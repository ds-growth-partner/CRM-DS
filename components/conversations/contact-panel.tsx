'use client'

import { useState, useEffect } from 'react'
import { useRealtimeContact } from '@/hooks/use-realtime-contact'
import { useContactTags } from '@/hooks/use-contact-tags'
import { useCustomFieldDefinitions } from '@/hooks/use-custom-field-definitions'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TagBadge } from '@/components/shared/tag-badge'
import { FunnelBadge } from '@/components/shared/funnel-badge'
import { LeadScoreBar } from '@/components/shared/lead-score-bar'
import { AIMindPanel } from './ai-mind-panel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Phone, Mail, Building2, MapPin, Copy, Plus, X, Pencil, Check, ChevronDown, Calendar, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils/date'
import { useSupabase } from '@/providers/supabase-provider'
import { useAuth } from '@/providers/auth-provider'
import type { FunnelStage, Json } from '@/lib/types/database'
import { cn } from '@/lib/utils'

interface ContactPanelProps {
  contactId: string
  conversationId: string
}

export function ContactPanel({ contactId, conversationId }: ContactPanelProps) {
  const { contact, loading } = useRealtimeContact(contactId)
  const { allTags, loadingTags, loadAllTags, assignTag, removeTag } = useContactTags(contactId)
  const { fields: customFieldDefs } = useCustomFieldDefinitions()
  const { supabase } = useSupabase()
  const { tenant } = useAuth()
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [stages, setStages] = useState<FunnelStage[]>([])
  const [stageMenuOpen, setStageMenuOpen] = useState(false)

  const [draft, setDraft] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    company: '',
    city: '',
    notes: '',
    funnel_stage_id: '' as string | null,
    custom_fields: {} as Record<string, unknown>,
  })

  useEffect(() => {
    if (contact && !editing) {
      setDraft({
        first_name: contact.first_name,
        last_name: contact.last_name ?? '',
        phone: contact.phone ?? '',
        email: contact.email ?? '',
        company: contact.company ?? '',
        city: contact.city ?? '',
        notes: contact.notes ?? '',
        funnel_stage_id: contact.funnel_stage_id ?? null,
        custom_fields: (contact.custom_fields as Record<string, unknown>) ?? {},
      })
    }
  }, [contact, editing])

  useEffect(() => {
    if (!tenant) return
    supabase.from('funnel_stages').select('*').eq('tenant_id', tenant.id).order('position')
      .then(({ data }) => setStages(data ?? []))
  }, [supabase, tenant])

  async function saveContact() {
    if (!contact) return
    setSaving(true)
    const { error } = await supabase
      .from('contacts')
      .update({
        first_name: draft.first_name.trim() || contact.first_name,
        last_name: draft.last_name.trim() || null,
        phone: draft.phone.trim() || null,
        email: draft.email.trim() || null,
        company: draft.company.trim() || null,
        city: draft.city.trim() || null,
        notes: draft.notes.trim() || null,
        funnel_stage_id: draft.funnel_stage_id || null,
        custom_fields: draft.custom_fields as Json,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId)

    if (error) toast.error('Error al guardar')
    else { toast.success('Contacto actualizado'); setEditing(false) }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full w-[270px] border-l border-border bg-sidebar p-4 space-y-4">
        <Skeleton className="h-14 w-14 rounded-full mx-auto" />
        <Skeleton className="h-4 w-3/4 mx-auto" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    )
  }

  if (!contact) return null

  const fullName = `${contact.first_name} ${contact.last_name ?? ''}`.trim()
  const assignedTagIds = new Set((contact.tags ?? []).map(t => t.id))
  const currentStage = stages.find(s => s.id === (editing ? draft.funnel_stage_id : contact.funnel_stage_id))

  function SectionHeader({ label }: { label: string }) {
    return (
      <p className="section-label px-0.5">{label}</p>
    )
  }

  function InfoRow({ icon: Icon, label, value, onCopy }: {
    icon: React.ElementType; label: string; value?: string | null; onCopy?: () => void
  }) {
    if (!editing && !value) return null
    return (
      <div className="flex items-start gap-2.5 py-1.5 group">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/8 text-primary/70 shrink-0 mt-0.5">
          <Icon className="h-3 w-3" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
          {editing ? (
            <Input
              value={value ?? ''}
              onChange={e => {
                const map: Record<string, keyof typeof draft> = {
                  'Teléfono': 'phone', 'Email': 'email', 'Empresa': 'company', 'Ciudad': 'city'
                }
                setDraft(d => ({ ...d, [map[label]]: e.target.value }))
              }}
              className="h-6 text-xs mt-0.5 bg-muted/40 border-muted"
            />
          ) : (
            <div className="flex items-center gap-1">
              <p className="text-xs text-foreground font-medium truncate">{value}</p>
              {onCopy && (
                <button
                  onClick={onCopy}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                >
                  <Copy className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full w-[270px] border-l border-border bg-sidebar">
      <Tabs defaultValue="contact" className="flex flex-col h-full">
        <TabsList className="mx-3 mt-3 grid grid-cols-2 h-8">
          <TabsTrigger value="contact" className="text-xs h-6">Contacto</TabsTrigger>
          <TabsTrigger value="ai" className="text-xs h-6">Mente IA</TabsTrigger>
        </TabsList>

        <TabsContent value="contact" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <div className="px-3 pt-3 pb-6 space-y-4">

              {/* Avatar + nombre */}
              <div className="flex flex-col items-center text-center pt-1">
                <div className="relative mb-2">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-violet-500/30 text-primary text-xl font-bold ring-2 ring-primary/20">
                    {fullName.charAt(0).toUpperCase()}
                  </div>
                  <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-sidebar status-online" />
                </div>

                {editing ? (
                  <div className="flex gap-1 w-full">
                    <Input
                      value={draft.first_name}
                      onChange={e => setDraft(d => ({ ...d, first_name: e.target.value }))}
                      className="h-7 text-xs text-center"
                      placeholder="Nombre"
                    />
                    <Input
                      value={draft.last_name}
                      onChange={e => setDraft(d => ({ ...d, last_name: e.target.value }))}
                      className="h-7 text-xs text-center"
                      placeholder="Apellido"
                    />
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-foreground leading-tight">{fullName}</p>
                )}
                {contact.company && !editing && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{contact.company}</p>
                )}

                {/* Acciones editar/guardar */}
                <div className="flex gap-1.5 mt-2">
                  {editing ? (
                    <>
                      <Button
                        size="sm"
                        className="h-7 text-xs px-3"
                        onClick={saveContact}
                        disabled={saving}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Guardar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-3"
                        onClick={() => setEditing(false)}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-3 border-border/60 hover:border-primary/40 bg-transparent"
                      onClick={() => setEditing(true)}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                  )}
                </div>
              </div>

              {/* Funnel + Lead Score */}
              <div className="rounded-xl border border-border bg-card/50 p-3 space-y-3">
                <div className="space-y-1.5">
                  <SectionHeader label="Etapa del embudo" />
                  {editing ? (
                    <div className="relative">
                      <button
                        onClick={() => setStageMenuOpen(v => !v)}
                        className="flex items-center justify-between w-full h-7 px-2.5 rounded-lg border border-border bg-muted/30 text-xs hover:bg-muted/50 transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          {currentStage ? (
                            <>
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: currentStage.color }} />
                              <span className="text-foreground">{currentStage.name}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">Sin etapa</span>
                          )}
                        </span>
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      </button>
                      {stageMenuOpen && (
                        <div className="absolute top-8 left-0 right-0 z-50 bg-popover border border-border rounded-xl shadow-xl overflow-hidden animate-slide-up">
                          <button
                            onClick={() => { setDraft(d => ({ ...d, funnel_stage_id: null })); setStageMenuOpen(false) }}
                            className="w-full px-3 py-2 text-xs text-left hover:bg-muted text-muted-foreground transition-colors"
                          >Sin etapa</button>
                          <div className="h-px bg-border mx-2" />
                          {stages.map(s => (
                            <button
                              key={s.id}
                              onClick={() => { setDraft(d => ({ ...d, funnel_stage_id: s.id })); setStageMenuOpen(false) }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left hover:bg-muted transition-colors"
                            >
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                              <span>{s.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <FunnelBadge stage={contact.funnel_stage} />
                  )}
                </div>

                <div className="space-y-1.5">
                  <SectionHeader label="Lead Score" />
                  <LeadScoreBar score={contact.lead_score} />
                </div>
              </div>

              {/* Información de contacto */}
              <div className="rounded-xl border border-border bg-card/50 p-3 space-y-0.5">
                <SectionHeader label="Información" />
                <InfoRow
                  icon={Phone}
                  label="Teléfono"
                  value={editing ? draft.phone : (contact.phone ?? '')}
                  onCopy={() => { navigator.clipboard.writeText(contact.phone ?? ''); toast.success('Copiado') }}
                />
                <InfoRow
                  icon={Mail}
                  label="Email"
                  value={editing ? draft.email : (contact.email ?? '')}
                  onCopy={() => { navigator.clipboard.writeText(contact.email ?? ''); toast.success('Copiado') }}
                />
                <InfoRow
                  icon={Building2}
                  label="Empresa"
                  value={editing ? draft.company : (contact.company ?? '')}
                />
                <InfoRow
                  icon={MapPin}
                  label="Ciudad"
                  value={editing ? draft.city : (contact.city ?? '')}
                />
              </div>

              {/* Tags */}
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
                        <p className="text-xs text-muted-foreground px-1">Sin etiquetas. Crea una en Ajustes.</p>
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
                    <p className="text-xs text-muted-foreground">Sin etiquetas</p>
                  )}
                </div>
              </div>

              {/* Custom fields */}
              {customFieldDefs.length > 0 && (
                <div className="rounded-xl border border-border bg-card/50 p-3 space-y-2">
                  <SectionHeader label="Campos personalizados" />
                  <div className="space-y-2">
                    {customFieldDefs.map(def => {
                      const val = editing
                        ? (draft.custom_fields[def.field_key] ?? '')
                        : ((contact.custom_fields as Record<string, unknown>)?.[def.field_key] ?? '')

                      if (!editing && !val) return null
                      return (
                        <div key={def.id} className="space-y-0.5">
                          <p className="text-[10px] text-muted-foreground">{def.label}</p>
                          {editing ? (
                            def.field_type === 'select' && def.options ? (
                              <select
                                value={String(draft.custom_fields[def.field_key] ?? '')}
                                onChange={e => setDraft(d => ({
                                  ...d,
                                  custom_fields: { ...d.custom_fields, [def.field_key]: e.target.value }
                                }))}
                                className="w-full h-7 rounded-lg border border-border bg-muted/30 text-xs px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              >
                                <option value="">— seleccionar —</option>
                                {(def.options as string[]).map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : (
                              <Input
                                type={def.field_type === 'number' ? 'number' : def.field_type === 'date' ? 'date' : def.field_type === 'email' ? 'email' : def.field_type === 'phone' ? 'tel' : 'text'}
                                value={String(draft.custom_fields[def.field_key] ?? '')}
                                onChange={e => setDraft(d => ({
                                  ...d,
                                  custom_fields: { ...d.custom_fields, [def.field_key]: e.target.value }
                                }))}
                                className="h-7 text-xs bg-muted/30"
                              />
                            )
                          ) : (
                            <p className="text-xs text-foreground font-medium">{String(val)}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="rounded-xl border border-border bg-card/50 p-3 space-y-2">
                <SectionHeader label="Notas internas" />
                {editing ? (
                  <textarea
                    value={draft.notes}
                    onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                    placeholder="Notas sobre el cliente..."
                    rows={3}
                    className="w-full rounded-lg border border-border bg-muted/30 text-xs p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                ) : contact.notes ? (
                  <p className="text-xs text-foreground leading-relaxed">{contact.notes}</p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Sin notas internas</p>
                )}
              </div>

              {/* Meta */}
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
