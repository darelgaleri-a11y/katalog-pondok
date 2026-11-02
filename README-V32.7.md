# Katalog Darel V32.7 — Transfer Bank & Checkout Lebih Ringkas

Basis: Katalog Darel **V32.6**. Perubahan ini dibuat agar pembayaran cukup **transfer bank** dan orang tua tidak perlu mengisi nomor WhatsApp pemesan.

## Perubahan

1. **Nomor rekening ada dalam pesan WhatsApp kasir**: untuk santri Putra/Putri diambil dari `settings.malePayment`/`settings.femalePayment`, sedangkan belanja umum diambil dari `store.paymentInfo` pada toko tersebut. Tidak ada nomor rekening yang dibuat-buat. Kalau admin belum mengisi, pesan akan meminta kasir menyampaikan rekening resmi sebelum transfer.
2. **Kolom nomor WhatsApp pemesan dihilangkan** dari checkout dan pesan prefill WA. Nomor pengirim terlihat oleh kasir **setelah** orang tua menekan Kirim di WhatsApp; website tidak dapat mengambil nomor pengirim otomatis.
3. **QRIS dihilangkan dari checkout baru**; metode yang dikirim ke database adalah `Transfer bank`. Riwayat/rekap QRIS yang telah ada tidak dihapus.
4. **Perlindungan transaksi tetap aktif**: wrapper SQL baru menggunakan checkout V6–V9 (termasuk penguncian stok, pembatasan, dan token duplikasi). Untuk checkout baru, pembatasan kasar maksimum 3 pesanan / 15 menit menggunakan pengenal browser anonim yang disimpan di localStorage, bukan nomor HP. Karena pengenal browser bisa direset, ini **bukan perlindungan anti-bot yang kuat**.

## Berkas patch

- `src/main.jsx` — tampilan, teks WA, metode bank-only.
- `src/checkoutClientRef.js` — pengenal browser acak yang konsisten.
- `supabase-v32.7-checkout-tanpa-wa.sql` — migrasi kecil SQL, termasuk RPC `create_checkout_v327`.
- `README-V32.7.md` — petunjuk ini.

## **PENTING: Urutan pemasangan**

**Jangan hanya mengganti JSX tanpa menjalankan SQL.** Bila SQL belum terpasang, checkout baru akan gagal karena RPC yang dibutuhkan belum tersedia.

1. Sebelum jam ramai, cadangkan proyek `D:\katalog-pondok` serta database di Supabase **Rahmani's Project**. Jangan membuat proyek Supabase baru.
2. Di Supabase → SQL Editor, jalankan **hanya** `supabase-v32.7-checkout-tanpa-wa.sql` pada project yang sudah digunakan. **Jangan** jalankan ulang SQL V5–V9 maupun paket setup lama. SQL V32.7 aman dibiarkan jika harus kembali ke aplikasi lama.
3. Ekstrak ZIP patch. Salin **dua file** `src/main.jsx` dan `src/checkoutClientRef.js` ke `D:\katalog-pondok\src\`. Tidak perlu menyalin `.env.local` atau mengubah API key Vercel.
4. Di terminal VS Code, jalankan `npm run build` dan `npm run dev`. Jika build error, **jangan deploy** dan kirim error tersebut untuk diperiksa.
5. Setelah uji lokal lolos, jalankan `npx vercel --prod`.
6. Masuk ke `/admin` → **Pengaturan**. Isi **rekening transfer Putra** dan **rekening transfer Putri** berupa nama bank, nomor rekening, dan nama pemilik rekening. Untuk **Belanja Umum**, buka **Toko & Produk** → **Daftar Toko** → edit toko lalu isi rekening transfer toko. Simpan dan pastikan data tetap ada setelah refresh. Hapus petunjuk lama yang masih menyebut QRIS.
7. Uji checkout santri **Putra** dan **Putri**, lalu **Belanja Umum**. Pastikan nama santri, total, rekening yang tepat, dan metode transfer ada di draf pesan WhatsApp. Uji transaksi sungguhan hanya dengan izin kasir; checkout langsung membuat pesanan/mereservasi stok, sekalipun pesan WA belum ditekan Kirim.

## Pengujian penting

- Tidak ada kolom WhatsApp pemesan di checkout.
- Tidak ada pilihan QRIS.
- Draf WhatsApp memuat **rekening Putra** untuk santri Putra, **rekening Putri** untuk santri Putri, dan **rekening toko** untuk Belanja Umum.
- Jika rekening belum dikonfigurasi, tidak ada nomor palsu—pesan meminta kasir mengirim rekening resmi.
- Mengulang checkout dengan **token yang sama** tidak membuat pesanan ganda.
- Stok dikurangi sekali ketika transaksi berhasil; admin dapat menemukan pesanan tanpa nomor pemesan pada daftar pesanan.
- Data lama, termasuk pembayaran QRIS historis, tetap ada.

## Batas pengujian

Tes otomatis frontend dan pemeriksaan sintaks **bukan** uji SQL di Supabase aktif atau uji beban 500 pesanan. Uji lokal/build serta satu transaksi yang diawasi kasir masih diperlukan. Jika frontend baru gagal, kembalikan file frontend V32.6 terlebih dahulu; SQL V32.7 yang sudah terpasang dapat tetap dibiarkan karena hanya menambahkan fungsi/kolom dan melonggarkan kewajiban nomor HP.
