-- merge_colaboradores now reassigns pericia_colaboradores rows instead of
-- pericias.colaborador_id (dropped in the previous migration). A pericia can
-- already be linked to both the survivor and a loser (two colaboradores on
-- one pericia, one of which is being merged away) — insert the survivor link
-- first (ON CONFLICT DO NOTHING dedupes that case), then delete every loser
-- link, so no duplicate/orphaned pair is left behind.
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

  insert into public.pericia_colaboradores (pericia_id, colaborador_id)
  select pc.pericia_id, survivor_id
  from public.pericia_colaboradores pc
  where pc.colaborador_id = any(loser_ids)
  on conflict (pericia_id, colaborador_id) do nothing;

  delete from public.pericia_colaboradores where colaborador_id = any(loser_ids);

  update public.colaboradores
  set nome = novo_nome, contato = novo_contato, formacao = nova_formacao, email = novo_email
  where id = survivor_id;

  delete from public.colaboradores where id = any(loser_ids);
end;
$$;

grant execute on function public.merge_colaboradores(bigint, bigint[], text, text, text, text) to authenticated;
