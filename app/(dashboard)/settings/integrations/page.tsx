'use client'

import { useAuth } from '@/providers/auth-provider'
import { CredentialsForm } from '@/components/settings/credentials-form'
import { Loader2 } from 'lucide-react'

export default function IntegrationsPage() {
  const { tenant, user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    )
  }

  if (!tenant) {
    return <p className="text-sm text-muted-foreground">No se encontró la organización.</p>
  }

  const canWrite = user?.role === 'owner'

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-lg font-semibold">Integraciones</h1>
        <p className="text-sm text-muted-foreground">
          Conecta tu instancia de n8n, WhatsApp y Google Calendar. Estas credenciales son
          específicas de tu organización.
        </p>
      </div>

      <CredentialsForm tenantId={tenant.id} canWrite={canWrite} />
    </div>
  )
}
