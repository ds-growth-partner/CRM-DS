'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Papa from 'papaparse'
import { useSupabase } from '@/providers/supabase-provider'
import { useAuth } from '@/hooks/use-auth'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  Upload,
  FileSpreadsheet,
  ChevronRight,
  X,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

type ContactField =
  | 'first_name'
  | 'last_name'
  | 'full_name'
  | 'phone'
  | 'email'
  | 'company'
  | 'job_title'
  | 'city'
  | 'country'
  | 'wa_id'
  | 'notes'
  | 'skip'

type Tag = { id: string; name: string; color: string }
type ParsedData = { headers: string[]; rows: Record<string, string>[] }
type ImportProgress = {
  total: number
  current: number
  created: number
  updated: number
  failed: number
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported?: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTACT_FIELDS: { value: ContactField; label: string }[] = [
  { value: 'first_name', label: 'Nombre' },
  { value: 'last_name', label: 'Apellido' },
  { value: 'full_name', label: 'Nombre completo' },
  { value: 'phone', label: 'Teléfono' },
  { value: 'email', label: 'Email' },
  { value: 'company', label: 'Empresa' },
  { value: 'job_title', label: 'Cargo' },
  { value: 'city', label: 'Ciudad' },
  { value: 'country', label: 'País' },
  { value: 'wa_id', label: 'WhatsApp ID' },
  { value: 'notes', label: 'Notas' },
  { value: 'skip', label: '— Ignorar columna —' },
]

const TAG_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#94a3b8',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeHeader(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\-_.]+/g, '_')
}

function autoDetect(header: string): ContactField {
  const h = normalizeHeader(header)
  const MAP: Record<string, ContactField> = {
    nombre: 'first_name',
    name: 'first_name',
    first_name: 'first_name',
    firstname: 'first_name',
    primer_nombre: 'first_name',
    apellido: 'last_name',
    last_name: 'last_name',
    lastname: 'last_name',
    segundo_nombre: 'last_name',
    surname: 'last_name',
    nombre_completo: 'full_name',
    full_name: 'full_name',
    fullname: 'full_name',
    nombre_y_apellido: 'full_name',
    telefono: 'phone',
    phone: 'phone',
    celular: 'phone',
    movil: 'phone',
    tel: 'phone',
    mobile: 'phone',
    numero: 'phone',
    numero_celular: 'phone',
    email: 'email',
    correo: 'email',
    mail: 'email',
    correo_electronico: 'email',
    empresa: 'company',
    company: 'company',
    negocio: 'company',
    razon_social: 'company',
    organization: 'company',
    organizacion: 'company',
    cargo: 'job_title',
    job_title: 'job_title',
    jobtitle: 'job_title',
    puesto: 'job_title',
    rol: 'job_title',
    role: 'job_title',
    position: 'job_title',
    ciudad: 'city',
    city: 'city',
    pais: 'country',
    country: 'country',
    whatsapp: 'wa_id',
    wa_id: 'wa_id',
    waid: 'wa_id',
    whatsapp_id: 'wa_id',
    notas: 'notes',
    notes: 'notes',
    observaciones: 'notes',
    comentarios: 'notes',
    comments: 'notes',
  }
  return MAP[h] ?? 'skip'
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ImportContactsDialog({ open, onOpenChange, onImported }: Props) {
  const { supabase } = useSupabase()
  const { tenant } = useAuth()

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<ParsedData | null>(null)
  const [mapping, setMapping] = useState<Record<string, ContactField>>({})
  const [existingTags, setExistingTags] = useState<Tag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [tagSearch, setTagSearch] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0])
  const [creatingTag, setCreatingTag] = useState(false)
  const [progress, setProgress] = useState<ImportProgress>({
    total: 0, current: 0, created: 0, updated: 0, failed: 0,
  })
  const fileRef = useRef<HTMLInputElement>(null)

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep(1)
        setFileName('')
        setParsed(null)
        setMapping({})
        setSelectedTagIds([])
        setTagSearch('')
        setNewTagName('')
        setNewTagColor(TAG_COLORS[0])
        setProgress({ total: 0, current: 0, created: 0, updated: 0, failed: 0 })
      }, 300)
      return () => clearTimeout(t)
    }
  }, [open])

  // Load tags when reaching step 3
  useEffect(() => {
    if (step === 3) {
      supabase.from('tags').select('*').order('name').then(({ data }) => {
        setExistingTags(data ?? [])
      })
    }
  }, [step, supabase])

  // ── File processing ──────────────────────────────────────────────────────

  const processFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Solo se aceptan archivos .csv')
      return
    }
    setFileName(file.name)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const headers = (result.meta.fields ?? []) as string[]
        const rows = result.data as Record<string, string>[]
        if (headers.length === 0 || rows.length === 0) {
          toast.error('El archivo no contiene datos válidos')
          return
        }
        const initialMapping: Record<string, ContactField> = {}
        headers.forEach(h => { initialMapping[h] = autoDetect(h) })
        setParsed({ headers, rows })
        setMapping(initialMapping)
        setStep(2)
      },
      error: () => toast.error('Error al leer el archivo CSV'),
    })
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  // ── Tag actions ──────────────────────────────────────────────────────────

  async function handleCreateTag() {
    if (!newTagName.trim() || !tenant) return
    setCreatingTag(true)
    const { data, error } = await supabase
      .from('tags')
      .insert({ tenant_id: tenant.id, name: newTagName.trim(), color: newTagColor })
      .select()
      .single()
    setCreatingTag(false)
    if (error) {
      toast.error('Error al crear etiqueta')
      return
    }
    setExistingTags(prev => [...prev, data as Tag].sort((a, b) => a.name.localeCompare(b.name)))
    setSelectedTagIds(prev => [...prev, (data as Tag).id])
    setNewTagName('')
    toast.success(`Etiqueta "${(data as Tag).name}" creada`)
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds(ids =>
      ids.includes(tagId) ? ids.filter(id => id !== tagId) : [...ids, tagId]
    )
  }

  // ── Import logic ─────────────────────────────────────────────────────────

  async function runImport() {
    if (!tenant || !parsed) return
    setStep(4)
    const tenantId = tenant.id

    // Build clean rows from mapping
    const rows = parsed.rows
      .map(row => {
        const contact: Record<string, string> = {}
        for (const [csvHeader, field] of Object.entries(mapping)) {
          if (field === 'skip') continue
          const val = (row[csvHeader] ?? '').trim()
          if (!val) continue
          if (field === 'full_name') {
            const parts = val.split(/\s+/)
            contact.first_name = parts[0]
            if (parts.length > 1) contact.last_name = parts.slice(1).join(' ')
          } else {
            contact[field] = val
          }
        }
        return contact
      })
      .filter(r => Boolean(r.first_name))

    const total = rows.length
    setProgress({ total, current: 0, created: 0, updated: 0, failed: 0 })

    // Las columnas de perfil del CSV se mapean a field_key de contact_field_values;
    // wa_id/notes/job_title/country siguen siendo columnas de contacts.
    const FIELD_MAP: Record<string, string> = {
      first_name: 'nombre', last_name: 'apellido', phone: 'telefono',
      email: 'email', company: 'empresa', city: 'ciudad',
    }
    const SYSTEM_KEYS = new Set(['wa_id', 'notes', 'job_title', 'country'])
    function split(row: Record<string, string>) {
      const sys: Record<string, string> = {}
      const fields: Record<string, string> = {}
      for (const [k, v] of Object.entries(row)) {
        if (FIELD_MAP[k]) fields[FIELD_MAP[k]] = v
        else if (SYSTEM_KEYS.has(k)) sys[k] = v
      }
      return { sys, fields }
    }

    // Detecta duplicados por teléfono/email buscando en contact_field_values
    const phones = [...new Set(rows.map(r => r.phone).filter(Boolean))]
    const emails = [...new Set(rows.map(r => r.email).filter(Boolean))]

    const [phoneRes, emailRes] = await Promise.all([
      phones.length
        ? supabase.from('contact_field_values').select('contact_id, value').eq('tenant_id', tenantId).eq('field_key', 'telefono').in('value', phones)
        : Promise.resolve({ data: [] as { contact_id: string; value: string }[] }),
      emails.length
        ? supabase.from('contact_field_values').select('contact_id, value').eq('tenant_id', tenantId).eq('field_key', 'email').in('value', emails)
        : Promise.resolve({ data: [] as { contact_id: string; value: string }[] }),
    ])

    const phoneMap = new Map((phoneRes.data ?? []).map((c: { contact_id: string; value: string }) => [c.value, c.contact_id]))
    const emailMap = new Map((emailRes.data ?? []).map((c: { contact_id: string; value: string }) => [c.value, c.contact_id]))

    let created = 0
    let updated = 0
    let failed = 0
    const affectedIds: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        const existingId =
          (row.phone && phoneMap.get(row.phone)) ||
          (row.email && emailMap.get(row.email)) ||
          null
        const { sys, fields } = split(row)

        let cid: string
        if (existingId) {
          if (Object.keys(sys).length) {
            const { error } = await supabase.from('contacts').update(sys).eq('id', existingId)
            if (error) throw error
          }
          cid = existingId
          updated++
        } else {
          const { data, error } = await supabase
            .from('contacts')
            .insert({ ...sys, tenant_id: tenantId, source: 'csv' })
            .select('id')
            .single()
          if (error) throw error
          cid = (data as { id: string }).id
          created++
        }

        // Guarda los valores de campo (nunca pisa con vacío: solo van los presentes)
        const fvRows = Object.entries(fields).map(([field_key, value]) => ({
          contact_id: cid, tenant_id: tenantId, field_key, value,
        }))
        if (fvRows.length) {
          const { error } = await supabase
            .from('contact_field_values')
            .upsert(fvRows, { onConflict: 'contact_id,field_key' })
          if (error) throw error
        }
        affectedIds.push(cid)
      } catch (e) {
        console.error('Import row error:', e)
        failed++
      }

      setProgress({ total, current: i + 1, created, updated, failed })
    }

    // Apply tags to all affected contacts
    if (selectedTagIds.length > 0 && affectedIds.length > 0) {
      const tagRows = affectedIds.flatMap(contactId =>
        selectedTagIds.map(tagId => ({ contact_id: contactId, tag_id: tagId }))
      )
      await supabase
        .from('contact_tags')
        .upsert(tagRows, { onConflict: 'contact_id,tag_id', ignoreDuplicates: true })
    }

    setStep(5)
    onImported?.()
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const hasNameColumn = Object.values(mapping).some(
    f => f === 'first_name' || f === 'full_name'
  )
  const filteredTags = existingTags.filter(
    t => t.name.toLowerCase().includes(tagSearch.toLowerCase())
  )
  const selectedTags = existingTags.filter(t => selectedTagIds.includes(t.id))
  const progressPct = progress.total > 0 ? (progress.current / progress.total) * 100 : 0

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-full bg-background/95 backdrop-blur-xl border-border/60 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            Importar contactos desde CSV
          </DialogTitle>

          {/* Step progress bar */}
          {step <= 3 && (
            <div className="flex items-center gap-1.5 pt-1">
              {[1, 2, 3].map(s => (
                <div
                  key={s}
                  className={cn(
                    'h-1 rounded-full transition-all duration-300',
                    step > s
                      ? 'bg-primary w-10'
                      : step === s
                      ? 'bg-primary w-14'
                      : 'bg-muted w-6'
                  )}
                />
              ))}
              <span className="text-[11px] text-muted-foreground ml-1">
                Paso {step} de 3
              </span>
            </div>
          )}
        </DialogHeader>

        {/* ── STEP 1: Upload ─────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="py-4 space-y-4">
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200',
                dragOver
                  ? 'border-primary bg-primary/5 scale-[1.01]'
                  : 'border-border hover:border-primary/50 hover:bg-muted/20'
              )}
            >
              <Upload
                className={cn(
                  'h-8 w-8 mx-auto mb-3 transition-colors',
                  dragOver ? 'text-primary' : 'text-muted-foreground'
                )}
              />
              <p className="text-sm font-medium">
                {dragOver ? 'Suelta el archivo aquí' : 'Arrastra tu archivo CSV aquí'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                o haz clic para seleccionar
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
            <div className="rounded-xl bg-muted/20 border border-border/50 p-3">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground/70">Columnas recomendadas: </span>
                nombre, apellido, teléfono, email, empresa, cargo, ciudad
                <br />
                La primera fila debe contener los encabezados. Se detectan automáticamente en español e inglés.
              </p>
            </div>
          </div>
        )}

        {/* ── STEP 2: Column mapping + preview ──────────────────────────── */}
        {step === 2 && parsed && (
          <div className="py-2 space-y-4 min-w-0">
            {/* Header info */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{parsed.rows.length}</span> filas
                en{' '}
                <span className="font-semibold text-foreground">{fileName}</span>
              </p>
              {!hasNameColumn && (
                <div className="flex items-center gap-1.5 text-xs text-amber-400 shrink-0">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Mapea &quot;Nombre&quot; o &quot;Nombre completo&quot;
                </div>
              )}
            </div>

            {/* Mapping table */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="grid grid-cols-[minmax(0,1fr)_24px_minmax(180px,1fr)] text-[11px] font-medium text-muted-foreground bg-muted/40 px-4 py-2 gap-3">
                <span>Columna CSV</span>
                <span />
                <span>Campo del CRM</span>
              </div>
              <div className="divide-y divide-border max-h-48 overflow-y-auto">
                {parsed.headers.map(header => (
                  <div
                    key={header}
                    className="grid grid-cols-[minmax(0,1fr)_24px_minmax(180px,1fr)] items-center gap-3 px-4 py-2"
                  >
                    <span className="text-xs font-mono text-foreground/80 truncate min-w-0">
                      {header}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground justify-self-center shrink-0" />
                    <Select
                      value={mapping[header] ?? 'skip'}
                      onValueChange={v =>
                        setMapping(m => ({ ...m, [header]: v as ContactField }))
                      }
                    >
                      <SelectTrigger className="h-7 text-xs w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTACT_FIELDS.map(f => (
                          <SelectItem key={f.value} value={f.value} className="text-xs">
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
                Vista previa — primeras 3 filas
              </p>
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="bg-muted/40">
                        {parsed.headers
                          .filter(h => mapping[h] !== 'skip')
                          .map(h => (
                            <th
                              key={h}
                              className="text-left px-3 py-1.5 font-medium text-muted-foreground whitespace-nowrap"
                            >
                              {CONTACT_FIELDS.find(f => f.value === mapping[h])?.label ?? h}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {parsed.rows.slice(0, 3).map((row, i) => (
                        <tr key={i} className="hover:bg-muted/20">
                          {parsed.headers
                            .filter(h => mapping[h] !== 'skip')
                            .map(h => (
                              <td
                                key={h}
                                className="px-3 py-1.5 text-foreground/80 max-w-[120px] truncate"
                              >
                                {row[h] || (
                                  <span className="text-muted-foreground/50">—</span>
                                )}
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-1">
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                Atrás
              </Button>
              <Button size="sm" disabled={!hasNameColumn} onClick={() => setStep(3)}>
                Continuar
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Tags ───────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="py-2 space-y-4">
            <div>
              <p className="text-sm font-medium">Etiquetas para los contactos importados</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Se aplicarán a los{' '}
                <span className="font-medium text-foreground">{parsed?.rows.length}</span>{' '}
                contactos. Opcional — puedes saltar este paso.
              </p>
            </div>

            {/* Selected tags */}
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedTags.map(t => (
                  <Badge
                    key={t.id}
                    variant="outline"
                    className="gap-1.5 pr-1.5 cursor-pointer select-none"
                    style={{ borderColor: t.color, color: t.color }}
                    onClick={() => toggleTag(t.id)}
                  >
                    {t.name}
                    <X className="h-3 w-3" />
                  </Badge>
                ))}
              </div>
            )}

            {/* Search + existing tags */}
            <div className="space-y-2">
              <Input
                placeholder="Buscar etiqueta existente..."
                value={tagSearch}
                onChange={e => setTagSearch(e.target.value)}
                className="h-8 text-sm"
              />
              <div className="min-h-[40px] max-h-28 overflow-y-auto flex flex-wrap gap-1.5 content-start">
                {filteredTags
                  .filter(t => !selectedTagIds.includes(t.id))
                  .map(t => (
                    <Badge
                      key={t.id}
                      variant="outline"
                      className="cursor-pointer hover:opacity-80 transition-opacity select-none"
                      style={{ borderColor: t.color, color: t.color }}
                      onClick={() => toggleTag(t.id)}
                    >
                      {t.name}
                    </Badge>
                  ))}
                {filteredTags.filter(t => !selectedTagIds.includes(t.id)).length === 0 &&
                  !tagSearch && (
                    <p className="text-xs text-muted-foreground py-1">
                      No hay etiquetas disponibles
                    </p>
                  )}
                {filteredTags.filter(t => !selectedTagIds.includes(t.id)).length === 0 &&
                  tagSearch && (
                    <p className="text-xs text-muted-foreground py-1">
                      Sin resultados para &quot;{tagSearch}&quot;
                    </p>
                  )}
              </div>
            </div>

            {/* Create new tag */}
            <div className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-2.5">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Crear nueva etiqueta
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Nombre de la etiqueta"
                  value={newTagName}
                  onChange={e => setNewTagName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateTag()}
                  className="h-8 text-sm flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!newTagName.trim() || creatingTag}
                  onClick={handleCreateTag}
                  className="h-8 shrink-0 min-w-[60px]"
                >
                  {creatingTag ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    'Crear'
                  )}
                </Button>
              </div>
              {/* Color picker */}
              <div className="flex gap-2 flex-wrap items-center">
                <span className="text-[11px] text-muted-foreground">Color:</span>
                {TAG_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewTagColor(c)}
                    className={cn(
                      'h-5 w-5 rounded-full border-2 transition-all duration-150',
                      newTagColor === c
                        ? 'border-white scale-125 shadow-sm'
                        : 'border-transparent hover:scale-110'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
                {/* Preview */}
                {newTagName && (
                  <Badge
                    variant="outline"
                    className="ml-1 text-[11px] pointer-events-none"
                    style={{ borderColor: newTagColor, color: newTagColor }}
                  >
                    {newTagName}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex justify-between pt-1">
              <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                Atrás
              </Button>
              <Button size="sm" onClick={runImport}>
                Importar {parsed?.rows.length} contactos
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Progress ───────────────────────────────────────────── */}
        {step === 4 && (
          <div className="py-8 space-y-6">
            <div className="text-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm font-medium">Importando contactos...</p>
              <p className="text-xs text-muted-foreground">
                {progress.current} de {progress.total} procesados
              </p>
            </div>

            <Progress value={progressPct} className="h-2" />

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-muted/30 border border-border/40 p-3">
                <p className="text-2xl font-bold text-emerald-500">{progress.created}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Creados</p>
              </div>
              <div className="rounded-xl bg-muted/30 border border-border/40 p-3">
                <p className="text-2xl font-bold text-blue-400">{progress.updated}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Actualizados</p>
              </div>
              <div className="rounded-xl bg-muted/30 border border-border/40 p-3">
                <p className="text-2xl font-bold text-red-400">{progress.failed}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Fallidos</p>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 5: Done ───────────────────────────────────────────────── */}
        {step === 5 && (
          <div className="py-8 space-y-6 text-center">
            <div className="space-y-2">
              <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500" />
              <p className="text-base font-semibold">¡Importación completada!</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-muted/30 border border-border/40 p-4">
                <p className="text-3xl font-bold text-emerald-500">{progress.created}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Nuevos</p>
              </div>
              <div className="rounded-xl bg-muted/30 border border-border/40 p-4">
                <p className="text-3xl font-bold text-blue-400">{progress.updated}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Actualizados</p>
              </div>
              <div className="rounded-xl bg-muted/30 border border-border/40 p-4">
                <p className="text-3xl font-bold text-red-400">{progress.failed}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Fallidos</p>
              </div>
            </div>

            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-center">
                <span className="text-xs text-muted-foreground self-center">
                  Etiquetas aplicadas:
                </span>
                {selectedTags.map(t => (
                  <Badge
                    key={t.id}
                    variant="outline"
                    className="text-xs pointer-events-none"
                    style={{ borderColor: t.color, color: t.color }}
                  >
                    {t.name}
                  </Badge>
                ))}
              </div>
            )}

            <Button onClick={() => onOpenChange(false)} className="w-full">
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
