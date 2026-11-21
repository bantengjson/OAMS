import { AssetStateGuard } from '../src/modules/assets/asset-state.guard.js';
import { createTestApp } from './utils/app.js';
import type { LoginResult, TestContext } from './utils/app.js';

/** Cross-flow races: whichever flow changes the asset first wins; the others get 409 and leave no trace. */
describe('asset state guard (e2e)', () => {
  let ctx: TestContext;
  let admin: LoginResult;
  let categoryId: string;
  let employeeId: string;

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
          ownershipType: 'OFFICE',
          acquisitionMethod: 'PURCHASE',
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

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await ctx.loginAs('ADMIN_INVENTARIS');
    categoryId = (await ctx.prisma.category.findUniqueOrThrow({ where: { code: 'ELEKTRONIK' } })).id;
    employeeId = (await ctx.prisma.employee.create({ data: { fullName: 'Pegawai Balapan' } })).id;
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

  // The test above only sometimes lands a loan inside archive's checks; this pins both windows
  // deterministically by committing a whole loan just before / just after archive reads the state.
  it.each(['before', 'after'] as const)(
    'a loan that commits %s archive reads the asset state wins, and archive refuses',
    async (when) => {
      const asset = await createAsset(`Balapan Arsip Celah ${when}`);
      let loanStatus = 0;
      const spy = vi
        .spyOn(AssetStateGuard.prototype, 'load')
        .mockImplementationOnce(async function (this: AssetStateGuard, ...args) {
          if (when === 'before') loanStatus = (await loan(asset.id)).status;
          // The once-implementation is used up by now, so this reaches the real load().
          const state = await this.load(...args);
          if (when === 'after') loanStatus = (await loan(asset.id)).status;
          return state;
        });
      let archiveStatus: number;
      try {
        archiveStatus = (await ctx.http().post(`/api/v1/assets/${asset.id}/archive`).set(bearer(admin)).send({})).status;
      } finally {
        spy.mockRestore();
      }
      expect(loanStatus).toBe(201);
      expect(archiveStatus).toBe(409);
      const row = await ctx.prisma.asset.findUniqueOrThrow({ where: { id: asset.id } });
      expect(row.archivedAt).toBeNull();
      expect(row.status).toBe('BORROWED');
    },
  );

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
