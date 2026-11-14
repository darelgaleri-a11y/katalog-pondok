PERBAIKAN FORM KIRIMAN SANTRI — NAMA PEMESAN TIDAK DIPERLUKAN

Isi paket:
- apply-student-checkout-name-fix.mjs

Perubahan:
1. Field "Nama pemesan" hanya ditampilkan pada Belanja Umum.
2. Field tersebut tidak ditampilkan pada Kiriman Santri.
3. Keterangan privasi disesuaikan: Kiriman Santri menggunakan nama santri,
   kamar/kelas, tujuan putra/putri, dan tanggal penyerahan.
4. Kompatibilitas checkout dipertahankan. Untuk Kiriman Santri, customer_name
   tetap menggunakan nilai netral "Tidak dicantumkan" seperti alur aplikasi
   yang sudah ada.

Cara memasang:
1. Cadangkan proyek atau pastikan perubahan lokal sudah tersimpan.
2. Ekstrak ZIP.
3. Salin apply-student-checkout-name-fix.mjs ke folder utama proyek
   (folder yang berisi package.json).
4. Buka PowerShell di D:\katalog-pondok.
5. Jalankan:
   node .\apply-student-checkout-name-fix.mjs
6. Jalankan:
   npm run build
7. Uji dua mode:
   - Kiriman Santri: field Nama pemesan tidak tampil.
   - Belanja Umum: field Nama pemesan tetap tampil.

Script hanya menyentuh src/main.jsx. Tidak mengubah SQL, database, stok,
harga, .env, atau kredensial.
