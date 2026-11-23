import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { createTestApp } from './utils/app.js';
import { testTypes } from './utils/fixtures.js';
import type { LoginResult, TestContext } from './utils/app.js';

const UPLOAD_ROOT = resolve(process.cwd(), '.test-uploads');

async function png(width = 64, height = 48): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#2563eb' } })
    .png()
    .toBuffer();
}

const pdf = () => Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');

describe('asset photos & documents (e2e)', () => {
  let ctx: TestContext;
  let admin: LoginResult;
  let viewer: LoginResult;
  let petugas: LoginResult;
  let assetId: string;
  let otherId: string;
  let archivedId: string;
  let firstPhotoId: string;
  let secondPhotoId: string;

  const bearer = (s: LoginResult) => ({ Authorization: `Bearer ${s.accessToken}` });
  const photosUrl = () => `/api/v1/assets/${assetId}/photos`;
  const docsUrl = () => `/api/v1/assets/${assetId}/documents`;

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await ctx.loginAs('ADMIN_INVENTARIS');
    viewer = await ctx.loginAs('VIEWER');
    petugas = await ctx.loginAs('PETUGAS_INVENTARIS');
    const p = ctx.prisma;
    const category = (await testTypes(p)).ng;
    const office = await p.location.create({ data: { code: 'FIL_HQ', name: 'Kantor Berkas', type: 'OFFICE' } });
    const building = await p.location.create({
      data: { code: 'FIL_B', name: 'Blok Berkas', type: 'BUILDING', parentId: office.id },
    });
    const floor = await p.location.create({
      data: { code: 'FIL_F', name: 'Lantai Berkas', type: 'FLOOR', parentId: building.id },
    });
    const room = await p.location.create({
      data: { code: 'FIL_R', name: 'Ruang Berkas', type: 'ROOM', parentId: floor.id },
    });
    const base = {
      name: 'Meja Rapat',
      categoryId: category.id,
      locationId: room.id,
      ownershipType: 'OFFICE',
      acquisitionMethod: 'PURCHASE',
      condition: 'GOOD',
      status: 'IN_USE',
    };
    assetId = (await ctx.http().post('/api/v1/assets').set(bearer(admin)).send(base).expect(201)).body.id;
    otherId = (
      await ctx.http().post('/api/v1/assets').set(bearer(admin)).send({ ...base, name: 'Meja Lain' }).expect(201)
    ).body.id;
    archivedId = (
      await ctx.http().post('/api/v1/assets').set(bearer(admin)).send({ ...base, name: 'Meja Arsip' }).expect(201)
    ).body.id;
    await ctx.http().post(`/api/v1/assets/${archivedId}/archive`).set(bearer(admin)).send({}).expect(200);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('uploads a photo, makes the first one primary, and serves webp variants', async () => {
    const res = await ctx
      .http()
      .post(photosUrl())
      .set(bearer(admin))
      .field('caption', 'Tampak depan')
      .attach('file', await png(), 'meja.png')
      .expect(201);
    firstPhotoId = res.body.id;
    expect(res.body).toMatchObject({ isPrimary: true, caption: 'Tampak depan', width: 64, height: 48 });
    expect(res.body.urls.full).toBe(`/api/v1/assets/${assetId}/photos/${firstPhotoId}/file?variant=full`);

    const full = await ctx.http().get(res.body.urls.full).set(bearer(admin)).expect(200);
    expect(full.headers['content-type']).toContain('image/webp');
    const thumb = await ctx.http().get(res.body.urls.thumb).set(bearer(viewer)).expect(200);
    expect(thumb.headers['content-type']).toContain('image/webp');
    expect(thumb.headers['cache-control']).toContain('private');

    await ctx.http().get(res.body.urls.full).expect(401);

    const audit = await ctx.prisma.auditLog.findFirst({ where: { action: 'asset.photo_added', entityId: assetId } });
    expect(audit?.actorId).toBe(admin.userId);
  });

  it('keeps later photos secondary until promoted; list reports hasPhoto', async () => {
    const res = await ctx.http().post(photosUrl()).set(bearer(admin)).attach('file', await png(32, 32), 'b.png').expect(201);
    secondPhotoId = res.body.id;
    expect(res.body.isPrimary).toBe(false);

    await ctx.http().post(`${photosUrl()}/${secondPhotoId}/primary`).set(bearer(admin)).expect(200);
    const detail = await ctx.http().get(`/api/v1/assets/${assetId}`).set(bearer(viewer)).expect(200);
    expect(detail.body.photos[0]).toMatchObject({ id: secondPhotoId, isPrimary: true });
    expect(detail.body.photos.find((p: { id: string }) => p.id === firstPhotoId).isPrimary).toBe(false);
    expect(detail.body.hasPhoto).toBe(true);

    const list = await ctx.http().get('/api/v1/assets').query({ search: 'Meja Rapat' }).set(bearer(viewer)).expect(200);
    expect(list.body.data[0].hasPhoto).toBe(true);
  });

  it('rejects files whose content does not match an allowed photo type', async () => {
    const liar = await ctx.http().post(photosUrl()).set(bearer(admin)).attach('file', pdf(), 'bukan-gambar.png').expect(400);
    expect(liar.body.message).toBe('Jenis berkas tidak didukung.');
    await ctx.http().post(photosUrl()).set(bearer(admin)).attach('file', Buffer.from('acak sekali isinya'), 'x.jpg').expect(400);
    const stored = readdirSync(join(UPLOAD_ROOT, 'assets', assetId, 'photos'));
    expect(stored.length).toBe(4); // 2 photos × (full + thumb)
  });

  it('rejects oversized photos and missing files', async () => {
    const big = Buffer.alloc(11 * 1024 * 1024, 1);
    const res = await ctx.http().post(photosUrl()).set(bearer(admin)).attach('file', big, 'besar.png').expect(400);
    expect(res.body.message).toBe('Ukuran berkas melebihi batas.');

    const none = await ctx.http().post(photosUrl()).set(bearer(admin)).field('caption', 'x').expect(400);
    expect(none.body.message).toBe('Berkas wajib diunggah.');
  });

  it('enforces permissions and the archive rule', async () => {
    await ctx.http().post(photosUrl()).set(bearer(viewer)).attach('file', await png(), 'v.png').expect(403);
    await ctx.http().delete(`${photosUrl()}/${firstPhotoId}`).set(bearer(viewer)).expect(403);
    const archived = await ctx
      .http()
      .post(`/api/v1/assets/${archivedId}/photos`)
      .set(bearer(admin))
      .attach('file', await png(), 'a.png')
      .expect(400);
    expect(archived.body.message).toBe('Barang sudah diarsipkan.');
  });

  it('deletes a photo together with its files and promotes another primary', async () => {
    await ctx.http().delete(`${photosUrl()}/${secondPhotoId}`).set(bearer(admin)).expect(204);
    const detail = await ctx.http().get(`/api/v1/assets/${assetId}`).set(bearer(viewer)).expect(200);
    expect(detail.body.photos).toHaveLength(1);
    expect(detail.body.photos[0]).toMatchObject({ id: firstPhotoId, isPrimary: true });
    const stored = readdirSync(join(UPLOAD_ROOT, 'assets', assetId, 'photos'));
    expect(stored.length).toBe(2);
    await ctx.http().get(`${photosUrl()}/${secondPhotoId}/file`).set(bearer(admin)).expect(404);
  });

  it('lets PETUGAS attach a photo only to a condition check of the same asset', async () => {
    await ctx.http().post(photosUrl()).set(bearer(petugas)).attach('file', await png(), 'p.png').expect(403);

    const log = (
      await ctx
        .http()
        .post(`/api/v1/assets/${assetId}/condition-logs`)
        .set(bearer(petugas))
        .send({ condition: 'NEEDS_REPAIR', notes: 'Goresan di sisi kiri' })
        .expect(201)
    ).body;
    const foreign = (
      await ctx
        .http()
        .post(`/api/v1/assets/${otherId}/condition-logs`)
        .set(bearer(petugas))
        .send({ condition: 'GOOD' })
        .expect(201)
    ).body;

    const wrong = await ctx
      .http()
      .post(photosUrl())
      .set(bearer(petugas))
      .field('conditionLogId', foreign.id)
      .attach('file', await png(), 'p.png')
      .expect(400);
    expect(wrong.body.message).toBe('Referensi data tidak valid.');

    const ok = await ctx
      .http()
      .post(photosUrl())
      .set(bearer(petugas))
      .field('conditionLogId', log.id)
      .attach('file', await png(), 'p.png')
      .expect(201);
    expect(ok.body.conditionLogId).toBe(log.id);
    expect(ok.body.isPrimary).toBe(false);

    const logs = await ctx.http().get(`/api/v1/assets/${assetId}/condition-logs`).set(bearer(petugas)).expect(200);
    const mine = logs.body.data.find((l: { id: string }) => l.id === log.id);
    expect(mine.photos.map((p: { id: string }) => p.id)).toEqual([ok.body.id]);

    await ctx.http().delete(`${photosUrl()}/${ok.body.id}`).set(bearer(petugas)).expect(403);
  });

  it('uploads, downloads and deletes documents', async () => {
    const up = await ctx
      .http()
      .post(docsUrl())
      .set(bearer(admin))
      .field('title', 'Faktur pembelian')
      .attach('file', pdf(), 'faktur meja.pdf')
      .expect(201);
    expect(up.body).toMatchObject({
      title: 'Faktur pembelian',
      originalName: 'faktur meja.pdf',
      mimeType: 'application/pdf',
    });
    expect(up.body.url).toBe(`/api/v1/assets/${assetId}/documents/${up.body.id}/file`);

    const dl = await ctx.http().get(up.body.url).set(bearer(viewer)).expect(200);
    expect(dl.headers['content-type']).toContain('application/pdf');
    expect(dl.headers['content-disposition']).toContain('attachment');
    expect(dl.headers['content-disposition']).toContain('faktur meja.pdf');

    const liar = await ctx.http().post(docsUrl()).set(bearer(admin)).attach('file', Buffer.from('bukan pdf'), 'x.pdf').expect(400);
    expect(liar.body.message).toBe('Jenis berkas tidak didukung.');

    await ctx.http().delete(up.body.url.replace('/file', '')).set(bearer(viewer)).expect(403);
    await ctx.http().delete(up.body.url.replace('/file', '')).set(bearer(admin)).expect(204);
    expect(existsSync(join(UPLOAD_ROOT, 'assets', assetId, 'documents'))).toBe(true);
    expect(readdirSync(join(UPLOAD_ROOT, 'assets', assetId, 'documents'))).toHaveLength(0);
    await ctx.http().get(up.body.url).set(bearer(admin)).expect(404);
  });
});
