-- A perícia can have more than one colaborador (e.g. "Igor Navarro/Julio
-- Cesar Mulatti" in the sheet's CAMPO column) — replaces the single nullable
-- pericias.colaborador_id column with a many-to-many join table.

create table public.pericia_colaboradores (
  pericia_id bigint not null references public.pericias (id) on delete cascade,
  colaborador_id bigint not null references public.colaboradores (id) on delete cascade,
  primary key (pericia_id, colaborador_id)
);

create index pericia_colaboradores_colaborador_id_idx on public.pericia_colaboradores (colaborador_id);

alter table public.pericia_colaboradores enable row level security;

create policy "pericia_colaboradores_all_approved" on public.pericia_colaboradores
  for all using (public.current_role() in ('gerencia', 'admin'))
  with check (public.current_role() in ('gerencia', 'admin'));

-- Migrate existing single-colaborador links before dropping the column.
insert into public.pericia_colaboradores (pericia_id, colaborador_id)
select id, colaborador_id from public.pericias where colaborador_id is not null;

drop trigger if exists pericias_colaborador_conflito on public.pericias;
drop function if exists public.check_colaborador_conflito();

alter table public.pericias drop column colaborador_id;

-- The double-booking check moves from "before insert/update on pericias" to
-- "before insert on pericia_colaboradores": a colaborador can't be linked to
-- two different (non-cancelled) processos at the same date/hora. Since the
-- app always re-syncs the full colaborador set on every pericia save (see
-- create_pericia_with_colaboradores/update_pericia_with_colaboradores in the
-- next migration), this also naturally re-validates a reschedule (date/hora
-- change) without needing a second trigger on pericias.
create or replace function public.check_colaborador_conflito()
returns trigger
language plpgsql
as $$
declare
  v_data_agendada date;
  v_hora_agendada time;
  v_processo_id bigint;
begin
  select p.data_agendada, p.hora_agendada, p.processo_id
  into v_data_agendada, v_hora_agendada, v_processo_id
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
    ) then
      raise exception 'colaborador já está em outra perícia nesse mesmo dia e horário'
        using errcode = '23505';
    end if;
  end if;
  return new;
end;
$$;

create trigger pericia_colaboradores_conflito
  before insert on public.pericia_colaboradores
  for each row
  execute function public.check_colaborador_conflito();
