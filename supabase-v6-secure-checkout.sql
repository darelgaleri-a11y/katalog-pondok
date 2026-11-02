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
