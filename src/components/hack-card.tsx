import { Clock, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DifficultyBadge } from '@/components/difficulty-badge'
import { Button } from '@/components/ui/button'
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
  
  return (
    <Card 
      className="group overflow-hidden transition-all duration-200 cursor-pointer border-border/40 hover:border-primary/60 hover:shadow-[0_0_30px_rgba(95,237,131,0.3)]"
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="font-sans font-bold text-xl text-foreground group-hover:text-primary line-clamp-2 transition-colors normal-case tracking-tight">
            {title}
          </CardTitle>
          <DifficultyBadge 
            difficulty={difficulty}
            className="shrink-0 text-xs"
          />
        </div>
        <CardDescription className="text-base leading-6 text-muted-foreground/80 line-clamp-3">
          {description}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
          <Clock className="h-4 w-4" />
          <span>{formatDuration(duration)}</span>
        </div>

        <Button 
          className="w-full group/button pointer-events-none group-hover:border-primary transition-colors"
          variant="default"
        >
          Try this hack
          <ExternalLink className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  )
}