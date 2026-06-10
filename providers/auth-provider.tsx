'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useUser, useOrganization } from '@clerk/nextjs'
import { useSupabase } from './supabase-provider'
import type { User, Tenant } from '@/lib/types/database'

type AuthContext = {
  user: User | null
  tenant: Tenant | null
  loading: boolean
}

const Context = createContext<AuthContext>({
  user: null,
  tenant: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user: clerkUser, isLoaded: userLoaded } = useUser()
  const { organization, isLoaded: orgLoaded } = useOrganization()
  const { supabase } = useSupabase()
  const [user, setUser] = useState<User | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userLoaded || !orgLoaded) return

    if (!clerkUser) {
      setUser(null)
      setTenant(null)
      setLoading(false)
      return
    }

    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('users')
        .select('*, tenants(*)')
        .eq('clerk_user_id', clerkUser!.id)
        .single()

      if (data) {
        const { tenants, ...userFields } = data as User & { tenants: Tenant }
        setUser(userFields)
        setTenant(tenants ?? null)
      }
      setLoading(false)
    }

    load()
  }, [clerkUser?.id, organization?.id, userLoaded, orgLoaded])

  return (
    <Context.Provider value={{ user, tenant, loading }}>
      {children}
    </Context.Provider>
  )
}

export function useAuth() {
  return useContext(Context)
}
