# OAMS Tahap 1 (Foundation) — Desain Singkat

Tanggal: 17 November 2026
Acuan utama: [docs/BLUEPRINT.md](../../BLUEPRINT.md) (Technical Blueprint OAMS v1.0)

## Maksud

Membangun fondasi Office Asset Management System sesuai blueprint: repository,
Docker, database, Prisma, autentikasi, otorisasi (RBAC), manajemen pengguna,
kategori, dan lokasi. Tahap ini harus teruji sebelum Tahap 2 (inventaris dan
QR Code) dimulai, sesuai ketentuan pengembangan butir 10.

## Tujuan Tahap 1

- Pengguna bisa login, refresh sesi, logout, lihat profil, ganti password.
- Empat role bawaan (Super Admin, Admin Inventaris, Petugas Inventaris, Viewer)
  dengan permission sesuai matriks hak akses blueprint bab 3.5.
- Super Admin mengelola pengguna: tambah, ubah, nonaktifkan, reset password,
  tetapkan role.
- Admin mengelola kategori, lokasi berjenjang (Kantor → Gedung → Lantai →
  Ruangan), dan unit kerja (departments).
- Setiap perubahan data penting tercatat di audit log (append-only).
- Frontend: halaman login, kerangka dashboard dengan navigasi sesuai role,
  halaman pengguna, kategori, lokasi, unit kerja.
- Dapat dijalankan di server lewat Docker Compose (Nginx, Next.js, NestJS,
  PostgreSQL) dan dikembangkan di laptop tanpa Docker.

## Bukan Tujuan Tahap 1

- Modul aset, QR, mutasi, stock opname, pemeliharaan, laporan, import Excel.
  Skema database untuk tabel-tabel itu dibuat belakangan di tahapnya
  masing-masing lewat migration terpisah.
- Forgot password lewat email (butuh SMTP; ditunda, halaman placeholder saja).
- Role dan permission kustom lewat UI (seed saja; UI penetapan role ke user
  ada, UI edit permission per role masuk tahap berikutnya).

## Anti-tujuan

- Menyimpang dari keputusan arsitektur blueprint (NestJS, Next.js,
  PostgreSQL, Prisma, modular monolith, Docker) tanpa alasan teknis.
- Menyimpan access token di localStorage atau cookie yang bisa dibaca JS.
- Menghapus histori (user dinonaktifkan, bukan dihapus).

## Batasan Lingkungan

- Mesin pengembangan: Windows 11, Node 24.22.3 (via nvm-windows), npm 11,
  tanpa Docker, tanpa PostgreSQL yang berfungsi.
- Server target: Docker dan PostgreSQL tersedia (milik pengguna).

## Pendekatan yang Dipertimbangkan

1. **Postgres tertanam lokal untuk dev/test, Docker Compose untuk server**
   (dipilih). Paket npm `embedded-postgres` menjalankan PostgreSQL asli di
   laptop tanpa instalasi; test e2e memakai instance sendiri. Server tetap
   memakai image PostgreSQL resmi lewat Compose. Trade-off: satu dependency
   dev tambahan, unduhan biner saat install.
2. **Database dev di server pengguna.** Paling mirip production, tetapi butuh
   port terbuka dan kredensial; pengujian otomatis jadi bergantung jaringan.
3. **Supabase lewat konektor.** Tanpa setup lokal, tetapi di luar keputusan
   blueprint dan berpotensi berbiaya.

Pengguna memilih pendekatan 1 (percakapan 17 Nov 2026).

## Keputusan Teknis (keputusan builder, dicatat agar bisa dikoreksi)

- **Runtime:** Node 24 LTS, dikunci di `.nvmrc`, `engines`, dan Dockerfile.
- **Monorepo:** npm workspaces (`backend`, `frontend`), tanpa Turborepo.
- **Backend:** NestJS 12, Prisma 7 dengan driver adapter `@prisma/adapter-pg`,
  class-validator untuk DTO, Swagger di `/api/docs`, `@nestjs/throttler`
  untuk rate limit login.
- **Autentikasi:** access token JWT berumur pendek (15 menit) dikirim di
  header Authorization dan disimpan di memori frontend; refresh token acak
  (bukan JWT) berumur 7 hari, disimpan ter-hash di tabel `refresh_tokens`,
  dikirim sebagai cookie HttpOnly + Secure + SameSite=Lax, dirotasi tiap
  refresh. Tabel `refresh_tokens` adalah tambahan di luar daftar 24 tabel
  blueprint; diperlukan agar logout dan pencabutan sesi bisa dilakukan.
- **Password:** Argon2id (paket `argon2`).
- **RBAC:** tabel `roles`, `permissions`, `user_roles`, `role_permissions`
  sesuai blueprint. Kode permission berformat `modul.aksi`
  (contoh `assets.create`, `users.manage`). Guard membaca permission efektif
  user dari gabungan role-nya. Role Super Admin ditandai `is_system` dan
  memegang semua permission.
- **Lokasi:** satu tabel `locations` berjenjang dengan `parent_id` dan
  `type` (OFFICE, BUILDING, FLOOR, ROOM); nonaktif lewat `is_active`.
- **Audit log:** dibangun sekarang sebagai layanan bersama (`common/audit`)
  karena semua modul memakainya; blueprint menaruhnya di Tahap 4, tetapi
  menunda berarti merombak semua service. Isi: user, aksi, modul, id objek,
  data sebelum, data sesudah, waktu, IP, user agent.
- **Waktu:** disimpan UTC (timestamptz), ditampilkan Asia/Jakarta di frontend.
- **Frontend:** Next.js 16 App Router, TypeScript, Tailwind CSS v4, TanStack
  Query, react-hook-form + zod, komponen UI sendiri yang ringkas. Bahasa
  antarmuka Indonesia. Responsif untuk desktop dan smartphone.
- **Seed:** 4 role, daftar permission, 9 kategori awal, satu Super Admin
  awal yang kredensialnya dibaca dari environment (`SEED_ADMIN_EMAIL`,
  `SEED_ADMIN_PASSWORD`), bukan di-hardcode.
- **Pengujian:** Jest. Unit test untuk service dengan logika (auth, RBAC,
  lokasi berjenjang); e2e test dengan supertest terhadap PostgreSQL tertanam
  untuk alur login, refresh, otorisasi, CRUD master data.
- **Deployment:** `infrastructure/docker` (Dockerfile backend dan frontend,
  multi-stage node:24-alpine), `infrastructure/nginx` (reverse proxy, HTTPS
  siap diisi sertifikat), `infrastructure/postgres` (skrip backup harian),
  `docker-compose.yml` di root, `.env.example`.

## Diserahkan ke Builder

- Struktur folder detail di dalam tiap modul (mengikuti controller / service /
  dto / entity ala NestJS).
- Detail tampilan komponen, selama konsisten dan responsif.
- Pilihan ukuran halaman, format error response (dipakai konsisten di semua
  endpoint: `{ statusCode, message, errors? }`).
