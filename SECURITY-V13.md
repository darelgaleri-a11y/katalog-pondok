# V13: Pemeriksaan keamanan sebelum aplikasi dibagikan luas

V13 **tidak mengubah kode, tabel, fungsi checkout, stok, atau data pelanggan**. Ini paket baseline V12 dengan audit read-only dan langkah penilaian hasil. Jangan jalankan ulang migrasi V4–V10.

## Langkah

1. Backup proyek dan database; untuk pengujian gunakan data percobaan.
2. Jalankan `supabase-v13-security-audit.sql` melalui Supabase SQL Editor pada proyek yang digunakan Vercel.
3. Pastikan RLS `orders`, `admin_users`, dan `order_status_history` bernilai `true`; jangan langsung mengubah aturan produksi jika berbeda.
4. Pada tabel `orders`, **tidak boleh** ada policy SELECT yang mengizinkan `anon` atau `PUBLIC` membaca semua pesanan. Hanya `admin_users` untuk pengguna terautentikasi yang semestinya dapat membaca.
5. Fungsi yang bersifat internal/previous (`expire_pending_orders_v8_internal`, `create_checkout_v6_original`, `create_checkout_v9_previous`) tidak boleh dapat dieksekusi oleh `anon` atau `authenticated`.
6. Fungsi `save_catalog_v10`, `set_product_stock_v10`, `update_order_status_v7` tidak boleh dieksekusi `anon`. Akses `authenticated` pada fungsi itu masih harus dilindungi pemeriksaan `admin_users` **di dalam fungsi**.
7. Fungsi `create_checkout_v6` memang dapat dipanggil oleh `anon` agar belanja tanpa login bekerja. Tetap diperlukan batas trafik di tingkat edge / WAF di luar batas berdasarkan nomor telepon V9.
8. Periksa Supabase Dashboard > Authentication > URL Configuration untuk domain Vercel produksi; jangan memasukkan secret/service_role ke variabel yang dimulai `VITE_`.
9. Uji dari mode samaran tanpa login: halaman pelanggan tetap berfungsi, tetapi permintaan SELECT langsung ke tabel `orders` harus ditolak/tidak mengembalikan data.
10. Batasi siapa yang dapat mengunduh CSV lengkap; hapus file ekspor dari perangkat bersama dan tetapkan kebijakan retensi data santri.

## Cara melaporkan hasil

Laporkan apakah RLS aktif pada tabel di atas, ada/tidaknya policy SELECT publik untuk `orders`, apakah fungsi internal punya EXECUTE untuk anon, serta apakah pelanggan anonim dapat membaca pesanan. **Jangan kirim password, API secret, token sesi, data santri, atau hasil query berisi data pribadi.**

Jika hasil audit ditemukan bermasalah, buat migrasi SQL minimal berdasarkan output yang ditemukan; hindari mengganti semua policy secara massal di produksi.
