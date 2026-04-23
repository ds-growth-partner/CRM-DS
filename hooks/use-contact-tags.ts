'use client'

import { useState, useCallback } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import { useAuth } from '@/providers/auth-provider'
import { toast } from 'sonner'
import type { Tag } from '@/lib/types/database'

/**
 * Gestiona la asignación de etiquetas a un contacto.
 * Las operaciones se persisten directamente en Supabase (contact_tags).
 */
export function useContactTags(contactId: string) {
  const { supabase } = useSupabase()
  const { tenant } = useAuth()
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [loadingTags, setLoadingTags] = useState(false)

  const loadAllTags = useCallback(async () => {
    if (!tenant) return
    setLoadingTags(true)
    const { data } = await supabase
      .from('tags')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('name')
    setAllTags(data ?? [])
    setLoadingTags(false)
  }, [supabase, tenant])

  async function assignTag(tagId: string) {
    const { error } = await supabase
      .from('contact_tags')
      .insert({ contact_id: contactId, tag_id: tagId })
    if (error && error.code !== '23505') {
      // 23505 = unique violation (ya existe), ignorar
      toast.error('Error al asignar etiqueta')
    }
  }

  async function removeTag(tagId: string) {
    const { error } = await supabase
      .from('contact_tags')
      .delete()
      .eq('contact_id', contactId)
      .eq('tag_id', tagId)
    if (error) {
      toast.error('Error al quitar etiqueta')
    }
  }

  return { allTags, loadingTags, loadAllTags, assignTag, removeTag }
}
