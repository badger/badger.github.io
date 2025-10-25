import { Badge } from '@/components/ui/badge'
import { getDifficultyColor } from '@/lib/utils'

export interface DifficultyBadgeProps {
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  className?: string
}

/**
 * Difficulty Badge Component
 * Displays a difficulty level badge with consistent colors:
 * - Beginner: Green
 * - Intermediate: Amber
 * - Advanced: Red
 */
export function DifficultyBadge({ difficulty, className = '' }: DifficultyBadgeProps) {
  return (
    <Badge 
      variant="secondary" 
      className={`${getDifficultyColor(difficulty)} ${className}`}
    >
      {difficulty}
    </Badge>
  )
}
