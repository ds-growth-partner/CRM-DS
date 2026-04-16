'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/providers/auth-provider'
import { useSupabase } from '@/providers/supabase-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'

export default function GeneralSettingsPage() {
  const { tenant, user } = useAuth()
  const { supabase } = useSupabase()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    tenantName: tenant?.name ?? '',
    fullName: user?.full_name ?? '',
  })

  useEffect(() => {
    setForm({ tenantName: tenant?.name ?? '', fullName: user?.full_name ?? '' })
  }, [tenant, user])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (tenant && ['owner', 'admin'].includes(user?.role ?? '')) {
        await supabase.from('tenants').update({ name: form.tenantName }).eq('id', tenant.id)
      }
      if (user) {
        await supabase.from('users').update({ full_name: form.fullName }).eq('id', user.id)
      }
      toast.success('Cambios guardados')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-lg font-semibold">General</h1>
        <p className="text-sm text-muted-foreground">Configuración general del CRM</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organización</CardTitle>
            <CardDescription>Información de tu empresa en TuContador</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre de la organización</Label>
              <Input
                value={form.tenantName}
                onChange={e => setForm(f => ({ ...f, tenantName: e.target.value }))}
                disabled={!['owner', 'admin'].includes(user?.role ?? '')}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Input value={tenant?.plan ?? ''} disabled />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tu perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre completo</Label>
              <Input
                value={form.fullName}
                onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={user?.email ?? ''} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Input value={user?.role ?? ''} disabled className="capitalize" />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Guardar cambios
        </Button>
      </form>
    </div>
  )
}
