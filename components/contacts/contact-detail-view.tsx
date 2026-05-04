'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useRealtimeContact } from '@/hooks/use-realtime-contact'
import { useContactTags } from '@/hooks/use-contact-tags'
import { useCustomFieldDefinitions } from '@/hooks/use-custom-field-definitions'
import { useMessages } from '@/hooks/use-messages'
import { useSupabase } from '@/providers/supabase-provider'
import { useAuth } from '@/providers/auth-provider'

import { MessageBubble } from '@/components/conversations/message-bubble'
import { Composer } from '@/components/conversations/composer'
import { TagBadge } from '@/components/shared/tag-badge'
import { LeadScoreBar } from '@/components/shared/lead-score-bar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils/date'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { FunnelStage, Json, PhaseTransition, Conversation, Appointment } from '@/lib/types/database'
import {
  ArrowLeft, Phone, Mail, Building2, MapPin, Globe, Calendar,
  Copy, Pencil, Plus, X, Check, ChevronDown, Loader2,
  MessageSquare, Activity, Bot, User as UserIcon, Clock,
  ArrowRight, Sparkles, Hash,
} from 'lucide-react'

interface ContactDetailViewProps {
  contactId: string
}

type EditableField = 'first_name' | 'last_name' | 'phone' | 'email' | 'company' | 'city'

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-0.5 mb-2">{label}</p>
}

// ── Phase transition timeline item ─────────────────────────────────────────────

function TransitionItem({ t, stages }: { t: PhaseTransition; stages: FunnelStage[] }) {
  const prev = stages.find(s => s.id === t.previous_stage_id)
  const next = stages.find(s => s.id === t.new_stage_id)

  const reasonLabel: Record<string, string> = {
    manual: 'Movido manualmente',
    automatic: 'Movido automáticamente',
    bot: 'Movido por IA',
    campaign: 'Movido por campaña',
  }

  return (
    <div className="flex gap-3 py-3 border-b border-border/40 last:border-0">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
        <ArrowRight className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {t.previous_stage_name ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{ backgroundColor: `${prev?.color ?? '#94a3b8'}18`, color: prev?.color ?? '#94a3b8' }}
            >
              {t.previous_stage_name}
            </span>
          ) : (
            <span className="text-muted-foreground/60 text-[11px]">Sin etapa</span>
          )}
          <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
            style={{ backgroundColor: `${next?.color ?? '#94a3b8'}18`, color: next?.color ?? '#94a3b8' }}
          >
            {t.new_stage_name ?? 'Sin etapa'}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-muted-foreground">{reasonLabel[t.reason] ?? t.reason}</span>
          <span className="text-muted-foreground/30">·</span>
          <span className="text-[10px] text-muted-foreground/60">{formatDate(t.created_at)}</span>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ContactDetailView({ contactId }: ContactDetailViewProps) {
  const router = useRouter()
  const { supabase } = useSupabase()
  const { tenant } = useAuth()

  // ── Local state ─────────────────────────────────────────────────────────────
  const [stages, setStages] = useState<FunnelStage[]>([])
  const [transitions, setTransitions] = useState<PhaseTransition[]>([])
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false)
  const [stageMenuOpen, setStageMenuOpen] = useState(false)
  const [savingField, setSavingField] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<EditableField | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [fieldValue, setFieldValue] = useState('')
  const [notes, setNotes] = useState('')
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({})
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [mobileTab, setMobileTab] = useState<'info' | 'chat' | 'activity' | 'appointments'>('info')

  // ── Data hooks ──────────────────────────────────────────────────────────────
  const { contact, loading } = useRealtimeContact(contactId)
  const { allTags, loadingTags, loadAllTags, assignTag, removeTag } = useContactTags(contactId)
  const { fields: customFieldDefs } = useCustomFieldDefinitions()
  const { messages, loading: messagesLoading, hasMore, loadOlder, addOptimisticMessage } = useMessages(
    conversation?.id ?? null
  )

  // ── Load stages & transitions ───────────────────────────────────────────────
  useEffect(() => {
    if (!tenant) return
    supabase
      .from('funnel_stages')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('position')
      .then(({ data }) => setStages(data ?? []))
  }, [supabase, tenant])

  useEffect(() => {
    supabase
      .from('phase_transitions')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => setTransitions(data ?? []))
  }, [supabase, contactId])

  // Load the most recent conversation for this contact (needed for Composer)
  useEffect(() => {
    supabase
      .from('conversations')
      .select('*')
      .eq('contact_id', contactId)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setConversation(data))
  }, [supabase, contactId])

  // Load appointments
  useEffect(() => {
    supabase
      .from('appointments')
      .select('*')
      .eq('contact_id', contactId)
      .order('start_time', { ascending: false })
      .then(({ data }) => setAppointments(data ?? []))
  }, [supabase, contactId])

  // ── Sync contact local state ────────────────────────────────────────────────
  useEffect(() => {
    if (!contact) return
    setNotes(contact.notes ?? '')
    setCustomFields((contact.custom_fields as Record<string, unknown>) ?? {})
  }, [contact?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll to bottom on new messages ───────────────────────────────────────
  useEffect(() => {
    if (!messagesLoading) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length, messagesLoading])

  // ── Save helpers ────────────────────────────────────────────────────────────
  async function saveField(field: string, value: string | null) {
    setSavingField(field)
    const { error } = await supabase
      .from('contacts')
      .update({ [field]: value || null, updated_at: new Date().toISOString() })
      .eq('id', contactId)
    if (error) toast.error('Error al guardar')
    setSavingField(null)
  }

  async function saveStage(stageId: string | null) {
    setSavingField('stage')
    setStageMenuOpen(false)
    const { error } = await supabase
      .from('contacts')
      .update({ funnel_stage_id: stageId, updated_at: new Date().toISOString() })
      .eq('id', contactId)
    if (error) toast.error('Error al guardar etapa')
    setSavingField(null)
  }

  function handleNotesChange(value: string) {
    setNotes(value)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from('contacts')
        .update({ notes: value || null, updated_at: new Date().toISOString() })
        .eq('id', contactId)
      if (error) toast.error('Error al guardar notas')
    }, 800)
  }

  async function saveCustomField(key: string, value: string) {
    const updated = { ...customFields, [key]: value || undefined }
    const { error } = await supabase
      .from('contacts')
      .update({ custom_fields: updated as Json, updated_at: new Date().toISOString() })
      .eq('id', contactId)
    if (error) toast.error('Error al guardar campo')
  }

  function startEdit(field: EditableField, current: string) {
    setEditingField(field)
    setFieldValue(current)
  }

  async function commitEdit() {
    if (!editingField) return
    const field = editingField
    const value = fieldValue
    setEditingField(null)
    await saveField(field, value)
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const fullName = contact ? `${contact.first_name} ${contact.last_name ?? ''}`.trim() : ''
  const assignedTagIds = new Set((contact?.tags ?? []).map(t => t.id))
  const currentStage = stages.find(s => s.id === contact?.funnel_stage_id)
  const initials = fullName.charAt(0).toUpperCase()

  // ── Group messages by date ──────────────────────────────────────────────────
  type MsgGroup = { date: string; entries: typeof messages }
  const msgGroups: MsgGroup[] = []
  let curDate = ''
  for (const entry of messages) {
    const d = formatDate(entry.created_at)
    if (d !== curDate) { curDate = d; msgGroups.push({ date: d, entries: [] }) }
    msgGroups[msgGroups.length - 1].entries.push(entry)
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="flex flex-1 gap-0 overflow-hidden">
          <div className="w-80 xl:w-96 border-r border-border p-4 space-y-4 hidden md:block">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
          <div className="flex-1 p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-3/4 rounded-xl" style={{ marginLeft: i % 2 ? 'auto' : 0 }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <UserIcon className="h-10 w-10 opacity-30" />
        <p className="text-sm">Contacto no encontrado</p>
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Volver
        </Button>
      </div>
    )
  }

  // ── Info panel content (shared between desktop left panel & mobile info tab) ──

  function InfoRow({
    field, icon: Icon, label, value,
  }: { field: EditableField; icon: React.ElementType; label: string; value?: string | null }) {
    const isEditing = editingField === field
    if (!isEditing && !value) {
      return (
        <button
          onClick={() => startEdit(field, '')}
          className="flex items-center gap-2.5 py-1.5 w-full text-left text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/30 shrink-0">
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs italic">Añadir {label.toLowerCase()}</span>
        </button>
      )
    }
    return (
      <div className="flex items-start gap-2.5 py-1.5 group">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/8 text-primary/70 shrink-0 mt-0.5">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
          {isEditing ? (
            <div className="flex items-center gap-1 mt-0.5">
              <Input
                autoFocus
                value={fieldValue}
                onChange={e => setFieldValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingField(null) }}
                onBlur={commitEdit}
                className="h-7 text-xs bg-muted/40 border-primary/40"
              />
              {savingField === field && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <p className="text-xs text-foreground font-medium truncate flex-1">{value}</p>
              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0 gap-0.5">
                <button
                  onClick={() => { navigator.clipboard.writeText(value ?? ''); toast.success('Copiado') }}
                  className="p-0.5 rounded text-muted-foreground hover:text-primary"
                >
                  <Copy className="h-3 w-3" />
                </button>
                <button
                  onClick={() => startEdit(field, value ?? '')}
                  className="p-0.5 rounded text-muted-foreground hover:text-primary"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const InfoPanelContent = (
    <div className="px-4 pb-8 space-y-5">

      {/* Avatar + nombre */}
      <div className="flex flex-col items-center text-center pt-4 pb-2">
        <div className="relative mb-3">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-violet-500/30 text-primary text-3xl font-bold ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
            {initials}
          </div>
        </div>

        {editingField === 'first_name' || editingField === 'last_name' ? (
          <div className="flex gap-1.5 w-full max-w-[220px]">
            <Input
              autoFocus={editingField === 'first_name'}
              value={editingField === 'first_name' ? fieldValue : contact.first_name}
              onChange={e => editingField === 'first_name' && setFieldValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingField(null) }}
              onBlur={commitEdit}
              className="h-8 text-sm text-center"
              placeholder="Nombre"
            />
            <Input
              autoFocus={editingField === 'last_name'}
              value={editingField === 'last_name' ? fieldValue : (contact.last_name ?? '')}
              onChange={e => editingField === 'last_name' && setFieldValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingField(null) }}
              onBlur={commitEdit}
              className="h-8 text-sm text-center"
              placeholder="Apellido"
            />
          </div>
        ) : (
          <div className="flex items-center gap-1.5 group">
            <p className="text-lg font-semibold text-foreground leading-tight">{fullName}</p>
            <button
              onClick={() => startEdit('first_name', contact.first_name)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary mt-0.5"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {contact.company && (
          <p className="text-xs text-muted-foreground mt-1">{contact.company}</p>
        )}

        {/* wa_id chip */}
        {contact.wa_id && (
          <div className="mt-2 flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full text-[11px] font-medium">
            <MessageSquare className="h-3 w-3" />
            WhatsApp activo
          </div>
        )}
      </div>

      {/* Etapa + Lead score */}
      <div className="rounded-xl border border-border bg-card/50 p-4 space-y-4">
        <div>
          <SectionHeader label="Etapa del embudo" />
          <div className="relative">
            <button
              onClick={() => setStageMenuOpen(v => !v)}
              className="flex items-center justify-between w-full h-9 px-3 rounded-lg border border-border bg-muted/30 text-sm hover:bg-muted/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                {currentStage ? (
                  <>
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: currentStage.color }} />
                    <span className="text-foreground font-medium">{currentStage.name}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Sin etapa</span>
                )}
              </span>
              {savingField === 'stage'
                ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              }
            </button>

            {stageMenuOpen && (
              <div className="absolute top-10 left-0 right-0 z-50 bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
                <button
                  onClick={() => saveStage(null)}
                  className="w-full px-3 py-2.5 text-sm text-left hover:bg-muted text-muted-foreground transition-colors"
                >
                  Sin etapa
                </button>
                <div className="h-px bg-border mx-3" />
                {stages.map(s => (
                  <button
                    key={s.id}
                    onClick={() => saveStage(s.id)}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-left hover:bg-muted transition-colors"
                  >
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="flex-1">{s.name}</span>
                    {contact.funnel_stage_id === s.id && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <SectionHeader label="Lead Score" />
          <LeadScoreBar score={contact.lead_score} showLabel />
        </div>
      </div>

      {/* Etiquetas */}
      <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <SectionHeader label="Etiquetas" />
          <Popover
            open={tagPopoverOpen}
            onOpenChange={open => { setTagPopoverOpen(open); if (open) loadAllTags() }}
          >
            <PopoverTrigger render={
              <button className="inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" />
            }>
              <Plus className="h-3.5 w-3.5" />
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="end">
              <p className="text-xs font-semibold mb-2 px-1">Asignar etiqueta</p>
              {loadingTags ? (
                <p className="text-xs text-muted-foreground px-1">Cargando...</p>
              ) : allTags.length === 0 ? (
                <p className="text-xs text-muted-foreground px-1">Sin etiquetas. Crea en Ajustes.</p>
              ) : (
                <div className="space-y-0.5">
                  {allTags.map(tag => {
                    const isAssigned = assignedTagIds.has(tag.id)
                    return (
                      <button
                        key={tag.id}
                        onClick={() => isAssigned ? removeTag(tag.id) : assignTag(tag.id)}
                        className={cn(
                          'flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs transition-colors',
                          isAssigned ? 'bg-primary/8 text-primary' : 'hover:bg-muted text-foreground'
                        )}
                      >
                        <span className="h-3 w-3 rounded-full shrink-0 ring-1 ring-black/10" style={{ backgroundColor: tag.color }} />
                        <span className="flex-1 text-left">{tag.name}</span>
                        {isAssigned && <Check className="h-3 w-3 text-primary" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(contact.tags ?? []).map(tag => (
            <div key={tag.id} className="flex items-center gap-0.5 group">
              <TagBadge tag={tag} />
              <button
                onClick={() => removeTag(tag.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-0.5"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
          {(contact.tags ?? []).length === 0 && (
            <button
              onClick={() => { setTagPopoverOpen(true); loadAllTags() }}
              className="text-xs italic text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            >
              Añadir etiqueta...
            </button>
          )}
        </div>
      </div>

      {/* Información de contacto */}
      <div className="rounded-xl border border-border bg-card/50 p-4 space-y-1">
        <SectionHeader label="Información de contacto" />
        <InfoRow field="phone"   icon={Phone}    label="Teléfono" value={contact.phone}   />
        <InfoRow field="email"   icon={Mail}     label="Email"    value={contact.email}   />
        <InfoRow field="company" icon={Building2} label="Empresa" value={contact.company} />
        <InfoRow field="city"    icon={MapPin}   label="Ciudad"   value={contact.city}    />
      </div>

      {/* Campos personalizados */}
      {customFieldDefs.length > 0 && (
        <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
          <SectionHeader label="Campos personalizados" />
          <div className="space-y-3">
            {customFieldDefs.map(def => {
              const val = String(customFields[def.field_key] ?? '')
              return (
                <div key={def.id} className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Hash className="h-3 w-3 text-muted-foreground/50" />
                    <p className="text-[11px] text-muted-foreground">{def.label}</p>
                  </div>
                  {def.field_type === 'select' && def.options ? (
                    <select
                      value={val}
                      onChange={e => {
                        const v = e.target.value
                        setCustomFields(p => ({ ...p, [def.field_key]: v }))
                        saveCustomField(def.field_key, v)
                      }}
                      className="w-full h-8 rounded-lg border border-border bg-muted/30 text-sm px-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">— seleccionar —</option>
                      {(def.options as string[]).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : def.field_type === 'boolean' ? (
                    <button
                      onClick={() => {
                        const v = val === 'true' ? 'false' : 'true'
                        setCustomFields(p => ({ ...p, [def.field_key]: v }))
                        saveCustomField(def.field_key, v)
                      }}
                      className={cn(
                        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                        val === 'true' ? 'bg-primary' : 'bg-muted-foreground/30'
                      )}
                    >
                      <span className={cn(
                        'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                        val === 'true' ? 'translate-x-4' : 'translate-x-0.5'
                      )} />
                    </button>
                  ) : (
                    <Input
                      type={
                        def.field_type === 'number' ? 'number'
                        : def.field_type === 'date' ? 'date'
                        : def.field_type === 'email' ? 'email'
                        : def.field_type === 'phone' ? 'tel'
                        : def.field_type === 'url' ? 'url'
                        : 'text'
                      }
                      value={val}
                      onChange={e => setCustomFields(p => ({ ...p, [def.field_key]: e.target.value }))}
                      onBlur={e => saveCustomField(def.field_key, e.target.value)}
                      placeholder={`Añadir ${def.label.toLowerCase()}...`}
                      className="h-8 text-sm bg-muted/30"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Notas internas */}
      <div className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
        <SectionHeader label="Notas internas" />
        <textarea
          value={notes}
          onChange={e => handleNotesChange(e.target.value)}
          placeholder="Notas sobre el cliente..."
          rows={4}
          className="w-full rounded-lg border border-border bg-muted/30 text-sm p-3 text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none placeholder:text-muted-foreground/40 leading-relaxed"
        />
      </div>

      {/* Origen */}
      <div className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
        <SectionHeader label="Origen y fecha" />
        <div className="flex items-center gap-2.5">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-foreground capitalize font-medium">{contact.source}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Creado {formatDate(contact.created_at)}</span>
        </div>
        {contact.last_contacted_at && (
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Último contacto {formatDate(contact.last_contacted_at)}</span>
          </div>
        )}
      </div>
    </div>
  )

  // ── Chat panel content ───────────────────────────────────────────────────────

  const ChatPanelContent = (
    <div className="flex flex-col h-full overflow-hidden">
      {contact.wa_id ? (
        <>
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto">
            {/* Load older */}
            {hasMore && (
              <div className="flex justify-center py-3">
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1.5" onClick={loadOlder}>
                  <Clock className="h-3 w-3" /> Cargar mensajes anteriores
                </Button>
              </div>
            )}

            {messagesLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={cn('flex', i % 2 ? 'justify-end' : 'justify-start')}>
                    <Skeleton className="h-10 w-2/3 rounded-2xl" />
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-16">
                <MessageSquare className="h-10 w-10 opacity-20" />
                <p className="text-sm">Sin mensajes aún</p>
                <p className="text-xs text-muted-foreground/60">Escribe abajo para iniciar la conversación</p>
              </div>
            ) : (
              <div className="py-4">
                {msgGroups.map(group => (
                  <div key={group.date}>
                    <div className="flex justify-center mb-3">
                      <span className="text-[11px] text-muted-foreground bg-muted/50 px-3 py-1 rounded-full border border-border/30">
                        {group.date}
                      </span>
                    </div>
                    {group.entries.map(entry => (
                      <MessageBubble key={entry.id} message={entry} />
                    ))}
                  </div>
                ))}
                <div ref={bottomRef} className="h-4" />
              </div>
            )}
          </div>

          {/* Composer — only if we have a conversation linked */}
          {conversation ? (
            <Composer
              conversationId={conversation.id}
              contactId={contactId}
              waId={contact.wa_id}
              lastIncomingAt={contact.last_incoming_at ?? null}
              contact={contact}
              onOptimisticMessage={(content) => {
                if (tenant) addOptimisticMessage(content, tenant.id, contactId)
              }}
            />
          ) : (
            <div className="border-t border-border p-4 text-center">
              <p className="text-xs text-muted-foreground">
                No hay conversación activa en WhatsApp para este contacto.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-16">
          <MessageSquare className="h-10 w-10 opacity-20" />
          <p className="text-sm">Este contacto no tiene WhatsApp asociado</p>
          <p className="text-xs text-muted-foreground/60">Añade un número de teléfono para ver los mensajes</p>
        </div>
      )}
    </div>
  )

  // ── Activity panel content ───────────────────────────────────────────────────

  const ActivityPanelContent = (
    <div className="h-full overflow-y-auto py-4 px-4">
      {transitions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-16">
          <Activity className="h-10 w-10 opacity-20" />
          <p className="text-sm">Sin cambios de etapa registrados</p>
        </div>
      ) : (
        <div>
          <p className="text-xs text-muted-foreground mb-4">
            {transitions.length} cambio{transitions.length !== 1 ? 's' : ''} de etapa
          </p>
          <div className="divide-y divide-border/40">
            {transitions.map(t => (
              <TransitionItem key={t.id} t={t} stages={stages} />
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // ── Appointments panel content ───────────────────────────────────────────────

  const AppointmentsPanelContent = (
    <div className="h-full overflow-y-auto py-4 px-4 space-y-4">
      {appointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-16">
          <Calendar className="h-10 w-10 opacity-20" />
          <p className="text-sm">No hay citas programadas con este cliente</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map(appt => {
            const start = new Date(appt.start_time)
            const end = new Date(appt.end_time)
            return (
              <div key={appt.id} className="border border-border rounded-xl p-4 bg-card/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-card">
                <div>
                  <h4 className="font-medium text-foreground text-sm">{appt.title}</h4>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(appt.start_time)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDate(appt.start_time).split(' ')[1]} - {formatDate(appt.end_time).split(' ')[1] || format(end, 'HH:mm')}
                    </span>
                  </div>
                  {appt.description && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{appt.description}</p>
                  )}
                </div>
                <div className="flex items-center sm:flex-col sm:items-end gap-2 shrink-0">
                  <span className={cn(
                    "px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-full",
                    appt.status === 'scheduled' ? "bg-blue-500/10 text-blue-500" :
                    appt.status === 'confirmed' ? "bg-emerald-500/10 text-emerald-500" :
                    appt.status === 'cancelled' ? "bg-red-500/10 text-red-500" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {appt.status}
                  </span>
                  {appt.google_meet_link && (
                    <a href={appt.google_meet_link} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                      <Globe className="h-3 w-3" /> Meet
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0 bg-background/80 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {/* Avatar pequeño */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-violet-500/30 text-primary text-sm font-bold">
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-foreground truncate">{fullName}</h1>
          {contact.company && (
            <p className="text-xs text-muted-foreground truncate">{contact.company}</p>
          )}
        </div>

        {currentStage && (
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0"
            style={{ backgroundColor: `${currentStage.color}18`, color: currentStage.color }}
          >
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: currentStage.color }} />
            {currentStage.name}
          </div>
        )}
      </div>

      {/* ── Mobile tab bar ──────────────────────────────────────────────────── */}
      <div className="flex md:hidden border-b border-border shrink-0">
        {[
          { id: 'info', label: 'Info', icon: UserIcon },
          { id: 'chat', label: 'Chat', icon: MessageSquare },
          { id: 'activity', label: 'Actividad', icon: Activity },
          { id: 'appointments', label: 'Citas', icon: Calendar },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setMobileTab(tab.id as typeof mobileTab)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-medium border-b-2 transition-colors',
              mobileTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Mobile content ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden md:hidden">
        {mobileTab === 'info' && (
          <ScrollArea className="flex-1">
            {InfoPanelContent}
          </ScrollArea>
        )}
        {mobileTab === 'chat' && (
          <div className="flex-1 overflow-hidden">
            {ChatPanelContent}
          </div>
        )}
        {mobileTab === 'activity' && (
          <div className="flex-1 overflow-hidden">
            {ActivityPanelContent}
          </div>
        )}
        {mobileTab === 'appointments' && (
          <div className="flex-1 overflow-hidden">
            {AppointmentsPanelContent}
          </div>
        )}
      </div>

      {/* ── Desktop two-column layout ────────────────────────────────────────── */}
      <div className="hidden md:flex flex-1 overflow-hidden">

        {/* Left: Info panel */}
        <div className="w-80 xl:w-96 shrink-0 border-r border-border overflow-hidden">
          <ScrollArea className="h-full">
            {InfoPanelContent}
          </ScrollArea>
        </div>

        {/* Right: Chat + Activity tabs */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs defaultValue="chat" className="flex flex-col h-full">
            <div className="flex items-center border-b border-border px-4 shrink-0">
              <TabsList className="h-10 bg-transparent gap-1 p-0">
                <TabsTrigger
                  value="chat"
                  className="h-9 px-3 text-sm data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent rounded-none gap-1.5"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Conversación
                  {messages.length > 0 && (
                    <span className="text-[10px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 tabular-nums">
                      {messages.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="activity"
                  className="h-9 px-3 text-sm data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent rounded-none gap-1.5"
                >
                  <Activity className="h-3.5 w-3.5" />
                  Actividad
                  {transitions.length > 0 && (
                    <span className="text-[10px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 tabular-nums">
                      {transitions.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="appointments"
                  className="h-9 px-3 text-sm data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent rounded-none gap-1.5"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Citas
                  {appointments.length > 0 && (
                    <span className="text-[10px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 tabular-nums">
                      {appointments.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="chat" className="flex-1 overflow-hidden mt-0">
              {ChatPanelContent}
            </TabsContent>

            <TabsContent value="activity" className="flex-1 overflow-hidden mt-0">
              {ActivityPanelContent}
            </TabsContent>

            <TabsContent value="appointments" className="flex-1 overflow-hidden mt-0">
              {AppointmentsPanelContent}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
