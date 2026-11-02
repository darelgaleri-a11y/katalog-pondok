# V12 — Panduan deploy di Vercel

V12 melanjutkan kode V11 (sudah diuji pengguna). Tidak ada SQL migrasi dan **tidak perlu membuat Supabase baru**.

## 1. Cadangan dan pemeriksaan sebelum publik
- Backup database Supabase dan proyek V11.
- Periksa policy RLS untuk `orders`, `admin_users`, `catalog_state` dan Storage. Pastikan hanya admin utama yang dapat membaca data pesanan lengkap dan mengubah produk/status.
- Pastikan fungsi checkout RPC berhak digunakan oleh pelanggan tanpa memberi akses langsung untuk mengubah harga, stok, atau status pesanan.
- Nonaktifkan pengiriman data pribadi ke analytics pihak ketiga sampai ada kebijakan privasi.
- Gunakan akun admin dengan password kuat dan aktifkan MFA jika tersedia pada metode login yang digunakan.

## 2. Jalankan lokal
Salin `.env` dari V11 (jangan commit). Jalankan `npm install` lalu `npm run build` dan `npm run dev`. Uji `/` dan `/admin`.

## 3. Deploy Vercel melalui Git
1. Buat repository Git **private**, unggah seluruh isi folder `katalog-multitoko-v12`, kecuali `.env` dan `node_modules`.
2. Masuk https://vercel.com/new dan impor repository.
3. Framework: **Vite**. Root directory: folder yang memuat `package.json`; Build Command: `npm run build`; Output Directory: `dist`.
4. Di Project Settings → Environment Variables, buat:
   - `VITE_SUPABASE_URL` = URL proyek Supabase yang sudah digunakan V11.
   - `VITE_SUPABASE_ANON_KEY` = publishable key / anon public key dari Supabase.
5. Berikan nilai environment variables pada **Production**; jika memakai preview, batasi agar tidak menghasilkan pesanan sungguhan secara tidak sengaja.
6. Deploy. Setelah itu cek alamat `https://NAMA-PROYEK.vercel.app/` dan `https://NAMA-PROYEK.vercel.app/admin`.

`vercel.json` menyertakan rewrite SPA supaya refresh langsung pada `/admin` tidak menghasilkan 404.

## 4. Pengaturan Supabase Authentication
Buka Supabase → Authentication → URL Configuration.
- Site URL: `https://NAMA-PROYEK.vercel.app` (atau domain resmi setelah dipasang).
- Jika menggunakan email konfirmasi/reset password, tambahkan URL produksi yang sesuai pada Redirect URLs (misalnya `https://NAMA-PROYEK.vercel.app/**`). Untuk produksi, hindari wildcard lintas domain.
- Tetap sisakan URL localhost yang diperlukan untuk pengembangan (mis. `http://localhost:5173/**`).

## 5. Domain sendiri (opsional)
Di Vercel → Project → Settings → Domains, tambahkan domain lalu ikuti instruksi DNS yang benar-benar ditampilkan Vercel. Jika sudah aktif, ubah Site URL dan Redirect URLs di Supabase menjadi domain resmi, tes login/reset password, checkout umum, dan checkout santri.

## 6. Uji end-to-end sebelum dibagikan
- Halaman pelanggan umum dan santri terbuka di HP, termasuk setelah refresh.
- URL `/admin` menampilkan login bagi pengunjung yang belum login, tanpa tautan admin pada halaman pelanggan.
- Tambah/edit toko, produk dan unggah foto dari admin; verifikasi terlihat dari perangkat lain.
- Checkout umum ke WA kasir toko yang tepat; santri ke WA kasir putra/putri dengan jadwal benar.
- Pesanan tersimpan, harga tervalidasi, stok berkurang, pembatalan/kedaluwarsa mengembalikan stok tepat sekali.
- Pastikan pengunjung tanpa login **tidak bisa** membaca data pribadi pesanan dari API Supabase.
- Cek CSV default tetap disamarkan dan CSV lengkap memerlukan konfirmasi.

## Catatan penting
- URL `/admin` tidak dirahasiakan; keamanan harus bergantung pada Supabase Auth, RLS dan otorisasi RPC (bukan hanya menyembunyikan menu).
- Semua `VITE_` environment variables ter-embed dalam bundle publik. Gunakan hanya public/anon key. **Jangan pernah memasukkan service-role/secret key**.
- Data demo atau pesanan tes di proyek produksi perlu dibersihkan dengan prosedur aman sebelum dibagikan ke orang tua/santri.
- Persiapkan pemberitahuan privasi (tujuan pengumpulan, siapa yang mengakses, jangka simpan, cara mengajukan penghapusan) sebelum aplikasi dibuka untuk masyarakat.
