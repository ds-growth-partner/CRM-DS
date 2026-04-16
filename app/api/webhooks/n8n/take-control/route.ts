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
    .select('n8n_base_url, n8n_webhook_secret')
    .eq('tenant_id', ctx.tenantId)
    .single()

  const body = await request.json()
  const payload = { ...body, tenant_id: ctx.tenantId, timestamp: new Date().toISOString() }

  if (!creds?.n8n_base_url) {
    console.log('[DEV] n8n not configured, mock take-control:', payload)
    return NextResponse.json({ ok: true, dev: true })
  }

  const client = new N8nWebhookClient(creds.n8n_base_url, creds.n8n_webhook_secret ?? '')
  const res = await client.post('take-control', payload)
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
