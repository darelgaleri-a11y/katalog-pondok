-- V22: fungsi status publik minimal, memerlukan ID penuh DAN kode acak checkout.
-- Jalankan setelah V21. Tidak membuka SELECT publik pada tabel orders.
CREATE OR REPLACE FUNCTION public.track_order_v22(p_order_id uuid, p_access_code uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_order public.orders%ROWTYPE;
BEGIN
  IF p_order_id IS NULL OR p_access_code IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_order FROM public.orders
    WHERE id = p_order_id AND checkout_token = p_access_code;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'status', v_order.status,
    'mode', v_order.mode,
    'delivery_date', CASE WHEN v_order.mode='student' THEN v_order.delivery_date ELSE NULL END,
    'handed_over', CASE WHEN v_order.mode='student' THEN EXISTS(
      SELECT 1 FROM public.student_handovers h WHERE h.order_id=v_order.id
    ) ELSE NULL END,
    'expired', v_order.expired_at IS NOT NULL
  );
END;
$$;
REVOKE ALL ON FUNCTION public.track_order_v22(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_order_v22(uuid,uuid) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
