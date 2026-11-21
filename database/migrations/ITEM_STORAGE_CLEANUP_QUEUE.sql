-- After DB_SCHEMA, ITEM_MEDIA_STORAGE, COMPANY_MEMBER_ACCESS and COMPANY_MODULES.
-- Storage bytes are removed only by the dedicated Edge worker, never with SQL DELETE.
begin;
-- Keep the tenant available to child DELETE triggers after the parent vanished,
-- including rows discovered by the FK cascade after the initial capture.
create table public.item_storage_deleted_items(item_id uuid primary key,company_id uuid not null,deleted_at timestamptz not null default now());
alter table public.item_storage_deleted_items enable row level security;
revoke all on public.item_storage_deleted_items from public,anon,authenticated,service_role;
create table public.item_storage_cleanup_queue(
 id uuid primary key default gen_random_uuid(),source_media_id uuid not null unique,
 company_id uuid not null,item_id uuid not null,url text,path text,
 status text not null default 'queued' check(status in('queued','running','done','review')),
 attempts integer not null default 0,available_at timestamptz not null default now(),
 locked_at timestamptz,lease_token uuid,retired_at timestamptz,
 last_error_code text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(path is null or (split_part(path,'/',1)=company_id::text and split_part(path,'/',2)=item_id::text))
);
create index item_storage_cleanup_ready on public.item_storage_cleanup_queue(available_at) where status in('queued','running');
create index item_storage_cleanup_path on public.item_storage_cleanup_queue(path);
alter table public.item_storage_cleanup_queue enable row level security;
revoke all on public.item_storage_cleanup_queue from public,anon,authenticated;
grant select,insert,update,delete on public.item_storage_cleanup_queue to service_role;

-- Decode ASCII URI characters used by canonical names; preserve other bytes.
create function public.item_storage_decode(p_text text) returns text
language plpgsql immutable set search_path='' as $$
begin
 if p_text is null then return null;end if;
 return (select convert_from(coalesce(string_agg(
  case when token[1] ~ '^%(09|0[aAdD]|[2-6][0-9a-fA-F]|7[0-9a-eA-E])$' then decode(substr(token[1],2,2),'hex') else convert_to(token[1],'UTF8') end,
  ''::bytea order by ordinal),''::bytea),'UTF8')
  from regexp_matches(p_text,'(%[0-9a-fA-F]{2}|[^%]+|%)','g') with ordinality as parts(token,ordinal));
exception when others then return null;
end $$;

create function public.item_storage_path(p_url text) returns text
language plpgsql immutable set search_path='' as $$
declare path text;part text;parts text[]:=array[]::text[];
begin
 path:=substring(split_part(split_part(p_url,'?',1),'#',1) from '(?i)^https?://[^/?#]+(/.*)$');
 path:=replace(public.item_storage_decode(path),chr(92),'/');
 if path is null then return null;end if;
 foreach part in array string_to_array(path,'/') loop
  if part='..' then parts:=parts[1:greatest(coalesce(array_length(parts,1),0)-1,0)];
  elsif part not in('','.') then parts:=array_append(parts,part);end if;
 end loop;
 path:=substring('/'||array_to_string(parts,'/') from '^/storage/v1/object/(?:public|sign|authenticated)/items-media/(.+)$');
 parts:=string_to_array(path,'/');
 if array_length(parts,1)<>3 or parts[1] !~ '^[0-9a-f-]{36}$' or parts[2] !~ '^[0-9a-f-]{36}$'
   or parts[3] !~ '^[A-Za-z0-9_][A-Za-z0-9_.-]*$' then return null;end if;
 return path;
end $$;
-- Normalize text links without rendering HTML or executing its contents.
create function public.item_storage_reference_text(p_text text) returns text
language plpgsql immutable set search_path='' as $$
declare result text:=public.item_storage_decode(p_text);entity text;codepoint integer;
begin
 for entity in select distinct token[1] from regexp_matches(result,'(&#[xX][0-9a-fA-F]{1,6};|&#[0-9]{1,7};)','g') as parts(token) loop
  if substr(entity,3,1) in('x','X') then
   codepoint:=('x'||lpad(substr(entity,4,length(entity)-4),8,'0'))::bit(32)::integer;
  else codepoint:=substr(entity,3,length(entity)-3)::integer;end if;
  if codepoint in(9,10,13) or codepoint between 32 and 126 then result:=replace(result,entity,chr(codepoint));end if;
 end loop;
 result:=replace(replace(replace(replace(replace(replace(replace(result,'&period;','.'),'&lowbar;','_'),'&UnderBar;','_'),'&sol;','/'),'&percnt;','%'),'&Tab;',chr(9)),'&NewLine;',chr(10));
 return public.item_storage_decode(translate(result,chr(9)||chr(10)||chr(13),''));
exception when others then return null;
end $$;
-- Text references are deliberately conservative: allow intervening dot segments
-- or markup, but require the company, item and basename to appear together.
create function public.item_storage_body_reference(p_body text,p_path text) returns boolean
language plpgsql immutable set search_path='' as $$
declare body text:=public.item_storage_reference_text(p_body);
begin
 if body is null then return position('items-media' in p_body)>0;end if;
 return position(split_part(p_path,'/',1) in body)>0 and position(split_part(p_path,'/',2) in body)>0 and position(split_part(p_path,'/',3) in body)>0;
end $$;

create function public.enqueue_item_storage_cleanup(p_company uuid,p_item uuid,p_media uuid,p_url text)
returns void language plpgsql security definer set search_path='' set row_security=off as $$
declare path text;safe_url text;
begin
 path:=public.item_storage_path(p_url);
 if split_part(path,'/',1) is distinct from p_company::text or split_part(path,'/',2) is distinct from p_item::text then path:=null;end if;
 if path is not null and length(p_url)<=4096 and p_url !~ '(?i)^https?://[^/?#]*@' then safe_url:=split_part(split_part(p_url,'?',1),'#',1);else path:=null;end if;
 insert into public.item_storage_cleanup_queue(source_media_id,company_id,item_id,url,path,status,last_error_code)
 values(p_media,p_company,p_item,safe_url,path,case when path is null then 'review' else 'queued' end,case when path is null then 'unverified_path' end)
 on conflict(source_media_id) do nothing;
end $$;
create function public.capture_item_storage_cleanup() returns trigger
language plpgsql security definer set search_path='' set row_security=off as $$
declare media record;
begin
 insert into public.item_storage_deleted_items(item_id,company_id) values(old.id,old.company_id)
 on conflict(item_id) do update set company_id=excluded.company_id,deleted_at=now();
 for media in select id,url_externa from public.item_media where item_id=old.id for update loop
  perform public.enqueue_item_storage_cleanup(old.company_id,old.id,media.id,media.url_externa);
 end loop;
 return old;
end $$;
create trigger capture_item_storage_cleanup before delete on public.items for each row execute function public.capture_item_storage_cleanup();

-- Also cover direct media removal; the parent BEFORE trigger covers FK cascades.
create or replace function public.cleanup_item_media_storage() returns trigger
language plpgsql security definer set search_path='' set row_security=off as $$
declare tenant uuid;
begin
 select company_id into tenant from public.items where id=old.item_id;
 if tenant is null then select company_id into tenant from public.item_storage_deleted_items where item_id=old.item_id;end if;
 if tenant is not null then perform public.enqueue_item_storage_cleanup(tenant,old.item_id,old.id,old.url_externa);end if;
 return old;
end $$;
drop trigger if exists trg_cleanup_item_media_storage on public.item_media;
create trigger trg_cleanup_item_media_storage after delete on public.item_media for each row execute function public.cleanup_item_media_storage();

-- Serialize new managed references with the durable tombstone. A cleanup may
-- release its lease, but it must never allow a retired object path to be reused.
create function public.guard_retired_item_storage_reference() returns trigger
language plpgsql security definer set search_path='' set row_security=off as $$
declare candidate text;body text;q record;
begin
 if tg_table_name='blog_posts' then
  body:=public.item_storage_reference_text(new.body);
  if position('items-media' in coalesce(body,new.body))=0 then return new;end if;
  for q in select * from public.item_storage_cleanup_queue where path is not null
   and (body is null or (position(split_part(path,'/',1) in body)>0 and position(split_part(path,'/',2) in body)>0 and position(split_part(path,'/',3) in body)>0)) order by id for share loop
   if q.retired_at is not null then raise exception 'Storage path retired' using errcode='42501';end if;
  end loop;
 else
  candidate:=public.item_storage_path(new.url_externa);
  for q in select * from public.item_storage_cleanup_queue where path=candidate order by id for share loop
   if q.retired_at is not null then raise exception 'Storage path retired' using errcode='42501';end if;
  end loop;
 end if;
 return new;
end $$;
create trigger guard_retired_item_storage_reference before insert or update of url_externa on public.item_media for each row execute function public.guard_retired_item_storage_reference();
create trigger guard_retired_item_storage_reference before insert or update of url_externa on public.blog_media for each row execute function public.guard_retired_item_storage_reference();
create trigger guard_retired_item_storage_reference before insert or update of body on public.blog_posts for each row execute function public.guard_retired_item_storage_reference();

create function public.claim_item_storage_cleanup(p_limit integer default 20)
returns setof public.item_storage_cleanup_queue language plpgsql security definer set search_path='' set row_security=off as $$
begin
 if p_limit is null or p_limit not between 1 and 50 then raise exception 'Invalid batch size' using errcode='22023';end if;
 update public.item_storage_cleanup_queue set status='review',locked_at=null,last_error_code='attempts_exhausted',updated_at=now()
 where attempts>=8 and (status='queued' or(status='running' and locked_at<now()-interval '10 minutes'));
 return query with ready as (
  select id from public.item_storage_cleanup_queue where attempts<8 and
   (status='queued' and available_at<=now() or status='running' and locked_at<now()-interval '10 minutes')
  order by available_at,id for update skip locked limit p_limit
 ) update public.item_storage_cleanup_queue q set status='running',attempts=attempts+1,locked_at=now(),lease_token=gen_random_uuid(),updated_at=now()
 from ready r where q.id=r.id returning q.*;
end $$;
create function public.prepare_item_storage_cleanup(p_id uuid,p_token uuid) returns boolean
language plpgsql security definer set search_path='' set row_security=off as $$
declare q public.item_storage_cleanup_queue;
begin
 select * into q from public.item_storage_cleanup_queue where id=p_id for update;
 if not found or q.status<>'running' or q.lease_token is distinct from p_token or q.locked_at is null or q.locked_at<=now()-interval '10 minutes' then return false;end if;
 if q.path is null or exists(select 1 from public.item_media where public.item_storage_path(url_externa)=q.path)
  or exists(select 1 from public.blog_media where public.item_storage_path(url_externa)=q.path)
  or exists(select 1 from public.blog_posts where public.item_storage_body_reference(body,q.path)) then
  update public.item_storage_cleanup_queue set status='review',locked_at=null,last_error_code='shared_reference',updated_at=now() where id=p_id;
  return false;
 end if;
 update public.item_storage_cleanup_queue set retired_at=coalesce(retired_at,now()),updated_at=now() where id=p_id;
 return true;
end $$;
create function public.finish_item_storage_cleanup(p_id uuid,p_token uuid,p_result text) returns boolean
language plpgsql security definer set search_path='' set row_security=off as $$
begin
 if p_result is null or p_result not in('done','retry','review') then raise exception 'Invalid cleanup result' using errcode='22023';end if;
 update public.item_storage_cleanup_queue set
  status=case when p_result='done' and retired_at is not null then 'done' when p_result='retry' and attempts<8 then 'queued' else 'review' end,
  available_at=now()+least(interval '1 hour',interval '30 seconds'*power(2,greatest(attempts-1,0))),locked_at=null,
  url=case when p_result='done' and retired_at is not null then null else url end,
  last_error_code=case when p_result='done' and retired_at is not null then null when p_result='review' then 'unverified_path' else 'cleanup_failed' end,updated_at=now()
 where id=p_id and status='running' and lease_token=p_token;
 return found;
end $$;

revoke all on function public.item_storage_decode(text),public.item_storage_path(text),public.item_storage_body_reference(text,text),public.item_storage_reference_text(text),public.enqueue_item_storage_cleanup(uuid,uuid,uuid,text),
 public.capture_item_storage_cleanup(),public.cleanup_item_media_storage(),public.guard_retired_item_storage_reference(),
 public.claim_item_storage_cleanup(integer),public.prepare_item_storage_cleanup(uuid,uuid),public.finish_item_storage_cleanup(uuid,uuid,text)
 from public,anon,authenticated,service_role;
grant execute on function public.claim_item_storage_cleanup(integer),public.prepare_item_storage_cleanup(uuid,uuid),public.finish_item_storage_cleanup(uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
