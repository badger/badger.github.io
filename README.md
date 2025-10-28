# Badger Catalog 🚀

A utilitarian catalog of hacks, apps, and documentation for the Badger 2350. Built with Astro, React, TypeScript, and Tailwind CSS for fast iteration and easy contributions.

## ✨ Features

- **🎨 Purposeful UI** – Terminal-inspired dark theme with subtle neon accents
- **📚 Comprehensive Catalog** – Browse hacks by difficulty, duration, and tags
- **📖 Detailed Tutorials** – Step-by-step guides with runnable code snippets
- **📝 MDX Content** – Markdown-first authoring with React components when needed
- **🚀 Static Site** – Optimised for GitHub Pages or any static host

## 🛠️ Tech Stack

- **Framework**: [Astro](https://astro.build/)
- **UI**: [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Components**: [shadcn/ui](https://ui.shadcn.com/)
- **Icons**: [Lucide](https://lucide.dev/)
- **Content**: [MDX](https://mdxjs.com/)

## 🚦 Quick Start

### Prerequisites

- Node.js 22+
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
