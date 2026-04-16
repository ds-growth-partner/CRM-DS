import { formatDistanceToNow, format, isWithinInterval, subHours, addHours } from 'date-fns'
import { es } from 'date-fns/locale'

export function timeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es })
}

export function formatDate(date: string | Date, pattern = 'dd/MM/yyyy'): string {
  return format(new Date(date), pattern, { locale: es })
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: es })
}

export function formatTime(date: string | Date): string {
  return format(new Date(date), 'HH:mm')
}

export function getWindow24hStatus(lastIncomingAt: string | null): {
  isOpen: boolean
  expiresAt: Date | null
  hoursLeft: number | null
  isWarning: boolean
} {
  if (!lastIncomingAt) {
    return { isOpen: false, expiresAt: null, hoursLeft: null, isWarning: false }
  }

  const lastMsg = new Date(lastIncomingAt)
  const expiresAt = addHours(lastMsg, 24)
  const now = new Date()
  const isOpen = now < expiresAt
  const hoursLeft = isOpen ? (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60) : 0
  const isWarning = isOpen && hoursLeft < 2

  return { isOpen, expiresAt, hoursLeft: isOpen ? hoursLeft : null, isWarning }
}
