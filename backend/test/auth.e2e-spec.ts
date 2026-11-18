import argon2 from 'argon2';
import { ALL_PERMISSION_CODES } from '../src/common/auth/permissions.catalog.js';
import { createTestApp, extractCookie, nextForwardedIp, TEST_ADMIN } from './utils/app.js';
import type { TestContext } from './utils/app.js';

const LOGIN = '/api/v1/auth/login';
const REFRESH = '/api/v1/auth/refresh';
const LOGOUT = '/api/v1/auth/logout';
const ME = '/api/v1/auth/me';
const CHANGE_PASSWORD = '/api/v1/auth/change-password';

describe('auth (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  const rawLogin = (body: Record<string, unknown>, ip = nextForwardedIp()) =>
    ctx.http().post(LOGIN).set('X-Forwarded-For', ip).send(body);

  it('logs in and returns an access token plus HttpOnly refresh cookie', async () => {
    const res = await rawLogin({ identifier: TEST_ADMIN.email, password: TEST_ADMIN.password }).expect(
      200,
    );
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.tokenType).toBe('Bearer');
    expect(res.body.expiresIn).toBe(900);
    expect(res.body.user.email).toBe(TEST_ADMIN.email);
    expect(res.body.user.roles).toEqual(['SUPER_ADMIN']);
    expect(res.body.user.permissions).toHaveLength(ALL_PERMISSION_CODES.length);
    expect(res.body.user).not.toHaveProperty('passwordHash');

    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith('oams_refresh='),
    );
    expect(cookie).toBeDefined();
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/api/v1/auth');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain('Secure');
  });

  it('accepts the email in any letter case', async () => {
    await rawLogin({ identifier: TEST_ADMIN.email.toUpperCase(), password: TEST_ADMIN.password }).expect(
      200,
    );
  });

  it('logs in with the username as well, case-insensitively', async () => {
    const res = await rawLogin({ identifier: TEST_ADMIN.username, password: TEST_ADMIN.password }).expect(200);
    expect(res.body.user.email).toBe(TEST_ADMIN.email);
    expect(res.body.user.username).toBe(TEST_ADMIN.username);
    await rawLogin({ identifier: ` ${TEST_ADMIN.username.toUpperCase()} `, password: TEST_ADMIN.password }).expect(200);
    await rawLogin({ identifier: TEST_ADMIN.username, password: 'salah-sekali' }).expect(401);
  });

  it('rejects a wrong password with 401 and the Indonesian message', async () => {
    const res = await rawLogin({ identifier: TEST_ADMIN.email, password: 'salah-sekali' }).expect(401);
    expect(res.body.message).toBe('Email/username atau password salah.');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('rejects an unknown email with the same 401 message', async () => {
    const res = await rawLogin({ identifier: 'nobody@test.local', password: 'Whatever123' }).expect(
      401,
    );
    expect(res.body.message).toBe('Email/username atau password salah.');
  });

  it('validates the login body', async () => {
    const res = await rawLogin({}).expect(400);
    expect(res.body.message).toBe('Validasi gagal.');
    expect(res.body.errors).toHaveProperty('identifier');
    expect(res.body.errors).toHaveProperty('password');
  });

  it('rejects a deactivated user with 403 and sets no cookie', async () => {
    const email = 'nonaktif@test.local';
    await ctx.prisma.user.upsert({
      where: { email },
      update: { isActive: false },
      create: {
        email,
        fullName: 'Nonaktif',
        isActive: false,
        passwordHash: await argon2.hash('Nonaktif123', { type: argon2.argon2id }),
      },
    });
    const res = await rawLogin({ identifier: email, password: 'Nonaktif123' }).expect(403);
    expect(res.body.message).toBe('Akun dinonaktifkan. Hubungi administrator.');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('GET /auth/me requires a token and returns the profile', async () => {
    const noToken = await ctx.http().get(ME).expect(401);
    expect(noToken.body.message).toBe('Autentikasi diperlukan.');

    await ctx.http().get(ME).set('Authorization', 'Bearer bukan.token.valid').expect(401);

    const session = await ctx.login(TEST_ADMIN.email, TEST_ADMIN.password);
    const res = await ctx
      .http()
      .get(ME)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    expect(res.body.email).toBe(TEST_ADMIN.email);
    expect(res.body.roles).toEqual(['SUPER_ADMIN']);
    expect(Array.isArray(res.body.permissions)).toBe(true);
  });

  it('refresh rotates the cookie and the old one is then rejected', async () => {
    const session = await ctx.login(TEST_ADMIN.email, TEST_ADMIN.password);

    const refreshed = await ctx.http().post(REFRESH).set('Cookie', session.refreshCookie).expect(200);
    expect(typeof refreshed.body.accessToken).toBe('string');
    const rotated = extractCookie(refreshed.headers['set-cookie'], 'oams_refresh');
    expect(rotated).not.toBe(session.refreshCookie);

    await ctx.prisma.refreshToken.updateMany({
      where: { userId: session.userId, revokedAt: { not: null } },
      data: { revokedAt: new Date(Date.now() - 10 * 60 * 1000) },
    });
    const replay = await ctx.http().post(REFRESH).set('Cookie', session.refreshCookie).expect(401);
    expect(replay.body.message).toBe('Sesi tidak valid.');
  });

  it('a logged-out token is rejected immediately, grace window or not', async () => {
    const session = await ctx.login(TEST_ADMIN.email, TEST_ADMIN.password);
    await ctx.http().post(LOGOUT).set('Cookie', session.refreshCookie).expect(204);
    await ctx.http().post(REFRESH).set('Cookie', session.refreshCookie).expect(401);
  });

  it('tolerates a second refresh with the same cookie inside the reuse grace window', async () => {
    // two browser tabs (or React StrictMode) refreshing at the same moment
    const session = await ctx.login(TEST_ADMIN.email, TEST_ADMIN.password);
    const [first, second] = await Promise.all([
      ctx.http().post(REFRESH).set('Cookie', session.refreshCookie),
      ctx.http().post(REFRESH).set('Cookie', session.refreshCookie),
    ]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const cookieA = extractCookie(first.headers['set-cookie'], 'oams_refresh');
    const cookieB = extractCookie(second.headers['set-cookie'], 'oams_refresh');
    expect(cookieA).not.toBe(cookieB);
    // both successors stay usable
    await ctx.http().post(REFRESH).set('Cookie', cookieA).expect(200);
    await ctx.http().post(REFRESH).set('Cookie', cookieB).expect(200);
  });

  it('a replayed refresh token revokes every session of the user', async () => {
    const victim = await ctx.loginAs('PETUGAS_INVENTARIS');
    const second = await ctx.login(victim.email, 'Test1234!');

    const rotatedRes = await ctx.http().post(REFRESH).set('Cookie', victim.refreshCookie).expect(200);
    const rotatedCookie = extractCookie(rotatedRes.headers['set-cookie'], 'oams_refresh');

    // pretend the rotation happened long ago (outside the reuse grace window)
    await ctx.prisma.refreshToken.updateMany({
      where: { userId: victim.userId, revokedAt: { not: null } },
      data: { revokedAt: new Date(Date.now() - 10 * 60 * 1000) },
    });

    // replay of the already-rotated token: theft signal
    await ctx.http().post(REFRESH).set('Cookie', victim.refreshCookie).expect(401);

    // every other live session of that user is now dead
    await ctx.http().post(REFRESH).set('Cookie', rotatedCookie).expect(401);
    await ctx.http().post(REFRESH).set('Cookie', second.refreshCookie).expect(401);

    const live = await ctx.prisma.refreshToken.count({
      where: { userId: victim.userId, revokedAt: null },
    });
    expect(live).toBe(0);
  });

  it('refresh without a cookie is rejected', async () => {
    const res = await ctx.http().post(REFRESH).expect(401);
    expect(res.body.message).toBe('Sesi tidak valid.');
  });

  it('logout clears the cookie and revokes the token', async () => {
    const session = await ctx.login(TEST_ADMIN.email, TEST_ADMIN.password);
    const res = await ctx
      .http()
      .post(LOGOUT)
      .set('Cookie', session.refreshCookie)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(204);
    const cleared = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith('oams_refresh='),
    );
    expect(cleared).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);

    await ctx.http().post(REFRESH).set('Cookie', session.refreshCookie).expect(401);
  });

  it('change-password verifies the current password, enforces strength and revokes sessions', async () => {
    const session = await ctx.loginAs('VIEWER');
    const auth = (token: string) => `Bearer ${token}`;

    const wrongCurrent = await ctx
      .http()
      .patch(CHANGE_PASSWORD)
      .set('Authorization', auth(session.accessToken))
      .send({ currentPassword: 'Salah1234', newPassword: 'BaruBanget123' })
      .expect(400);
    expect(wrongCurrent.body.message).toBe('Password saat ini salah.');

    const weak = await ctx
      .http()
      .patch(CHANGE_PASSWORD)
      .set('Authorization', auth(session.accessToken))
      .send({ currentPassword: 'Test1234!', newPassword: 'lemah' })
      .expect(400);
    expect(weak.body.message).toBe(
      'Password minimal 8 karakter dan mengandung huruf serta angka.',
    );

    await ctx
      .http()
      .patch(CHANGE_PASSWORD)
      .set('Authorization', auth(session.accessToken))
      .send({ currentPassword: 'Test1234!', newPassword: 'BaruBanget123' })
      .expect(204);

    await ctx.http().post(REFRESH).set('Cookie', session.refreshCookie).expect(401);
    await rawLogin({ identifier: session.email, password: 'Test1234!' }).expect(401);
    await rawLogin({ identifier: session.email, password: 'BaruBanget123' }).expect(200);

    const audit = await ctx.prisma.auditLog.findFirst({
      where: { action: 'auth.password_changed', actorId: session.userId },
    });
    expect(audit).not.toBeNull();
  });

  it('records successful and failed logins in the audit log', async () => {
    await rawLogin({ identifier: TEST_ADMIN.email, password: 'salah-lagi' }).expect(401);
    const failed = await ctx.prisma.auditLog.findFirst({
      where: { action: 'auth.login_failed', module: 'auth' },
      orderBy: { createdAt: 'desc' },
    });
    expect(failed?.after).toMatchObject({ identifier: TEST_ADMIN.email });

    const session = await ctx.login(TEST_ADMIN.email, TEST_ADMIN.password);
    const ok = await ctx.prisma.auditLog.findFirst({
      where: { action: 'auth.login', actorId: session.userId },
      orderBy: { createdAt: 'desc' },
    });
    expect(ok).not.toBeNull();
    const user = await ctx.prisma.user.findUnique({ where: { email: TEST_ADMIN.email } });
    expect(user?.lastLoginAt).not.toBeNull();
  });

  it('locks an account after 5 failed attempts per minute', async () => {
    const ip = '203.0.113.77';
    for (let i = 0; i < 5; i += 1) {
      await rawLogin({ identifier: 'limit@test.local', password: 'Salah1234' }, ip).expect(401);
    }
    const blocked = await rawLogin({ identifier: 'limit@test.local', password: 'Salah1234' }, ip).expect(
      429,
    );
    expect(blocked.body.message).toBe('Terlalu banyak percobaan login. Coba lagi dalam satu menit.');
    // the lock follows the account, not the address
    await rawLogin({ identifier: 'LIMIT@test.local', password: 'Salah1234' }, '203.0.113.78').expect(429);
  });

  it('does not lock other people sharing one address (office NAT)', async () => {
    const ip = '198.51.100.9';
    for (let i = 0; i < 6; i += 1) {
      await rawLogin({ identifier: `nat${i}@test.local`, password: 'Salah1234' }, ip).expect(401);
    }
    await rawLogin({ identifier: TEST_ADMIN.email, password: TEST_ADMIN.password }, ip).expect(200);
  });

  it('rate limits anonymous refresh calls per address', async () => {
    const ip = '192.0.2.44';
    for (let i = 0; i < 60; i += 1) {
      await ctx.http().post(REFRESH).set('X-Forwarded-For', ip).expect(401);
    }
    await ctx.http().post(REFRESH).set('X-Forwarded-For', ip).expect(429);
  });
});
