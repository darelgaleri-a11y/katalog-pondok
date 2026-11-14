import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');

test('setiap toko memiliki deep link dengan slug', () => {
  assert.match(main, /routeStoreSlug/);
  assert.match(main, /\/toko\/\$\{encodeURIComponent\(slugifyStore\(s\.name\)\)\}/);
  assert.match(main, /setPage\('storeUnavailable'\)/);
});

test('ketika halaman toko dibuka, produk difilter hanya dari toko tersebut', () => {
  assert.match(main, /visibleProducts\.filter\(p=>p\.storeId===storeId/);
});

test('keranjang tidak menghapus barang toko lain tanpa konfirmasi', () => {
  assert.match(main, /const hasOtherStore/);
  assert.match(main, /window\.confirm\('Keranjang berisi barang dari toko lain/);
  assert.match(main, /if\(hasOtherStore\)current=\{\}/);
  assert.match(main, /return false;/);
});

test('checkout tetap menolak campuran toko', () => {
  assert.match(main, /Satu pesanan hanya boleh berasal dari satu toko/);
  assert.match(main, /supabase\.rpc\('create_checkout_v36'/);
});

test('belanja santri tidak menyediakan aksi pindah toko dari keranjang', () => {
  assert.doesNotMatch(main, /Tambah dari toko lain/);
  assert.match(main, /Setiap toko memiliki keranjang dan pesanan tersendiri/);
});


test('server RPC menolak keranjang multi-toko sebelum memanggil checkout tepercaya', () => {
  const sql = fs.readFileSync(new URL('../supabase-v36-single-store-checkout.sql', import.meta.url), 'utf8');
  assert.match(sql, /Satu pesanan hanya boleh berasal dari satu toko/);
  assert.match(sql, /public\.create_checkout_v33\(p_order\)/);
  assert.match(sql, /GRANT EXECUTE/);
});
