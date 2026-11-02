# V26.1 — Perbaikan Rekonsiliasi

Masalah V26: `column payment_voids_v26.created_at does not exist` saat membuka Rekonsiliasi.

Penyebab: fungsi pengambilan data `ReconciliationDashboard.jsx` selalu mengurutkan `created_at`, termasuk tabel `payment_voids_v26` yang memiliki `voided_at` (bukan `created_at`).

Perbaikan: gunakan parameter kolom pengurutan; tabel koreksi diurutkan dengan `voided_at`. Perhitungan penerimaan bersih sudah mengecualikan pembayaran yang dibatalkan sesuai `receipt_id`.

**Tidak ada SQL baru. Jangan menambah kolom `created_at` atau menghapus catatan koreksi.**

Cara install:
1. Cadangkan folder V26 dan database jika memungkinkan.
2. Salin `.env` dari V26 ke V26.1.
3. Jalankan `npm install` lalu `npm run dev`.
4. Masuk ke `/admin` > Rekonsiliasi. Tekan "Muat ulang".
5. Buat catatan pembayaran uji, lalu koreksi melalui Kas & Koreksi. Pastikan nominal diterima pada Rekonsiliasi berkurang dan selisihnya diperbarui, termasuk setelah halaman di-refresh.
6. Uji checkout, stok, dan dashboard lain sebelum deployment ke Vercel.

Jika hanya ingin mengedit V26 yang sudah ada, ganti file `src/ReconciliationDashboard.jsx` dengan file dari V26.1 ini. Tidak perlu mengganti folder lain.
