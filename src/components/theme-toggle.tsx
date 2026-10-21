import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { getActiveTheme, setTheme, type Theme } from '@/lib/theme'

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme | null>(null)

  useEffect(() => {
    setThemeState(getActiveTheme())
    const onChange = (event: Event) => setThemeState((event as CustomEvent<Theme>).detail)
    window.addEventListener('badger-theme-change', onChange)
    return () => window.removeEventListener('badger-theme-change', onChange)
  }, [])

  const next: Theme = theme === 'light' ? 'dark' : 'light'
  const label = theme ? `Switch to ${next} theme` : 'Toggle theme'

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border/70 bg-transparent text-muted-foreground transition-colors duration-150 hover:border-primary/50 hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px"
    >
      <Sun className="hidden h-4 w-4 dark:block" aria-hidden="true" />
      <Moon className="block h-4 w-4 dark:hidden" aria-hidden="true" />
    </button>
  )
}