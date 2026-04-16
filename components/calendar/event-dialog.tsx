'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import type { Appointment } from '@/lib/types/database'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface EventDialogProps {
  open: boolean
  onClose: () => void
  appointment?: Appointment | null
  defaultStart?: string
  onSaved?: () => void
}

export function EventDialog({ open, onClose, appointment, defaultStart, onSaved }: EventDialogProps) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: appointment?.title ?? '',
    description: appointment?.description ?? '',
    location: appointment?.location ?? 'Google Meet',
    start_time: appointment?.start_time ?? defaultStart ?? '',
    end_time: appointment?.end_time ?? '',
    timezone: appointment?.timezone ?? 'America/Bogota',
    create_google_meet: true,
  })

  function update(k: string, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.start_time || !form.end_time) {
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
            ...form,
            id: appointment?.id,
          },
        }),
      })

      if (!res.ok) throw new Error()
      toast.success(appointment ? 'Cita actualizada' : 'Cita creada exitosamente')
      onSaved?.()
      onClose()
    } catch {
      toast.error('Error al guardar la cita')
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start">Inicio *</Label>
              <Input
                id="start"
                type="datetime-local"
                value={form.start_time.slice(0, 16)}
                onChange={e => update('start_time', e.target.value + ':00-05:00')}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end">Fin *</Label>
              <Input
                id="end"
                type="datetime-local"
                value={form.end_time.slice(0, 16)}
                onChange={e => update('end_time', e.target.value + ':00-05:00')}
                required
              />
            </div>
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {appointment ? 'Actualizar' : 'Crear cita'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
