import { AssetStateGuard } from '../src/modules/assets/asset-state.guard.js';
import { createTestApp } from './utils/app.js';
import { testTypes } from './utils/fixtures.js';
import type { LoginResult, TestContext } from './utils/app.js';

/** Cross-flow races: whichever flow changes the asset first wins; the others get 409 and leave no trace. */
describe('asset state guard (e2e)', () => {
  let ctx: TestContext;
  let admin: LoginResult;
  let petugas: LoginResult;
  let categoryId: string;
  let employeeId: string;
  let roomId: string;
  let room2Id: string;

  const bearer = (s: LoginResult) => ({ Authorization: `Bearer ${s.accessToken}` });
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

  const createAsset = async (name: string) =>
    (
      await ctx
        .http()
        .post('/api/v1/assets')
        .set(bearer(admin))
        .send({
          name,
          categoryId,
          locationId: roomId,
          ownershipType: 'OFFICE',
          acquisitionYear: 2024,
          condition: 'GOOD',
          status: 'IN_USE',
        })
        .expect(201)
    ).body as { id: string };

  const loan = (assetId: string) =>
    ctx
      .http()
      .post('/api/v1/loans')
      .set(bearer(admin))
      .send({ assetId, borrowerType: 'EMPLOYEE', borrowerEmployeeId: employeeId, loanedAt: today(), dueAt: today() });

  const archive = (assetId: string) =>
    ctx.http().post(`/api/v1/assets/${assetId}/archive`).set(bearer(admin)).send({});

  // Petugas may request but not approve, so the request stays PENDING and leaves the asset row untouched.
  const requestMutation = (assetId: string) =>
    ctx.http().post('/api/v1/mutations').set(bearer(petugas)).send({ assetId, toLocationId: room2Id, reason: 'Uji balapan' });

  /** Polls until `done` holds; fails the test instead of hanging when it never does. */
  const waitUntil = async (done: () => Promise<boolean>) => {
    const deadline = Date.now() + 5000;
    while (!(await done())) {
      if (Date.now() > deadline) throw new Error('waitUntil: timed out');
      await new Promise((r) => setTimeout(r, 10));
    }
  };
  const lockWaiters = async () =>
    (
      await ctx.prisma.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'`
    )[0].n;

  /**
   * Archives the asset while `other` runs inside archive's state read, just before or just after
   * the real load. `other` runs to the end, or until it waits for a row lock archive holds.
   */
  const archiveRacing = async (assetId: string, when: 'before' | 'after', other: () => Promise<{ status: number }>) => {
    let started: Promise<{ status: number }> | undefined;
    const runOther = async () => {
      let settled = false;
      started = other().then((r) => {
        settled = true;
        return r;
      });
      await waitUntil(async () => settled || (await lockWaiters()) > 0);
    };
    const spy = vi
      .spyOn(AssetStateGuard.prototype, 'load')
      .mockImplementationOnce(async function (this: AssetStateGuard, ...args) {
        if (when === 'before') await runOther();
        const state = await this.load(...args); // the once-implementation is used up: real load()
        if (when === 'after') await runOther();
        return state;
      });
    try {
      const archiveStatus = (await archive(assetId)).status;
      return { archive: archiveStatus, other: (await started!).status };
    } finally {
      spy.mockRestore();
    }
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await ctx.loginAs('ADMIN_INVENTARIS');
    petugas = await ctx.loginAs('PETUGAS_INVENTARIS');
    categoryId = ((await testTypes(ctx.prisma)).ng).id;
    employeeId = (await ctx.prisma.employee.create({ data: { fullName: 'Pegawai Balapan' } })).id;
    const t = await testTypes(ctx.prisma);
    roomId = t.roomA.id;
    room2Id = t.roomB.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('loan vs archive at the same instant: exactly one wins and the asset is consistent', async () => {
    for (let round = 0; round < 3; round++) {
      const asset = await createAsset(`Balapan Arsip ${round}`);
      const [l, a] = await Promise.all([
        loan(asset.id),
        ctx.http().post(`/api/v1/assets/${asset.id}/archive`).set(bearer(admin)).send({}),
      ]);
      expect([l.status, a.status].filter((s) => s < 300)).toHaveLength(1);
      const row = await ctx.prisma.asset.findUniqueOrThrow({ where: { id: asset.id } });
      const active = await ctx.prisma.assetLoan.count({ where: { assetId: asset.id, status: 'ACTIVE' } });
      if (l.status < 300) {
        expect(row.archivedAt).toBeNull();
        expect(row.status).toBe('BORROWED');
        expect(active).toBe(1);
      } else {
        expect(row.archivedAt).not.toBeNull();
        expect(row.status).toBe('IN_USE');
        expect(active).toBe(0);
      }
    }
  });

  // The test above only sometimes lands a loan inside archive's checks; this pins both windows.
  it.each(['before', 'after'] as const)(
    "a loan racing archive's state read (%s): exactly one wins and the asset is consistent",
    async (when) => {
      const asset = await createAsset(`Balapan Arsip Celah ${when}`);
      const r = await archiveRacing(asset.id, when, () => loan(asset.id));
      expect([r.archive, r.other].filter((s) => s < 300)).toHaveLength(1);
      expect([r.archive, r.other].filter((s) => s >= 300)).toEqual([409]); // a clean refusal, not a 500
      const row = await ctx.prisma.asset.findUniqueOrThrow({ where: { id: asset.id } });
      const active = await ctx.prisma.assetLoan.count({ where: { assetId: asset.id, status: 'ACTIVE' } });
      if (r.other < 300) {
        expect(row.archivedAt).toBeNull();
        expect(row.status).toBe('BORROWED');
        expect(active).toBe(1);
      } else {
        expect(row.archivedAt).not.toBeNull();
        expect(row.status).toBe('IN_USE');
        expect(active).toBe(0);
      }
    },
  );

  // A pending mutation request writes no asset column, so archive's conditional update cannot
  // see it; both flows lock the asset row and re-check under the lock.
  it.each(['before', 'after'] as const)(
    "a mutation request racing archive's state read (%s): exactly one wins",
    async (when) => {
      const asset = await createAsset(`Balapan Mutasi Arsip ${when}`);
      const r = await archiveRacing(asset.id, when, () => requestMutation(asset.id));
      expect([r.archive, r.other].filter((s) => s < 300)).toHaveLength(1);
      expect([r.archive, r.other].filter((s) => s >= 300)).toEqual([409]); // a clean refusal, not a 500
      const row = await ctx.prisma.asset.findUniqueOrThrow({ where: { id: asset.id } });
      const pending = await ctx.prisma.assetMutation.count({ where: { assetId: asset.id, status: 'PENDING' } });
      expect(pending).toBe(row.archivedAt ? 0 : 1);
    },
  );

  it('archive that commits while a mutation request is being checked: the request is refused', async () => {
    const asset = await createAsset('Balapan Mutasi Arsip cek');
    let archiveStatus = 0;
    const spy = vi
      .spyOn(AssetStateGuard.prototype, 'load')
      .mockImplementationOnce(async function (this: AssetStateGuard, ...args) {
        const state = await this.load(...args); // the once-implementation is used up: real load()
        archiveStatus = (await archive(asset.id)).status;
        return state;
      });
    let mutationStatus: number;
    try {
      mutationStatus = (await requestMutation(asset.id)).status;
    } finally {
      spy.mockRestore();
    }
    expect(archiveStatus).toBe(200);
    expect(mutationStatus).toBe(409);
    expect(await ctx.prisma.assetMutation.count({ where: { assetId: asset.id } })).toBe(0);
  });

  it('loan vs manual status change at the same instant: the status is never overwritten', async () => {
    for (let round = 0; round < 3; round++) {
      const asset = await createAsset(`Balapan Status ${round}`);
      const [l, p] = await Promise.all([
        loan(asset.id),
        ctx.http().patch(`/api/v1/assets/${asset.id}`).set(bearer(admin)).send({ status: 'STORED' }),
      ]);
      const row = await ctx.prisma.asset.findUniqueOrThrow({ where: { id: asset.id } });
      const active = await ctx.prisma.assetLoan.count({ where: { assetId: asset.id, status: 'ACTIVE' } });
      if (active === 1) {
        expect(l.status).toBe(201);
        expect(row.status).toBe('BORROWED');
      } else {
        expect(l.status).toBe(409);
        expect(p.status).toBe(200);
        expect(row.status).toBe('STORED');
      }
    }
  });

  it('loan vs maintenance start at the same instant: exactly one status changer wins', async () => {
    for (let round = 0; round < 3; round++) {
      const asset = await createAsset(`Balapan Servis ${round}`);
      const rep = await ctx
        .http()
        .post('/api/v1/maintenance')
        .set(bearer(admin))
        .send({ assetId: asset.id, description: 'Uji balapan' })
        .expect(201);
      const [l, m] = await Promise.all([
        loan(asset.id),
        ctx.http().post(`/api/v1/maintenance/${rep.body.id}/start`).set(bearer(admin)).send({}),
      ]);
      expect([l.status, m.status].filter((s) => s < 300)).toHaveLength(1);
      const row = await ctx.prisma.asset.findUniqueOrThrow({ where: { id: asset.id } });
      const activeLoans = await ctx.prisma.assetLoan.count({ where: { assetId: asset.id, status: 'ACTIVE' } });
      const inRepair = await ctx.prisma.maintenanceRecord.count({ where: { assetId: asset.id, status: 'IN_PROGRESS' } });
      expect(activeLoans + inRepair).toBe(1);
      expect(row.status).toBe(activeLoans === 1 ? 'BORROWED' : 'UNDER_MAINTENANCE');
    }
  });

});
