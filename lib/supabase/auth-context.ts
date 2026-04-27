import { createClient } from './server'
import { createAdminClient } from './admin'

export type AuthContext = {
  userId: string
  tenantId: string
  role: string
}

const SINGLE_TENANT_ID = process.env.SINGLE_TENANT_ID ?? ''

async function getSingleTenantId(): Promise<string | null> {
  if (SINGLE_TENANT_ID) return SINGLE_TENANT_ID

  const admin = createAdminClient()
  const { data } = await admin
    .from('tenants')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .single()

  return data?.id ?? null
}

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

  const tenantId = await getSingleTenantId()
  if (!tenantId) return null

  const { data: fallbackUser } = await admin
    .from('users')
    .select('id, tenant_id, role')
    .eq('tenant_id', tenantId)
    .limit(1)
    .single()

  if (fallbackUser) {
    return {
      userId: fallbackUser.id,
      tenantId: fallbackUser.tenant_id,
      role: fallbackUser.role,
    }
  }

  return null
}
