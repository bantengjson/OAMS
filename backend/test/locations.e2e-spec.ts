import { createTestApp } from './utils/app.js';
import type { LoginResult, TestContext } from './utils/app.js';

const URL = '/api/v1/locations';

interface TreeNode {
  id: string;
  name: string;
  isActive: boolean;
  children: TreeNode[];
}

describe('locations (e2e)', () => {
  let ctx: TestContext;
  let admin: LoginResult;
  let petugas: LoginResult;
  let officeId: string;
  let buildingId: string;
  let floorId: string;
  let roomId: string;

  const bearer = (s: LoginResult) => ({ Authorization: `Bearer ${s.accessToken}` });

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await ctx.loginAs('ADMIN_INVENTARIS');
    petugas = await ctx.loginAs('PETUGAS_INVENTARIS');
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('creates the Kantor → Gedung → Lantai → Ruangan chain with a readable path', async () => {
    const office = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ code: 'hq', name: 'Kantor Pusat', type: 'OFFICE' })
      .expect(201);
    officeId = office.body.id;
    expect(office.body).toMatchObject({
      code: 'HQ',
      type: 'OFFICE',
      parent: null,
      path: 'Kantor Pusat',
      isActive: true,
    });

    const building = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ code: 'GA', name: 'Gedung A', type: 'BUILDING', parentId: officeId })
      .expect(201);
    buildingId = building.body.id;
    expect(building.body.parent).toMatchObject({ id: officeId, code: 'HQ', type: 'OFFICE' });

    const floor = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ code: 'GA_L2', name: 'Lantai 2', type: 'FLOOR', parentId: buildingId })
      .expect(201);
    floorId = floor.body.id;

    const room = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({
        code: 'GA_L2_201',
        name: 'Ruang 201',
        type: 'ROOM',
        parentId: floorId,
        description: 'Ruang rapat kecil',
      })
      .expect(201);
    roomId = room.body.id;
    expect(room.body.path).toBe('Kantor Pusat / Gedung A / Lantai 2 / Ruang 201');

    const audit = await ctx.prisma.auditLog.findFirst({
      where: { action: 'location.created', entityId: roomId },
    });
    expect(audit?.module).toBe('locations');
  });

  it('rejects invalid hierarchy placements', async () => {
    const roomUnderBuilding = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ code: 'R_X', name: 'Ruang X', type: 'ROOM', parentId: buildingId })
      .expect(400);
    expect(roomUnderBuilding.body.message).toBe(
      'Lokasi induk untuk Ruangan harus berupa Lantai.',
    );

    const officeWithParent = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ code: 'HQ2', name: 'Kantor Dua', type: 'OFFICE', parentId: officeId })
      .expect(400);
    expect(officeWithParent.body.message).toBe('Kantor tidak memiliki lokasi induk.');

    const orphanBuilding = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ code: 'GB', name: 'Gedung B', type: 'BUILDING' })
      .expect(400);
    expect(orphanBuilding.body.message).toBe('Lokasi induk untuk Gedung harus berupa Kantor.');

    const unknownParent = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({
        code: 'GC',
        name: 'Gedung C',
        type: 'BUILDING',
        parentId: '00000000-0000-0000-0000-000000000000',
      })
      .expect(400);
    expect(unknownParent.body.message).toBe('Lokasi induk tidak ditemukan.');

    const badType = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ code: 'GAR', name: 'Garasi', type: 'GARAGE' })
      .expect(400);
    expect(badType.body.message).toBe('Validasi gagal.');
    expect(badType.body.errors).toHaveProperty('type');

    const duplicate = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ code: 'HQ', name: 'Kantor Lain', type: 'OFFICE' })
      .expect(409);
    expect(duplicate.body.errors).toHaveProperty('code');
  });

  it('lists with type, parent and search filters', async () => {
    const rooms = await ctx.http().get(URL).query({ type: 'ROOM' }).set(bearer(petugas)).expect(200);
    expect(rooms.body.data.every((l: { type: string }) => l.type === 'ROOM')).toBe(true);
    expect(rooms.body.data.some((l: { id: string }) => l.id === roomId)).toBe(true);

    const children = await ctx
      .http()
      .get(URL)
      .query({ parentId: floorId })
      .set(bearer(petugas))
      .expect(200);
    expect(children.body.data.map((l: { id: string }) => l.id)).toEqual([roomId]);

    const search = await ctx
      .http()
      .get(URL)
      .query({ search: 'gedung a' })
      .set(bearer(petugas))
      .expect(200);
    expect(search.body.data.map((l: { id: string }) => l.id)).toEqual([buildingId]);

    const got = await ctx.http().get(`${URL}/${roomId}`).set(bearer(petugas)).expect(200);
    expect(got.body.parent).toMatchObject({ id: floorId, type: 'FLOOR' });
  });

  it('returns the nested tree and hides inactive nodes unless asked', async () => {
    const tree = await ctx.http().get(`${URL}/tree`).set(bearer(petugas)).expect(200);
    const hq = (tree.body as TreeNode[]).find((n) => n.id === officeId)!;
    expect(hq.children.map((n) => n.id)).toEqual([buildingId]);
    expect(hq.children[0].children.map((n) => n.id)).toEqual([floorId]);
    expect(hq.children[0].children[0].children.map((n) => n.id)).toEqual([roomId]);
  });

  it('PETUGAS may read but not write', async () => {
    await ctx
      .http()
      .post(URL)
      .set(bearer(petugas))
      .send({ code: 'HQ3', name: 'Kantor Tiga', type: 'OFFICE' })
      .expect(403);
    await ctx.http().patch(`${URL}/${roomId}`).set(bearer(petugas)).send({ name: 'X' }).expect(403);
    await ctx.http().get(URL).expect(401);
  });

  it('updates name/description/code and re-validates a parent change', async () => {
    const renamed = await ctx
      .http()
      .patch(`${URL}/${roomId}`)
      .set(bearer(admin))
      .send({ name: 'Ruang 201 A', description: null })
      .expect(200);
    expect(renamed.body).toMatchObject({ name: 'Ruang 201 A', description: null });
    expect(renamed.body.path).toBe('Kantor Pusat / Gedung A / Lantai 2 / Ruang 201 A');

    const wrongParent = await ctx
      .http()
      .patch(`${URL}/${roomId}`)
      .set(bearer(admin))
      .send({ parentId: buildingId })
      .expect(400);
    expect(wrongParent.body.message).toBe('Lokasi induk untuk Ruangan harus berupa Lantai.');

    const floor3 = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({ code: 'GA_L3', name: 'Lantai 3', type: 'FLOOR', parentId: buildingId })
      .expect(201);
    const moved = await ctx
      .http()
      .patch(`${URL}/${roomId}`)
      .set(bearer(admin))
      .send({ parentId: floor3.body.id })
      .expect(200);
    expect(moved.body.parent.id).toBe(floor3.body.id);
    expect(moved.body.path).toBe('Kantor Pusat / Gedung A / Lantai 3 / Ruang 201 A');

    const typeChange = await ctx
      .http()
      .patch(`${URL}/${roomId}`)
      .set(bearer(admin))
      .send({ type: 'FLOOR' })
      .expect(400);
    expect(typeChange.body.message).toBe('Validasi gagal.');

    // move back for the remaining tests
    await ctx.http().patch(`${URL}/${roomId}`).set(bearer(admin)).send({ parentId: floorId }).expect(200);
  });

  it('deactivation respects the hierarchy', async () => {
    const blocked = await ctx
      .http()
      .post(`${URL}/${floorId}/deactivate`)
      .set(bearer(admin))
      .expect(400);
    expect(blocked.body.message).toBe('Nonaktifkan lokasi anak terlebih dahulu.');

    const roomOff = await ctx.http().post(`${URL}/${roomId}/deactivate`).set(bearer(admin)).expect(200);
    expect(roomOff.body.isActive).toBe(false);
    await ctx.http().post(`${URL}/${floorId}/deactivate`).set(bearer(admin)).expect(200);

    const activeTree = await ctx.http().get(`${URL}/tree`).set(bearer(admin)).expect(200);
    const building = (activeTree.body as TreeNode[])
      .find((n) => n.id === officeId)!
      .children.find((n) => n.id === buildingId)!;
    expect(building.children.some((n) => n.id === floorId)).toBe(false);

    const fullTree = await ctx
      .http()
      .get(`${URL}/tree`)
      .query({ includeInactive: true })
      .set(bearer(admin))
      .expect(200);
    const buildingAll = (fullTree.body as TreeNode[])
      .find((n) => n.id === officeId)!
      .children.find((n) => n.id === buildingId)!;
    const floorNode = buildingAll.children.find((n) => n.id === floorId)!;
    expect(floorNode.isActive).toBe(false);
    expect(floorNode.children.map((n) => n.id)).toEqual([roomId]);

    const parentInactive = await ctx
      .http()
      .post(`${URL}/${roomId}/activate`)
      .set(bearer(admin))
      .expect(400);
    expect(parentInactive.body.message).toBe('Aktifkan lokasi induk terlebih dahulu.');

    await ctx.http().post(`${URL}/${floorId}/activate`).set(bearer(admin)).expect(200);
    const roomOn = await ctx.http().post(`${URL}/${roomId}/activate`).set(bearer(admin)).expect(200);
    expect(roomOn.body.isActive).toBe(true);

    const actions = await ctx.prisma.auditLog.findMany({
      where: { entityId: roomId, module: 'locations' },
      select: { action: true },
    });
    expect(actions.map((a) => a.action)).toEqual(
      expect.arrayContaining([
        'location.created',
        'location.updated',
        'location.deactivated',
        'location.activated',
      ]),
    );
  });
});
