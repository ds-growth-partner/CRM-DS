import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, resolveTenantId } from '@/lib/supabase/auth-context'
import { getN8nClientForTenant } from '@/lib/n8n/client'

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    // Honra la impersonación de super admin: el cliente envía el tenant_id de la
    // conversación; se usa solo si el usuario tiene permiso (super admin).
    const tenantId = await resolveTenantId(ctx, body.tenant_id)
    const payload = { ...body, tenant_id: tenantId }
    console.log('[Webhook] Sending message to tenant n8n:', { tenant_id: tenantId })

    const client = await getN8nClientForTenant(tenantId)
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
