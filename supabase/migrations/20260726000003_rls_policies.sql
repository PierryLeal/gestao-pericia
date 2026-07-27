alter table public.profiles enable row level security;
alter table public.municipios enable row level security;
alter table public.processos enable row level security;
alter table public.peritos enable row level security;
alter table public.colaboradores enable row level security;
alter table public.pericias enable row level security;

-- security definer avoids infinite recursion when this is called from a policy on profiles itself
create or replace function public.current_role()
returns public.profile_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.current_role() = 'admin');

create policy "profiles_update_admin" on public.profiles
  for update using (public.current_role() = 'admin');

create policy "municipios_select_approved" on public.municipios
  for select using (public.current_role() in ('gerencia', 'admin'));
create policy "municipios_insert_approved" on public.municipios
  for insert with check (public.current_role() in ('gerencia', 'admin'));
create policy "municipios_update_approved" on public.municipios
  for update using (public.current_role() in ('gerencia', 'admin'));
create policy "municipios_delete_approved" on public.municipios
  for delete using (public.current_role() in ('gerencia', 'admin'));

create policy "processos_all_approved" on public.processos
  for all using (public.current_role() in ('gerencia', 'admin'))
  with check (public.current_role() in ('gerencia', 'admin'));

create policy "peritos_all_approved" on public.peritos
  for all using (public.current_role() in ('gerencia', 'admin'))
  with check (public.current_role() in ('gerencia', 'admin'));

create policy "colaboradores_all_approved" on public.colaboradores
  for all using (public.current_role() in ('gerencia', 'admin'))
  with check (public.current_role() in ('gerencia', 'admin'));

create policy "pericias_all_approved" on public.pericias
  for all using (public.current_role() in ('gerencia', 'admin'))
  with check (public.current_role() in ('gerencia', 'admin'));
