# Pemasangan database baru untuk Katalog Multi-Toko V32.1

Berlaku HANYA untuk **proyek Supabase baru/kosong** (misalnya Rahmani's Project). Berkas ini disusun dari 20 skrip migrasi di ZIP V32.1, dari `supabase-setup.sql` sampai `supabase-v31-close-wib.sql`, dalam urutan dependensi. Dua file dari ZIP memang sengaja TIDAK dijalankan: `supabase-v8-cron-optional.sql` (opsional) dan `supabase-v13-security-audit.sql` (audit baca-saja; lakukan tersendiri setelah instalasi). V24 tidak memiliki migrasi SQL.

## Langkah pertama
1. Masuk ke https://supabase.com/dashboard lalu buka proyek **Rahmani's Project**, pastikan proyeknya BARU dan KOSONG.
2. Buka menu **SQL Editor** -> **New Query**.
3. Buka file `supabase-install-baru-v32.1.sql` di VS Code, salin SELURUH isi ke SQL Editor.
4. Klik **Run**. Bila ada konfirmasi risiko perubahan database, pastikan ini proyek BARU (bukan proyek lama) sebelum menyetujui.
5. Bila sukses, hasil kueri akhir memuat tujuh kolom bernilai **true**. Bila gagal, STOP dan kirim **pesan error tanpa token**.

## Setelah berhasil, belum boleh diarahkan ke Vercel!
- Database baru hanya berisi struktur (tabel, fungsi, policy/RLS, bucket foto, dan katalog kosong).
- Akun admin, petugas Putra/Putri, toko, produk, foto, stok, dan riwayat pesanan lama TIDAK dipulihkan oleh pemasangan ini.
- Langkah kedua: buat pengguna admin lewat **Authentication -> Users**, lalu beri peran admin via tabel `public.admin_users` (panduan menyusul). Jangan berbagi password atau service-role key.
- Langkah ketiga: tetapkan nomor WA kasir dan buat toko/produk dari halaman admin.
- Langkah terakhir: ubah dua environment variable Vercel ke **URL + publishable key** proyek baru dan deploy ulang.

## Pengaman
- Installer membuka `BEGIN` dan menutup dengan `COMMIT`; jika SQL gagal, perubahan dalam transaksi di-rollback.
- Pemeriksaan awal menghentikan installer bila tabel aplikasi sudah ada (mencegah menjalankan installer ulang atau menimpa DB lama).
- Tidak ada password, kredensial, dan data pribadi dalam file.
- Installer tidak merestorasi data proyek lama dan tidak menjalankan penghapusan data pesanan.
- Migrasi V31 untuk Tutup Kas WIB tetap memiliki keterbatasan penguncian periode yang dicatat di kode, jadi jangan gunakan fitur Tutup Kas WIB sebagai prosedur wajib sebelum pengujian.
