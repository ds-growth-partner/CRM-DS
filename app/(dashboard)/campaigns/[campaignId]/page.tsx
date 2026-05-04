'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSupabase } from '@/providers/supabase-provider'
import { useAuth } from '@/providers/auth-provider'
import type { Campaign } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/utils/date'
import {
  ArrowLeft, Send, CheckCheck, Eye, Users, Play, Pause,
  MessageSquare, ExternalLink, CheckCircle2, XCircle, Clock, AlertCircle
} from 'lucide-react'

const STATUS_CONFIG: Record<string, { label: string; class: string; icon: React.ElementType }> = {
  draft: { label: 'Borrador', class: 'bg-muted text-muted-foreground', icon: Clock },
  scheduled: { label: 'Programada', class: 'bg-blue-500/10 text-blue-400', icon: Clock },
  sending: { label: 'Enviando...', class: 'bg-amber-500/10 text-amber-400', icon: Play },
  completed: { label: 'Completada', class: 'bg-emerald-500/10 text-emerald-400', icon: CheckCircle2 },
  failed: { label: 'Fallida', class: 'bg-red-500/10 text-red-400', icon: XCircle },
  cancelled: { label: 'Cancelada', class: 'bg-muted text-muted-foreground', icon: XCircle },
}

const RECIPIENT_STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  pending: { label: 'Pendiente', class: 'bg-muted text-muted-foreground' },
  sent: { label: 'Enviado', class: 'bg-blue-500/10 text-blue-400' },
  delivered: { label: 'Entregado', class: 'bg-emerald-500/10 text-emerald-400' },
  read: { label: 'Leído', class: 'bg-primary/10 text-primary' },
  failed: { label: 'Fallido', class: 'bg-red-500/10 text-red-400' },
}

interface RecipientRow {
  id: string
  contact_id: string
  contact_name: string
  contact_phone: string | null
  contact_wa_id: string | null
  status: string
  sent_at: string | null
  delivered_at: string | null
  read_at: string | null
  error_message: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRecipient(r: any): RecipientRow {
  return {
    id: r.id,
    contact_id: r.contact_id,
    contact_name: Array.isArray(r.contact)
      ? `${r.contact[0]?.first_name ?? ''} ${r.contact[0]?.last_name ?? ''}`.trim()
      : 'Sin nombre',
    contact_phone: r.contact?.[0]?.phone ?? null,
    contact_wa_id: r.contact?.[0]?.wa_id ?? null,
    status: r.status ?? 'pending',
    sent_at: r.sent_at ?? null,
    delivered_at: r.delivered_at ?? null,
    read_at: r.read_at ?? null,
    error_message: r.error_message ?? null,
  }
}

export default function CampaignDetailPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const resolved = use(params)
  const { campaignId } = resolved
  const router = useRouter()
  const { supabase } = useSupabase()
  const { tenant } = useAuth()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [recipients, setRecipients] = useState<RecipientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  async function loadCampaign() {
    const { data: campaignData } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()
    setCampaign(campaignData as Campaign | null)

    const { data: recipientsData } = await supabase
      .from('campaign_recipients')
      .select(`
        id,
        campaign_id,
        contact_id,
        status,
        sent_at,
        delivered_at,
        read_at,
        error_message,
        contact:contacts!campaign_recipients_contact_id_fkey(
          first_name,
          last_name,
          phone,
          wa_id
        )
      `)
      .eq('campaign_id', campaignId)
      .order('sent_at', { ascending: false })

    const mapped: RecipientRow[] = (recipientsData ?? []).map(mapRecipient)
    setRecipients(mapped)
    setLoading(false)
  }

  useEffect(() => {
    loadCampaign()
  }, [supabase, campaignId])

  async function handleCompleteDraft() {
    if (!campaign || campaign.status !== 'draft') return
    setUpdating(true)

    try {
      const payload = {
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        template_name: campaign.template_name ?? '',
        template_language: campaign.template_language ?? '',
        template_body: campaign.template_body ?? '',
        template_variables_count: campaign.template_variables_count ?? 0,
        variable_mappings: (campaign.variable_mappings as string[] | null) ?? [],
        contacts: recipients.map(r => ({
          id: r.contact_id,
          wa_id: r.contact_wa_id,
          phone: r.contact_phone,
        })),
        total_contacts: recipients.length,
      }

      const res = await fetch('/api/webhooks/n8n/send-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        await supabase.from('campaigns').update({ status: 'sending' }).eq('id', campaignId)
        await loadCampaign()
      }
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-6 py-3.5 border-b border-border">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <p className="text-sm">Campaña no encontrada</p>
        <Link href="/campaigns">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Volver a campañas
          </Button>
        </Link>
      </div>
    )
  }

  const config = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.draft
  const StatusIcon = config.icon
  const total = campaign.target_count ?? 0
  const sent = campaign.sent_count ?? 0
  const delivered = campaign.delivered_count ?? 0
  const read = campaign.read_count ?? 0
  const failed = campaign.failed_count ?? 0

  const pendingCount = recipients.filter(r => r.status === 'pending').length
  const sentCount = recipients.filter(r => r.status === 'sent').length
  const deliveredCount = recipients.filter(r => r.status === 'delivered').length
  const readCount = recipients.filter(r => r.status === 'read').length
  const failedCount = recipients.filter(r => r.status === 'failed').length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3.5 border-b border-border bg-background/80 backdrop-blur-md shrink-0">
        <Link href="/campaigns">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-foreground truncate">{campaign.name}</h1>
            <span className={cn('shrink-0 flex items-center gap-1 text-xs rounded-full px-2 py-0.5 font-medium', config.class)}>
              <StatusIcon className="h-3 w-3" />
              {config.label}
            </span>
          </div>
          {campaign.template_name && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Plantilla: <span className="font-mono">{campaign.template_name}</span>
            </p>
          )}
        </div>
        {campaign.status === 'draft' && (
          <Button
            size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
            onClick={handleCompleteDraft}
            disabled={updating || pendingCount === 0}
          >
            {updating ? (
              <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
            ) : (
              <Play className="h-3.5 w-3.5 mr-1.5" />
            )}
            Enviar campaña
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="border border-border rounded-xl p-4 bg-card space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span className="text-[10px] uppercase tracking-wider font-semibold">Total</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{total}</p>
          </div>
          <div className="border border-border rounded-xl p-4 bg-card space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Send className="h-3.5 w-3.5" />
              <span className="text-[10px] uppercase tracking-wider font-semibold">Enviados</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">{sent}</p>
          </div>
          <div className="border border-border rounded-xl p-4 bg-card space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CheckCheck className="h-3.5 w-3.5" />
              <span className="text-[10px] uppercase tracking-wider font-semibold">Entregados</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">{delivered}</p>
          </div>
          <div className="border border-border rounded-xl p-4 bg-card space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />
              <span className="text-[10px] uppercase tracking-wider font-semibold">Leídos</span>
            </div>
            <p className="text-2xl font-bold text-primary">{read}</p>
          </div>
          <div className="border border-border rounded-xl p-4 bg-card space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="text-[10px] uppercase tracking-wider font-semibold">Fallidos</span>
            </div>
            <p className="text-2xl font-bold text-red-400">{failed}</p>
          </div>
        </div>

        {/* Campaign info */}
        <div className="border border-border rounded-xl p-4 bg-card space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Información</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {campaign.description && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5">Descripción</p>
                <p className="text-foreground">{campaign.description}</p>
              </div>
            )}
            {campaign.template_name && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5">Plantilla</p>
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono text-foreground">{campaign.template_name}</span>
                </div>
              </div>
            )}
            {campaign.template_language && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5">Idioma</p>
                <p className="text-foreground">{campaign.template_language}</p>
              </div>
            )}
            {campaign.created_at && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5">Creada</p>
                <p className="text-foreground">{formatDateTime(campaign.created_at)}</p>
              </div>
            )}
          </div>

          {(campaign.variable_mappings as string[] | null) && (campaign.variable_mappings as string[]).length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5">Mapeo de variables</p>
              <div className="flex flex-wrap gap-2">
                {(campaign.variable_mappings as string[]).map((v, i) => (
                  <span key={i} className="text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-1 font-mono">
                    Variable {i + 1} → {v}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recipients */}
        <div className="border border-border rounded-xl bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Destinatarios ({recipients.length})
            </h3>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              {pendingCount > 0 && <span>{pendingCount} pendientes</span>}
              {sentCount > 0 && <span className="text-blue-400">{sentCount} enviados</span>}
              {deliveredCount > 0 && <span className="text-emerald-400">{deliveredCount} entregados</span>}
              {readCount > 0 && <span className="text-primary">{readCount} leídos</span>}
              {failedCount > 0 && <span className="text-red-400">{failedCount} fallidos</span>}
            </div>
          </div>

          {recipients.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin destinatarios</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40 max-h-[400px] overflow-y-auto">
              {recipients.map(r => {
                const rc = RECIPIENT_STATUS_CONFIG[r.status] ?? RECIPIENT_STATUS_CONFIG.pending
                const name = r.contact_name
                return (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{name}</p>
                        {r.contact_wa_id && (
                          <span className="text-[10px] text-emerald-500 bg-emerald-500/10 rounded px-1.5 py-0.5 shrink-0">WA</span>
                        )}
                      </div>
                      {r.contact_phone && (
                        <p className="text-[11px] text-muted-foreground">{r.contact_phone}</p>
                      )}
                      {r.error_message && (
                        <p className="text-[10px] text-red-400 mt-0.5">{r.error_message}</p>
                      )}
                    </div>
                    <div className="shrink-0">
                      <span className={cn('text-[10px] rounded-full px-2 py-0.5 font-medium', rc.class)}>
                        {rc.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}