export type Theme = 'dark' | 'light'

export const THEME_STORAGE_KEY = 'badger-theme'
export const DEFAULT_THEME: Theme = 'dark'

export function getStoredTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function getActiveTheme(): Theme {
  return document.documentElement.classList.contains('light') ? 'light' : 'dark'
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle('light', theme === 'light')
  root.classList.toggle('dark', theme === 'dark')
}

export function setTheme(theme: Theme) {
  applyTheme(theme)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage unavailable; theme still applies for this page view.
  }
  window.dispatchEvent(new CustomEvent<Theme>('badger-theme-change', { detail: theme }))
}
