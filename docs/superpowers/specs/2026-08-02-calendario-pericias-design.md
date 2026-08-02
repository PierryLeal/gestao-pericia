# Calendário de Perícias — Design

**Contexto:** o usuário pediu uma tela nova de calendário (estilo agenda do Teams) mostrando todas as Perícias, com clique para editar e arrastar-e-soltar para reagendar. Pensado junto com `docs/superpowers/specs/2026-08-02-conflito-colaborador-design.md` (validação de conflito de colaborador), que este pacote reaproveita ao arrastar um card.

## Escopo

Uma tela nova (`/calendario`) com visões de Mês, Semana e Dia, mostrando cada Perícia agendada como um card no seu dia/horário. Perícias sem data ficam numa lista lateral "Não agendadas", também arrastável para o calendário. Filtros por Situação, número de Processo, Perito e Colaborador.

## Biblioteca

`FullCalendar` (`@fullcalendar/react` + `@fullcalendar/daygrid` + `@fullcalendar/timegrid` + `@fullcalendar/interaction`) — decisão já validada com o usuário. Fornece as três visões e arrastar-e-soltar prontos; `@fullcalendar/interaction` cobre tanto mover eventos já no calendário quanto soltar itens externos (a lista "Não agendadas") nele.

## Arquitetura

Nova página `src/app/(app)/calendario/page.tsx` (server component) chama `listPericias()` (sem filtro de data — a tela busca tudo de uma vez; se isso pesar com o crescimento da base, um filtro de intervalo pode ser adicionado depois, YAGNI por ora) e `listPeritosOptions()`/`listColaboradoresOptions()` (já existentes, usados hoje pelos filtros da tela de Perícias), passando tudo para um novo `CalendarioScreen` (client component) em `src/features/pericias/components/calendario-screen.tsx`.

**Novo item de navegação** em `NAV_ITEMS` (`src/components/shared/sidebar.tsx`), rótulo "Calendário", visível para `admin`+`gerencia`, entre "Perícias" e "Processos".

### Filtros

Barra de filtros no topo (Situação, busca por nº de processo, Perito, Colaborador), mesmo padrão de `useSearchParams`/`router.push` já usado em `pericias-filters.tsx`, mas aplicados **client-side** sobre a lista já carregada (diferente da tela de Perícias, que filtra no servidor) — já que o calendário busca a base inteira de uma vez e os filtros aqui são só para reduzir o que aparece na tela, não para economizar consulta ao banco. Sem filtro de Local nem de intervalo de data (a navegação do próprio calendário já cobre isso).

### Divisão agendadas / não agendadas

- Perícias com `dataAgendada` e `horaAgendada` preenchidos → viram eventos do FullCalendar (`start` combinando os dois campos).
- Perícias sem data (`dataAgendada === null`) → lista lateral "Não agendadas", renderizada como itens arrastáveis via `Draggable` do `@fullcalendar/interaction`.

### Cards

Título do evento: número do processo + nome do perito. Cor de fundo segue a mesma paleta de `src/components/shared/status-badge.tsx` (`STYLES`/`LABELS` por Situação), reaproveitada aqui em vez de recriada, para manter consistência visual com a lista de Perícias.

### Clicar para editar

`eventClick`/`onClick` no item da lista de não-agendadas abre o mesmo `PericiaForm` (dialog) já usado na tela de Perícias, em modo edição, buscando os dados completos via `getPericiaForEdit(id)` (já existente).

### Arrastar para reagendar

No `eventDrop` (mover um evento já no calendário) e no `drop` (soltar um item da lista de não-agendadas sobre o calendário):

1. Calcula a nova `dataAgendada`/`horaAgendada` a partir de onde foi solto (na visão Mês, só a data muda, a hora existente — se houver — se mantém; nas visões Semana/Dia, a hora também muda para o horário exato do slot).
2. Se a perícia tem um `colaboradorId`, chama `getColaboradoresIndisponiveis(novaData, novaHora, id-da-propria-pericia)` (a mesma server action do pacote de validação de conflito).
3. Se vier algum ID em conflito **e for o colaborador dessa perícia**: desfaz o movimento (`info.revert()` do FullCalendar) e mostra `toast.error('Não é possível mover: o colaborador já está em outra perícia nesse dia e horário.')` — nenhuma chamada a `updatePericia` acontece.
4. Caso contrário: chama `updatePericia(id, { ...restante dos campos atuais, dataAgendada: novaData, horaAgendada: novaHora })` e mostra `toast.success('Perícia reagendada')`.

`updatePericia` já existe e espera o `PericiaInput` inteiro (não um patch parcial) — o handler de drop monta o objeto completo a partir dos dados já carregados daquela perícia (já presentes em `PericiaListItem`), trocando só `dataAgendada`/`horaAgendada`.

## Testes

- Mapeamento de `PericiaListItem[]` para eventos do FullCalendar: perícias com data viram eventos com as propriedades certas (id, título, data/hora, cor por situação); perícias sem data ficam de fora dos eventos e aparecem na lista de não-agendadas.
- Filtros client-side: aplicar cada filtro (situação, processo, perito, colaborador) reduz corretamente a lista de eventos e a lista de não-agendadas exibidas.
- Handler de drop: com conflito de colaborador → `info.revert()` chamado, `updatePericia` NÃO chamado, toast de erro; sem conflito → `updatePericia` chamado com a nova data/hora, toast de sucesso; perícia sem colaborador vinculado → pula a checagem de conflito e sempre atualiza.
- Clique num card abre o formulário de edição com os dados certos.

## Fora de escopo

- Exportar o calendário, notificações/lembretes.
- Criar uma perícia nova diretamente pelo calendário (clicar num dia vazio) — só editar/mover perícias já existentes, por enquanto.
- Validação equivalente de conflito de **Perito** (só Colaborador, mesma decisão do pacote de validação de conflito).
