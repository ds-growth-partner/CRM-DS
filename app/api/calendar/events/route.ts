import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/supabase/auth-context'
import { getN8nClientForTenant } from '@/lib/n8n/client'
import { config } from '@/lib/config'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const body = await request.json()
  const { action, appointment: appt } = body

  let resultData = null
  // Normalize the operation so the n8n webhook path matches what actually happened
  // (delete must fire calendar-delete, not calendar-update).
  const op: 'create' | 'update' | 'delete' =
    action === 'delete' ? 'delete' : action === 'update' ? 'update' : 'create'

  if (op === 'delete') {
    const { error } = await admin.from('appointments').delete().eq('id', appt.id).eq('tenant_id', ctx.tenantId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  } else if (op === 'update') {
    const { data, error } = await admin.from('appointments').update({
      title: appt.title,
      description: appt.description,
      contact_id: appt.contact_id ?? null,
      assigned_to: appt.assigned_to ?? ctx.userId,
      start_time: appt.start_time,
      end_time: appt.end_time,
      timezone: appt.timezone ?? 'America/Bogota',
      location: appt.location,
      status: appt.status ?? 'scheduled',
    }).eq('id', appt.id).eq('tenant_id', ctx.tenantId).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    resultData = data
  } else {
    const { data, error } = await admin.from('appointments').insert({
      tenant_id: ctx.tenantId,
      title: appt.title,
      description: appt.description,
      contact_id: appt.contact_id ?? null,
      assigned_to: appt.assigned_to ?? ctx.userId,
      start_time: appt.start_time,
      end_time: appt.end_time,
      timezone: appt.timezone ?? 'America/Bogota',
      location: appt.location,
      status: 'scheduled',
      created_by: 'manual',
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    resultData = data
  }

  // ── Sync to Google Calendar via the *tenant's own* n8n ──────────────────────
  // Each client's calendar webhooks fire against their own n8n + Google Calendar.
  const { data: cred } = await admin
    .from('tenant_credentials')
    .select('n8n_base_url, google_calendar_id')
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  const hasN8n = !!(cred?.n8n_base_url?.trim() || process.env.N8N_BASE_URL)
  if (hasN8n) {
    let contact = null
    if (appt.contact_id) {
      // Los datos de perfil viven en contact_field_values; los devolvemos como mapa
      const { data: fv } = await admin
        .from('contact_field_values')
        .select('field_key, value')
        .eq('contact_id', appt.contact_id)
      const fields: Record<string, string> = {}
      for (const r of fv ?? []) if (r.value != null) fields[r.field_key] = r.value
      contact = { id: appt.contact_id, fields }
    }

    const payload = {
      action: op,
      appointment: { ...appt, ...(resultData || {}) },
      contact,
      tenant_id: ctx.tenantId,
      google_calendar_id: cred?.google_calendar_id || config.google.calendarId,
      timestamp: new Date().toISOString(),
    }

    try {
      const client = await getN8nClientForTenant(ctx.tenantId)
      await client.post(`calendar-${op}`, payload)
    } catch (e) {
      console.error(`Error triggering n8n calendar-${op}:`, e)
    }
  }

  return NextResponse.json({ ok: true, data: resultData })
}
