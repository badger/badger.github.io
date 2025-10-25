# HackShelf UI Guidelines – Dark Hacker Aesthetic

All UI is DARK-ONLY. Remove/ignore any light mode patterns. Maintain a utilitarian, terminal-inspired feel. Avoid marketing gradients, rounded blobby ornaments, sales language, or corporate sheen.

## Core Principles
1. Monochrome + Green: Base is near-black (#010409 / hsl(210 11% 2%)). Accent is Universe Green-3 (#5FED83) used sparingly.
2. Flat + Precise: Panels are subtle layered dark greys (grey-9 → grey-8) with minimal elevation. No soft blurred frosted UI.
3. Monospace Bias: Use `font-mono` (Monaspace Neon) for interactive controls, labels, metrics, semantic tags. Display headings use `font-display`.
4. Technical Voice: Copy must be direct, instructional, terse. Avoid words like “unlock”, “amazing”, “grow”, “inspire”. Prefer “configure”, “wire”, “flash”, “pinout”, “I/O”, “example”.
5. No Light Mode Fallback: Don’t add light tokens or conditionals. Everything assumes a dark environment.
6. Motion Minimization: Only subtle opacity / shadow transitions (150–200ms). No scaling transforms except micro (translate-y for button press).
7. Honest UI: If data is missing, show placeholder monospace text (e.g. `--` or `/path/not/found`).

## Color Tokens (Dark Only)
```
background: #010409
layer-low: #101411   (grey-9)
layer-mid: #232925   (grey-8)
layer-border: #5A615C (grey-6)
text-primary: #FFFFFF
accent-green: #5FED83 (green-3)
accent-green-alt: #08872B (green-4) [rare]
error: #CF222E
muted-text: #909692 (grey-4)
muted-bg: #232925
```
Use existing CSS variables mapped to these.

### Acceptable Effects
- Grid overlay (radial or repeating) using low alpha green.
- Subtle edge glow (green 5–15% alpha) on hover for interactive panels.
- Thin 1px borders with `border-border/40` unless a stronger separation is needed.

### Forbidden
- Marketing gradients on buttons or headings.
- Neon rainbow or unrelated accent colors.
- Soft white drop shadows simulating elevation stacks.
- Large animated backgrounds (matrix-style falling code not permitted unless user explicitly asks).
- Blue/purple brand splashes from previous theme.

## Typography Rules
- Headings (h1–h2): `font-display`, tight leading.
- h3–h6: `font-mono`, uppercase, letter-spacing 0.12–0.15em depending on size.
- Body: `font-sans` for readability (Mona Sans).
- Metrics & labels: always `font-mono`.
- Avoid mixing sentence casing with uppercase in the same block.

## Components

### Buttons
- Base: border 1px `border-border/40`, transparent background.
- Hover: `border-primary/50`, bg `primary/5`.
- Active: inset shadow + slight translate-y (1px).
- Font: `font-mono` only.
- Variants kept minimal: default, outline (slightly stronger border), ghost (no border), link.
- No gradient fills.

### Cards / Panels
- Use `rounded-lg` only; avoid large radii.
- Background: layered dark gradient grey-9→grey-8 (already in `bg-card`).
- Border: 1px translucent; hover may shift border toward green.
- Title: monospace uppercase small label; content: compact vertical rhythm.

### Code Blocks
- Dark panel with slight inner green edge (pseudo-element).
- Optional header row: three dim circles or just monospace path.
- Language badge: top-right small uppercase mono (already supported).
- Inline code: no heavy background; subtle green-tinted panel.

### Lists / Tables
- Prefer monospace for column headers, small caps.
- Avoid zebra striping unless necessary for dense data.

## Copy Style
- Use imperative verbs: “Flash firmware”, “Wire LED to GP6”.
- Avoid aspirational phrases.
- Single period or no terminal punctuation for short labels.
- No exclamation marks.

## Review Checklist
- [ ] Dark-only; no conditional light tokens
- [ ] Monospace used for interactive + structural labels
- [ ] No gradients on buttons or headings
- [ ] Accent green used sparingly (not flooding UI)
- [ ] Copy is technical & concise
- [ ] Borders subtle; glow only on hover
- [ ] Code blocks have terminal feel
- [ ] No marketing phrases present

## Example Button Classes
```
<Button className="">  // relies on variant styling
variants:
  default: border border-border/40 hover:border-primary/60 hover:bg-primary/5 active:shadow-inner
```

## Future Enhancements (Optional)
- Add pinout diagram component with interactive GP label tooltips.
- Provide hardware capability matrix (power draw, I/O voltage tolerance).
- Command palette for quick navigation (e.g. type “apps”, “pins”).

Last Updated: 2025-10 (Hacker Overhaul)
