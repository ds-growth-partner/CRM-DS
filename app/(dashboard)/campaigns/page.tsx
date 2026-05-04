'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import type { Campaign } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Plus, Send, BarChart3, Users, CheckCheck, Eye } from 'lucide-react'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils/date'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  draft: { label: 'Borrador', class: 'bg-muted text-muted-foreground' },
  scheduled: { label: 'Programada', class: 'bg-blue-500/10 text-blue-400' },
  sending: { label: 'Enviando...', class: 'bg-amber-500/10 text-amber-400' },
  completed: { label: 'Completada', class: 'bg-emerald-500/10 text-emerald-400' },
  failed: { label: 'Fallida', class: 'bg-red-500/10 text-red-400' },
  cancelled: { label: 'Cancelada', class: 'bg-muted text-muted-foreground' },
}

export default function CampaignsPage() {
  const { supabase } = useSupabase()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setCampaigns(data ?? [])
        setLoading(false)
      })
  }, [supabase])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-3.5 border-b border-border bg-background/80 backdrop-blur-md">
        <div>
          <h1 className="text-base font-semibold text-foreground leading-tight">Campañas</h1>
          <p className="text-[11px] text-muted-foreground">{campaigns.length} campaña{campaigns.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="ml-auto">
          <Link href="/campaigns/new">
            <Button size="sm" className="h-8 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Nueva campaña
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Send className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-base font-medium mb-1">Sin campañas</h3>
            <p className="text-sm text-muted-foreground mb-4">Crea tu primera campaña masiva de WhatsApp</p>
            <Link href="/campaigns/new">
              <Button size="sm">Crear campaña</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3 max-w-4xl">
            {campaigns.map(campaign => {
              const config = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.draft
              const total = campaign.target_count ?? 0
              const sent = campaign.sent_count ?? 0
              const delivered = campaign.delivered_count ?? 0
              const read = campaign.read_count ?? 0
              const failed = campaign.failed_count ?? 0
              const progress = total > 0 ? Math.round((sent / total) * 100) : 0

              return (
                <div key={campaign.id} className="border border-border rounded-xl p-4 bg-card hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-foreground truncate">{campaign.name}</p>
                        <span className={cn('shrink-0 text-xs rounded-full px-2 py-0.5 font-medium', config.class)}>
                          {config.label}
                        </span>
                      </div>
                      {campaign.template_name && (
                        <p className="text-xs text-muted-foreground">
                          Plantilla: <span className="font-mono">{campaign.template_name}</span>
                        </p>
                      )}
                      {campaign.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{campaign.description}</p>
                      )}
                      {campaign.created_at && (
                        <p className="text-xs text-muted-foreground/60 mt-0.5">{formatDateTime(campaign.created_at)}</p>
                      )}
                    </div>

                    <Link href={`/campaigns/${campaign.id}`}>
                      <Button variant="outline" size="sm" className="h-8 text-xs shrink-0">
                        <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                        Ver detalle
                      </Button>
                    </Link>
                  </div>

                  {total > 0 && (
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {total} contactos
                      </span>
                      <span className="flex items-center gap-1">
                        <Send className="h-3 w-3" />
                        {sent} enviados
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCheck className="h-3 w-3" />
                        {delivered} entregados
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {read} leídos
                      </span>
                      {failed > 0 && (
                        <span className="flex items-center gap-1 text-red-400">
                          {failed} fallidos
                        </span>
                      )}
                    </div>
                  )}

                  {(campaign.status === 'sending' || campaign.status === 'completed') && total > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>{progress}% enviado</span>
                        <span>{sent}/{total}</span>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}