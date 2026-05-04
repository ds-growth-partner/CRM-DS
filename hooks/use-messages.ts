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

  const loadInitial = useCallback(async (convId: string | null) => {
    if (!convId) {
      setMessages([])
      setLoading(false)
      setHasMore(false)
      return
    }

    setLoading(true)

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (error) {
      console.error('[useMessages] load error:', error)
      setLoading(false)
      return
    }

    const rows = [...(data ?? [])].reverse() // newest 60, displayed oldest→newest
    console.log(`[useMessages] loaded ${rows.length} messages for conv ${convId}`)
    setMessages(rows)
    setHasMore(rows.length === PAGE_SIZE)
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
      const older = [...data].reverse()
      setMessages(prev => [...older, ...prev])
      setHasMore(data.length === PAGE_SIZE)
    } else {
      setHasMore(false)
    }
  }, [conversationId, messages, supabase])

  // Re-initialize whenever conversationId changes
  useEffect(() => {
    setMessages([])
    setLoading(true)
    setHasMore(false)

    // Clean up previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    if (!conversationId) {
      setLoading(false)
      return
    }

    loadInitial(conversationId)

    const channel = supabase
      .channel(`messages:conv:${conversationId}:${Date.now()}`)
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
            // Replace optimistic placeholder
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
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('[useMessages] realtime channel error for', conversationId)
        }
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, supabase]) // eslint-disable-line react-hooks/exhaustive-deps

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
