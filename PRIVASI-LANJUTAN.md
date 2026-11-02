# Tindak lanjut sebelum peluncuran luas

1. Tentukan kontak resmi pengelola data pondok (bukan nomor personal yang tidak disetujui).
2. Tetapkan kebijakan penyimpanan data pesanan dan santri serta prosedur penghapusan yang mempertimbangkan kewajiban transaksi.
3. Audit bucket Storage: pastikan bucket publik hanya berisi foto katalog, bukan bukti pembayaran atau data santri.
4. Uji akses API `anon` dari luar dashboard untuk tabel pesanan dan tabel admin; pengujian SQL Editor saja tidak selalu menguji peran `anon`.
5. Tambahkan perlindungan per-IP/perangkat atau CAPTCHA di lapisan server/edge sebelum promosi luas, serta monitoring error checkout.
6. Terapkan MFA untuk akun admin bila tersedia dan gunakan kata sandi kuat.
7. Tentukan prosedur pengembalian stok jika nomor WA tujuan salah atau pelanggan gagal membuka WhatsApp.
