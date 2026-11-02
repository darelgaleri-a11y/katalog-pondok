# Katalog Multi-Toko V32 — Simple Mode

Basis: V31.1, memakai database Supabase yang sama. **Tidak ada migrasi SQL tambahan.**

## UI sederhana

- Beranda pelanggan: **Kirim Barang untuk Santri**, **Belanja Umum**, **Lacak Pesanan**. Pelanggan tidak memerlukan akun.
- Checkout: mengisi identitas, pilihan Putra/Putri, tanggal yang tersedia, dan tombol **Pesan Lewat WhatsApp**. Validasi harga, stok, dan pesanan tetap memakai RPC Supabase.
- Portal petugas `/petugas`: pilih **Belum Diserahkan** / **Sudah Diserahkan**, kemudian tekan **Sudah Diserahkan** untuk membuka formulir bukti penerimaan.
- Admin `/admin`: menu utama Toko & Produk, Pesanan, Kiriman Santri, Keuangan, Pengaturan. Fitur laporan kas dan jurnal lama ada di **Keuangan > Fitur Keuangan Lanjutan**.

## Jalankan

Buat file `.env` menggunakan konfigurasi Supabase yang dipakai pada V31.1 (jangan memasukkan service_role / secret key), kemudian:

```bash
npm install
npm run build
npm run dev
```

Halaman pelanggan `/`, petugas `/petugas`, admin `/admin`, pelacakan `/lacak`.

## Pengujian wajib sebelum deploy

1. Build (`npm run build`) tanpa error.
2. Login admin, tambah dan edit toko/produk.
3. Checkout umum dan santri ke WA kasir yang benar; stok tetap terpotong.
4. Portal petugas Putra/Putri hanya melihat kiriman sendiri, catat bukti penerimaan.
5. Laporan, rekonsiliasi, kas, dan fitur keuangan lanjutan masih bisa dibuka.
6. Pastikan tidak ada file `.env` dan `node_modules` dalam ZIP/repo.

**Jangan langsung update Vercel sebelum pengujian lokal selesai.**
