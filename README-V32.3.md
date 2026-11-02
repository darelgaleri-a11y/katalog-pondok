# Katalog Darel V32.3 — Penguatan Kapasitas Tahap 1

**Basis:** Katalog Multi-Toko V32.2 yang sudah dipakai dengan Rahmani's Project di Supabase dan `katalog-darel` di Vercel.

## Yang berubah

1. **Daftar admin diambil dari database (50 pesanan/halaman).** Pencarian dan jumlah total bukan lagi terbatas 200 pesanan terakhir. Filter: tanggal transaksi **WIB**, nama pemesan/santri, nomor WA, kode pesanan, barang/toko, jenis dan status. Default tanggal adalah hari WIB saat ini; klik **Semua tanggal** untuk mencari riwayat lama. Hasil CSV hanya halaman yang sedang tampil, tetap menyamarkan identitas secara default.
2. **Koneksi Realtime dikurangi.** Pelanggan mengambil katalog ketika membuka website; Realtime katalog hanya untuk admin berizin yang membuka halaman admin. Saat tab pelanggan dibuka kembali setelah lebih dari dua menit, katalog diperbarui seperlunya. Validasi harga dan stok tetap wajib di RPC checkout, bukan data browser.
3. **Retry checkout lebih aman.** Jika jaringan putus, tampilan tidak langsung menyimpulkan pesanan gagal tersimpan; token UUID yang sama digunakan saat mengulangi klik sehingga backend tetap idempoten. Informasi durasi dan kode error tanpa identitas pelanggan dicatat di console browser untuk diagnosis. Ini belum merupakan dashboard pemantauan terpusat.
4. **Tampilan orang tua tetap:** pilih barang -> isi data -> WhatsApp. Tidak ada login pembeli, lacak pesanan, atau kewajiban mencatat serah-terima.

**Tidak berubah:** seluruh 22 berkas SQL sebelumnya, fungsi checkout `create_checkout_v6`, login, checkout Putra/Putri, stok, pembukuan, integrasi Supabase, dan nomor WA.

## Perubahan database khusus V32.3

Satu berkas baru `supabase-v32.3-admin-search.sql` menambahkan **tiga indeks** pada tabel `orders` serta fungsi `admin_find_orders_v323`. Fungsi wajib memverifikasi `auth.uid()` yang terdaftar di `admin_users`; akses anon ditolak. SQL **tidak** mengubah pesanan, menghapus tabel, atau mengganti prosedur checkout.

## Pemasangan pada situs yang sudah online

**Jangan langsung pasang di jam ramai.** Cadangkan data Supabase, dan buat salinan folder `D:\katalog-pondok` yang sekarang stabil. Bila memungkinkan uji dengan proyek Supabase pengujian terlebih dahulu.

1. Masuk ke **Rahmani's Project -> Supabase SQL Editor**. Jalankan **hanya** `supabase-v32.3-admin-search.sql`. Jangan menjalankan ulang SQL instalasi V1-V31. Jika gagal, hentikan, simpan teks error, dan jangan mengganti kode frontend.
2. Cadangkan `D:\katalog-pondok\src\main.jsx` dan `style.css`.
3. Ekstrak patch V32.3 lalu salin `src/main.jsx` dan `src/style.css` dari patch ke `D:\katalog-pondok\src`. Jangan menimpa `.env`, `.env.local`, `.vercel` atau kunci Vercel/Supabase.
4. Pada terminal folder proyek yang sudah dihubungkan ke **katalog-darel**, jalankan `npm run build`, lalu `npm run dev` dan uji: admin -> Pesanan, filter **Hari ini / Semua tanggal**, status, pencarian nama/kode, halaman Berikutnya/Sebelumnya, checkout umum & santri, token anti-duplikasi, stok, WhatsApp. Periksa bahwa riwayat sebelumnya masih ada.
5. **Jika build dan pengujian berhasil**, jalankan `npx vercel --prod` dari folder yang sama, lalu uji ulang secara terbatas melalui https://katalog-darel.vercel.app sebelum link dipakai ramai-ramai.

**Urutan penting:** SQL terlebih dahulu, baru kode; frontend V32.3 memerlukan RPC `admin_find_orders_v323`. Menjalankan SQL ini ketika frontend V32.2 masih online tidak mengubah perilaku checkout V32.2.

## Catatan kapasitas dan keamanan

- V32.3 tahap 1 **belum membuktikan** 500 pesanan/jam atau 60 pesanan/menit. Checkout masih mengunci satu baris katalog JSONB, yang menjadi kemungkinan titik antrean. Perubahan transaksi stok **bukan** bagian patch ini.
- Simulasi beban harus menggunakan Supabase pengujian dengan data buatan, tidak mengurangi stok produksi atau mengirim ratusan pesan WhatsApp sungguhan.
- Verifikasi pemesanan & pembayaran tetap manual bersama kasir. Tidak ada perubahan pada kebijakan reservasi 2 jam; evaluasi batas waktu bersama kasir sebelum cron kedaluwarsa diaktifkan.
- Supabase Free memiliki kuota yang berubah menurut paket; cek Dashboard usage untuk koneksi, kapasitas DB, dan limit Realtime sebelum publikasi skala besar.
- Jangan menaruh `service_role`, `sb_secret_`, database password atau `.env` ke ZIP dan Vercel frontend. Kunci `VITE_` hanya boleh publishable/anon yang diproteksi RLS.

## Tes yang sudah dilakukan

- `node --test tests/*.test.mjs`: 18 tes lulus, termasuk 6 tes baru V32.3 (berbasis pemeriksaan kode, bukan simulasi beban database).
- 12 berkas JS/JSX lolos pemeriksaan sintaks melalui parser TypeScript, semua import lokal tersedia.
- Berkas SQL lama dibandingkan byte-per-byte dengan V32.2 dan tidak diubah.
- `npm run build` **belum berhasil dijalankan di lingkungan pembuat paket** karena registry npm tidak dapat dijangkau. Harus dilakukan di VS Code pengguna sebelum deploy.
- Fungsi SQL baru belum dieksekusi langsung di Supabase pengguna. Uji melalui langkah 1 pada proyek milik pengguna.

## Rollback jika ada masalah

1. Jangan hapus SQL yang sudah dijalankan. Fungsi V32.3 bersifat tambahan dan aman dibiarkan tidak digunakan.
2. Pulihkan dua file `src/main.jsx` dan `src/style.css` dari cadangan V32.2.
3. Jalankan `npm run build`, kemudian `npx vercel --prod`. Tidak perlu menghapus toko, produk, pesanan atau migrasi SQL.

## Rencana tahap 2 (belum diimplementasikan)

Uji simulasi bertingkat (mis. 100, 300, 500 pesanan/jam; lonjakan target 60/menit) pada basis data uji. Pantau p95 waktu checkout, lock wait, error rate dan duplikasi. **Hanya jika diperlukan**, rancang pemisahan stok ke tabel per-produk dengan migrasi terukur dan rencana rollback. Jadwal pemrosesan kedaluwarsa disepakati bersama kasir, bukan diaktifkan diam-diam.
