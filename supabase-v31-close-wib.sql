-- V31: snapshot tutup kas WIB BARU. Tidak mengubah snapshot UTC V27.
-- Sebelum eksekusi: cadangkan database. Uji dengan pembayaran percobaan.
create table if not exists public.cash_closures_wib_v31 (
 id uuid primary key default gen_random_uuid(), cash_date date not null unique,
 receipt_count bigint not null, correction_count bigint not null, adjustment_count bigint not null,
 transfer_gross numeric not null, qris_gross numeric not null,
 transfer_corrections numeric not null, qris_corrections numeric not null,
 transfer_adjustments numeric not null, qris_adjustments numeric not null,
 net_amount numeric not null, notes text not null default '' check(char_length(notes)<=500),
 closed_by uuid not null references auth.users(id), closed_at timestamptz not null default now()
);
alter table public.cash_closures_wib_v31 enable row level security;
drop policy if exists "admin read close wib v31" on public.cash_closures_wib_v31;
create policy "admin read close wib v31" on public.cash_closures_wib_v31 for select to authenticated
 using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
revoke all on public.cash_closures_wib_v31 from public,anon,authenticated;
grant select on public.cash_closures_wib_v31 to authenticated;

create or replace function public.close_cash_wib_v31(p_date date,p_notes text default '')
returns public.cash_closures_wib_v31
language plpgsql security definer set search_path=public,pg_temp as $$
declare outrow public.cash_closures_wib_v31%rowtype;
 st timestamptz; en timestamptz;
 rc bigint; vc bigint; ac bigint; tg numeric; qg numeric; tc numeric; qc numeric; ta numeric; qa numeric;
begin
 if auth.uid() is null or not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Hanya admin utama'; end if;
 if p_date is null or p_date >= (now() at time zone 'Asia/Jakarta')::date then raise exception 'Hanya tanggal WIB yang sudah berlalu'; end if;
 if length(coalesce(p_notes,''))>500 then raise exception 'Catatan maksimal 500 karakter'; end if;
 perform pg_advisory_xact_lock(hashtextextended('close-wib-v31:'||p_date::text,0));
 if exists(select 1 from public.cash_closures_wib_v31 where cash_date=p_date) then raise exception 'Tanggal WIB sudah ditutup'; end if;
 st := p_date::timestamp at time zone 'Asia/Jakarta';
 en := (p_date+1)::timestamp at time zone 'Asia/Jakarta';
 select count(*),coalesce(sum(amount) filter(where payment_method='Transfer bank'),0),coalesce(sum(amount) filter(where payment_method='QRIS'),0)
 into rc,tg,qg from public.payment_reconciliations where received_at>=st and received_at<en;
 select count(*),coalesce(sum(r.amount) filter(where r.payment_method='Transfer bank'),0),coalesce(sum(r.amount) filter(where r.payment_method='QRIS'),0)
 into vc,tc,qc from public.payment_voids_v26 v join public.payment_reconciliations r on r.id=v.receipt_id where v.voided_at>=st and v.voided_at<en;
 select count(*),coalesce(sum(amount) filter(where method='Transfer bank'),0),coalesce(sum(amount) filter(where method='QRIS'),0)
 into ac,ta,qa from public.cash_adjustments_v30 where effective_date=p_date;
 insert into public.cash_closures_wib_v31(cash_date,receipt_count,correction_count,adjustment_count,transfer_gross,qris_gross,transfer_corrections,qris_corrections,transfer_adjustments,qris_adjustments,net_amount,notes,closed_by)
 values(p_date,rc,vc,ac,tg,qg,tc,qc,ta,qa,tg+qg-tc-qc+ta+qa,coalesce(p_notes,''),auth.uid()) returning * into outrow;
 return outrow;
end $$;
revoke all on function public.close_cash_wib_v31(date,text) from public,anon,authenticated;
grant execute on function public.close_cash_wib_v31(date,text) to authenticated;
notify pgrst,'reload schema';
-- KETERBATASAN: fungsi pembayaran dan jurnal versi sebelumnya TIDAK dikunci oleh penutupan WIB ini.
-- V31 adalah snapshot audit, BUKAN penguncian periode WIB yang menyeluruh.
