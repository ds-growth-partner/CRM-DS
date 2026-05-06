'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  X, SlidersHorizontal, ChevronDown, ChevronUp, RotateCcw,
  Bot, User, Tag, TrendingUp
} from 'lucide-react'
import type { FunnelStage, Tag as TagType } from '@/lib/types/database'
import type { ContactFilters } from '@/lib/types/shared'

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  web: 'Web',
  csv: 'CSV',
  manual: 'Manual',
  referral: 'Referido',
  campaign: 'Campaña',
}

interface ContactsFilterPanelProps {
  filters: ContactFilters
  onChange: (f: ContactFilters) => void
  stages: FunnelStage[]
  tags: TagType[]
  totalActive: number
}

export function ContactsFilterPanel({ filters, onChange, stages, tags, totalActive }: ContactsFilterPanelProps) {
  const [open, setOpen] = useState(false)

  function clear() {
    onChange({})
  }

  function toggleTag(tagId: string) {
    const current = (filters as { tag_ids?: string[] }).tag_ids ?? []
    const next = current.includes(tagId)
      ? current.filter(id => id !== tagId)
      : [...current, tagId]
    onChange({ ...filters, tag_ids: next } as ContactFilters & { tag_ids: string[] })
  }

  const activeTagIds: string[] = (filters as { tag_ids?: string[] }).tag_ids ?? []

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className={cn(
          'h-8 text-xs gap-1.5 cursor-pointer relative',
          totalActive > 0 && 'border-primary/60 text-primary bg-primary/5'
        )}
        onClick={() => setOpen(v => !v)}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filtros
        {totalActive > 0 && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {totalActive}
          </span>
        )}
        {open ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
      </Button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div className="absolute right-0 top-10 z-50 w-[520px] bg-popover border border-border rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Filtros avanzados</span>
                {totalActive > 0 && (
                  <span className="text-[10px] font-medium text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
                    {totalActive} activo{totalActive !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {totalActive > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={clear}>
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Limpiar
                  </Button>
                )}
                <button onClick={() => setOpen(false)} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Búsqueda */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Búsqueda general</label>
                <Input
                  placeholder="Nombre, teléfono, email, empresa..."
                  value={filters.search ?? ''}
                  onChange={e => onChange({ ...filters, search: e.target.value || undefined })}
                  className="h-8 text-xs"
                />
              </div>

              {/* Teléfono */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Teléfono</label>
                  <Input
                    placeholder="Filtrar por número..."
                    value={(filters as { phone?: string }).phone ?? ''}
                    onChange={e => onChange({ ...filters, phone: e.target.value || undefined } as ContactFilters)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Email</label>
                  <Input
                    placeholder="Filtrar por correo..."
                    value={(filters as { email?: string }).email ?? ''}
                    onChange={e => onChange({ ...filters, email: e.target.value || undefined } as ContactFilters)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Fase del embudo */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Fase del embudo
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => onChange({ ...filters, funnel_stage_id: undefined })}
                    className={cn(
                      'text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors cursor-pointer',
                      !filters.funnel_stage_id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:border-primary/40'
                    )}
                  >
                    Todas
                  </button>
                  {stages.map(stage => (
                    <button
                      key={stage.id}
                      onClick={() => onChange({ ...filters, funnel_stage_id: filters.funnel_stage_id === stage.id ? undefined : stage.id })}
                      className={cn(
                        'text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors cursor-pointer',
                        filters.funnel_stage_id === stage.id
                          ? 'text-white border-transparent'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      )}
                      style={filters.funnel_stage_id === stage.id ? { backgroundColor: stage.color, borderColor: stage.color } : {}}
                    >
                      {stage.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lead Score */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Lead Score</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Mín (0)"
                    value={filters.lead_score_min ?? ''}
                    onChange={e => onChange({ ...filters, lead_score_min: e.target.value ? Number(e.target.value) : undefined })}
                    className="h-8 text-xs"
                  />
                  <span className="text-muted-foreground text-xs shrink-0">—</span>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Máx (100)"
                    value={filters.lead_score_max ?? ''}
                    onChange={e => onChange({ ...filters, lead_score_max: e.target.value ? Number(e.target.value) : undefined })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Etiquetas */}
              {tags.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Etiquetas
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map(tag => {
                      const isActive = activeTagIds.includes(tag.id)
                      return (
                        <button
                          key={tag.id}
                          onClick={() => toggleTag(tag.id)}
                          className={cn(
                            'flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors cursor-pointer',
                            isActive ? 'text-white' : 'border-border text-muted-foreground hover:border-primary/40'
                          )}
                          style={isActive ? { backgroundColor: tag.color, borderColor: tag.color } : {}}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.7)' : tag.color }}
                          />
                          {tag.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Estado IA */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Bot className="h-3 w-3" /> Estado IA
                </label>
                <div className="flex gap-2">
                  {[
                    { value: undefined, label: 'Todos' },
                    { value: true, label: 'IA activa', icon: Bot },
                    { value: false, label: 'Humano', icon: User },
                  ].map(opt => (
                    <button
                      key={String(opt.value)}
                      onClick={() => onChange({ ...filters, ai_active: opt.value })}
                      className={cn(
                        'flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg border transition-colors cursor-pointer',
                        filters.ai_active === opt.value
                          ? opt.value === true
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-400/40'
                            : opt.value === false
                              ? 'bg-blue-500/10 text-blue-600 border-blue-400/40'
                              : 'bg-primary/10 text-primary border-primary/40'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      )}
                    >
                      {opt.icon && <opt.icon className="h-3 w-3" />}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fuente */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Fuente</label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => onChange({ ...filters, source: undefined })}
                    className={cn(
                      'text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors cursor-pointer',
                      !filters.source
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:border-primary/40'
                    )}
                  >
                    Todas
                  </button>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => onChange({ ...filters, source: filters.source === k ? undefined : k })}
                      className={cn(
                        'text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors cursor-pointer',
                        filters.source === k
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fecha de creación */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Creado desde</label>
                  <Input
                    type="date"
                    value={filters.created_from ?? ''}
                    onChange={e => onChange({ ...filters, created_from: e.target.value || undefined })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Creado hasta</label>
                  <Input
                    type="date"
                    value={filters.created_to ?? ''}
                    onChange={e => onChange({ ...filters, created_to: e.target.value || undefined })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {totalActive > 0 ? `${totalActive} filtro${totalActive !== 1 ? 's' : ''} aplicado${totalActive !== 1 ? 's' : ''}` : 'Sin filtros activos'}
              </span>
              <Button size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
                Aplicar
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
