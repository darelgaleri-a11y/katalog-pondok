# V22 – Lacak pesanan dengan kode akses

V22 menambah `/lacak` untuk pelanggan umum dan orang tua santri. Layanan tetap sama seperti V21.

## Instalasi
1. Cadangkan proyek V21 dan database Supabase.
2. Jalankan `supabase-v22-tracking.sql` di SQL Editor Supabase yang sama.
3. Salin `.env` V21, lalu jalankan `npm install` dan `npm run dev`.
4. Buat pesanan baru untuk uji. Pesan WA mencantumkan **ID Lengkap**, **Kode Akses Lacak**, dan tautan `/lacak`.
5. Salin ID serta kode dari pesan WA ke formulir `/lacak`.

**Penting:** Pesanan lama tidak otomatis memiliki kode yang sudah disampaikan melalui WA, sehingga fitur ini paling mudah digunakan untuk checkout baru. Jangan bagikan kode akses. Pelacakan hanya menunjukkan status umum, jadwal santri, dan apakah serah-terima tercatat; tidak menampilkan identitas pribadi.

Kode akses menggunakan UUID acak checkout yang sudah ada di V21. Ini adalah *bearer secret*; pemegangnya dapat melihat status tanpa login. Tidak ada batas percobaan RPC tambahan pada V22; perkuat dengan rate limiting/Edge Function sebelum dibuka untuk trafik luas.

**Pengujian keamanan:** kode salah tidak menunjukkan status; pelanggan tidak mendapatkan akses SELECT ke `orders`. Jangan gunakan ID pendek 8 digit untuk pencarian.

Jangan deploy ke Vercel sebelum pengujian lokal berhasil.
