# OAMS Tahap 3 (Asset Operations) — Desain

Tanggal: 19 November 2026
Acuan: [docs/BLUEPRINT.md](../../BLUEPRINT.md) bab 3.5, 4.1, 4.6, 4.7, 4.8, 5.4–5.5, 6, 7.5, 12 "Tahap 3". Dibangun di atas [Tahap 1](../../tahap-1-foundation.md) dan [Tahap 2](../../tahap-2-core-assets.md).

## 1. Maksud

Barang yang sudah tercatat (Tahap 2) kini bisa **berpindah** (mutasi lokasi dan penanggung jawab dengan persetujuan), **dipinjam keluar** oleh karyawan dan orang dekat karyawan, dan **diperiksa kondisinya**, dengan setiap perubahan tercatat dalam riwayat yang dapat ditelusuri. Agar penanggung jawab dan peminjam bisa dipilih dari daftar, ditambahkan data master **Pegawai** yang terpisah dari akun login.

Mengapa sekarang: kebutuhan harian kantor pemilik adalah tahu barang ada di mana, dipegang siapa, dipinjam siapa, dan kondisinya apa. Tahap 2 baru menjawab "barang apa saja".

## 2. Tujuan

- Data master Pegawai (CRUD oleh Admin), dipakai sebagai penanggung jawab barang, peminjam, dan penjamin.
- Penanggung jawab barang menunjuk ke Pegawai (bukan lagi ke akun pengguna), dengan riwayat pergantian tersendiri.
- Mutasi barang: pengajuan (lokasi tujuan dan/atau penanggung jawab baru, alasan), persetujuan/penolakan oleh Admin, pembatalan oleh pengaju, daftar dan detail. Semua perpindahan lokasi dan pergantian penanggung jawab hanya lewat mutasi.
- Peminjaman keluar: catat pinjam, catat kembali (dengan kondisi saat kembali), perpanjang rencana kembali, daftar aktif/terlambat/selesai, status barang `BORROWED` selama dipinjam.
- Pemeriksaan kondisi: catat kondisi baru dengan catatan dan foto kerusakan, riwayat kondisi; kondisi barang mengikuti pemeriksaan terakhir.
- Tab Riwayat barang menjadi satu linimasa yang memuat mutasi, pergantian penanggung jawab, pinjam/kembali, pemeriksaan kondisi, di samping aksi Tahap 2.
- Dashboard: kartu "Mutasi menunggu persetujuan", "Pinjaman aktif", "Pinjaman terlambat".

## 3. Bukan tujuan

- Peminjaman barang **oleh** kantor dari pihak ketiga (bab 4.11): pemilik menegaskan barang pinjaman dari luar tidak masuk inventaris. Kolom `ownershipType` dan `acquisitionMethod` tetap ada sebagai atribut barang, tanpa alur khusus.
- Status `Draft` mutasi: formulir pendek diisi sekali jadi, langsung `PENDING`.
- Notifikasi e-mail/push: blueprint tidak memintanya; cukup kartu dashboard.
- Pemeliharaan, status `UNDER_MAINTENANCE`/`MISSING`/`DISPOSED`, stock opname, laporan, ekspor, import pegawai dari Excel (Tahap 4–5).
- Portal peminjam (peminjam mengajukan sendiri lewat aplikasi): peminjaman dicatat petugas saat barang diserahkan.

## 4. Anti-tujuan

- Perpindahan atau pergantian penanggung jawab yang tidak muncul di riwayat mutasi (karena itu formulir ubah barang kehilangan kolom lokasi, penanggung jawab, dan kondisi).
- Dua pinjaman aktif atau dua mutasi menunggu untuk satu barang.
- Mengharuskan setiap karyawan punya akun login hanya agar bisa jadi peminjam atau penanggung jawab.

## 5. Keputusan yang disetujui pemilik (19 Nov 2026)

1. Peminjaman = barang kantor dipinjam orang lain; kantor meminjam dari luar tidak dicatat.
2. Peminjam umumnya karyawan, kadang orang dekat karyawan; tidak dibuka ke vendor/orang luar lepas.
3. Karyawan dipilih dari **daftar pegawai** yang akan diisi Admin; orang luar diketik bebas. Tidak semua karyawan punya akun, akun dibuat Admin bila perlu.
4. Semua perpindahan lewat mutasi, termasuk oleh Admin, agar tercatat.
5. Usulan berikut diterima tanpa koreksi: peminjaman tanpa persetujuan berjenjang; penjamin wajib untuk peminjam bukan karyawan; penanggung jawab beralih ke pegawai; `Draft` dilewati; kondisi hanya lewat pemeriksaan; status `Dipinjam` hanya diatur peminjaman; status `Dikembalikan` tidak dipakai untuk barang; riwayat satu linimasa; kartu dashboard mutasi dan pinjaman; pembagian hak akses pada bagian 9.

## 6. Pendekatan yang dipertimbangkan

| Pendekatan | Kelebihan | Kekurangan | Keputusan |
|---|---|---|---|
| **A. Tabel per fitur sesuai blueprint (`employees`, `asset_mutations`, `asset_loans`, `asset_condition_logs`, `asset_assignments`), linimasa dibaca dari audit log** | Aturan "satu aktif per barang" dijaga indeks basis data; laporan Tahap 5 membaca kolom rapi; tab Riwayat Tahap 2 hanya diperluas | Lebih banyak tabel dan modul | **Dipilih** |
| B. Satu tabel kejadian umum `asset_events` (jenis + JSON) | Sedikit tabel, linimasa sepele | Aturan unik harus di kode; laporan membongkar JSON; melawan kebutuhan laporan blueprint | Ditolak |
| C. Linimasa dari tabel gabungan (`UNION` lima tabel) alih-alih audit log | Tidak bergantung audit | Audit log sudah mencatat semua aksi dengan `entityId`; UNION menggandakan kerja | Ditolak |

## 7. Model data

Konvensi sama dengan Tahap 1–2: UUID, `snake_case` di DB, `timestamptz`, soft delete lewat `is_active` untuk data master.

### 7.1 `employees` (baru)

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| employee_number | varchar(30) unique null | NIP/nomor pegawai, opsional |
| full_name | varchar(150) | wajib |
| department_id | uuid FK departments null | unit kerja |
| position | varchar(100) null | jabatan |
| phone | varchar(30) null | |
| email | varchar(255) null | |
| user_id | uuid FK users unique null | tautan ke akun login bila ada |
| is_active | boolean default true | pegawai keluar dinonaktifkan |
| created_at, updated_at | | |

Indeks: `full_name`, `department_id`, `is_active`. Pencarian: nama, nomor pegawai.

`user_id` pada tahap ini hanya **penanda "punya akun"**: Admin dapat menautkan/melepas akun lewat pemilih pengguna (`GET /users/lookup` yang sudah ada) di formulir pegawai; satu akun hanya boleh tertaut ke satu pegawai (409 bila sudah terpakai). Belum ada perilaku lain (misalnya "barang saya"); itu menyusul bila dibutuhkan. Unit kerja pegawai dan unit kerja akun tidak disinkronkan.

### 7.2 Perubahan `assets`

- `responsible_user_id` **dihapus**, diganti `responsible_employee_id uuid FK employees null` (+ indeks). Data penanggung jawab lama tidak dimigrasikan: di server hanya ada barang uji, di lokal data uji.
- Kolom `location_id`, `responsible_employee_id`, `condition` tidak lagi boleh diubah lewat `PATCH /assets/:id` (lihat 8.2).
- `department_id` barang **tetap independen** dari unit kerja penanggung jawab (keputusan builder): barang milik unit tertentu bisa dipegang pegawai unit lain, dan laporan per unit (Tahap 5) mengacu ke unit pemilik barang. Formulir mutasi tidak menyentuhnya; `PATCH /assets/:id` tetap boleh mengubahnya.
- **Arsip**: `POST /assets/:id/archive` menolak 409 selama ada pinjaman `ACTIVE` atau mutasi `PENDING` ("Kembalikan pinjaman / selesaikan mutasi dulu"). Dengan begitu barang arsip tidak pernah berstatus `BORROWED` dan kartu dashboard tidak menghitung barang arsip.

### 7.3 `asset_assignments` (baru) — riwayat penanggung jawab

| Kolom | Keterangan |
|---|---|
| id | |
| asset_id FK | |
| from_employee_id FK null | penanggung jawab sebelumnya |
| to_employee_id FK null | penanggung jawab baru (null = dilepas) |
| source | enum `AssignmentSource`: `CREATE`, `MUTATION` |
| mutation_id FK asset_mutations null | bila dari mutasi |
| note | text null | alasan mutasi disalin |
| changed_by_id FK users | |
| created_at | |

Satu baris ditulis saat barang dibuat dengan penanggung jawab, dan setiap mutasi yang mengubah penanggung jawab disetujui.

### 7.4 `asset_mutations` (baru)

| Kolom | Keterangan |
|---|---|
| id | |
| asset_id FK | |
| status | enum `MutationStatus`: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` |
| from_location_id FK | lokasi saat diajukan |
| to_location_id FK null | null = lokasi tidak berubah |
| changes_responsible | boolean | membedakan "tidak diubah" dari "dilepas" |
| from_responsible_employee_id FK null | |
| to_responsible_employee_id FK null | berlaku bila `changes_responsible` |
| reason | text | wajib |
| requested_by_id FK users | |
| requested_at | |
| decided_by_id FK users null | |
| decided_at | null |
| decision_note | text null | wajib saat ditolak |
| cancelled_at | null |
| created_at, updated_at | |

Aturan: minimal satu dari `to_location_id` / `changes_responsible` terisi, dan harus berbeda dari nilai saat ini. **Indeks unik parsial** `(asset_id) WHERE status = 'PENDING'` lewat SQL migrasi (Prisma tidak mendukung partial unique). Indeks `status, requested_at`, `requested_by_id`.

### 7.5 `asset_loans` (baru)

| Kolom | Keterangan |
|---|---|
| id | |
| asset_id FK | |
| status | enum `LoanStatus`: `ACTIVE`, `RETURNED` |
| borrower_type | enum `BorrowerType`: `EMPLOYEE`, `EXTERNAL` |
| borrower_employee_id FK employees null | wajib bila `EMPLOYEE` |
| borrower_name | varchar(150) | selalu diisi (salinan nama pegawai, atau ketikan bebas) |
| borrower_department_id FK null | otomatis dari pegawai; untuk `EXTERNAL` opsional |
| borrower_contact | varchar(100) null | |
| guarantor_employee_id FK employees null | wajib bila `EXTERNAL` |
| purpose | text null | keperluan |
| loaned_at | date | |
| due_at | date | rencana kembali, ≥ `loaned_at` |
| returned_at | timestamptz null | |
| return_condition | `AssetCondition` null | |
| return_notes | text null | |
| previous_status | `AssetStatus` | status barang sebelum dipinjam, dikembalikan saat selesai |
| recorded_by_id FK users | |
| returned_by_id FK users null | |
| created_at, updated_at | |

**Indeks unik parsial** `(asset_id) WHERE status = 'ACTIVE'`. "Terlambat" bukan status tersimpan: `ACTIVE` dan `due_at < hari ini (Asia/Jakarta)`. Indeks `status, due_at`.

### 7.6 `asset_condition_logs` (baru)

| Kolom | Keterangan |
|---|---|
| id | |
| asset_id FK | |
| condition | `AssetCondition` | kondisi hasil pemeriksaan |
| previous_condition | `AssetCondition` null | |
| notes | text null | |
| checked_at | date | default hari ini |
| source | enum `ConditionSource`: `CREATE`, `MANUAL`, `LOAN_RETURN` |
| loan_id FK asset_loans null | |
| checked_by_id FK users | |
| created_at | |

Foto kerusakan: `asset_photos` mendapat kolom `condition_log_id uuid FK null`. Foto pemeriksaan tetap tampil di galeri barang (itu foto barang yang sah) dan juga di rincian pemeriksaan. Foto pemeriksaan tidak otomatis jadi foto utama.

Satu baris `CREATE` ditulis saat barang dibuat (kondisi awal dari formulir). Setiap pemeriksaan memperbarui `assets.condition`.

### 7.7 Enum yang ada

`AssetStatus` tetap; `RETURNED` dibiarkan di enum tetapi tidak ditawarkan di formulir dan ditolak validasi `PATCH`. `BORROWED` tidak boleh dipilih manual (hanya oleh peminjaman).

## 8. Endpoint backend

Semua di bawah `/api/v1`, format error, paginasi, dan audit sama dengan Tahap 2.

### 8.1 Pegawai

| Method | Path | Permission | Catatan |
|---|---|---|---|
| GET | /employees | `master_data.view` | paginasi; filter `search`, `departmentId`, `isActive` |
| GET | /employees/lookup?search= | `master_data.view` | ringkas, aktif saja, maks 20, untuk pemilih |
| GET | /employees/:id | `master_data.view` | termasuk jumlah barang yang dipegang dan pinjaman aktif |
| POST | /employees | `employees.manage` | |
| PATCH | /employees/:id | `employees.manage` | termasuk `isActive`; menonaktifkan tidak melepas barang yang dipegang |
| GET | /assets?responsibleEmployeeId= | `assets.view` | menggantikan filter `responsibleUserId` |

### 8.2 Perubahan `assets`

- `POST /assets`: `responsibleUserId` → `responsibleEmployeeId`; membuat baris `asset_assignments` (`CREATE`) bila terisi dan baris `asset_condition_logs` (`CREATE`).
- `PATCH /assets/:id`: `locationId`, `responsibleEmployeeId`, `condition` **ditolak** dengan 400 `Validasi gagal.` dan pesan per kolom "Ubah lewat mutasi" / "Ubah lewat pemeriksaan kondisi"; `status` menolak `BORROWED` dan `RETURNED` ("Status ini diatur oleh peminjaman"); `status` apa pun ditolak 409 saat barang sedang dipinjam.
- `GET /assets/:id` menambah `responsibleEmployee {id, fullName, department}`, `activeLoan` (ringkas, null bila tidak ada), `pendingMutation` (ringkas, null bila tidak ada).
- `GET /assets/:id/history`: modul audit yang dibaca bertambah `mutations`, `loans`, `condition_logs`, `assignments` (semua dicatat dengan `entityId` = id barang).
- `GET /assets/:id/assignments`, `GET /assets/:id/condition-logs` (paginasi), `POST /assets/:id/condition-logs` (`conditions.record`; JSON `{condition, notes?, checkedAt?}`; barang arsip → 409).
- `POST /assets/:id/photos` menerima field opsional `conditionLogId` (harus milik barang yang sama).
- `GET /assets/statistics` menambah `pendingMutations`, `activeLoans`, `overdueLoans`.
- Filter daftar barang tetap bisa `status=BORROWED`.

### 8.3 Mutasi

| Method | Path | Permission | Catatan |
|---|---|---|---|
| GET | /mutations | `mutations.view` | filter `status`, `assetId`, `requestedById`, `search` (kode/nama barang); urut `requested_at desc` |
| GET | /mutations/:id | `mutations.view` | |
| POST | /mutations | `mutations.request` | body `{assetId, toLocationId?, changesResponsible?, toResponsibleEmployeeId?, reason}`. Bila pelaku juga punya `mutations.approve`, mutasi **langsung disetujui** dalam transaksi yang sama (`decided_by = requested_by`). |
| POST | /mutations/:id/approve | `mutations.approve` | |
| POST | /mutations/:id/reject | `mutations.approve` | body `{note}` wajib |
| POST | /mutations/:id/cancel | `mutations.request` | hanya pengaju sendiri, atau pemegang `mutations.approve` |

Aturan 409 (`Konflik`): barang arsip; barang sedang dipinjam; sudah ada mutasi `PENDING` untuk barang itu (juga ditangkap indeks unik → dipetakan ke 409); tujuan sama dengan kondisi saat ini; lokasi tujuan nonaktif; pegawai tujuan nonaktif; approve/reject/cancel pada mutasi yang bukan `PENDING`. Saat **approve**: dalam satu transaksi, cek ulang barang tidak arsip dan tidak dipinjam, perbarui `assets.location_id` dan/atau `responsible_employee_id`, tulis `asset_assignments` bila penanggung jawab berubah, set status mutasi. Nilai `from_*` dibekukan saat pengajuan; bila lokasi barang sudah berubah lain jalan (tidak mungkin tanpa mutasi, tetapi dicek) → 409.

### 8.4 Peminjaman

| Method | Path | Permission | Catatan |
|---|---|---|---|
| GET | /loans | `loans.view` | filter `state` = `active` \| `overdue` \| `returned` \| `all` (default `active`), `assetId`, `borrowerEmployeeId`, `search` (kode/nama barang, nama peminjam); urut: terlambat dulu, lalu `due_at asc` |
| GET | /loans/:id | `loans.view` | |
| POST | /loans | `loans.manage` | body `{assetId, borrowerType, borrowerEmployeeId?, borrowerName?, borrowerDepartmentId?, borrowerContact?, guarantorEmployeeId?, purpose?, loanedAt, dueAt}` |
| PATCH | /loans/:id | `loans.manage` | hanya saat `ACTIVE`: `dueAt` (perpanjangan), `purpose`, `borrowerContact` |
| POST | /loans/:id/return | `loans.manage` | body `{returnedAt?, condition?, notes?}`; `returnedAt` default sekarang, tidak boleh sebelum `loaned_at` |

Aturan: barang arsip, sedang dipinjam, atau punya mutasi `PENDING` → 409. `loanedAt` tidak boleh di masa depan; `dueAt ≥ loanedAt`. Saat **create**: dalam satu transaksi simpan `previous_status = assets.status`, set `assets.status = BORROWED`. Saat **return**: set `status = RETURNED`, kembalikan `assets.status = previous_status` (bila `previous_status` ternyata `BORROWED`/`RETURNED`, pakai `AVAILABLE`); bila `condition` diisi, buat `asset_condition_logs` (`LOAN_RETURN`) dan perbarui `assets.condition`.

### 8.5 Audit (aksi baru)

`employees.create|update`, `assets.condition_record`, `mutations.request|approve|reject|cancel`, `loans.create|update|return`, `assets.assign` (penanggung jawab berubah). Semua dengan `entityId` = id barang untuk yang menyangkut barang, agar tab Riwayat barang menemukannya; untuk mutasi/pinjaman `after` memuat id mutasi/pinjaman untuk tautan.

## 9. Permission

Ditambahkan ke katalog (seed otomatis memberi permission baru ke role yang sudah ada, perilaku seed Tahap 1):

| Kode | Super Admin | Admin Inventaris | Petugas | Viewer |
|---|---|---|---|---|
| `employees.manage` | ✓ | ✓ | – | – |
| `loans.view` | ✓ | ✓ | ✓ | ✓ |
| `loans.manage` | ✓ | ✓ | ✓ | – |
| `conditions.record` | ✓ | ✓ | ✓ | – |
| `mutations.view` (ada) | ✓ | ✓ | ✓ | ✓ |
| `mutations.request` (ada) | ✓ | ✓ | ✓ | – |
| `mutations.approve` (ada) | ✓ | ✓ | – | – |

Catatan: Petugas sudah memegang `mutations.view` dan `mutations.request` di katalog. Viewer belum punya `mutations.view`; ditambahkan ke baseline katalog (sesuai "Melihat" untuk daftar, tanpa aksi). Karena seed hanya memberi role lama permission yang **baru dibuat** pada run itu, penambahan `mutations.view` ke Viewer di server yang sudah berjalan dilakukan lewat SQL di migrasi Tahap 3 (`INSERT ... ON CONFLICT DO NOTHING` ke `role_permissions`).

Foto pada pemeriksaan kondisi: `POST /assets/:id/photos` menerima pemegang `assets.update` **atau** pemegang `conditions.record` yang menyertakan `conditionLogId` (guard per permintaan). Menghapus foto dan mengatur foto utama tetap memerlukan `assets.update`.

## 10. Aplikasi web

Navigasi: bagian **Inventaris** bertambah "Mutasi" (`/mutations`, `mutations.view`) dan "Peminjaman" (`/loans`, `loans.view`); bagian **Data Master** bertambah "Pegawai" (`/employees`, `employees.manage`).

### 10.1 Pegawai `/employees`
Tabel (nama, nomor, unit kerja, jabatan, kontak, status, jumlah barang dipegang), pencarian, filter unit kerja dan aktif, dialog tambah/ubah, tombol nonaktifkan/aktifkan. Detail `/employees/[id]`: data pegawai, daftar barang yang dipegang (tautan), pinjaman aktif sebagai peminjam/penjamin.

### 10.2 Mutasi `/mutations`
Tabel: barang (kode + nama), perubahan ("Lokasi: A → B", "PJ: Budi → Sari"), pengaju, tanggal, status (badge), aksi cepat untuk Admin (Setujui/Tolak). Filter status (default Menunggu), pencarian. `/mutations/new?assetId=`: pemilih barang (menampilkan lokasi dan PJ saat ini), centang "Pindah lokasi" + pemilih lokasi, centang "Ganti penanggung jawab" + pemilih pegawai (dengan pilihan "lepaskan"), alasan. Tombol untuk Admin berbunyi "Pindahkan sekarang", untuk Petugas "Ajukan". `/mutations/[id]`: rincian sebelum/sesudah, tombol Setujui / Tolak (dialog alasan) / Batalkan sesuai hak.

### 10.3 Peminjaman `/loans`
Tabel sesuai sketsa yang disetujui: barang, peminjam (+ "penjamin: …" bila bukan karyawan), unit, pinjam → rencana kembali, status (Aktif / Terlambat N hari / Selesai), tombol "Kembalikan". Filter Aktif | Terlambat | Selesai | Semua. `/loans/new?assetId=`: formulir sesuai sketsa (pilihan Karyawan / Bukan karyawan mengubah kolom). Dialog kembalikan: tanggal kembali (default sekarang), kondisi saat kembali (opsional, default kondisi saat ini ditampilkan), catatan. Dialog perpanjang: rencana kembali baru.

### 10.4 Perubahan halaman barang
- **Formulir tambah**: penanggung jawab memakai pemilih pegawai; kondisi dan lokasi tetap ada.
- **Formulir ubah**: lokasi, penanggung jawab, kondisi tampil hanya-baca dengan tautan "Ubah lewat mutasi" / "Catat pemeriksaan"; status tidak menawarkan `Dipinjam`/`Dikembalikan` dan dinonaktifkan saat barang dipinjam.
- **Detail**: header menambah tombol "Ajukan mutasi"/"Pindahkan" (`mutations.request`), "Catat peminjaman" atau "Kembalikan" (`loans.manage`), "Catat kondisi" (`conditions.record`); semua nonaktif saat arsip. Banner di atas tab: "Sedang dipinjam oleh … sampai …" dan "Mutasi menunggu persetujuan". Tab baru **Kondisi** (riwayat pemeriksaan dengan foto, tombol catat), **Mutasi** (mutasi barang ini), **Peminjaman** (pinjaman barang ini). Tab **Riwayat** memakai label aksi baru.
- Kartu info menampilkan penanggung jawab sebagai pegawai (tautan ke `/employees/[id]`).

### 10.5 Dashboard
Tiga kartu tambahan dengan tautan: "Mutasi menunggu" → `/mutations?status=PENDING` (tampil bila `mutations.view`), "Pinjaman aktif" → `/loans`, "Terlambat" → `/loans?state=overdue` (tampil bila `loans.view`).

## 11. Pengujian

- E2E backend terhadap PostgreSQL asli untuk setiap modul: alur lengkap mutasi (ajukan → setujui mengubah barang dan menulis assignment; tolak; batal; auto-approve Admin; 409 untuk ganda/arsip/dipinjam), peminjaman (create mengubah status; return memulihkan status dan mencatat kondisi; terlambat; 409 ganda), kondisi (log + foto bertaut), pegawai (CRUD, lookup, nonaktif), penolakan `PATCH /assets` untuk kolom terkunci, statistik baru, history memuat aksi baru. Uji balapan: dua `POST /loans` serentak hanya satu berhasil.
- Unit: aturan tanggal (terlambat dihitung di Asia/Jakarta), pemetaan label linimasa, skema zod formulir pinjam (penjamin wajib bila bukan karyawan) dan mutasi (minimal satu perubahan).
- Frontend: uji komponen untuk nav items dan skema formulir; sisanya verifikasi browser seperti Tahap 2.

## 12. Deployment

Migrasi Prisma baru (menghapus `responsible_user_id`), seed berjalan otomatis saat backend start dan menambahkan permission baru ke role. Tidak ada variabel lingkungan baru. Urutan: `git pull --ff-only && docker compose up -d --build`.

## 13. Diserahkan ke builder

- Pembagian modul NestJS (`employees`, `mutations`, `loans`, `condition-logs` di dalam `assets` atau terpisah), nama file, bentuk DTO ringkas untuk `activeLoan`/`pendingMutation`.
- Rincian tampilan dan komponen (pemilih pegawai dapat meniru `user-lookup.tsx`), teks bantuan, urutan kolom.
- Cara menghitung "hari ini" Asia/Jakarta secara konsisten di backend (statistik, filter overdue) dan frontend (label "Terlambat N hari").
- Pelanggaran indeks unik parsial (P2002) pada `asset_loans`/`asset_mutations` dipetakan ke 409 dengan pesan spesifik ("Barang sedang dipinjam" / "Sudah ada mutasi menunggu"), bukan pesan umum filter.
- DTO ubah barang terpisah dari DTO tambah (kolom terkunci ditolak eksplisit), dan payload formulir ubah di frontend tidak lagi mengirim kolom terkunci.
