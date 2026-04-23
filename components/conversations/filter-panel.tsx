'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import { useAuth } from '@/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import type { ConversationFilters } from '@/lib/types/shared'
import type { FunnelStage, Tag, User } from '@/lib/types/database'

interface FilterPanelProps {
  filters: ConversationFilters
  onChange: (f: ConversationFilters) => void
  onClose: () => void
}

export function FilterPanel({ filters, onChange, onClose }: FilterPanelProps) {
  const { supabase } = useSupabase()
  const { tenant } = useAuth()
  const [stages, setStages] = useState<FunnelStage[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [agents, setAgents] = useState<User[]>([])

  useEffect(() => {
    if (!tenant) return
    Promise.all([
      supabase.from('funnel_stages').select('*').eq('tenant_id', tenant.id).order('position'),
      supabase.from('tags').select('*').eq('tenant_id', tenant.id).order('name'),
      supabase.from('users').select('*').eq('tenant_id', tenant.id).eq('is_active', true).order('full_name'),
    ]).then(([s, t, a]) => {
      setStages(s.data ?? [])
      setTags(t.data ?? [])
      setAgents(a.data ?? [])
    })
  }, [supabase, tenant])

  function set(key: keyof ConversationFilters, value: unknown) {
    onChange({ ...filters, [key]: value || undefined })
  }

  function clear() {
    onChange({})
  }

  const activeCount = Object.values(filters).filter(Boolean).length

  return (
    <div className="border-b border-border bg-muted/20 px-3 py-3 space-y-2.5 animate-slide-up">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Filtros
          {activeCount > 0 && (
            <span className="ml-1.5 text-primary font-bold">{activeCount}</span>
          )}
        </span>
        <div className="flex gap-1">
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2 text-muted-foreground hover:text-destructive" onClick={clear}>
              Limpiar
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground" onClick={onClose}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        <FilterSelect
          label="Estado"
          value={filters.status ?? ''}
          onChange={v => set('status', v)}
          options={[
            { value: 'open', label: 'Abierta' },
            { value: 'resolved', label: 'Resuelta' },
            { value: 'pending', label: 'Pendiente' },
            { value: 'snoozed', label: 'Pospuesta' },
          ]}
        />

        <FilterSelect
          label="Embudo"
          value={filters.funnel_stage_id ?? ''}
          onChange={v => set('funnel_stage_id', v)}
          options={stages.map(s => ({ value: s.id, label: s.name }))}
        />

        <FilterSelect
          label="Etiqueta"
          value={filters.tag_id ?? ''}
          onChange={v => set('tag_id', v)}
          options={tags.map(t => ({ value: t.id, label: t.name }))}
        />

        <FilterSelect
          label="Asesor"
          value={filters.assigned_to ?? ''}
          onChange={v => set('assigned_to', v)}
          options={agents.map(a => ({ value: a.id, label: a.full_name }))}
        />

        <FilterSelect
          label="Control"
          value={filters.ai_active === true ? 'true' : filters.ai_active === false ? 'false' : ''}
          onChange={v => set('ai_active', v === 'true' ? true : v === 'false' ? false : undefined)}
          options={[
            { value: 'true', label: 'IA activa' },
            { value: 'false', label: 'Agente humano' },
          ]}
        />
      </div>
    </div>
  )
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-16 shrink-0 font-medium">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex-1 h-7 rounded-lg border border-border bg-muted/30 text-xs px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
      >
        <option value="">Todos</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}
