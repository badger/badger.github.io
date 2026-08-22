import { Clock } from 'lucide-react'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { formatDuration } from '@/lib/utils'

export interface HackListItemProps {
  title: string
  description: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  duration: number // in minutes
  slug: string
}

/**
 * Compact Hack List Item Component
 * Displays a hack in a full-width compact row format for listing pages
 */
export function HackListItem({ 
  title, 
  description, 
  difficulty, 
  duration, 
  slug 
}: HackListItemProps) {
  const handleClick = () => {
    window.location.href = `/hack/${slug}`
  }
  
  return (
    <div 
      className="surface surface-hover group cursor-pointer p-5"
      onClick={handleClick}
    >
      {/* Difficulty and Duration */}
      <div className="mb-3 flex items-center gap-3">
        <DifficultyBadge 
          difficulty={difficulty}
          className="text-xs"
        />
        <div className="flex items-center gap-2 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
          <Clock className="h-3.5 w-3.5" />
          <span className="font-mono">{formatDuration(duration)}</span>
        </div>
      </div>
      
      {/* Title */}
      <h3 className="mb-2 font-sans text-lg font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary normal-case">
        {title}
      </h3>
      
      {/* Description */}
      <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  )
}
