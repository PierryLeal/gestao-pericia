-- Extends merge_colaboradores to merge more than one colaborador at once:
-- loser_id (single) becomes loser_ids (array). Every pericia pointing at any
-- id in loser_ids is repointed at survivor_id, survivor_id's own fields are
-- overwritten with the (user-edited) merged values, and every colaborador in
-- loser_ids is deleted. All in one transaction, so a conflict (e.g. the
-- colaborador-double-booking trigger) aborts the whole merge instead of
-- leaving it half-done.
drop function if exists public.merge_colaboradores(bigint, bigint, text, text, text, text);

create or replace function public.merge_colaboradores(
  survivor_id bigint,
  loser_ids bigint[],
  novo_nome text,
  novo_contato text,
  nova_formacao text,
  novo_email text
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if loser_ids is null or array_length(loser_ids, 1) is null then
    raise exception 'selecione ao menos um colaborador para mesclar';
  end if;
  if survivor_id = any(loser_ids) then
    raise exception 'selecione colaboradores diferentes para mesclar';
  end if;
  if length(trim(novo_nome)) = 0 then
    raise exception 'nome não pode ser vazio';
  end if;
  if not exists (select 1 from public.colaboradores where id = survivor_id) then
    raise exception 'colaborador a manter não encontrado';
  end if;
  if exists (
    select 1 from unnest(loser_ids) as loser_id
    where not exists (select 1 from public.colaboradores c where c.id = loser_id)
  ) then
    raise exception 'colaborador a mesclar não encontrado';
  end if;

  update public.pericias set colaborador_id = survivor_id where colaborador_id = any(loser_ids);

  update public.colaboradores
  set nome = novo_nome, contato = novo_contato, formacao = nova_formacao, email = novo_email
  where id = survivor_id;

  delete from public.colaboradores where id = any(loser_ids);
end;
$$;

grant execute on function public.merge_colaboradores(bigint, bigint[], text, text, text, text) to authenticated;
