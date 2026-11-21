-- Comprobaciones de seguridad SOLO LECTURA (auditoría 21/11/2026).
-- Ejecutar en el SQL Editor de Supabase. No modifica nada: solo SELECT sobre el catálogo.
-- Sirve para detectar diferencias entre producción y el repositorio (políticas creadas a mano,
-- migraciones sin aplicar...). Resultado esperado de cada bloque en su comentario.

-- 1) Tablas de public sin RLS. Esperado: ninguna fila.
select c.relname as tabla_sin_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
order by 1;

-- 2) Políticas permisivas de lectura abiertas (using true). Esperado: ninguna fila
--    (antes de ITEM_MEDIA_PUBLIC_READ_FIX.sql aparece item_media.item_media_public_select).
select tablename, policyname, roles::text, cmd
from pg_policies
where schemaname = 'public' and permissive = 'PERMISSIVE' and cmd in ('SELECT', 'ALL') and btrim(qual) = 'true'
order by 1, 2;

-- 3) Funciones SECURITY DEFINER sin search_path fijo. Esperado: ninguna fila.
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')
order by 1;

-- 4) Permisos de escritura del rol anónimo sobre tablas. Esperado: ninguna fila.
select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public' and privilege_type <> 'SELECT'
order by 1, 2;

-- 5) Tablas que el rol anónimo puede leer. Esperado exactamente: attribute_definitions,
--    attribute_values, blog_media, blog_posts, companies, item_media, item_media_summary, items
--    (las políticas limitan las filas a lo publicado; companies no tiene política para anon).
select table_name
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public' and privilege_type = 'SELECT'
order by 1;

-- 6) Funciones SECURITY DEFINER que el rol anónimo puede ejecutar. Esperado exactamente:
--    can_access_planner_object, can_write_blog_object, get_quote_approval_details,
--    has_company_role, is_company_member, is_company_module_enabled, respond_to_quote_approval.
select p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
order by 1;

-- 7) Buckets. Esperado: blog-media público (5 MB, solo imágenes), items-media público,
--    media-planner PRIVADO. Cualquier otro bucket público merece revisión.
select id, public, file_size_limit, allowed_mime_types from storage.buckets order by 1;

-- 8) Políticas de Storage. Revisar que no haya ninguna con using/with check (true) para
--    anon o public fuera de las previstas en STORAGE_BUCKETS.sql y BLOG_MEDIA_EDITOR.sql.
select policyname, permissive, roles::text, cmd, qual, with_check
from pg_policies where schemaname = 'storage' order by 1;
