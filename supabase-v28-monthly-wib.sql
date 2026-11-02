-- V28: laporan bulanan WIB, read-only, hanya admin utama.
-- Tidak mengubah atau mengunci transaksi dan tidak mengubah snapshot UTC V27.
create or replace function public.monthly_cash_wib_v28(p_month date)
returns table(payment_count bigint, correction_count bigint, transfer_gross numeric, qris_gross numeric, transfer_corrections numeric, qris_corrections numeric, gross_total numeric, correction_total numeric, net_total numeric)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_start timestamptz; v_end timestamptz;
begin
  if auth.uid() is null or not exists(select 1 from public.admin_users a where a.user_id=auth.uid()) then
    raise exception 'Hanya admin utama';
  end if;
  if p_month is null or extract(day from p_month) <> 1 then raise exception 'Masukkan tanggal pertama pada bulan laporan'; end if;
  v_start := p_month::timestamp at time zone 'Asia/Jakarta';
  v_end := (p_month + interval '1 month')::timestamp at time zone 'Asia/Jakarta';
  return query
  with receipts as (
    select count(*)::bigint as n,
      coalesce(sum(r.amount) filter(where r.payment_method='Transfer bank'),0)::numeric as tr,
      coalesce(sum(r.amount) filter(where r.payment_method='QRIS'),0)::numeric as qr
    from public.payment_reconciliations r
    where r.received_at>=v_start and r.received_at<v_end
  ), corrections as (
    select count(*)::bigint as n,
      coalesce(sum(r.amount) filter(where r.payment_method='Transfer bank'),0)::numeric as tr,
      coalesce(sum(r.amount) filter(where r.payment_method='QRIS'),0)::numeric as qr
    from public.payment_voids_v26 v join public.payment_reconciliations r on r.id=v.receipt_id
    where v.voided_at>=v_start and v.voided_at<v_end
  )
  select a.n,b.n,a.tr,a.qr,b.tr,b.qr,a.tr+a.qr,b.tr+b.qr,a.tr+a.qr-b.tr-b.qr
  from receipts a cross join corrections b;
end $$;
revoke all on function public.monthly_cash_wib_v28(date) from public,anon,authenticated;
grant execute on function public.monthly_cash_wib_v28(date) to authenticated;
