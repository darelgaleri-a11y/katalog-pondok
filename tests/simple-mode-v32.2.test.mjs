import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
test('checkout Supabase V32.1 dan UUID token tetap digunakan',()=>{
 assert.match(main,/getOrCreateCheckoutToken\(checkoutTokenRef\.current\)/);
 assert.match(main,/supabase\.rpc\('create_checkout_v33'/);
});
test('pesan WhatsApp tidak lagi berisi kode dan tautan lacak',()=>{
 const message=main.match(/const finalMessage=(`[^`]+`);/);
 assert.ok(message);
 assert.doesNotMatch(message[1],/Kode Akses Lacak|\/lacak|checkout_token/);
 assert.match(message[1],/No\. Pesanan/);
});
test('navigasi pembeli tidak menampilkan lacak pesanan',()=>{
 assert.doesNotMatch(main,/href="\/lacak"/);
 assert.match(main,/chat kasir melalui WhatsApp/);
});
test('menu admin pesanan santri adalah daftar pesanan, bukan laporan serah-terima',()=>{
 assert.match(main,/Pesanan Santri<\/button>/);
 assert.match(main,/setOrderMode\('student'\);goAdminTab\('orders'\)/);
 assert.doesNotMatch(main,/goAdminTab\('operations'\)/);
 assert.doesNotMatch(main,/tab==='operations'\?<section/);
});
test('halaman lama menampilkan informasi dan tidak merender portal lama',()=>{
 assert.match(main,/function HalamanLama\(/);
 assert.match(main,/path==='\/lacak'\|\|path==='\/petugas'/);
 assert.doesNotMatch(main,/<TrackingPage\/>|<StaffPortal\/>/);
 assert.match(css,/\.legacyHomeLink/);
});
test('login dan pengaturan santri tetap dipertahankan',()=>{
 assert.match(main,/supabase\.auth\.signInWithPassword/);
 assert.match(main,/saveSettings\(e\)/);
 assert.match(main,/db\.settings\.maleWa/);
 assert.match(main,/db\.settings\.femaleWa/);
});
