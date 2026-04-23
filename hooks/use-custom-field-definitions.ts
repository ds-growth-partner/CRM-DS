'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import { useAuth } from '@/providers/auth-provider'
import type { CustomFieldDefinition } from '@/lib/types/database'

export function useCustomFieldDefinitions() {
  const { supabase } = useSupabase()
  const { tenant } = useAuth()
  const [fields, setFields] = useState<CustomFieldDefinition[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!tenant) return
    const { data } = await supabase
      .from('custom_field_definitions')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('position')
    setFields(data ?? [])
    setLoading(false)
  }, [supabase, tenant])

  useEffect(() => { load() }, [load])

  return { fields, loading, refetch: load }
}
