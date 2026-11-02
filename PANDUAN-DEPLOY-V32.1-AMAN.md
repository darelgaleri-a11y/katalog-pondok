# Panduan Aman Deploy Katalog Multi-Toko V32.1 ke Vercel

Panduan ini hanya menerbitkan frontend React/Vite. **Jangan jalankan SQL migrasi apa pun; jangan membuat atau mereset database Supabase.** Semua data tetap berada di proyek Supabase lama.

## 0. Cadangkan dulu

- Cadangkan folder proyek V32.1 termasuk `.env` ke lokasi pribadi (jangan bagikan file `.env`).
- Cadangkan data Supabase. Pada paket Pro ke atas periksa Database > Backups. Pada paket Free pertimbangkan ekspor mandiri dengan `supabase db dump` (sesuai dokumentasi resmi). Jangan melakukan restore jika tidak perlu.
- Pastikan kunci dalam `.env` hanya publishable/anon key; **jangan pernah menyimpan `service_role`/secret key di frontend/Vercel `VITE_`**.

## 1. Berkas pengaman

Salin file `.gitignore` dan `.vercelignore` dalam paket ini ke akar proyek (folder dengan `package.json`). File ini mencegah file `.env*`, `node_modules` dan berkas migrasi `.sql` ikut terkirim melalui deploy dari CLI. Jika `.gitignore` proyek sudah memiliki aturan lain yang diperlukan, gabungkan aturan alih-alih menghapusnya. Tidak perlu menyalin berkas panduan ke proyek.

## 2. Cek konfigurasi dan build

- Pastikan ada `package.json`, `vercel.json`, dan direktori `src/` di akar proyek.
- Di VS Code terminal, jalankan `npm run build` dan pastikan selesai tanpa error.
- Periksa `.env` secara lokal, lalu catat nama `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`; nilai rahasia tidak perlu dikirim ke siapa pun.

## 3. Buat project Vercel baru, tanpa menyentuh aplikasi online lama

Masuk https://vercel.com menggunakan akunmu. Di terminal akar proyek:

```
npx vercel login
npx vercel link
```

Ikuti login di browser. Pilih scope/akun sendiri. Pilih **buat project baru** jika ingin menguji V32.1 tanpa mengubah proyek Vercel lama. Root Directory = `./` (folder ini). Framework Preset = Vite; Build Command = `npm run build`; Output Directory = `dist`.

## 4. Hubungkan environment hanya ke Production

Di Vercel Dashboard > Project > Settings > Environment Variables, tambahkan:

```
VITE_SUPABASE_URL          = <nilai sama persis dari .env lokal>
VITE_SUPABASE_ANON_KEY     = <anon/public/publishable key dari .env lokal>
```

Pilih environment **Production** dahulu. Variabel `VITE_` disertakan ke bundle browser: jangan pernah masukkan database password atau Supabase service-role/secret key.

Perhatikan: environment baru baru berlaku pada deployment berikutnya. Jika membuat preview, jangan bertransaksi dengan database produksi (preview yang memakai Supabase produksi tetap dapat menulis data asli).

## 5. Deploy dari terminal

Setelah variabel di Vercel tersimpan:

```
npx vercel --prod
```

Tunggu status Ready dan salin URL `https://...vercel.app` yang ditampilkan. Jangan sebarkan URL dulu sebelum uji selesai.

## 6. Uji online secara terbatas

- URL `/`, `/admin`, `/petugas`, `/lacak` dapat dibuka langsung dan di-refresh (tanpa 404).
- Produk dan toko dari Supabase lama tampil. Perubahan produk dan pesanan di Vercel akan menggunakan database **yang sama** dengan localhost.
- Tes satu checkout umum dan satu santri dengan data yang jelas bertanda **UJI COBA**, jika operasional mengizinkan. Pastikan nomor kasir tepat, pesanan tercatat sekali, stok benar, dan WA terbuka.
- Tes login admin dan petugas Putra/Putri, hak akses terpisah, serta serah-terima hanya pada kiriman uji. Gunakan HP dengan jaringan internet seluler.
- Periksa menu laporan keuangan tanpa menutup kas secara sembarangan. Jangan jalankan SQL ulang.
- Jika tes transaksi dilakukan pada basis data asli, catat dan bersihkan dengan prosedur transaksi yang sah (misalnya pembatalan yang mengembalikan stok sesuai mekanisme). Jangan menghapus data secara langsung dari tabel.

## 7. Supabase Authentication

Untuk login email/password biasa, URL Configuration belum tentu menentukan keberhasilan login. Untuk link konfirmasi/reset password, buka Supabase Dashboard > Authentication > URL Configuration, sesuaikan Site URL ke domain resmi dan tambahkan Redirect URL produksi yang spesifik, pertahankan localhost yang masih diperlukan.

## 8. Jika gagal

- `404` saat refresh: pastikan `vercel.json` ikut terdeploy dan Root Directory benar.
- Halaman bilang Supabase belum terhubung: periksa dua environment variable dan deploy ulang (perubahan environment hanya berlaku pada deployment baru).
- Login gagal: periksa akun/auth di Supabase, console browser, dan URL redirect jika memakai link email.
- Checkout 400: tangkap pesan RPC; jangan membuat SQL atau menghapus data untuk mengatasinya.
- Rollback Vercel hanya membatalkan perubahan frontend; rollback **tidak** menghapus transaksi yang sudah masuk ke Supabase.

Dokumentasi referensi:
- https://vercel.com/docs/frameworks/frontend/vite
- https://vercel.com/docs/deployments/vercel-ignore
- https://vercel.com/docs/projects/deploy-from-cli
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/platform/backups
