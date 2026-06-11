import { headers } from 'next/headers'
import { Webhook } from 'svix'
import { createAdminClient } from '@/lib/supabase/server'
import { config } from '@/lib/config'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

// Auto-register the user as a super admin if their email is in SUPER_ADMIN_EMAILS.
// Also de-registers them if they're removed from the list.
async function syncSuperAdmin(
  supabase: SupabaseAdmin,
  clerkUserId: string,
  email: string,
  name: string | null,
) {
  if (!email) return
  const isSuper = config.superAdminEmails.includes(email.toLowerCase())

  if (isSuper) {
    await supabase.from('super_admins').upsert(
      { clerk_user_id: clerkUserId, email, name, is_active: true },
      { onConflict: 'clerk_user_id' },
    )
  } else {
    // Demote anyone no longer in the env list (idempotent — no-op if not present)
    await supabase
      .from('super_admins')
      .update({ is_active: false })
      .eq('clerk_user_id', clerkUserId)
  }
}

type ClerkEvent = {
  type: string
  data: Record<string, unknown>
}

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
  if (!webhookSecret) {
    return new Response('Webhook secret not configured', { status: 500 })
  }

  const headerPayload = await headers()
  const svixId = headerPayload.get('svix-id')
  const svixTimestamp = headerPayload.get('svix-timestamp')
  const svixSignature = headerPayload.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('Missing svix headers', { status: 400 })
  }

  const payload = await req.json()
  const body = JSON.stringify(payload)

  const wh = new Webhook(webhookSecret)
  let event: ClerkEvent

  try {
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkEvent
  } catch {
    return new Response('Invalid webhook signature', { status: 400 })
  }

  const supabase = createAdminClient()

  switch (event.type) {
    // ── User created ──────────────────────────────────────────────────────
    case 'user.created': {
      const d = event.data
      const primaryEmail = (d.email_addresses as Array<{ email_address: string; id: string }>)
        ?.find((e) => e.id === d.primary_email_address_id)?.email_address ?? ''

      const fullName = [d.first_name, d.last_name].filter(Boolean).join(' ') || null
      await supabase.from('users').upsert({
        clerk_user_id: d.id as string,
        email: primaryEmail,
        full_name: fullName,
        avatar_url: (d.image_url as string) || null,
      }, { onConflict: 'clerk_user_id' })
      await syncSuperAdmin(supabase, d.id as string, primaryEmail, fullName)
      break
    }

    // ── User updated ──────────────────────────────────────────────────────
    case 'user.updated': {
      const d = event.data
      const primaryEmail = (d.email_addresses as Array<{ email_address: string; id: string }>)
        ?.find((e) => e.id === d.primary_email_address_id)?.email_address ?? ''

      const fullName = [d.first_name, d.last_name].filter(Boolean).join(' ') || null
      await supabase.from('users')
        .update({
          email: primaryEmail,
          full_name: fullName,
          avatar_url: (d.image_url as string) || null,
        })
        .eq('clerk_user_id', d.id as string)
      await syncSuperAdmin(supabase, d.id as string, primaryEmail, fullName)
      break
    }

    // ── Organization created → create tenant ──────────────────────────────
    case 'organization.created': {
      const d = event.data
      const slug = (d.slug as string) || (d.name as string).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

      await supabase.from('tenants').upsert({
        clerk_org_id: d.id as string,
        name: d.name as string,
        slug,
        logo_url: (d.image_url as string) || null,
      }, { onConflict: 'clerk_org_id' })
      break
    }

    // ── Organization updated ──────────────────────────────────────────────
    case 'organization.updated': {
      const d = event.data
      await supabase.from('tenants')
        .update({
          name: d.name as string,
          logo_url: (d.image_url as string) || null,
        })
        .eq('clerk_org_id', d.id as string)
      break
    }

    // ── Member added to org → link user to tenant ─────────────────────────
    case 'organizationMembership.created': {
      const d = event.data
      const orgId = (d.organization as { id: string }).id
      const userId = (d.public_user_data as { user_id: string }).user_id
      const role = mapClerkRole(d.role as string)

      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('clerk_org_id', orgId)
        .single()

      if (tenant) {
        await supabase.from('users')
          .update({ tenant_id: tenant.id, role })
          .eq('clerk_user_id', userId)
      }
      break
    }

    // ── Member role changed ───────────────────────────────────────────────
    case 'organizationMembership.updated': {
      const d = event.data
      const userId = (d.public_user_data as { user_id: string }).user_id
      const role = mapClerkRole(d.role as string)

      await supabase.from('users')
        .update({ role })
        .eq('clerk_user_id', userId)
      break
    }

    // ── Member removed ────────────────────────────────────────────────────
    case 'organizationMembership.deleted': {
      const d = event.data
      const userId = (d.public_user_data as { user_id: string }).user_id

      await supabase.from('users')
        .update({ tenant_id: null, is_active: false })
        .eq('clerk_user_id', userId)
      break
    }
  }

  return new Response('OK', { status: 200 })
}

function mapClerkRole(clerkRole: string): 'owner' | 'admin' | 'agent' | 'viewer' {
  switch (clerkRole) {
    case 'org:owner': return 'owner'
    case 'org:admin': return 'admin'
    case 'org:viewer': return 'viewer'
    default: return 'agent' // org:member
  }
}
