# V26 — Koreksi Pembayaran dan Kas Harian

1. Backup database dan proyek V25.
2. Jalankan `supabase-v26-cash-corrections.sql` **hanya** pada proyek Supabase V25.
3. Salin `.env` dari V25; jangan unggah ke GitHub.
4. `npm install`, lalu `npm run dev`. Login `/admin` → **Kas & Koreksi**.
5. Gunakan transaksi percobaan: catat pembayaran V25, koreksi dengan alasan, periksa laporan hari ini, dan pastikan koreksi kedua ditolak.

## Penting
- Koreksi berupa void utuh satu catatan, bukan pengeditan nominal. Untuk mengganti nominal, catat pembayaran baru lewat Rekonsiliasi.
- Laporan kas V26 memakai tanggal UTC sesuai `received_at`/`voided_at`, bukan otomatis waktu lokal pondok.
- Menu Rekonsiliasi V26 sudah mengurangi catatan yang di-void dari total per pesanan. **Dashboard Keuangan V24 masih menghitung berdasarkan status pesanan**, bukan penerimaan bersih V26; jangan samakan angka V24 dengan saldo kas.
- Tidak ada koneksi rekening/QRIS langsung. Rekonsiliasi manual harus dicek dengan bukti kasir/bank.
- Akun petugas tidak mendapat izin baca atau koreksi.
- Jangan deploy Vercel produksi sebelum menguji SQL, hak akses, dan alur stok/checkout.
