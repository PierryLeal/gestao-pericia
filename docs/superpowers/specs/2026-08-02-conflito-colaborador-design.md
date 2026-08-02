# Impedir Colaborador em Duas Perícias no Mesmo Horário — Design

**Contexto:** o formulário de Perícia permite atribuir um Colaborador e uma Data/Hora agendada (ambos opcionais), mas nada impede que o mesmo colaborador seja atribuído a duas perícias diferentes no mesmo dia e horário — algo fisicamente impossível. Este spec cobre só essa validação no formulário de criação/edição de Perícia. A tela de calendário (arrastar-e-soltar) mencionada junto com esse pedido é um pacote separado, que reaproveitará essa mesma regra — ver `docs/superpowers/specs/2026-08-02-calendario-pericias-design.md`.

## Escopo

No formulário de Perícia (`src/features/pericias/components/pericia-form.tsx`), impedir salvar uma perícia com um colaborador que já está atribuído a outra perícia na mesma Data+Hora exatas.

## Comportamento (já validado com o usuário)

- Enquanto Data e Hora não estiverem os dois preenchidos, o select de Colaborador funciona normalmente, sem nenhuma restrição.
- Assim que os dois estiverem preenchidos, o select passa a mostrar todos os colaboradores normalmente, mas os que já estão ocupados nesse exato dia+hora ficam com um estilo visualmente "apagado" (opacidade reduzida) — continuam clicáveis, não usam o `disabled` nativo do componente (que bloquearia o clique).
- Se o colaborador selecionado (agora ou antes) estiver na lista de ocupados, aparece uma mensagem fixa em vermelho abaixo do select ("Este colaborador já está atribuído a outra perícia nesse mesmo dia e horário.") e o botão "Salvar perícia" fica desabilitado até o conflito ser resolvido (trocando o colaborador, ou mudando a data/hora).
- Editar uma perícia que já tem colaborador+data+hora não conflita consigo mesma.
- A checagem roda tanto ao trocar o colaborador quanto ao preencher/mudar a data ou hora — qualquer uma das duas direções produz o mesmo resultado.

## Arquitetura

**Nova server action**, em `src/features/pericias/actions.ts`:

```ts
export async function getColaboradoresIndisponiveis(
  dataAgendada: string,
  horaAgendada: string,
  excludePericiaId?: number
): Promise<number[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  let query = supabase
    .from('pericias')
    .select('colaborador_id')
    .eq('data_agendada', dataAgendada)
    .eq('hora_agendada', horaAgendada)
    .not('colaborador_id', 'is', null);
  if (excludePericiaId) {
    query = query.neq('id', excludePericiaId);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.colaborador_id as number);
}
```

Filtra diretamente por igualdade exata de `data_agendada`/`hora_agendada` (colunas `date`/`time` no Postgres), exclui a própria perícia quando `excludePericiaId` é passado (edição), e devolve só os IDs de colaborador já ocupados — nada de dados sensíveis, nada além do necessário pro select saber quem desabilitar visualmente.

**No `PericiaForm`:**

- Novo estado `busyColaboradorIds: number[]` (padrão `[]`).
- Um `useEffect` com dependências `[dataAgendada, horaAgendada]`: se ambos estiverem preenchidos, dispara `getColaboradoresIndisponiveis(dataAgendada, horaAgendada, pericia?.id)` depois de um debounce de 300ms; se qualquer um estiver vazio, zera `busyColaboradorIds` imediatamente (sem chamar a action).
- Um valor derivado `colaboradorConflict = colaboradorId !== '' && busyColaboradorIds.includes(Number(colaboradorId))` — recalculado automaticamente a cada render, cobrindo os dois sentidos de mudança (colaborador ou data/hora) sem lógica duplicada.
- `SelectItem` de cada colaborador ganha `className={busyColaboradorIds.includes(c.id) ? 'opacity-40 text-muted-foreground' : undefined}` — puramente visual, sem `disabled`.
- Abaixo do select: `{colaboradorConflict && <p className="text-sm text-destructive">Este colaborador já está atribuído a outra perícia nesse mesmo dia e horário.</p>}`.
- Botão Salvar: `disabled={saving || colaboradorConflict}`.
- Proteção adicional no `handleSubmit` (defesa em profundidade, caso o estado do botão fique dessincronizado por algum motivo): se `colaboradorConflict` for verdadeiro, `onError(...)` e `return` antes de chamar `createPericia`/`updatePericia` — o backend em si não precisa validar isso de novo nesta primeira versão (a tela é o único ponto de entrada para agendar colaborador+data+hora; não há import em lote nem outra via de escrita).

## Testes

- `getColaboradoresIndisponiveis`: retorna os `colaborador_id`s corretos para data+hora exatos; lista vazia quando ninguém está ocupado; exclui a própria perícia quando `excludePericiaId` é passado; ignora perícias com `colaborador_id` nulo.
- `PericiaForm`: selecionar um colaborador que está em `busyColaboradorIds` mostra a mensagem e desabilita Salvar; preencher uma data/hora que conflita com o colaborador já selecionado produz o mesmo resultado; limpar a data faz a mensagem sumir e o botão voltar a habilitar; colaborador sem conflito nunca desabilita nada; editar uma perícia já agendada com seu próprio colaborador não dispara falso positivo.

## Fora de escopo

- Tela de calendário / arrastar-e-soltar — pacote separado.
- Validação equivalente no backend (ver "Proteção adicional" acima — fica só como guarda no client por enquanto; se um dia houver outra via de escrita como import em lote, essa decisão deve ser revisitada).
- Impedir conflito de **Perito** (só Colaborador foi pedido).
