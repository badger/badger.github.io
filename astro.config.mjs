// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import rehypePrettyCode from 'rehype-pretty-code';

const prettyCodeOptions = {
  theme: {
    dark: 'github-dark-dimmed',
    light: 'github-light'
  },
  keepBackground: false,
  onVisitLine(node) {
    // Prevent lines from collapsing in `display: grid` mode, and allow empty
    // lines to be copy/pasted
    if (node.children.length === 0) {
      node.children = [{ type: 'text', value: ' ' }];
    }
  },
  onVisitHighlightedLine(node) {
    node.properties.className.push('line--highlighted');
  },
  onVisitHighlightedChars(node) {
    node.properties.className = ['chars--highlighted'];
  },
};

// https://astro.build/config
export default defineConfig({
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false,
    }),
    mdx({
      rehypePlugins: [
        [rehypePrettyCode, prettyCodeOptions]
      ],
    }),
  ],
  site: 'https://badger.github.io',
  base: '/',
  vite: {
    server: {
      // Disable caching in dev mode
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    },
    build: {
      // Add content hash to filenames for cache busting
      rollupOptions: {
        output: {
          entryFileNames: 'entry.[hash].js',
          chunkFileNames: 'chunks/chunk.[hash].js',
          assetFileNames: 'assets/asset.[hash].[ext]'
        }
      }
    }
  }
});
