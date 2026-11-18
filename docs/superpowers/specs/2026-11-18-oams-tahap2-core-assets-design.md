# OAMS Tahap 2 (Core Asset Management) — Desain Singkat

Tanggal: 18 November 2026
Acuan: [docs/BLUEPRINT.md](../../BLUEPRINT.md) bab 2, 4.2–4.4, 5, 7.2–7.3, 9.4–9.5, 12 "Tahap 2". Dibangun di atas [Tahap 1](../../tahap-1-foundation.md).

## Maksud

Setiap barang kantor tercatat dengan identitas digital (Asset Code + Public Token + QR Code), dapat dicari dan difilter, punya foto dan dokumen, dapat dicetak stikernya, dipindai dengan kamera HP, dan dilihat lewat halaman publik.

## Tujuan Tahap 2

- CRUD inventaris dengan seluruh atribut bab 5.2, pencarian, filter (kategori, lokasi, kondisi, status, kepemilikan, unit kerja, penanggung jawab), arsip (soft delete) dan buka arsip, riwayat barang.
- Asset Code otomatis `INV-{TAHUN}-{NOMOR_URUT}` (minimal 4 digit, per tahun, atomik, tidak dipakai ulang, tidak berubah).
- Public Token acak per barang; QR berisi `{PUBLIC_BASE_URL}/a/{token}`; generate, preview, unduh PNG/SVG, regenerate, nonaktifkan/aktifkan, cetak satuan dan massal (lembar stiker 30×30 atau 40×40 mm, hanya QR).
- Upload foto (beberapa, satu utama) dan dokumen pendukung, tersimpan di disk server dengan kontrol akses.
- Scanner kamera di `/scan` + input token manual.
- Halaman publik `/a/[token]`: anonim melihat info dasar; pengguna login melihat sesuai hak akses.
- `GET /assets/statistics` untuk mengisi dashboard (angka dan rincian per status/kondisi/kategori).

## Bukan Tujuan Tahap 2

- Mutasi dengan persetujuan, riwayat penanggung jawab dan kondisi, peminjaman, stock opname, pemeliharaan, laporan/ekspor, import Excel, grafik analitik lengkap (Tahap 3–5).
- Penyimpanan file di S3/MinIO (disk lokal + volume Docker cukup untuk satu kantor).

## Keputusan yang disetujui pemilik (18 Nov 2026)

1. Isi QR = `PUBLIC_BASE_URL/a/{token}`; alamat dasar dari env, bisa ditimpa lewat `system_settings` (`public_base_url`). Stiker yang sudah dicetak memuat alamat itu, jadi domain final harus ditetapkan sebelum cetak massal.
2. Info publik tanpa login: kode aset, nama, kategori, merek/model, lokasi (path), status, foto utama. Disembunyikan: harga, vendor, nomor seri, penanggung jawab, unit kerja, catatan, dokumen, riwayat.
3. Kamera di HP hanya berjalan pada HTTPS tepercaya; uji pemindaian nyata menunggu domain + sertifikat. Pengembangan memakai `localhost`.
4. Field kepemilikan, perolehan, penanggung jawab, kondisi, status ada sejak sekarang; alur persetujuan dan histori khusus menyusul di Tahap 3.

## Keputusan Teknis (keputusan builder)

- **Skema**: tabel `assets`, `asset_labels`, `asset_photos`, `asset_documents` sesuai blueprint, plus `asset_code_sequences(year, last_number)` (tambahan) agar penomoran atomik lewat `INSERT ... ON CONFLICT ... RETURNING` dalam transaksi yang sama dengan pembuatan barang. Enum Prisma: `OwnershipType`, `AcquisitionMethod`, `AssetCondition`, `AssetStatus` (nilai bab 5.4–5.5 dan 4.11). `purchase_price` `Decimal(15,2)`.
- **Label QR**: satu baris per barang; `regenerate` mengganti token pada baris yang sama (riwayat lewat audit), `deactivate` menandai `is_active=false` sehingga halaman publik menjawab 404 "QR tidak aktif". Token = 32 byte acak base64url.
- **File**: disimpan di `UPLOADS_DIR` (lokal `backend/uploads`, Docker `/app/uploads` = volume `uploads`) dengan nama acak; MIME diverifikasi dari isi (`file-type`), bukan dari ekstensi. Foto: jpeg/png/webp ≤ 10 MB, dinormalisasi `sharp` ke WebP maks 1920 px + thumbnail 320 px (EXIF terbuang). Dokumen: pdf, docx, xlsx, jpeg, png ≤ 20 MB. File diakses hanya lewat endpoint ber-permission; satu pengecualian: foto utama lewat endpoint publik untuk halaman QR.
- **Autentikasi opsional**: `@OptionalAuth()` membuat guard melewatkan permintaan tanpa header; bila header ada tetap divalidasi penuh. Dipakai `GET /qr/public/:token` dan foto publiknya; keduanya dibatasi 60/menit per IP.
- **Pencarian pengguna** untuk penanggung jawab: `GET /users/lookup?search=` (`master_data.view`) mengembalikan pengguna aktif ringkas, karena Admin Inventaris tidak punya `users.manage`.
- **QR di browser** dibuat sisi klien dengan `qrcode` (preview, cetak) dari URL yang dikembalikan API; unduhan PNG/SVG datang dari backend agar konsisten. Cetak lewat halaman `/qr/print` dengan CSS `@page A4` dan ukuran stiker dalam mm; setelah cetak, `POST /qr/mark-printed` menambah `printed_count`.
- **Scanner**: `qr-scanner` (nimiq) dengan kamera belakang, menerima URL `/a/{token}` atau token mentah, lalu mengarahkan ke `/a/{token}`.
- **Dashboard** memakai `/assets/statistics` (kartu angka + batang CSS sederhana); grafik lengkap tetap Tahap 5.
- **Permission** memakai katalog Tahap 1: `assets.view|create|update|archive`, `qr.generate`, `qr.scan`.
- **Pengujian**: e2e backend terhadap PostgreSQL asli termasuk upload multipart (buffer gambar dibuat `sharp`); unit untuk pembentuk kode, pemetaan DTO publik, parser hasil pindai, tata letak cetak.

## Diserahkan ke Builder

Detail tampilan, pembagian komponen, teks bantuan, dan urutan kolom tabel, selama konsisten dengan Tahap 1 dan responsif.
