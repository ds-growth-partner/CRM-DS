'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import type { Appointment } from '@/lib/types/database'
import { EventDialog } from '@/components/calendar/event-dialog'
import { Button } from '@/components/ui/button'
import { Plus, ChevronLeft, ChevronRight, RefreshCw, Trash2 } from 'lucide-react'
import { format, parseISO, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { CalendarWrapper } from '@/components/calendar/calendar-wrapper'

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-300/50',
  confirmed: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300/50',
  completed: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-300/50 line-through',
  no_show: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300/50',
  rescheduled: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-300/50',
}

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  resource: Appointment
}

export default function CalendarPage() {
  const { supabase } = useSupabase()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'month' | 'week' | 'day' | 'agenda'>('week')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)
  const [defaultStart, setDefaultStart] = useState('')
  const [defaultEnd, setDefaultEnd] = useState('')
  const [syncing, setSyncing] = useState(false)

  const loadAppointments = useCallback(async () => {
    // For now, load a generous range (e.g., +/- 2 months) to cover month views
    const from = format(subMonths(currentDate, 2), 'yyyy-MM-dd')
    const to = format(addMonths(currentDate, 2), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .gte('start_time', from)
      .lte('start_time', to + 'T23:59:59')
    setAppointments(data ?? [])
  }, [supabase, currentDate])

  useEffect(() => { loadAppointments() }, [loadAppointments])

  async function handleSync() {
    setSyncing(true)
    try {
      await fetch('/api/calendar/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      await loadAppointments()
      toast.success('Calendario sincronizado')
    } catch {
      toast.error('Error al sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  const events: CalendarEvent[] = appointments.map(appt => ({
    id: appt.id,
    title: appt.title,
    start: parseISO(appt.start_time),
    end: parseISO(appt.end_time),
    resource: appt,
  }))

  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
    setDefaultStart(format(start, "yyyy-MM-dd'T'HH:mm"))
    setDefaultEnd(format(end, "yyyy-MM-dd'T'HH:mm"))
    setSelectedAppt(null)
    setDialogOpen(true)
  }

  const handleSelectEvent = (event: any) => {
    setSelectedAppt(event.resource)
    setDialogOpen(true)
  }

  const handleEventDrop = async ({ event, start, end }: any) => {
    const updatedAppt = { ...event.resource, start_time: start.toISOString(), end_time: end.toISOString() }
    
    // Optimistic update
    setAppointments(prev => prev.map(a => a.id === event.id ? updatedAppt : a))
    
    try {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', appointment: updatedAppt }),
      })
      if (!res.ok) throw new Error()
      toast.success('Evento actualizado')
    } catch {
      toast.error('Error al actualizar el evento')
      await loadAppointments() // revert
    }
  }

  const handleEventResize = async ({ event, start, end }: any) => {
    const updatedAppt = { ...event.resource, start_time: start.toISOString(), end_time: end.toISOString() }
    
    setAppointments(prev => prev.map(a => a.id === event.id ? updatedAppt : a))
    
    try {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', appointment: updatedAppt }),
      })
      if (!res.ok) throw new Error()
      toast.success('Evento actualizado')
    } catch {
      toast.error('Error al actualizar el evento')
      await loadAppointments() // revert
    }
  }

  const eventPropGetter = (event: CalendarEvent) => {
    const appt = event.resource
    const colorClass = STATUS_COLORS[appt.status] ?? STATUS_COLORS.scheduled
    // Extract base colors from the tailwind class conceptually, but for rbc-event we just pass classes
    // We also return a style object if we want to rely on the custom CSS overrides
    return {
      className: cn('border shadow-sm', colorClass),
      style: {
        backgroundColor: 'var(--tw-bg-opacity)', // The tailwind class will set this
      }
    }
  }

  const navigate = (action: 'PREV' | 'NEXT' | 'TODAY') => {
    if (action === 'TODAY') {
      setCurrentDate(new Date())
      return
    }
    
    if (view === 'month') {
      setCurrentDate(action === 'PREV' ? subMonths(currentDate, 1) : addMonths(currentDate, 1))
    } else if (view === 'week') {
      setCurrentDate(action === 'PREV' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1))
    } else if (view === 'day') {
      setCurrentDate(action === 'PREV' ? subDays(currentDate, 1) : addDays(currentDate, 1))
    }
  }

  const getHeaderText = () => {
    if (view === 'month') return format(currentDate, "MMMM yyyy", { locale: es })
    if (view === 'week') return `Semana del ${format(currentDate, "d MMM yyyy", { locale: es })}`
    return format(currentDate, "d MMMM yyyy", { locale: es })
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-6 py-4 border-b border-border">
        <h1 className="text-lg font-semibold shrink-0">Calendario</h1>
        
        <div className="flex items-center gap-1 sm:ml-4 bg-muted/30 p-1 rounded-lg border border-border">
          <Button variant={view === 'month' ? 'default' : 'ghost'} size="sm" onClick={() => setView('month')} className="h-7 text-xs">Mes</Button>
          <Button variant={view === 'week' ? 'default' : 'ghost'} size="sm" onClick={() => setView('week')} className="h-7 text-xs">Semana</Button>
          <Button variant={view === 'day' ? 'default' : 'ghost'} size="sm" onClick={() => setView('day')} className="h-7 text-xs">Día</Button>
        </div>

        <div className="flex items-center gap-2 sm:ml-4">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate('PREV')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => navigate('TODAY')}>
            Hoy
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate('NEXT')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium ml-2 capitalize">
            {getHeaderText()}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={cn("h-4 w-4 mr-1.5", syncing && "animate-spin")} />
            Sincronizar GCal
          </Button>
          <Button size="sm" onClick={() => { setSelectedAppt(null); setDialogOpen(true) }}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nueva cita
          </Button>
        </div>
      </div>

      {/* Calendar Area */}
      <div className="flex-1 p-4 overflow-hidden">
        <CalendarWrapper
          events={events}
          date={currentDate}
          view={view}
          onNavigate={(newDate: Date) => setCurrentDate(newDate)}
          onView={(newView: any) => setView(newView)}
          selectable
          resizable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          onEventDrop={handleEventDrop}
          onEventResize={handleEventResize}
          eventPropGetter={eventPropGetter as any}
          toolbar={false} // We are using our custom header instead
          defaultView="week"
          step={15}
          timeslots={4}
        />
      </div>

      <EventDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setSelectedAppt(null) }}
        appointment={selectedAppt}
        defaultStart={defaultStart}
        defaultEnd={defaultEnd}
        onSaved={loadAppointments}
      />
    </div>
  )
}

