import { AssetCodeService } from '../src/modules/assets/asset-code.js';
import { createTestApp } from './utils/app.js';
import type { LoginResult, TestContext } from './utils/app.js';

const P1 = 'NG.Z/990/UJI/2090';
const P2 = 'NG.Z/991/UJI/2090';

describe('asset codes (e2e)', () => {
  let ctx: TestContext;
  let service: AssetCodeService;
  let admin: LoginResult;
  let superAdmin: LoginResult;
  let viewer: LoginResult;
  const bearer = (s: LoginResult) => ({ Authorization: `Bearer ${s.accessToken}` });
  const ORG_URL = '/api/v1/settings/asset-code-org';

  beforeAll(async () => {
    ctx = await createTestApp();
    service = ctx.app.get(AssetCodeService);
    admin = await ctx.loginAs('ADMIN_INVENTARIS');
    superAdmin = await ctx.loginAs('SUPER_ADMIN');
    viewer = await ctx.loginAs('VIEWER');
    await ctx.prisma.assetCodeSequence.deleteMany({ where: { prefix: { in: [P1, P2] } } });
  });

  afterAll(async () => {
    await ctx.prisma.assetCodeSequence.deleteMany({ where: { prefix: { in: [P1, P2] } } });
    await ctx.prisma.systemSetting.update({ where: { key: 'asset_code_org' }, data: { value: 'DPC' } });
    await ctx.close();
  });

  it('parallel creation gives unique codes', async () => {
    const codes = await Promise.all(Array.from({ length: 6 }, () => ctx.prisma.$transaction((tx) => service.next(tx, P1))));
    expect([...codes].sort((a, b) => a.localeCompare(b))).toEqual(['01', '02', '03', '04', '05', '06'].map((u) => `${P1}-${u}`));
  });

  it('numbers per prefix', async () => {
    expect(await ctx.prisma.$transaction((tx) => service.next(tx, P2))).toBe(`${P2}-01`);
    expect(await ctx.prisma.$transaction((tx) => service.next(tx, P1))).toBe(`${P1}-07`);
  });

  it('does not consume a number when the surrounding transaction rolls back', async () => {
    await expect(
      ctx.prisma.$transaction(async (tx) => {
        await service.next(tx, P2);
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(await ctx.prisma.$transaction((tx) => service.next(tx, P2))).toBe(`${P2}-02`);
  });

  it('org setting changes new codes only', async () => {
    const got = await ctx.http().get(ORG_URL).set(bearer(viewer)).expect(200);
    expect(got.body).toEqual({ value: 'DPC' });
    const res = await ctx.http().put(ORG_URL).set(bearer(admin)).send({ value: ' dpd ' }).expect(200);
    expect(res.body).toEqual({ value: 'DPD' });
    expect(await ctx.prisma.$transaction((tx) => service.org(tx))).toBe('DPD');
    const audit = await ctx.prisma.auditLog.findFirst({ where: { action: 'setting.asset_code_org_changed' }, orderBy: { createdAt: 'desc' } });
    expect(audit).toMatchObject({ actorId: admin.userId, before: { value: 'DPC' }, after: { value: 'DPD' } });
    await ctx.http().put(ORG_URL).set(bearer(superAdmin)).send({ value: 'DPC' }).expect(200);
  });

  it('viewer cannot change org (403)', async () => {
    await ctx.http().put(ORG_URL).set(bearer(viewer)).send({ value: 'XYZ' }).expect(403);
  });

  it("org 'd p c' → 400", async () => {
    const res = await ctx.http().put(ORG_URL).set(bearer(admin)).send({ value: 'd p c' }).expect(400);
    expect(res.body.message).toBe('Kode organisasi harus 2-10 huruf atau angka tanpa spasi.');
  });
});
