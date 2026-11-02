-- V29: Penguncian periode untuk tanggal UTC V27 yang sudah ditutup.
-- Backup database dan uji di staging. Tidak mengubah data maupun snapshot lama.
-- Pembayaran bertanggal UTC yang sudah ditutup ditolak; koreksi selalu bertanggal saat dibuat.
-- Penyesuaian pembayaran terlambat: gunakan tanggal pencatatan periode terbuka,
-- simpan tanggal bank asli di notes, bukan mengubah snapshot tertutup.
-- Penutupan V27 tetap menggunakan UTC. Laporan bulanan V28 memakai WIB: keduanya
-- mungkin berbeda pada transaksi sekitar tengah malam; V29 BELUM menyatukan kalender.
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
 -- Kunci tanggal UTC yang sedang dicatat agar tidak balapan dengan penutupan kas.
 perform pg_advisory_xact_lock(hashtextextended('cash-close-v27:'||((p_received_at at time zone 'UTC')::date)::text,0));
 if exists (select 1 from public.cash_closures_v27 where cash_date=(p_received_at at time zone 'UTC')::date) then
   raise exception 'Tanggal penerimaan UTC sudah ditutup. Catat sebagai penyesuaian pada tanggal terbuka dengan keterangan tanggal transfer asli.';
 end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'Pesanan tidak ditemukan'; end if;
 if o.status='cancelled' or o.expired_at is not null then raise exception 'Pesanan batal/kedaluwarsa tidak dapat direkonsiliasi'; end if;
 insert into public.payment_reconciliations(order_id,amount,payment_method,reference_no,received_at,notes,recorded_by)
 values(p_order_id,p_amount,p_method,trim(p_reference),p_received_at,coalesce(p_notes,''),auth.uid()) returning * into r;
 return r;
end $$;
create or replace function public.void_payment_v26(p_receipt_id uuid,p_reason text)
returns public.payment_voids_v26
language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.payment_reconciliations%rowtype; v public.payment_voids_v26%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Akses ditolak'; end if;
 if length(trim(coalesce(p_reason,''))) not between 10 and 500 then raise exception 'Alasan koreksi wajib 10-500 karakter'; end if;
 -- Koreksi dicatat hari ini (UTC), bukan dengan mengubah tanggal pembayaran lama.
 perform pg_advisory_xact_lock(hashtextextended('cash-close-v27:'||((now() at time zone 'UTC')::date)::text,0));
 if exists (select 1 from public.cash_closures_v27 where cash_date=(now() at time zone 'UTC')::date) then
  raise exception 'Tanggal koreksi UTC sudah ditutup';
 end if;
 select * into r from public.payment_reconciliations where id=p_receipt_id for update;
 if not found then raise exception 'Catatan pembayaran tidak ditemukan'; end if;
 if exists(select 1 from public.payment_voids_v26 where receipt_id=p_receipt_id) then raise exception 'Catatan ini sudah dibatalkan'; end if;
 insert into public.payment_voids_v26(receipt_id,reason,voided_by)
 values(p_receipt_id,trim(p_reason),auth.uid()) returning * into v;
 return v;
end $$;
-- Tetap izinkan pemanggilan hanya oleh akun terautentikasi;
-- setiap RPC memeriksa daftar admin_users sendiri.
revoke all on function public.record_payment_v25(uuid,numeric,text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.record_payment_v25(uuid,numeric,text,text,timestamptz,text) to authenticated;
revoke all on function public.void_payment_v26(uuid,text) from public,anon,authenticated;
grant execute on function public.void_payment_v26(uuid,text) to authenticated;
notify pgrst, 'reload schema';
