import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

// The PWA plugin (vite-plugin-pwa) is added by the PWA issue; see docs/architecture/07-platform.md.
export default defineConfig({
  plugins: [preact()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
  },
  worker: {
    format: 'es',
  },
});
