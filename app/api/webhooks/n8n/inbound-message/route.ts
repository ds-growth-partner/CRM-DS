/**
 * POST /api/webhooks/n8n/inbound-message
 *
 * n8n llama este endpoint cuando llega un mensaje de WhatsApp o cuando el bot
 * genera una respuesta. Escribe en Supabase y el Realtime propaga el cambio al CRM.
 *
 * Autenticación: header X-N8n-Secret debe coincidir con tenant_credentials.n8n_webhook_secret
 *
 * Body esperado:
 * {
 *   tenant_id: string            // requerido
 *   wa_id: string                // número de WhatsApp del contacto (sin +)
 *   phone: string                // igual que wa_id, con formato E.164
 *   contact_name?: string        // nombre del contacto (para crearlo si no existe)
 *   message: {
 *     wa_message_id?: string     // ID de WhatsApp
 *     content?: string           // texto del mensaje
 *     content_type?: string      // 'text' | 'image' | 'audio' | 'video' | 'document' | ...
 *     direction: 'inbound' | 'outbound'
 *     sender_type: 'contact' | 'bot' | 'agent'
 *     media_url?: string
 *     media_mime_type?: string
 *     media_filename?: string
 *     template_name?: string
 *     timestamp?: string         // ISO 8601
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const admin = createAdminClient()

  // Parse body first
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const tenant_id = body.tenant_id as string
  if (!tenant_id) {
    return NextResponse.json({ error: 'tenant_id required' }, { status: 400 })
  }

  // Validate secret if configured
  const { data: creds } = await admin
    .from('tenant_credentials')
    .select('n8n_webhook_secret')
    .eq('tenant_id', tenant_id)
    .single()

  const incomingSecret = request.headers.get('x-n8n-secret')
  if (creds?.n8n_webhook_secret && incomingSecret !== creds.n8n_webhook_secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { wa_id, phone, contact_name, message } = body as {
    wa_id: string
    phone: string
    contact_name?: string
    message: {
      wa_message_id?: string
      content?: string
      content_type?: string
      direction: 'inbound' | 'outbound'
      sender_type: 'contact' | 'bot' | 'agent'
      media_url?: string
      media_mime_type?: string
      media_filename?: string
      media_size_bytes?: number
      template_name?: string
      timestamp?: string
    }
  }

  if (!wa_id || !message?.direction) {
    return NextResponse.json({ error: 'wa_id and message.direction required' }, { status: 400 })
  }

  // 1. Find or create contact
  let { data: contact } = await admin
    .from('contacts')
    .select('id')
    .eq('tenant_id', tenant_id)
    .eq('wa_id', wa_id)
    .single()

  if (!contact) {
    const nameParts = (contact_name ?? '').trim().split(' ')
    const first_name = nameParts[0] || phone || wa_id
    const last_name = nameParts.slice(1).join(' ') || null

    const { data: newContact, error: contactError } = await admin
      .from('contacts')
      .insert({
        tenant_id,
        first_name,
        last_name,
        phone: phone ?? `+${wa_id}`,
        wa_id,
        source: 'whatsapp',
        ai_active: true,
        country: 'CO',
        lead_score: 0,
        custom_fields: {},
      })
      .select('id')
      .single()

    if (contactError || !newContact) {
      console.error('[inbound-message] Error creating contact:', contactError)
      return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 })
    }
    contact = newContact
  }

  // 2. Find or create open conversation for this contact
  let { data: conversation } = await admin
    .from('conversations')
    .select('id, unread_count')
    .eq('tenant_id', tenant_id)
    .eq('contact_id', contact.id)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const now = message.timestamp ?? new Date().toISOString()

  if (!conversation) {
    const { data: newConv, error: convError } = await admin
      .from('conversations')
      .insert({
        tenant_id,
        contact_id: contact.id,
        status: 'open',
        ai_active: true,
        unread_count: message.direction === 'inbound' ? 1 : 0,
        last_message_at: now,
        last_message_preview: message.content ?? '[media]',
        last_message_direction: message.direction,
        window_expires_at: message.direction === 'inbound'
          ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          : null,
      })
      .select('id, unread_count')
      .single()

    if (convError || !newConv) {
      console.error('[inbound-message] Error creating conversation:', convError)
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
    }
    conversation = newConv
  }

  // 3. Update conversation metadata
  const unreadIncrement = message.direction === 'inbound' ? (conversation.unread_count ?? 0) + 1 : 0
  await admin
    .from('conversations')
    .update({
      last_message_at: now,
      last_message_preview: message.content ?? '[media]',
      last_message_direction: message.direction,
      unread_count: message.direction === 'inbound' ? unreadIncrement : 0,
      updated_at: new Date().toISOString(),
      ...(message.direction === 'inbound' && {
        window_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }),
    })
    .eq('id', conversation.id)

  // 4. Update contact last_incoming_at if inbound
  if (message.direction === 'inbound') {
    await admin
      .from('contacts')
      .update({
        last_incoming_at: now,
        last_contacted_at: now,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contact.id)
  }

  return NextResponse.json({
    ok: true,
    conversation_id: conversation.id,
    contact_id: contact.id,
  })
}
