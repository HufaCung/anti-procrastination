import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const possibleBrowsers = [
  '/opt/pw-browsers/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];
const foundBrowser = possibleBrowsers.find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || foundBrowser || undefined;

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:4173';

export default defineConfig({
  testDir: path.join(__dirname, 'tests/e2e'),
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
    : [
        {
          command: 'node backend/dist/server.js',
          url: 'http://localhost:3001/api/health',
          cwd: path.resolve(__dirname, '..'),
          reuseExistingServer: true,
          timeout: 30_000,
        },
        {
          command: 'npm run build && npx vite preview --port 4173 --strictPort',
          url: 'http://localhost:4173',
          cwd: __dirname,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      ],
});
