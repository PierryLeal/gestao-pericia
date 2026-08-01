# Export de Perícias para Excel — Design

**Contexto:** o usuário pediu um botão na tela de Perícias que exporte a listagem atual (respeitando os filtros ativos) para uma planilha `.xlsx`, com todas as colunas já exibidas na tela mais Autor e Réu (campos do Processo vinculado, não exibidos hoje na tabela).

## Escopo

Um botão "Exportar Excel" na tela de Perícias, ao lado de "Nova perícia", que gera e baixa um arquivo `.xlsx` com as perícias atualmente filtradas.

## Por que isso é pequeno

`listPericias(filters)` (`src/features/pericias/actions.ts:37`) já retorna tudo que o export precisa: já aplica todos os filtros ativos (situação, busca, intervalo de data, local, perito, colaborador) e já traz `processo.autor`/`processo.reu` via join (`processo:processos!inner ( id, numero, autor, reu )`, linha 49). **Nenhuma mudança de schema, migration ou nova server action é necessária** — o export é só uma nova forma de consumir uma função que já existe.

## Arquitetura

Um novo componente client `ExportPericiasButton` (dentro de `src/features/pericias/components/`), colocado em `PericiasScreen` ao lado do botão "Nova perícia". Ao clicar:

1. Lê os filtros atuais via `useSearchParams()` (mesmo padrão já usado em `pericias-filters.tsx`), montando o mesmo objeto de filtros que `src/app/(app)/page.tsx:16-24` já monta para `listPericias`.
2. Chama `listPericias(filters)` diretamente (é uma server action, pode ser chamada de um Client Component) — busca fresca no momento do clique, não reaproveita o `itemsPromise` já carregado na tela (evitaria mexer no Suspense boundary existente da tabela, que hoje só cobre a área da tabela, não a tela toda).
3. Se a lista vier vazia, mostra um toast informativo ("Nenhuma perícia para exportar com os filtros atuais.") e para — não gera arquivo vazio.
4. Monta o workbook com a biblioteca `exceljs` (`^4.4.0`, nova dependência — funciona tanto no Node quanto no navegador) e dispara o download via Blob + link temporário.
5. Toast de sucesso ("Planilha exportada") ao concluir; toast de erro se `listPericias` lançar.

**Nova dependência:** `exceljs`. Sem backend/rota nova — a geração do arquivo acontece inteiramente no navegador.

## Colunas do arquivo (nesta ordem)

Mapeadas 1:1 a partir de um `PericiaListItem` (`src/features/pericias/actions.ts:11-23`):

| Coluna | Origem | Observação |
|---|---|---|
| Nº Processo | `processo.numero` | texto |
| Data | `dataAgendada` | célula de data real (não texto), vazia se `null` — não a string "Não agendado" |
| Hora | `horaAgendada` | texto `HH:mm`, vazia se `null` |
| Local | `` `${municipio.nome}/${municipio.uf}` `` | mesmo formato já usado na tabela |
| Perito | `perito.nome` | texto |
| Colaborador | `colaborador?.nome ?? ''` | vazio se sem colaborador vinculado |
| Situação | `situacao` | traduzido para o rótulo em português já usado na tela (`Pendente`/`Marcada`/`Realizada`/`Cancelada` — mesmo mapa `LABELS` de `src/components/shared/status-badge.tsx:11-16`, reaproveitado ou duplicado como constante local) |
| Autor | `processo.autor` | novo, não exibido na tela |
| Réu | `processo.reu` | novo, não exibido na tela |

Cabeçalhos em negrito (primeira linha), largura de coluna razoável fixa por coluna (não autofit — `exceljs` não calcula isso sozinho no navegador sem medir texto, e não vale a complexidade para uma planilha deste tamanho).

## Nome do arquivo

`pericias-AAAA-MM-DD.xlsx`, usando a data local do momento do clique (não a data do servidor).

## Testes

- Teste de componente para `ExportPericiasButton`: mocka `listPericias` (via `../actions`) e `exceljs`; cobre (a) clique chama `listPericias` com os filtros lidos da URL, (b) lista vazia mostra o toast informativo e não tenta gerar arquivo, (c) lista não-vazia monta o workbook com as 9 colunas na ordem certa e dispara o download, (d) erro do `listPericias` mostra toast de erro.
- Não precisa de teste de integração real gerando um `.xlsx` binário e abrindo — mockar `exceljs` no teste de componente já cobre a lógica de mapeamento de colunas, que é a parte que pode ter bug.

## Fora de escopo

- Qualquer alteração na tabela/tela em si além de adicionar o botão.
- Exportar em outro formato (PDF, CSV) — só `.xlsx`, conforme decidido.
- Autofit de colunas / formatação visual elaborada (cores, bordas) — planilha simples e funcional.
- Exportar de outras telas (Peritos, Processos, Colaboradores) — só Perícias, como pedido.
