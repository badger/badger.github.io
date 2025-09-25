import { Clock, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getDifficultyColor, formatDuration } from '@/lib/utils'
import { getPlaceholderImage } from '@/lib/placeholder-images'

export interface HackCardProps {
  title: string
  description: string
  difficulty: 'easy' | 'medium' | 'hard'
  duration: number // in minutes
  tags: string[]
  thumbnail: string
  slug: string
}

/**
 * Hack Card Component
 * Displays a hack in a card format with thumbnail, metadata, and CTA
 */
export function HackCard({ 
  title, 
  description, 
  difficulty, 
  duration, 
  tags, 
  thumbnail, 
  slug 
}: HackCardProps) {
  // Use placeholder image for development
  const imageSrc = getPlaceholderImage(thumbnail.split('/').pop() || 'led-pattern.jpg')
  
  const handleCardClick = () => {
    window.location.href = `/hack/${slug}`
  }
  
  return (
    <Card 
      className="group overflow-hidden hover:shadow-lg transition-all duration-300 glow-border cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="aspect-video overflow-hidden">
        <img 
          src={imageSrc} 
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {title}
          </CardTitle>
          <Badge 
            variant="secondary" 
            className={`${getDifficultyColor(difficulty)} shrink-0 text-xs`}
          >
            {difficulty}
          </Badge>
        </div>
        <CardDescription className="line-clamp-2">
          {description}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{formatDuration(duration)}</span>
        </div>

        <div className="flex flex-wrap gap-1 mb-4">
          {tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
          {tags.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{tags.length - 3}
            </Badge>
          )}
        </div>

        <Button 
          className="w-full group/button pointer-events-none"
          variant="default"
        >
          Try this hack
          <ExternalLink className="h-4 w-4 ml-2 group-hover/button:translate-x-1 transition-transform" />
        </Button>
      </CardContent>
    </Card>
  )
}