# Apps Update Summary

## Updated Apps (All 6)

### 1. **Mona's Quest** (monaquest)
- **Category**: Game
- **Icon**: `monaquest_icon.png`
- **Description**: Go on a quest to find all treasures at GitHub Universe. Start with hack the badge station and find instructions there.
- **File**: `/apps/monaquest`

### 2. **Monagotchi** (monagotchi)
- **Category**: Game
- **Icon**: `monagotchi_icon.png`
- **Description**: Virtual mona pet, where you can have it play, feed and clean.
- **File**: `/apps/monagotchi`

### 3. **Monasketch** (sketch)
- **Category**: Fun
- **Icon**: `sketch_icon.png`
- **Description**: Sketchpad to draw anything you want. Use up, down, left, right to draw straight lines. Use combo of up/down and left/right to draw angled lines.
- **File**: `/apps/sketch`

### 4. **Flappy Mona** (flappymona)
- **Category**: Game
- **Icon**: `flappymona_icon.png`
- **Description**: Play the flappy mona game!
- **File**: `/apps/flappymona`

### 5. **Gallery** (gallery)
- **Category**: Utility
- **Icon**: `gallery_icon.png`
- **Description**: Show all photos in the gallery, and set any photo as full screen image to show on your badge.
- **File**: `/apps/gallery`

### 6. **Badge** (badge)
- **Category**: Utility
- **Icon**: `badge_icon.png`
- **Description**: Make your screen into your badge, showing your name, photo and stats from your GitHub profile.
- **File**: `/apps/badge`

## Files Updated

### Content Files
- ✅ `src/content/apps/monaquest.mdx` - Mona's Quest app
- ✅ `src/content/apps/monagotchi.mdx` - Monagotchi app
- ✅ `src/content/apps/sketch.mdx` - Monasketch app
- ✅ `src/content/apps/flappymona.mdx` - Flappy Mona app
- ✅ `src/content/apps/gallery.mdx` - Gallery app
- ✅ `src/content/apps/badge.mdx` - Badge app (newly created)

### Placeholder Images
- ✅ `src/lib/placeholder-images.ts` - Updated with all 6 app icon placeholders

### Pages
- ✅ `src/pages/index.astro` - Now shows all 6 apps (changed from 5)
- ✅ Layout: 3-column grid on desktop, 2-column on tablet, 1-column on mobile

## Icon Naming Convention
All icons follow the pattern: `{appname}_icon.png`
- Located in: `public/images/apps/`
- Format: PNG files

## Next Steps
1. Add actual icon images to `public/images/apps/`:
   - `monaquest_icon.png`
   - `monagotchi_icon.png`
   - `sketch_icon.png`
   - `flappymona_icon.png`
   - `gallery_icon.png`
   - `badge_icon.png`

2. All apps are now fully documented with:
   - Features
   - File locations
   - How-to guides
   - Code examples
   - Tips and tricks

## Layout
- **Home Page**: 3-column responsive grid showing all 6 apps
- **Apps Page**: Same 3-column grid with "All Apps" section
- **Individual Pages**: Each app has its own detailed page at `/app/{slug}`
