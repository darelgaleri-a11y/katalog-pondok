import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {groupProducts, validateVariants, makeVariantProducts, variantDisplayName} from '../src/productVariants.js';
const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const rpc=readFileSync(new URL('../supabase-v7-stock-history.sql',import.meta.url),'utf8');
const save=readFileSync(new URL('../supabase-v10-safe-catalog.sql',import.meta.url),'utf8');

test('setiap variasi punya ID produk terpisah dan stok sendiri',()=>{
 const products=makeVariantProducts({groupId:'grup-1',baseName:'Baju Santri',storeId:'t1',category:'Baju',audience:'both',image:'',variants:[{size:'M',color:'Hitam',price:60000,stock:3},{size:'L',color:'Hitam',price:65000,stock:0}],generateId:(()=>{let n=0;return()=>`id-${++n}`})()});
 assert.equal(products.length,2);
 assert.notEqual(products[0].id,products[1].id);
 assert.equal(products[0].stock,3);assert.equal(products[1].stock,0);
 assert.equal(products[0].price,60000);assert.equal(products[1].price,65000);
 assert.equal(products[0].name,'Baju Santri — Ukuran M / Warna Hitam');
 assert.equal(products[1].name,'Baju Santri — Ukuran L / Warna Hitam');
 assert.equal(groupProducts(products).length,1);
});

test('produk tanpa variasi tidak berubah dalam tampilan',()=>{
 const groups=groupProducts([{id:'a',name:'Sabun',price:2000,stock:8},{id:'b',name:'Buku',price:3000,stock:9}]);
 assert.equal(groups.length,2);assert.equal(groups[0].representative.name,'Sabun');
});

test('ukuran/warna dobel dengan beda huruf kapital ditolak',()=>{
 assert.match(validateVariants([{size:'M',color:'Hitam',price:1000,stock:1},{size:'m',color:'hitam',price:1000,stock:1}]),/sama/);
});

test('setiap variasi wajib punya ukuran atau warna',()=>{
 assert.match(validateVariants([{size:'',color:'',price:1000,stock:1}]),/harus memiliki/);
});

test('harga dan stok negatif, pecahan, atau melampaui batas ditolak',()=>{
 for(const row of [{size:'L',price:1000,stock:-1},{size:'L',price:-1,stock:1},{size:'L',price:1000.1,stock:1},{size:'L',price:1000,stock:0.2}]) assert.ok(validateVariants([row]));
});

test('variasi minimal 1 dan maksimal 50',()=>{
 assert.ok(validateVariants([]));assert.ok(validateVariants(Array.from({length:51},(_,i)=>({size:String(i),color:'',price:1000,stock:0}))));
});

test('nama variasi ikut ada di pesan WA karena server membaca product_name resmi',()=>{
 assert.match(main,/product_id:p\.id,quantity:qty/);
 assert.match(main,/x\.product_name/);
 assert.match(rpc,/v_item->>'product_id'/);
});

test('stok tiap ID variasi dipotong/dikembalikan oleh transaksi lama',()=>{
 assert.match(rpc,/v_id := v_item->>'product_id'/);
 assert.match(rpc,/v_stock-v_qty/);
 assert.match(rpc,/v_current\+v_qty/);
});

test('stok tidak ditimpa saat admin autosave katalog',()=>{
 assert.match(save,/v_prior->>'stock'/);
 assert.match(main,/set_product_stock_v10/);
});

test('pilihan variasi wajib sebelum tombol beli aktif',()=>{
 const card=readFileSync(new URL('../src/VariantProductCard.jsx',import.meta.url),'utf8');
 assert.match(card,/value=\{selectedId\}/);
 assert.match(card,/disabled=\{!selected\|\|selected.stock<=0\}/);
 assert.match(card,/onAdd\(selected\)/);
});

test('variasi lama tidak dihapus dari editor admin',()=>{
 const editor=readFileSync(new URL('../src/VariantEditor.jsx',import.meta.url),'utf8');
 assert.match(editor,/!row.id&&rows.length>1/);
 assert.match(main,/Variasi yang sudah tersimpan tidak boleh dihapus/);
});

test('produk tanpa variasi masih bisa ditambahkan ke keranjang seperti sebelumnya',()=>{
 assert.match(main,/addToCart\(p\)/);
});

test('format harga varian dengan ukuran saja atau warna saja',()=>{
 assert.equal(variantDisplayName('Sarung','XL',''),'Sarung — Ukuran XL');
 assert.equal(variantDisplayName('Jilbab','','Hitam'),'Jilbab — Warna Hitam');
});

test('penyimpanan variasi memakai RPC admin, bukan menunggu autosave',()=>{
 assert.match(main,/rpc\('save_catalog_v10',\{p_data:updatedCatalog\}\)/);
 assert.match(main,/supabase\.from\('catalog_state'\)\.select\('data'\)/);
});

test('harga dan stok diverifikasi server lewat ID produk fisik per variasi',()=>{
 const original=readFileSync(new URL('../supabase-v6-secure-checkout.sql',import.meta.url),'utf8');
 assert.match(original,/v_product->>'price'/);
 assert.match(original,/v_product->>'stock'/);
 assert.match(original,/v_req->>'product_id'/);
});
