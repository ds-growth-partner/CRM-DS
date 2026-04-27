import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/supabase/auth-context'
import { config } from '@/lib/config'

export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  if (!config.meta.accessToken || !config.meta.wabaId) {
    const { data } = await admin.from('hsm_templates').select('*').eq('tenant_id', ctx.tenantId).order('created_at', { ascending: false })
    return NextResponse.json({ templates: data ?? [] })
  }

  const metaRes = await fetch(
    `https://graph.facebook.com/v19.0/${config.meta.wabaId}/message_templates?fields=name,status,language,category,components&limit=100`,
    { headers: { Authorization: `Bearer ${config.meta.accessToken}` } }
  )

  if (!metaRes.ok) {
    return NextResponse.json({ error: 'Meta API error' }, { status: metaRes.status })
  }

  const metaData = await metaRes.json()
  const templates = (metaData.data ?? []).map((t: Record<string, unknown>) => ({
    tenant_id: ctx.tenantId,
    meta_template_id: t.id,
    name: t.name,
    language: t.language,
    category: t.category,
    status: t.status,
    body_text: (t.components as { type: string; text: string }[])?.find(c => c.type === 'BODY')?.text ?? '',
    header_text: (t.components as { type: string; text: string }[])?.find(c => c.type === 'HEADER')?.text,
    footer_text: (t.components as { type: string; text: string }[])?.find(c => c.type === 'FOOTER')?.text,
    variables_count: ((t.components as { text: string }[])?.map(c => c.text ?? '').join(' ').match(/\{\{[0-9]+\}\}/g) ?? []).length,
    last_synced_at: new Date().toISOString(),
  }))

  if (templates.length > 0) {
    await admin.from('hsm_templates').upsert(templates, { onConflict: 'tenant_id,meta_template_id' })
  }

  return NextResponse.json({ templates })
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['owner', 'admin'].includes(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!config.meta.accessToken || !config.meta.wabaId) {
    return NextResponse.json({ error: 'Meta credentials not configured' }, { status: 400 })
  }

  const body = await request.json()

  const metaRes = await fetch(
    `https://graph.facebook.com/v19.0/${config.meta.wabaId}/message_templates`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.meta.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  const data = await metaRes.json()
  return NextResponse.json(data, { status: metaRes.status })
}
