import type { Tag } from '@/lib/types/database'

export function TagBadge({ tag }: { tag: Pick<Tag, 'name' | 'color'> }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `${tag.color}20`,
        color: tag.color,
        border: `1px solid ${tag.color}40`,
      }}
    >
      {tag.name}
    </span>
  )
}
