-- V19: hanya tambah akun petugas dan fungsi terbatas. Jalankan setelah V18.
create table if not exists public.student_staff (
 user_id uuid primary key references auth.users(id) on delete cascade,
 gender text not null check(gender in ('male','female')),
 officer_name text not null check(length(trim(officer_name)) between 1 and 100),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.student_staff enable row level security;
revoke all on public.student_staff from public, anon, authenticated;
-- Tidak membuat policy baca langsung; akses hanya melalui RPC.

create or replace function public.my_staff_profile_v19()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.student_staff%rowtype;
begin
 select * into s from public.student_staff where user_id = (select auth.uid()) and active=true;
 if not found then return null; end if;
 return jsonb_build_object('gender',s.gender,'officer_name',s.officer_name);
end $$;
revoke all on function public.my_staff_profile_v19() from public, anon, authenticated;
grant execute on function public.my_staff_profile_v19() to authenticated;

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
          h.handed_at,h.officer_name as handed_by
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

create or replace function public.staff_handover_v19(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.student_staff%rowtype; o public.orders%rowtype;
begin
 select * into s from public.student_staff where user_id=(select auth.uid()) and active=true;
 if not found then raise exception 'Akun bukan petugas aktif'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.mode<>'student' or o.student_gender<>s.gender then
    raise exception 'Pesanan bukan bagian petugas ini'; end if;
 if o.status not in ('paid','prepared','completed') or o.expired_at is not null then
    raise exception 'Pesanan belum diverifikasi atau telah dibatalkan'; end if;
 if exists(select 1 from public.student_handovers where order_id=p_order_id) then
    raise exception 'Serah-terima sudah tercatat'; end if;
 insert into public.student_handovers(order_id, officer_name,recorded_by)
 values(p_order_id,s.officer_name,(select auth.uid()));
end $$;
revoke all on function public.staff_handover_v19(uuid) from public,anon,authenticated;
grant execute on function public.staff_handover_v19(uuid) to authenticated;
notify pgrst, 'reload schema';

-- CARA DAFTAR PETUGAS (jalankan terpisah, setelah membuat akun pada Authentication > Users):
-- insert into public.student_staff(user_id,gender,officer_name)
-- values ('UUID-USER-PETUGAS-DI-SINI','male','Nama Petugas Putra');
-- untuk petugas putri gunakan gender 'female'.
