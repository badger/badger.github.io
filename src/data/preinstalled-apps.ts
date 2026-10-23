// Apps pre-installed on the Universe 2026 badge, in Menu order (firmware apps/menu/app.py APP_ORDER).
// Icons are generated from the Menu's Material Symbols polygons (Apache License 2.0).

export interface PreinstalledApp {
  title: string
  description: string
  icon: string
}

// Menu tile palette (firmware apps/menu/src/ui.py PALETTE), assigned by position.
const MENU_PALETTE = [
  'rgb(88, 58, 247)',
  'rgb(22, 143, 251)',
  'rgb(15, 191, 62)',
  'rgb(247, 54, 120)',
  'rgb(192, 82, 0)',
  'rgb(187, 160, 10)',
  'rgb(8, 135, 43)',
  'rgb(255, 125, 237)',
]

const EXPEDITION_COLOR = 'rgb(140, 184, 56)'

const APPS: PreinstalledApp[] = [
  { title: 'Badge', description: 'Shows your GitHub avatar, profile and contribution graph. Set your username in Settings.', icon: 'badge' },
  { title: 'Contacts', description: 'Swap contact details with another badge and keep a list of the people you met.', icon: 'contacts' },
  { title: "Mona's Expedition", description: 'Visit Universe locations to unlock them. A beacon at each spot registers the visit.', icon: 'monas-expedition' },
  { title: 'Mona Paint', description: 'Pixel paint program in the style of Windows 98.', icon: 'mona-paint' },
  { title: 'Flappy Mona', description: 'Press to flap. Steer Mona through the gaps.', icon: 'flappy-mona' },
  { title: 'Snake', description: 'Eat, grow and avoid the walls and your own tail.', icon: 'snake' },
  { title: 'Mona Pet', description: 'Feed, play with and clean up after Mona.', icon: 'mona-pet' },
  { title: 'Rogue', description: 'Turn-based dungeon crawler. Find the gates and escape the ruins.', icon: 'rogue' },
  { title: 'Life', description: "Conway's Game of Life on a wrapping board.", icon: 'life' },
  { title: 'Merge Conflict', description: 'Head-to-head microgames against a nearby badge.', icon: 'merge-conflict' },
  { title: 'Brattal', description: 'Arena shooter. Scrap the bot before it scraps you.', icon: 'brattal' },
  { title: 'Pong', description: 'Two-player Pong against a nearby badge. Tracks wins and losses.', icon: 'pong' },
  { title: 'ISS', description: 'Tracks the International Space Station on a live world map. Needs Wi-Fi.', icon: 'iss' },
  { title: 'Mass Storage', description: 'Reboots into USB disk mode so you can copy files to the badge.', icon: 'mass-storage' },
  { title: 'Settings', description: 'Set Wi-Fi, GitHub username, contact details and backlight.', icon: 'settings' },
]

let menuIndex = 0
export const PREINSTALLED_APPS: (PreinstalledApp & { color: string; iconSrc: string })[] = APPS.map((app) => ({
  ...app,
  iconSrc: `/images/apps/2026/${app.icon}.svg`,
  color: app.icon === 'monas-expedition' ? EXPEDITION_COLOR : MENU_PALETTE[menuIndex++ % MENU_PALETTE.length],
}))

const STORE_IDS_BY_ICON: Record<string, string[]> = {
  badge: ['badge'],
  contacts: ['contacts'],
  'mona-paint': ['mona_paint'],
  'flappy-mona': ['flappy_mona'],
  snake: ['snake'],
  'mona-pet': ['mona_pet', 'monapet'],
  rogue: ['rogue'],
  life: ['life'],
  'merge-conflict': ['merge_conflict'],
  brattal: ['brattal'],
  pong: ['pong'],
  iss: ['iss'],
  'mass-storage': ['mass_storage'],
  settings: ['settings'],
}

export const PREINSTALLED_APPS_BY_STORE_ID = Object.fromEntries(
  PREINSTALLED_APPS.flatMap((app) => (STORE_IDS_BY_ICON[app.icon] ?? []).map((id) => [id, app])),
) as Record<string, (typeof PREINSTALLED_APPS)[number]>
