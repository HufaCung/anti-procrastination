import { test, expect, signUpAndOnboard, sidebar } from './helpers';

test('admin login opens user statistics, search and empty results', async ({ page, errors }) => {
  void errors;
  await page.goto('/login');
  await page.getByLabel('Username', { exact: true }).fill('admin-e2e');
  await page.getByLabel('Password', { exact: true }).fill(process.env.TINYDO_TEST_ADMIN_PASSWORD!);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.waitForURL('**/admin');
  await expect(page.getByRole('heading', { name: 'Admin · Users' })).toBeVisible();
  await expect(sidebar(page).getByRole('link', { name: 'Admin users' })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByLabel('Search users', { exact: true }).fill('admin-e2e');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'admin-e2e', exact: true })).toBeVisible();
  await expect(page.getByText('Page 1 of 1 · 1 matching users')).toBeVisible();
  await page.getByLabel('Search users', { exact: true }).fill('missing-user-xyz');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('No users found', { exact: true })).toBeVisible();
});

test('regular users have no admin link and direct navigation is denied by the API', async ({ page }) => {
  await signUpAndOnboard(page);
  await expect(sidebar(page).getByRole('link', { name: 'Admin users' })).toHaveCount(0);
  const response = page.waitForResponse(response => response.url().includes('/api/admin/users'));
  await page.goto('/admin');
  expect((await response).status()).toBe(403);
  await expect(page.getByRole('alert')).toContainText('Access denied');
  await expect(page.getByRole('table')).toHaveCount(0);
});
