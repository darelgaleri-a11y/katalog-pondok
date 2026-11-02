# V25: Rekonsiliasi Pembayaran

1. Backup database dan V24. Jalankan `supabase-v25-reconciliation.sql` di SQL Editor pada proyek Supabase yang sama.
2. Salin `.env` V24 ke V25, jalankan `npm install` dan `npm run dev`.
3. Di `/admin` buka tab **Rekonsiliasi**. Buat pesanan percobaan, verifikasi mutasi secara manual, isi nominal, referensi, dan tanggal penerimaan. Simpan.
4. Verifikasi total diterima, selisih, CSV, serta bahwa status pesanan **tidak otomatis berubah**.
5. Uji referensi ganda ditolak, pembayaran pada pesanan batal/kedaluwarsa ditolak, dan akun petugas tidak dapat mengakses tabel maupun RPC.

Catatan: Tidak terhubung otomatis ke rekening bank atau QRIS. Catatan pembayaran perlu dibandingkan bukti eksternal. Catatan sengaja append-only untuk mencegah pengubahan diam-diam. Jika ada kesalahan entry, jangan memasukkan data nyata sebelum tersedia prosedur koreksi berbasis audit. Jangan menjalankan SQL V25 pada produksi sebelum pengujian staging. Fungsi dapat mencatat pembayaran parsial atau lebih; bukan pengubah status pembayaran otomatis. Nomor referensi pembayaran dapat bersifat sensitif dan hanya terlihat admin.
