import ExcelJS from 'exceljs';
import type { Response } from 'supertest';
import { createTestApp } from './utils/app.js';
import type { LoginResult, TestContext } from './utils/app.js';
import { testTypes } from './utils/fixtures.js';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** supertest buffers unknown binary types only with a parser. */
const binary = (res: Response, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

describe('inventory report (e2e)', () => {
  let ctx: TestContext;
  let admin: LoginResult;
  let viewer: LoginResult;
  const URL = '/api/v1/reports/inventory';
  const bearer = (s: LoginResult) => ({ Authorization: `Bearer ${s.accessToken}` });

  const load = async (body: Buffer) => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(body as unknown as ArrayBuffer);
    return wb.worksheets[0];
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await ctx.loginAs('ADMIN_INVENTARIS');
    viewer = await ctx.loginAs('VIEWER');
    const t = await testTypes(ctx.prisma);
    await ctx
      .http()
      .post('/api/v1/assets')
      .set(bearer(admin))
      .send({
        name: 'Kursi Laporan',
        categoryId: t.ng.id,
        locationId: t.roomA.id,
        acquisitionYear: 2023,
        ownershipType: 'OFFICE',
        condition: 'GOOD',
        status: 'IN_USE',
        quantity: 2,
        specification: 'Panda',
      })
      .expect(201);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('downloads the per-room report as xlsx with the office header', async () => {
    const res = await ctx.http().get(URL).query({ mode: 'per-room' }).set(bearer(viewer)).buffer(true).parse(binary).expect(200);
    expect(res.headers['content-type']).toContain(XLSX);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="Daftar Inventaris DPC \d{4}-\d{2}-\d{2}\.xlsx"/);
    const sheet = await load(res.body as Buffer);
    expect(sheet.getCell('A1').value).toBe('DAFTAR INVENTARIS BARANG');
    expect(sheet.getCell('A2').value).toBe('DPC PDI PERJUANGAN KOTA SURABAYA');
    expect(sheet.getCell('A3').text).toMatch(/^TAHUN \d{4}$/);
    const texts: string[] = [];
    sheet.eachRow((row) => texts.push(row.values ? (row.values as unknown[]).filter(Boolean).join(' | ') : ''));
    const all = texts.join('\n');
    expect(all).toContain('A. INVENTARIS BARANG BERGERAK (KODE: BG)');
    expect(all).toContain('RUANG SEKRETARIAT (KODE: A)');
    expect(all).toContain('SUMBER');
    expect(all).toMatch(/900 \| Barang Uji \| \d+/);
  });

  it('downloads the overall report', async () => {
    const res = await ctx.http().get(URL).query({ mode: 'overall' }).set(bearer(viewer)).buffer(true).parse(binary).expect(200);
    const sheet = await load(res.body as Buffer);
    const texts: string[] = [];
    sheet.eachRow((row) => texts.push((row.values as unknown[]).filter(Boolean).join(' | ')));
    expect(texts.join('\n')).not.toContain('RUANG SEKRETARIAT (KODE: A)');
  });

  it('validates the mode and needs a login', async () => {
    await ctx.http().get(URL).query({ mode: 'semua' }).set(bearer(viewer)).expect(400);
    await ctx.http().get(URL).query({ mode: 'overall' }).expect(401);
  });
});
