import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');

test('menambah barang dari toko lain meminta persetujuan sebelum mengganti keranjang', () => {
  assert.match(main, /const hasOtherStore/);
  assert.match(main, /window\.confirm\('Keranjang berisi barang dari toko lain/);
  assert.match(main, /if\(hasOtherStore\)current=\{\}/);
});

test('membatalkan konfirmasi tidak mengubah keranjang', () => {
  assert.match(main, /if\(hasOtherStore&&!window\.confirm\([\s\S]*?\)\)return false;/);
});

test('keranjang toko yang sama tetap mempertahankan jumlah sebelumnya', () => {
  assert.match(main, /return \{\.\.\.current/);
  assert.match(main, /current\[p\.id\]\|\|0/);
});

test('tombol beli detail tidak membuka keranjang jika konfirmasi dibatalkan', () => {
  assert.match(main, /if\(add\(product\)\)openCart\(\)/);
});
