'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import { useAuth } from '@/providers/auth-provider'
import type { ConversationWithContact } from '@/lib/types/database'
import type { ConversationFilters } from '@/lib/types/shared'

export function useRealtimeConversations(filters: ConversationFilters = {}) {
  const { supabase } = useSupabase()
  const { tenant } = useAuth()
  const tenantId = tenant?.id
  const [conversations, setConversations] = useState<ConversationWithContact[]>([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = useRef(0)

  const loadConversations = useCallback(async () => {
    setLoading(true)

    // Load all conversations with their contacts, ordered by last_message_at
    const { data: convs, error } = await supabase
      .from('conversations')
      .select(`
        *,
        assigned_agent:users!conversations_assigned_agent_id_fkey(id, full_name, avatar_url, role),
        contact:contacts!contact_id(
          *,
          funnel_stage:funnel_stages(*),
          contact_tags(tag:tags(*))
        )
      `)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (error) {
      console.error('[useRealtimeConversations] query error:', error)
      setLoading(false)
      // Retry up to 3 times with 1s delay (handles CDN cold-start 300 errors)
      if (retryCountRef.current < 3) {
        retryCountRef.current += 1
        retryTimeoutRef.current = setTimeout(() => loadConversations(), 1000)
      }
      return
    }
    retryCountRef.current = 0 // Reset on success

    if (!convs || convs.length === 0) {
      setConversations([])
      setLoading(false)
      return
    }

    let result: ConversationWithContact[] = convs.map(c => {
      // Map contact.contact_tags to just tags for frontend ease
      const contactData = c.contact as any
      const contact = contactData ? {
        ...contactData,
        tags: contactData.contact_tags?.map((ct: any) => ct.tag) ?? [],
      } : null
      
      return {
        ...c,
        contact
      } as ConversationWithContact
    })

    // Apply frontend filters
    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(c => {
        if (!c.contact) return false
        const contact = c.contact as any
        const name = `${contact.first_name} ${contact.last_name ?? ''}`.toLowerCase()
        return name.includes(q) || (contact.phone ?? '').includes(q)
      })
    }

    if (filters.status) {
      result = result.filter(c => c.status === filters.status)
    }

    if (filters.assigned_to) {
      if (filters.assigned_to === 'unassigned') {
        result = result.filter(c => !c.assigned_agent_id)
      } else {
        result = result.filter(c => c.assigned_agent_id === filters.assigned_to)
      }
    }

    if (filters.funnel_stage_id) {
      result = result.filter(c => c.contact?.funnel_stage_id === filters.funnel_stage_id)
    }

    if (filters.tag_id) {
      result = result.filter(c =>
        (c.contact?.tags ?? []).some((t: any) => t.id === filters.tag_id)
      )
    }

    setConversations(result)
    setLoading(false)
  }, [supabase, filters])

  useEffect(() => {
    loadConversations()

    // Realtime postgres_changes on RLS-protected tables only deliver when the
    // subscription has a filter — an unfiltered subscription receives nothing
    // (this is why new conversations never showed up live). Scope every binding
    // to the tenant, which also keeps events isolated per tenant.
    if (!tenantId) return

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const f = `tenant_id=eq.${tenantId}`
    const channel = supabase
      .channel(`conversations-list-${tenantId}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: f }, () => loadConversations())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts', filter: f }, () => loadConversations())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: f }, () => loadConversations())
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[useRealtimeConversations] realtime channel status:', status)
        }
      })

    channelRef.current = channel

    // Safety net: if the tab was backgrounded and missed events, refresh on focus.
    const onFocus = () => { if (!document.hidden) loadConversations() }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
      retryCountRef.current = 0
    }
  }, [loadConversations, supabase, tenantId])

  return { conversations, loading }
}