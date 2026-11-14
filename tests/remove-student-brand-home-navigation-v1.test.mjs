import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');

test('logo pada mode Kiriman Santri hanya menjadi identitas toko dan tidak kembali ke halaman awal', () => {
  assert.match(main, /!admin&&mode==='student'\?<div className="brand" aria-label=/);
  assert.match(main, /<button className="brand" onClick=\{\(\)=>\{if\(admin\)/);
  assert.match(main, /navigateHome\(\)/);
});

test('logo pada mode Belanja Umum tetap menjadi tombol navigasi seperti sebelumnya', () => {
  assert.match(main, /!admin&&mode==='student'\?/);
  assert.match(main, /<button className="brand" onClick=/);
});

test('logo dan nama toko tetap ditampilkan pada kedua mode', () => {
  assert.match(main, /const brandContent=<>\{customerBrand\?\.logo_url/);
  assert.match(main, /catalogBrandText/);
});
