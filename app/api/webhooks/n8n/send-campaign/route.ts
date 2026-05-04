import { NextRequest, NextResponse } from 'next/server'
import { n8nClient } from '@/lib/n8n/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = { ...body, timestamp: new Date().toISOString() }

    const res = await n8nClient.post('send-campaign', payload)

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`[send-campaign] n8n returned ${res.status}:`, text)
      return NextResponse.json(
        { ok: false, n8n_status: res.status, message: 'n8n webhook error' },
        { status: 200 } // Always 200 to client — campaign was saved in DB regardless
      )
    }

    const data = await res.json().catch(() => ({}))
    return NextResponse.json({ ok: true, ...data })
  } catch (err) {
    console.error('[send-campaign] error:', err)
    return NextResponse.json(
      { ok: false, message: 'Error contacting n8n' },
      { status: 200 }
    )
  }
}
