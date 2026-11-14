import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');

test('pesan WhatsApp tidak lagi meminta kasir mengonfirmasi total atau menyebut bukti transfer', () => {
  assert.doesNotMatch(main, /Mohon kasir mengonfirmasi/);
  assert.doesNotMatch(main, /Bukti transfer akan dikirim di percakapan ini/);
  assert.match(main, /Catatan: \$\{String\(f\.get\('note'\)\|\|'-'\)\}`/);
});
