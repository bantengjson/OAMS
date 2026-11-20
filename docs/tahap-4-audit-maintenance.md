# OAMS Tahap 4 — Audit dan Maintenance

Dokumen ini merangkum apa yang dibangun pada Tahap 4, bagaimana memakainya, keputusan yang diambil, dan apa yang belum. Dibaca bersama [docs/tahap-3-asset-operations.md](tahap-3-asset-operations.md), [docs/tahap-2-core-assets.md](tahap-2-core-assets.md), [docs/tahap-1-foundation.md](tahap-1-foundation.md), dan [docs/BLUEPRINT.md](BLUEPRINT.md).

Desain: [docs/superpowers/specs/2026-11-20-oams-tahap4-audit-maintenance-design.md](superpowers/specs/2026-11-20-oams-tahap4-audit-maintenance-design.md). Rencana implementasi: [docs/superpowers/plans/2026-11-20-oams-tahap4-audit-maintenance.md](superpowers/plans/2026-11-20-oams-tahap4-audit-maintenance.md).

---

## 1. Ringkasan

Tahap 4 membuat kantor bisa **memeriksa fisik seluruh barang**, **mengurus perbaikan**, dan **melepas barang** dari inventaris, dengan setiap kejadian tercatat di riwayat barang:

- **Stock opname**: Admin membuka sesi; saat itu semua barang aktif dicatat sebagai daftar yang harus ditemukan. Petugas memindai stiker QR (kamera HP) atau mengetik kode barang; barang yang dipindai langsung dihitung "Sesuai", dan kondisi yang berbeda bisa dicatat. Pindaian ulang tidak menambah hitungan. Saat sesi ditutup, barang yang belum dipindai dinilai otomatis: sedang dipinjam, sedang diperbaiki, sudah diarsipkan/dilepas (tidak dihitung), atau **tidak ditemukan**. Laporan dikelompokkan per hasil dan bisa dicetak; kondisi yang berbeda diterapkan ke barang per baris oleh Admin.
- **Pemeliharaan**: siapa pun dengan izin melapor kerusakan (deskripsi + foto). Admin memulai perbaikan (teknisi, tanggal) sehingga barang berstatus **Dalam perbaikan**, lalu menyelesaikan (biaya, catatan teknisi, kondisi setelah perbaikan) atau membatalkan dengan alasan. Status barang dipulihkan seperti sebelum diperbaiki.
- **Pelepasan barang**: Admin melepas barang (rusak total, hilang, dijual, dihibahkan, lainnya) dengan tanggal, keterangan, nilai jual dan penerima opsional, serta dokumen pendukung. Barang menjadi **Dihapuskan**, QR-nya nonaktif, dan barang hilang dari daftar inventaris aktif. Pelepasan yang keliru bisa dibatalkan dengan alasan; status dan QR dipulihkan.
- **Pengaman lintas alur**: pinjam, mutasi, pemeliharaan, pelepasan, arsip, dan ubah status kini memakai satu aturan yang sama dan pembaruan bersyarat, sehingga dua alur yang berjalan bersamaan pada satu barang tidak bisa sama-sama berhasil (menutup temuan Minor #1 Tahap 3).
- **Riwayat barang, dashboard**: label riwayat untuk semua aksi baru; kartu dashboard "Dilepas" (ikut dihitung di Total barang: Total = Aktif + Diarsipkan + Dilepas), "Dalam perbaikan", "Laporan kerusakan baru", dan "Stock opname berjalan".

Yang **bukan** bagian Tahap 4 (sesuai desain): lokasi dalam opname (lokasi disembunyikan), persetujuan berjenjang untuk pelepasan/pemeliharaan, penjadwalan opname otomatis, notifikasi, laporan PDF/Excel (Tahap 5; laporan opname tampil di layar dan dicetak dari browser), penandaan otomatis "Hilang" untuk barang tidak ditemukan, pemindaian offline.

---

## 2. Model data baru

Migrasi: `backend/prisma/migrations/20261120055428_tahap4_audit_maintenance`.

| Tabel | Isi |
|---|---|
| `stock_opnames` | `name`, `notes`, `status` `OPEN|CLOSED|CANCELLED`, `planned_date`, `created_by_id`, `closed_by_id`, `closed_at`, `cancelled_at` |
| `stock_opname_officers` | petugas yang ditunjuk per sesi (kosong = semua pemegang `stock_opnames.execute`) |
| `stock_opname_items` | satu baris per barang per sesi (unik `opname_id + asset_id`): `expected_condition`, `expected_status`, `observed_condition`, `result`, `scanned_at`, `scanned_by_id`, `raw_value`, `note`, `condition_applied_at` |
| `maintenance_records` | `status` `REPORTED|IN_PROGRESS|COMPLETED|CANCELLED`, `description`, `reported_by_id`, `reported_at`, `technician`, `started_at`, `completed_at`, `cost`, `technician_notes`, `result_condition`, `previous_status`, `cancel_reason` |
| `asset_disposals` | `reason` `BROKEN|LOST|SOLD|DONATED|OTHER`, `disposed_at` (date), `description`, `value`, `recipient`, `previous_status`, `label_was_active`, `disposed_by_id`, `reverted_at`, `reverted_by_id`, `revert_reason` |

Hasil baris opname (`result`): `PENDING` (belum dipindai), `MATCHED` (sesuai), `CONDITION_DIFFERS`, `NOT_FOUND`, `UNREGISTERED` (dipindai tetapi tidak ada di daftar sesi: kode tak dikenal, barang yang didaftarkan setelah sesi dibuka, diarsipkan, atau dilepas), `ON_LOAN`, `IN_MAINTENANCE`, `REMOVED` (diarsipkan/dilepas selama sesi; tidak dihitung).

Perubahan tabel lama: `asset_photos.maintenance_id` (foto kerusakan), `asset_documents.disposal_id` (dokumen pelepasan); sumber kondisi baru `OPNAME` dan `MAINTENANCE`.

Aturan basis data yang dijaga lewat SQL di migrasi:

- `stock_opnames_one_open`: hanya satu sesi berstatus `OPEN`.
- `maintenance_one_open (asset_id) WHERE status IN ('REPORTED','IN_PROGRESS')`: satu pemeliharaan terbuka per barang.
- `asset_disposals_one_active (asset_id) WHERE reverted_at IS NULL`: satu pelepasan aktif per barang.

---

## 3. Endpoint backend

Semua di bawah `/api/v1`; format respons dan error sama seperti tahap sebelumnya. Permission dalam kurung.

### 3.1 Stock opname (`/stock-opnames`)

| Metode | Path | Permission | Keterangan |
|---|---|---|---|
| GET | `/stock-opnames` | `stock_opnames.execute` atau `.manage` | terbaru dulu; setiap sesi membawa `counts` per hasil, `total`, `scanned` |
| GET | `/stock-opnames/:id` | idem | |
| GET | `/stock-opnames/:id/items` | idem | filter `result`, `search`; `pageSize` default 500, maks 2000 |
| GET | `/stock-opnames/:id/report` | idem | `groups` per hasil (`MATCHED`, `CONDITION_DIFFERS`, `NOT_FOUND`, `UNREGISTERED`, `ON_LOAN`, `IN_MAINTENANCE`) |
| POST | `/stock-opnames` | `stock_opnames.manage` | `{name, plannedDate, notes?, officerIds?}`; snapshot semua barang aktif (bukan arsip, bukan `DISPOSED`); sesi kedua saat masih ada yang terbuka → 409 `Masih ada sesi stock opname yang terbuka.` |
| POST | `/stock-opnames/:id/scan` | `stock_opnames.execute` | `{value}`: alamat QR lengkap, token, atau kode barang; hasil `{item, alreadyScanned}` |
| POST | `/stock-opnames/:id/items/:itemId/confirm` | `stock_opnames.execute` | `{observedCondition, note?}`; boleh diulang selama sesi terbuka |
| POST | `/stock-opnames/:id/close` | `stock_opnames.manage` | menilai baris `PENDING` (lihat 1) |
| POST | `/stock-opnames/:id/cancel` | `stock_opnames.manage` | |
| POST | `/stock-opnames/:id/items/:itemId/apply-condition` | `stock_opnames.manage` | hanya sesi `CLOSED` dan baris `CONDITION_DIFFERS`; menulis log kondisi `OPNAME`; sekali per baris |

Petugas yang tidak ditunjuk pada sesi dengan daftar petugas → 403 `Anda bukan petugas sesi ini.` Memindai/mengonfirmasi pada sesi yang tidak terbuka → 409 `Sesi stock opname sudah ditutup.`

### 3.2 Pemeliharaan (`/maintenance`)

| Metode | Path | Permission | Keterangan |
|---|---|---|---|
| GET | `/maintenance` | `assets.view` | filter `status`, `assetId`, `search` |
| GET | `/maintenance/:id` | `assets.view` | termasuk foto |
| POST | `/maintenance` | `maintenance.report` | `{assetId, description}`; foto diunggah sesudahnya ke `POST /assets/:id/photos` dengan `maintenanceId`; laporan kedua yang masih terbuka → 409 `Sudah ada laporan pemeliharaan yang terbuka untuk barang ini.` |
| POST | `/maintenance/:id/start` | `maintenance.manage` | `{technician?, startedAt?}`; barang menjadi `UNDER_MAINTENANCE` lewat pengaman bersama (dipinjam/mutasi menunggu/dilepas → 409) |
| POST | `/maintenance/:id/complete` | `maintenance.manage` | `{completedAt?, cost?, technicianNotes?, resultCondition?}`; status dipulihkan (status alur → `AVAILABLE`); `resultCondition` menulis log kondisi `MAINTENANCE` |
| POST | `/maintenance/:id/cancel` | `maintenance.manage` | `{reason}`; bila sedang dikerjakan, status dipulihkan |

### 3.3 Pelepasan (`/disposals`)

| Metode | Path | Permission | Keterangan |
|---|---|---|---|
| GET | `/disposals` | `assets.view` | filter `reason`, `search`, `includeReverted` |
| GET | `/disposals/:id` | `assets.view` | termasuk dokumen |
| POST | `/disposals` | `disposals.manage` | `{assetId, reason, disposedAt, description, value?, recipient?}`; `disposedAt` tidak boleh melewati hari ini (Asia/Jakarta); barang dipinjam/diperbaiki/mutasi menunggu/arsip → 409; laporan kerusakan yang masih `REPORTED` ikut dibatalkan ("Barang dilepas"); QR dinonaktifkan dan status aktif sebelumnya disimpan |
| POST | `/disposals/:id/revert` | `disposals.manage` | `{reason}`; status dipulihkan, QR diaktifkan kembali **hanya** bila sebelumnya aktif; kedua kali → 409 `Pelepasan sudah dibatalkan.` |

### 3.4 Perubahan lintas modul

- `AssetStateGuard` (`backend/src/modules/assets/asset-state.guard.ts`) dipakai pinjam, mutasi, pemeliharaan, pelepasan, arsip, dan ubah status: memeriksa arsip, pelepasan aktif, pinjaman aktif, perbaikan berjalan, mutasi menunggu, lalu mengubah status dengan `updateMany` bersyarat pada status yang diharapkan. Yang kalah balapan mendapat 409 `Barang sudah berubah, muat ulang lalu coba lagi.`
- `POST /assets` dan `PATCH /assets/:id` menolak status `UNDER_MAINTENANCE`, `MISSING`, `DISPOSED` (`Status ini diatur oleh pemeliharaan/pelepasan`).
- QR: aktifkan/buat ulang menolak barang yang dilepas (409 `Barang sudah dilepas.`); cetak massal melewatinya; halaman QR publik barang yang dilepas 404.
- `GET /assets` menyembunyikan barang `DISPOSED` kecuali filter status dipilih atau arsip ikut ditampilkan. `GET /assets/:id` menambah `openMaintenance` dan `activeDisposal`.
- `GET /assets/statistics`: `total = aktif + diarsipkan + dilepas`; tambahan `disposed`, `openMaintenance` (laporan baru), `inMaintenance` (sedang dikerjakan), `openOpname` (`{id, name, scanned, total}` atau null).
- `GET /assets/:id/history` menambah modul `stock_opnames`, `maintenance`, `disposals`.

---

## 4. Permission

Seed memberi permission baru ke role yang sudah ada saat backend start.

| Kode | Super Admin | Admin Inventaris | Petugas | Viewer |
|---|---|---|---|---|
| `stock_opnames.manage` | ✓ | ✓ | – | – |
| `stock_opnames.execute` | ✓ | ✓ | ✓ | – |
| `maintenance.manage` | ✓ | ✓ | – | – |
| `maintenance.report` | ✓ | ✓ | ✓ | – |
| `disposals.manage` (baru) | ✓ | ✓ | – | – |

Daftar dan detail pemeliharaan serta pelepasan dibaca dengan `assets.view`.

---

## 5. Aplikasi web

Menu baru di bagian Inventaris: **Stock Opname** (`/stock-opnames`), **Pemeliharaan** (`/maintenance`), **Pelepasan** (`/disposals`).

- **Stock opname** `/stock-opnames`: daftar sesi (nama, tanggal, status, progres "34/41"), tombol "Buka sesi" (Admin) dengan nama, tanggal, catatan, dan pilihan petugas. `/stock-opnames/[id]` (dirancang untuk HP): panel pemindai di atas (kamera + input kode), kartu barang terakhir dengan pilihan kondisi dan **Simpan**, pemberitahuan "Sudah dihitung pada …" untuk pindaian ulang, penghitung dan progres, tab **Belum dipindai | Sudah dipindai | Tidak terdaftar** dengan pencarian; Admin: **Tutup sesi** / **Batalkan**. Sesi yang selesai menampilkan ringkasan dan tombol **Lihat laporan**. `/stock-opnames/[id]/report`: per kelompok hasil dengan jumlah dan baris, tombol **Terapkan kondisi** pada baris kondisi berbeda, tombol **Cetak**.
- **Pemeliharaan** `/maintenance`: tab Dilaporkan | Dikerjakan | Selesai | Dibatalkan | Semua (bisa dibuka lewat `?status=`), pencarian, tombol Mulai / Selesaikan / Batalkan, dialog lapor kerusakan dengan foto. `/maintenance/[id]`: rincian, foto, aksi.
- **Pelepasan** `/disposals`: daftar dengan filter alasan dan "tampilkan yang dibatalkan". `/disposals/new?assetId=`: formulir dengan konfirmasi tegas. `/disposals/[id]`: rincian, dokumen pendukung (unggah/unduh), **Batalkan pelepasan**.
- **Detail barang**: tombol **Lapor kerusakan** dan **Lepaskan** (nonaktif dengan keterangan bila barang dipinjam/diperbaiki), pinjam dan mutasi nonaktif selama diperbaiki, tombol Ubah disembunyikan untuk barang yang dilepas; banner "Ada laporan kerusakan" / "Sedang diperbaiki" / "Barang sudah dilepas"; tab baru **Pemeliharaan**; label riwayat baru. Formulir barang tidak menawarkan status Dalam perbaikan / Hilang / Dihapuskan.
- **Dashboard**: kartu **Dilepas** (jumlah barang yang sudah dilepas, ikut dihitung di Total barang; → `/disposals` untuk melihat barangnya), kartu Dalam perbaikan (→ `/maintenance?status=IN_PROGRESS`), Laporan kerusakan baru (→ `/maintenance?status=REPORTED`), dan Stock opname berjalan (progres, → sesi) bila ada sesi terbuka. Kartu jumlah lokasi dihapus karena lokasi disembunyikan.

---

## 6. Riwayat dan audit

Aksi baru: `opname.created|closed|cancelled` (entityId = id sesi), `opname.scanned|confirmed|unregistered|condition_applied` (entityId = id barang bila ada), `maintenance.reported|started|completed|cancelled`, `disposal.created|reverted`, serta `asset.condition_recorded` dari penerapan kondisi opname dan penyelesaian perbaikan. Semua yang menyangkut barang memakai `entityId` = id barang sehingga muncul di tab Riwayat.

---

## 7. Pengujian

- Backend e2e (PostgreSQL asli): `asset-state` (permintaan serentak: pinjam vs arsip, pinjam vs ubah status, pinjam vs mulai perbaikan — tepat satu berhasil), `stock-opnames` (snapshot, satu sesi terbuka, pindai lewat URL/token/kode tepat sekali, kondisi berbeda dan koreksinya, tidak terdaftar, petugas tidak ditunjuk dan Viewer ditolak, penutupan dengan barang dipinjam/diperbaiki/diarsipkan setelah snapshot, terapkan kondisi sekali, pembatalan, penutupan yang bersamaan dengan pindai dan konfirmasi), `maintenance` (alur lengkap, pemulihan status termasuk status alur → `AVAILABLE`, pembatalan saat dikerjakan, barang dipinjam ditolak), `disposals` (status, QR, daftar dan statistik, label yang sudah nonaktif tetap nonaktif, barang dipinjam/diperbaiki/arsip dan tanggal masa depan ditolak, laporan kerusakan ikut dibatalkan, pinjam vs pelepasan serentak).
- Unit: pengaman status bersama, pengurai nilai pindai, `opnameProgress`, skema formulir pelepasan, payload ubah barang tanpa status alur, item navigasi.
- Verifikasi penuh (`npm run lint && npm run build && npm test` di root) hijau; pemeriksaan browser untuk setiap halaman baru, termasuk stock opname di lebar 375 px.

---

## 8. Deployment dan operasional

- Migrasi `20261120055428_tahap4_audit_maintenance` berjalan otomatis saat backend start; seed menambahkan `disposals.manage` ke Super Admin dan Admin Inventaris. Di mesin pengembangan jalankan `npm run prisma:seed -w backend` sekali setelah migrasi.
- Tidak ada variabel lingkungan baru. Urutan: `git pull --ff-only && docker compose up -d --build`.
- Stock opname: hanya satu sesi terbuka pada satu waktu. Kamera HP memerlukan HTTPS; bila kamera tidak bisa dibuka, ketik kode dari stiker.
- Barang yang dilepas tidak bisa dipinjam, dimutasi, diperbaiki, atau dicetak QR-nya; batalkan pelepasan bila keliru.

---

## 9. Keputusan di luar atau melengkapi blueprint

| Topik | Keputusan | Alasan |
|---|---|---|
| Status pelepasan | Selalu `DISPOSED`, termasuk alasan hilang; `MISSING` tidak dipakai | Satu penyaring untuk opname, daftar, statistik; alasan tersimpan di pelepasan |
| Penilaian opname | Barang yang tidak dipindai dinilai terhadap keadaan saat sesi **ditutup** | Barang yang dipinjam/diperbaiki setelah snapshot tidak boleh dianggap tidak ditemukan |
| Memindai | Pindai = ditemukan dengan kondisi tercatat; konfirmasi kondisi opsional dan boleh diulang | Petugas cukup memindai untuk barang yang baik-baik saja |
| Hasil opname ke barang | Tidak otomatis; Admin menerapkan kondisi per baris | Anti-tujuan: opname tidak mengubah barang tanpa keputusan Admin |
| Lokasi dalam opname | Tidak ada | Kantor tunggal; lokasi disembunyikan |
| Laporan "per kategori" | Per kelompok hasil opname, bukan kategori barang | Pengelompokan per kategori barang menjadi bagian laporan Tahap 5 |
| QR saat dilepas | Nonaktif; pembatalan hanya mengaktifkan bila sebelumnya aktif | Label yang sengaja dinonaktifkan tidak boleh hidup lagi |
| Pelepasan dan laporan kerusakan | Laporan `REPORTED` ikut dibatalkan; perbaikan yang sedang dikerjakan harus diselesaikan/dibatalkan dulu | Tidak menyisakan laporan terbuka untuk barang yang sudah keluar |
| Ubah barang yang dilepas / diperbaiki | Tombol Ubah disembunyikan untuk barang yang dilepas; barang yang diperbaiki tetap bisa diubah, dengan status hanya-baca | Status diatur alurnya sendiri; pembatalan pelepasan adalah jalan kembali |
| Pelepasan dan laporan kerusakan baru | Laporan berstatus Dilaporkan ikut dibatalkan, bukan ditolak 409 (desain §8.3 diperbarui) | Alur alami Admin: laporan → "tidak layak diperbaiki" → lepaskan. Disetujui pemilik (20 Nov 2026) |
| Pemindai kamera | Nilai yang sama diabaikan selama masih terlihat kamera (jendela 3 detik bergeser); input ketik selalu dikirim | Memegang HP di depan stiker sambil memilih kondisi tidak memicu pindaian ulang |

---

## 10. Review akhir dan temuan yang ditunda

Review independen atas seluruh diff Tahap 4 (reviewer terpisah, model paling mampu) menilai: tidak ada temuan Critical; kelima fokus review (balapan pinjam/perbaikan/pelepasan, barang dipinjam/diperbaiki setelah snapshot, pindaian lewat URL/token/kode tepat sekali, label QR nonaktif tetap nonaktif setelah pembatalan, pemulihan status alur ke `AVAILABLE`) terpenuhi. Dua temuan Important diperbaiki dengan test regresi:

| # | Temuan | Perbaikan |
|---|---|---|
| I-1 | Barang yang sedang diperbaiki tidak bisa diubah: formulir mengirim balik status `Dalam perbaikan` dan ditolak | `toAssetUpdatePayload` membuang semua status alur; pilihan status terkunci dan menampilkan status alur saat ini dengan keterangan; unit test |
| I-2 | Menutup sesi opname bisa menimpa pindaian yang masuk bersamaan menjadi "Tidak ditemukan", dan konfirmasi kondisi bisa tertulis setelah sesi ditutup | Penutupan mengunci sesi lebih dulu dan hanya menilai baris yang masih belum dipindai; pindai/konfirmasi/tidak terdaftar memegang kunci baca atas sesi dan menolak sesi yang sudah ditutup; dua e2e yang menahan kunci baris untuk memaksa balapan |

Temuan Minor yang **ditunda**:

1. Mulai perbaikan dan pelepasan yang benar-benar bersamaan pada barang yang punya laporan kerusakan bisa saling mengunci (deadlock); data tetap konsisten tetapi satu pengguna mendapat error 500, bukan 409. Perbaikan: urutan kunci yang sama dan pemetaan error ke 409, plus test balapan khusus.
2. Setelah pelepasan, daftar pemeliharaan di layar tidak langsung diperbarui (laporan yang ikut dibatalkan tampil lama sampai dimuat ulang).
3. Laporan kerusakan yang dikirim tepat saat barang dilepas/diarsipkan, atau laporan yang sudah ada saat barang diarsipkan, tetap terbuka dan terhitung di kartu "Laporan kerusakan baru".
4. Pengajuan mutasi bisa dibuat bersamaan dengan pelepasan/perbaikan (persetujuannya nanti gagal dengan benar; Admin menolaknya manual).
5. Daftar inventaris: centang "Tampilkan barang yang diarsipkan" juga menampilkan barang dilepas, labelnya belum diperbarui.
6. Dialog lapor kerusakan: bila unggah foto gagal setelah laporan dibuat, mengirim ulang menghasilkan 409 dan foto tidak terlampir.
7. Tombol "Lepaskan" belum dinonaktifkan saat ada mutasi menunggu (ditolak backend setelah formulir diisi).
8. Setiap pindaian memuat ulang seluruh daftar barang sesi; terasa di HP lewat koneksi lambat bila barang ratusan.
9. Tanggal mulai/selesai perbaikan belum divalidasi terhadap satu sama lain dan masa depan; log kondisi setelah perbaikan bertanggal hari ini, bukan tanggal selesai.
10. Pelepasan yang tepat bersamaan dengan mengaktifkan QR bisa menyisakan label aktif (jendela sangat sempit).

Hal yang reviewer kesampingkan dan diterima apa adanya: lokasi disembunyikan, petugas yang ditunjuk tanpa izin pemindaian, stiker lama setelah QR dibuat ulang terbaca "tidak terdaftar", batas 2000 baris per sesi, arsip atas barang yang dilepas, API catat kondisi pada barang dilepas (UI menyembunyikannya).

---

## 11. Langkah berikutnya: Tahap 5

Sesuai blueprint: laporan dan ekspor (PDF/Excel), termasuk laporan opname per kategori barang, rekap pemeliharaan dan biaya, daftar barang dilepas, serta halaman audit log yang lebih lengkap.
