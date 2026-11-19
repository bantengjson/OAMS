import { createTestApp } from './utils/app.js';
import type { LoginResult, TestContext } from './utils/app.js';

const URL = '/api/v1/mutations';

describe('mutations (e2e)', () => {
  let ctx: TestContext;
  let admin: LoginResult;
  let petugas: LoginResult;
  let petugas2: LoginResult;
  let viewer: LoginResult;
  let categoryId: string;
  let room1: string;
  let room2: string;
  let roomInactive: string;
  let emp1: string;
  let emp2: string;
  let empInactive: string;

  const bearer = (s: LoginResult) => ({ Authorization: `Bearer ${s.accessToken}` });

  const createAsset = async (name: string, extra: object = {}) =>
    (
      await ctx
        .http()
        .post('/api/v1/assets')
        .set(bearer(admin))
        .send({
          name,
          categoryId,
          locationId: room1,
          ownershipType: 'OFFICE',
          acquisitionMethod: 'PURCHASE',
          condition: 'GOOD',
          status: 'IN_USE',
          responsibleEmployeeId: emp1,
          ...extra,
        })
        .expect(201)
    ).body as { id: string; assetCode: string };

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await ctx.loginAs('ADMIN_INVENTARIS');
    petugas = await ctx.loginAs('PETUGAS_INVENTARIS');
    viewer = await ctx.loginAs('VIEWER');
    const p = ctx.prisma;
    // A second Petugas account, to test "cancel only your own request".
    const role = await p.role.findUniqueOrThrow({ where: { code: 'PETUGAS_INVENTARIS' } });
    const argon2 = (await import('argon2')).default;
    const other = await p.user.upsert({
      where: { email: 'petugas2@test.local' },
      update: { isActive: true },
      create: {
        email: 'petugas2@test.local',
        fullName: 'Petugas Dua',
        passwordHash: await argon2.hash('Petugas2Pass!', { type: argon2.argon2id }),
      },
    });
    await p.userRole.upsert({
      where: { userId_roleId: { userId: other.id, roleId: role.id } },
      update: {},
      create: { userId: other.id, roleId: role.id },
    });
    petugas2 = await ctx.login('petugas2@test.local', 'Petugas2Pass!');

    categoryId = (await p.category.findUniqueOrThrow({ where: { code: 'ELEKTRONIK' } })).id;
    const office = await p.location.create({ data: { code: 'MUT_HQ', name: 'Kantor Mutasi', type: 'OFFICE' } });
    const building = await p.location.create({
      data: { code: 'MUT_B', name: 'Gedung Mutasi', type: 'BUILDING', parentId: office.id },
    });
    const floor = await p.location.create({
      data: { code: 'MUT_F', name: 'Lantai Mutasi', type: 'FLOOR', parentId: building.id },
    });
    room1 = (await p.location.create({ data: { code: 'MUT_R1', name: 'Ruang 101', type: 'ROOM', parentId: floor.id } })).id;
    room2 = (await p.location.create({ data: { code: 'MUT_R2', name: 'Ruang 102', type: 'ROOM', parentId: floor.id } })).id;
    roomInactive = (
      await p.location.create({ data: { code: 'MUT_RX', name: 'Ruang Tutup', type: 'ROOM', parentId: floor.id, isActive: false } })
    ).id;
    emp1 = (await p.employee.create({ data: { fullName: 'Pemegang Mutasi' } })).id;
    emp2 = (await p.employee.create({ data: { fullName: 'Penerima Mutasi' } })).id;
    empInactive = (await p.employee.create({ data: { fullName: 'Nonaktif Mutasi', isActive: false } })).id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('PETUGAS requests; the asset is unchanged until ADMIN approves', async () => {
    const asset = await createAsset('Proyektor Mutasi');
    const res = await ctx
      .http()
      .post(URL)
      .set(bearer(petugas))
      .send({
        assetId: asset.id,
        toLocationId: room2,
        changesResponsible: true,
        toResponsibleEmployeeId: emp2,
        reason: 'Pindah ke ruang rapat lantai 1',
      })
      .expect(201);
    expect(res.body).toMatchObject({
      status: 'PENDING',
      asset: { id: asset.id, assetCode: asset.assetCode, name: 'Proyektor Mutasi' },
      fromLocation: { id: room1, name: 'Ruang 101' },
      toLocation: { id: room2, name: 'Ruang 102' },
      changesResponsible: true,
      fromResponsibleEmployee: { id: emp1, fullName: 'Pemegang Mutasi' },
      toResponsibleEmployee: { id: emp2, fullName: 'Penerima Mutasi' },
      reason: 'Pindah ke ruang rapat lantai 1',
      requestedBy: { id: petugas.userId },
      decidedBy: null,
      decidedAt: null,
    });
    expect(res.body.fromLocation.path).toContain('Ruang 101');

    const before = await ctx.http().get(`/api/v1/assets/${asset.id}`).set(bearer(viewer)).expect(200);
    expect(before.body.location.id).toBe(room1);
    expect(before.body.responsibleEmployee.id).toBe(emp1);
    expect(before.body.pendingMutation).toMatchObject({ id: res.body.id, toLocation: { id: room2 } });

    // Second request while one is pending.
    const dup = await ctx
      .http()
      .post(URL)
      .set(bearer(petugas))
      .send({ assetId: asset.id, toLocationId: room2, reason: 'Lagi' })
      .expect(409);
    expect(dup.body.message).toBe('Sudah ada mutasi yang menunggu persetujuan.');

    // Archiving is blocked while a mutation waits.
    const archive = await ctx.http().post(`/api/v1/assets/${asset.id}/archive`).set(bearer(admin)).send({}).expect(409);
    expect(archive.body.message).toBe('Selesaikan mutasi yang menunggu dulu sebelum mengarsipkan.');

    // Petugas cannot approve; Admin can.
    await ctx.http().post(`${URL}/${res.body.id}/approve`).set(bearer(petugas)).send({}).expect(403);
    const approved = await ctx.http().post(`${URL}/${res.body.id}/approve`).set(bearer(admin)).send({}).expect(200);
    expect(approved.body).toMatchObject({ status: 'APPROVED', decidedBy: { id: admin.userId } });
    expect(approved.body.decidedAt).toBeTruthy();

    const after = await ctx.http().get(`/api/v1/assets/${asset.id}`).set(bearer(viewer)).expect(200);
    expect(after.body.location.id).toBe(room2);
    expect(after.body.responsibleEmployee.id).toBe(emp2);
    expect(after.body.pendingMutation).toBeNull();

    const assignments = await ctx.http().get(`/api/v1/assets/${asset.id}/assignments`).set(bearer(viewer)).expect(200);
    expect(assignments.body.data[0]).toMatchObject({
      source: 'MUTATION',
      mutationId: res.body.id,
      fromEmployee: { id: emp1 },
      toEmployee: { id: emp2 },
      note: 'Pindah ke ruang rapat lantai 1',
      changedBy: { id: admin.userId },
    });

    await ctx.http().post(`${URL}/${res.body.id}/approve`).set(bearer(admin)).send({}).expect(409);

    const history = await ctx.http().get(`/api/v1/assets/${asset.id}/history`).set(bearer(viewer)).expect(200);
    const actions = history.body.data.map((h: { action: string }) => h.action);
    expect(actions).toEqual(expect.arrayContaining(['mutation.requested', 'mutation.approved', 'asset.assigned']));
  });

  it("ADMIN's own request is executed immediately", async () => {
    const asset = await createAsset('Printer Mutasi');
    const res = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ assetId: asset.id, toLocationId: room2, reason: 'Langsung pindah' })
      .expect(201);
    expect(res.body.status).toBe('APPROVED');
    expect(res.body.decidedBy.id).toBe(res.body.requestedBy.id);
    expect(res.body.changesResponsible).toBe(false);
    expect(res.body.toResponsibleEmployee).toBeNull();
    const after = await ctx.http().get(`/api/v1/assets/${asset.id}`).set(bearer(viewer)).expect(200);
    expect(after.body.location.id).toBe(room2);
    expect(after.body.responsibleEmployee.id).toBe(emp1);
  });

  it('releasing the responsible person is a change; no change at all is refused', async () => {
    const asset = await createAsset('Scanner Mutasi');
    const none = await ctx
      .http()
      .post(URL)
      .set(bearer(petugas))
      .send({ assetId: asset.id, reason: 'Tanpa perubahan' })
      .expect(409);
    expect(none.body.message).toBe('Tidak ada perubahan yang diajukan.');
    const same = await ctx
      .http()
      .post(URL)
      .set(bearer(petugas))
      .send({ assetId: asset.id, toLocationId: room1, changesResponsible: true, toResponsibleEmployeeId: emp1, reason: 'Sama' })
      .expect(409);
    expect(same.body.message).toBe('Tidak ada perubahan yang diajukan.');

    const release = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ assetId: asset.id, changesResponsible: true, toResponsibleEmployeeId: null, reason: 'Lepas PJ' })
      .expect(201);
    expect(release.body.status).toBe('APPROVED');
    const after = await ctx.http().get(`/api/v1/assets/${asset.id}`).set(bearer(viewer)).expect(200);
    expect(after.body.responsibleEmployee).toBeNull();
    expect(after.body.location.id).toBe(room1);
  });

  it('validates references: inactive location, inactive employee, missing reason', async () => {
    const asset = await createAsset('Kamera Mutasi');
    const loc = await ctx
      .http()
      .post(URL)
      .set(bearer(petugas))
      .send({ assetId: asset.id, toLocationId: roomInactive, reason: 'x' })
      .expect(409);
    expect(loc.body.message).toBe('Lokasi tujuan tidak aktif.');
    const emp = await ctx
      .http()
      .post(URL)
      .set(bearer(petugas))
      .send({ assetId: asset.id, changesResponsible: true, toResponsibleEmployeeId: empInactive, reason: 'x' })
      .expect(409);
    expect(emp.body.message).toBe('Pegawai tidak aktif.');
    const noReason = await ctx.http().post(URL).set(bearer(petugas)).send({ assetId: asset.id, toLocationId: room2 }).expect(400);
    expect(noReason.body.errors).toHaveProperty('reason');
    await ctx.http().post(URL).set(bearer(viewer)).send({ assetId: asset.id, toLocationId: room2, reason: 'x' }).expect(403);
  });

  it('reject needs a note and leaves the asset alone; cancel is for the requester', async () => {
    const asset = await createAsset('Laptop Mutasi');
    const req = await ctx
      .http()
      .post(URL)
      .set(bearer(petugas))
      .send({ assetId: asset.id, toLocationId: room2, reason: 'Coba' })
      .expect(201);

    const noNote = await ctx.http().post(`${URL}/${req.body.id}/reject`).set(bearer(admin)).send({}).expect(400);
    expect(noNote.body.errors.note).toContain('Alasan penolakan wajib diisi');

    await ctx.http().post(`${URL}/${req.body.id}/cancel`).set(bearer(petugas2)).expect(403);

    const rejected = await ctx
      .http()
      .post(`${URL}/${req.body.id}/reject`)
      .set(bearer(admin))
      .send({ note: 'Ruang 102 penuh' })
      .expect(200);
    expect(rejected.body).toMatchObject({ status: 'REJECTED', decisionNote: 'Ruang 102 penuh', decidedBy: { id: admin.userId } });
    const after = await ctx.http().get(`/api/v1/assets/${asset.id}`).set(bearer(viewer)).expect(200);
    expect(after.body.location.id).toBe(room1);

    const req2 = await ctx
      .http()
      .post(URL)
      .set(bearer(petugas))
      .send({ assetId: asset.id, toLocationId: room2, reason: 'Coba lagi' })
      .expect(201);
    const cancelled = await ctx.http().post(`${URL}/${req2.body.id}/cancel`).set(bearer(petugas)).expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');
    expect(cancelled.body.cancelledAt).toBeTruthy();
    const again = await ctx.http().post(`${URL}/${req2.body.id}/cancel`).set(bearer(petugas)).expect(409);
    expect(again.body.message).toBe('Mutasi sudah diproses.');
  });

  it('only one of five concurrent requests for the same asset succeeds', async () => {
    const asset = await createAsset('Meja Balapan');
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        ctx.http().post(URL).set(bearer(petugas)).send({ assetId: asset.id, toLocationId: room2, reason: `Balapan ${i}` }),
      ),
    );
    const statuses = results.map((r) => r.status).sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409, 409, 409, 409]);
    expect(results.filter((r) => r.status === 409).every((r) => r.body.message === 'Sudah ada mutasi yang menunggu persetujuan.')).toBe(true);
    expect(await ctx.prisma.assetMutation.count({ where: { assetId: asset.id } })).toBe(1);
  });

  it('refuses to approve once the asset was archived in the meantime', async () => {
    const asset = await createAsset('Kursi Arsip Mutasi');
    const req = await ctx
      .http()
      .post(URL)
      .set(bearer(petugas))
      .send({ assetId: asset.id, toLocationId: room2, reason: 'Pindah' })
      .expect(201);
    await ctx.prisma.asset.update({ where: { id: asset.id }, data: { archivedAt: new Date() } });
    const res = await ctx.http().post(`${URL}/${req.body.id}/approve`).set(bearer(admin)).send({}).expect(409);
    expect(res.body.message).toBe('Barang sudah diarsipkan.');
    const row = await ctx.prisma.asset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(row.locationId).toBe(room1);
    expect((await ctx.prisma.assetMutation.findUniqueOrThrow({ where: { id: req.body.id } })).status).toBe('PENDING');
    // Requests on archived assets are refused too.
    await ctx.prisma.assetMutation.update({ where: { id: req.body.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
    const blocked = await ctx.http().post(URL).set(bearer(petugas)).send({ assetId: asset.id, toLocationId: room2, reason: 'x' }).expect(409);
    expect(blocked.body.message).toBe('Barang sudah diarsipkan.');
  });

  it('lists with filters for every role that may view', async () => {
    const all = await ctx.http().get(URL).set(bearer(viewer)).expect(200);
    expect(all.body.meta.total).toBeGreaterThanOrEqual(6);
    const pending = await ctx.http().get(`${URL}?status=PENDING`).set(bearer(petugas)).expect(200);
    expect(pending.body.data.every((m: { status: string }) => m.status === 'PENDING')).toBe(true);
    const search = await ctx.http().get(`${URL}?search=Proyektor%20Mutasi`).set(bearer(admin)).expect(200);
    expect(search.body.data.length).toBeGreaterThanOrEqual(1);
    expect(search.body.data.every((m: { asset: { name: string } }) => m.asset.name === 'Proyektor Mutasi')).toBe(true);
    const mine = await ctx.http().get(`${URL}?requestedById=${admin.userId}`).set(bearer(admin)).expect(200);
    expect(mine.body.data.every((m: { requestedBy: { id: string } }) => m.requestedBy.id === admin.userId)).toBe(true);
    const detail = await ctx.http().get(`${URL}/${all.body.data[0].id}`).set(bearer(viewer)).expect(200);
    expect(detail.body.id).toBe(all.body.data[0].id);
    await ctx.http().get(`${URL}/00000000-0000-0000-0000-000000000000`).set(bearer(viewer)).expect(404);
  });
});
