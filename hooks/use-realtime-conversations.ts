'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import type { ConversationWithContact, N8nMessage } from '@/lib/types/database'
import type { ConversationFilters } from '@/lib/types/shared'

/** Extrae el texto legible de un mensaje JSONB de n8n */
function extractN8nContent(message: unknown): string | null {
  if (!message) return null
  const msg = message as N8nMessage
  if (typeof msg.content === 'string' && msg.content) return msg.content
  if (msg.data?.content) return msg.data.content
  return null
}

export function useRealtimeConversations(filters: ConversationFilters = {}) {
  const { supabase } = useSupabase()
  const [conversations, setConversations] = useState<ConversationWithContact[]>([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const loadConversations = useCallback(async () => {
    setLoading(true)

    // ── 1. Contactos del tenant con wa_id ─────────────────────────────────
    // RLS asegura que solo vemos los contactos del tenant autenticado
    const { data: contacts } = await supabase
      .from('contacts')
      .select(`
        *,
        funnel_stage:funnel_stages(*),
        contact_tags(tag:tags(*))
      `)
      .not('wa_id', 'is', null)

    if (!contacts?.length) {
      setConversations([])
      setLoading(false)
      return
    }

    const waIds = contacts.map(c => c.wa_id as string)

    // ── 2. Último mensaje de n8n por cada wa_id ───────────────────────────
    const { data: latestMsgs } = await supabase
      .rpc('get_latest_n8n_messages', { p_session_ids: waIds })

    type LatestMsg = { session_id: string; last_message: N8nMessage; last_message_at: string }
    const msgMap = new Map<string, LatestMsg>(
      ((latestMsgs ?? []) as LatestMsg[]).map(m => [m.session_id, m])
    )

    // Solo contactos que tienen al menos un mensaje en n8n
    const contactsWithMsgs = contacts.filter(c => msgMap.has(c.wa_id as string))

    if (!contactsWithMsgs.length) {
      setConversations([])
      setLoading(false)
      return
    }

    // ── 3. Estado de conversaciones (status, unread, ai_active, agente) ───
    const { data: existingConvs } = await supabase
      .from('conversations')
      .select('*, assigned_agent:users!conversations_assigned_agent_id_fkey(id, full_name, avatar_url, role)')

    const convMap = new Map(((existingConvs ?? []) as NonNullable<typeof existingConvs>).map(c => [c.contact_id, c]))

    // ── 4. Auto-crear conversations para contactos que no tienen registro ──
    const missingConvContacts = contactsWithMsgs.filter(c => !convMap.has(c.id))

    if (missingConvContacts.length > 0) {
      const tenantId = missingConvContacts[0].tenant_id
      const toInsert = missingConvContacts.map(c => {
        const msg = msgMap.get(c.wa_id as string)!
        return {
          tenant_id: tenantId,
          contact_id: c.id,
          status: 'open' as const,
          ai_active: c.ai_active,
          unread_count: 0,
          last_message_at: msg.last_message_at,
          last_message_preview: extractN8nContent(msg.last_message)?.slice(0, 100) ?? null,
          last_message_direction: (msg.last_message as N8nMessage)?.type === 'human'
            ? 'inbound' as const
            : 'outbound' as const,
        }
      })

      const { data: newConvs } = await supabase
        .from('conversations')
        .upsert(toInsert, { onConflict: 'contact_id' })
        .select('*, assigned_agent:users!conversations_assigned_agent_id_fkey(id, full_name, avatar_url, role)')

      newConvs?.forEach(c => convMap.set(c.contact_id, c))
    }

    // ── 5. Construir objetos ConversationWithContact ───────────────────────
    let result: ConversationWithContact[] = contactsWithMsgs
      .map(contact => {
        const conv = convMap.get(contact.id)
        if (!conv) return null

        const msg = msgMap.get(contact.wa_id as string)!
        const content = extractN8nContent(msg.last_message)
        const direction = (msg.last_message as N8nMessage)?.type === 'human' ? 'inbound' : 'outbound'

        return {
          ...conv,
          contact: {
            ...contact,
            funnel_stage: (contact as any).funnel_stage ?? null,
            tags: ((contact as any).contact_tags as { tag: unknown }[] ?? []).map(ct => ct.tag),
          },
          last_message_at: msg.last_message_at,
          last_message_preview: content?.slice(0, 100) ?? null,
          last_message_direction: direction,
        } as ConversationWithContact
      })
      .filter(Boolean) as ConversationWithContact[]

    // ── 6. Filtros ────────────────────────────────────────────────────────
    if (filters.status) result = result.filter(c => c.status === filters.status)
    if (filters.ai_active !== undefined) result = result.filter(c => c.ai_active === filters.ai_active)
    if (filters.assigned_to) result = result.filter(c => c.assigned_agent_id === filters.assigned_to)
    if (filters.funnel_stage_id) {
      result = result.filter(c => c.contact.funnel_stage?.id === filters.funnel_stage_id)
    }
    if (filters.tag_id) {
      result = result.filter(c =>
        (c.contact.tags ?? []).some((t: any) => t.id === filters.tag_id)
      )
    }
    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(c => {
        const name = `${c.contact.first_name} ${c.contact.last_name ?? ''}`.toLowerCase()
        const phone = (c.contact.phone ?? '').toLowerCase()
        const email = (c.contact.email ?? '').toLowerCase()
        const preview = (c.last_message_preview ?? '').toLowerCase()
        return name.includes(q) || phone.includes(q) || email.includes(q) || preview.includes(q)
      })
    }

    // Ordenar por último mensaje
    result.sort((a, b) => {
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
      return tb - ta
    })

    setConversations(result)
    setLoading(false)
  }, [supabase, JSON.stringify(filters)]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadConversations()

    if (channelRef.current) supabase.removeChannel(channelRef.current)

    const channel = supabase
      .channel(`conversations-realtime-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => loadConversations())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'n8n_chat_histories' }, () => loadConversations())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => loadConversations())
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [loadConversations])

  return { conversations, loading, refetch: loadConversations }
}
