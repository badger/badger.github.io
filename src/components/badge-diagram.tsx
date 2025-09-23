import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface HotspotData {
  id: string
  title: string
  description: string
  specs: string[]
  position: { x: number; y: number }
}

const hotspots: HotspotData[] = [
  {
    id: 'processor',
    title: 'RP2350 Processor',
    description: 'Dual-core ARM Cortex-M33 running at 150MHz with 520KB RAM and 4MB flash storage.',
    specs: ['150MHz Dual-Core', '520KB RAM', '4MB Flash'],
    position: { x: 45, y: 35 }
  },
  {
    id: 'display',
    title: 'E-Ink Display',
    description: 'Ultra-low power 296×128 pixel monochrome e-ink display that retains content without power.',
    specs: ['296×128 pixels', 'E-Ink Technology', 'Ultra Low Power'],
    position: { x: 50, y: 15 }
  },
  {
    id: 'battery',
    title: 'Battery Connector',
    description: 'JST connector for Li-Po battery with built-in charging circuit and power management.',
    specs: ['Li-Po Compatible', 'USB-C Charging', 'Power Management'],
    position: { x: 20, y: 60 }
  },
  {
    id: 'usb',
    title: 'USB-C Port',
    description: 'USB-C connector for programming, debugging, and power delivery.',
    specs: ['USB-C', 'Programming', 'Power Delivery'],
    position: { x: 50, y: 85 }
  },
  {
    id: 'buttons',
    title: 'User Buttons',
    description: 'Five tactile buttons for user input and navigation (A, B, C, UP, DOWN).',
    specs: ['5 Buttons', 'Tactile Feedback', 'User Input'],
    position: { x: 75, y: 50 }
  },
  {
    id: 'gpio',
    title: 'GPIO Expansion',
    description: 'Breakout pins for GPIO, I2C, SPI, and other communication protocols.',
    specs: ['GPIO Pins', 'I2C/SPI', 'Expandable'],
    position: { x: 85, y: 25 }
  }
]

/**
 * Interactive Badge Diagram Component
 * Shows an SVG representation of the Badger 2350 with clickable hotspots
 */
export function BadgeDiagram() {
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotData | null>(null)
  const [hoveredHotspot, setHoveredHotspot] = useState<string | null>(null)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      {/* Badge Diagram */}
      <div className="relative">
        <div className="bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-8 shadow-lg">
          <svg
            viewBox="0 0 400 300"
            className="w-full h-auto"
            style={{ maxHeight: '400px' }}
          >
            {/* Badge Outline */}
            <rect
              x="50"
              y="50"
              width="300"
              height="200"
              rx="20"
              fill="url(#badgeGradient)"
              stroke="url(#borderGradient)"
              strokeWidth="2"
            />

            {/* Display Area */}
            <rect
              x="80"
              y="70"
              width="240"
              height="100"
              rx="8"
              fill="#1a1a1a"
              stroke="#333"
              strokeWidth="1"
            />

            {/* Display Content */}
            <text x="200" y="110" textAnchor="middle" fill="#00ff00" fontSize="12" fontFamily="monospace">
              BADGER 2350
            </text>
            <text x="200" y="130" textAnchor="middle" fill="#00ff00" fontSize="10" fontFamily="monospace">
              Ready to Hack!
            </text>

            {/* Buttons */}
            <circle cx="290" cy="200" r="8" fill="#4a5568" stroke="#2d3748" strokeWidth="1" />
            <circle cx="310" cy="180" r="8" fill="#4a5568" stroke="#2d3748" strokeWidth="1" />
            <circle cx="310" cy="200" r="8" fill="#4a5568" stroke="#2d3748" strokeWidth="1" />
            <circle cx="310" cy="220" r="8" fill="#4a5568" stroke="#2d3748" strokeWidth="1" />
            <circle cx="330" cy="200" r="8" fill="#4a5568" stroke="#2d3748" strokeWidth="1" />

            {/* USB-C Port */}
            <rect x="190" y="245" width="20" height="8" rx="4" fill="#2d3748" />

            {/* GPIO Pins */}
            <g>
              {Array.from({ length: 8 }, (_, i) => (
                <circle
                  key={i}
                  cx={320 + (i % 4) * 8}
                  cy={90 + Math.floor(i / 4) * 8}
                  r="2"
                  fill="#ffd700"
                />
              ))}
            </g>

            {/* Processor */}
            <rect x="160" y="190" width="80" height="40" rx="4" fill="#2d3748" stroke="#4a5568" strokeWidth="1" />
            <text x="200" y="210" textAnchor="middle" fill="#e2e8f0" fontSize="8">RP2350</text>

            {/* Battery Connector */}
            <rect x="70" y="190" width="15" height="10" rx="2" fill="#e53e3e" />

            {/* Gradients */}
            <defs>
              <linearGradient id="badgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1a365d" />
                <stop offset="100%" stopColor="#2a69ac" />
              </linearGradient>
              <linearGradient id="borderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3182ce" />
                <stop offset="100%" stopColor="#805ad5" />
              </linearGradient>
            </defs>

            {/* Hotspots */}
            {hotspots.map((hotspot) => (
              <circle
                key={hotspot.id}
                cx={hotspot.position.x * 4} // Scale to SVG coordinates
                cy={hotspot.position.y * 3}
                r="12"
                fill={hoveredHotspot === hotspot.id ? "rgba(59, 130, 246, 0.6)" : "rgba(59, 130, 246, 0.3)"}
                stroke="#3b82f6"
                strokeWidth="2"
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setHoveredHotspot(hotspot.id)}
                onMouseLeave={() => setHoveredHotspot(null)}
                onClick={() => setSelectedHotspot(hotspot)}
              >
                <title>{hotspot.title}</title>
              </circle>
            ))}

            {/* Pulse animation for active hotspot */}
            {hoveredHotspot && (
              <circle
                cx={hotspots.find(h => h.id === hoveredHotspot)!.position.x * 4}
                cy={hotspots.find(h => h.id === hoveredHotspot)!.position.y * 3}
                r="12"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                opacity="0.6"
              >
                <animate
                  attributeName="r"
                  values="12;20;12"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.6;0;0.6"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </circle>
            )}
          </svg>
        </div>

        <p className="text-sm text-muted-foreground text-center mt-4">
          Click on the blue dots to learn more about each component
        </p>
      </div>

      {/* Feature Details */}
      <div className="space-y-6">
        {selectedHotspot ? (
          <Card className="border-2 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="text-xl text-blue-600 dark:text-blue-400">
                {selectedHotspot.title}
              </CardTitle>
              <CardDescription className="text-base">
                {selectedHotspot.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {selectedHotspot.specs.map((spec) => (
                  <Badge key={spec} variant="secondary">
                    {spec}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-2">
            <CardHeader>
              <CardTitle className="text-lg text-muted-foreground">
                Select a Component
              </CardTitle>
              <CardDescription>
                Click on any blue dot on the badge diagram to learn more about that component's features and specifications.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Quick Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Processor:</span>
                <br />
                <span className="text-muted-foreground">RP2350 Dual-Core</span>
              </div>
              <div>
                <span className="font-medium">Memory:</span>
                <br />
                <span className="text-muted-foreground">520KB RAM, 4MB Flash</span>
              </div>
              <div>
                <span className="font-medium">Display:</span>
                <br />
                <span className="text-muted-foreground">296×128 E-Ink</span>
              </div>
              <div>
                <span className="font-medium">Connectivity:</span>
                <br />
                <span className="text-muted-foreground">WiFi, Bluetooth</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}