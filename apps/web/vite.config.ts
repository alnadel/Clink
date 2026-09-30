import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Docs: architecture/07-platform.md. The service worker precaches the app, World 1 art and all audio;
// level packs and the manifest are cached at runtime (packs are immutable, the manifest is network-first).
export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // registered by src/platform/sw.ts
      manifest: {
        name: 'Clink',
        short_name: 'Clink',
        description: 'A puzzle you can hear: pour water into glasses to tune them to a melody.',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,woff2,svg,png,webp,wav}',
          'audio/glass/*',
          'audio/sfx/*',
          'art/w1/**',
        ],
        globIgnores: ['art/w2/**', 'art/w3/**', 'content/**', 'config.json', 'og.png'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/content\//, /^\/config\.json$/, /^\/audio\//, /^\/art\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname === '/config.json' || url.pathname === '/content/manifest.json',
            handler: 'NetworkFirst',
            options: { cacheName: 'clink-live', networkTimeoutSeconds: 3 },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/content/packs/'),
            handler: 'CacheFirst',
            options: { cacheName: 'clink-packs', expiration: { maxEntries: 40 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/art/') || url.pathname.startsWith('/audio/'),
            handler: 'CacheFirst',
            options: { cacheName: 'clink-assets', expiration: { maxEntries: 200 } },
          },
        ],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
  },
  build: {
    target: ['es2022', 'safari16.4'],
    // Source maps are uploaded to the error tracker and removed before deploy (07 §5).
    sourcemap: 'hidden',
  },
  worker: {
    format: 'es',
  },
});
