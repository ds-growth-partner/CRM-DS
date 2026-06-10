'use client'

import { createContext, useContext, useMemo } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'

type SupabaseContext = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
}

const Context = createContext<SupabaseContext | undefined>(undefined)

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth()

  const supabase = useMemo(
    () => createClient(() => getToken({ template: 'supabase' })),
    [getToken]
  )

  return <Context.Provider value={{ supabase }}>{children}</Context.Provider>
}

export function useSupabase() {
  const context = useContext(Context)
  if (!context) throw new Error('useSupabase must be used within SupabaseProvider')
  return context
}
