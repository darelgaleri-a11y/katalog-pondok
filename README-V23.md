# V23 — Pembatasan Percobaan Kode Pelacakan

Perubahan ini hanya berlaku pada endpoint `/lacak`. Tidak ada perubahan pada pesanan, stok, checkout, akun admin/petugas, maupun jadwal santri.

## Instalasi
1. **Backup database Supabase** dan folder V22 dahulu. Pengujian awal gunakan proyek staging bila ada.
2. Jalankan `supabase-v23-tracking-limit.sql` pada proyek yang sudah menjalankan migrasi V22.
3. Salin `.env` dari V22 ke proyek V23, lalu jalankan `npm install` dan `npm run dev`.
4. Uji ID lengkap + kode benar (berhasil), kode salah (gagal), delapan percobaan salah (percobaan berikutnya tertahan), lalu kode benar tetap bisa digunakan.
5. Uji `/admin`, `/petugas`, checkout umum/santri, stok dan pembatalan.
6. Deploy ke Vercel setelah pengujian lokal berhasil. **Catatan:** Skrip menonaktifkan RPC lama `track_order_v22` segera setelah dijalankan; halaman V22 yang sedang online tidak bisa melacak sampai frontend V23 ter-deploy. Idealnya migrasikan saat waktu pemeliharaan singkat.

## Keamanan dan keterbatasan
- Pembatasan **8 kode salah per ID pesanan valid dalam 15 menit**, bukan per IP atau akun. Kode benar tetap bisa digunakan. Pemilik ID dapat mengalami hambatan jika ada orang lain sengaja memasukkan kode salah berkali-kali, walau kode benar tetap berfungsi.
- ID pesanan UUID acak dan kode akses checkout UUID acak tetap harus dirahasiakan. Pelacakan sengaja tidak mengungkap identitas pelanggan/santri.
- Ini **bukan** perlindungan volumetrik per IP atau CAPTCHA. Untuk publik berskala besar, gunakan Supabase Edge Function / gateway dengan batas berdasarkan IP yang mempertimbangkan proxy tepercaya serta monitoring dan kebijakan privasi.
- Log kegagalan hanya menyimpan ID pesanan dan waktu, tidak menyimpan kode yang diketik. Bersihkan log lama secara berkala, contoh SQL opsional di migrasi.
- Jangan memberikan hak SELECT pada tabel log kepada anon/authenticated.
