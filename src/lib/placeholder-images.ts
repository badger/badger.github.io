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
  `),

  // App Icons with bold background colors
  'monaquest_icon.png': 'data:image/svg+xml;base64,' + btoa(`
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="rgb(211, 250, 55)" rx="40"/>
      <path d="M60 100 L100 60 L140 100 L120 140 L80 140 Z" fill="#1f2937"/>
      <circle cx="100" cy="90" r="15" fill="#ffffff"/>
      <text x="100" y="100" text-anchor="middle" fill="#1f2937" font-size="20" font-weight="bold">?</text>
    </svg>
  `),

  'monagotchi_icon.png': 'data:image/svg+xml;base64,' + btoa(`
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="rgb(48, 148, 255)" rx="40"/>
      <ellipse cx="100" cy="105" rx="55" ry="45" fill="#1f2937"/>
      <circle cx="85" cy="95" r="8" fill="#ffffff"/>
      <circle cx="115" cy="95" r="8" fill="#ffffff"/>
      <path d="M85 115 Q100 125 115 115" stroke="#ffffff" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="70" cy="115" r="8" fill="rgb(211, 250, 55)"/>
      <circle cx="130" cy="115" r="8" fill="rgb(211, 250, 55)"/>
    </svg>
  `),

  'sketch_icon.png': 'data:image/svg+xml;base64,' + btoa(`
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="rgb(95, 237, 131)" rx="40"/>
      <rect x="50" y="50" width="100" height="100" fill="#ffffff" rx="10"/>
      <path d="M70 80 L90 60 L120 90 L130 70" stroke="#1f2937" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="70" cy="120" r="12" fill="rgb(225, 46, 251)" opacity="0.8"/>
      <path d="M100 100 L110 130 L120 110" stroke="#1f2937" stroke-width="3" fill="none" stroke-linecap="round"/>
    </svg>
  `),

  'flappymona_icon.png': 'data:image/svg+xml;base64,' + btoa(`
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="rgb(225, 46, 251)" rx="40"/>
      <rect x="140" y="40" width="20" height="60" fill="#1f2937" rx="4"/>
      <rect x="140" y="120" width="20" height="60" fill="#1f2937" rx="4"/>
      <ellipse cx="70" cy="100" rx="28" ry="22" fill="rgb(216, 189, 14)"/>
      <circle cx="75" cy="95" r="6" fill="#1f2937"/>
      <path d="M48 105 L60 100 L48 95" fill="#ef4444"/>
      <path d="M65 85 L75 75 L70 85" fill="rgb(216, 189, 14)" opacity="0.8"/>
    </svg>
  `),

  'gallery_icon.png': 'data:image/svg+xml;base64,' + btoa(`
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="rgb(216, 189, 14)" rx="40"/>
      <rect x="50" y="60" width="100" height="80" fill="#ffffff" rx="8"/>
      <rect x="60" y="70" width="35" height="30" fill="rgb(48, 148, 255)" rx="4"/>
      <rect x="105" y="70" width="35" height="30" fill="rgb(95, 237, 131)" rx="4"/>
      <rect x="60" y="105" width="35" height="30" fill="rgb(225, 46, 251)" rx="4"/>
      <rect x="105" y="105" width="35" height="30" fill="rgb(255, 128, 210)" rx="4"/>
      <circle cx="68" cy="78" r="4" fill="#ffffff"/>
    </svg>
  `),

  'badge_icon.png': 'data:image/svg+xml;base64,' + btoa(`
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="rgb(255, 128, 210)" rx="40"/>
      <rect x="60" y="60" width="80" height="80" rx="12" fill="#1f2937"/>
      <circle cx="100" cy="85" r="15" fill="#ffffff"/>
      <rect x="75" y="105" width="50" height="8" rx="4" fill="#ffffff"/>
      <rect x="80" y="118" width="40" height="6" rx="3" fill="rgb(211, 250, 55)"/>
      <rect x="70" y="130" width="60" height="4" rx="2" fill="#6b7280"/>
    </svg>
  `),

  'app-icon.png': 'data:image/svg+xml;base64,' + btoa(`
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect x="50" y="50" width="100" height="100" rx="20" fill="#6366f1" opacity="0.2"/>
      <rect x="60" y="60" width="80" height="80" rx="15" fill="#6366f1"/>
      <circle cx="100" cy="100" r="25" fill="#ffffff"/>
      <text x="100" y="170" text-anchor="middle" fill="#6366f1" font-size="14" font-family="Arial, sans-serif" font-weight="600">App</text>
    </svg>
  `)
}

// Helper function to get placeholder image
export function getPlaceholderImage(filename: string): string {
  return placeholderImages[filename as keyof typeof placeholderImages] || placeholderImages['led-pattern.jpg']
}