import { cn } from '@/lib/utils'

interface LeadScoreBarProps {
  score: number
  showLabel?: boolean
  className?: string
}

export function LeadScoreBar({ score, showLabel = true, className }: LeadScoreBarProps) {
  const color = score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-400'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${score}%` }}
        />
      </div>
      {showLabel && <span className="text-xs text-muted-foreground w-6 text-right">{score}</span>}
    </div>
  )
}
