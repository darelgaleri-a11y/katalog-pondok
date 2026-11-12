import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const editor = fs.readFileSync(new URL('../src/OrderEditStudent.jsx', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase-v34-edit-student-orders.sql', import.meta.url), 'utf8');

test('admin menyediakan tombol edit hanya untuk pesanan Kiriman Santri', () => {
  assert.match(main, /o\.mode==='student'&&<button/);
  assert.match(main, /setOrderEditing\(o\)/);
  assert.match(main, /<OrderEditStudent order=\{orderEditing\}/);
});

test('editor mengirim seluruh field yang dapat diedit melalui RPC admin', () => {
  for (const field of ['customer_name','student_name','student_room','student_gender','delivery_date','payment_method','note','items']) {
    assert.match(editor, new RegExp(field));
    assert.match(migration, new RegExp('p_' + field));
  }
  assert.match(editor, /admin_edit_student_order_v1/);
});

test('RPC hanya admin, menjaga status, stok atomik, dan membuat audit edit', () => {
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /public\.admin_users/);
  assert.match(migration, /FOR UPDATE/);
  assert.match(migration, /stock_reserved/);
  assert.match(migration, /Pesanan selesai tidak dapat diedit/);
  assert.match(migration, /public\.student_handovers/);
  assert.match(migration, /public\.order_edit_history/);
  assert.match(migration, /GRANT EXECUTE/);
});
