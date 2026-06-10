'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/providers/auth-provider'
import { useSupabase } from '@/providers/supabase-provider'
import type { CannedResponse } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, Pencil, Check, X, Search, MessageSquare } from 'lucide-react'

const CATEGORIES = ['General', 'Saludo', 'Calificación', 'Cierre', 'Soporte', 'Seguimiento']

const VARIABLE_HINTS = [
  { key: 'first_name', label: 'Nombre' },
  { key: 'last_name', label: 'Apellido' },
  { key: 'full_name', label: 'Nombre completo' },
  { key: 'company', label: 'Empresa' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'email', label: 'Correo' },
]

export default function CannedResponsesPage() {
  const { tenant, user } = useAuth()
  const { supabase } = useSupabase()
  const [responses, setResponses] = useState<CannedResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const canEdit = ['owner', 'admin', 'agent'].includes(user?.role ?? '')

  // Form state — nuevo
  const [newTitle, setNewTitle]       = useState('')
  const [newShortcut, setNewShortcut] = useState('')
  const [newContent, setNewContent]   = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [shortcutManual, setShortcutManual] = useState(false)

  // Edit state
  const [editDraft, setEditDraft] = useState<Partial<CannedResponse>>({})

  async function loadResponses() {
    if (!tenant) return
    const { data } = await supabase
      .from('canned_responses')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('shortcut')
    setResponses(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadResponses() }, [tenant]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleTitleChange(val: string) {
    setNewTitle(val)
    if (!shortcutManual) {
      setNewShortcut(
        '/' + val.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '')
          .slice(0, 30)
      )
    }
  }

  function insertVar(key: string) {
    setNewContent(c => c + `{{${key}}}`)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim() || !newShortcut.trim() || !newContent.trim() || !tenant) return
    setSaving(true)

    const shortcut = newShortcut.startsWith('/') ? newShortcut : `/${newShortcut}`

    const { error } = await supabase.from('canned_responses').insert({
      tenant_id: tenant.id,
      title: newTitle.trim(),
      shortcut,
      content: newContent.trim(),
      category: newCategory || null,
      created_by: user?.id ?? null,
    })

    if (error) {
      toast.error(error.code === '23505' ? 'Ya existe una respuesta con ese atajo' : error.message)
    } else {
      toast.success('Respuesta creada')
      setNewTitle(''); setNewShortcut(''); setNewContent('')
      setNewCategory(''); setShortcutManual(false)
      await loadResponses()
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('canned_responses').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Respuesta eliminada'); setResponses(r => r.filter(x => x.id !== id)) }
  }

  async function handleSaveEdit(id: string) {
    if (!editDraft.content?.trim() || !editDraft.title?.trim()) return
    const shortcut = editDraft.shortcut?.startsWith('/') ? editDraft.shortcut : `/${editDraft.shortcut}`
    const { error } = await supabase
      .from('canned_responses')
      .update({ ...editDraft, shortcut, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) toast.error(error.message)
    else {
      toast.success('Guardado')
      setEditingId(null)
      await loadResponses()
    }
  }

  const filtered = responses.filter(r => {
    const matchSearch = !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.shortcut.toLowerCase().includes(search.toLowerCase()) ||
      r.content.toLowerCase().includes(search.toLowerCase())
    const matchCat = !filterCategory || r.category === filterCategory
    return matchSearch && matchCat
  })

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-lg font-semibold">Respuestas predeterminadas</h1>
        <p className="text-sm text-muted-foreground">
          Crea respuestas rápidas. En el composer escribe{' '}
          <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono text-primary">/atajo</code>{' '}
          para buscarlas y usarlas.
        </p>
      </div>

      {/* Crear nueva respuesta */}
      {canEdit && (
        <form onSubmit={handleCreate} className="border border-border rounded-xl bg-card p-4 space-y-4">
          <h2 className="text-sm font-medium">Nueva respuesta</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                value={newTitle}
                onChange={e => handleTitleChange(e.target.value)}
                placeholder="Ej: Saludo inicial"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Atajo{' '}
                <span className="text-[10px] text-muted-foreground font-normal">empieza con /</span>
              </Label>
              <Input
                value={newShortcut}
                onChange={e => { setNewShortcut(e.target.value); setShortcutManual(true) }}
                placeholder="/saludo"
                required
                className="font-mono text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Categoría <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setNewCategory(c => c === cat ? '' : cat)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    newCategory === cat
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Contenido</Label>
              <div className="flex gap-1 flex-wrap justify-end">
                {VARIABLE_HINTS.map(v => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVar(v.key)}
                    className="text-[10px] font-mono text-primary bg-primary/5 hover:bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 transition-colors"
                  >
                    {`{{${v.key}}}`}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder={`Hola {{first_name}}, soy asesor del equipo. ¿En qué te puedo ayudar hoy? 😊`}
              rows={4}
              required
              className="w-full rounded-lg border border-border bg-background text-sm p-3 text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
            <p className="text-[11px] text-muted-foreground">
              Usa <code className="font-mono text-primary">{'{{first_name}}'}</code> para insertar datos del contacto. Las variables se reemplazan automáticamente al enviar.
            </p>
          </div>

          <Button type="submit" disabled={saving || !newTitle.trim() || !newShortcut.trim() || !newContent.trim()} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
            Crear respuesta
          </Button>
        </form>
      )}

      {/* Buscar y filtrar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, atajo o contenido..."
            className="pl-8 h-9 text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="h-9 rounded-md border border-border bg-background text-sm px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Todas las categorías</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-medium">Respuestas</h2>
          <span className="text-xs text-muted-foreground">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground px-1">Cargando...</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-xl text-muted-foreground gap-2">
            <MessageSquare className="h-8 w-8 opacity-30" />
            <p className="text-sm">
              {search || filterCategory ? 'Sin resultados para esta búsqueda' : 'Sin respuestas predeterminadas todavía'}
            </p>
          </div>
        ) : (
          filtered.map(resp => {
            const isEditing = editingId === resp.id
            return (
              <div key={resp.id} className="border border-border rounded-xl bg-card overflow-hidden">
                {isEditing ? (
                  /* ---- Edit mode ---- */
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Título</Label>
                        <Input
                          value={editDraft.title ?? ''}
                          onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Atajo</Label>
                        <Input
                          value={editDraft.shortcut ?? ''}
                          onChange={e => setEditDraft(d => ({ ...d, shortcut: e.target.value }))}
                          className="h-7 text-xs font-mono"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Contenido</Label>
                        <div className="flex gap-1">
                          {VARIABLE_HINTS.slice(0, 3).map(v => (
                            <button
                              key={v.key}
                              type="button"
                              onClick={() => setEditDraft(d => ({ ...d, content: (d.content ?? '') + `{{${v.key}}}` }))}
                              className="text-[10px] font-mono text-primary bg-primary/5 hover:bg-primary/10 px-1 py-0.5 rounded border border-primary/20"
                            >
                              {`{{${v.key}}}`}
                            </button>
                          ))}
                        </div>
                      </div>
                      <textarea
                        value={editDraft.content ?? ''}
                        onChange={e => setEditDraft(d => ({ ...d, content: e.target.value }))}
                        rows={3}
                        className="w-full rounded-lg border border-border bg-background text-xs p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveEdit(resp.id)}>
                        <Check className="h-3 w-3 mr-1" /> Guardar
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                        <X className="h-3 w-3 mr-1" /> Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* ---- View mode ---- */
                  <div className="flex items-start gap-3 p-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{resp.title}</span>
                        <code className="text-xs font-mono text-primary bg-primary/8 px-1.5 py-0.5 rounded border border-primary/20">
                          {resp.shortcut}
                        </code>
                        {resp.category && (
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                            {resp.category}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {resp.content}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => { setEditingId(resp.id); setEditDraft({ ...resp }) }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(resp.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
