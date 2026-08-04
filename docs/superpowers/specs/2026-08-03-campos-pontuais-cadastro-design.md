# Campos pontuais de cadastro — Observações, Escritório, remoção de Interno/Externo — Design

**Contexto:** primeira metade de um pacote maior pedido pelo usuário (a segunda metade, importação em massa via Excel, é um subsistema à parte com seu próprio design — ver `docs/superpowers/specs/<data>-importacao-excel-design.md` quando existir). Esta spec cobre só as mudanças pontuais de schema/formulário/tabela, que a importação em massa vai depender (a coluna Escritório precisa existir antes da importação poder gravar nela).

## Escopo

1. **Perícia**: nova coluna `observacoes` (texto livre, opcional).
2. **Processo**: nova coluna `escritorio` (texto, obrigatório).
3. **Colaborador**: remover a coluna `interno` (todo colaborador é interno agora).
4. **Perito**: nada a fazer — "Já trabalhamos?" já existe (`ja_trabalhamos`, já no formulário como switch).

## 1. Perícia — Observações

### Banco de dados

Nova migration `supabase/migrations/<timestamp>_pericia_observacoes.sql`:

```sql
alter table public.pericias add column observacoes text;
```

Nula por padrão (sem perícia perde dado existente), sem tamanho máximo.

### Schema e actions

`src/features/pericias/schemas.ts`: adicionar `observacoes: z.string().trim().nullable().default(null)` ao `periciaSchema`.

`src/features/pericias/actions.ts`:
- `PericiaListItem`: adicionar `observacoes: string | null`.
- `toRow`: mapear `observacoes: input.observacoes`.
- `listPericias`/`getPericiaForEdit`: incluir `observacoes` no `select` e no retorno.

### Formulário

`PericiaForm` (`src/features/pericias/components/pericia-form.tsx`): novo campo `<Textarea>` (componente já existe em `src/components/ui/textarea.tsx`) logo abaixo do campo Situação, rotulado "Observações", opcional, sem placeholder obrigatório.

### Tabela de Perícias

`PericiasTable` (`src/features/pericias/components/pericias-table.tsx`): nova coluna "Obs." entre Situação e a coluna de ações. Célula usa o mesmo padrão de truncamento + tooltip já estabelecido no calendário (`Tooltip`/`TooltipTrigger`/`TooltipContent` de `@/components/ui/tooltip`, com `truncate` no gatilho): mostra o texto cortado com reticências, e o texto completo aparece no tooltip ao passar o mouse. Se `observacoes` for `null`, mostra `—` sem tooltip.

## 2. Processo — Escritório

### Banco de dados

Nova migration `supabase/migrations/<timestamp>_processo_escritorio.sql`:

```sql
alter table public.processos add column escritorio text not null default '';
alter table public.processos alter column escritorio drop default;
```

(Adiciona com default vazio para não quebrar linhas existentes, depois remove o default para que todo INSERT futuro seja obrigado a informar um valor — mesmo padrão de "adicionar coluna not null em tabela com dados" que uma migration precisa para não falhar em produção.)

### Schema e actions

`src/features/processos/schemas.ts`: adicionar `escritorio: z.string().trim().min(1, 'Escritório é obrigatório')` ao `processoSchema`.

`src/features/processos/actions.ts`: adicionar `escritorio` ao tipo `Processo` e a todos os `select`/`insert`/`update` (`searchProcessos`, `createProcesso`, `listProcessos`, `getProcesso`, `updateProcesso`).

### Combobox de sugestão (`EscritorioCombobox`)

Novo componente `src/features/processos/components/escritorio-combobox.tsx`, seguindo o mesmo padrão visual/estrutural do `MunicipioCombobox` já existente (`Popover` + `Command`), mas sem tabela própria — `escritorio` é só uma coluna de texto em `processos`, não uma entidade com FK:

- Nova server action `listEscritoriosDistintos(): Promise<string[]>` em `src/features/processos/actions.ts`, fazendo `SELECT DISTINCT escritorio FROM processos ORDER BY escritorio` (ignorando string vazia).
- O combobox carrega essa lista uma vez (sem debounce de busca ao servidor — a lista tende a ser pequena, filtragem é client-side via `Command`'s busca embutida).
- Digitar um valor que não bate com nenhuma sugestão mostra uma opção "Usar '<texto digitado>'" que apenas atribui esse texto ao campo (não grava nada no banco até o formulário do Processo ser salvo — mesma mecânica de um combobox de texto livre com autocomplete, não de criação de entidade).

### Formulário

`ProcessoForm` (`src/features/processos/components/processo-form.tsx`): troca o `<Input>` que hoje não existe para Escritório por um `<EscritorioCombobox>` logo após o campo Número do processo. Como este form é reaproveitado tanto na tela de Processos quanto no dialog de criação rápida a partir da Perícia (`novo-processo-dialog.tsx`), as duas telas ganham o campo automaticamente.

### Tabelas

- `ProcessosTable` (`src/features/processos/components/processos-table.tsx`): nova coluna "Escritório" após "Número".
- `PericiasTable`: nova coluna "Escritório" (com truncamento + tooltip, mesmo tratamento de Observações) — vem do `item.processo.escritorio`, então `PericiaListItem.processo` também precisa incluir `escritorio` no tipo e no `select` de `listPericias`/`getPericiaForEdit`.

## 3. Colaborador — remover Interno/Externo

### Banco de dados

Nova migration `supabase/migrations/<timestamp>_colaborador_remove_interno.sql`:

```sql
alter table public.colaboradores drop column interno;
```

### Schema e actions

- `src/features/colaboradores/schemas.ts`: remover `interno` de `colaboradorSchema`.
- `src/features/colaboradores/actions.ts`: remover `interno` de `Colaborador`, `toRow` (se existir mapeamento próprio) e de todo `select`.
- `src/features/pericias/actions.ts`: remover `interno` do tipo `colaborador` dentro de `PericiaListItem` e do `select` de `listPericias`.

### Formulário e tabelas

- `ColaboradorForm` (`src/features/colaboradores/components/colaborador-form.tsx`): remover o `<Switch>` "Colaborador interno" e o estado `interno`.
- `ColaboradoresTable` (`src/features/colaboradores/components/colaboradores-table.tsx`): remover a coluna "Tipo".
- `PericiasTable`: remover a linha `{item.colaborador.interno ? 'Interno' : 'Externo'}` do painel expandido de detalhes (linha 167 hoje).

### Tipos gerados

`src/lib/supabase/database.types.ts` precisa ser regenerado após as três migrations rodarem no banco de dev (via `supabase gen types typescript`), já que esse arquivo reflete o schema real. Isso é um passo de execução, não algo a escrever manualmente na spec.

## Testes

- `pericia-form.test.tsx`: preencher e limpar o campo Observações reflete no `input` passado para `createPericia`/`updatePericia`.
- `pericias-table.test.tsx`: truncamento + tooltip de Observações e de Escritório (célula mostra texto cortado, tooltip mostra completo); `—` quando `observacoes` é `null`.
- `processo-form.test.tsx`: submeter sem Escritório preenchido bloqueia o envio (mensagem de erro do schema); selecionar uma sugestão existente ou digitar um valor novo funciona.
- `escritorio-combobox.test.tsx`: lista as sugestões vindas de `listEscritoriosDistintos`, filtra ao digitar, mostra "Usar '...'" quando não há correspondência.
- `colaborador-form.test.tsx`: teste existente que cobria o switch "interno" é removido (não substituído — a funcionalidade deixou de existir).
- `colaboradores-table.test.tsx`/`pericias-table.test.tsx`: qualquer asserção existente sobre "Interno"/"Externo" é removida.
- Suíte completa (`npx vitest run`), `tsc --noEmit` e `npm run build` continuam verdes ao final — a remoção de `interno` deve estourar erros de tipo em qualquer lugar esquecido, o que serve como rede de segurança.

## Fora de escopo

- Importação em massa via Excel (spec própria, a seguir).
- Qualquer mudança em Perito além de confirmar que "Já trabalhamos?" já existe.
- Adicionar Escritório ao tooltip/cards do calendário de Perícias (o dado passa a existir e fica disponível para isso depois, mas não faz parte deste pacote).
- Migrar uma lista fixa de escritórios conhecidos (PMRA, CESCON, S&V etc.) — eles simplesmente aparecerão como sugestão assim que o primeiro processo de cada um for cadastrado ou importado.
