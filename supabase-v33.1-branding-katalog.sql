-- Katalog Darel V33.1 — Branding tersendiri, aman dari tulis ulang stok katalog.
-- Pasang SEKALI di Supabase SQL Editor (Rahmani's Project) sebelum deploy kode V33.1.
-- Tidak mengubah catalog_state, orders, produk, inventaris, atau checkout.
CREATE TABLE IF NOT EXISTS public.catalog_branding_v331 (
  mode text PRIMARY KEY CHECK (mode IN ('student','general')),
  display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 70),
  logo_url text NOT NULL DEFAULT '' CHECK (char_length(logo_url)<=2048 AND (logo_url='' OR logo_url ~ '^https://[^[:space:]]+$')),
  primary_color text NOT NULL CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  soft_color text NOT NULL CHECK (soft_color ~ '^#[0-9A-Fa-f]{6}$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.catalog_branding_v331 (mode,display_name,logo_url,primary_color,soft_color)
VALUES
  ('student','Katalog Kiriman Santri','','#176B47','#E9F5EE'),
  ('general','Katalog Darel','','#7050E8','#F2EEFF')
ON CONFLICT (mode) DO NOTHING;

ALTER TABLE public.catalog_branding_v331 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.catalog_branding_v331 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.catalog_branding_v331 TO anon, authenticated;
GRANT INSERT, UPDATE ON TABLE public.catalog_branding_v331 TO authenticated;

DROP POLICY IF EXISTS "branding public read v331" ON public.catalog_branding_v331;
CREATE POLICY "branding public read v331" ON public.catalog_branding_v331
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "branding admin insert v331" ON public.catalog_branding_v331;
CREATE POLICY "branding admin insert v331" ON public.catalog_branding_v331
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND EXISTS
    (SELECT 1 FROM public.admin_users WHERE user_id=(SELECT auth.uid())));

DROP POLICY IF EXISTS "branding admin update v331" ON public.catalog_branding_v331;
CREATE POLICY "branding admin update v331" ON public.catalog_branding_v331
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND EXISTS
    (SELECT 1 FROM public.admin_users WHERE user_id=(SELECT auth.uid())))
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND EXISTS
    (SELECT 1 FROM public.admin_users WHERE user_id=(SELECT auth.uid())));

NOTIFY pgrst, 'reload schema';
