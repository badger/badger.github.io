import React from 'react'
import { getPlaceholderImage } from '@/lib/placeholder-images'

export interface AppCardProps {
  title: string
  description: string
  icon: string
  category: 'utility' | 'game' | 'productivity' | 'fun'
  preloaded: boolean
  customizable: boolean
  slug: string
}

// Bold background colors for app icons
const APP_COLORS: Record<string, string> = {
  'monaquest_icon.png': 'rgb(211, 250, 55)',
  'monagotchi_icon.png': 'rgb(48, 148, 255)',
  'sketch_icon.png': 'rgb(95, 237, 131)',
  'flappymona_icon.png': 'rgb(225, 46, 251)',
  'gallery_icon.png': 'rgb(216, 189, 14)',
  'badge_icon.png': 'rgb(255, 128, 210)',
}

/**
 * App Card Component
 * Displays a preloaded app in a sleek, app-store style with icon, name, and description
 */
export function AppCard({ 
  title, 
  description, 
  icon,
  category,
  preloaded,
  customizable,
  slug 
}: AppCardProps) {
  // Try to use actual icon, fallback to placeholder if needed
  const iconFilename = icon.split('/').pop() || 'app-icon.png'
  const [iconSrc, setIconSrc] = React.useState(icon)
  const iconBgColor = APP_COLORS[iconFilename] || 'rgb(99, 102, 241)'
  
  React.useEffect(() => {
    // Check if actual image exists, otherwise use placeholder
    const img = new Image()
    img.onload = () => setIconSrc(icon)
    img.onerror = () => setIconSrc(getPlaceholderImage(iconFilename))
    img.src = icon
  }, [icon, iconFilename])
  
  const handleCardClick = () => {
    window.location.href = `/app/${slug}`
  }
  
  return (
    <div 
      className="group flex items-start gap-4 p-4 rounded-xl hover:bg-muted/50 transition-all duration-200 cursor-pointer"
      onClick={handleCardClick}
    >
      {/* App Icon */}
      <div 
        className="flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow"
        style={{ backgroundColor: iconBgColor }}
      >
        <img 
          src={iconSrc} 
          alt={title}
          className="w-12 h-12 object-contain"
        />
      </div>

      {/* App Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-1 truncate">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  )
}
