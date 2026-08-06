-- Merges two or more peritos into one, mirroring merge_colaboradores: every
-- pericia pointing at any id in loser_ids is repointed at survivor_id,
-- survivor_id's own fields are overwritten with the (user-edited) merged
-- values, and every perito in loser_ids is deleted. All in one transaction.
create or replace function public.merge_peritos(
  survivor_id bigint,
  loser_ids bigint[],
  novo_nome text,
  novo_contato text,
  nova_formacao text,
  novo_crea text,
  novo_documento text,
  novo_ja_trabalhamos boolean,
  nova_relacao public.perito_relacao,
  novo_resultados public.perito_resultado
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if loser_ids is null or array_length(loser_ids, 1) is null then
    raise exception 'selecione ao menos um perito para mesclar';
  end if;
  if survivor_id = any(loser_ids) then
    raise exception 'selecione peritos diferentes para mesclar';
  end if;
  if length(trim(novo_nome)) = 0 then
    raise exception 'nome não pode ser vazio';
  end if;
  if not exists (select 1 from public.peritos where id = survivor_id) then
    raise exception 'perito a manter não encontrado';
  end if;
  if exists (
    select 1 from unnest(loser_ids) as loser_id
    where not exists (select 1 from public.peritos p where p.id = loser_id)
  ) then
    raise exception 'perito a mesclar não encontrado';
  end if;

  update public.pericias set perito_id = survivor_id where perito_id = any(loser_ids);

  update public.peritos
  set nome = novo_nome, contato = novo_contato, formacao = nova_formacao, crea = novo_crea,
      documento = novo_documento, ja_trabalhamos = novo_ja_trabalhamos,
      relacao = nova_relacao, resultados = novo_resultados
  where id = survivor_id;

  delete from public.peritos where id = any(loser_ids);
end;
$$;

grant execute on function public.merge_peritos(
  bigint, bigint[], text, text, text, text, text, boolean, public.perito_relacao, public.perito_resultado
) to authenticated;
