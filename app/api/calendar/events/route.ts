import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/supabase/auth-context'
import { config } from '@/lib/config'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const body = await request.json()
  const { action, appointment: appt } = body

  let resultData = null

  if (action === 'delete') {
    const { error } = await admin.from('appointments').delete().eq('id', appt.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  } else if (action === 'update') {
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
    }).eq('id', appt.id).select().single()
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
      created_by_user_id: ctx.userId,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    resultData = data
  }

  if (n8nUrl) {
    const action = appointment?.id ? 'update' : 'create'
    const webhookPath = action === 'create' ? 'calendar-create' : 'calendar-update'

    let contact = null
    if (appt.contact_id) {
      const { data } = await admin.from('contacts').select('first_name, last_name, email, phone').eq('id', appt.contact_id).single()
      contact = data
    }

    const payload = {
      action,
      appointment: { ...appt, ...(resultData || {}) },
      contact,
      tenant_id: ctx.tenantId,
      google_calendar_id: config.google.calendarId,
      timestamp: new Date().toISOString(),
    }

    const { n8nClient } = await import('@/lib/n8n/client')
    try {
      await n8nClient.post(webhookPath, payload)
    } catch (e) {
      console.error(`Error triggering n8n ${webhookPath}:`, e)
    }
  }

  return NextResponse.json({ ok: true, data: resultData })
}
