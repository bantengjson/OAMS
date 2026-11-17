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

Jalankan database lokal (terminal 1):

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

## Deployment

Lihat bagian ini setelah Tahap 1 selesai: petunjuk Docker Compose, backup, dan restore akan ditambahkan di sini.
