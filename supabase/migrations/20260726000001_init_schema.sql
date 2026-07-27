create type public.pericia_situacao as enum ('pendente', 'marcada', 'realizada', 'cancelada');
create type public.profile_role as enum ('pendente', 'gerencia', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  email text not null,
  role public.profile_role not null default 'pendente',
  created_at timestamptz not null default now()
);

create table public.municipios (
  id integer primary key, -- codigo IBGE
  nome text not null,
  uf char(2) not null
);

create table public.processos (
  id bigint generated always as identity primary key,
  numero text not null unique,
  autor text not null,
  reu text not null,
  created_at timestamptz not null default now()
);

create table public.peritos (
  id bigint generated always as identity primary key,
  nome text not null,
  contato text not null default '',
  formacao text not null default '',
  crea text not null default '',
  documento text not null default '',
  ja_trabalhamos boolean not null default false,
  relacao smallint not null default 0 check (relacao between 0 and 10),
  resultados smallint not null default 0 check (resultados between 0 and 10),
  created_at timestamptz not null default now()
);

create table public.colaboradores (
  id bigint generated always as identity primary key,
  nome text not null,
  contato text not null default '',
  formacao text not null default '',
  interno boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.pericias (
  id bigint generated always as identity primary key,
  processo_id bigint not null references public.processos (id) on delete restrict,
  data_agendada date not null,
  hora_agendada time not null,
  municipio_id integer not null references public.municipios (id) on delete restrict,
  perito_id bigint not null references public.peritos (id) on delete restrict,
  colaborador_id bigint references public.colaboradores (id) on delete set null,
  situacao public.pericia_situacao not null default 'pendente',
  created_at timestamptz not null default now()
);

create index pericias_processo_id_idx on public.pericias (processo_id);
create index pericias_perito_id_idx on public.pericias (perito_id);
create index pericias_data_agendada_idx on public.pericias (data_agendada);
