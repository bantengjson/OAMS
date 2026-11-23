import argon2 from 'argon2';
import { createTestApp } from './utils/app.js';
import { testTypes } from './utils/fixtures.js';
import type { LoginResult, TestContext } from './utils/app.js';

const URL = '/api/v1/stock-opnames';

describe('stock opname (e2e)', () => {
  let ctx: TestContext;
  let admin: LoginResult;
  let petugas: LoginResult;
  let petugas2: LoginResult;
  let viewer: LoginResult;
  let categoryId: string;
  let employeeId: string;
  let sessionId: string;
  const assets: Record<string, { id: string; assetCode: string; token: string }> = {};

  const bearer = (s: LoginResult) => ({ Authorization: `Bearer ${s.accessToken}` });
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

  const createAsset = async (key: string, extra: object = {}) => {
    const body = (
      await ctx
        .http()
        .post('/api/v1/assets')
        .set(bearer(admin))
        .send({
          name: `Opname ${key}`,
          categoryId,
          ownershipType: 'OFFICE',
          acquisitionYear: 2024,
          condition: 'GOOD',
          status: 'IN_USE',
          ...extra,
        })
        .expect(201)
    ).body as { id: string; assetCode: string; label: { token: string } };
    assets[key] = { id: body.id, assetCode: body.assetCode, token: body.label.token };
    return assets[key];
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await ctx.loginAs('ADMIN_INVENTARIS');
    petugas = await ctx.loginAs('PETUGAS_INVENTARIS');
    viewer = await ctx.loginAs('VIEWER');
    const p = ctx.prisma;
    const role = await p.role.findUniqueOrThrow({ where: { code: 'PETUGAS_INVENTARIS' } });
    const other = await p.user.upsert({
      where: { email: 'petugas-opname2@test.local' },
      update: { isActive: true },
      create: {
        email: 'petugas-opname2@test.local',
        fullName: 'Petugas Opname Dua',
        passwordHash: await argon2.hash('Petugas2Pass!', { type: argon2.argon2id }),
      },
    });
    await p.userRole.upsert({
      where: { userId_roleId: { userId: other.id, roleId: role.id } },
      update: {},
      create: { userId: other.id, roleId: role.id },
    });
    petugas2 = await ctx.login('petugas-opname2@test.local', 'Petugas2Pass!');
    categoryId = ((await testTypes(p)).bg).id;
    employeeId = (await p.employee.create({ data: { fullName: 'Pegawai Opname' } })).id;
    // Leave no OPEN session from another spec file in this shared database.
    await p.stockOpname.updateMany({ where: { status: 'OPEN' }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
    for (const k of ['found', 'differs', 'missing', 'borrowLater', 'repairLater', 'archiveLater']) await createAsset(k);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('ADMIN opens one session with a snapshot of active assets; a second one is refused', async () => {
    await ctx.http().post(URL).set(bearer(petugas)).send({ name: 'x', plannedDate: today() }).expect(403);
    const res = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ name: 'Opname Uji', plannedDate: today(), notes: 'Uji', officerIds: [petugas.userId] })
      .expect(201);
    sessionId = res.body.id;
    const expected = await ctx.prisma.asset.count({ where: { archivedAt: null, status: { not: 'DISPOSED' } } });
    expect(res.body).toMatchObject({ name: 'Opname Uji', status: 'OPEN', total: expected, scanned: 0 });
    expect(res.body.officers.map((o: { id: string }) => o.id)).toEqual([petugas.userId]);

    const dup = await ctx.http().post(URL).set(bearer(admin)).send({ name: 'Lagi', plannedDate: today() }).expect(409);
    expect(dup.body.message).toBe('Masih ada sesi stock opname yang terbuka.');
  });

  it('only listed officers (or managers) may scan; Viewer cannot even list', async () => {
    const res = await ctx
      .http()
      .post(`${URL}/${sessionId}/scan`)
      .set(bearer(petugas2))
      .send({ value: assets.found.assetCode })
      .expect(403);
    expect(res.body.message).toBe('Anda bukan petugas sesi ini.');
    await ctx.http().get(URL).set(bearer(viewer)).expect(403);
    await ctx.http().get(URL).set(bearer(petugas)).expect(200);
  });

  it('scanning by URL, token or code hits the same row exactly once', async () => {
    const a = assets.found;
    const first = await ctx
      .http()
      .post(`${URL}/${sessionId}/scan`)
      .set(bearer(petugas))
      .send({ value: `http://localhost:3000/a/${a.token}` })
      .expect(200);
    expect(first.body).toMatchObject({ alreadyScanned: false, item: { result: 'MATCHED', observedCondition: 'GOOD' } });
    expect(first.body.item.asset.id).toBe(a.id);

    for (const value of [a.token, a.assetCode.toLowerCase(), `/a/${a.token}`]) {
      const again = await ctx.http().post(`${URL}/${sessionId}/scan`).set(bearer(petugas)).send({ value }).expect(200);
      expect(again.body.alreadyScanned).toBe(true);
      expect(again.body.item.id).toBe(first.body.item.id);
    }
    const detail = await ctx.http().get(`${URL}/${sessionId}`).set(bearer(petugas)).expect(200);
    expect(detail.body.scanned).toBe(1);
  });

  it('confirming another condition marks the row as differing, and it can be corrected', async () => {
    const scan = await ctx
      .http()
      .post(`${URL}/${sessionId}/scan`)
      .set(bearer(petugas))
      .send({ value: assets.differs.assetCode })
      .expect(200);
    const itemId = scan.body.item.id;
    const c1 = await ctx
      .http()
      .post(`${URL}/${sessionId}/items/${itemId}/confirm`)
      .set(bearer(petugas))
      .send({ observedCondition: 'GOOD' })
      .expect(200);
    expect(c1.body.result).toBe('MATCHED');
    const c2 = await ctx
      .http()
      .post(`${URL}/${sessionId}/items/${itemId}/confirm`)
      .set(bearer(petugas))
      .send({ observedCondition: 'NEEDS_REPAIR', note: 'Kaki goyang' })
      .expect(200);
    expect(c2.body).toMatchObject({ result: 'CONDITION_DIFFERS', observedCondition: 'NEEDS_REPAIR', note: 'Kaki goyang' });
  });

  it('records an unknown QR once as unregistered', async () => {
    const value = 'https://contoh.test/a/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const u1 = await ctx.http().post(`${URL}/${sessionId}/scan`).set(bearer(petugas)).send({ value }).expect(200);
    expect(u1.body).toMatchObject({ alreadyScanned: false, item: { result: 'UNREGISTERED', asset: null } });
    const u2 = await ctx.http().post(`${URL}/${sessionId}/scan`).set(bearer(petugas)).send({ value }).expect(200);
    expect(u2.body.alreadyScanned).toBe(true);
    expect(u2.body.item.id).toBe(u1.body.item.id);
    const bad = await ctx.http().post(`${URL}/${sessionId}/scan`).set(bearer(petugas)).send({ value: 'halo' }).expect(400);
    expect(bad.body.message).toBe('Validasi gagal.');
  });

  it('closing judges unscanned items by their state at close', async () => {
    // Borrowed after the snapshot
    await ctx
      .http()
      .post('/api/v1/loans')
      .set(bearer(admin))
      .send({
        assetId: assets.borrowLater.id,
        borrowerType: 'EMPLOYEE',
        borrowerEmployeeId: employeeId,
        loanedAt: today(),
        dueAt: today(),
      })
      .expect(201);
    // In repair after the snapshot (maintenance row written directly; the module comes in a later task)
    await ctx.prisma.maintenanceRecord.create({
      data: {
        assetId: assets.repairLater.id,
        status: 'IN_PROGRESS',
        description: 'Diperbaiki',
        reportedById: admin.userId,
        startedAt: new Date(),
        previousStatus: 'IN_USE',
      },
    });
    await ctx.prisma.asset.update({ where: { id: assets.repairLater.id }, data: { status: 'UNDER_MAINTENANCE' } });
    // Archived after the snapshot
    await ctx.http().post(`/api/v1/assets/${assets.archiveLater.id}/archive`).set(bearer(admin)).send({}).expect(200);

    await ctx.http().post(`${URL}/${sessionId}/close`).set(bearer(petugas)).expect(403);
    const closed = await ctx.http().post(`${URL}/${sessionId}/close`).set(bearer(admin)).expect(200);
    expect(closed.body.status).toBe('CLOSED');

    const items = await ctx.http().get(`${URL}/${sessionId}/items`).set(bearer(admin)).expect(200);
    const byAsset = new Map(
      items.body.data.filter((i: { asset: unknown }) => i.asset).map((i: { asset: { id: string }; result: string }) => [i.asset.id, i.result]),
    );
    expect(byAsset.get(assets.borrowLater.id)).toBe('ON_LOAN');
    expect(byAsset.get(assets.repairLater.id)).toBe('IN_MAINTENANCE');
    expect(byAsset.get(assets.archiveLater.id)).toBe('REMOVED');
    expect(byAsset.get(assets.missing.id)).toBe('NOT_FOUND');
    expect(byAsset.get(assets.found.id)).toBe('MATCHED');

    const late = await ctx
      .http()
      .post(`${URL}/${sessionId}/scan`)
      .set(bearer(petugas))
      .send({ value: assets.missing.assetCode })
      .expect(409);
    expect(late.body.message).toBe('Sesi stock opname sudah ditutup.');
  });

  it('applies a differing condition once, and the report groups results', async () => {
    const items = await ctx.http().get(`${URL}/${sessionId}/items?result=CONDITION_DIFFERS`).set(bearer(admin)).expect(200);
    const row = items.body.data[0];
    expect(row.asset.id).toBe(assets.differs.id);
    await ctx.http().post(`${URL}/${sessionId}/items/${row.id}/apply-condition`).set(bearer(petugas)).expect(403);
    const applied = await ctx.http().post(`${URL}/${sessionId}/items/${row.id}/apply-condition`).set(bearer(admin)).expect(200);
    expect(applied.body.conditionAppliedAt).toBeTruthy();
    const asset = await ctx.http().get(`/api/v1/assets/${assets.differs.id}`).set(bearer(admin)).expect(200);
    expect(asset.body.condition).toBe('NEEDS_REPAIR');
    const logs = await ctx.http().get(`/api/v1/assets/${assets.differs.id}/condition-logs`).set(bearer(admin)).expect(200);
    expect(logs.body.data[0].source).toBe('OPNAME');
    await ctx.http().post(`${URL}/${sessionId}/items/${row.id}/apply-condition`).set(bearer(admin)).expect(409);

    const report = await ctx.http().get(`${URL}/${sessionId}/report`).set(bearer(petugas)).expect(200);
    expect(Object.keys(report.body.groups).sort()).toEqual(
      ['CONDITION_DIFFERS', 'IN_MAINTENANCE', 'MATCHED', 'NOT_FOUND', 'ON_LOAN', 'UNREGISTERED'].sort(),
    );
    expect(report.body.groups.UNREGISTERED).toHaveLength(1);
    const reportIds = Object.values(report.body.groups)
      .flat()
      .map((i) => (i as { asset: { id: string } | null }).asset?.id);
    expect(reportIds).not.toContain(assets.archiveLater.id);

    const history = await ctx.http().get(`/api/v1/assets/${assets.found.id}/history`).set(bearer(admin)).expect(200);
    expect(history.body.data.map((h: { action: string }) => h.action)).toContain('opname.scanned');
  });

  it('cancels only an open session and then allows a new one', async () => {
    const s2 = await ctx.http().post(URL).set(bearer(admin)).send({ name: 'Opname Kedua', plannedDate: today() }).expect(201);
    const cancelled = await ctx.http().post(`${URL}/${s2.body.id}/cancel`).set(bearer(admin)).expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');
    await ctx.http().post(`${URL}/${s2.body.id}/cancel`).set(bearer(admin)).expect(409);
    await ctx.http().post(`${URL}/${sessionId}/cancel`).set(bearer(admin)).expect(409);
    const stats = await ctx.http().get('/api/v1/assets/statistics').set(bearer(admin)).expect(200);
    expect(stats.body.openOpname).toBeNull();
  });

  describe('close racing with scanners', () => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const openSession = async (name: string) =>
      (await ctx.http().post(URL).set(bearer(admin)).send({ name, plannedDate: today() }).expect(201)).body.id as string;
    const itemOf = async (opnameId: string, assetId: string) =>
      (await ctx.prisma.stockOpnameItem.findFirstOrThrow({ where: { opnameId, assetId } })).id;

    it('a scan that commits while close is judging is not overwritten', async () => {
      const asset = await createAsset('raceScan');
      const id = await openSession('Opname Balapan Pindai');
      const itemId = await itemOf(id, asset.id);
      let closeRes: { status: number } | undefined;
      // Hold the row like an in-flight scan, let close reach it, then commit the scan.
      await ctx.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM stock_opname_items WHERE id = ${itemId}::uuid FOR UPDATE`;
          const closing = ctx
            .http()
            .post(`${URL}/${id}/close`)
            .set(bearer(admin))
            .then((r) => (closeRes = r));
          void closing;
          await sleep(400);
          await tx.stockOpnameItem.update({
            where: { id: itemId },
            data: { result: 'MATCHED', scannedAt: new Date(), scannedById: petugas.userId, observedCondition: 'GOOD' },
          });
        },
        { timeout: 10_000 },
      );
      for (let i = 0; i < 50 && !closeRes; i++) await sleep(100);
      expect(closeRes?.status).toBe(200);
      const row = await ctx.prisma.stockOpnameItem.findUniqueOrThrow({ where: { id: itemId } });
      expect(row.result).toBe('MATCHED');
    });

    it('a confirmation in flight when close starts is counted by close, never written after it', async () => {
      const asset = await createAsset('raceConfirm');
      const id = await openSession('Opname Balapan Konfirmasi');
      const itemId = await itemOf(id, asset.id);
      await ctx.http().post(`${URL}/${id}/scan`).set(bearer(petugas)).send({ value: asset.assetCode }).expect(200);
      let confirmRes: { status: number } | undefined;
      let closeRes: { status: number; body: { counts: Record<string, number> } } | undefined;
      await ctx.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM stock_opname_items WHERE id = ${itemId}::uuid FOR UPDATE`;
          void ctx
            .http()
            .post(`${URL}/${id}/items/${itemId}/confirm`)
            .set(bearer(petugas))
            .send({ observedCondition: 'DAMAGED' })
            .then((r) => (confirmRes = r));
          await sleep(400);
          void ctx
            .http()
            .post(`${URL}/${id}/close`)
            .set(bearer(admin))
            .then((r) => (closeRes = r));
          await sleep(400);
        },
        { timeout: 10_000 },
      );
      for (let i = 0; i < 50 && (!confirmRes || !closeRes); i++) await sleep(100);
      expect(closeRes?.status).toBe(200);
      const final = await ctx.http().get(`${URL}/${id}`).set(bearer(admin)).expect(200);
      // Whatever order won, the counts close reported are the counts the session keeps.
      expect(closeRes?.body.counts).toEqual(final.body.counts);
      if (confirmRes?.status === 200) expect(final.body.counts.CONDITION_DIFFERS).toBe(1);
      else expect(confirmRes?.status).toBe(409);
    });
  });
});
