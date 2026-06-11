import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/auth-context'
import { getN8nClientForTenant } from '@/lib/n8n/client'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const payload = { ...body, tenant_id: ctx.tenantId, timestamp: new Date().toISOString() }

  const client = await getN8nClientForTenant(ctx.tenantId)
  const res = await client.post('take-control', payload)
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
