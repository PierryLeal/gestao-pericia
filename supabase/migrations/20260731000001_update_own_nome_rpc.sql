create or replace function public.update_own_nome(new_nome text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if length(trim(new_nome)) = 0 then
    raise exception 'nome não pode ser vazio';
  end if;
  update public.profiles set nome = new_nome where id = auth.uid();
end;
$$;

grant execute on function public.update_own_nome(text) to authenticated;
