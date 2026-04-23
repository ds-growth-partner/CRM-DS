import { cn } from '@/lib/utils'

interface LeadScoreBarProps {
  score: number
  showLabel?: boolean
  className?: string
}

export function LeadScoreBar({ score, showLabel = true, className }: LeadScoreBarProps) {
  const color = score >= 70
    ? 'bg-emerald-400'
    : score >= 40
    ? 'bg-amber-400'
    : 'bg-red-400'

  const glowColor = score >= 70
    ? 'shadow-emerald-400/40'
    : score >= 40
    ? 'shadow-amber-400/40'
    : 'shadow-red-400/40'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all shadow-sm', color, glowColor)}
          style={{ width: `${score}%` }}
        />
      </div>
      {showLabel && (
        <span className={cn(
          'text-xs font-medium w-6 text-right tabular-nums',
          score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-amber-400' : 'text-red-400'
        )}>
          {score}
        </span>
      )}
    </div>
  )
}
