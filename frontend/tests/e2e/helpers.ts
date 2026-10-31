import { expect, type Page, test as base } from '@playwright/test';
import { buildSeed } from '../fixtures/seed';
import { randomUUID } from 'node:crypto';

/** Fails the test on any console error or uncaught exception; stubs Google Fonts so offline runs stay clean. */
export const test = base.extend<{ errors: string[] }>({
  errors: async ({ page }, use) => {
    const errors: string[] = [];
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await use(errors);
    expect(errors, 'console errors').toEqual([]);
  },
});
export { expect };

export function uniqueEmail() {
  return `user-${randomUUID()}@example.com`;
}

export async function signUp(page: Page, opts: { name?: string; email?: string; password?: string } = {}) {
  const email = opts.email ?? uniqueEmail();
  const password = opts.password ?? 'Secret123!';
  await page.goto('/signup');
  await page.getByLabel('Username').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding');
  return { email, password };
}

/** Sign up and finish onboarding. `sample` loads the test fixture workspace. */
export async function signUpAndOnboard(page: Page, opts: { sample?: boolean; project?: string; notes?: string } = {}) {
  const creds = await signUp(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Project name').fill(opts.project ?? 'Final report for Data Structures');
  if (opts.notes) await page.getByLabel(/Notes/).fill(opts.notes);
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.waitForURL(/\/projects\//);
  await page.getByRole('button', { name: 'Skip tour' }).click();
  await page.goto('/');
  if (opts.sample) await loadFixture(page);
  return creds;
}

/**
 * Test-only: writes a realistic workspace (5 active projects, history, slipped tasks)
 * straight into localStorage for the signed-in user, then reloads.
 */
export async function loadFixture(page: Page) {
  const userId = await page.evaluate(() => {
    const raw = localStorage.getItem('nt:v1:session') ?? sessionStorage.getItem('nt:v1:session');
    return raw ? (JSON.parse(raw) as { userId: string }).userId : '';
  });
  expect(userId).not.toBe('');
  const seed = buildSeed(userId, new Date());
  await page.evaluate(({ seed, userId }) => {
    const add = (key: string, items: unknown[]) => {
      const cur = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify([...cur, ...items]));
    };
    add('nt:v1:projects', seed.projects);
    add('nt:v1:tasks', seed.tasks);
    add('nt:v1:sessions', seed.sessions);
    const metas = JSON.parse(localStorage.getItem('nt:v1:meta') || '[]');
    metas.forEach((m: { userId: string; lastAutoReplanAt?: string }) => {
      if (m.userId === userId) m.lastAutoReplanAt = new Date().toISOString();
    });
    localStorage.setItem('nt:v1:meta', JSON.stringify(metas));
  }, { seed, userId });
  await page.reload();
}

export const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Main' });
