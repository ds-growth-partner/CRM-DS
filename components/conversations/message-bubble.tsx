import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/utils/date'
import type { Message } from '@/lib/types/database'
import { Check, CheckCheck, Clock, Image as ImageIcon, FileText, Mic, MapPin } from 'lucide-react'

interface MessageBubbleProps {
  message: Message
}

const STATUS_ICONS = {
  pending:   <Clock     className="h-3 w-3 opacity-60" />,
  sent:      <Check     className="h-3 w-3 opacity-60" />,
  delivered: <CheckCheck className="h-3 w-3 opacity-60" />,
  read:      <CheckCheck className="h-3 w-3 text-primary" />,
  failed:    <span className="text-destructive text-xs font-bold">!</span>,
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound'
  const isBot = message.sender_type === 'bot'

  return (
    <div className={cn('flex mb-2 px-4', isOutbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'relative max-w-[72%] px-3.5 py-2.5 text-sm shadow-sm',
          isOutbound
            ? 'bubble-out-premium text-white'
            : 'bubble-in-premium text-foreground'
        )}
      >
        {/* Bot label */}
        {isBot && !isOutbound && (
          <p className="text-[10px] font-semibold text-emerald-400 mb-1 uppercase tracking-wide">IA Bot</p>
        )}

        {/* Text */}
        {message.content_type === 'text' && (
          <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
        )}

        {/* Image */}
        {message.content_type === 'image' && (
          <div className="space-y-1.5">
            {message.media_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={message.media_url}
                alt="Imagen"
                className="rounded-xl max-w-[220px] cursor-pointer hover:opacity-90 transition-opacity"
                loading="lazy"
              />
            ) : (
              <div className="flex items-center gap-2 opacity-60">
                <ImageIcon className="h-4 w-4" />
                <span>Imagen</span>
              </div>
            )}
            {message.content && <p className="leading-relaxed">{message.content}</p>}
          </div>
        )}

        {/* Audio */}
        {message.content_type === 'audio' && (
          <div className="flex items-center gap-2">
            <div className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full shrink-0',
              isOutbound ? 'bg-white/20' : 'bg-primary/20'
            )}>
              <Mic className="h-3.5 w-3.5" />
            </div>
            {message.media_url ? (
              <audio controls className="h-7 max-w-[180px]" src={message.media_url} />
            ) : (
              <span className="opacity-60">Nota de voz</span>
            )}
          </div>
        )}

        {/* Document */}
        {message.content_type === 'document' && (
          <a
            href={message.media_url ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex items-center gap-2 rounded-lg p-2 transition-colors',
              isOutbound ? 'bg-white/10 hover:bg-white/20' : 'bg-primary/10 hover:bg-primary/20'
            )}
          >
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg shrink-0',
              isOutbound ? 'bg-white/20' : 'bg-primary/20'
            )}>
              <FileText className="h-4 w-4" />
            </div>
            <span className="truncate text-xs font-medium">{message.media_filename ?? 'Documento'}</span>
          </a>
        )}

        {/* Location */}
        {message.content_type === 'location' && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-red-400" />
            <span>{message.location_name ?? `${message.latitude}, ${message.longitude}`}</span>
          </div>
        )}

        {/* Template */}
        {message.content_type === 'template' && (
          <div className="space-y-1">
            <p className={cn(
              'text-[10px] font-semibold uppercase tracking-wide',
              isOutbound ? 'text-white/60' : 'text-foreground/50'
            )}>
              Plantilla HSM
            </p>
            <p className="leading-relaxed">{message.content ?? message.template_name}</p>
          </div>
        )}

        {/* Timestamp + status */}
        <div className={cn(
          'flex items-center gap-1 mt-1',
          isOutbound ? 'justify-end' : 'justify-start'
        )}>
          <span className={cn(
            'text-[10px] tabular-nums',
            isOutbound ? 'text-white/55' : 'text-foreground/50'
          )}>
            {formatTime(message.created_at)}
          </span>
          {isOutbound && (
            <span className="text-white/60">
              {STATUS_ICONS[message.delivery_status ?? 'pending']}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
