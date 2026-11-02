# V20 — Bukti Penerimaan Kiriman

V20 meneruskan V19, memperkuat pencatatan petugas dengan nama penerima dan cara penerimaan (`langsung` / `perwakilan_pondok`). Petugas wajib mencentang pernyataan bahwa barang benar-benar diserahkan. Waktu server, nama petugas, dan anti-duplikasi tetap dipakai. Hanya petugas gender yang sesuai dapat mencatat.

## Pemasangan

1. Cadangkan data Supabase dan proyek V19. Uji di lingkungan non-produksi jika tersedia.
2. Jalankan **hanya** `supabase-v20-receipt.sql` di SQL Editor Supabase yang sama.
3. Salin `.env` V19, jalankan `npm install` dan `npm run dev`.
4. Buka `/petugas`, login sebagai petugas percobaan dan uji dengan pesanan percobaan status `paid` / `prepared`.
5. Jika lolos, commit V20 ke GitHub dan deploy Vercel. Jangan deploy kode V20 sebelum SQL dijalankan: akan menyebabkan error fungsi RPC tidak ditemukan.

## Uji penting

- Nama penerima kosong atau cara penerimaan belum dipilih → ditolak.
- Pernyataan belum dicentang → tombol tidak menyimpan dan pesan kesalahan ditampilkan.
- Pesanan Putri tidak muncul atau tidak dapat dicatat akun Putra, juga sebaliknya.
- Pesanan batal, kedaluwarsa, dan menunggu konfirmasi ditolak di server.
- Setelah serah-terima, penerima dan waktu tampil; penyerahan kedua ditolak.
- Fungsi lama `staff_handover_v19` tidak boleh dapat dipanggil petugas.
- Checkout umum/santri, stok, kedaluwarsa, admin, dan laporan harus tetap berfungsi.

## Batasan

Nama penerima dan ceklis adalah pernyataan petugas, **bukan** bukti tanda tangan, OTP, atau verifikasi identitas independen. Entri V18/V19 tetap memiliki kolom penerima kosong. Admin V18 masih bisa mencatat serah-terima tanpa kolom penerima melalui fungsi lama; fitur admin dapat diperbarui pada versi lanjutan setelah disepakati. Perlakukan nama penerima sebagai informasi pribadi. Jangan membagikan laporan berisi nama lengkap kepada publik.
