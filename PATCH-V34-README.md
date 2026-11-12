# Katalog Pondok — Patch Edit Pesanan Santri V34

Paket ini berisi salinan proyek Katalog Pondok dengan antarmuka edit pesanan santri dan migrasi SQL yang menyertainya.

## Keamanan paket
Paket dibuat dari arsip proyek yang diberikan. Berkas `.env`, `.env.local`, kunci Firebase Admin SDK, folder `.git`, `node_modules`, dan hasil build tidak disertakan. Siapkan `.env` milik Anda sendiri secara lokal dari `.env.example` bila tersedia.

## Sebelum menerapkan
1. Buat backup database Supabase.
2. Uji dahulu di proyek/staging Supabase, bukan langsung di produksi.
3. Periksa struktur `catalog_state.data`, format data produk, dan aturan stok di database Anda.
4. Migrasi menambahkan tabel `order_edit_history` dan RPC `admin_edit_student_order_v1`.

## Urutan penerapan
1. Ekstrak ZIP.
2. Buka folder `katalog-pondok` di VS Code.
3. Jalankan `npm install`.
4. Buka Supabase SQL Editor dan jalankan `supabase-v34-edit-student-orders.sql` satu kali setelah backup.
5. Siapkan `.env` dengan URL Supabase dan anon key proyek Anda.
6. Jalankan `npm run build`.
7. Jika build sukses, jalankan `npm run dev` untuk uji lokal.
8. Uji edit satu pesanan percobaan: data santri, tanggal, tambah/hapus produk, jumlah, total, dan stok. Periksa juga riwayat edit dan riwayat status.
9. Deploy ke Vercel setelah seluruh pengujian staging lulus.

## Batasan dan catatan verifikasi
- Paket ini adalah patch berbasis source ZIP yang diberikan, bukan hasil uji transaksi terhadap database Supabase Anda.
- Jangan jalankan migrasi langsung ke produksi sebelum memverifikasi nama kolom, bentuk JSON katalog, kebijakan stok, dan aturan tanggal penyerahan.
- Pesanan selesai dan pesanan yang sudah memiliki catatan serah-terima dikunci dari edit.
- Pesanan yang dibatalkan dapat dikoreksi datanya, tetapi statusnya tidak otomatis diaktifkan kembali.
- Jika struktur katalog atau nama field di database Anda berbeda, fungsi SQL perlu disesuaikan sebelum dipakai.
- Nomor telepon pemesan tidak diubah melalui form ini; form mengedit nama pemesan, data santri, tanggal, produk/jumlah, metode pembayaran, dan catatan. Perubahan gender akan mengarahkan nomor kasir berdasarkan pengaturan maleWa/femaleWa.

## File tambahan
- `src/OrderEditStudent.jsx`: form edit pesanan santri.
- `supabase-v34-edit-student-orders.sql`: migrasi RPC dan audit riwayat edit.
- `tests/order-edit-student-v1.test.mjs`: pemeriksaan statis tambahan.
