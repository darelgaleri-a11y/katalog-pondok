# V30 — Jurnal penyesuaian WIB (tahap transisi)

Backup database V29 sebelum pemasangan. Jalankan `supabase-v30-adjustments-wib.sql` **sekali** di Supabase SQL Editor pada proyek pengujian. Salin `.env` V29, jalankan `npm install` lalu `npm run dev`. Buka `/admin` → **Jurnal WIB**.

Fitur: catat jurnal bertanggal WIB dengan nominal plus/minus, metode, referensi unik, alasan dan akun admin; ringkasan bulanan memperlihatkan angka V28 dan jurnal secara terpisah. Hanya admin dapat memakai RPC melalui pemeriksaan `admin_users` dan RLS. Tidak mengubah atau migrasikan data tutup kas V27, tidak mengubah stok, checkout, maupun transaksi rekonsiliasi asli.

**Batasan:** Ini BELUM menyeragamkan mekanisme tutup kas UTC V27 menjadi WIB; hanya jurnal penyesuaian dan laporan tambahan menggunakan WIB. Kontrol tanggal tertutup bersifat konservatif dan memeriksa tanggal yang sama pada penutupan V27. Belum menggantikan sistem akuntansi resmi, bukti mutasi bank, atau prosedur approval berlapis. Gunakan data uji; jangan jalankan di produksi sebelum audit.

Uji: SQL sukses; login admin; petugas tidak dapat memanggil RPC; jurnal positif/negatif; referensi ganda ditolak; laporan cocok; cetak/laporan lama, checkout, stok dan pelacakan tetap bekerja.
