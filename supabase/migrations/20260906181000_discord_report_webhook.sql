-- Webhook automático para laudos de porte de arma.
-- O endereço do webhook fica no banco e nunca é retornado ao frontend.

create extension if not exists pg_net;

alter table public.medical_reports
  add column if not exists discord_request_id bigint,
  add column if not exists discord_queued_at timestamptz;

insert into public.system_settings (key, value)
values
  ('discord_report_webhook', '{"enabled":false,"url":""}'::jsonb)
on conflict (key) do nothing;

create or replace function public.set_discord_webhook(
  integration_name text,
  webhook_url text,
  enabled boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  setting_key text;
begin
  if not (
    public.has_permission('manage_integrations')
    or public.has_permission('manage_system')
  ) then
    raise exception 'Sem permissão para alterar integrações.';
  end if;

  if integration_name not in ('reports', 'kits') then
    raise exception 'Integração inválida.';
  end if;

  if enabled and (
    webhook_url is null
    or webhook_url !~ '^https://((canary|ptb)\.)?discord(app)?\.com/api/webhooks/'
  ) then
    raise exception 'Informe uma URL válida de webhook do Discord.';
  end if;

  setting_key := case integration_name
    when 'reports' then 'discord_report_webhook'
    else 'discord_kit_webhook'
  end;

  insert into public.system_settings (key, value, updated_at, updated_by)
  values (
    setting_key,
    jsonb_build_object(
      'enabled', enabled,
      'url', coalesce(webhook_url, '')
    ),
    now(),
    auth.uid()
  )
  on conflict (key) do update
  set value = excluded.value,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;
end;
$$;

revoke all on function public.set_discord_webhook(text, text, boolean) from public;
grant execute on function public.set_discord_webhook(text, text, boolean) to authenticated;

create or replace function public.get_discord_webhook_status()
returns table (
  integration text,
  enabled boolean,
  configured boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.has_permission('manage_integrations')
    or public.has_permission('manage_system')
  ) then
    raise exception 'Sem permissão para visualizar integrações.';
  end if;

  return query
  select
    case s.key
      when 'discord_report_webhook' then 'reports'
      when 'discord_kit_webhook' then 'kits'
      else s.key
    end as integration,
    coalesce((s.value->>'enabled')::boolean, false) as enabled,
    length(coalesce(s.value->>'url', '')) > 0 as configured,
    s.updated_at
  from public.system_settings s
  where s.key in ('discord_report_webhook', 'discord_kit_webhook')
  order by s.key;
end;
$$;

revoke all on function public.get_discord_webhook_status() from public;
grant execute on function public.get_discord_webhook_status() to authenticated;

create or replace function public.notify_medical_report_discord()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  setting_value jsonb;
  webhook_url text;
  webhook_enabled boolean;
  request_id bigint;
  result_color integer;
  result_label text;
  report_date text;
  fields jsonb;
  payload jsonb;
begin
  select value
    into setting_value
  from public.system_settings
  where key = 'discord_report_webhook';

  webhook_enabled := coalesce((setting_value->>'enabled')::boolean, false);
  webhook_url := nullif(setting_value->>'url', '');

  if not webhook_enabled or webhook_url is null then
    return new;
  end if;

  result_color := case when new.result = 'Apto' then 3066993 else 15158332 end;
  result_label := case when new.result = 'Apto' then 'APROVADO' else 'NEGADO' end;
  report_date := to_char(new.issued_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');

  fields := jsonb_build_array(
    jsonb_build_object('name', 'Paciente', 'value', new.patient_name, 'inline', true),
    jsonb_build_object('name', 'ID da cidade', 'value', new.patient_game_id, 'inline', true),
    jsonb_build_object('name', 'Resultado', 'value', '**' || result_label || '**', 'inline', true),
    jsonb_build_object('name', 'Finalidade', 'value', new.purpose, 'inline', true),
    jsonb_build_object('name', 'Responsável pela avaliação', 'value', new.examiner_name, 'inline', true),
    jsonb_build_object('name', 'Data e hora', 'value', report_date, 'inline', true)
  );

  if new.observations is not null and btrim(new.observations) <> '' then
    fields := fields || jsonb_build_array(
      jsonb_build_object('name', 'Observações', 'value', new.observations, 'inline', false)
    );
  end if;

  payload := jsonb_build_object(
    'username', 'UPA • Laudos Médicos',
    'embeds', jsonb_build_array(
      jsonb_build_object(
        'title', case
          when new.result = 'Apto' then '✅ Laudo para Porte de Arma — APROVADO'
          else '❌ Laudo para Porte de Arma — NEGADO'
        end,
        'description', 'Resultado registrado automaticamente pelo Sistema Integrado da UPA.',
        'color', result_color,
        'fields', fields,
        'footer', jsonb_build_object('text', 'UPA • Sistema Integrado'),
        'timestamp', new.issued_at
      )
    )
  );

  select net.http_post(
    url := webhook_url,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := payload,
    timeout_milliseconds := 10000
  ) into request_id;

  update public.medical_reports
  set discord_request_id = request_id,
      discord_queued_at = now()
  where id = new.id;

  return new;
exception
  when others then
    -- O laudo não deve deixar de ser salvo por uma indisponibilidade do Discord.
    -- O erro fica disponível nos logs do banco para diagnóstico.
    raise warning 'Falha ao enfileirar webhook do laudo %: %', new.id, sqlerrm;
    return new;
end;
$$;

create trigger notify_medical_report_discord_after_insert
after insert on public.medical_reports
for each row execute function public.notify_medical_report_discord();
