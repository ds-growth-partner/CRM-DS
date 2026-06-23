'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import type { Contact, FunnelStage, Tag, ContactFields } from '@/lib/types/database'
import { toFieldMap, CONTACT_FIELDS_EMBED } from '@/lib/utils/contact-fields'

export type ContactFull = Contact & {
  funnel_stage?: FunnelStage | null
  tags?: Tag[]
  fields?: ContactFields
}

export function useRealtimeContact(contactId: string | null) {
  const { supabase } = useSupabase()
  const [contact, setContact] = useState<ContactFull | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadContact(id: string) {
    const { data } = await supabase
      .from('contacts')
      .select(`
        *,
        funnel_stage:funnel_stages(*),
        contact_tags(tag:tags(*)),
        ${CONTACT_FIELDS_EMBED}
      `)
      .eq('id', id)
      .single()

    if (data) {
      const tags = (data.contact_tags as unknown as { tag: Tag }[])?.map(ct => ct.tag) ?? []
      const fields = toFieldMap((data as { contact_field_values?: { field_key: string; value: string | null }[] }).contact_field_values)
      setContact({ ...data, tags, funnel_stage: data.funnel_stage, fields } as ContactFull)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!contactId) {
      setContact(null)
      setLoading(false)
      return
    }

    setLoading(true)
    loadContact(contactId)

    const channel = supabase
      .channel(`contact:${contactId}-${Math.random()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'contacts',
          filter: `id=eq.${contactId}`,
        },
        () => loadContact(contactId)
      )
      // Escuchar cambios en etiquetas del contacto (asignación / remoción)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contact_tags',
          filter: `contact_id=eq.${contactId}`,
        },
        () => loadContact(contactId)
      )
      // Cambios en los campos del contacto (incl. los que escribe n8n)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contact_field_values',
          filter: `contact_id=eq.${contactId}`,
        },
        () => loadContact(contactId)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [contactId, supabase])

  return { contact, loading }
}
