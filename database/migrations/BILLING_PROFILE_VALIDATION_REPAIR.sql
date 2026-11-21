-- Apply after BILLING_RECTIFYING_INVOICES and the audit balance/module fixes.
-- Restores cumulative validation without rewriting existing documents/profiles.
begin;
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
  foreach k in array array['name','taxId','address','email','phone','iban','payment','notes','prefix','quotePrefix','rectificationPrefix','color','logo'] loop
    if p_profile ? k and (jsonb_typeof(p_profile->k) <> 'string'
      or (k <> 'logo' and length(p_profile->>k)>2000)) then
      raise exception 'Invalid profile field: %',k using errcode='22023';
    end if;
  end loop;
  foreach k in array array['prefix','quotePrefix','rectificationPrefix'] loop
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
revoke all on function public.validate_billing_profile(jsonb) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
