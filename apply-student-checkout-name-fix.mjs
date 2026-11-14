import fs from 'node:fs';

const mainPath = 'src/main.jsx';
let main = fs.readFileSync(mainPath, 'utf8');

function replaceOnce(source, before, after, description) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Bagian tidak ditemukan: ${description}. Tidak ada file yang diubah.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Bagian muncul lebih dari sekali: ${description}. Tidak ada file yang diubah.`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

main = replaceOnce(
  main,
  "const f=new FormData(e.currentTarget),name=String(f.get('name')||'').trim(),pay='Transfer bank';\n if(!name)return alert('Nama pemesan wajib diisi.');",
  "const f=new FormData(e.currentTarget),name=String((mode==='student'?f.get('student'):f.get('name'))||'').trim(),pay='Transfer bank';\n if(!name)return alert(mode==='student'?'Nama santri wajib diisi.':'Nama pemesan wajib diisi.');",
  'validasi nama pada checkout'
);

main = replaceOnce(
  main,
  "<label>Nama pemesan<input name=\"name\" required placeholder=\"Nama orang tua / pembeli\"/></label>{mode==='student'&&<>",
  "{mode==='general'&&<label>Nama pemesan<input name=\"name\" required placeholder=\"Nama orang tua / pembeli\"/></label>}{mode==='student'&&<>",
  'field nama pemesan pada formulir'
);

main = replaceOnce(
  main,
  "\\nNama pemesan: ${name}\\nMetode bayar: Transfer bank",
  "${mode==='general'?`\\nNama pemesan: ${name}`:''}\\nMetode bayar: Transfer bank",
  'baris nama pada pesan WhatsApp'
);

main = replaceOnce(
  main,
  "Nama pemesan dipakai untuk mencatat serta menindaklanjuti pesanan.",
  "Untuk Belanja Umum, nama pemesan dipakai untuk mencatat serta menindaklanjuti pesanan. Untuk Kiriman Santri, nama santri menjadi identitas penerima pesanan.",
  'keterangan privasi'
);

fs.writeFileSync(mainPath, main, 'utf8');

const testPath = 'tests/student-checkout-no-customer-name.test.mjs';
const test = `import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');

test('field nama pemesan hanya muncul pada Belanja Umum', () => {
  assert.match(main, /\\{mode==='general'&&<label>Nama pemesan/);
  assert.match(main, /\\{mode==='student'&&/);
});

test('checkout Kiriman Santri memakai nama santri tanpa meminta nama pemesan', () => {
  assert.match(main, /mode==='student'\\?f\\.get\\('student'\\):f\\.get\\('name'/);
  assert.match(main, /mode==='student'\\?'Nama santri wajib diisi\\.'/);
});

test('Belanja Umum tetap mewajibkan nama pemesan', () => {
  assert.match(main, /mode==='student'\\?'Nama santri wajib diisi\\.':'Nama pemesan wajib diisi\\.'/);
});

test('pesan WhatsApp hanya menampilkan nama pemesan untuk Belanja Umum', () => {
  assert.match(main, /mode==='general'\\?`\\\\nNama pemesan: \\$\\{name\\}`:''/);
});

test('RPC tetap menerima identitas nama untuk menjaga kompatibilitas database', () => {
  assert.match(main, /customer_name:name/);
  assert.match(main, /student_name:mode==='student'\\?/);
});
`;
fs.writeFileSync(testPath, test, 'utf8');

console.log('Perbaikan Kiriman Santri selesai diterapkan.');
console.log('File diubah: src/main.jsx');
console.log('Tes baru: tests/student-checkout-no-customer-name.test.mjs');
