# Katalog Darel V32.2 — Belanja Sederhana via WhatsApp

Basis: V32.1 (perbaikan UUID checkout). Versi ini hanya menyederhanakan **frontend**.

## Apa yang berubah?

- Halaman utama tidak menampilkan tautan **Lacak Pesanan**. Orang tua diarahkan untuk bertanya kepada kasir melalui percakapan WhatsApp yang sudah ada.
- Pesan WhatsApp setelah checkout tetap mencantumkan **nomor pesanan** dan rincian belanja, tetapi tidak lagi mencantumkan kode akses lacak atau URL `/lacak`.
- Admin tidak lagi melihat dashboard laporan atau tombol **Catat Serah-terima**. Sebagai gantinya, tombol **Pesanan Santri** membuka daftar pesanan yang telah ada, terfilter untuk santri.
- `/lacak` dan `/petugas` yang mungkin sudah disimpan di HP/WhatsApp menampilkan pemberitahuan ramah, bukan error 404 dan bukan halaman serah-terima.
- Pilihan status **Selesai** pada admin tetap ada untuk digunakan **hanya setelah kasir memastikan proses benar-benar selesai**.

## Yang tidak berubah

- Seluruh file SQL/migrasi, termasuk checkout, reservasi stok, RLS, riwayat, pembayaran, dan fungsi lama.
- Login admin, pengaturan WhatsApp Putra/Putri, jadwal Selasa/Jumat, multi-toko, pelanggan umum, stok, checkout V32.1 anti-duplikasi.
- Riwayat status, catatan serah-terima yang sudah ada, dan tabel tracking **tidak dihapus** dari Supabase. Modul legacy (`src/TrackingPage.jsx`, `src/StaffPortal.jsx`) disimpan sebagai arsip kode, **tidak lagi dimuat oleh tampilan utama**.

## Pemasangan pada situs Vercel yang sudah online

1. **Jangan** jalankan SQL baru. **Jangan** ganti URL Supabase, API key, atau akun admin.
2. Cadangkan folder `D:\katalog-pondok` yang saat ini berhasil, terutama `.env`/`.env.local` dan `.vercel/` di komputer. Jangan sebarkan file berisi token.
3. Cara termudah: salin **dua file** `src/main.jsx` dan `src/style.css` dari paket patch V32.2 ke folder `D:\katalog-pondok\src`. Jangan timpa folder `.vercel` atau `.env.local`.
4. Jalankan `npm run build`. Jika berhasil, `npm run dev` dan uji satu pesanan percobaan pada folder lokal bila memungkinkan.
5. Setelah yakin, jalankan `npx vercel --prod` **dari folder proyek yang telah dihubungkan ke `katalog-darel`**, lalu cek alamat produksi menggunakan jendela Incognito.
6. Pengujian minimum: katalog umum, kiriman santri, jadwal Selasa/Jumat, tujuan WhatsApp Putra/Putri, pesanan tercatat sekali, stok, login admin, produk, daftar Pesanan Santri, halaman `/lacak` dan `/petugas` berisi pemberitahuan saja.

**Catatan:** saat menguji pesanan pada Supabase yang sama, pesanan dan reservasi stok akan benar-benar tercatat. Jangan ulangi checkout tanpa memeriksa pesanan sebelumnya.

## Kontak orang tua

Orang tua bisa membalas atau menghubungi nomor WhatsApp kasir yang menerima pesanan. Aplikasi tidak menyatakan barang sudah diserahkan tanpa verifikasi di dunia nyata.

## Build

Pemeriksaan kompilasi penuh perlu dijalankan di VS Code (`npm run build`). Lingkungan pembuatan paket tidak memiliki akses DNS registry npm untuk menginstal dependensi.
