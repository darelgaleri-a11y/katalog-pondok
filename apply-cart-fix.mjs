import fs from 'node:fs';

const mainPath = 'src/main.jsx';
const oldTestPath = 'tests/store-isolation-v1.test.mjs';
const newTestPath = 'tests/cart-preserve-on-store-switch.test.mjs';

let main = fs.readFileSync(mainPath, 'utf8');
let oldTests = fs.readFileSync(oldTestPath, 'utf8');

const oldAdd = " function add(p){updateCart(prev=>{let current={...prev};current=Object.fromEntries(Object.entries(current).filter(([id])=>db.products.find(x=>x.id===id)?.storeId===p.storeId));return {...current,[p.id]:Math.min(p.stock,(current[p.id]||0)+1)}})}";
const newAdd = ` function add(p){
  // Jangan pernah menghapus isi keranjang toko lain secara diam-diam.
  // Satu checkout tetap dibatasi untuk satu toko oleh aturan bisnis dan RPC V36.
  const currentCart=carts[mode]||{};
  const hasOtherStore=Object.entries(currentCart).some(([id,qty])=>{
   if(!(qty>0))return false;
   const existingProduct=db.products.find(item=>item.id===id);
   return Boolean(existingProduct&&existingProduct.storeId!==p.storeId);
  });
  if(hasOtherStore&&!window.confirm('Keranjang berisi barang dari toko lain. Jika melanjutkan, barang di keranjang lama akan diganti dengan barang dari toko ini. Lanjutkan?'))return false;
  updateCart(prev=>{
   let current={...prev};
   if(hasOtherStore)current={};
   return {...current,[p.id]:Math.min(p.stock,(current[p.id]||0)+1)};
  });
  return true;
 }`;
if (!main.includes(oldAdd)) throw new Error('Fungsi add(p) tidak cocok dengan versi file ini.');
main = main.replace(oldAdd, newAdd);

const oldCard = "const addToCart=chosen=>{if(mode==='general'&&rows.some(x=>x.p.storeId!==chosen.storeId)&&!confirm('Keranjang umum hanya untuk satu toko. Ganti toko dan kosongkan keranjang sebelumnya?'))return;add(chosen)};";
if (!main.includes(oldCard)) throw new Error('Handler kartu produk tidak cocok dengan versi file ini.');
main = main.replace(oldCard, "const addToCart=chosen=>add(chosen);");

const oldDetail = "onClick={()=>{add(product);openCart()}}";
if (!main.includes(oldDetail)) throw new Error('Handler beli produk detail tidak cocok dengan versi file ini.');
main = main.replace(oldDetail, "onClick={()=>{if(add(product))openCart()}}");

const oldTestStart = oldTests.indexOf("test('keranjang pelanggan dibatasi ke toko aktif");
if (oldTestStart < 0) throw new Error('Tes lama keranjang tidak ditemukan.');
const oldTestEndMarker = "\n});";
const oldTestEnd = oldTests.indexOf(oldTestEndMarker, oldTestStart);
if (oldTestEnd < 0) throw new Error('Akhir tes lama keranjang tidak ditemukan.');
const replacementTests = `test('keranjang tidak menghapus barang toko lain tanpa konfirmasi', () => {
  assert.match(main, /const hasOtherStore/);
  assert.match(main, /window\\.confirm\\('Keranjang berisi barang dari toko lain/);
  assert.match(main, /if\\(hasOtherStore\\)current=\\{\\}/);
  assert.match(main, /return false;/);
});

test('checkout tetap menolak campuran toko', () => {
  assert.match(main, /Satu pesanan hanya boleh berasal dari satu toko/);
  assert.match(main, /supabase\\.rpc\\('create_checkout_v36'/);
});`;
oldTests = oldTests.slice(0, oldTestStart) + replacementTests + oldTests.slice(oldTestEnd + oldTestEndMarker.length);

const newTest = `import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');

test('menambah barang dari toko lain meminta persetujuan sebelum mengganti keranjang', () => {
  assert.match(main, /const hasOtherStore/);
  assert.match(main, /window\\.confirm\\('Keranjang berisi barang dari toko lain/);
  assert.match(main, /if\\(hasOtherStore\\)current=\\{\\}/);
});

test('membatalkan konfirmasi tidak mengubah keranjang', () => {
  assert.match(main, /if\\(hasOtherStore&&!window\\.confirm\\([\\s\\S]*?\\)\\)return false;/);
});

test('keranjang toko yang sama tetap mempertahankan jumlah sebelumnya', () => {
  assert.match(main, /return \\{\\.\\.\\.current/);
  assert.match(main, /current\\[p\\.id\\]\\|\\|0/);
});

test('tombol beli detail tidak membuka keranjang jika konfirmasi dibatalkan', () => {
  assert.match(main, /if\\(add\\(product\\)\\)openCart\\(\\)/);
});
`;

fs.writeFileSync(mainPath, main, 'utf8');
fs.writeFileSync(oldTestPath, oldTests, 'utf8');
fs.writeFileSync(newTestPath, newTest, 'utf8');
console.log('Perbaikan keranjang diterapkan dan tes regresi ditambahkan.');
