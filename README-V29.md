# V29 — Kunci periode kas setelah tutup kas (UTC)

**Cadangkan database dan gunakan proyek staging terlebih dahulu.**

## Instalasi
1. Jalankan `supabase-v29-period-lock.sql` di SQL Editor setelah V28.
2. Salin `.env` yang aman dari V28 ke V29 (jangan commit ke GitHub).
3. Jalankan `npm install` dan `npm run dev`.

## Aturan
- Hanya admin utama boleh menjalankan RPC pembayaran/koreksi.
- `record_payment_v25` menolak `received_at` pada tanggal **UTC** yang sudah ada dalam `cash_closures_v27`.
- Pembayaran yang terlambat diketahui boleh dicatat dengan tanggal penerimaan akuntansi *periode yang masih terbuka*; tanggal mutasi bank aslinya harus ditulis di `notes` untuk transparansi. Ini merupakan pencatatan penyesuaian, bukan perubahan transaksi bank.
- `void_payment_v26` mencatat koreksi pada saat operasi dilakukan; koreksi atas penerimaan lama boleh di periode terbuka dan snapshot lama tetap utuh.
- Penutupan dan insert memakai advisory lock yang sama per tanggal UTC untuk mengurangi risiko transaksi bersamaan.
- **Batasan:** laporan bulanan V28 masih Asia/Jakarta/WIB sementara tutup kas V27 masih UTC. SQL ini **belum menyatukan** kedua periode. Perlu desain migrasi terpisah setelah pengecekan laporan.
- Versi ini belum menambahkan jurnal penyesuaian formal yang terpisah.

## Uji
1. Buat pesanan pembayaran percobaan dan tutup tanggal UTC yang telah berlalu.
2. Coba catat pembayaran baru dengan `received_at` di tanggal yang sudah ditutup: **ditolak**, tanpa menciptakan catatan.
3. Catat pembayaran di tanggal terbuka dengan catatan tanggal bank asli: **berhasil**.
4. Batalkan pembayaran lama via Koreksi: **tercatat pada hari koreksi**, snapshot sebelumnya tidak berubah.
5. Periksa login, checkout WhatsApp, stok, laporan harian/bulanan, dan petugas tetap berfungsi.

**Jangan jalankan di produksi sebelum tes staging berhasil.**
