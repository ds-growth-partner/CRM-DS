import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/auth-context'
import { n8nClient } from '@/lib/n8n/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('[Webhook] Sending message to n8n:', body)
    
    const res = await n8nClient.post('send-message', body)
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
