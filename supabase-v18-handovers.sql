-- V18: jalankan sekali setelah V17. Tidak menghapus pesanan lama.
create table if not exists public.student_handovers (
 order_id uuid primary key references public.orders(id) on delete restrict,
 handed_at timestamptz not null default now(),
 officer_name text not null check (char_length(trim(officer_name)) between 1 and 100),
 recorded_by uuid not null references auth.users(id),
 notes text not null default ''
);
alter table public.student_handovers enable row level security;
drop policy if exists "admin read student handovers" on public.student_handovers;
create policy "admin read student handovers" on public.student_handovers
 for select to authenticated using (exists(select 1 from public.admin_users a where a.user_id=(select auth.uid())));
revoke all on public.student_handovers from public,anon,authenticated;
grant select on public.student_handovers to authenticated;

create or replace function public.record_student_handover_v18(p_order_id uuid,p_officer_name text)
returns void language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.admin_users where user_id=(select auth.uid())) then
  raise exception 'Hanya admin utama yang boleh mencatat serah-terima';
 end if;
 if char_length(trim(coalesce(p_officer_name,''))) not between 1 and 100 then
  raise exception 'Nama petugas wajib diisi, maksimal 100 karakter';
 end if;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found or v_order.mode <> 'student' then raise exception 'Pesanan santri tidak ditemukan'; end if;
 if v_order.status not in ('paid','prepared','completed') or v_order.expired_at is not null then
  raise exception 'Penyerahan hanya untuk pesanan yang sudah diverifikasi, bukan batal/kedaluwarsa';
 end if;
 if exists(select 1 from public.student_handovers where order_id=p_order_id) then
  raise exception 'Penyerahan sudah tercatat; tidak boleh dicatat dua kali';
 end if;
 insert into public.student_handovers(order_id,officer_name,recorded_by)
 values(p_order_id,trim(p_officer_name),(select auth.uid()));
end $$;
revoke all on function public.record_student_handover_v18(uuid,text) from public,anon,authenticated;
grant execute on function public.record_student_handover_v18(uuid,text) to authenticated;
notify pgrst, 'reload schema';
