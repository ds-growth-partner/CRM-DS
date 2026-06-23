import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Default funnel stages seeded for every new tenant.
 * "Nuevo" is marked is_default so it can't be deleted (the entry stage).
 * "Ganado"/"Perdido" carry the won/lost flags used by analytics.
 * All of these are fully editable by the tenant afterwards.
 */
export const DEFAULT_FUNNEL_STAGES = [
  { name: 'Nuevo',       slug: 'nuevo',       color: '#6366f1', position: 0, is_default: true },
  { name: 'Contactado',  slug: 'contactado',  color: '#3b82f6', position: 1 },
  { name: 'Calificado',  slug: 'calificado',  color: '#8b5cf6', position: 2 },
  { name: 'Propuesta',   slug: 'propuesta',   color: '#f59e0b', position: 3 },
  { name: 'Negociación', slug: 'negociacion', color: '#eab308', position: 4 },
  { name: 'Ganado',      slug: 'ganado',      color: '#22c55e', position: 5, is_won: true },
  { name: 'Perdido',     slug: 'perdido',     color: '#ef4444', position: 6, is_lost: true },
] as const

/**
 * Default contact fields. There are no hardcoded "system" fields anymore: nombre,
 * email, empresa, etc. are all regular field definitions the tenant can rename,
 * reorder and delete. The ones with `mapped_column` read/write a real column of
 * `contacts` (so n8n, search, lists and {{variables}} keep working); the rest live
 * in contacts.custom_fields (jsonb). All of them are fully editable afterwards.
 */
export const DEFAULT_CUSTOM_FIELDS = [
  { field_key: 'nombre',              label: 'Nombre',             field_type: 'text',   options: null, position: 0,  mapped_column: 'first_name' },
  { field_key: 'apellido',            label: 'Apellido',           field_type: 'text',   options: null, position: 1,  mapped_column: 'last_name' },
  { field_key: 'telefono',            label: 'Teléfono',           field_type: 'phone',  options: null, position: 2,  mapped_column: 'phone' },
  { field_key: 'email',               label: 'Email',              field_type: 'email',  options: null, position: 3,  mapped_column: 'email' },
  { field_key: 'empresa',             label: 'Empresa',            field_type: 'text',   options: null, position: 4,  mapped_column: 'company' },
  { field_key: 'ciudad',              label: 'Ciudad',             field_type: 'text',   options: null, position: 5,  mapped_column: 'city' },
  { field_key: 'documento',           label: 'Documento',          field_type: 'text',   options: null, position: 6,  mapped_column: null },
  { field_key: 'origen_lead',         label: 'Origen del lead',    field_type: 'select', options: ['Sitio web', 'Referido', 'Redes sociales', 'Anuncio', 'WhatsApp', 'Otro'], position: 7, mapped_column: null },
  { field_key: 'proximo_seguimiento', label: 'Próximo seguimiento', field_type: 'date',  options: null, position: 8,  mapped_column: null },
] as const

/** A couple of starter tags. */
export const DEFAULT_TAGS = [
  { name: 'VIP',      color: '#f59e0b' },
  { name: 'Caliente', color: '#ef4444' },
  { name: 'Frío',     color: '#06b6d4' },
] as const

/**
 * Sample services so the catalog isn't empty on day one. Prices default to 0 and
 * are fully editable; the tenant replaces these with their real service list.
 */
export const DEFAULT_SERVICES = [
  { name: 'Consulta inicial',      description: 'Primera consulta de valoración',   price: 0, position: 0 },
  { name: 'Sesión de seguimiento', description: 'Consulta de control / seguimiento', price: 0, position: 1 },
] as const

/**
 * Seeds default funnel stages, custom fields and tags for a tenant.
 *
 * Idempotent: uses ignoreDuplicates against the (tenant_id, slug/field_key/name)
 * unique constraints, so re-running never overwrites edits the client already made.
 * Safe to call from the Clerk webhook on org/membership creation and from backfills.
 */
export async function seedTenantDefaults(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  tenantId: string,
): Promise<void> {
  await Promise.all([
    supabase.from('funnel_stages').upsert(
      DEFAULT_FUNNEL_STAGES.map((s) => ({ tenant_id: tenantId, ...s })),
      { onConflict: 'tenant_id,slug', ignoreDuplicates: true },
    ),
    supabase.from('custom_field_definitions').upsert(
      DEFAULT_CUSTOM_FIELDS.map((f) => ({ tenant_id: tenantId, ...f })),
      { onConflict: 'tenant_id,field_key', ignoreDuplicates: true },
    ),
    supabase.from('tags').upsert(
      DEFAULT_TAGS.map((t) => ({ tenant_id: tenantId, ...t })),
      { onConflict: 'tenant_id,name', ignoreDuplicates: true },
    ),
  ])

  // Services have no natural unique key, so only seed when the catalog is empty
  // (keeps this idempotent without clobbering the tenant's own catalog).
  const { count } = await supabase
    .from('services')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
  if (!count) {
    await supabase
      .from('services')
      .insert(DEFAULT_SERVICES.map((s) => ({ tenant_id: tenantId, ...s })))
  }
}
