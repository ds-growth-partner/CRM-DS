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
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
})

const DnDCalendar = withDragAndDrop(Calendar)

export interface CalendarWrapperProps extends Omit<React.ComponentProps<typeof DnDCalendar>, 'localizer'> {}

export const CalendarWrapper = forwardRef<any, CalendarWrapperProps>((props, ref) => {
  const { localizer: _localizer, ...rest } = props
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
          previous: '‹',
          next: '›',
          today: 'Hoy',
          agenda: 'Agenda',
          showMore: (total: number) => `+${total} más`,
          noEventsInRange: 'No hay citas en este rango.',
        }}
        {...rest}
      />
    </div>
  )
})
CalendarWrapper.displayName = 'CalendarWrapper'
