import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from './admin'

export type AuthContext = {
  userId: string        // internal Supabase UUID
  clerkUserId: string   // Clerk user ID
  tenantId: string      // internal Supabase UUID
  clerkOrgId: string    // Clerk org ID
  role: string
}

// Use in API routes to get the authenticated user + tenant context
export async function getAuthContext(): Promise<AuthContext | null> {
  const { userId: clerkUserId, orgId: clerkOrgId } = await auth()
  if (!clerkUserId || !clerkOrgId) return null

  const admin = createAdminClient()
  const { data } = await admin
    .from('users')
    .select('id, tenant_id, role, tenants(id)')
    .eq('clerk_user_id', clerkUserId)
    .single()

  if (!data || !data.tenant_id) return null

  return {
    userId: data.id,
    clerkUserId,
    tenantId: data.tenant_id,
    clerkOrgId,
    role: data.role,
  }
}

// Resuelve el tenant sobre el que debe actuar una API route.
//
// Por defecto es el tenant propio del usuario (ctx.tenantId). Pero un super
// admin puede estar "viendo como" otra cuenta (impersonación); esa selección
// vive solo en el frontend, así que el cliente envía el tenant_id de la
// conversación en el body y aquí lo honramos SOLO si el usuario es super admin.
// Un usuario normal nunca puede actuar sobre un tenant que no es el suyo.
export async function resolveTenantId(
  ctx: AuthContext,
  requestedTenantId?: string | null,
): Promise<string> {
  if (!requestedTenantId || requestedTenantId === ctx.tenantId) {
    return ctx.tenantId
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('super_admins')
    .select('id')
    .eq('clerk_user_id', ctx.clerkUserId)
    .eq('is_active', true)
    .maybeSingle()

  return data ? requestedTenantId : ctx.tenantId
}
