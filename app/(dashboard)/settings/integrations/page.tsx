'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { config } from '@/lib/config'

export default function IntegrationsPage() {
  const [envVars, setEnvVars] = useState<Record<string, string>>({})

  useEffect(() => {
    setEnvVars({
      'N8N_BASE_URL': config.n8n.baseUrl,
      'N8N_WEBHOOK_SECRET': config.n8n.webhookSecret ? '••••••••' : 'no configurado',
      'META_WABA_ID': config.meta.wabaId || 'no configurado',
      'META_PHONE_NUMBER_ID': config.meta.phoneNumberId || 'no configurado',
      'META_ACCESS_TOKEN': config.meta.accessToken ? '••••••••' : 'no configurado',
      'GOOGLE_CALENDAR_ID': config.google.calendarId,
      'GOOGLE_SERVICE_ACCOUNT_JSON': config.google.serviceAccountJson ? '••••••••' : 'no configurado',
    })
  }, [])

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-lg font-semibold">Integraciones</h1>
        <p className="text-sm text-muted-foreground">
          Las credenciales se configuran via variables de entorno (.env)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">n8n</CardTitle>
          <CardDescription>Automatización e IA</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <EnvRow label="URL de n8n" value={envVars['N8N_BASE_URL']} />
          <EnvRow label="Webhook Secret" value={envVars['N8N_WEBHOOK_SECRET']} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meta WhatsApp Business</CardTitle>
          <CardDescription>Cloud API de WhatsApp</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <EnvRow label="WABA ID" value={envVars['META_WABA_ID']} />
          <EnvRow label="Phone Number ID" value={envVars['META_PHONE_NUMBER_ID']} />
          <EnvRow label="Access Token" value={envVars['META_ACCESS_TOKEN']} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Google Calendar</CardTitle>
          <CardDescription>Sincronización de citas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <EnvRow label="Calendar ID" value={envVars['GOOGLE_CALENDAR_ID']} />
          <EnvRow label="Service Account" value={envVars['GOOGLE_SERVICE_ACCOUNT_JSON']} />
        </CardContent>
      </Card>
    </div>
  )
}

function EnvRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs truncate max-w-[200px]">{value}</span>
    </div>
  )
}
