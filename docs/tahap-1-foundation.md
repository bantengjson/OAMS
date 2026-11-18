# OAMS Tahap 1 — Foundation

**Status:** selesai, terpasang di server (18 November 2026)  
**Acuan:** [BLUEPRINT.md](BLUEPRINT.md) bab 12 "Tahap 1 — Foundation"  
**Desain dan rencana:** [spesifikasi desain](superpowers/specs/2026-11-17-oams-tahap1-foundation-design.md), [rencana implementasi](superpowers/plans/2026-11-17-oams-tahap1-foundation.md)

Dokumen ini merangkum apa yang benar-benar terbangun di Tahap 1, bagaimana cara kerjanya, keputusan yang diambil di luar blueprint, dan apa yang sengaja ditunda. Pembaca yang dituju: pengembang berikutnya dan pengelola sistem di kantor.

---

## 1. Ringkasan

Tahap 1 menyiapkan fondasi yang dipakai semua tahap berikutnya:

- Repository monorepo (backend NestJS, frontend Next.js, infrastruktur Docker).
- Database PostgreSQL dengan migrasi Prisma dan seed data awal.
- Autentikasi (login, refresh, logout, ganti password) dan otorisasi berbasis role dan permission.
- Manajemen pengguna, role dan izin, kategori, unit kerja, lokasi berjenjang.
- Audit log append-only untuk semua perubahan penting.
- Aplikasi web berbahasa Indonesia yang responsif, menyesuaikan menu dengan permission.
- Deployment Docker Compose dengan Nginx, backup harian, dan skrip restore.

Yang **belum** ada karena memang milik tahap berikutnya: inventaris barang, QR Code, mutasi, stock opname, pemeliharaan, peminjaman, laporan, import Excel.

---

## 2. Arsitektur yang terpasang

```text
Browser (desktop / HP)
   │ HTTPS
   ▼
Nginx (container, port 80/443 host)
   ├── /api/*  ──▶ backend  NestJS 12, port 4000  ──▶ PostgreSQL 17 (jaringan internal Docker)
   └── /*      ──▶ frontend Next.js 16, port 3000       ▲
                                                        └── backup (pg_dump harian ke ./backups)
```

| Lapisan | Teknologi | Catatan |
|---|---|---|
| Runtime | Node.js 24 LTS | dikunci di `.nvmrc`, `engines`, dan image Docker |
| Backend | NestJS 12 (ESM), Prisma 7 + `@prisma/adapter-pg`, Vitest | modular monolith: `common/` + `modules/` |
| Frontend | Next.js 16 App Router, React 19, Tailwind 4, TanStack Query, react-hook-form + zod | semua halaman client-rendered di balik login |
| Database | PostgreSQL 17 | UUID sebagai primary key, timestamptz (UTC), tampil Asia/Jakarta |
| Deployment | Docker Compose, Nginx 1.27 | lihat README bagian Deployment |
| Dev lokal | `embedded-postgres` (PostgreSQL asli tanpa instalasi) | `npm run dev` menyalakan semuanya |

Struktur repo mengikuti blueprint bab 8:

```text
backend/src/common/     audit, auth (guard, decorator, katalog permission), context, dto, filters, pipes, prisma
backend/src/modules/    auth, users, roles, categories, departments, locations, audit-logs, health
backend/src/database/   seed, seed-cli, set-password
backend/prisma/         schema.prisma, migrations/
backend/test/           e2e spec per modul + harness (test/utils)
frontend/src/app/       (auth)/login, (app)/dashboard|users|roles|categories|departments|locations|audit-logs|profile
frontend/src/components ui/ (komponen dasar), layout/ (shell, sidebar, nav)
frontend/src/features/  komponen per fitur (users, locations, roles, master-data, audit-logs, profile)
frontend/src/lib/       api client, auth provider, util
infrastructure/         docker/, nginx/, postgres/
```

---

## 3. Modul backend dan endpoint

Semua endpoint di bawah `/api/v1`. Selain yang ditandai publik, semua butuh `Authorization: Bearer <access token>`. Dokumentasi interaktif: `/api/docs` (Swagger).

### 3.1 Autentikasi (`/auth`)

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| POST | `/auth/login` | publik | Login dengan `identifier` (email **atau** username) dan `password` |
| POST | `/auth/refresh` | publik (cookie) | Tukar refresh cookie dengan access token baru |
| POST | `/auth/logout` | publik (cookie) | Cabut refresh token, hapus cookie |
| GET | `/auth/me` | login | Profil, role, dan permission efektif |
| PATCH | `/auth/change-password` | login | Ganti password sendiri; semua sesi dicabut |

### 3.2 Role dan permission

| Method | Endpoint | Permission | Fungsi |
|---|---|---|---|
| GET | `/roles` | `roles.view` | Daftar role, permission, jumlah pengguna |
| GET | `/roles/:id` | `roles.view` | Detail role |
| GET | `/permissions` | `roles.view` | Katalog permission per modul |
| PUT | `/roles/:id/permissions` | `roles.manage` | Ganti seluruh permission role (Super Admin tidak bisa diubah) |

### 3.3 Pengguna (`/users`, semua `users.manage`)

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/users` | Daftar, filter `search`, `isActive`, `roleCode`, paginasi |
| POST | `/users` | Tambah pengguna (email, username opsional, password awal, role, unit kerja, telepon) |
| GET | `/users/:id` | Detail |
| PATCH | `/users/:id` | Ubah nama, username, telepon, unit kerja |
| POST | `/users/:id/deactivate` | Nonaktifkan (sesi dicabut) |
| POST | `/users/:id/activate` | Aktifkan kembali |
| POST | `/users/:id/reset-password` | Set password baru (sesi dicabut) |
| PUT | `/users/:id/roles` | Ganti seluruh role |
| GET | `/users/:id/activity` | Audit log dengan pengguna tersebut sebagai pelaku |

Aturan: email dinormalisasi huruf kecil dan unik tanpa memandang kapital; tidak bisa menonaktifkan diri sendiri; sistem harus selalu punya minimal satu Super Admin aktif; hanya Super Admin yang boleh memberi atau mencabut role Super Admin.

### 3.4 Master data

Kategori (`/categories`), unit kerja (`/departments`), dan lokasi (`/locations`) memiliki pola yang sama: `GET` daftar dan detail (`master_data.view`), `POST`, `PATCH`, `POST :id/deactivate`, `POST :id/activate` (`<modul>.manage`). Kode berformat huruf besar, angka, garis bawah (2 sampai 20 karakter) dan unik. Tidak ada hapus permanen; data dinonaktifkan.

Lokasi tambahan:

- `GET /locations/tree?includeInactive=` mengembalikan pohon Kantor → Gedung → Lantai → Ruangan.
- Aturan hierarki ketat: Kantor tanpa induk; tipe lain harus berinduk tepat satu tingkat di atasnya. Tipe tidak dapat diubah setelah dibuat.
- Menonaktifkan lokasi ditolak selama masih ada anak aktif; mengaktifkan ditolak bila induk nonaktif.
- Setiap lokasi membawa `path` yang mudah dibaca, misalnya `Kantor Pusat / Gedung A / Lantai 2 / Ruang 201`.

### 3.5 Audit log

`GET /audit-logs` dengan filter `actorId`, `module`, `action`, `entityId`, `from`, `to`. Pemegang `audit_logs.view_all` melihat semua; pemegang `audit_logs.view_operational` tidak melihat modul `auth`, `users`, `roles`, `settings`. Tidak ada endpoint ubah atau hapus.

### 3.6 Lain-lain

`GET /health` (publik) memeriksa aplikasi dan koneksi database; dipakai health check Docker.

---

## 4. Role dan permission

Empat role sistem di-seed dan tidak dapat dihapus. Permission Super Admin selalu lengkap dan tidak dapat diubah; permission role lain dapat diatur lewat menu Role & Izin.

| Permission | Super Admin | Admin Inventaris | Petugas | Viewer |
|---|:-:|:-:|:-:|:-:|
| `dashboard.view` | ✓ | ✓ | ✓ | ✓ |
| `assets.view` | ✓ | ✓ | ✓ | ✓ |
| `assets.create`, `assets.update`, `assets.archive` | ✓ | ✓ | | |
| `qr.generate` | ✓ | ✓ | | |
| `qr.scan` | ✓ | ✓ | ✓ | ✓ |
| `mutations.view`, `mutations.request` | ✓ | ✓ | ✓ | |
| `mutations.approve` | ✓ | ✓ | | |
| `stock_opnames.manage` | ✓ | ✓ | | |
| `stock_opnames.execute` | ✓ | ✓ | ✓ | |
| `maintenance.manage` | ✓ | ✓ | | |
| `maintenance.report` | ✓ | ✓ | ✓ | |
| `reports.view` | ✓ | ✓ | ✓ | ✓ |
| `reports.full` | ✓ | ✓ | | |
| `users.manage` | ✓ | | | |
| `roles.view` | ✓ | ✓ | | |
| `roles.manage` | ✓ | | | |
| `master_data.view` | ✓ | ✓ | ✓ | ✓ |
| `categories.manage`, `locations.manage`, `departments.manage` | ✓ | ✓ | | |
| `settings.manage` | ✓ | | | |
| `settings.limited` | ✓ | ✓ | | |
| `audit_logs.view_all` | ✓ | | | |
| `audit_logs.view_operational` | ✓ | ✓ | | |

Permission untuk aset, QR, mutasi, stock opname, pemeliharaan, laporan, dan pengaturan sudah ada di katalog agar tahap berikutnya tinggal memakainya. Sumber kebenaran: `backend/src/common/auth/permissions.catalog.ts`.

Mekanisme: guard global `JwtAuthGuard` memverifikasi token dan memuat permission efektif dari database pada setiap permintaan (perubahan role atau penonaktifan langsung berlaku), lalu `PermissionsGuard` mencocokkan dengan `@RequirePermissions(...)` pada handler. Di frontend, menu dan tombol hanya mengikuti permission yang sama; keputusan akhir tetap di server.

---

## 5. Model data

Migrasi: `20261117085857_init` dan `20261118080000_add_user_username`.

| Tabel | Isi |
|---|---|
| `users` | akun: email unik, `username` unik opsional, hash password Argon2id, nama, telepon, unit kerja, `is_active`, login terakhir |
| `roles` | empat role sistem (`is_system`) |
| `permissions` | katalog permission (`code`, `module`, `description`) |
| `user_roles`, `role_permissions` | relasi banyak-ke-banyak |
| `departments` | unit kerja |
| `categories` | kategori barang (9 kategori awal di-seed) |
| `locations` | lokasi berjenjang (`parent_id`, `type` OFFICE/BUILDING/FLOOR/ROOM) |
| `refresh_tokens` | tambahan di luar daftar blueprint: hash SHA-256 refresh token, kedaluwarsa, pencabutan, penerus (rotasi) |
| `audit_logs` | pelaku, aksi, modul, id objek, data sebelum/sesudah (JSON), IP, user agent, waktu |
| `system_settings` | disiapkan untuk konfigurasi (belum dipakai) |

Tabel aset dan turunannya (bab 6 blueprint nomor 9 sampai 22) dibuat di tahapnya masing-masing lewat migrasi terpisah.

---

## 6. Alur autentikasi dan keamanan

- **Password** di-hash Argon2id. Aturan password baru: minimal 8 karakter, mengandung huruf dan angka.
- **Access token**: JWT berumur 15 menit, dikirim di header `Authorization`, disimpan hanya di memori browser (bukan localStorage).
- **Refresh token**: nilai acak 48 byte, tersimpan ter-hash di `refresh_tokens`, dikirim sebagai cookie `oams_refresh` (HttpOnly, Secure di produksi, SameSite=Lax, Path `/api/v1/auth`), umur 7 hari, **diputar** setiap refresh.
- **Deteksi pencurian**: token lama yang dipakai lagi setelah lebih dari 30 detik sejak rotasi, atau token yang sudah logout, mencabut semua sesi pengguna tersebut. Pemakaian ulang di bawah 30 detik dianggap dua tab yang refresh bersamaan dan diizinkan.
- **Pembatasan percobaan login**: 5 kegagalan per menit per akun (email/username), 30 permintaan per menit per alamat IP; refresh dan logout 60 per menit per IP. Batas per IP sengaja longgar karena satu kantor biasanya keluar lewat satu alamat NAT.
- **Validasi**: semua body divalidasi DTO (`whitelist` + `forbidNonWhitelisted`), jadi field asing ditolak. Format error seragam: `{ statusCode, message, errors?, path, timestamp }` dengan pesan Indonesia; pelanggaran unik dari database menjadi 409 dengan nama field.
- **Audit**: setiap perubahan data penting tercatat dengan `before`/`after`; field password selalu dibuang sebelum disimpan. Aksi yang dicatat antara lain `auth.login`, `auth.login_failed`, `auth.logout`, `auth.password_changed`, `user.created|updated|deactivated|activated|password_reset|roles_updated`, `role.permissions_updated`, `category.*`, `department.*`, `location.*`.

---

## 7. Aplikasi web

| Halaman | Siapa | Isi |
|---|---|---|
| `/login` | semua | Login email/username + password (dengan tombol lihat password) |
| `/forgot-password` | semua | Petunjuk menghubungi Super Admin |
| `/dashboard` | semua yang login | Sapaan, kartu jumlah pengguna/kategori/lokasi/unit kerja sesuai izin |
| `/users` | `users.manage` | Tabel, tambah/ubah, atur role, reset password, aktif/nonaktif |
| `/roles` | `roles.view` (+`roles.manage` untuk ubah) | Daftar role dan editor permission per modul |
| `/categories`, `/departments` | `categories.manage` / `departments.manage` | Tabel dengan cari, filter status, dialog tambah/ubah |
| `/locations` | `locations.manage` | Pohon lokasi + panel detail, tambah anak sesuai tingkat |
| `/audit-logs` | izin audit | Filter modul/aksi/tanggal, baris dapat dibuka untuk melihat sebelum/sesudah |
| `/profile` | semua yang login | Data akun dan ganti password |

Perilaku umum: sesi dipulihkan otomatis saat halaman dibuka (refresh cookie); 401 memicu satu kali refresh lalu mengulang permintaan; menu disusun dari `NAV_ITEMS` yang disaring permission; layar sempit memakai drawer. Semua teks berbahasa Indonesia; waktu ditampilkan dalam zona Asia/Jakarta.

---

## 8. Pengujian

| Suite | Jumlah | Catatan |
|---|---|---|
| Backend unit (Vitest) | 40 | filter error, env, audit, guard, password, limiter, aturan lokasi |
| Backend e2e (Vitest + supertest) | 75 | berjalan terhadap PostgreSQL asli yang dinyalakan sementara oleh `test/global-setup.ts`; mencakup login, rotasi/replay token, RBAC, semua modul |
| Frontend (Vitest + Testing Library) | 24 | API client (refresh, dedup, error), navigasi per role, pohon lokasi, form lokasi, input password |

Jalankan semuanya dengan `npm test` dari root. Lint: `npm run lint`. Build produksi: `npm run build`.

---

## 9. Deployment dan operasional

Detail langkah ada di [README](../README.md). Ringkasnya:

- `docker compose up -d --build` menjalankan `postgres`, `backend`, `frontend`, `nginx`, `backup`. PostgreSQL hanya di jaringan internal Docker.
- Saat start, container backend menjalankan `prisma migrate deploy` lalu seed idempoten (role, permission, kategori awal, Super Admin dari `SEED_ADMIN_*`). Seed tidak pernah mengubah password akun yang sudah ada, dan pada role yang sudah ada hanya menambahkan permission yang baru diperkenalkan (permission yang dicabut admin tidak dikembalikan).
- Update: `git pull --ff-only && docker compose up -d --build`.
- Backup `pg_dump` harian ke `./backups` (retensi 14 hari); restore dengan `docker compose run --rm --entrypoint sh backup /scripts/restore.sh <berkas>`.
- Lupa password admin: `docker compose exec backend node dist/database/set-password.js <email|username> <password-baru>`.
- Server saat ini memakai sertifikat self-signed dan alamat IP. Sebelum Tahap 2 (pemindaian QR dengan kamera HP) dibutuhkan domain dengan sertifikat yang dipercaya perangkat.

---

## 10. Keputusan di luar atau melengkapi blueprint

| Keputusan | Alasan |
|---|---|
| Audit log dibangun di Tahap 1 (blueprint: Tahap 4) | semua modul memakainya; menunda berarti merombak semua service |
| Tabel `refresh_tokens` ditambahkan | diperlukan untuk logout nyata, rotasi, dan pencabutan sesi |
| Kolom `users.username` ditambahkan | permintaan pemilik agar login bisa memakai nama singkat selain email |
| Refresh token punya toleransi pemakaian ulang 30 detik | dua tab atau React StrictMode yang refresh bersamaan sempat mematikan sesi; replay di luar jendela tetap mencabut semua sesi |
| Pembatasan login per akun, bukan hanya per IP | satu kantor berbagi satu IP; per IP saja akan mengunci semua orang |
| Seed hanya menambahkan permission baru pada role yang sudah ada | agar pencabutan permission oleh admin tidak dikembalikan diam-diam saat restart |
| Hanya Super Admin yang boleh menetapkan role Super Admin | mencegah pemegang `users.manage` menaikkan dirinya sendiri |
| Image Docker berbasis Debian slim, bukan Alpine | modul native `argon2` dan engine Prisma lebih aman di glibc |
| Frontend tanpa Google Fonts | build di server tidak bergantung internet |

---

## 11. Temuan yang ditunda (dari review akhir Tahap 1)

Tidak menghalangi pemakaian, dicatat untuk dikerjakan saat relevan:

1. Swagger `/api/docs` masih dapat diakses publik di produksi; batasi lewat Nginx atau env.
2. Tabel `refresh_tokens` belum dibersihkan berkala (token kedaluwarsa/dicabut menumpuk).
3. Jendela toleransi refresh 30 detik bisa dipersempit (satu penerus saja, ~10 detik).
4. Pemeriksaan "Super Admin terakhir" belum atomik untuk dua penonaktifan bersamaan.
5. Lokasi aktif masih bisa dipindahkan ke bawah induk nonaktif lewat PATCH.
6. Indeks path lokasi dimuat per permintaan; tinjau saat aset bergabung dengan lokasi.
7. Kode permission yang hilang dari tabel dibuang diam-diam oleh `setPermissions`.
8. Dependensi `@nestjs/config` tidak terpakai.
9. Filter tanggal audit log memakai zona waktu browser, bukan Asia/Jakarta.
10. Menu dropdown belum punya navigasi tombol panah; grup checkbox role belum berupa fieldset.
11. Email login yang gagal untuk akun yang tidak ada ikut tersimpan di audit.
12. Klien tidak mencoba refresh pada 401 dari `/auth/me` (belum dipakai).
13. Test pengguna memulihkan admin seed hanya di `afterAll`.

---

## 12. Lingkungan dan akun

| Lingkungan | Alamat | Database | Akun Super Admin |
|---|---|---|---|
| Lokal (pengembangan) | http://localhost:3000 | PostgreSQL tertanam, `backend/.pgdata` | dari `backend/.env` (`SEED_ADMIN_*`) |
| Server kantor | https://100.89.220.43 (Tailscale), https://192.168.0.242 (LAN) | PostgreSQL di Docker, volume `pgdata` | `admin@oams.local` / username `adminbanteng`; password dikelola pemilik |

Kode kedua lingkungan sama (repo `bantengjson/OAMS`, branch `main`), datanya terpisah.

---

## 13. Langkah berikutnya: Tahap 2

Core Asset Management sesuai blueprint: CRUD inventaris, upload foto dan dokumen, Asset Code otomatis `INV-{TAHUN}-{URUT}`, QR Code (generate, cetak satuan dan massal, regenerate, nonaktifkan), scanner kamera, halaman publik `/a/[token]`, serta endpoint statistik untuk dashboard. Prasyarat non-kode: domain dan sertifikat tepercaya agar kamera HP dapat dipakai.
