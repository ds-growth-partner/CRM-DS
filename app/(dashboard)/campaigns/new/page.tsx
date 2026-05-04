'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/providers/supabase-provider'
import { useAuth } from '@/providers/auth-provider'
import type { HSMTemplate, ContactWithDetails, Campaign } from '@/lib/types/database'
import type { FunnelStage } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  ArrowLeft, ArrowRight, Send, CheckCircle2, Search,
  CheckSquare, Square, Users, MessageSquare, ChevronDown, ChevronUp,
  Save, Loader2, Tag
} from 'lucide-react'
import Link from 'next/link'

// ─── Types ──────────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3

interface ContactFilters {
  search: string
  funnel_stage_id: string
  source: string
  lead_score_min: string
  lead_score_max: string
  tag_ids: string[]
}

// ─── Variable mapping ─────────────────────────────────────────────────────
const FIELD_OPTIONS = [
  { key: 'first_name', label: 'Nombre' },
  { key: 'last_name', label: 'Apellido' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'email', label: 'Email' },
  { key: 'company', label: 'Empresa' },
  { key: 'city', label: 'Ciudad' },
]

function scanTemplateVariables(body: string): { key: string; placeholder: string }[] {
  const matches = body.match(/\{\{(.+?)\}\}/g) ?? []
  const seen = new Set<string>()
  const result: { key: string; placeholder: string }[] = []
  for (const m of matches) {
    const key = m.replace(/\{\{|\}\}/g, '').trim()
    if (!seen.has(key)) {
      seen.add(key)
      result.push({ key, placeholder: m })
    }
  }

  // Si todas las keys son números, ordenamos numéricamente (formato estándar Meta)
  const allNumeric = result.every(v => /^\d+$/.test(v.key))
  if (allNumeric) {
    return result.sort((a, b) => parseInt(a.key) - parseInt(b.key))
  }

  return result
}

function VariableMapping({
  variables,
  mappings,
  onChange,
}: {
  variables: { key: string; placeholder: string }[]
  mappings: string[]
  onChange: (index: number, value: string) => void
}) {
  if (variables.length === 0) return null

  return (
    <div className="space-y-3 border border-border rounded-xl p-4 bg-muted/20">
      <div className="flex items-center gap-2 mb-1">
        <MessageSquare className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Mapeo de variables</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">
          Asigna cada variable a un campo del contacto
        </span>
      </div>

      {/* Variable previews from body */}
      <div className="bg-background/60 rounded-lg p-3 text-xs text-muted-foreground leading-relaxed border border-border">
        {variables.map((v) => (
          <span key={v.key} className="bg-primary/10 text-primary border border-primary/20 rounded px-1 mx-0.5 font-mono">
            {v.placeholder}
          </span>
        ))}
      </div>

      <div className="space-y-2">
        {variables.map((v, i) => (
          <div key={v.key} className="flex items-center gap-3">
            <div className="w-24 shrink-0">
              <span className="text-xs font-mono text-primary bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5">
                {v.placeholder}
              </span>
            </div>
            <div className="flex-1">
              <select
                value={mappings[i] ?? ''}
                onChange={e => onChange(i, e.target.value)}
                className="w-full h-8 text-xs rounded-md border border-border bg-background px-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">— seleccionar campo —</option>
                {FIELD_OPTIONS.map(f => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>
            </div>
            {mappings[i] && (
              <span className="text-[10px] text-muted-foreground shrink-0">
                {FIELD_OPTIONS.find(f => f.key === mappings[i])?.label ?? mappings[i]}
              </span>
            )}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground/70 italic">
        Los valores se reemplazan automáticamente al enviar la campaña a cada contacto.
      </p>
    </div>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  MARKETING: 'Marketing',
  UTILITY: 'Utilidad',
  AUTHENTICATION: 'Autenticación',
}

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  web: 'Web',
  csv: 'CSV',
  manual: 'Manual',
  referral: 'Referido',
  campaign: 'Campaña',
}

// ─── Step 1: Info + Template + Variables ──────────────────────────────────
function StepTemplate({
  name, setName,
  description, setDescription,
  templates, loading,
  selectedTemplate, setSelectedTemplate,
  variableMappings, setVariableMappings,
}: {
  name: string; setName: (v: string) => void
  description: string; setDescription: (v: string) => void
  templates: HSMTemplate[]; loading: boolean
  selectedTemplate: HSMTemplate | null; setSelectedTemplate: (t: HSMTemplate | null) => void
  variableMappings: string[]; setVariableMappings: (m: string[]) => void
}) {
  const approved = templates.filter(t => t.status === 'APPROVED')

  const templateVariables = selectedTemplate
    ? scanTemplateVariables(selectedTemplate.body_text)
    : []

  function handleVariableChange(index: number, value: string) {
    const next = [...variableMappings]
    next[index] = value
    setVariableMappings(next)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Información de la campaña</h2>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Nombre de la campaña *</label>
          <Input
            placeholder="Ej: Promo Declaración de Renta 2025"
            value={name}
            onChange={e => setName(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Descripción (opcional)</label>
          <Textarea
            placeholder="Describe el objetivo de esta campaña..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="text-sm resize-none"
            rows={2}
          />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Selecciona una plantilla HSM</h2>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : approved.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center border border-dashed border-border rounded-xl">
            <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No hay plantillas aprobadas</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Sincroniza tus plantillas desde Meta Business Manager</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {approved.map(template => {
              const selected = selectedTemplate?.id === template.id
              const vars = scanTemplateVariables(template.body_text)
              return (
                <button
                  key={template.id}
                  onClick={() => {
                    setSelectedTemplate(selected ? null : template)
                    if (!selected) setVariableMappings([])
                  }}
                  className={cn(
                    'w-full text-left border rounded-xl p-4 transition-all cursor-pointer',
                    selected
                      ? 'border-primary/60 bg-primary/5 shadow-sm'
                      : 'border-border hover:border-border/80 hover:bg-muted/30'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-foreground font-mono">{template.name}</p>
                        <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                          {CATEGORY_LABELS[template.category]}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{template.language}</span>
                      </div>
                      {template.header_text && (
                        <p className="text-xs font-medium text-foreground mb-1">{template.header_text}</p>
                      )}
                      <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{template.body_text}</p>
                      {vars.length > 0 && (
                        <p className="text-[10px] text-primary mt-1.5">
                          {vars.length} variable{vars.length !== 1 ? 's' : ''}{' '}
                          {vars.map(v => v.placeholder).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className={cn(
                      'shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center mt-0.5 transition-colors',
                      selected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                    )}>
                      {selected && <div className="h-2 w-2 rounded-full bg-white" />}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selectedTemplate && templateVariables.length > 0 && (
        <VariableMapping
          variables={templateVariables}
          mappings={variableMappings}
          onChange={handleVariableChange}
        />
      )}

      {selectedTemplate && templateVariables.length === 0 && (
        <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            Esta plantilla no tiene variables. Puedes continuar.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Step 2: Select contacts ───────────────────────────────────────────────
function StepContacts({
  contacts, loading,
  selected, onToggle, onSelectAll, onClearAll,
  stages,
  filters, setFilters,
  tags,
}: {
  contacts: ContactWithDetails[]; loading: boolean
  selected: Set<string>; onToggle: (id: string) => void
  onSelectAll: () => void; onClearAll: () => void
  stages: FunnelStage[]
  filters: ContactFilters; setFilters: (f: ContactFilters) => void
  tags: { id: string; name: string; color: string }[]
}) {
  const [showFilters, setShowFilters] = useState(false)

  function toggleTag(tagId: string) {
    const current = filters.tag_ids
    setFilters({
      ...filters,
      tag_ids: current.includes(tagId)
        ? current.filter((id: string) => id !== tagId)
        : [...current, tagId],
    })
  }

  const filtered = contacts.filter(c => {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      const name = `${c.first_name} ${c.last_name ?? ''}`.toLowerCase()
      if (!name.includes(q) && !(c.phone ?? '').includes(q) && !(c.email ?? '').toLowerCase().includes(q)) return false
    }
    if (filters.funnel_stage_id && c.funnel_stage_id !== filters.funnel_stage_id) return false
    if (filters.source && c.source !== filters.source) return false
    if (filters.lead_score_min && c.lead_score < parseInt(filters.lead_score_min)) return false
    if (filters.lead_score_max && c.lead_score > parseInt(filters.lead_score_max)) return false
    if (filters.tag_ids.length > 0) {
      const contactTagIds = (c.tags ?? []).map((t: { id: string }) => t.id)
      if (!filters.tag_ids.every(id => contactTagIds.includes(id))) return false
    }
    return true
  })

  const allVisibleSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id))

  function handleToggleAll() {
    if (allVisibleSelected) {
      filtered.forEach(c => { if (selected.has(c.id)) onToggle(c.id) })
    } else {
      filtered.forEach(c => { if (!selected.has(c.id)) onToggle(c.id) })
    }
  }

  return (
    <div className="space-y-4">
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors"
        >
          <span>Filtros de contactos</span>
          {showFilters ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {showFilters && (
          <div className="border-t border-border p-4 grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1.5 block">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Nombre, teléfono, email..."
                  className="pl-9 h-8 text-xs"
                  value={filters.search}
                  onChange={e => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Fase del embudo</label>
              <select
                className="w-full h-8 text-xs rounded-md border border-input bg-background px-2"
                value={filters.funnel_stage_id}
                onChange={e => setFilters({ ...filters, funnel_stage_id: e.target.value })}
              >
                <option value="">Todas las fases</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Fuente</label>
              <select
                className="w-full h-8 text-xs rounded-md border border-input bg-background px-2"
                value={filters.source}
                onChange={e => setFilters({ ...filters, source: e.target.value })}
              >
                <option value="">Todas las fuentes</option>
                {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Lead score mín.</label>
              <Input
                type="number" min="0" max="100" placeholder="0"
                className="h-8 text-xs"
                value={filters.lead_score_min}
                onChange={e => setFilters({ ...filters, lead_score_min: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Lead score máx.</label>
              <Input
                type="number" min="0" max="100" placeholder="100"
                className="h-8 text-xs"
                value={filters.lead_score_max}
                onChange={e => setFilters({ ...filters, lead_score_max: e.target.value })}
              />
            </div>

            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
                <Tag className="h-3 w-3" />
                Etiquetas
              </label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => {
                  const isActive = filters.tag_ids.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={cn(
                        'flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-medium border transition-colors cursor-pointer',
                        isActive
                          ? 'text-white'
                          : 'text-muted-foreground border-border hover:border-primary/40'
                      )}
                      style={isActive ? { backgroundColor: tag.color, borderColor: tag.color } : {}}
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.5)' : tag.color }}
                      />
                      {tag.name}
                    </button>
                  )
                })}
                {tags.length === 0 && (
                  <span className="text-[10px] text-muted-foreground/50 italic">Sin etiquetas disponibles</span>
                )}
              </div>
              {filters.tag_ids.length > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {filters.tag_ids.length} etiqueta{filters.tag_ids.length !== 1 ? 's' : ''} seleccionada{filters.tag_ids.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? 'Cargando...' : `${filtered.length} contactos · ${selected.size} seleccionados`}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleToggleAll}>
            {allVisibleSelected ? 'Deseleccionar visibles' : 'Seleccionar visibles'}
          </Button>
          {selected.size > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={onClearAll}>
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Sin contactos con esos filtros</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
          {filtered.map(contact => {
            const isSelected = selected.has(contact.id)
            const name = `${contact.first_name} ${contact.last_name ?? ''}`.trim()
            return (
              <button
                key={contact.id}
                onClick={() => onToggle(contact.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer',
                  isSelected
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border hover:bg-muted/30'
                )}
              >
                <div className={cn('shrink-0 text-primary', !isSelected && 'text-muted-foreground/40')}>
                  {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {contact.phone ?? contact.email ?? 'Sin contacto'}
                    {contact.company ? ` · ${contact.company}` : ''}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {contact.wa_id && (
                    <span className="text-[10px] text-emerald-500 bg-emerald-500/10 rounded px-1.5 py-0.5">WA</span>
                  )}
                  <span className="text-[10px] text-muted-foreground tabular-nums">{contact.lead_score}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Step 3: Confirm ─────────────────────────────────────────────────────────
function StepConfirm({
  name, description, selectedTemplate, selectedContacts, variableMappings,
  sending, saving,
}: {
  name: string; description: string
  selectedTemplate: HSMTemplate | null
  selectedContacts: ContactWithDetails[]
  variableMappings: string[]
  sending: boolean
  saving: boolean
}) {
  const templateVars = selectedTemplate ? scanTemplateVariables(selectedTemplate.body_text) : []

  return (
    <div className="space-y-6">
      <div className="border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resumen de campaña</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nombre</span>
            <span className="font-medium text-foreground">{name}</span>
          </div>
          {description && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Descripción</span>
              <span className="text-foreground text-right max-w-[240px] truncate">{description}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plantilla</span>
            <span className="font-mono text-foreground">{selectedTemplate?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Contactos seleccionados</span>
            <span className="font-semibold text-foreground">{selectedContacts.length}</span>
          </div>
        </div>
      </div>

      {selectedTemplate && (
        <div className="border border-border rounded-xl p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Vista previa de la plantilla</h3>
          <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
            {selectedTemplate.header_text && (
              <p className="text-sm font-semibold text-foreground">{selectedTemplate.header_text}</p>
            )}
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{selectedTemplate.body_text}</p>
            {selectedTemplate.footer_text && (
              <p className="text-xs text-muted-foreground italic">{selectedTemplate.footer_text}</p>
            )}
          </div>
        </div>
      )}

      {templateVars.length > 0 && variableMappings.length > 0 && (
        <div className="border border-border rounded-xl p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Mapeo de variables</h3>
          <div className="flex flex-wrap gap-2">
            {templateVars.map((v, i) => (
              <span key={v.key} className="text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-1 font-mono">
                {v.placeholder} → {variableMappings[i] ? FIELD_OPTIONS.find(f => f.key === variableMappings[i])?.label ?? variableMappings[i] : '—'}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="border border-border rounded-xl p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Contactos ({selectedContacts.length})
        </h3>
        <div className="space-y-1 max-h-[240px] overflow-y-auto">
          {selectedContacts.map(c => (
            <div key={c.id} className="flex items-center gap-2 py-1.5 border-b border-border/40 last:border-0">
              <div className="flex-1 min-w-0">
                <span className="text-sm text-foreground">
                  {`${c.first_name} ${c.last_name ?? ''}`.trim()}
                </span>
                {c.phone && <span className="text-xs text-muted-foreground ml-2">{c.phone}</span>}
              </div>
              {c.wa_id && <span className="text-[10px] text-emerald-500 bg-emerald-500/10 rounded px-1.5 py-0.5 shrink-0">WA</span>}
            </div>
          ))}
        </div>
      </div>

      {(sending || saving) && (
        <div className="flex items-center justify-center gap-2 py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {saving ? 'Guardando campaña...' : 'Enviando campaña a n8n...'}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────
export default function NewCampaignPage() {
  const router = useRouter()
  const { supabase } = useSupabase()
  const { tenant } = useAuth()

  const [step, setStep] = useState<Step>(1)
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [templates, setTemplates] = useState<HSMTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<HSMTemplate | null>(null)
  const [variableMappings, setVariableMappings] = useState<string[]>([])

  const [contacts, setContacts] = useState<ContactWithDetails[]>([])
  const [contactsLoading, setContactsLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [stages, setStages] = useState<FunnelStage[]>([])
  const [filters, setFilters] = useState<ContactFilters>({
    search: '', funnel_stage_id: '', source: '', lead_score_min: '', lead_score_max: '',
    tag_ids: [],
  })

  useEffect(() => {
    supabase.from('hsm_templates').select('*').order('name').then(({ data }) => {
      setTemplates(data ?? [])
      setTemplatesLoading(false)
    })
  }, [supabase])

  useEffect(() => {
    supabase
      .from('contacts')
      .select(`*, funnel_stage:funnel_stages(*), assigned_user:users!contacts_assigned_to_fkey(id, full_name, avatar_url), contact_tags(tag:tags(*))`)
      .order('updated_at', { ascending: false })
      .limit(1000)
      .then(({ data }) => {
        const mapped = (data ?? []).map(c => ({
          ...c,
          tags: (c.contact_tags as unknown as { tag: unknown }[])?.map(ct => ct.tag) ?? [],
        }))
        setContacts(mapped as unknown as ContactWithDetails[])
        setContactsLoading(false)
      })

    supabase.from('funnel_stages').select('*').order('position').then(({ data }) => {
      setStages(data ?? [])
    })

    supabase.from('tags').select('*').order('name').then(({ data }) => {
      setAllTags(data ?? [])
    })
  }, [supabase])

  const [allTags, setAllTags] = useState<{ id: string; name: string; color: string }[]>([])

  const toggleContact = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearAll = useCallback(() => setSelectedIds(new Set()), [])
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(contacts.map(c => c.id)))
  }, [contacts])

  const selectedContacts = contacts.filter(c => selectedIds.has(c.id))

  const templateVars = selectedTemplate
    ? scanTemplateVariables(selectedTemplate.body_text)
    : []

  const canAdvance =
    step === 1
      ? name.trim().length > 0 && selectedTemplate !== null
        && (templateVars.length === 0 || variableMappings.every(Boolean))
      : step === 2
      ? selectedIds.size > 0
      : true

  async function handleSaveDraft() {
    if (!tenant || !selectedTemplate) return
    setSaving(true)

    try {
      const selectedContactsList = contacts.filter(c => selectedIds.has(c.id))

      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          tenant_id: tenant.id,
          name: name.trim(),
          description: description.trim() || null,
          template_id: selectedTemplate.id,
          template_name: selectedTemplate.name,
          template_variables: variableMappings.filter(Boolean).length > 0
            ? variableMappings.filter(Boolean)
            : null,
          target_count: selectedContactsList.length,
          sent_count: 0,
          delivered_count: 0,
          read_count: 0,
          failed_count: 0,
          status: 'draft',
        })
        .select()
        .single()

      if (campaignError) throw campaignError

      const recipientsToInsert = selectedContactsList.map(c => ({
        campaign_id: campaignData.id,
        contact_id: c.id,
        tenant_id: tenant.id,
        status: 'pending',
      }))

      const { error: recipientsError } = await supabase
        .from('campaign_messages')
        .insert(recipientsToInsert)

      if (recipientsError) throw recipientsError

      toast.success('Campaña guardada como borrador')
      router.push('/campaigns')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error(`Error: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleSend() {
    if (!tenant || !selectedTemplate || selectedIds.size === 0) return
    setSending(true)

    try {
      const selectedContactsList = contacts.filter(c => selectedIds.has(c.id))

      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          tenant_id: tenant.id,
          name: name.trim(),
          description: description.trim() || null,
          template_id: selectedTemplate.id,
          template_name: selectedTemplate.name,
          template_variables: variableMappings.filter(Boolean).length > 0
            ? variableMappings.filter(Boolean)
            : null,
          target_count: selectedContactsList.length,
          sent_count: 0,
          delivered_count: 0,
          read_count: 0,
          failed_count: 0,
          status: 'sending',
          started_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (campaignError) throw campaignError

      const recipientsToInsert = selectedContactsList.map(c => ({
        campaign_id: campaignData.id,
        contact_id: c.id,
        tenant_id: tenant.id,
        status: 'pending',
      }))

      const { error: recipientsError } = await supabase
        .from('campaign_messages')
        .insert(recipientsToInsert)

      if (recipientsError) throw recipientsError

      const payload = {
        campaign_id: campaignData.id,
        campaign_name: name.trim(),
        template_name: selectedTemplate.name,
        template_language: selectedTemplate.language,
        template_body: selectedTemplate.body_text,
        template_variables_count: selectedTemplate.variables_count,
        variable_mappings: variableMappings.filter(Boolean),
        contacts: selectedContactsList.map(c => ({
          id: c.id,
          wa_id: c.wa_id,
          phone: c.phone,
          first_name: c.first_name,
          last_name: c.last_name,
          email: c.email,
          company: c.company,
          city: c.city,
          lead_score: c.lead_score,
          funnel_stage: (c.funnel_stage as { name?: string } | null)?.name ?? null,
        })),
        total_contacts: selectedContactsList.length,
      }

      const res = await fetch('/api/webhooks/n8n/send-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const resData = await res.json().catch(() => ({}))

      if (resData.ok === false) {
        // Campaign saved but n8n had issues — warn and still redirect
        toast.warning(`Campaña creada pero n8n reportó un error (status ${resData.n8n_status ?? '?'}). Verifica que el workflow esté activo.`)
      } else {
        toast.success(`Campaña enviada a ${selectedContactsList.length} contactos`)
      }
      router.push('/campaigns')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error(`Error: ${msg}`)
    } finally {
      setSending(false)
    }
  }

  const STEPS = [
    { num: 1, label: 'Plantilla' },
    { num: 2, label: 'Contactos' },
    { num: 3, label: 'Confirmar' },
  ]

  const templateHasVars = templateVars.length > 0

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-3.5 border-b border-border bg-background/80 backdrop-blur-md">
        <Link href="/campaigns">
          <Button variant="ghost" size="sm" className="h-8 px-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-base font-semibold text-foreground leading-tight">Nueva campaña</h1>
        </div>

        <div className="ml-auto flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex items-center gap-1">
              <div className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors',
                step === s.num ? 'bg-primary text-primary-foreground' :
                step > s.num ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'
              )}>
                {step > s.num ? <CheckCircle2 className="h-3 w-3" /> : <span>{s.num}</span>}
                {s.label}
              </div>
              {i < STEPS.length - 1 && <div className="w-4 h-px bg-border" />}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          {step === 1 && (
            <StepTemplate
              name={name} setName={setName}
              description={description} setDescription={setDescription}
              templates={templates} loading={templatesLoading}
              selectedTemplate={selectedTemplate} setSelectedTemplate={setSelectedTemplate}
              variableMappings={variableMappings} setVariableMappings={setVariableMappings}
            />
          )}
          {step === 2 && (
            <StepContacts
              contacts={contacts} loading={contactsLoading}
              selected={selectedIds} onToggle={toggleContact}
              onSelectAll={selectAll} onClearAll={clearAll}
              stages={stages} filters={filters} setFilters={setFilters}
              tags={allTags}
            />
          )}
          {step === 3 && (
            <StepConfirm
              name={name} description={description}
              selectedTemplate={selectedTemplate}
              selectedContacts={selectedContacts}
              variableMappings={variableMappings}
              sending={sending} saving={saving}
            />
          )}
        </div>
      </div>

      <div className="px-6 py-4 border-t border-border bg-background/80 backdrop-blur-md flex items-center justify-between">
        <Button
          variant="outline" size="sm" className="h-8 text-xs"
          onClick={() => setStep(s => Math.max(1, s - 1) as Step)}
          disabled={step === 1 || sending || saving}
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          Atrás
        </Button>

        <div className="flex items-center gap-2">
          {step === 1 && selectedTemplate && (
            <Button
              variant="outline" size="sm" className="h-8 text-xs"
              onClick={handleSaveDraft}
              disabled={!name.trim() || saving || sending}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Guardar borrador
            </Button>
          )}

          {step < 3 ? (
            <Button
              size="sm" className="h-8 text-xs"
              onClick={() => setStep(s => Math.min(3, s + 1) as Step)}
              disabled={!canAdvance}
            >
              Continuar
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          ) : (
            <Button
              size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSend}
              disabled={sending || saving || selectedIds.size === 0}
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Enviar campaña ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}