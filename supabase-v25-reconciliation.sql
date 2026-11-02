-- V25: tambah catatan rekonsiliasi pembayaran terpisah dari status pesanan.
-- Jalankan setelah migrasi V24. Tidak mengubah data pesanan lama.
create table if not exists public.payment_reconciliations (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete restrict,
 amount numeric(14,0) not null check (amount > 0),
 payment_method text not null check(payment_method in ('Transfer bank','QRIS')),
 reference_no text not null check(char_length(trim(reference_no)) between 3 and 120),
 received_at timestamptz not null,
 notes text not null default '' check(char_length(notes)<=500),
 created_at timestamptz not null default now(),
 recorded_by uuid not null default auth.uid()
);
create index if not exists payment_reconciliations_order_idx on public.payment_reconciliations(order_id);
create unique index if not exists payment_reconciliations_reference_unique on public.payment_reconciliations(payment_method,lower(trim(reference_no)));
alter table public.payment_reconciliations enable row level security;
drop policy if exists "admin read reconciliations" on public.payment_reconciliations;
create policy "admin read reconciliations" on public.payment_reconciliations for select to authenticated
 using (exists(select 1 from public.admin_users a where a.user_id=(select auth.uid())));
revoke all on public.payment_reconciliations from anon, authenticated;
grant select on public.payment_reconciliations to authenticated;
-- Semua penulisan harus melalui RPC; tak ada direct INSERT/UPDATE/DELETE oleh klien.
create or replace function public.record_payment_v25(p_order_id uuid,p_amount numeric,p_method text,p_reference text,p_received_at timestamptz,p_notes text default '')
returns public.payment_reconciliations
language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.orders%rowtype; r public.payment_reconciliations%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from public.admin_users where user_id=auth.uid()) then
   raise exception 'Akses ditolak';
 end if;
 if p_amount is null or p_amount <= 0 or p_amount > 99999999999999 then raise exception 'Nominal tidak valid'; end if;
 if p_method not in ('Transfer bank','QRIS') then raise exception 'Metode tidak valid'; end if;
 if length(trim(coalesce(p_reference,''))) not between 3 and 120 then raise exception 'Referensi harus 3-120 karakter'; end if;
 if p_received_at is null or p_received_at > now() + interval '5 minutes' then raise exception 'Waktu penerimaan tidak valid'; end if;
 if length(coalesce(p_notes,''))>500 then raise exception 'Catatan terlalu panjang'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'Pesanan tidak ditemukan'; end if;
 if o.status='cancelled' or o.expired_at is not null then raise exception 'Pesanan batal/kedaluwarsa tidak dapat direkonsiliasi'; end if;
 insert into public.payment_reconciliations(order_id,amount,payment_method,reference_no,received_at,notes,recorded_by)
 values(p_order_id,p_amount,p_method,trim(p_reference),p_received_at,coalesce(p_notes,''),auth.uid()) returning * into r;
 return r;
end $$;
revoke all on function public.record_payment_v25(uuid,numeric,text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.record_payment_v25(uuid,numeric,text,text,timestamptz,text) to authenticated;
