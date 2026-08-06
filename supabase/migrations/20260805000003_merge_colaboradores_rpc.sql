-- Merges two colaboradores into one: every pericia pointing at loser_id is
-- repointed at survivor_id, survivor_id's own fields are overwritten with the
-- (user-edited) merged values, and loser_id is deleted. All in one
-- transaction, so a conflict (e.g. the colaborador-double-booking trigger)
-- aborts the whole merge instead of leaving it half-done.
create or replace function public.merge_colaboradores(
  survivor_id bigint,
  loser_id bigint,
  novo_nome text,
  novo_contato text,
  nova_formacao text,
  novo_email text
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if survivor_id = loser_id then
    raise exception 'selecione dois colaboradores diferentes para mesclar';
  end if;
  if length(trim(novo_nome)) = 0 then
    raise exception 'nome não pode ser vazio';
  end if;
  if not exists (select 1 from public.colaboradores where id = survivor_id) then
    raise exception 'colaborador a manter não encontrado';
  end if;
  if not exists (select 1 from public.colaboradores where id = loser_id) then
    raise exception 'colaborador a mesclar não encontrado';
  end if;

  update public.pericias set colaborador_id = survivor_id where colaborador_id = loser_id;

  update public.colaboradores
  set nome = novo_nome, contato = novo_contato, formacao = nova_formacao, email = novo_email
  where id = survivor_id;

  delete from public.colaboradores where id = loser_id;
end;
$$;

grant execute on function public.merge_colaboradores(bigint, bigint, text, text, text, text) to authenticated;
