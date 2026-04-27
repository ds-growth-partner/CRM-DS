import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/auth-context'
import { n8nClient } from '@/lib/n8n/client'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['owner', 'admin'].includes(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const payload = { ...body, tenant_id: ctx.tenantId, created_by: ctx.userId, timestamp: new Date().toISOString() }

  const res = await n8nClient.post('send-campaign', payload)
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
