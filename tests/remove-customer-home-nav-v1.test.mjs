import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');

test('navigasi Beranda pelanggan tidak ditampilkan di header', () => {
  assert.doesNotMatch(main, /<button onClick=\{navigateHome\}>Beranda<\/button>/);
  assert.match(main, /mode&&<button className="cartBtn" onClick={openCart}/);
});

test('logo katalog tetap dapat mengarahkan pelanggan ke halaman awal', () => {
  assert.match(main, /onClick=\{\(\)=>\{if\(admin\)/);
  assert.match(main, /navigateHome\(\)/);
});
