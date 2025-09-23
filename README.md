# HackShelf 🚀

A beautiful, modern catalog of hacks and projects for the Badger 2350 device. Built with Astro, React, TypeScript, and Tailwind CSS.

![HackShelf Preview](https://via.placeholder.com/800x400/6366f1/ffffff?text=HackShelf+Preview)

## ✨ Features

- **🎨 Beautiful UI** - Clean, modern design with dark/light mode support
- **📚 Comprehensive Catalog** - Browse hacks by difficulty, duration, and tags
- **📖 Detailed Tutorials** - Step-by-step guides with code snippets and copy functionality
- **🎯 Interactive Badge Diagram** - Explore Badger 2350 features with tooltips
- **� Easy Navigation** - Intuitive layout with responsive design
- **📝 MDX Content** - Easy-to-edit content in Markdown with React components
- **🚀 Static Site** - Fast, SEO-friendly, deployable to GitHub Pages
- **♿ Accessible** - Built with accessibility best practices

## �️ Tech Stack

- **Framework**: [Astro](https://astro.build/) - Static Site Generator
- **Frontend**: [React](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Components**: [ShadCN UI](https://ui.shadcn.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Content**: [MDX](https://mdxjs.com/) with frontmatter
- **Deployment**: GitHub Pages ready

## 🚦 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/badger/hackshelf.git
   cd hackshelf
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   ```
   http://localhost:4321/hackshelf
   ```

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run astro        # Run Astro CLI commands
```

## 📁 Project Structure

```
hackshelf/
├── public/
│   ├── images/          # Static images and assets
│   └── favicon.svg
├── src/
│   ├── components/      # React components
│   │   ├── ui/         # ShadCN UI components
│   │   ├── hack-card.tsx
│   │   ├── navigation.tsx
│   │   └── ...
│   ├── content/        # MDX content files
│   │   └── hacks/      # Individual hack tutorials
│   ├── layouts/        # Astro layout components
│   ├── lib/           # Utility functions
│   ├── pages/         # Astro pages (routes)
│   └── styles/        # Global styles
├── astro.config.mjs   # Astro configuration
├── tailwind.config.mjs # Tailwind CSS configuration
└── package.json
```

## ✏️ Adding New Hacks

### 1. Create a new MDX file

Create a new file in `src/content/hacks/your-hack-name.mdx`:

```mdx
---
title: "Your Hack Title"
description: "Brief description of what this hack does"
difficulty: "easy" # easy | medium | hard
duration: 30 # in minutes
tags: ["LED", "WiFi", "Sensors"] # relevant tags
thumbnail: "/images/hacks/your-hack.jpg"
author: "Your Name"
date: "2025-01-15"
hardware:
  - "Badger 2350"
  - "Additional components..."
github: "https://github.com/your-repo/hack-code"
---

# Your Hack Title

Write your tutorial content here using Markdown and MDX syntax...

## Step 1: Setup

```python
# Your code examples
import badger2350
```

## Step 2: Implementation

More content...
```

### 2. Add images

Place hack images in `public/images/hacks/` and reference them in your MDX file.

### 3. Test locally

Run `npm run dev` to see your new hack in the catalog.

## 🎨 Customizing the Design

### Colors & Themes

Edit `tailwind.config.mjs` and `src/styles/globals.css` to customize:

- Color schemes
- Typography
- Component styles
- Dark/light mode variants

### Components

All UI components are in `src/components/ui/` using ShadCN UI. Customize or add new components as needed.

## 🚀 Deployment

### GitHub Pages

1. **Configure Astro for GitHub Pages**
   
   Update `astro.config.mjs`:
   ```js
   export default defineConfig({
     site: 'https://your-username.github.io',
     base: '/hackshelf',
     // ... other config
   })
   ```

2. **Build and deploy**
   ```bash
   npm run build
   ```

3. **Deploy to GitHub Pages**
   - Push to your repository
   - Enable GitHub Pages in repository settings
   - Set source to GitHub Actions
   - Site will be available at `https://your-username.github.io/hackshelf`

### Other Platforms

HackShelf can be deployed to any static hosting platform:
- Netlify
- Vercel  
- Cloudflare Pages
- AWS S3 + CloudFront

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](src/pages/contribute.astro) for details on:

- Adding new hacks
- Improving existing content
- Bug fixes and features
- Code style guidelines

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-hack`
3. Make your changes
4. Test locally: `npm run dev`
5. Commit with descriptive messages
6. Push and create a Pull Request

## 📄 Content Guidelines

### Hack Tutorials Should Include:

- ✅ Clear title and description
- ✅ Accurate difficulty and time estimates  
- ✅ Complete component lists
- ✅ Step-by-step instructions
- ✅ Working code examples
- ✅ Troubleshooting tips
- ✅ Safety considerations
- ✅ Photos or diagrams

### Writing Style:

- 📝 Use clear, beginner-friendly language
- 🔧 Explain technical concepts simply
- 🎯 Include practical tips and warnings
- 📸 Add visual aids when helpful
- 🔗 Link to relevant resources

## 📊 Analytics & SEO

The site includes:
- Semantic HTML for accessibility
- Meta tags for social sharing
- Structured data for search engines
- Optimized images and assets
- Fast loading times

## 🐛 Troubleshooting

### Common Issues:

**Build fails with "Cannot find module" error**
- Run `npm install` to ensure all dependencies are installed
- Check that all imports use correct paths

**Images not displaying**  
- Verify images are in `public/images/` directory
- Check image paths start with `/images/`
- Ensure image formats are web-compatible (jpg, png, webp)

**Components not working**
- Ensure client-side components have `client:load` directive
- Check for TypeScript errors in the console

## � Support & Community

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/badger/hackshelf/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/badger/hackshelf/discussions)  
- 📚 **Documentation**: [Wiki](https://github.com/badger/hackshelf/wiki)
- 💬 **Community**: [Discord](https://discord.gg/badger-community)

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for the amazing Badger 2350 community
- Inspired by maker culture and open source collaboration
- Thanks to all contributors and hack creators!

---

**Happy Hacking!** 🎉

Built with ❤️ for the Badger 2350 community
