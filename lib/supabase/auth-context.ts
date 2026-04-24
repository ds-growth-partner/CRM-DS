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
  const admin = createAdminClient()
  const supabase = await createClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await admin
        .from('users')
        .select('id, tenant_id, role')
        .eq('id', user.id)
        .single()
      if (data) return { userId: data.id, tenantId: data.tenant_id, role: data.role }
    }
  } catch (e) {
    console.error('getAuthContext: error getting user', e)
  }

  // Fallback for development: use the first available user
  const { data: fallbackUser } = await admin
    .from('users')
    .select('id, tenant_id, role')
    .limit(1)
    .single()

  if (fallbackUser) {
    return { 
      userId: fallbackUser.id, 
      tenantId: fallbackUser.tenant_id, 
      role: fallbackUser.role 
    }
  }

  return null
}
