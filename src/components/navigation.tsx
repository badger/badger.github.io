import { useEffect, useState } from 'react'
import { BookOpen, ContactRound, Grid3x3, Home, PlugZap, Power, Settings } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { GitHubRepoBadge } from '@/components/github-repo-badge'
import { APP_CATALOG_PAGE_ENABLED } from '@/config/features'

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/get-started', label: 'Start', icon: Power },
  { href: '/about-badge', label: 'Badge', icon: BookOpen },
  { href: '/apps', label: 'Apps', icon: Grid3x3 },
  { href: '/edit', label: 'Edit', icon: PlugZap },
  { href: '/contacts', label: 'Contacts', icon: ContactRound },
  { href: '/hacks', label: 'Hacks', icon: Settings },
].filter(({ href }) => APP_CATALOG_PAGE_ENABLED || href !== '/apps')

export function Navigation() {
  const [pathname, setPathname] = useState('/')

  useEffect(() => {
    setPathname(window.location.pathname)
  }, [])

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/90 backdrop-blur-xl">
      <div className="container flex h-[4.5rem] items-center justify-between gap-6">
        <a href="/" className="group flex shrink-0 items-center gap-3" aria-label="Badger home">
          <img src="/favicon.svg" alt="" className="h-9 w-9 transition-transform duration-200 group-hover:rotate-[-6deg]" />
          <span className="font-display text-2xl font-semibold tracking-tight">Badger</span>
        </a>

        <div className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <a
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                data-active={active}
                className="site-nav-link inline-flex items-center gap-2 rounded-md px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-primary/5 hover:text-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </a>
            )
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <span className="hidden sm:block"><GitHubRepoBadge repo="badger/home" /></span>
        </div>
      </div>
      <div className={`container grid ${APP_CATALOG_PAGE_ENABLED ? 'grid-cols-7' : 'grid-cols-6'} gap-1 overflow-hidden border-t border-border/50 py-2 lg:hidden`}>
        {navItems.map(({ href, label }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <a
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              data-active={active}
              className="min-w-0 rounded-md py-1.5 text-center font-mono text-[0.58rem] uppercase text-muted-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
            >
              {label}
            </a>
          )
        })}
      </div>
    </nav>
  )
}
