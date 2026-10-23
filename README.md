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

## App store catalog and descriptions

The `/apps/` app store reads `/app-catalog.json` from this website, not GitHub's
REST API. Reload reads the currently published catalog; it does not start a
workflow. App downloads still come from public `badger/home`, using the exact
commit recorded in the catalog so file lists and downloaded code match.

Each deployment reads the latest `badger/home/main` file tree and app READMEs,
then generates the catalog and `src/data/app-descriptions.json` in its build
workspace. The latter also supplies descriptions in the Developer Simulator.
Descriptions use the first sentence of each app's README. Descriptions on
`/browse-apps/` and individual app pages still come from local app content.
The store excludes `menu`, `startup`, and `quest`.

After the companion workflow is configured in `badger/home`, a push to its
`main` branch that changes `badge/apps/**` starts this site's `Deploy` workflow.
This includes fixes to existing apps, new or removed files, and README changes.
It does not require a release or tag. Catalog refreshes publish build output
without data commits or data-update PRs. Website source changes still use PRs.
Until that setup is complete, an authorized maintainer can run `Deploy` manually
on `main`. A failed generation or build does not replace the published site.

### Cross-repository setup

Use a dedicated organization-owned GitHub App installed only on
`badger/badger.github.io`, with repository **Actions: read and write** permission.
The companion workflow creates a short-lived installation token only to start
`deploy.yml` on `main`; it does not check out or execute badge-app code.

An administrator must configure a `catalog-sync` environment in `badger/home`,
restricted to the `main` branch, and protect workflow changes through review.
Add the App's non-secret Client ID as the environment variable
`CATALOG_APP_CLIENT_ID` and its private key as the environment secret
`CATALOG_APP_PRIVATE_KEY`. Do not add content-write or administration permissions,
install the App across all repositories, or put the key in code, logs, artifacts,
or browser files. Restrict the website's Pages environment to deployments from
`main` too. Follow the organization's approval requirements.

The private key remains sensitive even though each installation token is
temporary. Keep it protected and replace it if exposed. To stop automatic
updates, disable the companion workflow or revoke the App's access.

### Local catalog updates

Normal local builds use the saved catalog and do not need the GitHub App.
To refresh it, use a checkout of public `badger/home`:

```bash
npm run sync:app-catalog -- /path/to/home
npm run test:app-descriptions
npm run test:app-catalog
npm run build
```

The generator reads committed files at that checkout's `HEAD`, not uncommitted
edits. Only the Git file tree and app READMEs are needed; a sparse checkout is
sufficient. It does not download or execute app code. Apps without a usable
README keep their saved description. Existing folders outside the lowercase
description-key rule (`^[a-z0-9][a-z0-9_-]*$`, such as `Copilot`) remain
installable without a generated description.

Do not edit `public/app-catalog.json` or `src/data/app-descriptions.json` by hand.
Both are generated from the same public source commit. Invalid or incomplete
updates fail before replacing the generated files.

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

MIT License. See [LICENSE](LICENSE).

## 🙏 Acknowledgements

- Built for the Badger 2350 community
- Powered by open source contributors and hardware experimenters everywhere

---

**Keep shipping badge hacks.**
