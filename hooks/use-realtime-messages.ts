'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import type { Message } from '@/lib/types/database'

const PAGE_SIZE = 40

export function useRealtimeMessages(conversationId: string | null) {
  const { supabase } = useSupabase()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Carga inicial: los últimos PAGE_SIZE mensajes
  const loadInitial = useCallback(async () => {
    if (!conversationId) {
      setMessages([])
      setLoading(false)
      setHasMore(false)
      return
    }

    setLoading(true)

    const { data, count } = await supabase
      .from('messages')
      .select('*', { count: 'exact' })
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    const reversed = (data ?? []).reverse()
    setMessages(reversed)
    setHasMore((count ?? 0) > PAGE_SIZE)
    setLoading(false)
  }, [conversationId, supabase])

  // Carga mensajes más antiguos (scroll hacia arriba)
  const loadOlder = useCallback(async () => {
    if (!conversationId || messages.length === 0 || loadingOlder) return

    setLoadingOlder(true)
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

    setLoadingOlder(false)
  }, [conversationId, messages, loadingOlder, supabase])

  useEffect(() => {
    loadInitial()

    // Limpiar canal anterior
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    if (!conversationId) return

    // Realtime: nuevos mensajes (INSERT)
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
          setMessages(prev => {
            // Evitar duplicados (optimistic + real)
            const exists = prev.some(m => m.id === payload.new.id || m.id.startsWith('optimistic-') && (m.content === (payload.new as Message).content))
            if (exists) {
              // Reemplazar optimístico por el real
              return prev.map(m =>
                m.id.startsWith('optimistic-') && m.content === (payload.new as Message).content
                  ? payload.new as Message
                  : m
              )
            }
            return [...prev, payload.new as Message]
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
          setMessages(prev =>
            prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } as Message : m)
          )
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadInitial, conversationId])

  function addOptimisticMessage(msg: Partial<Message>): string {
    const tempId = `optimistic-${Date.now()}`
    const optimistic: Message = {
      id: tempId,
      content: null,
      content_type: 'text',
      direction: 'outbound',
      sender_type: 'agent',
      sender_id: null,
      media_url: null,
      media_mime_type: null,
      media_filename: null,
      media_size_bytes: null,
      latitude: null,
      longitude: null,
      location_name: null,
      template_name: null,
      template_params: null,
      reaction_emoji: null,
      reacted_to_message_id: null,
      wa_message_id: null,
      delivery_status: 'pending',
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tenant_id: '',
      conversation_id: conversationId ?? '',
      contact_id: '',
      ...msg,
    }
    setMessages(prev => [...prev, optimistic])
    return tempId
  }

  function confirmOptimisticMessage(tempId: string, realMsg: Message) {
    setMessages(prev => prev.map(m => m.id === tempId ? realMsg : m))
  }

  function removeOptimisticMessage(tempId: string) {
    setMessages(prev => prev.filter(m => m.id !== tempId))
  }

  return {
    messages,
    loading,
    loadingOlder,
    hasMore,
    loadOlder,
    addOptimisticMessage,
    confirmOptimisticMessage,
    removeOptimisticMessage,
  }
}
