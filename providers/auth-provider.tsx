'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useUser, useOrganization } from '@clerk/nextjs'
import { useSupabase } from './supabase-provider'
import type { User, Tenant } from '@/lib/types/database'

type AuthContext = {
  user: User | null
  tenant: Tenant | null
  isSuperAdmin: boolean
  loading: boolean
}

const Context = createContext<AuthContext>({
  user: null,
  tenant: null,
  isSuperAdmin: false,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user: clerkUser, isLoaded: userLoaded } = useUser()
  const { organization, isLoaded: orgLoaded } = useOrganization()
  const { supabase } = useSupabase()
  const [user, setUser] = useState<User | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userLoaded || !orgLoaded) return

    if (!clerkUser) {
      setUser(null)
      setTenant(null)
      setIsSuperAdmin(false)
      setLoading(false)
      return
    }

    async function load() {
      setLoading(true)
      const [{ data }, { data: superRow }] = await Promise.all([
        supabase
          .from('users')
          .select('*, tenants(*)')
          .eq('clerk_user_id', clerkUser!.id)
          .single(),
        supabase
          .from('super_admins')
          .select('id')
          .eq('clerk_user_id', clerkUser!.id)
          .eq('is_active', true)
          .maybeSingle(),
      ])

      if (data) {
        const { tenants, ...userFields } = data as User & { tenants: Tenant }
        setUser(userFields)
        setTenant(tenants ?? null)
      }
      setIsSuperAdmin(!!superRow)
      setLoading(false)
    }

    load()
  }, [clerkUser?.id, organization?.id, userLoaded, orgLoaded])

  return (
    <Context.Provider value={{ user, tenant, isSuperAdmin, loading }}>
      {children}
    </Context.Provider>
  )
}

export function useAuth() {
  return useContext(Context)
}
