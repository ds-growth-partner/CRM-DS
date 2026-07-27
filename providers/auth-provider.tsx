'use client'

import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { useUser, useOrganization } from '@clerk/nextjs'
import { useSupabase } from './supabase-provider'
import type { User, Tenant } from '@/lib/types/database'

// Clave donde se persiste la cuenta que el super admin está "viendo como".
const STORAGE_KEY = 'ds-crm:active-tenant'

type AuthContext = {
  user: User | null
  /** Cuenta ACTIVA: la impersonada por el super admin, o la propia del usuario. */
  tenant: Tenant | null
  /** Tenant real del usuario (no cambia al impersonar). */
  ownTenant: Tenant | null
  isSuperAdmin: boolean
  /** true cuando un super admin está viendo una cuenta que no es la suya. */
  isImpersonating: boolean
  /** Super admin: todas las cuentas. Usuario normal: solo la suya. */
  availableTenants: Tenant[]
  activeTenantId: string | null
  setActiveTenantId: (id: string) => void
  loading: boolean
}

const Context = createContext<AuthContext>({
  user: null,
  tenant: null,
  ownTenant: null,
  isSuperAdmin: false,
  isImpersonating: false,
  availableTenants: [],
  activeTenantId: null,
  setActiveTenantId: () => {},
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user: clerkUser, isLoaded: userLoaded } = useUser()
  const { organization, isLoaded: orgLoaded } = useOrganization()
  const { supabase } = useSupabase()
  const [user, setUser] = useState<User | null>(null)
  const [ownTenant, setOwnTenant] = useState<Tenant | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([])
  const [activeTenantId, setActiveTenantIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userLoaded || !orgLoaded) return

    if (!clerkUser) {
      setUser(null)
      setOwnTenant(null)
      setIsSuperAdmin(false)
      setAvailableTenants([])
      setActiveTenantIdState(null)
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

      let own: Tenant | null = null
      if (data) {
        const { tenants, ...userFields } = data as User & { tenants: Tenant }
        setUser(userFields)
        own = tenants ?? null
        setOwnTenant(own)
      }

      const superAdmin = !!superRow
      setIsSuperAdmin(superAdmin)

      // Super admin → puede ver TODAS las cuentas (el RLS ya se lo permite).
      // Usuario normal → solo la suya.
      let tenants: Tenant[] = own ? [own] : []
      if (superAdmin) {
        const { data: all } = await supabase.from('tenants').select('*').order('name')
        if (all && all.length) tenants = all as Tenant[]
      }
      setAvailableTenants(tenants)

      // Resolver la cuenta activa: preferencia guardada > propia > primera.
      const stored =
        typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      const validStored = stored && tenants.some(t => t.id === stored) ? stored : null
      setActiveTenantIdState(validStored ?? own?.id ?? tenants[0]?.id ?? null)

      setLoading(false)
    }

    load()
  }, [clerkUser?.id, organization?.id, userLoaded, orgLoaded, supabase])

  const setActiveTenantId = useCallback((id: string) => {
    setActiveTenantIdState(id)
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, id)
  }, [])

  // Cuenta activa (impersonada o propia). Memoizada para mantener referencia
  // estable: solo cambia cuando cambia la selección o las cuentas disponibles.
  const tenant = useMemo(
    () => availableTenants.find(t => t.id === activeTenantId) ?? ownTenant,
    [availableTenants, activeTenantId, ownTenant]
  )

  const isImpersonating = isSuperAdmin && !!tenant && tenant.id !== ownTenant?.id

  return (
    <Context.Provider
      value={{
        user,
        tenant,
        ownTenant,
        isSuperAdmin,
        isImpersonating,
        availableTenants,
        activeTenantId,
        setActiveTenantId,
        loading,
      }}
    >
      {children}
    </Context.Provider>
  )
}

export function useAuth() {
  return useContext(Context)
}
