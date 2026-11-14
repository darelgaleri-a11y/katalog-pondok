import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const variant = fs.readFileSync(new URL('../src/VariantProductCard.jsx', import.meta.url), 'utf8');

test('link produk memiliki URL langsung yang dapat disalin', () => {
  assert.match(main, /\/produk\/\$\{encodeURIComponent\(p\.id\)\}\?mode=/);
  assert.match(main, /copyProductLink/);
  assert.match(main, /navigator\.clipboard\.writeText/);
});

test('membuka URL produk langsung menampilkan halaman detail produk', () => {
  assert.match(main, /routeProductId/);
  assert.match(main, /setPage\('product'\)/);
  assert.match(main, /productDetailPage/);
  assert.match(main, /productUnavailable/);
});

test('produk biasa dan produk variasi menyediakan tautan detail langsung', () => {
  assert.match(main, /onClick=\{\(\)=>openProduct\(p\)\}/);
  assert.match(main, /onShare=\{copyProductLink\}/);
  assert.match(variant, /onOpen/);
  assert.match(variant, /onShare/);
});

test('tombol Kembali ke toko di halaman pelanggan dihilangkan', () => {
  assert.doesNotMatch(main, /Kembali ke toko/);
});
