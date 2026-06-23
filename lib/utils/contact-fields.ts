import type { ContactFields } from '@/lib/types/database'

/**
 * Todos los campos de perfil del contacto viven en la tabla `contact_field_values`
 * (una fila por campo). Estos helpers convierten ese embed en un mapa cómodo y
 * resuelven el nombre/teléfono/etc. de forma consistente en toda la app.
 *
 * Convención de field_key para los campos base: nombre, apellido, telefono,
 * email, empresa, ciudad, documento. El resto son los que cree el tenant.
 */

type RawFieldRow = { field_key: string; value: string | null }

/** Convierte el embed contact_field_values(field_key,value) en { key: value }. */
export function toFieldMap(rows?: RawFieldRow[] | null): ContactFields {
  const map: ContactFields = {}
  for (const r of rows ?? []) {
    if (r?.field_key && r.value != null && r.value !== '') map[r.field_key] = r.value
  }
  return map
}

/**
 * Toma una fila cruda de `contacts` con el embed `contact_field_values` y devuelve
 * el contacto con `fields` ya armado (y sin el array crudo).
 */
export function withFields<T extends Record<string, unknown>>(
  raw: T & { contact_field_values?: RawFieldRow[] | null },
): T & { fields: ContactFields } {
  const { contact_field_values, ...rest } = raw
  return { ...(rest as T), fields: toFieldMap(contact_field_values) }
}

/** Nombre a mostrar a partir del mapa de campos. */
export function contactName(fields?: ContactFields | null): string {
  const f = fields ?? {}
  const full = [f.nombre, f.apellido].filter(Boolean).join(' ').trim()
  return full || f.telefono || 'Sin nombre'
}

/** Inicial(es) para el avatar. */
export function contactInitials(fields?: ContactFields | null): string {
  const name = contactName(fields)
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

/** El select de PostgREST para traer los campos junto con el contacto. */
export const CONTACT_FIELDS_EMBED = 'contact_field_values(field_key, value)'
