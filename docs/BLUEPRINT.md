# TECHNICAL BLUEPRINT
# OFFICE ASSET MANAGEMENT SYSTEM (OAMS)

**Dokumen:** Spesifikasi Teknis Sistem  
**Versi:** 1.0  
**Tanggal:** 17 November 2026  
**Status:** Baseline Pengembangan  
**Platform:** Web Application  
**Arsitektur:** Modular Monolith  

---

# 1. PENDAHULUAN

## 1.1 Latar Belakang

Pengelolaan inventaris kantor membutuhkan sistem pencatatan yang terstruktur agar setiap barang dapat diidentifikasi, dipantau, dan dikelola dengan mudah.

Pencatatan inventaris secara manual berpotensi menimbulkan berbagai permasalahan, seperti kesulitan mengetahui lokasi barang, ketidaksesuaian data inventaris dengan kondisi fisik, kesulitan melacak perpindahan barang, serta tidak tersedianya riwayat pemeliharaan yang terpusat.

Untuk mengatasi permasalahan tersebut, dikembangkan Office Asset Management System (OAMS), yaitu aplikasi manajemen inventaris kantor berbasis web yang menggunakan QR Code sebagai identitas digital setiap barang.

Setiap barang akan memiliki QR Code unik yang ditempelkan pada barang fisik. Ketika QR Code dipindai menggunakan kamera smartphone, pengguna dapat langsung mengakses informasi barang melalui halaman web.

## 1.2 Tujuan Sistem

1. Mendigitalisasi pencatatan inventaris kantor.
2. Memberikan identitas unik kepada setiap barang.
3. Mempermudah pencarian informasi barang melalui QR Code.
4. Memantau lokasi dan penanggung jawab barang.
5. Mencatat perpindahan dan perubahan kondisi barang.
6. Mengelola riwayat pemeliharaan dan perbaikan.
7. Mempermudah proses stock opname.
8. Menyediakan laporan inventaris secara terstruktur.
9. Menyediakan histori aktivitas untuk kebutuhan audit.

## 1.3 Ruang Lingkup

Sistem dikembangkan untuk satu kantor dengan dukungan pengelolaan banyak gedung, lantai, ruangan, dan unit kerja.

Jenis barang yang dikelola mencakup seluruh barang inventaris kantor, antara lain:

- Perangkat elektronik.
- Peralatan komputer dan IT.
- Furniture.
- Peralatan administrasi.
- Peralatan rapat.
- Infrastruktur kantor.
- Kendaraan.
- Peralatan kebersihan.
- Barang inventaris lainnya.

## 1.4 Keputusan Desain

| Aspek | Keputusan |
|---|---|
| Nama Sistem | Office Asset Management System (OAMS) |
| Platform | Web responsif |
| Cakupan | Satu kantor |
| Identifikasi Barang | QR Code |
| Format Stiker | QR Code saja |
| Akses QR | Hybrid (publik dan pengguna login) |
| Mutasi Barang | Memerlukan persetujuan Admin Inventaris |
| Kepemilikan | Milik kantor dan pihak lain |
| Metode Input | Manual dan import Excel |
| Database | PostgreSQL |
| Backend | NestJS |
| Frontend | Next.js |
| Arsitektur | Modular Monolith |
| Deployment | Docker |

---

# 2. GAMBARAN UMUM SISTEM

## 2.1 Konsep Sistem

OAMS merupakan aplikasi terpusat untuk mengelola seluruh siklus inventaris kantor.

Setiap barang memiliki identitas digital berupa:

1. Asset Code: kode inventaris yang dapat dibaca manusia.
2. Public Token: token unik untuk identifikasi QR Code.
3. QR Code: representasi visual yang mengarah ke halaman detail barang.

Contoh:

- Asset Code: INV-2026-0001
- QR URL: https://inventaris.domainkantor.com/a/{public-token}

QR Code tidak menyimpan seluruh informasi barang secara langsung. QR Code hanya menyimpan alamat halaman detail barang dengan token unik.

## 2.2 Alur Registrasi Barang

1. Admin melakukan login.
2. Admin membuka menu inventaris.
3. Admin memilih tambah barang.
4. Admin mengisi informasi barang.
5. Sistem melakukan validasi.
6. Sistem membuat Asset Code otomatis.
7. Sistem membuat Public Token.
8. Sistem menyimpan data barang.
9. Sistem menghasilkan QR Code.
10. Admin mencetak QR Code.
11. Stiker ditempelkan pada barang fisik.

## 2.3 Alur Pemindaian QR Code

1. Pengguna membuka kamera smartphone melalui halaman scanner atau aplikasi kamera bawaan.
2. Pengguna memindai QR Code.
3. Browser membuka URL barang.
4. Sistem memvalidasi token.
5. Sistem menampilkan halaman informasi barang.
6. Jika pengguna belum login, informasi dasar ditampilkan.
7. Jika pengguna sudah login, sistem menampilkan informasi sesuai hak akses.

---

# 3. ROLE DAN HAK AKSES PENGGUNA

Sistem menggunakan Role-Based Access Control (RBAC).

## 3.1 Super Admin

Memiliki akses penuh terhadap seluruh fitur aplikasi.

Kewenangan:

- Mengelola seluruh akun pengguna.
- Mengelola role dan permission.
- Mengelola data inventaris.
- Mengelola kategori dan lokasi.
- Mengelola seluruh QR Code.
- Menyetujui mutasi barang.
- Mengelola pemeliharaan.
- Mengelola stock opname.
- Mengakses seluruh laporan.
- Mengakses audit log.
- Mengelola konfigurasi sistem.

## 3.2 Admin Inventaris

Bertanggung jawab terhadap pengelolaan inventaris kantor.

Kewenangan:

- Menambahkan barang.
- Mengubah data barang.
- Mengarsipkan barang.
- Mengelola kategori.
- Mengelola lokasi.
- Mengelola penanggung jawab.
- Menghasilkan dan mencetak QR Code.
- Mengelola import dan export.
- Menyetujui atau menolak pengajuan mutasi.
- Mengelola pemeliharaan.
- Mengelola stock opname.
- Membuat laporan inventaris.
- Melihat audit log operasional sesuai izin.

## 3.3 Petugas Inventaris

Bertugas melakukan pemeriksaan dan pencatatan kondisi barang.

Kewenangan:

- Melihat informasi barang.
- Memindai QR Code.
- Melakukan stock opname.
- Memeriksa kondisi barang.
- Melaporkan kerusakan.
- Mengajukan mutasi barang.
- Melihat status pengajuan mutasi.

Petugas tidak dapat langsung mengubah lokasi barang atau menyetujui mutasi.

## 3.4 Viewer

Pengguna dengan akses baca.

Kewenangan:

- Melihat informasi inventaris yang diizinkan.
- Melihat daftar barang sesuai izin.
- Melihat laporan yang diberikan aksesnya.

Viewer tidak dapat mengubah data.

## 3.5 Matriks Hak Akses

| Fitur | Super Admin | Admin | Petugas | Viewer |
|---|---|---|---|---|
| Dashboard | Full | Full | Terbatas | Terbatas |
| Melihat Inventaris | Ya | Ya | Ya | Ya |
| Tambah Barang | Ya | Ya | Tidak | Tidak |
| Edit Barang | Ya | Ya | Tidak | Tidak |
| Arsip Barang | Ya | Ya | Tidak | Tidak |
| Generate QR | Ya | Ya | Tidak | Tidak |
| Scan QR | Ya | Ya | Ya | Ya |
| Mutasi Barang | Approve | Approve | Request | Tidak |
| Stock Opname | Ya | Ya | Ya | Tidak |
| Maintenance | Ya | Ya | Pelaporan | Tidak |
| Laporan | Full | Ya | Terbatas | Sesuai izin |
| Pengguna | Ya | Tidak | Tidak | Tidak |
| Pengaturan | Ya | Terbatas | Tidak | Tidak |
| Audit Log | Full | Operasional | Tidak | Tidak |

---

# 4. MODUL APLIKASI

## 4.1 Dashboard

Menampilkan ringkasan kondisi inventaris kantor.

Informasi:

- Total barang.
- Barang aktif.
- Barang tersedia.
- Barang digunakan.
- Barang rusak.
- Barang dalam perbaikan.
- Barang dipinjam.
- Barang hilang.
- Jumlah kategori.
- Jumlah lokasi.
- Aktivitas terbaru.
- Pengajuan mutasi yang menunggu persetujuan.

Dashboard menyediakan grafik berdasarkan kategori, kondisi, lokasi, dan status barang.

## 4.2 Manajemen Inventaris

Modul utama untuk melakukan pengelolaan seluruh barang.

Fitur:

- Daftar inventaris.
- Tambah barang.
- Edit barang.
- Detail barang.
- Upload foto.
- Upload dokumen.
- Pencarian barang.
- Filter kategori.
- Filter lokasi.
- Filter kondisi.
- Filter status.
- Filter kepemilikan.
- Arsip barang.

## 4.3 QR Code Management

Fitur:

- Generate QR Code otomatis.
- Preview QR Code.
- Download QR Code.
- Cetak QR Code satuan.
- Cetak QR Code massal.
- Regenerate token.
- Menonaktifkan QR Code.
- Mencetak ulang QR Code.

Stiker hanya menampilkan QR Code tanpa teks tambahan.

Ukuran awal yang direkomendasikan adalah 30 × 30 mm atau 40 × 40 mm dan harus diuji dengan printer serta material stiker.

## 4.4 Scan Inventaris

Scanner menggunakan kamera smartphone melalui browser.

Fitur:

- Aktivasi kamera.
- Pemindaian QR Code.
- Identifikasi barang.
- Redirect menuju halaman detail barang.
- Input token secara manual jika kamera tidak tersedia.

Scanner membutuhkan HTTPS untuk akses kamera pada browser modern.

## 4.5 Manajemen Lokasi

Struktur lokasi:

Kantor → Gedung → Lantai → Ruangan.

Fitur:

- Tambah lokasi.
- Edit lokasi.
- Nonaktifkan lokasi.
- Melihat daftar barang pada lokasi.
- Melihat riwayat penggunaan lokasi.

Lokasi yang sudah memiliki riwayat barang tidak boleh dihapus secara permanen melalui dashboard.

## 4.6 Manajemen Penanggung Jawab

Fitur:

- Menentukan penanggung jawab barang.
- Mengganti penanggung jawab.
- Melihat barang berdasarkan penanggung jawab.
- Melihat riwayat pergantian penanggung jawab.

Setiap perubahan penanggung jawab harus dicatat dalam histori.

## 4.7 Mutasi Barang

Perpindahan barang wajib mendapatkan persetujuan Admin Inventaris atau Super Admin.

Alur:

1. Petugas memilih barang.
2. Petugas membuat pengajuan mutasi.
3. Petugas menentukan lokasi tujuan.
4. Petugas menentukan penanggung jawab baru jika ada.
5. Sistem menyimpan pengajuan dengan status Pending.
6. Admin melakukan pemeriksaan.
7. Admin menyetujui atau menolak pengajuan.
8. Jika disetujui, sistem memperbarui lokasi dan penanggung jawab.
9. Sistem menyimpan riwayat mutasi.

Status mutasi:

- Draft.
- Pending.
- Approved.
- Rejected.
- Cancelled.

Pengajuan mutasi yang masih Pending tidak boleh mengubah lokasi aktual barang.

## 4.8 Pemeriksaan Kondisi Barang

Kondisi barang:

- Baik.
- Rusak Ringan.
- Rusak Berat.
- Tidak Layak Pakai.

Fitur:

- Pemeriksaan kondisi.
- Pelaporan kerusakan.
- Upload foto kerusakan.
- Catatan pemeriksaan.
- Riwayat kondisi.

Kondisi barang harus dipisahkan dari status operasional barang.

## 4.9 Stock Opname

Fitur:

- Membuat sesi stock opname.
- Menentukan periode.
- Menentukan lokasi pemeriksaan.
- Menentukan petugas.
- Scan QR Code.
- Konfirmasi kondisi.
- Konfirmasi lokasi.
- Mencatat hasil pemeriksaan.
- Menampilkan barang belum ditemukan.
- Menampilkan barang tidak terdaftar.
- Membuat laporan hasil pemeriksaan.

Kategori hasil:

1. Sesuai.
2. Lokasi berbeda.
3. Kondisi berbeda.
4. Barang tidak ditemukan.
5. Barang tidak terdaftar.

Satu barang hanya boleh dihitung satu kali dalam satu sesi stock opname.

## 4.10 Pemeliharaan Barang

Fitur:

- Laporan kerusakan.
- Riwayat perbaikan.
- Catatan teknisi.
- Biaya pemeliharaan.
- Dokumentasi foto.
- Tanggal perbaikan.
- Status pekerjaan.

Status pemeliharaan:

- Reported.
- In Progress.
- Completed.
- Cancelled.

## 4.11 Manajemen Kepemilikan dan Peminjaman

Jenis kepemilikan:

- Milik Kantor.
- Milik Pihak Ketiga.

Metode perolehan:

- Pembelian.
- Hibah.
- Pinjaman.
- Metode lainnya.

Data tambahan barang pinjaman:

- Nama pemilik.
- Kontak pemilik.
- Tanggal mulai pinjam.
- Tanggal rencana pengembalian.
- Tanggal pengembalian aktual.
- Dokumen perjanjian.
- Status pinjaman.

Barang pinjaman harus mempunyai riwayat peminjaman yang dapat ditelusuri.

## 4.12 Import dan Export Excel

Metode input barang:

1. Input manual melalui formulir.
2. Import melalui file Excel.

Alur import:

1. Admin mengunduh template.
2. Admin mengisi data barang.
3. Admin mengunggah file.
4. Sistem memvalidasi format dan data.
5. Sistem menampilkan preview.
6. Sistem menampilkan baris yang valid dan tidak valid.
7. Admin mengonfirmasi import.
8. Sistem menyimpan data.
9. Sistem menghasilkan Asset Code dan QR Code.

ID inventaris tidak boleh ditentukan melalui Excel karena dibuat otomatis oleh sistem.

## 4.13 Laporan

Jenis laporan:

- Rekap seluruh inventaris.
- Inventaris berdasarkan kategori.
- Inventaris berdasarkan lokasi.
- Inventaris berdasarkan kondisi.
- Inventaris berdasarkan status.
- Inventaris berdasarkan penanggung jawab.
- Laporan pengadaan.
- Laporan mutasi.
- Laporan pemeliharaan.
- Laporan stock opname.
- Laporan barang pinjaman.
- Laporan penghapusan barang.

Format ekspor:

- PDF.
- Excel.
- CSV.

## 4.14 Manajemen Pengguna

Fitur:

- Tambah pengguna.
- Edit pengguna.
- Nonaktifkan pengguna.
- Reset password.
- Penetapan role.
- Pengaturan permission.
- Riwayat aktivitas pengguna.

## 4.15 Audit Log

Mencatat:

- Pengguna yang melakukan aktivitas.
- Jenis tindakan.
- Modul yang diakses.
- ID objek terkait.
- Data sebelum perubahan.
- Data setelah perubahan.
- Waktu aktivitas.
- Informasi sumber akses yang relevan.

Audit log bersifat append-only dan tidak dapat diubah melalui dashboard operasional.

---

# 5. STRUKTUR DATA BARANG

## 5.1 Identitas Barang

Setiap barang memiliki kode inventaris unik.

Format:

INV-{TAHUN}-{NOMOR_URUT}

Contoh:

- INV-2026-0001
- INV-2026-0002
- INV-2026-0003

Aturan:

- Dibuat otomatis.
- Tidak boleh duplikat.
- Tidak boleh digunakan kembali.
- Tidak berubah ketika barang berpindah.
- Tidak berubah ketika penanggung jawab berganti.
- Tetap tersimpan ketika barang diarsipkan.

## 5.2 Atribut Barang

| Field | Keterangan | Wajib |
|---|---|---|
| asset_code | Kode inventaris | Otomatis |
| name | Nama barang | Ya |
| category_id | Kategori | Ya |
| brand | Merek | Tidak |
| model | Tipe/model | Tidak |
| serial_number | Nomor seri | Tidak |
| description | Deskripsi | Tidak |
| ownership_type | Kepemilikan | Ya |
| acquisition_method | Metode perolehan | Ya |
| acquisition_date | Tanggal perolehan | Tidak |
| purchase_price | Harga perolehan | Tidak |
| vendor | Penyedia | Tidak |
| location_id | Lokasi | Ya |
| department_id | Unit kerja | Tidak |
| condition | Kondisi | Ya |
| status | Status operasional | Ya |
| responsible_user_id | Penanggung jawab | Tidak |
| notes | Catatan internal | Tidak |

Barang dapat memiliki lebih dari satu foto dan dokumen pendukung.

## 5.3 Kategori Barang

Kategori awal:

1. Elektronik.
2. Komputer dan IT.
3. Furniture.
4. Peralatan Administrasi.
5. Peralatan Rapat.
6. Infrastruktur.
7. Kendaraan.
8. Peralatan Kebersihan.
9. Lainnya.

Kategori harus dapat ditambahkan dan dikelola melalui dashboard.

## 5.4 Status Barang

- Available.
- In Use.
- Stored.
- Borrowed.
- Under Maintenance.
- Missing.
- Disposed.
- Returned.

## 5.5 Kondisi Barang

- Good.
- Minor Damage.
- Major Damage.
- Unusable.

---

# 6. STRUKTUR DATABASE

Database menggunakan PostgreSQL dengan UUID sebagai primary key.

Daftar tabel:

| No. | Nama Tabel | Fungsi |
|---|---|---|
| 1 | users | Pengguna |
| 2 | roles | Role |
| 3 | permissions | Permission |
| 4 | user_roles | Relasi pengguna dan role |
| 5 | role_permissions | Relasi role dan permission |
| 6 | departments | Unit kerja |
| 7 | categories | Kategori barang |
| 8 | locations | Lokasi |
| 9 | assets | Data utama barang |
| 10 | asset_labels | Identitas QR |
| 11 | asset_photos | Foto barang |
| 12 | asset_documents | Dokumen barang |
| 13 | asset_assignments | Riwayat penanggung jawab |
| 14 | asset_mutations | Pengajuan dan riwayat mutasi |
| 15 | asset_condition_logs | Riwayat kondisi |
| 16 | maintenance_records | Pemeliharaan |
| 17 | stock_opnames | Sesi stock opname |
| 18 | stock_opname_items | Hasil pemeriksaan |
| 19 | asset_disposals | Pelepasan barang |
| 20 | asset_loans | Riwayat pinjaman |
| 21 | import_jobs | Riwayat import |
| 22 | import_job_rows | Hasil setiap baris import |
| 23 | audit_logs | Aktivitas pengguna |
| 24 | system_settings | Konfigurasi sistem |

## 6.1 Aturan Database

- Menggunakan UUID sebagai primary key.
- Asset Code mempunyai unique constraint.
- Public Token mempunyai unique constraint.
- Foreign key digunakan untuk menjaga integritas relasi.
- Timestamp disimpan dalam UTC.
- Waktu ditampilkan menggunakan zona Asia/Jakarta.
- Barang menggunakan soft delete atau status arsip.
- Transaksi mutasi menggunakan database transaction.
- Perubahan kondisi memiliki histori tersendiri.
- Perubahan penanggung jawab memiliki histori tersendiri.
- Audit log tidak dapat dihapus melalui aplikasi.

---

# 7. API SPECIFICATION

Base URL:

`/api/v1`

## 7.1 Authentication

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | /auth/login | Login |
| POST | /auth/refresh | Refresh token |
| POST | /auth/logout | Logout |
| GET | /auth/me | Profil pengguna |
| PATCH | /auth/change-password | Ganti password |

## 7.2 Assets

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | /assets | Daftar barang |
| POST | /assets | Tambah barang |
| GET | /assets/:id | Detail barang |
| PATCH | /assets/:id | Edit barang |
| POST | /assets/:id/archive | Arsip barang |
| GET | /assets/:id/history | Riwayat barang |
| GET | /assets/statistics | Statistik inventaris |

## 7.3 QR Code

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | /assets/:id/qr | Informasi QR |
| POST | /assets/:id/qr/regenerate | Regenerasi token |
| GET | /assets/:id/qr/download | Download QR |
| POST | /qr/bulk-generate | Generate massal |
| GET | /qr/public/:token | Detail publik |

## 7.4 Locations dan Categories

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | /locations | Daftar lokasi |
| POST | /locations | Tambah lokasi |
| PATCH | /locations/:id | Edit lokasi |
| GET | /categories | Daftar kategori |
| POST | /categories | Tambah kategori |
| PATCH | /categories/:id | Edit kategori |

## 7.5 Mutations

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | /mutations | Daftar mutasi |
| POST | /mutations | Ajukan mutasi |
| GET | /mutations/:id | Detail mutasi |
| POST | /mutations/:id/approve | Setujui |
| POST | /mutations/:id/reject | Tolak |
| POST | /mutations/:id/cancel | Batalkan |

## 7.6 Stock Opname

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | /stock-opnames | Daftar sesi |
| POST | /stock-opnames | Buat sesi |
| GET | /stock-opnames/:id | Detail sesi |
| POST | /stock-opnames/:id/start | Mulai |
| POST | /stock-opnames/:id/scan | Scan barang |
| POST | /stock-opnames/:id/complete | Selesaikan |
| GET | /stock-opnames/:id/report | Laporan |

## 7.7 Modul Lainnya

- /users
- /roles
- /permissions
- /maintenance
- /asset-loans
- /asset-disposals
- /imports
- /reports
- /audit-logs
- /dashboard
- /settings

Semua endpoint harus mempunyai validasi, autentikasi, dan otorisasi sesuai kebutuhan.

---

# 8. STRUKTUR PROJECT

Repository menggunakan pendekatan monorepo.

```text
oams/
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── hooks/
│   ├── lib/
│   └── types/
│
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── roles/
│   │   │   ├── assets/
│   │   │   ├── qr/
│   │   │   ├── categories/
│   │   │   ├── locations/
│   │   │   ├── mutations/
│   │   │   ├── maintenance/
│   │   │   ├── stock-opnames/
│   │   │   ├── reports/
│   │   │   ├── imports/
│   │   │   └── audit-logs/
│   │   │
│   │   └── common/
│   │
│   ├── prisma/
│   └── test/
│
├── infrastructure/
│   ├── docker/
│   ├── nginx/
│   └── postgres/
│
├── docker-compose.yml
├── .env.example
├── README.md
└── .gitignore
```

Prinsip:

- Frontend dan backend terpisah.
- Backend menggunakan modular architecture.
- Controller menangani HTTP request.
- Service menangani business logic.
- DTO menangani validasi request.
- Database diakses melalui Prisma.
- Seluruh API didokumentasikan menggunakan Swagger.

---

# 9. RANCANGAN HALAMAN APLIKASI

## 9.1 Halaman Publik

- /a/[token] : Detail barang publik.

## 9.2 Halaman Autentikasi

- /login
- /forgot-password

## 9.3 Dashboard

- /dashboard

## 9.4 Inventaris

- /assets
- /assets/create
- /assets/[id]
- /assets/[id]/edit

## 9.5 QR Management

- /scan
- /qr/print

## 9.6 Pengelolaan

- /categories
- /locations
- /mutations
- /stock-opnames
- /maintenance
- /asset-loans

## 9.7 Laporan dan Administrasi

- /reports
- /users
- /roles
- /audit-logs
- /settings

Navigasi dan tindakan harus menyesuaikan role serta permission pengguna.

---

# 10. KEAMANAN SISTEM

Ketentuan keamanan:

1. Seluruh koneksi menggunakan HTTPS.
2. Password menggunakan Argon2id.
3. Access token dan refresh token dikelola secara aman.
4. Refresh token menggunakan cookie HttpOnly, Secure, dan konfigurasi SameSite yang sesuai.
5. Setiap endpoint memvalidasi permission.
6. Endpoint publik hanya mengembalikan informasi yang diizinkan.
7. Public Token harus menggunakan nilai acak yang sulit ditebak.
8. Login dan endpoint publik menggunakan rate limiting.
9. Upload file harus melalui validasi MIME type dan ukuran.
10. Database tidak boleh diekspos langsung ke internet.
11. Audit log mencatat aktivitas penting.
12. Backup database dilakukan secara berkala.
13. Backup disimpan terpisah dari server utama.
14. Pemulihan backup harus diuji secara berkala.

---

# 11. DEPLOYMENT

Deployment menggunakan Docker Compose.

Komponen:

1. Nginx Reverse Proxy.
2. Next.js Frontend.
3. NestJS Backend.
4. PostgreSQL.
5. File Storage.

Arsitektur:

```text
Internet / Jaringan Kantor
          |
          v
    Nginx Reverse Proxy
          |
     +----+----+
     |         |
     v         v
  Next.js    NestJS
  :3000      :4000
                |
                v
            PostgreSQL
                |
                v
            File Storage
```

Ketentuan:

- PostgreSQL hanya dapat diakses melalui jaringan internal.
- Backend menjadi satu-satunya jalur akses database.
- File Storage tidak boleh terbuka secara langsung tanpa kontrol akses.
- HTTPS wajib digunakan.
- Backup dilakukan otomatis.
- Environment variable digunakan untuk menyimpan konfigurasi sensitif.

---

# 12. ROADMAP PENGEMBANGAN

## Tahap 1 — Foundation

- Setup repository.
- Setup Docker.
- Setup database.
- Setup Prisma.
- Authentication.
- Authorization.
- User Management.
- Categories.
- Locations.

## Tahap 2 — Core Asset Management

- CRUD Inventaris.
- Upload Foto.
- Asset Code Generator.
- QR Code Generator.
- QR Scanner.
- Public Asset Viewer.
- QR Printing.

## Tahap 3 — Asset Operations

- Kepemilikan Barang.
- Asset Loans.
- Penanggung Jawab.
- Mutation Management.
- Approval Mutasi.
- Condition Management.
- Asset History.

## Tahap 4 — Audit dan Maintenance

- Stock Opname.
- Maintenance.
- Asset Disposal.
- Audit Log.

## Tahap 5 — Reporting dan Deployment

- Dashboard Analitik.
- Import Excel.
- Export Excel.
- Export PDF.
- Security Testing.
- Backup.
- Production Deployment.

---

# 13. ACCEPTANCE CRITERIA

Sistem dinyatakan siap digunakan apabila:

1. Admin dapat mendaftarkan barang.
2. Setiap barang mendapatkan Asset Code unik.
3. Setiap barang memiliki QR Code.
4. QR Code dapat dipindai menggunakan kamera HP.
5. Informasi publik dan privat dapat dibedakan.
6. Pengguna hanya dapat mengakses fitur sesuai role.
7. Perpindahan barang memerlukan persetujuan.
8. Riwayat mutasi tersimpan.
9. Perubahan kondisi tersimpan.
10. Import Excel dapat melakukan validasi.
11. Stock opname dapat mencocokkan data dengan barang fisik.
12. Riwayat aktivitas dapat ditelusuri.
13. Laporan dapat diekspor.
14. Backup dapat dipulihkan.
15. Aplikasi dapat digunakan melalui desktop dan smartphone.

---

# 14. KETENTUAN PENGEMBANGAN

Seluruh pengembangan wajib mengikuti ketentuan berikut:

1. Mengikuti blueprint sebagai acuan utama.
2. Tidak mengubah keputusan arsitektur tanpa alasan teknis yang jelas.
3. Menggunakan TypeScript pada frontend dan backend.
4. Mengutamakan modularitas dan pemisahan tanggung jawab.
5. Menggunakan database migration untuk perubahan struktur.
6. Menggunakan validasi pada frontend dan backend.
7. Memastikan seluruh perubahan data penting tercatat.
8. Tidak menghapus histori transaksi.
9. Memisahkan data publik dan internal.
10. Menguji setiap modul sebelum melanjutkan ke modul berikutnya.
11. Memperbarui dokumentasi ketika ada perubahan spesifikasi.

---

# 15. PENUTUP

Office Asset Management System dirancang sebagai sistem pengelolaan inventaris kantor terpusat dengan identitas barang berbasis QR Code.

Sistem tidak hanya berfungsi sebagai pencatatan daftar barang, tetapi juga mendukung pengelolaan lokasi, kepemilikan, penanggung jawab, perpindahan, pemeriksaan kondisi, pemeliharaan, stock opname, dan pelaporan.

Dengan pendekatan modular monolith, sistem dapat dikembangkan secara bertahap tanpa harus membangun infrastruktur yang kompleks sejak awal.

Dokumen ini menjadi baseline spesifikasi teknis untuk memulai proses perancangan database, implementasi backend, pengembangan frontend, pengujian, dan deployment.

**END OF DOCUMENT**
