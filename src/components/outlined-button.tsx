import React from 'react'

export interface OutlinedButtonProps {
  href: string
  children: React.ReactNode
  className?: string
}

/**
 * Outlined Button Component
 * A button with a visible white outline that turns green on hover
 */
export function OutlinedButton({ href, children, className = '' }: OutlinedButtonProps) {
  const [isHovered, setIsHovered] = React.useState(false)

  return (
    <a
      href={href}
      className={`inline-flex items-center gap-2.5 px-5 py-3 h-12 rounded-lg font-mono text-base uppercase tracking-[0.12em] bg-transparent hover:bg-primary/5 transition-all duration-150 ${className}`}
      style={{
        border: '1px solid white',
        borderColor: isHovered ? '#5FED83' : 'white',
        boxShadow: 'none',
        transition: 'border-color 150ms, background-color 150ms',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
    </a>
  )
}
