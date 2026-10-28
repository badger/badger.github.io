export const doomBadgeActions = [
  { bit: 16, position: 'Left', label: 'Doom source', href: 'https://github.com/id-software/doom', kind: 'link' },
  { bit: 8, position: 'Middle', label: 'Universe', href: 'https://github.com/events/universe/recap?utm_source=virtual-badge&utm_medium=web&utm_campaign=universe-2026', kind: 'link' },
  { bit: 4, position: 'Right', label: 'Can it run Doom?', href: 'https://canitrundoom.org/', kind: 'link' },
  { bit: 2, position: 'Up', label: 'Made with Copilot', kind: 'terminal' },
  { bit: 1, position: 'Down', label: 'Play video', href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', kind: 'video' },
] as const

export type DoomBadgeAction = typeof doomBadgeActions[number]
