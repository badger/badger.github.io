import { Github, Home, BookOpen, Plus, Settings, Grid3x3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { GitHubRepoBadge } from '@/components/github-repo-badge'

/**
 * Main Navigation Component
 * Provides top-level navigation for the entire site
 */
export function Navigation() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo and Brand */}
        <div className="flex items-center space-x-4">
          <a href="/" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-blue-500 to-purple-600" />
            <span className="text-xl font-bold">HackShelf</span>
          </a>
        </div>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center space-x-6">
          <a
            href="/"
            className="flex items-center space-x-2 text-foreground/80 hover:text-foreground transition-colors"
          >
            <Home className="h-4 w-4" />
            <span>Home</span>
          </a>
          <a
            href="/about-badge"
            className="flex items-center space-x-2 text-foreground/80 hover:text-foreground transition-colors"
          >
            <BookOpen className="h-4 w-4" />
            <span>About Badge</span>
          </a>
          <a
            href="/apps"
            className="flex items-center space-x-2 text-foreground/80 hover:text-foreground transition-colors"
          >
            <Grid3x3 className="h-4 w-4" />
            <span>Apps</span>
          </a>
          <a
            href="/hacks"
            className="flex items-center space-x-2 text-foreground/80 hover:text-foreground transition-colors"
          >
            <Settings className="h-4 w-4" />
            <span>Hacks</span>
          </a>
          <a
            href="/contribute"
            className="flex items-center space-x-2 text-foreground/80 hover:text-foreground transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Contribute</span>
          </a>
        </div>

        {/* Right side actions */}
        <div className="flex items-center space-x-4">
          <ThemeToggle />
          <GitHubRepoBadge repo="badger/home" />
        </div>
      </div>
    </nav>
  )
}