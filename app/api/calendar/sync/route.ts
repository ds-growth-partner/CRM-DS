import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/auth-context'
import { config } from '@/lib/config'
import { n8nClient } from '@/lib/n8n/client'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = {
    tenant_id: ctx.tenantId,
    google_calendar_id: config.google.calendarId,
    sync_range_days: 30,
    direction: 'bidirectional',
    timestamp: new Date().toISOString(),
  }

  const res = await n8nClient.post('calendar-sync', payload)
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
