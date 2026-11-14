import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');

test('form Nama pemesan hanya muncul untuk Belanja Umum', () => {
  assert.match(main, /\{mode==='general'&&<label>Nama pemesan/);
  assert.doesNotMatch(main, /<form onSubmit=\{checkout\}><label>Nama pemesan/);
});

test('checkout Kiriman Santri memakai nama santri untuk field internal database', () => {
  assert.match(main, /name=mode==='general'\?String\(f\.get\('name'\)\|\|''\)\.trim\(\):String\(f\.get\('student'\)\|\|''\)\.trim\(\)/);
  assert.match(main, /customer_name:name/);
  assert.match(main, /if\(mode==='general'&&!name\)/);
});

test('pesan WhatsApp Kiriman Santri tidak menampilkan Nama pemesan', () => {
  assert.match(main, /\$\{mode==='general'\?`Nama pemesan: \$\{name\}\\n`:''\}/);
});

test('informasi privasi Kiriman Santri tidak meminta nama orang tua/pemesan', () => {
  assert.match(main, /Nama orang tua\/pemesan tidak diminta untuk Kiriman Santri/);
});
