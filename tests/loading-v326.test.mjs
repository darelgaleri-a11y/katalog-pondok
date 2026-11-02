import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');

test('layar memuat katalog memiliki indikator visual dan pesan jelas',()=>{
 assert.match(main,/if\(!loaded\)return <main className="catalogLoadingScreen"/);
 for(const token of ['catalogLoadingArtwork','catalogLoadingBag','catalogLoadingDots','catalogLoadingTrack','Sedang menyiapkan katalog'])assert.ok(main.includes(token),`hilang: ${token}`);
});
test('keadaan galat berbeda dari animasi memuat dan ada tombol ulang',()=>{
 assert.match(main,/!cloudError&&<><div className="catalogLoadingDots"/);
 assert.match(main,/cloudError\?\s*'Coba muat ulang'/);
 assert.match(main,/\.catch\(error=>\{/);
 assert.match(main,/window\.location\.reload\(\)/);
});
test('animasi CSS menghormati preferensi kurangi gerakan',()=>{
 for(const token of ['@keyframes catalogBagFloat','@keyframes catalogDot','@keyframes catalogTrack','@media(prefers-reduced-motion:reduce)']) assert.ok(css.includes(token));
});
test('animasi tidak memberi progres palsu atau mengubah transaksi checkout',()=>{
 assert.doesNotMatch(main,/setTimeout\([^)]*setLoaded\(true\)/);
 assert.match(main,/supabase\.rpc\('create_checkout_v33'/);
 assert.match(main,/checkoutTokenRef\.current=orderPayload\.checkout_token/);
});
