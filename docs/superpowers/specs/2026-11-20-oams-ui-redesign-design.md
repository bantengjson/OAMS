# OAMS Redesign UI/UX — Desain

Tanggal: 20 November 2026. Sumber permintaan: "Master Prompt — OAMS UI/UX Redesign" dari pemilik, dengan pesan pemilik untuk menyesuaikannya dengan kondisi OAMS dan tidak terpaku bila menabrak fungsi fitur. Mockup yang disetujui: `.superpowers/brainstorm/2048-1795162524/content/dashboard-v2.html` dan `inventaris.html` (lokal, tidak di-commit; ringkasannya ada di dokumen ini).

## 1. Maksud

Seluruh halaman OAMS tampil seperti produk perangkat lunak perkantoran yang matang: terang, rapi, hierarki informasi jelas, dan **sedikit berwarna** (pemilik menilai versi netral "kurang colorful"; versi berwarna disetujui). Ini penyempurnaan tampilan, bukan penulisan ulang: semua fitur, data asli, hak akses, rute, dan kontrak API tetap.

## 2. Tujuan

- Sistem desain baru (warna, tipografi Inter, jarak, radius) diterapkan di satu tempat dan dipakai semua halaman.
- Dashboard baru: judul halaman, 4 KPI, panel operasional ringkas, 3 grafik sederhana dari data asli, aktivitas terbaru.
- Halaman Inventaris baru: tombol cepat per status, bilah filter, pilih kolom, urutkan, pilih banyak + cetak QR terpilih, tabel profesional dengan paginasi server.
- Semua halaman lain memakai sistem yang sama dengan susunan sesuai fungsinya.
- Responsif: optimal di ≥1440 px, tabel bisa digeser di tablet, formulir dan pemindai QR nyaman di HP.

## 3. Bukan tujuan

- Mengubah sidebar dalam bentuk apa pun (lihat §6).
- Mode gelap untuk area konten.
- Mengubah skema database, nama rute, atau kontrak API yang ada.
- Fitur baru di luar tampilan: arsip/hapus massal, ekspor Excel, pengurutan berdasarkan status/kondisi.
- Format kode kantor (`NG.A/012/DPC/2023`), ruangan A–O, kondisi 3 tingkat: pekerjaan terpisah yang masih menunggu jawaban pemilik; redesign dikerjakan **lebih dulu** (keputusan pemilik).

## 4. Anti-tujuan

- Tampilan "template admin buatan AI": gradien berlebihan, glassmorphism, bayangan tebal, ikon dekoratif besar, kartu untuk setiap informasi.
- Angka contoh/palsu di aplikasi. Setiap angka dan grafik berasal dari API; bila datanya belum ada, bagian itu disembunyikan atau menampilkan keadaan kosong yang jujur.
- Fitur yang hilang atau berubah perilaku setelah redesign.
- Sidebar yang berubah satu piksel pun.

## 5. Keputusan pemilik (20 Nov 2026)

1. Redesign dikerjakan sebelum format kode kantor.
2. Mockup dashboard versi 2 (berwarna) disetujui: KPI dengan ikon berwarna dan garis atas berwarna, panel operasional berikon, donut kondisi, batang kategori berwarna, batang per tahun, aktivitas berikon.
3. Mockup Inventaris disetujui: judul + jumlah, tombol cepat status, filter, menu Kolom, bilah pilih banyak dengan Cetak QR terpilih, tabel bersortir, paginasi.
4. Cara pembangunan **A**: memperbarui komponen yang ada tanpa library tabel/grafik tambahan.
5. Penyesuaian terhadap master prompt yang sudah disampaikan dan tidak dibantah: kolom Lokasi tidak ditampilkan (lokasi disembunyikan); aktivitas terbaru hanya untuk pemegang izin audit log; grafik tren perolehan memerlukan tambahan kecil di API statistik dan disembunyikan bila datanya belum cukup; pengurutan hanya pada kolom yang didukung API; aksi massal hanya Cetak QR.

## 6. Sidebar dikunci

Sidebar (`frontend/src/components/layout/sidebar.tsx`) **tidak diedit**. Masalahnya: sidebar memakai token global `--primary` (kotak logo) dan mewarisi font `body`, sehingga mengganti token dan font secara global ikut mengubahnya.

Penyelesaian: `AppShell` membungkus `<Sidebar>` dengan elemen `display: contents` berkelas `sidebar-legacy`. Kelas itu (di `globals.css`) menetapkan ulang nilai lama untuk sidebar saja: `--primary: #1d4ed8`, `--primary-foreground`, `--ring`, token `--sidebar-*` yang sama, dan `font-family` sistem yang dipakai sekarang. Token baru berlaku di `:root` untuk semua yang lain, termasuk dialog dan toast yang dirender di luar pohon konten.

Bukti tidak berubah: sebelum dan sesudah pekerjaan, ambil nilai `getComputedStyle` (warna latar, warna teks, font-family, font-size, padding, lebar) untuk aside, logo, judul seksi, item menu biasa, item aktif, dan item hover, di lebar 1440 px dan 375 px (drawer). Kedua snapshot harus sama persis; ditambah tangkapan layar sebelum/sesudah. Teks kecil di dasar sidebar ("Tahap 1 · Foundation") juga dibiarkan.

## 7. Sistem desain

### 7.1 Token (di `globals.css`, `:root`)

| Token | Nilai |
|---|---|
| Latar halaman | `#F7F8FA` |
| Kartu | `#FFFFFF` |
| Primer | `#2457D6` (hover sedikit lebih gelap, mis. `#1D47B5`) |
| Judul | `#172033` |
| Teks isi | `#475569` |
| Teks sekunder | `#64748B` |
| Garis | `#E2E8F0` |
| Sukses / Peringatan / Bahaya | `#16A36A` / `#D99A28` / `#DC5656` |

Palet aksen (warna + latar lembut) untuk ikon, label, dan grafik: biru `#2457D6/#EAF0FC`, hijau `#16A36A/#E7F6EF`, ungu `#7C5CD6/#F0ECFB`, kuning `#D99A28/#FCF3E2`, merah `#DC5656/#FCEDED`, teal `#0E9AA7/#E3F5F6`, oranye `#E07B39/#FCEFE5`, abu `#64748B/#EEF1F5`.

### 7.2 Arti warna (tetap di seluruh aplikasi)

- **Status barang:** Tersedia hijau, Digunakan biru, Disimpan abu, Dipinjam ungu, Dalam perbaikan oranye, Hilang merah, Dihapuskan abu, Dikembalikan teal.
- **Kondisi:** Baik hijau, Rusak ringan kuning, Rusak berat oranye, Tidak layak pakai merah.
- **Alur:** Mutasi ungu, Peminjaman biru, Terlambat merah, Perbaikan oranye, Laporan kerusakan kuning, Pelepasan abu, Stock opname teal.
- **Kategori:** warna dari palet aksen menurut urutan kategori (stabil per kategori), dipakai sebagai titik kecil di tabel dan batang grafik.

Label status berbentuk pil berlatar lembut tanpa garis tepi; kondisi ditampilkan sebagai titik + teks (tidak semua hal dijadikan pil, agar tidak ramai).

### 7.3 Tipografi dan ukuran

- Font **Inter** lewat `next/font/google` (diunduh saat build dan disajikan dari server sendiri; tanpa panggilan ke Google saat dipakai), cadangan font sistem. Diterapkan pada area konten, dialog, dan toast; tidak pada sidebar.
- Judul halaman 26 px semibold; judul seksi 16 px semibold; isi 14 px; keterangan 12 px; angka memakai `tabular-nums`.
- Padding konten 28–32 px (desktop), 16 px (HP); lebar konten maksimal 1440 px (sebelumnya 1152 px).
- Radius kartu 11 px, tombol dan input 8 px; bayangan kartu sangat tipis (`0 1px 2px rgba(16,24,40,.04)`); garis 1 px `#E2E8F0`.

## 8. Komponen bersama (di `components/ui`, memperbarui yang ada)

- **Button, Input, Select, Textarea, Badge, Card, Tabs, Dialog, ConfirmDialog, Alert, Pagination, Table, FileDrop, Spinner, EmptyState**: gaya baru, API props tetap agar halaman tidak perlu diubah logikanya.
- **PageHeader**: kartu putih dengan aksen garis kiri biru 4 px, judul, deskripsi, slot `meta` (mis. jumlah, tanggal) dan `actions`.
- Baru: **StatTile** (KPI dengan ikon berwarna, garis atas berwarna, angka, keterangan), **MetricStrip** (deretan metrik ringkas dalam satu kartu, tiap metrik bisa ditautkan), **StatusChips** (tombol cepat penyaring berwarna dengan jumlah), **FilterBar** (wadah pencarian + filter + slot kanan), **ColumnMenu** (pilih kolom, disimpan di `localStorage` per tabel), **SortableHeader** (TH dengan panah urut), **BulkBar** (bilah pilih banyak), **DonutChart** dan **BarList/ColumnChart** berbasis CSS, **IconChip** (ikon dalam kotak berwarna).
- Topbar (`header.tsx`) boleh diperbaiki secara visual: remah roti "OAMS / Nama halaman", menu pengguna dengan avatar inisial; fungsi profil, keluar, dan tombol buka sidebar di HP tetap.

## 9. Halaman

### 9.1 Dashboard (`/dashboard`)

Urutan: judul (Dashboard, "Ringkasan inventaris DPC PDI Perjuangan", tanggal hari ini, status sistem dari `GET /health`, tombol Muat ulang yang memuat ulang query) → 4 KPI → panel Operasional → 3 grafik → Aktivitas terbaru. Kartu sapaan dihapus.

- **KPI:** Total inventaris (`total`, keterangan aktif/diarsipkan/dilepas), Aset aktif (`active`, persen dari total), Pengguna aktif (hanya bila `users.manage`, seperti sekarang), Kategori barang (jumlah kategori aktif). Pemegang tanpa `users.manage` melihat 3 KPI yang melebar.
- **Operasional** (satu kartu, 6 metrik tertaut, sesuai izin yang sekarang): Mutasi menunggu, Peminjaman aktif, Peminjaman terlambat (merah bila > 0), Dalam perbaikan, Laporan kerusakan baru (kuning bila > 0), Barang dilepas. Bila ada sesi stock opname terbuka, satu baris tambahan "Stock opname berjalan · 34/41" tertaut ke sesinya.
- **Grafik:** Kondisi barang (donut + legenda, dari `byCondition`), Per kategori (8 teratas, batang berwarna, dari `byCategory`), Perolehan per tahun (batang, dari data baru §10). Grafik tahun disembunyikan bila kurang dari 2 tahun berdata; jumlah barang tanpa tahun perolehan ditampilkan sebagai keterangan.
- **Aktivitas terbaru:** 8 entri terakhir dari `GET /audit-logs` yang menyangkut barang (modul `assets`, `mutations`, `loans`, `maintenance`, `disposals`), kolom Waktu, Aktivitas (ikon berwarna + label aksi yang sudah ada), Barang (nama + kode bila tersedia), Oleh, Status (bila relevan). Hanya tampil bagi pemegang `audit_logs.view_all` atau `audit_logs.view_operational`; tautan "Buka audit log".

### 9.2 Inventaris (`/assets`)

Judul + label "N barang aktif" + tombol Cetak QR dan Tambah barang (sesuai izin) → StatusChips (lihat di bawah) → kartu berisi FilterBar (pencarian kode/nama/merek/model/nomor seri, kategori, kondisi, kepemilikan, "Tampilkan arsip & dilepas", tombol Kolom) → BulkBar saat ada yang dipilih → tabel → paginasi.

- Kolom: pilih, Kode, Nama (merek/model di bawahnya), Kategori (titik warna), Status (pil), Kondisi (titik), Penanggung jawab (inisial + nama), Diperbarui, Aksi (lihat, ubah sesuai izin, menu lainnya). Unit kerja tersedia di menu Kolom (mati bawaan). Kolom Lokasi tidak ada.
- Urutkan: Kode, Nama, Diperbarui (parameter urut API yang ada).
- Pilih banyak: per halaman yang tampil; pilihan dikosongkan saat filter/halaman berubah; Cetak QR terpilih membuka `/qr/print?ids=…`.
- Header tabel lengket saat digulir (lihat §11); baris memiliki efek hover; klik baris membuka detail.
- **StatusChips menggantikan pilihan status** dan tidak boleh menghilangkan kemampuan yang ada: "Semua" (barang aktif), satu tombol untuk setiap status aktif yang jumlahnya > 0 (dari `byStatus`), ditambah **Dihapuskan** (jumlah dari `disposed`) bila > 0, sehingga barang yang dilepas tetap bisa disaring tersendiri. Jumlah pada tombol adalah jumlah keseluruhan (tidak mengikuti filter lain) dan diberi keterangan kecil bila filter lain aktif. *(Keputusan builder setelah pemeriksaan.)*
- **Filter, urutan, dan halaman Inventaris disimpan di URL** (`/assets?status=…&condition=…&categoryId=…&sort=…&page=…`), dibaca saat halaman dibuka dan diperbarui saat berubah (`router.replace`, tanpa menumpuk riwayat). Saat ini filter belum di URL; ini ditambahkan agar dashboard bisa menaut ke daftar tersaring (mis. donut kondisi → `/assets?condition=MAJOR_DAMAGE`) dan tautan bisa dibagikan. Halaman daftar lain tetap seperti sekarang. *(Keputusan builder.)*

### 9.3 Detail dan formulir barang

- Detail (`/assets/[id]`): kepala halaman berisi kode, nama, pil status, titik kondisi, kategori; tombol aksi dikelompokkan (aksi utama terlihat, sisanya di menu "Lainnya" bila terlalu banyak di layar sempit); banner (dipinjam, mutasi menunggu, perbaikan, dilepas, diarsipkan) memakai warna alurnya; tab tetap sama; tab Informasi berupa daftar label–nilai dua kolom dalam 2–3 kartu.
- Formulir (tambah/ubah barang, mutasi baru, peminjaman baru, pelepasan baru): kartu berseksi, grid 2 kolom di desktop, bilah tombol di bawah; aturan, validasi, dan field terkunci tetap.

### 9.4 Halaman operasional

Mutasi, Peminjaman, Stock Opname, Pemeliharaan, Pelepasan memakai pola daftar yang sama dengan Inventaris (PageHeader → tab/StatusChips sesuai halaman → FilterBar → tabel → paginasi) dan pola detail yang sama dengan barang. Yang khusus:

- **Stock opname sesi** tetap mengutamakan HP: panel pemindai di atas, penghitung dengan warna hasil.
- **Laporan opname** dan **Cetak QR**: tampilan layar mengikuti sistem baru. `print.css` dan tata letak stiker **tidak diedit**; stiker tidak terpengaruh karena font dan ukurannya ditetapkan sendiri. Laporan opname yang dicetak boleh ikut berganti font/warna baru, asalkan tetap terbaca rapi di A4 (diperiksa lewat pratinjau cetak). *(Keputusan builder.)*
- **Scan QR**: kartu kamera di tengah dengan input manual di bawahnya pada HP, berdampingan di desktop.

### 9.5 Data master dan administrasi

Kategori, Unit Kerja, Pegawai, Pengguna, Role & Izin, Audit Log, Profil: pola daftar + dialog yang sama. Role & Izin mempertahankan matriks izin dalam tabel rapi; Audit Log mempertahankan filter dan memakai ikon berwarna per modul seperti aktivitas terbaru.

### 9.6 Di luar shell

Halaman masuk, lupa kata sandi, dan halaman QR publik (`/a/[token]`) disesuaikan warna dan font agar konsisten (keputusan builder: perubahan ringan saja).

## 10. Perubahan backend (satu, kecil)

`GET /assets/statistics` menambah `byAcquisitionYear: { year: number; count: number }[]` (barang aktif dengan `acquisition_date`, dikelompokkan per tahun kalender Asia/Jakarta, urut naik) dan `withoutAcquisitionYear: number`. Tanpa perubahan skema; field lama tidak berubah. Diuji e2e.

## 11. Responsif

- ≥1440 px: lebar konten sampai 1440 px; KPI 4 kolom; grafik 3 kolom; metrik operasional 6 kolom.
- 1024–1439 px: KPI 4 kolom bila muat, grafik 2+1, metrik 3×2.
- 768–1023 px: KPI 2×2, grafik bertumpuk, tabel menggulir horizontal di dalam kartunya (bukan seluruh halaman).
- **Header tabel lengket hanya di ≥1024 px**, di mana tabel tidak perlu digeser ke samping (wadah tabel tanpa `overflow-x` di ukuran itu). Di bawah 1024 px tabel menggulir ke samping di dalam kartunya dan header tidak lengket. *(Keputusan builder: CSS tidak bisa membuat header lengket ke halaman sekaligus menggulir ke samping tanpa area gulir bertinggi tetap.)*
- < 768 px: sidebar tetap perilaku drawer yang sekarang; kolom tabel kurang penting disembunyikan seperti sekarang; formulir satu kolom; pemindai QR selebar layar.

## 12. Pengujian dan pemeriksaan

- Unit test baru untuk logika komponen yang bukan sekadar gaya: penyimpanan pilihan kolom, pemetaan warna kategori/status, pemetaan entri audit ke baris aktivitas, aturan tampil grafik tahun.
- E2E backend untuk `byAcquisitionYear`.
- Setiap tahap: lint, build, semua test hijau; pemeriksaan browser (1440, 768, 375 px) halaman yang disentuh, console tanpa error baru, fungsi utama halaman dicoba (filter, simpan formulir, dialog).
- Snapshot sidebar sebelum/sesudah sama persis (§6).
- Server pengembangan dihentikan sepenuhnya setelah pemeriksaan (atau memakai server pemilik yang sedang berjalan).

## 13. Tahapan

1. Token, font, pengunci sidebar, komponen bersama.
2. Dashboard (+ perubahan backend §10).
3. Inventaris.
4. Detail dan formulir barang.
5. Mutasi, Peminjaman, Stock Opname, Pemeliharaan, Pelepasan, Scan QR, Cetak QR.
6. Data master, administrasi, profil, halaman di luar shell.
7. QA responsif dan visual menyeluruh, review independen, dokumentasi.

Setiap tahap di-commit terpisah; pemilik yang mendorong ke GitHub, lalu deploy seperti biasa.

## 14. Diserahkan ke builder

- Nama file komponen baru dan pembagian prop, selama API komponen lama tetap.
- Ikon spesifik (lucide-react yang sudah dipakai) untuk tiap metrik dan aktivitas.
- Teks bantuan, urutan kolom sekunder, jarak persis dalam rentang §7.3.
- Cara memetakan entri audit ke "Barang" dan "Status" di aktivitas terbaru, memakai data yang ada di entri.
