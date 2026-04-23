import type { Tag } from '@/lib/types/database'

export function TagBadge({ tag }: { tag: Pick<Tag, 'name' | 'color'> }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        backgroundColor: `${tag.color}18`,
        color: tag.color,
        border: `1px solid ${tag.color}35`,
      }}
    >
      {tag.name}
    </span>
  )
}
