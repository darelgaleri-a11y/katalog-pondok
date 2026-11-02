# Katalog Darel V32.3.1 — Tombol Kembali Mudah di HP

## Yang berubah
- Ketika halaman **Pilih Toko** atau **Daftar Produk** digulir ke bawah, tombol **Kembali** kecil mengikuti layar HP.
- Jika keranjang berisi barang, tombol **Kembali** berada **di atas** tombol **Lihat Keranjang**, jadi kedua tombol tetap bisa ditekan.
- Saat berada di atas halaman, tombol mengambang tersembunyi karena tombol kembali biasa sudah terlihat.
- Tombol kembali kini membawa pengguna ke bagian atas halaman tujuan sehingga tidak terdampar pada posisi scroll yang lama.
- Tombol mengambang tidak ditampilkan pada formulir checkout agar tidak menutupi tombol WhatsApp.
- Tidak ada perubahan SQL, data toko, stok, WhatsApp kasir, checkout, admin, atau Supabase.

## Cara memasang ke proyek V32.3 yang sudah berjalan
1. Cadangkan folder `D:\katalog-pondok`.
2. Ekstrak `katalog-multitoko-v32.3.1-patch.zip`.
3. Salin `src/main.jsx` dan `src/style.css` ke `D:\katalog-pondok\src`, mengganti file lama.
4. Di VS Code jalankan `npm run build`. Jika gagal, **jangan** deploy.
5. Jika berhasil, jalankan `npm run dev`. Tes di Chrome HP: buat halaman cukup panjang, gulir ke bawah, klik Kembali; ulangi dengan keranjang berisi barang.
6. Setelah lulus, jalankan `npx vercel --prod` pada proyek Vercel `katalog-darel`.

> Tidak perlu SQL baru atau mengganti environment variable Supabase. Jangan menimpa `.env.local` dengan isi ZIP.

## Verifikasi
- Build Vite harus berhasil di komputer pengguna sebelum deploy. Pemeriksaan sintaks otomatis hanya pendukung.
- Lihat halaman toko (daftar panjang) dan daftar produk (daftar panjang): tombol Kembali mudah dijangkau setelah scroll.
- Bila ada barang di keranjang, tombol Kembali tidak bertabrakan dengan tombol Lihat Keranjang.
- Pencarian admin V32.3 dan checkout WhatsApp tetap bekerja.
