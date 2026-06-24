'use client'

import { useRealtimeAIActions } from '@/hooks/use-realtime-ai-actions'
import { aiActionText } from '@/lib/utils/ai-actions'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Brain, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { timeAgo } from '@/lib/utils/date'
import type { AIAction } from '@/lib/types/database'

interface AIMindPanelProps {
  contactId: string
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  extract_email: '📧',
  extract_phone: '📞',
  schedule_appointment: '📅',
  qualify_lead: '⭐',
  change_stage: '🔄',
  send_response: '💬',
  add_tag: '🏷️',
  update_score: '📊',
}

function ActionItem({ action }: { action: AIAction }) {
  const icon = ACTION_ICONS[action.action_type] ?? '🤖'
  const text = aiActionText(action) || action.summary

  return (
    <div className="flex gap-2.5 py-2.5 border-b border-border/50 last:border-0">
      <span className="text-base shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <p className="text-xs font-medium text-foreground leading-snug">{text}</p>
          {action.status === 'success' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />}
          {action.status === 'failure' && <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />}
          {action.status === 'pending' && <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />}
        </div>
        {action.reasoning && (
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{action.reasoning}</p>
        )}
        {action.stage_before && action.stage_after && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {action.stage_before} → {action.stage_after}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(action.created_at)}</p>
      </div>
    </div>
  )
}

export function AIMindPanel({ contactId }: AIMindPanelProps) {
  const { actions, loading } = useRealtimeAIActions(contactId)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <Brain className="h-4 w-4 text-purple-500" />
        <span className="text-xs font-semibold text-foreground">Mente de la IA</span>
        <span className="ml-auto text-xs text-muted-foreground">{actions.length} acciones</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-3">
          {loading ? (
            <div className="space-y-3 py-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-3 w-3/5" />
                </div>
              ))}
            </div>
          ) : actions.length === 0 ? (
            <div className="py-6 text-center">
              <Brain className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Sin acciones de IA todavía</p>
            </div>
          ) : (
            actions.map(action => <ActionItem key={action.id} action={action} />)
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
