'use client'

import { useEffect, useRef, useState } from 'react'
import { useRealtimeMessages } from '@/hooks/use-realtime-messages'
import { useN8nMessages } from '@/hooks/use-n8n-messages'
import { useRealtimeContact } from '@/hooks/use-realtime-contact'
import { MessageBubble } from './message-bubble'
import { N8nMessageBubble } from './n8n-message-bubble'
import { Composer } from './composer'
import { WindowIndicator } from './window-indicator'
import { TakeControlButton } from './take-control-button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import type { ConversationWithContact, User } from '@/lib/types/database'
import { formatDate } from '@/lib/utils/date'
import { Bot, User as UserIcon, UserCheck, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSupabase } from '@/providers/supabase-provider'
import { useAuth } from '@/providers/auth-provider'
import { toast } from 'sonner'

interface ChatViewProps {
  conversation: ConversationWithContact
}

export function ChatView({ conversation }: ChatViewProps) {
  const contact = conversation.contact
  const waId = contact.wa_id ?? null
  // n8n_chat_histories is the primary source (full AI conversation including bot responses)
  const { messages: n8nMessages, loading: n8nLoading } = useN8nMessages(waId)
  // CRM messages table as fallback (contacts without wa_id or human-only messages)
  const { messages: crmMessages, loading: crmLoading, addOptimisticMessage } = useRealtimeMessages(conversation.id)
  const { contact: liveContact } = useRealtimeContact(contact.id)

  // Use n8n messages when contact has a wa_id, otherwise fall back to CRM messages
  const useN8n = Boolean(waId)
  const loading = useN8n ? n8nLoading : crmLoading
  const bottomRef = useRef<HTMLDivElement>(null)
  const [aiActive, setAiActive] = useState(conversation.ai_active)
  const [showAgentMenu, setShowAgentMenu] = useState(false)
  const [agents, setAgents] = useState<User[]>([])
  const [assignedAgent, setAssignedAgent] = useState(conversation.assigned_agent ?? null)
  const { supabase } = useSupabase()
  const { tenant } = useAuth()

  useEffect(() => {
    setAiActive(conversation.ai_active)
    setAssignedAgent(conversation.assigned_agent ?? null)
  }, [conversation.id, conversation.ai_active, conversation.assigned_agent])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [n8nMessages.length, crmMessages.length])

  async function loadAgents() {
    if (!tenant) return
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .in('role', ['owner', 'admin', 'agent'])
      .order('full_name')
    setAgents(data ?? [])
  }

  async function assignAgent(agent: User | null) {
    const { error } = await supabase
      .from('conversations')
      .update({ assigned_agent_id: agent?.id ?? null, updated_at: new Date().toISOString() })
      .eq('id', conversation.id)

    if (error) { toast.error('Error al asignar asesor'); return }
    setAssignedAgent(agent)
    setShowAgentMenu(false)
    toast.success(agent ? `Asignado a ${agent.full_name}` : 'Asesor removido')
  }

  // Group n8n messages by date
  type N8nGrouped = { date: string; entries: typeof n8nMessages }
  const n8nGrouped: N8nGrouped[] = []
  let n8nCurrentDate = ''
  for (const entry of n8nMessages) {
    const d = formatDate(entry.time_stamp)
    if (d !== n8nCurrentDate) {
      n8nCurrentDate = d
      n8nGrouped.push({ date: d, entries: [entry] })
    } else {
      n8nGrouped[n8nGrouped.length - 1].entries.push(entry)
    }
  }

  // Group CRM messages by date (fallback)
  const crmGrouped: { date: string; messages: typeof crmMessages }[] = []
  let crmCurrentDate = ''
  for (const msg of crmMessages) {
    const d = formatDate(msg.created_at)
    if (d !== crmCurrentDate) {
      crmCurrentDate = d
      crmGrouped.push({ date: d, messages: [msg] })
    } else {
      crmGrouped[crmGrouped.length - 1].messages.push(msg)
    }
  }

  const fullName = `${contact.first_name} ${contact.last_name ?? ''}`.trim()

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-background/80 backdrop-blur-md gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-semibold ring-1 ring-primary/25">
              {fullName.charAt(0).toUpperCase()}
            </div>
            <span className={cn(
              'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-1 ring-background',
              aiActive ? 'bg-emerald-400 status-online' : 'bg-blue-400'
            )} />
          </div>

          {/* Info */}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{fullName}</p>
            <p className="text-[11px] text-muted-foreground">{contact.phone}</p>
          </div>

          {/* AI/Human badge */}
          <span className={cn(
            'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0 border',
            aiActive
              ? 'bg-emerald-500/8 text-emerald-400 border-emerald-500/20'
              : 'bg-blue-500/8 text-blue-400 border-blue-500/20'
          )}>
            {aiActive ? <Bot className="h-2.5 w-2.5" /> : <UserIcon className="h-2.5 w-2.5" />}
            {aiActive ? 'IA' : 'Humano'}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <WindowIndicator lastIncomingAt={contact.last_incoming_at} />

          {/* Assign agent dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-7 text-xs border-border/60 hover:border-primary/40 bg-transparent cursor-pointer"
              onClick={() => { setShowAgentMenu(v => !v); if (!agents.length) loadAgents() }}
            >
              <UserCheck className="h-3.5 w-3.5" />
              {assignedAgent ? assignedAgent.full_name.split(' ')[0] : 'Asignar'}
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
            {showAgentMenu && (
              <div className="absolute right-0 top-9 z-50 w-52 bg-popover border border-border rounded-xl shadow-xl overflow-hidden animate-slide-up">
                <div className="py-1.5">
                  <button
                    onClick={() => assignAgent(null)}
                    className="w-full px-3 py-2 text-xs text-left hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
                  >
                    Sin asignar
                  </button>
                  <div className="my-1 h-px bg-border mx-2" />
                  {agents.map(a => (
                    <button
                      key={a.id}
                      onClick={() => assignAgent(a)}
                      className={cn(
                        'w-full px-3 py-2 text-xs text-left hover:bg-muted flex items-center gap-2 transition-colors cursor-pointer',
                        assignedAgent?.id === a.id && 'bg-primary/8 text-primary font-medium'
                      )}
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-semibold shrink-0">
                        {a.full_name.charAt(0)}
                      </span>
                      {a.full_name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <TakeControlButton
            conversationId={conversation.id}
            contactId={contact.id}
            aiActive={aiActive}
            onToggle={setAiActive}
          />
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 py-2 chat-bg">
        {loading ? (
          <div className="px-4 space-y-3 pt-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={cn('flex', i % 2 === 0 ? 'justify-start' : 'justify-end')}>
                <Skeleton className="h-10 w-48 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : useN8n ? (
          /* ── n8n conversation history (primary source) ── */
          <>
            {n8nGrouped.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full pt-16 text-center px-8">
                <Bot className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Sin mensajes aún</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Los mensajes de WhatsApp aparecerán aquí
                </p>
              </div>
            )}
            {n8nGrouped.map(({ date, entries }) => (
              <div key={date}>
                <div className="flex items-center justify-center my-4">
                  <span className="text-[10px] text-muted-foreground bg-muted/70 border border-border/50 px-3 py-0.5 rounded-full backdrop-blur-sm">
                    {date}
                  </span>
                </div>
                {entries.map(entry => (
                  <N8nMessageBubble key={entry.id} entry={entry} />
                ))}
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        ) : (
          /* ── CRM messages fallback (contacts without wa_id) ── */
          <>
            {crmGrouped.map(({ date, messages: dayMsgs }) => (
              <div key={date}>
                <div className="flex items-center justify-center my-4">
                  <span className="text-[10px] text-muted-foreground bg-muted/70 border border-border/50 px-3 py-0.5 rounded-full backdrop-blur-sm">
                    {date}
                  </span>
                </div>
                {dayMsgs.map(msg => <MessageBubble key={msg.id} message={msg} />)}
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </ScrollArea>

      <Composer
        conversationId={conversation.id}
        contactId={contact.id}
        waId={contact.wa_id ?? contact.phone?.replace(/\D/g, '') ?? ''}
        lastIncomingAt={contact.last_incoming_at}
        contact={liveContact ?? contact}
        onOptimisticMessage={(content) => addOptimisticMessage({
          content,
          conversation_id: conversation.id,
          contact_id: contact.id,
        })}
      />
    </div>
  )
}
