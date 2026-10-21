import React from 'react'

// Theme class is applied pre-paint by the inline script in Layout.astro.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}