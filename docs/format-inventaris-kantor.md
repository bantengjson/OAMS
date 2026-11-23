# Format Inventaris Kantor

OAMS memakai format inventaris DPC PDI Perjuangan Kota Surabaya. Desain: [superpowers/specs/2026-11-23-oams-format-inventaris-kantor-design.md](superpowers/specs/2026-11-23-oams-format-inventaris-kantor-design.md).

## Kode barang

`NG.A/012/DPC/2023-01` = golongan . huruf ruangan / nomor jenis / kode organisasi / tahun pengadaan - nomor unit.

| Bagian | Asal |
|---|---|
| `NG` / `BG` | Golongan jenis barang (BG = bergerak/kendaraan, NG = tidak bergerak) |
| `.A` | Ruangan saat barang **didaftarkan**; kendaraan (BG) dan tanah & bangunan (NG 001) tanpa huruf |
| `012` | Nomor jenis barang (3 digit) |
| `DPC` | Pengaturan `asset_code_org`; diubah di halaman Jenis Barang, berlaku untuk kode baru |
| `2023` | Tahun pengadaan; `TT` bila tidak diketahui (hanya data impor) |
| `-01` | Nomor unit per awalan, 2 digit, menjadi 3 digit setelah 99 |

- Pindah ruangan lewat **Mutasi**; kodenya tidak berubah.
- Selama stiker belum pernah dicetak, jenis, ruangan awal, dan tahun boleh dikoreksi lewat Ubah barang; kode dibuat ulang (tercatat di riwayat sebagai `asset.code_changed`).
- Setelah stiker dicetak, jenis dan ruangan awal terkunci. Bila salah: arsipkan, daftarkan ulang, cetak stiker baru. Tahun yang diisi belakangan hanya disimpan.
- Tahun yang sudah terisi tidak bisa dikosongkan.

## Jenis barang dan ruangan

- **Jenis Barang** (menu Data Master): nomor unik per golongan, otomatis lanjut dari nomor terbesar. Golongan, nomor, dan tanda "barang kelompok" terkunci setelah dipakai.
- **Ruangan** (menu Data Master): A–O dari seed; ruangan baru mendapat huruf berikutnya (P, …, Z, AA). Huruf tidak bisa diubah.

## Kolom barang

Spesifikasi (merk/tipe/warna), Tahun pengadaan, Sumber (terisi = hibah, kosong = beli; cara perolehan diisi otomatis), Nomor seri / nomor polisi. Formulir tambah bisa membuat 1–100 unit identik sekaligus, masing-masing dengan kode dan QR.

Kondisi: Baik / Perlu Perbaikan / Rusak.

## Barang Kelompok

Tab **Barang Kelompok** di halaman Inventaris: barang yang dihitung jumlahnya tanpa QR (peralatan dapur). Satu baris per jenis + ruangan (+ tahun/spesifikasi/sumber), jumlah per kondisi. Setiap perubahan wajib beralasan dan tercatat di riwayat. Saat stock opname, petugas mengisi hasil hitung; menutup sesi menerapkan hasil hitung, baris yang tidak dihitung tetap.

## Laporan

Tombol **Unduh Daftar Inventaris** di halaman Inventaris: `.xlsx` berbentuk seperti Excel kantor, per ruangan atau keseluruhan (`GET /api/v1/reports/inventory?mode=per-room|overall`). Barang dilepas tercantum dengan Keterangan "Tidak Ada".

## Impor data kantor (sekali jalan)

Data kantor **tidak pernah di-commit** (repo publik). Folder `data-kantor/` di-*gitignore*.

1. Daftar gabungan dan file data dibuat dari Excel kantor dengan `data-kantor/merge.py`:
   `python data-kantor/merge.py "data-kantor/Gabungan Inventaris DPC (draf 3).xlsx" data-kantor/import-data.json`
2. Pratinjau (tidak menulis apa pun):
   `cd backend && npx tsx src/database/import-office/cli.ts --data ../data-kantor/import-data.json --report "../data-kantor/Pratinjau Impor.xlsx"`
3. Setelah pratinjau disetujui pemilik, backup database lalu tambahkan `--write`. Impor menghapus data uji (barang dan turunannya, jenis dan lokasi lama), membuat jenis, ruangan, barang, dan barang kelompok dalam satu transaksi, lalu memasang penanda `office_import_done` sehingga tidak bisa dijalankan dua kali.
4. Di server: salin `import-data.json` dengan `scp` ke `~/oams/backups/`, masukkan ke kontainer dengan `docker compose cp backups/import-data.json backend:/tmp/import-data.json`, lalu `docker compose exec backend node dist/database/import-office/cli.js --data /tmp/import-data.json --report /tmp/pratinjau.xlsx` (tambahkan `--write` setelah disetujui). Ambil pratinjau dengan `docker compose cp backend:/tmp/pratinjau.xlsx backups/`.
