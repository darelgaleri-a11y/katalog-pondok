-- V4.1: dapat dijalankan ulang; tidak menghapus data toko, produk, atau admin.
-- Jalankan di Supabase SQL Editor (proyek yang sama).
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admin_users enable row level security;
drop policy if exists "admin can see own role" on public.admin_users;
create policy "admin can see own role" on public.admin_users for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.catalog_state (
  id int primary key check (id = 1),
  data jsonb not null default '{"stores":[],"products":[],"settings":{"maleWa":"","femaleWa":"","malePayment":"","femalePayment":"","deliveryDays":[2,5]}}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.catalog_state enable row level security;
drop policy if exists "public read catalog" on public.catalog_state;
create policy "public read catalog" on public.catalog_state for select to anon, authenticated using (true);
drop policy if exists "admin modify catalog" on public.catalog_state;
create policy "admin modify catalog" on public.catalog_state for update to authenticated
using (exists(select 1 from public.admin_users where user_id=(select auth.uid())))
with check (exists(select 1 from public.admin_users where user_id=(select auth.uid())));
insert into public.catalog_state(id) values (1) on conflict (id) do nothing;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;
drop policy if exists "public read product images" on storage.objects;
create policy "public read product images" on storage.objects for select to anon,authenticated using (bucket_id='product-images');
drop policy if exists "admin upload product images" on storage.objects;
create policy "admin upload product images" on storage.objects for insert to authenticated
with check (bucket_id='product-images' and exists(select 1 from public.admin_users where user_id=(select auth.uid())));

-- Agar perubahan katalog dapat disiarkan ke perangkat lain.
-- Realtime memerlukan tabel dalam publikasi supabase_realtime.
do $$ begin
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='catalog_state') then
  alter publication supabase_realtime add table public.catalog_state;
 end if;
end $$;

-- SETELAH membuat akun admin di Authentication > Users, jalankan sekali,
-- mengganti UUID berikut dengan ID pengguna yang sesungguhnya:
-- insert into public.admin_users(user_id) values ('UUID-ADMIN-DARI-AUTH-USERS');
