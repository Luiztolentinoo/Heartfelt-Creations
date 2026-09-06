create table public.public_portal_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  full_name text not null,
  game_id text not null,
  pin_hash text not null,
  requested_role text not null default 'Cidadão' check (requested_role in ('Cidadão','Enfermeiro','Paramédico','Médico','Psicólogo','Direção')),
  access_status text not null default 'public' check (access_status in ('public','pending_staff','staff','blocked')),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index public_portal_accounts_username_unique on public.public_portal_accounts(lower(username));
create index public_portal_accounts_game_id_idx on public.public_portal_accounts(game_id);
create index public_portal_accounts_access_status_idx on public.public_portal_accounts(access_status, created_at desc);

create table public.public_portal_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.public_portal_accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index public_portal_sessions_account_idx on public.public_portal_sessions(account_id, expires_at desc);

create table public.report_requests (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique,
  account_id uuid not null references public.public_portal_accounts(id) on delete restrict,
  requester_name text not null,
  requester_game_id text not null,
  purpose text not null default 'Porte de arma',
  preferred_period text not null check (preferred_period in ('Manhã','Tarde','Noite','Qualquer horário')),
  status text not null default 'Solicitado' check (status in ('Solicitado','Aguardando agendamento','Agendado','Em avaliação','Aprovado','Negado','Cancelado')),
  notes text,
  appointment_at timestamptz,
  assigned_professional_id uuid references public.profiles(id) on delete set null,
  professional_name text,
  result public.report_result,
  result_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index report_requests_account_idx on public.report_requests(account_id, created_at desc);
create index report_requests_status_idx on public.report_requests(status, created_at desc);
create index report_requests_game_id_idx on public.report_requests(requester_game_id, created_at desc);

alter table public.medical_reports
  add column if not exists report_request_id uuid references public.report_requests(id) on delete set null,
  add column if not exists discord_notified_at timestamptz;

create unique index if not exists medical_reports_request_unique
  on public.medical_reports(report_request_id)
  where report_request_id is not null;

create or replace function public.sync_report_request_from_medical_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.report_request_id is not null then
    update public.report_requests
      set status = case when new.result = 'Apto' then 'Aprovado' else 'Negado' end,
          result = new.result,
          result_at = new.issued_at,
          professional_name = new.examiner_name,
          assigned_professional_id = new.examiner_id,
          updated_at = now()
    where id = new.report_request_id;
  end if;
  return new;
end;
$$;

create trigger sync_report_request_after_report
  after insert or update of result on public.medical_reports
  for each row execute function public.sync_report_request_from_medical_report();

create trigger audit_report_requests after insert or update or delete on public.report_requests
for each row execute function public.audit_row_change();

alter table public.public_portal_accounts enable row level security;
alter table public.public_portal_sessions enable row level security;
alter table public.report_requests enable row level security;

-- Contas e sessões públicas são acessadas somente pelas Edge Functions com service role.
-- Nenhuma policy é criada para anon/authenticated nessas duas tabelas.

create policy "staff can view public account requests" on public.public_portal_accounts
for select to authenticated
using (public.has_permission('manage_staff') or public.has_permission('manage_system'));

create policy "staff can approve public account requests" on public.public_portal_accounts
for update to authenticated
using (public.has_permission('manage_staff') or public.has_permission('manage_system'))
with check (public.has_permission('manage_staff') or public.has_permission('manage_system'));

create policy "authorized staff can view report requests" on public.report_requests
for select to authenticated
using (
  public.has_permission('view_appointments') or
  public.has_permission('manage_appointments') or
  public.has_permission('view_reports') or
  public.has_permission('issue_reports')
);

create policy "authorized staff can update report requests" on public.report_requests
for update to authenticated
using (public.has_permission('manage_appointments') or public.has_permission('issue_reports'))
with check (public.has_permission('manage_appointments') or public.has_permission('issue_reports'));
