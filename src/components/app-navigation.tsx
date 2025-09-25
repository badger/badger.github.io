import { Navigation } from '@/components/navigation'
import { ThemeProvider } from '@/components/theme-provider'

export function AppNavigation() {
  return (
    <ThemeProvider>
      <Navigation />
    </ThemeProvider>
  )
}