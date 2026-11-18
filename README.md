# OAMS — Office Asset Management System

Aplikasi manajemen inventaris kantor berbasis web dengan QR Code sebagai identitas setiap barang. Spesifikasi lengkap ada di [docs/BLUEPRINT.md](docs/BLUEPRINT.md).

## Stack

| Bagian | Teknologi |
|---|---|
| Backend | NestJS 12 (TypeScript, ESM), Prisma 7, PostgreSQL 17 |
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Runtime | Node.js 24 LTS |
| Deployment | Docker Compose: Nginx, Next.js, NestJS, PostgreSQL |

Struktur repo mengikuti monorepo npm workspaces:

```text
backend/          API NestJS + Prisma
frontend/         Aplikasi Next.js
infrastructure/   Dockerfile, Nginx, skrip backup PostgreSQL
docs/             Blueprint, desain, dan rencana implementasi
```

## Prasyarat pengembangan

- Node.js 24 (disarankan lewat nvm: `nvm install 24 && nvm use 24`, versi tepatnya ada di `.nvmrc`).
- npm 11 (ikut Node 24).
- Tidak perlu Docker atau PostgreSQL terpasang. Database lokal dijalankan otomatis lewat paket `embedded-postgres`.

## Menjalankan secara lokal

```bash
npm install
```

Cara termudah, satu perintah untuk database, backend, dan frontend sekaligus (hentikan dengan Ctrl+C):

```bash
npm run dev
```

Atau jalankan terpisah bila ingin log masing-masing. Database lokal (terminal 1):

```bash
npm run dev:db
```

Siapkan `backend/.env` dari `backend/.env.example`, lalu migrasi dan seed (sekali):

```bash
npm run prisma:migrate -w backend
```

```bash
npm run prisma:seed -w backend
```

Jalankan backend (terminal 2) dan frontend (terminal 3):

```bash
npm run dev:backend
```

```bash
npm run dev:frontend
```

- Frontend: http://localhost:3000
- API: http://localhost:4000/api/v1
- Dokumentasi API (Swagger): http://localhost:4000/api/docs

Login memakai **email atau username**. Akun Super Admin lokal dibuat oleh seed dari `backend/.env` (bawaan: username `admin`, password `12345678`; hanya untuk pengembangan). Lupa password akun mana pun di lokal maupun server:

```bash
npm run user:set-password -w backend -- admin PasswordBaru123
```

Di server, perintah yang sama dijalankan di dalam container backend:

```bash
docker compose exec backend node dist/database/set-password.js admin PasswordBaru123
```

## Pengujian

```bash
npm test
```

Perintah di atas menjalankan unit test backend, e2e test backend (dengan PostgreSQL tertanam sementara), dan test frontend. Lint seluruh workspace:

```bash
npm run lint
```

## Dokumen

- Blueprint: [docs/BLUEPRINT.md](docs/BLUEPRINT.md)
- Desain Tahap 1: [docs/superpowers/specs/2026-11-17-oams-tahap1-foundation-design.md](docs/superpowers/specs/2026-11-17-oams-tahap1-foundation-design.md)
- Rencana Tahap 1: [docs/superpowers/plans/2026-11-17-oams-tahap1-foundation.md](docs/superpowers/plans/2026-11-17-oams-tahap1-foundation.md)
- Dokumentasi hasil Tahap 1: [docs/tahap-1-foundation.md](docs/tahap-1-foundation.md)

## Deployment (server dengan Docker)

Stack produksi dijalankan dengan Docker Compose: Nginx (reverse proxy + TLS), Next.js, NestJS, PostgreSQL 17, dan container backup harian. PostgreSQL berada di jaringan internal Docker dan tidak dipublikasikan ke luar; hanya backend yang mengaksesnya.

```text
Internet / Jaringan Kantor -> nginx:443 -> frontend:3000 (/) dan backend:4000 (/api/)
                                                   backend -> postgres:5432 (internal)
```

### 1. Persiapan di server

1. Clone repository ini ke server, lalu masuk ke foldernya.
2. Salin konfigurasi dan isi nilainya:

```bash
cp .env.example .env
```

   Wajib diisi: `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET` (minimal 32 karakter), `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`. Buat rahasia acak dengan perintah berikut. Gunakan format heksadesimal untuk `POSTGRES_PASSWORD` karena nilainya disisipkan ke dalam URL koneksi dan tidak boleh mengandung karakter seperti `/`, `@`, `+`, atau `=`:

```bash
openssl rand -hex 32
```

3. Letakkan sertifikat TLS di `infrastructure/nginx/certs/` dengan nama `fullchain.pem` dan `privkey.pem` (misalnya dari Let's Encrypt atau CA internal kantor). HTTPS wajib karena cookie sesi memakai flag `Secure` dan kamera QR (Tahap 2) membutuhkan HTTPS.

### 2. Menjalankan

```bash
docker compose up -d --build
```

Saat container backend start, ia otomatis menjalankan migrasi database (`prisma migrate deploy`) dan seed idempoten (role, permission, kategori awal, Super Admin dari `SEED_ADMIN_*`). Pantau dengan:

```bash
docker compose logs -f backend
```

Buka `https://<domain-kantor>/login`, masuk dengan akun `SEED_ADMIN_*`, lalu segera ganti password lewat menu Profil.

Perintah lain yang sering dipakai:

```bash
docker compose ps
```

```bash
docker compose pull && docker compose up -d --build
```

```bash
docker compose down
```

### 3. Backup

Container `backup` membuat dump setiap 24 jam ke folder `./backups` di server (format custom `pg_dump`, retensi 14 hari, atur lewat `BACKUP_RETENTION_DAYS`). Folder ini harus disalin rutin ke penyimpanan lain di luar server (rsync, rclone, atau NAS kantor) agar backup terpisah dari server utama.

Membuat backup manual kapan saja:

```bash
docker compose exec backup sh /scripts/backup.sh
```

### 4. Restore dan uji pemulihan

Hentikan backend, pulihkan, lalu jalankan lagi:

```bash
docker compose stop backend
```

```bash
docker compose run --rm --entrypoint sh backup /scripts/restore.sh /backups/oams-YYYYMMDD-HHMM.dump
```

`--entrypoint sh` wajib ditulis, karena entrypoint bawaan container `backup` adalah loop backup harian.

```bash
docker compose start backend
```

Uji pemulihan secara berkala (disarankan setiap triwulan) pada database kosong, misalnya dengan `POSTGRES_DB=oams_uji` di salinan `.env` terpisah, untuk memastikan berkas backup benar-benar bisa dipulihkan.

### Keamanan operasional

- Setelah login pertama dan password Super Admin diganti, hapus `SEED_ADMIN_PASSWORD` dari `.env` atau set `SEED_ON_START=false`. Seed tidak pernah mengubah password akun yang sudah ada, tetapi rahasia tidak perlu tersimpan lebih lama dari yang diperlukan.
- Seed saat start hanya menambahkan permission yang baru diperkenalkan oleh versi aplikasi; permission yang dicabut Super Admin lewat menu Role & Izin tidak dikembalikan.
- Login dibatasi 5 kegagalan per menit per akun dan 30 permintaan per menit per alamat; endpoint refresh dan logout 60 per menit per alamat.
- Dokumentasi Swagger (`/api/docs`) ikut terekspos di balik Nginx. Batasi aksesnya di Nginx (misalnya hanya dari jaringan kantor) bila tidak ingin struktur API terlihat publik.

### Catatan

- Nilai `API_URL` untuk rewrite `/api` di frontend dibakukan saat build image (`http://backend:4000`), sesuai nama service di Compose.
- Mesin pengembangan tidak memiliki Docker, sehingga `docker compose config`/`up` belum pernah dijalankan dari repo ini. Jalankan pertama kali di server dan laporkan log bila ada kegagalan build.
- Konfigurasi sensitif hanya lewat `.env` di server; file ini tidak pernah di-commit.
