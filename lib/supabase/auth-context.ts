import { createClient } from './server'
import { createAdminClient } from './admin'

export type AuthContext = {
  userId: string
  tenantId: string
  role: string
}

/**
 * Obtiene el contexto de auth para API routes.
 * En desarrollo (sin sesión activa) usa el primer usuario del tenant.
 * En producción requiere sesión válida.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data } = await supabase
      .from('users')
      .select('id, tenant_id, role')
      .eq('id', user.id)
      .single()
    if (!data) return null
    return { userId: data.id, tenantId: data.tenant_id, role: data.role }
  }

  // Dev bypass: primer usuario disponible
  if (process.env.NODE_ENV === 'development') {
    const admin = createAdminClient()
    const { data } = await admin
      .from('users')
      .select('id, tenant_id, role')
      .limit(1)
      .single()
    if (!data) return null
    return { userId: data.id, tenantId: data.tenant_id, role: data.role }
  }

  return null
}
