-- Public media URLs are part of the existing web contract. Planner is private.
insert into storage.buckets(id,name,public) values
 ('items-media','items-media',true),('blog-media','blog-media',true),('media-planner','media-planner',false)
on conflict(id) do update set public=excluded.public;
-- Media uploads/deletes use the authorized Edge functions with service_role.
-- Authenticated direct access is defined only for Planner by its later policies.
