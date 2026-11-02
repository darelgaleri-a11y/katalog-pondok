import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase-v32.3-admin-search.sql',import.meta.url),'utf8');
test('admin search memakai RPC dan tidak membatasi 200 pesanan terbaru',()=>{
 assert.match(js,/supabase\.rpc\('admin_find_orders_v323'/);
 assert.match(js,/ORDERS_PAGE_SIZE=50/);
 assert.doesNotMatch(js,/\.limit\(200\)/);
});
test('query server mendukung filter tanggal WIB, mode, status, dan pencarian',()=>{
 for(const term of ['p_day date','Asia/Jakarta','p_mode text','p_status text','p_search text','o.customer_name','o.student_name','o.items::text'])assert.ok(sql.includes(term),`missing ${term}`);
 assert.match(js,/type="date" value=\{orderDay\}/);
});
test('fungsi backend menolak bukan admin dan tidak terbuka untuk anon',()=>{
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/FROM public\.admin_users/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.admin_find_orders_v323/);
 assert.match(sql,/FROM PUBLIC, anon, authenticated/);
 assert.match(sql,/TO authenticated/);
});
test('katalog pelanggan tidak membuka channel Realtime',()=>{
 assert.match(js,/!isAdminUser\|\|!admin\)return/);
 assert.match(js,/catalog-admin-changes-v323/);
 assert.match(js,/visibilitychange/);
});
test('token checkout lama aman untuk retry jika jaringan gagal',()=>{
 assert.match(js,/getOrCreateCheckoutToken\(checkoutTokenRef\.current\)/);
 assert.match(js,/Belum bisa dipastikan apakah pesanan tercatat/);
 assert.match(js,/console\.warn\('\[Katalog Darel\] checkout error'/);
 assert.match(js,/refreshCatalog\(\)\.catch\(\(\)=>\{\}\)/);
});
test('UI pelanggan tetap tanpa lacak pesanan dan laporan serah-terima',()=>{
 assert.match(js,/Fitur lacak pesanan tidak digunakan lagi/);
 assert.match(js,/Pencatatan serah-terima melalui aplikasi tidak diwajibkan lagi/);
 assert.match(js,/Pesan Lewat WhatsApp|Buka WhatsApp|WhatsApp kasir/);
});
