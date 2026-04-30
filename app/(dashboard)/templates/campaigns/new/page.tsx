'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/providers/supabase-provider'
import type { HSMTemplate, ContactWithDetails } from '@/lib/types/database'
import type { FunnelStage } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  ArrowLeft, ArrowRight, Send, CheckCircle2, Search,
  CheckSquare, Square, Users, MessageSquare, ChevronDown, ChevronUp
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
}

// ─── Helpers ────────────────────────────────────────────────────────────────
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

// ─── Step 1: Info + Template ─────────────────────────────────────────────────
function StepTemplate({
  name, setName,
  description, setDescription,
  templates, loading,
  selectedTemplate, setSelectedTemplate,
}: {
  name: string; setName: (v: string) => void
  description: string; setDescription: (v: string) => void
  templates: HSMTemplate[]; loading: boolean
  selectedTemplate: HSMTemplate | null; setSelectedTemplate: (t: HSMTemplate | null) => void
}) {
  const approved = templates.filter(t => t.status === 'APPROVED')

  return (
    <div className="space-y-6">
      {/* Campaign info */}
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

      {/* Template picker */}
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
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {approved.map(template => {
              const selected = selectedTemplate?.id === template.id
              return (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(selected ? null : template)}
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
                      {template.variables_count > 0 && (
                        <p className="text-[10px] text-primary mt-1.5">{template.variables_count} variable{template.variables_count !== 1 ? 's' : ''}</p>
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
    </div>
  )
}

// ─── Step 2: Select contacts ─────────────────────────────────────────────────
function StepContacts({
  contacts, loading,
  selected, onToggle, onSelectAll, onClearAll,
  stages,
  filters, setFilters,
}: {
  contacts: ContactWithDetails[]; loading: boolean
  selected: Set<string>; onToggle: (id: string) => void
  onSelectAll: () => void; onClearAll: () => void
  stages: FunnelStage[]
  filters: ContactFilters; setFilters: (f: ContactFilters) => void
}) {
  const [showFilters, setShowFilters] = useState(false)

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
    return true
  })

  const allVisibleSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id))

  function handleToggleAll() {
    if (allVisibleSelected) {
      filtered.forEach(c => {
        if (selected.has(c.id)) onToggle(c.id)
      })
    } else {
      filtered.forEach(c => {
        if (!selected.has(c.id)) onToggle(c.id)
      })
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
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
          </div>
        )}
      </div>

      {/* Header */}
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

      {/* Contacts list */}
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
                  {isSelected
                    ? <CheckSquare className="h-4 w-4" />
                    : <Square className="h-4 w-4" />
                  }
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
  name, description, selectedTemplate, selectedContacts, sending,
}: {
  name: string; description: string
  selectedTemplate: HSMTemplate | null
  selectedContacts: ContactWithDetails[]
  sending: boolean
}) {
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

      {sending && (
        <div className="flex items-center justify-center gap-2 py-4">
          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Enviando campaña a n8n...</span>
        </div>
      )}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function NewCampaignPage() {
  const router = useRouter()
  const { supabase } = useSupabase()

  // Wizard state
  const [step, setStep] = useState<Step>(1)
  const [sending, setSending] = useState(false)

  // Step 1
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [templates, setTemplates] = useState<HSMTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<HSMTemplate | null>(null)

  // Step 2
  const [contacts, setContacts] = useState<ContactWithDetails[]>([])
  const [contactsLoading, setContactsLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [stages, setStages] = useState<FunnelStage[]>([])
  const [filters, setFilters] = useState<ContactFilters>({
    search: '', funnel_stage_id: '', source: '', lead_score_min: '', lead_score_max: '',
  })

  // Load templates
  useEffect(() => {
    supabase.from('hsm_templates').select('*').order('name').then(({ data }) => {
      setTemplates(data ?? [])
      setTemplatesLoading(false)
    })
  }, [supabase])

  // Load contacts + stages
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
  }, [supabase])

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

  // Validation per step
  const canAdvance =
    step === 1 ? name.trim().length > 0 && selectedTemplate !== null :
    step === 2 ? selectedIds.size > 0 :
    true

  async function handleSend() {
    if (!selectedTemplate || selectedIds.size === 0) return
    setSending(true)

    try {
      // Bypassing DB since there's an auth/schema issue right now, just send to n8n
      const payload = {
        campaign_id: 'test-campaign-id',
        campaign_name: name.trim(),
        template_name: selectedTemplate?.name ?? '',
        template_language: selectedTemplate?.language ?? '',
        template_body: selectedTemplate?.body_text ?? '',
        template_variables_count: selectedTemplate?.variables_count ?? 0,
        contacts: selectedContacts.map(c => ({
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
        total_contacts: selectedContacts.length,
      }

      const res = await fetch('/api/webhooks/n8n/send-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        toast.warning('Hubo un error al notificar a n8n')
      } else {
        toast.success(`Campaña enviada a ${selectedContacts.length} contactos`)
        router.push('/templates/campaigns')
      }
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

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="flex items-center gap-3 px-6 py-3.5 border-b border-border bg-background/80 backdrop-blur-md">
        <Link href="/templates/campaigns">
          <Button variant="ghost" size="sm" className="h-8 px-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-base font-semibold text-foreground leading-tight">Nueva campaña</h1>
        </div>

        {/* Step indicators */}
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

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          {step === 1 && (
            <StepTemplate
              name={name} setName={setName}
              description={description} setDescription={setDescription}
              templates={templates} loading={templatesLoading}
              selectedTemplate={selectedTemplate} setSelectedTemplate={setSelectedTemplate}
            />
          )}
          {step === 2 && (
            <StepContacts
              contacts={contacts} loading={contactsLoading}
              selected={selectedIds} onToggle={toggleContact}
              onSelectAll={selectAll} onClearAll={clearAll}
              stages={stages} filters={filters} setFilters={setFilters}
            />
          )}
          {step === 3 && (
            <StepConfirm
              name={name} description={description}
              selectedTemplate={selectedTemplate}
              selectedContacts={selectedContacts}
              sending={sending}
            />
          )}
        </div>
      </div>

      {/* Footer nav */}
      <div className="px-6 py-4 border-t border-border bg-background/80 backdrop-blur-md flex items-center justify-between">
        <Button
          variant="outline" size="sm" className="h-8 text-xs"
          onClick={() => setStep(s => Math.max(1, s - 1) as Step)}
          disabled={step === 1 || sending}
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          Atrás
        </Button>

        <div className="flex items-center gap-2">
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
              disabled={sending || selectedIds.size === 0}
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Enviar campaña ({selectedIds.size} contactos)
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
