-- KATALOG PONDOK V35: arsipkan/hapus dari daftar semua pesanan Kiriman Santri.
-- Soft delete: transaksi, status, bukti serah-terima, dan laporan keuangan tetap tersimpan.
-- Jalankan setelah backup DB dan setelah V34 edit-pesanan-santri.

BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

CREATE TABLE IF NOT EXISTS public.order_archive_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,
  order_snapshot jsonb NOT NULL
);
ALTER TABLE public.order_archive_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_archive_history FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_archive_student_order_v1(
  p_order_id uuid,
  p_reason text DEFAULT 'Diarsipkan oleh admin'
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_catalog jsonb;
  v_products jsonb;
  v_item jsonb;
  v_product_id text;
  v_qty integer;
  v_stock integer;
  v_should_restore boolean := false;
  v_row public.orders%ROWTYPE;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id=(SELECT auth.uid())
  ) THEN
    RAISE EXCEPTION 'Hanya admin utama yang boleh mengarsipkan pesanan';
  END IF;

  -- Lock katalog lalu pesanan, sama seperti checkout dan koreksi stok.
  SELECT data INTO v_catalog
    FROM public.catalog_state WHERE id=1 FOR UPDATE;
  IF v_catalog IS NULL THEN RAISE EXCEPTION 'Katalog belum tersedia'; END IF;

  SELECT * INTO v_order
    FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.mode <> 'student' THEN
    RAISE EXCEPTION 'Pesanan Kiriman Santri tidak ditemukan';
  END IF;
  IF v_order.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Pesanan sudah pernah diarsipkan';
  END IF;

  -- Semua status boleh diarsipkan, termasuk selesai dan sudah diserahterimakan.
  -- Barang yang sudah selesai/terserah tidak boleh menambah stok kembali.
  v_should_restore := coalesce(v_order.stock_reserved,false)
    AND v_order.status NOT IN ('completed')
    AND NOT EXISTS (
      SELECT 1 FROM public.student_handovers WHERE order_id=p_order_id
    );

  IF v_should_restore THEN
    v_products := coalesce(v_catalog->'products','[]'::jsonb);
    FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(v_order.items) LOOP
      v_product_id := v_item->>'product_id';
      v_qty := (v_item->>'quantity')::integer;
      IF EXISTS (
        SELECT 1 FROM pg_catalog.jsonb_array_elements(v_products)
        WHERE value->>'id'=v_product_id
      ) THEN
        SELECT (value->>'stock')::integer INTO v_stock
        FROM pg_catalog.jsonb_array_elements(v_products)
        WHERE value->>'id'=v_product_id LIMIT 1;
        SELECT pg_catalog.jsonb_agg(
          CASE WHEN value->>'id'=v_product_id
            THEN pg_catalog.jsonb_set(value,'{stock}',pg_catalog.to_jsonb(coalesce(v_stock,0)+v_qty),true)
            ELSE value END
        ) INTO v_products
        FROM pg_catalog.jsonb_array_elements(v_products);
      END IF;
    END LOOP;
    UPDATE public.catalog_state
      SET data=pg_catalog.jsonb_set(v_catalog,'{products}',v_products,true)
      WHERE id=1;
  END IF;

  UPDATE public.orders SET
    deleted_at=now(),
    deleted_by=(SELECT auth.uid()),
    deletion_reason=left(btrim(coalesce(p_reason,'Diarsipkan oleh admin')),500),
    stock_reserved=CASE WHEN v_should_restore THEN false ELSE stock_reserved END
  WHERE id=p_order_id
  RETURNING * INTO v_row;

  INSERT INTO public.order_archive_history(order_id,actor_id,reason,order_snapshot)
  VALUES(
    p_order_id,
    (SELECT auth.uid()),
    left(btrim(coalesce(p_reason,'Diarsipkan oleh admin')),500),
    to_jsonb(v_order)
  );

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_archive_student_order_v1(uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_archive_student_order_v1(uuid,text)
  TO authenticated;

-- Sembunyikan arsip dari daftar pesanan admin normal.
CREATE OR REPLACE FUNCTION public.admin_find_orders_v323(
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_search text DEFAULT '',
  p_mode text DEFAULT 'all',
  p_status text DEFAULT 'all',
  p_day date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_page integer;
  v_size integer;
  v_offset integer;
  v_search text;
  v_total bigint;
  v_rows jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = (SELECT auth.uid())
  ) THEN
    RAISE EXCEPTION 'Hanya admin utama yang boleh melihat daftar pesanan';
  END IF;

  v_page := coalesce(p_page, 1);
  v_size := coalesce(p_page_size, 50);
  IF v_page < 1 OR v_page > 100000 OR v_size < 1 OR v_size > 100 THEN
    RAISE EXCEPTION 'Nomor halaman atau ukuran halaman tidak valid';
  END IF;
  v_offset := (v_page - 1) * v_size;
  v_search := lower(left(btrim(coalesce(p_search, '')), 100));
  IF coalesce(p_mode, 'all') NOT IN ('all', 'general', 'student') THEN
    RAISE EXCEPTION 'Jenis pesanan tidak valid';
  END IF;
  IF coalesce(p_status, 'all') NOT IN ('all','awaiting_confirmation','confirmed','paid','prepared','completed','cancelled') THEN
    RAISE EXCEPTION 'Status pesanan tidak valid';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.orders o
  WHERE o.deleted_at IS NULL
    AND (coalesce(p_mode,'all')='all' OR o.mode=p_mode)
    AND (coalesce(p_status,'all')='all' OR o.status=p_status OR
         (p_status='cancelled' AND o.expired_at IS NOT NULL))
    AND (p_day IS NULL OR (
      o.created_at >= (p_day::timestamp AT TIME ZONE 'Asia/Jakarta')
      AND o.created_at < ((p_day + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')
    ))
    AND (v_search='' OR
      strpos(lower(o.id::text), v_search)>0 OR
      strpos(lower(o.customer_name), v_search)>0 OR
      strpos(lower(o.customer_phone), v_search)>0 OR
      strpos(lower(coalesce(o.student_name,'')), v_search)>0 OR
      strpos(lower(coalesce(o.student_room,'')), v_search)>0 OR
      strpos(lower(o.items::text), v_search)>0);

  SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC, p.id DESC), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT o.* FROM public.orders o
    WHERE o.deleted_at IS NULL
      AND (coalesce(p_mode,'all')='all' OR o.mode=p_mode)
      AND (coalesce(p_status,'all')='all' OR o.status=p_status OR
           (p_status='cancelled' AND o.expired_at IS NOT NULL))
      AND (p_day IS NULL OR (
        o.created_at >= (p_day::timestamp AT TIME ZONE 'Asia/Jakarta')
        AND o.created_at < ((p_day + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')
      ))
      AND (v_search='' OR
        strpos(lower(o.id::text), v_search)>0 OR
        strpos(lower(o.customer_name), v_search)>0 OR
        strpos(lower(o.customer_phone), v_search)>0 OR
        strpos(lower(coalesce(o.student_name,'')), v_search)>0 OR
        strpos(lower(coalesce(o.student_room,'')), v_search)>0 OR
        strpos(lower(o.items::text), v_search)>0)
    ORDER BY o.created_at DESC, o.id DESC
    LIMIT v_size OFFSET v_offset
  ) p;

  RETURN jsonb_build_object('orders',v_rows,'total',v_total,
                            'page',v_page,'page_size',v_size);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_find_orders_v323(integer,integer,text,text,text,date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_find_orders_v323(integer,integer,text,text,text,date)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
