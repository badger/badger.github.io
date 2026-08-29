import { Clock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { formatDuration } from '@/lib/utils'
import { getPlaceholderImage } from '@/lib/placeholder-images'

export interface HackCardProps {
  title: string
  description: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  duration: number // in minutes
  thumbnail: string
  slug: string
}

/**
 * Hack Card Component
 * Displays a hack in a card format with metadata and CTA
 */
export function HackCard({ 
  title, 
  description, 
  difficulty, 
  duration, 
  thumbnail, 
  slug 
}: HackCardProps) {
  const handleCardClick = () => {
    window.location.href = `/hack/${slug}`
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleCardClick()
    }
  }
  
  return (
    <Card 
      className="surface surface-hover group cursor-pointer overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      role="link"
      tabIndex={0}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2 font-sans text-lg font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary normal-case">
            {title}
          </CardTitle>
          <DifficultyBadge 
            difficulty={difficulty}
            className="shrink-0 text-xs"
          />
        </div>
        <CardDescription className="line-clamp-3 text-sm leading-6 text-muted-foreground">
          {description}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
          <Clock className="h-4 w-4" />
          <span>{formatDuration(duration)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
