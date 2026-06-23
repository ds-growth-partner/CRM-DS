export function formatPhone(phone: string | null): string {
  if (!phone) return ''
  // Format Colombian phone numbers
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('57') && cleaned.length === 12) {
    return `+57 ${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`
  }
  return phone
}

export function toE164(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('57')) return `+${cleaned}`
  if (cleaned.length === 10 && cleaned.startsWith('3')) return `+57${cleaned}`
  return `+${cleaned}`
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function formatMoney(amount: number | null | undefined, currency = 'COP'): string {
  const value = amount ?? 0
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value)
  } catch {
    // Unknown currency code → fall back to a plain number + code
    return `${value.toLocaleString('es-CO')} ${currency}`
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
