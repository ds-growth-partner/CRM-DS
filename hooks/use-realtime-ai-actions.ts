'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import type { AIAction } from '@/lib/types/database'

/**
 * Carga las acciones de la IA de un contacto.
 *
 * OJO: el agente n8n inserta `ai_actions` con `conversation_id = NULL`
 * (solo setea `contact_id`), así que filtramos por contacto, no por
 * conversación. Un contacto suele tener una sola conversación.
 */
export function useRealtimeAIActions(contactId: string | null) {
  const { supabase } = useSupabase()
  const [actions, setActions] = useState<AIAction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!contactId) {
      setActions([])
      setLoading(false)
      return
    }

    setLoading(true)
    supabase
      .from('ai_actions')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setActions(data ?? [])
        setLoading(false)
      })

    const channel = supabase
      .channel(`ai-actions:${contactId}-${Math.random()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_actions',
          filter: `contact_id=eq.${contactId}`,
        },
        (payload) => {
          const incoming = payload.new as AIAction
          setActions(prev => prev.some(a => a.id === incoming.id) ? prev : [incoming, ...prev])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [contactId, supabase])

  return { actions, loading }
}
