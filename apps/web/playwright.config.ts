import { defineConfig, devices } from '@playwright/test';

// Some sandboxes ship their own Chromium; point PW_CHROMIUM_EXECUTABLE at it.
const executablePath = process.env.PW_CHROMIUM_EXECUTABLE;
const mobile = { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true };

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  webServer: {
    command:
      'pnpm -w packs:build && pnpm exec vite build --mode e2e --outDir dist-e2e && pnpm exec vite preview --outDir dist-e2e --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...mobile,
        launchOptions: executablePath ? { executablePath } : {},
      },
    },
    // WebKit is installed in CI only.
    ...(process.env.CI ? [{ name: 'webkit', use: { ...devices['Desktop Safari'], ...mobile } }] : []),
  ],
});
