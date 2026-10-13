import { defineConfig, devices } from '@playwright/test';

const PORT = 4322;

/** Offline/PWA checks run against the production build (service workers need it). */
export default defineConfig({
  testDir: 'tests/offline',
  timeout: 120_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}/`, viewport: { width: 1180, height: 820 } },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1180, height: 820 } } }],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
