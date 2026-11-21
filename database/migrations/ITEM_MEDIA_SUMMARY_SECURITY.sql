-- PostgreSQL 15+. Apply after ITEM_MEDIA_STORAGE and COMPANY_MODULES.
-- The existing projection stays unchanged; access follows the caller's RLS.
begin;
alter view public.item_media_summary set (security_invoker=true);
revoke all on public.item_media_summary from public,anon,authenticated;
grant select on public.item_media_summary to anon,authenticated;
notify pgrst,'reload schema';
commit;
