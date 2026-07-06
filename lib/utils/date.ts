import { formatDistanceToNow, addHours } from 'date-fns'
import { es } from 'date-fns/locale'

// Toda la app muestra fecha/hora en horario de Colombia (America/Bogota, UTC-5),
// SIN depender de la zona horaria del navegador del usuario ni del servidor (SSR).
// Usamos Intl.DateTimeFormat con timeZone fijo: así el render del servidor (Vercel
// corre en UTC) y el del cliente coinciden — no hay parpadeo ni desfase.
const TZ = 'America/Bogota'

export function timeAgo(date: string | Date): string {
  // Relativo ("hace 5 min"): es independiente de la zona horaria.
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es })
}

// dd/MM/yyyy en horario Colombia
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

// dd/MM/yyyy HH:mm en horario Colombia (24h)
export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(date)).replace(',', '')
}

// HH:mm en horario Colombia (24h)
export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(date))
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
