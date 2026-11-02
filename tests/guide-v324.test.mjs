import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const jsx=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../src/style.css',import.meta.url),'utf8');

test('beranda tetap menyediakan tombol panduan manual',()=>{
 assert.match(jsx,/Bingung cara belanja\?/);
 assert.match(jsx,/onClick=\{openGuideManually\}/);
 assert.match(jsx,/showGuide&&<div className="guideOverlay"/);
});

test('panduan 4 langkah tetap menampilkan ilustrasi dan instruksi WhatsApp',()=>{
 assert.equal((jsx.match(/no:'[1-4]',title:/g)||[]).length,4);
 assert.match(jsx,/guideStepIllustration/);
 assert.match(jsx,/guideStepArtIcon/);
 assert.match(jsx,/tekan Kirim agar kasir menerima pesanan Anda/);
 assert.match(css,/\.guideStepIllustration/);
});

test('panduan bisa ditutup melalui tombol dan Escape',()=>{
 assert.match(jsx,/className="guideClose" onClick=\{closeGuide\}/);
 assert.match(jsx,/e\.key==='Escape'/);
 assert.match(jsx,/if\(guideStep===3\)closeGuide\(\)/);
});
