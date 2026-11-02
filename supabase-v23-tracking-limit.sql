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
