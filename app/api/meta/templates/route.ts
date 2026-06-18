import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/supabase/auth-context'

// Reads the tenant's OWN Meta credentials (never global env) so each client
// syncs its own WhatsApp Business Account.
async function getTenantMeta(tenantId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('tenant_credentials')
    .select('meta_access_token, waba_id')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  return {
    accessToken: data?.meta_access_token?.trim() || '',
    wabaId: data?.waba_id?.trim() || '',
  }
}

export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { accessToken, wabaId } = await getTenantMeta(ctx.tenantId)

  // No per-tenant Meta creds in the CRM → read what the tenant's n8n already
  // synced into hsm_templates (this is the default in the per-client-n8n model).
  if (!accessToken || !wabaId) {
    const { data } = await admin
      .from('hsm_templates')
      .select('*')
      .eq('tenant_id', ctx.tenantId)
      .order('created_at', { ascending: false })
    return NextResponse.json({ templates: data ?? [], source: 'db' })
  }

  // Tenant has its own Meta creds → sync live from its WABA.
  const metaRes = await fetch(
    `https://graph.facebook.com/v19.0/${wabaId}/message_templates?fields=name,status,language,category,components&limit=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!metaRes.ok) {
    return NextResponse.json({ error: 'Meta API error' }, { status: metaRes.status })
  }

  const metaData = await metaRes.json()
  const templates = (metaData.data ?? []).map((t: Record<string, unknown>) => ({
    tenant_id: ctx.tenantId,
    meta_template_id: t.id,
    name: t.name,
    language: t.language,
    category: t.category,
    status: t.status,
    body_text: (t.components as { type: string; text: string }[])?.find(c => c.type === 'BODY')?.text ?? '',
    header_text: (t.components as { type: string; text: string }[])?.find(c => c.type === 'HEADER')?.text,
    footer_text: (t.components as { type: string; text: string }[])?.find(c => c.type === 'FOOTER')?.text,
    variables_count: (new Set(
      (t.components as { text: string }[])
        ?.map(c => c.text ?? '')
        .join(' ')
        .match(/\{\{(.+?)\}\}/g) ?? []
    )).size,
    last_synced_at: new Date().toISOString(),
  }))

  if (templates.length > 0) {
    await admin.from('hsm_templates').upsert(templates, { onConflict: 'tenant_id,meta_template_id' })
  }

  return NextResponse.json({ templates, source: 'meta' })
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['owner', 'admin'].includes(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { accessToken, wabaId } = await getTenantMeta(ctx.tenantId)
  if (!accessToken || !wabaId) {
    return NextResponse.json(
      { error: 'Este cliente no tiene credenciales de Meta configuradas. Crea la plantilla desde su n8n o configura meta_access_token + waba_id en /admin.' },
      { status: 400 }
    )
  }

  const body = await request.json()

  const metaRes = await fetch(
    `https://graph.facebook.com/v19.0/${wabaId}/message_templates`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  const data = await metaRes.json()
  return NextResponse.json(data, { status: metaRes.status })
}
