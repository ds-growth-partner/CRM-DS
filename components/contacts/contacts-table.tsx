'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ContactWithDetails } from '@/lib/types/database'
import { TagBadge } from '@/components/shared/tag-badge'
import { FunnelBadge } from '@/components/shared/funnel-badge'
import { LeadScoreBar } from '@/components/shared/lead-score-bar'
import { formatDate } from '@/lib/utils/date'
import { formatPhone } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Bot,
  User,
  ExternalLink,
  CheckSquare,
  Square,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ContactsTableProps {
  contacts: ContactWithDetails[]
  loading: boolean
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onSelectAll: () => void
  onClearAll: () => void
}

type SortKey = 'full_name' | 'lead_score' | 'created_at' | 'last_contacted_at'
type SortDir = 'asc' | 'desc'

export function ContactsTable({ contacts, loading, selectedIds, onToggle, onSelectAll, onClearAll }: ContactsTableProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'created_at', dir: 'desc' })

  function toggleSort(key: SortKey) {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })
  }

  const sorted = [...contacts].sort((a, b) => {
    let av: string | number = ''
    let bv: string | number = ''
    if (sort.key === 'full_name') {
      av = `${a.first_name} ${a.last_name ?? ''}`.toLowerCase()
      bv = `${b.first_name} ${b.last_name ?? ''}`.toLowerCase()
    } else if (sort.key === 'lead_score') {
      av = a.lead_score; bv = b.lead_score
    } else {
      av = a[sort.key] ?? ''; bv = b[sort.key] ?? ''
    }
    const r = av < bv ? -1 : av > bv ? 1 : 0
    return sort.dir === 'asc' ? r : -r
  })

  function SortIcon({ k }: { k: SortKey }) {
    if (sort.key !== k) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 text-muted-foreground/50" />
    return sort.dir === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5 ml-1 text-primary" />
      : <ArrowDown className="h-3.5 w-3.5 ml-1 text-primary" />
  }

  const allSelected = sorted.length > 0 && sorted.every(c => selectedIds.has(c.id))
  const someSelected = sorted.some(c => selectedIds.has(c.id))

  function handleToggleAll() {
    if (allSelected) {
      onClearAll()
    } else {
      onSelectAll()
    }
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider bg-muted/20">
            {/* Checkbox header */}
            <th className="px-4 py-3.5 w-10">
              <button
                onClick={handleToggleAll}
                className="flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
              >
                {allSelected
                  ? <CheckSquare className="h-4 w-4 text-primary" />
                  : someSelected
                    ? <CheckSquare className="h-4 w-4 text-primary/50" />
                    : <Square className="h-4 w-4" />
                }
              </button>
            </th>
            <th className="text-left font-medium px-3 py-3.5 min-w-[180px]">
              <button onClick={() => toggleSort('full_name')} className="flex items-center hover:text-foreground">
                Nombre <SortIcon k="full_name" />
              </button>
            </th>
            <th className="text-left font-medium px-3 py-3.5 min-w-[140px]">Teléfono</th>
            <th className="text-left font-medium px-3 py-3.5 min-w-[160px]">Email</th>
            <th className="text-left font-medium px-3 py-3.5 min-w-[140px]">Empresa</th>
            <th className="text-left font-medium px-3 py-3.5 min-w-[140px]">Fase</th>
            <th className="text-left font-medium px-3 py-3.5 min-w-[120px]">
              <button onClick={() => toggleSort('lead_score')} className="flex items-center hover:text-foreground">
                Score <SortIcon k="lead_score" />
              </button>
            </th>
            <th className="text-left font-medium px-3 py-3.5 min-w-[140px]">Etiquetas</th>
            <th className="text-left font-medium px-3 py-3.5 min-w-[80px]">IA</th>
            <th className="text-left font-medium px-3 py-3.5 min-w-[120px]">
              <button onClick={() => toggleSort('created_at')} className="flex items-center hover:text-foreground">
                Creado <SortIcon k="created_at" />
              </button>
            </th>
            <th className="px-3 py-3.5 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(contact => {
            const fullName = `${contact.first_name} ${contact.last_name ?? ''}`.trim()
            const tags = (contact as ContactWithDetails & { tags?: { id: string; name: string; color: string }[] }).tags ?? []
            const isSelected = selectedIds.has(contact.id)
            return (
              <tr
                key={contact.id}
                className={cn(
                  'border-b border-border/50 hover:bg-muted/30 transition-colors',
                  isSelected && 'bg-primary/5 border-primary/20'
                )}
              >
                {/* Checkbox */}
                <td className="px-4 py-3.5">
                  <button
                    onClick={() => onToggle(contact.id)}
                    className="flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                  >
                    {isSelected
                      ? <CheckSquare className="h-4 w-4 text-primary" />
                      : <Square className="h-4 w-4" />
                    }
                  </button>
                </td>
                <td className="px-3 py-4">
                  <Link href={`/contacts/${contact.id}`} className="font-semibold text-foreground hover:text-primary transition-colors">
                    {fullName}
                  </Link>
                </td>
                <td className="px-3 py-4 text-muted-foreground">{formatPhone(contact.phone)}</td>
                <td className="px-3 py-4 text-muted-foreground truncate max-w-[160px]">{contact.email ?? '—'}</td>
                <td className="px-3 py-4 text-muted-foreground">{contact.company ?? '—'}</td>
                <td className="px-3 py-4">
                  <FunnelBadge stage={contact.funnel_stage} />
                </td>
                <td className="px-3 py-4 min-w-[120px]">
                  <LeadScoreBar score={contact.lead_score} />
                </td>
                <td className="px-3 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {tags.slice(0, 2).map(tag => <TagBadge key={tag.id} tag={tag} />)}
                    {tags.length > 2 && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">+{tags.length - 2}</span>}
                  </div>
                </td>
                <td className="px-3 py-4">
                  {contact.ai_active
                    ? <Bot className="h-4 w-4 text-emerald-500" />
                    : <User className="h-4 w-4 text-blue-500" />
                  }
                </td>
                <td className="px-3 py-4 text-muted-foreground text-xs">{formatDate(contact.created_at)}</td>
                <td className="px-3 py-4">
                  <Link href={`/contacts/${contact.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {sorted.length === 0 && !loading && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No hay contactos que mostrar
        </div>
      )}
    </div>
  )
}
