# Katalog Darel V32.9.1 — Perbaikan Unggah Foto pada HP / Jaringan Lokal

Perbaikan dari V32.9 untuk pesan **“Browser belum mendukung unggah aman. Buka lewat HTTPS.”**.

## Masalah dan perbaikan

Di V32.9, unggah foto hanya memakai `crypto.randomUUID()` untuk membuat nama berkas foto. Browser dapat menonaktifkan API ini di halaman **HTTP jaringan lokal**, misalnya `http://192.168.1.5:5173`, bahkan jika pilihan file dan Supabase sudah benar.

V32.9.1 memakai generator UUID yang sudah tersedia di Katalog Darel (`src/checkoutToken.js`), yang menggunakan `crypto.randomUUID()` jika tersedia, lalu fallback **aman** ke `crypto.getRandomValues()` (tersedia pada banyak browser bahkan di HTTP lokal). Tidak menggunakan `Math.random` untuk nama file.

**HTTPS tetap dianjurkan untuk penggunaan normal dan produksi**. Jika browser benar-benar tidak mendukung kedua API kriptografi tersebut, unggah ditolak dengan pesan yang lebih tepat.

## File yang berubah

- **Hanya `src/PhotoFields.jsx`** — perubahan pembuatan ID berkas untuk unggah foto.
- Tidak mengubah SQL, Supabase Storage bucket, akun admin, stok, checkout, atau sistem variasi.

## Cara memasang dari V32.9

1. Cadangkan `D:\katalog-pondok`.
2. Ekstrak `katalog-multitoko-v32.9.1-patch.zip`.
3. Salin file `src/PhotoFields.jsx` dari patch ke `D:\katalog-pondok\src\PhotoFields.jsx` (Replace).
4. Di terminal VS Code pada `D:\katalog-pondok`, jalankan `npm run build` lalu `npm run dev`.
5. Tes unggah satu foto JPG dari alamat `http://localhost:5173` atau alamat lokal HP. Login sebagai admin; tes simpan, refresh, dan pastikan foto masih tampil.
6. Jika aman, jalankan `npx vercel --prod`.

**Tidak perlu SQL baru.** Jangan mengganti `.env.local`, `.vercel`, atau kunci Supabase/Vercel.

## Jika pesan error masih muncul

- Coba buka situs produksi `https://katalog-darel.vercel.app` dengan Chrome/Firefox terbaru.
- Periksa apakah browser memungkinkan `crypto.getRandomValues()` (browser sangat lama dapat tidak mendukung).
- Jika error menjadi `Unggah foto gagal: ...`, artinya UUID sudah berfungsi dan masalahnya ada di Supabase Storage atau hak akses admin. Pastikan login admin dan bucket `product-images` tersedia.
- Foto wajib JPG/PNG/WEBP, ukuran awal maksimal 5 MB.

## Pengujian

Jalankan `node --test tests/*.test.mjs` di folder proyek lengkap. Build Vite penuh perlu dijalankan pada PC yang memiliki `node_modules`.
