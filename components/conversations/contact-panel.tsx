'use client'

import { useRealtimeContact } from '@/hooks/use-realtime-contact'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { TagBadge } from '@/components/shared/tag-badge'
import { FunnelBadge } from '@/components/shared/funnel-badge'
import { LeadScoreBar } from '@/components/shared/lead-score-bar'
import { AIMindPanel } from './ai-mind-panel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Phone, Mail, Building2, MapPin, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils/date'

interface ContactPanelProps {
  contactId: string
  conversationId: string
}

function InfoRow({ icon: Icon, label, value, copyable }: {
  icon: React.ElementType
  label: string
  value?: string | null
  copyable?: boolean
}) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2 py-1.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className="flex items-center gap-1">
          <p className="text-xs text-foreground truncate">{value}</p>
          {copyable && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(value)
                toast.success('Copiado')
              }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Copy className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function ContactPanel({ contactId, conversationId }: ContactPanelProps) {
  const { contact, loading } = useRealtimeContact(contactId)

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
      </div>
    )
  }

  if (!contact) return null

  const fullName = `${contact.first_name} ${contact.last_name ?? ''}`.trim()

  return (
    <div className="flex flex-col h-full w-72 border-l border-border">
      <Tabs defaultValue="contact" className="flex flex-col h-full">
        <TabsList className="mx-3 mt-3 grid grid-cols-2">
          <TabsTrigger value="contact" className="text-xs">Contacto</TabsTrigger>
          <TabsTrigger value="ai" className="text-xs">Mente IA</TabsTrigger>
        </TabsList>

        <TabsContent value="contact" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-4">
              {/* Name + Avatar */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">
                  {fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold">{fullName}</p>
                  {contact.company && (
                    <p className="text-xs text-muted-foreground">{contact.company}</p>
                  )}
                </div>
              </div>

              {/* Funnel Stage + Score */}
              <div className="space-y-2">
                <FunnelBadge stage={contact.funnel_stage} />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Lead Score</p>
                  <LeadScoreBar score={contact.lead_score} />
                </div>
              </div>

              {/* Info */}
              <div className="space-y-0.5 border-t border-border pt-3">
                <InfoRow icon={Phone} label="Teléfono" value={contact.phone} copyable />
                <InfoRow icon={Mail} label="Email" value={contact.email} copyable />
                <InfoRow icon={Building2} label="Empresa" value={contact.company} />
                <InfoRow icon={MapPin} label="Ciudad" value={contact.city} />
              </div>

              {/* Tags */}
              {contact.tags && contact.tags.length > 0 && (
                <div className="border-t border-border pt-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Etiquetas</p>
                  <div className="flex flex-wrap gap-1">
                    {contact.tags.map(tag => <TagBadge key={tag.id} tag={tag} />)}
                  </div>
                </div>
              )}

              {/* Meta */}
              <div className="border-t border-border pt-3 space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Origen</p>
                <span className="text-xs bg-muted rounded px-1.5 py-0.5 text-muted-foreground capitalize">
                  {contact.source}
                </span>
                {contact.created_at && (
                  <p className="text-[10px] text-muted-foreground">
                    Creado: {formatDate(contact.created_at)}
                  </p>
                )}
              </div>

              {/* Notes */}
              {contact.notes && (
                <div className="border-t border-border pt-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Notas</p>
                  <p className="text-xs text-foreground leading-relaxed">{contact.notes}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="ai" className="flex-1 overflow-hidden mt-0">
          <AIMindPanel conversationId={conversationId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
