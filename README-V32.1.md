# Katalog Multi-Toko V32.1 — Perbaikan token checkout

## Masalah yang diperbaiki

Pada V32, `uid()` memilih `crypto.randomUUID()` lalu fallback ke `id-${Date.now()}-${Math.random()}`. Pada HP yang membuka aplikasi melalui HTTP LAN (misalnya `http://192.168.1.10:5173`), `crypto.randomUUID()` dapat tidak tersedia. Token `id-...` bukan UUID sehingga `create_checkout_v6` di Supabase menolak pesanan dengan `Token checkout tidak valid` (HTTP 400). Pesanan tidak tercatat dan WhatsApp memang tidak dibuka.

V32.1 menambahkan `src/checkoutToken.js` yang membuat UUID v4 menggunakan `crypto.randomUUID` atau fallback aman `crypto.getRandomValues`, yang dapat bekerja pada HTTP lokal. Token `id-...` yang tersimpan di memori dari percobaan gagal akan diganti saat checkout berikutnya. Jika API kriptografi tidak tersedia, aplikasi berhenti dengan pesan yang mudah dipahami; *tidak pernah* menggunakan `Math.random` untuk token checkout. Request ulang dengan token valid tetap idempoten.

## Instalasi

1. Cadangkan folder V32 terlebih dahulu.
2. Cara paling ringan: salin dua file `src/main.jsx` dan `src/checkoutToken.js` dari V32.1 ke folder proyek V32 (menimpa `src/main.jsx`).
3. Alternatif: ekstrak ZIP V32.1 sebagai proyek lengkap dan salin `.env` lokal milik Anda secara manual.
4. **Jangan jalankan SQL baru:** tidak ada migrasi database di V32.1.
5. Jalankan `npm run build`, lalu `npm run dev`.
6. Uji checkout pelanggan umum dan santri melalui localhost dan melalui HP di alamat HTTP jaringan lokal. Periksa satu pesanan tersimpan, stok/reservasi terpotong satu kali, WhatsApp berisi kode akses UUID, dan pelacakan tetap berjalan.

## Uji otomatis tanpa dependency eksternal

`node --test tests/checkout-token.test.mjs`

Tes ini menguji format UUID v4, fallback HTTP, regenerasi token legacy, pemakaian ulang token retry, dan penolakan saat browser tidak punya API kriptografi.

## Batas pengujian

Tes unit Node bukan pengganti pengujian checkout terhadap Supabase asli. `npm run build` membutuhkan dependensi dari npm di mesin Anda. Sebaiknya jangan deploy Vercel sebelum build dan checkout end-to-end berhasil.
