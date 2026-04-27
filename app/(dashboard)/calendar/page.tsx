'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import { useAuth } from '@/providers/auth-provider'
import type { Appointment } from '@/lib/types/database'
import { EventDialog } from '@/components/calendar/event-dialog'
import { Button } from '@/components/ui/button'
import { Plus, Loader2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { CalendarWrapper } from '@/components/calendar/calendar-wrapper'

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  resource: Appointment
}

export default function CalendarPage() {
  const { supabase } = useSupabase()
  const { tenant } = useAuth()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)
  const [defaultStart, setDefaultStart] = useState<string | undefined>()
  const [defaultEnd, setDefaultEnd] = useState<string | undefined>()

  const loadEvents = useCallback(async () => {
    if (!tenant) return
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('start_time')
    if (data) {
      setEvents(data.map(appt => ({
        id: appt.id,
        title: appt.title,
        start: parseISO(appt.start_time),
        end: parseISO(appt.end_time),
        resource: appt,
      })))
    }
    setLoading(false)
  }, [supabase, tenant])

  useEffect(() => {
    if (!tenant) return
    loadEvents()

    const channel = supabase
      .channel('appointments-calendar')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'appointments',
        filter: `tenant_id=eq.${tenant.id}`,
      }, (payload) => {
        const appt = payload.new as Appointment
        if (payload.eventType === 'DELETE') {
          setEvents(prev => prev.filter(e => e.id !== payload.old.id))
        } else if (payload.eventType === 'INSERT') {
          setEvents(prev => [...prev, {
            id: appt.id,
            title: appt.title,
            start: parseISO(appt.start_time),
            end: parseISO(appt.end_time),
            resource: appt,
          }])
        } else if (payload.eventType === 'UPDATE') {
          setEvents(prev => prev.map(e => e.id === appt.id ? {
            ...e,
            title: appt.title,
            start: parseISO(appt.start_time),
            end: parseISO(appt.end_time),
            resource: appt,
          } : e))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, tenant, loadEvents])

  const handleSelect = useCallback((event: any) => {
    setSelectedAppt(event?.resource ?? null)
    setDefaultStart(undefined)
    setDefaultEnd(undefined)
    setDialogOpen(true)
  }, [])

  const handleSelectSlot = useCallback((data: any) => {
    const start = data.start
    const end = data.end
    setSelectedAppt(null)
    setDefaultStart(format(start, "yyyy-MM-dd'T'HH:mm:ss"))
    setDefaultEnd(format(end, "yyyy-MM-dd'T'HH:mm:ss"))
    setDialogOpen(true)
  }, [])

  const COLOMBIA_OFFSET = '-05:00'

  function toISOWithTZ(date: Date): string {
    return format(date, "yyyy-MM-dd'T'HH:mm:ss") + COLOMBIA_OFFSET
  }

  const handleEventDrop = useCallback(async (data: any) => {
    const { event, start, end } = data
    const appt = event?.resource
    if (!appt) return

    const res = await fetch('/api/calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        appointment: {
          ...appt,
          start_time: toISOWithTZ(start),
          end_time: toISOWithTZ(end),
        },
      }),
    })

    if (!res.ok) {
      loadEvents()
    }
  }, [loadEvents])

  const handleEventResize = useCallback(async (data: any) => {
    const { event, start, end } = data
    const appt = event?.resource
    if (!appt) return

    const res = await fetch('/api/calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        appointment: {
          ...appt,
          start_time: toISOWithTZ(start),
          end_time: toISOWithTZ(end),
        },
      }),
    })

    if (!res.ok) {
      loadEvents()
    }
  }, [loadEvents])

  const STATUS_COLORS: Record<string, string> = {
    scheduled: '#3b82f6',
    confirmed: '#10b981',
    completed: '#6b7280',
    cancelled: '#ef4444',
    no_show: '#f59e0b',
    rescheduled: '#8b5cf6',
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50 backdrop-blur-sm">
        <div>
          <h1 className="text-lg font-semibold">Calendario</h1>
          <p className="text-xs text-muted-foreground">Citas y eventos</p>
        </div>
        <Button size="sm" onClick={() => { setSelectedAppt(null); setDefaultStart(undefined); setDefaultEnd(undefined); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nueva cita
        </Button>
      </div>

      <div className="flex-1 overflow-hidden p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
          </div>
        ) : (
          <div className="h-full bg-card rounded-xl border border-border overflow-hidden">
            <CalendarWrapper
              events={events}
              culture="es"
              defaultView="week"
              views={['month', 'week', 'day', 'agenda']}
              messages={{
                week: 'Semana',
                work_week: 'Semana laboral',
                day: 'Día',
                month: 'Mes',
                previous: '‹',
                next: '›',
                today: 'Hoy',
                agenda: 'Agenda',
                noEventsInRange: 'No hay citas en este rango.',
              }}
              selectable
              onSelectEvent={handleSelect}
              onSelectSlot={handleSelectSlot}
              onEventDrop={handleEventDrop}
              onEventResize={handleEventResize}
              resizable
              draggableAccessor={() => true}
              eventPropGetter={(event: any) => ({
                style: {
                  backgroundColor: STATUS_COLORS[event?.resource?.status] ?? '#6366f1',
                  borderRadius: '6px',
                  border: 'none',
                  color: '#fff',
                  fontSize: '12px',
                  padding: '2px 6px',
                },
              })}
            />
          </div>
        )}
      </div>

      <EventDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setSelectedAppt(null) }}
        appointment={selectedAppt}
        defaultStart={defaultStart}
        defaultEnd={defaultEnd}
        onSaved={loadEvents}
      />
    </div>
  )
}
