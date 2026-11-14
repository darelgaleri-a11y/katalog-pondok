# Katalog Pondok — Paket Patch Keamanan Tahap 1

Paket ini adalah **patch keamanan untuk repository** `darelgaleri-a11y/Kataloh-darul-ilmi`, bukan salinan penuh source aplikasi atau database. File aplikasi yang tidak berubah tetap diambil dari folder proyek yang sudah ada. Patch sengaja tidak membawa database SQLite, file WAL/SHM, upload, `.env`, atau kredensial.

## Isi perbaikan

1. Tidak lagi membuat akun `admin / adminpondok123` secara otomatis.
2. Admin pertama untuk database baru dibuat dari `ADMIN_USERNAME`, `ADMIN_PASSWORD`, dan `ADMIN_NAME`.
3. Password baru menggunakan PBKDF2-SHA512 310.000 iterasi. Hash lama tetap bisa diverifikasi dan otomatis diperbarui setelah login berhasil.
4. Login dibatasi 5 kegagalan per alamat IP dalam jendela 15 menit, lalu diblokir 15 menit.
5. Token sesi acak disimpan dalam database sebagai SHA-256 hash, bukan token mentah.
6. Masa sesi baru menjadi 12 jam. Sesi kedaluwarsa dibersihkan saat login.
7. Mengganti password mencabut sesi lain pada akun tersebut.
8. Pengaturan yang dikirim ke browser publik memakai allowlist eksplisit.
9. Upload hanya menerima PNG/JPEG/WebP dengan signature file yang sesuai dan ukuran maksimal 5 MiB; SVG ditolak.
10. Menambahkan header keamanan dasar dan cache-control untuk endpoint autentikasi/admin.
11. Script produksi `start` diperbaiki agar menjalankan server TypeScript dengan `tsx`.
12. Database lokal dan file upload dimasukkan ke `.gitignore`.

## Cara memasang

**Penting: lakukan backup dulu.** Salin folder `data/` ke lokasi aman, khususnya `katalog_pondok.db`, `katalog_pondok.db-wal`, dan `katalog_pondok.db-shm` bila ada. Jangan hapus atau menimpa database.

1. Ekstrak ZIP ini ke folder proyek yang sudah berisi `server.ts`, `server/db.ts`, dan `package.json`.
2. Buka terminal VS Code di folder utama proyek.
3. Jalankan patch:

   ```bash
   node security-stage1/apply.mjs
   ```

   Script akan membuat folder backup `.security-stage1-backup-...` dan berhenti jika struktur source tidak cocok persis.

4. Buka `.env` (buat dari `.env.example` bila belum ada). Untuk database baru, isi:

   ```env
   ADMIN_USERNAME="admin"
   ADMIN_PASSWORD="GANTI_DENGAN_PASSWORD_UNIK_MINIMAL_12_KARAKTER"
   ADMIN_NAME="Administrator Katalog"
   ```

   Jangan commit `.env`. Simpan password ini secara pribadi.

5. Install dependency dan cek aplikasi:

   ```bash
   npm install
   npm run lint
   npm run build
   npm start
   ```

## Penting untuk database yang sudah dipakai

- Akun admin yang sudah ada **tidak dihapus dan tidak di-reset** oleh patch ini.
- Jika database lama masih menggunakan password bawaan `adminpondok123`, login sekali lalu segera ganti dari menu Pengaturan dengan password baru minimal 12 karakter. Hash lama akan otomatis dinaikkan setelah login berhasil.
- Setelah patch, sesi lama tidak berlaku karena database sekarang menyimpan hash token. Login admin kembali.
- Untuk database baru, admin tidak dibuat jika `ADMIN_USERNAME` dan `ADMIN_PASSWORD` belum disediakan.
- Bila aplikasi berjalan di layanan hosting, atur ketiga variabel `ADMIN_*` di panel environment/secrets hosting, bukan hanya di `.env` lokal.

## Database yang pernah masuk Git

Repository saat audit memiliki file `data/katalog_pondok.db-wal` yang terlacak Git. `.gitignore` tidak otomatis menghapus file yang sudah ter-commit. Setelah memeriksa bahwa file itu memang bukan data yang harus dibagikan, keluarkan dari tracking dengan:

```bash
git rm --cached data/katalog_pondok.db-wal
git commit -m "chore: stop tracking local sqlite wal file"
```

Jangan menjalankan `git rm` pada file database lokal tanpa memastikan backup dan kebutuhan datanya.

## Batas pengujian

Patch ini dibuat berdasarkan source `main` yang diaudit. Jalankan `npm run lint` dan `npm run build` pada komputer proyek sebelum deploy. Belum dilakukan penetration test atau pengujian terhadap server produksi. Header HSTS hanya dipasang ketika `NODE_ENV=production`; pastikan situs produksi benar-benar menggunakan HTTPS.
