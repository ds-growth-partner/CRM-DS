import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/auth-context'
import { getN8nClientForTenant } from '@/lib/n8n/client'

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const payload = { ...body, tenant_id: ctx.tenantId }
    console.log('[Webhook] Sending message to tenant n8n:', { tenant_id: ctx.tenantId })

    const client = await getN8nClientForTenant(ctx.tenantId)
    const res = await client.post('send-message', payload)
    const data = await res.json().catch(() => ({}))

    console.log(`[Webhook] n8n responded with status ${res.status}:`, data)

    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    console.error('[Webhook] Error calling n8n:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
