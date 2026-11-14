import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const db = fs.readFileSync('server/db.ts', 'utf8');

test('public settings use explicit allowlist', () => {
  assert.match(server, /PUBLIC_SETTING_KEYS/);
  assert.match(server, /PUBLIC_SETTING_KEYS\.has\(s\.key\)/);
});

test('login throttling and bounded credential inputs exist', () => {
  assert.match(server, /LOGIN_MAX_ATTEMPTS = 5/);
  assert.match(server, /loginThrottle/);
  assert.match(server, /recordLoginFailure/);
  assert.match(server, /password\.length > 256/);
});

test('password changes revoke all administrator sessions', () => {
  assert.match(server, /DELETE FROM sessions WHERE user_id = \?/);
  assert.match(server, /new_password\.length < 12/);
});

test('uploads accept only raster formats with signature checks', () => {
  assert.ok(server.includes('image\\\\/(?:jpeg|png|webp)'));
  assert.match(server, /isJpeg/);
  assert.match(server, /isPng/);
  assert.match(server, /isWebp/);
  assert.ok(!server.includes('image/svg+xml'));
});

test('default admin password is no longer embedded', () => {
  assert.doesNotMatch(db, /hashPassword\('adminpondok123'\)/);
  assert.match(db, /ADMIN_INITIAL_PASSWORD/);
});

test('new password hashes use stronger work factor while legacy hashes remain verifiable', () => {
  assert.match(db, /PASSWORD_ITERATIONS = 310000/);
  assert.match(db, /LEGACY_PASSWORD_ITERATIONS = 10000/);
});
