# Katalog Darel V33.1 — Identitas & Tampilan Mandiri Admin

V33.1 adalah pembaruan di atas **V33**. Admin dapat memasang logo, mengatur nama katalog, memilih warna utama dan warna latar untuk **Kiriman Santri** dan **Belanja Umum secara terpisah**, lalu melihat pratinjau sebelum menyimpan.

**Tampilan pembeli:** tidak ada langkah belanja baru. URL `/santri`, `/umum`, dan alias `/belanja-umum` tetap dipakai. Semua produk, stok, checkout, pengiriman umum, dan WA kasir dipertahankan.

## Persiapan (sekali saja)

1. Cadangkan folder `D:\katalog-pondok` dan backup database Supabase *Rahmani's Project*. Pasang saat bukan jam ramai.
2. Masuk Supabase → SQL Editor → New query. Tempel seluruh isi **`supabase-v33.1-branding-katalog.sql`**, lalu **Run**. Ini membuat tabel `public.catalog_branding_v331` dengan dua baris bawaan. Tabel dapat dibaca publik tetapi ditulis admin saja (RLS).
3. Pastikan V33 sudah terpasang. **Patch V33.1 hanya untuk proyek V33, jangan gunakan pada V32.x.**
4. Ekstrak patch, salin empat file dari folder `src` ke `D:\katalog-pondok\src` (timpa jika diminta):
   - `main.jsx`
   - `style.css`
   - `catalogBranding.js` (baru)
   - `BrandingSettings.jsx` (baru)
5. Di terminal VS Code, dari `D:\katalog-pondok` jalankan:

   ```powershell
   npm run build
   npm run dev
   ```

6. Uji login admin `/admin` → **Pengaturan → Identitas & Tampilan**. Pilih **Kiriman Santri**, isi nama, unggah logo, pilih warna, lihat pratinjau, lalu **Simpan Tampilan**. Buka `/santri` di tab baru dan segarkan. Ulangi untuk **Belanja Umum**; buka `/umum`.
7. Pastikan nama/warna/logo tetap ada setelah refresh; pastikan perubahan Santri tidak mengubah Umum, dan checkout lama tetap berfungsi. **Jangan lakukan checkout sungguhan di database produksi tanpa koordinasi kasir.**
8. Jika semua normal, hentikan dev (`Ctrl+C`) dan jalankan:

   ```powershell
   npx vercel --prod
   ```

## Cara mengganti branding berikutnya

Cukup login `/admin` → Pengaturan → Identitas & Tampilan, pilih katalog, unggah logo, pilih warna, **Simpan Tampilan**. Tidak perlu buka kode, deploy ulang, atau jalankan SQL lagi.

## Catatan teknis dan keamanan

- Logo disimpan di bucket Storage **`product-images`** yang sudah tersedia sejak versi lama. Hanya admin utama boleh unggah, sesuai kebijakan Storage yang terpasang. Nama file di folder `branding/student/` atau `branding/general/`.
- Logo dikompres ke WebP/JPEG maksimum sesuai `catalogPhotos.js`; sumber foto maksimum 5 MB. Gunakan logo resmi yang bebas dipublikasikan.
- Tabel `catalog_branding_v331` menyimpan hanya mode, nama, tautan logo, warna utama, dan warna latar; tidak menyimpan data pesanan atau santri.
- Perubahan branding tidak memakai `save_catalog_v10` atau mengubah JSON inventaris `catalog_state` sehingga tidak dapat menimpa stok.
- Logo lama dilepas dari **tampilan** saat diganti atau dihapus. File di Supabase Storage **tidak otomatis dihapus** agar tidak merusak tautan yang sudah dipakai; admins dapat membersihkan file tak terpakai nanti melalui dashboard Storage bila diperlukan.
- CSS tidak mengubah tampilan `/admin`; warna hanya digunakan pada katalog yang sedang dibuka.
- Jika SQL belum dijalankan, UI menampilkan kesalahan dan tombol Simpan dimatikan. Jalankan SQL, lalu refresh.
- Membagikan `/santri` dan `/umum` adalah pemisahan tampilan, **bukan** pembatasan akses: kedua URL dapat dibuka oleh siapa saja.
- Jika ingin membatalkan, kembalikan `main.jsx` dan `style.css` V33. Tidak perlu menghapus tabel branding untuk rollback frontend.

## Uji kode yang telah dilakukan

- `node --test tests/*.test.mjs` — **82/82 lulus**, termasuk 8 tes baru branding.
- Pemeriksaan parser TypeScript untuk 23 berkas `src/*.js`/`src/*.jsx` — tidak ada kesalahan sintaks.
- Belum menjalankan `npm run build`/uji SQL pada Supabase aktif karena dependensi npm dan akses proyek pengguna tidak tersedia dalam lingkungan ini. Jalankan build dan uji SQL di lingkungan sendiri **sebelum** Vercel production.
