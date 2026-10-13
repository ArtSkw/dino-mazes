import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  fullyParallel: true,
  workers: 2,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/`,
    viewport: { width: 1180, height: 820 },
    deviceScaleFactor: 2,
    locale: 'en-US',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, locale: 'en-US' } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, locale: 'en-US' } },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
