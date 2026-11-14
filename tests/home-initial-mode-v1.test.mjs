import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');

test('URL root memulai halaman awal tanpa memilih mode pelanggan otomatis', () => {
  assert.match(main, /useState\(\(\)=>routeMode\(\)\|\|\(routeProductId\(\)\?routeProductMode\(\)\|\|'student':null\)\)/);
  assert.match(main, /page==='home'&&!mode/);
});

test('mode tetap ditentukan saat membuka link produk langsung', () => {
  assert.match(main, /routeProductId\(\)\?routeProductMode\(\)\|\|'student':null/);
  assert.match(main, /setPage\(productId\?'product'/);
});

test('navigasi browser kembali ke root juga mengosongkan mode pelanggan', () => {
  assert.match(main, /setMode\(nextMode\|\|\(productId\?routeProductMode\(\)\|\|'student':null\)\)/);
});
