'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import type { Message } from '@/lib/types/database'

const PAGE_SIZE = 60

export function useMessages(conversationId: string | null | undefined) {
  const { supabase } = useSupabase()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const prevConvIdRef = useRef<string | null>(null)
  const initializedRef = useRef(false)

  const loadInitial = useCallback(async (convId: string | null) => {
    if (!convId) {
      setMessages([])
      setLoading(false)
      setHasMore(false)
      return
    }

    setLoading(true)

    const { data, count } = await supabase
      .from('messages')
      .select('*', { count: 'exact' })
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    setMessages((data ?? []).reverse())
    setHasMore((count ?? 0) > PAGE_SIZE)
    setLoading(false)
  }, [supabase])

  const loadOlder = useCallback(async () => {
    if (!conversationId || messages.length === 0) return
    const oldest = messages[0].created_at

    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .lt('created_at', oldest)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (data && data.length > 0) {
      setMessages(prev => [...data.reverse(), ...prev])
      setHasMore(data.length === PAGE_SIZE)
    } else {
      setHasMore(false)
    }
  }, [conversationId, messages, supabase])

  useEffect(() => {
    if (prevConvIdRef.current === conversationId && initializedRef.current) return
    prevConvIdRef.current = conversationId ?? null
    initializedRef.current = true

    loadInitial(conversationId ?? null)

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    if (!conversationId) return

    const channel = supabase
      .channel(`messages:${conversationId}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incoming = payload.new as Message
          setMessages(prev => {
            // Replace optimistic placeholder if content matches
            const optimisticIdx = prev.findIndex(
              m => m.id.startsWith('optimistic-') && m.content === incoming.content
            )
            if (optimisticIdx !== -1) {
              const next = [...prev]
              next[optimisticIdx] = incoming
              return next
            }
            if (prev.some(m => m.id === incoming.id)) return prev
            return [...prev, incoming]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as Message
          setMessages(prev => prev.map(m => m.id === updated.id ? updated : m))
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, supabase])

  // Add an optimistic outbound message immediately (replaced when realtime fires)
  function addOptimisticMessage(content: string, tenantId: string, contactId: string) {
    if (!conversationId) return
    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      tenant_id: tenantId,
      conversation_id: conversationId,
      contact_id: contactId,
      content,
      content_type: 'text',
      direction: 'outbound',
      sender_type: 'agent',
      sender_id: null,
      media_url: null,
      media_mime_type: null,
      media_filename: null,
      media_size_bytes: null,
      wa_message_id: null,
      delivery_status: 'pending',
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])
  }

  return { messages, loading, hasMore, loadOlder, addOptimisticMessage }
}
