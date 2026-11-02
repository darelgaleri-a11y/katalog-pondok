# Katalog Darel V32.5 — Tutorial Otomatis saat Pertama Dibuka

Versi ini melanjutkan V32.4. **Orang tua melihat panduan otomatis pada kunjungan pertama** ke beranda (setelah katalog berhasil dimuat), satu langkah bergambar setiap layar. Panduan **bisa dilewati** dan tidak akan mengganggu kunjungan berikutnya pada browser yang sama.

## Penggunaan

- Pertama membuka beranda: panduan muncul otomatis.
- Tekan **Berikutnya** untuk melihat 4 langkah: pilih layanan, pilih barang, isi data, kirim ke WhatsApp.
- Tekan **Lewati** kapan saja, atau **Mulai Belanja** di langkah terakhir. Aplikasi mengingat bahwa tutorial sudah dibuka pada perangkat/browser tersebut.
- Bila ingin mengulang, tekan **Bingung cara belanja?** di beranda.
- Jika mode penyamaran digunakan atau penyimpanan browser dibersihkan, tutorial dapat muncul lagi. Ini normal.
- Panduan tidak otomatis tampil pada halaman `/admin`, `/petugas`, dan `/lacak`.

## Pemasangan patch

1. Cadangkan folder aplikasi `D:\katalog-pondok` di komputer.
2. Ekstrak `katalog-multitoko-v32.5-patch.zip`.
3. Salin **hanya** file `src/main.jsx` dan `src/style.css` ke folder `D:\katalog-pondok\src` (Replace). Tidak perlu mengubah `.env`, `.env.local`, `.vercel` atau variabel Vercel.
4. Jalankan `npm run build`. Jika gagal, **jangan deploy**; kirim pesan error.
5. Jalankan `npm run dev`, cek tutorial pada browser incognito dan di HP; coba tombol Lewati, Berikutnya, Mulai Belanja, lalu tombol bantuan manual.
6. Setelah semua normal, jalankan `npx vercel --prod` di folder aplikasi yang sudah terhubung ke Vercel.

**Tidak perlu SQL baru.** Database Rahmani's Project, pembayaran, stok, dan checkout WhatsApp tidak diubah. Tutorial tersimpan hanya di `localStorage` browser menggunakan penanda `katalog-darel-v325-guide-seen`, bukan di Supabase.

## Catatan verifikasi

Jalankan `node --test tests/*.test.mjs` dan `npm run build` sebelum publikasi. Instalasi dependensi dan build penuh tetap harus diverifikasi di VS Code jika `node_modules` tidak tersedia pada lingkungan pembuat paket. Pengujian lain seperti checkout umum/santri dan tampilan HP juga wajib diperiksa sebelum deploy produksi.
