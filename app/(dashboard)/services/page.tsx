'use client'

import { useState } from 'react'
import { useAuth } from '@/providers/auth-provider'
import { useSupabase } from '@/providers/supabase-provider'
import { useServices } from '@/hooks/use-services'
import type { Service } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Plus, Loader2, Trash2, Package, Clock } from 'lucide-react'
import { formatMoney } from '@/lib/utils/format'

export default function ServicesPage() {
  const { tenant, user } = useAuth()
  const { supabase } = useSupabase()
  const { services, loading, refetch } = useServices()
  const canEdit = ['owner', 'admin'].includes(user?.role ?? '')

  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !tenant) return
    setSaving(true)
    const { error } = await supabase.from('services').insert({
      tenant_id: tenant.id,
      name: newName.trim(),
      description: newDesc.trim() || null,
      price: Number(newPrice) || 0,
      position: services.length,
    })
    if (error) toast.error(error.message)
    else { toast.success('Servicio creado'); setNewName(''); setNewPrice(''); setNewDesc(''); await refetch() }
    setSaving(false)
  }

  async function patch(id: string, patch: Partial<Service>) {
    const { error } = await supabase.from('services').update(patch).eq('id', id)
    if (error) { toast.error(error.message); refetch() }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('services').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Servicio eliminado'); refetch() }
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Servicios</h1>
            <p className="text-sm text-muted-foreground">
              Tu catálogo de servicios. El precio aquí es el de referencia: al asociarlo a un cliente puedes ajustarlo por promociones o descuentos.
            </p>
          </div>
        </div>

        {canEdit && (
          <form onSubmit={handleCreate} className="border border-border rounded-xl bg-card p-4 space-y-3">
            <h2 className="text-sm font-medium">Nuevo servicio</h2>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej: Consulta general" required />
              </div>
              <div className="space-y-1.5">
                <Label>Precio</Label>
                <Input type="number" min="0" step="any" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Qué incluye el servicio..." rows={2} />
            </div>
            <Button type="submit" disabled={saving || !newName.trim()} size="sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
              Crear servicio
            </Button>
          </form>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-medium">Catálogo</h2>
            <span className="text-xs text-muted-foreground">{services.length} servicio{services.length !== 1 ? 's' : ''}</span>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground px-1">Cargando...</p>
          ) : services.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-border rounded-xl text-muted-foreground text-sm">
              Sin servicios todavía
            </div>
          ) : (
            services.map(svc => (
              <ServiceRow
                key={svc.id}
                service={svc}
                canEdit={canEdit}
                onPatch={patch}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function ServiceRow({
  service, canEdit, onPatch, onDelete,
}: {
  service: Service
  canEdit: boolean
  onPatch: (id: string, patch: Partial<Service>) => void
  onDelete: (id: string) => void
}) {
  const [name, setName] = useState(service.name)
  const [price, setPrice] = useState(String(service.price))
  const [duration, setDuration] = useState(service.duration_minutes != null ? String(service.duration_minutes) : '')
  const [description, setDescription] = useState(service.description ?? '')

  if (!canEdit) {
    return (
      <div className="flex items-start gap-3 p-3.5 border border-border rounded-xl bg-card">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{service.name}</span>
            {!service.is_active && <span className="text-[10px] text-muted-foreground">(inactivo)</span>}
          </div>
          {service.description && <p className="text-xs text-muted-foreground mt-0.5">{service.description}</p>}
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{formatMoney(service.price, service.currency)}</span>
            {service.duration_minutes != null && (
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{service.duration_minutes} min</span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3.5 border border-border rounded-xl bg-card space-y-2.5">
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={() => { const v = name.trim(); if (v && v !== service.name) onPatch(service.id, { name: v }); else setName(service.name) }}
          className="flex-1 h-8 text-sm font-medium border-transparent bg-transparent hover:bg-muted/40 focus:border-primary/40"
        />
        <div className="flex items-center gap-2 shrink-0">
          <Switch
            checked={service.is_active}
            onCheckedChange={(v: boolean) => onPatch(service.id, { is_active: v })}
            size="sm"
          />
          <span className="text-[11px] text-muted-foreground w-12">{service.is_active ? 'Activo' : 'Inactivo'}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(service.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <Textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        onBlur={() => { const v = description.trim(); if (v !== (service.description ?? '')) onPatch(service.id, { description: v || null }) }}
        placeholder="Descripción del servicio..."
        rows={2}
        className="text-sm bg-muted/20 border-transparent focus:border-primary/40 resize-none"
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Precio ({service.currency})</Label>
          <Input
            type="number" min="0" step="any"
            value={price}
            onChange={e => setPrice(e.target.value)}
            onBlur={() => { const v = Number(price) || 0; if (v !== service.price) onPatch(service.id, { price: v }) }}
            className="h-8 text-sm bg-muted/20"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Duración (min)</Label>
          <Input
            type="number" min="0" step="1"
            value={duration}
            onChange={e => setDuration(e.target.value)}
            onBlur={() => { const v = duration === '' ? null : Number(duration); if (v !== service.duration_minutes) onPatch(service.id, { duration_minutes: v }) }}
            placeholder="—"
            className="h-8 text-sm bg-muted/20"
          />
        </div>
      </div>
    </div>
  )
}
