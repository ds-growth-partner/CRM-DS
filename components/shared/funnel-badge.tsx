import type { FunnelStage } from '@/lib/types/database'

export function FunnelBadge({ stage }: { stage: Pick<FunnelStage, 'name' | 'color'> | null | undefined }) {
  if (!stage) return null
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
      style={{
        backgroundColor: `${stage.color}15`,
        color: stage.color,
        outline: `1px solid ${stage.color}30`,
      }}
    >
      {stage.name}
    </span>
  )
}
