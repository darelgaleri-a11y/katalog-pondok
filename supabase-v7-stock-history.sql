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
