import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/supabase/auth-context'
import { getN8nClientForTenant } from '@/lib/n8n/client'

// Sincroniza las plantillas HSM del tenant.
//
// Modelo multi-tenant: hay dos formas de que un tenant tenga plantillas:
//  1) El CRM tiene las credenciales Meta del tenant (meta_access_token + waba_id)
//     → traemos en vivo desde la Graph API y hacemos upsert en hsm_templates.
//  2) El tenant usa su propio n8n (lo normal): n8n tiene las credenciales Meta y
//     escribe hsm_templates. Aquí disparamos su webhook `sync-templates` para que
//     re-sincronice, y devolvemos lo que haya en la BD.
//
// Siempre respondemos 200 con las plantillas actuales para que el botón "funcione"
// aunque el n8n del tenant aún no tenga el workflow de sync — el usuario ve su lista.

async function getTenantMeta(tenantId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('tenant_credentials')
    .select('meta_access_token, waba_id')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  return {
    accessToken: data?.meta_access_token?.trim() || '',
    wabaId: data?.waba_id?.trim() || '',
  }
}

async function syncFromMeta(tenantId: string, accessToken: string, wabaId: string) {
  const admin = createAdminClient()
  const metaRes = await fetch(
    `https://graph.facebook.com/v19.0/${wabaId}/message_templates?fields=name,status,language,category,components&limit=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!metaRes.ok) {
    const text = await metaRes.text().catch(() => '')
    console.error(`[templates/sync] Meta API ${metaRes.status}:`, text)
    return { ok: false as const, status: metaRes.status }
  }

  const metaData = await metaRes.json()
  const templates = (metaData.data ?? []).map((t: Record<string, unknown>) => {
    const components = (t.components as { type: string; text?: string }[]) ?? []
    return {
      tenant_id: tenantId,
      meta_template_id: t.id,
      name: t.name,
      language: t.language,
      category: t.category,
      status: t.status,
      body_text: components.find(c => c.type === 'BODY')?.text ?? '',
      header_text: components.find(c => c.type === 'HEADER')?.text ?? null,
      footer_text: components.find(c => c.type === 'FOOTER')?.text ?? null,
      variables_count: new Set(
        components.map(c => c.text ?? '').join(' ').match(/\{\{(.+?)\}\}/g) ?? []
      ).size,
      last_synced_at: new Date().toISOString(),
    }
  })

  if (templates.length > 0) {
    await admin.from('hsm_templates').upsert(templates, { onConflict: 'tenant_id,meta_template_id' })
  }
  return { ok: true as const, count: templates.length }
}

export async function POST() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  if (!['owner', 'admin'].includes(ctx.role)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { accessToken, wabaId } = await getTenantMeta(ctx.tenantId)

  let source: 'meta' | 'n8n' | 'db' = 'db'

  if (accessToken && wabaId) {
    // Caso 1: el CRM tiene credenciales Meta → sync en vivo.
    const result = await syncFromMeta(ctx.tenantId, accessToken, wabaId)
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: 'Meta API error', n8n_status: result.status },
        { status: 502 }
      )
    }
    source = 'meta'
  } else {
    // Caso 2: disparar el n8n del tenant para que re-sincronice (best-effort).
    // No fallamos si el workflow no existe: devolvemos lo que haya en la BD.
    try {
      const client = await getN8nClientForTenant(ctx.tenantId)
      const res = await client.post('sync-templates', { tenant_id: ctx.tenantId })
      if (res.ok) {
        source = 'n8n'
        // Damos un instante a n8n para escribir en Supabase antes de leer.
        await new Promise(r => setTimeout(r, 1500))
      } else {
        console.warn(`[templates/sync] n8n sync-templates devolvió ${res.status} (se usa la BD)`)
      }
    } catch (err) {
      console.warn('[templates/sync] no se pudo contactar n8n (se usa la BD):', err)
    }
  }

  const { data: templates } = await admin
    .from('hsm_templates')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })

  return NextResponse.json({ ok: true, source, templates: templates ?? [] })
}
