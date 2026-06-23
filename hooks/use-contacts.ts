'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import type { ContactWithDetails } from '@/lib/types/database'
import type { ContactFilters } from '@/lib/types/shared'
import { toFieldMap, contactName, CONTACT_FIELDS_EMBED } from '@/lib/utils/contact-fields'

export function useContacts(filters: ContactFilters = {}) {
  const { supabase } = useSupabase()
  const [contacts, setContacts] = useState<ContactWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const loadContacts = useCallback(async () => {
    setLoading(true)

    let selectStr = `
      *,
      funnel_stage:funnel_stages(*),
      assigned_user:users!contacts_assigned_to_fkey(id, full_name, avatar_url),
      contact_tags(tag:tags(*)),
      ${CONTACT_FIELDS_EMBED}
    `

    // If filtering by tags, we need to use !inner to filter the main contacts
    if (filters.tag_ids && filters.tag_ids.length > 0) {
      selectStr = `
        *,
        funnel_stage:funnel_stages(*),
        assigned_user:users!contacts_assigned_to_fkey(id, full_name, avatar_url),
        contact_tags!inner(tag:tags(*)),
        ${CONTACT_FIELDS_EMBED}
      `
    }

    let query = supabase
      .from('contacts')
      .select(selectStr, { count: 'exact' })
      .order('updated_at', { ascending: false })

    if (filters.funnel_stage_id) query = query.eq('funnel_stage_id', filters.funnel_stage_id)
    if (filters.source) query = query.eq('source', filters.source)
    if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to)
    if (filters.ai_active !== undefined) query = query.eq('ai_active', filters.ai_active)
    if (filters.lead_score_min !== undefined) query = query.gte('lead_score', filters.lead_score_min)
    if (filters.lead_score_max !== undefined) query = query.lte('lead_score', filters.lead_score_max)
    if (filters.created_from) query = query.gte('created_at', filters.created_from)
    if (filters.created_to) query = query.lte('created_at', filters.created_to + 'T23:59:59')
    
    if (filters.tag_ids && filters.tag_ids.length > 0) {
      // Filtering by many-to-many tags requires an inner join in PostgREST
      query = query.filter('contact_tags.tag_id', 'in', `(${filters.tag_ids.join(',')})`)
    }

    const { data, count, error } = await query.limit(500)

    if (error) {
      console.error('Error fetching contacts:', error)
    }

    const rows = (data ?? []) as unknown as Record<string, unknown>[]
    let mapped = rows.map(c => ({
      ...c,
      tags: (c.contact_tags as { tag: unknown }[] | undefined)?.map(ct => ct.tag) ?? [],
      fields: toFieldMap(c.contact_field_values as { field_key: string; value: string | null }[] | undefined),
    })) as unknown as ContactWithDetails[]

    // Búsqueda por nombre/teléfono/email/empresa: ahora los valores viven en
    // contact_field_values, así que se filtra en cliente sobre `fields`.
    const term = (filters.search ?? '').toLowerCase().trim()
    const phoneTerm = (filters.phone ?? '').toLowerCase().trim()
    const emailTerm = (filters.email ?? '').toLowerCase().trim()
    const filteredByFields = term || phoneTerm || emailTerm
    if (filteredByFields) {
      mapped = mapped.filter(c => {
        const f = c.fields ?? {}
        if (phoneTerm && !(f.telefono ?? '').toLowerCase().includes(phoneTerm)) return false
        if (emailTerm && !(f.email ?? '').toLowerCase().includes(emailTerm)) return false
        if (term) {
          const hay = `${contactName(f)} ${f.email ?? ''} ${f.telefono ?? ''} ${f.empresa ?? ''}`.toLowerCase()
          if (!hay.includes(term)) return false
        }
        return true
      })
    }

    setContacts(mapped)
    setTotal(filteredByFields ? mapped.length : (count ?? 0))
    setLoading(false)
  }, [supabase, JSON.stringify(filters)]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadContacts()

    // Limpiar canal anterior
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    // Realtime: recarga la lista cuando cambia cualquier contacto o sus etiquetas
    const channel = supabase
      .channel(`contacts-list-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts' },
        () => loadContacts()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contact_tags' },
        () => loadContacts()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contact_field_values' },
        () => loadContacts()
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadContacts])

  return { contacts, loading, total, refetch: loadContacts }
}
