-- The same processo número can legitimately be handled under more than one
-- "contrato" over time (confirmed in a real import: the same processo
-- appeared under both "VALE AT" and "VALE BRUMADINHO" blocks of the source
-- sheet) — contrato describes a specific engagement/perícia, not the lawsuit
-- itself, so it belongs on pericias, not processos. Keeping it on processos
-- meant a later pericia's contrato silently overwrote an earlier one's for
-- every other pericia sharing that processo.

alter table public.pericias add column contrato text;
create index pericias_contrato_idx on public.pericias (contrato);

-- Best-effort carry-over: every existing pericia inherits its processo's
-- current contrato value, so today's data doesn't go blank after the switch.
update public.pericias per
set contrato = proc.contrato
from public.processos proc
where proc.id = per.processo_id and proc.contrato is not null;

drop index if exists public.processos_contrato_idx;
alter table public.processos drop column contrato;

-- `create or replace` can't change a function's parameter list — adding
-- `p_contrato` would otherwise silently create a second, overloaded
-- function instead of replacing the old one.
drop function if exists public.create_pericia_with_colaboradores(
  bigint, date, time, integer, bigint, public.pericia_situacao, text, bigint[]
);
drop function if exists public.update_pericia_with_colaboradores(
  bigint, bigint, date, time, integer, bigint, public.pericia_situacao, text, bigint[]
);

create or replace function public.create_pericia_with_colaboradores(
  p_processo_id bigint,
  p_data_agendada date,
  p_hora_agendada time,
  p_municipio_id integer,
  p_perito_id bigint,
  p_situacao public.pericia_situacao,
  p_observacoes text,
  p_colaborador_ids bigint[],
  p_contrato text
)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_pericia_id bigint;
begin
  insert into public.pericias (processo_id, data_agendada, hora_agendada, municipio_id, perito_id, situacao, observacoes, contrato)
  values (p_processo_id, p_data_agendada, p_hora_agendada, p_municipio_id, p_perito_id, p_situacao, p_observacoes, p_contrato)
  returning id into v_pericia_id;

  if p_colaborador_ids is not null and array_length(p_colaborador_ids, 1) > 0 then
    insert into public.pericia_colaboradores (pericia_id, colaborador_id)
    select v_pericia_id, cid from unnest(p_colaborador_ids) as cid
    on conflict (pericia_id, colaborador_id) do nothing;
  end if;

  return v_pericia_id;
end;
$$;

create or replace function public.update_pericia_with_colaboradores(
  p_id bigint,
  p_processo_id bigint,
  p_data_agendada date,
  p_hora_agendada time,
  p_municipio_id integer,
  p_perito_id bigint,
  p_situacao public.pericia_situacao,
  p_observacoes text,
  p_colaborador_ids bigint[],
  p_contrato text
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.pericias
  set processo_id = p_processo_id, data_agendada = p_data_agendada, hora_agendada = p_hora_agendada,
      municipio_id = p_municipio_id, perito_id = p_perito_id, situacao = p_situacao, observacoes = p_observacoes,
      contrato = p_contrato
  where id = p_id;

  delete from public.pericia_colaboradores where pericia_id = p_id;
  if p_colaborador_ids is not null and array_length(p_colaborador_ids, 1) > 0 then
    insert into public.pericia_colaboradores (pericia_id, colaborador_id)
    select p_id, cid from unnest(p_colaborador_ids) as cid
    on conflict (pericia_id, colaborador_id) do nothing;
  end if;
end;
$$;

grant execute on function public.create_pericia_with_colaboradores(
  bigint, date, time, integer, bigint, public.pericia_situacao, text, bigint[], text
) to authenticated;
grant execute on function public.update_pericia_with_colaboradores(
  bigint, bigint, date, time, integer, bigint, public.pericia_situacao, text, bigint[], text
) to authenticated;
