import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getOrCreateCheckoutClientRef} from '../src/checkoutClientRef.js';
const js=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase-v32.7-checkout-tanpa-wa.sql',import.meta.url),'utf8');
const makeStorage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}};
const cryptoStub={randomUUID:()=> '12345678-1234-4123-8123-123456789abc'};
test('browser membuat dan memakai ulang pengenal acak secara anonim',()=>{
 const storage=makeStorage();
 assert.equal(getOrCreateCheckoutClientRef(storage,cryptoStub),cryptoStub.randomUUID());
 assert.equal(getOrCreateCheckoutClientRef(storage,{}),cryptoStub.randomUUID());
});
test('pengenal browser tidak boleh fallback ke angka acak tidak aman',()=>{
 assert.throws(()=>getOrCreateCheckoutClientRef(makeStorage(),{}),/Browser tidak dapat menyimpan/);
});
test('WA pemesan dihapus dari form dan payload, tetapi nama santri tetap wajib',()=>{
 assert.doesNotMatch(js,/<input name="phone"/);
 assert.doesNotMatch(js,/customer_phone:phone/);
 assert.match(js,/name="student" required/);
 assert.match(js,/supabase\.rpc\('create_checkout_v33'/);
 assert.match(js,/client_ref:clientRef/);
});
test('Checkout hanya transfer dan nomor rekening masuk pesan WhatsApp',()=>{
 assert.doesNotMatch(js,/<option>QRIS<\/option>/);
 assert.match(js,/pay='Transfer bank'/);
 assert.match(js,/\*REKENING TRANSFER\*/);
 assert.match(js,/bankInfo=transferInfo\(gender==='male'\?db\.settings\.malePayment:db\.settings\.femalePayment\)/);
 assert.match(js,/bankInfo=transferInfo\(generalCheckoutStore\?\.paymentInfo\)/);
 assert.match(js,/Nomor rekening belum diatur admin/);
});
test('Admin dapat mengisi bank, nomor rekening, nama pemilik rekening',()=>{
 assert.match(js,/Rekening transfer putra \(bank, nomor rekening, atas nama\)/);
 assert.match(js,/Rekening transfer putri \(bank, nomor rekening, atas nama\)/);
 assert.match(js,/Rekening transfer toko \(bank, nomor rekening, atas nama\)/);
});
test('SQL mempertahankan fungsi checkout lama dan reservasi stok',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.create_checkout_v327\(p_order jsonb\)/);
 assert.match(sql,/public\.create_checkout_v6\(/);
 assert.match(sql,/customer_phone=NULL, checkout_client_ref=v_client_ref/);
 assert.match(sql,/ALTER TABLE public\.orders ALTER COLUMN customer_phone DROP NOT NULL/);
 assert.doesNotMatch(sql,/DROP TABLE|TRUNCATE/i);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.create_checkout_v327\(jsonb\) TO anon, authenticated/);
});
test('SQL mempertahankan cek token duplicate dan membatasi pesanan per browser',()=>{
 assert.match(sql,/WHERE o\.checkout_token=v_token/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/o\.checkout_client_ref=v_client_ref/);
 assert.match(sql,/v_recent>=3/);
 assert.match(sql,/pg_catalog\.mod/);
});
