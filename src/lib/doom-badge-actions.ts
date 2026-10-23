export const doomBadgeActions = [
  { bit: 16, position: 'Left', label: 'r/itrunsdoom', href: 'https://www.reddit.com/r/itrunsdoom/', kind: 'link' },
  { bit: 8, position: 'Middle', label: 'Can it run Doom?', href: 'https://canitrundoom.org/', kind: 'link' },
  { bit: 4, position: 'Right', label: 'Doom source', href: 'https://github.com/id-Software/DOOM', kind: 'link' },
  { bit: 2, position: 'Up', label: 'Play video', href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', kind: 'video' },
  { bit: 1, position: 'Down', label: 'Universe', href: 'https://githubuniverse.com/?utm_source=GitHub&utm_medium=Site&utm_campaign=virtual_badge_uni_26', kind: 'link' },
] as const

export type DoomBadgeAction = typeof doomBadgeActions[number]
