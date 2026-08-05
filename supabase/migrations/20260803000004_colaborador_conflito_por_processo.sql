-- Replaces the flat unique index (colaborador_id, data_agendada, hora_agendada)
-- with a trigger that allows the same colaborador at the same date/time when it's
-- the same processo (e.g. two specialists examining the same case together), while
-- still blocking a genuine double-booking across two different processos.

drop index if exists public.pericias_colaborador_unico_por_horario;

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
        and (new.id is null or p.id <> new.id)
    ) then
      raise exception 'colaborador já está em outra perícia nesse mesmo dia e horário'
        using errcode = '23505';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists pericias_colaborador_conflito on public.pericias;

create trigger pericias_colaborador_conflito
  before insert or update on public.pericias
  for each row
  execute function public.check_colaborador_conflito();
