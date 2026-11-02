-- V21: Samakan bukti penerimaan admin dengan petugas V20.
-- Jalankan setelah supabase-v20-receipt.sql. Tidak mengubah data serah-terima lama.
-- Petugas V20 tetap menggunakan staff_receipt_v20.

revoke execute on function public.record_student_handover_v18(uuid,text) from public,anon,authenticated;

create or replace function public.admin_receipt_v21(
 p_order_id uuid, p_officer_name text, p_recipient_name text, p_receipt_method text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype;
begin
 if (select auth.uid()) is null or not exists(
  select 1 from public.admin_users where user_id=(select auth.uid())
 ) then raise exception 'Hanya admin utama yang dapat mencatat penyerahan'; end if;
 if length(trim(coalesce(p_officer_name,''))) not between 1 and 100 then
  raise exception 'Nama petugas wajib diisi, maksimal 100 karakter'; end if;
 if length(trim(coalesce(p_recipient_name,''))) not between 2 and 100 then
  raise exception 'Nama penerima wajib diisi (2–100 karakter)'; end if;
 if p_receipt_method is null or p_receipt_method not in ('langsung','perwakilan_pondok') then
  raise exception 'Cara penerimaan tidak sah'; end if;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found or v_order.mode <> 'student' then raise exception 'Pesanan santri tidak ditemukan'; end if;
 if v_order.status not in ('paid','prepared','completed') or v_order.expired_at is not null then
  raise exception 'Pesanan belum diverifikasi atau telah dibatalkan/kedaluwarsa'; end if;
 if exists(select 1 from public.student_handovers where order_id=p_order_id) then
  raise exception 'Penyerahan sudah pernah dicatat'; end if;
 insert into public.student_handovers(order_id,officer_name,recorded_by,recipient_name,receipt_method)
 values(p_order_id,trim(p_officer_name),(select auth.uid()),trim(p_recipient_name),p_receipt_method);
end $$;
revoke all on function public.admin_receipt_v21(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_receipt_v21(uuid,text,text,text) to authenticated;
notify pgrst, 'reload schema';
