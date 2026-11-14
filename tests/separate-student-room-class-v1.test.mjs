import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');

test('formulir Kiriman Santri memisahkan kolom kamar dan kelas', () => {
  assert.match(main, /<label>Kamar<input name="room" required placeholder="Contoh: A-05"\/><\/label>/);
  assert.match(main, /<label>Kelas<input name="studentClass" required placeholder="Contoh: 10 MA"\/><\/label>/);
  assert.doesNotMatch(main, /<label>Kamar \/ Kelas/);
});

test('kamar dan kelas wajib diisi sebelum checkout', () => {
  assert.match(main, /!room\|\|!studentClass/);
  assert.match(main, /Isi nama santri, kamar, kelas/);
});

test('pesan WhatsApp menampilkan kamar dan kelas sebagai baris terpisah', () => {
  assert.match(main, /Kamar: \$\{room\}\\nKelas: \$\{studentClass\}/);
});

test('data kamar dan kelas disimpan pada kolom lama agar tidak perlu migrasi', () => {
  assert.match(main, /student_room:mode==='student'\?`Kamar: \$\{String\(f\.get\('room'\)\|\|''\)\.trim\(\)\} \| Kelas: \$\{String\(f\.get\('studentClass'\)\|\|''\)\.trim\(\)\}`:null/);
  assert.match(main, /Kamar \/ Kelas:/);
});
