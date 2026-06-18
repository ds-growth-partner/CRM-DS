'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/providers/auth-provider'
import { useSupabase } from '@/providers/supabase-provider'
import type { FunnelStage } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Plus, Loader2 } from 'lucide-react'
import { SortableColorList, PALETTE } from '@/components/settings/sortable-color-list'

export default function FunnelPage() {
  const { tenant, user } = useAuth()
  const { supabase } = useSupabase()
  const [stages, setStages] = useState<FunnelStage[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PALETTE[0])
  const [saving, setSaving] = useState(false)
  const canEdit = ['owner', 'admin'].includes(user?.role ?? '')

  async function loadStages() {
    if (!tenant) return
    const { data } = await supabase.from('funnel_stages').select('*').eq('tenant_id', tenant.id).order('position')
    setStages(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadStages() }, [tenant]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !tenant) return
    setSaving(true)
    const base = newName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const slug = `${base || 'fase'}-${Date.now().toString(36)}`
    const { error } = await supabase.from('funnel_stages').insert({
      tenant_id: tenant.id,
      name: newName.trim(),
      slug,
      color: newColor,
      position: stages.length,
    })
    if (error) toast.error(error.message)
    else { toast.success('Fase creada'); setNewName(''); await loadStages() }
    setSaving(false)
  }

  async function handleReorder(ids: string[]) {
    setStages(prev => ids.map((id, i) => ({ ...prev.find(s => s.id === id)!, position: i })))
    try {
      await Promise.all(ids.map((id, i) => supabase.from('funnel_stages').update({ position: i }).eq('id', id)))
    } catch {
      toast.error('Error al reordenar'); loadStages()
    }
  }

  async function handleRename(id: string, name: string) {
    setStages(prev => prev.map(s => s.id === id ? { ...s, name } : s))
    const { error } = await supabase.from('funnel_stages').update({ name }).eq('id', id)
    if (error) { toast.error(error.message); loadStages() }
  }

  async function handleRecolor(id: string, color: string) {
    setStages(prev => prev.map(s => s.id === id ? { ...s, color } : s))
    const { error } = await supabase.from('funnel_stages').update({ color }).eq('id', id)
    if (error) { toast.error(error.message); loadStages() }
  }

  async function handleDelete(id: string) {
    const prev = stages
    setStages(s => s.filter(stage => stage.id !== id))
    const { error } = await supabase.from('funnel_stages').delete().eq('id', id)
    if (error) { toast.error(error.message); setStages(prev) }
    else toast.success('Fase eliminada')
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-lg font-semibold">Embudo de ventas</h1>
        <p className="text-sm text-muted-foreground">
          Configura las fases. Arrastra para reordenar, haz clic en el nombre para renombrar y en el color para cambiarlo.
        </p>
      </div>

      {canEdit && (
        <form onSubmit={handleCreate} className="flex items-end gap-3 p-4 border border-border rounded-xl bg-card">
          <div className="flex-1 space-y-1.5">
            <Label>Nueva fase</Label>
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej: Interesado" required />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-1.5">
              {PALETTE.slice(0, 6).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{ backgroundColor: c, borderColor: newColor === c ? 'white' : 'transparent' }}
                />
              ))}
            </div>
          </div>
          <Button type="submit" disabled={saving || !newName.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : stages.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay fases todavía</p>
      ) : (
        <SortableColorList
          items={stages}
          canEdit={canEdit}
          onReorder={handleReorder}
          onRename={handleRename}
          onRecolor={handleRecolor}
          onDelete={handleDelete}
          canDelete={(s) => !s.is_default}
          renderMeta={(s) => (
            <>
              {s.is_won && <span className="text-[10px] text-emerald-500 font-medium shrink-0">Ganado</span>}
              {s.is_lost && <span className="text-[10px] text-red-500 font-medium shrink-0">Perdido</span>}
              {s.is_default && <span className="text-[10px] text-muted-foreground shrink-0">Fija</span>}
            </>
          )}
        />
      )}
    </div>
  )
}
