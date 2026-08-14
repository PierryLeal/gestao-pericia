-- Clarified with the user: when two pericias share the same perito, data,
-- hora AND local (município) — besides the same colaborador — it's NOT a
-- real double-booking. It's understood the colaborador wraps up the first
-- and moves straight into the second, back-to-back, at the same place and
-- for the same perito. Only perito_id/municipio_id both matching (and both
-- known) exempts the pair; anything else still conflicts exactly as before.
create or replace function public.check_colaborador_conflito()
returns trigger
language plpgsql
as $$
declare
  v_data_agendada date;
  v_hora_agendada time;
  v_processo_id bigint;
  v_perito_id bigint;
  v_municipio_id integer;
begin
  select p.data_agendada, p.hora_agendada, p.processo_id, p.perito_id, p.municipio_id
  into v_data_agendada, v_hora_agendada, v_processo_id, v_perito_id, v_municipio_id
  from public.pericias p
  where p.id = new.pericia_id;

  if v_data_agendada is not null and v_hora_agendada is not null then
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
          and v_municipio_id is not null and p.municipio_id = v_municipio_id
        )
    ) then
      raise exception 'colaborador já está em outra perícia nesse mesmo dia e horário'
        using errcode = '23505';
    end if;
  end if;
  return new;
end;
$$;
