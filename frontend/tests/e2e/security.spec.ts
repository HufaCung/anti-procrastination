import type { Page } from '@playwright/test';
import type { AppData } from '../../src/data/types';
import { test, expect, signUpAndOnboard, sidebar } from './helpers';

async function workspace(page: Page): Promise<AppData> {
  return page.evaluate(async () => {
    const token = localStorage.getItem('nt:v1:token') || sessionStorage.getItem('nt:v1:token');
    return (await (await fetch('/api/data', { headers: { Authorization: `Bearer ${token}` } })).json()).data;
  });
}
async function ready(page: Page) {
  const credentials = await signUpAndOnboard(page, { project: 'Security project' });
  await expect(page.getByTestId('sync-status')).toHaveText('All changes synced');
  await sidebar(page).getByRole('link', { name: /Security project/ }).click();
  return credentials;
}
async function addTask(page: Page, title: string) {
  await page.getByLabel('New task title').fill(title);
  await page.getByLabel('New task title').press('Enter');
}

test('browser cache contains no password hash and changing password replaces the revoked JWT', async ({ page }) => {
  const credentials = await ready(page);
  await page.evaluate(() => {
    const profiles = JSON.parse(localStorage.getItem('nt:v1:users')!);
    profiles[0].passwordHash = 'legacy-cached-hash';
    localStorage.setItem('nt:v1:users', JSON.stringify(profiles));
  });
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem('nt:v1:users'))).not.toContain('passwordHash');
  const oldToken = await page.evaluate(() => localStorage.getItem('nt:v1:token'));
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Change password', exact: true }).click();
  await page.getByLabel('Current password', { exact: true }).fill(credentials.password);
  await page.getByLabel('New password', { exact: true }).fill('Updated-password-123!');
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(page.getByText('Password changed', { exact: true })).toBeVisible();
  const result = await page.evaluate(async old => {
    const token = localStorage.getItem('nt:v1:token');
    const revoked = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${old}` } });
    const current = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    return { revoked: revoked.status, current: current.status, different: token !== old, profiles: localStorage.getItem('nt:v1:users') };
  }, oldToken);
  expect(result).toMatchObject({ revoked: 401, current: 200, different: true });
  expect(result.profiles).not.toContain('passwordHash');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Profile & settings', exact: true })).toBeVisible();
});

test('transient sync failures retry automatically and send the latest local edits', async ({ page }) => {
  await ready(page);
  let failures = 0;
  await page.route('**/api/data', route => {
    if (route.request().method() === 'PUT' && failures++ < 2) return route.abort();
    return route.continue();
  });
  await addTask(page, 'Retry task one');
  await expect(page.getByTestId('sync-status')).toContainText('Retrying');
  await addTask(page, 'Retry task two');
  await expect(page.getByTestId('sync-status')).toHaveText('All changes synced', { timeout: 15000 });
  const data = await workspace(page);
  expect(data.tasks.map(task => task.title)).toEqual(expect.arrayContaining(['Retry task one', 'Retry task two']));
});

test('sync retries are bounded and the Retry sync button recovers without a reload', async ({ page }) => {
  await ready(page);
  let attempts = 0;
  let fail = true;
  await page.route('**/api/data', route => {
    if (route.request().method() === 'PUT' && fail) { attempts++; return route.abort(); }
    return route.continue();
  });
  await addTask(page, 'Saved after manual retry');
  await expect(page.getByRole('button', { name: 'Retry sync', exact: true })).toBeVisible({ timeout: 15000 });
  expect(attempts).toBe(4);
  await page.waitForTimeout(1100);
  expect(attempts).toBe(4);
  fail = false;
  await page.getByRole('button', { name: 'Retry sync', exact: true }).click();
  await expect(page.getByTestId('sync-status')).toHaveText('All changes synced');
  expect((await workspace(page)).tasks.some(task => task.title === 'Saved after manual retry')).toBe(true);
});

test('initial load failures keep local edits and recover when the browser reconnects', async ({ page }) => {
  await ready(page);
  let fail = true;
  await page.route('**/api/data', route => {
    if (route.request().method() === 'GET' && fail) return route.abort();
    return route.continue();
  });
  await page.reload();
  await expect(page.getByLabel('New task title')).toBeVisible();
  await addTask(page, 'Edited while initial fetch failed');
  fail = false;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByTestId('sync-status')).toHaveText('All changes synced', { timeout: 15000 });
  expect((await workspace(page)).tasks.some(task => task.title === 'Edited while initial fetch failed')).toBe(true);
});

test('a real revision conflict keeps both server data and the unsynced local copy', async ({ page }) => {
  await ready(page);
  await page.evaluate(async () => {
    const token = localStorage.getItem('nt:v1:token');
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    const snapshot = await (await fetch('/api/data', { headers })).json();
    snapshot.data.projects[0].name = 'Newer server project';
    const result = await fetch('/api/data', { method: 'PUT', headers, body: JSON.stringify(snapshot) });
    if (!result.ok) throw new Error('Could not prepare conflict');
  });
  let writes = 0;
  await page.route('**/api/data', route => {
    if (route.request().method() === 'PUT') writes++;
    return route.continue();
  });
  await addTask(page, 'Local conflict task');
  await expect(page.getByTestId('sync-status')).toContainText('server has newer data');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await addTask(page, 'Another local conflict task');
  await page.waitForTimeout(1100);
  expect(writes).toBe(1);
  const remote = await workspace(page);
  expect(remote.projects[0].name).toBe('Newer server project');
  expect(remote.tasks).toHaveLength(0);
  expect(await page.evaluate(() => localStorage.getItem('nt:v1:tasks'))).toContain('Local conflict task');
});

test('validation errors are not automatically retried', async ({ page }) => {
  await ready(page);
  let writes = 0;
  await page.route('**/api/data', route => {
    if (route.request().method() === 'PUT') {
      writes++;
      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid data' }) });
    }
    return route.continue();
  });
  await addTask(page, 'Rejected task stays local');
  await expect(page.getByRole('button', { name: 'Retry sync', exact: true })).toBeVisible();
  await page.waitForTimeout(1100);
  expect(writes).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('nt:v1:tasks'))).toContain('Rejected task stays local');
});
