-- New databases only. Reviewed historical DDL; never execute BDD_REFERENCIA as a bootstrap.
CREATE TABLE public.client_company (
  user_id uuid,
  name text NOT NULL,
  phone text,
  email text,
  responsible text,
  color text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  company_id uuid,
  CONSTRAINT client_company_pkey PRIMARY KEY (id),
  CONSTRAINT client_company_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT client_company_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

CREATE TABLE public.planning_task (
  client_company_id uuid,
  title text NOT NULL,
  description text,
  type text CHECK (type = ANY (ARRAY['recibir_pago'::text, 'realizar_pago'::text, 'todo'::text, 'entregable'::text, 'reunion'::text])),
  start_datetime timestamp with time zone NOT NULL,
  end_datetime timestamp with time zone,
  recurrence_value integer,
  files jsonb,
  created_by uuid,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  is_all_day boolean DEFAULT false,
  recurrence_type text DEFAULT 'none'::text CHECK (recurrence_type = ANY (ARRAY['none'::text, 'hourly'::text, 'daily'::text, 'weekly'::text, 'yearly'::text])),
  created_at timestamp with time zone DEFAULT now(),
  company_id uuid,
  attachments jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT planning_task_pkey PRIMARY KEY (id),
  CONSTRAINT planning_task_client_company_id_fkey FOREIGN KEY (client_company_id) REFERENCES public.client_company(id),
  CONSTRAINT planning_task_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT planning_task_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

CREATE TABLE public.billing (
  client_company_id uuid,
  title text NOT NULL,
  description text,
  billing_date date NOT NULL,
  amount numeric NOT NULL,
  direction text CHECK (direction = ANY (ARRAY['pagar'::text, 'cobrar'::text])),
  recurrence_value integer,
  files jsonb,
  created_by uuid,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  recurrence_type text DEFAULT 'none'::text CHECK (recurrence_type = ANY (ARRAY['none'::text, 'hourly'::text, 'daily'::text, 'weekly'::text, 'yearly'::text])),
  created_at timestamp with time zone DEFAULT now(),
  company_id uuid,
  attachments jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT billing_pkey PRIMARY KEY (id),
  CONSTRAINT billing_client_company_id_fkey FOREIGN KEY (client_company_id) REFERENCES public.client_company(id),
  CONSTRAINT billing_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT billing_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

CREATE TABLE public.attached_file (
  url text NOT NULL,
  task_id uuid,
  billing_id uuid,
  uploaded_by uuid,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  uploaded_at timestamp with time zone DEFAULT now(),
  CONSTRAINT attached_file_pkey PRIMARY KEY (id),
  CONSTRAINT attached_file_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.planning_task(id),
  CONSTRAINT attached_file_billing_id_fkey FOREIGN KEY (billing_id) REFERENCES public.billing(id),
  CONSTRAINT attached_file_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id)
);

CREATE TABLE public.client_company_members (
  client_company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'editor'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT client_company_members_pkey PRIMARY KEY (client_company_id, user_id),
  CONSTRAINT client_company_members_client_company_id_fkey FOREIGN KEY (client_company_id) REFERENCES public.client_company(id),
  CONSTRAINT client_company_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

alter table public.attached_file enable row level security;
alter table public.client_company_members enable row level security;
revoke all on public.attached_file,public.client_company_members from public,anon,authenticated;
grant all on public.attached_file,public.client_company_members to service_role;
