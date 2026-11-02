-- V5: tambahan ke database V4.1, tidak menghapus data lama.
create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 mode text not null check(mode in ('general','student')),
 customer_name text not null check(char_length(customer_name) between 1 and 150),
 customer_phone text not null check(char_length(customer_phone) between 5 and 32),
 student_name text,
 student_room text,
 student_gender text check(student_gender is null or student_gender in ('male','female')),
 delivery_date date,
 payment_method text not null check(payment_method in ('Transfer bank','QRIS')),
 note text,
 cashier_wa text not null,
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 100),
 total_estimate numeric(14,0) not null check(total_estimate>=0),
 status text not null default 'awaiting_confirmation' check(status in ('awaiting_confirmation','confirmed','paid','prepared','completed','cancelled'))
);
create index if not exists orders_created_idx on public.orders(created_at desc);
alter table public.orders enable row level security;
-- Pelanggan hanya boleh membuat pesanan; mereka tidak dapat membaca identitas pelanggan lain.
drop policy if exists "customer create order" on public.orders;
create policy "customer create order" on public.orders for insert to anon,authenticated
with check(status='awaiting_confirmation' and char_length(coalesce(note,''))<=2000);
drop policy if exists "admin read orders" on public.orders;
create policy "admin read orders" on public.orders for select to authenticated
using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
drop policy if exists "admin update orders" on public.orders;
create policy "admin update orders" on public.orders for update to authenticated
using(exists(select 1 from public.admin_users where user_id=(select auth.uid())))
with check(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
-- Kolom yang boleh diubah oleh admin (tidak perlu mengubah harga dan identitas):
revoke update on public.orders from authenticated;
grant update(status) on public.orders to authenticated;
grant select, insert on public.orders to anon, authenticated;
-- Hindari akses publik via SELECT: RLS tetap membatasi hanya admin.
