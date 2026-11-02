-- V13 SECURITY AUDIT — READ ONLY. Run in Supabase SQL Editor.
-- Do not post output publicly if it contains identifiers.
-- (1) RLS for app tables.
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p')
  and c.relname in ('orders','catalog_state','admin_users','order_status_history')
order by c.relname;

-- (2) Policies. Inspect any permissive SELECT policy for anon or PUBLIC.
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname='public'
  and tablename in ('orders','catalog_state','admin_users','order_status_history')
order by tablename, policyname;

-- (3) Table privileges for public API roles.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema='public'
  and table_name in ('orders','catalog_state','admin_users','order_status_history')
  and grantee in ('anon','authenticated','PUBLIC')
order by table_name, grantee, privilege_type;

-- (4) Callable app functions and EXECUTE permissions.
select p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('create_checkout_v6','create_checkout_v6_original',
                   'create_checkout_v9_previous','update_order_status_v7',
                   'expire_pending_orders_v8','expire_pending_orders_v8_internal',
                   'save_catalog_v10','set_product_stock_v10')
order by p.proname;

-- (5) Are product images public? Expected yes for catalog images.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets where id='product-images';
