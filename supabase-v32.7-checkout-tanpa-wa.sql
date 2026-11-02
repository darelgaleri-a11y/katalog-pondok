-- KATALOG DAREL V32.7 - WA pemesan tidak diminta; pembayaran hanya transfer bank.
-- Jalankan di SQL Editor pada proyek Supabase yang sama, SETELAH backup.
-- Urutan: terapkan SQL dulu, uji, kemudian deploy frontend V32.7.
-- TIDAK mengubah checkout lama (public.create_checkout_v6), stok,
-- status, riwayat pembayaran, atau data pesanan yang sudah tersimpan.
-- QRIS lama tetap ada pada riwayat/rekap, hanya tidak ditawarkan kepada pembeli baru.

-- Nomor telepon menjadi opsional; CHECK lama (panjang 5-32) tetap aman:
-- pada NULL hasilnya UNKNOWN, yang diterima oleh constraint PostgreSQL.
ALTER TABLE public.orders ALTER COLUMN customer_phone DROP NOT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS checkout_client_ref uuid;

-- Pengenal acak per-browser digunakan untuk pembatasan checkout baru,
-- TANPA menyimpan nomor WhatsApp pelanggan di database.
CREATE INDEX IF NOT EXISTS orders_v327_client_ref_created_idx
  ON public.orders (checkout_client_ref, created_at DESC)
  WHERE checkout_client_ref IS NOT NULL;

-- Wrapper kompatibilitas: mempertahankan semua validasi checkout/stok/rate limit V6-V9.
-- Nomor sementara dibuat hanya DI DALAM TRANSAKSI untuk validator lama,
-- lalu langsung diganti NULL sebelum transaksi disimpan.
-- Pengenal browser di client_ref dapat direset pengguna: ini bukan anti-bot kuat.
CREATE OR REPLACE FUNCTION public.create_checkout_v327(p_order jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token uuid;
  v_client_ref uuid;
  v_existing uuid;
  v_recent integer;
  v_temporary_phone text;
  v_result jsonb;
  v_order_id uuid;
BEGIN
  IF p_order IS NULL OR pg_catalog.jsonb_typeof(p_order) <> 'object' THEN
    RAISE EXCEPTION 'Format checkout tidak valid';
  END IF;

  BEGIN
    v_token := (p_order->>'checkout_token')::uuid;
    v_client_ref := (p_order->>'client_ref')::uuid;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Pengenal checkout atau browser tidak valid';
  END;
  IF v_token IS NULL OR v_client_ref IS NULL THEN
    RAISE EXCEPTION 'Pengenal checkout atau browser wajib diisi';
  END IF;

  -- Angka sementara yang stabil per-browser agar validator lama tidak rusak.
  -- Prefiks 000 bukan nomor nyata, dan tidak disimpan setelah transaksi selesai.
  v_temporary_phone := '000' || pg_catalog.lpad(
    pg_catalog.mod(pg_catalog.hashtextextended(v_client_ref::text,0)::numeric + 9223372036854775808,1000000000000)::text,
    12, '0'
  );

  -- Anti-duplikasi berdasarkan token tetap prioritas pertama.
  SELECT o.id INTO v_existing FROM public.orders o WHERE o.checkout_token=v_token;
  IF v_existing IS NOT NULL THEN
    RETURN public.create_checkout_v6(
      p_order || pg_catalog.jsonb_build_object('customer_phone',v_temporary_phone)
    );
  END IF;

  -- Pembatasan kasar 3 pesanan baru / 15 menit / browser; dapat dilewati
  -- dengan mengganti browser, sama seperti limit lama bisa dilewati ganti nomor.
  -- Lock per-browser melindungi penghitung saat permintaan bersamaan.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('checkout-client-v327:'||v_client_ref::text,0)
  );
  SELECT o.id INTO v_existing FROM public.orders o WHERE o.checkout_token=v_token;
  IF v_existing IS NOT NULL THEN
    RETURN public.create_checkout_v6(
      p_order || pg_catalog.jsonb_build_object('customer_phone',v_temporary_phone)
    );
  END IF;

  SELECT pg_catalog.count(*) INTO v_recent
  FROM public.orders o
  WHERE o.checkout_client_ref=v_client_ref
    AND o.created_at >= now() - interval '15 minutes';
  IF v_recent>=3 THEN
    RAISE EXCEPTION 'Batas 3 pesanan dalam 15 menit pada browser ini tercapai. Hubungi kasir jika perlu bantuan.';
  END IF;

  -- Fungsi lama membuat order + reservasi stok dalam satu transaksi yang sama.
  -- Bila gagal, perubahan apa pun ikut dibatalkan oleh PostgreSQL.
  v_result := public.create_checkout_v6(
    p_order || pg_catalog.jsonb_build_object('customer_phone',v_temporary_phone)
  );
  v_order_id := (v_result->>'id')::uuid;
  IF v_order_id IS NULL THEN RAISE EXCEPTION 'Checkout tidak mengembalikan nomor pesanan'; END IF;

  -- Jangan ubah pesanan lama bila token yang sama sudah pernah dipakai.
  IF coalesce((v_result->>'duplicate')::boolean,false)=false THEN
    UPDATE public.orders
      SET customer_phone=NULL, checkout_client_ref=v_client_ref
      WHERE id=v_order_id AND checkout_token=v_token;
    IF NOT FOUND THEN RAISE EXCEPTION 'Gagal menyimpan pesanan tanpa nomor telepon'; END IF;
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_checkout_v327(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_v327(jsonb) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
