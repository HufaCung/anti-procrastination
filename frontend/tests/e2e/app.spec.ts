import { test, expect, signUp, signUpAndOnboard, sidebar } from './helpers';

test.describe('1–2 · auth and onboarding', () => {
  test('sign up → 2-step onboarding → project page, and the dashboard shows the new project', async ({ page, errors }) => {
    void errors;
    await signUp(page);
    await expect(page.getByText('Step 1 of 2')).toBeVisible();
    await page.getByRole('radio', { name: /3 hours/ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Step 2 of 2')).toBeVisible();
    // validation
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page.getByText('Give your project a name')).toBeVisible();
    await page.getByLabel('Project name').fill('Data Structures report');
    await page.getByLabel(/Notes/).fill('Hash tables chapter');
    await page.getByRole('button', { name: 'Create project' }).click();
    await page.waitForURL(/\/projects\//);
    await page.getByRole('button', { name: 'Skip tour' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Data Structures report' })).toBeVisible();
    await expect(page.getByText('No tasks yet')).toBeVisible();
    await expect(page.getByText(/AI|Smart breakdown/)).toHaveCount(0);
    await page.getByLabel('New task title').fill('Outline the report');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.goto('/');
    await expect(sidebar(page).getByRole('link', { name: /Data Structures report/ })).toBeVisible();
    await expect(page.locator('.dl-item', { hasText: 'Data Structures report' })).toBeVisible();
    await page.goto('/profile');
    await expect(page.getByTestId('goal')).toHaveText('3h / day');
  });

  test('step 2 can be skipped; the dashboard starts empty with no sample data', async ({ page, errors }) => {
    void errors;
    await signUp(page);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Step 2 of 2')).toBeVisible();
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await page.waitForURL((u) => u.pathname === '/');
    await page.getByRole('button', { name: 'Skip tour' }).click();
    await expect(page.getByText('Start with one project')).toBeVisible();
    await expect(page.getByRole('button', { name: /sample data/i })).toHaveCount(0);
    await expect(sidebar(page).getByText('Create your first project')).toBeVisible();
    await page.reload();
    await page.waitForURL((u) => u.pathname === '/'); // onboarding is not shown again
    await page.goto('/projects');
    await expect(page.getByText('No projects yet')).toBeVisible();
  });

  test('validation errors on sign up and log in', async ({ page, errors }) => {
    void errors;
    await page.goto('/signup');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Enter a username of 2-100 characters without spaces.')).toBeVisible();
    await expect(page.getByText('Password must be at least 8 characters.')).toBeVisible();
    // strength meter
    await page.getByLabel('Password', { exact: true }).fill('abcdefgh');
    await expect(page.getByText('Password strength: Weak')).toBeVisible();
    await page.getByLabel('Password', { exact: true }).fill('Abcdefg1!');
    await expect(page.getByText('Password strength: Strong')).toBeVisible();
    await page.getByLabel('Username').fill('validuser');
    await page.getByLabel('Confirm password').fill('different');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Passwords do not match.')).toBeVisible();
    await page.getByRole('link', { name: 'Log in' }).first().click();
    await page.getByLabel('Username').fill('nobody@example.com');
    await page.getByLabel('Password', { exact: true }).fill('wrongpass1');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('Username or password is incorrect.')).toBeVisible();
  });

  test('duplicate username is rejected', async ({ page, errors }) => {
    void errors;
    const { email } = await signUpAndOnboard(page);
    await sidebar(page).getByRole('button', { name: 'Log out' }).click();
    await page.goto('/signup');
    await page.getByLabel('Username').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('Another123');
    await page.getByLabel('Confirm password').fill('Another123');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Could not create account. The username may already be in use, or the server may be unavailable.')).toBeVisible();
  });

  test('log out → log in → data persists after reload; guards redirect', async ({ page, errors }) => {
    void errors;
    const { email, password } = await signUpAndOnboard(page, { project: 'Persist me' });
    await sidebar(page).getByRole('button', { name: 'Log out' }).click();
    await page.waitForURL('**/login');
    await page.goto('/calendar');
    await page.waitForURL('**/login');
    await page.getByLabel('Username').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('**/calendar');
    await page.reload();
    await expect(sidebar(page).getByRole('link', { name: /Persist me/ })).toBeVisible();
    await page.goto('/login');
    await page.waitForURL((u) => u.pathname === '/');
  });

  test('a new browser loads existing server data without replacing it', async ({ page, browser }) => {
    const { email, password } = await signUpAndOnboard(page, { project: 'Cross device project' });
    await expect.poll(async () => page.evaluate(async () => {
      const token = localStorage.getItem('nt:v1:token') ?? sessionStorage.getItem('nt:v1:token');
      const response = await fetch('/api/data', { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      return result.data?.projects?.some((p: { name: string }) => p.name === 'Cross device project');
    })).toBe(true);

    const context = await browser.newContext();
    try {
      const other = await context.newPage();
      await other.goto(new URL('/login', page.url()).href);
      await other.getByLabel('Username').fill(email);
      await other.getByLabel('Password', { exact: true }).fill(password);
      await other.getByRole('button', { name: 'Log in' }).click();
      await expect(sidebar(other).getByText('Cross device project')).toBeVisible();
      await other.reload();
      await expect(sidebar(other).getByText('Cross device project')).toBeVisible();
      await expect.poll(async () => page.evaluate(async () => {
        const token = localStorage.getItem('nt:v1:token');
        const response = await fetch('/api/data', { headers: { Authorization: `Bearer ${token}` } });
        const result = await response.json();
        return result.data?.projects?.some((p: { name: string }) => p.name === 'Cross device project');
      })).toBe(true);
    } finally {
      await context.close();
    }
  });

  test('forgot password explains reset is unavailable', async ({ page, errors }) => {
    void errors;
    await page.goto('/forgot-password');
    await expect(page.getByText(/Password reset by email is not available yet/)).toBeVisible();
  });
});

test('task deadline calendar selects and saves a date without a planned start', async ({ page }) => {
  await signUpAndOnboard(page, { project: 'Deadline project' });
  await sidebar(page).getByRole('link', { name: /Deadline project/ }).click();
  await page.setViewportSize({ width: 375, height: 780 });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.getByLabel('New task title').fill('Read research');
  await expect(page.getByLabel('Planned start (optional)')).toHaveCount(0);
  await page.getByRole('button', { name: 'Task deadline (optional)' }).click();
  const calendar = page.getByRole('group', { name: 'Task deadline (optional) calendar' });
  await expect(calendar).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.keyboard.press('Escape');
  await expect(calendar).toHaveCount(0);
  await page.getByRole('button', { name: 'Task deadline (optional)' }).click();
  const heading = await calendar.locator('.date-calendar-month').innerText();
  await calendar.getByRole('button', { name: 'Next month' }).click();
  await expect(calendar.locator('.date-calendar-month')).not.toHaveText(heading);
  await calendar.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(calendar).toHaveCount(0);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const row = page.locator('.task-item', { has: page.getByLabel('Task title: Read research') });
  await expect(row).toContainText('Deadline:');
  await page.reload();
  await expect(row).toContainText('Deadline:');
  await expect(row).not.toContainText('Planned:');
});

test.describe('welcome tour', () => {
  test('guides a new user through project tasks and can be completed', async ({ page }) => {
    await signUp(page);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Project name').fill('First project');
    await page.getByRole('button', { name: 'Create project' }).click();
    const tour = page.getByRole('dialog', { name: 'Turn a big project into small steps' });
    await expect(tour).toBeVisible();
    await expect(page.locator('.tour-spotlight')).toBeVisible();
    await tour.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('dialog', { name: 'Pick a time estimate' })).toBeVisible();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.reload();
    await expect(page.getByLabel('New task title')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('skipped setup guides the empty dashboard and Escape dismisses it', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 780 });
    await signUp(page);
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(page.getByRole('dialog', { name: 'Give your goal a home' })).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('dialog', { name: 'Add small tasks' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.reload();
    await expect(page.getByText('Start with one project')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('3–4 · projects and tasks', () => {
  test('project CRUD via modal', async ({ page, errors }) => {
    void errors;
    await signUpAndOnboard(page);
    await page.goto('/projects');
    await page.getByRole('button', { name: 'New project' }).click();
    const dialog = page.getByRole('dialog', { name: 'New project' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Create project' }).click();
    await expect(dialog.getByText('Give the project a name')).toBeVisible();
    await dialog.getByLabel('Project name').fill('Robotics club demo');
    await dialog.getByRole('button', { name: 'Create project' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Robotics club demo' })).toBeVisible();
    await expect(page.getByText('No tasks yet')).toBeVisible();

    // edit
    await page.getByRole('button', { name: 'Edit project' }).click();
    const edit = page.getByRole('dialog', { name: 'Edit project' });
    await edit.getByLabel('Project name').fill('Robotics club showcase');
    await edit.getByRole('button', { name: 'Deadline', exact: true }).click();
    await edit.getByRole('group', { name: 'Deadline calendar' }).getByRole('button', { name: 'Today', exact: true }).click();
    await edit.getByRole('radio', { name: 'High' }).click();
    await edit.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Robotics club showcase' })).toBeVisible();
    await expect(page.getByText('High priority')).toBeVisible();
    await expect(page.getByText(/Due .*today/)).toBeVisible();

    // delete
    await page.getByRole('button', { name: 'Edit project' }).click();
    await page.getByRole('button', { name: 'Delete project' }).click();
    const confirm = page.getByRole('dialog', { name: 'Delete this project?' });
    await confirm.getByRole('button', { name: 'Delete project' }).click();
    await page.waitForURL('**/projects');
    await expect(sidebar(page).getByRole('link', { name: /Robotics club/ })).toHaveCount(0);
  });

  test('task CRUD, reorder, status cycle and live numbers', async ({ page, errors }) => {
    void errors;
    await signUpAndOnboard(page, { project: 'Tasks project' });
    await sidebar(page).getByRole('link', { name: /Tasks project/ }).click();

    // add
    await page.getByLabel('New task title').fill('Write the conclusion');
    await page.getByLabel('Estimate', { exact: true }).selectOption('10');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    const row = page.locator('li', { has: page.getByLabel('Task title: Write the conclusion') });
    await expect(row).toBeVisible();
    await expect(page.getByText('Inbox')).toBeVisible();
    await page.getByLabel('New task title').fill('Proofread the conclusion');
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    // rename inline
    const title = page.getByLabel('Task title: Write the conclusion');
    await title.fill('Write the final conclusion');
    await title.press('Enter');
    await expect(page.getByLabel('Task title: Write the final conclusion')).toBeVisible();

    // estimate
    await page.getByLabel('Estimate for Write the final conclusion').selectOption('25');
    await expect(page.getByLabel('Estimate for Write the final conclusion')).toHaveValue('25');

    // reorder: move "Proofread" up within Inbox
    const inbox = page.locator('.group', { hasText: 'Inbox' });
    await expect(inbox.locator('input.inline-edit').first()).toHaveValue('Write the final conclusion');
    await page.getByRole('button', { name: 'Options for Proofread the conclusion' }).click();
    await page.getByRole('menuitem', { name: 'Move up' }).click();
    await expect(inbox.locator('input.inline-edit').first()).toHaveValue('Proofread the conclusion');

    // status cycle + numbers
    const pct = page.getByTestId('project-pct');
    await expect(pct).toHaveText('0% complete');
    const left0 = await page.getByTestId('work-left').innerText();
    const pill = page.getByRole('button', { name: /^Status To do, change: Write the final conclusion/ });
    await pill.click();
    await expect(page.getByRole('button', { name: /^Status In progress, change: Write the final conclusion/ })).toBeVisible();
    await page.getByRole('button', { name: /^Status In progress, change: Write the final conclusion/ }).click();
    await expect(page.getByRole('button', { name: /^Status Done, change: Write the final conclusion/ })).toBeVisible();
    await expect(pct).not.toHaveText('0% complete');
    await expect(page.getByTestId('work-left')).not.toHaveText(left0);
    await page.getByRole('button', { name: /^Status Done, change: Write the final conclusion/ }).click();
    await expect(page.getByRole('button', { name: /^Status To do, change: Write the final conclusion/ })).toBeVisible();
    await expect(pct).toHaveText('0% complete');

    // delete with undo
    await page.getByRole('button', { name: 'Options for Proofread the conclusion' }).click();
    await page.getByRole('menuitem', { name: 'Delete task' }).click();
    await expect(page.getByLabel('Task title: Proofread the conclusion')).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByLabel('Task title: Proofread the conclusion')).toBeVisible();
    await page.getByRole('button', { name: 'Options for Proofread the conclusion' }).click();
    await page.getByRole('menuitem', { name: 'Delete task' }).click();
    await expect(page.getByLabel('Task title: Proofread the conclusion')).toHaveCount(0);

    // persists
    await page.reload();
    await expect(page.getByLabel('Task title: Write the final conclusion')).toBeVisible();
    await expect(page.getByLabel('Task title: Proofread the conclusion')).toHaveCount(0);
  });

  test('subtasks stay with their parent through edit, undo, reload and another device', async ({ page, browser }) => {
    const { email, password } = await signUpAndOnboard(page, { project: 'Subtask project' });
    await sidebar(page).getByRole('link', { name: /Subtask project/ }).click();
    await page.getByLabel('New task title').fill('Write report');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByLabel('Task title: Write report').fill('Discard task edit');
    await page.getByLabel('Task title: Write report').press('Escape');
    await expect(page.getByLabel('Task title: Write report')).toHaveValue('Write report');
    await page.getByRole('button', { name: 'Options for Write report' }).click();
    await page.getByRole('menuitem', { name: 'Add subtask' }).click();
    await page.getByLabel('New subtask for Write report').fill('Find sources');
    await page.locator('.subtask-add').getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByLabel('Subtask title: Find sources').fill('Find three sources');
    await page.getByLabel('Complete subtask: Find sources').check();
    await expect(page.getByLabel('Complete subtask: Find three sources')).toBeChecked();
    await page.getByLabel('Subtask title: Find three sources').fill('Discard this change');
    await page.getByLabel('Subtask title: Find three sources').press('Escape');
    await expect(page.getByLabel('Subtask title: Find three sources')).toHaveValue('Find three sources');
    await expect(page.getByText('1 of 1 subtasks done')).toBeVisible();
    await page.getByRole('button', { name: 'Options for Write report' }).click();
    await page.getByRole('menuitem', { name: 'Delete task' }).click();
    await expect(page.getByLabel('Subtask title: Find three sources')).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByLabel('Complete subtask: Find three sources')).toBeChecked();
    await expect.poll(async () => page.evaluate(async () => {
      const token = localStorage.getItem('nt:v1:token');
      const response = await fetch('/api/data', { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      return result.data.tasks.some((task: { title: string; subtasks?: { title: string; done: boolean }[] }) => task.title === 'Write report' && task.subtasks?.some((sub) => sub.title === 'Find three sources' && sub.done));
    })).toBe(true);
    await page.reload();
    await expect(page.getByLabel('Complete subtask: Find three sources')).toBeChecked();
    const otherContext = await browser.newContext();
    try {
      const other = await otherContext.newPage();
      await other.goto(new URL('/login', page.url()).href);
      await other.getByLabel('Username').fill(email);
      await other.getByLabel('Password', { exact: true }).fill(password);
      await other.getByRole('button', { name: 'Log in' }).click();
      await sidebar(other).getByRole('link', { name: /Subtask project/ }).click();
      await expect(other.getByLabel('Complete subtask: Find three sources')).toBeChecked();
      await other.getByRole('button', { name: 'Delete subtask: Find three sources' }).click();
      await expect(other.getByLabel('Subtask title: Find three sources')).toHaveCount(0);
    } finally { await otherContext.close(); }
  });

  test('deleting the final completed task returns the project to active', async ({ page }) => {
    await signUpAndOnboard(page, { project: 'Reopened project' });
    await sidebar(page).getByRole('link', { name: /Reopened project/ }).click();
    await page.getByLabel('New task title').fill('Only task');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: /^Status To do, change: Only task/ }).click();
    await page.getByRole('button', { name: /^Status In progress, change: Only task/ }).click();
    await expect(page.getByTestId('project-pct')).toHaveText('100% complete');
    await page.getByRole('button', { name: 'Options for Only task' }).click();
    await page.getByRole('menuitem', { name: 'Delete task' }).click();
    await expect(page.getByText('No tasks yet')).toBeVisible();
    await expect(sidebar(page).getByRole('link', { name: /Reopened project/ })).toBeVisible();
  });

  test('a task can be selected for Focus and its suggested timer changed before starting', async ({ page }) => {
    await signUpAndOnboard(page, { project: 'Focus project' });
    await sidebar(page).getByRole('link', { name: /Focus project/ }).click();
    await page.getByLabel('New task title').fill('Review notes');
    await page.getByLabel('Estimate', { exact: true }).selectOption('10');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'Options for Review notes' }).click();
    await page.getByRole('menuitem', { name: 'Focus on task' }).click();
    await expect(page.getByRole('heading', { name: 'Review notes' })).toBeVisible();
    await expect(page.getByTestId('clock')).toHaveText('10:00');
    await page.getByRole('radio', { name: '25 min' }).click();
    await expect(page.getByTestId('clock')).toHaveText('25:00');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await page.waitForTimeout(1100);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.getByRole('radio', { name: '10 min' })).toBeDisabled();
    await expect(page.getByText(/Finish or reset the session to change its length or task/)).toBeVisible();
    await page.getByRole('button', { name: 'Mark done' }).click();
    await page.getByRole('button', { name: 'Exit' }).click();
    await expect(page.getByRole('button', { name: /^Status Done, change: Review notes/ })).toBeVisible();
  });

  test('task menu remains inside a small viewport and supports keyboard navigation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 500 });
    await signUpAndOnboard(page, { project: 'Menu project' });
    await sidebar(page).getByRole('button', { name: 'More' }).click();
    await sidebar(page).getByRole('link', { name: /Menu project/ }).click();
    await page.getByLabel('New task title').fill('Menu task');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    const trigger = page.getByRole('button', { name: 'Options for Menu task' });
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    const menu = page.getByRole('menu', { name: 'Options for Menu task' });
    const bounds = await menu.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(500);
    await expect(menu.getByRole('menuitem', { name: 'Add subtask' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem', { name: 'Focus on task' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('dashboard and sidebar numbers update from today’s list', async ({ page, errors }) => {
    void errors;
    await signUpAndOnboard(page, { sample: true });
    const plan = page.getByTestId('kpi-plan');
    const before = await plan.innerText();
    const box = page.getByRole('button', { name: /^Mark done: Submit essay on portal/ });
    await box.click();
    await expect(page.getByRole('button', { name: /^Mark not done: Submit essay on portal/ })).toBeVisible();
    await expect(plan).not.toHaveText(before);
    await expect(sidebar(page).getByText(/tasks? done/)).toContainText('4 tasks done');
  });

});

test.describe('6 · focus mode', () => {
  test('timer survives reload; mark done logs a session and advances', async ({ page, errors }) => {
    void errors;
    await signUpAndOnboard(page, { sample: true });
    const focusBefore = await page.getByTestId('kpi-focus').innerText();
    await page.goto('/focus');
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(/Pick a task/);
    const firstTitle = await page.getByRole('heading', { level: 1 }).innerText();
    await page.getByRole('radio', { name: '15 min' }).click();
    await expect(page.getByTestId('clock')).toHaveText('15:00');
    await page.getByRole('button', { name: 'Start' }).click();
    await page.waitForTimeout(2500);
    await page.reload();
    const t = await page.getByTestId('clock').innerText();
    const [m, s] = t.split(':').map(Number);
    const remaining = m * 60 + s;
    expect(remaining).toBeLessThanOrEqual(15 * 60 - 2);
    expect(remaining).toBeGreaterThanOrEqual(15 * 60 - 8);
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

    // +5 min extends
    await page.getByRole('button', { name: '+5 min' }).click();
    const m2 = Number((await page.getByTestId('clock').innerText()).split(':')[0]);
    expect(m2).toBeGreaterThanOrEqual(19);

    // pause / resume
    await page.getByRole('button', { name: 'Pause' }).click();
    const paused = await page.getByTestId('clock').innerText();
    await page.waitForTimeout(1200);
    await expect(page.getByTestId('clock')).toHaveText(paused);
    await page.getByRole('button', { name: 'Resume' }).click();

    // pretend 2 minutes passed (shift the stored end time)
    await page.evaluate(() => {
      const key = 'nt:v1:meta';
      const all = JSON.parse(localStorage.getItem(key) || '[]');
      all.forEach((m: { timer?: { endsAt?: number; running?: boolean } }) => {
        if (m.timer?.running && m.timer.endsAt) m.timer.endsAt -= 120_000;
      });
      localStorage.setItem(key, JSON.stringify(all));
    });
    await page.reload();
    await page.getByRole('button', { name: 'Mark done' }).click();
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(firstTitle);
    await expect(page.locator('.queue-row .t.done', { hasText: firstTitle })).toBeVisible();
    await expect(page.getByTestId('focus-today')).toContainText('7 sessions');
    await page.getByRole('button', { name: 'Exit' }).click();
    await page.goto('/');
    await expect(page.getByTestId('kpi-focus')).not.toHaveText(focusBefore);
  });

  test('a session that ends while away completes on return', async ({ page, errors }) => {
    void errors;
    await signUpAndOnboard(page, { sample: true });
    await page.goto('/focus');
    await expect(page.locator('.queue-row.current')).toBeVisible();
    const title = await page.getByRole('heading', { level: 1 }).innerText();
    await page.getByRole('button', { name: 'Start' }).click();
    await page.getByRole('button', { name: 'Exit' }).click();
    await expect(sidebar(page).getByLabel('Focus timer running')).toBeVisible();
    // Simulate the laptop sleeping past the end of the session.
    await page.evaluate(() => {
      const key = 'nt:v1:meta';
      const all = JSON.parse(localStorage.getItem(key) || '[]');
      all.forEach((m: { timer?: { endsAt?: number; running?: boolean } }) => {
        if (m.timer?.running) m.timer.endsAt = Date.now() - 1000;
      });
      localStorage.setItem(key, JSON.stringify(all));
    });
    await page.reload();
    await expect(page.getByText(`Done: ${title}`)).toBeVisible();
    await page.goto('/focus');
    await expect(page.locator('.queue-row .t.done', { hasText: title })).toBeVisible();
    await expect(page.getByTestId('focus-today')).toContainText('7 sessions');
  });

  test('focus can start on a specific task and parking lot works', async ({ page, errors }) => {
    void errors;
    await signUpAndOnboard(page, { sample: true });
    await sidebar(page).getByRole('link', { name: /Portfolio redesign/ }).click();
    await page.getByRole('button', { name: 'Focus on next task' }).click();
    await page.waitForURL('**/focus');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pick typography and colors');
    await page.getByLabel('Parking lot').fill('Reply to Minh about slides');
    await page.getByLabel('Parking lot').press('Enter');
    await expect(page.getByText('Reply to Minh about slides')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Reply to Minh about slides')).toBeVisible();
    await page.getByRole('button', { name: 'Remove note: Reply to Minh about slides' }).click();
    await expect(page.getByText('Reply to Minh about slides')).toHaveCount(0);
  });
});

test.describe('7–9 · overdue, replan, calendar, progress', () => {
  test('overdue banner → replan to today → calendar shows the tasks', async ({ page, errors }) => {
    void errors;
    await signUpAndOnboard(page, { sample: true });
    // Give today room so every overdue task fits.
    await page.goto('/profile');
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Increase goal' }).click();
    await page.goto('/');
    const alert = page.getByRole('alert').filter({ hasText: 'overdue' });
    await expect(alert).toContainText('Scholarship essay is 1 day overdue');
    await alert.getByRole('button', { name: 'Replan to today' }).click();
    await expect(page.getByText(/Moved \d+ Scholarship essay tasks? into today/)).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'is 1 day overdue' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Read the essay aloud once' })).toBeVisible();
    await page.goto('/calendar');
    await expect(page.getByRole('heading', { name: /Today · / })).toBeVisible();
    await expect(page.locator('.agenda').getByText('Read the essay aloud once')).toBeVisible();
    await expect(page.locator('.agenda').getByText(/replanned/).first()).toBeVisible();
  });

  test('calendar navigation and day selection', async ({ page, errors }) => {
    void errors;
    await signUpAndOnboard(page, { sample: true });
    await page.goto('/calendar');
    const title = page.getByRole('heading', { level: 1 });
    const now = new Date();
    const monthName = now.toLocaleString('en-US', { month: 'long' });
    await expect(title).toHaveText(`${monthName} ${now.getFullYear()}`);
    await page.getByRole('button', { name: 'Next month' }).click();
    await expect(title).not.toHaveText(`${monthName} ${now.getFullYear()}`);
    await page.getByRole('button', { name: 'Previous month' }).click();
    await page.getByRole('button', { name: 'Previous month' }).click();
    await page.getByRole('button', { name: 'Today', exact: true }).click();
    await expect(title).toHaveText(`${monthName} ${now.getFullYear()}`);
    // select yesterday: the overdue deadline and slipped tasks are there
    const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    await page.locator(`#cell-${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`).click();
    await expect(page.locator('.agenda')).toContainText('Scholarship essay due');
    await expect(page.locator('.agenda')).toContainText('missed');
    // keyboard: arrow right moves to today
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('heading', { name: /^Today · / })).toBeVisible();
    // chips reflect real data
    await expect(page.locator('.ev.overdue').first()).toContainText('Scholarship essay');
  });

  test('progress: range toggle and replan apply / undo', async ({ page, errors }) => {
    void errors;
    await signUpAndOnboard(page, { sample: true });
    await page.goto('/progress');
    const focus = page.getByTestId('kpi-Focus time');
    const tasks = page.getByTestId('kpi-Tasks completed');
    const f7 = await focus.innerText();
    const t7 = await tasks.innerText();
    await expect(page.locator('.chart .c')).toHaveCount(7);
    await page.getByRole('radio', { name: 'Last 30 days' }).click();
    await expect(page.locator('.chart .c')).toHaveCount(30);
    await expect(focus).not.toHaveText(f7);
    await expect(tasks).not.toHaveText(t7);
    await page.getByRole('radio', { name: 'Last 7 days' }).click();
    await expect(focus).toHaveText(f7);

    // replan
    const rows = page.locator('.replan-row');
    const n = await rows.count();
    expect(n).toBeGreaterThanOrEqual(4);
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('nt:v1:tasks') || '[]').map((t: { id: string; scheduledFor?: string }) => [t.id, t.scheduledFor ?? null]));
    await page.getByRole('button', { name: 'Apply replan' }).click();
    await expect(page.getByRole('button', { name: 'Undo replan' })).toBeVisible();
    await expect(page.locator('.replan-row .to.applied').first()).toBeVisible();
    await page.getByRole('button', { name: 'Undo replan' }).click();
    await expect(page.getByRole('button', { name: 'Apply replan' })).toBeVisible();
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('nt:v1:tasks') || '[]').map((t: { id: string; scheduledFor?: string }) => [t.id, t.scheduledFor ?? null]));
    expect(after).toEqual(before);

    // auto-replan switch persists
    const sw = page.getByRole('switch', { name: 'Auto-replan nightly at 22:00' });
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await page.goto('/profile');
    await expect(page.getByRole('switch', { name: 'Auto-replan unfinished tasks' })).toHaveAttribute('aria-checked', 'false');
  });
});

test.describe('10 · theme', () => {
  test('theme from sidebar, profile and focus applies everywhere and persists without a flash', async ({ page, errors }) => {
    void errors;
    await signUpAndOnboard(page);
    const html = page.locator('html');
    await sidebar(page).getByRole('radio', { name: 'Dark' }).click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.goto('/profile');
    await expect(page.getByRole('radiogroup', { name: 'Appearance' }).getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('radiogroup', { name: 'Appearance' }).getByRole('radio', { name: 'Light' }).click();
    await expect(html).toHaveAttribute('data-theme', 'light');

    // Focus Mode follows the global theme (light-neutral in light mode).
    await page.goto('/focus');
    const bg = await page.locator('.focus-page').evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(251, 251, 250)');
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.waitForTimeout(300);
    expect(await page.locator('.focus-page').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(17, 17, 19)');

    // No flash: the attribute is set before any app script runs.
    await page.addInitScript(() => {
      document.addEventListener('readystatechange', () => {
        if (document.readyState === 'interactive') (window as unknown as { __themeAtParse: string | null }).__themeAtParse = document.documentElement.getAttribute('data-theme');
      });
    });
    await page.reload();
    expect(await page.evaluate(() => (window as unknown as { __themeAtParse: string | null }).__themeAtParse)).toBe('dark');
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });
});

test.describe('11 · responsive', () => {
  test.use({ viewport: { width: 375, height: 780 } });
  test('no horizontal page scroll at 375px; sidebar stacks; calendar scrolls inside its card', async ({ page, errors }) => {
    void errors;
    await signUpAndOnboard(page, { sample: true });
    const paths = ['/', '/projects', '/calendar', '/progress', '/profile', '/focus'];
    for (const p of paths) {
      await page.goto(p);
      await page.waitForTimeout(400);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(sw, `scrollWidth on ${p}`).toBeLessThanOrEqual(375);
    }
    const projectHref = await page.goto('/projects').then(() => page.locator('.proj-card').first().getAttribute('href'));
    await page.goto(projectHref!);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

    await page.goto('/');
    const nav = await sidebar(page).boundingBox();
    const main = await page.locator('main').boundingBox();
    expect(main!.y).toBeGreaterThan(nav!.y + 100); // stacked
    await page.goto('/calendar');
    const cal = page.locator('.cal-wrap');
    const scrollable = await cal.evaluate((el) => el.scrollWidth > el.clientWidth && getComputedStyle(el).overflowX === 'auto');
    expect(scrollable).toBe(true);
    // mobile "More" reveals projects and theme
    await sidebar(page).getByRole('button', { name: 'More' }).click();
    await expect(sidebar(page).getByRole('radio', { name: 'Dark' })).toBeVisible();
  });
});

test.describe('12 · keyboard and modals', () => {
  test('controls are reachable with Tab and show a focus ring; modals trap focus and close on Esc', async ({ page, errors }) => {
    void errors;
    await signUpAndOnboard(page);
    await page.goto('/');
    await expect(page.getByText('Skip to content')).toBeVisible();
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const st = getComputedStyle(el);
      return { tag: el.tagName, outline: st.outlineStyle, width: st.outlineWidth, text: el.textContent };
    });
    expect(focused.text).toContain('Skip to content');
    // Tab through the sidebar: each focused element has a visible ring.
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const st = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const cs = getComputedStyle(el);
        const ring = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2;
        const glow = cs.boxShadow !== 'none';
        const wrap = el.closest('.search') ? getComputedStyle(el.closest('.search')!).boxShadow !== 'none' : false;
        return { ring: ring || glow || wrap, tag: el.tagName };
      });
      expect(st.ring, `focus ring on ${st.tag} #${i}`).toBe(true);
    }

    // ⌘K / Ctrl+K focuses search; results open a project
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('combobox', { name: 'Search tasks and projects' })).toBeFocused();
    await page.keyboard.type('Final');
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/projects\//);

    // Quick task modal: focus trap + Esc
    await sidebar(page).getByRole('button', { name: 'New task' }).click();
    const dialog = page.getByRole('dialog', { name: 'New task' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Task')).toBeFocused();
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    // add a task through the modal
    await sidebar(page).getByRole('button', { name: 'New task' }).click();
    await page.getByRole('dialog', { name: 'New task' }).getByLabel('Task').fill('Email the TA');
    await page.getByRole('dialog', { name: 'New task' }).getByRole('radio', { name: 'Today' }).click();
    await page.getByRole('button', { name: 'Add task' }).click();
    await expect(page.getByLabel('Task title: Email the TA')).toBeVisible();
  });

  test('profile: save display name and log out', async ({ page, errors }) => {
    void errors;
    await signUpAndOnboard(page);
    await page.goto('/profile');
    await expect(page.getByLabel('Username')).toHaveAttribute('readonly', '');
    await page.getByLabel('Display name').fill('Hoang Tran');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
    await expect(sidebar(page)).toContainText('Hoang Tran');
    await expect(page.getByRole('button', { name: 'Export' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete account' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Log out', exact: true }).last().click();
    await page.waitForURL('**/login');
  });
});
