-- V20: bukti penerimaan sederhana. Jalankan SETELAH V19.
-- Tidak menghapus catatan sebelumnya; kolom baru nullable untuk catatan V18/V19.
alter table public.student_handovers
  add column if not exists recipient_name text,
  add column if not exists receipt_method text;

alter table public.student_handovers drop constraint if exists receipt_method_allowed_v20;
alter table public.student_handovers add constraint receipt_method_allowed_v20
  check (receipt_method is null or receipt_method in ('langsung','perwakilan_pondok'));

-- Tutup jalur pencatatan lama oleh petugas: hanya jalur baru yang menyimpan bukti.
revoke execute on function public.staff_handover_v19(uuid) from public, anon, authenticated;

create or replace function public.staff_orders_v19(p_delivery_date date default null, p_limit integer default 200, p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.student_staff%rowtype; result jsonb;
begin
 select * into s from public.student_staff where user_id=(select auth.uid()) and active=true;
 if not found then raise exception 'Akun bukan petugas aktif'; end if;
 if p_limit not between 1 and 200 or p_offset < 0 then raise exception 'Batas halaman tidak sah'; end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.delivery_date,q.created_at), '[]'::jsonb) into result
 from (
   select o.id,o.delivery_date,o.student_name,o.student_room,o.items,o.status,o.created_at,
          h.handed_at,h.officer_name as handed_by,h.recipient_name,h.receipt_method
   from public.orders o
   left join public.student_handovers h on h.order_id=o.id
   where o.mode='student' and o.student_gender=s.gender
     and o.status in ('paid','prepared','completed') and o.expired_at is null
     and (p_delivery_date is null or o.delivery_date=p_delivery_date)
   order by o.delivery_date asc,o.created_at asc,o.id asc
   limit p_limit offset p_offset
 ) q;
 return result;
end $$;
revoke all on function public.staff_orders_v19(date,integer,integer) from public,anon,authenticated;
grant execute on function public.staff_orders_v19(date,integer,integer) to authenticated;

create or replace function public.staff_receipt_v20(
 p_order_id uuid, p_recipient_name text, p_receipt_method text
) returns void language plpgsql security definer set search_path = '' as $$
declare s public.student_staff%rowtype; o public.orders%rowtype;
begin
 select * into s from public.student_staff where user_id=(select auth.uid()) and active=true;
 if not found then raise exception 'Akun bukan petugas aktif'; end if;
 if length(trim(coalesce(p_recipient_name,''))) not between 2 and 100 then
  raise exception 'Nama penerima wajib diisi (2–100 karakter)'; end if;
 if p_receipt_method not in ('langsung','perwakilan_pondok') or p_receipt_method is null then
  raise exception 'Pilih cara konfirmasi penerima'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.mode<>'student' or o.student_gender<>s.gender then
  raise exception 'Pesanan bukan bagian petugas ini'; end if;
 if o.status not in ('paid','prepared','completed') or o.expired_at is not null then
  raise exception 'Pesanan belum diverifikasi atau telah dibatalkan'; end if;
 if exists(select 1 from public.student_handovers where order_id=p_order_id) then
  raise exception 'Serah-terima sudah tercatat'; end if;
 insert into public.student_handovers(order_id,officer_name,recorded_by,recipient_name,receipt_method)
 values(p_order_id,s.officer_name,(select auth.uid()),trim(p_recipient_name),p_receipt_method);
end $$;
revoke all on function public.staff_receipt_v20(uuid,text,text) from public,anon,authenticated;
grant execute on function public.staff_receipt_v20(uuid,text,text) to authenticated;
notify pgrst, 'reload schema';
