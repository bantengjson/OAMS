# OAMS Tahap 4 (Audit dan Maintenance) — Desain

Tanggal: 20 November 2026
Acuan: [docs/BLUEPRINT.md](../../BLUEPRINT.md) bab 3.5, 4.9, 4.10, 4.15, 6 (tabel 16–19), 7.6, 12 "Tahap 4". Dibangun di atas [Tahap 3](../../tahap-3-asset-operations.md).

## 1. Maksud

Kantor (satu kantor, home office DPC PDI Perjuangan, lokasi disembunyikan) bisa **memeriksa fisik seluruh barang secara berkala** (stock opname), **mengurus perbaikan** barang yang rusak (pemeliharaan), dan **melepas barang** dari inventaris (rusak total, hilang, dijual, dihibahkan), dengan semua kejadian tercatat di riwayat barang dan audit log.

Status barang `UNDER_MAINTENANCE`, `MISSING`, dan `DISPOSED` mulai dipakai di tahap ini, masing-masing hanya oleh alurnya sendiri.

## 2. Tujuan

- Stock opname: sesi, daftar barang yang harus ditemukan (snapshot saat sesi dibuat), pemindaian QR/ketik kode oleh petugas, konfirmasi kondisi, satu barang sekali per sesi, penutupan sesi, laporan per kategori, penerapan kondisi berbeda oleh Admin.
- Pemeliharaan: laporan kerusakan → dikerjakan → selesai/dibatalkan, teknisi, biaya, catatan, foto, tanggal; status barang mengikuti.
- Pelepasan barang: oleh Admin, dengan alasan, tanggal, keterangan, nilai/penerima opsional, dokumen opsional; bisa dibatalkan dengan alasan.
- Pengaman status lintas alur: pinjam, mutasi, pemeliharaan, pelepasan, arsip, dan ubah status saling mengunci dengan aturan yang sama dan pembaruan bersyarat (menutup temuan Minor Tahap 3 tentang balapan lintas alur).
- Riwayat barang, audit log, dan dashboard menampilkan kejadian baru.

## 3. Bukan tujuan

- Lokasi dalam stock opname (kategori "lokasi berbeda", "menentukan lokasi pemeriksaan"): lokasi disembunyikan untuk kantor tunggal.
- Persetujuan berjenjang untuk pelepasan atau pemeliharaan.
- Penjadwalan opname berkala otomatis, notifikasi e-mail/push.
- Laporan PDF/Excel opname (Tahap 5; laporan tampil di layar dan bisa dicetak dari browser).
- Penandaan otomatis barang tidak ditemukan sebagai `Hilang`.
- Pemindaian offline.

## 4. Anti-tujuan

- Opname yang mengubah data barang tanpa keputusan Admin.
- Barang `Dihapuskan` yang masih bisa dipinjam, dimutasi, diperbaiki, atau dihitung di opname.
- Barang yang sedang dipinjam dihitung "tidak ditemukan".
- Dua alur yang mengubah status barang bersamaan sehingga status akhir salah (mis. barang dipinjam sekaligus diperbaiki).

## 5. Keputusan yang disetujui pemilik (20 Nov 2026)

1. Ringkasan Tahap 4 di atas (stock opname, pemeliharaan, pelepasan, audit log cukup ditambah label).
2. Alur stock opname usulan: sesi oleh Admin, snapshot barang aktif, pemindaian petugas dengan konfirmasi kondisi, tidak terdaftar, tutup sesi, laporan; hasil tidak otomatis mengubah barang, "terapkan kondisi" per barang oleh Admin; tidak ditemukan tidak otomatis Hilang; barang dipinjam dipisahkan.
3. Pelepasan langsung oleh Admin tanpa pengajuan, isian dan aturan seperti bagian 8.3, bisa dibatalkan.
4. Alur pemeliharaan Dilaporkan → Dikerjakan → Selesai/Dibatalkan, barang `Dalam perbaikan` selama dikerjakan.
5. Pendekatan: satu tabel per fitur mengikuti pola Tahap 3.

## 6. Pendekatan

| Pendekatan | Keputusan |
|---|---|
| **A. Tabel per fitur (`stock_opnames`, `stock_opname_items`, `maintenance_records`, `asset_disposals`), riwayat dari audit log** | **Dipilih**, sama dengan Tahap 3; laporan Tahap 5 membaca kolom rapi |
| B. Tabel kejadian umum | Ditolak di Tahap 3 karena aturan unik dan laporan |

## 7. Model data

### 7.1 `stock_opnames`

| Kolom | Keterangan |
|---|---|
| id, name (varchar 150), notes | |
| status | enum `OpnameStatus`: `OPEN`, `CLOSED`, `CANCELLED` |
| planned_date | date |
| created_by_id, created_at | |
| closed_by_id, closed_at | |
| cancelled_at | |

Petugas yang ditunjuk: tabel penghubung `stock_opname_officers (opname_id, user_id)`; boleh kosong (= semua pemegang `stock_opnames.execute`). **Hanya satu sesi `OPEN` pada satu waktu** (indeks unik parsial), karena satu kantor.

### 7.2 `stock_opname_items`

Satu baris per barang dalam snapshot, ditambah baris tanpa barang untuk pemindaian tidak terdaftar.

| Kolom | Keterangan |
|---|---|
| id, opname_id | |
| asset_id | null untuk tidak terdaftar |
| expected_condition | kondisi barang saat snapshot |
| expected_status | status saat snapshot (untuk menandai `BORROWED`) |
| scanned_at, scanned_by_id | null = belum dipindai |
| observed_condition | kondisi yang dikonfirmasi petugas |
| result | enum `OpnameResult`: `PENDING`, `MATCHED`, `CONDITION_DIFFERS`, `NOT_FOUND`, `UNREGISTERED`, `ON_LOAN`, `IN_MAINTENANCE`, `REMOVED` (lihat bagian 13) |
| raw_value | teks hasil pindai/ketik, untuk tidak terdaftar |
| note | |
| condition_applied_at, condition_log_id | saat Admin menerapkan kondisi |

Unik `(opname_id, asset_id)` (baris tidak terdaftar memiliki `asset_id` null, tidak terkena). Snapshot memuat semua barang aktif non-arsip yang statusnya bukan `DISPOSED`; barang `BORROWED` saat snapshot langsung `ON_LOAN` tetapi tetap boleh dipindai (bila dipindai menjadi `MATCHED`/`CONDITION_DIFFERS`). Barang yang dibuat setelah sesi dibuka tidak ikut; bila dipindai, dicatat `UNREGISTERED` dengan catatan "terdaftar setelah sesi dibuka" (keputusan builder: kasus jarang, laporan tetap jujur).

### 7.3 `maintenance_records`

| Kolom | Keterangan |
|---|---|
| id, asset_id | |
| status | enum `MaintenanceStatus`: `REPORTED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` |
| description | kerusakan, wajib |
| reported_by_id, reported_at | |
| technician | varchar 150, teknisi/bengkel |
| started_at, started_by_id | |
| completed_at, completed_by_id | |
| cost | decimal(15,2) |
| technician_notes | |
| result_condition | `AssetCondition` setelah perbaikan |
| previous_status | status barang sebelum `IN_PROGRESS` |
| cancelled_at, cancel_reason | |

Satu pemeliharaan terbuka (`REPORTED` atau `IN_PROGRESS`) per barang (indeks unik parsial). Foto: `asset_photos.maintenance_id` (opsional), pola sama dengan `condition_log_id`.

### 7.4 `asset_disposals`

| Kolom | Keterangan |
|---|---|
| id, asset_id | |
| reason | enum `DisposalReason`: `BROKEN`, `LOST`, `SOLD`, `DONATED`, `OTHER` |
| disposed_at | date |
| description | wajib |
| value | decimal(15,2) opsional (nilai jual) |
| recipient | varchar 150 opsional (pembeli/penerima hibah) |
| previous_status | |
| disposed_by_id, created_at | |
| reverted_at, reverted_by_id, revert_reason | pembatalan |

Satu pelepasan aktif (belum dibatalkan) per barang (indeks unik parsial). Dokumen pendukung memakai `asset_documents` yang sudah ada dengan kolom baru `disposal_id` opsional.

## 8. Endpoint backend

### 8.1 Stock opname (`/stock-opnames`)

| Metode | Path | Permission | Catatan |
|---|---|---|---|
| GET | `/stock-opnames` | `stock_opnames.execute` atau `stock_opnames.manage` | daftar sesi dengan ringkasan hitungan |
| POST | `/stock-opnames` | `stock_opnames.manage` | `{name, plannedDate, notes?, officerIds?}`; snapshot dibuat dalam transaksi; 409 bila masih ada sesi `OPEN` |
| GET | `/stock-opnames/:id` | execute/manage | detail + hitungan per hasil |
| GET | `/stock-opnames/:id/items?result=&search=` | execute/manage | daftar baris |
| POST | `/stock-opnames/:id/scan` | `stock_opnames.execute` | `{value}` (URL QR, token, atau kode inventaris) → baris yang cocok + data barang ringkas; tidak mengubah apa pun selain mencatat bahwa barang ditemukan bila belum |
| POST | `/stock-opnames/:id/items/:itemId/confirm` | `stock_opnames.execute` | `{observedCondition, note?}` → hasil `MATCHED`/`CONDITION_DIFFERS` |
| POST | `/stock-opnames/:id/close` | `stock_opnames.manage` | baris `PENDING` → `NOT_FOUND` (kecuali `ON_LOAN` yang tetap) |
| POST | `/stock-opnames/:id/cancel` | `stock_opnames.manage` | hanya `OPEN` |
| POST | `/stock-opnames/:id/items/:itemId/apply-condition` | `stock_opnames.manage` | hanya sesi `CLOSED`, hasil `CONDITION_DIFFERS`, barang belum arsip/dilepas; mencatat pemeriksaan kondisi (sumber baru `OPNAME`) |
| GET | `/stock-opnames/:id/report` | execute/manage | ringkasan + daftar per kategori, siap cetak |

Bila sesi menunjuk petugas, hanya petugas itu (dan pemegang `manage`) yang boleh scan/confirm. Scan barang yang sudah dipindai mengembalikan baris yang sama dengan penanda `alreadyScanned: true` (bukan galat), agar petugas tahu sudah dihitung. Sesi bukan `OPEN` → 409.

### 8.2 Pemeliharaan (`/maintenance`)

| Metode | Path | Permission | Catatan |
|---|---|---|---|
| GET | `/maintenance` | `assets.view` | filter `status`, `assetId`, `search` |
| GET | `/maintenance/:id` | `assets.view` | |
| POST | `/maintenance` | `maintenance.report` | `{assetId, description}`; 409 bila sudah ada yang terbuka, barang arsip/dilepas |
| POST | `/maintenance/:id/start` | `maintenance.manage` | `{technician?, startedAt?}`; barang harus tidak dipinjam dan tanpa mutasi menunggu; simpan `previous_status`, status barang → `UNDER_MAINTENANCE` |
| POST | `/maintenance/:id/complete` | `maintenance.manage` | `{completedAt?, cost?, technicianNotes?, resultCondition?}`; status barang dipulihkan (fallback `AVAILABLE` bila `previous_status` tidak sah); kondisi dicatat bila diisi (sumber baru `MAINTENANCE`) |
| POST | `/maintenance/:id/cancel` | `maintenance.manage` | `{reason}`; bila sedang dikerjakan, status barang dipulihkan |
| POST | `/assets/:id/photos` | | menerima `maintenanceId` dengan aturan sama seperti `conditionLogId` (pelapor dengan `maintenance.report`) |

### 8.3 Pelepasan (`/disposals`)

| Metode | Path | Permission | Catatan |
|---|---|---|---|
| GET | `/disposals` | `assets.view` | filter `reason`, `search`, `includeReverted` |
| GET | `/disposals/:id` | `assets.view` | |
| POST | `/disposals` | `disposals.manage` (baru) | `{assetId, reason, disposedAt, description, value?, recipient?}`; 409 bila dipinjam, mutasi menunggu, pemeliharaan terbuka, sudah dilepas, atau arsip; status barang → `DISPOSED` (semua alasan, termasuk `LOST`), QR dinonaktifkan |
| POST | `/disposals/:id/revert` | `disposals.manage` | `{reason}`; status barang dipulihkan, QR diaktifkan kembali |
| POST | `/assets/:id/documents` | | menerima `disposalId` opsional |

### 8.4 Perubahan lintas modul

- Satu pengaman bersama `AssetStateGuard` dipakai pinjam, mutasi, pemeliharaan, pelepasan, arsip, dan PATCH status: memeriksa arsip, pinjaman aktif, mutasi menunggu, pemeliharaan dikerjakan, dan pelepasan aktif, lalu menulis perubahan status dengan `updateMany` bersyarat pada status yang diharapkan (409 bila kalah balapan).
- Pinjaman dan mutasi menolak barang `UNDER_MAINTENANCE`, `MISSING`, `DISPOSED` (keputusan yang ditunda dari Tahap 3).
- `PATCH /assets/:id` menolak `UNDER_MAINTENANCE`, `MISSING`, `DISPOSED` seperti `BORROWED`/`RETURNED` ("Status ini diatur oleh pemeliharaan/pelepasan").
- Daftar inventaris menyembunyikan barang `DISPOSED` kecuali filter status dipilih atau "tampilkan arsip/dilepas" dicentang; statistik menghitung barang dilepas terpisah (`disposed`).
- Sumber kondisi baru: `OPNAME`, `MAINTENANCE`.
- `GET /assets/:id/history` menambah modul `stock_opnames`, `maintenance`, `disposals`. `GET /assets/statistics` menambah `openMaintenance`, `inMaintenance`, `disposed`, `openOpname` (id + progres atau null).

### 8.5 Audit (aksi baru)

`opname.created|closed|cancelled` (entityId = id sesi), `opname.scanned|confirmed|unregistered` (entityId = id barang bila ada), `opname.condition_applied`; `maintenance.reported|started|completed|cancelled`; `disposal.created|reverted`. Semua yang menyangkut barang memakai `entityId` = id barang.

## 9. Permission

| Kode | Super Admin | Admin | Petugas | Viewer |
|---|---|---|---|---|
| `stock_opnames.manage` (ada) | ✓ | ✓ | – | – |
| `stock_opnames.execute` (ada) | ✓ | ✓ | ✓ | – |
| `maintenance.manage` (ada) | ✓ | ✓ | – | – |
| `maintenance.report` (ada) | ✓ | ✓ | ✓ | – |
| `disposals.manage` (baru) | ✓ | ✓ | – | – |

Daftar dan detail pemeliharaan serta pelepasan dibaca dengan `assets.view` (bagian dari riwayat barang).

## 10. Aplikasi web

Menu baru di bagian Inventaris: **Stock Opname** (`/stock-opnames`), **Pemeliharaan** (`/maintenance`), **Pelepasan** (`/disposals`).

- `/stock-opnames`: daftar sesi (nama, tanggal, status, progres "34/41"), tombol "Buat sesi" (Admin). `/stock-opnames/[id]`: untuk sesi terbuka, panel pemindai (kamera memakai komponen pemindai Tahap 2 + input ketik kode), kartu barang terakhir dengan pilihan kondisi dan Simpan, daftar "belum ditemukan" dan "sudah dipindai"; tombol Tutup sesi/Batalkan (Admin). Untuk sesi tertutup: laporan per kategori dengan tombol "Terapkan kondisi" per baris berbeda dan tombol Cetak.
- `/maintenance`: tab Dilaporkan | Dikerjakan | Selesai | Semua; formulir lapor kerusakan (pemilih barang, deskripsi, foto); detail dengan tombol Mulai/Selesaikan/Batalkan.
- `/disposals`: daftar; formulir pelepasan dengan konfirmasi tegas ("barang akan keluar dari inventaris aktif"); detail dengan tombol Batalkan pelepasan.
- Detail barang: tombol "Lapor kerusakan" (`maintenance.report`) dan "Lepaskan barang" (`disposals.manage`), banner "Sedang diperbaiki" / "Barang sudah dilepas", tab **Pemeliharaan**, label riwayat baru.
- Dashboard: kartu "Dalam perbaikan", "Laporan kerusakan baru", dan progres opname terbuka.

## 11. Pengujian

- E2E: alur opname lengkap (snapshot, scan by URL/token/kode, sekali per sesi, tidak terdaftar, barang dipinjam, tutup → tidak ditemukan, terapkan kondisi, petugas tidak ditunjuk ditolak, satu sesi terbuka), pemeliharaan (status barang ikut, pemulihan, satu terbuka per barang, konflik dengan pinjaman/mutasi), pelepasan (status, QR nonaktif, pembatalan memulihkan, konflik), balapan lintas alur (pinjam vs mulai perbaikan vs lepas serentak: tepat satu berhasil, status akhir konsisten).
- Unit: pengurai nilai pindai (URL/token/kode), kalkulasi ringkasan opname, skema formulir.
- Browser: setiap halaman baru, termasuk opname di lebar layar HP.

## 12. Deployment

Migrasi Prisma baru; seed menambah `disposals.manage` ke Super Admin dan Admin. Tidak ada variabel lingkungan baru.

## 13. Keputusan builder setelah pemeriksaan independen

Pemeriksa independen membaca dokumen ini sebagai calon pembangun. Enam pertanyaannya diputuskan sebagai berikut; semuanya bisa dikoreksi pemilik.

1. **Pelepasan selalu berstatus `DISPOSED`**, termasuk alasan `LOST`. Alasan hilang tercatat di `asset_disposals.reason`; status `MISSING` tidak dipakai di Tahap 4. Semua penyaring (snapshot opname, daftar inventaris, statistik) cukup memeriksa status `DISPOSED`. Bagian 8.3 diperbarui sesuai keputusan ini.
2. **Hasil opname dinilai terhadap keadaan barang saat sesi ditutup**, bukan saat snapshot. Saat penutupan, baris `PENDING` menjadi:
   - `ON_LOAN` bila barang sedang punya pinjaman aktif;
   - `IN_MAINTENANCE` (nilai `OpnameResult` baru) bila barang sedang punya pemeliharaan `IN_PROGRESS`;
   - `REMOVED` (nilai baru) bila barang sudah diarsipkan atau dilepas selama sesi; baris ini tidak dihitung di ringkasan;
   - `NOT_FOUND` untuk sisanya.

   Alur lain tidak dikunci selama sesi terbuka.
3. **Memindai berarti ditemukan.** Pemindaian langsung menyetel hasil `MATCHED` dengan kondisi yang diharapkan sebagai kondisi teramati. Konfirmasi kondisi bersifat opsional dan boleh diulang selama sesi terbuka; kondisi yang berbeda menjadi `CONDITION_DIFFERS`. "Sekali per sesi" berarti baris unik per barang dan pindaian ulang tidak menambah hitungan.
4. **Status yang diatur alur ditolak di input manual.** Server tidak punya barang berstatus `UNDER_MAINTENANCE`, `MISSING`, atau `DISPOSED` (dicek 20 Nov 2026), jadi tidak perlu migrasi data. `POST /assets` dan `PATCH /assets/:id` sama-sama menolak ketiga status itu, dengan pesan "Status ini diatur oleh pemeliharaan/pelepasan".
5. **QR saat barang dilepas:**
   - Pelepasan menyimpan status aktif label sebelumnya (`asset_disposals.label_was_active`); pembatalan hanya mengaktifkan kembali bila sebelumnya aktif.
   - Selama pelepasan aktif, `setActive`, `regenerate`, dan `bulkGenerate` menolak barang itu (409 `Barang sudah dilepas.`; pada cetak massal barang dilewati seperti barang arsip).
   - Halaman QR publik tetap 404 "QR tidak aktif", karena label nonaktif dan tidak ada informasi yang perlu dibuka ke publik.
6. **"Laporan per kategori" berarti kategori hasil opname** (sesuai, kondisi berbeda, tidak ditemukan, tidak terdaftar, dipinjam, dalam perbaikan), bukan kategori barang. Pengelompokan per kategori barang menjadi bagian laporan Tahap 5.

## 14. Diserahkan ke builder

- Nama file dan pembagian modul, bentuk DTO ringkas.
- Rincian tampilan, teks bantuan, urutan kolom.
- Cara mencocokkan nilai pindai dengan barang (memakai pengurai `scan.ts` Tahap 2 di frontend dan pencocokan token/kode di backend).
