-- Confirmed with the user: the LOCAL column in the real import sheets is
-- often a company/mining-site code ("CMD", e.g.) rather than an actual city
-- name, so it never resolves to a real município via the IBGE exact-name
-- lookup — município_id stays null, and the perito+local double-booking
-- exemption (added in 20260814000001) never fires even when both pericias
-- plainly share the same perito and the same LOCAL text. `local` is the raw
-- place label as typed in the sheet (or the município's canonical name, for
-- manually created pericias) — a far more reliable "same place" signal than
-- a município FK that legitimately can't always be resolved.
alter table public.pericias add column local text;

drop function if exists public.create_pericia_with_colaboradores(
  bigint, date, time, integer, bigint, public.pericia_situacao, text, bigint[], text
);
drop function if exists public.update_pericia_with_colaboradores(
  bigint, bigint, date, time, integer, bigint, public.pericia_situacao, text, bigint[], text
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
  p_contrato text,
  p_local text
)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_pericia_id bigint;
begin
  insert into public.pericias (processo_id, data_agendada, hora_agendada, municipio_id, perito_id, situacao, observacoes, contrato, local)
  values (p_processo_id, p_data_agendada, p_hora_agendada, p_municipio_id, p_perito_id, p_situacao, p_observacoes, p_contrato, p_local)
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
  p_contrato text,
  p_local text
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.pericias
  set processo_id = p_processo_id, data_agendada = p_data_agendada, hora_agendada = p_hora_agendada,
      municipio_id = p_municipio_id, perito_id = p_perito_id, situacao = p_situacao, observacoes = p_observacoes,
      contrato = p_contrato, local = p_local
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
  bigint, date, time, integer, bigint, public.pericia_situacao, text, bigint[], text, text
) to authenticated;
grant execute on function public.update_pericia_with_colaboradores(
  bigint, bigint, date, time, integer, bigint, public.pericia_situacao, text, bigint[], text, text
) to authenticated;

create or replace function public.check_colaborador_conflito()
returns trigger
language plpgsql
as $$
declare
  v_data_agendada date;
  v_hora_agendada time;
  v_processo_id bigint;
  v_perito_id bigint;
  v_local text;
  v_situacao public.pericia_situacao;
begin
  select p.data_agendada, p.hora_agendada, p.processo_id, p.perito_id, p.local, p.situacao
  into v_data_agendada, v_hora_agendada, v_processo_id, v_perito_id, v_local, v_situacao
  from public.pericias p
  where p.id = new.pericia_id;

  if v_data_agendada is not null and v_hora_agendada is not null and v_situacao <> 'cancelada' then
    if exists (
      select 1
      from public.pericia_colaboradores pc
      join public.pericias p on p.id = pc.pericia_id
      where pc.colaborador_id = new.colaborador_id
        and p.data_agendada = v_data_agendada
        and p.hora_agendada = v_hora_agendada
        and p.processo_id <> v_processo_id
        and p.situacao <> 'cancelada'
        and pc.pericia_id <> new.pericia_id
        and not (
          v_perito_id is not null and p.perito_id = v_perito_id
          and v_local is not null and trim(v_local) <> ''
          and lower(trim(p.local)) = lower(trim(v_local))
        )
    ) then
      raise exception 'colaborador já está em outra perícia nesse mesmo dia e horário'
        using errcode = '23505';
    end if;
  end if;
  return new;
end;
$$;
