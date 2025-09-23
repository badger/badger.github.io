// Placeholder images for development
// In production, replace these with actual thumbnails

export const placeholderImages = {
  'led-pattern.jpg': 'data:image/svg+xml;base64,' + btoa(`
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1e40af"/>
          <stop offset="100%" style="stop-color:#7c3aed"/>
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bg)"/>
      <circle cx="150" cy="100" r="30" fill="#ef4444" opacity="0.8"/>
      <circle cx="250" cy="150" r="25" fill="#22c55e" opacity="0.8"/>
      <circle cx="200" cy="200" r="35" fill="#3b82f6" opacity="0.8"/>
      <text x="200" y="250" text-anchor="middle" fill="white" font-size="20" font-family="Arial">LED Pattern</text>
    </svg>
  `),
  
  'weather-station.jpg': 'data:image/svg+xml;base64,' + btoa(`
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0ea5e9"/>
          <stop offset="100%" style="stop-color:#06b6d4"/>
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bg2)"/>
      <circle cx="300" cy="80" r="40" fill="#fbbf24" opacity="0.9"/>
      <path d="M50 150 Q100 120 150 150 Q200 180 250 150 Q300 120 350 150" stroke="white" stroke-width="4" fill="none"/>
      <rect x="150" y="200" width="100" height="60" rx="10" fill="white" opacity="0.9"/>
      <text x="200" y="225" text-anchor="middle" fill="#0ea5e9" font-size="16" font-family="Arial">25C</text>
      <text x="200" y="245" text-anchor="middle" fill="#0ea5e9" font-size="14" font-family="Arial">Weather</text>
    </svg>
  `),
  
  'audio-visualizer.jpg': 'data:image/svg+xml;base64,' + btoa(`
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#7c3aed"/>
          <stop offset="100%" style="stop-color:#ec4899"/>
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bg3)"/>
      <rect x="50" y="200" width="20" height="80" fill="#22c55e"/>
      <rect x="80" y="150" width="20" height="130" fill="#3b82f6"/>
      <rect x="110" y="120" width="20" height="160" fill="#f59e0b"/>
      <rect x="140" y="100" width="20" height="180" fill="#ef4444"/>
      <rect x="170" y="140" width="20" height="140" fill="#8b5cf6"/>
      <rect x="200" y="180" width="20" height="100" fill="#06b6d4"/>
      <rect x="230" y="160" width="20" height="120" fill="#84cc16"/>
      <rect x="260" y="190" width="20" height="90" fill="#f97316"/>
      <rect x="290" y="170" width="20" height="110" fill="#ec4899"/>
      <rect x="320" y="140" width="20" height="140" fill="#6366f1"/>
      <text x="200" y="50" text-anchor="middle" fill="white" font-size="20" font-family="Arial">Audio Visualizer</text>
    </svg>
  `),
  
  'digital-pet.jpg': 'data:image/svg+xml;base64,' + btoa(`
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg4" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#10b981"/>
          <stop offset="100%" style="stop-color:#3b82f6"/>
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bg4)"/>
      <ellipse cx="200" cy="180" rx="60" ry="40" fill="#fbbf24"/>
      <circle cx="180" cy="160" r="8" fill="#1f2937"/>
      <circle cx="220" cy="160" r="8" fill="#1f2937"/>
      <ellipse cx="200" cy="190" rx="15" ry="8" fill="#f97316"/>
      <path d="M200 190 Q190 200 180 195" stroke="#1f2937" stroke-width="2" fill="none"/>
      <path d="M200 190 Q210 200 220 195" stroke="#1f2937" stroke-width="2" fill="none"/>
      <text x="200" y="250" text-anchor="middle" fill="white" font-size="20" font-family="Arial">Digital Pet</text>
      <text x="200" y="40" text-anchor="middle" fill="white" font-size="16" font-family="Arial">Healthy Pet</text>
    </svg>
  `)
}

// Helper function to get placeholder image
export function getPlaceholderImage(filename: string): string {
  return placeholderImages[filename as keyof typeof placeholderImages] || placeholderImages['led-pattern.jpg']
}