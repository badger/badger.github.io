import { Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getDifficultyColor, formatDuration } from '@/lib/utils'

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
      className="group p-5 rounded-lg border border-border/40 hover:border-primary/60 hover:shadow-[0_0_20px_rgba(95,237,131,0.2)] transition-all duration-200 cursor-pointer bg-card/30"
      onClick={handleClick}
    >
      {/* Difficulty and Duration */}
      <div className="flex items-center gap-3 mb-3">
        <Badge 
          variant="secondary" 
          className={`${getDifficultyColor(difficulty)} text-xs`}
        >
          {difficulty}
        </Badge>
        <div className="flex items-center gap-2 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
          <Clock className="h-3.5 w-3.5" />
          <span className="font-mono">{formatDuration(duration)}</span>
        </div>
      </div>
      
      {/* Title */}
      <h3 className="font-sans font-bold text-lg text-foreground group-hover:text-primary transition-colors normal-case tracking-tight mb-2">
        {title}
      </h3>
      
      {/* Description */}
      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
        {description}
      </p>
    </div>
  )
}
