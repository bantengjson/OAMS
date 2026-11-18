import argon2 from 'argon2';
import { createTestApp } from './utils/app.js';
import type { LoginResult, TestContext } from './utils/app.js';

const URL = '/api/v1/assets';

interface Ids {
  category: string;
  categoryInactive: string;
  office: string;
  building: string;
  floor: string;
  room1: string;
  room2: string;
  roomInactive: string;
  department: string;
  inactiveUserId: string;
}

describe('assets (e2e)', () => {
  let ctx: TestContext;
  let admin: LoginResult;
  let petugas: LoginResult;
  let viewer: LoginResult;
  let ids: Ids;
  let firstId: string;
  let firstCode: string;

  const bearer = (s: LoginResult) => ({ Authorization: `Bearer ${s.accessToken}` });

  const baseAsset = () => ({
    name: 'Laptop Kerja A',
    categoryId: ids.category,
    locationId: ids.room1,
    ownershipType: 'OFFICE',
    acquisitionMethod: 'PURCHASE',
    condition: 'GOOD',
    status: 'AVAILABLE',
    brand: 'Lenovo',
    model: 'ThinkPad T14',
    serialNumber: 'SN-0001',
    purchasePrice: 15000000,
    acquisitionDate: '2026-01-15',
    vendor: 'PT Komputer Jaya',
    departmentId: ids.department,
    responsibleUserId: undefined as string | undefined,
    notes: 'Unit untuk staf TU',
  });

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await ctx.loginAs('ADMIN_INVENTARIS');
    petugas = await ctx.loginAs('PETUGAS_INVENTARIS');
    viewer = await ctx.loginAs('VIEWER');

    const p = ctx.prisma;
    const category = await p.category.findUniqueOrThrow({ where: { code: 'ELEKTRONIK' } });
    const categoryInactive = await p.category.create({
      data: { code: 'AST_NONAKTIF', name: 'Kategori Nonaktif', isActive: false },
    });
    const office = await p.location.create({ data: { code: 'AST_HQ', name: 'Kantor Aset', type: 'OFFICE' } });
    const building = await p.location.create({
      data: { code: 'AST_G1', name: 'Menara Aset', type: 'BUILDING', parentId: office.id },
    });
    const floor = await p.location.create({
      data: { code: 'AST_L1', name: 'Lantai Aset', type: 'FLOOR', parentId: building.id },
    });
    const room1 = await p.location.create({
      data: { code: 'AST_R1', name: 'Ruang Aset 1', type: 'ROOM', parentId: floor.id },
    });
    const room2 = await p.location.create({
      data: { code: 'AST_R2', name: 'Ruang Aset 2', type: 'ROOM', parentId: floor.id },
    });
    const roomInactive = await p.location.create({
      data: { code: 'AST_RX', name: 'Ruang Nonaktif', type: 'ROOM', parentId: floor.id, isActive: false },
    });
    const department = await p.department.create({ data: { code: 'AST_TU', name: 'TU Aset' } });
    const inactiveUser = await p.user.create({
      data: {
        email: 'nonaktif-pj@test.local',
        fullName: 'PJ Nonaktif',
        isActive: false,
        passwordHash: await argon2.hash('Nonaktif123', { type: argon2.argon2id }),
      },
    });
    ids = {
      category: category.id,
      categoryInactive: categoryInactive.id,
      office: office.id,
      building: building.id,
      floor: floor.id,
      room1: room1.id,
      room2: room2.id,
      roomInactive: roomInactive.id,
      department: department.id,
      inactiveUserId: inactiveUser.id,
    };
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('VIEWER and PETUGAS cannot create assets', async () => {
    await ctx.http().post(URL).set(bearer(viewer)).send(baseAsset()).expect(403);
    await ctx.http().post(URL).set(bearer(petugas)).send(baseAsset()).expect(403);
    await ctx.http().post(URL).send(baseAsset()).expect(401);
  });

  it('creates an asset with an automatic code and a QR label', async () => {
    const res = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ ...baseAsset(), responsibleUserId: petugas.userId })
      .expect(201);
    firstId = res.body.id;
    firstCode = res.body.assetCode;
    expect(firstCode).toMatch(/^INV-\d{4}-\d{4,}$/);
    expect(res.body).toMatchObject({
      name: 'Laptop Kerja A',
      brand: 'Lenovo',
      status: 'AVAILABLE',
      condition: 'GOOD',
      ownershipType: 'OFFICE',
      acquisitionMethod: 'PURCHASE',
      acquisitionDate: '2026-01-15',
      purchasePrice: '15000000.00',
      isArchived: false,
      hasPhoto: false,
      category: { code: 'ELEKTRONIK' },
      location: { id: ids.room1, path: 'Kantor Aset / Menara Aset / Lantai Aset / Ruang Aset 1' },
      department: { code: 'AST_TU' },
      responsibleUser: { id: petugas.userId },
      createdBy: { id: admin.userId },
      photos: [],
      documents: [],
    });
    expect(res.body.label.token).toHaveLength(43);
    expect(res.body.label.isActive).toBe(true);
    expect(res.body.label.url).toBe(`http://localhost:3000/a/${res.body.label.token}`);

    const audit = await ctx.prisma.auditLog.findFirst({
      where: { action: 'asset.created', entityId: firstId },
    });
    expect(audit?.module).toBe('assets');
    expect(audit?.actorId).toBe(admin.userId);
  });

  it('gives the next asset the following number', async () => {
    const res = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ ...baseAsset(), name: 'Laptop Kerja B', locationId: ids.room2, status: 'IN_USE' })
      .expect(201);
    const [, year, n1] = firstCode.split('-');
    const [, year2, n2] = (res.body.assetCode as string).split('-');
    expect(year2).toBe(year);
    expect(Number(n2)).toBe(Number(n1) + 1);
  });

  it('refuses inactive or unknown references with a field-specific message', async () => {
    const cat = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ ...baseAsset(), categoryId: ids.categoryInactive })
      .expect(400);
    expect(cat.body.message).toBe('Kategori tidak ditemukan atau nonaktif.');

    const loc = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ ...baseAsset(), locationId: ids.roomInactive })
      .expect(400);
    expect(loc.body.message).toBe('Lokasi tidak ditemukan atau nonaktif.');

    const pj = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ ...baseAsset(), responsibleUserId: ids.inactiveUserId })
      .expect(400);
    expect(pj.body.message).toBe('Penanggung jawab tidak ditemukan atau nonaktif.');

    const dept = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ ...baseAsset(), departmentId: '00000000-0000-0000-0000-000000000000' })
      .expect(400);
    expect(dept.body.message).toBe('Unit kerja tidak ditemukan atau nonaktif.');
  });

  it('validates the body', async () => {
    const res = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ ...baseAsset(), name: '', status: 'FLYING', purchasePrice: -5 })
      .expect(400);
    expect(res.body.message).toBe('Validasi gagal.');
    expect(res.body.errors).toHaveProperty('name');
    expect(res.body.errors).toHaveProperty('status');
    expect(res.body.errors).toHaveProperty('purchasePrice');
  });

  it('lists with search and filters, excluding archived by default', async () => {
    const bySuffix = await ctx
      .http()
      .get(URL)
      .query({ search: firstCode.slice(-4) })
      .set(bearer(viewer))
      .expect(200);
    expect(bySuffix.body.data.some((a: { id: string }) => a.id === firstId)).toBe(true);
    expect(bySuffix.body.meta.total).toBeGreaterThanOrEqual(1);

    const byName = await ctx.http().get(URL).query({ search: 'kerja b' }).set(bearer(viewer)).expect(200);
    expect(byName.body.data.map((a: { name: string }) => a.name)).toEqual(['Laptop Kerja B']);

    const byStatus = await ctx.http().get(URL).query({ status: 'IN_USE' }).set(bearer(viewer)).expect(200);
    expect(byStatus.body.data.every((a: { status: string }) => a.status === 'IN_USE')).toBe(true);
    expect(byStatus.body.data.length).toBeGreaterThanOrEqual(1);

    // locationId includes every descendant room
    const byBuilding = await ctx
      .http()
      .get(URL)
      .query({ locationId: ids.building })
      .set(bearer(viewer))
      .expect(200);
    expect(byBuilding.body.meta.total).toBeGreaterThanOrEqual(2);
    const byRoom2 = await ctx.http().get(URL).query({ locationId: ids.room2 }).set(bearer(viewer)).expect(200);
    expect(byRoom2.body.data.map((a: { name: string }) => a.name)).toEqual(['Laptop Kerja B']);

    const page = await ctx.http().get(URL).query({ pageSize: 1, page: 2 }).set(bearer(viewer)).expect(200);
    expect(page.body.data).toHaveLength(1);
    expect(page.body.meta).toMatchObject({ page: 2, pageSize: 1 });

    const sorted = await ctx
      .http()
      .get(URL)
      .query({ sort: 'name', order: 'asc', categoryId: ids.category })
      .set(bearer(viewer))
      .expect(200);
    const names = sorted.body.data.map((a: { name: string }) => a.name);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });

  it('returns the detail and 404 for an unknown id', async () => {
    const res = await ctx.http().get(`${URL}/${firstId}`).set(bearer(petugas)).expect(200);
    expect(res.body.assetCode).toBe(firstCode);
    expect(res.body.label.token).toHaveLength(43);
    const missing = await ctx
      .http()
      .get(`${URL}/00000000-0000-0000-0000-000000000000`)
      .set(bearer(petugas))
      .expect(404);
    expect(missing.body.message).toBe('Barang tidak ditemukan.');
  });

  it('updates fields and audits before/after; PETUGAS cannot update', async () => {
    await ctx.http().patch(`${URL}/${firstId}`).set(bearer(petugas)).send({ status: 'STORED' }).expect(403);

    const res = await ctx
      .http()
      .patch(`${URL}/${firstId}`)
      .set(bearer(admin))
      .send({ status: 'STORED', locationId: ids.room2, responsibleUserId: null, notes: null })
      .expect(200);
    expect(res.body).toMatchObject({
      status: 'STORED',
      location: { id: ids.room2 },
      responsibleUser: null,
      notes: null,
      assetCode: firstCode,
    });

    const audit = await ctx.prisma.auditLog.findFirst({
      where: { action: 'asset.updated', entityId: firstId },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit?.before).toMatchObject({ status: 'AVAILABLE', locationId: ids.room1 });
    expect(audit?.after).toMatchObject({ status: 'STORED', locationId: ids.room2 });
  });

  it('archives, hides, blocks edits, and unarchives', async () => {
    await ctx.http().post(`${URL}/${firstId}/archive`).set(bearer(viewer)).send({}).expect(403);

    const archived = await ctx
      .http()
      .post(`${URL}/${firstId}/archive`)
      .set(bearer(admin))
      .send({ reason: 'Rusak total, dihapuskan' })
      .expect(200);
    expect(archived.body.isArchived).toBe(true);
    expect(archived.body.archiveReason).toBe('Rusak total, dihapuskan');
    expect(archived.body.archivedBy).toMatchObject({ id: admin.userId });

    const list = await ctx.http().get(URL).query({ pageSize: 100 }).set(bearer(viewer)).expect(200);
    expect(list.body.data.some((a: { id: string }) => a.id === firstId)).toBe(false);
    const withArchived = await ctx
      .http()
      .get(URL)
      .query({ includeArchived: true, pageSize: 100 })
      .set(bearer(viewer))
      .expect(200);
    expect(withArchived.body.data.some((a: { id: string }) => a.id === firstId)).toBe(true);

    const blocked = await ctx
      .http()
      .patch(`${URL}/${firstId}`)
      .set(bearer(admin))
      .send({ name: 'x' })
      .expect(400);
    expect(blocked.body.message).toBe('Barang sudah diarsipkan.');
    await ctx.http().post(`${URL}/${firstId}/archive`).set(bearer(admin)).send({}).expect(400);

    const restored = await ctx.http().post(`${URL}/${firstId}/unarchive`).set(bearer(admin)).expect(200);
    expect(restored.body.isArchived).toBe(false);
    expect(restored.body.archiveReason).toBeNull();
  });

  it('lists the history of an asset, newest first', async () => {
    const res = await ctx.http().get(`${URL}/${firstId}/history`).set(bearer(petugas)).expect(200);
    const actions = res.body.data.map((r: { action: string }) => r.action);
    expect(actions[0]).toBe('asset.unarchived');
    expect(actions).toEqual(
      expect.arrayContaining(['asset.created', 'asset.updated', 'asset.archived', 'asset.unarchived']),
    );
    expect(res.body.meta.total).toBeGreaterThanOrEqual(4);
  });

  it('reports statistics without archived assets', async () => {
    const third = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ ...baseAsset(), name: 'Kursi Arsip', condition: 'UNUSABLE', status: 'DISPOSED' })
      .expect(201);
    await ctx.http().post(`${URL}/${third.body.id}/archive`).set(bearer(admin)).send({}).expect(200);

    const res = await ctx.http().get(`${URL}/statistics`).set(bearer(viewer)).expect(200);
    expect(res.body.archived).toBeGreaterThanOrEqual(1);
    expect(res.body.active).toBe(res.body.total);
    expect(res.body.byStatus.STORED).toBeGreaterThanOrEqual(1);
    expect(res.body.byStatus.IN_USE).toBeGreaterThanOrEqual(1);
    expect(res.body.byCondition.UNUSABLE ?? 0).toBe(0);
    expect(res.body.byCategory).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: ids.category })]),
    );
    expect(res.body.byOffice).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: ids.office, name: 'Kantor Aset' })]),
    );
  });

  it('exposes a user lookup for choosing a responsible person', async () => {
    const res = await ctx
      .http()
      .get('/api/v1/users/lookup')
      .query({ search: 'petugas' })
      .set(bearer(admin))
      .expect(200);
    expect(res.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: petugas.userId, fullName: expect.any(String) })]),
    );
    expect(res.body[0]).not.toHaveProperty('passwordHash');

    const inactive = await ctx
      .http()
      .get('/api/v1/users/lookup')
      .query({ search: 'nonaktif-pj' })
      .set(bearer(admin))
      .expect(200);
    expect(inactive.body).toEqual([]);

    await ctx.http().get('/api/v1/users/lookup').set(bearer(viewer)).expect(200);
  });
});
