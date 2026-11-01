import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.TINYDO_TEST_DATABASE) throw new Error('Run npm run test:features from the repository root.');
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['features.spec.ts', 'admin.spec.ts'],
  timeout: 60_000,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/features', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    timezoneId: 'Asia/Ho_Chi_Minh',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run admin:create --workspace=backend && node backend/dist/server.js', cwd: root,
      url: 'http://127.0.0.1:3002/api/health', reuseExistingServer: false,
      env: { PORT: '3002', NODE_ENV: 'development', DATABASE_PATH: process.env.TINYDO_TEST_DATABASE, ADMIN_USERNAME: 'admin-e2e', ADMIN_PASSWORD: process.env.TINYDO_TEST_ADMIN_PASSWORD || '' },
    },
    {
      command: 'npx vite preview --host 127.0.0.1 --port 4174 --strictPort', cwd: path.join(root, 'frontend'),
      url: 'http://127.0.0.1:4174', reuseExistingServer: false,
      env: { TINYDO_API_URL: 'http://127.0.0.1:3002' },
    },
  ],
});
