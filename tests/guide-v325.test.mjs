import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const jsx=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../src/style.css',import.meta.url),'utf8');

test('tutorial otomatis di katalog santri/umum setelah katalog siap',()=>{
 assert.match(jsx,/if\(!configured\|\|!loaded\|\|admin\|\|guideAutoCheckedRef\.current\)return/);
 assert.match(jsx,/guideAutoCheckedRef\.current=true/);
 assert.match(jsx,/if\(!sudahPernah\)\{setGuideStep\(0\);setGuideIsAutomatic\(true\);setShowGuide\(true\)\}/);
});

test('penanda tutorial disimpan di browser, tanpa pengiriman data ke database',()=>{
 assert.match(jsx,/const GUIDE_STORAGE_KEY='katalog-darel-v325-guide-seen'/);
 assert.match(jsx,/localStorage\.getItem\(GUIDE_STORAGE_KEY\)/);
 assert.match(jsx,/localStorage\.setItem\(GUIDE_STORAGE_KEY,'1'\)/);
 assert.match(jsx,/function closeGuide\(\)/);
 assert.match(jsx,/function openGuideManually\(\)/);
});

test('tutorial empat langkah menampilkan satu langkah per layar dan bisa dilewati',()=>{
 assert.match(jsx,/\.filter\(\(_,i\)=>i===guideStep\)/);
 assert.match(jsx,/Langkah \$\{guideStep\+1\} dari 4/);
 assert.match(jsx,/guideIsAutomatic\?'Lewati':'Tutup'/);
 assert.match(jsx,/setGuideStep\(s=>Math\.min\(3,s\+1\)\)/);
 assert.match(jsx,/setGuideStep\(s=>Math\.max\(0,s-1\)\)/);
 assert.match(jsx,/Mulai Belanja/);
 assert.match(css,/\.guideOneStep/);
 assert.match(css,/\.guideProgress/);
});

test('dialog punya aksesibilitas dasar dan tidak mengubah checkout',()=>{
 assert.match(jsx,/role="dialog" aria-modal="true"/);
 assert.match(jsx,/e\.key==='Escape'/);
 assert.match(jsx,/document\.body\.style\.overflow='hidden'/);
 assert.match(jsx,/supabase\.rpc\('create_checkout_v33'/);
 assert.match(jsx,/getOrCreateCheckoutToken\(checkoutTokenRef\.current\)/);
});
