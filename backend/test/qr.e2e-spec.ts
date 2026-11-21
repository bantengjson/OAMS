import sharp from 'sharp';
import { createTestApp } from './utils/app.js';
import type { LoginResult, TestContext } from './utils/app.js';

const PUBLIC_MESSAGE = 'QR Code tidak dikenal atau sudah tidak aktif.';

describe('qr (e2e)', () => {
  let ctx: TestContext;
  let admin: LoginResult;
  let viewer: LoginResult;
  let assetId: string;
  let assetCode: string;
  let archivedId: string;
  let noPhotoId: string;
  let token: string;

  const bearer = (s: LoginResult) => ({ Authorization: `Bearer ${s.accessToken}` });
  const qrUrl = () => `/api/v1/assets/${assetId}/qr`;
  const publicUrl = (t: string) => `/api/v1/qr/public/${t}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await ctx.loginAs('ADMIN_INVENTARIS');
    viewer = await ctx.loginAs('VIEWER');
    const p = ctx.prisma;
    const category = await p.category.findUniqueOrThrow({ where: { code: 'KOMPUTER_IT' } });
    const office = await p.location.create({ data: { code: 'QR_HQ', name: 'Kantor QR', type: 'OFFICE' } });
    const building = await p.location.create({ data: { code: 'QR_B', name: 'Blok QR', type: 'BUILDING', parentId: office.id } });
    const floor = await p.location.create({ data: { code: 'QR_F', name: 'Lantai QR', type: 'FLOOR', parentId: building.id } });
    const room = await p.location.create({ data: { code: 'QR_R', name: 'Ruang QR', type: 'ROOM', parentId: floor.id } });
    const base = {
      name: 'Proyektor Rapat',
      categoryId: category.id,
      locationId: room.id,
      ownershipType: 'OFFICE',
      acquisitionMethod: 'PURCHASE',
      condition: 'GOOD',
      status: 'IN_USE',
      brand: 'Epson',
      model: 'EB-X51',
      serialNumber: 'SN-QR-RAHASIA',
      purchasePrice: 7500000,
      vendor: 'CV Vendor Rahasia',
      notes: 'catatan internal rahasia',
    };
    const created = await ctx.http().post('/api/v1/assets').set(bearer(admin)).send(base).expect(201);
    assetId = created.body.id;
    assetCode = created.body.assetCode;
    token = created.body.label.token;
    const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#16a34a' } }).png().toBuffer();
    await ctx.http().post(`/api/v1/assets/${assetId}/photos`).set(bearer(admin)).attach('file', png, 'p.png').expect(201);

    archivedId = (await ctx.http().post('/api/v1/assets').set(bearer(admin)).send({ ...base, name: 'Arsip QR' }).expect(201)).body.id;
    await ctx.http().post(`/api/v1/assets/${archivedId}/archive`).set(bearer(admin)).send({}).expect(200);
    noPhotoId = (await ctx.http().post('/api/v1/assets').set(bearer(admin)).send({ ...base, name: 'Tanpa Foto' }).expect(201)).body.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('exposes QR info for an asset', async () => {
    const res = await ctx.http().get(qrUrl()).set(bearer(viewer)).expect(200);
    expect(res.body).toMatchObject({ token, isActive: true, printedCount: 0, lastPrintedAt: null });
    expect(res.body.url).toBe(`http://localhost:3000/a/${token}`);
  });

  it('anonymous visitors get only the public fields', async () => {
    const res = await ctx.http().get(publicUrl(token)).expect(200);
    expect(Object.keys(res.body).sort()).toEqual(
      ['assetCode', 'brand', 'category', 'condition', 'hasPhoto', 'location', 'model', 'name', 'status'].sort(),
    );
    expect(res.body).toMatchObject({
      assetCode,
      name: 'Proyektor Rapat',
      category: { name: 'Komputer dan IT' },
      location: { name: 'Ruang QR', path: 'Kantor QR / Blok QR / Lantai QR / Ruang QR' },
      hasPhoto: true,
    });
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/RAHASIA|7500000|Rahasia|catatan|responsible|serial|purchase|vendor|notes|documents/i);
  });

  it('staff with assets.view get the full detail through the same URL', async () => {
    const res = await ctx.http().get(publicUrl(token)).set(bearer(viewer)).expect(200);
    expect(res.body).toMatchObject({ id: assetId, assetCode, serialNumber: 'SN-QR-RAHASIA', purchasePrice: '7500000.00', isPublicView: false });
    expect(res.body.photos).toHaveLength(1);
    expect(res.body.label.token).toBe(token);
  });

  it('serves the primary photo publicly, and 404 when there is none', async () => {
    const full = await ctx.http().get(`${publicUrl(token)}/photo`).expect(200);
    expect(full.headers['content-type']).toContain('image/webp');
    await ctx.http().get(`${publicUrl(token)}/photo`).query({ variant: 'thumb' }).expect(200);

    const noPhoto = await ctx.http().get(`/api/v1/assets/${noPhotoId}/qr`).set(bearer(viewer)).expect(200);
    await ctx.http().get(`${publicUrl(noPhoto.body.token)}/photo`).expect(404);
  });

  it('unknown, malformed and archived tokens all give the same 404', async () => {
    const unknown = await ctx.http().get(publicUrl('A'.repeat(43))).expect(404);
    expect(unknown.body.message).toBe(PUBLIC_MESSAGE);
    await ctx.http().get(publicUrl('pendek')).expect(404);
    const archived = await ctx.http().get(`/api/v1/assets/${archivedId}/qr`).set(bearer(viewer)).expect(200);
    const res = await ctx.http().get(publicUrl(archived.body.token)).expect(404);
    expect(res.body.message).toBe(PUBLIC_MESSAGE);
  });

  it('deactivating a label hides the public page until reactivated', async () => {
    await ctx.http().post(`${qrUrl()}/deactivate`).set(bearer(viewer)).expect(403);
    const off = await ctx.http().post(`${qrUrl()}/deactivate`).set(bearer(admin)).expect(200);
    expect(off.body.isActive).toBe(false);
    const hidden = await ctx.http().get(publicUrl(token)).expect(404);
    expect(hidden.body.message).toBe(PUBLIC_MESSAGE);
    await ctx.http().get(`${publicUrl(token)}/photo`).expect(404);

    const on = await ctx.http().post(`${qrUrl()}/activate`).set(bearer(admin)).expect(200);
    expect(on.body.isActive).toBe(true);
    await ctx.http().get(publicUrl(token)).expect(200);

    const actions = await ctx.prisma.auditLog.findMany({ where: { module: 'qr', entityId: assetId }, select: { action: true } });
    expect(actions.map((a) => a.action)).toEqual(expect.arrayContaining(['qr.generated', 'qr.deactivated', 'qr.activated']));
  });

  it('regenerating replaces the token and kills the old one immediately', async () => {
    await ctx.http().post(`${qrUrl()}/regenerate`).set(bearer(viewer)).expect(403);
    const res = await ctx.http().post(`${qrUrl()}/regenerate`).set(bearer(admin)).expect(200);
    const fresh = res.body.token as string;
    expect(fresh).toHaveLength(43);
    expect(fresh).not.toBe(token);
    expect(res.body).toMatchObject({ isActive: true, printedCount: 0 });

    await ctx.http().get(publicUrl(token)).expect(404);
    await ctx.http().get(publicUrl(fresh)).expect(200);
    token = fresh;

    const audit = await ctx.prisma.auditLog.findFirst({ where: { action: 'qr.regenerated', entityId: assetId } });
    expect(audit?.actorId).toBe(admin.userId);
    expect(JSON.stringify(audit?.after ?? {})).not.toContain(fresh);
  });

  it('downloads PNG and SVG and validates the options', async () => {
    const png = await ctx.http().get(`${qrUrl()}/download`).query({ format: 'png', size: 400 }).set(bearer(viewer)).expect(200);
    expect(png.headers['content-type']).toContain('image/png');
    expect(png.headers['content-disposition']).toContain(`${assetCode}.png`);
    expect(png.body.length).toBeGreaterThan(200);

    const svg = await ctx.http().get(`${qrUrl()}/download`).query({ format: 'svg' }).set(bearer(viewer)).expect(200);
    expect(svg.headers['content-type']).toContain('image/svg+xml');
    const svgText: string = svg.text ?? Buffer.from(svg.body as Buffer).toString('utf8');
    expect(svgText).toContain('<svg');

    await ctx.http().get(`${qrUrl()}/download`).query({ format: 'gif' }).set(bearer(viewer)).expect(400);
    await ctx.http().get(`${qrUrl()}/download`).query({ format: 'png', size: 100 }).set(bearer(viewer)).expect(400);
  });

  it('bulk-generate returns print data and skips archived or unknown ids', async () => {
    await ctx.http().post('/api/v1/qr/bulk-generate').set(bearer(viewer)).send({ assetIds: [assetId] }).expect(403);
    const res = await ctx
      .http()
      .post('/api/v1/qr/bulk-generate')
      .set(bearer(admin))
      .send({ assetIds: [assetId, archivedId, '00000000-0000-0000-0000-000000000000'] })
      .expect(200);
    expect(res.body.items).toEqual([
      expect.objectContaining({ assetId, assetCode, name: 'Proyektor Rapat', token, url: `http://localhost:3000/a/${token}` }),
    ]);
    expect(res.body.skipped).toHaveLength(2);
    expect(res.body.skipped.map((s: { assetId: string }) => s.assetId)).toEqual(
      expect.arrayContaining([archivedId, '00000000-0000-0000-0000-000000000000']),
    );
    await ctx.http().post('/api/v1/qr/bulk-generate').set(bearer(admin)).send({ assetIds: [] }).expect(400);
  });

  it('bulk-generate can leave a deactivated label alone instead of reactivating it', async () => {
    await ctx.http().post(`${qrUrl()}/deactivate`).set(bearer(admin)).expect(200);
    const res = await ctx
      .http()
      .post('/api/v1/qr/bulk-generate')
      .set(bearer(admin))
      .send({ assetIds: [assetId], activateInactive: false })
      .expect(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.skipped).toEqual([expect.objectContaining({ assetId, inactiveLabel: true })]);
    const info = await ctx.http().get(qrUrl()).set(bearer(admin)).expect(200);
    expect(info.body.isActive).toBe(false);
    // Without the flag the old behaviour stands: printing reactivates the label.
    const again = await ctx.http().post('/api/v1/qr/bulk-generate').set(bearer(admin)).send({ assetIds: [assetId] }).expect(200);
    expect(again.body.items).toHaveLength(1);
  });

  it('mark-printed increments the counter', async () => {
    const res = await ctx.http().post('/api/v1/qr/mark-printed').set(bearer(admin)).send({ assetIds: [assetId] }).expect(200);
    expect(res.body.updated).toBe(1);
    const info = await ctx.http().get(qrUrl()).set(bearer(viewer)).expect(200);
    expect(info.body.printedCount).toBe(1);
    expect(info.body.lastPrintedAt).not.toBeNull();
    const audit = await ctx.prisma.auditLog.findFirst({ where: { action: 'qr.printed', entityId: assetId } });
    expect(audit).not.toBeNull();
  });

  it('rate limits anonymous public lookups per address', async () => {
    const ip = '198.51.100.200';
    for (let i = 0; i < 60; i += 1) {
      await ctx.http().get(publicUrl(token)).set('X-Forwarded-For', ip).expect(200);
    }
    await ctx.http().get(publicUrl(token)).set('X-Forwarded-For', ip).expect(429);
  });
});
