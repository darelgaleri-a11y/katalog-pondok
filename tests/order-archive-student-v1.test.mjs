import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase-v35-archive-student-orders.sql', import.meta.url), 'utf8');

test('admin menyediakan aksi arsip untuk semua pesanan Kiriman Santri', () => {
  assert.match(main, /o\.mode==='student'&&<button[^>]*orderArchiveButton/);
  assert.match(main, /admin_archive_student_order_v1/);
});

test('arsip menyimpan transaksi dan menyembunyikan pesanan dari daftar aktif', () => {
  assert.match(migration, /deleted_at/);
  assert.match(migration, /order_archive_history/);
  assert.match(migration, /order_snapshot/);
  assert.match(migration, /o\.deleted_at IS NULL/);
});

test('stok hanya dikembalikan untuk reservasi aktif yang belum selesai atau diserahterimakan', () => {
  assert.match(migration, /v_order\.stock_reserved/);
  assert.match(migration, /v_order\.status NOT IN \('completed'\)/);
  assert.match(migration, /public\.student_handovers/);
  assert.match(migration, /stock_reserved=CASE WHEN v_should_restore THEN false ELSE stock_reserved END/);
});

test('arsip hanya dapat dilakukan admin utama', () => {
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /public\.admin_users/);
  assert.match(migration, /GRANT EXECUTE/);
});
