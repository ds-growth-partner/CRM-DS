'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/providers/auth-provider'
import { useSupabase } from '@/providers/supabase-provider'
import type { Tag } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2 } from 'lucide-react'

const DEFAULT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']

export default function TagsPage() {
  const { tenant, user } = useAuth()
  const { supabase } = useSupabase()
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(DEFAULT_COLORS[0])
  const [saving, setSaving] = useState(false)

  const canEdit = ['owner', 'admin'].includes(user?.role ?? '')

  async function loadTags() {
    if (!tenant) return
    const { data } = await supabase.from('tags').select('*').eq('tenant_id', tenant.id).order('name')
    setTags(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadTags() }, [tenant])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !tenant) return
    setSaving(true)
    const { error } = await supabase.from('tags').insert({ tenant_id: tenant.id, name: newName.trim(), color: newColor })
    if (error) toast.error(error.message)
    else { toast.success('Etiqueta creada'); setNewName(''); await loadTags() }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('tags').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Etiqueta eliminada'); setTags(t => t.filter(tag => tag.id !== id)) }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-lg font-semibold">Etiquetas</h1>
        <p className="text-sm text-muted-foreground">Gestiona las etiquetas para clasificar tus contactos</p>
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
        ) : tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay etiquetas todavía</p>
        ) : (
          tags.map(tag => (
            <div key={tag.id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-card hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <span className="h-5 w-5 rounded-full" style={{ backgroundColor: tag.color }} />
                <span className="text-sm font-medium">{tag.name}</span>
              </div>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(tag.id)}
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
