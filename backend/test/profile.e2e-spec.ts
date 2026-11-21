import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { createTestApp } from './utils/app.js';
import type { LoginResult, TestContext } from './utils/app.js';

const AVATAR_DIR = join(resolve(process.cwd(), '.test-uploads'), 'avatars');

async function png(width = 400, height = 200): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#e11d48' } })
    .png()
    .toBuffer();
}

const avatarFiles = () => (existsSync(AVATAR_DIR) ? readdirSync(AVATAR_DIR) : []);

describe('own profile: name and photo (e2e)', () => {
  let ctx: TestContext;
  let viewer: LoginResult;
  let admin: LoginResult;

  const bearer = (s: LoginResult) => ({ Authorization: `Bearer ${s.accessToken}` });
  const avatarPath = (url: string) => url.replace(/\?.*$/, '');

  beforeAll(async () => {
    ctx = await createTestApp();
    viewer = await ctx.loginAs('VIEWER');
    admin = await ctx.loginAs('ADMIN_INVENTARIS');
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('anyone signed in changes their own display name, not their username', async () => {
    const before = await ctx.http().get('/api/v1/auth/me').set(bearer(viewer)).expect(200);
    const res = await ctx.http().patch('/api/v1/auth/me').set(bearer(viewer)).send({ fullName: '  Budi Santoso  ' }).expect(200);
    expect(res.body).toMatchObject({ id: viewer.userId, fullName: 'Budi Santoso', username: before.body.username, avatarUrl: null });
    const me = await ctx.http().get('/api/v1/auth/me').set(bearer(viewer)).expect(200);
    expect(me.body.fullName).toBe('Budi Santoso');

    await ctx.http().patch('/api/v1/auth/me').set(bearer(viewer)).send({ fullName: ' ' }).expect(400);
    await ctx.http().patch('/api/v1/auth/me').set(bearer(viewer)).send({ fullName: 'x'.repeat(151) }).expect(400);
    // Only the name: other fields are rejected, not silently applied.
    await ctx.http().patch('/api/v1/auth/me').set(bearer(viewer)).send({ fullName: 'Budi', username: 'baru' }).expect(400);

    const audit = await ctx.prisma.auditLog.findFirst({ where: { action: 'user.profile_updated', entityId: viewer.userId } });
    expect(audit?.actorId).toBe(viewer.userId);
  });

  it('uploads a photo as a 256x256 WebP and serves it to other users', async () => {
    const res = await ctx.http().post('/api/v1/auth/me/avatar').set(bearer(viewer)).attach('file', await png(), 'me.png').expect(201);
    const url = res.body.avatarUrl as string;
    expect(url).toMatch(new RegExp(`^/api/v1/users/${viewer.userId}/avatar\\?v=`));

    const file = await ctx.http().get(avatarPath(url)).set(bearer(admin)).buffer(true).expect(200);
    expect(file.headers['content-type']).toContain('image/webp');
    const meta = await sharp(file.body as Buffer).metadata();
    expect(meta).toMatchObject({ format: 'webp', width: 256, height: 256 });
    expect(meta.exif).toBeUndefined();

    const me = await ctx.http().get('/api/v1/auth/me').set(bearer(viewer)).expect(200);
    expect(me.body.avatarUrl).toBe(url);
    const list = await ctx.http().get('/api/v1/users').query({ search: viewer.email }).set(bearer(await ctx.loginAs('SUPER_ADMIN'))).expect(200);
    expect(list.body.data[0].avatarUrl).toBe(url);

    await ctx.http().get(avatarPath(url)).expect(401);
  });

  it('replacing the photo deletes the old file', async () => {
    const before = await ctx.http().get('/api/v1/auth/me').set(bearer(viewer)).expect(200);
    const oldName = new URL(before.body.avatarUrl, 'http://x').searchParams.get('v');
    expect(avatarFiles().some((f) => f.startsWith(oldName!))).toBe(true);

    const res = await ctx.http().post('/api/v1/auth/me/avatar').set(bearer(viewer)).attach('file', await png(100, 300), 'b.png').expect(201);
    expect(res.body.avatarUrl).not.toBe(before.body.avatarUrl);
    expect(avatarFiles().some((f) => f.startsWith(oldName!))).toBe(false);
  });

  it('rejects files that are not photos, and files over 5 MB', async () => {
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
    await ctx.http().post('/api/v1/auth/me/avatar').set(bearer(viewer)).attach('file', pdf, 'x.png').expect(400);
    await ctx.http().post('/api/v1/auth/me/avatar').set(bearer(viewer)).expect(400);
    const big = Buffer.concat([await png(), Buffer.alloc(5 * 1024 * 1024 + 1)]);
    const res = await ctx.http().post('/api/v1/auth/me/avatar').set(bearer(viewer)).attach('file', big, 'big.png');
    expect([400, 413]).toContain(res.status);
  });

  it('removing the photo falls back to initials and deletes the file', async () => {
    const before = await ctx.http().get('/api/v1/auth/me').set(bearer(viewer)).expect(200);
    const name = new URL(before.body.avatarUrl, 'http://x').searchParams.get('v');
    const res = await ctx.http().delete('/api/v1/auth/me/avatar').set(bearer(viewer)).expect(200);
    expect(res.body.avatarUrl).toBeNull();
    expect(avatarFiles().some((f) => f.startsWith(name!))).toBe(false);
    await ctx.http().get(`/api/v1/users/${viewer.userId}/avatar`).set(bearer(admin)).expect(404);

    const actions = await ctx.prisma.auditLog.findMany({ where: { module: 'users', entityId: viewer.userId }, select: { action: true } });
    expect(actions.map((a) => a.action)).toEqual(expect.arrayContaining(['user.avatar_updated', 'user.avatar_removed']));
  });
});
