PERBAIKAN KERANJANG KATALOG PONDOK

Isi:
- apply-cart-fix.mjs: patcher otomatis untuk repository yang cocok dengan versi source yang diaudit.

Cara pakai:
1. Cadangkan folder proyek atau pastikan perubahan lokal sudah di-commit.
2. Salin apply-cart-fix.mjs ke folder utama repository (folder yang berisi package.json).
3. Jalankan: node apply-cart-fix.mjs
4. Jalankan tes:
   node --test tests/store-isolation-v1.test.mjs tests/cart-preserve-on-store-switch.test.mjs
5. Jalankan build:
   npm run build

Patcher akan berhenti sebelum menulis file jika struktur source tidak cocok.
File yang disentuh:
- src/main.jsx
- tests/store-isolation-v1.test.mjs
- tests/cart-preserve-on-store-switch.test.mjs (baru)

Perubahan:
- Penambahan barang dari toko lain meminta konfirmasi pada kedua mode.
- Jika dibatalkan, keranjang lama tidak berubah.
- Jika dilanjutkan, keranjang lama diganti dengan keranjang toko baru.
- Tombol beli di halaman detail tidak membuka keranjang bila konfirmasi dibatalkan.
- Checkout tetap satu toko per pesanan.

Patcher ini tidak mengubah database, SQL, konfigurasi, maupun file rahasia.
