'use client'

import { createContext, useContext, useEffect, useMemo } from 'react'
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

  // Keep the Realtime websocket token fresh.
  //
  // supabase-js initializes Realtime by calling `setAuth(token)` with an explicit
  // token, which puts it in "manual token" mode — and in that mode the per-heartbeat
  // auto-refresh is skipped. Clerk tokens expire in ~60s, so the frozen token dies
  // and Realtime silently stops delivering events.
  //
  // Calling `setAuth()` with NO argument switches Realtime back to callback mode
  // (it pulls a fresh token from our accessToken callback and pushes it to every
  // joined channel). We do it on mount and every 50s, comfortably under the 60s TTL.
  useEffect(() => {
    let active = true
    const refresh = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(supabase.realtime as any).setAuth().catch(() => {})
    }
    refresh()
    const id = setInterval(() => { if (active) refresh() }, 50_000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [supabase])

  return <Context.Provider value={{ supabase }}>{children}</Context.Provider>
}

export function useSupabase() {
  const context = useContext(Context)
  if (!context) throw new Error('useSupabase must be used within SupabaseProvider')
  return context
}
