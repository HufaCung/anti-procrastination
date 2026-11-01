import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { env: { DATABASE_URL: '', REQUIRE_DATABASE_URL: 'false', DATABASE_PATH: ':memory:', NODE_ENV: 'test' } } });
