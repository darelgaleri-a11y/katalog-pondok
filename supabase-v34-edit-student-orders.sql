-- KATALOG DAREL: edit data pesanan Kiriman Santri (V1)
-- Backup database terlebih dahulu. Jalankan satu kali di Supabase SQL Editor.
-- Edit memakai RPC SECURITY DEFINER; tidak memberi hak UPDATE langsung pada tabel orders.
-- Pesanan batal boleh dikoreksi datanya, tetapi statusnya tidak diaktifkan kembali.
-- Pesanan selesai atau sudah diserahterimakan dikunci.

BEGIN;

CREATE TABLE IF NOT EXISTS public.order_edit_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  edited_at timestamptz NOT NULL DEFAULT now(),
  before_data jsonb NOT NULL,
  after_data jsonb NOT NULL
);

ALTER TABLE public.order_edit_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_edit_history FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_edit_student_order_v1(
  p_order_id uuid,
  p_customer_name text,
  p_student_name text,
  p_student_room text,
  p_student_gender text,
  p_delivery_date date,
  p_payment_method text,
  p_note text,
  p_items jsonb
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_catalog jsonb;
  v_settings jsonb;
  v_products jsonb;
  v_item jsonb;
  v_product jsonb;
  v_store jsonb;
  v_id text;
  v_qty integer;
  v_stock integer;
  v_price numeric;
  v_total numeric := 0;
  v_items jsonb := '[]'::jsonb;
  v_days jsonb;
  v_cashier_wa text;
  v_target text;
  v_before jsonb;
  v_after jsonb;
  v_row public.orders%ROWTYPE;
  v_seen text[] := ARRAY[]::text[];
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id=(SELECT auth.uid())
  ) THEN
    RAISE EXCEPTION 'Hanya admin utama yang boleh mengedit pesanan';
  END IF;

  IF p_order_id IS NULL THEN RAISE EXCEPTION 'ID pesanan wajib diisi'; END IF;
  IF length(btrim(coalesce(p_customer_name,''))) NOT BETWEEN 1 AND 150
     OR length(btrim(coalesce(p_student_name,''))) NOT BETWEEN 1 AND 150
     OR length(btrim(coalesce(p_student_room,''))) NOT BETWEEN 1 AND 150
     OR p_student_gender IS NULL OR p_student_gender NOT IN ('male','female')
     OR p_delivery_date IS NULL
     OR p_payment_method IS NULL OR p_payment_method NOT IN ('Transfer bank','QRIS')
     OR length(coalesce(p_note,'')) > 2000 THEN
    RAISE EXCEPTION 'Data pemesan, santri, tanggal, pembayaran, atau catatan tidak valid';
  END IF;

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Pesanan harus berisi 1 sampai 100 barang';
  END IF;

  -- Urutan lock wajib sama dengan checkout dan perubahan status: katalog lalu pesanan.
  SELECT data INTO v_catalog FROM public.catalog_state WHERE id=1 FOR UPDATE;
  IF v_catalog IS NULL THEN RAISE EXCEPTION 'Katalog belum tersedia'; END IF;
  v_settings := coalesce(v_catalog->'settings','{}'::jsonb);
  v_products := coalesce(v_catalog->'products','[]'::jsonb);

  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.mode <> 'student' THEN
    RAISE EXCEPTION 'Pesanan Kiriman Santri tidak ditemukan';
  END IF;
  IF v_order.status='completed' THEN
    RAISE EXCEPTION 'Pesanan selesai tidak dapat diedit';
  END IF;
  IF EXISTS (SELECT 1 FROM public.student_handovers WHERE order_id=p_order_id) THEN
    RAISE EXCEPTION 'Pesanan sudah diserahterimakan dan tidak dapat diedit';
  END IF;

  -- Tanggal harus tetap mengikuti hari penyerahan yang diatur admin.
  v_days := coalesce(v_settings->'deliveryDays','[2,5]'::jsonb);
  IF NOT (v_days @> jsonb_build_array(extract(dow FROM p_delivery_date)::integer)) THEN
    RAISE EXCEPTION 'Tanggal penyerahan tidak sesuai jadwal pondok';
  END IF;

  -- Jika gender berubah, arahkan pesanan ke WhatsApp kasir tujuan yang baru.
  v_cashier_wa := v_order.cashier_wa;
  IF p_student_gender IS DISTINCT FROM v_order.student_gender THEN
    v_target := CASE WHEN p_student_gender='male'
      THEN v_settings->>'maleWa' ELSE v_settings->>'femaleWa' END;
    v_target := regexp_replace(coalesce(v_target,''),'[^0-9]','','g');
    IF left(v_target,1)='0' THEN v_target := '62'||substr(v_target,2); END IF;
    IF v_target !~ '^[0-9]{10,15}$' THEN
      RAISE EXCEPTION 'WhatsApp kasir untuk tujuan santri yang baru belum valid';
    END IF;
    v_cashier_wa := v_target;
  END IF;

  -- Pesanan aktif yang masih memegang reservasi: kembalikan stok lama dahulu.
  -- Pesanan batal/kedaluwarsa tetap tidak memegang stok dan tidak diaktifkan kembali.
  IF coalesce(v_order.stock_reserved,false) THEN
    FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(v_order.items) LOOP
      v_id := v_item->>'product_id';
      v_qty := (v_item->>'quantity')::integer;
      IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(v_products) WHERE value->>'id'=v_id) THEN
        SELECT (value->>'stock')::integer INTO v_stock
          FROM pg_catalog.jsonb_array_elements(v_products)
          WHERE value->>'id'=v_id LIMIT 1;
        SELECT pg_catalog.jsonb_agg(
          CASE WHEN value->>'id'=v_id
            THEN pg_catalog.jsonb_set(value,'{stock}',pg_catalog.to_jsonb(v_stock+v_qty),true)
            ELSE value END
        ) INTO v_products
        FROM pg_catalog.jsonb_array_elements(v_products);
      END IF;
    END LOOP;
  END IF;

  -- Bangun ulang snapshot barang dari katalog tepercaya, bukan harga dari browser.
  FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(v_item) <> 'object' OR coalesce(v_item->>'product_id','')='' THEN
      RAISE EXCEPTION 'Baris barang tidak valid';
    END IF;
    v_id := v_item->>'product_id';
    IF v_id=ANY(v_seen) THEN RAISE EXCEPTION 'Produk yang sama tidak boleh berulang'; END IF;
    v_seen := array_append(v_seen,v_id);

    BEGIN
      v_qty := (v_item->>'quantity')::integer;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Jumlah barang tidak valid';
    END;
    IF v_qty IS NULL OR v_qty NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'Jumlah barang harus 1 sampai 100';
    END IF;

    SELECT value INTO v_product
      FROM pg_catalog.jsonb_array_elements(v_products)
      WHERE value->>'id'=v_id LIMIT 1;
    IF v_product IS NULL THEN RAISE EXCEPTION 'Produk % tidak ditemukan atau sudah dihapus',v_id; END IF;

    SELECT value INTO v_store
      FROM pg_catalog.jsonb_array_elements(coalesce(v_catalog->'stores','[]'::jsonb))
      WHERE value->>'id'=v_product->>'storeId' LIMIT 1;
    IF v_store IS NULL OR coalesce((v_store->>'active')::boolean,false)=false THEN
      RAISE EXCEPTION 'Toko untuk produk % tidak aktif',v_product->>'name';
    END IF;
    IF coalesce(v_product->>'audience','both') NOT IN ('both','student') THEN
      RAISE EXCEPTION 'Produk % tidak tersedia untuk Kiriman Santri',v_product->>'name';
    END IF;

    v_stock := coalesce((v_product->>'stock')::integer,0);
    IF coalesce(v_order.stock_reserved,false) THEN
      IF v_stock < v_qty THEN
        RAISE EXCEPTION 'Stok tidak cukup untuk %. Tersedia: %, diminta: %',
          v_product->>'name',v_stock,v_qty;
      END IF;
      SELECT pg_catalog.jsonb_agg(
        CASE WHEN value->>'id'=v_id
          THEN pg_catalog.jsonb_set(value,'{stock}',pg_catalog.to_jsonb(v_stock-v_qty),true)
          ELSE value END
      ) INTO v_products
      FROM pg_catalog.jsonb_array_elements(v_products);
    END IF;

    v_price := (v_product->>'price')::numeric;
    IF v_price IS NULL OR v_price<0 OR v_price<>trunc(v_price) THEN
      RAISE EXCEPTION 'Harga produk % tidak valid',v_product->>'name';
    END IF;
    v_total := v_total + (v_price*v_qty);
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'product_id',v_product->>'id',
      'store_id',v_product->>'storeId',
      'store_name',v_store->>'name',
      'product_name',v_product->>'name',
      'quantity',v_qty,
      'unit_price',v_price,
      'subtotal',v_price*v_qty
    ));
    v_product := NULL;
    v_store := NULL;
  END LOOP;

  v_before := jsonb_build_object(
    'customer_name',v_order.customer_name,
    'student_name',v_order.student_name,
    'student_room',v_order.student_room,
    'student_gender',v_order.student_gender,
    'delivery_date',v_order.delivery_date,
    'payment_method',v_order.payment_method,
    'note',v_order.note,
    'items',v_order.items,
    'total_estimate',v_order.total_estimate
  );

  UPDATE public.catalog_state
    SET data=pg_catalog.jsonb_set(v_catalog,'{products}',v_products,true)
    WHERE id=1 AND coalesce(v_order.stock_reserved,false);

  UPDATE public.orders SET
    customer_name=btrim(p_customer_name),
    student_name=btrim(p_student_name),
    student_room=btrim(p_student_room),
    student_gender=p_student_gender,
    delivery_date=p_delivery_date,
    payment_method=p_payment_method,
    note=coalesce(p_note,''),
    cashier_wa=v_cashier_wa,
    items=v_items,
    total_estimate=v_total
  WHERE id=p_order_id
  RETURNING * INTO v_row;

  v_after := jsonb_build_object(
    'customer_name',v_row.customer_name,
    'student_name',v_row.student_name,
    'student_room',v_row.student_room,
    'student_gender',v_row.student_gender,
    'delivery_date',v_row.delivery_date,
    'payment_method',v_row.payment_method,
    'note',v_row.note,
    'items',v_row.items,
    'total_estimate',v_row.total_estimate
  );

  INSERT INTO public.order_edit_history(order_id,actor_id,before_data,after_data)
  VALUES(p_order_id,(SELECT auth.uid()),v_before,v_after);

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_edit_student_order_v1(
  uuid,text,text,text,text,date,text,text,jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_edit_student_order_v1(
  uuid,text,text,text,text,date,text,text,jsonb
) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
