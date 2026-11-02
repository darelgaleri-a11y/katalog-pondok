# V24 — Rekap Keuangan (lanjutan V23)

- Tambah tab **Keuangan** pada `/admin` untuk admin utama. Tidak ada perubahan SQL maupun RLS.
- Data diambil langsung dari `orders` dengan pagination 500 baris setiap halaman.
- Ringkasan: nilai terverifikasi (status `paid`, `prepared`, `completed`), belum terverifikasi, batal/kedaluwarsa, umum, santri, dan subtotal berdasarkan toko.
- Pesanan kiriman santri lintas toko dihitung dari `items[].subtotal` per toko, bukan seluruh total ke salah satu toko.
- Filter tanggal checkout (UTC), layanan dan ekspor CSV tanpa nama/nomor pelanggan.
- PERINGATAN: status adalah konfirmasi manual; ini bukan bukti settlement rekening, belum memuat refund/biaya.

## Instalasi
1. Jangan jalankan ulang SQL lama atau buat proyek Supabase baru.
2. Salin `.env` V23 ke folder V24.
3. `npm install` lalu `npm run dev`. Buka `/admin` -> **Keuangan**.
4. Uji sebelum mengganti Vercel produksi.

## Tes
1. Login admin; tab Keuangan ada, petugas tidak melihatnya.
2. Cek rekap nominal status waiting/paid/prepared/completed/cancelled sesuai Supabase.
3. Kiriman lintas toko terbagi sesuai subtotal item.
4. Filter tanggal dan jenis umum/santri.
5. CSV terunduh tanpa nama, nomor HP, atau data santri.
6. Checkout, stok, pelacakan, dan petugas tetap normal.

Tidak ada penambahan permission publik. Pengujian lengkap tetap wajib pada Supabase proyek Anda.
