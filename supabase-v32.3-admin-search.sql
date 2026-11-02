-- V32.3 TAHAP 1. Jalankan SATU KALI di Rahmani's Project setelah mencadangkan database.
-- Hanya menambahkan fungsi pencarian dan indeks; tidak mengubah pesanan, stok, ataupun checkout.
-- Hanya admin utama berlogin yang dapat mengeksekusi fungsi ini.

CREATE INDEX IF NOT EXISTS orders_v323_created_id_idx
  ON public.orders (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS orders_v323_mode_created_idx
  ON public.orders (mode, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS orders_v323_status_created_idx
  ON public.orders (status, created_at DESC, id DESC);

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

  -- Tanggal mengikuti WIB, terlepas dari zona waktu server/PostgREST.
  SELECT count(*) INTO v_total
  FROM public.orders o
  WHERE (coalesce(p_mode,'all')='all' OR o.mode=p_mode)
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
    WHERE (coalesce(p_mode,'all')='all' OR o.mode=p_mode)
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
