# V31 — Tutup Kas Harian WIB

1. Cadangkan database dan kode V30; gunakan staging lebih dulu.
2. Jalankan `supabase-v31-close-wib.sql` satu kali di Supabase SQL Editor.
3. Salin `.env` V30 ke folder V31, lalu `npm install` dan `npm run dev`.
4. Buka `/admin` → **Tutup Kas WIB**. Coba tanggal WIB kemarin menggunakan data uji.
5. Pastikan pembayaran, koreksi, dan jurnal telah tercatat sebelum menutup.

**Penting:** Snapshot V31 tidak mengubah Tutup Kas UTC V27 dan **belum mengunci** fungsi pencatatan pembayaran/jurnal sesudah penutupan. Juga tidak memverifikasi saldo bank/QRIS. Periode tercatat dalam Asia/Jakarta; jika pondok menggunakan WITA, jangan pakai WIB sebagai standar akuntansi tanpa persetujuan operasional.

Uji: SQL, login admin, menu baru, snapshot hari lalu, duplikasi ditolak, total penerimaan/koreksi/jurnal, persistensi refresh, CSV, akses petugas ditolak, checkout dan stok tetap normal.
