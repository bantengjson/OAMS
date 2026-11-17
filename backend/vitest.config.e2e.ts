import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://placeholder:placeholder@localhost:5433/placeholder',
      JWT_ACCESS_SECRET: 'test-only-secret-that-is-at-least-32-chars-long',
      COOKIE_SECURE: 'false',
    },
  },
});
