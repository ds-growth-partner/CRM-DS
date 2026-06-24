'use client'

import { useState, useEffect, useRef } from 'react'
import { useRealtimeContact } from '@/hooks/use-realtime-contact'
import { useContactTags } from '@/hooks/use-contact-tags'
import { useCustomFieldDefinitions } from '@/hooks/use-custom-field-definitions'
import { useContactNotes } from '@/hooks/use-contact-notes'
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
  Phone, Mail, Building2, MapPin, Hash, Plus, X, Check,
  ChevronDown, Calendar, Globe, Pencil, Loader2, ArrowLeft, Bot,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, timeAgo } from '@/lib/utils/date'
import { useSupabase } from '@/providers/supabase-provider'
import { useAuth } from '@/providers/auth-provider'
import type { FunnelStage } from '@/lib/types/database'
import { contactName, contactInitials } from '@/lib/utils/contact-fields'
import { cn } from '@/lib/utils'

interface ContactPanelProps {
  contactId: string
  conversationId: string
  onClose?: () => void
}

type EditableField = 'nombre' | 'apellido'

const FIELD_ICONS: Record<string, React.ElementType> = {
  telefono: Phone, email: Mail, empresa: Building2, ciudad: MapPin,
}

export function ContactPanel({ contactId, conversationId, onClose }: ContactPanelProps) {
  const { contact, loading } = useRealtimeContact(contactId)
  const { notes: contactNotes } = useContactNotes(contactId)
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

  // Todos los campos viven en contact_field_values → contact.fields
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})

  // Initialise local state when contact changes (not on every realtime update)
  useEffect(() => {
    if (!contact) return
    setNotes(contact.notes ?? '')
    const f = contact.fields ?? {}
    const vals: Record<string, string> = {}
    for (const def of customFieldDefs) vals[def.field_key] = f[def.field_key] ?? ''
    setFieldValues(vals)
  }, [contact?.id, contact?.fields, customFieldDefs]) // eslint-disable-line react-hooks/exhaustive-deps

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

  async function saveFieldValue(fieldKey: string, value: string) {
    setFieldValues(p => ({ ...p, [fieldKey]: value }))
    if (!tenant) return
    setSavingField(fieldKey)
    const v = value.trim()
    const { error } = v === ''
      ? await supabase.from('contact_field_values').delete()
          .eq('contact_id', contactId).eq('field_key', fieldKey)
      : await supabase.from('contact_field_values').upsert(
          { contact_id: contactId, tenant_id: tenant.id, field_key: fieldKey, value: v },
          { onConflict: 'contact_id,field_key' },
        )
    if (error) toast.error('Error al guardar campo')
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

  function startEdit(field: EditableField, current: string) {
    setEditingField(field)
    setFieldValue(current)
  }

  async function commitEdit() {
    if (!editingField) return
    const field = editingField
    const value = fieldValue
    setEditingField(null)
    await saveFieldValue(field, value)
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

  const cfields = contact.fields ?? {}
  const fullNameRaw = contactName(cfields)
  const fullName = fullNameRaw === 'Sin nombre' ? '' : fullNameRaw
  const assignedTagIds = new Set((contact.tags ?? []).map(t => t.id))
  const currentStage = stages.find(s => s.id === contact.funnel_stage_id)

  // ── Sub-components ────────────────────────────────────────────────────────

  function SectionHeader({ label }: { label: string }) {
    return <p className="section-label px-0.5">{label}</p>
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
                    {contactInitials(cfields)}
                  </div>
                  <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-sidebar status-online" />
                </div>

                {editingField === 'nombre' || editingField === 'apellido' ? (
                  <div className="flex gap-1 w-full">
                    <Input
                      autoFocus={editingField === 'nombre'}
                      value={editingField === 'nombre' ? fieldValue : (cfields.nombre ?? '')}
                      onChange={e => editingField === 'nombre' && setFieldValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingField(null) }}
                      onBlur={commitEdit}
                      className="h-7 text-xs text-center"
                      placeholder="Nombre"
                    />
                    <Input
                      autoFocus={editingField === 'apellido'}
                      value={editingField === 'apellido' ? fieldValue : (cfields.apellido ?? '')}
                      onChange={e => editingField === 'apellido' && setFieldValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingField(null) }}
                      onBlur={commitEdit}
                      className="h-7 text-xs text-center"
                      placeholder="Apellido"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 group">
                    <p className="text-sm font-semibold text-foreground leading-tight">{fullName || 'Sin nombre'}</p>
                    <button
                      onClick={() => startEdit('nombre', cfields.nombre ?? '')}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {cfields.empresa && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{cfields.empresa}</p>
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

              {/* Información del contacto — todos los campos en una lista uniforme
                  (nombre/apellido se editan arriba en el avatar) */}
              {customFieldDefs.length > 0 && (
                <div className="rounded-xl border border-border bg-card/50 p-3 space-y-2">
                  <SectionHeader label="Información" />
                  <div className="space-y-2">
                    {customFieldDefs
                      .filter(def => def.field_key !== 'nombre' && def.field_key !== 'apellido')
                      .map(def => {
                        const val = fieldValues[def.field_key] ?? ''
                        const Icon = FIELD_ICONS[def.field_key] || Hash
                        return (
                          <div key={def.id} className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <Icon className="h-3 w-3 text-muted-foreground/50" />
                              <p className="text-[10px] text-muted-foreground">{def.label}</p>
                            </div>
                            {def.field_type === 'select' && def.options ? (
                              <select
                                value={val}
                                onChange={e => saveFieldValue(def.field_key, e.target.value)}
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
                                  : def.field_type === 'url' ? 'url'
                                  : 'text'
                                }
                                value={val}
                                onChange={e => setFieldValues(p => ({ ...p, [def.field_key]: e.target.value }))}
                                onBlur={e => saveFieldValue(def.field_key, e.target.value)}
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

              {/* Notas del bot — feed en tiempo real desde contact_notes */}
              {contactNotes.length > 0 && (
                <div className="rounded-xl border border-border bg-card/50 p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Bot className="h-3 w-3 text-purple-500" />
                    <SectionHeader label="Notas del bot" />
                  </div>
                  <div className="space-y-2">
                    {contactNotes.map(note => (
                      <div key={note.id} className="rounded-lg border border-border/60 bg-muted/30 p-2">
                        <p className="text-xs text-foreground whitespace-pre-wrap leading-snug">{note.content}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] text-muted-foreground/70">
                            {note.created_by ? 'Equipo' : 'Bot IA'}
                          </span>
                          <span className="text-[10px] text-muted-foreground/40">·</span>
                          <span className="text-[10px] text-muted-foreground/70">{timeAgo(note.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
          <AIMindPanel contactId={contactId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
