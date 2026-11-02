-- V9: Jalankan SETELAH V8 pada proyek Supabase yang sama.
-- Anti-spam sederhana: maksimal 3 pesanan BARU dalam 15 menit per nomor WA pemesan.
-- Tidak memblokir pengulangan token checkout yang sama (idempotensi V6/V7).
-- Ini bukan anti-bot penuh: nomor dapat diganti; sebelum publik, pertimbangkan CAPTCHA/Edge Function.
-- Backup database terlebih dahulu. Skrip aman untuk dijalankan ulang.

DO $$ BEGIN
  IF to_regprocedure('public.create_checkout_v9_previous(jsonb)') IS NULL THEN
    ALTER FUNCTION public.create_checkout_v6(jsonb) RENAME TO create_checkout_v9_previous;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.create_checkout_v9_previous(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_checkout_v6(p_order jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_phone text;
 v_token uuid;
 v_existing public.orders%ROWTYPE;
 v_recent integer;
BEGIN
 IF p_order IS NULL OR jsonb_typeof(p_order) <> 'object' THEN
    RAISE EXCEPTION 'Format checkout tidak valid';
 END IF;
 BEGIN
   v_token := (p_order->>'checkout_token')::uuid;
 EXCEPTION WHEN OTHERS THEN
   RAISE EXCEPTION 'Token checkout tidak valid';
 END;
 IF v_token IS NULL THEN RAISE EXCEPTION 'Token checkout wajib diisi'; END IF;
 -- Pastikan token yang sudah digunakan bisa diulang tanpa mengurangi stok lagi.
 SELECT * INTO v_existing FROM public.orders WHERE checkout_token=v_token;
 IF FOUND THEN RETURN public.create_checkout_v9_previous(p_order); END IF;

 -- Gunakan nomor normalisasi ringan; format tetap diverifikasi oleh RPC V6.
 v_phone := pg_catalog.regexp_replace(coalesce(p_order->>'customer_phone',''),'[^0-9]','','g');
 IF pg_catalog.length(v_phone) NOT BETWEEN 9 AND 16 THEN
   RAISE EXCEPTION 'Nomor WhatsApp pemesan tidak valid';
 END IF;
 -- Lock per nomor, agar permintaan bersamaan dari nomor yang sama tak lolos batas.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('checkout-phone:'||v_phone,0));
 -- Setelah lock, cek ulang token agar permintaan duplikat menunggu dan tidak ditolak.
 SELECT * INTO v_existing FROM public.orders WHERE checkout_token=v_token;
 IF FOUND THEN RETURN public.create_checkout_v9_previous(p_order); END IF;
 SELECT count(*) INTO v_recent FROM public.orders
 WHERE pg_catalog.regexp_replace(coalesce(customer_phone,''),'[^0-9]','','g') = v_phone
   AND created_at >= now() - interval '15 minutes';
 IF v_recent >= 3 THEN
   RAISE EXCEPTION 'Batas 3 pesanan dalam 15 menit untuk nomor ini tercapai. Hubungi kasir bila perlu bantuan.';
 END IF;
 RETURN public.create_checkout_v9_previous(p_order);
END $$;
REVOKE ALL ON FUNCTION public.create_checkout_v6(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_checkout_v6(jsonb) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
