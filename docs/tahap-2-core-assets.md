# OAMS Tahap 2 — Core Asset Management

Dokumen ini merangkum apa yang dibangun pada Tahap 2, bagaimana memakainya, keputusan yang diambil, dan apa yang belum. Dibaca bersama [docs/tahap-1-foundation.md](tahap-1-foundation.md) (fondasi) dan [docs/BLUEPRINT.md](BLUEPRINT.md) (rencana keseluruhan).

Desain singkat: [docs/superpowers/specs/2026-11-18-oams-tahap2-core-assets-design.md](superpowers/specs/2026-11-18-oams-tahap2-core-assets-design.md). Rencana implementasi: [docs/superpowers/plans/2026-11-18-oams-tahap2-core-assets.md](superpowers/plans/2026-11-18-oams-tahap2-core-assets.md).

---

## 1. Ringkasan

Tahap 2 menghadirkan modul inventaris inti sesuai blueprint bab 4.1 sampai 4.3:

- Pendaftaran barang dengan kode otomatis `INV-{TAHUN}-{URUT}` (penomoran atomik per tahun, zona waktu Asia/Jakarta).
- Data lengkap: identitas, kategori, lokasi (path gedung/lantai/ruang), unit kerja, penanggung jawab, kepemilikan, metode dan tanggal perolehan, harga, penyedia, kondisi, status, catatan.
- Foto (dinormalisasi ke WebP + thumbnail) dan dokumen (faktur, garansi, dsb.) per barang, dengan validasi jenis berkas dari isinya.
- QR Code per barang: dibuat otomatis saat barang didaftarkan, bisa diunduh PNG/SVG, dicetak satuan atau massal pada lembar A4, diganti tokennya, dinonaktifkan, dan dihitung berapa kali dicetak.
- Halaman publik `/a/{token}` yang dibuka hasil pindai: tanpa login hanya info dasar, staf yang login mendapat tautan ke detail lengkap.
- Pemindai kamera di `/scan` dan input manual untuk alat pemindai barcode.
- Arsip barang (soft delete) dengan alasan, riwayat per barang dari audit log, serta statistik untuk dashboard.

Yang **bukan** bagian Tahap 2 (ditunda sesuai desain): peminjaman, mutasi, histori kondisi, pemeliharaan, stock opname, laporan, pengaturan admin, notifikasi. Field yang berkaitan (status `BORROWED`, penanggung jawab, kondisi) sudah ada agar Tahap 3 tinggal menambahkan alurnya.

---

## 2. Model data baru

Migrasi: `backend/prisma/migrations/20261118094044_tahap2_assets`.

| Tabel | Isi |
|---|---|
| `assets` | data barang (bab 5.2 blueprint, camelCase di Prisma), `archived_at`, `archived_by_id`, `archive_reason`, `created_by_id`, timestamps; indeks pada kategori, lokasi, status, kondisi, `archived_at` |
| `asset_code_sequences` | `year` (PK) dan `last_number`; sumber nomor urut per tahun |
| `asset_labels` | satu baris per barang: `public_token` (unik, 43 karakter base64url), `is_active`, `generated_at`, `printed_count`, `last_printed_at`, `revoked_at` |
| `asset_photos` | nama berkas acak, nama asli, MIME, ukuran, lebar/tinggi, `is_primary`, keterangan, pengunggah |
| `asset_documents` | nama berkas acak, nama asli, MIME, ukuran, judul, pengunggah |
| `system_settings` | sudah ada sejak Tahap 1; kini dipakai kunci `public_base_url` (opsional) |

Enum: `OwnershipType {OFFICE, THIRD_PARTY}`, `AcquisitionMethod {PURCHASE, GRANT, LOAN, OTHER}`, `AssetCondition {GOOD, MINOR_DAMAGE, MAJOR_DAMAGE, UNUSABLE}`, `AssetStatus {AVAILABLE, IN_USE, STORED, BORROWED, UNDER_MAINTENANCE, MISSING, DISPOSED, RETURNED}`.

Penomoran: saat membuat barang, backend menjalankan `INSERT INTO asset_code_sequences ... ON CONFLICT (year) DO UPDATE SET last_number = last_number + 1 RETURNING last_number` di dalam transaksi yang sama dengan pembuatan barang dan label. Dua permintaan bersamaan tidak pernah mendapat nomor yang sama (diuji 25 transaksi paralel). Nomor empat digit dengan nol di depan dan terus bertambah melewati 9999 (`INV-2026-12345`).

---

## 3. Endpoint backend

Semua di bawah `/api/v1`, format respons dan error sama seperti Tahap 1. Permission ditulis dalam kurung.

### 3.1 Inventaris (`/assets`)

| Metode | Path | Permission | Keterangan |
|---|---|---|---|
| GET | `/assets` | `assets.view` | daftar berhalaman; filter `search` (kode, nama, merek, model, nomor seri), `categoryId`, `locationId` (termasuk lokasi turunannya), `departmentId`, `responsibleUserId`, `condition`, `status`, `ownershipType`, `includeArchived`; `sort` `name|assetCode|updatedAt|createdAt`, `order asc|desc` |
| GET | `/assets/statistics` | `assets.view` | `total`, `active`, `archived`, `byStatus`, `byCondition`, `byCategory[]`, `byOffice[]` (kantor = akar lokasi); barang arsip hanya dihitung di `archived` |
| POST | `/assets` | `assets.create` | membuat barang + kode + label QR dalam satu transaksi |
| GET | `/assets/:id` | `assets.view` | detail termasuk foto, dokumen, dan label |
| PATCH | `/assets/:id` | `assets.update` | ditolak (400) bila barang diarsipkan |
| POST | `/assets/:id/archive` | `assets.archive` | body `{ reason? }` |
| POST | `/assets/:id/unarchive` | `assets.archive` | |
| GET | `/assets/:id/history` | `assets.view` | audit log modul `assets` dan `qr` untuk barang itu |

Validasi relasi: kategori, lokasi, unit kerja, dan penanggung jawab harus ada dan aktif; pesan 400 menyebut field yang salah (mis. `Kategori tidak ditemukan atau nonaktif.`).

### 3.2 Foto dan dokumen

| Metode | Path | Permission | Keterangan |
|---|---|---|---|
| POST | `/assets/:id/photos` | `assets.update` | multipart `file` (+ `caption`); JPEG/PNG/WebP ≤ 10 MB; foto pertama otomatis utama |
| GET | `/assets/:id/photos/:photoId/file?variant=full|thumb` | `assets.view` | WebP |
| POST | `/assets/:id/photos/:photoId/primary` | `assets.update` | |
| DELETE | `/assets/:id/photos/:photoId` | `assets.update` | menghapus baris dan berkasnya |
| POST | `/assets/:id/documents` | `assets.update` | multipart `file` (+ `title`); PDF/DOCX/XLSX/JPEG/PNG ≤ 20 MB |
| GET | `/assets/:id/documents/:documentId/file` | `assets.view` | `Content-Disposition: attachment` dengan nama asli |
| DELETE | `/assets/:id/documents/:documentId` | `assets.update` | |

Aturan berkas:

- Jenis berkas ditentukan dari isi (magic number, pustaka `file-type`), bukan dari ekstensi atau `Content-Type` klien. Berkas `.png` yang isinya PDF ditolak 400 `Jenis berkas tidak didukung.` dan tidak pernah disimpan.
- Berkas terlalu besar menghasilkan 400 `Ukuran berkas melebihi batas.` (batas multer 413 dipetakan ke bentuk validasi yang sama).
- Foto dinormalisasi `sharp`: maksimal 1920 px sisi terpanjang, WebP kualitas 82, plus thumbnail 320 px; metadata EXIF (termasuk lokasi GPS) ikut terbuang.
- Nama berkas di disk acak; nama asli hanya disimpan di database setelah dibersihkan dari karakter path. Semua path diverifikasi tetap berada di dalam `UPLOADS_DIR`.
- Berkas hanya bisa diakses lewat endpoint ber-permission; pengecualian tunggal adalah foto utama lewat endpoint publik QR.
- Upload ditolak (400) untuk barang yang diarsipkan.

### 3.3 QR Code

| Metode | Path | Permission | Keterangan |
|---|---|---|---|
| GET | `/assets/:id/qr` | `assets.view` | `token`, `isActive`, `url`, `printedCount`, `lastPrintedAt`, `generatedAt` |
| POST | `/assets/:id/qr/regenerate` | `qr.generate` | token baru; stiker lama langsung tidak berlaku; ditolak untuk barang arsip |
| POST | `/assets/:id/qr/deactivate` · `/activate` | `qr.generate` | stiker nonaktif menjawab 404 di halaman publik |
| GET | `/assets/:id/qr/download?format=png|svg&size=` | `assets.view` | gambar QR dari backend |
| POST | `/qr/bulk-generate` | `qr.generate` | `{ assetIds[] }` (1–500) → `items[] { assetId, assetCode, name, token, url }` + `skipped[]` (barang arsip); label nonaktif diaktifkan kembali dan diaudit |
| POST | `/qr/mark-printed` | `qr.generate` | menambah `printedCount` dan `lastPrintedAt` |
| GET | `/qr/public/:token` | tanpa login (`@OptionalAuth`) | lihat 3.4 |
| GET | `/qr/public/:token/photo?variant=` | tanpa login | foto utama; `Cache-Control: public, max-age=3600` |

Isi QR adalah `PUBLIC_BASE_URL/a/{token}`. `PUBLIC_BASE_URL` berasal dari `system_settings.public_base_url` bila ada, kalau tidak dari env, garis miring di akhir dibuang. **Stiker yang sudah dicetak memuat alamat itu; tetapkan domain final sebelum cetak massal.**

### 3.4 Halaman publik dan privasi

`GET /qr/public/:token` tanpa bearer mengembalikan **hanya**: `assetCode`, `name`, `category.name`, `brand`, `model`, `location {name, path}`, `status`, `condition`, `hasPhoto`. Harga, penyedia, nomor seri, penanggung jawab, unit kerja, catatan, dokumen, dan riwayat tidak pernah ikut (diuji e2e pada barang yang memiliki semuanya). Dengan bearer yang punya `assets.view`, respons adalah detail penuh ditandai `isPublicView: false`.

Token yang tidak dikenal, bentuknya salah, nonaktif, atau milik barang yang diarsipkan semuanya dijawab 404 dengan pesan yang sama, sehingga endpoint tidak membocorkan apa pun tentang format token atau keberadaan barang. Kedua endpoint publik dibatasi 60 permintaan per menit per alamat IP.

### 3.5 Pencarian pengguna

`GET /users/lookup?search=` (`master_data.view`) mengembalikan maksimal 20 pengguna aktif `{ id, fullName, email, department }` untuk memilih penanggung jawab. Dibuat karena Admin Inventaris tidak memegang `users.manage`.

---

## 4. Permission yang dipakai

| Permission | Dipakai untuk |
|---|---|
| `assets.view` | daftar, detail, riwayat, statistik, berkas, info QR, unduh QR |
| `assets.create` | mendaftarkan barang |
| `assets.update` | mengubah data, unggah/hapus foto dan dokumen, foto utama |
| `assets.archive` | arsip dan buka arsip |
| `qr.generate` | regenerate, aktif/nonaktif, cetak massal, mark-printed |
| `qr.scan` | menu Scan QR di aplikasi |

Pemetaan ke role bawaan tidak berubah dari Tahap 1: Super Admin dan Admin Inventaris memegang semuanya; Petugas Inventaris dan Viewer hanya `assets.view` dan `qr.scan`.

---

## 5. Aplikasi web

Menu baru pada bagian **Inventaris** di sidebar: Inventaris (`/assets`), Scan QR (`/scan`), Cetak QR (`/qr/print`). Semua teks berbahasa Indonesia; tampilan responsif.

| Halaman | Isi |
|---|---|
| `/assets` | tabel berhalaman dengan pencarian, filter kategori/lokasi/unit kerja/kondisi/status/kepemilikan, centang "termasuk arsip"; tombol Tambah (`assets.create`) |
| `/assets/create`, `/assets/[id]/edit` | formulir dengan validasi zod; pemilih lokasi menampilkan path lengkap (semua tingkat), pencarian penanggung jawab lewat `/users/lookup`, harga dalam Rupiah |
| `/assets/[id]` | tab **Informasi**, **Foto** (tarik-lepas, banyak berkas, jadikan utama, hapus), **Dokumen** (judul + berkas, unduh, hapus), **QR Code** (pratinjau dibuat di browser, unduh PNG/SVG, cetak, aktif/nonaktif, buat token baru dengan konfirmasi, penghitung cetak), **Riwayat** (audit log dengan label aksi berbahasa Indonesia); tombol Ubah, Arsipkan/Buka arsip (dengan alasan), Cetak QR |
| `/scan` | kamera belakang lewat `qr-scanner` (dimuat malas), pilihan kamera, pesan bila kamera tidak tersedia (bukan HTTPS, izin ditolak), input manual untuk alamat atau token; hasil diarahkan ke `/a/{token}` |
| `/a/[token]` | di luar kerangka aplikasi (tanpa sidebar); tanpa login: kartu info dasar + foto utama + tautan "Masuk sebagai petugas"; dengan login: kartu yang sama + "Buka detail lengkap"; token tidak dikenal: pesan "QR tidak dikenal" |
| `/qr/print` | pilih barang (pencarian, centang, praseleksi dari `?ids=`), ukuran stiker 30 mm (5×8 = 40 per lembar) atau 40 mm (4×6 = 24 per lembar), pratinjau lembar pertama, tombol Cetak memanggil dialog cetak browser; setelah dialog cetak ditutup, `mark-printed` dipanggil |
| `/dashboard` | kartu Total/Aktif/Diarsipkan dan batang per status, kondisi, dan 10 kategori teratas dari `/assets/statistics` (bila `assets.view`) |

Catatan teknis frontend:

- Gambar yang butuh bearer (thumbnail foto) diambil sebagai blob lewat komponen `AuthImage`, bukan `<img src>` langsung, karena cookie sesi tidak berlaku untuk endpoint berkas.
- Klien API meneruskan `FormData` apa adanya (`apiUpload`) dan menyediakan `fetchBlob`; keduanya melewati jalur refresh-on-401 yang sama.
- QR untuk pratinjau dan cetak dibuat di browser dengan pustaka `qrcode` dari URL yang dikembalikan API, sehingga mencetak 500 stiker tidak memukul API 500 kali. Unduhan PNG/SVG tetap dari backend.
- Lembar cetak memakai `@page { size: A4; margin: 10mm }`, grid dalam milimeter dengan jarak 4 mm, dan menyembunyikan kerangka aplikasi saat mencetak (`print.css`). Setiap stiker memuat QR dan kode inventaris.

---

## 6. Riwayat dan audit

Aksi yang dicatat (modul `assets` dan `qr`): `asset.created`, `asset.updated`, `asset.archived`, `asset.unarchived`, `asset.photo_added`, `asset.photo_removed`, `asset.photo_primary`, `asset.document_added`, `asset.document_removed`, `qr.generated`, `qr.regenerated`, `qr.deactivated`, `qr.activated`, `qr.printed`. Tab Riwayat di detail barang menampilkan semuanya; halaman Audit Log Tahap 1 tetap memuat seluruh modul.

---

## 7. Pengujian

| Lapisan | Cakupan |
|---|---|
| Unit backend | pembentuk kode (`formatAssetCode`, `jakartaYear`), pemetaan DTO publik (daftar kunci yang diizinkan), validasi unggahan |
| e2e backend (PostgreSQL tertanam) | 25 transaksi paralel menghasilkan 25 kode berbeda; CRUD, filter, arsip, riwayat, statistik, lookup pengguna; unggah foto/dokumen termasuk berkas berbohong ekstensi, batas ukuran, 403 untuk `assets.view` saja, 401 tanpa token, penghapusan berkas di disk; QR info/regenerate/deactivate/activate/download, bulk-generate dan mark-printed, endpoint publik anonim vs staf, 404 untuk token nonaktif/tidak dikenal |
| Frontend (Vitest + Testing Library) | klien API (refresh, FormData), skema formulir barang, `qrDataUrl`/`qrSvg`, `parseScannedValue`, `sheetLayout`, komponen Tahap 1 |

Jalankan semuanya dengan `npm test` di akar repo. Pemeriksaan di browser yang dilakukan selama pengembangan: buat barang, unggah foto dan dokumen, ganti token QR, arsip dan buka arsip, halaman publik sebagai staf, lembar cetak 26 stiker (2 lembar) dan pencatatan `mark-printed`.

---

## 8. Deployment dan operasional

Perubahan dibanding Tahap 1 (detail di [README](../README.md)):

- Variabel baru: `PUBLIC_BASE_URL` (wajib diisi dengan alamat yang dibuka pengguna, mis. `https://inventaris.domainkantor.com`) dan `UPLOADS_DIR` (`/app/uploads` di Docker, otomatis).
- Volume Docker baru `uploads` menyimpan foto dan dokumen; ia **tidak** termasuk dalam backup `pg_dump`. Sertakan `docker volume` itu (atau salinan `docker compose cp backend:/app/uploads`) dalam rutinitas backup kantor.
- Update server: `git pull --ff-only && docker compose up -d --build`; migrasi `tahap2_assets` berjalan otomatis saat backend start, seed menambahkan tidak ada permission baru (katalog sudah lengkap sejak Tahap 1).
- Kamera di ponsel hanya aktif pada halaman HTTPS yang sertifikatnya dipercaya perangkat. Dengan sertifikat self-signed saat ini, pemindaian lewat kamera belum bisa diuji di HP; input manual dan alat pemindai barcode tetap berfungsi.

---

## 9. Keputusan di luar atau melengkapi blueprint

| Keputusan | Alasan |
|---|---|
| Tabel `asset_code_sequences` (tidak ada di blueprint) | penomoran per tahun harus atomik; `MAX()+1` bisa menabrak saat dua petugas mendaftar bersamaan |
| Token QR acak 32 byte, bukan ID barang | URL tidak bisa ditebak atau dienumerasi; regenerate memutus stiker lama tanpa mengubah ID |
| Token salah bentuk dijawab 404, bukan 400 | endpoint publik tidak perlu mengajari format token |
| Regenerate ditolak untuk barang arsip, tetapi nonaktif/aktif tetap boleh | stiker barang arsip harus bisa dimatikan; token baru tidak ada gunanya |
| Bulk-generate mengaktifkan kembali label nonaktif | mencetak berarti stiker harus berfungsi; tindakan diaudit `qr.activated` |
| Foto dinormalisasi ke WebP dan EXIF dibuang | ukuran konsisten, tidak menyimpan koordinat GPS dari kamera HP |
| Pemilih lokasi menerima semua tingkat, bukan hanya ruangan | blueprint mewajibkan lokasi, tidak mewajibkan ruangan; filter per gedung tetap mencakup turunannya |
| `mark-printed` dipanggil pada `afterprint`, termasuk saat dialog cetak dibatalkan | browser tidak membedakan cetak dan batal; stiker yang tidak tercatat lebih merugikan daripada hitungan lebih |
| QR dirender di browser untuk pratinjau dan cetak | cetak massal tidak membebani API; unduhan tetap dari backend agar konsisten |
| Multer 413 dipetakan ke 400 | satu bentuk error validasi untuk klien |

---

## 10. Review akhir dan temuan yang ditunda

Review independen atas seluruh perubahan Tahap 2 (9 commit, 99 berkas) tidak menemukan temuan Critical. Lima fokus review (penomoran atomik, berkas berbohong ekstensi, token nonaktif/tidak dikenal, privasi endpoint publik, 403/401 pada berkas) semuanya terkonfirmasi lewat kode dan test. Satu temuan Important dan tujuh Minor diperbaiki pada commit `fix: address review findings for Tahap 2`:

- Riwayat barang (`GET /assets/:id/history`) tidak lagi menyertakan alamat IP dan perangkat pelaku; keduanya tetap hanya di halaman Audit Log (izin `audit_logs.*`).
- `PATCH /assets/:id` dengan `null` pada field wajib, tanggal yang tidak ada di kalender (`2026-02-31`), atau harga melebihi 13 digit kini dijawab 400 dengan pesan, bukan 500.
- `statistics.total` = aktif + arsip (sebelumnya sama dengan aktif).
- Foto publik QR di-cache `private, max-age=300` (sebelumnya publik 1 jam, sehingga foto bisa tetap tersaji setelah QR dinonaktifkan).
- Pratinjau di halaman Cetak QR tidak ikut tercetak (sebelumnya menumpuk dengan lembar sebenarnya).
- Unggah foto menentukan foto utama di dalam transaksi serializable dan menghapus berkas bila penyimpanan baris gagal; penghapusan foto memindahkan status utama dalam transaksi yang sama; dekode gambar dibatasi 50 megapiksel.
- `bulk-generate` dan unduh QR menolak (400) bila `PUBLIC_BASE_URL` kosong, agar tidak ada stiker berisi alamat relatif.

Ditunda (tidak menghalangi pemakaian):

1. Setiap respons 413 dipetakan ke pesan "Ukuran berkas melebihi batas.", termasuk 413 dari batas body JSON (kosmetik; batas JSON jauh di atas pemakaian normal).
2. Catatan review: berkas PDF yang diberi nama `.png` sah diterima sebagai **dokumen** (PDF memang diizinkan) dan disimpan sebagai `.pdf` sesuai isinya; perilaku ini disengaja.
3. Temuan Tahap 1 yang masih terbuka tetap tercatat di [docs/tahap-1-foundation.md](tahap-1-foundation.md) bagian 11.

---

## 11. Langkah berikutnya: Tahap 3

Sesuai blueprint: peminjaman barang (pengajuan, persetujuan, pengembalian, status `BORROWED`), mutasi lokasi dan penanggung jawab dengan alur persetujuan, histori kondisi, serta notifikasi dasar. Prasyarat non-kode yang masih sama dengan Tahap 1: domain dengan sertifikat tepercaya agar kamera HP dapat dipakai dan `PUBLIC_BASE_URL` final sebelum cetak stiker massal.
