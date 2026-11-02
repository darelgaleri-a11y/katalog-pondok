# Katalog Darel V32.6 — Animasi Saat Memuat Katalog

Pembaruan kecil di atas V32.5: layar `Memuat katalog...` diganti dengan animasi ringan ikon tas belanja, tiga titik berjalan, dan garis cahaya. Animasi **berhenti otomatis** begitu data berhasil muncul; tidak ada penundaan buatan atau angka progres palsu.

- Jika koneksi gagal, animasi berhenti, pesan kesalahan ditampilkan, dan tombol **Coba muat ulang** tersedia.
- Jika koneksi lambat, tersedia tombol **Muat ulang jika terlalu lama**.
- Animasi dibuat dengan CSS, tidak memakai GIF, video, atau layanan eksternal.
- Mendukung pengaturan sistem **kurangi animasi** (`prefers-reduced-motion`).
- Tutorial otomatis V32.5, tombol kembali V32.3.1, pencarian admin, stok, checkout WhatsApp tidak diubah.
- Tidak ada perubahan SQL atau Supabase.

## Instalasi patch
1. Cadangkan folder `D:\katalog-pondok`.
2. Ekstrak ZIP patch dan **hanya salin `src/main.jsx` serta `src/style.css`** ke `D:\katalog-pondok\src`.
3. Jalankan `npm run build` di VS Code; jika ada error, jangan deploy.
4. Jalankan `npm run dev`, lalu periksa layar memuat dan checkout biasa di browser/HP.
5. Jika sudah berhasil, jalankan `npx vercel --prod`.

**Tidak perlu menjalankan SQL atau mengubah variabel Supabase/Vercel.**
