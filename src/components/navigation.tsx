import { Home, BookOpen, Plus, Settings, Grid3x3, Terminal, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { GitHubRepoBadge } from '@/components/github-repo-badge'

/**
 * Main Navigation Component
 * Provides top-level navigation for the entire site
 */
export function Navigation() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-20 items-center justify-between">
        {/* Logo and Brand */}
        <div className="flex items-center space-x-2">
          <a href="/" className="flex items-center space-x-3 group">
            <div className="h-12 w-12 rounded border border-border/40 bg-card flex items-center justify-center transition-colors group-hover:border-primary/60 group-hover:bg-primary/5">
              <Terminal className="h-7 w-7 text-primary" />
            </div>
            <span className="text-4xl font-display font-semibold tracking-tight">Badger</span>
          </a>
        </div>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center space-x-0.5">
          <a
            href="/"
            className="flex items-center space-x-2.5 px-5 py-3 rounded font-mono text-base uppercase tracking-[0.12em] text-foreground hover:text-primary hover:bg-primary/10 transition-all duration-150 border border-transparent hover:border-primary/50 hover:shadow-[0_0_15px_rgba(95,237,131,0.3)]"
          >
            <Home className="h-5 w-5" />
            <span>Home</span>
          </a>
          <a
            href="/get-started"
            className="flex items-center space-x-2.5 px-5 py-3 rounded font-mono text-base uppercase tracking-[0.12em] text-foreground hover:text-primary hover:bg-primary/10 transition-all duration-150 border border-transparent hover:border-primary/50 hover:shadow-[0_0_15px_rgba(95,237,131,0.3)]"
          >
            <Power className="h-5 w-5" />
            <span>Get Started</span>
          </a>
          <a
            href="/about-badge"
            className="flex items-center space-x-2.5 px-5 py-3 rounded font-mono text-base uppercase tracking-[0.12em] text-foreground hover:text-primary hover:bg-primary/10 transition-all duration-150 border border-transparent hover:border-primary/50 hover:shadow-[0_0_15px_rgba(95,237,131,0.3)]"
          >
            <BookOpen className="h-5 w-5" />
            <span>Badge</span>
          </a>
          <a
            href="/apps"
            className="flex items-center space-x-2.5 px-5 py-3 rounded font-mono text-base uppercase tracking-[0.12em] text-foreground hover:text-primary hover:bg-primary/10 transition-all duration-150 border border-transparent hover:border-primary/50 hover:shadow-[0_0_15px_rgba(95,237,131,0.3)]"
          >
            <Grid3x3 className="h-5 w-5" />
            <span>Apps</span>
          </a>
          <a
            href="/hacks"
            className="flex items-center space-x-2.5 px-5 py-3 rounded font-mono text-base uppercase tracking-[0.12em] text-foreground hover:text-primary hover:bg-primary/10 transition-all duration-150 border border-transparent hover:border-primary/50 hover:shadow-[0_0_15px_rgba(95,237,131,0.3)]"
          >
            <Settings className="h-5 w-5" />
            <span>Hacks</span>
          </a>
          <a
            href="/contribute"
            className="flex items-center space-x-2.5 px-5 py-3 rounded font-mono text-base uppercase tracking-[0.12em] text-foreground hover:text-primary hover:bg-primary/10 transition-all duration-150 border border-transparent hover:border-primary/50 hover:shadow-[0_0_15px_rgba(95,237,131,0.3)]"
          >
            <Plus className="h-5 w-5" />
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