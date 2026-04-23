import { cn } from '@/lib/utils'
import type { N8nChatHistory, N8nMessage } from '@/lib/types/database'
import { Bot, User, Search } from 'lucide-react'

interface N8nMessageBubbleProps {
  entry: N8nChatHistory
}

/**
 * Parses the n8n JSONB message field.
 * Handles two formats:
 *   1. { type, content, tool_calls?, ... }   ← standard LangChain format
 *   2. { type, data: { content }, ... }       ← proactive/follow-up messages
 */
function parseMessage(msg: N8nMessage): {
  type: 'human' | 'ai' | 'tool'
  content: string
  isToolCall: boolean
  toolName?: string
  isAgent: boolean
} {
  const type = msg.type ?? 'ai'

  // Extract content from either format
  let content: string
  if (msg.data?.content) {
    content = msg.data.content
  } else {
    content = msg.content ?? ''
  }

  // Detect AI messages that are just internal tool invocations (not user-facing)
  const isToolCall =
    type === 'ai' &&
    Array.isArray(msg.tool_calls) &&
    msg.tool_calls.length > 0

  // Check if sent by a human agent from the CRM
  const isAgent = msg.additional_kwargs?.sender === 'agent' || msg.data?.additional_kwargs?.sender === 'agent'

  return {
    type: type as 'human' | 'ai' | 'tool',
    content: content.trim(),
    isToolCall,
    toolName: isToolCall ? msg.tool_calls![0]?.name : undefined,
    isAgent,
  }
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function N8nMessageBubble({ entry }: N8nMessageBubbleProps) {
  const { type, content, isToolCall, toolName, isAgent } = parseMessage(entry.message)

  // Skip tool result messages (raw knowledge base data — internal only)
  if (type === 'tool') return null

  // AI message that is a tool call invocation → show compact system indicator
  if (isToolCall) {
    return (
      <div className="flex justify-center mb-1 px-4">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 bg-muted/40 rounded-full px-3 py-1 border border-border/30">
          <Search className="h-2.5 w-2.5 shrink-0" />
          <span>Consultando base de conocimiento{toolName ? ` (${toolName})` : ''}…</span>
        </div>
      </div>
    )
  }

  // Skip empty content
  if (!content) return null

  const isOutbound = type === 'ai'

  return (
    <div className={cn('flex mb-2 px-4', isOutbound ? 'justify-end' : 'justify-start')}>
      {/* Avatar for human messages */}
      {!isOutbound && (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted border border-border/50 mr-1.5 mt-1">
          <User className="h-3 w-3 text-muted-foreground" />
        </div>
      )}

      <div
        className={cn(
          'relative max-w-[72%] px-3.5 py-2.5 text-sm shadow-sm',
          isOutbound
            ? 'bubble-out-premium text-white'
            : 'bubble-in-premium text-foreground'
        )}
      >
        {/* Bot label for AI messages */}
        {isOutbound && !isAgent && (
          <div className="flex items-center gap-1 mb-1">
            <Bot className="h-2.5 w-2.5 text-emerald-400/80" />
            <span className="text-[9px] font-semibold text-emerald-400/80 uppercase tracking-wide">
              IA
            </span>
          </div>
        )}
        
        {/* Agent label for manual messages */}
        {isOutbound && isAgent && (
          <div className="flex items-center gap-1 mb-1">
            <User className="h-2.5 w-2.5 text-blue-400/80" />
            <span className="text-[9px] font-semibold text-blue-400/80 uppercase tracking-wide">
              Asesor
            </span>
          </div>
        )}

        {/* Message text */}
        <p className="whitespace-pre-wrap break-words leading-relaxed">{content}</p>

        {/* Timestamp */}
        <div className={cn(
          'flex items-center gap-1 mt-1',
          isOutbound ? 'justify-end' : 'justify-start'
        )}>
          <span className={cn(
            'text-[10px] tabular-nums',
            isOutbound ? 'text-white/55' : 'text-foreground/50'
          )}>
            {formatTime(entry.time_stamp)}
          </span>
        </div>
      </div>

      {/* Avatar for AI/Agent messages */}
      {isOutbound && (
        <div className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ml-1.5 mt-1",
          isAgent 
            ? "bg-blue-500/15 border-blue-500/20" 
            : "bg-emerald-500/15 border-emerald-500/20"
        )}>
          {isAgent ? (
            <User className="h-3 w-3 text-blue-400" />
          ) : (
            <Bot className="h-3 w-3 text-emerald-400" />
          )}
        </div>
      )}
    </div>
  )
}
