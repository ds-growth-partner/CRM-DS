'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useSupabase } from './supabase-provider'
import type { User, Tenant } from '@/lib/types/database'
import type { Session } from '@supabase/supabase-js'

type AuthContext = {
  session: Session | null
  user: User | null
  tenant: Tenant | null
  loading: boolean
}

const Context = createContext<AuthContext>({
  session: null,
  user: null,
  tenant: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { supabase } = useSupabase()
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        loadUserData(session.user.id)
      } else {
        // Dev mode: load first user without auth session
        loadDevUser()
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadUserData(session.user.id)
      else {
        setUser(null)
        setTenant(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadDevUser() {
    const { data } = await supabase
      .from('users')
      .select('*, tenants(*)')
      .limit(1)
      .single()

    if (data) {
      const { tenants, ...userFields } = data as User & { tenants: Tenant }
      setUser(userFields)
      setTenant(tenants ?? null)
    }
    setLoading(false)
  }

  async function loadUserData(authUserId: string) {
    const { data: userData, error } = await supabase
      .from('users')
      .select('*, tenants(*)')
      .eq('id', authUserId)
      .single()

    if (userData) {
      const { tenants, ...userFields } = userData as User & { tenants: Tenant }
      setUser(userFields)
      setTenant(tenants ?? null)
    } else if (error) {
      // Usuario autenticado pero sin registro en users (puede tardar el trigger)
      // Reintenta una vez después de 1s
      setTimeout(async () => {
        const { data: retry } = await supabase
          .from('users')
          .select('*, tenants(*)')
          .eq('id', authUserId)
          .single()
        if (retry) {
          const { tenants, ...userFields } = retry as User & { tenants: Tenant }
          setUser(userFields)
          setTenant(tenants ?? null)
        }
        setLoading(false)
      }, 1000)
      return
    }
    setLoading(false)
  }

  return (
    <Context.Provider value={{ session, user, tenant, loading }}>
      {children}
    </Context.Provider>
  )
}

export function useAuth() {
  return useContext(Context)
}
