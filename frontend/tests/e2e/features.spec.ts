import type { Page } from '@playwright/test';
import type { AppData } from '../../src/data/types';
import { test, expect, signUpAndOnboard, sidebar } from './helpers';

async function workspace(page: Page): Promise<AppData> {
  return page.evaluate(async () => {
    const token = localStorage.getItem('nt:v1:token') || sessionStorage.getItem('nt:v1:token');
    const response = await fetch('/api/data', { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Read workspace: ${response.status}`);
    return (await response.json()).data;
  });
}

async function seed(page: Page, options: { slipped?: boolean; gap?: boolean; alerts?: boolean } = {}) {
  await signUpAndOnboard(page, { project: 'Feature project' });
  // Wait for onboarding's writes before replacing the fixture through the real API.
  await expect.poll(() => page.evaluate(async () => {
    const session = JSON.parse(localStorage.getItem('nt:v1:session') || sessionStorage.getItem('nt:v1:session') || 'null');
    const token = localStorage.getItem('nt:v1:token') || sessionStorage.getItem('nt:v1:token');
    const remote = await (await fetch('/api/data', { headers: { Authorization: `Bearer ${token}` } })).json();
    const saved = JSON.parse(localStorage.getItem(`nt:sync:${session.userId}`) || 'null');
    return saved?.revision === remote.revision && remote.data.projects.length === 1;
  })).toBe(true);
  const projectId = await page.evaluate(async (opts) => {
    const token = localStorage.getItem('nt:v1:token') || sessionStorage.getItem('nt:v1:token');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const remote = await (await fetch('/api/data', { headers })).json();
    const data = remote.data;
    const userId = data.settings.userId;
    const date = (offset: number, hour = 10) => { const d = new Date(); d.setDate(d.getDate() + offset); d.setHours(hour, 0, 0, 0); return d; };
    const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const project = { ...data.projects[0], dueDate: key(date(2)), priority: 'high' };
    data.projects = opts.alerts ? Array.from({ length: 5 }, (_, i) => ({ ...project, id: `alert-${i}`, name: `Deadline ${i}`, dueDate: key(date(1)) })) : [project];
    const make = (id: string, title: string, scheduledFor?: string) => ({ id: `${project.id}-${id}`, title, userId, projectId: project.id, section: 'Inbox', estimateMin: 60, status: 'todo', order: 0, createdAt: new Date().toISOString(), scheduledFor, subtasks: [{ id: `step-${id}`, title: 'Check the result', done: false }] });
    data.tasks = opts.alerts ? [] : opts.gap ? [
      { ...make('later', 'Afternoon task', date(0, 16).toISOString()), estimateMin: 45 },
      { ...make('gap', 'Fill morning gap'), estimateMin: 15, order: 1 },
      { ...make('overflow', 'Tomorrow task'), estimateMin: 15, order: 2 },
    ] : [make('focus-task', 'Write report', date(opts.slipped ? -1 : 0).toISOString())];
    data.sessions = [];
    data.settings = { ...data.settings, dailyGoalMin: opts.gap ? 60 : 120, autoReplan: false, deadlineAlerts: !!opts.alerts, focusSound: false };
    data.meta = { userId, shownAlerts: [], snoozedAlerts: {}, parking: [], onboarded: true };
    const response = await fetch('/api/data', { method: 'PUT', headers, body: JSON.stringify({ data, revision: remote.revision }) });
    if (!response.ok) throw new Error(`Seed workspace: ${response.status}`);
    for (const collection of ['projects', 'tasks', 'sessions', 'settings', 'meta']) {
      const key = `nt:v1:${collection}`;
      localStorage.setItem(key, JSON.stringify(JSON.parse(localStorage.getItem(key) || '[]').filter((item: { userId: string }) => item.userId !== userId)));
    }
    localStorage.removeItem(`nt:sync:${userId}`);
    return project.id as string;
  }, options);
  await page.reload();
  await expect(sidebar(page)).toBeVisible();
  return projectId;
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-01T10:00:00+07:00') });
});

test('onboarding, task and subtask editing, completion and reopening persist', async ({ page, errors }) => {
  void errors;
  await signUpAndOnboard(page, { project: 'Feature project' });
  await sidebar(page).getByRole('link', { name: /Feature project/ }).click();
  await page.getByLabel('New task title').fill('Review feature');
  await page.getByLabel('New task title').press('Enter');
  await page.getByRole('button', { name: 'Options for Review feature' }).click();
  await page.getByRole('menuitem', { name: 'Add subtask' }).click();
  await page.getByLabel('New subtask for Review feature').fill('Check output');
  await page.getByLabel('New subtask for Review feature').press('Enter');
  await page.getByLabel('Complete subtask: Check output', { exact: true }).check();
  await page.getByRole('button', { name: 'Status To do, change: Review feature' }).click();
  await page.getByRole('button', { name: 'Status In progress, change: Review feature' }).click();
  await expect(page.getByTestId('project-pct')).toHaveText('100% complete');
  await expect.poll(async () => (await workspace(page)).projects[0].completedAt).toBeTruthy();
  await page.reload();
  await expect(page.getByLabel('Complete subtask: Check output', { exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Status Done, change: Review feature' }).click();
  await expect(page.getByTestId('project-pct')).toHaveText('0% complete');
  await expect.poll(async () => (await workspace(page)).projects[0].completedAt).toBeFalsy();
});

test('timer expiry logs once, keeps task and subtasks open, then explicit Mark done completes', async ({ page, errors }) => {
  void errors;
  await seed(page);
  await page.goto('/focus');
  await page.getByRole('radio', { name: '10 min', exact: true }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.clock.fastForward(10 * 60_000);
  await expect(page.getByText('Session complete', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Write report');
  await expect.poll(async () => (await workspace(page)).sessions.length).toBe(1);
  const data = await workspace(page);
  expect(data.sessions[0]).toMatchObject({ minutes: 10, completedTask: false });
  expect(data.tasks[0].status).not.toBe('done');
  expect(data.tasks[0].subtasks?.[0].done).toBe(false);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
  expect((await workspace(page)).sessions).toHaveLength(1);
  await page.getByRole('button', { name: 'Mark done', exact: true }).click();
  await expect.poll(async () => (await workspace(page)).tasks[0].status).toBe('done');
  expect((await workspace(page)).sessions).toHaveLength(1);
});

test('pause, reload, resume and Log session preserve unfinished work', async ({ page, errors }) => {
  void errors;
  await seed(page);
  await page.goto('/focus');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.clock.fastForward(60_000);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const paused = await page.getByTestId('clock').innerText();
  await page.clock.fastForward(120_000);
  await expect(page.getByTestId('clock')).toHaveText(paused);
  await expect.poll(async () => (await workspace(page)).meta.timer?.running).toBe(false);
  await page.reload();
  await expect(page.getByTestId('clock')).toHaveText(paused);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.clock.fastForward(60_000);
  await page.getByRole('button', { name: 'Log session', exact: true }).click();
  await expect.poll(async () => (await workspace(page)).sessions.length).toBe(1);
  const data = await workspace(page);
  expect(data.sessions[0]).toMatchObject({ minutes: 2, completedTask: false });
  expect(data.tasks[0].status).not.toBe('done');
});

test('Plan tasks fills an earlier gap and spills beyond daily capacity into Calendar', async ({ page, errors }) => {
  void errors;
  await seed(page, { gap: true });
  await page.getByRole('button', { name: 'Plan tasks', exact: true }).click();
  await expect.poll(async () => (await workspace(page)).tasks.filter(t => t.scheduledFor).length).toBe(3);
  const data = await workspace(page);
  const gap = data.tasks.find(t => t.id.endsWith('-gap'))!;
  const later = data.tasks.find(t => t.id.endsWith('-later'))!;
  const overflow = data.tasks.find(t => t.id.endsWith('-overflow'))!;
  expect(new Date(gap.scheduledFor!).getTime()).toBeLessThan(new Date(later.scheduledFor!).getTime());
  expect(new Date(overflow.scheduledFor!).getTime()).toBeGreaterThan(new Date(later.scheduledFor!).getTime());
  await page.goto('/calendar');
  await expect(page.locator('.agenda').getByText('Fill morning gap', { exact: true })).toBeVisible();
  await expect(page.locator('.agenda').getByText('Afternoon task', { exact: true })).toBeVisible();
});

test('replan preview, apply and undo restore the previous slot', async ({ page, errors }) => {
  void errors;
  await seed(page, { slipped: true });
  const oldSlot = (await workspace(page)).tasks[0].scheduledFor;
  await page.goto('/progress');
  await expect(page.getByText(/Progress counts completed tasks/)).toBeVisible();
  await page.getByRole('button', { name: 'Apply replan', exact: true }).click();
  await expect.poll(async () => (await workspace(page)).tasks[0].scheduledFor).not.toBe(oldSlot);
  await page.getByRole('button', { name: 'Undo replan', exact: true }).click();
  await expect.poll(async () => (await workspace(page)).tasks[0].scheduledFor).toBe(oldSlot);
});

test('all five deadlines are delivered across batches, and a changed deadline alerts again', async ({ page, errors }) => {
  void errors;
  await seed(page, { alerts: true });
  await expect.poll(async () => (await workspace(page)).meta.shownAlerts.length).toBe(3);
  await page.clock.fastForward(16_000);
  await expect.poll(async () => (await workspace(page)).meta.shownAlerts.length).toBe(5);
  const seen = (await workspace(page)).meta.shownAlerts;
  expect(new Set(seen).size).toBe(5);
  await page.clock.fastForward(16_000);
  expect((await workspace(page)).meta.shownAlerts).toEqual(seen);
  await page.evaluate(async () => {
    const token = localStorage.getItem('nt:v1:token');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const snapshot = await (await fetch('/api/data', { headers })).json();
    snapshot.data.projects[0].dueDate = '2026-11-03';
    const result = await fetch('/api/data', { method: 'PUT', headers, body: JSON.stringify(snapshot) });
    if (!result.ok) throw new Error(`Change deadline: ${result.status}`);
  });
  await page.reload();
  await expect.poll(async () => (await workspace(page)).meta.shownAlerts.length).toBe(6);
  expect((await workspace(page)).meta.shownAlerts).toContain('alert-0:2026-11-03:3d');
});
