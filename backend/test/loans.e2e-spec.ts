import { createTestApp } from './utils/app.js';
import { testTypes } from './utils/fixtures.js';
import type { LoginResult, TestContext } from './utils/app.js';

const URL = '/api/v1/loans';

describe('loans (e2e)', () => {
  let ctx: TestContext;
  let admin: LoginResult;
  let petugas: LoginResult;
  let viewer: LoginResult;
  let categoryId: string;
  let room: string;
  let room2: string;
  let departmentId: string;
  let emp1: string;
  let emp2: string;
  let empInactive: string;

  const bearer = (s: LoginResult) => ({ Authorization: `Bearer ${s.accessToken}` });
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const shift = (days: number) => {
    const d = new Date(`${today()}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const createAsset = async (name: string, extra: object = {}) =>
    (
      await ctx
        .http()
        .post('/api/v1/assets')
        .set(bearer(admin))
        .send({
          name,
          categoryId,
          locationId: room,
          ownershipType: 'OFFICE',
          acquisitionYear: 2024,
          condition: 'GOOD',
          status: 'IN_USE',
          ...extra,
        })
        .expect(201)
    ).body as { id: string; assetCode: string };

  const employeeLoan = (assetId: string, extra: object = {}) => ({
    assetId,
    borrowerType: 'EMPLOYEE',
    borrowerEmployeeId: emp1,
    purpose: 'Presentasi di kantor cabang',
    loanedAt: today(),
    dueAt: shift(7),
    ...extra,
  });

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await ctx.loginAs('ADMIN_INVENTARIS');
    petugas = await ctx.loginAs('PETUGAS_INVENTARIS');
    viewer = await ctx.loginAs('VIEWER');
    const p = ctx.prisma;
    categoryId = ((await testTypes(p)).ng).id;
    const office = await p.location.create({ data: { code: 'LN_HQ', name: 'Kantor Pinjam', type: 'OFFICE' } });
    room = (await testTypes(p)).roomA.id;
    room2 = (await p.location.create({ data: { code: 'LN_B', name: 'Gedung Pinjam', type: 'BUILDING', parentId: office.id } })).id;
    departmentId = (await p.department.create({ data: { code: 'LN_KEU', name: 'Keuangan Pinjam' } })).id;
    emp1 = (await p.employee.create({ data: { fullName: 'Peminjam Satu', departmentId } })).id;
    emp2 = (await p.employee.create({ data: { fullName: 'Penjamin Dua' } })).id;
    empInactive = (await p.employee.create({ data: { fullName: 'Peminjam Nonaktif', isActive: false } })).id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('PETUGAS records an employee loan; the asset becomes BORROWED', async () => {
    const asset = await createAsset('Proyektor Pinjam');
    const res = await ctx.http().post(URL).set(bearer(petugas)).send(employeeLoan(asset.id)).expect(201);
    expect(res.body).toMatchObject({
      status: 'ACTIVE',
      asset: { id: asset.id, assetCode: asset.assetCode, name: 'Proyektor Pinjam' },
      borrowerType: 'EMPLOYEE',
      borrowerEmployee: { id: emp1, fullName: 'Peminjam Satu' },
      borrowerName: 'Peminjam Satu',
      borrowerDepartment: { id: departmentId, name: 'Keuangan Pinjam' },
      guarantorEmployee: null,
      purpose: 'Presentasi di kantor cabang',
      loanedAt: today(),
      dueAt: shift(7),
      returnedAt: null,
      previousStatus: 'IN_USE',
      isOverdue: false,
      overdueDays: 0,
      recordedBy: { id: petugas.userId },
    });

    const detail = await ctx.http().get(`/api/v1/assets/${asset.id}`).set(bearer(viewer)).expect(200);
    expect(detail.body.status).toBe('BORROWED');
    expect(detail.body.activeLoan).toMatchObject({ id: res.body.id, borrowerName: 'Peminjam Satu', isOverdue: false });

    // While borrowed: no second loan, no status edit, no mutation, no archive.
    const dup = await ctx.http().post(URL).set(bearer(admin)).send(employeeLoan(asset.id)).expect(409);
    expect(dup.body.message).toBe('Barang sedang dipinjam.');
    const patch = await ctx.http().patch(`/api/v1/assets/${asset.id}`).set(bearer(admin)).send({ status: 'STORED' }).expect(409);
    expect(patch.body.message).toBe('Barang sedang dipinjam.');
    const mut = await ctx
      .http()
      .post('/api/v1/mutations')
      .set(bearer(admin))
      .send({ assetId: asset.id, toLocationId: room2, reason: 'x' })
      .expect(409);
    expect(mut.body.message).toBe('Barang sedang dipinjam.');
    const archive = await ctx.http().post(`/api/v1/assets/${asset.id}/archive`).set(bearer(admin)).send({}).expect(409);
    expect(archive.body.message).toBe('Kembalikan pinjaman dulu sebelum mengarsipkan.');

    // Non-status edits are still fine.
    await ctx.http().patch(`/api/v1/assets/${asset.id}`).set(bearer(admin)).send({ notes: 'masih dipinjam' }).expect(200);

    // Return with a condition: status restored, condition logged.
    const returned = await ctx
      .http()
      .post(`${URL}/${res.body.id}/return`)
      .set(bearer(petugas))
      .send({ condition: 'NEEDS_REPAIR', notes: 'Kabel HDMI lecet' })
      .expect(200);
    expect(returned.body).toMatchObject({
      status: 'RETURNED',
      returnCondition: 'NEEDS_REPAIR',
      returnNotes: 'Kabel HDMI lecet',
      returnedBy: { id: petugas.userId },
    });
    expect(returned.body.returnedAt).toBeTruthy();

    const after = await ctx.http().get(`/api/v1/assets/${asset.id}`).set(bearer(viewer)).expect(200);
    expect(after.body.status).toBe('IN_USE');
    expect(after.body.condition).toBe('NEEDS_REPAIR');
    expect(after.body.activeLoan).toBeNull();

    const logs = await ctx.http().get(`/api/v1/assets/${asset.id}/condition-logs`).set(bearer(viewer)).expect(200);
    expect(logs.body.data[0]).toMatchObject({
      source: 'LOAN_RETURN',
      loanId: res.body.id,
      condition: 'NEEDS_REPAIR',
      previousCondition: 'GOOD',
      notes: 'Kabel HDMI lecet',
    });

    const again = await ctx.http().post(`${URL}/${res.body.id}/return`).set(bearer(petugas)).send({}).expect(409);
    expect(again.body.message).toBe('Peminjaman sudah selesai.');
    const extend = await ctx.http().patch(`${URL}/${res.body.id}`).set(bearer(petugas)).send({ dueAt: shift(10) }).expect(409);
    expect(extend.body.message).toBe('Peminjaman sudah selesai.');

    const history = await ctx.http().get(`/api/v1/assets/${asset.id}/history`).set(bearer(viewer)).expect(200);
    const actions = history.body.data.map((h: { action: string }) => h.action);
    expect(actions).toEqual(expect.arrayContaining(['loan.created', 'loan.returned', 'asset.condition_recorded']));
  });

  it('external borrowers need a name and a guarantor; dates are checked', async () => {
    const asset = await createAsset('Kamera Pinjam');
    const noGuarantor = await ctx
      .http()
      .post(URL)
      .set(bearer(petugas))
      .send({ assetId: asset.id, borrowerType: 'EXTERNAL', borrowerName: 'Rina', loanedAt: today(), dueAt: shift(3) })
      .expect(400);
    expect(noGuarantor.body.message).toBe('Validasi gagal.');
    expect(noGuarantor.body.errors.guarantorEmployeeId).toEqual(['Penjamin wajib diisi']);

    const noName = await ctx
      .http()
      .post(URL)
      .set(bearer(petugas))
      .send({ assetId: asset.id, borrowerType: 'EXTERNAL', guarantorEmployeeId: emp2, loanedAt: today(), dueAt: shift(3) })
      .expect(400);
    expect(noName.body.errors.borrowerName).toEqual(['Nama peminjam wajib diisi']);

    const noEmployee = await ctx
      .http()
      .post(URL)
      .set(bearer(petugas))
      .send({ assetId: asset.id, borrowerType: 'EMPLOYEE', loanedAt: today(), dueAt: shift(3) })
      .expect(400);
    expect(noEmployee.body.errors.borrowerEmployeeId).toEqual(['Pilih pegawai peminjam']);

    const inactive = await ctx
      .http()
      .post(URL)
      .set(bearer(petugas))
      .send(employeeLoan(asset.id, { borrowerEmployeeId: empInactive }))
      .expect(409);
    expect(inactive.body.message).toBe('Pegawai tidak aktif.');

    const badDue = await ctx
      .http()
      .post(URL)
      .set(bearer(petugas))
      .send(employeeLoan(asset.id, { loanedAt: today(), dueAt: shift(-1) }))
      .expect(400);
    expect(badDue.body.errors.dueAt).toEqual(['Rencana kembali tidak boleh sebelum tanggal pinjam']);

    const future = await ctx
      .http()
      .post(URL)
      .set(bearer(petugas))
      .send(employeeLoan(asset.id, { loanedAt: shift(1), dueAt: shift(5) }))
      .expect(400);
    expect(future.body.errors.loanedAt).toEqual(['Tanggal pinjam tidak boleh di masa depan']);

    const ok = await ctx
      .http()
      .post(URL)
      .set(bearer(admin))
      .send({
        assetId: asset.id,
        borrowerType: 'EXTERNAL',
        borrowerName: 'Rina (adik Pak Dua)',
        borrowerContact: '0812000',
        guarantorEmployeeId: emp2,
        loanedAt: shift(-2),
        dueAt: shift(2),
      })
      .expect(201);
    expect(ok.body).toMatchObject({
      borrowerType: 'EXTERNAL',
      borrowerEmployee: null,
      borrowerName: 'Rina (adik Pak Dua)',
      borrowerContact: '0812000',
      guarantorEmployee: { id: emp2, fullName: 'Penjamin Dua' },
    });

    const extended = await ctx.http().patch(`${URL}/${ok.body.id}`).set(bearer(petugas)).send({ dueAt: shift(9) }).expect(200);
    expect(extended.body.dueAt).toBe(shift(9));
    await ctx.http().post(`${URL}/${ok.body.id}/return`).set(bearer(admin)).send({}).expect(200);
    const back = await ctx.http().get(`/api/v1/assets/${asset.id}`).set(bearer(viewer)).expect(200);
    expect(back.body.status).toBe('IN_USE');
    expect(back.body.condition).toBe('GOOD');
  });

  it('flags overdue loans and orders them first', async () => {
    const late = await createAsset('Laptop Telat');
    const onTime = await createAsset('Laptop Tepat');
    const lateLoan = (await ctx.http().post(URL).set(bearer(petugas)).send(employeeLoan(late.id)).expect(201)).body;
    await ctx.http().post(URL).set(bearer(petugas)).send(employeeLoan(onTime.id)).expect(201);
    await ctx.prisma.assetLoan.update({ where: { id: lateLoan.id }, data: { dueAt: new Date(`${shift(-3)}T00:00:00Z`) } });

    const overdue = await ctx.http().get(`${URL}?state=overdue`).set(bearer(viewer)).expect(200);
    expect(overdue.body.data.map((l: { id: string }) => l.id)).toEqual([lateLoan.id]);
    expect(overdue.body.data[0]).toMatchObject({ isOverdue: true, overdueDays: 3 });

    const active = await ctx.http().get(`${URL}?state=active`).set(bearer(viewer)).expect(200);
    const ids = active.body.data.map((l: { id: string }) => l.id);
    expect(ids[0]).toBe(lateLoan.id);

    const detail = await ctx.http().get(`/api/v1/assets/${late.id}`).set(bearer(viewer)).expect(200);
    expect(detail.body.activeLoan.isOverdue).toBe(true);

    const stats = await ctx.http().get('/api/v1/assets/statistics').set(bearer(viewer)).expect(200);
    expect(stats.body.activeLoans).toBeGreaterThanOrEqual(2);
    expect(stats.body.overdueLoans).toBeGreaterThanOrEqual(1);

    const search = await ctx.http().get(`${URL}?state=all&search=Peminjam%20Satu`).set(bearer(viewer)).expect(200);
    expect(search.body.data.length).toBeGreaterThanOrEqual(2);
    const byAsset = await ctx.http().get(`${URL}?state=all&assetId=${late.id}`).set(bearer(viewer)).expect(200);
    expect(byAsset.body.data.map((l: { id: string }) => l.id)).toEqual([lateLoan.id]);
    const byBorrower = await ctx.http().get(`${URL}?state=all&borrowerEmployeeId=${emp1}`).set(bearer(viewer)).expect(200);
    expect(byBorrower.body.data.every((l: { borrowerEmployee: { id: string } }) => l.borrowerEmployee.id === emp1)).toBe(true);
  });

  it('restores AVAILABLE when the previous status was itself BORROWED', async () => {
    const asset = await createAsset('Kursi Aneh');
    const loan = (await ctx.http().post(URL).set(bearer(admin)).send(employeeLoan(asset.id)).expect(201)).body;
    await ctx.prisma.assetLoan.update({ where: { id: loan.id }, data: { previousStatus: 'BORROWED' } });
    await ctx.http().post(`${URL}/${loan.id}/return`).set(bearer(admin)).send({}).expect(200);
    const after = await ctx.http().get(`/api/v1/assets/${asset.id}`).set(bearer(viewer)).expect(200);
    expect(after.body.status).toBe('AVAILABLE');
  });

  it('only one of five concurrent loans for the same asset succeeds', async () => {
    const asset = await createAsset('Meja Balapan Pinjam');
    const results = await Promise.all(
      Array.from({ length: 5 }, () => ctx.http().post(URL).set(bearer(petugas)).send(employeeLoan(asset.id))),
    );
    const statuses = results.map((r) => r.status).sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409, 409, 409, 409]);
    expect(results.filter((r) => r.status === 409).every((r) => r.body.message === 'Barang sedang dipinjam.')).toBe(true);
    expect(await ctx.prisma.assetLoan.count({ where: { assetId: asset.id } })).toBe(1);
    const row = await ctx.prisma.asset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(row.status).toBe('BORROWED');
  });

  it('refuses loans on archived assets and on assets with a pending mutation', async () => {
    const archived = await createAsset('Printer Arsip Pinjam');
    await ctx.http().post(`/api/v1/assets/${archived.id}/archive`).set(bearer(admin)).send({}).expect(200);
    const a = await ctx.http().post(URL).set(bearer(petugas)).send(employeeLoan(archived.id)).expect(409);
    expect(a.body.message).toBe('Barang sudah diarsipkan.');

    const pending = await createAsset('Printer Mutasi Pinjam');
    await ctx
      .http()
      .post('/api/v1/mutations')
      .set(bearer(petugas))
      .send({ assetId: pending.id, toLocationId: room2, reason: 'pindah' })
      .expect(201);
    const m = await ctx.http().post(URL).set(bearer(petugas)).send(employeeLoan(pending.id)).expect(409);
    expect(m.body.message).toBe('Sudah ada mutasi yang menunggu persetujuan.');
  });

  it('accepts a same-day return recorded before 07:00 WIB and refuses one before the loan date', async () => {
    const asset = await createAsset('Jam Dinding Pinjam');
    const loan = (await ctx.http().post(URL).set(bearer(admin)).send(employeeLoan(asset.id)).expect(201)).body;
    const early = await ctx
      .http()
      .post(`${URL}/${loan.id}/return`)
      .set(bearer(admin))
      .send({ returnedAt: `${shift(-1)}T23:30:00+07:00` })
      .expect(400);
    expect(early.body.errors.returnedAt).toBeDefined();
    const ok = await ctx
      .http()
      .post(`${URL}/${loan.id}/return`)
      .set(bearer(admin))
      .send({ returnedAt: `${today()}T00:30:00+07:00` })
      .expect(200);
    expect(ok.body.status).toBe('RETURNED');
  });

  it('VIEWER may list and read but not write', async () => {
    const list = await ctx.http().get(`${URL}?state=all`).set(bearer(viewer)).expect(200);
    expect(list.body.meta.total).toBeGreaterThanOrEqual(5);
    await ctx.http().get(`${URL}/${list.body.data[0].id}`).set(bearer(viewer)).expect(200);
    await ctx.http().post(URL).set(bearer(viewer)).send({}).expect(403);
    await ctx.http().post(`${URL}/${list.body.data[0].id}/return`).set(bearer(viewer)).send({}).expect(403);
    await ctx.http().get(`${URL}/00000000-0000-0000-0000-000000000000`).set(bearer(viewer)).expect(404);
  });
});
