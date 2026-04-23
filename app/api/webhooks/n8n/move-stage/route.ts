import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/supabase/auth-context'
import { N8nWebhookClient } from '@/lib/n8n/client'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { contact_id, new_stage_id } = body as Record<string, string>

  if (!contact_id) {
    return NextResponse.json({ error: 'Missing contact_id' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Try auth context (cookie-based session). May be null if session expired.
  const ctx = await getAuthContext().catch(() => null)

  // If no auth context, derive tenant from the contact itself using admin client
  let tenantId = ctx?.tenantId
  if (!tenantId) {
    const { data: contact } = await admin
      .from('contacts')
      .select('tenant_id')
      .eq('id', contact_id)
      .single()
    tenantId = contact?.tenant_id ?? undefined
  }

  if (!tenantId) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  const { data: creds } = await admin
    .from('tenant_credentials')
    .select('n8n_base_url, n8n_webhook_secret')
    .eq('tenant_id', tenantId)
    .single()

  // No n8n configured — update Supabase directly
  // The trigger log_phase_transition records the change in phase_transitions automatically
  if (!creds?.n8n_base_url) {
    const stageValue = new_stage_id === 'no-stage' ? null : (new_stage_id || null)
    await admin
      .from('contacts')
      .update({ funnel_stage_id: stageValue, updated_at: new Date().toISOString() })
      .eq('id', contact_id)
    return NextResponse.json({ ok: true })
  }

  const payload = {
    ...body,
    tenant_id: tenantId,
    moved_by: ctx?.userId ?? 'system',
    timestamp: new Date().toISOString(),
  }

  const client = new N8nWebhookClient(creds.n8n_base_url, creds.n8n_webhook_secret ?? '')
  const res = await client.post('move-stage', payload)
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
