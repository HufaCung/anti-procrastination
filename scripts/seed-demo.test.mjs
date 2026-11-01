import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildDemoData, seedDemo } from './seed-demo.mjs';

let server;
let baseUrl;
const password = randomUUID();
const username = `seed-test-${randomUUID()}`;
const now = new Date(2026, 10, 1, 8);
before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = '';
  process.env.REQUIRE_DATABASE_URL = 'false';
  process.env.DATABASE_PATH = ':memory:';
  const { app } = await import('../backend/dist/server.js');
  server = await new Promise(resolve => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  const { db } = await import('../backend/dist/db/sqlite.js');
  db.close();
});

test('100 demo records have unique IDs, valid relationships and useful feature states', () => {
  const data = buildDemoData('user-a', 100, now);
  assert.deepEqual([data.projects.length, data.tasks.length, data.sessions.length], [10, 70, 20]);
  const projects = new Set(data.projects.map(record => record.id));
  const tasks = new Map(data.tasks.map(record => [record.id, record]));
  assert.equal(new Set([...data.projects, ...data.tasks, ...data.sessions].map(record => record.id)).size, 100);
  for (const task of data.tasks) {
    assert.ok(projects.has(task.projectId));
    assert.equal(task.subtasks.length, 2);
    if (task.status === 'done') assert.ok(task.completedAt);
  }
  for (const session of data.sessions) {
    assert.equal(tasks.get(session.taskId).projectId, session.projectId);
    assert.ok(new Date(session.endedAt) <= now);
    assert.equal((Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 60000, session.minutes);
  }
  assert.ok(data.tasks.some(task => !task.scheduledFor));
  assert.ok(data.tasks.some(task => task.status === 'in_progress'));
  assert.ok(data.tasks.some(task => task.status === 'done'));
  assert.ok(data.projects.some(project => project.completedAt));
  assert.deepEqual(buildDemoData('user-a', 100, now), data);
});

test('count bounds reject invalid input and arbitrary counts have exact totals', () => {
  for (const count of [10, 51, 100, 137, 1000]) {
    const data = buildDemoData('u', count, now);
    assert.equal(data.projects.length + data.tasks.length + data.sessions.length, count);
  }
  for (const count of [0, 9, 1001, 10.5, NaN]) assert.throws(() => buildDemoData('u', count, now));
});

test('real API persists data; reruns preserve edits, unrelated records and revisions', async () => {
  const options = { baseUrl, username, password, now };
  const first = await seedDemo(options);
  assert.equal(first.createdAccount, true);
  assert.deepEqual(first.added, { projects: 10, tasks: 70, sessions: 20 });
  const login = await (await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })).json();
  const headers = { Authorization: `Bearer ${login.token}`, 'Content-Type': 'application/json' };
  const snapshot = await (await fetch(`${baseUrl}/api/data`, { headers })).json();
  snapshot.data.tasks[0].title = 'My manual edit';
  snapshot.data.projects.push({ ...snapshot.data.projects[0], id: randomUUID(), name: 'My own project' });
  const saved = await fetch(`${baseUrl}/api/data`, { method: 'PUT', headers, body: JSON.stringify(snapshot) });
  assert.equal(saved.status, 200);
  const before = await (await fetch(`${baseUrl}/api/data`, { headers })).json();
  const again = await seedDemo(options);
  assert.equal(again.createdAccount, false);
  assert.deepEqual(again.added, { projects: 0, tasks: 0, sessions: 0 });
  assert.deepEqual(again.totals, { projects: 11, tasks: 70, sessions: 20 });
  const after = await (await fetch(`${baseUrl}/api/data`, { headers })).json();
  assert.deepEqual(after, before);
  await assert.rejects(seedDemo({ ...options, password: randomUUID() }), /authenticate/);
  const other = await seedDemo({ ...options, username: `other-${randomUUID()}` });
  assert.deepEqual(other.totals, { projects: 10, tasks: 70, sessions: 20 });
  assert.deepEqual(await (await fetch(`${baseUrl}/api/data`, { headers })).json(), before);
});

test('refuses remote origins and missing passwords before sending requests', async () => {
  for (const baseUrl of ['https://example.com', 'http://localhost.evil.test', 'http://localhost:3001/path']) {
    await assert.rejects(seedDemo({ baseUrl, password }), /local API origin/);
  }
  await assert.rejects(seedDemo({ baseUrl }), /TINYDO_SEED_PASSWORD/);
});

test('explicit HTTPS seeding authenticates and persists 100 records without duplicates', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  // Forward the simulated deployed origin to a real isolated Express API. No
  // requests are sent to an external service and TLS verification stays default.
  globalThis.fetch = (url, options) => {
    assert.equal(new URL(url).origin, 'https://demo.example.test');
    assert.equal(options.redirect, 'error');
    calls.push(new URL(url).pathname);
    return originalFetch(url.replace('https://demo.example.test', baseUrl), options);
  };
  try {
    const options = { baseUrl: 'https://demo.example.test', allowRemote: true, username: `remote-${randomUUID()}`, password, now };
    assert.deepEqual((await seedDemo(options)).added, { projects:10, tasks:70, sessions:20 });
    assert.deepEqual((await seedDemo(options)).added, { projects:0, tasks:0, sessions:0 });
    assert.ok(calls.includes('/api/auth/signup'));
    assert.ok(calls.includes('/api/auth/login'));
    assert.ok(calls.includes('/api/data'));
  } finally { globalThis.fetch = originalFetch; }
});

test('remote opt-in still refuses HTTP, credentials, paths, queries and fragments before network access', async () => {
  for (const baseUrl of ['http://example.com','https://user:secret@example.com','https://example.com/api','https://example.com/?x=1','https://example.com/#x']) {
    await assert.rejects(seedDemo({baseUrl,password,allowRemote:true}), /local API origin/);
  }
});
