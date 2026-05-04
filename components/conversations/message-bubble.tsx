import { cn } from '@/lib/utils'
import type { Message } from '@/lib/types/database'
import { Bot, User, FileText, Mic, MapPin, CheckCheck, Check, Clock, AlertCircle } from 'lucide-react'

interface MessageBubbleProps {
  message: Message
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function DeliveryIcon({ status }: { status: Message['delivery_status'] }) {
  if (status === 'pending') return <Clock className="h-2.5 w-2.5" />
  if (status === 'sent') return <Check className="h-2.5 w-2.5" />
  if (status === 'delivered') return <CheckCheck className="h-2.5 w-2.5" />
  if (status === 'read') return <CheckCheck className="h-2.5 w-2.5 text-blue-300" />
  if (status === 'failed') return <AlertCircle className="h-2.5 w-2.5 text-red-400" />
  return null
}

function MediaContent({ message, isOutbound }: { message: Message; isOutbound: boolean }) {
  const { content_type, media_url, media_filename } = message

  if (!media_url) return null

  if (content_type === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={media_url}
        alt="Imagen"
        className="rounded-lg max-w-full max-h-64 object-cover cursor-pointer"
        onClick={() => window.open(media_url, '_blank')}
      />
    )
  }

  if (content_type === 'video') {
    return (
      <video
        src={media_url}
        controls
        className="rounded-lg max-w-full max-h-48"
      />
    )
  }

  if (content_type === 'audio') {
    return (
      <div className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2 min-w-[180px]',
        isOutbound ? 'bg-white/10' : 'bg-muted/60'
      )}>
        <Mic className="h-4 w-4 shrink-0 opacity-70" />
        <audio src={media_url} controls className="h-7 w-full" />
      </div>
    )
  }

  if (content_type === 'document') {
    return (
      <a
        href={media_url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-opacity hover:opacity-80',
          isOutbound ? 'bg-white/10' : 'bg-muted/60'
        )}
      >
        <FileText className="h-4 w-4 shrink-0" />
        <span className="truncate max-w-[180px]">{media_filename ?? 'Documento'}</span>
      </a>
    )
  }

  if (content_type === 'location') {
    return (
      <a
        href={media_url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-opacity hover:opacity-80',
          isOutbound ? 'bg-white/10' : 'bg-muted/60'
        )}
      >
        <MapPin className="h-4 w-4 shrink-0" />
        <span>Ver ubicación</span>
      </a>
    )
  }

  return null
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound'
  const isAgent = message.sender_type === 'agent'
  const isOptimistic = message.id.startsWith('optimistic-')

  // Skip system messages with no content
  if (!message.content && !message.media_url) return null

  return (
    <div className={cn('flex mb-2 px-4', isOutbound ? 'justify-end' : 'justify-start')}>
      {/* Inbound avatar */}
      {!isOutbound && (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted border border-border/50 mr-1.5 mt-1">
          <User className="h-3 w-3 text-muted-foreground" />
        </div>
      )}

      <div
        className={cn(
          'relative max-w-[72%] px-3.5 py-2.5 text-sm shadow-sm',
          isOptimistic && 'opacity-70',
          isOutbound
            ? 'bubble-out-premium text-white'
            : 'bubble-in-premium text-foreground'
        )}
      >
        {/* Sender label */}
        {isOutbound && (
          <div className="flex items-center gap-1 mb-1">
            {isAgent ? (
              <>
                <User className="h-2.5 w-2.5 text-blue-400/80" />
                <span className="text-[9px] font-semibold text-blue-400/80 uppercase tracking-wide">Asesor</span>
              </>
            ) : (
              <>
                <Bot className="h-2.5 w-2.5 text-emerald-400/80" />
                <span className="text-[9px] font-semibold text-emerald-400/80 uppercase tracking-wide">IA</span>
              </>
            )}
          </div>
        )}

        {/* Media */}
        {message.media_url && (
          <div className="mb-1">
            <MediaContent message={message} isOutbound={isOutbound} />
          </div>
        )}

        {/* Text */}
        {message.content && (
          <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
        )}

        {/* Footer: timestamp + delivery */}
        <div className={cn('flex items-center gap-1 mt-1', isOutbound ? 'justify-end' : 'justify-start')}>
          <span className={cn('text-[10px] tabular-nums', isOutbound ? 'text-white/55' : 'text-foreground/50')}>
            {formatTime(message.created_at)}
          </span>
          {isOutbound && (
            <span className="text-white/55">
              <DeliveryIcon status={message.delivery_status} />
            </span>
          )}
        </div>
      </div>

      {/* Outbound avatar */}
      {isOutbound && (
        <div className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ml-1.5 mt-1',
          isAgent
            ? 'bg-blue-500/15 border-blue-500/20'
            : 'bg-emerald-500/15 border-emerald-500/20'
        )}>
          {isAgent
            ? <User className="h-3 w-3 text-blue-400" />
            : <Bot className="h-3 w-3 text-emerald-400" />
          }
        </div>
      )}
    </div>
  )
}
