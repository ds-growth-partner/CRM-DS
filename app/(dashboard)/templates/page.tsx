'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import type { HSMTemplate } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Plus, RefreshCw, MessageSquare, CheckCircle2, Clock, XCircle, PauseCircle } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const STATUS_CONFIG = {
  APPROVED: { label: 'Aprobada', icon: CheckCircle2, class: 'bg-emerald-500/10 text-emerald-600 border-emerald-300/30' },
  PENDING: { label: 'Pendiente', icon: Clock, class: 'bg-amber-500/10 text-amber-600 border-amber-300/30' },
  REJECTED: { label: 'Rechazada', icon: XCircle, class: 'bg-red-500/10 text-red-600 border-red-300/30' },
  PAUSED: { label: 'Pausada', icon: PauseCircle, class: 'bg-muted text-muted-foreground border-border' },
  DISABLED: { label: 'Deshabilitada', icon: XCircle, class: 'bg-muted text-muted-foreground border-border' },
}

const CATEGORY_LABELS = {
  MARKETING: 'Marketing',
  UTILITY: 'Utilidad',
  AUTHENTICATION: 'Autenticación',
}

export default function TemplatesPage() {
  const { supabase } = useSupabase()
  const [templates, setTemplates] = useState<HSMTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  async function loadTemplates() {
    const { data } = await supabase
      .from('hsm_templates')
      .select('*')
      .order('created_at', { ascending: false })
    setTemplates(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadTemplates() }, [])

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch('/api/meta/templates')
      if (res.ok) {
        await loadTemplates()
        toast.success('Plantillas sincronizadas con Meta')
      }
    } catch {
      toast.error('Error al sincronizar plantillas')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <h1 className="text-lg font-semibold">Plantillas HSM</h1>
        <span className="text-sm text-muted-foreground">({templates.length})</span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={cn('h-4 w-4 mr-1.5', syncing && 'animate-spin')} />
            Sincronizar Meta
          </Button>
          <Button size="sm" disabled title="Las plantillas se crean en Meta Business Manager">
            <Plus className="h-4 w-4 mr-1.5" />
            Nueva plantilla
          </Button>
          <Link href="/templates/campaigns">
            <Button variant="outline" size="sm">
              <MessageSquare className="h-4 w-4 mr-1.5" />
              Campañas
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-base font-medium mb-1">Sin plantillas</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crea plantillas HSM en Meta Business Manager y sincronízalas aquí
            </p>
            <Button onClick={handleSync}>Sincronizar desde Meta</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(template => {
              const statusConfig = STATUS_CONFIG[template.status]
              const StatusIcon = statusConfig.icon
              return (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{template.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{CATEGORY_LABELS[template.category]} · {template.language}</p>
                      </div>
                      <span className={cn('flex items-center gap-1 text-xs rounded-full px-2 py-0.5 border font-medium', statusConfig.class)}>
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {template.header_text && (
                      <p className="text-xs font-medium text-foreground mb-1">{template.header_text}</p>
                    )}
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{template.body_text}</p>
                    {template.footer_text && (
                      <p className="text-[10px] text-muted-foreground/70 mt-2 italic">{template.footer_text}</p>
                    )}
                    {template.variables_count > 0 && (
                      <p className="text-[10px] text-primary mt-2">{template.variables_count} variable{template.variables_count !== 1 ? 's' : ''}</p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
