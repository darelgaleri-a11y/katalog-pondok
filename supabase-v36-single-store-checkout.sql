-- KATALOG DAREL V36: enforce single-store checkout on server
-- Jalankan setelah SQL V33 dan sebelum frontend V36 digunakan. Backup dahulu.
BEGIN;

CREATE OR REPLACE FUNCTION public.create_checkout_v36(p_order jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_catalog jsonb;
  v_item jsonb;
  v_product jsonb;
  v_store_id text;
  v_first_store_id text := NULL;
  v_seen text[] := ARRAY[]::text[];
  v_result jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    -- Customer checkout tetap boleh anon; auth.uid() null bukan masalah.
    NULL;
  END IF;
  IF p_order IS NULL OR jsonb_typeof(p_order) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Format pesanan tidak valid';
  END IF;
  IF jsonb_typeof(p_order->'items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_order->'items') NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Keranjang harus berisi 1 sampai 100 barang';
  END IF;

  -- Serialisasi terhadap perubahan katalog dan checkout; fungsi V33 akan mengunci ulang.
  SELECT data INTO v_catalog FROM public.catalog_state WHERE id=1 FOR UPDATE;
  IF v_catalog IS NULL THEN RAISE EXCEPTION 'Katalog belum tersedia'; END IF;

  FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_order->'items') LOOP
    IF jsonb_typeof(v_item) <> 'object' OR coalesce(v_item->>'product_id','')='' THEN
      RAISE EXCEPTION 'Baris barang tidak valid';
    END IF;
    IF (v_item->>'product_id')=ANY(v_seen) THEN
      RAISE EXCEPTION 'Produk tidak boleh berulang';
    END IF;
    v_seen := array_append(v_seen,v_item->>'product_id');

    SELECT value INTO v_product
    FROM pg_catalog.jsonb_array_elements(coalesce(v_catalog->'products','[]'::jsonb))
    WHERE value->>'id'=v_item->>'product_id' LIMIT 1;
    IF v_product IS NULL THEN RAISE EXCEPTION 'Produk tidak ditemukan'; END IF;
    v_store_id := v_product->>'storeId';
    IF v_first_store_id IS NULL THEN
      v_first_store_id := v_store_id;
    ELSIF v_first_store_id IS DISTINCT FROM v_store_id THEN
      RAISE EXCEPTION 'Satu pesanan hanya boleh berasal dari satu toko';
    END IF;
    v_product := NULL;
  END LOOP;

  -- V33 tetap melakukan validasi harga, stok, audience, alamat, token, dan rate limit.
  v_result := public.create_checkout_v33(p_order);
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_checkout_v36(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_v36(jsonb) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
