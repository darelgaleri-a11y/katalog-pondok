# Katalog Darel V32.9 — Galeri Foto Toko dan Produk

Versi ini meneruskan V32.8. **Tidak ada SQL baru** dan alur checkout/keranjang tidak diubah.

## Perubahan
- Toko: **1 foto sampul**, **1 logo opsional**. Cover muncul pada kartu toko dan header halaman toko.
- Produk biasa dan produk dengan variasi: **maksimal 5 foto**. Foto pertama menjadi foto utama.
- Pembeli mengetuk foto produk untuk membuka galeri besar, menggeser kiri-kanan di HP, memakai tombol panah, atau thumbnail.
- Admin dapat unggah foto JPG/PNG/WEBP dari HP/komputer, mengubah urutan, atau menghapus foto dari katalog.
- Foto secara otomatis dikompres ke WEBP/JPG hingga **maksimal 1200 piksel sisi terpanjang** dan **2 MB per foto hasil kompresi**. Foto mentah dibatasi 5 MB.
- Media disimpan pada **Supabase Storage bucket `product-images` yang sudah digunakan versi lama**. JSON katalog hanya menyimpan URL foto.
- Foto produk lama (`image`) tetap ditampilkan meskipun belum mempunyai daftar `images`.

## Perubahan file kode

- `src/main.jsx`
- `src/style.css`
- `src/VariantEditor.jsx`
- `src/VariantProductCard.jsx`
- `src/productVariants.js`
- **Baru** `src/PhotoFields.jsx`, `src/PhotoGallery.jsx`, `src/catalogPhotos.js`

## Petunjuk pemasangan ke V32.8
1. Cadangkan folder `D:\katalog-pondok` dan bila memungkinkan ekspor data katalog Supabase. Pilih waktu di luar jam sibuk.
2. Ekstrak **katalog-multitoko-v32.9-patch.zip**, lalu buka folder `katalog-multitoko-v32.9-patch\src`.
3. Salin **semua 8 file dari folder `src` patch** ke `D:\katalog-pondok\src` (replace bila diminta).
4. Jalankan di terminal VS Code:

   ```powershell
   cd D:\katalog-pondok
   npm run build
   npm run dev
   ```

5. Coba Admin → Toko & Produk → Daftar Toko → Edit Toko. Unggah satu cover dan, bila diinginkan, logo. Tekan Simpan Toko, **tunggu status tersimpan**, lalu refresh dan cek foto tetap ada.
6. Coba Admin → Toko & Produk → Daftar Produk → Edit Produk. Unggah 2–5 foto, urutkan, simpan, lalu lihat galeri di layar pelanggan. Ulangi untuk salah satu produk variasi.
7. Setelah berhasil dan foto muncul di HP, hentikan server dev dengan `Ctrl+C`, lalu jalankan `npx vercel --prod`.

**Jangan** mengganti `.env.local`, `.vercel`, proyek Supabase, atau API key yang sudah berfungsi.

## Jika upload foto gagal
- Pastikan login sebagai admin utama (tabel `public.admin_users`).
- Buka Supabase → Storage dan cek bucket **`product-images`** sudah tersedia dan publik untuk dibaca. Dalam instalasi lama, bucket ini dibuat oleh `supabase-setup.sql`.
- Kebijakan unggah hanya untuk akun admin; jangan membuat kebijakan unggah publik bagi pelanggan.
- Pastikan foto JPEG/PNG/WEBP dan tidak lebih dari 5 MB per foto. Foto dari iPhone format HEIC perlu dikonversi ke JPG terlebih dahulu jika browser tidak mendukung.
- Tidak perlu menjalankan ulang seluruh skrip SQL lama hanya untuk menambah foto.

## Catatan keamanan dan penyimpanan
- Media publik katalog memang terlihat oleh semua orang. Jangan unggah foto berisi data pribadi santri atau nomor rekening rahasia.
- Menghapus foto **dari katalog** hanya menghapus tautannya dari katalog; file foto di Supabase Storage belum dihapus agar tidak merusak produk lain yang mungkin memakainya. Penghapusan berkas lama di Storage bisa dilakukan terpisah setelah verifikasi.
- Hasil kompresi bergantung browser. Jika gagal, sistem akan menampilkan pesan error tanpa mengubah stok/checkout.
- File penuh V32.9 bersifat referensi. Untuk proyek Vercel dan env yang sudah terpasang, **lebih aman gunakan ZIP patch**.

## Pengujian
- `node --test tests/*.test.mjs` menjalankan uji kode (termasuk tes V32.9).
- Pemeriksaan parser JSX terpisah telah dilakukan di lingkungan penyusunan.
- **Build Vite produksi dan upload langsung ke Rahmani's Project belum diverifikasi**; wajib uji di VS Code sebelum deploy.
