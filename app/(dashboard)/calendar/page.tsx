'use client'

import { useState, useEffect } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import type { Appointment } from '@/lib/types/database'
import { EventDialog } from '@/components/calendar/event-dialog'
import { Button } from '@/components/ui/button'
import { Plus, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { format, addWeeks, subWeeks, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-300/50',
  confirmed: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300/50',
  completed: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-300/50 line-through',
  no_show: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300/50',
  rescheduled: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-300/50',
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8) // 8am - 7pm

export default function CalendarPage() {
  const { supabase } = useSupabase()
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)
  const [defaultStart, setDefaultStart] = useState('')
  const [syncing, setSyncing] = useState(false)

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }) // Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  async function loadAppointments() {
    const from = format(weekStart, 'yyyy-MM-dd')
    const to = format(addDays(weekStart, 6), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .gte('start_time', from)
      .lte('start_time', to + 'T23:59:59')
      .order('start_time')
    setAppointments(data ?? [])
  }

  useEffect(() => { loadAppointments() }, [currentWeek])

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

  function getApptStyle(appt: Appointment) {
    const start = parseISO(appt.start_time)
    const end = parseISO(appt.end_time)
    const startHour = start.getHours() + start.getMinutes() / 60
    const endHour = end.getHours() + end.getMinutes() / 60
    const top = (startHour - 8) * 64
    const height = Math.max((endHour - startHour) * 64, 24)
    return { top, height }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <h1 className="text-lg font-semibold">Calendario</h1>
        <div className="flex items-center gap-2 ml-4">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentWeek(d => subWeeks(d, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentWeek(new Date())}>
            Hoy
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentWeek(d => addWeeks(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium ml-2">
            {format(weekStart, "MMMM yyyy", { locale: es })}
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

      {/* Week view */}
      <div className="flex-1 overflow-auto">
        <div className="flex">
          {/* Hour labels */}
          <div className="w-16 shrink-0 border-r border-border">
            <div className="h-12 border-b border-border" />
            {HOURS.map(h => (
              <div key={h} className="h-16 border-b border-border/50 flex items-start justify-end pr-2 pt-1">
                <span className="text-[10px] text-muted-foreground">{h}:00</span>
              </div>
            ))}
          </div>

          {/* Days */}
          {weekDays.map(day => {
            const isToday = isSameDay(day, new Date())
            const dayAppts = appointments.filter(a => isSameDay(parseISO(a.start_time), day))

            return (
              <div key={day.toISOString()} className="flex-1 border-r border-border last:border-r-0">
                {/* Day header */}
                <div
                  className={cn(
                    'h-12 border-b border-border flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50',
                    isToday && 'bg-primary/5'
                  )}
                  onClick={() => {
                    const startStr = format(day, "yyyy-MM-dd'T'09:00")
                    setDefaultStart(startStr)
                    setSelectedAppt(null)
                    setDialogOpen(true)
                  }}
                >
                  <span className={cn('text-xs text-muted-foreground uppercase', isToday && 'text-primary')}>
                    {format(day, 'EEE', { locale: es })}
                  </span>
                  <span className={cn(
                    'text-lg font-semibold',
                    isToday ? 'text-primary' : 'text-foreground'
                  )}>
                    {format(day, 'd')}
                  </span>
                </div>

                {/* Events grid */}
                <div className="relative">
                  {HOURS.map(h => (
                    <div key={h} className="h-16 border-b border-border/30" />
                  ))}
                  {dayAppts.map(appt => {
                    const { top, height } = getApptStyle(appt)
                    const colorClass = STATUS_COLORS[appt.status] ?? STATUS_COLORS.scheduled
                    return (
                      <div
                        key={appt.id}
                        className={cn(
                          'absolute left-1 right-1 rounded border px-1.5 py-0.5 text-xs cursor-pointer hover:opacity-80 transition-opacity overflow-hidden',
                          colorClass
                        )}
                        style={{ top: `${top}px`, height: `${height}px` }}
                        onClick={() => { setSelectedAppt(appt); setDialogOpen(true) }}
                      >
                        <p className="font-medium truncate">{appt.title}</p>
                        {height > 32 && (
                          <p className="truncate opacity-70">
                            {format(parseISO(appt.start_time), 'HH:mm')} – {format(parseISO(appt.end_time), 'HH:mm')}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <EventDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setSelectedAppt(null) }}
        appointment={selectedAppt}
        defaultStart={defaultStart}
        onSaved={loadAppointments}
      />
    </div>
  )
}
