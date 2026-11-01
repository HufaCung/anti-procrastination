import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testDir = await mkdtemp(path.join(tmpdir(), 'tinydo-features-'));
const headed = process.argv.includes('--headed');
function run(args, env = {}) {
  return new Promise((resolve, reject) => {
    // Arguments are fixed below; using cmd on Windows supports npm.cmd.
    const child = process.platform === 'win32'
      ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], { cwd: root, stdio: 'inherit', env: { ...process.env, ...env }, windowsHide: true })
      : spawn('npm', args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`npm ${args.join(' ')} failed (${code})`)));
  });
}
try {
  await run(['test']);
  await run(['run', 'build']);
  if (!process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) await run(['exec', '--workspace=frontend', '--', 'playwright', 'install', 'chromium']);
  await run(['exec', '--workspace=frontend', '--', 'playwright', 'test', '--config=playwright.features.config.ts', ...(headed ? ['--headed'] : [])], { TINYDO_TEST_DATABASE: path.join(testDir, 'features.db'), TINYDO_TEST_ADMIN_PASSWORD: randomUUID() });
  console.log('Feature checks passed. HTML report: frontend/playwright-report/features/index.html');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  const target = path.resolve(testDir);
  if (path.dirname(target) !== path.resolve(tmpdir()) || !path.basename(target).startsWith('tinydo-features-')) {
    throw new Error('Refusing to remove a directory outside the temporary feature-test folder.');
  }
  await rm(target, { recursive: true, force: true });
}
