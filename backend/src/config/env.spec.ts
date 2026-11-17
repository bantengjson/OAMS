import { loadEnv } from './env.js';

const valid = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/oams',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  SEED_ADMIN_EMAIL: 'admin@example.com',
  SEED_ADMIN_PASSWORD: 'Admin1234!',
  SEED_ADMIN_NAME: 'Super Admin',
};

describe('loadEnv', () => {
  it('applies defaults for optional values', () => {
    const env = loadEnv({ ...valid });
    expect(env.PORT).toBe(4000);
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(7);
    expect(env.APP_TIMEZONE).toBe('Asia/Jakarta');
    expect(env.NODE_ENV).toBe('development');
    expect(env.COOKIE_SECURE).toBe(false);
  });

  it('defaults COOKIE_SECURE to true in production', () => {
    const env = loadEnv({ ...valid, NODE_ENV: 'production' });
    expect(env.COOKIE_SECURE).toBe(true);
  });

  it('parses explicit string values', () => {
    const env = loadEnv({ ...valid, PORT: '5000', COOKIE_SECURE: 'false', NODE_ENV: 'production' });
    expect(env.PORT).toBe(5000);
    expect(env.COOKIE_SECURE).toBe(false);
  });

  it('throws a message naming every missing or invalid key', () => {
    expect(() => loadEnv({ JWT_ACCESS_SECRET: 'short' })).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ JWT_ACCESS_SECRET: 'short' })).toThrow(/JWT_ACCESS_SECRET/);
  });
});
