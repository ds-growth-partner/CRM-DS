import { cn } from '@/lib/utils'
import type { N8nChatHistory, N8nMessage } from '@/lib/types/database'
import { Bot, User, Search, FileText, Play, Mic } from 'lucide-react'

interface N8nMessageBubbleProps {
  entry: N8nChatHistory
}

type MediaType = 'image' | 'video' | 'audio' | 'document' | null

interface ParsedMessage {
  type: 'human' | 'ai' | 'tool'
  content: string
  isToolCall: boolean
  toolName?: string
  isAgent: boolean
  mediaType: MediaType
  mediaUrl: string | null
  mediaFilename: string | null
}

/**
 * Parses the n8n JSONB message field.
 * Handles:
 *   1. { type, content, tool_calls?, ... }              ← standard LangChain
 *   2. { type, data: { content }, ... }                 ← proactive/follow-up
 *   3. { type, content, additional_kwargs: {            ← media messages
 *         media_type: 'image'|'video'|'audio'|'document',
 *         media_url: 'https://...',
 *         media_filename?: 'archivo.pdf'
 *      }}
 */
function parseMessage(msg: N8nMessage): ParsedMessage {
  const type = (msg.type ?? 'ai') as 'human' | 'ai' | 'tool'

  let content: string
  if (msg.data?.content) {
    content = msg.data.content
  } else {
    content = msg.content ?? ''
  }

  const isToolCall =
    type === 'ai' &&
    Array.isArray(msg.tool_calls) &&
    msg.tool_calls.length > 0

  const isAgent =
    msg.additional_kwargs?.sender === 'agent' ||
    msg.data?.additional_kwargs?.sender === 'agent'

  // Media fields from additional_kwargs
  const kwargs = (msg.additional_kwargs ?? {}) as Record<string, unknown>
  const mediaType = (kwargs.media_type as MediaType) ?? null
  const mediaUrl = (kwargs.media_url as string) ?? null
  const mediaFilename = (kwargs.media_filename as string) ?? null

  return {
    type,
    content: content.trim(),
    isToolCall,
    toolName: isToolCall ? msg.tool_calls![0]?.name : undefined,
    isAgent,
    mediaType,
    mediaUrl,
    mediaFilename,
  }
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/** Renderiza el contenido multimedia del mensaje */
function MediaContent({
  mediaType,
  mediaUrl,
  mediaFilename,
  isOutbound,
}: {
  mediaType: MediaType
  mediaUrl: string
  mediaFilename: string | null
  isOutbound: boolean
}) {
  if (mediaType === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={mediaUrl}
        alt="Imagen"
        className="rounded-lg max-w-full max-h-64 object-cover cursor-pointer"
        onClick={() => window.open(mediaUrl, '_blank')}
      />
    )
  }

  if (mediaType === 'video') {
    return (
      <div className="relative">
        <video
          src={mediaUrl}
          controls
          className="rounded-lg max-w-full max-h-48"
        />
      </div>
    )
  }

  if (mediaType === 'audio') {
    return (
      <div className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2 min-w-[180px]',
        isOutbound ? 'bg-white/10' : 'bg-muted/60'
      )}>
        <Mic className="h-4 w-4 shrink-0 opacity-70" />
        <audio src={mediaUrl} controls className="h-7 w-full" />
      </div>
    )
  }

  if (mediaType === 'document') {
    return (
      <a
        href={mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-opacity hover:opacity-80',
          isOutbound ? 'bg-white/10' : 'bg-muted/60'
        )}
      >
        <FileText className="h-4 w-4 shrink-0" />
        <span className="truncate max-w-[180px]">{mediaFilename ?? 'Documento'}</span>
      </a>
    )
  }

  return null
}

export function N8nMessageBubble({ entry }: N8nMessageBubbleProps) {
  const { type, content, isToolCall, toolName, isAgent, mediaType, mediaUrl, mediaFilename } =
    parseMessage(entry.message)

  // Skip tool result messages (internal only)
  if (type === 'tool') return null

  // Tool call invocations → compact indicator
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

  // Skip if no content and no media
  if (!content && !mediaUrl) return null

  const isOutbound = type === 'ai'

  return (
    <div className={cn('flex mb-2 px-4', isOutbound ? 'justify-end' : 'justify-start')}>
      {/* Avatar contact */}
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
        {/* Bot label */}
        {isOutbound && !isAgent && (
          <div className="flex items-center gap-1 mb-1">
            <Bot className="h-2.5 w-2.5 text-emerald-400/80" />
            <span className="text-[9px] font-semibold text-emerald-400/80 uppercase tracking-wide">
              IA
            </span>
          </div>
        )}

        {/* Agent label */}
        {isOutbound && isAgent && (
          <div className="flex items-center gap-1 mb-1">
            <User className="h-2.5 w-2.5 text-blue-400/80" />
            <span className="text-[9px] font-semibold text-blue-400/80 uppercase tracking-wide">
              Asesor
            </span>
          </div>
        )}

        {/* Media content */}
        {mediaUrl && mediaType && (
          <div className="mb-1">
            <MediaContent
              mediaType={mediaType}
              mediaUrl={mediaUrl}
              mediaFilename={mediaFilename}
              isOutbound={isOutbound}
            />
          </div>
        )}

        {/* Text content (caption or message) */}
        {content && (
          <p className="whitespace-pre-wrap break-words leading-relaxed">{content}</p>
        )}

        {/* Timestamp */}
        <div className={cn('flex items-center gap-1 mt-1', isOutbound ? 'justify-end' : 'justify-start')}>
          <span className={cn(
            'text-[10px] tabular-nums',
            isOutbound ? 'text-white/55' : 'text-foreground/50'
          )}>
            {formatTime(entry.time_stamp)}
          </span>
        </div>
      </div>

      {/* Avatar AI/Agent */}
      {isOutbound && (
        <div className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ml-1.5 mt-1',
          isAgent
            ? 'bg-blue-500/15 border-blue-500/20'
            : 'bg-emerald-500/15 border-emerald-500/20'
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
