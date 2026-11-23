import { createTestApp } from './utils/app.js';
import type { LoginResult, TestContext } from './utils/app.js';

describe('rooms (e2e)', () => {
  let ctx: TestContext;
  let admin: LoginResult;
  let viewer: LoginResult;
  const URL = '/api/v1/rooms';
  const bearer = (s: LoginResult) => ({ Authorization: `Bearer ${s.accessToken}` });

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await ctx.loginAs('ADMIN_INVENTARIS');
    viewer = await ctx.loginAs('VIEWER');
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('lists the 15 seeded rooms in letter order', async () => {
    const res = await ctx.http().get(URL).set(bearer(viewer)).expect(200);
    const codes = res.body.map((r: { code: string }) => r.code);
    expect(codes.slice(0, 15)).toEqual('ABCDEFGHIJKLMNO'.split(''));
    expect(res.body[0]).toMatchObject({ code: 'A', name: 'Sekretariat', isActive: true, inUse: expect.any(Boolean) });
    expect(res.body.some((r: { code: string }) => r.code === 'KANTOR')).toBe(false);
  });

  it('adds room P with the next letter', async () => {
    const res = await ctx.http().post(URL).set(bearer(admin)).send({ name: '  Ruang Arsip  ' }).expect(201);
    expect(res.body).toMatchObject({ code: 'P', name: 'Ruang Arsip', isActive: true, inUse: false });
    const audit = await ctx.prisma.auditLog.findFirst({ where: { action: 'room.created', entityId: res.body.id } });
    expect(audit?.actorId).toBe(admin.userId);
  });

  it('viewer cannot add (403) and the name is required (400)', async () => {
    await ctx.http().post(URL).set(bearer(viewer)).send({ name: 'Ruang X' }).expect(403);
    await ctx.http().post(URL).set(bearer(admin)).send({ name: ' ' }).expect(400);
    await ctx.http().post(URL).set(bearer(admin)).send({ name: 'Ruang Y', code: 'Z' }).expect(400);
  });

  it('renames a room but never changes its letter', async () => {
    const p = await ctx.prisma.location.findUniqueOrThrow({ where: { code: 'P' } });
    const res = await ctx.http().patch(`${URL}/${p.id}`).set(bearer(admin)).send({ name: 'Arsip Lama' }).expect(200);
    expect(res.body).toMatchObject({ code: 'P', name: 'Arsip Lama' });
    await ctx.http().patch(`${URL}/${p.id}`).set(bearer(admin)).send({ code: 'Q' }).expect(400);
  });

  it('deactivated room hidden from active list', async () => {
    const p = await ctx.prisma.location.findUniqueOrThrow({ where: { code: 'P' } });
    await ctx.http().post(`${URL}/${p.id}/deactivate`).set(bearer(admin)).expect(200);
    const active = await ctx.http().get(URL).query({ isActive: true }).set(bearer(viewer)).expect(200);
    expect(active.body.some((r: { code: string }) => r.code === 'P')).toBe(false);
    const all = await ctx.http().get(URL).set(bearer(viewer)).expect(200);
    expect(all.body.find((r: { code: string }) => r.code === 'P')).toMatchObject({ isActive: false });
    await ctx.http().post(`${URL}/${p.id}/activate`).set(bearer(admin)).expect(200);
  });

  it('a non-room id is 404', async () => {
    const office = await ctx.prisma.location.findUniqueOrThrow({ where: { code: 'KANTOR' } });
    await ctx.http().patch(`${URL}/${office.id}`).set(bearer(admin)).send({ name: 'X' }).expect(404);
  });
});
