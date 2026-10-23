import { useEffect, useState } from 'react'
import {
  BookOpen,
  ChevronDown,
  Hammer,
  Menu,
  PlugZap,
  Power,
  X,
  type LucideIcon,
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { GitHubRepoBadge } from '@/components/github-repo-badge'
import { APP_CATALOG_PAGE_ENABLED, CONTACTS_PAGE_ENABLED } from '@/config/features'

interface NavigationLink {
  href: string
  label: string
  description: string
}

interface NavigationGroup {
  href: string
  label: string
  landingLabel: string
  icon: LucideIcon
  matches: string[]
  items: NavigationLink[]
}

const navigationGroups: NavigationGroup[] = [
  {
    href: '/get-started',
    label: 'Start Here',
    landingLabel: 'Open Start Here',
    icon: Power,
    matches: ['/get-started'],
    items: [
      { href: '/get-started#set-up', label: 'Set Up Your Badge', description: 'Charge, start and configure it' },
      { href: '/get-started#controls', label: 'Learn the Controls', description: 'Buttons, power and USB modes' },
      { href: '/get-started#personalize', label: 'Personalize Your Badge', description: 'Profile, apps and menu images' },
      { href: '/get-started#troubleshooting', label: 'Troubleshooting', description: 'Fix startup and connection issues' },
    ],
  },
  {
    href: '/about-badge',
    label: 'About',
    landingLabel: 'About the Badger',
    icon: BookOpen,
    matches: ['/about-badge'],
    items: [
      { href: '/about-badge#specifications', label: 'Hardware & Specs', description: 'Processor, display, ports and sensors' },
      { href: '/about-badge#badge-simulator', label: 'Badge Simulator', description: 'Use MonaOS in the browser' },
    ],
  },
  {
    href: '/apps',
    label: 'App Store',
    landingLabel: 'Open App Store',
    icon: PlugZap,
    matches: ['/apps', '/app', '/browse-apps'],
    items: [
      { href: '/apps#available-apps', label: 'Available Apps', description: 'Choose apps to install' },
      { href: '/apps#add-local-app', label: 'Add Local App', description: 'Upload your own app' },
      ...(APP_CATALOG_PAGE_ENABLED
        ? [{ href: '/browse-apps', label: 'Browse App Guides', description: 'Read optional app documentation' }]
        : []),
      ...(CONTACTS_PAGE_ENABLED
        ? [{ href: '/contacts', label: 'Contacts', description: 'Manage saved badge contacts' }]
        : []),
    ],
  },
  {
    href: '/build',
    label: 'Build',
    landingLabel: 'Open Build Guide',
    icon: Hammer,
    matches: ['/build', '/simulator', '/editor', '/hacks', '/hack'],
    items: [
      { href: '/build/app', label: 'Copilot App', description: 'Build in the desktop app' },
      { href: '/build/vscode', label: 'VS Code', description: 'Build with Copilot Chat' },
      { href: '/build/cli', label: 'Copilot CLI', description: 'Build from a terminal' },
      { href: '/simulator', label: 'Developer Simulator', description: 'Edit MonaOS live in the browser' },
      { href: '/hacks', label: 'Start From a Hack', description: 'Follow a prepared project' },
    ],
  },
]

export function Navigation() {
  const [pathname, setPathname] = useState('/')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileOpenGroup, setMobileOpenGroup] = useState<string | null>(null)
  const [desktopOpenGroup, setDesktopOpenGroup] = useState<string | null>(null)

  useEffect(() => {
    setPathname(window.location.pathname)
  }, [])

  useEffect(() => {
    if (!mobileOpen && !desktopOpenGroup) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMobileOpen(false)
      setMobileOpenGroup(null)
      setDesktopOpenGroup(null)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [desktopOpenGroup, mobileOpen])

  const pathMatches = (path: string) => pathname === path || pathname.startsWith(`${path}/`)
  const isGroupActive = (group: NavigationGroup) => group.matches.some(pathMatches)
  const activeGroupHref = navigationGroups.find(isGroupActive)?.href ?? null
  const closeMobileMenu = () => {
    setMobileOpen(false)
    setMobileOpenGroup(null)
  }
  const toggleMobileMenu = () => {
    const nextOpen = !mobileOpen
    setMobileOpen(nextOpen)
    setMobileOpenGroup(nextOpen ? activeGroupHref : null)
  }

  return (
    <nav aria-label="Primary navigation" className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/95">
      <div className="container flex h-[4.5rem] items-center justify-between gap-6">
        <a href="/" className="group flex shrink-0 items-center gap-3" aria-label="Badger home">
          <img src="/favicon.svg" alt="" className="h-9 w-9 transition-opacity duration-150 group-hover:opacity-80" />
          <span className="font-display text-2xl font-semibold tracking-tight">Badger</span>
        </a>

        <div className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex">
          {navigationGroups.map((group) => {
            const active = isGroupActive(group)
            const open = desktopOpenGroup === group.href
            const Icon = group.icon
            return (
              <div
                key={group.href}
                className="relative"
                onMouseEnter={() => setDesktopOpenGroup(group.href)}
                onMouseLeave={() => setDesktopOpenGroup((current) => current === group.href ? null : current)}
                onFocusCapture={() => setDesktopOpenGroup(group.href)}
                onBlurCapture={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setDesktopOpenGroup((current) => current === group.href ? null : current)
                  }
                }}
              >
                <a
                  href={group.href}
                  aria-current={pathname === group.href ? 'page' : undefined}
                  aria-expanded={open}
                  data-active={active}
                  className="site-nav-link inline-flex items-center gap-2 rounded-md px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-primary/5 hover:text-foreground focus-visible:bg-primary/5 focus-visible:text-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {group.label}
                  <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                </a>
                <div className={`absolute left-1/2 top-full w-80 -translate-x-1/2 pt-2 transition-[opacity,visibility] duration-150 ${open ? 'visible opacity-100' : 'invisible pointer-events-none opacity-0'}`}>
                  <div className="rounded-lg border border-border/80 bg-popover p-2">
                    {group.items.map((item) => (
                      <a
                        key={item.href}
                        href={item.href}
                        className="block rounded-md px-3 py-2.5 transition-colors hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:outline-none"
                      >
                        <span className="block font-mono text-xs uppercase tracking-[0.1em] text-foreground">{item.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description}</span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <span className="hidden xl:block"><GitHubRepoBadge repo="badger/home" /></span>
          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={toggleMobileMenu}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground lg:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            <span className="sr-only">{mobileOpen ? 'Close menu' : 'Open menu'}</span>
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div id="mobile-navigation" className="container max-h-[calc(100dvh-4.5rem)] overflow-y-auto overscroll-contain border-t border-border/60 py-3 lg:hidden">
          <div className="grid gap-2">
            {navigationGroups.map((group) => {
              const active = isGroupActive(group)
              const Icon = group.icon
              return (
                <details
                  key={group.href}
                  className="group/mobile rounded-lg border border-border/60 bg-card/50"
                  open={mobileOpenGroup === group.href}
                  onToggle={(event) => {
                    if (event.currentTarget.open) setMobileOpenGroup(group.href)
                    else setMobileOpenGroup((current) => current === group.href ? null : current)
                  }}
                >
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden">
                    <span
                      data-active={active}
                      className="inline-flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground data-[active=true]:text-primary"
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {group.label}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-150 group-open/mobile:rotate-180" aria-hidden="true" />
                  </summary>
                  <div className="grid gap-1 border-t border-border/50 p-2">
                    <a
                      href={group.href}
                      onClick={closeMobileMenu}
                      className="rounded-md px-3 py-2.5 font-mono text-xs uppercase tracking-[0.1em] text-primary transition-colors hover:bg-primary/5"
                    >
                      {group.landingLabel}
                    </a>
                    {group.items.map((item) => (
                      <a
                        key={item.href}
                        href={item.href}
                        onClick={closeMobileMenu}
                        className="rounded-md px-3 py-2.5 transition-colors hover:bg-primary/5"
                      >
                        <span className="block font-mono text-xs uppercase tracking-[0.1em] text-foreground">{item.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description}</span>
                      </a>
                    ))}
                  </div>
                </details>
              )
            })}
          </div>
        </div>
      )}
    </nav>
  )
}
