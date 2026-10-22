import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

const localChromium = '/opt/pw-browsers/chromium';
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:4173';
const executablePath = fs.existsSync(localChromium) && fs.statSync(localChromium).isFile() ? localChromium : undefined;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run build && npx vite preview --port 4173 --strictPort',
        url: 'http://localhost:4173',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
