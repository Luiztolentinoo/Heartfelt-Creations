alter table public.report_requests
  add column if not exists result_observations text;

create or replace function public.schedule_report_request(
  request_id uuid,
  appointment_at_value timestamptz
)
returns public.report_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_request public.report_requests;
begin
  if not public.has_permission('manage_appointments') then
    raise exception 'Sem permissão para agendar avaliações.';
  end if;

  if appointment_at_value is null or appointment_at_value <= now() then
    raise exception 'Informe uma data futura para o agendamento.';
  end if;

  update public.report_requests
  set status = 'Agendado',
      appointment_at = appointment_at_value,
      updated_at = now()
  where id = request_id
    and status in ('Solicitado', 'Aguardando agendamento', 'Agendado')
  returning * into updated_request;

  if updated_request.id is null then
    raise exception 'Solicitação não localizada ou não pode mais ser agendada.';
  end if;

  return updated_request;
end;
$$;

revoke all on function public.schedule_report_request(uuid, timestamptz) from public;
grant execute on function public.schedule_report_request(uuid, timestamptz) to authenticated;

create or replace function public.take_report_request(request_id uuid)
returns public.report_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text;
  updated_request public.report_requests;
begin
  if not public.has_permission('issue_reports') then
    raise exception 'Sem permissão para assumir avaliações.';
  end if;

  select name into profile_name
  from public.profiles
  where id = auth.uid() and active = true;

  if profile_name is null then
    raise exception 'Perfil profissional não localizado.';
  end if;

  update public.report_requests
  set status = 'Em avaliação',
      assigned_professional_id = auth.uid(),
      professional_name = profile_name,
      updated_at = now()
  where id = request_id
    and status in ('Solicitado', 'Aguardando agendamento', 'Agendado', 'Em avaliação')
    and (assigned_professional_id is null or assigned_professional_id = auth.uid())
  returning * into updated_request;

  if updated_request.id is null then
    raise exception 'Solicitação já está atribuída ou não pode ser assumida.';
  end if;

  return updated_request;
end;
$$;

revoke all on function public.take_report_request(uuid) from public;
grant execute on function public.take_report_request(uuid) to authenticated;

create or replace function public.cancel_report_request(request_id uuid)
returns public.report_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_request public.report_requests;
begin
  if not public.has_permission('manage_appointments') then
    raise exception 'Sem permissão para cancelar solicitações.';
  end if;

  update public.report_requests
  set status = 'Cancelado',
      updated_at = now()
  where id = request_id
    and status not in ('Aprovado', 'Negado', 'Cancelado')
  returning * into updated_request;

  if updated_request.id is null then
    raise exception 'Solicitação não localizada ou já finalizada.';
  end if;

  return updated_request;
end;
$$;

revoke all on function public.cancel_report_request(uuid) from public;
grant execute on function public.cancel_report_request(uuid) to authenticated;

create or replace function public.finalize_report_request(
  request_id uuid,
  result_value public.report_result,
  observations_value text default null
)
returns public.report_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.report_requests;
  profile_name text;
  updated_request public.report_requests;
begin
  if not public.has_permission('issue_reports') then
    raise exception 'Sem permissão para finalizar laudos.';
  end if;

  select name into profile_name
  from public.profiles
  where id = auth.uid() and active = true;

  if profile_name is null then
    raise exception 'Perfil profissional não localizado.';
  end if;

  select * into request_row
  from public.report_requests
  where id = request_id
  for update;

  if request_row.id is null then
    raise exception 'Solicitação não localizada.';
  end if;

  if request_row.status in ('Aprovado', 'Negado', 'Cancelado') then
    raise exception 'Essa solicitação já foi encerrada.';
  end if;

  if request_row.assigned_professional_id is not null
     and request_row.assigned_professional_id <> auth.uid() then
    raise exception 'A solicitação está atribuída a outro profissional.';
  end if;

  insert into public.medical_reports (
    report_request_id,
    patient_name,
    patient_game_id,
    examiner_id,
    examiner_name,
    purpose,
    result,
    observations,
    issued_at
  ) values (
    request_row.id,
    request_row.requester_name,
    request_row.requester_game_id,
    auth.uid(),
    profile_name,
    'Porte de arma',
    result_value,
    nullif(btrim(observations_value), ''),
    now()
  );

  update public.report_requests
  set status = case when result_value = 'Apto' then 'Aprovado' else 'Negado' end,
      assigned_professional_id = auth.uid(),
      professional_name = profile_name,
      result = result_value,
      result_at = now(),
      result_observations = nullif(btrim(observations_value), ''),
      updated_at = now()
  where id = request_row.id
  returning * into updated_request;

  return updated_request;
end;
$$;

revoke all on function public.finalize_report_request(uuid, public.report_result, text) from public;
grant execute on function public.finalize_report_request(uuid, public.report_result, text) to authenticated;
