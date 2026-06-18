'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/providers/auth-provider'
import { useSupabase } from '@/providers/supabase-provider'
import type { Tag } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Plus, Loader2 } from 'lucide-react'
import { SortableColorList, PALETTE } from '@/components/settings/sortable-color-list'

export default function TagsPage() {
  const { tenant, user } = useAuth()
  const { supabase } = useSupabase()
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PALETTE[0])
  const [saving, setSaving] = useState(false)

  const canEdit = ['owner', 'admin'].includes(user?.role ?? '')

  async function loadTags() {
    if (!tenant) return
    const { data } = await supabase.from('tags').select('*').eq('tenant_id', tenant.id).order('position')
    setTags(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadTags() }, [tenant]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !tenant) return
    setSaving(true)
    const { error } = await supabase.from('tags').insert({
      tenant_id: tenant.id, name: newName.trim(), color: newColor, position: tags.length,
    })
    if (error) toast.error(error.code === '23505' ? 'Ya existe una etiqueta con ese nombre' : error.message)
    else { toast.success('Etiqueta creada'); setNewName(''); await loadTags() }
    setSaving(false)
  }

  async function handleReorder(ids: string[]) {
    setTags(prev => ids.map((id, i) => ({ ...prev.find(t => t.id === id)!, position: i })))
    try {
      await Promise.all(ids.map((id, i) => supabase.from('tags').update({ position: i }).eq('id', id)))
    } catch {
      toast.error('Error al reordenar'); loadTags()
    }
  }

  async function handleRename(id: string, name: string) {
    setTags(prev => prev.map(t => t.id === id ? { ...t, name } : t))
    const { error } = await supabase.from('tags').update({ name }).eq('id', id)
    if (error) { toast.error(error.code === '23505' ? 'Ya existe una etiqueta con ese nombre' : error.message); loadTags() }
  }

  async function handleRecolor(id: string, color: string) {
    setTags(prev => prev.map(t => t.id === id ? { ...t, color } : t))
    const { error } = await supabase.from('tags').update({ color }).eq('id', id)
    if (error) { toast.error(error.message); loadTags() }
  }

  async function handleDelete(id: string) {
    const prev = tags
    setTags(t => t.filter(tag => tag.id !== id))
    const { error } = await supabase.from('tags').delete().eq('id', id)
    if (error) { toast.error(error.message); setTags(prev) }
    else toast.success('Etiqueta eliminada')
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-lg font-semibold">Etiquetas</h1>
        <p className="text-sm text-muted-foreground">
          Arrastra para reordenar, haz clic en el nombre para renombrar y en el color para cambiarlo.
        </p>
      </div>

      {canEdit && (
        <form onSubmit={handleCreate} className="flex items-end gap-3 p-4 border border-border rounded-xl bg-card">
          <div className="flex-1 space-y-1.5">
            <Label>Nueva etiqueta</Label>
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre de la etiqueta" required />
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
      ) : tags.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay etiquetas todavía</p>
      ) : (
        <SortableColorList
          items={tags}
          canEdit={canEdit}
          onReorder={handleReorder}
          onRename={handleRename}
          onRecolor={handleRecolor}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
