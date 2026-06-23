'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/providers/auth-provider'
import { useSupabase } from '@/providers/supabase-provider'
import type { CustomFieldDefinition } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Plus, Trash2, Loader2, GripVertical,
  Type, Hash, Calendar, ToggleLeft, List, Link, Mail, Phone,
} from 'lucide-react'

const FIELD_TYPES: { value: CustomFieldDefinition['field_type']; label: string; icon: React.ElementType }[] = [
  { value: 'text',    label: 'Texto',      icon: Type },
  { value: 'number',  label: 'Número',     icon: Hash },
  { value: 'date',    label: 'Fecha',      icon: Calendar },
  { value: 'boolean', label: 'Sí / No',    icon: ToggleLeft },
  { value: 'select',  label: 'Lista',      icon: List },
  { value: 'url',     label: 'URL',        icon: Link },
  { value: 'email',   label: 'Correo',     icon: Mail },
  { value: 'phone',   label: 'Teléfono',   icon: Phone },
]

export default function CustomFieldsPage() {
  const { tenant, user } = useAuth()
  const { supabase } = useSupabase()
  const [fields, setFields] = useState<CustomFieldDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const canEdit = ['owner', 'admin'].includes(user?.role ?? '')

  // Form state
  const [newLabel, setNewLabel]     = useState('')
  const [newKey, setNewKey]         = useState('')
  const [newType, setNewType]       = useState<CustomFieldDefinition['field_type']>('text')
  const [newOptions, setNewOptions] = useState('')   // CSV para tipo select
  const [newRequired, setNewRequired] = useState(false)
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false)

  async function loadFields() {
    if (!tenant) return
    const { data } = await supabase
      .from('custom_field_definitions')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('position')
    setFields(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadFields() }, [tenant]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-generar field_key a partir del label
  function handleLabelChange(val: string) {
    setNewLabel(val)
    if (!keyManuallyEdited) {
      setNewKey(
        val.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '')
          .slice(0, 40)
      )
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newLabel.trim() || !newKey.trim() || !tenant) return
    setSaving(true)

    const options = newType === 'select'
      ? newOptions.split(',').map(o => o.trim()).filter(Boolean)
      : null

    const { error } = await supabase.from('custom_field_definitions').insert({
      tenant_id: tenant.id,
      label: newLabel.trim(),
      field_key: newKey.trim(),
      field_type: newType,
      options: options ? JSON.stringify(options) : null,
      is_required: newRequired,
      position: fields.length,
    })

    if (error) {
      toast.error(error.code === '23505' ? 'Ya existe un campo con ese nombre clave' : error.message)
    } else {
      toast.success('Campo creado')
      setNewLabel(''); setNewKey(''); setNewType('text')
      setNewOptions(''); setNewRequired(false); setKeyManuallyEdited(false)
      await loadFields()
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('custom_field_definitions').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Campo eliminado'); setFields(f => f.filter(x => x.id !== id)) }
  }

  async function handleRename(id: string, label: string) {
    const v = label.trim()
    if (!v) return
    setFields(f => f.map(x => x.id === id ? { ...x, label: v } : x))
    const { error } = await supabase.from('custom_field_definitions').update({ label: v }).eq('id', id)
    if (error) { toast.error(error.message); loadFields() }
  }

  async function moveUp(index: number) {
    if (index === 0) return
    const updated = [...fields]
    ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
    setFields(updated)
    await Promise.all([
      supabase.from('custom_field_definitions').update({ position: index - 1 }).eq('id', updated[index - 1].id),
      supabase.from('custom_field_definitions').update({ position: index }).eq('id', updated[index].id),
    ])
  }

  const TypeIcon = FIELD_TYPES.find(t => t.value === newType)?.icon ?? Type

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-lg font-semibold">Campos personalizados</h1>
        <p className="text-sm text-muted-foreground">
          Define campos extra para tus contactos. Úsalos en mensajes con{' '}
          <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono text-primary">{'{{field_key}}'}</code>
        </p>
      </div>

      {/* Form */}
      {canEdit && (
        <form
          onSubmit={handleCreate}
          className="border border-border rounded-xl bg-card p-4 space-y-4"
        >
          <h2 className="text-sm font-medium">Nuevo campo</h2>

          <div className="grid grid-cols-2 gap-3">
            {/* Label */}
            <div className="space-y-1.5">
              <Label>Nombre del campo</Label>
              <Input
                value={newLabel}
                onChange={e => handleLabelChange(e.target.value)}
                placeholder="Ej: RFC"
                required
              />
            </div>

            {/* Key */}
            <div className="space-y-1.5">
              <Label>
                Nombre clave{' '}
                <span className="text-[10px] text-muted-foreground font-normal">(para {'{{variables}}'})</span>
              </Label>
              <Input
                value={newKey}
                onChange={e => { setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); setKeyManuallyEdited(true) }}
                placeholder="rfc"
                required
                className="font-mono text-sm"
              />
            </div>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <div className="grid grid-cols-4 gap-2">
              {FIELD_TYPES.map(t => {
                const Icon = t.icon
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setNewType(t.value)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      newType === t.value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Select options */}
          {newType === 'select' && (
            <div className="space-y-1.5">
              <Label>
                Opciones{' '}
                <span className="text-[10px] text-muted-foreground font-normal">separadas por coma</span>
              </Label>
              <Input
                value={newOptions}
                onChange={e => setNewOptions(e.target.value)}
                placeholder="Persona Física, Persona Moral, Empresa"
                required
              />
            </div>
          )}

          {/* Required */}
          <div className="flex items-center gap-2">
            <input
              id="required"
              type="checkbox"
              checked={newRequired}
              onChange={e => setNewRequired(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="required" className="cursor-pointer font-normal">
              Campo obligatorio
            </Label>
          </div>

          <Button type="submit" disabled={saving || !newLabel.trim() || !newKey.trim()} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
            Crear campo
          </Button>
        </form>
      )}

      {/* List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-medium">Campos activos</h2>
          <span className="text-xs text-muted-foreground">{fields.length} campo{fields.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground px-1">Cargando...</p>
        ) : fields.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-border rounded-xl text-muted-foreground text-sm">
            Sin campos personalizados todavía
          </div>
        ) : (
          fields.map((field, idx) => {
            const typeInfo = FIELD_TYPES.find(t => t.value === field.field_type)
            const Icon = typeInfo?.icon ?? Type
            const options = field.options ? (field.options as string[]) : []
            return (
              <div
                key={field.id}
                className="flex items-center gap-3 p-3 border border-border rounded-xl bg-card hover:bg-muted/20 transition-colors"
              >
                {canEdit && (
                  <button
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    className="text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20 cursor-pointer"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                )}

                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/5 text-primary shrink-0">
                  <Icon className="h-3.5 w-3.5" />
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {canEdit ? (
                      <input
                        defaultValue={field.label}
                        key={field.label}
                        onBlur={e => { if (e.target.value.trim() && e.target.value !== field.label) handleRename(field.id, e.target.value) }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        className="text-sm font-medium bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none min-w-0"
                      />
                    ) : (
                      <span className="text-sm font-medium">{field.label}</span>
                    )}
                    {field.mapped_column && (
                      <span className="text-[10px] text-muted-foreground/70 font-medium shrink-0">campo base</span>
                    )}
                    {field.is_required && (
                      <span className="text-[10px] text-destructive font-medium">Requerido</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <code className="text-[11px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {`{{${field.field_key}}}`}
                    </code>
                    <span className="text-[11px] text-muted-foreground">{typeInfo?.label}</span>
                    {options.length > 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        · {options.slice(0, 3).join(', ')}{options.length > 3 ? ` +${options.length - 3}` : ''}
                      </span>
                    )}
                  </div>
                </div>

                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleDelete(field.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Info */}
      <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground text-xs">¿Cómo usar los campos?</p>
        <p className="text-xs">En el composer de mensajes escribe <code className="font-mono text-primary">{'{{' }</code> para ver todos los campos disponibles y seleccionarlos.</p>
        <p className="text-xs">Los valores se guardan en el perfil del contacto y se reemplazan automáticamente al enviar.</p>
      </div>
    </div>
  )
}
