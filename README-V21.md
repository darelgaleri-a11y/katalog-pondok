# Katalog Multi-Toko V21 — Konsistensi bukti penerimaan & rekap

## Fitur baru
- Serah-terima yang dicatat admin kini wajib menyebut **petugas**, **nama penerima**, dan **cara penerimaan**.
- Jalur RPC admin V18 `record_student_handover_v18` dicabut untuk peran aplikasi agar tidak melewati isian V21. Jalur petugas `staff_receipt_v20` tetap tersedia.
- Ringkasan **Siap, belum diserahkan** di Operasional Santri: pesanan aktif dengan status `paid`, `prepared`, atau `completed` yang belum memiliki catatan penyerahan.
- Rincian bukti penerimaan masuk ke daftar operasional, cetak, serta ekspor CSV. Identitas tetap disamarkan secara default.
- Catatan V18/V19 yang sudah ada **tidak dihapus**; penerima/metode untuk data lama dapat kosong.

## Upgrade dari V20
1. Cadangkan database Supabase dan folder V20.
2. Jalankan **hanya** `supabase-v21-admin-receipts.sql` di Supabase SQL Editor (proyek sama).
3. Salin `.env` dari proyek V20 ke folder V21, jangan unggah `.env` ke GitHub.
4. Di VS Code: `npm install` lalu `npm run dev`.
5. Masuk ke `/admin` → Operasional Santri dan klik **Muat ulang laporan**.
6. Tes catat penyerahan admin dengan pesanan percobaan yang sudah diverifikasi. Isi nama petugas, penerima, metode `1` atau `2`, lalu konfirmasi.
7. Tes `/petugas` untuk Putra dan Putri. Checkout, stok, pembayaran, dan semua data lama harus tetap berfungsi.

## Perhatian
- Pengambilan daftar kiriman menggunakan paginasi; memuat semua pesanan santri yang diizinkan untuk admin, yang dapat menjadi berat pada jumlah sangat besar.
- `completed` tanpa catatan bukti penerimaan tetap masuk hitungan *belum diserahkan* sampai ada bukti operasional yang tercatat.
- Bukti merupakan deklarasi petugas/admin, bukan OTP atau tanda tangan penerima.
- SQL migrasi belum diuji pada proyek Supabase kamu. Uji lokal sebelum deploy Vercel.
