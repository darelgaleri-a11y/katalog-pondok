import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');

test('halaman detail produk menyediakan tombol kembali ke toko pemilik produk', () => {
  assert.match(main, /productDetailPage.*productDetailBack/s);
  assert.match(main, /Kembali ke toko/);
  assert.match(main, /setStoreId\(product\.storeId\)/);
  assert.match(main, /setPage\('store'\)/);
});

test('kembali ke toko mempertahankan mode pelanggan umum dan santri', () => {
  assert.match(main, /targetMode===.*general.*mode=general/);
  assert.match(main, /get\('mode'\)\|\|'student'/);
});

test('tautan toko tetap menggunakan slug toko yang sedang dibuka', () => {
  assert.match(main, /slugifyStore\(productStore\.name\)/);
});
