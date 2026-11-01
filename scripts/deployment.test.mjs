import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('production serves React and API together, and retains SQLite data across restart', { timeout: 30000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'tinydo-deploy-'));
  const jwtSecret = randomUUID();
  const adminPassword = randomUUID();
  let child;
  let exited;
  const stop = async () => {
    if (child && child.exitCode === null && child.signalCode === null) child.kill();
    if (exited) await exited;
  };
  const start = () => new Promise((resolve, reject) => {
    child = spawn(process.execPath, ['backend/dist/server.js'], { cwd: root, windowsHide: true, env: {
      ...process.env, NODE_ENV: 'production', PORT: '0', JWT_SECRET: jwtSecret,
      DATA_DIR: directory, DATABASE_PATH: path.join(directory, 'smoke.db'),
      BOOTSTRAP_ADMIN: 'true', ADMIN_USERNAME: 'bootstrap-smoke-admin', ADMIN_PASSWORD: adminPassword,
    }, stdio: ['ignore', 'pipe', 'pipe'] });
    exited = new Promise(resolveExit => child.once('exit', resolveExit));
    const timeout = setTimeout(() => reject(new Error('Production server startup timed out')), 10000);
    let output = '';
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/http:\/\/localhost:(\d+)/);
      if (match) { clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}`); }
    });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Production server exited: ${code}`)); });
  });
  try {
    let base = await start();
    const adminLogin = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'bootstrap-smoke-admin', password: adminPassword }) });
    const admin = await adminLogin.json();
    assert.equal(admin.user.role, 'admin');
    assert.equal((await fetch(base + '/api/admin/users', { headers: { Authorization: `Bearer ${admin.token}` } })).status, 200);
    for (const route of ['/', '/login', '/admin', '/projects/example']) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /text\/html/);
      assert.match(await response.text(), /id="root"/);
    }
    const home = await (await fetch(base)).text();
    const asset = home.match(/src="([^"]+\.js)"/)[1];
    assert.equal((await fetch(base + asset)).status, 200);
    assert.equal((await fetch(base + '/assets/missing.js')).status, 404);
    const missingApi = await fetch(base + '/api/not-found');
    assert.equal(missingApi.status, 404);
    assert.deepEqual(await missingApi.json(), { error: 'API route not found' });
    assert.equal((await fetch(base + '/api/admin/users')).status, 401);
    const username = `deploy-${randomUUID()}`;
    const password = randomUUID();
    const response = await fetch(base + '/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    assert.equal(response.status, 201);
    const registered = await response.json();
    await stop();
    base = await start();
    assert.equal((await fetch(base + '/api/admin/users', { headers: { Authorization: `Bearer ${admin.token}` } })).status, 200);
    const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    assert.equal((await login.json()).user.id, registered.user.id);
    assert.equal((await fetch(base + '/api/auth/me', { headers: { Authorization: `Bearer ${registered.token}` } })).status, 200);
  } finally {
    await stop();
    const target = path.resolve(directory);
    if (path.dirname(target) !== path.resolve(tmpdir()) || !path.basename(target).startsWith('tinydo-deploy-')) throw new Error('Unexpected temporary directory');
    await rm(target, { recursive: true, force: true });
  }
});
