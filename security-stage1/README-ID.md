# Kataloh Darul Ilmi — Security Stage 1

Paket ini adalah patch overlay untuk repository `darelgaleri-a11y/Kataloh-darul-ilmi`, bukan salinan penuh repository.

## Isi dan perubahan
1. Password admin default `adminpondok123` dihapus. Admin baru hanya dibuat bila `ADMIN_INITIAL_PASSWORD` tersedia (minimal 12 karakter).
2. Password hash baru menggunakan PBKDF2-HMAC-SHA512 310.000 iterasi. Hash lama 10.000 iterasi tetap diverifikasi dan ditingkatkan saat login sukses.
3. Login dibatasi 5 kegagalan per alamat IP per jendela 15 menit (in-memory, per proses).
4. Setelah password admin diganti, semua sesi admin tersebut dicabut.
5. Pengaturan endpoint publik memakai allowlist eksplisit.
6. Upload hanya JPEG/PNG/WebP, maksimal 4 MB, memeriksa signature file, menolak SVG dan MIME palsu.
7. Batas body request turun dari 20 MB menjadi 6 MB dan header keamanan dasar ditambahkan.

## Cara memasang
1. Buat backup seluruh repository dan database `data/katalog_pondok.db`.
2. Salin folder `security-stage1` ke root repository.
3. Jalankan dari root repository:
   `node security-stage1/apply-security-stage1.mjs`
4. Jika skrip berhenti karena source tidak cocok, jangan lanjutkan deploy. Periksa perbedaan branch terlebih dahulu.
5. Buat file `.env` (jangan commit) untuk instalasi BARU tanpa akun admin:
   `ADMIN_INITIAL_USERNAME=admin`
   `ADMIN_INITIAL_NAME=Administrator`
   `ADMIN_INITIAL_PASSWORD=isi-dengan-password-acak-minimal-12-karakter`
6. Untuk database lama yang sudah memiliki akun admin, variabel bootstrap tidak akan mengubah password yang ada. Login seperti biasa; setelah login, password lama akan di-hash ulang saat sukses login.
7. Jalankan:
   `npm install`
   `npm run lint`
   `npm run build`
   `npm run dev`

## Catatan penting
- Login throttle ini in-memory dan per proses. Untuk deployment multi-instance, tambahkan shared rate limiter (misalnya Redis) sebelum produksi.
- Header HSTS hanya dikirim saat `NODE_ENV=production`; pastikan produksi benar-benar memakai HTTPS.
- `bank_info` tetap ada dalam allowlist karena pada versi ini informasi pembayaran dapat ditampilkan ke pelanggan. Hapus dari allowlist bila data rekening tidak dimaksudkan untuk publik.
- Mengganti password mencabut semua sesi, sehingga administrator perlu login ulang.
- Tidak ada migrasi database. Tidak ada data produk/kategori/pesanan yang diubah.
- Paket tidak menyertakan `.env`, database, token, atau kredensial.

## Batas verifikasi
Patch applier menggunakan pencocokan source yang ketat. Jalankan lint/build dan uji alur login/upload pada salinan database sebelum deploy. Paket ini tidak mengklaim telah menjalankan pengujian end-to-end pada server produksi.
