# Katalog Darel V32.8 — Variasi Ukuran, Warna, Harga, dan Stok

Berangkat dari **V32.7**, termasuk fitur tutorial pertama kali dan animasi memuat.

## Yang baru

- **Produk biasa tetap seperti dulu**. Tidak perlu mengatur variasi untuk sabun, makanan, dan barang lain.
- Admin dapat membuat **Produk dengan ukuran / warna** dan menambah pilihan (contoh S/Putih, M/Hitam, XL/Hitam). Harga dan stok bisa berbeda **per kombinasi**. Maksimal 50 kombinasi per produk.
- Orang tua melihat satu kartu produk dan **wajib memilih kombinasi ukuran/warna** melalui daftar pilihan sebelum tombol **Keranjang** aktif. Variasi stok 0 tidak bisa dipilih.
- Keranjang dan pesan WhatsApp otomatis berisi **nama produk, ukuran, warna, jumlah, harga, total** sesuai produk yang dipilih.
- Pengurangan stok serta pengembalian stok ketika pembatalan/kedaluwarsa mengikuti **ID stok khusus untuk setiap kombinasi**, melalui checkout V6–V9/V32.7 dan pengelolaan stok V7/V8/V10 yang sudah ada.

## Arsitektur yang aman tanpa SQL baru

Variasi disimpan sebagai **entri produk independen dengan ID unik** dalam `catalog_state.data.products` yang sudah dipakai sebelumnya. Contohnya:

- `Baju Santri — Ukuran M / Warna Hitam` (ID sendiri, harga Rp65.000, stok 12)
- `Baju Santri — Ukuran L / Warna Hitam` (ID sendiri, harga Rp70.000, stok 5)

Kedua entri memiliki `variantGroupId` sama dan **ditampilkan sebagai satu kartu**. Data produk lama tidak dimigrasikan dan tidak dihapus. Database mengunci dan mengurangi stok menurut ID produk pada setiap checkout, sehingga kombinasi ukuran berbeda tidak saling mengambil stok. Backend mengirim `product_name` dari katalog server, bukan label yang dipercaya dari browser, sehingga rincian variasi masuk ke WhatsApp dengan benar.

**Tidak ada SQL V32.8.** Namun, SQL V32.7 dan V32.3 yang sudah terpasang **tetap diperlukan**. Jangan menjalankan ulang SQL instalasi lama.

## Cara membuat produk bervariasi

1. Login `/admin` → **Toko & Produk** → **Daftar Produk**.
2. Tekan **Produk dengan ukuran / warna** (tombol baru), bukan **Tambah Produk** biasa.
3. Pilih toko, isi nama produk, kategori, tujuan pelanggan, dan foto.
4. Isi daftar kombinasi. Contoh:

   | Ukuran | Warna | Harga | Stok |
   |---|---|---:|---:|
   | M | Putih | 65.000 | 10 |
   | L | Putih | 65.000 | 8 |
   | XL | Hitam | 70.000 | 3 |

5. Gunakan **Tambah pilihan ukuran / warna** untuk membuat kombinasi lain, lalu **Simpan Produk & Variasi**.
6. Tunggu hingga status admin mengatakan **Tersimpan di Supabase**, kemudian muat ulang dan pastikan semua pilihan tetap ada.
7. Untuk mengubah harga atau stok, tekan ikon **Edit** pada produk tersebut. Variasi yang telah disimpan tidak bisa dihapus satu per satu karena mungkin masih terkait pesanan lama; jika stok sementara habis, isi 0.

**Produk lama yang sudah terjual dan tidak mempunyai variasi**: jangan langsung mengubah identitasnya menjadi salah satu ukuran. Buat produk bervariasi baru; tunggu pesanan lama selesai sebelum mempertimbangkan menghapus produk lama. Menghapus produk dengan pesanan aktif dapat mengganggu pengembalian stok.

## Pemasangan ke V32.7 yang sudah online

1. Cadangkan `D:\katalog-pondok` dan pastikan V32.7 sudah berjalan baik.
2. Ekstrak `katalog-multitoko-v32.8-patch.zip`. Di dalamnya ada folder `src` dan berkas panduan.
3. Salin **lima file** dari `src` patch ke `D:\katalog-pondok\src\`: `main.jsx`, `style.css`, `productVariants.js`, `VariantProductCard.jsx`, `VariantEditor.jsx`.
4. Di terminal VS Code pada `D:\katalog-pondok`, jalankan `npm run build`. Jika gagal **jangan deploy**.
5. Jalankan `npm run dev`, uji produk variasi baru pada localhost: cek daftar pilihan, harga, stok, dan keranjang; **tidak perlu checkout sungguhan** hanya untuk memeriksa UI.
6. Setelah tampilan benar dan build berhasil, jalankan `npx vercel --prod`.
7. Uji **satu checkout** dengan kasir yang diberi tahu sebelumnya. Pastikan ukuran/warna tertulis dalam WhatsApp dan stok hanya berkurang pada variasi yang dibeli. Checkout mengunci stok walaupun pesan WhatsApp belum dikirim.

Tidak perlu mengubah `.env.local`, kunci Supabase, setting Vercel, maupun menjalankan SQL baru. **Jangan mengganti folder proyek seluruhnya** karena bisa menimpa konfigurasi lokal yang sudah berhasil.

## Batasan dan kehati-hatian

- Variasi dikelompokkan di tampilan, tetapi masing-masing menggunakan **ID produk nyata** agar kompatibel dengan database lama.
- Jika harga berubah saat checkout, **harga server** yang digunakan. Jika stok habis pada saat checkout, transaksi ditolak tanpa membuat reservasi parsial.
- Perubahan **stok banyak variasi** oleh admin menggunakan beberapa panggilan RPC stok bawaan. Jika salah satu gagal, sebagian stok dapat terlanjur disimpan; refresh daftar dan periksa satu per satu sebelum mengulang. Tidak ada jaminan edit massal stok bersifat atomik.
- **Beban 500+ pesanan/jam belum diuji**. Masih ada penguncian satu baris katalog seperti V32.7. V32.8 tidak mengklaim peningkatan kapasitas checkout.
- Pemeriksaan otomatis **bukan** pengganti uji build di VS Code, uji SQL hidup, atau uji checkout bersama kasir.

## Rollback

Jika ada masalah dengan UI, kembalikan kelima file frontend ke cadangan V32.7, lalu deploy ulang. Hindari membuat variasi baru selama proses rollback; produk variasi yang sudah tersimpan tetap akan tampil sebagai item mandiri pada UI lama (dan jangan dihapus saat masih ada pesanan aktif).
