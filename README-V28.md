# V28 — Laporan kas bulanan WIB

Fitur baru: menu Admin → Kas Bulanan WIB. Menjumlahkan pembayaran berdasarkan `received_at` dan koreksi berdasarkan `voided_at` dalam zona Asia/Jakarta (UTC+7). Disajikan sebagai laporan dinamis baca-saja dari Supabase. Tidak mengubah penutupan V27, tabel keuangan, stok atau checkout.

## Memasang
1. Cadangkan proyek dan database V27.
2. Jalankan **hanya** `supabase-v28-monthly-wib.sql` di SQL Editor proyek Supabase yang sama.
3. Salin `.env` V27 ke folder V28. Jangan upload `.env` ke GitHub.
4. Jalankan `npm install` lalu `npm run dev`.
5. Login admin, buka Kas Bulanan WIB, pilih bulan, dan klik Tampilkan laporan.

## Uji
- Cocokkan transaksi sekitar pergantian hari WIB dan UTC.
- Pastikan metode transfer dan QRIS sesuai total pembayaran V25.
- Pastikan koreksi dibebankan ke bulan saat koreksi dibuat, bukan bulan penerimaan awal.
- Pastikan petugas tidak bisa menjalankan RPC dan pelanggan anonim tidak bisa melihat nominal.
- Pastikan fitur V27 checkout, stok, rekonsiliasi, tutup kas UTC tetap berfungsi.

**Batasan:** snapshot V27 masih dalam UTC. Belum ada penguncian periode atau mekanisme jurnal penyesuaian untuk transaksi terlambat, sehingga V28 bukan proses tutup buku resmi. Jangan menjumlahkan kas bersih snapshot UTC dengan kas bersih laporan WIB sebagai satu angka.
