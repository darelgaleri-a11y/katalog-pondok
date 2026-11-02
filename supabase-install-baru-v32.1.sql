-- PEMASANGAN BARU KATALOG MULTI-TOKO V32.1 - Supabase kosong saja.
-- Sumber: SQL asli V4.1 sampai V31 dari paket V32.1.
-- Jalankan SATU KALI di SQL Editor proyek Supabase BARU 'Rahmani's Project'.
-- JANGAN dijalankan di Supabase yang sudah berisi data / aplikasi lama.
-- SQL ini hanya memasang STRUKTUR, TIDAK memulihkan data toko, produk,
-- pesanan, akun Authentication, atau file foto dari proyek lama.
-- Jika ada error, JANGAN menjalankan ulang tanpa memeriksa errornya.
-- Eksekusi dalam satu transaksi: jika terjadi kegagalan, migrasi di-rollback.

BEGIN;

-- Pemeriksaan pengaman agar tidak menimpa database yang sudah diisi.
DO $fresh_guard$
BEGIN
  IF to_regclass('public.catalog_state') IS NOT NULL
     OR to_regclass('public.orders') IS NOT NULL
     OR to_regclass('public.admin_users') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: Database sudah memiliki tabel Katalog. File ini hanya untuk proyek BARU KOSONG. Jangan lanjutkan.';
  END IF;
END
$fresh_guard$;



-- ========== LANGKAH 01 / 20 : supabase-setup.sql ==========
-- V4.1: dapat dijalankan ulang; tidak menghapus data toko, produk, atau admin.
-- Jalankan di Supabase SQL Editor (proyek yang sama).
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admin_users enable row level security;
drop policy if exists "admin can see own role" on public.admin_users;
create policy "admin can see own role" on public.admin_users for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.catalog_state (
  id int primary key check (id = 1),
  data jsonb not null default '{"stores":[],"products":[],"settings":{"maleWa":"","femaleWa":"","malePayment":"","femalePayment":"","deliveryDays":[2,5]}}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.catalog_state enable row level security;
drop policy if exists "public read catalog" on public.catalog_state;
create policy "public read catalog" on public.catalog_state for select to anon, authenticated using (true);
drop policy if exists "admin modify catalog" on public.catalog_state;
create policy "admin modify catalog" on public.catalog_state for update to authenticated
using (exists(select 1 from public.admin_users where user_id=(select auth.uid())))
with check (exists(select 1 from public.admin_users where user_id=(select auth.uid())));
insert into public.catalog_state(id) values (1) on conflict (id) do nothing;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;
drop policy if exists "public read product images" on storage.objects;
create policy "public read product images" on storage.objects for select to anon,authenticated using (bucket_id='product-images');
drop policy if exists "admin upload product images" on storage.objects;
create policy "admin upload product images" on storage.objects for insert to authenticated
with check (bucket_id='product-images' and exists(select 1 from public.admin_users where user_id=(select auth.uid())));

-- Agar perubahan katalog dapat disiarkan ke perangkat lain.
-- Realtime memerlukan tabel dalam publikasi supabase_realtime.
do $$ begin
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='catalog_state') then
  alter publication supabase_realtime add table public.catalog_state;
 end if;
end $$;

-- SETELAH membuat akun admin di Authentication > Users, jalankan sekali,
-- mengganti UUID berikut dengan ID pengguna yang sesungguhnya:
-- insert into public.admin_users(user_id) values ('UUID-ADMIN-DARI-AUTH-USERS');


-- ========== LANGKAH 02 / 20 : supabase-v5-orders.sql ==========
-- V5: tambahan ke database V4.1, tidak menghapus data lama.
create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 mode text not null check(mode in ('general','student')),
 customer_name text not null check(char_length(customer_name) between 1 and 150),
 customer_phone text not null check(char_length(customer_phone) between 5 and 32),
 student_name text,
 student_room text,
 student_gender text check(student_gender is null or student_gender in ('male','female')),
 delivery_date date,
 payment_method text not null check(payment_method in ('Transfer bank','QRIS')),
 note text,
 cashier_wa text not null,
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 100),
 total_estimate numeric(14,0) not null check(total_estimate>=0),
 status text not null default 'awaiting_confirmation' check(status in ('awaiting_confirmation','confirmed','paid','prepared','completed','cancelled'))
);
create index if not exists orders_created_idx on public.orders(created_at desc);
alter table public.orders enable row level security;
-- Pelanggan hanya boleh membuat pesanan; mereka tidak dapat membaca identitas pelanggan lain.
drop policy if exists "customer create order" on public.orders;
create policy "customer create order" on public.orders for insert to anon,authenticated
with check(status='awaiting_confirmation' and char_length(coalesce(note,''))<=2000);
drop policy if exists "admin read orders" on public.orders;
create policy "admin read orders" on public.orders for select to authenticated
using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
drop policy if exists "admin update orders" on public.orders;
create policy "admin update orders" on public.orders for update to authenticated
using(exists(select 1 from public.admin_users where user_id=(select auth.uid())))
with check(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
-- Kolom yang boleh diubah oleh admin (tidak perlu mengubah harga dan identitas):
revoke update on public.orders from authenticated;
grant update(status) on public.orders to authenticated;
grant select, insert on public.orders to anon, authenticated;
-- Hindari akses publik via SELECT: RLS tetap membatasi hanya admin.


-- ========== LANGKAH 03 / 20 : supabase-v6-secure-checkout.sql ==========
-- V6: jalankan SETELAH SQL V5, pada proyek Supabase yang sama.
-- Backup data sebelum migrasi. Menghindari perubahan yang merusak data lama.
create extension if not exists pgcrypto;
alter table public.orders add column if not exists checkout_token uuid;
create unique index if not exists orders_checkout_token_uq on public.orders(checkout_token) where checkout_token is not null;

-- Transaksi checkout hanya boleh melalui RPC terverifikasi.
drop policy if exists "customer create order" on public.orders;
revoke insert on public.orders from anon, authenticated;
-- Admin masih dapat membaca / mengubah status lewat RLS sebelumnya.

create or replace function public.create_checkout_v6(p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_catalog jsonb;
  v_settings jsonb;
  v_items jsonb := '[]'::jsonb;
  v_req jsonb;
  v_product jsonb;
  v_store jsonb;
  v_qty integer;
  v_price numeric;
  v_total numeric := 0;
  v_store_id text;
  v_first_store text := null;
  v_store_count integer := 0;
  v_id uuid;
  v_token uuid;
  v_mode text;
  v_gender text;
  v_target text;
  v_delivery date;
  v_days jsonb;
  v_name text;
  v_phone text;
  v_student_name text;
  v_room text;
  v_note text;
  v_pay text;
  v_existing public.orders%rowtype;
  v_seen text[] := array[]::text[];
begin
  if p_order is null or jsonb_typeof(p_order) <> 'object' then
    raise exception 'Format pesanan tidak valid';
  end if;
  begin
    v_token := (p_order->>'checkout_token')::uuid;
  exception when others then
    raise exception 'Token checkout tidak valid';
  end;
  if v_token is null then raise exception 'Token checkout wajib diisi'; end if;

  -- Transaksi yang memakai token sama dikunci agar checkout ganda tidak membuat dua pesanan.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_token::text, 0));
  select * into v_existing from public.orders where checkout_token = v_token;
  if found then
    return jsonb_build_object('id',v_existing.id,'total',v_existing.total_estimate,
      'cashier_wa',v_existing.cashier_wa,'items',v_existing.items,
      'duplicate',true,'mode',v_existing.mode);
  end if;

  v_mode := p_order->>'mode';
  v_name := btrim(coalesce(p_order->>'customer_name',''));
  v_phone := btrim(coalesce(p_order->>'customer_phone',''));
  v_student_name := btrim(coalesce(p_order->>'student_name',''));
  v_room := btrim(coalesce(p_order->>'student_room',''));
  v_gender := p_order->>'student_gender';
  v_pay := p_order->>'payment_method';
  v_note := coalesce(p_order->>'note','');
  if v_mode not in ('general','student') or length(v_name) not between 1 and 150
     or length(v_phone) not between 5 and 32 or length(v_note)>2000
     or v_pay not in ('Transfer bank','QRIS') then
    raise exception 'Data pemesan atau pembayaran tidak valid';
  end if;
  if jsonb_typeof(p_order->'items') is distinct from 'array' or
     jsonb_array_length(p_order->'items') not between 1 and 100 then
    raise exception 'Keranjang harus berisi 1 sampai 100 produk';
  end if;

  -- Kunci baris katalog untuk membaca harga dan stok konsisten dalam checkout.
  select data into v_catalog from public.catalog_state where id=1 for update;
  if v_catalog is null then raise exception 'Katalog belum tersedia'; end if;
  v_settings := coalesce(v_catalog->'settings','{}'::jsonb);

  if v_mode = 'student' then
    if v_gender not in ('male','female') or length(v_student_name) not between 1 and 150
        or length(v_room) not between 1 and 150 then
      raise exception 'Identitas santri tidak lengkap';
    end if;
    begin
      v_delivery := (p_order->>'delivery_date')::date;
    exception when others then
      raise exception 'Tanggal penyerahan tidak valid';
    end;
    if v_delivery is null or v_delivery < (now() at time zone 'Asia/Jakarta')::date
       or v_delivery > (now() at time zone 'Asia/Jakarta')::date+90 then
      raise exception 'Tanggal penyerahan di luar rentang yang diizinkan';
    end if;
    v_days := coalesce(v_settings->'deliveryDays','[2,5]'::jsonb);
    if not (v_days @> jsonb_build_array(extract(dow from v_delivery)::integer)) then
      raise exception 'Tanggal penyerahan tidak sesuai jadwal pondok';
    end if;
    v_target := case when v_gender='male' then v_settings->>'maleWa' else v_settings->>'femaleWa' end;
  else
    v_gender := null;
    v_student_name := null;
    v_room := null;
    v_delivery := null;
  end if;

  for v_req in select value from jsonb_array_elements(p_order->'items') loop
    if jsonb_typeof(v_req) <> 'object' then raise exception 'Baris keranjang tidak valid'; end if;
    if v_req->>'product_id' is null or v_req->>'product_id' = '' then
      raise exception 'ID barang wajib diisi'; end if;
    if (v_req->>'product_id')=any(v_seen) then raise exception 'Produk tidak boleh berulang'; end if;
    v_seen := array_append(v_seen,v_req->>'product_id');
    begin
      v_qty := (v_req->>'quantity')::integer;
    exception when others then raise exception 'Jumlah barang tidak valid'; end;
    if v_qty is null or v_qty<1 or v_qty>100 then raise exception 'Jumlah barang harus 1 sampai 100'; end if;
    select value into v_product from jsonb_array_elements(coalesce(v_catalog->'products','[]'::jsonb))
      where value->>'id'=v_req->>'product_id' limit 1;
    if v_product is null then raise exception 'Produk tidak ditemukan / sudah dihapus'; end if;
    v_store_id := v_product->>'storeId';
    select value into v_store from jsonb_array_elements(coalesce(v_catalog->'stores','[]'::jsonb))
      where value->>'id'=v_store_id limit 1;
    if v_store is null or coalesce((v_store->>'active')::boolean,false)=false then
      raise exception 'Toko tidak aktif'; end if;
    if coalesce(v_product->>'audience','both') not in ('both',v_mode) then
      raise exception 'Produk tidak tersedia untuk layanan yang dipilih'; end if;
    if coalesce((v_product->>'stock')::integer,0)<v_qty then
      raise exception 'Stok tidak cukup untuk %', v_product->>'name'; end if;
    v_price := (v_product->>'price')::numeric;
    if v_price is null or v_price<0 or v_price<>trunc(v_price) or v_price>100000000000 then
      raise exception 'Harga produk tidak valid'; end if;
    if v_first_store is null then v_first_store := v_store_id; end if;
    if v_mode='general' and v_first_store<>v_store_id then
      raise exception 'Checkout umum hanya boleh dari satu toko'; end if;
    if v_mode='general' then v_target := v_store->>'wa'; end if;
    v_total := v_total+(v_price*v_qty);
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'product_id',v_product->>'id','store_id',v_store_id,
      'store_name',v_store->>'name','product_name',v_product->>'name',
      'quantity',v_qty,'unit_price',v_price,'subtotal',v_price*v_qty));
    v_product := null;
    v_store := null;
  end loop;
  v_target := regexp_replace(coalesce(v_target,''),'[^0-9]','','g');
  if left(v_target,1)='0' then v_target:='62'||substr(v_target,2); end if;
  if v_target !~ '^[0-9]{10,15}$' then raise exception 'Nomor kasir belum valid'; end if;

  insert into public.orders (
    mode,customer_name,customer_phone,student_name,student_room,student_gender,
    delivery_date,payment_method,note,cashier_wa,items,total_estimate,checkout_token
  ) values (
    v_mode,v_name,v_phone,v_student_name,v_room,v_gender,v_delivery,
    v_pay,v_note,v_target,v_items,v_total,v_token
  ) returning id into v_id;

  return jsonb_build_object('id',v_id,'total',v_total,'cashier_wa',v_target,
    'items',v_items,'duplicate',false,'mode',v_mode);
end;
$$;
revoke all on function public.create_checkout_v6(jsonb) from public;
grant execute on function public.create_checkout_v6(jsonb) to anon, authenticated;
notify pgrst, 'reload schema';


-- ========== LANGKAH 04 / 20 : supabase-v7-stock-history.sql ==========
-- V7: jalankan SESUDAH V6. Backup database lebih dulu.
-- Migrasi tidak mengurangi stok pesanan lama. Berlaku untuk checkout baru sesudah V7.
create table if not exists public.order_status_history (
 id bigint generated always as identity primary key,
 order_id uuid not null references public.orders(id) on delete cascade,
 actor_id uuid,
 old_status text,
 new_status text not null,
 created_at timestamptz not null default now()
);
create index if not exists order_history_order_idx on public.order_status_history(order_id,created_at desc);
alter table public.order_status_history enable row level security;
drop policy if exists "admin read order history" on public.order_status_history;
create policy "admin read order history" on public.order_status_history for select to authenticated
using (exists(select 1 from public.admin_users where user_id=(select auth.uid())));
revoke all on public.order_status_history from anon,authenticated;
grant select on public.order_status_history to authenticated;

alter table public.orders add column if not exists stock_reserved boolean not null default false;
-- V5 allowed direct update(status). V7 restricts to RPC so audit and restocking cannot be skipped.
revoke update on public.orders from anon,authenticated;
drop policy if exists "admin update orders" on public.orders;

-- Rename original V6 implementation once and place a guarded wrapper at its public RPC name.
do $$ begin
 if to_regprocedure('public.create_checkout_v6_original(jsonb)') is null then
   alter function public.create_checkout_v6(jsonb) rename to create_checkout_v6_original;
 end if;
end $$;
revoke all on function public.create_checkout_v6_original(jsonb) from public,anon,authenticated;

create or replace function public.create_checkout_v6(p_order jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_result jsonb;
 v_catalog jsonb;
 v_products jsonb;
 v_item jsonb;
 v_product jsonb;
 v_id text;
 v_qty integer;
 v_stock integer;
 v_order_id uuid;
 v_reserved boolean;
begin
 -- Serialisasi checkout, termasuk validasi dalam V6; mencegah oversell.
 perform 1 from public.catalog_state where id=1 for update;
 v_result := public.create_checkout_v6_original(p_order);
 v_order_id := (v_result->>'id')::uuid;
 select stock_reserved into v_reserved from public.orders where id=v_order_id for update;
 if coalesce(v_reserved,false) then return v_result; end if;
 -- Stok hanya terpotong sekali, semua item dalam satu transaksi.
 select data into v_catalog from public.catalog_state where id=1;
 v_products := v_catalog->'products';
 for v_item in select value from pg_catalog.jsonb_array_elements(v_result->'items') loop
   v_id := v_item->>'product_id';
   v_qty := (v_item->>'quantity')::integer;
   select value into v_product from pg_catalog.jsonb_array_elements(v_products) where value->>'id'=v_id limit 1;
   if v_product is null then raise exception 'Produk % hilang, checkout dibatalkan',v_id; end if;
   v_stock := (v_product->>'stock')::integer;
   if v_stock < v_qty then raise exception 'Stok tidak cukup untuk %',v_product->>'name'; end if;
   select pg_catalog.jsonb_agg(case when value->>'id'=v_id
     then pg_catalog.jsonb_set(value,'{stock}',pg_catalog.to_jsonb(v_stock-v_qty),true)
     else value end) into v_products from pg_catalog.jsonb_array_elements(v_products);
 end loop;
 update public.catalog_state set data=pg_catalog.jsonb_set(v_catalog,'{products}',v_products,true) where id=1;
 update public.orders set stock_reserved=true where id=v_order_id;
 return v_result;
end $$;
revoke all on function public.create_checkout_v6(jsonb) from public;
grant execute on function public.create_checkout_v6(jsonb) to anon,authenticated;

-- Perubahan status harus melalui fungsi berikut, dengan izin admin diperiksa di server.
create or replace function public.update_order_status_v7(p_order_id uuid,p_status text)
returns public.orders language plpgsql security definer set search_path = '' as $$
declare
 v_order public.orders%rowtype;
 v_cat jsonb;
 v_products jsonb;
 v_item jsonb;
 v_id text;
 v_qty integer;
 v_current integer;
 v_row public.orders%rowtype;
begin
 if (select auth.uid()) is null or not exists(
    select 1 from public.admin_users where user_id=(select auth.uid())) then
    raise exception 'Hanya admin utama yang boleh mengubah status';
 end if;
 if p_status not in ('awaiting_confirmation','confirmed','paid','prepared','completed','cancelled') then
   raise exception 'Status tidak dikenal'; end if;
 -- Urutan lock sama: katalog lalu pesanan.
 perform 1 from public.catalog_state where id=1 for update;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found then raise exception 'Pesanan tidak ditemukan'; end if;
 if v_order.status=p_status then return v_order; end if;
 if v_order.status='cancelled' then raise exception 'Pesanan dibatalkan tidak boleh diaktifkan kembali. Buat pesanan baru'; end if;
 if v_order.status='completed' then raise exception 'Pesanan selesai tidak boleh diubah'; end if;
 if p_status='cancelled' and v_order.stock_reserved then
   select data into v_cat from public.catalog_state where id=1;
   v_products := v_cat->'products';
   for v_item in select value from pg_catalog.jsonb_array_elements(v_order.items) loop
     v_id := v_item->>'product_id';
     v_qty := (v_item->>'quantity')::integer;
     -- Produk mungkin telah dihapus; lewati, jangan buat produk baru secara diam-diam.
     if exists(select 1 from pg_catalog.jsonb_array_elements(v_products) where value->>'id'=v_id) then
       select (value->>'stock')::integer into v_current
       from pg_catalog.jsonb_array_elements(v_products) where value->>'id'=v_id limit 1;
       select pg_catalog.jsonb_agg(case when value->>'id'=v_id
         then pg_catalog.jsonb_set(value,'{stock}',pg_catalog.to_jsonb(v_current+v_qty),true)
         else value end) into v_products from pg_catalog.jsonb_array_elements(v_products);
     end if;
   end loop;
   update public.catalog_state set data=pg_catalog.jsonb_set(v_cat,'{products}',v_products,true) where id=1;
 end if;
 update public.orders set status=p_status,
   stock_reserved=case when p_status='cancelled' then false else stock_reserved end
   where id=p_order_id returning * into v_row;
 insert into public.order_status_history(order_id,actor_id,old_status,new_status)
 values(p_order_id,(select auth.uid()),v_order.status,p_status);
 return v_row;
end $$;
revoke all on function public.update_order_status_v7(uuid,text) from public;
grant execute on function public.update_order_status_v7(uuid,text) to authenticated;
notify pgrst,'reload schema';


-- ========== LANGKAH 05 / 20 : supabase-v8-expiry.sql ==========
-- V8: instal SESUDAH V7. Jalankan sekali di SQL Editor Supabase; aman jika diulang.
-- Pesanan yang belum dikonfirmasi selama 2 jam dapat dibatalkan otomatis/manual.
-- Tidak mengubah pesanan confirmed/paid/prepared/completed, atau pesanan lama tanpa reservasi.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS expired_at timestamptz;
CREATE INDEX IF NOT EXISTS orders_pending_expiration_idx
 ON public.orders (created_at) WHERE status='awaiting_confirmation' AND stock_reserved=true;

-- Implementasi internal. Tidak boleh dipanggil langsung melalui API anon/authenticated.
CREATE OR REPLACE FUNCTION public.expire_pending_orders_v8_internal(p_limit integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_order public.orders%ROWTYPE;
 v_catalog jsonb;
 v_products jsonb;
 v_item jsonb;
 v_pid text;
 v_quantity integer;
 v_stock integer;
 v_count integer := 0;
BEGIN
 IF p_limit IS NULL OR p_limit < 1 OR p_limit > 500 THEN
   RAISE EXCEPTION 'Batas pemeriksaan harus 1 sampai 500';
 END IF;
 -- Selalu lock katalog lebih dulu, sama seperti checkout V7 dan perubahan status.
 SELECT data INTO v_catalog FROM public.catalog_state WHERE id=1 FOR UPDATE;
 IF v_catalog IS NULL THEN RAISE EXCEPTION 'Katalog belum tersedia'; END IF;
 v_products := COALESCE(v_catalog->'products','[]'::jsonb);
 FOR v_order IN
   SELECT * FROM public.orders
   WHERE status='awaiting_confirmation' AND stock_reserved=true
     AND created_at <= now() - interval '2 hours'
   ORDER BY created_at ASC LIMIT p_limit FOR UPDATE
 LOOP
   FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(v_order.items) LOOP
     v_pid := v_item->>'product_id';
     v_quantity := (v_item->>'quantity')::integer;
     IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(v_products) WHERE value->>'id'=v_pid) THEN
       SELECT (value->>'stock')::integer INTO v_stock
       FROM pg_catalog.jsonb_array_elements(v_products) WHERE value->>'id'=v_pid LIMIT 1;
       SELECT pg_catalog.jsonb_agg(
         CASE WHEN value->>'id'=v_pid THEN
           pg_catalog.jsonb_set(value,'{stock}',pg_catalog.to_jsonb(v_stock+v_quantity),true)
         ELSE value END
       ) INTO v_products FROM pg_catalog.jsonb_array_elements(v_products);
     END IF;
   END LOOP;
   UPDATE public.orders SET status='cancelled',stock_reserved=false,expired_at=now()
     WHERE id=v_order.id;
   INSERT INTO public.order_status_history(order_id,actor_id,old_status,new_status)
     VALUES(v_order.id,NULL,'awaiting_confirmation','cancelled');
   v_count := v_count + 1;
 END LOOP;
 IF v_count>0 THEN
   UPDATE public.catalog_state SET data=pg_catalog.jsonb_set(v_catalog,'{products}',v_products,true)
   WHERE id=1;
 END IF;
 RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.expire_pending_orders_v8_internal(integer) FROM PUBLIC, anon, authenticated;

-- RPC publik hanya untuk admin utama terdaftar.
CREATE OR REPLACE FUNCTION public.expire_pending_orders_v8(p_limit integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT EXISTS
    (SELECT 1 FROM public.admin_users WHERE user_id=(SELECT auth.uid())) THEN
   RAISE EXCEPTION 'Hanya admin utama yang boleh memeriksa reservasi';
 END IF;
 RETURN public.expire_pending_orders_v8_internal(p_limit);
END $$;
REVOKE ALL ON FUNCTION public.expire_pending_orders_v8(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_pending_orders_v8(integer) TO authenticated;
NOTIFY pgrst, 'reload schema';


-- ========== LANGKAH 06 / 20 : supabase-v9-rate-limit.sql ==========
-- V9: Jalankan SETELAH V8 pada proyek Supabase yang sama.
-- Anti-spam sederhana: maksimal 3 pesanan BARU dalam 15 menit per nomor WA pemesan.
-- Tidak memblokir pengulangan token checkout yang sama (idempotensi V6/V7).
-- Ini bukan anti-bot penuh: nomor dapat diganti; sebelum publik, pertimbangkan CAPTCHA/Edge Function.
-- Backup database terlebih dahulu. Skrip aman untuk dijalankan ulang.

DO $$ BEGIN
  IF to_regprocedure('public.create_checkout_v9_previous(jsonb)') IS NULL THEN
    ALTER FUNCTION public.create_checkout_v6(jsonb) RENAME TO create_checkout_v9_previous;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.create_checkout_v9_previous(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_checkout_v6(p_order jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_phone text;
 v_token uuid;
 v_existing public.orders%ROWTYPE;
 v_recent integer;
BEGIN
 IF p_order IS NULL OR jsonb_typeof(p_order) <> 'object' THEN
    RAISE EXCEPTION 'Format checkout tidak valid';
 END IF;
 BEGIN
   v_token := (p_order->>'checkout_token')::uuid;
 EXCEPTION WHEN OTHERS THEN
   RAISE EXCEPTION 'Token checkout tidak valid';
 END;
 IF v_token IS NULL THEN RAISE EXCEPTION 'Token checkout wajib diisi'; END IF;
 -- Pastikan token yang sudah digunakan bisa diulang tanpa mengurangi stok lagi.
 SELECT * INTO v_existing FROM public.orders WHERE checkout_token=v_token;
 IF FOUND THEN RETURN public.create_checkout_v9_previous(p_order); END IF;

 -- Gunakan nomor normalisasi ringan; format tetap diverifikasi oleh RPC V6.
 v_phone := pg_catalog.regexp_replace(coalesce(p_order->>'customer_phone',''),'[^0-9]','','g');
 IF pg_catalog.length(v_phone) NOT BETWEEN 9 AND 16 THEN
   RAISE EXCEPTION 'Nomor WhatsApp pemesan tidak valid';
 END IF;
 -- Lock per nomor, agar permintaan bersamaan dari nomor yang sama tak lolos batas.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('checkout-phone:'||v_phone,0));
 -- Setelah lock, cek ulang token agar permintaan duplikat menunggu dan tidak ditolak.
 SELECT * INTO v_existing FROM public.orders WHERE checkout_token=v_token;
 IF FOUND THEN RETURN public.create_checkout_v9_previous(p_order); END IF;
 SELECT count(*) INTO v_recent FROM public.orders
 WHERE pg_catalog.regexp_replace(coalesce(customer_phone,''),'[^0-9]','','g') = v_phone
   AND created_at >= now() - interval '15 minutes';
 IF v_recent >= 3 THEN
   RAISE EXCEPTION 'Batas 3 pesanan dalam 15 menit untuk nomor ini tercapai. Hubungi kasir bila perlu bantuan.';
 END IF;
 RETURN public.create_checkout_v9_previous(p_order);
END $$;
REVOKE ALL ON FUNCTION public.create_checkout_v6(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_checkout_v6(jsonb) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';


-- ========== LANGKAH 07 / 20 : supabase-v10-safe-catalog.sql ==========
-- V10: Jalankan setelah V9 di proyek Supabase yang sama. Cadangkan database lebih dulu.
-- Menjaga stok checkout V7/V8 agar tidak tertimpa autosave katalog admin.
-- SQL ini tidak memindahkan stok ke tabel terpisah; itu butuh migrasi yang lebih besar.
-- Fungsi admin update menyimpan metadata katalog dan mengambil stock terbaru dari database.

CREATE OR REPLACE FUNCTION public.save_catalog_v10(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_old jsonb;
  v_oldproducts jsonb;
  v_products jsonb;
  v_product jsonb;
  v_prior jsonb;
  v_result jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT EXISTS
   (SELECT 1 FROM public.admin_users WHERE user_id=(SELECT auth.uid())) THEN
    RAISE EXCEPTION 'Hanya admin utama yang dapat menyimpan katalog';
  END IF;
  IF p_data IS NULL OR pg_catalog.jsonb_typeof(p_data) <> 'object'
     OR pg_catalog.jsonb_typeof(p_data->'products') <> 'array'
     OR pg_catalog.jsonb_typeof(p_data->'stores') <> 'array'
     OR pg_catalog.jsonb_typeof(p_data->'settings') <> 'object' THEN
    RAISE EXCEPTION 'Format katalog tidak valid';
  END IF;
  SELECT data INTO v_old FROM public.catalog_state WHERE id=1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Katalog tidak ditemukan'; END IF;
  v_oldproducts := coalesce(v_old->'products','[]'::jsonb);
  v_products := '[]'::jsonb;
  FOR v_product IN SELECT value FROM pg_catalog.jsonb_array_elements(p_data->'products') LOOP
    IF coalesce(v_product->>'id','') = '' THEN RAISE EXCEPTION 'ID produk kosong'; END IF;
    SELECT value INTO v_prior FROM pg_catalog.jsonb_array_elements(v_oldproducts)
      WHERE value->>'id'=v_product->>'id' LIMIT 1;
    IF v_prior IS NOT NULL THEN
      v_product := pg_catalog.jsonb_set(v_product,'{stock}',
        pg_catalog.to_jsonb((v_prior->>'stock')::integer),true);
    ELSE
      IF coalesce(v_product->>'stock','') !~ '^[0-9]+$' THEN
        RAISE EXCEPTION 'Stok produk baru tidak valid';
      END IF;
    END IF;
    v_products := v_products || pg_catalog.jsonb_build_array(v_product);
  END LOOP;
  v_result := pg_catalog.jsonb_set(p_data,'{products}',v_products,true);
  UPDATE public.catalog_state SET data=v_result, updated_at=now() WHERE id=1;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.set_product_stock_v10(p_product_id text,p_new_stock integer)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_catalog jsonb;
 v_products jsonb;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT EXISTS
   (SELECT 1 FROM public.admin_users WHERE user_id=(SELECT auth.uid())) THEN
   RAISE EXCEPTION 'Hanya admin utama yang bisa mengubah stok';
 END IF;
 IF p_product_id IS NULL OR p_product_id='' OR p_new_stock IS NULL OR p_new_stock < 0 THEN
   RAISE EXCEPTION 'ID produk atau stok tidak valid';
 END IF;
 SELECT data INTO v_catalog FROM public.catalog_state WHERE id=1 FOR UPDATE;
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(v_catalog->'products')
   WHERE value->>'id'=p_product_id) THEN
   RAISE EXCEPTION 'Produk tidak ditemukan';
 END IF;
 SELECT pg_catalog.jsonb_agg(CASE WHEN value->>'id'=p_product_id
   THEN pg_catalog.jsonb_set(value,'{stock}',pg_catalog.to_jsonb(p_new_stock),true)
   ELSE value END) INTO v_products
 FROM pg_catalog.jsonb_array_elements(v_catalog->'products');
 UPDATE public.catalog_state SET data=pg_catalog.jsonb_set(v_catalog,'{products}',v_products,true),updated_at=now()
 WHERE id=1;
 RETURN p_new_stock;
END $$;

-- Setelah fungsi siap, hentikan penulisan langsung yang dapat menimpa stok checkout.
REVOKE UPDATE ON public.catalog_state FROM authenticated;
DROP POLICY IF EXISTS "admin modify catalog" ON public.catalog_state;
REVOKE ALL ON FUNCTION public.save_catalog_v10(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.set_product_stock_v10(text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_catalog_v10(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_product_stock_v10(text,integer) TO authenticated;
NOTIFY pgrst, 'reload schema';


-- ========== LANGKAH 08 / 20 : supabase-v18-handovers.sql ==========
-- V18: jalankan sekali setelah V17. Tidak menghapus pesanan lama.
create table if not exists public.student_handovers (
 order_id uuid primary key references public.orders(id) on delete restrict,
 handed_at timestamptz not null default now(),
 officer_name text not null check (char_length(trim(officer_name)) between 1 and 100),
 recorded_by uuid not null references auth.users(id),
 notes text not null default ''
);
alter table public.student_handovers enable row level security;
drop policy if exists "admin read student handovers" on public.student_handovers;
create policy "admin read student handovers" on public.student_handovers
 for select to authenticated using (exists(select 1 from public.admin_users a where a.user_id=(select auth.uid())));
revoke all on public.student_handovers from public,anon,authenticated;
grant select on public.student_handovers to authenticated;

create or replace function public.record_student_handover_v18(p_order_id uuid,p_officer_name text)
returns void language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.admin_users where user_id=(select auth.uid())) then
  raise exception 'Hanya admin utama yang boleh mencatat serah-terima';
 end if;
 if char_length(trim(coalesce(p_officer_name,''))) not between 1 and 100 then
  raise exception 'Nama petugas wajib diisi, maksimal 100 karakter';
 end if;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found or v_order.mode <> 'student' then raise exception 'Pesanan santri tidak ditemukan'; end if;
 if v_order.status not in ('paid','prepared','completed') or v_order.expired_at is not null then
  raise exception 'Penyerahan hanya untuk pesanan yang sudah diverifikasi, bukan batal/kedaluwarsa';
 end if;
 if exists(select 1 from public.student_handovers where order_id=p_order_id) then
  raise exception 'Penyerahan sudah tercatat; tidak boleh dicatat dua kali';
 end if;
 insert into public.student_handovers(order_id,officer_name,recorded_by)
 values(p_order_id,trim(p_officer_name),(select auth.uid()));
end $$;
revoke all on function public.record_student_handover_v18(uuid,text) from public,anon,authenticated;
grant execute on function public.record_student_handover_v18(uuid,text) to authenticated;
notify pgrst, 'reload schema';


-- ========== LANGKAH 09 / 20 : supabase-v19-staff.sql ==========
-- V19: hanya tambah akun petugas dan fungsi terbatas. Jalankan setelah V18.
create table if not exists public.student_staff (
 user_id uuid primary key references auth.users(id) on delete cascade,
 gender text not null check(gender in ('male','female')),
 officer_name text not null check(length(trim(officer_name)) between 1 and 100),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.student_staff enable row level security;
revoke all on public.student_staff from public, anon, authenticated;
-- Tidak membuat policy baca langsung; akses hanya melalui RPC.

create or replace function public.my_staff_profile_v19()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.student_staff%rowtype;
begin
 select * into s from public.student_staff where user_id = (select auth.uid()) and active=true;
 if not found then return null; end if;
 return jsonb_build_object('gender',s.gender,'officer_name',s.officer_name);
end $$;
revoke all on function public.my_staff_profile_v19() from public, anon, authenticated;
grant execute on function public.my_staff_profile_v19() to authenticated;

create or replace function public.staff_orders_v19(p_delivery_date date default null, p_limit integer default 200, p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.student_staff%rowtype; result jsonb;
begin
 select * into s from public.student_staff where user_id=(select auth.uid()) and active=true;
 if not found then raise exception 'Akun bukan petugas aktif'; end if;
 if p_limit not between 1 and 200 or p_offset < 0 then raise exception 'Batas halaman tidak sah'; end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.delivery_date,q.created_at), '[]'::jsonb) into result
 from (
   select o.id,o.delivery_date,o.student_name,o.student_room,o.items,o.status,o.created_at,
          h.handed_at,h.officer_name as handed_by
   from public.orders o
   left join public.student_handovers h on h.order_id=o.id
   where o.mode='student' and o.student_gender=s.gender
     and o.status in ('paid','prepared','completed') and o.expired_at is null
     and (p_delivery_date is null or o.delivery_date=p_delivery_date)
   order by o.delivery_date asc,o.created_at asc,o.id asc
   limit p_limit offset p_offset
 ) q;
 return result;
end $$;
revoke all on function public.staff_orders_v19(date,integer,integer) from public,anon,authenticated;
grant execute on function public.staff_orders_v19(date,integer,integer) to authenticated;

create or replace function public.staff_handover_v19(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.student_staff%rowtype; o public.orders%rowtype;
begin
 select * into s from public.student_staff where user_id=(select auth.uid()) and active=true;
 if not found then raise exception 'Akun bukan petugas aktif'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.mode<>'student' or o.student_gender<>s.gender then
    raise exception 'Pesanan bukan bagian petugas ini'; end if;
 if o.status not in ('paid','prepared','completed') or o.expired_at is not null then
    raise exception 'Pesanan belum diverifikasi atau telah dibatalkan'; end if;
 if exists(select 1 from public.student_handovers where order_id=p_order_id) then
    raise exception 'Serah-terima sudah tercatat'; end if;
 insert into public.student_handovers(order_id, officer_name,recorded_by)
 values(p_order_id,s.officer_name,(select auth.uid()));
end $$;
revoke all on function public.staff_handover_v19(uuid) from public,anon,authenticated;
grant execute on function public.staff_handover_v19(uuid) to authenticated;
notify pgrst, 'reload schema';

-- CARA DAFTAR PETUGAS (jalankan terpisah, setelah membuat akun pada Authentication > Users):
-- insert into public.student_staff(user_id,gender,officer_name)
-- values ('UUID-USER-PETUGAS-DI-SINI','male','Nama Petugas Putra');
-- untuk petugas putri gunakan gender 'female'.


-- ========== LANGKAH 10 / 20 : supabase-v20-receipt.sql ==========
-- V20: bukti penerimaan sederhana. Jalankan SETELAH V19.
-- Tidak menghapus catatan sebelumnya; kolom baru nullable untuk catatan V18/V19.
alter table public.student_handovers
  add column if not exists recipient_name text,
  add column if not exists receipt_method text;

alter table public.student_handovers drop constraint if exists receipt_method_allowed_v20;
alter table public.student_handovers add constraint receipt_method_allowed_v20
  check (receipt_method is null or receipt_method in ('langsung','perwakilan_pondok'));

-- Tutup jalur pencatatan lama oleh petugas: hanya jalur baru yang menyimpan bukti.
revoke execute on function public.staff_handover_v19(uuid) from public, anon, authenticated;

create or replace function public.staff_orders_v19(p_delivery_date date default null, p_limit integer default 200, p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.student_staff%rowtype; result jsonb;
begin
 select * into s from public.student_staff where user_id=(select auth.uid()) and active=true;
 if not found then raise exception 'Akun bukan petugas aktif'; end if;
 if p_limit not between 1 and 200 or p_offset < 0 then raise exception 'Batas halaman tidak sah'; end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.delivery_date,q.created_at), '[]'::jsonb) into result
 from (
   select o.id,o.delivery_date,o.student_name,o.student_room,o.items,o.status,o.created_at,
          h.handed_at,h.officer_name as handed_by,h.recipient_name,h.receipt_method
   from public.orders o
   left join public.student_handovers h on h.order_id=o.id
   where o.mode='student' and o.student_gender=s.gender
     and o.status in ('paid','prepared','completed') and o.expired_at is null
     and (p_delivery_date is null or o.delivery_date=p_delivery_date)
   order by o.delivery_date asc,o.created_at asc,o.id asc
   limit p_limit offset p_offset
 ) q;
 return result;
end $$;
revoke all on function public.staff_orders_v19(date,integer,integer) from public,anon,authenticated;
grant execute on function public.staff_orders_v19(date,integer,integer) to authenticated;

create or replace function public.staff_receipt_v20(
 p_order_id uuid, p_recipient_name text, p_receipt_method text
) returns void language plpgsql security definer set search_path = '' as $$
declare s public.student_staff%rowtype; o public.orders%rowtype;
begin
 select * into s from public.student_staff where user_id=(select auth.uid()) and active=true;
 if not found then raise exception 'Akun bukan petugas aktif'; end if;
 if length(trim(coalesce(p_recipient_name,''))) not between 2 and 100 then
  raise exception 'Nama penerima wajib diisi (2–100 karakter)'; end if;
 if p_receipt_method not in ('langsung','perwakilan_pondok') or p_receipt_method is null then
  raise exception 'Pilih cara konfirmasi penerima'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.mode<>'student' or o.student_gender<>s.gender then
  raise exception 'Pesanan bukan bagian petugas ini'; end if;
 if o.status not in ('paid','prepared','completed') or o.expired_at is not null then
  raise exception 'Pesanan belum diverifikasi atau telah dibatalkan'; end if;
 if exists(select 1 from public.student_handovers where order_id=p_order_id) then
  raise exception 'Serah-terima sudah tercatat'; end if;
 insert into public.student_handovers(order_id,officer_name,recorded_by,recipient_name,receipt_method)
 values(p_order_id,s.officer_name,(select auth.uid()),trim(p_recipient_name),p_receipt_method);
end $$;
revoke all on function public.staff_receipt_v20(uuid,text,text) from public,anon,authenticated;
grant execute on function public.staff_receipt_v20(uuid,text,text) to authenticated;
notify pgrst, 'reload schema';


-- ========== LANGKAH 11 / 20 : supabase-v21-admin-receipts.sql ==========
-- V21: Samakan bukti penerimaan admin dengan petugas V20.
-- Jalankan setelah supabase-v20-receipt.sql. Tidak mengubah data serah-terima lama.
-- Petugas V20 tetap menggunakan staff_receipt_v20.

revoke execute on function public.record_student_handover_v18(uuid,text) from public,anon,authenticated;

create or replace function public.admin_receipt_v21(
 p_order_id uuid, p_officer_name text, p_recipient_name text, p_receipt_method text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype;
begin
 if (select auth.uid()) is null or not exists(
  select 1 from public.admin_users where user_id=(select auth.uid())
 ) then raise exception 'Hanya admin utama yang dapat mencatat penyerahan'; end if;
 if length(trim(coalesce(p_officer_name,''))) not between 1 and 100 then
  raise exception 'Nama petugas wajib diisi, maksimal 100 karakter'; end if;
 if length(trim(coalesce(p_recipient_name,''))) not between 2 and 100 then
  raise exception 'Nama penerima wajib diisi (2–100 karakter)'; end if;
 if p_receipt_method is null or p_receipt_method not in ('langsung','perwakilan_pondok') then
  raise exception 'Cara penerimaan tidak sah'; end if;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found or v_order.mode <> 'student' then raise exception 'Pesanan santri tidak ditemukan'; end if;
 if v_order.status not in ('paid','prepared','completed') or v_order.expired_at is not null then
  raise exception 'Pesanan belum diverifikasi atau telah dibatalkan/kedaluwarsa'; end if;
 if exists(select 1 from public.student_handovers where order_id=p_order_id) then
  raise exception 'Penyerahan sudah pernah dicatat'; end if;
 insert into public.student_handovers(order_id,officer_name,recorded_by,recipient_name,receipt_method)
 values(p_order_id,trim(p_officer_name),(select auth.uid()),trim(p_recipient_name),p_receipt_method);
end $$;
revoke all on function public.admin_receipt_v21(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_receipt_v21(uuid,text,text,text) to authenticated;
notify pgrst, 'reload schema';


-- ========== LANGKAH 12 / 20 : supabase-v22-tracking.sql ==========
-- V22: fungsi status publik minimal, memerlukan ID penuh DAN kode acak checkout.
-- Jalankan setelah V21. Tidak membuka SELECT publik pada tabel orders.
CREATE OR REPLACE FUNCTION public.track_order_v22(p_order_id uuid, p_access_code uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_order public.orders%ROWTYPE;
BEGIN
  IF p_order_id IS NULL OR p_access_code IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_order FROM public.orders
    WHERE id = p_order_id AND checkout_token = p_access_code;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'status', v_order.status,
    'mode', v_order.mode,
    'delivery_date', CASE WHEN v_order.mode='student' THEN v_order.delivery_date ELSE NULL END,
    'handed_over', CASE WHEN v_order.mode='student' THEN EXISTS(
      SELECT 1 FROM public.student_handovers h WHERE h.order_id=v_order.id
    ) ELSE NULL END,
    'expired', v_order.expired_at IS NOT NULL
  );
END;
$$;
REVOKE ALL ON FUNCTION public.track_order_v22(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_order_v22(uuid,uuid) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';


-- ========== LANGKAH 13 / 20 : supabase-v23-tracking-limit.sql ==========
-- V23: batas percobaan kode pelacakan yang salah PER ID pesanan valid.
-- Jalankan setelah migrasi V22; tidak mengubah orders atau stok.
-- Batas: 8 kegagalan dalam 15 menit. Kode benar tetap dapat mengecek status.
CREATE TABLE IF NOT EXISTS public.tracking_failed_attempts_v23 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tracking_failed_attempts_v23_lookup
  ON public.tracking_failed_attempts_v23(order_id, attempted_at DESC);
ALTER TABLE public.tracking_failed_attempts_v23 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tracking_failed_attempts_v23 FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.track_order_v23(p_order_id uuid, p_access_code uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_failures integer;
BEGIN
  IF p_order_id IS NULL OR p_access_code IS NULL THEN
    RETURN NULL;
  END IF;

  -- Serialize attempts against the same order for accurate counting.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_order_id::text, 23));
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  -- Never create tracking records for random/nonexistent UUIDs.
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Valid code succeeds even after unrelated failed attempts.
  IF v_order.checkout_token = p_access_code THEN
    RETURN jsonb_build_object(
      'status',v_order.status,'mode',v_order.mode,
      'delivery_date',CASE WHEN v_order.mode='student' THEN v_order.delivery_date ELSE NULL END,
      'handed_over',CASE WHEN v_order.mode='student' THEN EXISTS(
        SELECT 1 FROM public.student_handovers h WHERE h.order_id=v_order.id
      ) ELSE NULL END,
      'expired', v_order.expired_at IS NOT NULL
    );
  END IF;

  SELECT count(*) INTO v_failures FROM public.tracking_failed_attempts_v23
    WHERE order_id=p_order_id AND attempted_at > now() - interval '15 minutes';
  IF v_failures >= 8 THEN
    RETURN jsonb_build_object('rate_limited',true);
  END IF;
  INSERT INTO public.tracking_failed_attempts_v23(order_id) VALUES (p_order_id);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.track_order_v23(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_order_v23(uuid,uuid) TO anon,authenticated;
-- Disable the old unrestricted entrypoint, including default PUBLIC permissions.
REVOKE ALL ON FUNCTION public.track_order_v22(uuid,uuid) FROM PUBLIC,anon,authenticated;
NOTIFY pgrst, 'reload schema';

-- Optional maintenance: run periodically in SQL Editor; do not run on every request.
-- DELETE FROM public.tracking_failed_attempts_v23 WHERE attempted_at < now() - interval '2 days';


-- ========== LANGKAH 14 / 20 : supabase-v25-reconciliation.sql ==========
-- V25: tambah catatan rekonsiliasi pembayaran terpisah dari status pesanan.
-- Jalankan setelah migrasi V24. Tidak mengubah data pesanan lama.
create table if not exists public.payment_reconciliations (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete restrict,
 amount numeric(14,0) not null check (amount > 0),
 payment_method text not null check(payment_method in ('Transfer bank','QRIS')),
 reference_no text not null check(char_length(trim(reference_no)) between 3 and 120),
 received_at timestamptz not null,
 notes text not null default '' check(char_length(notes)<=500),
 created_at timestamptz not null default now(),
 recorded_by uuid not null default auth.uid()
);
create index if not exists payment_reconciliations_order_idx on public.payment_reconciliations(order_id);
create unique index if not exists payment_reconciliations_reference_unique on public.payment_reconciliations(payment_method,lower(trim(reference_no)));
alter table public.payment_reconciliations enable row level security;
drop policy if exists "admin read reconciliations" on public.payment_reconciliations;
create policy "admin read reconciliations" on public.payment_reconciliations for select to authenticated
 using (exists(select 1 from public.admin_users a where a.user_id=(select auth.uid())));
revoke all on public.payment_reconciliations from anon, authenticated;
grant select on public.payment_reconciliations to authenticated;
-- Semua penulisan harus melalui RPC; tak ada direct INSERT/UPDATE/DELETE oleh klien.
create or replace function public.record_payment_v25(p_order_id uuid,p_amount numeric,p_method text,p_reference text,p_received_at timestamptz,p_notes text default '')
returns public.payment_reconciliations
language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.orders%rowtype; r public.payment_reconciliations%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from public.admin_users where user_id=auth.uid()) then
   raise exception 'Akses ditolak';
 end if;
 if p_amount is null or p_amount <= 0 or p_amount > 99999999999999 then raise exception 'Nominal tidak valid'; end if;
 if p_method not in ('Transfer bank','QRIS') then raise exception 'Metode tidak valid'; end if;
 if length(trim(coalesce(p_reference,''))) not between 3 and 120 then raise exception 'Referensi harus 3-120 karakter'; end if;
 if p_received_at is null or p_received_at > now() + interval '5 minutes' then raise exception 'Waktu penerimaan tidak valid'; end if;
 if length(coalesce(p_notes,''))>500 then raise exception 'Catatan terlalu panjang'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'Pesanan tidak ditemukan'; end if;
 if o.status='cancelled' or o.expired_at is not null then raise exception 'Pesanan batal/kedaluwarsa tidak dapat direkonsiliasi'; end if;
 insert into public.payment_reconciliations(order_id,amount,payment_method,reference_no,received_at,notes,recorded_by)
 values(p_order_id,p_amount,p_method,trim(p_reference),p_received_at,coalesce(p_notes,''),auth.uid()) returning * into r;
 return r;
end $$;
revoke all on function public.record_payment_v25(uuid,numeric,text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.record_payment_v25(uuid,numeric,text,text,timestamptz,text) to authenticated;


-- ========== LANGKAH 15 / 20 : supabase-v26-cash-corrections.sql ==========
-- V26: Pembatalan catatan pembayaran dengan jejak audit (bukan edit/hapus).
-- Backup database dahulu. Jalankan sesudah V25.
create table if not exists public.payment_voids_v26 (
 id uuid primary key default gen_random_uuid(),
 receipt_id uuid not null unique references public.payment_reconciliations(id) on delete restrict,
 reason text not null check (char_length(trim(reason)) between 10 and 500),
 voided_at timestamptz not null default now(),
 voided_by uuid not null default auth.uid()
);
create index if not exists payment_voids_v26_time_idx on public.payment_voids_v26(voided_at);
alter table public.payment_voids_v26 enable row level security;
drop policy if exists "admin read payment voids v26" on public.payment_voids_v26;
create policy "admin read payment voids v26" on public.payment_voids_v26 for select to authenticated
 using (exists(select 1 from public.admin_users a where a.user_id=(select auth.uid())));
revoke all on public.payment_voids_v26 from public,anon,authenticated;
grant select on public.payment_voids_v26 to authenticated;
create or replace function public.void_payment_v26(p_receipt_id uuid,p_reason text)
returns public.payment_voids_v26
language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.payment_reconciliations%rowtype; v public.payment_voids_v26%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Akses ditolak'; end if;
 if length(trim(coalesce(p_reason,''))) not between 10 and 500 then raise exception 'Alasan koreksi wajib 10-500 karakter'; end if;
 select * into r from public.payment_reconciliations where id=p_receipt_id for update;
 if not found then raise exception 'Catatan pembayaran tidak ditemukan'; end if;
 if exists(select 1 from public.payment_voids_v26 where receipt_id=p_receipt_id) then raise exception 'Catatan ini sudah dibatalkan'; end if;
 insert into public.payment_voids_v26(receipt_id,reason,voided_by)
 values(p_receipt_id,trim(p_reason),auth.uid()) returning * into v;
 return v;
end $$;
revoke all on function public.void_payment_v26(uuid,text) from public,anon,authenticated;
grant execute on function public.void_payment_v26(uuid,text) to authenticated;
-- Jangan hapus catatan pembayaran lama. Referensi pembayaran V25 yang dibatalkan
-- tetap unik dan tidak dapat digunakan ulang; pakai referensi koreksi baru.


-- ========== LANGKAH 16 / 20 : supabase-v27-daily-close.sql ==========
-- V27: tutup kas UTC, snapshot immutable, hanya admin utama.
-- Jalankan pada proyek Supabase yang sama SETELAH V26. Cadangkan database sebelum migrasi.
-- Tutup kas tidak mengubah pembayaran, pembatalan, maupun stok.
create table if not exists public.cash_closures_v27 (
 id uuid primary key default gen_random_uuid(),
 cash_date date not null unique,
 receipt_count bigint not null,
 correction_count bigint not null,
 gross_amount numeric(18,0) not null,
 corrections_amount numeric(18,0) not null,
 net_amount numeric(18,0) not null,
 transfer_net numeric(18,0) not null,
 qris_net numeric(18,0) not null,
 notes text not null default '' check(char_length(notes)<=500),
 closed_by uuid not null references auth.users(id),
 closed_at timestamptz not null default now()
);
alter table public.cash_closures_v27 enable row level security;
drop policy if exists "admin read cash closures v27" on public.cash_closures_v27;
create policy "admin read cash closures v27" on public.cash_closures_v27 for select to authenticated
using (exists(select 1 from public.admin_users a where a.user_id=(select auth.uid())));
revoke all on public.cash_closures_v27 from public, anon, authenticated;
grant select on public.cash_closures_v27 to authenticated;

create or replace function public.close_cash_day_v27(p_date date,p_notes text default '')
returns public.cash_closures_v27
language plpgsql security definer set search_path=public,pg_temp as $$
declare row_out public.cash_closures_v27%rowtype;
        v_gross numeric; v_corr numeric; v_t numeric; v_q numeric; v_rc bigint; v_vc bigint; strict_v_t numeric; strict_v_q numeric;
begin
 if auth.uid() is null or not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Akses admin ditolak'; end if;
 if p_date is null or p_date >= (now() at time zone 'UTC')::date then raise exception 'Hanya tanggal UTC yang sudah berlalu dapat ditutup'; end if;
 if length(coalesce(p_notes,''))>500 then raise exception 'Catatan maksimal 500 karakter'; end if;
 perform pg_advisory_xact_lock(hashtextextended('cash-close-v27:'||p_date::text,0));
 if exists(select 1 from public.cash_closures_v27 where cash_date=p_date) then raise exception 'Tanggal kas sudah ditutup'; end if;
 select count(*),coalesce(sum(amount),0),
  coalesce(sum(amount) filter(where payment_method='Transfer bank'),0),
  coalesce(sum(amount) filter(where payment_method='QRIS'),0)
 into v_rc,v_gross,v_t,v_q
 from public.payment_reconciliations
 where received_at >= p_date::timestamp at time zone 'UTC' and received_at < (p_date+1)::timestamp at time zone 'UTC';
 select count(*),coalesce(sum(r.amount),0),
  coalesce(sum(r.amount) filter(where r.payment_method='Transfer bank'),0),
  coalesce(sum(r.amount) filter(where r.payment_method='QRIS'),0)
 into v_vc,v_corr,strict_v_t,strict_v_q
 from public.payment_voids_v26 v join public.payment_reconciliations r on r.id=v.receipt_id
 where v.voided_at >= p_date::timestamp at time zone 'UTC' and v.voided_at < (p_date+1)::timestamp at time zone 'UTC';
 insert into public.cash_closures_v27(cash_date,receipt_count,correction_count,gross_amount,corrections_amount,net_amount,transfer_net,qris_net,notes,closed_by)
 values(p_date,v_rc,v_vc,v_gross,v_corr,v_gross-v_corr,v_t-strict_v_t,v_q-strict_v_q,coalesce(p_notes,''),auth.uid()) returning * into row_out;
 return row_out;
end $$;
revoke all on function public.close_cash_day_v27(date,text) from public,anon,authenticated;
grant execute on function public.close_cash_day_v27(date,text) to authenticated;


-- ========== LANGKAH 17 / 20 : supabase-v28-monthly-wib.sql ==========
-- V28: laporan bulanan WIB, read-only, hanya admin utama.
-- Tidak mengubah atau mengunci transaksi dan tidak mengubah snapshot UTC V27.
create or replace function public.monthly_cash_wib_v28(p_month date)
returns table(payment_count bigint, correction_count bigint, transfer_gross numeric, qris_gross numeric, transfer_corrections numeric, qris_corrections numeric, gross_total numeric, correction_total numeric, net_total numeric)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_start timestamptz; v_end timestamptz;
begin
  if auth.uid() is null or not exists(select 1 from public.admin_users a where a.user_id=auth.uid()) then
    raise exception 'Hanya admin utama';
  end if;
  if p_month is null or extract(day from p_month) <> 1 then raise exception 'Masukkan tanggal pertama pada bulan laporan'; end if;
  v_start := p_month::timestamp at time zone 'Asia/Jakarta';
  v_end := (p_month + interval '1 month')::timestamp at time zone 'Asia/Jakarta';
  return query
  with receipts as (
    select count(*)::bigint as n,
      coalesce(sum(r.amount) filter(where r.payment_method='Transfer bank'),0)::numeric as tr,
      coalesce(sum(r.amount) filter(where r.payment_method='QRIS'),0)::numeric as qr
    from public.payment_reconciliations r
    where r.received_at>=v_start and r.received_at<v_end
  ), corrections as (
    select count(*)::bigint as n,
      coalesce(sum(r.amount) filter(where r.payment_method='Transfer bank'),0)::numeric as tr,
      coalesce(sum(r.amount) filter(where r.payment_method='QRIS'),0)::numeric as qr
    from public.payment_voids_v26 v join public.payment_reconciliations r on r.id=v.receipt_id
    where v.voided_at>=v_start and v.voided_at<v_end
  )
  select a.n,b.n,a.tr,a.qr,b.tr,b.qr,a.tr+a.qr,b.tr+b.qr,a.tr+a.qr-b.tr-b.qr
  from receipts a cross join corrections b;
end $$;
revoke all on function public.monthly_cash_wib_v28(date) from public,anon,authenticated;
grant execute on function public.monthly_cash_wib_v28(date) to authenticated;


-- ========== LANGKAH 18 / 20 : supabase-v29-period-lock.sql ==========
-- V29: Penguncian periode untuk tanggal UTC V27 yang sudah ditutup.
-- Backup database dan uji di staging. Tidak mengubah data maupun snapshot lama.
-- Pembayaran bertanggal UTC yang sudah ditutup ditolak; koreksi selalu bertanggal saat dibuat.
-- Penyesuaian pembayaran terlambat: gunakan tanggal pencatatan periode terbuka,
-- simpan tanggal bank asli di notes, bukan mengubah snapshot tertutup.
-- Penutupan V27 tetap menggunakan UTC. Laporan bulanan V28 memakai WIB: keduanya
-- mungkin berbeda pada transaksi sekitar tengah malam; V29 BELUM menyatukan kalender.
create or replace function public.record_payment_v25(p_order_id uuid,p_amount numeric,p_method text,p_reference text,p_received_at timestamptz,p_notes text default '')
returns public.payment_reconciliations
language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.orders%rowtype; r public.payment_reconciliations%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from public.admin_users where user_id=auth.uid()) then
   raise exception 'Akses ditolak';
 end if;
 if p_amount is null or p_amount <= 0 or p_amount > 99999999999999 then raise exception 'Nominal tidak valid'; end if;
 if p_method not in ('Transfer bank','QRIS') then raise exception 'Metode tidak valid'; end if;
 if length(trim(coalesce(p_reference,''))) not between 3 and 120 then raise exception 'Referensi harus 3-120 karakter'; end if;
 if p_received_at is null or p_received_at > now() + interval '5 minutes' then raise exception 'Waktu penerimaan tidak valid'; end if;
 if length(coalesce(p_notes,''))>500 then raise exception 'Catatan terlalu panjang'; end if;
 -- Kunci tanggal UTC yang sedang dicatat agar tidak balapan dengan penutupan kas.
 perform pg_advisory_xact_lock(hashtextextended('cash-close-v27:'||((p_received_at at time zone 'UTC')::date)::text,0));
 if exists (select 1 from public.cash_closures_v27 where cash_date=(p_received_at at time zone 'UTC')::date) then
   raise exception 'Tanggal penerimaan UTC sudah ditutup. Catat sebagai penyesuaian pada tanggal terbuka dengan keterangan tanggal transfer asli.';
 end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'Pesanan tidak ditemukan'; end if;
 if o.status='cancelled' or o.expired_at is not null then raise exception 'Pesanan batal/kedaluwarsa tidak dapat direkonsiliasi'; end if;
 insert into public.payment_reconciliations(order_id,amount,payment_method,reference_no,received_at,notes,recorded_by)
 values(p_order_id,p_amount,p_method,trim(p_reference),p_received_at,coalesce(p_notes,''),auth.uid()) returning * into r;
 return r;
end $$;
create or replace function public.void_payment_v26(p_receipt_id uuid,p_reason text)
returns public.payment_voids_v26
language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.payment_reconciliations%rowtype; v public.payment_voids_v26%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Akses ditolak'; end if;
 if length(trim(coalesce(p_reason,''))) not between 10 and 500 then raise exception 'Alasan koreksi wajib 10-500 karakter'; end if;
 -- Koreksi dicatat hari ini (UTC), bukan dengan mengubah tanggal pembayaran lama.
 perform pg_advisory_xact_lock(hashtextextended('cash-close-v27:'||((now() at time zone 'UTC')::date)::text,0));
 if exists (select 1 from public.cash_closures_v27 where cash_date=(now() at time zone 'UTC')::date) then
  raise exception 'Tanggal koreksi UTC sudah ditutup';
 end if;
 select * into r from public.payment_reconciliations where id=p_receipt_id for update;
 if not found then raise exception 'Catatan pembayaran tidak ditemukan'; end if;
 if exists(select 1 from public.payment_voids_v26 where receipt_id=p_receipt_id) then raise exception 'Catatan ini sudah dibatalkan'; end if;
 insert into public.payment_voids_v26(receipt_id,reason,voided_by)
 values(p_receipt_id,trim(p_reason),auth.uid()) returning * into v;
 return v;
end $$;
-- Tetap izinkan pemanggilan hanya oleh akun terautentikasi;
-- setiap RPC memeriksa daftar admin_users sendiri.
revoke all on function public.record_payment_v25(uuid,numeric,text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.record_payment_v25(uuid,numeric,text,text,timestamptz,text) to authenticated;
revoke all on function public.void_payment_v26(uuid,text) from public,anon,authenticated;
grant execute on function public.void_payment_v26(uuid,text) to authenticated;
notify pgrst, 'reload schema';


-- ========== LANGKAH 19 / 20 : supabase-v30-adjustments-wib.sql ==========
-- V30: jurnal penyesuaian terpisah berbasis WIB. Tidak mengubah tutup kas UTC V27.
-- Jalankan hanya setelah backup dan uji staging.
create table if not exists public.cash_adjustments_v30 (
 id uuid primary key default gen_random_uuid(),
 effective_date date not null,
 amount numeric(14,2) not null check(amount <> 0 and abs(amount) <= 999999999999),
 method text not null check(method in ('Transfer bank','QRIS')),
 reference_no text not null check(char_length(trim(reference_no)) between 3 and 120),
 reason text not null check(char_length(trim(reason)) between 10 and 500),
 recorded_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(reference_no,method)
);
alter table public.cash_adjustments_v30 enable row level security;
drop policy if exists "admin read adjustments v30" on public.cash_adjustments_v30;
create policy "admin read adjustments v30" on public.cash_adjustments_v30 for select to authenticated
 using (exists(select 1 from public.admin_users where user_id=auth.uid()));
revoke all on public.cash_adjustments_v30 from anon,authenticated;
grant select on public.cash_adjustments_v30 to authenticated;

create or replace function public.record_cash_adjustment_v30(p_effective_date date,p_amount numeric,p_method text,p_reference text,p_reason text)
returns public.cash_adjustments_v30 language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.cash_adjustments_v30%rowtype; today_wib date;
begin
 if auth.uid() is null or not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Hanya admin utama'; end if;
 today_wib := (now() at time zone 'Asia/Jakarta')::date;
 if p_effective_date is null or p_effective_date > today_wib or p_effective_date < today_wib-interval '366 days' then raise exception 'Tanggal di luar rentang yang diizinkan'; end if;
 if p_amount is null or p_amount=0 or abs(p_amount)>999999999999 then raise exception 'Nominal tidak valid'; end if;
 if p_method not in ('Transfer bank','QRIS') then raise exception 'Metode pembayaran tidak valid'; end if;
 if length(trim(coalesce(p_reference,''))) not between 3 and 120 then raise exception 'Referensi tidak valid'; end if;
 if length(trim(coalesce(p_reason,''))) not between 10 and 500 then raise exception 'Alasan wajib 10-500 karakter'; end if;
 -- Pembukuan kas V27 berbasis UTC. Hindari mengisi penyesuaian WIB pada hari UTC yang sudah ditutup,
 -- sebagai langkah konservatif. Ini belum menyatukan dua kalender akuntansi.
 if exists (select 1 from public.cash_closures_v27 where cash_date=p_effective_date) then
   raise exception 'Tanggal ini sudah ditutup pada sistem kas lama; gunakan tanggal terbuka dan jelaskan tanggal asal dalam alasan';
 end if;
 insert into public.cash_adjustments_v30(effective_date,amount,method,reference_no,reason,recorded_by)
 values(p_effective_date,p_amount,p_method,trim(p_reference),trim(p_reason),auth.uid()) returning * into r;
 return r;
end $$;
revoke all on function public.record_cash_adjustment_v30(date,numeric,text,text,text) from public,anon,authenticated;
grant execute on function public.record_cash_adjustment_v30(date,numeric,text,text,text) to authenticated;

-- Laporan termasuk jurnal penyesuaian sebagai BARIS TERPISAH dari total V28.
-- Untuk menghindari penggabungan otomatis yang berpotensi menutupi selisih, angka net_total_v28
-- tidak ditimpa. net_after_adjustments adalah hitungan eksplisit baru.
create or replace function public.monthly_cash_with_adjustments_v30(p_month date)
returns table(base_net numeric,adjustment_total numeric,net_after_adjustments numeric,adjustment_count bigint)
language plpgsql security definer set search_path=public,pg_temp as $$
declare b numeric; a numeric; n bigint;
begin
 if auth.uid() is null or not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Hanya admin utama'; end if;
 if p_month is null or extract(day from p_month)<>1 then raise exception 'Pilih awal bulan'; end if;
 select m.net_total into b from public.monthly_cash_wib_v28(p_month) m;
 select coalesce(sum(x.amount),0),count(*) into a,n from public.cash_adjustments_v30 x
 where x.effective_date>=p_month and x.effective_date<(p_month+interval '1 month')::date;
 return query select coalesce(b,0),coalesce(a,0),coalesce(b,0)+coalesce(a,0),n;
end $$;
revoke all on function public.monthly_cash_with_adjustments_v30(date) from public,anon,authenticated;
grant execute on function public.monthly_cash_with_adjustments_v30(date) to authenticated;
notify pgrst,'reload schema';


-- ========== LANGKAH 20 / 20 : supabase-v31-close-wib.sql ==========
-- V31: snapshot tutup kas WIB BARU. Tidak mengubah snapshot UTC V27.
-- Sebelum eksekusi: cadangkan database. Uji dengan pembayaran percobaan.
create table if not exists public.cash_closures_wib_v31 (
 id uuid primary key default gen_random_uuid(), cash_date date not null unique,
 receipt_count bigint not null, correction_count bigint not null, adjustment_count bigint not null,
 transfer_gross numeric not null, qris_gross numeric not null,
 transfer_corrections numeric not null, qris_corrections numeric not null,
 transfer_adjustments numeric not null, qris_adjustments numeric not null,
 net_amount numeric not null, notes text not null default '' check(char_length(notes)<=500),
 closed_by uuid not null references auth.users(id), closed_at timestamptz not null default now()
);
alter table public.cash_closures_wib_v31 enable row level security;
drop policy if exists "admin read close wib v31" on public.cash_closures_wib_v31;
create policy "admin read close wib v31" on public.cash_closures_wib_v31 for select to authenticated
 using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
revoke all on public.cash_closures_wib_v31 from public,anon,authenticated;
grant select on public.cash_closures_wib_v31 to authenticated;

create or replace function public.close_cash_wib_v31(p_date date,p_notes text default '')
returns public.cash_closures_wib_v31
language plpgsql security definer set search_path=public,pg_temp as $$
declare outrow public.cash_closures_wib_v31%rowtype;
 st timestamptz; en timestamptz;
 rc bigint; vc bigint; ac bigint; tg numeric; qg numeric; tc numeric; qc numeric; ta numeric; qa numeric;
begin
 if auth.uid() is null or not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Hanya admin utama'; end if;
 if p_date is null or p_date >= (now() at time zone 'Asia/Jakarta')::date then raise exception 'Hanya tanggal WIB yang sudah berlalu'; end if;
 if length(coalesce(p_notes,''))>500 then raise exception 'Catatan maksimal 500 karakter'; end if;
 perform pg_advisory_xact_lock(hashtextextended('close-wib-v31:'||p_date::text,0));
 if exists(select 1 from public.cash_closures_wib_v31 where cash_date=p_date) then raise exception 'Tanggal WIB sudah ditutup'; end if;
 st := p_date::timestamp at time zone 'Asia/Jakarta';
 en := (p_date+1)::timestamp at time zone 'Asia/Jakarta';
 select count(*),coalesce(sum(amount) filter(where payment_method='Transfer bank'),0),coalesce(sum(amount) filter(where payment_method='QRIS'),0)
 into rc,tg,qg from public.payment_reconciliations where received_at>=st and received_at<en;
 select count(*),coalesce(sum(r.amount) filter(where r.payment_method='Transfer bank'),0),coalesce(sum(r.amount) filter(where r.payment_method='QRIS'),0)
 into vc,tc,qc from public.payment_voids_v26 v join public.payment_reconciliations r on r.id=v.receipt_id where v.voided_at>=st and v.voided_at<en;
 select count(*),coalesce(sum(amount) filter(where method='Transfer bank'),0),coalesce(sum(amount) filter(where method='QRIS'),0)
 into ac,ta,qa from public.cash_adjustments_v30 where effective_date=p_date;
 insert into public.cash_closures_wib_v31(cash_date,receipt_count,correction_count,adjustment_count,transfer_gross,qris_gross,transfer_corrections,qris_corrections,transfer_adjustments,qris_adjustments,net_amount,notes,closed_by)
 values(p_date,rc,vc,ac,tg,qg,tc,qc,ta,qa,tg+qg-tc-qc+ta+qa,coalesce(p_notes,''),auth.uid()) returning * into outrow;
 return outrow;
end $$;
revoke all on function public.close_cash_wib_v31(date,text) from public,anon,authenticated;
grant execute on function public.close_cash_wib_v31(date,text) to authenticated;
notify pgrst,'reload schema';
-- KETERBATASAN: fungsi pembayaran dan jurnal versi sebelumnya TIDAK dikunci oleh penutupan WIB ini.
-- V31 adalah snapshot audit, BUKAN penguncian periode WIB yang menyeluruh.


COMMIT;

-- Pemeriksaan akhir hanya membaca skema. Semua kolom seharusnya TRUE.
SELECT
  to_regclass('public.catalog_state') IS NOT NULL AS katalog_ada,
  to_regclass('public.orders') IS NOT NULL AS pesanan_ada,
  to_regclass('public.admin_users') IS NOT NULL AS tabel_admin_ada,
  to_regclass('public.student_staff') IS NOT NULL AS tabel_petugas_ada,
  to_regprocedure('public.create_checkout_v6(jsonb)') IS NOT NULL AS checkout_ada,
  to_regprocedure('public.track_order_v23(uuid,uuid)') IS NOT NULL AS pelacakan_ada,
  to_regclass('public.cash_closures_wib_v31') IS NOT NULL AS laporan_ada;
