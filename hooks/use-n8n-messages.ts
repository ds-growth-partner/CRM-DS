'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import type { N8nChatHistory } from '@/lib/types/database'

const PAGE_SIZE = 60

/**
 * Loads messages from n8n_chat_histories for a given contact.
 *
 * session_id is tenant-scoped: '<tenant_id>:<wa_id>' (e.g.
 * "126b2385-…:573001234567"). This MUST match the sessionKey configured in the
 * tenant's n8n Chat Memory node — otherwise the same phone writing to two clients
 * would share memory. Pass the tenant id so the key is built consistently.
 */
export function useN8nMessages(
  waId: string | null | undefined,
  tenantId: string | null | undefined,
) {
  const { supabase } = useSupabase()
  const [messages, setMessages] = useState<N8nChatHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const pendingOptimistic = useRef<Set<string>>(new Set())
  // Track the previous sessionId so we only re-initialize when it truly changes
  const prevSessionIdRef = useRef<string | null>(null)
  const initializedRef = useRef(false)

  // Tenant-scoped key: '<tenant_id>:<wa_id>'
  const sessionId = waId && tenantId ? `${tenantId}:${waId}` : null

  const loadInitial = useCallback(async (sid: string | null) => {
    if (!sid) {
      setMessages([])
      setLoading(false)
      setHasMore(false)
      return
    }

    setLoading(true)

    const { data, count } = await supabase
      .from('n8n_chat_histories')
      .select('*', { count: 'exact' })
      .eq('session_id', sid)
      .order('time_stamp', { ascending: false })
      .limit(PAGE_SIZE)

    setMessages((data ?? []).reverse())
    setHasMore((count ?? 0) > PAGE_SIZE)
    setLoading(false)
  }, [supabase])

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
    // Only re-initialize when sessionId actually changes value
    if (prevSessionIdRef.current === sessionId && initializedRef.current) {
      return
    }
    prevSessionIdRef.current = sessionId
    initializedRef.current = true

    loadInitial(sessionId)

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
          // RLS-protected tables only deliver realtime when the subscription is filtered.
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const incoming = payload.new as N8nChatHistory
          if (incoming.session_id !== sessionId) return
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const content = (incoming.message as any)?.content as string | undefined
          if (content && pendingOptimistic.current.has(content)) {
            // Replace the optimistic placeholder with the real row
            pendingOptimistic.current.delete(content)
            setMessages(prev => [
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ...prev.filter(m => m.id > 0 || (m.message as any)?.content !== content),
              incoming,
            ])
          } else {
            setMessages(prev => {
              if (prev.some(m => m.id === incoming.id)) return prev
              return [...prev, incoming]
            })
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, supabase])

  function addOptimisticMessage(content: string) {
    if (!sessionId) return
    pendingOptimistic.current.add(content)
    setMessages(prev => [
      ...prev,
      {
        id: -Date.now(),
        session_id: sessionId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        message: { type: 'ai', content, additional_kwargs: { sender: 'agent' } } as any,
        time_stamp: new Date().toISOString(),
      } as N8nChatHistory,
    ])
  }

  return { messages, loading, hasMore, loadOlder, addOptimisticMessage }
}
