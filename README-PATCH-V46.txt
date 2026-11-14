# Patch V46 — Perbaikan Admin & Hapus Pesanan

## Isi patch
- `src/main.jsx` — tombol hapus pada setiap kartu pesanan dan pemanggilan RPC aman.
- `src/style.css` — keterbacaan dan tata letak admin diperbaiki, termasuk tombol hapus responsif.
- `supabase-v46-delete-order.sql` — fungsi database untuk penghapusan pesanan dengan pemeriksaan admin dan pengembalian stok.
- `tests/student-preparation-excel-matrix-v1.test.mjs` — pengujian regresi fitur Excel dan penghapusan pesanan.

## Cara memasang
1. Cadangkan proyek dan database terlebih dahulu.
2. Ekstrak ZIP ke folder proyek, lalu izinkan penggantian `src/main.jsx` dan `src/style.css`.
3. Buka Supabase Dashboard → SQL Editor.
4. Jalankan seluruh isi `supabase-v46-delete-order.sql` satu kali.
5. Jalankan `npm run build`, lalu `npm run dev` untuk menguji lokal.

## Aturan penghapusan
- Hanya admin utama yang dapat menghapus pesanan.
- Stok yang masih direservasi dikembalikan otomatis.
- Pesanan dengan catatan serah-terima atau rekonsiliasi pembayaran tidak dapat dihapus, untuk menjaga bukti operasional dan jejak keuangan.
- Riwayat status terkait ikut terhapus sesuai relasi `ON DELETE CASCADE`.

Patch ini tidak mengubah skema kolom tabel atau meminta migrasi data.
