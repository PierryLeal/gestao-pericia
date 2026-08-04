alter table public.processos add column escritorio text not null default '';
alter table public.processos alter column escritorio drop default;
