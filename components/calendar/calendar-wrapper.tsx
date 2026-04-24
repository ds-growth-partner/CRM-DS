'use client'

import { Calendar, dateFnsLocalizer, Event as CalendarEvent, Views, DateLocalizer } from 'react-big-calendar'
import withDragAndDrop, { withDragAndDropProps } from 'react-big-calendar/lib/addons/dragAndDrop'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { forwardRef } from 'react'

import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import './calendar-overrides.css'

const locales = {
  'es': es,
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

// @ts-ignore
const DnDCalendar = withDragAndDrop(Calendar)

export interface CalendarWrapperProps extends Omit<React.ComponentProps<typeof DnDCalendar>, 'localizer'> {
  // Add any custom props here if needed
}

export const CalendarWrapper = forwardRef<any, CalendarWrapperProps>((props, ref) => {
  return (
    <div className="h-full w-full calendar-wrapper">
      <DnDCalendar
        ref={ref}
        localizer={localizer}
        culture="es"
        messages={{
          week: 'Semana',
          work_week: 'Semana laboral',
          day: 'Día',
          month: 'Mes',
          previous: 'Anterior',
          next: 'Siguiente',
          today: 'Hoy',
          agenda: 'Agenda',
          showMore: (total: number) => `+${total} más`,
          noEventsInRange: 'No hay citas en este rango.',
        }}
        {...props}
      />
    </div>
  )
})
CalendarWrapper.displayName = 'CalendarWrapper'
