-- Apply after BILLING_SECURITY_HARDENING.sql and BILLING_DOCUMENT_PRESENTATION.sql.
-- Extends validation only. Existing profiles/documents are never rewritten.
begin;
create or replace function public.billing_palette_luminance(p_hex text)
returns double precision language plpgsql immutable strict set search_path = '' as $$
declare rgb bytea; channel double precision; result double precision:=0; i integer;
begin
  if p_hex !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Invalid palette color' using errcode='22023'; end if;
  rgb:=decode(substring(p_hex from 2),'hex');
  for i in 0..2 loop
    channel:=get_byte(rgb,i)::double precision/255;
    channel:=case when channel<=0.04045 then channel/12.92 else power((channel+0.055)/1.055,2.4) end;
    result:=result+channel*(case i when 0 then 0.2126 when 1 then 0.7152 else 0.0722 end);
  end loop;
  return result;
end $$;
create or replace function public.billing_palette_contrast(p_first text,p_second text)
returns double precision language sql immutable strict set search_path = '' as $$
  select (greatest(public.billing_palette_luminance(p_first),public.billing_palette_luminance(p_second))+0.05)
    /(least(public.billing_palette_luminance(p_first),public.billing_palette_luminance(p_second))+0.05)
$$;
create or replace function public.validate_billing_palette(p_palette jsonb)
returns void language plpgsql set search_path = '' as $$
declare role_name text; background text;
begin
  if p_palette is null or jsonb_typeof(p_palette) is distinct from 'object' then
    raise exception 'Invalid palette' using errcode='22023';
  end if;
  if (select count(*) from jsonb_object_keys(p_palette))<>6
    or jsonb_typeof(p_palette->'id') is distinct from 'string'
    or p_palette->>'id' not in ('graphite','ocean','olive','custom') then
    raise exception 'Invalid palette identity' using errcode='22023';
  end if;
  foreach role_name in array array['accent','ink','muted','paper','surface'] loop
    if jsonb_typeof(p_palette->role_name) is distinct from 'string'
      or p_palette->>role_name !~ '^#[0-9A-Fa-f]{6}$' then
      raise exception 'Invalid palette color' using errcode='22023';
    end if;
  end loop;
  foreach role_name in array array['ink','muted'] loop
    foreach background in array array['paper','surface'] loop
      if public.billing_palette_contrast(p_palette->>role_name,p_palette->>background)<4.5 then
        raise exception 'Insufficient palette contrast' using errcode='22023';
      end if;
    end loop;
  end loop;
  if public.billing_palette_contrast(p_palette->>'accent',p_palette->>'paper')<4.5 then
    raise exception 'Insufficient palette contrast' using errcode='22023';
  end if;
end $$;

create or replace function public.validate_billing_profile(p_profile jsonb)
returns void language plpgsql set search_path = '' as $$
declare k text; logo_bytes bytea;
begin
  if p_profile is null or jsonb_typeof(p_profile) <> 'object' or octet_length(p_profile::text)>1500000 then
    raise exception 'Invalid billing profile' using errcode='22023';
  end if;
  foreach k in array array['name','taxId','address'] loop
    if jsonb_typeof(p_profile->k) is distinct from 'string' or length(trim(p_profile->>k))=0 then
      raise exception 'Missing issuer field: %',k using errcode='22023';
    end if;
  end loop;
  foreach k in array array['name','taxId','address','email','phone','iban','payment','notes','prefix','quotePrefix','color','logo'] loop
    if p_profile ? k and (jsonb_typeof(p_profile->k) <> 'string'
      or (k <> 'logo' and length(p_profile->>k)>2000)) then
      raise exception 'Invalid profile field: %',k using errcode='22023';
    end if;
  end loop;
  foreach k in array array['prefix','quotePrefix'] loop
    if p_profile ? k and (p_profile->>k) !~ '^[A-Za-z0-9_-]{1,20}$' then
      raise exception 'Invalid numbering series' using errcode='22023';
    end if;
  end loop;
  if p_profile ? 'color' and p_profile->>'color' !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Invalid template color' using errcode='22023';
  end if;
  if coalesce(p_profile->>'logo','') <> '' and
    (length(p_profile->>'logo')>1400000 or p_profile->>'logo' !~ '^data:image/(png|jpeg);base64,[A-Za-z0-9+/]+=*$') then
    raise exception 'Invalid logo; only inline PNG/JPEG is allowed' using errcode='22023';
  end if;
  if p_profile ? 'palette' then perform public.validate_billing_palette(p_profile->'palette'); end if;
  if coalesce(p_profile->>'logo','') <> '' then
    begin
      logo_bytes:=decode(split_part(p_profile->>'logo',',',2),'base64');
    exception when others then raise exception 'Invalid logo encoding' using errcode='22023'; end;
    if (p_profile->>'logo' like 'data:image/png;%' and
        (octet_length(logo_bytes)<24 or encode(substring(logo_bytes from 1 for 8),'hex')<>'89504e470d0a1a0a'))
      or (p_profile->>'logo' like 'data:image/jpeg;%' and
        (octet_length(logo_bytes)<4 or encode(substring(logo_bytes from 1 for 3),'hex')<>'ffd8ff')) then
      raise exception 'Invalid logo image signature' using errcode='22023';
    end if;
  end if;
end $$;

revoke all on function public.billing_palette_luminance(text),public.billing_palette_contrast(text,text),
  public.validate_billing_palette(jsonb),public.validate_billing_profile(jsonb) from public,anon,authenticated;
notify pgrst, 'reload schema';
commit;
