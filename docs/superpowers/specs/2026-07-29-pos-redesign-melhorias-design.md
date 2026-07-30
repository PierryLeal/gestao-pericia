# Design — Melhorias pós-redesign (categorização, filtros, máscaras)

Data: 2026-07-29

## 1. Contexto e objetivo

Após a reformulação de UX/UI (spec `2026-07-27-ux-redesign-design.md`), uso
real do app revelou uma correção pendente e um conjunto de melhorias. A
correção (bug de navegação/skeleton) e dois ajustes triviais de estilo já
foram implementados fora deste spec — ver §5. Este documento cobre as
melhorias que exigem decisão de design:

1. Peritos: `relacao`/`resultados` deixam de ser nota 0-10 e passam a ser
   categorias fixas e coloridas.
2. Perícias: novos filtros (data, local, perito, colaborador).
3. Processos/Peritos/Colaboradores: busca por texto (hoje só existe em
   Perícias).
4. Máscaras de input: telefone (contato) e CPF (documento) do Perito e
   Colaborador.

Fora de escopo: máscara de CREA (formato varia demais por estado), filtro de
período (apenas data única), busca client-side (tudo via servidor).

## 2. Peritos: Relação e Resultado categorizados

### 2.1 Banco de dados

Nova migration `supabase/migrations/<timestamp>_perito_categorias.sql`,
seguindo o padrão do enum `pericia_situacao` já existente:

```sql
create type public.perito_relacao as enum ('ruim', 'neutra', 'boa', 'otima');
create type public.perito_resultado as enum ('negativo', 'parcial', 'positivo');

alter table public.peritos add column relacao_new public.perito_relacao;
update public.peritos set relacao_new = case
  when relacao <= 3 then 'ruim'
  when relacao <= 6 then 'neutra'
  when relacao <= 8 then 'boa'
  else 'otima'
end::public.perito_relacao;
alter table public.peritos alter column relacao_new set not null;
alter table public.peritos alter column relacao_new set default 'neutra';
alter table public.peritos drop column relacao;
alter table public.peritos rename column relacao_new to relacao;

-- mesmo padrão para resultados (negativo <=3, parcial <=6, positivo >6)
```

Colunas antigas (`smallint` 0-10) são substituídas, não mantidas em paralelo —
não há necessidade de reter o número após a migração.

### 2.2 Camada de aplicação

- `src/features/peritos/schemas.ts`: `relacao`/`resultados` passam de
  `z.number().int().min(0).max(10)` para `z.enum([...])`. Exporta
  `relacaoOptions = ['ruim', 'neutra', 'boa', 'otima']` e
  `resultadoOptions = ['negativo', 'parcial', 'positivo']` (mesmo padrão de
  `situacaoOptions` em `pericias/schemas.ts`).
- `database.types.ts`: atualiza os tipos gerados para os dois campos.

### 2.3 Formulário

Em `PeritoForm`, os dois `<Input type="number">` viram `<Select>` (mesmo
componente e padrão já usado no campo Situação de `PericiaForm`), com os
rótulos em português (Ótima/Boa/Neutra/Ruim e Positivo/Parcial/Negativo) e o
valor interno em minúsculo sem acento.

### 2.4 Exibição

Novo componente `src/components/shared/relacao-badge.tsx` e
`resultado-badge.tsx` (ou um único `CategoryBadge` parametrizado — decisão de
implementação, não de design), no mesmo padrão visual de `StatusBadge`
(`bg-[cor]/15 text-[cor]`, pill arredondado).

Cores (reaproveitando tokens já existentes, sem novas variáveis globais):

| Categoria | Valor | Cor | Token reaproveitado |
|---|---|---|---|
| Relação | ótima | verde | `--status-realizada` |
| Relação | boa | azul | `--status-marcada` |
| Relação | neutra | cinza | `--muted-foreground` |
| Relação | ruim | vermelho | `--status-cancelada` |
| Resultado | positivo | verde | `--status-realizada` |
| Resultado | parcial | cinza | `--muted-foreground` |
| Resultado | negativo | vermelho | `--status-cancelada` |

Usado em `PeritosTable` (substitui "8/10") e no bloco expandido de
`PericiasTable` (substitui "Relação: 8/10 · Resultados: 9/10").

## 3. Perícias: novos filtros

`PericiasFilters` ganha, além do que já existe (busca por número, situação):

- **Data**: `<Input type="date">`, filtra por `dataAgendada` exata.
- **Local**: reaproveita `MunicipioCombobox` já usado no formulário.
- **Perito**: novo combobox simples (lista vem de `listPeritosOptions()`, já
  buscada pela página — sem nova query).
- **Colaborador**: novo combobox simples, mesma lógica.

Todos os filtros somam-se como query params (`?data=&municipioId=&peritoId=&colaboradorId=&situacao=&busca=`),
seguindo o padrão de debounce (300ms) e `router.push` já usado — incluindo a
guarda contra push redundante corrigida nesta sessão. `listPericias` passa a
aceitar os quatro novos parâmetros opcionais.

## 4. Busca em Processos, Peritos e Colaboradores

Cada tela ganha um componente `*-filters.tsx` (mirror de `PericiasFilters`,
mesmo padrão de busca com debounce 300ms via query param `busca`):

| Tela | Campo(s) de busca | Nova capacidade na action |
|---|---|---|
| Processos | número, autor ou réu | `listProcessos(busca?: string)` |
| Peritos | nome | `listPeritos(busca?: string)` |
| Colaboradores | nome | `listColaboradores(busca?: string)` |

## 5. Máscaras de input

Sem biblioteca nova — máscara incremental simples via `onChange` (formata a
string a cada dígito digitado), mesmo estilo usado em projetos React sem
dependência de máscara.

| Campo | Tela(s) | Máscara |
|---|---|---|
| Contato | Perito, Colaborador | `(99) 99999-9999` |
| Documento | Perito | `999.999.999-99` (CPF) |
| CREA | Perito | Sem máscara (fora de escopo) |

## 6. Já implementado nesta sessão (fora deste spec)

Para contexto — não faz parte do plano de implementação a seguir:

- Paleta clara (fundo branco, cor só em botão/sidebar/badges) e fix do
  painel escuro do login.
- Fix da altura da sidebar (`min-h-screen` → `h-screen`).
- `React.cache()` em `getCurrentProfile` (deduplicação de chamadas ao
  Supabase por request).
- Streaming por tabela (`use()` + `Suspense`) nas 4 telas.
- Fix de bug: debounce de `PericiasFilters` disparava `router.push`
  redundante mesmo sem mudança, podendo "puxar" a navegação de volta para `/`
  sob rede lenta.
- Barra de progresso de navegação (`NavProgressBar`/`NavProgressReporter`,
  via `useLinkStatus`), já que este Next.js não tem `cacheComponents`
  habilitado (recurso "draft") para instant navigation nativo.
- Cor nos headers de tabela (`text-primary` no componente base `TableHead`).
- `cursor-pointer` no componente base `Button`.

## 7. Testes

- Migration: não tem teste automatizado (é SQL rodado no Supabase); validar
  manualmente com `supabase db reset` local ou equivalente antes de aplicar
  em produção.
- Schemas/actions: testes unitários para os novos enums e para os parâmetros
  de busca nas actions (mirror dos testes já existentes de `listPericias`).
- Componentes: testes para os novos filtros (mirror de
  `pericias-filters.test.tsx`, já criado nesta sessão) e para os badges de
  categoria.
- Formulários: testes de `PeritoForm` atualizados para os novos `Select` em
  vez de `Input type="number"`.
