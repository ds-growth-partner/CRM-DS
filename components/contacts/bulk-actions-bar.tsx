'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  Trash2, X, Edit3, ChevronDown, CheckSquare, Square, AlertTriangle,
  Bot, User, TrendingUp, Tag
} from 'lucide-react'
import type { ContactWithDetails, FunnelStage, Tag as TagType } from '@/lib/types/database'
import { useSupabase } from '@/providers/supabase-provider'
import { toast } from 'sonner'
import { TagBadge } from '@/components/shared/tag-badge'

interface BulkActionsBarProps {
  selectedIds: Set<string>
  contacts: ContactWithDetails[]
  stages: FunnelStage[]
  tags: TagType[]
  onClear: () => void
  onRefetch: () => void
}

type BulkMode = null | 'delete' | 'edit'

export function BulkActionsBar({ selectedIds, contacts, stages, tags, onClear, onRefetch }: BulkActionsBarProps) {
  const { supabase } = useSupabase()
  const [mode, setMode] = useState<BulkMode>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [loading, setLoading] = useState(false)

  // Edit form state
  const [newFunnelStage, setNewFunnelStage] = useState('')
  const [newAiActive, setNewAiActive] = useState<boolean | null>(null)
  const [newLeadScore, setNewLeadScore] = useState('')
  const [addTagId, setAddTagId] = useState('')
  const [removeTagId, setRemoveTagId] = useState('')

  const count = selectedIds.size
  if (count === 0) return null

  const ids = [...selectedIds]

  async function handleDelete() {
    setLoading(true)
    try {
      // Delete contact_tags first (FK constraint)
      await supabase.from('contact_tags').delete().in('contact_id', ids)
      const { error } = await supabase.from('contacts').delete().in('id', ids)
      if (error) throw error
      toast.success(`${count} contacto${count !== 1 ? 's' : ''} eliminado${count !== 1 ? 's' : ''}`)
      onClear()
      onRefetch()
    } catch (err) {
      toast.error('Error al eliminar contactos')
      console.error(err)
    } finally {
      setLoading(false)
      setConfirmDelete(false)
      setMode(null)
    }
  }

  async function handleEdit() {
    setLoading(true)
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (newFunnelStage) updates.funnel_stage_id = newFunnelStage === '__none__' ? null : newFunnelStage
    if (newAiActive !== null) updates.ai_active = newAiActive
    if (newLeadScore !== '') updates.lead_score = Number(newLeadScore)

    try {
      if (Object.keys(updates).length > 1) {
        const { error } = await supabase.from('contacts').update(updates).in('id', ids)
        if (error) throw error
      }

      if (addTagId) {
        const rows = ids.map(id => ({ contact_id: id, tag_id: addTagId }))
        await supabase.from('contact_tags').upsert(rows, { onConflict: 'contact_id,tag_id' })
      }

      if (removeTagId) {
        await supabase.from('contact_tags').delete()
          .in('contact_id', ids)
          .eq('tag_id', removeTagId)
      }

      toast.success(`${count} contacto${count !== 1 ? 's' : ''} actualizado${count !== 1 ? 's' : ''}`)
      onClear()
      onRefetch()
    } catch (err) {
      toast.error('Error al actualizar contactos')
      console.error(err)
    } finally {
      setLoading(false)
      setMode(null)
      setNewFunnelStage('')
      setNewAiActive(null)
      setNewLeadScore('')
      setAddTagId('')
      setRemoveTagId('')
    }
  }

  return (
    <>
      {/* Overlay for modals */}
      {mode && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => { setMode(null); setConfirmDelete(false) }} />}

      {/* Sticky bar at the bottom */}
      <div className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2.5',
        'bg-background/95 backdrop-blur-md border border-border rounded-2xl shadow-2xl',
        'animate-slide-up'
      )}>
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <CheckSquare className="h-4 w-4 text-primary" />
          <span>{count} seleccionado{count !== 1 ? 's' : ''}</span>
        </div>

        <div className="w-px h-5 bg-border mx-1" />

        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5 cursor-pointer"
          onClick={() => setMode('edit')}
        >
          <Edit3 className="h-3.5 w-3.5" />
          Editar
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5 cursor-pointer text-destructive hover:bg-destructive/10 border-destructive/30"
          onClick={() => { setMode('delete'); setConfirmDelete(true) }}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Eliminar
        </Button>

        <button
          onClick={onClear}
          className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Delete Confirm Modal */}
      {mode === 'delete' && confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-popover border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">¿Eliminar {count} contacto{count !== 1 ? 's' : ''}?</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Esta acción no se puede deshacer. Se eliminarán también todas sus etiquetas y datos relacionados.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setMode(null); setConfirmDelete(false) }}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                onClick={handleDelete}
                disabled={loading}
              >
                {loading ? 'Eliminando...' : `Eliminar ${count} contacto${count !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {mode === 'edit' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-popover border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Editar {count} contacto{count !== 1 ? 's' : ''}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Solo los campos que modifiques serán actualizados</p>
              </div>
              <button onClick={() => setMode(null)} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Fase del embudo */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Cambiar fase del embudo
                </label>
                <select
                  value={newFunnelStage}
                  onChange={e => setNewFunnelStage(e.target.value)}
                  className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">— sin cambios —</option>
                  <option value="__none__">Sin fase</option>
                  {stages.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Lead Score */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Lead Score (0–100)</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Sin cambios"
                  value={newLeadScore}
                  onChange={e => setNewLeadScore(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              {/* IA */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Bot className="h-3 w-3" /> Estado IA
                </label>
                <div className="flex gap-2">
                  {[
                    { v: null, label: 'Sin cambios' },
                    { v: true, label: 'Activar IA', color: 'text-emerald-600' },
                    { v: false, label: 'Desactivar', color: 'text-blue-600' },
                  ].map(opt => (
                    <button
                      key={String(opt.v)}
                      onClick={() => setNewAiActive(opt.v)}
                      className={cn(
                        'text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer',
                        newAiActive === opt.v
                          ? 'bg-primary/10 text-primary border-primary/40'
                          : 'border-border text-muted-foreground hover:border-primary/30'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Añadir etiqueta */}
              {tags.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Añadir etiqueta a todos
                  </label>
                  <select
                    value={addTagId}
                    onChange={e => setAddTagId(e.target.value)}
                    className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">— no añadir —</option>
                    {tags.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quitar etiqueta */}
              {tags.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Quitar etiqueta de todos
                  </label>
                  <select
                    value={removeTagId}
                    onChange={e => setRemoveTagId(e.target.value)}
                    className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">— no quitar —</option>
                    {tags.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setMode(null)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={handleEdit}
                disabled={loading || (!newFunnelStage && newAiActive === null && !newLeadScore && !addTagId && !removeTagId)}
              >
                {loading ? 'Guardando...' : `Actualizar ${count} contacto${count !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
