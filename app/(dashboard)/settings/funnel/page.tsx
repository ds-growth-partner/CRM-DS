'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/providers/auth-provider'
import { useSupabase } from '@/providers/supabase-provider'
import type { FunnelStage } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Plus, Trash2, GripVertical, Loader2 } from 'lucide-react'

const DEFAULT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export default function FunnelPage() {
  const { tenant, user } = useAuth()
  const { supabase } = useSupabase()
  const [stages, setStages] = useState<FunnelStage[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(DEFAULT_COLORS[0])
  const [saving, setSaving] = useState(false)
  const canEdit = ['owner', 'admin'].includes(user?.role ?? '')

  async function loadStages() {
    if (!tenant) return
    const { data } = await supabase.from('funnel_stages').select('*').eq('tenant_id', tenant.id).order('position')
    setStages(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadStages() }, [tenant])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !tenant) return
    setSaving(true)
    const slug = newName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
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

  async function handleDelete(id: string) {
    const { error } = await supabase.from('funnel_stages').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Fase eliminada'); setStages(s => s.filter(stage => stage.id !== id)) }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-lg font-semibold">Embudo de ventas</h1>
        <p className="text-sm text-muted-foreground">Configura las fases del embudo de tu proceso comercial</p>
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
              {DEFAULT_COLORS.map(c => (
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

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : stages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay fases todavía</p>
        ) : (
          stages.map((stage, idx) => (
            <div key={stage.id} className="flex items-center gap-3 p-3 border border-border rounded-lg bg-card hover:bg-muted/30 transition-colors">
              <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab" />
              <span
                className="h-5 w-5 rounded-full shrink-0"
                style={{ backgroundColor: stage.color }}
              />
              <span className="flex-1 text-sm font-medium">{stage.name}</span>
              <span className="text-xs text-muted-foreground">Pos. {stage.position}</span>
              {stage.is_won && <span className="text-xs text-emerald-500">Ganado</span>}
              {stage.is_lost && <span className="text-xs text-red-500">Perdido</span>}
              {canEdit && !stage.is_default && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(stage.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
