import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readGeneralShipping,generalShippingWhatsApp} from '../src/shippingDetails.js';

const src=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const migration=readFileSync(new URL('../supabase-v33-alamat-pengiriman-umum.sql',import.meta.url),'utf8');
const shippingComponent=readFileSync(new URL('../src/GeneralShippingFields.jsx',import.meta.url),'utf8');
const valid = {shipping_recipient:'Ibu Ani',shipping_address:'Jl. Mawar No. 3 RT 02',shipping_area:'Menteng, Jekan Raya',shipping_city:'Palangka Raya',shipping_landmark:'Rumah pagar biru'};

// Minimal mock yang tidak tergantung paket React/Vite untuk unit helper murni.
const fakeForm=values=>({get:name=>values[name]??null});

test('alamat umum divalidasi dan seluruh field disimpan dalam payload',()=>{
 const result=readGeneralShipping(fakeForm({...valid,shipping_address:'  Jl. Mawar No. 3 RT 02  '}));
 assert.equal(result.shipping_address,'Jl. Mawar No. 3 RT 02');
 assert.equal(result.shipping_recipient,'Ibu Ani');
 assert.equal(Object.keys(result).length,5);
 assert.match(src,/\.\.\.shipping,student_name/);
 assert.match(src,/mode==='general'\)\{try\{shipping=readGeneralShipping/);
});

test('data wajib untuk alamat umum, tetapi patokan bisa dikosongkan',()=>{
 const parsed=readGeneralShipping(fakeForm({...valid,shipping_landmark:''}));
 assert.equal(parsed.shipping_landmark,'');
 for(const key of ['shipping_recipient','shipping_address','shipping_area','shipping_city']){
  assert.throws(()=>readGeneralShipping(fakeForm({...valid,[key]:'  '})),/wajib diisi/);
 }
 assert.throws(()=>readGeneralShipping(fakeForm({...valid,shipping_city:'x'.repeat(121)})),/maksimal/);
 assert.throws(()=>readGeneralShipping(fakeForm({...valid,shipping_landmark:'x'.repeat(201)})),/maksimal/);
});

test('pesan WhatsApp umum berisi alamat dan info ongkir, tidak ada alamat pada pesan santri',()=>{
 const text=generalShippingWhatsApp(valid);
 for (const v of Object.values(valid)) assert.ok(text.includes(v));
 assert.match(text,/Ongkos kirim belum termasuk/);
 assert.match(src,/\+generalShippingWhatsApp\(shipping\)/);
 assert.match(src,/mode==='general'\?'\\n\*Belum termasuk ongkos kirim\.\*'/);
 assert.match(src,/KIRIMAN SANTRI/);
});

test('alur santri dan umum punya URL tersendiri, beranda tetap tersedia',()=>{
 assert.match(src,/\/santri/);
 assert.match(src,/\/belanja-umum/);
 assert.match(src,/setMode\(nextMode\)/);
 assert.match(src,/routeMode\(\)\?'stores':'home'/);
 assert.match(src,/popstate/);
});

test('alamat pengiriman muncul hanya di formulir umum',()=>{
 assert.match(src,/mode==='general'&&<GeneralShippingFields\/>/);
 assert.match(shippingComponent,/name="shipping_recipient" required/);
 assert.match(shippingComponent,/name="shipping_address" required/);
 assert.match(shippingComponent,/name="shipping_city" required/);
 assert.match(shippingComponent,/Ongkos kirim belum termasuk/);
});

test('checkout umum dari keranjang tersimpan memakai kasir toko barang, bukan hanya navigasi toko',()=>{
 assert.match(src,/generalCheckoutStore=db\.stores\.find\(s=>s\.id===rows\[0\]\?\.p\.storeId\)/);
 assert.match(src,/waNumber\(generalCheckoutStore\?\.wa\)/);
});

test('migration menyimpan alamat dan ongkir tidak dibebankan otomatis',()=>{
 assert.match(migration,/ADD COLUMN IF NOT EXISTS shipping_recipient text/);
 assert.match(migration,/ADD COLUMN IF NOT EXISTS shipping_address text/);
 assert.match(migration,/IF v_mode='general' THEN/);
 assert.match(migration,/IF v_mode='general' THEN\s+UPDATE public\.orders SET/);
 assert.doesNotMatch(migration,/SET total_estimate/);
 assert.match(migration,/SECURITY DEFINER/);
 assert.match(migration,/SET search_path = ''/);
 assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.create_checkout_v33\(jsonb\) TO anon, authenticated/);
 assert.match(migration,/v_result := public\.create_checkout_v327\(p_order\)/);
 assert.match(src,/supabase\.rpc\('create_checkout_v33'/);
});

test('duplicate checkout tidak mengubah alamat tersimpan dan mengembalikan error bila berbeda',()=>{
 assert.match(migration,/IF v_duplicate THEN/);
 assert.match(migration,/shipping_address IS DISTINCT FROM v_address/);
 assert.match(migration,/jangan membuat pesanan baru/);
 assert.match(migration,/WHERE id=v_order_id AND checkout_token=v_token/);
});

test('admin dapat melihat alamat dan ekspor tetap menyamarkan alamat secara default',()=>{
 assert.match(src,/adminShippingSummary/);
 assert.match(src,/revealPersonal\?<span>/);
 assert.match(src,/includePersonalCsv\?o\.shipping_address:'\[disamarkan\]'/);
 assert.match(src,/includePersonalCsv\?o\.shipping_recipient:'\[disamarkan\]'/);
});


test('URL khusus /santri dan /umum tidak mengarahkan pengunjung kembali ke pemilih layanan',()=>{
 assert.match(src,/routeMode=\(\)=>activeRoute\(\)==='\/santri'\?'student':\['\/umum','\/belanja-umum'\]/);
 assert.match(src,/nextMode==='student'\?'\/santri':'\/umum'/);
 assert.match(src,/function navigateHome\(\)\{const lane=routeMode\(\)/);
 assert.match(src,/setPage\(lane\?'stores':'home'\)/);
 assert.match(src,/function backToShop\(\)\{if\(page==='stores'\)return/);
 assert.doesNotMatch(src,/Pilih layanan<\/button><section className="storeBanner"/);
 assert.match(src,/page==='store'&&showQuickBack/);
 assert.match(src,/className="laneGuideShortcut"/);
});

test('tutorial empat langkah menyesuaikan bahasa dengan katalog saat ini',()=>{
 assert.match(src,/mode==='student'\?'Periksa keranjang, isi nama santri/);
 assert.match(src,/mode==='general'\?'Periksa keranjang dan isi nama penerima/);
 assert.match(src,/if\(!configured\|\|!loaded\|\|admin\|\|guideAutoCheckedRef\.current\)return/);
});
