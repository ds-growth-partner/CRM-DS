import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/supabase/auth-context'
import { n8nClient } from '@/lib/n8n/client'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { contact_id, new_stage_id } = body as Record<string, string>

  if (!contact_id) {
    return NextResponse.json({ error: 'Missing contact_id' }, { status: 400 })
  }

  const admin = createAdminClient()
  const ctx = await getAuthContext().catch(() => null)
  let tenantId = ctx?.tenantId

  if (!tenantId) {
    const { data: contact } = await admin.from('contacts').select('tenant_id').eq('id', contact_id).single()
    tenantId = contact?.tenant_id ?? undefined
  }

  if (!tenantId) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  // Si no hay n8n configurado, actualizar directamente en Supabase
  if (!process.env.N8N_BASE_URL) {
    const stageValue = new_stage_id === 'no-stage' ? null : (new_stage_id || null)
    await admin.from('contacts').update({ funnel_stage_id: stageValue, updated_at: new Date().toISOString() }).eq('id', contact_id)
    return NextResponse.json({ ok: true })
  }

  const payload = {
    ...body,
    tenant_id: tenantId,
    moved_by: ctx?.userId ?? 'system',
    timestamp: new Date().toISOString(),
  }

  const res = await n8nClient.post('move-stage', payload)
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
