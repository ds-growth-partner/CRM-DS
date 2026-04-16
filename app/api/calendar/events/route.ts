import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/supabase/auth-context'
import { N8nWebhookClient } from '@/lib/n8n/client'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: creds } = await admin
    .from('tenant_credentials')
    .select('n8n_base_url, n8n_webhook_secret, google_calendar_id')
    .eq('tenant_id', ctx.tenantId)
    .single()

  const body = await request.json()
  const payload = {
    ...body,
    tenant_id: ctx.tenantId,
    google_calendar_id: creds?.google_calendar_id ?? 'primary',
    timestamp: new Date().toISOString(),
  }

  if (!creds?.n8n_base_url) {
    // Dev: create appointment directly in Supabase
    const appt = body.appointment
    const { data } = await admin.from('appointments').insert({
      tenant_id: ctx.tenantId,
      title: appt.title,
      description: appt.description,
      contact_id: appt.contact_id ?? null,
      assigned_to: appt.assigned_to ?? ctx.userId,
      start_time: appt.start_time,
      end_time: appt.end_time,
      timezone: appt.timezone ?? 'America/Bogota',
      location: appt.location,
      created_by: 'manual',
      created_by_user_id: ctx.userId,
    }).select().single()
    return NextResponse.json({ ok: true, dev: true, data })
  }

  const client = new N8nWebhookClient(creds.n8n_base_url, creds.n8n_webhook_secret ?? '')
  const res = await client.post('calendar-event', payload)
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
