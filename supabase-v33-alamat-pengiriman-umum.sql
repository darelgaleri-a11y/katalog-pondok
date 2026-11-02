-- KATALOG DAREL V33: dua jalur checkout, pengiriman alamat hanya untuk belanja umum.
-- JALANKAN setelah instalasi V32.7 dan setelah membuat backup Rahmani's Project.
-- Tidak menghapus pesanan lama, tidak mengubah mekanisme stok atau kasir.
-- SQL dulu, baru frontend V33; tidak mengaktifkan checkout alamat secara terpisah.

BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_recipient text,
  ADD COLUMN IF NOT EXISTS shipping_address text,
  ADD COLUMN IF NOT EXISTS shipping_area text,
  ADD COLUMN IF NOT EXISTS shipping_city text,
  ADD COLUMN IF NOT EXISTS shipping_landmark text;

-- Menggunakan wrapper V32.7 agar stok, deduplikasi UUID, dan limit per browser
-- tetap dikelola oleh RPC sebelumnya dalam transaksi database yang SAMA.
-- Semua field dari pengguna divalidasi ulang sebelum mengubah pesanan.
CREATE OR REPLACE FUNCTION public.create_checkout_v33(p_order jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_mode text;
  v_token uuid;
  v_recipient text;
  v_address text;
  v_area text;
  v_city text;
  v_landmark text;
  v_result jsonb;
  v_order_id uuid;
  v_duplicate boolean;
  v_existing public.orders%ROWTYPE;
BEGIN
  IF p_order IS NULL OR pg_catalog.jsonb_typeof(p_order) <> 'object' THEN
    RAISE EXCEPTION 'Format checkout tidak valid';
  END IF;
  v_mode := p_order->>'mode';
  IF v_mode NOT IN ('student','general') OR v_mode IS NULL THEN
    RAISE EXCEPTION 'Jenis layanan tidak valid';
  END IF;
  BEGIN
    v_token := (p_order->>'checkout_token')::uuid;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Nomor pengaman checkout tidak valid';
  END;
  IF v_token IS NULL THEN RAISE EXCEPTION 'Nomor pengaman checkout wajib diisi'; END IF;

  v_recipient := pg_catalog.btrim(coalesce(p_order->>'shipping_recipient',''));
  v_address := pg_catalog.btrim(coalesce(p_order->>'shipping_address',''));
  v_area := pg_catalog.btrim(coalesce(p_order->>'shipping_area',''));
  v_city := pg_catalog.btrim(coalesce(p_order->>'shipping_city',''));
  v_landmark := pg_catalog.btrim(coalesce(p_order->>'shipping_landmark',''));

  IF v_mode='general' THEN
    IF pg_catalog.length(v_recipient) NOT BETWEEN 1 AND 150 OR
       pg_catalog.length(v_address) NOT BETWEEN 1 AND 500 OR
       pg_catalog.length(v_area) NOT BETWEEN 1 AND 180 OR
       pg_catalog.length(v_city) NOT BETWEEN 1 AND 120 OR
       pg_catalog.length(v_landmark)>200 THEN
      RAISE EXCEPTION 'Alamat pengiriman belum lengkap atau terlalu panjang';
    END IF;
  ELSIF v_recipient<>'' OR v_address<>'' OR v_area<>'' OR v_city<>'' OR v_landmark<>'' THEN
    RAISE EXCEPTION 'Kiriman santri tidak membutuhkan alamat rumah';
  END IF;

  -- Wrapper memanggil V32.7: semua reservasi stok dan pencatatan tetap atomik.
  v_result := public.create_checkout_v327(p_order);
  v_order_id := (v_result->>'id')::uuid;
  v_duplicate := coalesce((v_result->>'duplicate')::boolean,false);
  IF v_order_id IS NULL THEN RAISE EXCEPTION 'Nomor pesanan tidak ditemukan'; END IF;

  IF v_duplicate THEN
    -- Jika browser mengulang token setelah mengubah alamat, JANGAN kirim
    -- pesan WhatsApp dengan alamat berbeda dari yang tercatat admin.
    SELECT * INTO v_existing FROM public.orders
      WHERE id=v_order_id AND checkout_token=v_token FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Data pesanan sebelumnya tidak ditemukan'; END IF;
    IF v_existing.mode IS DISTINCT FROM v_mode OR
       v_existing.customer_name IS DISTINCT FROM pg_catalog.btrim(coalesce(p_order->>'customer_name','')) OR
       v_existing.note IS DISTINCT FROM coalesce(p_order->>'note','') OR
       (v_mode='student' AND (
         v_existing.student_name IS DISTINCT FROM pg_catalog.btrim(coalesce(p_order->>'student_name','')) OR
         v_existing.student_room IS DISTINCT FROM pg_catalog.btrim(coalesce(p_order->>'student_room','')) OR
         v_existing.student_gender IS DISTINCT FROM (p_order->>'student_gender') OR
         v_existing.delivery_date::text IS DISTINCT FROM (p_order->>'delivery_date')
       )) OR
       (v_mode='general' AND (
         v_existing.shipping_recipient IS DISTINCT FROM v_recipient OR
         v_existing.shipping_address IS DISTINCT FROM v_address OR
         v_existing.shipping_area IS DISTINCT FROM v_area OR
         v_existing.shipping_city IS DISTINCT FROM v_city OR
         coalesce(v_existing.shipping_landmark,'')<>v_landmark
       )) THEN
      RAISE EXCEPTION 'Pesanan ini sudah tercatat dengan data berbeda. Hubungi kasir untuk perubahan alamat; jangan membuat pesanan baru.';
    END IF;
    RETURN v_result;
  END IF;

  -- Pesanan baru: alamat disimpan sebelum COMMIT; jika UPDATE gagal, stok
  -- yang sudah direservasi akan ikut ROLLBACK.
  IF v_mode='general' THEN
    UPDATE public.orders SET
      shipping_recipient=v_recipient,
      shipping_address=v_address,
      shipping_area=v_area,
      shipping_city=v_city,
      shipping_landmark=NULLIF(v_landmark,'')
    WHERE id=v_order_id AND checkout_token=v_token AND mode='general';
    IF NOT FOUND THEN RAISE EXCEPTION 'Gagal menyimpan alamat pesanan umum'; END IF;
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_checkout_v33(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_v33(jsonb) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
