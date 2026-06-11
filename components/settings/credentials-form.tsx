'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, Save, Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react'

type Credentials = {
  n8n_base_url: string
  n8n_webhook_secret: string
  waba_id: string
  phone_number_id: string
  meta_access_token: string
  meta_webhook_verify_token: string
  google_calendar_id: string
  google_service_account_json: string
}

const EMPTY: Credentials = {
  n8n_base_url: '',
  n8n_webhook_secret: '',
  waba_id: '',
  phone_number_id: '',
  meta_access_token: '',
  meta_webhook_verify_token: '',
  google_calendar_id: '',
  google_service_account_json: '',
}

/**
 * Edits a single tenant's credentials (tenant_credentials row).
 * Used by both settings/integrations (tenant owner) and /admin (super admin).
 * RLS handles authorization: owner-of-tenant or super_admin can write.
 *
 * Focused on what matters for the per-tenant n8n model:
 *   - n8n URL + secret  (where the CRM sends outbound webhooks)
 *   - WhatsApp Phone Number ID  (inbound routing key → tenant_id)
 * Everything else lives under "Avanzado".
 */
export function CredentialsForm({
  tenantId,
  canWrite,
}: {
  tenantId: string
  canWrite: boolean
}) {
  const { supabase } = useSupabase()
  const [form, setForm] = useState<Credentials>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showSecrets, setShowSecrets] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('tenant_credentials')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (active) {
        setForm({
          n8n_base_url: data?.n8n_base_url ?? '',
          n8n_webhook_secret: data?.n8n_webhook_secret ?? '',
          waba_id: data?.waba_id ?? '',
          phone_number_id: data?.phone_number_id ?? '',
          meta_access_token: data?.meta_access_token ?? '',
          meta_webhook_verify_token: data?.meta_webhook_verify_token ?? '',
          google_calendar_id: data?.google_calendar_id ?? '',
          google_service_account_json: data?.google_service_account_json ?? '',
        })
        setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [tenantId, supabase])

  function set<K extends keyof Credentials>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!canWrite) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('tenant_credentials')
        .upsert({ tenant_id: tenantId, ...form }, { onConflict: 'tenant_id' })

      if (error) throw error
      toast.success('Credenciales guardadas')
    } catch (err) {
      console.error(err)
      toast.error('Error al guardar las credenciales')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando credenciales…
      </div>
    )
  }

  const secretType = showSecrets ? 'text' : 'password'

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowSecrets((s) => !s)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showSecrets ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showSecrets ? 'Ocultar secretos' : 'Mostrar secretos'}
        </button>
      </div>

      {/* n8n — a dónde el CRM envía los webhooks de este cliente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">n8n del cliente</CardTitle>
          <CardDescription>
            URL de la instancia de n8n a la que el CRM enviará los webhooks (mensajes salientes,
            campañas, tomar/soltar control).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="URL base de n8n" hint="Ej: https://cliente.app.n8n.cloud — sin /webhook al final">
            <Input
              value={form.n8n_base_url}
              onChange={(e) => set('n8n_base_url', e.target.value)}
              placeholder="https://…"
              disabled={!canWrite}
            />
          </Field>
          <Field label="Webhook Secret (HMAC)" hint="Debe coincidir con el secret configurado en el n8n del cliente. Opcional pero recomendado.">
            <Input
              type={secretType}
              value={form.n8n_webhook_secret}
              onChange={(e) => set('n8n_webhook_secret', e.target.value)}
              disabled={!canWrite}
            />
          </Field>
        </CardContent>
      </Card>

      {/* WhatsApp — la llave de enrutamiento entrante */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Número de WhatsApp</CardTitle>
          <CardDescription>
            El <span className="font-medium">Phone Number ID</span> es la llave con la que los
            mensajes entrantes se asignan a este cliente automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Phone Number ID" hint="De Meta → WhatsApp → API Setup. Único por cliente — es lo que enruta los mensajes entrantes.">
            <Input
              value={form.phone_number_id}
              onChange={(e) => set('phone_number_id', e.target.value)}
              placeholder="Ej: 123456789012345"
              disabled={!canWrite}
            />
          </Field>
          <Field label="WABA ID" hint="WhatsApp Business Account ID (opcional)">
            <Input
              value={form.waba_id}
              onChange={(e) => set('waba_id', e.target.value)}
              disabled={!canWrite}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Avanzado — normalmente lo maneja el n8n del cliente, no el CRM */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((s) => !s)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Avanzado (opcional)
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Meta — tokens directos</CardTitle>
                <CardDescription>
                  Solo si el CRM llama a Meta directamente. En tu modelo, esto vive en el n8n del cliente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Access Token">
                  <Input type={secretType} value={form.meta_access_token} onChange={(e) => set('meta_access_token', e.target.value)} disabled={!canWrite} />
                </Field>
                <Field label="Webhook Verify Token">
                  <Input type={secretType} value={form.meta_webhook_verify_token} onChange={(e) => set('meta_webhook_verify_token', e.target.value)} disabled={!canWrite} />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Google Calendar</CardTitle>
                <CardDescription>Sincronización de citas (opcional)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Calendar ID">
                  <Input value={form.google_calendar_id} onChange={(e) => set('google_calendar_id', e.target.value)} disabled={!canWrite} />
                </Field>
                <Field label="Service Account JSON">
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={showSecrets ? form.google_service_account_json : form.google_service_account_json ? '••••••••••••' : ''}
                    onChange={(e) => set('google_service_account_json', e.target.value)}
                    disabled={!canWrite || !showSecrets}
                    placeholder={showSecrets ? '{ "type": "service_account", … }' : 'Pulsa "Mostrar secretos" para editar'}
                  />
                </Field>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {canWrite ? (
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Guardar
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Solo el <span className="font-medium">owner</span> de la organización puede editar las credenciales.
        </p>
      )}
    </form>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
