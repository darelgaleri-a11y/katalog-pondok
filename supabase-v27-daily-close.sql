-- V27: tutup kas UTC, snapshot immutable, hanya admin utama.
-- Jalankan pada proyek Supabase yang sama SETELAH V26. Cadangkan database sebelum migrasi.
-- Tutup kas tidak mengubah pembayaran, pembatalan, maupun stok.
create table if not exists public.cash_closures_v27 (
 id uuid primary key default gen_random_uuid(),
 cash_date date not null unique,
 receipt_count bigint not null,
 correction_count bigint not null,
 gross_amount numeric(18,0) not null,
 corrections_amount numeric(18,0) not null,
 net_amount numeric(18,0) not null,
 transfer_net numeric(18,0) not null,
 qris_net numeric(18,0) not null,
 notes text not null default '' check(char_length(notes)<=500),
 closed_by uuid not null references auth.users(id),
 closed_at timestamptz not null default now()
);
alter table public.cash_closures_v27 enable row level security;
drop policy if exists "admin read cash closures v27" on public.cash_closures_v27;
create policy "admin read cash closures v27" on public.cash_closures_v27 for select to authenticated
using (exists(select 1 from public.admin_users a where a.user_id=(select auth.uid())));
revoke all on public.cash_closures_v27 from public, anon, authenticated;
grant select on public.cash_closures_v27 to authenticated;

create or replace function public.close_cash_day_v27(p_date date,p_notes text default '')
returns public.cash_closures_v27
language plpgsql security definer set search_path=public,pg_temp as $$
declare row_out public.cash_closures_v27%rowtype;
        v_gross numeric; v_corr numeric; v_t numeric; v_q numeric; v_rc bigint; v_vc bigint; strict_v_t numeric; strict_v_q numeric;
begin
 if auth.uid() is null or not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Akses admin ditolak'; end if;
 if p_date is null or p_date >= (now() at time zone 'UTC')::date then raise exception 'Hanya tanggal UTC yang sudah berlalu dapat ditutup'; end if;
 if length(coalesce(p_notes,''))>500 then raise exception 'Catatan maksimal 500 karakter'; end if;
 perform pg_advisory_xact_lock(hashtextextended('cash-close-v27:'||p_date::text,0));
 if exists(select 1 from public.cash_closures_v27 where cash_date=p_date) then raise exception 'Tanggal kas sudah ditutup'; end if;
 select count(*),coalesce(sum(amount),0),
  coalesce(sum(amount) filter(where payment_method='Transfer bank'),0),
  coalesce(sum(amount) filter(where payment_method='QRIS'),0)
 into v_rc,v_gross,v_t,v_q
 from public.payment_reconciliations
 where received_at >= p_date::timestamp at time zone 'UTC' and received_at < (p_date+1)::timestamp at time zone 'UTC';
 select count(*),coalesce(sum(r.amount),0),
  coalesce(sum(r.amount) filter(where r.payment_method='Transfer bank'),0),
  coalesce(sum(r.amount) filter(where r.payment_method='QRIS'),0)
 into v_vc,v_corr,strict_v_t,strict_v_q
 from public.payment_voids_v26 v join public.payment_reconciliations r on r.id=v.receipt_id
 where v.voided_at >= p_date::timestamp at time zone 'UTC' and v.voided_at < (p_date+1)::timestamp at time zone 'UTC';
 insert into public.cash_closures_v27(cash_date,receipt_count,correction_count,gross_amount,corrections_amount,net_amount,transfer_net,qris_net,notes,closed_by)
 values(p_date,v_rc,v_vc,v_gross,v_corr,v_gross-v_corr,v_t-strict_v_t,v_q-strict_v_q,coalesce(p_notes,''),auth.uid()) returning * into row_out;
 return row_out;
end $$;
revoke all on function public.close_cash_day_v27(date,text) from public,anon,authenticated;
grant execute on function public.close_cash_day_v27(date,text) to authenticated;
