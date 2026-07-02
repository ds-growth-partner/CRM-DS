const MARKER = '/storage/v1/object/'

/**
 * Normaliza una URL de media de Supabase Storage.
 *
 * El n8n de algunos tenants arma mal la media_url del audio/imagen: con el host
 * equivocado, el prefijo `/storage/v1/object/` duplicado y/o sin `/public/`
 * (p. ej. `https://X/storage/v1/object/https://X/storage/v1/object/media/…`).
 * El archivo real vive en el bucket público `media` de NUESTRO proyecto, así que
 * extraemos solo la ruta del objeto y reconstruimos la URL pública correcta,
 * ignorando el host/prefijo basura que venga guardado.
 *
 * - URLs que no son de Supabase Storage se devuelven tal cual.
 * - URLs firmadas (`/object/sign/…?token=`) no se tocan.
 * - Es idempotente: una URL ya correcta se devuelve igual.
 */
export function normalizeMediaUrl(url?: string | null): string {
  if (!url) return ''
  const last = url.lastIndexOf(MARKER)
  if (last === -1) return url // no es storage de Supabase → dejar igual

  let path = url.slice(last + MARKER.length) // "media/…", "public/media/…", "sign/…"
  if (path.startsWith('sign/')) return url   // URL firmada: no tocar
  path = path.replace(/^(public\/|authenticated\/)/, '') // → "media/…"

  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
  if (base) return `${base}${MARKER}public/${path}`

  // Sin env (fallback): al menos de-duplicar usando el host de la propia URL.
  const origin = url.slice(0, url.indexOf(MARKER))
  return `${origin}${MARKER}public/${path}`
}
