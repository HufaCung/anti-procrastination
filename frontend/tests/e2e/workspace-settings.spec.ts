import { test, expect, signUpAndOnboard } from './helpers';

test('translates the workspace without rewriting user content, syncs work hours and deletes the account', async ({ page }) => {
  const project = 'Meet Mon about May report';
  const title = 'Today and Fri are part of this title';
  const { password } = await signUpAndOnboard(page, { project });
  const nav = page.locator('nav').filter({ has: page.getByRole('link', { name: 'Dashboard', exact: true }) });
  await nav.getByRole('link', { name: new RegExp(project) }).click();
  await page.getByLabel('New task title').fill(title);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('textbox', { name: `Task title: ${title}` })).toHaveValue(title);
  const projectUrl = page.url();

  await page.goto('/profile');
  await page.getByRole('radiogroup', { name: 'Language' }).getByRole('radio', { name: 'VI' }).first().click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.getByRole('heading', { name: 'Tập trung và lập kế hoạch' })).toBeVisible();
  await page.getByLabel('Bắt đầu', { exact: true }).fill('10:00');
  await page.getByLabel('Kết thúc', { exact: true }).fill('17:00');
  await page.getByRole('checkbox', { name: 'Thứ bảy' }).check();
  await page.getByRole('button', { name: 'Lưu lịch làm việc' }).click();
  await expect(page.getByTestId('sync-status')).toHaveText('Đã đồng bộ mọi thay đổi');

  const { token, userId } = await page.evaluate(() => ({
    token: localStorage.getItem('nt:v1:token'),
    userId: JSON.parse(localStorage.getItem('nt:v1:session')!).userId,
  }));
  const settings = await page.request.get('/api/settings', { headers: { Authorization: `Bearer ${token}` } });
  expect((await settings.json()).settings).toMatchObject({ workStartMin: 600, workEndMin: 1020, daysOffMask: 64 });

  await page.goto(projectUrl);
  await expect(page.getByRole('heading', { name: project, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chia nhỏ công việc' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: `Tên công việc: ${title}` })).toHaveValue(title);
  await page.goto('/progress');
  await expect(page.getByRole('heading', { name: 'Tiến độ dự án và rủi ro trễ hạn' })).toBeVisible();
  await page.goto('/calendar');
  await expect(page.getByRole('button', { name: 'Tháng sau' })).toBeVisible();
  await page.goto('/focus');
  await expect(page.getByRole('heading', { name: 'Chọn một việc trong danh sách hoặc bắt đầu tập trung tự do' })).toBeVisible();
  await page.goto('/profile');
  await expect(page.getByLabel('Bắt đầu', { exact: true })).toHaveValue('10:00');
  await expect(page.getByRole('checkbox', { name: 'Thứ bảy' })).toBeChecked();

  await page.getByRole('button', { name: 'Xóa tài khoản', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Xóa tài khoản' });
  await dialog.getByLabel('Mật khẩu hiện tại').fill(password);
  await dialog.getByRole('button', { name: 'Xóa tài khoản', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate((id) => {
    const collections = ['users', 'projects', 'tasks', 'sessions', 'settings', 'meta'];
    return collections.every(key => !localStorage.getItem(`nt:v1:${key}`)?.includes(id))
      && !localStorage.getItem(`nt:sync:${id}`) && !localStorage.getItem('nt:v1:token');
  }, userId)).toBe(true);
  expect((await page.request.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(401);
  await page.getByRole('radio', { name: 'EN' }).first().click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});
