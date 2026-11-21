-- Explicit base privileges: PostgreSQL grants and RLS are both required.
grant usage on schema public to anon,authenticated,service_role;
grant select on public.companies,public.items,public.attribute_definitions,public.attribute_values,public.item_media,public.blog_posts,public.blog_media to anon;
grant select,insert,update,delete on public.companies,public.company_members,public.items,public.attribute_definitions,public.attribute_values,public.item_media,public.blog_posts,public.blog_media,public.planning_task,public.billing to authenticated;
grant select on public.client_company,public.analytics_event_definitions,public.analytics_daily,public.lead to authenticated;
grant select on public.analytics_events to authenticated;
grant select,insert,update,delete on public.user_filter_preferences,public.analytics_event_definitions to authenticated;
grant update(status,notes,handled_by),delete on public.lead to authenticated;
grant all on all tables in schema public to service_role;
-- Never grant TRUNCATE to browser roles; RLS cannot constrain it.
revoke truncate,references,trigger on all tables in schema public from anon,authenticated;
notify pgrst,'reload schema';
