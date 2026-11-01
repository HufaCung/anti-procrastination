import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';

export function validateCount(count) {
  if (!Number.isSafeInteger(count) || count < 10 || count > 1000) throw new Error('count must be an integer between 10 and 1000.');
}

export function buildDemoData(userId, count = 100, now = new Date()) {
  validateCount(count);
  const projectCount = Math.max(1, Math.floor(count / 10));
  const sessionCount = Math.floor(count / 5);
  const taskCount = count - projectCount - sessionCount;
  const prefix = `tinydo-demo-v1-${userId}`;
  const at = (days, hour = 10, minute = 0) => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    date.setHours(hour, minute, 0, 0);
    return date;
  };
  const day = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const names = ['Scholarship essay', 'Website launch', 'English practice', 'Read a book', 'Portfolio refresh', 'Learning TypeScript', 'Budget review', 'Workout plan', 'Presentation prep', 'Completed project'];
  const actions = ['Gather requirements', 'Write the outline', 'Prepare the first draft', 'Review the details', 'Check the result', 'Apply feedback', 'Finalize and submit'];
  const dueOffsets = [-3, 0, 1, 2, 4, 7, 10, 14, 21, -1];
  const projects = Array.from({ length: projectCount }, (_, i) => ({
    id: `${prefix}-p-${i}`, userId,
    name: `[Demo] ${names[i % names.length]}${i >= names.length ? ` ${i + 1}` : ''}`,
    description: 'Demo workspace for Dashboard, Calendar, Focus, Progress and Replan testing.',
    color: ['#2383E2', '#D92D20', '#5E5CE6', '#0F7B6C', '#D9730D'][i % 5],
    priority: ['high', 'medium', 'low'][i % 3],
    dueDate: day(at(dueOffsets[i % dueOffsets.length])),
    createdAt: at(-30).toISOString(),
    ...(i % 10 === 9 ? { completedAt: at(-2, 16).toISOString() } : {}),
  }));
  const tasks = Array.from({ length: taskCount }, (_, i) => {
    const projectIndex = i % projectCount;
    const rank = Math.floor(i / projectCount);
    const project = projects[projectIndex];
    const done = !!project.completedAt || rank % 5 === 0;
    const status = done ? 'done' : rank % 3 === 0 ? 'in_progress' : 'todo';
    let scheduledFor;
    if (done) scheduledFor = at(-3, 9, (rank % 5) * 35).toISOString();
    else if (rank % 4 === 1) scheduledFor = at(-1, 10, (projectIndex % 5) * 35).toISOString();
    else if (rank % 4 === 2) scheduledFor = at(0, 9, (projectIndex % 5) * 35).toISOString();
    else if (rank % 4 === 3 && projectIndex % 10 !== 0) {
      const offset = Math.min(2, Math.max(0, dueOffsets[projectIndex % 10]));
      scheduledFor = at(offset, 14, (projectIndex % 5) * 35).toISOString();
    }
    return {
      id: `${prefix}-t-${i}`, userId, projectId: project.id,
      title: `${actions[rank % actions.length]} (${projectIndex + 1}.${rank + 1})`,
      section: rank < 3 ? 'Preparation' : 'Execution',
      estimateMin: [10, 15, 25, 30][i % 4], status, order: rank,
      createdAt: at(-20).toISOString(),
      ...(scheduledFor ? { scheduledFor } : {}),
      ...(done ? { completedAt: at(-3, 16).toISOString() } : {}),
      ...(i % 4 === 0 ? { dueDate: project.dueDate } : {}),
      subtasks: [
        { id: `${prefix}-st-${i}-1`, title: 'Prepare the inputs', done: done || status === 'in_progress' },
        { id: `${prefix}-st-${i}-2`, title: 'Review the output', done },
      ],
    };
  });
  const sessions = Array.from({ length: sessionCount }, (_, i) => {
    const task = tasks[i % tasks.length];
    const minutes = [10, 15, 25][i % 3];
    // Historical sessions never end in the future, even when run before 09:00.
    const started = at(-14 + (i % 14), 9 + Math.floor(i / 14) % 10);
    const ended = new Date(started.getTime() + minutes * 60_000);
    return {
      id: `${prefix}-s-${i}`, userId, taskId: task.id, projectId: task.projectId,
      startedAt: started.toISOString(), endedAt: ended.toISOString(), minutes,
      completedTask: task.status === 'done' && task.completedAt === ended.toISOString(),
    };
  });
  return { projects, tasks, sessions };
}

export async function seedDemo({ baseUrl = 'http://localhost:3001', username = 'tinydo-demo', password, count = 100, now = new Date(), allowRemote = false }) {
  validateCount(count);
  const url = new URL(baseUrl);
  const local = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const remote = allowRemote === true && url.protocol === 'https:';
  if ((!local && !remote) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Use a local API origin, or explicitly enable TINYDO_SEED_ALLOW_REMOTE=true for an HTTPS origin.');
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 1024) throw new Error('Set TINYDO_SEED_PASSWORD to a password of 8–1024 characters.');
  if (typeof username !== 'string' || !/^\S{2,100}$/.test(username)) throw new Error('Username must be 2–100 characters without spaces.');
  const request = async (route, { token, method = 'GET', body } = {}) => {
    let response;
    try {
      response = await fetch(`${url.origin}${route}`, {
        method, redirect: 'error', signal: AbortSignal.timeout(remote && route === '/api/health' ? 60_000 : 15_000),
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch { throw new Error(`Cannot reach API at ${url.origin}. Check that the server is awake and available.`); }
    let data;
    try { data = await response.json(); } catch { throw new Error(`${route}: API did not return JSON.`); }
    return { status: response.status, data };
  };
  const health = await request('/api/health');
  if (health.status !== 200 || health.data.status !== 'ok') throw new Error('API health check failed.');
  let auth = await request('/api/auth/signup', { method: 'POST', body: { username, password } });
  const createdAccount = auth.status === 201;
  if (auth.status === 409) auth = await request('/api/auth/login', { method: 'POST', body: { username, password } });
  if (!auth.data.token || !auth.data.user?.id) throw new Error('Could not authenticate the demo account. Check username and TINYDO_SEED_PASSWORD.');
  const { token, user } = auth.data;
  const fixture = buildDemoData(user.id, count, now);
  for (let attempt = 0; attempt < 3; attempt++) {
    const snapshot = await request('/api/data', { token });
    if (snapshot.status !== 200) throw new Error(`Cannot read workspace (${snapshot.status}).`);
    const { data, revision } = snapshot.data;
    const expected = { ...data };
    const added = {};
    for (const collection of ['projects', 'tasks', 'sessions']) {
      const ids = new Set(data[collection].map(record => record.id));
      const missing = fixture[collection].filter(record => !ids.has(record.id));
      expected[collection] = [...data[collection], ...missing];
      added[collection] = missing.length;
    }
    if (revision === 0) {
      expected.settings = { ...data.settings, dailyGoalMin: 120, autoReplan: false };
      expected.meta = { ...data.meta, onboarded: true };
    }
    const needsWrite = Object.values(added).some(value => value > 0) || revision === 0;
    if (needsWrite) {
      const saved = await request('/api/data', { token, method: 'PUT', body: { data: expected, revision } });
      if (saved.status === 409) continue;
      if (saved.status !== 200) throw new Error(`Cannot save demo records (${saved.status}).`);
    }
    const verified = await request('/api/data', { token });
    if (verified.status !== 200) throw new Error('Read-back verification failed.');
    for (const collection of ['projects', 'tasks', 'sessions']) {
      const persisted = new Map(verified.data.data[collection].map(record => [record.id, record]));
      for (const record of expected[collection]) {
        if (!isDeepStrictEqual(persisted.get(record.id), record)) throw new Error(`Read-back mismatch in ${collection}; another client may have changed the workspace. Reload and rerun.`);
      }
    }
    return { username: user.username, createdAccount, requested: count, added, totals: Object.fromEntries(['projects', 'tasks', 'sessions'].map(key => [key, verified.data.data[key].length])) };
  }
  throw new Error('Workspace changed repeatedly. Close the demo account in the browser and rerun.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length && !((args.length === 2 && args[0] === '--count') || (args.length === 1 && /^\d+$/.test(args[0])))) throw new Error('Usage: node scripts/seed-demo.mjs --count 100 (or run npm run seed:demo for 100 records).');
    const result = await seedDemo({
      baseUrl: process.env.TINYDO_SEED_URL || 'http://localhost:3001',
      username: process.env.TINYDO_SEED_USERNAME || 'tinydo-demo',
      password: process.env.TINYDO_SEED_PASSWORD,
      count: args.length ? Number(args.at(-1)) : 100,
      allowRemote: process.env.TINYDO_SEED_ALLOW_REMOTE === 'true',
    });
    console.log(`Demo data verified. Username: ${result.username}`);
    console.log(`Added: ${result.added.projects} projects, ${result.added.tasks} tasks, ${result.added.sessions} sessions.`);
    console.log(`Workspace totals: ${result.totals.projects} projects, ${result.totals.tasks} tasks, ${result.totals.sessions} sessions.`);
    console.log(process.env.TINYDO_SEED_ALLOW_REMOTE === 'true' ? 'Sign in on the configured deployed app using this username and your supplied password.' : 'Open http://localhost:5173 and sign in using this username and your supplied password.');
    console.log('Data remains in the app database. Reruns preserve existing records, including your edits.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
