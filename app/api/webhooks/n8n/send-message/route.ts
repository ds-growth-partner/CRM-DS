import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/auth-context'
import { n8nClient } from '@/lib/n8n/client'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const payload = { ...body, tenant_id: ctx.tenantId, agent_id: ctx.userId }

  const res = await n8nClient.post('send-message', payload)
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
