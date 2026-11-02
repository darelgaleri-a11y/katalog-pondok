-- V26: Pembatalan catatan pembayaran dengan jejak audit (bukan edit/hapus).
-- Backup database dahulu. Jalankan sesudah V25.
create table if not exists public.payment_voids_v26 (
 id uuid primary key default gen_random_uuid(),
 receipt_id uuid not null unique references public.payment_reconciliations(id) on delete restrict,
 reason text not null check (char_length(trim(reason)) between 10 and 500),
 voided_at timestamptz not null default now(),
 voided_by uuid not null default auth.uid()
);
create index if not exists payment_voids_v26_time_idx on public.payment_voids_v26(voided_at);
alter table public.payment_voids_v26 enable row level security;
drop policy if exists "admin read payment voids v26" on public.payment_voids_v26;
create policy "admin read payment voids v26" on public.payment_voids_v26 for select to authenticated
 using (exists(select 1 from public.admin_users a where a.user_id=(select auth.uid())));
revoke all on public.payment_voids_v26 from public,anon,authenticated;
grant select on public.payment_voids_v26 to authenticated;
create or replace function public.void_payment_v26(p_receipt_id uuid,p_reason text)
returns public.payment_voids_v26
language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.payment_reconciliations%rowtype; v public.payment_voids_v26%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Akses ditolak'; end if;
 if length(trim(coalesce(p_reason,''))) not between 10 and 500 then raise exception 'Alasan koreksi wajib 10-500 karakter'; end if;
 select * into r from public.payment_reconciliations where id=p_receipt_id for update;
 if not found then raise exception 'Catatan pembayaran tidak ditemukan'; end if;
 if exists(select 1 from public.payment_voids_v26 where receipt_id=p_receipt_id) then raise exception 'Catatan ini sudah dibatalkan'; end if;
 insert into public.payment_voids_v26(receipt_id,reason,voided_by)
 values(p_receipt_id,trim(p_reason),auth.uid()) returning * into v;
 return v;
end $$;
revoke all on function public.void_payment_v26(uuid,text) from public,anon,authenticated;
grant execute on function public.void_payment_v26(uuid,text) to authenticated;
-- Jangan hapus catatan pembayaran lama. Referensi pembayaran V25 yang dibatalkan
-- tetap unik dan tidak dapat digunakan ulang; pakai referensi koreksi baru.
