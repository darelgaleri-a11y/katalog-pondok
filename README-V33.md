# Katalog Darel V33 — Dua Jalur Belanja

Khusus **Kiriman Santri** dan **Belanja Umum**, tetap satu website, satu Supabase, satu pengelolaan stok, dan satu panel admin.

## Fitur baru

- Alamat utama `/` tetap menjadi pintu pilihan layanan bagi pengunjung lama. Dari situ, tiap pilihan membuka URL terpisah: `/santri` dan `/umum`.
- Tidak ada tautan pindah ke layanan lain di dalam masing-masing katalog; tombol **Beranda** hanya mengembalikan ke daftar toko layanan yang sama. URL `/belanja-umum` juga dikenali sebagai alias bagi link umum yang sempat dibagikan.
- Tutorial empat langkah otomatis tersedia untuk pengunjung baru di kedua URL khusus dan dapat dibuka lagi dari daftar toko.
- `/santri`: nama santri, kamar/kelas, Putra/Putri, jadwal kiriman. **Tidak meminta alamat rumah**. Nomor WhatsApp kasir Putra/Putri tetap dipakai.
- `/umum`: nama pemesan, nama penerima, alamat lengkap, kelurahan/kecamatan, kota/kabupaten, dan patokan rumah opsional. Nomor WhatsApp kasir dari toko yang ada di keranjang.
- Alamat umum divalidasi di browser **dan di SQL**, dicatat pada pesanan, dan disalin ke pesan WhatsApp kasir toko.
- Biaya kirim **belum dihitung otomatis** dan **tidak masuk total barang**. Kasir harus mengonfirmasi ongkir serta jangkauan pengiriman sebelum pelanggan membayar.
- Admin dapat melihat alamat kiriman umum pada detail pesanan (disamarkan sampai opsi Tampilkan Data Pribadi diaktifkan). Ekspor CSV juga menyamarkan alamat secara default.
- Stok, keranjang, variasi, galeri, riwayat pesanan lama, dan anti-duplikasi token tidak dihapus.

## Cara memasang ke `D:\katalog-pondok`

**Lakukan di luar jam pesanan ramai.**

1. Buat salinan aman folder `D:\katalog-pondok` dan backup database Supabase Rahmani's Project. Jangan pernah membagikan `.env.local` atau kunci rahasia.
2. **Jalankan SATU file SQL tambahan** `supabase-v33-alamat-pengiriman-umum.sql` di Supabase → SQL Editor proyek **yang sama**. Ini hanya menambah kolom alamat pada tabel `orders` dan RPC `create_checkout_v33`, tidak menghapus data lama. SQL V32.7 harus sudah terpasang.
3. Ekstrak patch V33; salin **empat** file `src/main.jsx`, `src/style.css`, `src/GeneralShippingFields.jsx`, `src/shippingDetails.js` ke `D:\katalog-pondok\src`. Jangan timpa `.env.local` atau `.vercel`.
4. Di VS Code: `npm run build` lalu `npm run dev`. Pastikan tidak ada error.
5. Di localhost, uji kedua layanan. Kiriman Santri **tanpa alamat rumah**, checkout umum **wajib alamat**, dan pesan WhatsApp umum menampilkan nama penerima/alamat plus keterangan ongkir.
6. Jika lolos, jalankan `npx vercel --prod` dari folder proyek yang sudah terhubung ke Vercel.
7. Uji 1 pesanan dari masing-masing jalur pada website HTTPS, periksa data pesanan di admin, dan konfirmasi ke kasir sebelum memakai ramai-ramai.

## Pengujian yang disarankan

- Buka `/santri` dan `/umum` secara langsung (termasuk refresh halaman). Pastikan tombol **Beranda** dan logo tidak menampilkan katalog layanan lain.
- Kiriman Santri: pilih barang, isi nama santri/kamar/jenis, cek hari kiriman, checkout ke kasir sesuai Putra/Putri. Tidak ada kolom alamat rumah.
- Belanja Umum: isi penerima dan alamat, coba kosongkan salah satu field wajib (harus tertolak); kasir yang dibuka sesuai toko barang di keranjang.
- Setelah checkout, cek alamat tersimpan di **Admin → Semua Pesanan → Tampilkan data pribadi**; pastikan hanya admin yang dapat membuka halaman ini.
- Periksa pesan WhatsApp dan pastikan ongkos kirim belum dianggap sudah dibayar.
- Coba tekan kembali tombol checkout untuk memastikan token lama tidak menggandakan pesanan.
- Coba akses keranjang Belanja Umum setelah refresh halaman (ketika toko terakhir tidak dipilih) untuk memeriksa nomor kasir yang digunakan.
- Coba produk variasi, foto toko, foto produk dan stok.

## Penting tentang keamanan & penerapan

- **SQL V33 wajib dipasang lebih dahulu**. Frontend V33 menggunakan RPC `create_checkout_v33`; akan gagal jika migrasi belum berhasil.
- Jangan jalankan ulang seluruh installer Supabase. Jangan membuat Supabase baru.
- Tidak ada pengiriman otomatis atau ongkir otomatis. Pesanan tersimpan **sebelum** WhatsApp terbuka; kasir tetap harus mengecek pesan WhatsApp dan pembayaran manual.
- Pesanan umum lama tanpa alamat tetap dapat ditampilkan; kolom baru bernilai `NULL` untuk data lama.
- Untuk kompatibilitas selama peluncuran, RPC V32.7 lama **tetap tersedia**. Browser yang menyimpan versi website lama perlu memuat ulang agar menggunakan formulir alamat V33.
- Data alamat adalah data pribadi. Jangan mengekspor CSV lengkap atau membagikan tangkapan layar detail alamat tanpa kebutuhan yang sah.
- Tes otomatis kode telah dijalankan, tetapi **build Vite penuh, migrasi pada Supabase aktif, dan pengujian beban belum dijalankan di lingkungan ini**. Jalankan pemeriksaan lokal dan uji langsung sebelum produksi.

**Pembatasan ini hanya navigasi dan katalog publik berdasarkan kategori produk**, bukan kontrol akses rahasia. Pengunjung yang mengetik URL layanan lain secara sengaja masih bisa membuka katalog publik tersebut.
