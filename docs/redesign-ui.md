# OAMS — Redesign UI/UX (November 2026)

Dokumen ini merangkum redesign tampilan OAMS: sistem desain, komponen, aturan warna, pengunci sidebar, dan cara memeriksanya. Desain: [docs/superpowers/specs/2026-11-20-oams-ui-redesign-design.md](superpowers/specs/2026-11-20-oams-ui-redesign-design.md). Rencana: [docs/superpowers/plans/2026-11-21-oams-ui-redesign.md](superpowers/plans/2026-11-21-oams-ui-redesign.md).

Redesign ini hanya mengubah tampilan. Fitur, data, hak akses, alamat halaman, dan kontrak API tetap; satu tambahan kecil di API statistik (§6).

---

## 1. Sistem desain

Token ada di `frontend/src/app/globals.css` (`:root` dan `@theme inline`).

| Peran | Nilai |
|---|---|
| Latar halaman / kartu | `#F7F8FA` / `#FFFFFF` |
| Primer (hover) | `#2457D6` (`#1D47B5`) |
| Judul / isi / sekunder | `#172033` / `#475569` / `#64748B` |
| Garis | `#E2E8F0` |
| Sukses / peringatan / bahaya | `#16A36A` / `#D99A28` / `#DC5656` |

Warna aksen (kuat / lembut): biru, hijau, ungu, kuning, merah, teal, oranye, abu — kelas Tailwind `text-tone-<nama>`, `bg-tone-<nama>-soft`, `bg-tone-<nama>` (titik). Font **Inter** dimuat lewat `next/font/google` di `app/layout.tsx` (diunduh saat build, disajikan dari server sendiri). Radius kartu 11 px (`rounded-card`), tombol/input 8 px, bayangan kartu tipis (`shadow-card`), lebar konten maksimal 1440 px.

## 2. Arti warna

Semua pemetaan ada di satu tempat: `frontend/src/lib/tones.ts`.

- **Status barang** (`STATUS_TONE`): Tersedia hijau, Digunakan biru, Disimpan abu, Dipinjam ungu, Dalam perbaikan oranye, Hilang merah, Dihapuskan abu, Dikembalikan teal.
- **Kondisi** (`CONDITION_TONE`): Baik hijau, Rusak ringan kuning, Rusak berat oranye, Tidak layak pakai merah — ditampilkan sebagai titik + teks.
- **Alur** (`FLOW_TONE`): mutasi ungu, peminjaman biru, terlambat merah, perbaikan oranye, laporan kerusakan kuning, pelepasan abu, stock opname teal.
- **Kategori** (`categoryTone(id)`): warna tetap per kategori (hash id), tidak berubah walau jumlah atau urutan berubah.
- **Aktivitas / audit log** (`ACTIVITY_MODULE_STYLE` di `features/dashboard/dashboard-model.ts`): ikon dan warna per modul.

## 3. Sidebar dikunci

Sidebar (`components/layout/sidebar.tsx`) tidak diedit. `AppShell` membungkusnya dengan `<div class="sidebar-legacy contents">`; kelas itu (di `globals.css`) mengembalikan nilai lama (`--primary #1d4ed8`, token `--sidebar-*`, font sistem), sehingga token dan font baru tidak mengenai sidebar.

Pemeriksaan: skrip di `.superpowers/sdd/2026-11-21-oams-ui-redesign/sidebar-probe.js` membandingkan gaya terhitung (warna, font, ukuran, padding, posisi) setiap elemen sidebar dengan rekaman sebelum redesign, di lebar 1440 px dan 375 px (laci terbuka). Hasil akhir: identik di kedua lebar. Tinggi sidebar desktop dan posisi teks dasarnya mengikuti panjang halaman, sehingga tidak dibandingkan.

## 4. Komponen

Komponen lama di `components/ui` mempertahankan props-nya (tidak perlu mengubah halaman yang memakainya). Tambahan:

| Komponen | Kegunaan |
|---|---|
| `PageHeader` (+ `meta`, `HeaderPill`) | kartu judul dengan aksen biru di kiri |
| `StatTile` | kartu KPI: ikon berwarna, garis atas berwarna, angka besar, satu baris keterangan |
| `MetricStrip` | beberapa metrik kecil dalam satu kartu, masing-masing bisa ditautkan |
| `StatusChips` | tombol cepat penyaring dengan titik warna dan jumlah |
| `FilterBar`, `BulkBar` | baris pencarian/filter; bilah aksi saat ada baris dipilih |
| `ColumnMenu` + `lib/column-prefs.ts` | pilih kolom tabel, disimpan di browser (`oams.columns.<tabel>`) |
| `SortableHeader` | judul kolom yang bisa diurutkan |
| `IconChip` | ikon dalam kotak berwarna lembut |
| `DonutChart`, `BarList`, `ColumnChart` | grafik CSS sederhana tanpa library |
| `Badge tone=…`, `Alert tone=…` | label dan banner berwarna menurut alur |

Header tabel menempel di bawah topbar saat digulir pada layar ≥1280 px; di layar lebih kecil tabel digeser ke samping di dalam kartunya (pada 1024–1279 px tabel tidak muat di samping sidebar). Tabel yang terlalu lebar (audit log) memakai `stickyHeader={false}` dan selalu bisa digeser.

## 5. Halaman

- **Dashboard**: judul + tanggal + status sistem + Muat ulang; 4 KPI (Total inventaris, Aset aktif, Pengguna aktif bila boleh mengelola pengguna, Kategori barang); panel Operasional (mutasi menunggu, pinjaman aktif/terlambat, dalam perbaikan, laporan kerusakan baru, dilepas) + baris stock opname berjalan; grafik kondisi (tautan ke daftar tersaring), per kategori, perolehan per tahun (hanya bila ada ≥2 tahun berdata); aktivitas terbaru (hanya pemegang izin audit log; diambil per modul agar cetak QR massal atau konfirmasi opname tidak mendesak aktivitas lain).
- **Inventaris**: tombol cepat status (termasuk Dihapuskan; status yang sedang dipilih selalu tampil, dan semua status tersedia saat "Tampilkan arsip & dilepas" dicentang; jumlahnya menghitung barang aktif dan diberi keterangan bila filter lain aktif), pencarian dan filter, menu Kolom, urutkan Kode/Nama/Diperbarui, pilih baris + Cetak QR terpilih (pemegang `qr.generate`). Filter, urutan, dan halaman tersimpan di alamat halaman (`/assets?status=…&condition=…`), sehingga bisa dibagikan dan dashboard bisa menaut ke daftar tersaring. Nilai URL yang tidak sah diabaikan (kembali ke bawaan).
- **Detail** (barang, mutasi, peminjaman, pemeliharaan, pelepasan, stock opname, pegawai): kartu kepala dengan aksen biru; banner barang memakai warna alurnya.
- **Lainnya**: semua halaman memakai komponen yang sama; keluaran cetak stiker QR tidak berubah (`print.css`, tata letak stiker tidak diedit).

## 6. Perubahan backend

`GET /assets/statistics` menambah `byAcquisitionYear: { year, count }[]` (barang aktif per tahun tanggal perolehan, urut naik) dan `withoutAcquisitionYear` (barang aktif tanpa tanggal perolehan). Tanpa perubahan skema; diuji e2e.

## 7. Perbaikan yang ikut

Formulir ubah barang sebelumnya menampilkan "Pilih kategori..." (dan unit kerja kosong) walaupun barang punya nilai, karena pilihan dimuat setelah formulir terpasang; nilai kini diterapkan ulang setelah pilihan termuat. Data yang dikirim sudah benar sejak awal; yang salah hanya tampilannya.

## 8. Pengujian

Unit test baru: `lib/tones`, `lib/column-prefs`, `components/ui/charts` (`donutSegments`), `features/dashboard/dashboard-model` (blok per izin, aturan grafik tahun, baris aktivitas), `features/assets/asset-list-state` (URL ↔ filter, tombol status, pilihan baris). E2E backend: statistik per tahun perolehan. Setiap tahap diperiksa di browser pada 1440, 768, dan 375 px.

## 9. Review akhir

Review independen atas seluruh diff redesign: tidak ada temuan Critical; kelima fokus review (blok dashboard per izin, URL yang diubah tangan, pilihan baris yang basi, data kosong, warna kategori stabil), kunci sidebar, dan tambahan SQL statistik terpenuhi. Lima temuan Important diperbaiki: tabel melebar keluar halaman pada 1024–1350 px; aktivitas terbaru kosong setelah cetak QR massal; status tanpa barang aktif (mis. Hilang yang diarsipkan) tidak bisa disaring; kotak pencarian tidak mengikuti URL; tidak ada keterangan bahwa jumlah tombol status mengabaikan filter lain.

Perbedaan dari desain yang perlu dikonfirmasi pemilik: header tabel lengket mulai 1280 px (bukan 1024).

### Lanjutan (21 Nov 2026)

- Halaman daftar Mutasi, Peminjaman, Pemeliharaan, dan Pelepasan kini memakai pola Inventaris: tombol status (atau alasan, untuk pelepasan) berwarna dengan jumlahnya, pencarian dalam bilah filter, dan label jumlah di judul (mis. "2 terlambat", "1 laporan baru"). Jumlah diambil per status dengan permintaan kecil (hooks/use-list-counts.ts). Stock Opname mendapat label sesi berjalan / jumlah sesi.
- Perbaikan kecil yang sebelumnya ditunda dan kini selesai: angka Terlambat dan Laporan kerusakan hanya berwarna bila > 0; grafik 3 kolom mulai 1440 px; tidak ada slot KPI kosong; grafik tahun maksimal 8 batang dengan tahun kosong ikut tampil dan tahun lama digabung "≤tahun"; halaman di luar jangkauan pindah ke halaman terakhir; judul halaman memakai h1; banner terlambat/dilepas kembali berperan sebagai peringatan; skema Swagger untuk statistik per tahun; filter tetap terbawa setelah login; sudut tabel aktivitas; kode aksi tidak tampil dua kali di audit log.

Masih ditunda (kecil): dua kategori bisa kebetulan berwarna sama; kategori tak dikenal di URL menyaring jadi kosong; kolom Barang di aktivitas sering berisi "Lihat barang".
