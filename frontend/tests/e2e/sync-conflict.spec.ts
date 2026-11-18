import { test, expect, signUpAndOnboard, sidebar } from './helpers';

test('backs up unsynced edits and resumes from the current server snapshot', async ({ page }) => {
  await signUpAndOnboard(page, { project: 'Server project' });
  await expect(page.getByTestId('sync-status')).toHaveText('All changes synced');
  const token = await page.evaluate(() => localStorage.getItem('nt:v1:token'));
  const update = await page.request.patch('/api/settings', {
    headers: { Authorization: `Bearer ${token}` },
    data: { dailyGoalMin: 240 },
  });
  expect(update.ok()).toBe(true);
  await page.evaluate(() => {
    const projects = JSON.parse(localStorage.getItem('nt:v1:projects')!);
    projects[0].name = 'Unsynced edit';
    localStorage.setItem('nt:v1:projects', JSON.stringify(projects));
  });

  await page.reload();
  await expect(sidebar(page).getByRole('link', { name: /Unsynced edit/ })).toBeVisible();
  await page.getByRole('button', { name: 'Resolve sync conflict' }).click();
  const dialog = page.getByRole('dialog', { name: 'Resolve sync conflict' });
  await expect(dialog).toBeVisible();
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Back up and use server data' }).click();
  expect((await download).suggestedFilename()).toMatch(/^tinydo-local-backup-\d+\.json$/);
  await expect(sidebar(page).getByRole('link', { name: /Server project/ })).toBeVisible();
  await expect(page.getByTestId('sync-status')).toHaveText('All changes synced');
  const backup = await page.evaluate(() => {
    const { userId } = JSON.parse(localStorage.getItem('nt:v1:session')!);
    return JSON.parse(localStorage.getItem(`nt:sync-backup:${userId}`)!).projects[0].name;
  });
  expect(backup).toBe('Unsynced edit');
  await page.goto('/profile');
  await expect(page.getByTestId('goal')).toHaveText('4h / day');
});
