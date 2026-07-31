# CRUD e Filtro — Melhorias (Pacote A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Perícia's Data/Hora optional, add delete to Perícia/Perito/Processo/Colaborador, let the Colaborador field be cleared in the Perícia form, and turn the Perícias date filter into a range.

**Architecture:** Additive changes to the existing feature-slice structure (`src/features/<entity>/{schemas,actions}.ts` + `components/`). One new DB migration (nullable columns, no new tables). One new shared UI component (`ConfirmDialog`) reused by all four delete flows. No new routes.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase (Postgres + supabase-js + RLS), Tailwind v4, Zod, Vitest + React Testing Library.

## Global Constraints

- Delete permission: `requireRole(['admin', 'gerencia'])` — identical to create/update on every entity.
- Deletion is a hard delete (no soft-delete column anywhere in this plan).
- Deleting a Perito or Processo referenced by an existing Perícia must fail with a friendly message, not a raw Postgres error. The FK is already `on delete restrict` for both (see `supabase/migrations/20260726000001_init_schema.sql:50-54`) — no migration needed for this part.
- Deleting a Colaborador is always allowed (FK is already `on delete set null`, `20260726000001_init_schema.sql:55`).
- Deleting a Perícia is always allowed (nothing references `pericias`).
- No existing action anywhere in this codebase calls `revalidatePath` — screens refresh via `router.refresh()` after a successful mutation (see every `handleSaved` in `*-screen.tsx`). New delete actions follow the same convention: no `revalidatePath` calls.
- **Applying the new migration to the production Supabase project (`ralyhgneesqpfijpvxii`) requires explicit user confirmation at execution time.** Task 1's steps show the exact command for both dev and prod, but do not run the prod command without asking first — same rule this project has followed for every prior production migration.

---

### Task 1: Migration — Perícia Data/Hora become optional

**Files:**
- Create: `supabase/migrations/20260730000001_pericia_data_hora_opcionais.sql`
- Modify: `src/lib/supabase/database.types.ts:48` and `:53`

**Interfaces:**
- Produces: `pericias.data_agendada` and `pericias.hora_agendada` are nullable at the DB level from this task onward. Every later task in this plan that touches these columns assumes this is already true.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260730000001_pericia_data_hora_opcionais.sql
alter table public.pericias alter column data_agendada drop not null;
alter table public.pericias alter column hora_agendada drop not null;
```

- [ ] **Step 2: Apply to the dev database**

```bash
npx supabase link --project-ref wpssipdxpfmvcamldpum
npx supabase db push
```

Expected: `Applying migration 20260730000001_pericia_data_hora_opcionais.sql...` followed by success (Docker "failed to connect" warnings about the optional edge-runtime cache are expected/harmless if Docker Desktop isn't running).

- [ ] **Step 3: Verify with the CLI**

```bash
npx supabase migration list
```

Expected: `20260730000001` appears in both the `local` and `remote` columns.

- [ ] **Step 4: Update the generated types**

In `src/lib/supabase/database.types.ts`, inside `Database['public']['Tables']['pericias']`:

```ts
// line 48, was: id: number; processo_id: number; data_agendada: string; hora_agendada: string;
          id: number; processo_id: number; data_agendada: string | null; hora_agendada: string | null;
```

```ts
// line 53, was: processo_id: number; data_agendada: string; hora_agendada: string; municipio_id: number;
          processo_id: number; data_agendada?: string | null; hora_agendada?: string | null; municipio_id: number;
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: fails inside `src/features/pericias/schemas.ts` and `actions.ts` (not yet updated) — that's expected here; those files are fixed in Task 2. If it fails anywhere else, stop and investigate before continuing.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260730000001_pericia_data_hora_opcionais.sql src/lib/supabase/database.types.ts
git commit -m "feat: make pericias.data_agendada and hora_agendada nullable"
```

**Ask the user before running the equivalent push against the production project** (`npx supabase link --project-ref ralyhgneesqpfijpvxii && npx supabase db push`, then `npx supabase link --project-ref wpssipdxpfmvcamldpum` to switch back to dev). Do this once, near the end of the plan (after Task 11 passes), not now — the app must keep working locally throughout implementation, and prod shouldn't be touched mid-plan.

---

### Task 2: Pericia schema + actions — nullable Data/Hora, nulls-last ordering

**Files:**
- Modify: `src/features/pericias/schemas.ts`
- Modify: `src/features/pericias/schemas.test.ts`
- Modify: `src/features/pericias/actions.ts:11-23` (type), `:37-77` (listPericias), `:82-108` (mapping)
- Modify: `src/features/pericias/actions.test.ts`

**Interfaces:**
- Consumes: Task 1's nullable DB columns.
- Produces: `PericiaInput['dataAgendada' | 'horaAgendada']` is `string | null`. `PericiaListItem['dataAgendada' | 'horaAgendada']` is `string | null`. `listPericias` still takes a `filters` object — later tasks (Task 5) will change its `data` key to `dataInicio`/`dataFim`, but that is out of scope here; this task only changes nullability and ordering.

- [ ] **Step 1: Write the failing schema test**

Add to `src/features/pericias/schemas.test.ts` (new `it` inside the existing `describe('periciaSchema', ...)`):

```ts
  it('accepts null dataAgendada and horaAgendada', () => {
    const result = periciaSchema.safeParse({
      processoId: 1,
      dataAgendada: null,
      horaAgendada: null,
      municipioId: 1,
      peritoId: 1,
      colaboradorId: null,
      situacao: 'marcada',
    });
    expect(result.success).toBe(true);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/features/pericias/schemas.test.ts`
Expected: FAIL — `dataAgendada`/`horaAgendada` currently reject `null` (regex-only string schema).

- [ ] **Step 3: Update the schema**

In `src/features/pericias/schemas.ts`, change:

```ts
  dataAgendada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  horaAgendada: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida'),
```

to:

```ts
  dataAgendada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida').nullable(),
  horaAgendada: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida').nullable(),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/pericias/schemas.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Update `PericiaListItem` and the row mapping in `actions.ts`**

In `src/features/pericias/actions.ts:13-14`, change:

```ts
  dataAgendada: string;
  horaAgendada: string;
```

to:

```ts
  dataAgendada: string | null;
  horaAgendada: string | null;
```

- [ ] **Step 6: Add nulls-last ordering**

In `src/features/pericias/actions.ts:54`, change:

```ts
    .order('data_agendada', { ascending: false });
```

to:

```ts
    .order('data_agendada', { ascending: false, nullsFirst: false });
```

- [ ] **Step 7: Write the failing action test for ordering**

Add to `src/features/pericias/actions.test.ts`, inside `describe('listPericias', ...)`:

```ts
  it('orders by data_agendada with nulls last', async () => {
    periciasQueryResult = { data: [], error: null };
    await listPericias();
    expect(mockOrder).toHaveBeenCalledWith('data_agendada', { ascending: false, nullsFirst: false });
  });
```

This needs an `order` spy the test file can assert on. Update `periciasQueryBuilder()` in the same file: change

```ts
    order: vi.fn(() => builder),
```

to a module-level spy so the test above can reference it:

```ts
const mockOrder = vi.fn(() => undefined);
```

placed near the other `mock*` declarations at the top of the file (after `mockUpdate`), and change `periciasQueryBuilder()`'s `order` line to:

```ts
    order: mockOrder.mockImplementation(() => builder),
```

- [ ] **Step 8: Run it to verify it fails, then passes**

First, add `mockOrder.mockClear();` to the file's existing `beforeEach` (it already resets `periciasSelectCalls.length = 0; periciasEqCalls.length = 0; periciasQueryResult = { data: [], error: null };` — add the new line alongside those three).

Run: `npx vitest run src/features/pericias/actions.test.ts`
Expected: PASS (Step 6 already made the production code match; this step just confirms it end-to-end).

- [ ] **Step 9: Run the full pericias test suite**

Run: `npx vitest run src/features/pericias`
Expected: all PASS.

- [ ] **Step 10: Type-check**

Run: `npx tsc --noEmit`
Expected: clean (Task 1's expected failures are now fixed).

- [ ] **Step 11: Commit**

```bash
git add src/features/pericias/schemas.ts src/features/pericias/schemas.test.ts src/features/pericias/actions.ts src/features/pericias/actions.test.ts
git commit -m "feat: make Pericia dataAgendada/horaAgendada nullable, order nulls last"
```

---

### Task 3: Pericia form — optional Data/Hora, clearable Colaborador

**Files:**
- Modify: `src/features/pericias/components/pericia-form.tsx`
- Modify: `src/features/pericias/components/pericia-form.test.tsx`

**Interfaces:**
- Consumes: `PericiaInput` from Task 2 (`dataAgendada`/`horaAgendada: string | null`).
- Produces: no new exports; same `PericiaForm` props.

- [ ] **Step 1: Write the failing test for the Colaborador clear option**

Add to `src/features/pericias/components/pericia-form.test.tsx`'s `describe('PericiaForm', ...)` (no changes needed to the existing mocks at the top of the file — `../actions`, `ProcessoCombobox`, and `MunicipioCombobox` are already mocked there):

```ts
  it('lets the user clear a selected colaborador back to none', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <PericiaForm
        peritos={[{ id: 1, nome: 'Carlos' }]}
        colaboradores={[{ id: 2, nome: 'Bruna' }]}
        onSaved={onSaved}
        onError={vi.fn()}
      />
    );

    await user.click(screen.getByRole('combobox', { name: /colaborador/i }));
    await user.click(await screen.findByText('Bruna'));

    await user.click(screen.getByRole('combobox', { name: /colaborador/i }));
    await user.click(await screen.findByText('Nenhum'));

    await user.click(screen.getByText('selecionar processo'));
    await user.click(screen.getByText('selecionar município'));
    await user.click(screen.getByRole('combobox', { name: /perito/i }));
    await user.click(await screen.findByText('Carlos'));
    await user.click(screen.getByRole('button', { name: /salvar perícia/i }));

    expect(onSaved).toHaveBeenCalledWith(5);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/features/pericias/components/pericia-form.test.tsx`
Expected: FAIL — there is no "Nenhum" option in the Colaborador select yet.

- [ ] **Step 3: Add the "Nenhum" option and null-conversion on submit**

In `src/features/pericias/components/pericia-form.tsx`, change the Colaborador `Select` block (currently):

```tsx
      <div className="space-y-2">
        <Label htmlFor="colaborador">Colaborador (opcional)</Label>
        <Select items={colaboradorItems} value={colaboradorId} onValueChange={(v) => setColaboradorId(v ?? '')}>
          <SelectTrigger id="colaborador"><SelectValue placeholder="Selecione um colaborador" /></SelectTrigger>
          <SelectContent>
            {colaboradores.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
```

to:

```tsx
      <div className="space-y-2">
        <Label htmlFor="colaborador">Colaborador (opcional)</Label>
        <Select
          items={{ none: 'Nenhum', ...colaboradorItems }}
          value={colaboradorId || 'none'}
          onValueChange={(v) => setColaboradorId(!v || v === 'none' ? '' : v)}
        >
          <SelectTrigger id="colaborador"><SelectValue placeholder="Selecione um colaborador" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum</SelectItem>
            {colaboradores.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
```

Then update the submit payload. Find:

```ts
    const input: PericiaInput = {
      processoId: processo.id,
      municipioId: municipio.id,
      peritoId: Number(peritoId),
      colaboradorId: colaboradorId ? Number(colaboradorId) : null,
      dataAgendada,
      horaAgendada,
      situacao,
    };
```

and change the last two fields to convert empty strings to `null`:

```ts
    const input: PericiaInput = {
      processoId: processo.id,
      municipioId: municipio.id,
      peritoId: Number(peritoId),
      colaboradorId: colaboradorId ? Number(colaboradorId) : null,
      dataAgendada: dataAgendada || null,
      horaAgendada: horaAgendada || null,
      situacao,
    };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/pericias/components/pericia-form.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write a test proving Data/Hora can be left empty**

Add another test in the same file:

```ts
  it('saves successfully when dataAgendada and horaAgendada are left empty', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <PericiaForm peritos={[{ id: 1, nome: 'Carlos' }]} colaboradores={[]} onSaved={onSaved} onError={vi.fn()} />
    );

    await user.click(screen.getByText('selecionar processo'));
    await user.click(screen.getByText('selecionar município'));
    await user.click(screen.getByRole('combobox', { name: /perito/i }));
    await user.click(await screen.findByText('Carlos'));
    await user.click(screen.getByRole('button', { name: /salvar perícia/i }));

    expect(onSaved).toHaveBeenCalledWith(5);
  });
```

- [ ] **Step 6: Run the full file**

Run: `npx vitest run src/features/pericias/components/pericia-form.test.tsx`
Expected: all PASS (this test already passes once Step 3 lands, since the form never required Data/Hora client-side — it confirms the server action call, mocked to always succeed, actually receives `null` instead of a schema-rejected `''`; the meaningful regression check is Task 2's schema test).

- [ ] **Step 7: Type-check and run the whole suite**

Run: `npx tsc --noEmit && npm test`
Expected: both clean.

- [ ] **Step 8: Commit**

```bash
git add src/features/pericias/components/pericia-form.tsx src/features/pericias/components/pericia-form.test.tsx
git commit -m "feat: allow clearing Colaborador and leaving Data/Hora empty in the Pericia form"
```

---

### Task 4: Pericia table — display fallback for missing Data/Hora

**Files:**
- Modify: `src/features/pericias/components/pericias-table.tsx:68-73`
- Modify: `src/features/pericias/components/pericias-table.test.tsx`

**Interfaces:**
- Consumes: `PericiaListItem.dataAgendada`/`horaAgendada: string | null` (Task 2).

- [ ] **Step 1: Write the failing test**

Add to `src/features/pericias/components/pericias-table.test.tsx`, a new item and test:

```ts
const itemSemData: PericiaListItem = {
  ...items[0],
  id: 2,
  dataAgendada: null,
  horaAgendada: null,
};
```

Place this right after the existing `items` array. Then add a test inside `describe('PericiasTable', ...)`:

```ts
  it('shows "Não agendado" when dataAgendada and horaAgendada are both null', () => {
    render(<PericiasTable items={[itemSemData]} onEdit={vi.fn()} />);
    expect(screen.getByText('Não agendado')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/features/pericias/components/pericias-table.test.tsx`
Expected: FAIL — the current code does `new Date('nullTnull')`, an Invalid Date, and renders `"Invalid Date"`, not `"Não agendado"`.

- [ ] **Step 3: Implement the fallback**

In `src/features/pericias/components/pericias-table.tsx`, replace:

```tsx
                <TableCell>
                  {new Date(`${item.dataAgendada}T${item.horaAgendada}`).toLocaleString('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </TableCell>
```

with:

```tsx
                <TableCell>
                  {item.dataAgendada && item.horaAgendada ? (
                    new Date(`${item.dataAgendada}T${item.horaAgendada}`).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })
                  ) : item.dataAgendada ? (
                    <>
                      {new Date(`${item.dataAgendada}T00:00`).toLocaleDateString('pt-BR')}
                      {' · '}
                      <span className="text-muted-foreground">Hora não definida</span>
                    </>
                  ) : item.horaAgendada ? (
                    <>
                      <span className="text-muted-foreground">Data não definida</span>
                      {' · '}
                      {item.horaAgendada}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Não agendado</span>
                  )}
                </TableCell>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/pericias/components/pericias-table.test.tsx`
Expected: PASS (all tests, including the pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add src/features/pericias/components/pericias-table.tsx src/features/pericias/components/pericias-table.test.tsx
git commit -m "fix: show a fallback in the Pericias table when Data/Hora are missing"
```

---

### Task 5: Perícias date filter becomes a range (Data inicial / Data final)

**Files:**
- Modify: `src/features/pericias/actions.ts` (filters type + `if (filters.data)` block)
- Modify: `src/features/pericias/actions.test.ts`
- Modify: `src/app/(app)/page.tsx`
- Modify: `src/features/pericias/components/pericias-filters.tsx`
- Modify: `src/features/pericias/components/pericias-filters.test.tsx`
- Modify: `src/app/(app)/loading.tsx` (no code change expected — verify in Step 8)

**Interfaces:**
- Produces: `listPericias` filters take `dataInicio?: string; dataFim?: string` instead of `data?: string`. URL search params `dataInicio`/`dataFim` replace `data`.

- [ ] **Step 1: Write the failing action tests**

In `src/features/pericias/actions.test.ts`, the mock query builder needs `.gte`/`.lte` spies. Update `periciasQueryBuilder()`:

```ts
    filter: vi.fn(() => builder),
```

add right after it:

```ts
    gte: vi.fn((column: string, value: unknown) => {
      periciasEqCalls.push([`gte:${column}`, value]);
      return builder;
    }),
    lte: vi.fn((column: string, value: unknown) => {
      periciasEqCalls.push([`lte:${column}`, value]);
      return builder;
    }),
```

Replace the existing `it('filters by data when provided', ...)` test with:

```ts
  it('filters by dataInicio using gte on data_agendada', async () => {
    await listPericias({ dataInicio: '2026-08-01' });
    expect(periciasEqCalls).toContainEqual(['gte:data_agendada', '2026-08-01']);
  });

  it('filters by dataFim using lte on data_agendada', async () => {
    await listPericias({ dataFim: '2026-08-10' });
    expect(periciasEqCalls).toContainEqual(['lte:data_agendada', '2026-08-10']);
  });

  it('filters an exact day when dataInicio equals dataFim', async () => {
    await listPericias({ dataInicio: '2026-08-05', dataFim: '2026-08-05' });
    expect(periciasEqCalls).toContainEqual(['gte:data_agendada', '2026-08-05']);
    expect(periciasEqCalls).toContainEqual(['lte:data_agendada', '2026-08-05']);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/features/pericias/actions.test.ts`
Expected: FAIL — `listPericias` doesn't accept `dataInicio`/`dataFim` yet (TypeScript would also reject this at compile time; that's expected until Step 3).

- [ ] **Step 3: Update `listPericias`**

In `src/features/pericias/actions.ts`, change the filters parameter type (line 38-40):

```ts
  filters: {
    situacao?: string; busca?: string; data?: string;
    municipioId?: number; peritoId?: number; colaboradorId?: number;
  } = {}
```

to:

```ts
  filters: {
    situacao?: string; busca?: string; dataInicio?: string; dataFim?: string;
    municipioId?: number; peritoId?: number; colaboradorId?: number;
  } = {}
```

Then replace:

```ts
  if (filters.data) {
    query = query.eq('data_agendada', filters.data);
  }
```

with:

```ts
  if (filters.dataInicio) {
    query = query.gte('data_agendada', filters.dataInicio);
  }
  if (filters.dataFim) {
    query = query.lte('data_agendada', filters.dataFim);
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/pericias/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the page's searchParams**

In `src/app/(app)/page.tsx`, change:

```ts
  searchParams: Promise<{
    situacao?: string; busca?: string; data?: string;
    municipioId?: string; peritoId?: string; colaboradorId?: string;
  }>;
}) {
  const { situacao, busca, data, municipioId, peritoId, colaboradorId } = await searchParams;
  const itemsPromise = listPericias({
    situacao,
    busca,
    data,
    municipioId: municipioId ? Number(municipioId) : undefined,
    peritoId: peritoId ? Number(peritoId) : undefined,
    colaboradorId: colaboradorId ? Number(colaboradorId) : undefined,
  });
```

to:

```ts
  searchParams: Promise<{
    situacao?: string; busca?: string; dataInicio?: string; dataFim?: string;
    municipioId?: string; peritoId?: string; colaboradorId?: string;
  }>;
}) {
  const { situacao, busca, dataInicio, dataFim, municipioId, peritoId, colaboradorId } = await searchParams;
  const itemsPromise = listPericias({
    situacao,
    busca,
    dataInicio,
    dataFim,
    municipioId: municipioId ? Number(municipioId) : undefined,
    peritoId: peritoId ? Number(peritoId) : undefined,
    colaboradorId: colaboradorId ? Number(colaboradorId) : undefined,
  });
```

- [ ] **Step 6: Write the failing filter UI tests**

In `src/features/pericias/components/pericias-filters.test.tsx`, replace the `it('pushes data when a date is picked', ...)` test with:

```ts
  it('pushes dataInicio when the start date is picked', async () => {
    params = new URLSearchParams();
    const user = userEvent.setup();
    render(<PericiasFilters peritos={[]} colaboradores={[]} municipio={null} startTransition={(cb) => cb()} />);

    await user.type(screen.getByLabelText('Data inicial'), '2026-08-01');

    expect(push).toHaveBeenCalledWith(expect.stringContaining('dataInicio=2026-08-01'));
  });

  it('pushes dataFim when the end date is picked', async () => {
    params = new URLSearchParams();
    const user = userEvent.setup();
    render(<PericiasFilters peritos={[]} colaboradores={[]} municipio={null} startTransition={(cb) => cb()} />);

    await user.type(screen.getByLabelText('Data final'), '2026-08-10');

    expect(push).toHaveBeenCalledWith(expect.stringContaining('dataFim=2026-08-10'));
  });
```

And update the `'clears data, municipioId, ...'` test: change its seed params string from

```ts
    params = new URLSearchParams(
      'busca=P-1&situacao=Em+andamento&data=2026-08-01&municipioId=3550308&peritoId=1&colaboradorId=2'
    );
```

to

```ts
    params = new URLSearchParams(
      'busca=P-1&situacao=Em+andamento&dataInicio=2026-08-01&dataFim=2026-08-05&municipioId=3550308&peritoId=1&colaboradorId=2'
    );
```

and its assertions from

```ts
    expect(pushedUrl).not.toContain('data=');
```

to

```ts
    expect(pushedUrl).not.toContain('dataInicio=');
    expect(pushedUrl).not.toContain('dataFim=');
```

(keep the `municipioId=`/`peritoId=`/`colaboradorId=` assertions unchanged).

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run src/features/pericias/components/pericias-filters.test.tsx`
Expected: FAIL — no element is labeled "Data inicial" or "Data final" yet.

- [ ] **Step 8: Replace the single Data field with a range pair**

In `src/features/pericias/components/pericias-filters.tsx`, replace:

```tsx
          <div className="space-y-1.5">
            <Label htmlFor="data-filtro">Data</Label>
            <Input
              id="data-filtro" type="date"
              value={searchParams.get('data') ?? ''}
              onChange={(e) => updateParam('data', e.target.value)}
            />
          </div>
```

with:

```tsx
          <div className="space-y-1.5">
            <Label>Data</Label>
            <div className="flex items-center gap-1">
              <Input
                type="date" aria-label="Data inicial"
                value={searchParams.get('dataInicio') ?? ''}
                onChange={(e) => updateParam('dataInicio', e.target.value)}
              />
              <span className="text-xs text-muted-foreground">até</span>
              <Input
                type="date" aria-label="Data final"
                value={searchParams.get('dataFim') ?? ''}
                onChange={(e) => updateParam('dataFim', e.target.value)}
              />
            </div>
          </div>
```

Then update `hasActiveFilters` — replace:

```ts
  const hasActiveFilters = Boolean(
    searchParams.get('busca') ||
      searchParams.get('situacao') ||
      searchParams.get('data') ||
      municipioId ||
      peritoId ||
      colaboradorId
  );
```

with:

```ts
  const hasActiveFilters = Boolean(
    searchParams.get('busca') ||
      searchParams.get('situacao') ||
      searchParams.get('dataInicio') ||
      searchParams.get('dataFim') ||
      municipioId ||
      peritoId ||
      colaboradorId
  );
```

`handleClearFilters` already does `router.push('/')` (clears every param unconditionally) — no change needed there.

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run src/features/pericias/components/pericias-filters.test.tsx`
Expected: PASS.

- [ ] **Step 10: Manually confirm the loading fallback still renders the filters**

Open `src/app/(app)/loading.tsx` and confirm it renders `<PericiasFilters .../>` with no `data`-specific prop (it only passes `peritos={[]} colaboradores={[]} municipio={null}`, unaffected by this task). No edit needed; this step is a read-only sanity check.

- [ ] **Step 11: Run the full pericias suite, then the whole project**

Run: `npx vitest run src/features/pericias && npx tsc --noEmit && npm test`
Expected: all clean.

- [ ] **Step 12: Commit**

```bash
git add src/features/pericias/actions.ts src/features/pericias/actions.test.ts src/app/\(app\)/page.tsx src/features/pericias/components/pericias-filters.tsx src/features/pericias/components/pericias-filters.test.tsx
git commit -m "feat: turn the Pericias date filter into a range (dataInicio/dataFim)"
```

---

### Task 6: Shared `ConfirmDialog` component

**Files:**
- Create: `src/components/shared/confirm-dialog.tsx`
- Create: `src/components/shared/confirm-dialog.test.tsx`

**Interfaces:**
- Produces: `ConfirmDialog` component, props `{ open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; onConfirm: () => void; loading: boolean }`. Every delete task (7-10) imports this from `@/components/shared/confirm-dialog`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/shared/confirm-dialog.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ConfirmDialog } from './confirm-dialog';

describe('ConfirmDialog', () => {
  it('renders title and description when open', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Excluir perito"
        description="Excluir 'Carlos'? Essa ação não pode ser desfeita."
        onConfirm={vi.fn()}
        loading={false}
      />
    );
    expect(screen.getByText('Excluir perito')).toBeInTheDocument();
    expect(screen.getByText("Excluir 'Carlos'? Essa ação não pode ser desfeita.")).toBeInTheDocument();
  });

  it('calls onConfirm when the Excluir button is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Excluir perito"
        description="..."
        onConfirm={onConfirm}
        loading={false}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onOpenChange(false) when Cancelar is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Excluir perito"
        description="..."
        onConfirm={vi.fn()}
        loading={false}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disables both buttons and shows "Excluindo..." while loading', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Excluir perito"
        description="..."
        onConfirm={vi.fn()}
        loading
      />
    );
    expect(screen.getByRole('button', { name: 'Excluindo...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/shared/confirm-dialog.test.tsx`
Expected: FAIL — the file doesn't exist yet.

- [ ] **Step 3: Implement the component**

```tsx
// src/components/shared/confirm-dialog.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? 'Excluindo...' : 'Excluir'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/shared/confirm-dialog.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/confirm-dialog.tsx src/components/shared/confirm-dialog.test.tsx
git commit -m "feat: add shared ConfirmDialog component for delete flows"
```

---

### Task 7: Delete Perito

**Files:**
- Modify: `src/features/peritos/actions.ts`
- Modify: `src/features/peritos/actions.test.ts`
- Modify: `src/features/peritos/components/peritos-table.tsx`
- Create: `src/features/peritos/components/peritos-table.test.tsx`
- Modify: `src/features/peritos/components/peritos-screen.tsx`

**Interfaces:**
- Consumes: `ConfirmDialog` (Task 6).
- Produces: `deletePerito(id: number): Promise<ActionResult<null>>`. `PeritosTable` gains an `onDelete: (perito: Perito) => Promise<void>` prop.

- [ ] **Step 1: Write the failing action test**

Add to `src/features/peritos/actions.test.ts`. First add a delete mock — change the top of the file from:

```ts
const mockOrder = vi.fn();
const mockSelect = vi.fn(() => ({ order: mockOrder }));

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ select: mockSelect }),
  })),
}));
```

to:

```ts
const mockOrder = vi.fn();
const mockSelect = vi.fn(() => ({ order: mockOrder }));
const mockDeleteEq = vi.fn(() => ({ error: null }));
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq }));

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ select: mockSelect, delete: mockDelete }),
  })),
}));
```

Then add, importing `deletePerito` in the top `import { listPeritos } from './actions';` line (change to `import { listPeritos, deletePerito } from './actions';`), and add a new `describe`:

```ts
describe('deletePerito', () => {
  beforeEach(() => {
    mockDeleteEq.mockReset();
    mockDeleteEq.mockReturnValue({ error: null });
  });

  it('deletes the perito', async () => {
    const result = await deletePerito(1);
    expect(result).toEqual({ success: true, data: null });
    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 1);
  });

  it('returns a friendly error when the perito has linked pericias', async () => {
    mockDeleteEq.mockReturnValue({ error: { code: '23503', message: 'foreign key violation' } });
    const result = await deletePerito(1);
    expect(result).toEqual({
      success: false,
      error: 'Não é possível excluir: há perícias vinculadas a este perito.',
    });
  });

  it('returns the raw message for any other error', async () => {
    mockDeleteEq.mockReturnValue({ error: { code: '99999', message: 'boom' } });
    const result = await deletePerito(1);
    expect(result).toEqual({ success: false, error: 'boom' });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/features/peritos/actions.test.ts`
Expected: FAIL — `deletePerito` doesn't exist (TypeScript import error).

- [ ] **Step 3: Implement `deletePerito`**

Add to the end of `src/features/peritos/actions.ts`:

```ts
export async function deletePerito(id: number): Promise<ActionResult<null>> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { error } = await supabase.from('peritos').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {
      return { success: false, error: 'Não é possível excluir: há perícias vinculadas a este perito.' };
    }
    return { success: false, error: error.message };
  }
  return { success: true, data: null };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/peritos/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing table test (new file)**

```tsx
// src/features/peritos/components/peritos-table.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PeritosTable } from './peritos-table';
import type { Perito } from '../actions';

const items: Perito[] = [
  {
    id: 1, nome: 'Carlos Lima', contato: '', formacao: '', crea: '', documento: '',
    jaTrabalhamos: false, relacao: 'neutra', resultados: 'parcial',
  },
];

describe('PeritosTable', () => {
  it('calls onEdit when the edit icon is clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<PeritosTable items={items} onEdit={onEdit} onDelete={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /editar carlos lima/i }));

    expect(onEdit).toHaveBeenCalledWith(items[0]);
  });

  it('opens a confirmation dialog and calls onDelete when confirmed', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn(async () => {});
    render(<PeritosTable items={items} onEdit={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /excluir carlos lima/i }));
    expect(screen.getByText(/excluir "carlos lima"/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Excluir' }));

    expect(onDelete).toHaveBeenCalledWith(items[0]);
  });

  it('does not call onDelete when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn(async () => {});
    render(<PeritosTable items={items} onEdit={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /excluir carlos lima/i }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByText(/excluir "carlos lima"/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/features/peritos/components/peritos-table.test.tsx`
Expected: FAIL — `PeritosTable` doesn't accept `onDelete` yet, no trash icon exists.

- [ ] **Step 7: Wire the delete button + dialog into the table**

Replace the full contents of `src/features/peritos/components/peritos-table.tsx` with:

```tsx
'use client';

import { use, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { RelacaoBadge } from '@/components/shared/relacao-badge';
import { ResultadoBadge } from '@/components/shared/resultado-badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { formatPhone } from '@/lib/masks';
import type { Perito } from '../actions';

export function PeritosTableAsync({
  itemsPromise,
  onEdit,
  onDelete,
}: {
  itemsPromise: Promise<Perito[]>;
  onEdit: (perito: Perito) => void;
  onDelete: (perito: Perito) => Promise<void>;
}) {
  const items = use(itemsPromise);
  return <PeritosTable items={items} onEdit={onEdit} onDelete={onDelete} />;
}

export function PeritosTable({
  items,
  onEdit,
  onDelete,
}: {
  items: Perito[];
  onEdit: (perito: Perito) => void;
  onDelete: (perito: Perito) => Promise<void>;
}) {
  const [confirmTarget, setConfirmTarget] = useState<Perito | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhum perito cadastrado.</p>;
  }

  async function handleConfirmDelete() {
    if (!confirmTarget) return;
    setDeleting(true);
    await onDelete(confirmTarget);
    setDeleting(false);
    setConfirmTarget(null);
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>Formação</TableHead>
            <TableHead>CREA</TableHead>
            <TableHead>Relação</TableHead>
            <TableHead>Resultados</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.nome}</TableCell>
              <TableCell>{formatPhone(item.contato)}</TableCell>
              <TableCell>{item.formacao}</TableCell>
              <TableCell>{item.crea}</TableCell>
              <TableCell><RelacaoBadge relacao={item.relacao} /></TableCell>
              <TableCell><ResultadoBadge resultado={item.resultados} /></TableCell>
              <TableCell>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => onEdit(item)}>
                  <Pencil className="size-4" />
                  <span className="sr-only">Editar {item.nome}</span>
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setConfirmTarget(item)}>
                  <Trash2 className="size-4" />
                  <span className="sr-only">Excluir {item.nome}</span>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title="Excluir perito"
        description={`Excluir "${confirmTarget?.nome}"? Essa ação não pode ser desfeita.`}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </>
  );
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/features/peritos/components/peritos-table.test.tsx`
Expected: PASS.

- [ ] **Step 9: Wire the screen**

In `src/features/peritos/components/peritos-screen.tsx`, change the import line:

```ts
import type { Perito } from '../actions';
```

to:

```ts
import { deletePerito, type Perito } from '../actions';
```

Add a `handleDelete` function after `handleSaved`:

```ts
  async function handleDelete(perito: Perito) {
    const result = await deletePerito(perito.id);
    if (result.success) {
      toast.success('Perito excluído');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }
```

And pass it to the table:

```tsx
        <Suspense fallback={<TableSkeleton headers={PERITOS_HEADERS} />}>
          <PeritosTableAsync itemsPromise={itemsPromise} onEdit={openEdit} onDelete={handleDelete} />
        </Suspense>
```

- [ ] **Step 10: Run the full peritos suite, then type-check**

Run: `npx vitest run src/features/peritos && npx tsc --noEmit`
Expected: both clean. (`peritos-screen.test.tsx` currently doesn't mock `deletePerito` — check it: if it mocks `'../actions'` wholesale, add `deletePerito: vi.fn()` to that mock; if it doesn't mock `'../actions'` at all, no change needed. Read the file before assuming either way.)

- [ ] **Step 11: Commit**

```bash
git add src/features/peritos/actions.ts src/features/peritos/actions.test.ts src/features/peritos/components/peritos-table.tsx src/features/peritos/components/peritos-table.test.tsx src/features/peritos/components/peritos-screen.tsx
git commit -m "feat: add delete to Peritos"
```

---

### Task 8: Delete Processo

**Files:**
- Modify: `src/features/processos/actions.ts`
- Modify: `src/features/processos/actions.test.ts`
- Modify: `src/features/processos/components/processos-table.tsx`
- Create: `src/features/processos/components/processos-table.test.tsx`
- Modify: `src/features/processos/components/processos-screen.tsx`

**Interfaces:**
- Consumes: `ConfirmDialog` (Task 6).
- Produces: `deleteProcesso(id: number): Promise<ActionResult<null>>`. `ProcessosTable` gains `onDelete: (processo: Processo) => Promise<void>`.

- [ ] **Step 1: Write the failing action test**

In `src/features/processos/actions.test.ts`, change the top mock block from:

```ts
const mockUpdateEq = vi.fn(() => ({ select: () => ({ single: mockSingle }) }));
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ select: mockSelect, update: mockUpdate }),
  })),
}));
```

to:

```ts
const mockUpdateEq = vi.fn(() => ({ select: () => ({ single: mockSingle }) }));
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
const mockDeleteEq = vi.fn(() => ({ error: null }));
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq }));

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ select: mockSelect, update: mockUpdate, delete: mockDelete }),
  })),
}));
```

Change the import line `import { listProcessos, getProcesso, updateProcesso } from './actions';` to `import { listProcessos, getProcesso, updateProcesso, deleteProcesso } from './actions';`, and add:

```ts
describe('deleteProcesso', () => {
  beforeEach(() => {
    mockDeleteEq.mockReset();
    mockDeleteEq.mockReturnValue({ error: null });
  });

  it('deletes the processo', async () => {
    const result = await deleteProcesso(1);
    expect(result).toEqual({ success: true, data: null });
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 1);
  });

  it('returns a friendly error when the processo has linked pericias', async () => {
    mockDeleteEq.mockReturnValue({ error: { code: '23503', message: 'foreign key violation' } });
    const result = await deleteProcesso(1);
    expect(result).toEqual({
      success: false,
      error: 'Não é possível excluir: há perícias vinculadas a este processo.',
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/features/processos/actions.test.ts`
Expected: FAIL — `deleteProcesso` doesn't exist.

- [ ] **Step 3: Implement `deleteProcesso`**

Add to the end of `src/features/processos/actions.ts`:

```ts
export async function deleteProcesso(id: number): Promise<ActionResult<null>> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { error } = await supabase.from('processos').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {
      return { success: false, error: 'Não é possível excluir: há perícias vinculadas a este processo.' };
    }
    return { success: false, error: error.message };
  }
  return { success: true, data: null };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/processos/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing table test (new file)**

```tsx
// src/features/processos/components/processos-table.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ProcessosTable } from './processos-table';
import type { Processo } from '../actions';

const items: Processo[] = [{ id: 1, numero: 'P-1', autor: 'A', reu: 'B' }];

describe('ProcessosTable', () => {
  it('calls onEdit when the edit icon is clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<ProcessosTable items={items} onEdit={onEdit} onDelete={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /editar p-1/i }));

    expect(onEdit).toHaveBeenCalledWith(items[0]);
  });

  it('opens a confirmation dialog and calls onDelete when confirmed', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn(async () => {});
    render(<ProcessosTable items={items} onEdit={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /excluir p-1/i }));
    expect(screen.getByText(/excluir o processo "p-1"/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Excluir' }));

    expect(onDelete).toHaveBeenCalledWith(items[0]);
  });

  it('does not call onDelete when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn(async () => {});
    render(<ProcessosTable items={items} onEdit={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /excluir p-1/i }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onDelete).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/features/processos/components/processos-table.test.tsx`
Expected: FAIL.

- [ ] **Step 7: Wire the delete button + dialog into the table**

Replace the full contents of `src/features/processos/components/processos-table.tsx` with:

```tsx
'use client';

import { use, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import type { Processo } from '../actions';

export function ProcessosTableAsync({
  itemsPromise,
  onEdit,
  onDelete,
}: {
  itemsPromise: Promise<Processo[]>;
  onEdit: (processo: Processo) => void;
  onDelete: (processo: Processo) => Promise<void>;
}) {
  const items = use(itemsPromise);
  return <ProcessosTable items={items} onEdit={onEdit} onDelete={onDelete} />;
}

export function ProcessosTable({
  items,
  onEdit,
  onDelete,
}: {
  items: Processo[];
  onEdit: (processo: Processo) => void;
  onDelete: (processo: Processo) => Promise<void>;
}) {
  const [confirmTarget, setConfirmTarget] = useState<Processo | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhum processo cadastrado.</p>;
  }

  async function handleConfirmDelete() {
    if (!confirmTarget) return;
    setDeleting(true);
    await onDelete(confirmTarget);
    setDeleting(false);
    setConfirmTarget(null);
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Autor</TableHead>
            <TableHead>Réu</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.numero}</TableCell>
              <TableCell>{item.autor}</TableCell>
              <TableCell>{item.reu}</TableCell>
              <TableCell>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => onEdit(item)}>
                  <Pencil className="size-4" />
                  <span className="sr-only">Editar {item.numero}</span>
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setConfirmTarget(item)}>
                  <Trash2 className="size-4" />
                  <span className="sr-only">Excluir {item.numero}</span>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title="Excluir processo"
        description={`Excluir o processo "${confirmTarget?.numero}"? Essa ação não pode ser desfeita.`}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </>
  );
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/features/processos/components/processos-table.test.tsx`
Expected: PASS.

- [ ] **Step 9: Wire the screen**

In `src/features/processos/components/processos-screen.tsx`, change:

```ts
import type { Processo } from '../actions';
```

to:

```ts
import { deleteProcesso, type Processo } from '../actions';
```

Add after `handleSaved`:

```ts
  async function handleDelete(processo: Processo) {
    const result = await deleteProcesso(processo.id);
    if (result.success) {
      toast.success('Processo excluído');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }
```

Pass it to the table:

```tsx
        <Suspense fallback={<TableSkeleton headers={PROCESSOS_HEADERS} />}>
          <ProcessosTableAsync itemsPromise={itemsPromise} onEdit={openEdit} onDelete={handleDelete} />
        </Suspense>
```

- [ ] **Step 10: Run the full processos suite, then type-check**

Run: `npx vitest run src/features/processos && npx tsc --noEmit`
Expected: both clean. Same caveat as Task 7 Step 10 about `processos-screen.test.tsx`'s `'../actions'` mock — check and add `deleteProcesso: vi.fn()` if that mock exists there.

- [ ] **Step 11: Commit**

```bash
git add src/features/processos/actions.ts src/features/processos/actions.test.ts src/features/processos/components/processos-table.tsx src/features/processos/components/processos-table.test.tsx src/features/processos/components/processos-screen.tsx
git commit -m "feat: add delete to Processos"
```

---

### Task 9: Delete Colaborador

**Files:**
- Modify: `src/features/colaboradores/actions.ts`
- Modify: `src/features/colaboradores/actions.test.ts`
- Modify: `src/features/colaboradores/components/colaboradores-table.tsx`
- Create: `src/features/colaboradores/components/colaboradores-table.test.tsx`
- Modify: `src/features/colaboradores/components/colaboradores-screen.tsx`

**Interfaces:**
- Consumes: `ConfirmDialog` (Task 6).
- Produces: `deleteColaborador(id: number): Promise<ActionResult<null>>`. `ColaboradoresTable` gains `onDelete: (colaborador: Colaborador) => Promise<void>`.

- [ ] **Step 1: Write the failing action test**

In `src/features/colaboradores/actions.test.ts`, change the top mock block from:

```ts
const mockOrder = vi.fn();
const mockSelect = vi.fn(() => ({ order: mockOrder }));

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ select: mockSelect }),
  })),
}));
```

to:

```ts
const mockOrder = vi.fn();
const mockSelect = vi.fn(() => ({ order: mockOrder }));
const mockDeleteEq = vi.fn(() => ({ error: null }));
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq }));

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ select: mockSelect, delete: mockDelete }),
  })),
}));
```

Change `import { listColaboradores } from './actions';` to `import { listColaboradores, deleteColaborador } from './actions';`, and add:

```ts
describe('deleteColaborador', () => {
  beforeEach(() => {
    mockDeleteEq.mockReset();
    mockDeleteEq.mockReturnValue({ error: null });
  });

  it('deletes the colaborador', async () => {
    const result = await deleteColaborador(1);
    expect(result).toEqual({ success: true, data: null });
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 1);
  });

  it('returns the raw message on any database error', async () => {
    mockDeleteEq.mockReturnValue({ error: { code: '99999', message: 'boom' } });
    const result = await deleteColaborador(1);
    expect(result).toEqual({ success: false, error: 'boom' });
  });
});
```

(No `23503` branch: `colaborador_id` on `pericias` is `on delete set null`, so deleting a linked colaborador can never raise a foreign-key violation — see Global Constraints.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/features/colaboradores/actions.test.ts`
Expected: FAIL — `deleteColaborador` doesn't exist.

- [ ] **Step 3: Implement `deleteColaborador`**

Add to the end of `src/features/colaboradores/actions.ts`:

```ts
export async function deleteColaborador(id: number): Promise<ActionResult<null>> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { error } = await supabase.from('colaboradores').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/colaboradores/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing table test (new file)**

```tsx
// src/features/colaboradores/components/colaboradores-table.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ColaboradoresTable } from './colaboradores-table';
import type { Colaborador } from '../actions';

const items: Colaborador[] = [{ id: 1, nome: 'Bruna Souza', contato: '', formacao: '', interno: true }];

describe('ColaboradoresTable', () => {
  it('calls onEdit when the edit icon is clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<ColaboradoresTable items={items} onEdit={onEdit} onDelete={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /editar bruna souza/i }));

    expect(onEdit).toHaveBeenCalledWith(items[0]);
  });

  it('opens a confirmation dialog and calls onDelete when confirmed', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn(async () => {});
    render(<ColaboradoresTable items={items} onEdit={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /excluir bruna souza/i }));
    expect(screen.getByText(/excluir "bruna souza"/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Excluir' }));

    expect(onDelete).toHaveBeenCalledWith(items[0]);
  });

  it('does not call onDelete when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn(async () => {});
    render(<ColaboradoresTable items={items} onEdit={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /excluir bruna souza/i }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onDelete).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/features/colaboradores/components/colaboradores-table.test.tsx`
Expected: FAIL.

- [ ] **Step 7: Wire the delete button + dialog into the table**

Replace the full contents of `src/features/colaboradores/components/colaboradores-table.tsx` with:

```tsx
'use client';

import { use, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { formatPhone } from '@/lib/masks';
import type { Colaborador } from '../actions';

export function ColaboradoresTableAsync({
  itemsPromise,
  onEdit,
  onDelete,
}: {
  itemsPromise: Promise<Colaborador[]>;
  onEdit: (colaborador: Colaborador) => void;
  onDelete: (colaborador: Colaborador) => Promise<void>;
}) {
  const items = use(itemsPromise);
  return <ColaboradoresTable items={items} onEdit={onEdit} onDelete={onDelete} />;
}

export function ColaboradoresTable({
  items,
  onEdit,
  onDelete,
}: {
  items: Colaborador[];
  onEdit: (colaborador: Colaborador) => void;
  onDelete: (colaborador: Colaborador) => Promise<void>;
}) {
  const [confirmTarget, setConfirmTarget] = useState<Colaborador | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhum colaborador cadastrado.</p>;
  }

  async function handleConfirmDelete() {
    if (!confirmTarget) return;
    setDeleting(true);
    await onDelete(confirmTarget);
    setDeleting(false);
    setConfirmTarget(null);
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>Formação</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.nome}</TableCell>
              <TableCell>{formatPhone(item.contato)}</TableCell>
              <TableCell>{item.formacao}</TableCell>
              <TableCell>{item.interno ? 'Interno' : 'Externo'}</TableCell>
              <TableCell>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => onEdit(item)}>
                  <Pencil className="size-4" />
                  <span className="sr-only">Editar {item.nome}</span>
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setConfirmTarget(item)}>
                  <Trash2 className="size-4" />
                  <span className="sr-only">Excluir {item.nome}</span>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title="Excluir colaborador"
        description={`Excluir "${confirmTarget?.nome}"? Essa ação não pode ser desfeita.`}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </>
  );
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/features/colaboradores/components/colaboradores-table.test.tsx`
Expected: PASS.

- [ ] **Step 9: Wire the screen**

In `src/features/colaboradores/components/colaboradores-screen.tsx`, change:

```ts
import type { Colaborador } from '../actions';
```

to:

```ts
import { deleteColaborador, type Colaborador } from '../actions';
```

Add after `handleSaved`:

```ts
  async function handleDelete(colaborador: Colaborador) {
    const result = await deleteColaborador(colaborador.id);
    if (result.success) {
      toast.success('Colaborador excluído');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }
```

Pass it to the table:

```tsx
        <Suspense fallback={<TableSkeleton headers={COLABORADORES_HEADERS} />}>
          <ColaboradoresTableAsync itemsPromise={itemsPromise} onEdit={openEdit} onDelete={handleDelete} />
        </Suspense>
```

- [ ] **Step 10: Run the full colaboradores suite, then type-check**

Run: `npx vitest run src/features/colaboradores && npx tsc --noEmit`
Expected: both clean. `colaboradores-screen.test.tsx` already mocks router with `push`/`refresh` (per this session's history) — check whether it also mocks `'../actions'`; if so, add `deleteColaborador: vi.fn()`.

- [ ] **Step 11: Commit**

```bash
git add src/features/colaboradores/actions.ts src/features/colaboradores/actions.test.ts src/features/colaboradores/components/colaboradores-table.tsx src/features/colaboradores/components/colaboradores-table.test.tsx src/features/colaboradores/components/colaboradores-screen.tsx
git commit -m "feat: add delete to Colaboradores"
```

---

### Task 10: Delete Perícia

**Files:**
- Modify: `src/features/pericias/actions.ts`
- Modify: `src/features/pericias/actions.test.ts`
- Modify: `src/features/pericias/components/pericias-table.tsx`
- Modify: `src/features/pericias/components/pericias-table.test.tsx`
- Modify: `src/features/pericias/components/pericias-screen.tsx`
- Modify: `src/features/pericias/components/pericias-screen.test.tsx`

**Interfaces:**
- Consumes: `ConfirmDialog` (Task 6).
- Produces: `deletePericia(id: number): Promise<ActionResult<null>>`. `PericiasTable` gains `onDelete: (item: PericiaListItem) => Promise<void>`.

- [ ] **Step 1: Write the failing action test**

In `src/features/pericias/actions.test.ts`, add a delete mock. The existing `vi.mock('@/lib/supabase/server', ...)` block returns `from: () => ({ insert: mockInsert, update: mockUpdate, ...periciasQueryBuilder() })`. Add a delete chain: declare near the other mocks (after `mockUpdate`):

```ts
const mockDeleteEq = vi.fn(() => ({ error: null }));
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq }));
```

and change the `from` factory to:

```ts
    from: () => ({ insert: mockInsert, update: mockUpdate, delete: mockDelete, ...periciasQueryBuilder() }),
```

Change the top import `import { createPericia, listPericias, updatePericia } from './actions';` to `import { createPericia, listPericias, updatePericia, deletePericia } from './actions';`, and add:

```ts
describe('deletePericia', () => {
  beforeEach(() => {
    mockDeleteEq.mockReset();
    mockDeleteEq.mockReturnValue({ error: null });
  });

  it('deletes the pericia', async () => {
    const result = await deletePericia(1);
    expect(result).toEqual({ success: true, data: null });
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 1);
  });

  it('returns the raw message on a database error', async () => {
    mockDeleteEq.mockReturnValue({ error: { message: 'boom' } });
    const result = await deletePericia(1);
    expect(result).toEqual({ success: false, error: 'boom' });
  });
});
```

(No `23503` branch: nothing references `pericias` — see Global Constraints.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/features/pericias/actions.test.ts`
Expected: FAIL — `deletePericia` doesn't exist.

- [ ] **Step 3: Implement `deletePericia`**

Add to the end of `src/features/pericias/actions.ts`:

```ts
export async function deletePericia(id: number): Promise<ActionResult<null>> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { error } = await supabase.from('pericias').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/pericias/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing table tests**

In `src/features/pericias/components/pericias-table.test.tsx`, update every `render(<PericiasTable items={...} onEdit={...} />)` call to also pass `onDelete={vi.fn()}` (all 5 existing `it` blocks — the last one, `'shows a message when there are no items'`, renders with `items={[]}`, still needs `onDelete={vi.fn()}` for the prop type to be satisfied even though the empty-state early return never uses it).

Then add:

```ts
  it('opens a confirmation dialog and calls onDelete when confirmed', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn(async () => {});
    render(<PericiasTable items={items} onEdit={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /excluir perícia/i }));
    expect(screen.getByText(/excluir a perícia do processo "0001234-56\.2026\.8\.26\.0100"/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Excluir' }));

    expect(onDelete).toHaveBeenCalledWith(items[0]);
  });

  it('does not call onDelete when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn(async () => {});
    render(<PericiasTable items={items} onEdit={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /excluir perícia/i }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onDelete).not.toHaveBeenCalled();
  });
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/features/pericias/components/pericias-table.test.tsx`
Expected: FAIL — no delete button exists yet, and TypeScript rejects the missing `onDelete` prop in the pre-existing render calls.

- [ ] **Step 7: Wire the delete button + dialog into the table**

In `src/features/pericias/components/pericias-table.tsx`:

Add imports — change:

```tsx
import { Fragment, use, useState } from 'react';
import { ChevronRight, Pencil } from 'lucide-react';
```

to:

```tsx
import { Fragment, use, useState } from 'react';
import { ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
```

Change the `PericiasTableAsync` and `PericiasTable` signatures — replace:

```tsx
export function PericiasTableAsync({
  itemsPromise,
  onEdit,
}: {
  itemsPromise: Promise<PericiaListItem[]>;
  onEdit: (item: PericiaListItem) => void;
}) {
  const items = use(itemsPromise);
  return <PericiasTable items={items} onEdit={onEdit} />;
}

export function PericiasTable({ items, onEdit }: { items: PericiaListItem[]; onEdit: (item: PericiaListItem) => void }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhuma perícia encontrada.</p>;
  }
```

with:

```tsx
export function PericiasTableAsync({
  itemsPromise,
  onEdit,
  onDelete,
}: {
  itemsPromise: Promise<PericiaListItem[]>;
  onEdit: (item: PericiaListItem) => void;
  onDelete: (item: PericiaListItem) => Promise<void>;
}) {
  const items = use(itemsPromise);
  return <PericiasTable items={items} onEdit={onEdit} onDelete={onDelete} />;
}

export function PericiasTable({
  items,
  onEdit,
  onDelete,
}: {
  items: PericiaListItem[];
  onEdit: (item: PericiaListItem) => void;
  onDelete: (item: PericiaListItem) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [confirmTarget, setConfirmTarget] = useState<PericiaListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhuma perícia encontrada.</p>;
  }

  async function handleConfirmDelete() {
    if (!confirmTarget) return;
    setDeleting(true);
    await onDelete(confirmTarget);
    setDeleting(false);
    setConfirmTarget(null);
  }
```

Add the Trash2 button next to the existing edit button — replace:

```tsx
                <TableCell>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => onEdit(item)}>
                    <Pencil className="size-4" />
                    <span className="sr-only">Editar perícia {item.processo.numero}</span>
                  </Button>
                </TableCell>
```

with:

```tsx
                <TableCell>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => onEdit(item)}>
                    <Pencil className="size-4" />
                    <span className="sr-only">Editar perícia {item.processo.numero}</span>
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setConfirmTarget(item)}>
                    <Trash2 className="size-4" />
                    <span className="sr-only">Excluir perícia {item.processo.numero}</span>
                  </Button>
                </TableCell>
```

Finally, wrap the whole return value in a fragment so the dialog can sit alongside the table, and close it with the dialog. The component currently starts and ends with:

```tsx
  return (
    <Table>
      <TableHeader>
```

```tsx
      </TableBody>
    </Table>
  );
}
```

Change the opening to:

```tsx
  return (
    <>
      <Table>
        <TableHeader>
```

(re-indent everything between `<TableHeader>` and the matching `</Table>` one level deeper to stay valid — the content itself doesn't otherwise change), and change the ending to:

```tsx
        </TableBody>
      </Table>
      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title="Excluir perícia"
        description={`Excluir a perícia do processo "${confirmTarget?.processo.numero}"? Essa ação não pode ser desfeita.`}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </>
  );
}
```

(The `Trash2` icon button being a sibling of `Pencil` inside the same `TableCell` needs no extra layout wrapper — `TableCell` already renders as a flex-free `<td>`; both `Button`s are `icon-sm` and sit inline. If they visually overlap when reviewing in the browser, wrap both in `<div className="flex gap-1">` — but do not add this preemptively; only if the manual check in Task 11 shows a real problem.)

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/features/pericias/components/pericias-table.test.tsx`
Expected: PASS (all 7 tests).

- [ ] **Step 9: Wire the screen**

In `src/features/pericias/components/pericias-screen.tsx`, change:

```ts
import type { PericiaListItem } from '../actions';
```

to:

```ts
import { deletePericia, type PericiaListItem } from '../actions';
```

Add after `handleSaved`:

```ts
  async function handleDelete(item: PericiaListItem) {
    const result = await deletePericia(item.id);
    if (result.success) {
      toast.success('Perícia excluída');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }
```

Pass it to the table:

```tsx
        <Suspense fallback={<TableSkeleton headers={PERICIAS_HEADERS} />}>
          <PericiasTableAsync itemsPromise={itemsPromise} onEdit={openEdit} onDelete={handleDelete} />
        </Suspense>
```

- [ ] **Step 10: Fix `pericias-screen.test.tsx`**

This file's `vi.mock('../actions', ...)` currently only stubs `createPericia`/`updatePericia`. Add `deletePericia: vi.fn(async () => ({ success: true, data: null }))` to that mock object so the real `PericiasScreen` (which now imports `deletePericia` as a value) doesn't hit the un-mocked real module:

```ts
vi.mock('../actions', () => ({
  createPericia: vi.fn(async () => ({ success: true, data: { id: 9 } })),
  updatePericia: vi.fn(async () => ({ success: true, data: { id: 1 } })),
  deletePericia: vi.fn(async () => ({ success: true, data: null })),
}));
```

- [ ] **Step 11: Run the full pericias suite, then type-check and the whole project**

Run: `npx vitest run src/features/pericias && npx tsc --noEmit && npm test`
Expected: all clean.

- [ ] **Step 12: Commit**

```bash
git add src/features/pericias/actions.ts src/features/pericias/actions.test.ts src/features/pericias/components/pericias-table.tsx src/features/pericias/components/pericias-table.test.tsx src/features/pericias/components/pericias-screen.tsx src/features/pericias/components/pericias-screen.test.tsx
git commit -m "feat: add delete to Pericias"
```

---

### Task 11: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full automated suite**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all clean, 0 errors, 0 failing tests.

- [ ] **Step 2: Manual smoke test against the dev database**

Start the dev server (`npm run dev`) and, logged in as the seeded admin, check:
- Create a Perícia leaving Data and Hora empty → saves, shows "Não agendado" in the list.
- Edit that same Perícia, set only Data (no Hora) → list shows the date + "Hora não definida".
- Perícias filter: pick a Data inicial only → only perícias on/after that date show. Pick a Data final only → only perícias on/through that date show. Pick both equal → only that day. "Limpar filtros" clears both.
- In the Perícia form, select a Colaborador, then reopen the select and choose "Nenhum" → saves with no colaborador.
- Delete a Perito that has no linked Perícias → succeeds, disappears from the list, toast confirms.
- Delete a Perito that DOES have a linked Perícia → fails with the friendly "há perícias vinculadas" message, perito stays in the list.
- Delete a Processo with a linked Perícia → same friendly-block behavior.
- Delete a Colaborador linked to a Perícia → succeeds; reopen that Perícia's detail row and confirm it now shows "Nenhum colaborador vinculado."
- Delete a Perícia → succeeds, disappears from the list.
- Cancel out of a delete confirmation dialog on any of the four screens → nothing is deleted.

- [ ] **Step 3: Apply the migration to production**

**Ask the user for explicit confirmation before this step.** Once confirmed:

```bash
npx supabase link --project-ref ralyhgneesqpfijpvxii
npx supabase db push
npx supabase migration list
npx supabase link --project-ref wpssipdxpfmvcamldpum
```

Expected: `20260730000001` appears in both `local` and `remote` for the prod project in the `migration list` output, and the CLI ends re-linked back to dev.

- [ ] **Step 4: Push**

```bash
git push
```

Expected: Vercel picks up the push and redeploys production automatically (per the CI/CD pipeline set up earlier this session); GitHub Actions CI runs and passes.
