# Design — Reformulação de UX/UI do Gestão de Perícias

Data: 2026-07-27

## 1. Contexto e objetivo

O SaaS de Gestão de Perícias está funcionalmente completo (22 tarefas do plano
original, testado, revisado e em produção com um admin de teste). Uso real do
app revelou fricções de UX e uma identidade visual crua (tema padrão do
shadcn/ui, sem paleta própria). Este documento cobre uma reformulação de UX/UI
que:

- Move a criação/edição de perícias, peritos, colaboradores e processos de
  páginas dedicadas para modais sobre a listagem.
- Adiciona feedback de carregamento (skeletons, spinners) e notificações
  (toast) em todas as ações.
- Troca o tooltip da listagem de perícias por um acordeão expansível.
- Adiciona uma tela de gestão de Processos (hoje só criável inline).
- Adota uma identidade visual escura própria, derivada de uma imagem de
  referência (fotografia duotone em tons de teal profundo de um prédio/escada).
- Torna a sidebar encolhível.

Fora de escopo: modo claro, deep-link para abrir o modal de edição de um
registro específico via URL, ações em lote, drag-and-drop.

## 2. Identidade visual

### 2.1 Paleta (tema escuro único)

| Token CSS | Hex | Uso |
|---|---|---|
| `--background` | `#0A1614` | Fundo geral da aplicação |
| `--surface` | `#101F1D` | Sidebar, cards, modais, linhas de tabela, popovers |
| `--border` | `#1E3634` | Bordas sutis, divisores |
| `--accent` (primary) | `#35C2AE` | Botões primários, links, item ativo da sidebar, anéis de foco |
| `--accent-foreground` | `#07211D` | Texto sobre elementos com fundo `accent` (contraste) |
| `--foreground` | `#EDEFEE` | Texto principal |
| `--muted-foreground` | `#8FA6A3` | Texto secundário, labels, placeholders |

Cores semânticas (situação da perícia e toasts), ajustadas para contraste
sobre o fundo escuro:

| Situação / estado | Hex |
|---|---|
| `pendente` (âmbar) | `#D9A441` |
| `marcada` (azul) | `#4A9FE0` |
| `realizada` / sucesso (verde) | `#4ABE7A` |
| `cancelada` / erro / destructive (coral) | `#E06A5F` |

Essas cores substituem as classes `bg-yellow-100 text-yellow-800` etc.
atualmente hardcoded em `StatusBadge` por variáveis do tema (ver §6).

### 2.2 Tipografia

- **Space Grotesk** — títulos (`h1`/`h2`), carregada via `next/font/google`.
- **IBM Plex Sans** — corpo, formulários, tabelas (fonte padrão do `body`).
- **IBM Plex Mono** — campos tabulares específicos: número do processo, CREA,
  documento, datas/horas nas tabelas. Aplicada via uma classe utilitária
  `font-mono-data` nesses campos específicos, não no app inteiro.

### 2.3 Hover e interação

- Botões primários (`variant="default"`): escurecem o `accent` ao passar o
  mouse (`hover:bg-[oklch(from_var(--accent)_calc(l-0.08)_c_h)]` ou
  equivalente já suportado pelas classes existentes de `buttonVariants`).
- Botões outline/ghost e itens de navegação da sidebar: ganham fundo
  `surface` sutil no hover.
- Linhas de tabela: leve clareamento de fundo no hover, sinalizando que a
  linha tem uma ação de editar disponível.
- Ícones/links: transição de cor para `accent`.

### 2.4 Elemento de assinatura

A tela de login (`src/app/login/page.tsx`) ganha um painel lateral com um
gradiente sutil em tons de teal (abstrato — não a foto de referência
literal), usando `--background`/`--surface`/`--accent` em um gradiente
diagonal suave. É o único lugar do app com essa personalidade mais forte; as
telas de dados permanecem disciplinadas.

### 2.5 Implementação

Tailwind v4 é CSS-first (sem `tailwind.config.js`, ver `src/app/globals.css`).
A paleta é definida como variáveis CSS em `:root` dentro de `globals.css`,
seguindo a convenção que o shadcn/ui já usa (`--background`, `--foreground`,
`--primary`, etc.) — os tokens acima mapeiam para essas variáveis existentes
(`--accent` acima = `--primary` do shadcn), não criam um sistema paralelo.
Como o app é dark-only, essas variáveis são definidas uma única vez (sem bloco
`.dark` separado sobrepondo — o tema escuro passa a ser o único tema).

## 3. Infraestrutura compartilhada

### 3.1 Toast

- `npx shadcn add sonner` — adiciona `src/components/ui/sonner.tsx`.
- `<Toaster />` montado uma vez em `src/app/(app)/layout.tsx`.
- Toda action de criar/editar chama `toast.success('<Entidade> salvo com
  sucesso')` ao concluir, ou `toast.error(result.error)` ao falhar — dispara
  a partir do componente de modal de cada entidade (ver §4), não da server
  action em si (toasts são client-side).

### 3.2 Skeletons e loading de rota

- `npx shadcn add skeleton` — adiciona `src/components/ui/skeleton.tsx`.
- Novo componente `src/components/shared/table-skeleton.tsx`: recebe
  `columns: number` e `rows?: number` (padrão 5), renderiza uma `<Table>`
  com células `<Skeleton className="h-4 w-full" />`.
- Um arquivo `loading.tsx` por rota que lista dados (`(app)/page.tsx`,
  `(app)/peritos/`, `(app)/colaboradores/`, `(app)/processos/`,
  `(app)/perfis/`), renderizando `<TableSkeleton columns={N} />` com o número
  de colunas daquela tabela. Usa o mecanismo nativo do App Router
  (Suspense) — não precisa de estado de loading manual.

### 3.3 Estado de carregamento em botões

Todos os botões de salvar (peritos, colaboradores, processos, perícias)
passam a usar um padrão único: ícone `Loader2` (lucide-react) com
`animate-spin` + texto, substituindo o texto solto "Salvando...". Mesmo
padrão nos botões "Buscando..." dos comboboxes de processo/município,
trocando o texto por um spinner discreto dentro do popover.

## 4. Padrão modal de CRUD

Cada entidade com CRUD (Peritos, Colaboradores, Processos, Perícias) ganha um
componente `<EntidadeScreen items={...} />` (client component) que
encapsula: o botão "Novo", a tabela e **um único `Dialog` reaproveitado**
para criar/editar.

```tsx
// Estado do Screen
const [dialogOpen, setDialogOpen] = useState(false);
const [editing, setEditing] = useState<Perito | null>(null); // null = criando

function openCreate() { setEditing(null); setDialogOpen(true); }
function openEdit(item: Perito) { setEditing(item); setDialogOpen(true); }

function handleSaved() {
  setDialogOpen(false);
  toast.success(editing ? 'Perito atualizado' : 'Perito criado');
  router.refresh();
}
```

O formulário já existente de cada entidade (`PeritoForm`, `ColaboradorForm`,
`PericiaForm`, novo `ProcessoForm`) passa a viver **dentro do `Dialog`**, e
recebe `onSaved: () => void` no lugar de fazer `router.push`. Em caso de
erro, o formulário chama `onError: (message: string) => void` (o Screen
dispara `toast.error`); o modal **permanece aberto**. O parágrafo de erro
inline atual (`{error && <p>...}`) é removido — o toast passa a ser o único
canal de feedback de erro/sucesso.

A página do Next.js (Server Component) fica reduzida a buscar dados e
renderizar o Screen:

```tsx
// (app)/peritos/page.tsx
export default async function PeritosPage() {
  const items = await listPeritos();
  return <PeritosScreen items={items} />;
}
```

**Edição**: cada linha da tabela ganha uma célula de ações com um ícone de
lápis (`Pencil` do lucide-react) que chama `openEdit(item)`.

**Rotas removidas**: `/pericias/nova`, `/pericias/[id]`, `/peritos/novo`,
`/peritos/[id]`, `/colaboradores/novo`, `/colaboradores/[id]` deixam de
existir. Tudo acontece via modal na própria listagem.

### 4.1 Processos — nova tela

Hoje só existe `searchProcessos`/`createProcesso` (usados pelo combobox de
perícia). Esta reformulação adiciona:

- `listProcessos(): Promise<Processo[]>` — lista completa, ordenada por
  número (mesmo padrão de `listPeritos`/`listColaboradores`).
- `getProcesso(id: number): Promise<Processo | null>`.
- `updateProcesso(id: number, input: ProcessoInput): Promise<ActionResult<Processo>>`.
- Nova rota `/processos` na sidebar (entre Perícias e Peritos), com o mesmo
  padrão `ProcessosScreen` + `ProcessoForm` (extraído do conteúdo hoje dentro
  de `NovoProcessoDialog`, que passa a ser reaproveitado tanto pelo modal
  standalone da tela de Processos quanto pelo fluxo inline do combobox de
  perícia).

## 5. Listagem de perícias: acordeão

Cada linha ganha uma célula extra à esquerda com um ícone de seta
(`ChevronRight`, rotaciona para baixo quando expandida). Ao clicar, uma
`<tr>` extra aparece logo abaixo com `<td colSpan={7}>` contendo 3 blocos
lado a lado (grid de 3 colunas em telas médias+, empilhado em mobile):

| Processo | Perito | Colaborador |
|---|---|---|
| Autor × Réu | Contato, Formação, CREA, Já trabalhamos, Relação, Resultados | Contato, Formação, Interno/Externo |

Não usa o componente `Accordion` do shadcn/ui (é baseado em `<div>`s, não
compatível com `<tr>`/`<td>`) — é uma linha de tabela condicional com
transição de altura/opacidade via classes Tailwind, com a mesma linguagem
visual (chevron rotativo). Estado de quais linhas estão expandidas é local
(`Set<number>` de ids) no `PericiasTable`, que também recebe o ícone de
editar (abre o `Dialog` de perícia, mesmo padrão do §4).

`TooltipCell`/`Tooltip` deixam de ser usados na listagem de perícias — o
componente `Tooltip`/`TooltipTrigger`/`TooltipContent` continua existindo
(reaproveitado pelos tooltips de label da sidebar colapsada, §7).

## 6. StatusBadge com cores do tema

`src/components/shared/status-badge.tsx` troca as classes hardcoded
(`bg-yellow-100 text-yellow-800` etc.) pelas cores semânticas do §2.1,
definidas como variáveis CSS (`--status-pendente`, `--status-marcada`,
`--status-realizada`, `--status-cancelada`) em `globals.css`, para não
duplicar valores hex espalhados pelo código.

## 7. Sidebar encolhível

- Botão de toggle (ícone `PanelLeftClose`/`PanelLeftOpen`) no rodapé da
  sidebar, ao lado do botão de sair.
- Expandida: `w-56` (atual), ícone + texto. Colapsada: `w-16`, só ícones
  centralizados.
- Cada item de navegação, quando colapsado, fica envolto em
  `TooltipCell`-style (`Tooltip`/`TooltipTrigger`/`TooltipContent`) mostrando
  o nome da tela no hover.
- Estado persistido em `localStorage` (chave `sidebar-collapsed`), lido no
  mount do componente (client component, sem SSR flash relevante dado que é
  um detalhe de preferência, não de conteúdo).
- Transição de largura via `transition-all duration-200`.

## 8. Testes

Cada modal/Screen novo segue o padrão de teste já estabelecido no projeto
(Vitest + Testing Library): renderizar o Screen, clicar em "Novo", preencher
o formulário dentro do modal, submeter, e verificar que `router.refresh` foi
chamado e o modal fechou. Testes de `listProcessos`/`getProcesso`/
`updateProcesso` seguem o padrão de mocking já usado em
`peritos/actions.test.ts`/`colaboradores` (mockando `@/lib/supabase/server`
e `@/features/auth/guards`). O acordeão da listagem de perícias ganha um
teste verificando que o clique no chevron expande a linha e mostra os 3
blocos de detalhe.

## 9. Fora de escopo

- Modo claro (tema escuro é o único por enquanto).
- Deep-link para abrir o modal de edição de um registro específico via URL.
- Ações em lote (excluir/editar múltiplos registros de uma vez).
- Drag-and-drop.
- Mudança de paleta/tema após esta reformulação (ex.: seletor de tema).
