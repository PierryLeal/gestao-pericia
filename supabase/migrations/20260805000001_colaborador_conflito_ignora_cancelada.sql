-- A cancelled pericia no longer blocks scheduling the same colaborador at the
-- same date/time — a cancelled slot is, by definition, freed up.

create or replace function public.check_colaborador_conflito()
returns trigger
language plpgsql
as $$
begin
  if new.colaborador_id is not null and new.data_agendada is not null and new.hora_agendada is not null then
    if exists (
      select 1
      from public.pericias p
      where p.colaborador_id = new.colaborador_id
        and p.data_agendada = new.data_agendada
        and p.hora_agendada = new.hora_agendada
        and p.processo_id <> new.processo_id
        and p.situacao <> 'cancelada'
        and (new.id is null or p.id <> new.id)
    ) then
      raise exception 'colaborador já está em outra perícia nesse mesmo dia e horário'
        using errcode = '23505';
    end if;
  end if;
  return new;
end;
$$;
