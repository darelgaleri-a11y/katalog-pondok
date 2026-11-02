# Katalog Darel V32.4 — Panduan Bergambar 4 Langkah

V32.4 menambahkan tombol **Bingung cara belanja?** yang tersedia di beranda pelanggan. Ketika dibuka, aplikasi menampilkan **empat kartu panduan dengan ilustrasi ikon besar**, tulisan singkat, dan tombol **Saya Mengerti**. Panduan dapat ditutup kapan saja; tidak muncul otomatis dan tidak menghalangi orang tua yang sudah mahir.

## Empat langkah
1. Pilih Kiriman Santri atau Belanja Umum.
2. Pilih toko dan tambahkan barang ke keranjang.
3. Periksa keranjang dan isi data yang diperlukan.
4. Tekan Pesan Lewat WhatsApp, lalu tekan **Kirim** di WhatsApp agar kasir menerima pesan.

## File yang berubah
- `src/main.jsx`
- `src/style.css`

Tidak ada perubahan SQL/database, stok, atau logika checkout. Fitur V32.3.1 tetap dipertahankan, termasuk tombol Kembali mengambang. **Jangan jalankan ulang SQL lama.**

## Cara memasang (patch pada V32.3.1 yang sudah online)
1. Cadangkan folder `D:\katalog-pondok` terlebih dahulu.
2. Ekstrak `katalog-multitoko-v32.4-patch.zip`.
3. Salin `src/main.jsx` dan `src/style.css` dari patch ke `D:\katalog-pondok\src`, timpa file yang lama. **Jangan mengganti** `.env`, `.env.local`, atau `.vercel`.
4. Jalankan `npm run build` di VS Code. Jika berhasil, jalankan `npm run dev` untuk mencoba tutorial melalui HP.
5. Uji tombol **Bingung cara belanja?**, gambar empat langkah, **Tutup/Saya Mengerti**, dan pastikan belanja dan checkout tetap berjalan.
6. Jika semua berhasil, jalankan `npx vercel --prod` lalu periksa situs produksi.

Catatan: build penuh harus berhasil di komputer sebelum deployment produksi. Jangan menyimpan kunci rahasia Supabase di kode frontend.
