'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import type { AIAction } from '@/lib/types/database'

export function useRealtimeAIActions(conversationId: string | null) {
  const { supabase } = useSupabase()
  const [actions, setActions] = useState<AIAction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!conversationId) {
      setActions([])
      setLoading(false)
      return
    }

    supabase
      .from('ai_actions')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setActions(data ?? [])
        setLoading(false)
      })

    const channel = supabase
      .channel(`ai-actions:${conversationId}-${Math.random()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_actions',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setActions(prev => [payload.new as AIAction, ...prev])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId, supabase])

  return { actions, loading }
}
