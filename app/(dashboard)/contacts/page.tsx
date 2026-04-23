'use client'

import { useState } from 'react'
import { useContacts } from '@/hooks/use-contacts'
import { ContactsTable } from '@/components/contacts/contacts-table'
import { ContactsKanban } from '@/components/contacts/contacts-kanban'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSupabase } from '@/providers/supabase-provider'
import { useEffect } from 'react'
import type { FunnelStage } from '@/lib/types/database'
import { LayoutGrid, Table2, Search, Download, Upload, Plus } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebounce } from '@/hooks/use-debounce'
import { toast } from 'sonner'

export default function ContactsPage() {
  const [view, setView] = useState<'table' | 'kanban'>('table')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const { contacts, loading, total } = useContacts({ search: debouncedSearch })
  const { supabase } = useSupabase()
  const [stages, setStages] = useState<FunnelStage[]>([])

  useEffect(() => {
    supabase.from('funnel_stages').select('*').order('position').then(({ data }) => {
      setStages(data ?? [])
    })
  }, [supabase])

  function handleExportCSV() {
    const headers = ['Nombre', 'Teléfono', 'Email', 'Empresa', 'Ciudad', 'Lead Score', 'Fuente', 'Creado']
    const rows = contacts.map(c => [
      `${c.first_name} ${c.last_name ?? ''}`.trim(),
      c.phone ?? '',
      c.email ?? '',
      c.company ?? '',
      c.city ?? '',
      c.lead_score,
      c.source,
      c.created_at.split('T')[0],
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contactos-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${contacts.length} contactos exportados`)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="flex items-center gap-3 px-6 py-3.5 border-b border-border bg-background/80 backdrop-blur-md">
        <div>
          <h1 className="text-base font-semibold text-foreground leading-tight">Contactos</h1>
          <p className="text-[11px] text-muted-foreground">{total} contacto{total !== 1 ? 's' : ''}</p>
        </div>

        <div className="relative ml-4 flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, teléfono, email..."
            className="pl-9 h-8 text-sm bg-muted/40 border-transparent focus:border-primary/40 transition-colors"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border border-border rounded-lg overflow-hidden">
            <Button
              variant={view === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-none h-8 px-2.5 cursor-pointer"
              onClick={() => setView('table')}
            >
              <Table2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={view === 'kanban' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-none h-8 px-2.5 cursor-pointer"
              onClick={() => setView('kanban')}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Button variant="outline" size="sm" className="h-8 text-xs cursor-pointer" onClick={handleExportCSV}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Exportar
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" disabled title="Próximamente">
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Importar
          </Button>
          <Button size="sm" className="h-8 text-xs" disabled title="Próximamente">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Nuevo contacto
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-xl" />)}
          </div>
        ) : view === 'table' ? (
          <div className="overflow-auto h-full">
            <ContactsTable contacts={contacts} loading={loading} />
          </div>
        ) : (
          <div className="p-4 overflow-auto h-full">
            <ContactsKanban contacts={contacts as any} stages={stages} />
          </div>
        )}
      </div>
    </div>
  )
}
