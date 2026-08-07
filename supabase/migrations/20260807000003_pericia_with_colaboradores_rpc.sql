-- Wraps the pericias row write and its pericia_colaboradores sync in one
-- transaction. Doing these as two separate client calls would leave a
-- half-formed pericia behind if the second call (the colaborador conflict
-- check) failed — the base row would already be committed with the wrong
-- (empty or stale) set of colaboradores.

create or replace function public.create_pericia_with_colaboradores(
  p_processo_id bigint,
  p_data_agendada date,
  p_hora_agendada time,
  p_municipio_id integer,
  p_perito_id bigint,
  p_situacao public.pericia_situacao,
  p_observacoes text,
  p_colaborador_ids bigint[]
)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_pericia_id bigint;
begin
  insert into public.pericias (processo_id, data_agendada, hora_agendada, municipio_id, perito_id, situacao, observacoes)
  values (p_processo_id, p_data_agendada, p_hora_agendada, p_municipio_id, p_perito_id, p_situacao, p_observacoes)
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
  p_colaborador_ids bigint[]
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.pericias
  set processo_id = p_processo_id, data_agendada = p_data_agendada, hora_agendada = p_hora_agendada,
      municipio_id = p_municipio_id, perito_id = p_perito_id, situacao = p_situacao, observacoes = p_observacoes
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
  bigint, date, time, integer, bigint, public.pericia_situacao, text, bigint[]
) to authenticated;
grant execute on function public.update_pericia_with_colaboradores(
  bigint, bigint, date, time, integer, bigint, public.pericia_situacao, text, bigint[]
) to authenticated;
