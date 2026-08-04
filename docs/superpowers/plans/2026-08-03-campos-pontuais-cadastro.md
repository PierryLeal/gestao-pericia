# Campos pontuais de cadastro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `observacoes` to Perícia, `escritorio` to Processo, and remove `interno` from Colaborador, across schema, server actions, forms, and tables.

**Architecture:** Each task is a self-contained vertical slice (migration → hand-maintained `database.types.ts` → Zod schema → server actions → form → table), following the exact patterns already established in this codebase (Base UI `Select`/`Command`/`Popover`, `Textarea`, the `TooltipCell` truncate+tooltip pattern). No new libraries.

**Tech Stack:** Next.js 16 App Router + React 19, Supabase (Postgres + supabase-js), Zod, Vitest/RTL, Base UI components.

## Global Constraints

- `database.types.ts` (`src/lib/supabase/database.types.ts`) is **hand-maintained in this repo**, not CLI-generated — there is no `supabase gen types` step. Every column added/removed in a migration must be mirrored by hand in this file's `Database['public']['Tables'][...]` shape, or the typed Supabase client (`createClient<Database>()`) will fail to compile against the new/removed column.
- Migrations go in `supabase/migrations/` as `<timestamp>_<name>.sql`, one logical change per file, matching the existing files in that directory. After creating a migration file, apply it to the linked dev Supabase project with `npx supabase db push` from the repo root — this is the dev database, not production; no extra confirmation gate applies (that gate is production-only, per this project's standing convention).
- `Processo.escritorio` is `not null`. The migration adds it with a temporary `default ''` so existing rows don't break, then drops the default so every future `insert`/`update` is forced to supply a value.
- `Colaborador.interno` is removed everywhere: migration (`drop column`), Zod schema, the `Colaborador` and `PericiaListItem['colaborador']` TypeScript types, `ColaboradorForm`'s switch, `ColaboradoresTable`'s column, and the now-dead `item.colaborador.interno` read in `PericiasTable`'s expanded detail panel.
- Perito needs no changes — "Já trabalhamos?" (`ja_trabalhamos`) already exists end-to-end (column, schema, action, switch in `PeritoForm`). No task touches Perito files.
- New truncate+tooltip table cells reuse the existing `TooltipCell` component (`src/components/shared/tooltip-cell.tsx`) — do not hand-roll a new `Tooltip`/`TooltipTrigger`/`TooltipContent` composition for these.
- `EscritorioCombobox` (new) follows the exact structural pattern of `MunicipioCombobox` (`src/features/municipios/components/municipio-combobox.tsx`): `Popover` + `Command` with a `PopoverTrigger` styled as an outline `Button` with `role="combobox"`. Unlike `MunicipioCombobox`, it has no backing table/FK — it manages a plain `string` value with autocomplete suggestions, not a selected-object model.

---

### Task 1: Perícia — Observações

**Files:**
- Create: `supabase/migrations/20260803000001_pericia_observacoes.sql`
- Modify: `src/lib/supabase/database.types.ts`
- Modify: `src/features/pericias/schemas.ts`
- Modify: `src/features/pericias/schemas.test.ts`
- Modify: `src/features/pericias/actions.ts`
- Modify: `src/features/pericias/actions.test.ts`
- Modify: `src/features/pericias/components/pericia-form.tsx`
- Modify: `src/features/pericias/components/pericia-form.test.tsx`
- Modify: `src/features/pericias/components/pericias-table.tsx`
- Modify: `src/features/pericias/components/pericias-table.test.tsx`

**Interfaces:**
- Consumes: `Textarea` from `@/components/ui/textarea` (existing, unchanged); `TooltipCell` from `@/components/shared/tooltip-cell` (existing, unchanged, `{ label: ReactNode; detail: ReactNode }`).
- Produces: `PericiaInput['observacoes']: string | null` and `PericiaListItem['observacoes']: string | null` — consumed as-is by Tasks 2-3 (neither touches Perícia's own fields, but Task 2 adds a new column to `PericiaListItem['processo']` in the same file).

- [ ] **Step 1: Create and apply the migration**

Create `supabase/migrations/20260803000001_pericia_observacoes.sql`:

```sql
alter table public.pericias add column observacoes text;
```

Run: `npx supabase db push`
Expected: migration applied with no errors (nullable column, no existing-row backfill needed).

- [ ] **Step 2: Update `database.types.ts`**

In `src/lib/supabase/database.types.ts`, in the `pericias` table entry, add `observacoes` to `Row` (always present, nullable) and to `Insert` (optional, nullable — matches how `data_agendada`/`hora_agendada` are already declared on this same table):

```ts
      pericias: {
        Row: {
          id: number; processo_id: number; data_agendada: string | null; hora_agendada: string | null;
          municipio_id: number; perito_id: number; colaborador_id: number | null;
          situacao: PericiaSituacao; observacoes: string | null; created_at: string;
        };
        Insert: {
          processo_id: number; data_agendada?: string | null; hora_agendada?: string | null; municipio_id: number;
          perito_id: number; colaborador_id?: number | null; situacao?: PericiaSituacao; observacoes?: string | null;
        };
```

(`Update` already reads `Partial<Database['public']['Tables']['pericias']['Insert']>` — no separate edit needed there.)

- [ ] **Step 3: Write the failing schema test**

Add to `src/features/pericias/schemas.test.ts`, inside the existing `describe('periciaSchema', ...)` block:

```ts
  it('accepts a string observacoes and defaults it to null when omitted', () => {
    const withNote = periciaSchema.safeParse({
      processoId: 1,
      dataAgendada: '2026-08-01',
      horaAgendada: '14:30',
      municipioId: 1,
      peritoId: 1,
      colaboradorId: null,
      situacao: 'marcada',
      observacoes: 'Perícia remarcada a pedido do perito',
    });
    expect(withNote.success).toBe(true);
    expect(withNote.success && withNote.data.observacoes).toBe('Perícia remarcada a pedido do perito');

    const withoutNote = periciaSchema.safeParse({
      processoId: 1,
      dataAgendada: '2026-08-01',
      horaAgendada: '14:30',
      municipioId: 1,
      peritoId: 1,
      colaboradorId: null,
      situacao: 'marcada',
    });
    expect(withoutNote.success).toBe(true);
    expect(withoutNote.success && withoutNote.data.observacoes).toBeNull();
  });
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/features/pericias/schemas.test.ts`
Expected: FAIL — `withNote.data.observacoes` is `undefined` (the field is stripped by Zod since `periciaSchema` doesn't declare it yet).

- [ ] **Step 5: Add the field to the schema**

In `src/features/pericias/schemas.ts`, add to `periciaSchema` (after `situacao`):

```ts
  observacoes: z.string().trim().nullable().default(null),
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/features/pericias/schemas.test.ts`
Expected: PASS, all tests.

- [ ] **Step 7: Update `PericiaListItem`, `toRow`, and the two selects in `actions.ts`**

In `src/features/pericias/actions.ts`:

Add `observacoes: string | null;` to `PericiaListItem` (after `situacao`):

```ts
export type PericiaListItem = {
  id: number;
  dataAgendada: string | null;
  horaAgendada: string | null;
  situacao: PericiaInput['situacao'];
  observacoes: string | null;
  processo: { id: number; numero: string; autor: string; reu: string };
  ...
```

Add `observacoes` to `toRow`:

```ts
function toRow(input: PericiaInput) {
  return {
    processo_id: input.processoId,
    data_agendada: input.dataAgendada,
    hora_agendada: input.horaAgendada,
    municipio_id: input.municipioId,
    perito_id: input.peritoId,
    colaborador_id: input.colaboradorId,
    situacao: input.situacao,
    observacoes: input.observacoes,
  };
}
```

In `listPericias`, add `observacoes` to the top-level `select` columns (right after `situacao`):

```ts
    .select(`
      id, data_agendada, hora_agendada, situacao, observacoes,
      processo:processos!inner ( id, numero, autor, reu ),
      municipio:municipios!inner ( id, nome, uf ),
      perito:peritos!inner ( id, nome, contato, formacao, crea, ja_trabalhamos, relacao, resultados ),
      colaborador:colaboradores ( id, nome, contato, formacao, interno )
    `)
```

And add `observacoes: row.observacoes,` to the mapped return object (right after `situacao: row.situacao,`).

In `getPericiaForEdit`, add `observacoes` to the select and to the returned object:

```ts
    .select(`
      id, data_agendada, hora_agendada, situacao, observacoes, perito_id, colaborador_id,
      processo:processos ( id, numero, autor, reu ),
      municipio:municipios ( id, nome, uf )
    `)
```

```ts
  return {
    id: row.id,
    processoId: row.processo.id,
    dataAgendada: row.data_agendada,
    horaAgendada: row.hora_agendada,
    municipioId: row.municipio.id,
    peritoId: row.perito_id,
    colaboradorId: row.colaborador_id,
    situacao: row.situacao,
    observacoes: row.observacoes,
    processo: row.processo,
    municipio: row.municipio,
  };
```

- [ ] **Step 8: Update the two `actions.test.ts` fixtures this touches**

In `src/features/pericias/actions.test.ts`:

`validInput` (used by `createPericia`/`updatePericia` tests) gains `observacoes: null`:

```ts
const validInput = {
  processoId: 1,
  dataAgendada: '2026-08-01',
  horaAgendada: '14:30',
  municipioId: 3550308,
  peritoId: 1,
  colaboradorId: null,
  situacao: 'marcada' as const,
  observacoes: null,
};
```

The `'inserts a valid pericia and returns its id'` test's `expect(mockInsert).toHaveBeenCalledWith({...})` gains `observacoes: null` as the last field:

```ts
    expect(mockInsert).toHaveBeenCalledWith({
      processo_id: 1,
      data_agendada: '2026-08-01',
      hora_agendada: '14:30',
      municipio_id: 3550308,
      perito_id: 1,
      colaborador_id: null,
      situacao: 'marcada',
      observacoes: null,
    });
```

In the `listPericias` describe block, `fullRow` gains `observacoes: 'Levar equipamento extra'` (right after `situacao: 'marcada',`), and the `'maps a full row with all embeds present without throwing'` test's expected result gains the matching `observacoes: 'Levar equipamento extra'` (right after `situacao: 'marcada',` in the expected object).

- [ ] **Step 9: Run the pericias actions/schema tests to verify they pass**

Run: `npx vitest run src/features/pericias/actions.test.ts src/features/pericias/schemas.test.ts`
Expected: PASS, all tests.

- [ ] **Step 10: Write the failing test for `PericiaForm`'s Observações field**

Add to `src/features/pericias/components/pericia-form.test.tsx`, inside the existing `describe('PericiaForm', ...)` block. This needs the `createPericia` mock to actually capture its argument (the existing mock ignores its input), so change the mock at the top of the file first:

```tsx
vi.mock('../actions', () => ({
  createPericia: vi.fn(async () => ({ success: true, data: { id: 5 } })),
  updatePericia: vi.fn(async () => ({ success: true, data: { id: 5 } })),
  getColaboradoresIndisponiveis: vi.fn(async () => []),
}));
```

stays as-is (it's a plain mock, args are always recorded by `vi.fn()` regardless of the implementation) — import `createPericia` at the top alongside `getColaboradoresIndisponiveis`:

```tsx
import { createPericia, getColaboradoresIndisponiveis } from '../actions';
```

Then add the test:

```tsx
  it('sends a trimmed observacoes value, or null when left blank', async () => {
    const user = userEvent.setup();
    render(
      <PericiaForm peritos={[{ id: 1, nome: 'Carlos' }]} colaboradores={[]} onSaved={vi.fn()} onError={vi.fn()} />
    );

    await user.click(screen.getByText('selecionar processo'));
    await user.click(screen.getByText('selecionar município'));
    await user.click(screen.getByRole('combobox', { name: /perito/i }));
    await user.click(await screen.findByText('Carlos'));
    await user.type(screen.getByLabelText('Observações'), '  Levar EPI extra  ');
    await user.click(screen.getByRole('button', { name: /salvar perícia/i }));

    expect(vi.mocked(createPericia)).toHaveBeenCalledWith(
      expect.objectContaining({ observacoes: 'Levar EPI extra' })
    );
  });

  it('sends observacoes as null when left blank', async () => {
    const user = userEvent.setup();
    render(
      <PericiaForm peritos={[{ id: 1, nome: 'Carlos' }]} colaboradores={[]} onSaved={vi.fn()} onError={vi.fn()} />
    );

    await user.click(screen.getByText('selecionar processo'));
    await user.click(screen.getByText('selecionar município'));
    await user.click(screen.getByRole('combobox', { name: /perito/i }));
    await user.click(await screen.findByText('Carlos'));
    await user.click(screen.getByRole('button', { name: /salvar perícia/i }));

    expect(vi.mocked(createPericia)).toHaveBeenCalledWith(expect.objectContaining({ observacoes: null }));
  });
```

The existing `'passes the pericia id to exclude itself from the conflict check when editing'` test passes an inline `pericia={{...}}` object typed against `PericiaInput & {...}` — add `observacoes: null` to it, and `escritorio: 'PMRA'` to its nested `processo` object (the latter is required by Task 2's `Processo` type change; add it now so this file only needs touching once — Task 2 does not re-touch this file):

```tsx
        pericia={{
          id: 9,
          processoId: 1,
          municipioId: 3550308,
          peritoId: 1,
          colaboradorId: 2,
          dataAgendada: '2026-08-10',
          horaAgendada: '14:00',
          situacao: 'marcada',
          observacoes: null,
          processo: { id: 1, numero: 'P-1', autor: 'A', reu: 'B', escritorio: 'PMRA' },
          municipio: { id: 3550308, nome: 'São Paulo', uf: 'SP' },
        }}
```

- [ ] **Step 11: Run test to verify it fails**

Run: `npx vitest run src/features/pericias/components/pericia-form.test.tsx`
Expected: FAIL — `screen.getByLabelText('Observações')` throws (no such field yet).

- [ ] **Step 12: Add the Observações field to `PericiaForm`**

In `src/features/pericias/components/pericia-form.tsx`, add the import:

```ts
import { Textarea } from '@/components/ui/textarea';
```

Add state (after the `situacao` state):

```ts
  const [observacoes, setObservacoes] = useState(pericia?.observacoes ?? '');
```

In `handleSubmit`, add to the `input` object (after `situacao,`):

```ts
      observacoes: observacoes.trim() || null,
```

In the JSX, add a new field right before the submit `<Button>`:

```tsx
      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea id="observacoes" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} />
      </div>
```

- [ ] **Step 13: Run test to verify it passes**

Run: `npx vitest run src/features/pericias/components/pericia-form.test.tsx`
Expected: PASS, all tests (13 total: 11 existing + 2 new).

- [ ] **Step 14: Write the failing tests for the Obs. column in `PericiasTable`**

In `src/features/pericias/components/pericias-table.test.tsx`, add the `within` import and give `items[0]` an `observacoes` value (it currently has none, and the type now requires the key):

```tsx
import { render, screen, within } from '@testing-library/react';
```

```tsx
const items: PericiaListItem[] = [
  {
    id: 1,
    dataAgendada: '2026-08-01',
    horaAgendada: '14:30',
    situacao: 'marcada',
    observacoes: 'Levar equipamento de medição extra para esta perícia específica',
    processo: { id: 1, numero: '0001234-56.2026.8.26.0100', autor: 'Maria Souza', reu: 'João Pereira' },
    municipio: { id: 3550308, nome: 'São Paulo', uf: 'SP' },
    perito: {
      id: 1, nome: 'Carlos Lima', contato: '(11) 90000-0000', formacao: 'Eng. Civil', crea: '123456',
      jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo',
    },
    colaborador: null,
  },
];
```

Add a second fixture for the null case, and two tests, at the end of the `describe('PericiasTable', ...)` block:

```tsx
const itemSemObservacoes: PericiaListItem = { ...items[0], id: 3, observacoes: null };
```

```tsx
  it('shows the full Observações text (visually truncated by CSS, not shortened in the DOM)', () => {
    render(<PericiasTable items={items} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(
      screen.getByText('Levar equipamento de medição extra para esta perícia específica')
    ).toBeInTheDocument();
  });

  it('shows a dash in the Obs. column when observacoes is null', () => {
    render(<PericiasTable items={[itemSemObservacoes]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    const row = screen.getByText('0001234-56.2026.8.26.0100').closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getAllByText('—').length).toBeGreaterThan(0);
  });
```

- [ ] **Step 15: Run test to verify it fails**

Run: `npx vitest run src/features/pericias/components/pericias-table.test.tsx`
Expected: FAIL — no Obs. column exists yet, so the full-text `getByText` doesn't find it (colaborador is `null` for `itemSemObservacoes`, so the `—` count check would actually still find one from the Colaborador column — but the full-text assertion in the first new test fails, which is enough to confirm RED).

- [ ] **Step 16: Add the Obs. column to `PericiasTable`**

In `src/features/pericias/components/pericias-table.tsx`, add the import:

```ts
import { TooltipCell } from '@/components/shared/tooltip-cell';
```

Add a header cell, right after `<TableHead>Situação</TableHead>`:

```tsx
            <TableHead>Situação</TableHead>
            <TableHead>Obs.</TableHead>
```

Add a body cell, right after the Situação `<TableCell>` (which renders `<StatusBadge situacao={item.situacao} />`):

```tsx
                  <TableCell>
                    <StatusBadge situacao={item.situacao} />
                  </TableCell>
                  <TableCell>
                    {item.observacoes ? (
                      <TooltipCell
                        label={<span className="block max-w-40 truncate">{item.observacoes}</span>}
                        detail={item.observacoes}
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
```

Update the expanded-detail row's `<TableCell colSpan={8} ...>` to `colSpan={9}` (one more column now exists).

- [ ] **Step 17: Run test to verify it passes**

Run: `npx vitest run src/features/pericias/components/pericias-table.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 18: Full suite, typecheck, lint**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass, no new type errors, zero eslint errors.

- [ ] **Step 19: Commit**

```bash
git add supabase/migrations/20260803000001_pericia_observacoes.sql src/lib/supabase/database.types.ts src/features/pericias/schemas.ts src/features/pericias/schemas.test.ts src/features/pericias/actions.ts src/features/pericias/actions.test.ts src/features/pericias/components/pericia-form.tsx src/features/pericias/components/pericia-form.test.tsx src/features/pericias/components/pericias-table.tsx src/features/pericias/components/pericias-table.test.tsx
git commit -m "feat: add Observações field to Perícia"
```

---

### Task 2: Processo — Escritório

**Files:**
- Create: `supabase/migrations/20260803000002_processo_escritorio.sql`
- Create: `src/features/processos/components/escritorio-combobox.tsx`
- Create: `src/features/processos/components/escritorio-combobox.test.tsx`
- Modify: `src/lib/supabase/database.types.ts`
- Modify: `src/features/processos/schemas.ts`
- Modify: `src/features/processos/actions.ts`
- Modify: `src/features/processos/actions.test.ts`
- Modify: `src/features/processos/components/processo-form.tsx`
- Modify: `src/features/processos/components/processo-form.test.tsx`
- Modify: `src/features/processos/components/processos-table.tsx`
- Modify: `src/features/processos/components/processos-table.test.tsx`
- Modify: `src/features/processos/components/novo-processo-dialog.test.tsx`
- Modify: `src/features/pericias/actions.ts`
- Modify: `src/features/pericias/components/pericias-table.tsx`
- Modify: `src/features/pericias/components/pericias-table.test.tsx`

**Interfaces:**
- Consumes: `TooltipCell` (Task 1, unchanged); the `Command`/`Popover` primitives already used by `MunicipioCombobox`.
- Produces: `Processo.escritorio: string` (required) — the `Processo` type is used by `ProcessoForm`, `ProcessoCombobox`, `NovoProcessoDialog`, and `PericiaListItem['processo']`, none of which need code changes beyond what's listed here since they all pass `Processo` objects through opaquely except where noted. `listEscritoriosDistintos(): Promise<string[]>` and `EscritorioCombobox({ value: string; onChange: (v: string) => void })` — leaf of this plan for these, nothing downstream depends on them further.

- [ ] **Step 1: Create and apply the migration**

Create `supabase/migrations/20260803000002_processo_escritorio.sql`:

```sql
alter table public.processos add column escritorio text not null default '';
alter table public.processos alter column escritorio drop default;
```

Run: `npx supabase db push`
Expected: migration applied with no errors (existing rows backfilled with `''`, then the column becomes required for all future writes with no default).

- [ ] **Step 2: Update `database.types.ts`**

In `src/lib/supabase/database.types.ts`, in the `processos` table entry:

```ts
      processos: {
        Row: { id: number; numero: string; autor: string; reu: string; escritorio: string; created_at: string };
        Insert: { numero: string; autor: string; reu: string; escritorio: string };
        Update: Partial<{ numero: string; autor: string; reu: string; escritorio: string }>;
        Relationships: [];
      };
```

- [ ] **Step 3: Write the failing schema test**

There is no dedicated `schemas.test.ts` for `processoSchema` — its validation is exercised indirectly through `actions.test.ts`'s `updateProcesso` tests. Add the escritorio requirement test there, inside `describe('updateProcesso', ...)`, right after the existing `'returns an error for invalid input without touching the database'` test:

```ts
  it('returns an error when escritorio is missing', async () => {
    const result = await updateProcesso(1, { numero: 'P-1', autor: 'A', reu: 'B', escritorio: '' });
    expect(result).toEqual({ success: false, error: 'Escritório é obrigatório' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
```

Also update the existing `'updates a valid processo'` test to include `escritorio` (this test currently omits it, which will fail validation once the field is required):

```ts
  it('updates a valid processo', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 1, numero: 'P-2', autor: 'A', reu: 'B', escritorio: 'PMRA' },
      error: null,
    });
    const result = await updateProcesso(1, { numero: 'P-2', autor: 'A', reu: 'B', escritorio: 'PMRA' });
    expect(result).toEqual({
      success: true,
      data: { id: 1, numero: 'P-2', autor: 'A', reu: 'B', escritorio: 'PMRA' },
    });
  });
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/features/processos/actions.test.ts`
Expected: FAIL — the new "missing escritorio" test fails because `processoSchema` doesn't validate `escritorio` yet (it's silently ignored, so `updateProcesso` proceeds and calls the database instead of returning the expected error); the updated "updates a valid processo" test still passes at this point since Zod ignores the extra unknown `escritorio` key on the way in and the mock returns whatever `mockSingle` is told to.

- [ ] **Step 5: Add `escritorio` to `processoSchema`**

In `src/features/processos/schemas.ts`:

```ts
export const processoSchema = z.object({
  numero: z.string().trim().min(1, 'Número do processo é obrigatório'),
  autor: z.string().trim().min(1, 'Autor é obrigatório'),
  reu: z.string().trim().min(1, 'Réu é obrigatório'),
  escritorio: z.string().trim().min(1, 'Escritório é obrigatório'),
});
```

(Declared last, after `reu`, so an empty `numero` in an otherwise-valid-except-escritorio input still reports the `numero` error first — this preserves the existing `'returns an error for invalid input without touching the database'` test's expected error message, `'Número do processo é obrigatório'`, without needing to touch that test.)

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/features/processos/actions.test.ts`
Expected: PASS, all tests.

- [ ] **Step 7: Add `escritorio` and `listEscritoriosDistintos` to `processos/actions.ts`**

In `src/features/processos/actions.ts`:

Add `escritorio: string;` to the `Processo` type:

```ts
export type Processo = { id: number; numero: string; autor: string; reu: string; escritorio: string };
```

Add `escritorio` to the `select` strings in `searchProcessos`, `createProcesso`, `listProcessos`, `getProcesso`, and `updateProcesso` (all five currently select `'id, numero, autor, reu'`) — change each to `'id, numero, autor, reu, escritorio'`.

Add a new function, after `deleteProcesso`:

```ts
export async function listEscritoriosDistintos(): Promise<string[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { data, error } = await supabase.from('processos').select('escritorio').order('escritorio');
  if (error) throw new Error(error.message);
  const values = (data ?? []).map((row) => row.escritorio).filter((v): v is string => Boolean(v));
  return [...new Set(values)];
}
```

- [ ] **Step 8: Run the processos actions tests to verify they still pass**

Run: `npx vitest run src/features/processos/actions.test.ts`
Expected: PASS, all tests (the `select`-string changes aren't asserted directly by any existing test, so this just confirms nothing else broke).

- [ ] **Step 9: Write the failing test for `EscritorioCombobox`**

Create `src/features/processos/components/escritorio-combobox.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { EscritorioCombobox } from './escritorio-combobox';

vi.mock('../actions', () => ({
  listEscritoriosDistintos: vi.fn(async () => ['CESCON', 'PMRA']),
}));

describe('EscritorioCombobox', () => {
  it('shows existing suggestions and calls onChange when one is selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EscritorioCombobox value="" onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('PMRA'));

    expect(onChange).toHaveBeenCalledWith('PMRA');
  });

  it('offers to use a freshly typed value that matches no suggestion', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EscritorioCombobox value="" onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByPlaceholderText('Buscar ou digitar escritório...'), 'Novo Escritório');
    await user.click(await screen.findByText('Usar "Novo Escritório"'));

    expect(onChange).toHaveBeenCalledWith('Novo Escritório');
  });

  it('shows the current value in the trigger', async () => {
    render(<EscritorioCombobox value="PMRA" onChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toHaveTextContent('PMRA');
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npx vitest run src/features/processos/components/escritorio-combobox.test.tsx`
Expected: FAIL — `./escritorio-combobox` does not exist.

- [ ] **Step 11: Write `EscritorioCombobox`**

Create `src/features/processos/components/escritorio-combobox.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { listEscritoriosDistintos } from '../actions';

export function EscritorioCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (escritorio: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    listEscritoriosDistintos()
      .then(setOptions)
      .catch(() => setOptions([]));
  }, []);

  const trimmedQuery = query.trim();
  const filtered = trimmedQuery
    ? options.filter((o) => o.toLowerCase().includes(trimmedQuery.toLowerCase()))
    : options;
  const exactMatch = options.some((o) => o.toLowerCase() === trimmedQuery.toLowerCase());

  function handleSelect(escritorio: string) {
    onChange(escritorio);
    setQuery('');
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button type="button" variant="outline" role="combobox" className="w-full justify-between" />}
      >
        <span className="truncate">{value || 'Selecione um escritório'}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar ou digitar escritório..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>Nenhum escritório encontrado.</CommandEmpty>
            <CommandGroup>
              {filtered.map((escritorio) => (
                <CommandItem key={escritorio} value={escritorio} onSelect={() => handleSelect(escritorio)}>
                  <Check className={cn('mr-2 h-4 w-4', value === escritorio ? 'opacity-100' : 'opacity-0')} />
                  {escritorio}
                </CommandItem>
              ))}
              {trimmedQuery && !exactMatch && (
                <CommandItem value={trimmedQuery} onSelect={() => handleSelect(trimmedQuery)}>
                  Usar &quot;{trimmedQuery}&quot;
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npx vitest run src/features/processos/components/escritorio-combobox.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 13: Update `processo-form.test.tsx`'s fixtures and mocks for `escritorio`**

In `src/features/processos/components/processo-form.test.tsx`, update the `vi.mock('../actions', ...)` input/output types and the two existing tests' `processo` props and assertions to include `escritorio`:

```tsx
vi.mock('../actions', () => ({
  createProcesso: vi.fn(async (input: { numero: string; autor: string; reu: string; escritorio: string }) => ({
    success: true,
    data: { id: 1, ...input },
  })),
  updateProcesso: vi.fn(async (id: number, input: { numero: string; autor: string; reu: string; escritorio: string }) => ({
    success: true,
    data: { id, ...input },
  })),
}));
```

```tsx
  it('pre-fills fields when editing an existing processo', () => {
    render(
      <ProcessoForm
        processo={{ id: 5, numero: 'P-5', autor: 'Ana', reu: 'Bia', escritorio: 'PMRA' }}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Número do processo')).toHaveValue('P-5');
    expect(screen.getByLabelText('Autor')).toHaveValue('Ana');
    expect(screen.getByLabelText('Réu')).toHaveValue('Bia');
    expect(screen.getByRole('combobox')).toHaveTextContent('PMRA');
  });

  it('calls updateProcesso and onSaved when editing', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <ProcessoForm
        processo={{ id: 5, numero: 'P-5', autor: 'Ana', reu: 'Bia', escritorio: 'PMRA' }}
        onSaved={onSaved}
        onError={vi.fn()}
      />
    );
    await user.click(screen.getByRole('button', { name: /salvar processo/i }));
    expect(onSaved).toHaveBeenCalledWith({ id: 5, numero: 'P-5', autor: 'Ana', reu: 'Bia', escritorio: 'PMRA' });
  });
```

This test file does not mock `EscritorioCombobox` itself — it renders the real component, which calls the real (module-mocked) `listEscritoriosDistintos` from `'../actions'`. Add that export to the existing `vi.mock('../actions', ...)` call:

```tsx
vi.mock('../actions', () => ({
  createProcesso: vi.fn(async (input: { numero: string; autor: string; reu: string; escritorio: string }) => ({
    success: true,
    data: { id: 1, ...input },
  })),
  updateProcesso: vi.fn(async (id: number, input: { numero: string; autor: string; reu: string; escritorio: string }) => ({
    success: true,
    data: { id, ...input },
  })),
  listEscritoriosDistintos: vi.fn(async () => []),
}));
```

- [ ] **Step 14: Run test to verify it fails**

Run: `npx vitest run src/features/processos/components/processo-form.test.tsx`
Expected: FAIL — `ProcessoForm` doesn't render an Escritório field yet, so `screen.getByRole('combobox')` doesn't exist and the `processo`/`onSaved` type shapes don't match what the form currently builds.

- [ ] **Step 15: Wire `EscritorioCombobox` into `ProcessoForm`**

In `src/features/processos/components/processo-form.tsx`:

```ts
import { EscritorioCombobox } from './escritorio-combobox';
```

```ts
  const [escritorio, setEscritorio] = useState(processo?.escritorio ?? '');
```

In `handleSubmit`:

```ts
    const input = { numero, autor, reu, escritorio };
```

In the JSX, add right after the Número field:

```tsx
      <div className="space-y-2">
        <Label>Escritório</Label>
        <EscritorioCombobox value={escritorio} onChange={setEscritorio} />
      </div>
```

- [ ] **Step 16: Run test to verify it passes**

Run: `npx vitest run src/features/processos/components/processo-form.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 17: Fix `novo-processo-dialog.test.tsx`**

In `src/features/processos/components/novo-processo-dialog.test.tsx`, add `listEscritoriosDistintos` to the mock and fill the Escritório combobox before submitting:

```tsx
vi.mock('../actions', () => ({
  createProcesso: vi.fn(async (input: { numero: string; autor: string; reu: string; escritorio: string }) => ({
    success: true,
    data: { id: 42, ...input },
  })),
  listEscritoriosDistintos: vi.fn(async () => []),
}));
```

```tsx
  it('calls onCreated with the new processo and closes on success', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const onOpenChange = vi.fn();

    render(<NovoProcessoDialog open onOpenChange={onOpenChange} onCreated={onCreated} />);

    await user.type(screen.getByLabelText('Número do processo'), '0001234-56.2026.8.26.0100');
    await user.type(screen.getByLabelText('Autor'), 'Maria Souza');
    await user.type(screen.getByLabelText('Réu'), 'João Pereira');
    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByPlaceholderText('Buscar ou digitar escritório...'), 'PMRA');
    await user.click(await screen.findByText('Usar "PMRA"'));
    await user.click(screen.getByRole('button', { name: /salvar e vincular/i }));

    expect(onCreated).toHaveBeenCalledWith({
      id: 42,
      numero: '0001234-56.2026.8.26.0100',
      autor: 'Maria Souza',
      reu: 'João Pereira',
      escritorio: 'PMRA',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
```

Run: `npx vitest run src/features/processos/components/novo-processo-dialog.test.tsx`
Expected: PASS.

- [ ] **Step 18: Write the failing test for the Escritório column in `ProcessosTable`**

In `src/features/processos/components/processos-table.test.tsx`, update the fixture and add one test:

```tsx
const items: Processo[] = [{ id: 1, numero: 'P-1', autor: 'A', reu: 'B', escritorio: 'PMRA' }];
```

```tsx
  it('shows the escritorio column', () => {
    render(<ProcessosTable items={items} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('PMRA')).toBeInTheDocument();
  });
```

- [ ] **Step 19: Run test to verify it fails**

Run: `npx vitest run src/features/processos/components/processos-table.test.tsx`
Expected: FAIL — no Escritório column exists yet (also a TS error on the `items` fixture until the `Processo` type change from Step 7 is in place, which it already is by this point in the task).

- [ ] **Step 20: Add the Escritório column to `ProcessosTable`**

In `src/features/processos/components/processos-table.tsx`, add a header cell after `<TableHead>Réu</TableHead>`:

```tsx
            <TableHead>Réu</TableHead>
            <TableHead>Escritório</TableHead>
```

Add a body cell after the Réu `<TableCell>`:

```tsx
              <TableCell>{item.reu}</TableCell>
              <TableCell>{item.escritorio}</TableCell>
```

- [ ] **Step 21: Run test to verify it passes**

Run: `npx vitest run src/features/processos/components/processos-table.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 22: Write the failing test for the Escritório column in `PericiasTable`**

In `src/features/pericias/components/pericias-table.test.tsx`, add `escritorio: 'PMRA'` to `items[0].processo` (required now by `PericiaListItem['processo']`, updated in Step 23 below):

```tsx
    processo: { id: 1, numero: '0001234-56.2026.8.26.0100', autor: 'Maria Souza', reu: 'João Pereira', escritorio: 'PMRA' },
```

Add one test:

```tsx
  it('shows the processo escritorio', () => {
    render(<PericiasTable items={items} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('PMRA')).toBeInTheDocument();
  });
```

- [ ] **Step 23: Add `escritorio` to `PericiaListItem['processo']` and the Escritório column to `PericiasTable`**

In `src/features/pericias/actions.ts`, add `escritorio: string` to `PericiaListItem['processo']`:

```ts
  processo: { id: number; numero: string; autor: string; reu: string; escritorio: string };
```

Add `escritorio` to the `processo` embed in both `listPericias`'s and `getPericiaForEdit`'s `select`:

```ts
      processo:processos!inner ( id, numero, autor, reu, escritorio ),
```

```ts
      processo:processos ( id, numero, autor, reu, escritorio ),
```

(No change needed to the mapping code in either function — both already do `processo: row.processo` verbatim, so the new field flows through automatically.)

In `src/features/pericias/components/pericias-table.tsx`, add a header cell right after `<TableHead>Nº Processo</TableHead>`:

```tsx
            <TableHead>Nº Processo</TableHead>
            <TableHead>Escritório</TableHead>
```

Add a body cell right after the Nº Processo `<TableCell>`:

```tsx
                  <TableCell>{item.processo.numero}</TableCell>
                  <TableCell>
                    <TooltipCell
                      label={<span className="block max-w-32 truncate">{item.processo.escritorio}</span>}
                      detail={item.processo.escritorio}
                    />
                  </TableCell>
```

Update the expanded-detail row's `<TableCell colSpan={9} ...>` to `colSpan={10}` (Task 1 already brought it from 8 to 9; this task brings it to 10).

- [ ] **Step 24: Run test to verify it passes**

Run: `npx vitest run src/features/pericias/components/pericias-table.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 25: Full suite, typecheck, lint**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass, no new type errors, zero eslint errors.

- [ ] **Step 26: Commit**

```bash
git add supabase/migrations/20260803000002_processo_escritorio.sql src/lib/supabase/database.types.ts src/features/processos/schemas.ts src/features/processos/actions.ts src/features/processos/actions.test.ts src/features/processos/components/escritorio-combobox.tsx src/features/processos/components/escritorio-combobox.test.tsx src/features/processos/components/processo-form.tsx src/features/processos/components/processo-form.test.tsx src/features/processos/components/processos-table.tsx src/features/processos/components/processos-table.test.tsx src/features/processos/components/novo-processo-dialog.test.tsx src/features/pericias/actions.ts src/features/pericias/components/pericias-table.tsx src/features/pericias/components/pericias-table.test.tsx
git commit -m "feat: add Escritório field to Processo"
```

---

### Task 3: Colaborador — remover Interno/Externo

**Files:**
- Create: `supabase/migrations/20260803000003_colaborador_remove_interno.sql`
- Modify: `src/lib/supabase/database.types.ts`
- Modify: `src/features/colaboradores/schemas.ts`
- Modify: `src/features/colaboradores/actions.ts`
- Modify: `src/features/colaboradores/actions.test.ts`
- Modify: `src/features/colaboradores/components/colaborador-form.tsx`
- Modify: `src/features/colaboradores/components/colaborador-form.test.tsx`
- Modify: `src/features/colaboradores/components/colaboradores-table.tsx`
- Modify: `src/features/colaboradores/components/colaboradores-table.test.tsx`
- Modify: `src/features/colaboradores/components/colaboradores-screen.test.tsx`
- Modify: `src/features/pericias/actions.ts`
- Modify: `src/features/pericias/actions.test.ts`
- Modify: `src/features/pericias/components/pericias-table.tsx`

**Interfaces:**
- Consumes: nothing new from Tasks 1-2.
- Produces: nothing — this is a pure removal, leaf of the plan. The final step of this task runs the full suite + `tsc` + `eslint` + `npm run build`, which is expected to be the definitive check that no `interno` reference was missed anywhere in the codebase (the compiler enforces this, since `Colaborador` and `PericiaListItem['colaborador']` no longer declare the field).

- [ ] **Step 1: Create and apply the migration**

Create `supabase/migrations/20260803000003_colaborador_remove_interno.sql`:

```sql
alter table public.colaboradores drop column interno;
```

Run: `npx supabase db push`
Expected: migration applied with no errors (no view or RLS policy references `interno` — confirmed by grepping `supabase/migrations/` for `interno`, the only match is the column's own original `create table` definition).

- [ ] **Step 2: Update `database.types.ts`**

In `src/lib/supabase/database.types.ts`, in the `colaboradores` table entry, remove `interno` from both `Row` and `Insert`:

```ts
      colaboradores: {
        Row: { id: number; nome: string; contato: string; formacao: string; created_at: string };
        Insert: { nome: string; contato?: string; formacao?: string };
        Update: Partial<Database['public']['Tables']['colaboradores']['Insert']>;
        Relationships: [];
      };
```

- [ ] **Step 3: Remove `interno` from the Zod schema and update the schema-level tests**

In `src/features/colaboradores/schemas.ts`:

```ts
export const colaboradorSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório'),
  contato: z.string().trim().default(''),
  formacao: z.string().trim().default(''),
});
```

There is no dedicated `schemas.test.ts` for this file — no test file changes needed here.

- [ ] **Step 4: Remove `interno` from `colaboradores/actions.ts` and update its fixtures**

In `src/features/colaboradores/actions.ts`:

```ts
export type Colaborador = { id: number; nome: string; contato: string; formacao: string };

function toRow(input: ColaboradorInput) {
  return { nome: input.nome, contato: input.contato, formacao: input.formacao };
}
```

(`listColaboradores`/`getColaborador` use `select('*')` — nothing to change there; dropping the DB column is what removes it from their results.)

In `src/features/colaboradores/actions.test.ts`, remove `interno: true`/`interno: false` from both `rows` fixture entries:

```ts
const rows = [
  { id: 1, nome: 'Bruna Souza', contato: '', formacao: '' },
  { id: 2, nome: 'José André', contato: '', formacao: '' },
];
```

- [ ] **Step 5: Run the colaboradores actions tests to verify they pass**

Run: `npx vitest run src/features/colaboradores/actions.test.ts`
Expected: PASS, all tests (this is a removal — there is no meaningful RED state to capture here; the tests are being kept in sync with a type that's shrinking, not growing a new capability).

- [ ] **Step 6: Remove the switch from `ColaboradorForm` and update its tests**

In `src/features/colaboradores/components/colaborador-form.tsx`:

Remove the `Switch` import (no longer used anywhere in this file):

```ts
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPhone } from '@/lib/masks';
import { createColaborador, updateColaborador, type Colaborador } from '../actions';
import type { ColaboradorInput } from '../schemas';
```

Remove the `interno` state line:

```ts
  const [formacao, setFormacao] = useState(colaborador?.formacao ?? '');
  const [saving, setSaving] = useState(false);
```

Remove `interno` from the `input` object in `handleSubmit`:

```ts
    const input: ColaboradorInput = { nome, contato, formacao };
```

Remove the switch block from the JSX entirely:

```tsx
      <div className="flex items-center gap-2">
        <Switch id="interno" checked={interno} onCheckedChange={setInterno} />
        <Label htmlFor="interno">Colaborador interno</Label>
      </div>
```

In `src/features/colaboradores/components/colaborador-form.test.tsx`, remove `interno: false` from both `colaborador` fixture props (in `'pre-fills fields when editing an existing colaborador'` and `'does not truncate an over-length existing contato value on mount'`):

```tsx
        colaborador={{ id: 1, nome: 'Bruna', contato: '11988887777', formacao: 'Direito' }}
```

```tsx
        colaborador={{ id: 1, nome: 'Bruna', contato: '5511999998888888', formacao: 'Direito' }}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run src/features/colaboradores/components/colaborador-form.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 8: Remove the Tipo column from `ColaboradoresTable` and update its tests**

In `src/features/colaboradores/components/colaboradores-table.tsx`, remove the header cell:

```tsx
            <TableHead>Formação</TableHead>
            <TableHead className="w-20" />
```

Remove the body cell:

```tsx
              <TableCell>{item.formacao}</TableCell>
              <TableCell>
```

In `src/features/colaboradores/components/colaboradores-table.test.tsx`, remove `interno: true` from the `items` fixture:

```tsx
const items: Colaborador[] = [{ id: 1, nome: 'Bruna Souza', contato: '', formacao: '' }];
```

In `src/features/colaboradores/components/colaboradores-screen.test.tsx`, remove `interno: true` from the `items` fixture:

```tsx
const items = [{ id: 1, nome: 'Bruna', contato: '', formacao: '' }];
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run src/features/colaboradores/components/colaboradores-table.test.tsx src/features/colaboradores/components/colaboradores-screen.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 10: Remove `interno` from `PericiaListItem['colaborador']` and its mapping**

In `src/features/pericias/actions.ts`:

```ts
  colaborador: { id: number; nome: string; contato: string; formacao: string } | null;
```

In `listPericias`'s `select`, remove `interno` from the `colaborador` embed:

```ts
      colaborador:colaboradores ( id, nome, contato, formacao )
```

In the mapped return object, remove the `interno` line from the `colaborador` block:

```ts
    colaborador: row.colaborador
      ? {
          id: row.colaborador.id,
          nome: row.colaborador.nome,
          contato: row.colaborador.contato,
          formacao: row.colaborador.formacao,
        }
      : null,
```

In `src/features/pericias/actions.test.ts`, remove `interno: true` from `fullRow.colaborador` and from the expected `colaborador` object in the `'maps a full row with all embeds present without throwing'` test.

- [ ] **Step 11: Run test to verify it passes**

Run: `npx vitest run src/features/pericias/actions.test.ts`
Expected: PASS, all tests.

- [ ] **Step 12: Remove the dead `interno` read in `PericiasTable`'s expanded detail panel**

In `src/features/pericias/components/pericias-table.tsx`, in the Colaborador block of the expanded detail row:

```tsx
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Colaborador</p>
                          {item.colaborador ? (
                            <p className="text-sm">
                              Contato: {formatPhone(item.colaborador.contato)} · Formação: {item.colaborador.formacao}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground">Nenhum colaborador vinculado.</p>
                          )}
                        </div>
```

- [ ] **Step 13: Run test to verify it passes**

Run: `npx vitest run src/features/pericias/components/pericias-table.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 14: Full suite, typecheck, lint, and build**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src && npm run build`
Expected: all tests pass, zero type errors (this is the compiler's confirmation that every `interno` reference across the codebase — including any not explicitly listed above — was caught and removed), zero eslint errors, build succeeds.

If `tsc` reports an error in a file not touched by this task, that means a reference to `interno` was missed — fix it in place (it will be a straightforward removal following the same pattern as the steps above) before proceeding.

- [ ] **Step 15: Commit**

```bash
git add supabase/migrations/20260803000003_colaborador_remove_interno.sql src/lib/supabase/database.types.ts src/features/colaboradores/schemas.ts src/features/colaboradores/actions.ts src/features/colaboradores/actions.test.ts src/features/colaboradores/components/colaborador-form.tsx src/features/colaboradores/components/colaborador-form.test.tsx src/features/colaboradores/components/colaboradores-table.tsx src/features/colaboradores/components/colaboradores-table.test.tsx src/features/colaboradores/components/colaboradores-screen.test.tsx src/features/pericias/actions.ts src/features/pericias/actions.test.ts src/features/pericias/components/pericias-table.tsx
git commit -m "feat: remove interno/externo distinction from Colaborador"
```

---

## Manual verification (after all 3 tasks)

1. Run `npm run dev`. Open `/pericias`, click "Nova perícia", fill in a note in Observações, save, confirm the Obs. column shows it (truncated if long) and hovering reveals the full text.
2. Open `/processos`, click "Novo processo", confirm Escritório is required (try saving without it — should show an error), type a new office name and save, confirm it appears in the table.
3. Create a second processo and open the Escritório combobox — confirm the first processo's office name now appears as a clickable suggestion.
4. From the Perícia form's "Novo processo" quick-create dialog, confirm the same Escritório field/behavior is present there too.
5. Open `/colaboradores`, confirm there's no "Tipo"/Interno-Externo column or switch anywhere in the list or the create/edit form.
6. Open a Perícia's expanded detail row with a colaborador attached — confirm the Colaborador block no longer mentions Interno/Externo.
