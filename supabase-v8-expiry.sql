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
