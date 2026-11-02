-- OPSIONAL, hanya jika extension pg_cron tersedia dan diaktifkan di Supabase.
-- Jalankan di SQL Editor dengan hak postgres. Cek job dengan SELECT * FROM cron.job;
-- Petunjuk ekstensi: Supabase Dashboard > Database > Extensions > pg_cron.
-- Beberapa proyek tidak menyediakan pg_cron: gunakan tombol admin V8 sebagai alternatif.
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('katalog-expire-pending-every-15-min', '*/15 * * * *',
  'SELECT public.expire_pending_orders_v8_internal(500);');
-- Jika ingin menonaktifkan:
-- SELECT cron.unschedule('katalog-expire-pending-every-15-min');
