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
