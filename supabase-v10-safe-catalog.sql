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
