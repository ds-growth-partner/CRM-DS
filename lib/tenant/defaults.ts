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
 * Sample custom fields so a new tenant immediately sees how the feature works.
 * `options` is stored as a real JSON array (jsonb) so the UI can read it directly.
 */
export const DEFAULT_CUSTOM_FIELDS = [
  { field_key: 'presupuesto',         label: 'Presupuesto',        field_type: 'number', options: null,                                                                   position: 0 },
  { field_key: 'origen_lead',         label: 'Origen del lead',    field_type: 'select', options: ['Sitio web', 'Referido', 'Redes sociales', 'Anuncio', 'WhatsApp', 'Otro'], position: 1 },
  { field_key: 'proximo_seguimiento', label: 'Próximo seguimiento', field_type: 'date',  options: null,                                                                   position: 2 },
] as const

/** A couple of starter tags. */
export const DEFAULT_TAGS = [
  { name: 'VIP',      color: '#f59e0b' },
  { name: 'Caliente', color: '#ef4444' },
  { name: 'Frío',     color: '#06b6d4' },
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
}
