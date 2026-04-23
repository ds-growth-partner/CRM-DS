import type { FunnelStage } from '@/lib/types/database'

export function FunnelBadge({ stage }: { stage: Pick<FunnelStage, 'name' | 'color'> | null | undefined }) {
  if (!stage) return (
    <span className="inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-medium text-muted-foreground bg-muted/50">
      Sin etapa
    </span>
  )
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[11px] font-medium"
      style={{
        backgroundColor: `${stage.color}15`,
        color: stage.color,
        border: `1px solid ${stage.color}30`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
      {stage.name}
    </span>
  )
}
