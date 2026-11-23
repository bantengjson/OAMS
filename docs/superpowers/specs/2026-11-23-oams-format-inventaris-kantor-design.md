# OAMS Format Inventaris Kantor — Desain

Tanggal: 23 November 2026. Sumber: Excel kantor `DAFTAR INVENTARIS BARANG DPC 2026.xlsx` (5 sheet, tidak di-commit), jawaban pemilik atas 29 pertanyaan + K1–K9 (21–23 Nov), dan daftar gabungan `data-kantor/Gabungan Inventaris DPC (draf 2).xlsx` (folder di-*gitignore*: repo ini publik, data kantor tidak boleh masuk Git).

## 1. Maksud

Kantor DPC PDI Perjuangan Kota Surabaya selama ini mencatat inventaris di Excel dengan format sendiri: kode `NG.A / 012 / DPC / 2023`, jenis barang bernomor, ruangan berhuruf A–O, tiga kondisi. OAMS harus memakai format yang sama persis, supaya kantor bisa berhenti memakai Excel: kode di stiker QR sama dengan yang sudah dikenal staf, laporan yang diunduh bentuknya sama dengan Excel lama, dan **semua barang yang ada di Excel masuk ke OAMS tanpa satu pun tertinggal**.

## 2. Tujuan

1. **Jenis Barang** menggantikan Kategori: bernomor (001, 002, …), bergolongan BG (bergerak) atau NG (tidak bergerak), nomornya tidak pernah berubah.
2. **Ruangan A–O** aktif kembali (lokasi yang dulu disembunyikan), bisa ditambah Admin (P, Q, …); pindah ruangan lewat Mutasi.
3. **Kode baru** `NG.A/012/DPC/2023-01`, dibuat otomatis, tetap walau barang pindah ruangan.
4. Kolom barang mengikuti Excel: **Spesifikasi** (menggantikan Merk + Model), **Tahun pengadaan**, **Sumber** (menggantikan "KET.": terisi = hibah, kosong = dibeli), **Nomor seri / nomor polisi**.
5. **Kondisi 3 tingkat**: Baik / Perlu Perbaikan / Rusak.
6. **Tambah beberapa unit sekaligus** untuk barang yang sama persis; tiap unit tetap punya data, kode, dan QR sendiri.
7. **Barang Kelompok** untuk peralatan dapur: dicatat per jenis per ruangan dengan jumlah, tanpa QR, dihitung saat stock opname.
8. **Laporan "Daftar Inventaris"** berbentuk seperti Excel kantor (per ruangan dan keseluruhan), diunduh sebagai `.xlsx`.
9. **Impor sekali** seluruh daftar gabungan ke OAMS (lokal lalu server), setelah data uji dihapus, dengan pratinjau dan laporan hasil.

## 3. Bukan tujuan

- Fitur impor Excel di aplikasi (impor berulang). Impor kali ini dijalankan sekali oleh pengembang.
- Kategori khusus barang habis pakai, atau mencatat isi ulang/tisu/pengharum (yang dicatat hanya alat/wadahnya).
- Peminjaman, mutasi per unit, perbaikan, atau QR untuk Barang Kelompok.
- Laporan lain Tahap 5 (grafik, penyusutan, dsb.). Hanya "Daftar Inventaris".
- Mengubah gaya sidebar (lihat §5).
- Multi-kantor. Tetap satu kantor ([[oams-office-identity]]).

## 4. Anti-tujuan

- Ada barang di Excel yang tidak masuk OAMS, atau masuk dua kali.
- Kode berubah diam-diam setelah stikernya ditempel.
- Alur per unit yang sudah berjalan (peminjaman, mutasi, opname, perbaikan, pelepasan) rusak atau berubah perilaku untuk barang biasa.
- Data kantor (daftar barang, nama penyumbang, nomor polisi) ikut ter-commit ke repo publik.

## 5. Batasan

- Stack tetap: NestJS 12 + Prisma 7 + PostgreSQL 17, Next.js 16 + React 19 + Tailwind 4. Perubahan skema lewat migrasi Prisma yang bisa dijalankan otomatis saat deploy (`docker compose up -d --build`).
- **Sidebar dibekukan gayanya**. Pemilik (23 Nov) mengizinkan menambah menu baru: menu **Ruangan** di Data Master. Label "Kategori" menjadi "Jenis Barang" (isi menu, keputusan pembangun mengikuti usulan yang tidak ditolak pemilik). Gaya, warna, ukuran tetap.
- Repo publik: skrip impor membaca file Excel/daftar gabungan dari path yang diberikan saat dijalankan; data tidak disimpan di repo.
- Data uji (`INV-2026-xxxx`) di lokal dan server dihapus sebelum impor; akun pengguna, role, pegawai, dan unit kerja tetap. Backup `pg_dump` dibuat dulu.
- Nama kantor: "DPC PDI Perjuangan Kota Surabaya".

## 6. Pendekatan

**Barang Kelompok (keputusan pemilik 23 Nov: pilihan A).**

| | A. Daftar terpisah "Barang Kelompok" (dipilih) | B. Barang biasa + kolom jumlah |
|---|---|---|
| Bentuk | Tabel sendiri: satu baris = jenis + ruangan + tahun, dengan jumlah per kondisi | `assets` diberi kolom `quantity` |
| Alur yang ada | Tidak tersentuh | Semua alur (pinjam, mutasi, opname, perbaikan, lepas, QR, dashboard) harus menangani jumlah > 1, misal pinjam 10 dari 94 garpu |
| Risiko | Rendah | Tinggi, menyentuh fitur yang sudah selesai |
| Kekurangan | Dua daftar; dashboard menampilkan total kelompok terpisah | — |

**Jenis Barang dan Ruangan: pakai tabel yang ada** (keputusan pembangun). `categories` diberi kolom golongan + nomor; `locations` bertipe `ROOM` di bawah root `OFFICE` dipakai sebagai ruangan dengan `code` = hurufnya. Alternatif tabel baru ditolak: semua relasi (aset, mutasi, filter, audit) sudah memakai kedua tabel ini.

## 7. Keputusan pemilik (ringkasan, mengikat)

- Kode tetap saat pindah ruangan; huruf ruangan = ruangan saat didaftarkan. Tanpa spasi. Nomor urut 2 digit, otomatis 3 digit setelah 99.
- Kendaraan dan tanah/bangunan tanpa huruf ruangan: `BG/004/DPC/2023-01`, `NG/001/DPC/2019-01`.
- Bagian "DPC" selalu "DPC", bisa diubah Admin.
- Tahun kosong → `TT` (mis. `NG.J/012/DPC/TT-01`). Selama stiker belum pernah dicetak, mengisi tahun ikut mengubah kode; setelah dicetak, kode tetap. Tahun boleh kosong **hanya untuk impor ini**; data baru wajib tahun.
- Jenis barang dari Excel; nomor tidak boleh berubah; jenis baru lanjut 107, 108, …; golongan melekat ke jenis. Nomor jenis unik di dalam golongan (BG 001–009 = satu nomor per kendaraan; NG 001–106).
- 15 ruangan: A Sekretariat, B Ketua/Sekretaris/Bendahara, C Bendahara, D Fraksi, E Rapat Internal, F Rapat Bersama, G Data & KTA, H Mushalla, I Dapur, J BBHAR, K Gudang, L Balai Kreasi, M Meja Satgas, N Ruang Tengah, O Halaman Parkiran. Admin menambah ruangan; huruf lanjut otomatis.
- Kondisi Baik / Perlu Perbaikan / Rusak. Perbaikan selesai bisa mengembalikan ke Baik.
- "Keterangan Ada / Tidak Ada" = barangnya ada secara fisik atau tidak. "Tidak Ada" dicatat sebagai Dilepas.
- Kolom "KET." diganti nama menjadi **Sumber**: terisi = hibah (isi = nama penyumbang), kosong = dibeli.
- Satu kolom Spesifikasi bebas; Merk/Tipe terpisah dihapus. Nomor polisi di Nomor seri / nomor polisi, bukan di nama.
- Barang yang sama boleh didaftarkan sekaligus beberapa unit; beda merk/tipe dipisah. Tiap unit punya kode `-01`, `-02`, …
- Pengharum Ruangan dan Kotak Tisu dicatat sebagai barang biasa. Peralatan dapur = Barang Kelompok.
- Tanah & bangunan dicatat sebagai barang, tanpa perlu stiker.
- Penanggung jawab dikosongkan saat impor; diisi nanti lewat mutasi.
- Stiker: utamakan berbingkai 70×47 / 90×60 mm. Stiker lama tidak bernomor unit; pakai format baru.
- Laporan Daftar Inventaris model Excel dibuat dalam pekerjaan ini.
- Data uji dihapus sebelum impor.

## 8. Rancangan

### 8.1 Jenis Barang (tabel `categories`)

Kolom baru: `golongan` (`BG` | `NG`), `number` (int, unik per golongan), `isGroup` (boolean: jenis untuk Barang Kelompok). `code` diisi otomatis `NG-012` / `BG-004` (tetap unik). Nama halaman dan label di UI: "Jenis Barang".

- Tambah jenis: Admin memilih golongan; nomor = nomor terbesar golongan itu + 1 (bisa diketik manual bila kosong/unik, untuk menyamakan dengan Excel). Nomor dan golongan **tidak bisa diubah** setelah ada barang yang memakainya.
- `isGroup` tidak bisa diubah setelah dipakai. Jenis kelompok hanya muncul di formulir Barang Kelompok; jenis biasa hanya di formulir barang.
- Daftar awal: 115 dari Excel + 47 baru (107–153) dari daftar gabungan, termasuk 153 Kursi KSB.

### 8.2 Ruangan (tabel `locations`, tipe `ROOM`)

- Ruangan = `Location` tipe `ROOM` di bawah satu root `OFFICE` (kantor). `code` = huruf (A, B, …, Z, lalu AA, AB, …). Huruf tidak bisa diubah setelah dipakai kode barang.
- Halaman "Ruangan": daftar datar (bukan pohon), tambah/ubah nama/nonaktifkan. Halaman `/locations` lama diganti tampilannya.
- Barang NG wajib punya ruangan, kecuali jenis NG 001 (tanah & bangunan). Barang BG tanpa ruangan.
- Formulir, tabel, detail barang, filter, dan halaman QR publik menampilkan ruangan saat ini.
- **Mutasi** kembali bisa memindah ruangan (kolom `from/to location` sudah ada), bersama atau tanpa ganti penanggung jawab. Kode barang tidak berubah.

### 8.3 Kode barang

Format: `{golongan}{.huruf ruangan}/{nomor jenis 3 digit}/{kode organisasi}/{tahun atau TT}-{nomor unit}`.

| Kasus | Contoh |
|---|---|
| Barang di ruangan | `NG.A/012/DPC/2023-01` |
| Kendaraan | `BG/004/DPC/2023-01` |
| Tanah & bangunan | `NG/001/DPC/2019-01` |
| Tanpa tahun (impor) | `NG.J/012/DPC/TT-01` |
| Unit ke-100 | `NG.I/012/DPC/2023-100` |

- Nomor unit dihitung per **awalan** (semua sebelum `-`): tabel urutan baru `asset_code_sequences` berkunci awalan (menggantikan kunci tahun), dengan upsert-and-return di transaksi yang sama seperti sekarang.
- Kode organisasi dari `system_settings` (`asset_code_org`, bawaan `DPC`), bisa diubah Admin; perubahan hanya berlaku untuk kode baru.
- Kode tidak pernah dipakai ulang, termasuk setelah barang dilepas/diarsip.
- Aturan TT: ketika tahun diisi pada barang ber-TT dan `printedCount` labelnya 0, kode dibuat ulang dengan nomor unit baru untuk awalan bertahun; perubahan dicatat di audit. Bila sudah pernah dicetak, kode tetap dan tahun hanya tersimpan di data.
- **Koreksi data pendaftaran** (pemilik, 23 Nov): selama label belum pernah dicetak (`printedCount` 0), jenis, ruangan awal, dan tahun boleh dikoreksi lewat Ubah barang dan kodenya dibuat ulang (nomor unit baru, audit mencatat kode lama dan baru). Setelah pernah dicetak, jenis dan ruangan awal **dikunci** di formulir dan API; bila salah, barang diarsip dan didaftarkan ulang dengan stiker baru. Pindah ruangan biasa lewat Mutasi dan tidak mengubah kode.
- Kode lama `INV-…` tidak dipertahankan (data uji dihapus).

### 8.4 Kolom barang

| Kolom | Perubahan |
|---|---|
| Nama barang | Tetap; bawaan = nama jenis |
| Spesifikasi (Merk/Tipe/Warna) | Baru, teks bebas; menggantikan `brand` + `model` (migrasi menggabungkan isinya) |
| Tahun pengadaan | Baru, angka 4 digit; wajib saat **menambah** barang; boleh kosong hanya lewat impor. Saat **mengubah** barang ber-TT, tahun boleh tetap kosong (staf bisa memperbaiki data lain tanpa mengarang tahun), tetapi tahun yang sudah terisi tidak bisa dikosongkan (keputusan pembangun) |
| Sumber | Baru, teks; terisi → cara perolehan Hibah, kosong → Pembelian (diisi otomatis; pilihan cara perolehan disembunyikan dari formulir) |
| Nomor seri / nomor polisi | Label baru untuk `serialNumber` |
| Jumlah unit | Hanya di formulir tambah: 1–100; membuat N barang identik berurutan (`-01`…`-0N`) dalam satu transaksi, masing-masing dengan QR |
| Harga, vendor, tanggal beli, unit kerja, catatan | Tetap, opsional |

Pencarian mencakup kode, nama, spesifikasi, nomor seri. Filter: golongan, jenis, ruangan, kondisi, status.

### 8.5 Kondisi 3 tingkat

Enum menjadi `GOOD` (Baik), `NEEDS_REPAIR` (Perlu Perbaikan), `DAMAGED` (Rusak). Migrasi: `MINOR_DAMAGE` → `NEEDS_REPAIR`; `MAJOR_DAMAGE`, `UNUSABLE` → `DAMAGED`, di semua tabel yang menyimpan kondisi (barang, riwayat kondisi, opname, perbaikan). Label, warna, filter, grafik dashboard mengikuti.

### 8.6 Barang Kelompok

Tabel baru `group_items`:

- `categoryId` (jenis dengan `isGroup`), `locationId` (ruangan, wajib), `name`, `specification`, `acquisitionYear` (boleh kosong hanya via impor), `source`, `qtyGood`, `qtyNeedsRepair`, `qtyDamaged` (≥ 0), `notes`, `archivedAt`, `createdById`, cap waktu.
- Kode tampilan tanpa nomor unit: `NG.I/110/DPC/TT` (hanya tampilan, tidak harus unik). Boleh ada lebih dari satu baris dengan jenis, ruangan, dan tahun yang sama bila spesifikasi atau sumbernya berbeda, supaya asal hibah tidak hilang (keputusan pembangun).
- Tampil sebagai tab **"Barang Kelompok"** di halaman Inventaris (tanpa menu sidebar baru): tabel jenis, ruangan, tahun, jumlah per kondisi, total.
- Ubah jumlah/kondisi/ruangan lewat formulir ubah dengan **alasan wajib**; setiap perubahan masuk audit log dan tampil sebagai riwayat. Hapus = arsip dengan alasan.
- Hak akses memakai izin barang yang ada (`assets.view`, `assets.create`, `assets.update`, `assets.archive`).
- **Stock opname**: saat opname dibuat, setiap Barang Kelompok aktif ikut sebagai baris hitung (jumlah tercatat per kondisi). Petugas mengisi jumlah hasil hitung per kondisi. Saat opname ditutup, baris berselisih dilaporkan, dan jumlah hasil hitung menjadi jumlah baru Barang Kelompok (dengan audit "hasil opname"). Baris yang **tidak dihitung** tetap memakai jumlah tercatat dan ditandai "tidak dihitung" di laporan opname — tidak pernah dianggap 0 (keputusan pembangun).
- Tidak ikut peminjaman, mutasi, perbaikan, pelepasan, QR.
- Dashboard: kartu kecil terpisah "Barang Kelompok: N jenis · M unit". Total barang di dashboard tetap menghitung barang per unit saja.

### 8.7 Stiker dan halaman QR

- Teks di bawah QR = kode baru (±20 karakter). Ukuran huruf menyesuaikan agar muat di stiker berbingkai; stiker polos 30 mm tetap tersedia dengan huruf kecil.
- Ukuran bawaan cetak tetap berbingkai 90×60.
- Halaman QR publik menampilkan ruangan dan spesifikasi (menggantikan merk/model).

### 8.8 Laporan "Daftar Inventaris" (.xlsx)

Tombol "Unduh Daftar Inventaris" di halaman Inventaris (pengguna dengan `assets.view`), pilihan **Per ruangan** atau **Keseluruhan**, dibuat di server (pustaka `exceljs`, dependensi baru).

- Satu file berisi semua ruangan, disusun seperti sheet "INVENTARIS PER RUANGAN": bagian A (kendaraan, tanpa ruangan), lalu bagian B dimulai NG 001 tanah & bangunan (tanpa ruangan), lalu subjudul tiap ruangan A, B, … (keputusan pembangun, mengikuti Excel).
- Kepala: `DAFTAR INVENTARIS BARANG` / `DPC PDI PERJUANGAN KOTA SURABAYA` / `TAHUN {tahun berjalan}`.
- Bagian **A. Inventaris Barang Bergerak (Kode: BG)** dan **B. Inventaris Barang Tidak Bergerak/Tetap (Kode: NG)**; versi per ruangan diberi subjudul `RUANG SEKRETARIAT (KODE: A)` dst.
- Kolom: NO. (nomor jenis) · NAMA BARANG · JUMLAH BARANG · TAHUN PENGADAAN · SPESIFIKASI (MERK/TYPE/WARNA) · KONDISI BARANG (Baik · Perlu Perbaikan · Rusak) · KETERANGAN · SUMBER.
- Satu baris per (ruangan, jenis) — keseluruhan: per jenis. Bila tahun/spesifikasi campuran, ditulis seperti Excel: `2025 (2), 2020 (2)`, `LG Dell (2), Lenovo (2)`.
- KETERANGAN = "Ada" untuk barang aktif; barang Dilepas ikut tercantum dengan "Tidak Ada" (seperti ambulans lama di Excel). Barang diarsip tidak ikut.
- Barang Kelompok ikut di ruangannya sebagai baris biasa (jumlah per kondisi).

### 8.9 Impor data

Skrip sekali-jalan di `backend/src/database/import-office/` (kode di repo; data dibaca dari path saat dijalankan).

1. **Masukan**: daftar gabungan (draf 2) dan Excel asli untuk tahun, spesifikasi, kondisi, sumber, keterangan.
2. **Mode pratinjau** (bawaan): tidak menulis apa pun; menghasilkan laporan `.xlsx` di `data-kantor/`: tiap barang yang akan dibuat dengan kodenya, jumlah per ruangan/jenis, dan daftar periksa (baris janggal, tahun kosong, jumlah tidak jelas). Pemilik memeriksa sebelum impor sungguhan.
3. **Mode tulis**: backup dulu; hapus data uji (barang dan semua turunannya, kategori dan lokasi lama, berkas foto/dokumen); buat 162 jenis, 15 ruangan, lalu barang dan Barang Kelompok — semua dalam satu transaksi; tulis ringkasan ke audit log.
4. **Aturan pengisian** (keputusan pembangun kecuali disebut pemilik):
   - Jumlah: dari INVENTARIS PER RUANGAN; bila tidak ada, dari UPDATE PER RUANGAN; kosong / `1 set` / `` ` `` → 1 dan masuk daftar periksa.
   - Tahun dan spesifikasi campuran dipecah sesuai angka dalam kurung, dipasangkan menurut urutan tulisan (pemilik). Tahun tidak jelas → TT + daftar periksa.
   - Kondisi: unit pertama sebanyak kolom Baik = Baik, lalu Perlu Perbaikan, lalu Rusak (pemilik). Baris yang rincian kondisinya tidak cocok dengan jumlah → semua Baik + daftar periksa (pemilik: rincian janggal tidak dipakai).
   - Status barang impor: Dipakai (`IN_USE`).
   - Kendaraan: ambulans 001–003 dan Honda Beat 008 → dibuat lalu Dilepas (alasan Lainnya, keterangan "Keterangan Excel: Tidak Ada"); nomor polisi lama ke catatan.
   - "Asuransi DJI Osmo" → catatan pada DJI Osmo Pocket 4; "Toolify" tidak diimpor.
   - Sumber dari kolom KET.; Spesifikasi dari kolom Merk/Type/Warna.
5. Dijalankan di lokal dulu (pemilik memeriksa di aplikasi), lalu di server lewat `docker compose exec backend`.

### 8.10 Lain-lain

- Nama kantor "DPC PDI Perjuangan Kota Surabaya" di laporan, halaman login/QR publik, dan bingkai stiker bila ada teksnya.
- Dashboard, filter, dan grafik memakai jenis/ruangan/kondisi baru.
- Dokumentasi: `docs/format-inventaris-kantor.md` (cara kode dibuat, aturan TT, cara impor).

## 9. Diserahkan ke pembangun

Bentuk endpoint dan DTO; susunan migrasi (boleh beberapa); cara menghapus data uji dengan aman; detail tata letak `.xlsx` (lebar kolom, gabungan sel) asal mirip Excel kantor; komponen UI mengikuti sistem desain yang ada; urutan pengerjaan per bagian.

## 10. Urutan kerja dan rilis

1. Format baru (jenis, ruangan, kode, kolom, kondisi, tambah N unit, stiker).
2. Barang Kelompok (termasuk opname).
3. Laporan Daftar Inventaris.
4. Skrip impor (pratinjau → periksa pemilik → tulis) di lokal.
5. Satu rilis ke server: backup, deploy, impor pratinjau, impor tulis, periksa.

## 11. Pertanyaan terbuka untuk pemilik

Tidak ada. Semua pertanyaan pemeriksa sudah dijawab pemilik atau diputuskan pembangun (ditandai di dokumen).
