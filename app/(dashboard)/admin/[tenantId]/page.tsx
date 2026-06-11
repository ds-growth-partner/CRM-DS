'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/providers/auth-provider'
import { useSupabase } from '@/providers/supabase-provider'
import { CredentialsForm } from '@/components/settings/credentials-form'
import { Loader2, ArrowLeft, ShieldCheck } from 'lucide-react'
import type { Tenant } from '@/lib/types/database'

export default function AdminTenantPage() {
  const { isSuperAdmin, loading: authLoading } = useAuth()
  const { supabase } = useSupabase()
  const router = useRouter()
  const params = useParams<{ tenantId: string }>()
  const tenantId = params.tenantId
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !isSuperAdmin) {
      router.replace('/conversations')
    }
  }, [authLoading, isSuperAdmin, router])

  useEffect(() => {
    if (!isSuperAdmin || !tenantId) return
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle()
      setTenant((data as Tenant) ?? null)
      setLoading(false)
    }
    load()
  }, [isSuperAdmin, tenantId, supabase])

  if (authLoading || !isSuperAdmin || loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="p-6 space-y-4 max-w-2xl mx-auto">
        <Link href="/admin" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <p className="text-sm text-muted-foreground">No se encontró la organización.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <Link href="/admin" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver a clientes
      </Link>

      <div className="flex items-center gap-2.5">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold">{tenant.name}</h1>
          <p className="text-sm text-muted-foreground">
            Plan <span className="capitalize">{tenant.plan}</span> · {tenant.slug}
          </p>
        </div>
      </div>

      <CredentialsForm tenantId={tenant.id} canWrite />
    </div>
  )
}
