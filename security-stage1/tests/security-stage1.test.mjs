import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync(new URL('../../server.ts', import.meta.url), 'utf8');
const db = fs.readFileSync(new URL('../../server/db.ts', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

test('login memiliki rate limit dan password input dibatasi', () => {
  assert.match(server, /LOGIN_MAX_FAILURES = 5/);
  assert.match(server, /LOGIN_BLOCK_MS = 15 \* 60 \* 1000/);
  assert.match(server, /password\.length > 256/);
});

test('token sesi disimpan dan dicari dalam bentuk SHA-256', () => {
  assert.match(server, /function hashSessionToken/);
  assert.match(server, /hashSessionToken\(token\)/);
  assert.match(server, /hashSessionToken\(currentToken\)/);
});

test('pengaturan publik memakai allowlist', () => {
  assert.match(server, /publicSettingKeys/);
  assert.match(server, /WHERE key IN/);
});

test('upload menolak SVG dan memvalidasi signature serta ukuran', () => {
  assert.ok(server.includes('image\\/(?:png|jpeg|webp)'));
  assert.match(server, /5 \* 1024 \* 1024/);
  assert.match(server, /validSignature/);
});

test('password baru lebih kuat dan hash lama masih didukung', () => {
  assert.match(server, /new_password\.length < 12/);
  assert.match(db, /CURRENT_PASSWORD_ITERATIONS = 310000/);
  assert.match(db, /LEGACY_PASSWORD_ITERATIONS = 10000/);
});

test('tidak ada password admin hard-coded dan start menjalankan tsx', () => {
  assert.doesNotMatch(db, /adminpondok123/);
  assert.match(db, /process\.env\.ADMIN_PASSWORD/);
  assert.equal(pkg.scripts.start, 'tsx server.ts');
  assert.ok(pkg.dependencies.tsx);
});
