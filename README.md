# Badger Catalog 🚀

A utilitarian catalog of hacks, apps, and documentation for the Badger 2350. Built with Astro, React, TypeScript, and Tailwind CSS for fast iteration and easy contributions.

## ✨ Features

- **🎨 Purposeful UI** – Terminal-inspired dark theme with subtle neon accents
- **📚 Comprehensive Catalog** – Browse hacks by difficulty, duration, and tags
- **📖 Detailed Tutorials** – Step-by-step guides with runnable code snippets
- **📝 MDX Content** – Markdown-first authoring with React components when needed
- **🚀 Static Site** – Optimised for GitHub Pages or any static host

## App store and editor routes

The **Apps** tab opens `/apps`, which contains the app store and USB/disk tools.
Old `/edit` links redirect to `/apps`. The optional app-browsing catalog lives at
`/browse-apps`. The Bluetooth editor is disabled by default.

## Build routes

`/build` lists the build paths. The Copilot guides are at `/build/app`,
`/build/vscode`, and `/build/cli`, with Windows and macOS instructions together.
Shared steps live in `src/components/build-guide-*.astro`; tool-specific content
lives in `src/content/build-guides/`. Old tool and platform fragment links redirect
to the matching guide.

## 🛠️ Tech Stack

- **Framework**: [Astro](https://astro.build/)
- **UI**: [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Components**: [shadcn/ui](https://ui.shadcn.com/)
- **Icons**: [Lucide](https://lucide.dev/)
- **Content**: [MDX](https://mdxjs.com/)

## 🚦 Quick Start

### Prerequisites

- Node.js 22.6.0 or newer
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/badger/badger.github.io.git
   cd badger.github.io
   ```
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Start the development server**
   ```bash
   npm run dev
   ```
4. **Open the app**
   ```
   http://localhost:4321/
   ```

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview the production build
npm run astro        # Run Astro CLI commands
```

## App store descriptions

The `/apps/` app store uses descriptions generated from the first sentence of
each app's `README.md` in `badger/home`. App downloads also come from
`badger/home`; descriptions on `/browse-apps/` and individual app
pages still come from local app content.
The store excludes the `menu` and `startup` system apps and the `quest` app.

To update descriptions:

1. Edit the app's `README.md` in `badger/home` so its first paragraph starts with
   one plain-text sentence.
2. After the change merges to `main`, the nightly `Update app descriptions`
   workflow reads `badger/home` and opens a pull request here. To run it by hand, use `workflow_dispatch` or run
   `npm run sync:app-descriptions` on a website working branch.
3. Run `npm run test:app-descriptions` and `npm run build`, then submit the saved
   website changes through a pull request.

The update command requires Node.js 22.6.0 or newer. It reads the file tree and
READMEs from the public `badger/home` repository (`APPS_REF` selects a branch or
commit, default `main`). Apps without a usable README keep their saved
description. Folders that do not match the lowercase key rule
(`^[a-z0-9][a-z0-9_-]*$`, such as `Copilot`) get no description. Invalid or
incomplete updates fail with a clear error and leave the last good copy
unchanged.

Do not edit `src/data/app-descriptions.json` by hand. It is the generated website
copy used by normal builds and deployment. A newly added store app remains
installable and is listed without a description until the descriptions are
updated.

## 📁 Project Structure

```
badger.github.io/
├── public/
│   ├── images/          # Static images and assets
│   └── favicon.svg
├── src/
│   ├── components/      # React components
│   │   ├── ui/          # shadcn/ui primitives
│   │   ├── hack-card.tsx
│   │   ├── navigation.tsx
│   │   └── ...
│   ├── content/         # MDX content collections
│   ├── layouts/         # Astro layouts
│   ├── lib/             # Utilities
│   ├── pages/           # Astro routes
│   └── styles/          # Global styles
├── astro.config.mjs
├── tailwind.config.mjs
└── package.json
```

## ✏️ Adding New Hacks

1. **Create a new MDX file** in `src/content/hacks/your-hack-name.mdx`
2. **Add assets** to `public/images/hacks/`
3. **Preview locally** with `npm run dev`

Each MDX document supports frontmatter for metadata:

```mdx
---
title: "Your Hack Title"
description: "Brief description of what this hack does"
difficulty: "easy" # easy | medium | hard
duration: 30 # minutes
tags: ["LED", "WiFi", "Sensors"]
thumbnail: "/images/hacks/your-hack.jpg"
author: "Your Name"
date: "2025-01-15"
hardware:
  - "Badger 2350"
  - "Additional components..."
github: "https://github.com/your-repo/hack-code"
---
```

## 🎨 Customising the Design

- Update tokens in `tailwind.config.mjs`
- Extend typography and utilities in `src/styles/globals.css`
- Component overrides live in `src/components/ui/`

## 🚀 Deployment

### GitHub Pages

The production Doom page is `https://badger.github.io/virtual/`. Use HTTPS:
Doom's asset integrity checks require Web Crypto in a secure context (localhost
also works). Enable **Enforce HTTPS** in the repository's Pages settings so
`http://badger.github.io/virtual` redirects to HTTPS.

The deployment workflow reads `SITE_URL` and `BASE_PATH` from GitHub Pages;
no fork owner or custom domain belongs in the source. Local builds default to
`https://badger.github.io` with base `/`. To check a fork's project-site build:

```bash
SITE_URL=https://example.github.io BASE_PATH=/badger.github.io/ npm run build
node scripts/verify-site-paths.mjs /badger.github.io/ https://example.github.io
```

CI checks both the production root and a fork subpath, including the absolute
sharing image URL. Badge model source credits are external provenance links,
not deployment URLs.

1. Configure Astro:
   ```js
   export default defineConfig({
     site: 'https://badger.github.io',
     base: '/',
     // ...
   })
   ```
2. Build the project:
   ```bash
   npm run build
   ```
3. Push to `main` (GitHub Pages is already wired for this repo).

## 🤝 Contributing

1. Fork the repo: `https://github.com/badger/badger.github.io/fork`
2. Create a feature branch: `git checkout -b feature/my-update`
3. Make changes and run `npm run build`
4. Commit, push, and open a pull request

### Community Links

- 🐛 **Issues**: <https://github.com/badger/badger.github.io/issues>

## 📄 License

Website code is MIT licensed; see [LICENSE](LICENSE). Bundled third-party
software and assets retain their own licenses.

### Doom easter egg

Visit https://badger.github.io/virtual for a surpise :godmode:

### Doom licensing

The `/virtual/` page includes two separately licensed components:

- **Engine:** WebSockets Doom / Chocolate Doom and its browser adapter are
  GPLv2 software, not MIT. See the bundled [GPLv2 text](public/doom/runtime/COPYING.txt)
  and [corresponding source, local patch, and rebuild instructions](public/doom/runtime/SOURCE.md).
- **Game data:** `DOOM1.WAD` is the original, unmodified Doom 1 v1.9 shareware
  episode, copyright id Software. It is **not GPL, freeware, or public domain**.
  Redistribution is governed by the [original limited-use shareware license](public/doom/licenses/DOOM1-SHAREWARE.txt),
  which permits free copies but prohibits charging for receipt or use without
  id Software's prior written consent. Commercial `DOOM.WAD` and `DOOM2.WAD`
  data are not included.

See [Doom asset documentation](public/doom/README.md) and
[third-party notices](public/doom/THIRD_PARTY.md) for provenance and verification
details. DOOM and associated trademarks belong to their respective owners.
This unofficial integration is not affiliated with or endorsed by id Software,
Bethesda Softworks, or Microsoft.

## 🙏 Acknowledgements

- Built for the Badger 2350 community
- Powered by open source contributors and hardware experimenters everywhere

---

**Keep shipping badge hacks.**
