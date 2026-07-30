create type public.perito_relacao as enum ('ruim', 'neutra', 'boa', 'otima');
create type public.perito_resultado as enum ('negativo', 'parcial', 'positivo');

alter table public.peritos add column relacao_new public.perito_relacao;
update public.peritos set relacao_new = case
  when relacao = 0 then 'neutra'
  when relacao <= 3 then 'ruim'
  when relacao <= 6 then 'neutra'
  when relacao <= 8 then 'boa'
  else 'otima'
end::public.perito_relacao;
alter table public.peritos alter column relacao_new set not null;
alter table public.peritos alter column relacao_new set default 'neutra';
alter table public.peritos drop column relacao;
alter table public.peritos rename column relacao_new to relacao;

alter table public.peritos add column resultados_new public.perito_resultado;
update public.peritos set resultados_new = case
  when resultados = 0 then 'parcial'
  when resultados <= 3 then 'negativo'
  when resultados <= 6 then 'parcial'
  else 'positivo'
end::public.perito_resultado;
alter table public.peritos alter column resultados_new set not null;
alter table public.peritos alter column resultados_new set default 'parcial';
alter table public.peritos drop column resultados;
alter table public.peritos rename column resultados_new to resultados;
