import React from 'react'
import { getPlaceholderImage } from '@/lib/placeholder-images'
import { APP_DETAIL_LINKS_ENABLED } from '@/config/features'

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
  'monapet_icon.png': 'rgb(48, 148, 255)',
  'sketch_icon.png': 'rgb(95, 237, 131)',
  'flappymona_icon.png': 'rgb(225, 46, 251)',
  'gallery_icon.png': 'rgb(216, 189, 14)',
  'badge_icon.png': 'rgb(255, 128, 210)',
  'commits.svg': 'rgb(46, 160, 67)',
  'snake.svg': 'rgb(25, 108, 46)',
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
    if (!APP_DETAIL_LINKS_ENABLED) return
    window.location.href = `/app/${slug}`
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleCardClick()
    }
  }
  
  return (
    <div
      className={`surface flex items-start gap-4 p-4 ${APP_DETAIL_LINKS_ENABLED ? 'surface-hover group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background' : ''}`}
      onClick={APP_DETAIL_LINKS_ENABLED ? handleCardClick : undefined}
      onKeyDown={APP_DETAIL_LINKS_ENABLED ? handleKeyDown : undefined}
      role={APP_DETAIL_LINKS_ENABLED ? 'link' : undefined}
      tabIndex={APP_DETAIL_LINKS_ENABLED ? 0 : undefined}
    >
      {/* App Icon */}
      <div 
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-[1.03]"
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
        <div className="mb-1.5 flex items-center gap-2">
          <h3 className="font-sans text-base font-semibold tracking-tight transition-colors group-hover:text-primary normal-case">
            {title}
          </h3>
          {!preloaded && (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] px-2 py-[2px] rounded border border-primary/60 text-primary">
              MANUAL LOAD
            </span>
          )}
        </div>
        <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  )
}
