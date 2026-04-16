'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/providers/auth-provider'
import { useSupabase } from '@/providers/supabase-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, Save, Eye, EyeOff } from 'lucide-react'

type Creds = {
  waba_id: string
  phone_number_id: string
  meta_access_token: string
  chatwoot_base_url: string
  chatwoot_api_token: string
  chatwoot_account_id: string
  n8n_base_url: string
  n8n_webhook_secret: string
  google_calendar_id: string
}

export default function IntegrationsPage() {
  const { tenant, user } = useAuth()
  const { supabase } = useSupabase()
  const [saving, setSaving] = useState(false)
  const [showTokens, setShowTokens] = useState(false)
  const [creds, setCreds] = useState<Creds>({
    waba_id: '', phone_number_id: '', meta_access_token: '',
    chatwoot_base_url: '', chatwoot_api_token: '', chatwoot_account_id: '',
    n8n_base_url: '', n8n_webhook_secret: '', google_calendar_id: 'primary',
  })

  useEffect(() => {
    if (!tenant || !['owner'].includes(user?.role ?? '')) return
    supabase.from('tenant_credentials').select('*').eq('tenant_id', tenant.id).single()
      .then(({ data }) => {
        if (data) {
          setCreds({
            waba_id: data.waba_id ?? '',
            phone_number_id: data.phone_number_id ?? '',
            meta_access_token: data.meta_access_token ?? '',
            chatwoot_base_url: data.chatwoot_base_url ?? '',
            chatwoot_api_token: data.chatwoot_api_token ?? '',
            chatwoot_account_id: String(data.chatwoot_account_id ?? ''),
            n8n_base_url: data.n8n_base_url ?? '',
            n8n_webhook_secret: data.n8n_webhook_secret ?? '',
            google_calendar_id: data.google_calendar_id ?? 'primary',
          })
        }
      })
  }, [tenant, user, supabase])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!tenant || user?.role !== 'owner') {
      toast.error('Solo el owner puede modificar las integraciones')
      return
    }
    setSaving(true)
    try {
      await supabase.from('tenant_credentials').upsert({
        tenant_id: tenant.id,
        waba_id: creds.waba_id || null,
        phone_number_id: creds.phone_number_id || null,
        meta_access_token: creds.meta_access_token || null,
        chatwoot_base_url: creds.chatwoot_base_url || null,
        chatwoot_api_token: creds.chatwoot_api_token || null,
        chatwoot_account_id: creds.chatwoot_account_id ? parseInt(creds.chatwoot_account_id) : null,
        n8n_base_url: creds.n8n_base_url || null,
        n8n_webhook_secret: creds.n8n_webhook_secret || null,
        google_calendar_id: creds.google_calendar_id || null,
      }, { onConflict: 'tenant_id' })
      toast.success('Integraciones guardadas')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const isOwner = user?.role === 'owner'

  function Field({ label, field, placeholder, type = 'text' }: { label: string; field: keyof Creds; placeholder?: string; type?: string }) {
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <Input
          type={type === 'secret' ? (showTokens ? 'text' : 'password') : type}
          value={creds[field]}
          onChange={e => setCreds(c => ({ ...c, [field]: e.target.value }))}
          placeholder={placeholder}
          disabled={!isOwner}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Integraciones</h1>
          <p className="text-sm text-muted-foreground">Conecta TuContador CRM con tus servicios externos</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowTokens(v => !v)}>
          {showTokens ? <EyeOff className="h-4 w-4 mr-1.5" /> : <Eye className="h-4 w-4 mr-1.5" />}
          {showTokens ? 'Ocultar' : 'Mostrar'} tokens
        </Button>
      </div>

      {!isOwner && (
        <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg px-4 py-3">
          Solo el owner de la organización puede modificar las integraciones.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meta WhatsApp Business</CardTitle>
            <CardDescription>Credenciales de la Cloud API de Meta para WhatsApp</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="WABA ID" field="waba_id" placeholder="123456789" />
            <Field label="Phone Number ID" field="phone_number_id" placeholder="987654321" />
            <Field label="System User Token" field="meta_access_token" placeholder="EAAx..." type="secret" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chatwoot</CardTitle>
            <CardDescription>Instancia de Chatwoot para gestión de conversaciones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="URL de Chatwoot" field="chatwoot_base_url" placeholder="https://app.chatwoot.com" />
            <Field label="API Access Token" field="chatwoot_api_token" placeholder="tu-token-api" type="secret" />
            <Field label="Account ID" field="chatwoot_account_id" placeholder="1" type="number" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">n8n</CardTitle>
            <CardDescription>Instancia de n8n para automatización e IA</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="URL de n8n" field="n8n_base_url" placeholder="https://n8n.tuempresa.com" />
            <Field label="Webhook Secret (HMAC)" field="n8n_webhook_secret" placeholder="tu-secret-hmac" type="secret" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Google Calendar</CardTitle>
            <CardDescription>Sincronización de citas con Google Calendar</CardDescription>
          </CardHeader>
          <CardContent>
            <Field label="Calendar ID" field="google_calendar_id" placeholder="primary" />
          </CardContent>
        </Card>

        {isOwner && (
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar integraciones
          </Button>
        )}
      </form>
    </div>
  )
}
