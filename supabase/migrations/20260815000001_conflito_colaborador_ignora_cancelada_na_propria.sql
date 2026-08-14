-- Clarified with the user: a CANCELADA pericia doesn't occupy the
-- colaborador's time at all — it's not going to happen — so it must never be
-- blocked from linking a colaborador just because another (non-cancelled)
-- pericia already has that colaborador at the same date/hora. The trigger
-- already excluded a cancelled *existing* pericia from counting as a
-- conflict; it never excluded the case where the pericia being inserted
-- itself is cancelada. Mirrors what the import preview's own JS predictor
-- (detectarConflitosDeHorario) already does — it skips a cancelada row
-- entirely, in both directions.
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
  v_situacao public.pericia_situacao;
begin
  select p.data_agendada, p.hora_agendada, p.processo_id, p.perito_id, p.municipio_id, p.situacao
  into v_data_agendada, v_hora_agendada, v_processo_id, v_perito_id, v_municipio_id, v_situacao
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
