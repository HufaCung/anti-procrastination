import { cp, mkdir } from 'node:fs/promises';
const target = new URL('../dist/db/migrations/', import.meta.url);
await mkdir(target, { recursive: true });
await cp(new URL('../src/db/migrations/', import.meta.url), target, { recursive: true });
