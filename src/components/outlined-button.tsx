import React from 'react'

export interface OutlinedButtonProps {
  href: string
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'subtle'
}

export function OutlinedButton({ href, children, className = '', variant = 'default' }: OutlinedButtonProps) {
  const [isHovered, setIsHovered] = React.useState(false)
  const subtle = variant === 'subtle'

  return (
    <a
      href={href}
      className={`inline-flex items-center font-mono uppercase tracking-[0.12em] transition-all duration-150 ${subtle ? 'h-10 gap-2 rounded-md bg-primary/5 px-4 py-2 text-xs text-primary hover:bg-primary/10' : 'h-12 gap-2.5 rounded-lg bg-transparent px-5 py-3 text-base hover:bg-primary/5'} ${className}`}
      style={{
        border: '1px solid',
        borderColor: subtle ? (isHovered ? 'hsl(var(--primary) / 0.6)' : 'hsl(var(--primary) / 0.35)') : (isHovered ? '#5FED83' : 'white'),
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
