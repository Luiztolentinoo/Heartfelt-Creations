create extension if not exists pgcrypto;

create type public.kit_status as enum ('Pendente', 'Conferido');
create type public.report_result as enum ('Apto', 'Não Apto');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  game_id text not null unique,
  hierarchy_role text not null,
  clinical_function text not null,
  permissions text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  game_id text not null unique,
  phone text,
  status text not null default 'Ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade,
  professional_id uuid references public.profiles(id) on delete set null,
  appointment_type text not null,
  scheduled_at timestamptz not null,
  status text not null default 'Agendada',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.medical_reports (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete restrict,
  patient_name text not null,
  patient_game_id text not null,
  examiner_id uuid not null references public.profiles(id) on delete restrict,
  examiner_name text not null,
  purpose text not null default 'Porte de arma',
  result public.report_result not null,
  observations text,
  issued_at timestamptz not null default now()
);

create table public.kit_purchases (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique,
  doctor_id uuid not null references public.profiles(id) on delete restrict,
  doctor_name text not null,
  quantity integer not null check (quantity > 0),
  unit_purchase_cost integer not null default 250 check (unit_purchase_cost >= 0),
  unit_sale_price integer not null default 1600 check (unit_sale_price >= 0),
  unit_hospital_return integer not null default 300 check (unit_hospital_return >= 0),
  total_purchase_cost integer generated always as (quantity * unit_purchase_cost) stored,
  total_sale_potential integer generated always as (quantity * unit_sale_price) stored,
  hospital_return_due integer generated always as (quantity * unit_hospital_return) stored,
  status public.kit_status not null default 'Pendente',
  notes text,
  registered_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles(id) on delete set null,
  discord_notified_at timestamptz
);

create table public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.system_settings (key, value) values
  ('kit_rules', '{"purchase_cost":250,"sale_price":1600,"hospital_return":300}'::jsonb)
on conflict (key) do nothing;

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text,
  action text not null,
  entity_type text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.has_permission(permission_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and permission_name = any(p.permissions)
  );
$$;

create or replace function public.is_clinical_function(function_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.clinical_function = function_name
  );
$$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name_value text;
begin
  select name into actor_name_value from public.profiles where id = auth.uid();
  insert into public.audit_logs(actor_id, actor_name, action, entity_type, entity_id, old_data, new_data)
  values (
    auth.uid(),
    actor_name_value,
    tg_op,
    tg_table_name,
    coalesce((to_jsonb(new)->>'id'), (to_jsonb(old)->>'id')),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_kit_purchases after insert or update or delete on public.kit_purchases
for each row execute function public.audit_row_change();

create trigger audit_medical_reports after insert or update or delete on public.medical_reports
for each row execute function public.audit_row_change();

create trigger audit_profiles after insert or update or delete on public.profiles
for each row execute function public.audit_row_change();

alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.appointments enable row level security;
alter table public.medical_reports enable row level security;
alter table public.kit_purchases enable row level security;
alter table public.system_settings enable row level security;
alter table public.audit_logs enable row level security;

create policy "staff can view profiles" on public.profiles for select to authenticated using (true);
create policy "admins can manage profiles" on public.profiles for all to authenticated
using (public.has_permission('manage_staff') or public.has_permission('manage_system'))
with check (public.has_permission('manage_staff') or public.has_permission('manage_system'));

create policy "authorized staff can view patients" on public.patients for select to authenticated
using (public.has_permission('view_patients'));
create policy "authorized staff can manage patients" on public.patients for all to authenticated
using (public.has_permission('manage_patients'))
with check (public.has_permission('manage_patients'));

create policy "authorized staff can view appointments" on public.appointments for select to authenticated
using (public.has_permission('view_appointments'));
create policy "authorized staff can manage appointments" on public.appointments for all to authenticated
using (public.has_permission('manage_appointments'))
with check (public.has_permission('manage_appointments'));

create policy "authorized staff can view reports" on public.medical_reports for select to authenticated
using (public.has_permission('view_reports'));
create policy "authorized staff can issue reports" on public.medical_reports for insert to authenticated
with check (public.has_permission('issue_reports') and examiner_id = auth.uid());

create policy "authorized staff can view kits" on public.kit_purchases for select to authenticated
using (
  public.has_permission('manage_kits') or
  public.has_permission('confirm_kit_returns') or
  public.has_permission('view_finance')
);
create policy "doctors can register their kit purchases" on public.kit_purchases for insert to authenticated
with check (
  doctor_id = auth.uid()
  and public.is_clinical_function('Médico')
  and public.has_permission('manage_kits')
  and status = 'Pendente'
);
create policy "authorized supervisors can confirm kits" on public.kit_purchases for update to authenticated
using (public.has_permission('confirm_kit_returns'))
with check (public.has_permission('confirm_kit_returns'));

create policy "management can view settings" on public.system_settings for select to authenticated
using (public.has_permission('manage_integrations') or public.has_permission('manage_system'));
create policy "system admins can change settings" on public.system_settings for all to authenticated
using (public.has_permission('manage_system'))
with check (public.has_permission('manage_system'));

create policy "auditors can view audit log" on public.audit_logs for select to authenticated
using (public.has_permission('view_audit'));

create index kit_purchases_doctor_idx on public.kit_purchases(doctor_id, registered_at desc);
create index kit_purchases_status_idx on public.kit_purchases(status, registered_at desc);
create index reports_patient_idx on public.medical_reports(patient_game_id, issued_at desc);
create index audit_logs_created_idx on public.audit_logs(created_at desc);
