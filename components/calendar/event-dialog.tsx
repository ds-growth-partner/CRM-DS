'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Appointment, Contact } from '@/lib/types/database'
import { toast } from 'sonner'
import { Loader2, Trash2 } from 'lucide-react'
import { useSupabase } from '@/providers/supabase-provider'

interface EventDialogProps {
  open: boolean
  onClose: () => void
  appointment?: Appointment | null
  defaultStart?: string
  defaultEnd?: string
  onSaved?: () => void
}

export function EventDialog({ open, onClose, appointment, defaultStart, defaultEnd, onSaved }: EventDialogProps) {
  const { supabase } = useSupabase()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [contacts, setContacts] = useState<Partial<Contact>[]>([])
  
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: 'Google Meet',
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    timezone: 'America/Bogota',
    create_google_meet: true,
    contact_id: 'none',
  })

  useEffect(() => {
    if (open) {
      const startIso = appointment?.start_time ?? defaultStart ?? ''
      const endIso = appointment?.end_time ?? defaultEnd ?? ''

      setForm({
        title: appointment?.title ?? '',
        description: appointment?.description ?? '',
        location: appointment?.location ?? 'Google Meet',
        start_date: startIso ? startIso.slice(0, 10) : '',
        start_time: startIso ? startIso.slice(11, 16) : '',
        end_date: endIso ? endIso.slice(0, 10) : '',
        end_time: endIso ? endIso.slice(11, 16) : '',
        timezone: appointment?.timezone ?? 'America/Bogota',
        create_google_meet: true,
        contact_id: appointment?.contact_id ?? 'none',
      })
      
      // Load contacts for dropdown
      supabase.from('contacts').select('id, first_name, last_name, company').order('first_name')
        .then(({ data }) => setContacts(data ?? []))
    }
  }, [open, appointment, defaultStart, defaultEnd, supabase])

  function update(k: string, v: string | boolean | null) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleDelete() {
    if (!appointment) return
    if (!confirm('¿Seguro que deseas eliminar esta cita?')) return

    setDeleting(true)
    try {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          appointment: { id: appointment.id },
        }),
      })

      if (!res.ok) throw new Error()
      toast.success('Cita eliminada')
      onSaved?.()
      onClose()
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setDeleting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.start_date || !form.start_time || !form.end_date || !form.end_time) {
      toast.error('Completa los campos requeridos')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: appointment ? 'update' : 'create',
          appointment: {
            title: form.title,
            description: form.description,
            location: form.location,
            timezone: form.timezone,
            start_time: `${form.start_date}T${form.start_time}:00-05:00`,
            end_time: `${form.end_date}T${form.end_time}:00-05:00`,
            create_google_meet: form.create_google_meet,
            contact_id: form.contact_id === 'none' ? null : form.contact_id,
            id: appointment?.id,
          },
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Unknown error')
      }
      toast.success(appointment ? 'Cita actualizada' : 'Cita creada exitosamente')
      onSaved?.()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar la cita')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{appointment ? 'Editar cita' : 'Nueva cita'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Título *</Label>
            <Input id="title" value={form.title} onChange={e => update('title', e.target.value)} required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Inicio *</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={e => update('start_date', e.target.value)}
                  required
                />
                <Input
                  type="time"
                  value={form.start_time}
                  onChange={e => update('start_time', e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Fin *</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={e => update('end_date', e.target.value)}
                  required
                />
                <Input
                  type="time"
                  value={form.end_time}
                  onChange={e => update('end_time', e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact">Contacto vinculado</Label>
            <Select value={form.contact_id} onValueChange={v => update('contact_id', v)}>
              <SelectTrigger id="contact">
                <SelectValue placeholder="Seleccionar contacto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ninguno</SelectItem>
                {contacts.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.first_name} {c.last_name} {c.company ? `(${c.company})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location">Ubicación</Label>
            <Input id="location" value={form.location} onChange={e => update('location', e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc">Descripción</Label>
            <Textarea id="desc" value={form.description} onChange={e => update('description', e.target.value)} rows={3} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="meet">Crear Google Meet</Label>
            <Switch
              id="meet"
              checked={form.create_google_meet}
              onCheckedChange={v => update('create_google_meet', v)}
            />
          </div>

          <DialogFooter className="flex justify-between items-center sm:justify-between">
            {appointment ? (
              <Button type="button" variant="destructive" size="icon" onClick={handleDelete} disabled={deleting || loading} className="shrink-0">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            ) : (
              <div /> // Spacer
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading || deleting}>Cancelar</Button>
              <Button type="submit" disabled={loading || deleting}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {appointment ? 'Actualizar' : 'Crear cita'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
