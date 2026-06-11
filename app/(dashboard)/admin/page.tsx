'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/auth-provider'
import { useSupabase } from '@/providers/supabase-provider'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, ShieldCheck, ChevronRight, CheckCircle2, XCircle, Plug } from 'lucide-react'
import type { Tenant } from '@/lib/types/database'

type TenantRow = Tenant & { tenant_credentials: { n8n_base_url: string | null }[] | null }

export default function AdminPage() {
  const { isSuperAdmin, loading: authLoading } = useAuth()
  const { supabase } = useSupabase()
  const router = useRouter()
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [loading, setLoading] = useState(true)

  // Guard: kick non-super-admins out
  useEffect(() => {
    if (!authLoading && !isSuperAdmin) {
      router.replace('/conversations')
    }
  }, [authLoading, isSuperAdmin, router])

  useEffect(() => {
    if (!isSuperAdmin) return
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('tenants')
        .select('*, tenant_credentials(n8n_base_url)')
        .order('created_at', { ascending: false })
      setTenants((data as TenantRow[]) ?? [])
      setLoading(false)
    }
    load()
  }, [isSuperAdmin, supabase])

  if (authLoading || !isSuperAdmin) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Verificando acceso…
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2.5">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold">Super Admin — Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Todas las organizaciones del CRM. Configura el n8n y las credenciales de cada cliente.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando clientes…
        </div>
      ) : tenants.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aún no hay organizaciones. Cuando un cliente cree su organización en Clerk,
            aparecerá aquí automáticamente.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {tenants.map((t) => {
            const n8nConfigured = !!t.tenant_credentials?.[0]?.n8n_base_url
            return (
              <Link key={t.id} href={`/admin/${t.id}`}>
                <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
                  <CardHeader className="flex-row items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <CardTitle className="text-base flex items-center gap-2">
                        {t.name}
                        {t.is_active ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-0.5">
                        <span className="capitalize">{t.plan}</span>
                        <span>·</span>
                        <span className="font-mono text-xs">{t.slug}</span>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={
                          'flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 ' +
                          (n8nConfigured
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-amber-500/10 text-amber-500')
                        }
                      >
                        <Plug className="h-3 w-3" />
                        {n8nConfigured ? 'n8n conectado' : 'n8n sin configurar'}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
