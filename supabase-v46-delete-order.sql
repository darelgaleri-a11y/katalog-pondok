-- V46: hapus pesanan secara aman melalui RPC admin.
-- Jalankan satu kali di Supabase SQL Editor setelah migrasi V25.
-- Pesanan yang sudah diserahterimakan atau direkonsiliasi tidak dapat dihapus
-- agar bukti operasional dan jejak keuangan tetap utuh.
create or replace function public.admin_delete_order_v46(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_catalog jsonb;
  v_products jsonb;
  v_item jsonb;
  v_product_id text;
  v_qty integer;
  v_current_stock integer;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.admin_users a
    where a.user_id = (select auth.uid())
  ) then
    raise exception 'Hanya admin utama yang boleh menghapus pesanan';
  end if;

  -- Gunakan urutan lock yang sama dengan checkout dan pembatalan stok.
  perform 1 from public.catalog_state where id = 1 for update;
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Pesanan tidak ditemukan atau sudah dihapus';
  end if;

  if exists (
    select 1 from public.student_handovers h
    where h.order_id = p_order_id
  ) then
    raise exception 'Pesanan memiliki catatan serah-terima; data harus dipertahankan';
  end if;

  if exists (
    select 1 from public.payment_reconciliations r
    where r.order_id = p_order_id
  ) then
    raise exception 'Pesanan memiliki catatan rekonsiliasi pembayaran; data harus dipertahankan';
  end if;

  -- Kembalikan stok hanya jika pesanan ini masih memegang reservasi.
  if coalesce(v_order.stock_reserved, false) then
    select data into v_catalog
    from public.catalog_state
    where id = 1;

    v_products := coalesce(v_catalog->'products', '[]'::jsonb);

    for v_item in
      select value from pg_catalog.jsonb_array_elements(coalesce(v_order.items, '[]'::jsonb))
    loop
      v_product_id := v_item->>'product_id';
      v_qty := greatest(coalesce((v_item->>'quantity')::integer, 0), 0);

      -- Produk yang sudah dihapus dari katalog dilewati, tidak dibuat ulang.
      if v_product_id is not null and v_qty > 0 and exists (
        select 1 from pg_catalog.jsonb_array_elements(v_products)
        where value->>'id' = v_product_id
      ) then
        select (value->>'stock')::integer
        into v_current_stock
        from pg_catalog.jsonb_array_elements(v_products)
        where value->>'id' = v_product_id
        limit 1;

        select pg_catalog.jsonb_agg(
          case when value->>'id' = v_product_id
            then pg_catalog.jsonb_set(
              value, '{stock}',
              pg_catalog.to_jsonb(coalesce(v_current_stock, 0) + v_qty),
              true
            )
            else value
          end
        )
        into v_products
        from pg_catalog.jsonb_array_elements(v_products);
      end if;
    end loop;

    update public.catalog_state
    set data = pg_catalog.jsonb_set(v_catalog, '{products}', v_products, true)
    where id = 1;
  end if;

  -- order_status_history memiliki ON DELETE CASCADE.
  delete from public.orders where id = p_order_id;
  return true;
end;
$$;

revoke all on function public.admin_delete_order_v46(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_order_v46(uuid) to authenticated;
notify pgrst, 'reload schema';
