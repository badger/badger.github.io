import React from 'react'

// Dark-only theme provider: simply ensures 'dark' class is on <html>
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  if (typeof document !== 'undefined') {
    const root = document.documentElement
    if (!root.classList.contains('dark')) {
      root.classList.add('dark')
    }
  }
  return <>{children}</>
}

// Deprecated hook shim for existing imports
export const useTheme = () => ({ theme: 'dark', setTheme: () => {} })