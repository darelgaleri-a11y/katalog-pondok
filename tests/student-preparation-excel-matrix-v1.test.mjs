import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');

test('admin menyediakan tombol ekspor Excel rekap Kiriman Santri', () => {
  assert.match(main, /Excel Rekap Santri/);
  assert.match(main, /onClick=\{exportPreparationExcel\}/);
  assert.match(main, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  assert.match(main, /rekap-kiriman-santri-.*\.xlsx/);
});

test('kolom pertama menggabungkan nama, kelas, dan kamar sebagai asrama', () => {
  assert.match(main, /const student=\[order\.student_name\|\|'Nama tidak tercatat',studentClass\?`Kelas \$\{studentClass\}`:'Kelas —',room\?`Asrama \$\{room\}`:'Asrama —'\]\.join\(' \| '\)/);
  assert.match(main, /Kamar\\s\*:\\s\*\(\.\*\?\)\\s\*\\\|\\s\*Kelas\\s\*:\\s\*\(\.\*\)\$/i);
});

test('produk menjadi kolom dinamis dan jumlahnya dijumlahkan pada baris total', () => {
  assert.match(main, /const headers=\['Data Santri',\.\.\.products\.map/);
  assert.match(main, /quantities\.set\(key,\(quantities\.get\(key\)\|\|0\)\+Number\(item\.quantity\|\|0\)\)/);
  assert.match(main, /const totals=headers\.map/);
});

test('file Excel memiliki header berformat, filter, dan freeze panes', () => {
  assert.match(main, /state="frozen"/);
  assert.match(main, /<autoFilter ref=/);
  assert.match(main, /fillId="2"/);
  assert.match(main, /orientation="landscape"/);
});

test('ekspor hanya memuat kiriman santri aktif dan meminta konfirmasi data pribadi', () => {
  assert.match(main, /if\(!activeOps\.length\)return alert\('Tidak ada kiriman santri aktif/);
  assert.match(main, /File Excel ini berisi nama santri, kelas, dan asrama\/kamar/);
});

test('seluruh riwayat Kiriman Santri dimuat saat admin membuka menu Pesanan', () => {
  assert.match(main, /useEffect\(\(\)=>\{if\(isAdminUser&&admin&&tab==='orders'\)loadAllStudentOrders\(\)\},\[isAdminUser,admin,tab\]\)/);
  assert.match(main, /const batch=500;let offset=0;const collected=\[\]/);
});

test('checkout Kiriman Santri menyimpan kamar dan kelas terpisah dalam format yang dapat dibaca ekspor', () => {
  assert.match(main, /<label>Kamar<input name="room" required placeholder="Contoh: A-05"\/><\/label>/);
  assert.match(main, /<label>Kelas<input name="studentClass" required placeholder="Contoh: 10 MA"\/><\/label>/);
  assert.match(main, /!student\|\|!room\|\|!studentClass/);
  assert.match(main, /Kamar: \$\{room\}\\nKelas: \$\{studentClass\}/);
  assert.match(main, /student_room:mode==='student'\?`Kamar: \$\{String\(f\.get\('room'\)\|\|''\)\.trim\(\)\} \| Kelas: \$\{String\(f\.get\('studentClass'\)\|\|''\)\.trim\(\)\}`:null/);
});

test('setiap kartu pesanan menyediakan aksi hapus yang memanggil RPC server-side', () => {
  assert.match(main, /async function deleteOrder\(order\)/);
  assert.match(main, /supabase\.rpc\('admin_delete_order_v46',\{p_order_id:order\.id\}\)/);
  assert.match(main, /className="dangerOrderButton" onClick=\{\(\)=>deleteOrder\(o\)\}/);
  assert.match(main, /Hapus pesanan/);
});

test('penghapusan memuat ulang daftar pesanan dan rekap santri', () => {
  assert.match(main, /await loadOrders\(\);[\s\S]*if\(order\.mode==='student'\)await loadAllStudentOrders\(\)/);
});

test('aksi hapus memiliki konfirmasi permanen dan memberi perlindungan catatan serah-terima/rekonsiliasi', () => {
  assert.match(main, /Hapus pesanan #\$\{orderCode\} secara permanen/);
  assert.match(main, /catatan serah-terima/);
  assert.match(main, /catatan rekonsiliasi pembayaran/);
});
