'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import type { ContactNote } from '@/lib/types/database'

/**
 * Carga las notas de un contacto (tabla `contact_notes`) en tiempo real.
 * El bot puede dejar notas aquí (created_by IS NULL) y aparecen al instante
 * en el panel del contacto.
 */
export function useContactNotes(contactId: string | null) {
  const { supabase } = useSupabase()
  const [notes, setNotes] = useState<ContactNote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!contactId) {
      setNotes([])
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    supabase
      .from('contact_notes')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (!active) return
        setNotes(data ?? [])
        setLoading(false)
      })

    const channel = supabase
      .channel(`contact-notes:${contactId}-${Math.random()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'contact_notes', filter: `contact_id=eq.${contactId}` },
        (payload) => {
          const incoming = payload.new as ContactNote
          setNotes(prev => prev.some(n => n.id === incoming.id) ? prev : [incoming, ...prev])
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'contact_notes', filter: `contact_id=eq.${contactId}` },
        (payload) => {
          const old = payload.old as ContactNote
          setNotes(prev => prev.filter(n => n.id !== old.id))
        }
      )
      .subscribe()

    return () => { active = false; supabase.removeChannel(channel) }
  }, [contactId, supabase])

  return { notes, loading }
}
