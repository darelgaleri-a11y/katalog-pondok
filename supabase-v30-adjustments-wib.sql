-- V30: jurnal penyesuaian terpisah berbasis WIB. Tidak mengubah tutup kas UTC V27.
-- Jalankan hanya setelah backup dan uji staging.
create table if not exists public.cash_adjustments_v30 (
 id uuid primary key default gen_random_uuid(),
 effective_date date not null,
 amount numeric(14,2) not null check(amount <> 0 and abs(amount) <= 999999999999),
 method text not null check(method in ('Transfer bank','QRIS')),
 reference_no text not null check(char_length(trim(reference_no)) between 3 and 120),
 reason text not null check(char_length(trim(reason)) between 10 and 500),
 recorded_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(reference_no,method)
);
alter table public.cash_adjustments_v30 enable row level security;
drop policy if exists "admin read adjustments v30" on public.cash_adjustments_v30;
create policy "admin read adjustments v30" on public.cash_adjustments_v30 for select to authenticated
 using (exists(select 1 from public.admin_users where user_id=auth.uid()));
revoke all on public.cash_adjustments_v30 from anon,authenticated;
grant select on public.cash_adjustments_v30 to authenticated;

create or replace function public.record_cash_adjustment_v30(p_effective_date date,p_amount numeric,p_method text,p_reference text,p_reason text)
returns public.cash_adjustments_v30 language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.cash_adjustments_v30%rowtype; today_wib date;
begin
 if auth.uid() is null or not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Hanya admin utama'; end if;
 today_wib := (now() at time zone 'Asia/Jakarta')::date;
 if p_effective_date is null or p_effective_date > today_wib or p_effective_date < today_wib-interval '366 days' then raise exception 'Tanggal di luar rentang yang diizinkan'; end if;
 if p_amount is null or p_amount=0 or abs(p_amount)>999999999999 then raise exception 'Nominal tidak valid'; end if;
 if p_method not in ('Transfer bank','QRIS') then raise exception 'Metode pembayaran tidak valid'; end if;
 if length(trim(coalesce(p_reference,''))) not between 3 and 120 then raise exception 'Referensi tidak valid'; end if;
 if length(trim(coalesce(p_reason,''))) not between 10 and 500 then raise exception 'Alasan wajib 10-500 karakter'; end if;
 -- Pembukuan kas V27 berbasis UTC. Hindari mengisi penyesuaian WIB pada hari UTC yang sudah ditutup,
 -- sebagai langkah konservatif. Ini belum menyatukan dua kalender akuntansi.
 if exists (select 1 from public.cash_closures_v27 where cash_date=p_effective_date) then
   raise exception 'Tanggal ini sudah ditutup pada sistem kas lama; gunakan tanggal terbuka dan jelaskan tanggal asal dalam alasan';
 end if;
 insert into public.cash_adjustments_v30(effective_date,amount,method,reference_no,reason,recorded_by)
 values(p_effective_date,p_amount,p_method,trim(p_reference),trim(p_reason),auth.uid()) returning * into r;
 return r;
end $$;
revoke all on function public.record_cash_adjustment_v30(date,numeric,text,text,text) from public,anon,authenticated;
grant execute on function public.record_cash_adjustment_v30(date,numeric,text,text,text) to authenticated;

-- Laporan termasuk jurnal penyesuaian sebagai BARIS TERPISAH dari total V28.
-- Untuk menghindari penggabungan otomatis yang berpotensi menutupi selisih, angka net_total_v28
-- tidak ditimpa. net_after_adjustments adalah hitungan eksplisit baru.
create or replace function public.monthly_cash_with_adjustments_v30(p_month date)
returns table(base_net numeric,adjustment_total numeric,net_after_adjustments numeric,adjustment_count bigint)
language plpgsql security definer set search_path=public,pg_temp as $$
declare b numeric; a numeric; n bigint;
begin
 if auth.uid() is null or not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Hanya admin utama'; end if;
 if p_month is null or extract(day from p_month)<>1 then raise exception 'Pilih awal bulan'; end if;
 select m.net_total into b from public.monthly_cash_wib_v28(p_month) m;
 select coalesce(sum(x.amount),0),count(*) into a,n from public.cash_adjustments_v30 x
 where x.effective_date>=p_month and x.effective_date<(p_month+interval '1 month')::date;
 return query select coalesce(b,0),coalesce(a,0),coalesce(b,0)+coalesce(a,0),n;
end $$;
revoke all on function public.monthly_cash_with_adjustments_v30(date) from public,anon,authenticated;
grant execute on function public.monthly_cash_with_adjustments_v30(date) to authenticated;
notify pgrst,'reload schema';
