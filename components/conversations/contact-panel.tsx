'use client'

import { useState, useEffect, useRef } from 'react'
import { useRealtimeContact } from '@/hooks/use-realtime-contact'
import { useContactTags } from '@/hooks/use-contact-tags'
import { useCustomFieldDefinitions } from '@/hooks/use-custom-field-definitions'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { TagBadge } from '@/components/shared/tag-badge'
import { LeadScoreBar } from '@/components/shared/lead-score-bar'
import { AIMindPanel } from './ai-mind-panel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Phone, Mail, Building2, MapPin, Copy, Plus, X, Check,
  ChevronDown, Calendar, Globe, Pencil, Loader2, ArrowLeft,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils/date'
import { useSupabase } from '@/providers/supabase-provider'
import { useAuth } from '@/providers/auth-provider'
import type { FunnelStage, Json } from '@/lib/types/database'
import { cn } from '@/lib/utils'

interface ContactPanelProps {
  contactId: string
  conversationId: string
  onClose?: () => void
}

type EditableField = 'first_name' | 'last_name' | 'phone' | 'email' | 'company' | 'city'

export function ContactPanel({ contactId, conversationId, onClose }: ContactPanelProps) {
  const { contact, loading } = useRealtimeContact(contactId)
  const { allTags, loadingTags, loadAllTags, assignTag, removeTag } = useContactTags(contactId)
  const { fields: customFieldDefs } = useCustomFieldDefinitions()
  const { supabase } = useSupabase()
  const { tenant } = useAuth()

  const [tagPopoverOpen, setTagPopoverOpen] = useState(false)
  const [stages, setStages] = useState<FunnelStage[]>([])
  const [stageMenuOpen, setStageMenuOpen] = useState(false)
  const [savingField, setSavingField] = useState<string | null>(null)

  // Per-field inline editing
  const [editingField, setEditingField] = useState<EditableField | null>(null)
  const [fieldValue, setFieldValue] = useState('')

  // Notes — always editable, debounced auto-save
  const [notes, setNotes] = useState('')
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Custom fields — always editable
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({})

  // Initialise local state when contact changes (not on every realtime update)
  useEffect(() => {
    if (!contact) return
    setNotes(contact.notes ?? '')
    setCustomFields((contact.custom_fields as Record<string, unknown>) ?? {})
  }, [contact?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!tenant) return
    supabase
      .from('funnel_stages')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('position')
      .then(({ data }) => setStages(data ?? []))
  }, [supabase, tenant])

  // ── Save helpers ──────────────────────────────────────────────────────────

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

  // ── Loading / empty ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col h-full w-full lg:w-[270px] border-l border-border bg-sidebar p-4 space-y-4">
        <Skeleton className="h-14 w-14 rounded-full mx-auto" />
        <Skeleton className="h-4 w-3/4 mx-auto" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    )
  }

  if (!contact) return null

  const fullName = `${contact.first_name} ${contact.last_name ?? ''}`.trim()
  const assignedTagIds = new Set((contact.tags ?? []).map(t => t.id))
  const currentStage = stages.find(s => s.id === contact.funnel_stage_id)

  // ── Sub-components ────────────────────────────────────────────────────────

  function SectionHeader({ label }: { label: string }) {
    return <p className="section-label px-0.5">{label}</p>
  }

  function InfoRow({
    field, icon: Icon, label, value,
  }: { field: EditableField; icon: React.ElementType; label: string; value?: string | null }) {
    const isEditing = editingField === field

    if (!isEditing && !value) {
      return (
        <button
          onClick={() => startEdit(field, '')}
          className="flex items-center gap-2 py-1.5 w-full text-left text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted/20 shrink-0">
            <Icon className="h-3 w-3" />
          </div>
          <span className="text-xs italic">Añadir {label.toLowerCase()}</span>
        </button>
      )
    }

    return (
      <div className="flex items-start gap-2.5 py-1.5 group">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/8 text-primary/70 shrink-0 mt-0.5">
          <Icon className="h-3 w-3" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
          {isEditing ? (
            <div className="flex items-center gap-1 mt-0.5">
              <Input
                autoFocus
                value={fieldValue}
                onChange={e => setFieldValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit()
                  if (e.key === 'Escape') setEditingField(null)
                }}
                onBlur={commitEdit}
                className="h-6 text-xs bg-muted/40 border-primary/40"
              />
              {savingField === field && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <p className="text-xs text-foreground font-medium truncate flex-1">{value}</p>
              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0 gap-0.5">
                <button
                  onClick={() => { navigator.clipboard.writeText(value ?? ''); toast.success('Copiado') }}
                  className="p-0.5 rounded text-muted-foreground hover:text-primary"
                >
                  <Copy className="h-2.5 w-2.5" />
                </button>
                <button
                  onClick={() => startEdit(field, value ?? '')}
                  className="p-0.5 rounded text-muted-foreground hover:text-primary"
                >
                  <Pencil className="h-2.5 w-2.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full w-full lg:w-[270px] border-l border-border bg-sidebar">
      {/* Mobile back button */}
      {onClose && (
        <div className="flex items-center gap-2 px-3 pt-3 pb-1 lg:hidden">
          <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={onClose}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al chat
          </Button>
        </div>
      )}

      <Tabs defaultValue="contact" className="flex flex-col flex-1 overflow-hidden">
        <TabsList className="mx-3 mt-3 grid grid-cols-2 h-8 shrink-0">
          <TabsTrigger value="contact" className="text-xs h-6">Contacto</TabsTrigger>
          <TabsTrigger value="ai" className="text-xs h-6">Mente IA</TabsTrigger>
        </TabsList>

        <TabsContent value="contact" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <div className="px-3 pt-3 pb-6 space-y-4">

              {/* Avatar + nombre (click-to-edit) */}
              <div className="flex flex-col items-center text-center pt-1">
                <div className="relative mb-2">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-violet-500/30 text-primary text-xl font-bold ring-2 ring-primary/20">
                    {fullName.charAt(0).toUpperCase()}
                  </div>
                  <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-sidebar status-online" />
                </div>

                {editingField === 'first_name' || editingField === 'last_name' ? (
                  <div className="flex gap-1 w-full">
                    <Input
                      autoFocus={editingField === 'first_name'}
                      value={editingField === 'first_name' ? fieldValue : contact.first_name}
                      onChange={e => editingField === 'first_name' && setFieldValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingField(null) }}
                      onBlur={commitEdit}
                      className="h-7 text-xs text-center"
                      placeholder="Nombre"
                    />
                    <Input
                      autoFocus={editingField === 'last_name'}
                      value={editingField === 'last_name' ? fieldValue : (contact.last_name ?? '')}
                      onChange={e => editingField === 'last_name' && setFieldValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingField(null) }}
                      onBlur={commitEdit}
                      className="h-7 text-xs text-center"
                      placeholder="Apellido"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 group">
                    <p className="text-sm font-semibold text-foreground leading-tight">{fullName}</p>
                    <button
                      onClick={() => startEdit('first_name', contact.first_name)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {contact.company && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{contact.company}</p>
                )}
              </div>

              {/* Funnel stage — siempre interactivo */}
              <div className="rounded-xl border border-border bg-card/50 p-3 space-y-3">
                <div className="space-y-1.5">
                  <SectionHeader label="Etapa del embudo" />
                  <div className="relative">
                    <button
                      onClick={() => setStageMenuOpen(v => !v)}
                      className="flex items-center justify-between w-full h-7 px-2.5 rounded-lg border border-border bg-muted/30 text-xs hover:bg-muted/50 transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        {currentStage ? (
                          <>
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: currentStage.color }}
                            />
                            <span className="text-foreground">{currentStage.name}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Sin etapa</span>
                        )}
                      </span>
                      {savingField === 'stage'
                        ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        : <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      }
                    </button>

                    {stageMenuOpen && (
                      <div className="absolute top-8 left-0 right-0 z-50 bg-popover border border-border rounded-xl shadow-xl overflow-hidden animate-slide-up">
                        <button
                          onClick={() => saveStage(null)}
                          className="w-full px-3 py-2 text-xs text-left hover:bg-muted text-muted-foreground transition-colors"
                        >
                          Sin etapa
                        </button>
                        <div className="h-px bg-border mx-2" />
                        {stages.map(s => (
                          <button
                            key={s.id}
                            onClick={() => saveStage(s.id)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left hover:bg-muted transition-colors"
                          >
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                            <span className="flex-1">{s.name}</span>
                            {contact.funnel_stage_id === s.id && (
                              <Check className="h-3 w-3 text-primary" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <SectionHeader label="Lead Score" />
                  <LeadScoreBar score={contact.lead_score} />
                </div>
              </div>

              {/* Etiquetas — siempre interactivas */}
              <div className="rounded-xl border border-border bg-card/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <SectionHeader label="Etiquetas" />
                  <Popover
                    open={tagPopoverOpen}
                    onOpenChange={open => { setTagPopoverOpen(open); if (open) loadAllTags() }}
                  >
                    <PopoverTrigger render={
                      <button className="inline-flex items-center justify-center h-5 w-5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" />
                    }>
                      <Plus className="h-3 w-3" />
                    </PopoverTrigger>
                    <PopoverContent className="w-52 p-2" align="end">
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
                                <span
                                  className="h-3 w-3 rounded-full shrink-0 ring-1 ring-black/10"
                                  style={{ backgroundColor: tag.color }}
                                />
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
                <div className="flex flex-wrap gap-1">
                  {(contact.tags ?? []).map(tag => (
                    <div key={tag.id} className="flex items-center gap-0.5 group">
                      <TagBadge tag={tag} />
                      <button
                        onClick={() => removeTag(tag.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                  {(contact.tags ?? []).length === 0 && (
                    <button
                      onClick={() => { setTagPopoverOpen(true); loadAllTags() }}
                      className="text-xs italic text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    >
                      Añadir etiqueta...
                    </button>
                  )}
                </div>
              </div>

              {/* Información de contacto — click-to-edit por campo */}
              <div className="rounded-xl border border-border bg-card/50 p-3 space-y-0.5">
                <SectionHeader label="Información" />
                <InfoRow field="phone"   icon={Phone}    label="Teléfono" value={contact.phone}   />
                <InfoRow field="email"   icon={Mail}     label="Email"    value={contact.email}   />
                <InfoRow field="company" icon={Building2} label="Empresa" value={contact.company} />
                <InfoRow field="city"    icon={MapPin}   label="Ciudad"   value={contact.city}    />
              </div>

              {/* Campos personalizados — siempre editables */}
              {customFieldDefs.length > 0 && (
                <div className="rounded-xl border border-border bg-card/50 p-3 space-y-2">
                  <SectionHeader label="Campos personalizados" />
                  <div className="space-y-2">
                    {customFieldDefs.map(def => {
                      const val = String(customFields[def.field_key] ?? '')
                      return (
                        <div key={def.id} className="space-y-0.5">
                          <p className="text-[10px] text-muted-foreground">{def.label}</p>
                          {def.field_type === 'select' && def.options ? (
                            <select
                              value={val}
                              onChange={e => {
                                const v = e.target.value
                                setCustomFields(p => ({ ...p, [def.field_key]: v }))
                                saveCustomField(def.field_key, v)
                              }}
                              className="w-full h-7 rounded-lg border border-border bg-muted/30 text-xs px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="">— seleccionar —</option>
                              {(def.options as string[]).map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <Input
                              type={
                                def.field_type === 'number' ? 'number'
                                : def.field_type === 'date' ? 'date'
                                : def.field_type === 'email' ? 'email'
                                : def.field_type === 'phone' ? 'tel'
                                : 'text'
                              }
                              value={val}
                              onChange={e => setCustomFields(p => ({ ...p, [def.field_key]: e.target.value }))}
                              onBlur={e => saveCustomField(def.field_key, e.target.value)}
                              placeholder={`Añadir ${def.label.toLowerCase()}...`}
                              className="h-7 text-xs bg-muted/30"
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Notas internas — siempre editables, auto-save */}
              <div className="rounded-xl border border-border bg-card/50 p-3 space-y-2">
                <SectionHeader label="Notas internas" />
                <textarea
                  value={notes}
                  onChange={e => handleNotesChange(e.target.value)}
                  placeholder="Notas sobre el cliente..."
                  rows={3}
                  className="w-full rounded-lg border border-border bg-muted/30 text-xs p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none placeholder:text-muted-foreground/50"
                />
              </div>

              {/* Origen */}
              <div className="rounded-xl border border-border bg-card/50 p-3 space-y-2">
                <SectionHeader label="Origen" />
                <div className="flex items-center gap-2">
                  <Globe className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-foreground capitalize font-medium">{contact.source}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Creado {formatDate(contact.created_at)}</span>
                </div>
              </div>

            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="ai" className="flex-1 overflow-hidden mt-0">
          <AIMindPanel conversationId={conversationId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
