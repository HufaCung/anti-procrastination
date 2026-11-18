import EmbeddedPostgres from 'embedded-postgres';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export async function startTestPostgres() {
  const directory = await mkdtemp(path.join(tmpdir(), 'tinydo-pg-'));
  const port = await new Promise(resolve => { const server = createServer(); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
  const password = randomUUID();
  const cluster = new EmbeddedPostgres({ databaseDir: path.join(directory, 'cluster'), user: 'tinydo_test', password, port,
    persistent: true, authMethod: 'scram-sha-256', initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
  const stop = async () => {
    await cluster.stop();
    const target = path.resolve(directory);
    if (path.dirname(target) !== path.resolve(tmpdir()) || !path.basename(target).startsWith('tinydo-pg-')) throw new Error('Unexpected test directory');
    await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  };
  try { await cluster.initialise(); await cluster.start(); }
  catch (error) { await stop(); throw error; }
  return { directory, connectionString: `postgresql://tinydo_test:${password}@127.0.0.1:${port}/postgres`, stop };
}
