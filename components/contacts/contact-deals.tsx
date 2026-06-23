'use client'

import { useMemo, useState } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import { useDeals } from '@/hooks/use-deals'
import { useServices } from '@/hooks/use-services'
import type { Deal } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { formatMoney } from '@/lib/utils/format'
import { formatDate } from '@/lib/utils/date'
import { cn } from '@/lib/utils'
import { Plus, Loader2, Trash2, ShoppingBag, X } from 'lucide-react'

const STATUSES: { value: Deal['status']; label: string; cls: string }[] = [
  { value: 'pending',   label: 'Pendiente',  cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  { value: 'paid',      label: 'Pagado',     cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  { value: 'completed', label: 'Completado', cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  { value: 'cancelled', label: 'Cancelado',  cls: 'bg-red-500/10 text-red-500' },
]

const CUSTOM = '__custom__'

export function ContactDeals({ contactId }: { contactId: string }) {
  const { supabase } = useSupabase()
  const { deals, loading, tenantId } = useDeals(contactId)
  const { services } = useServices({ activeOnly: true })

  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [serviceId, setServiceId] = useState<string>(CUSTOM)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [status, setStatus] = useState<Deal['status']>('pending')
  const [soldAt, setSoldAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')

  const total = useMemo(
    () => deals.filter(d => d.status !== 'cancelled').reduce((s, d) => s + Number(d.price) * (d.quantity || 1), 0),
    [deals],
  )
  const currency = deals[0]?.currency ?? services[0]?.currency ?? 'COP'

  function pickService(id: string) {
    setServiceId(id)
    if (id !== CUSTOM) {
      const svc = services.find(s => s.id === id)
      if (svc) { setName(svc.name); setPrice(String(svc.price)) }
    }
  }

  function resetForm() {
    setServiceId(CUSTOM); setName(''); setPrice(''); setQuantity('1')
    setStatus('pending'); setSoldAt(new Date().toISOString().slice(0, 10)); setNotes('')
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !tenantId) return
    setSaving(true)
    const svc = serviceId !== CUSTOM ? services.find(s => s.id === serviceId) : null
    const { error } = await supabase.from('deals').insert({
      tenant_id: tenantId,
      contact_id: contactId,
      service_id: svc?.id ?? null,
      name: name.trim(),
      price: Number(price) || 0,
      currency: svc?.currency ?? 'COP',
      quantity: Number(quantity) || 1,
      status,
      sold_at: new Date(soldAt).toISOString(),
      notes: notes.trim() || null,
    })
    if (error) toast.error(error.message)
    else { toast.success('Venta registrada'); resetForm(); setAdding(false) }
    setSaving(false)
  }

  async function patch(id: string, p: Partial<Deal>) {
    const { error } = await supabase.from('deals').update(p).eq('id', id)
    if (error) toast.error(error.message)
  }

  async function remove(id: string) {
    const { error } = await supabase.from('deals').delete().eq('id', id)
    if (error) toast.error(error.message)
    else toast.success('Venta eliminada')
  }

  return (
    <div className="h-full overflow-y-auto py-4 px-4 space-y-4">
      {/* Summary + add button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Total comprado</p>
          <p className="text-lg font-semibold text-foreground">{formatMoney(total, currency)}</p>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Nueva venta
          </Button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <form onSubmit={handleAdd} className="border border-border rounded-xl bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Registrar venta</h3>
            <button type="button" onClick={() => { setAdding(false); resetForm() }} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <Label>Servicio</Label>
            <select
              value={serviceId}
              onChange={e => pickService(e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-muted/30 text-sm px-2.5 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {services.map(s => (
                <option key={s.id} value={s.id}>{s.name} · {formatMoney(s.price, s.currency)}</option>
              ))}
              <option value={CUSTOM}>Otro (personalizado)…</option>
            </select>
          </div>

          {serviceId === CUSTOM && (
            <div className="space-y-1.5">
              <Label>Nombre del servicio</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Servicio personalizado" required />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Precio</Label>
              <Input type="number" min="0" step="any" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Cantidad</Label>
              <Input type="number" min="1" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input type="date" value={soldAt} onChange={e => setSoldAt(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Estado</Label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as Deal['status'])}
              className="w-full h-9 rounded-lg border border-border bg-muted/30 text-sm px-2.5 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Notas <span className="text-[10px] text-muted-foreground font-normal">(opcional)</span></Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Promoción aplicada, observaciones..." />
          </div>

          <Button type="submit" disabled={saving || !name.trim()} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
            Registrar
          </Button>
        </form>
      )}

      {/* History */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : deals.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground py-12">
          <ShoppingBag className="h-10 w-10 opacity-20" />
          <p className="text-sm">Sin ventas registradas</p>
          <p className="text-xs text-muted-foreground/60">Asocia servicios a este cliente para llevar su historial de compras</p>
        </div>
      ) : (
        <div className="space-y-2">
          {deals.map(d => {
            const st = STATUSES.find(s => s.value === d.status) ?? STATUSES[0]
            return (
              <div key={d.id} className="border border-border rounded-xl bg-card/50 p-3.5 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{d.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span>{formatDate(d.sold_at)}</span>
                      {d.quantity > 1 && <span>· x{d.quantity}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-foreground">{formatMoney(Number(d.price) * (d.quantity || 1), d.currency)}</p>
                    {d.quantity > 1 && <p className="text-[10px] text-muted-foreground">{formatMoney(d.price, d.currency)} c/u</p>}
                  </div>
                </div>

                {d.notes && <p className="text-xs text-muted-foreground mt-2">{d.notes}</p>}

                <div className="flex items-center justify-between mt-2.5">
                  <select
                    value={d.status}
                    onChange={e => patch(d.id, { status: e.target.value as Deal['status'] })}
                    className={cn('text-[11px] font-medium rounded-full px-2 py-1 border-0 focus:outline-none cursor-pointer', st.cls)}
                  >
                    {STATUSES.map(s => <option key={s.value} value={s.value} className="bg-popover text-foreground">{s.label}</option>)}
                  </select>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">Precio</span>
                      <Input
                        type="number" min="0" step="any"
                        defaultValue={String(d.price)}
                        onBlur={e => { const v = Number(e.target.value) || 0; if (v !== d.price) patch(d.id, { price: v }) }}
                        className="h-7 w-24 text-xs bg-muted/30"
                      />
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => remove(d.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
