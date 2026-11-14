# Katalog Pondok — Patch V39: tautan langsung produk + halaman toko terpisah + edit & arsip pesanan santri

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
5. Setelah V34 berhasil, jalankan `supabase-v35-archive-student-orders.sql` satu kali. V35 mengaktifkan arsip/hapus dari daftar untuk semua status pesanan Santri, termasuk selesai.
6. Siapkan `.env` dengan URL Supabase dan anon key proyek Anda.
7. Jalankan `npm run build`.
8. Jika build sukses, jalankan `npm run dev` untuk uji lokal.
9. Uji edit dan arsip satu pesanan percobaan. Pastikan data tetap di database, hilang dari daftar aktif, dan laporan keuangan tetap utuh.
10. Deploy ke Vercel setelah seluruh pengujian staging lulus.

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

## Fitur arsip V35
- Semua status Kiriman Santri boleh diarsipkan, termasuk selesai dan sudah diserahterimakan.
- Ini adalah soft delete: data pesanan, riwayat status, dan bukti serah-terima tidak dihapus permanen.
- Pesanan yang belum selesai dan masih memegang reservasi mengembalikan stok. Pesanan selesai/serah-terima tidak mengembalikan stok.
- Arsip disembunyikan dari daftar admin dan laporan operasional santri; baris transaksi tetap ada untuk audit/laporan keuangan.
- Tombol berlabel `Arsipkan / Hapus dari daftar` agar jelas bahwa data tetap tersimpan.


## Fitur pelanggan per toko V36
- Setiap toko memiliki URL halaman sendiri: `/toko/<slug-nama-toko>`.
- Membuka URL toko langsung hanya memuat produk milik toko tersebut; jika slug tidak valid/toko tidak aktif, tampil pesan toko tidak ditemukan.
- Keranjang dibatasi pada satu toko. Ketika pelanggan mulai menambah barang dari toko berbeda, keranjang sebelumnya diganti agar tidak tercampur.
- Checkout mempunyai validasi tambahan agar satu transaksi tidak pernah berisi produk lintas toko.
- Tautan toko tersimpan di riwayat browser dan dapat dibagikan. Nama toko sebaiknya unik karena slug berasal dari nama toko.

Catatan implementasi: frontend memfilter dan membatasi navigasi/keranjang berdasarkan toko. RPC checkout Supabase yang ada tetap menjadi validasi harga, stok, dan aturan audience di sisi server; untuk pembatasan keamanan yang mutlak dari sisi server, migrasi backend lanjutan perlu menambahkan parameter store_id dan validasi store tunggal dalam RPC checkout yang digunakan.


## SQL checkout satu toko di sisi server V36
Jalankan `supabase-v36-single-store-checkout.sql` setelah V33 (dan setelah migrasi edit/arsip V34/V35), sebelum frontend V36 digunakan. Fungsi `create_checkout_v36` menolak item dari lebih dari satu toko di server, lalu meneruskan checkout ke `create_checkout_v33` yang tetap bertanggung jawab memvalidasi harga, stok, audience, alamat, token deduplikasi, dan aturan lain.


## Tautan langsung produk V37
- Setiap kartu produk memiliki tombol `Lihat produk` untuk membuka halaman detail khusus.
- Tombol `Salin link` menyalin URL unik `/produk/<id>?mode=<student|general>` agar bisa dibagikan melalui WhatsApp atau media lain.
- Saat pelanggan membuka URL tersebut, aplikasi langsung membuka detail produk terkait, bukan daftar toko.
- Tombol mengambang `Kembali ke toko` yang terlihat pada halaman pelanggan dihapus.
- Halaman detail menampilkan foto, nama, kategori, harga, stok, dan tombol beli. Tautan produk tidak valid atau produk/toko nonaktif akan menampilkan pesan produk tidak tersedia.

Tidak ada migrasi SQL baru untuk V37. Tetap gunakan migrasi V34, V35, dan V36 sesuai panduan paket.


## Navigasi pelanggan V38
- Tombol `Beranda` di header pelanggan dihilangkan agar tampilan lebih ringkas.
- Logo/nama Katalog di header tetap menjadi jalur kembali ke halaman awal.
- Tombol keranjang tetap tersedia ketika pelanggan sedang berada dalam mode belanja.


## Perbaikan halaman awal kosong V39
- Pada URL root `/`, mode pelanggan tidak lagi otomatis dipilih sebagai `student`.
- Halaman awal kembali tampil sehingga pengunjung dapat memilih Kiriman Santri atau Belanja Umum.
- Deep link produk tetap menentukan mode dari query `mode`; jika tidak ada, fallback tetap ke `student`.
- Navigasi browser ke root juga mengosongkan mode pelanggan, mencegah halaman kosong setelah tombol Back.
- Tidak ada perubahan database atau migrasi SQL.
