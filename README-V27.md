# V27 — Tutup Kas Harian

1. Cadangkan database dan proyek V26.1.
2. Jalankan `supabase-v27-daily-close.sql` di Supabase SQL Editor. Jalankan hanya sekali pada tahap awal dan baca kode SQL sebelum eksekusi.
3. Salin `.env` lama, jalankan `npm install` kemudian `npm run dev`.
4. Buka `/admin` → **Tutup Kas**. Lakukan uji dengan data percobaan.

## Aturan
- Hanya admin utama boleh tutup kas, dan hanya tanggal **UTC** sebelum hari ini.
- Per tanggal hanya satu penutupan. Snapshot permanen; tidak mengubah data pembayaran atau stok.
- Pembayaran dihitung dari `received_at`, koreksi dari `voided_at`, dalam rentang hari UTC.
- Koreksi berikutnya dicatat pada tanggal koreksi. Pengisian pembayaran backdate setelah tutup kas dapat membuat snapshot berbeda dengan laporan berjalan: perlu prosedur penguncian periode pada pengembangan lanjutan.
- Perlu pemeriksaan manual dengan mutasi bank dan QRIS. Belum ada rekonsiliasi otomatis bank.
- Audit peran petugas Putra/Putri: harus ditolak server untuk RPC penutupan.

## Tes
Login admin; SQL sukses; penutupan kemarin; tanggal sama ditolak; petugas ditolak; angka snapshot sama dengan Kas & Koreksi saat penutupan; ekspor CSV; checkout/stok/pelacakan tetap berfungsi.
