# OAMS Tahap 3 — Asset Operations

Dokumen ini merangkum apa yang dibangun pada Tahap 3, bagaimana memakainya, keputusan yang diambil, dan apa yang belum. Dibaca bersama [docs/tahap-2-core-assets.md](tahap-2-core-assets.md), [docs/tahap-1-foundation.md](tahap-1-foundation.md), dan [docs/BLUEPRINT.md](BLUEPRINT.md).

Desain: [docs/superpowers/specs/2026-11-19-oams-tahap3-asset-operations-design.md](superpowers/specs/2026-11-19-oams-tahap3-asset-operations-design.md). Rencana implementasi: [docs/superpowers/plans/2026-11-19-oams-tahap3-asset-operations.md](superpowers/plans/2026-11-19-oams-tahap3-asset-operations.md).

---

## 1. Ringkasan

Tahap 3 membuat barang yang sudah tercatat bisa **berpindah, dipinjam, dan diperiksa**, dengan setiap perubahan tercatat:

- **Pegawai** sebagai data master baru (terpisah dari akun login): penanggung jawab barang, peminjam, dan penjamin dipilih dari daftar ini. Admin mengisinya; pegawai yang keluar dinonaktifkan, bukan dihapus.
- **Penanggung jawab** barang kini menunjuk ke pegawai, dengan riwayat pergantian tersendiri (`asset_assignments`).
- **Mutasi** lokasi dan/atau penanggung jawab dengan persetujuan: Petugas mengajukan, Admin menyetujui atau menolak (alasan wajib), pengaju bisa membatalkan. Perpindahan oleh Admin sendiri tercatat sebagai mutasi yang langsung disetujui. **Semua** perpindahan lokasi dan pergantian penanggung jawab hanya lewat jalur ini; formulir ubah barang tidak lagi memuat kolom tersebut.
- **Peminjaman keluar**: barang kantor dipinjam karyawan (dipilih dari daftar pegawai) atau orang dekat karyawan (nama diketik, wajib ada karyawan penjamin). Status barang menjadi `Dipinjam` sampai pengembalian dicatat; saat kembali, status semula dipulihkan dan kondisi saat kembali bisa dicatat. Keterlambatan dihitung dari rencana kembali (kalender Asia/Jakarta).
- **Pemeriksaan kondisi**: kondisi baru, catatan, tanggal, dan foto kerusakan; kondisi barang mengikuti pemeriksaan terakhir. Petugas boleh melampirkan foto pemeriksaan meski tidak punya hak ubah barang.
- **Riwayat barang** menjadi satu linimasa: pendaftaran, perubahan, QR, mutasi, pergantian penanggung jawab, pinjam/kembali, pemeriksaan kondisi, arsip.
- **Dashboard** bertambah kartu "Mutasi menunggu", "Pinjaman aktif", dan "Pinjaman terlambat".

Yang **bukan** bagian Tahap 3 (sesuai desain): peminjaman barang **oleh** kantor dari pihak ketiga (pemilik menegaskan barang pinjaman dari luar tidak masuk inventaris), status `Draft` mutasi, notifikasi e-mail/push, pemeliharaan, stock opname, laporan/ekspor, import pegawai dari Excel, portal peminjam.

---

## 2. Model data baru

Migrasi: `backend/prisma/migrations/20261119065116_tahap3_operations`.

| Tabel | Isi |
|---|---|
| `employees` | `employee_number` (unik, opsional), `full_name`, `department_id`, `position`, `phone`, `email`, `user_id` (unik, opsional: tautan ke akun login), `is_active` |
| `asset_assignments` | riwayat penanggung jawab: `from_employee_id`, `to_employee_id` (null = dilepas), `source` `CREATE|MUTATION`, `mutation_id`, `note`, `changed_by_id` |
| `asset_mutations` | `status` `PENDING|APPROVED|REJECTED|CANCELLED`, `from_location_id`, `to_location_id` (null = lokasi tidak berubah), `changes_responsible`, `from/to_responsible_employee_id`, `reason`, `requested_by_id`, `requested_at`, `decided_by_id`, `decided_at`, `decision_note`, `cancelled_at` |
| `asset_loans` | `status` `ACTIVE|RETURNED`, `borrower_type` `EMPLOYEE|EXTERNAL`, `borrower_employee_id`, `borrower_name` (selalu terisi), `borrower_department_id`, `borrower_contact`, `guarantor_employee_id`, `purpose`, `loaned_at` (date), `due_at` (date), `returned_at`, `return_condition`, `return_notes`, `previous_status` (status barang sebelum dipinjam), `recorded_by_id`, `returned_by_id` |
| `asset_condition_logs` | `condition`, `previous_condition`, `notes`, `checked_at` (date), `source` `CREATE|MANUAL|LOAN_RETURN`, `loan_id`, `checked_by_id` |

Perubahan tabel lama:

- `assets.responsible_user_id` **dihapus**, diganti `responsible_employee_id` (FK `employees`). Data penanggung jawab lama tidak dimigrasikan (di server hanya ada barang uji).
- `asset_photos.condition_log_id` (opsional): foto yang diunggah sebagai dokumentasi pemeriksaan kondisi. Foto ini tetap tampil di galeri barang (berlabel "Pemeriksaan") dan tidak otomatis menjadi foto utama.

Aturan basis data yang dijaga lewat SQL di migrasi:

- Indeks unik parsial `asset_mutations_one_pending (asset_id) WHERE status = 'PENDING'`: satu mutasi menunggu per barang.
- Indeks unik parsial `asset_loans_one_active (asset_id) WHERE status = 'ACTIVE'`: satu pinjaman aktif per barang. Lima permintaan serentak diuji: tepat satu berhasil.
- `INSERT ... ON CONFLICT DO NOTHING` ke `role_permissions` agar role Viewer yang sudah ada di server mendapat `mutations.view` (seed hanya memberi permission yang baru dibuat ke role lama).

"Terlambat" bukan status tersimpan: pinjaman `ACTIVE` dengan `due_at` sebelum hari ini menurut kalender Asia/Jakarta (`backend/src/common/dates/jakarta.ts`).

---

## 3. Endpoint backend

Semua di bawah `/api/v1`; format respons dan error sama seperti tahap sebelumnya. Permission dalam kurung.

### 3.1 Pegawai (`/employees`)

| Metode | Path | Permission | Keterangan |
|---|---|---|---|
| GET | `/employees` | `master_data.view` | filter `search` (nama, nomor), `departmentId`, `isActive` |
| GET | `/employees/lookup?search=` | `master_data.view` | pegawai aktif, maks 20, untuk pemilih |
| GET | `/employees/:id` | `master_data.view` | + `assetCount` (barang aktif yang dipegang), `activeLoanCount` |
| POST | `/employees` | `employees.manage` | |
| PATCH | `/employees/:id` | `employees.manage` | termasuk `isActive`; menonaktifkan **tidak** melepas barang yang dipegang; `userId` yang sudah tertaut ke pegawai lain → 409 `Akun ini sudah tertaut ke pegawai lain.` |

### 3.2 Perubahan pada `/assets`

- `POST /assets` menerima `responsibleEmployeeId` (pegawai harus aktif; nonaktif → 409 `Pegawai tidak aktif.`). Pembuatan barang juga menulis baris `asset_assignments` (`CREATE`) bila ada penanggung jawab dan baris `asset_condition_logs` (`CREATE`) dari kondisi awal, dalam transaksi yang sama.
- `PATCH /assets/:id` **menolak** `locationId` dan `responsibleEmployeeId` (400, pesan `Ubah lewat mutasi`) serta `condition` (`Ubah lewat pemeriksaan kondisi`); `status` menolak `BORROWED`/`RETURNED` (`Status ini diatur oleh peminjaman`) dan ditolak 409 `Barang sedang dipinjam.` selama ada pinjaman aktif. Kolom lain tetap bisa diubah.
- `POST /assets/:id/archive` → 409 `Kembalikan pinjaman dulu sebelum mengarsipkan.` / `Selesaikan mutasi yang menunggu dulu sebelum mengarsipkan.` bila masih ada pinjaman aktif atau mutasi menunggu.
- `GET /assets/:id` menambah `responsibleEmployee {id, fullName, department}`, `activeLoan {id, borrowerName, loanedAt, dueAt, isOverdue}`, `pendingMutation {id, requestedAt, requestedBy, toLocation, changesResponsible, toResponsibleEmployee}`; `GET /assets` memakai filter `responsibleEmployeeId` (menggantikan `responsibleUserId`).
- `GET /assets/:id/history` membaca audit modul `assets`, `qr`, `assignments`, `condition_logs`, `mutations`, `loans`.
- `GET /assets/statistics` menambah `pendingMutations`, `activeLoans`, `overdueLoans`.
- Baru: `GET /assets/:id/condition-logs` (`assets.view`), `POST /assets/:id/condition-logs` (`conditions.record`; body `{condition, notes?, checkedAt?}`; tanggal tidak boleh di masa depan; barang arsip → 409), `GET /assets/:id/assignments` (`assets.view`).
- `POST /assets/:id/photos` menerima field opsional `conditionLogId`. Izin diputuskan di service: pemegang `assets.update`, **atau** pemegang `conditions.record` yang menyertakan `conditionLogId` milik barang yang sama (log barang lain → 400 `Referensi data tidak valid.`). Menghapus foto dan mengatur foto utama tetap memerlukan `assets.update`.

### 3.3 Mutasi (`/mutations`)

| Metode | Path | Permission | Keterangan |
|---|---|---|---|
| GET | `/mutations` | `mutations.view` | filter `status`, `assetId`, `requestedById`, `search` (kode/nama barang); terbaru dulu |
| GET | `/mutations/:id` | `mutations.view` | |
| POST | `/mutations` | `mutations.request` | `{assetId, toLocationId?, changesResponsible?, toResponsibleEmployeeId?, reason}`; pemegang `mutations.approve` langsung disetujui dalam transaksi yang sama |
| POST | `/mutations/:id/approve` | `mutations.approve` | `{note?}` |
| POST | `/mutations/:id/reject` | `mutations.approve` | `{note}` wajib (`Alasan penolakan wajib diisi`) |
| POST | `/mutations/:id/cancel` | `mutations.request` | hanya pengaju sendiri atau pemegang `mutations.approve` |

Aturan 409: barang arsip (`Barang sudah diarsipkan.`), sedang dipinjam (`Barang sedang dipinjam.`), sudah ada mutasi menunggu (`Sudah ada mutasi yang menunggu persetujuan.`), tidak ada perubahan efektif (`Tidak ada perubahan yang diajukan.`), lokasi tujuan nonaktif (`Lokasi tujuan tidak aktif.`), pegawai tujuan nonaktif (`Pegawai tidak aktif.`), keputusan pada mutasi yang bukan `PENDING` (`Mutasi sudah diproses.`), barang sudah berpindah sejak diajukan (`Barang sudah berpindah.`). Persetujuan berjalan dalam transaksi `Serializable` yang memeriksa ulang semua prasyarat, memperbarui barang, menulis `asset_assignments` bila penanggung jawab berubah, lalu menandai mutasi; kegagalan serialisasi dicoba ulang sekali.

### 3.4 Peminjaman (`/loans`)

| Metode | Path | Permission | Keterangan |
|---|---|---|---|
| GET | `/loans` | `loans.view` | `state` = `active` (default) \| `overdue` \| `returned` \| `all`; filter `assetId`, `borrowerEmployeeId`, `search` (kode/nama barang, nama peminjam); aktif dulu, yang paling terlambat di atas |
| GET | `/loans/:id` | `loans.view` | |
| POST | `/loans` | `loans.manage` | `{assetId, borrowerType, borrowerEmployeeId?, borrowerName?, borrowerDepartmentId?, borrowerContact?, guarantorEmployeeId?, purpose?, loanedAt, dueAt}` |
| PATCH | `/loans/:id` | `loans.manage` | hanya saat aktif: `dueAt` (perpanjangan), `purpose`, `borrowerContact` |
| POST | `/loans/:id/return` | `loans.manage` | `{returnedAt?, condition?, notes?}` |

Validasi 400 (`Validasi gagal.` + `errors`): `EMPLOYEE` wajib `borrowerEmployeeId` (`Pilih pegawai peminjam`); `EXTERNAL` wajib `borrowerName` (`Nama peminjam wajib diisi`) dan `guarantorEmployeeId` (`Penjamin wajib diisi`); `loanedAt` tidak di masa depan; `dueAt ≥ loanedAt`. Untuk peminjam karyawan, nama dan unit kerja disalin dari data pegawai. Aturan 409 sama dengan mutasi (arsip, sedang dipinjam, ada mutasi menunggu). Saat dibuat: `previous_status` disimpan dan status barang menjadi `BORROWED`. Saat dikembalikan: status barang dipulihkan (bila `previous_status` ternyata `BORROWED`/`RETURNED`, dipakai `AVAILABLE`), dan bila `condition` diisi dibuat log kondisi `LOAN_RETURN` yang juga mengubah kondisi barang. Pengembalian/perpanjangan pada pinjaman yang sudah selesai → 409 `Peminjaman sudah selesai.`

---

## 4. Permission

Ditambahkan ke katalog (`backend/src/common/auth/permissions.catalog.ts`); seed memberi permission baru ke role yang sudah ada saat backend start.

| Kode | Super Admin | Admin Inventaris | Petugas | Viewer |
|---|---|---|---|---|
| `employees.manage` | ✓ | ✓ | – | – |
| `loans.view` | ✓ | ✓ | ✓ | ✓ |
| `loans.manage` | ✓ | ✓ | ✓ | – |
| `conditions.record` | ✓ | ✓ | ✓ | – |
| `mutations.view` | ✓ | ✓ | ✓ | ✓ (baru; lewat migrasi untuk DB lama) |
| `mutations.request` | ✓ | ✓ | ✓ | – |
| `mutations.approve` | ✓ | ✓ | – | – |

Daftar pegawai dibaca dengan `master_data.view` (semua role), dikelola dengan `employees.manage`.

---

## 5. Aplikasi web

Menu baru: **Mutasi** (`/mutations`) dan **Peminjaman** (`/loans`) di bagian Inventaris; **Pegawai** (`/employees`) di Data Master.

- **Pegawai** `/employees`: tabel dengan pencarian, filter unit kerja dan status, dialog tambah/ubah (termasuk tautan akun login lewat pemilih pengguna), nonaktifkan/aktifkan. `/employees/[id]`: data pegawai, barang yang dipegang, pinjaman aktif atas namanya.
- **Mutasi** `/mutations`: filter status (default Menunggu) dan pencarian; tombol Setujui/Tolak untuk penyetuju, Batalkan untuk pengaju. `/mutations/new?assetId=`: pemilih barang (menampilkan lokasi dan PJ saat ini), centang "Pindah lokasi" dan/atau "Ganti penanggung jawab" (dengan pilihan "lepaskan"), alasan; tombol berbunyi "Pindahkan sekarang" untuk penyetuju, "Ajukan mutasi" untuk Petugas. `/mutations/[id]`: sebelum/sesudah, linimasa, aksi sesuai hak.
- **Peminjaman** `/loans`: tab Aktif | Terlambat | Selesai | Semua, pencarian, tombol Kembalikan/Perpanjang. `/loans/new?assetId=`: pilihan Karyawan (pemilih pegawai) atau Bukan karyawan (nama, unit terkait, penjamin wajib), kontak, tanggal pinjam (default hari ini), rencana kembali (default +7 hari), keperluan. `/loans/[id]`: rincian peminjam dan pengembalian. Dialog kembalikan: waktu kembali, kondisi saat kembali (opsional), catatan. Dialog perpanjang: rencana kembali baru.
- **Barang**: formulir tambah memakai pemilih pegawai untuk penanggung jawab; formulir ubah menampilkan lokasi, penanggung jawab, dan kondisi hanya-baca dengan tautan "Ubah lewat mutasi" / "Catat pemeriksaan", status tidak menawarkan Dipinjam/Dikembalikan dan terkunci saat barang dipinjam. Detail barang: tombol Catat peminjaman / Kembalikan, Catat kondisi (dialog dengan foto kerusakan), Ajukan mutasi / Pindahkan; banner "Sedang dipinjam oleh …" dan "Mutasi menunggu persetujuan"; tab baru Kondisi, Mutasi, Peminjaman; tab Riwayat dengan label aksi baru; `?tab=` membuka tab tertentu.
- **Dashboard**: kartu Mutasi menunggu (→ `/mutations?status=PENDING`), Pinjaman aktif (→ `/loans`), Pinjaman terlambat (→ `/loans?state=overdue`), sesuai hak akses.

---

## 6. Riwayat dan audit

Aksi baru (semua dengan `entityId` = id barang agar muncul di tab Riwayat): modul `employees` (`employee.created|updated|activated|deactivated`, entityId = id pegawai), `assignments` (`asset.assigned`), `condition_logs` (`asset.condition_recorded`, memuat `conditionLogId`), `mutations` (`mutation.requested|approved|rejected|cancelled`, memuat `mutationId`), `loans` (`loan.created|updated|returned`, memuat `loanId`). Kondisi awal dan penanggung jawab awal saat pendaftaran tidak diaudit terpisah karena `asset.created` sudah memuatnya.

---

## 7. Pengujian

- Backend e2e (PostgreSQL asli): `employees` (CRUD, pencarian, lookup, tautan akun, nonaktif tetap memegang barang), `asset-conditions` (log awal + assignment saat pendaftaran, pemeriksaan oleh Petugas, tanggal masa depan, arsip), `asset-files` (foto pemeriksaan oleh Petugas: tanpa log 403, log barang lain 400, log sendiri 201), `assets` (kolom terkunci 400, status pinjaman 400, statistik baru), `mutations` (alur lengkap, auto-approve Admin, 5 permintaan serentak → 1 berhasil, tolak/batal, persetujuan setelah arsip gagal tanpa perubahan), `loans` (pinjam/kembali dengan kondisi, peminjam luar + penjamin, 5 pinjaman serentak → 1 berhasil, terlambat, pemulihan status, arsip/mutasi menunggu).
- Unit: pembantu tanggal Asia/Jakarta (backend dan frontend), skema formulir mutasi dan pinjaman, item navigasi, payload ubah barang tanpa kolom terkunci.
- Verifikasi penuh (`npm run lint && npm run build && npm test` di root) hijau; pemeriksaan browser untuk setiap halaman baru.

---

## 8. Deployment dan operasional

- Migrasi `20261119065116_tahap3_operations` berjalan otomatis saat backend start, termasuk indeks unik parsial dan pemberian `mutations.view` ke Viewer. Seed menambahkan empat permission baru ke role yang sudah ada.
- Tidak ada variabel lingkungan baru. Urutan: `git pull --ff-only && docker compose up -d --build`.
- **Isi daftar pegawai dulu** (menu Pegawai) sebelum mencatat peminjaman atau menunjuk penanggung jawab; pemilih hanya menampilkan pegawai aktif.
- Barang yang sedang dipinjam atau punya mutasi menunggu tidak bisa diarsipkan; selesaikan dulu.

---

## 9. Keputusan di luar atau melengkapi blueprint

| Topik | Keputusan | Alasan |
|---|---|---|
| Arah peminjaman | Hanya barang kantor dipinjam keluar; bab 4.11 (barang pinjaman dari pihak ketiga) tidak dibangun | Pemilik: barang pinjaman dari luar tidak masuk inventaris |
| Peminjam | Karyawan dipilih dari daftar pegawai; orang luar diketik bebas dengan karyawan penjamin wajib | Pemilik: umumnya karyawan, kadang orang dekat karyawan |
| Penanggung jawab | Menunjuk ke pegawai, bukan akun login | Tidak semua karyawan punya akun |
| Perpindahan | Semua lewat mutasi, termasuk Admin (langsung disetujui) | Pemilik: agar tercatat |
| Persetujuan pinjaman | Tidak ada; dicatat saat barang diserahkan | Barang sudah berpindah tangan saat dicatat |
| Status `Draft` | Dilewati | Formulir pendek, sekali jadi |
| Status `RETURNED` barang | Tidak dipakai; barang kembali ke status semula | Lebih informatif daripada status tersendiri |
| Unit kerja barang | Tetap independen dari unit pegawai penanggung jawab | Laporan per unit mengacu ke unit pemilik barang |
| Arsip | Ditolak saat ada pinjaman aktif / mutasi menunggu | Mencegah barang arsip berstatus Dipinjam |
| Foto pemeriksaan oleh Petugas | Boleh, lewat `conditionLogId`; hapus/utama tetap Admin | Matriks: Petugas mencatat kondisi dengan foto |
| Kode status arsip | Aksi Tahap 3 memakai 409; rute Tahap 2 tetap 400 | Konsistensi dengan konflik lain di Tahap 3 tanpa mengubah kontrak Tahap 2 |

---

## 10. Review akhir dan temuan yang ditunda

Review independen atas seluruh diff Tahap 3 (reviewer terpisah, model paling mampu) menilai: tidak ada temuan Critical; kelima fokus review (balapan permintaan serentak, persetujuan setelah barang berubah, pemulihan status saat kembali, pegawai nonaktif, foto pemeriksaan oleh Petugas) terpenuhi di backend. Tiga temuan Important diperbaiki dengan test regresi:

| # | Temuan | Perbaikan |
|---|---|---|
| I-1 | Formulir ubah barang gagal disimpan selama barang dipinjam: status `BORROWED` ikut terkirim dan ditolak backend | `toAssetUpdatePayload` membuang status `BORROWED`/`RETURNED`; unit test |
| I-2 | Pengembalian di hari yang sama sebelum pukul 07.00 WIB ditolak karena dibandingkan dengan tengah malam UTC | perbandingan memakai tanggal kalender Asia/Jakarta; e2e |
| I-3 | Persetujuan mutasi tidak memeriksa ulang pegawai/lokasi tujuan yang keburu nonaktif | `applyApproval` memeriksa ulang keduanya di dalam transaksi (409 `Pegawai tidak aktif.` / `Lokasi tujuan tidak aktif.`); e2e, termasuk kasus barang keburu dipinjam |

Temuan Minor yang **ditunda** (dicatat untuk Tahap 4):

1. Balapan lintas alur (pinjam vs arsip / ubah status / persetujuan mutasi dalam jendela di bawah 100 ms) belum diserialisasi; balapan pada endpoint yang sama sudah aman lewat indeks unik. Mitigasi murah: transaksi `Serializable` pada pembuatan pinjaman dan `updateMany` bersyarat pada arsip/status.
2. Kegagalan serialisasi kedua saat `approve` memakai pesan "Sudah ada mutasi yang menunggu persetujuan." yang kurang tepat untuk penyetuju.
3. Detail pegawai menghitung pinjaman hanya sebagai peminjam, belum sebagai penjamin; tabel pegawai belum menampilkan jumlah barang dipegang; belum ada filter `guarantorEmployeeId`.
4. Dialog catat kondisi: bila unggah foto gagal setelah log dibuat, percobaan ulang membuat log kedua.
5. `returnedAt` menerima waktu di masa depan.
6. Tombol "Batalkan" di tabel mutasi disembunyikan untuk penyetuju meski backend dan halaman detail mengizinkannya.
7. Parameter `actor` tidak dipakai di `LoansService.update`; catatan persetujuan kosong disimpan sebagai `''`.
8. Tautan ke `/employees/[id]` hanya untuk pemegang `employees.manage`, padahal rutenya cukup `master_data.view`.

Hal yang reviewer kesampingkan dan diterima apa adanya: pinjaman pada status `DISPOSED`/`MISSING`/`UNDER_MAINTENANCE` (alur Tahap 4), mutasi Admin tanpa persetujuan kedua (keputusan pemilik), unit kerja barang independen, migrasi menghapus `responsible_user_id` tanpa migrasi data (hanya data uji).

---

## 11. Langkah berikutnya: Tahap 4

Sesuai blueprint: stock opname (sesi, pemindaian, hasil sesuai/beda lokasi/beda kondisi/tidak ditemukan/tidak terdaftar), pemeliharaan (laporan kerusakan → perbaikan → selesai, biaya, teknisi), pelepasan barang (`DISPOSED`), dan halaman audit log yang lebih lengkap. Status `UNDER_MAINTENANCE`, `MISSING`, `DISPOSED` mulai dipakai di tahap itu.
