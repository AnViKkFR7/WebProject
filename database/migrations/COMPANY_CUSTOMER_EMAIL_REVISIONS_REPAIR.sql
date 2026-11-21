-- Restores the template revision table if an earlier email-template migration
-- was interrupted after creating the current settings table.
-- Apply after COMPANY_CUSTOMER_EMAIL_TEMPLATES.sql and before COMPANY_MODULES_SCOPE_FIX.sql.
begin;

create table if not exists public.company_customer_email_revisions (
  revision_id uuid primary key default gen_random_uuid(),
  revision_seq bigint generated always as identity unique,
  company_id uuid not null references public.companies(id) on delete cascade,
  settings jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists company_customer_email_revisions_recent_idx
  on public.company_customer_email_revisions(company_id,revision_seq desc);

alter table public.company_customer_email_revisions enable row level security;
revoke all on public.company_customer_email_revisions from public,anon,authenticated;
grant select,insert,update,delete on public.company_customer_email_revisions to service_role;

commit;
