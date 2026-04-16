import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/utils/date'
import type { Message } from '@/lib/types/database'
import { Check, CheckCheck, Clock, Image as ImageIcon, FileText, Mic, MapPin } from 'lucide-react'

interface MessageBubbleProps {
  message: Message
}

const STATUS_ICONS = {
  pending: <Clock className="h-3 w-3" />,
  sent: <Check className="h-3 w-3" />,
  delivered: <CheckCheck className="h-3 w-3" />,
  read: <CheckCheck className="h-3 w-3 text-blue-400" />,
  failed: <span className="text-red-400 text-xs">!</span>,
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound'
  const isBot = message.sender_type === 'bot'

  return (
    <div className={cn('flex mb-1.5 px-4', isOutbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'relative max-w-[75%] px-3 py-2 shadow-sm',
          isOutbound
            ? 'msg-bubble-out bg-emerald-600/20 dark:bg-emerald-500/20'
            : 'msg-bubble-in bg-card border border-border/50'
        )}
      >
        {/* Bot label */}
        {isBot && (
          <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mb-1">IA Bot</p>
        )}

        {/* Content */}
        {message.content_type === 'text' && (
          <p className="text-sm text-foreground whitespace-pre-wrap break-words">{message.content}</p>
        )}

        {message.content_type === 'image' && (
          <div className="space-y-1">
            {message.media_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={message.media_url}
                alt="Imagen"
                className="rounded-lg max-w-[200px] cursor-pointer hover:opacity-90 transition-opacity"
                loading="lazy"
              />
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
                <span className="text-sm">Imagen</span>
              </div>
            )}
            {message.content && <p className="text-sm text-foreground">{message.content}</p>}
          </div>
        )}

        {message.content_type === 'audio' && (
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-muted-foreground shrink-0" />
            {message.media_url ? (
              <audio controls className="h-8 max-w-[200px]" src={message.media_url} />
            ) : (
              <span className="text-sm text-muted-foreground">Nota de voz</span>
            )}
          </div>
        )}

        {message.content_type === 'document' && (
          <a
            href={message.media_url ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate">{message.media_filename ?? 'Documento'}</span>
          </a>
        )}

        {message.content_type === 'location' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0 text-red-500" />
            <span>{message.location_name ?? `${message.latitude}, ${message.longitude}`}</span>
          </div>
        )}

        {message.content_type === 'template' && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Plantilla HSM</p>
            <p className="text-sm text-foreground">{message.content ?? message.template_name}</p>
          </div>
        )}

        {/* Timestamp + status */}
        <div className={cn('flex items-center gap-1 mt-0.5', isOutbound ? 'justify-end' : 'justify-start')}>
          <span className="text-[10px] text-muted-foreground">
            {formatTime(message.created_at)}
          </span>
          {isOutbound && (
            <span className="text-muted-foreground">
              {STATUS_ICONS[message.delivery_status ?? 'pending']}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
