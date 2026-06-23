'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { XIcon, Link2, MapPin, Clock, Users, Video, Plus, Trash2, Loader2, ChevronDown, CalendarDays } from 'lucide-react'
import type { Appointment } from '@/lib/types/database'
import { toFieldMap, contactName, CONTACT_FIELDS_EMBED } from '@/lib/utils/contact-fields'
import { toast } from 'sonner'
import { useSupabase } from '@/providers/supabase-provider'
import { format, addHours, addDays, setHours, setMinutes } from 'date-fns'
import { es } from 'date-fns/locale'

interface EventDialogProps {
  open: boolean
  onClose: () => void
  appointment?: Appointment | null
  defaultStart?: string
  defaultEnd?: string
  onSaved?: () => void
}

const TIME_PRESETS = [
  { label: '30 min', minutes: 30 },
  { label: '1 hora', minutes: 60 },
  { label: '1.5 horas', minutes: 90 },
  { label: '2 horas', minutes: 120 },
]

const QUICK_DATES = [
  { label: 'Hoy', getDate: () => new Date() },
  { label: 'Mañana', getDate: () => addDays(new Date(), 1) },
  { label: 'Pasado mañana', getDate: () => addDays(new Date(), 2) },
  { label: 'Próxima semana', getDate: () => addDays(new Date(), 7) },
]

export function EventDialog({ open, onClose, appointment, defaultStart, defaultEnd, onSaved }: EventDialogProps) {
  const { supabase } = useSupabase()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [contacts, setContacts] = useState<{ id: string; name: string; empresa?: string }[]>([])
  const [guestInput, setGuestInput] = useState('')
  const [attendees, setAttendees] = useState<string[]>([])
  const [showDatePicker, setShowDatePicker] = useState(false)

  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    timezone: 'America/Bogota',
    contact_id: 'none',
    google_meet: true,
    status: 'scheduled',
    attendees: [] as string[],
  })

  useEffect(() => {
    if (open) {
      const startIso = appointment?.start_time ?? defaultStart ?? ''
      const endIso = appointment?.end_time ?? defaultEnd ?? ''
      const startDate = startIso ? new Date(startIso) : new Date()
      const endDate = endIso ? new Date(endIso) : addHours(startDate, 1)

      const savedAttendees = appointment?.description
        ? extractEmails(appointment.description)
        : []

      setForm({
        title: appointment?.title ?? '',
        description: appointment?.description ?? '',
        location: appointment?.location ?? '',
        start_date: format(startDate, 'yyyy-MM-dd'),
        start_time: format(startDate, 'HH:mm'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        end_time: format(endDate, 'HH:mm'),
        timezone: appointment?.timezone ?? 'America/Bogota',
        contact_id: appointment?.contact_id ?? 'none',
        google_meet: appointment?.location?.includes('meet.google.com') || !appointment?.location,
        status: appointment?.status ?? 'scheduled',
        attendees: savedAttendees,
      })
      setAttendees(savedAttendees)

      supabase.from('contacts').select(`id, ${CONTACT_FIELDS_EMBED}`)
        .then(({ data }) => setContacts(
          (data ?? []).map((c: { id: string; contact_field_values?: { field_key: string; value: string | null }[] }) => {
            const f = toFieldMap(c.contact_field_values)
            return { id: c.id, name: contactName(f), empresa: f.empresa }
          })
        ))
    }
  }, [open, appointment, defaultStart, defaultEnd, supabase])

  function extractEmails(text: string): string[] {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
    return text.match(emailRegex) || []
  }

  function update(k: string, v: string | boolean | null) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function applyTimePreset(minutes: number) {
    const startDate = new Date(`${form.start_date}T${form.start_time}:00`)
    const endDate = addHours(startDate, minutes / 60)
    setForm(f => ({
      ...f,
      end_time: format(endDate, 'HH:mm'),
      end_date: format(endDate, 'yyyy-MM-dd'),
    }))
  }

  function applyQuickDate(getDate: () => Date) {
    const date = getDate()
    setForm(f => ({
      ...f,
      start_date: format(date, 'yyyy-MM-dd'),
      end_date: format(date, 'yyyy-MM-dd'),
    }))
  }

  function addAttendee(email: string) {
    if (email && email.includes('@') && !attendees.includes(email)) {
      setAttendees(prev => [...prev, email])
      setForm(f => ({ ...f, attendees: [...f.attendees, email] }))
    }
    setGuestInput('')
  }

  function removeAttendee(email: string) {
    setAttendees(prev => prev.filter(e => e !== email))
    setForm(f => ({ ...f, attendees: f.attendees.filter(e => e !== email) }))
  }

  async function handleDelete() {
    if (!appointment) return
    if (!confirm('¿Eliminar esta cita?')) return
    setDeleting(true)
    try {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', appointment: { id: appointment.id } }),
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
      const location = form.google_meet
        ? 'https://meet.google.com/' + Math.random().toString(36).substring(2, 15)
        : form.location

      const description = form.attendees.length > 0
        ? `Invitados: ${form.attendees.join(', ')}\n${form.description || ''}`
        : form.description

      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: appointment ? 'update' : 'create',
          appointment: {
            title: form.title,
            description,
            location,
            timezone: form.timezone,
            start_time: `${form.start_date}T${form.start_time}:00-05:00`,
            end_time: `${form.end_date}T${form.end_time}:00-05:00`,
            contact_id: form.contact_id === 'none' ? null : form.contact_id,
            status: form.status,
            id: appointment?.id,
            google_meet: form.google_meet,
          },
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error')
      }
      toast.success(appointment ? 'Cita actualizada' : 'Cita creada')
      onSaved?.()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  const isEditing = !!appointment

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 [&_[data-slot=dialog-content]]:sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="p-6 pb-4">
            <input
              type="text"
              value={form.title}
              onChange={e => update('title', e.target.value)}
              placeholder="Agregar título"
              className="w-full text-xl font-medium bg-transparent border-none outline-none placeholder:text-muted-foreground focus:ring-0 p-0"
              required
            />
          </div>

          <div className="px-6 pb-4 space-y-4">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={e => update('start_date', e.target.value)}
                    className="border-0 p-0 h-auto text-sm bg-transparent focus:ring-0 hover:bg-muted/50 rounded-md px-2 py-1"
                  />
                  <Input
                    type="time"
                    value={form.start_time}
                    onChange={e => update('start_time', e.target.value)}
                    className="border-0 p-0 h-auto text-sm bg-transparent focus:ring-0 hover:bg-muted/50 rounded-md px-2 py-1"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={e => update('end_date', e.target.value)}
                    className="border-0 p-0 h-auto text-sm bg-transparent focus:ring-0 hover:bg-muted/50 rounded-md px-2 py-1"
                  />
                  <Input
                    type="time"
                    value={form.end_time}
                    onChange={e => update('end_time', e.target.value)}
                    className="border-0 p-0 h-auto text-sm bg-transparent focus:ring-0 hover:bg-muted/50 rounded-md px-2 py-1"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {TIME_PRESETS.map(preset => (
                <Button
                  key={preset.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyTimePreset(preset.minutes)}
                  className="h-7 text-xs"
                >
                  {preset.label}
                </Button>
              ))}
              {QUICK_DATES.map(qd => (
                <Button
                  key={qd.label}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => applyQuickDate(qd.getDate)}
                  className="h-7 text-xs"
                >
                  {qd.label}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-2 border-t">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                value={form.location}
                onChange={e => update('location', e.target.value)}
                placeholder="Agregar ubicación"
                className="flex-1"
              />
            </div>

            <div className="flex items-center gap-3">
              <Video className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex items-center justify-between flex-1">
                <Label className="cursor-pointer">Google Meet</Label>
                <Switch
                  checked={form.google_meet}
                  onCheckedChange={v => update('google_meet', v)}
                />
              </div>
            </div>

            {form.google_meet && form.location?.includes('meet.google.com') && (
              <div className="flex items-center gap-2 ml-7 p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                <Link2 className="h-4 w-4 text-green-600" />
                <a
                  href={form.location}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-green-600 hover:underline truncate flex-1"
                >
                  {form.location}
                </a>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2 border-t">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {attendees.map(email => (
                    <Badge key={email} variant="secondary" className="text-xs gap-1 pr-1">
                      {email}
                      <button
                        type="button"
                        onClick={() => removeAttendee(email)}
                        className="hover:text-destructive"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <Input
                  value={guestInput}
                  onChange={e => setGuestInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault()
                      addAttendee(guestInput)
                    }
                  }}
                  placeholder="Agregar invitados (enter para añadir)"
                  className="text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2 border-t">
              <Select value={form.contact_id} onValueChange={v => update('contact_id', v)}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Vincular contacto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguno</SelectItem>
                  {contacts.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex flex-col items-start">
                        <span>{c.name}</span>
                        {c.empresa && <span className="text-xs text-muted-foreground">{c.empresa}</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-2">
              <Textarea
                value={form.description}
                onChange={e => update('description', e.target.value)}
                placeholder="Agregar notas o descripción"
                rows={3}
                className="resize-none"
              />
            </div>

            {isEditing && (
              <div className="pt-2 border-t">
                <Label className="mb-2 block">Estado</Label>
                <Select value={form.status} onValueChange={v => update('status', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Programada</SelectItem>
                    <SelectItem value="confirmed">Confirmada</SelectItem>
                    <SelectItem value="completed">Completada</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                    <SelectItem value="no_show">No asistio</SelectItem>
                    <SelectItem value="rescheduled">Reprogramada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 border-t bg-muted/30">
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={handleDelete}
                disabled={deleting || loading}
                className="mr-auto"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || deleting}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? 'Guardar cambios' : 'Crear cita'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
