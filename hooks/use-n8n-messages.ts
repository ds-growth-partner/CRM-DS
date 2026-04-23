'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import type { N8nChatHistory } from '@/lib/types/database'

const PAGE_SIZE = 60

/**
 * Loads messages from n8n_chat_histories for a given contact wa_id.
 * n8n stores session_id as "<phone>@s.whatsapp.net" (WhatsApp Web format).
 * wa_id in the CRM is stored as the phone number without the @s.whatsapp.net suffix.
 */
export function useN8nMessages(waId: string | null | undefined) {
  const { supabase } = useSupabase()
  const [messages, setMessages] = useState<N8nChatHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // n8n session_id is "<waId>@s.whatsapp.net"
  const sessionId = waId ? `${waId}@s.whatsapp.net` : null

  const loadInitial = useCallback(async () => {
    if (!sessionId) {
      setMessages([])
      setLoading(false)
      setHasMore(false)
      return
    }

    setLoading(true)

    const { data, count } = await supabase
      .from('n8n_chat_histories')
      .select('*', { count: 'exact' })
      .eq('session_id', sessionId)
      .order('time_stamp', { ascending: false })
      .limit(PAGE_SIZE)

    setMessages((data ?? []).reverse())
    setHasMore((count ?? 0) > PAGE_SIZE)
    setLoading(false)
  }, [sessionId, supabase])

  const loadOlder = useCallback(async () => {
    if (!sessionId || messages.length === 0) return

    const oldest = messages[0].time_stamp

    const { data } = await supabase
      .from('n8n_chat_histories')
      .select('*')
      .eq('session_id', sessionId)
      .lt('time_stamp', oldest)
      .order('time_stamp', { ascending: false })
      .limit(PAGE_SIZE)

    if (data && data.length > 0) {
      setMessages(prev => [...data.reverse(), ...prev])
      setHasMore(data.length === PAGE_SIZE)
    } else {
      setHasMore(false)
    }
  }, [sessionId, messages, supabase])

  useEffect(() => {
    loadInitial()

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    if (!sessionId) return

    const channel = supabase
      .channel(`n8n:${sessionId}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'n8n_chat_histories',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setMessages(prev => {
            const exists = prev.some(m => m.id === (payload.new as N8nChatHistory).id)
            if (exists) return prev
            return [...prev, payload.new as N8nChatHistory]
          })
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadInitial, sessionId])

  return { messages, loading, hasMore, loadOlder }
}
