'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import type { Campaign } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Plus, Send, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils/date'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

const STATUS_CONFIG = {
  draft: { label: 'Borrador', class: 'bg-muted text-muted-foreground' },
  scheduled: { label: 'Programada', class: 'bg-blue-500/10 text-blue-600' },
  sending: { label: 'Enviando...', class: 'bg-amber-500/10 text-amber-600' },
  completed: { label: 'Completada', class: 'bg-emerald-500/10 text-emerald-600' },
  failed: { label: 'Fallida', class: 'bg-red-500/10 text-red-600' },
  cancelled: { label: 'Cancelada', class: 'bg-muted text-muted-foreground' },
}

export default function CampaignsPage() {
  const { supabase } = useSupabase()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('campaigns').select('*').order('created_at', { ascending: false })
      .then(({ data }) => {
        setCampaigns(data ?? [])
        setLoading(false)
      })
  }, [supabase])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <h1 className="text-lg font-semibold">Campañas de WhatsApp</h1>
        <div className="ml-auto">
          <Link href="/templates/campaigns/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Nueva campaña
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Send className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-base font-medium mb-1">Sin campañas</h3>
            <p className="text-sm text-muted-foreground mb-4">Crea tu primera campaña masiva de WhatsApp</p>
            <Link href="/templates/campaigns/new">
              <Button>Crear campaña</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map(campaign => {
              const config = STATUS_CONFIG[campaign.status]
              const total = campaign.total_contacts
              const sent = campaign.sent_count
              const read = campaign.read_count
              const progress = total > 0 ? Math.round((sent / total) * 100) : 0

              return (
                <div key={campaign.id} className="border border-border rounded-xl p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-foreground">{campaign.name}</p>
                        <span className={cn('text-xs rounded-full px-2 py-0.5 font-medium', config.class)}>
                          {config.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Plantilla: {campaign.template_name} · {total} contactos
                      </p>
                      {campaign.created_at && (
                        <p className="text-xs text-muted-foreground">{formatDateTime(campaign.created_at)}</p>
                      )}
                    </div>

                    <Link href={`/templates/campaigns/${campaign.id}`}>
                      <Button variant="outline" size="sm">
                        <BarChart3 className="h-4 w-4 mr-1.5" />
                        Ver métricas
                      </Button>
                    </Link>
                  </div>

                  {/* Progress bar */}
                  {(campaign.status === 'sending' || campaign.status === 'completed') && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Enviados: {sent}/{total}</span>
                        <span>Leídos: {read}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
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
