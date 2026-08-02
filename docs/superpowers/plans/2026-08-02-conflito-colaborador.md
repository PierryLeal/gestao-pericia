# Conflito de Colaborador na Perícia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent the same Colaborador from being assigned to two Perícias at the exact same Data+Hora, with a reactive, visually-non-blocking warning in the Perícia form.

**Architecture:** A new read-only server action queries `pericias` for the exact date+time match and returns which colaborador ids are already booked; the existing `PericiaForm` client component calls it (debounced) whenever Data or Hora change, and derives a conflict flag from the currently-selected colaborador against that list — driving custom (non-native) visual dimming, an inline warning, and disabling Save.

**Tech Stack:** Next.js 16 App Router + React 19 Server Actions, Supabase (Postgres `date`/`time` columns), Base UI `Select`, Vitest/RTL.

## Global Constraints

- Every new server action calls `requireRole(['admin', 'gerencia'])` first, matching every other action in this file.
- The visual dimming on a conflicting colaborador option uses a `className` condition only — never Base UI's `disabled` prop on `SelectItem`, which sets `pointer-events-none` and would block the click the spec explicitly requires to stay clickable.
- Debounce delay is 300ms, matching the existing `busca` filter debounce pattern already in this codebase (`src/features/pericias/components/pericias-filters.tsx:43`).
- Editing a Perícia that already has its own colaborador+data+hora must never flag itself — the new action always excludes the Perícia's own id when one is given.

---

### Task 1: `getColaboradoresIndisponiveis` server action

**Files:**
- Modify: `src/features/pericias/actions.ts` (add after `deletePericia`, i.e. after line 173)
- Modify: `src/features/pericias/actions.test.ts` (extend the shared `periciasQueryBuilder()` helper, add a new `describe` block)

**Interfaces:**
- Produces: `getColaboradoresIndisponiveis(dataAgendada: string, horaAgendada: string, excludePericiaId?: number): Promise<number[]>`. Consumed by Task 2 (the form).

- [ ] **Step 1: Extend the shared query-builder test mock**

`src/features/pericias/actions.test.ts` already defines a `periciasQueryBuilder()` helper (lines 23-48) shared by every test in this file, and a top-level `beforeEach` (lines 70-75) that already resets `periciasSelectCalls`/`periciasEqCalls`/`periciasQueryResult`/`mockOrder` before every test — the new tests in this task need no additional `beforeEach`. The builder is missing `.not()` and `.neq()`, both needed by the new action. In `src/features/pericias/actions.test.ts`, change:

```ts
function periciasQueryBuilder() {
  const builder = {
    select: vi.fn((arg: string) => {
      periciasSelectCalls.push(arg);
      return builder;
    }),
    order: mockOrder,
    eq: vi.fn((column: string, value: unknown) => {
      periciasEqCalls.push([column, value]);
      return builder;
    }),
    filter: vi.fn(() => builder),
    gte: vi.fn((column: string, value: unknown) => {
      periciasEqCalls.push([`gte:${column}`, value]);
      return builder;
    }),
    lte: vi.fn((column: string, value: unknown) => {
      periciasEqCalls.push([`lte:${column}`, value]);
      return builder;
    }),
    then: (resolve: (v: typeof periciasQueryResult) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(periciasQueryResult).then(resolve, reject),
  };
  mockOrder.mockImplementation(() => builder);
  return builder;
}
```

to:

```ts
function periciasQueryBuilder() {
  const builder = {
    select: vi.fn((arg: string) => {
      periciasSelectCalls.push(arg);
      return builder;
    }),
    order: mockOrder,
    eq: vi.fn((column: string, value: unknown) => {
      periciasEqCalls.push([column, value]);
      return builder;
    }),
    filter: vi.fn(() => builder),
    gte: vi.fn((column: string, value: unknown) => {
      periciasEqCalls.push([`gte:${column}`, value]);
      return builder;
    }),
    lte: vi.fn((column: string, value: unknown) => {
      periciasEqCalls.push([`lte:${column}`, value]);
      return builder;
    }),
    not: vi.fn((column: string, operator: string, value: unknown) => {
      periciasEqCalls.push([`not:${column}:${operator}`, value]);
      return builder;
    }),
    neq: vi.fn((column: string, value: unknown) => {
      periciasEqCalls.push([`neq:${column}`, value]);
      return builder;
    }),
    then: (resolve: (v: typeof periciasQueryResult) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(periciasQueryResult).then(resolve, reject),
  };
  mockOrder.mockImplementation(() => builder);
  return builder;
}
```

- [ ] **Step 2: Write the failing tests**

Add to `src/features/pericias/actions.test.ts` — first add `getColaboradoresIndisponiveis` to the existing import on line 2:

```ts
import { createPericia, listPericias, updatePericia, deletePericia, getColaboradoresIndisponiveis } from './actions';
```

Then append this new `describe` block at the end of the file:

```ts
describe('getColaboradoresIndisponiveis', () => {
  it('returns the colaborador ids already booked at that exact date and time', async () => {
    periciasQueryResult = { data: [{ colaborador_id: 2 }, { colaborador_id: 5 }], error: null };

    const result = await getColaboradoresIndisponiveis('2026-08-10', '14:00');

    expect(result).toEqual([2, 5]);
    expect(periciasEqCalls).toContainEqual(['data_agendada', '2026-08-10']);
    expect(periciasEqCalls).toContainEqual(['hora_agendada', '14:00']);
    expect(periciasEqCalls).toContainEqual(['not:colaborador_id:is', null]);
  });

  it('excludes the given pericia id when editing', async () => {
    periciasQueryResult = { data: [], error: null };

    await getColaboradoresIndisponiveis('2026-08-10', '14:00', 7);

    expect(periciasEqCalls).toContainEqual(['neq:id', 7]);
  });

  it('does not filter by id when no exclude id is given', async () => {
    periciasQueryResult = { data: [], error: null };

    await getColaboradoresIndisponiveis('2026-08-10', '14:00');

    expect(periciasEqCalls.some(([col]) => col === 'neq:id')).toBe(false);
  });

  it('returns an empty array when nobody is booked', async () => {
    periciasQueryResult = { data: [], error: null };

    const result = await getColaboradoresIndisponiveis('2026-08-10', '14:00');

    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/features/pericias/actions.test.ts`
Expected: FAIL — `getColaboradoresIndisponiveis` is not exported yet.

- [ ] **Step 4: Add the server action**

Add to `src/features/pericias/actions.ts`, after `deletePericia` (after line 173):

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

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/pericias/actions.test.ts`
Expected: PASS, all tests (existing + 4 new).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/pericias/actions.ts src/features/pericias/actions.test.ts
git commit -m "feat: add getColaboradoresIndisponiveis server action"
```

---

### Task 2: Reactive conflict check in `PericiaForm`

**Files:**
- Modify: `src/features/pericias/components/pericia-form.tsx`
- Modify: `src/features/pericias/components/pericia-form.test.tsx`

**Interfaces:**
- Consumes: `getColaboradoresIndisponiveis(dataAgendada, horaAgendada, excludePericiaId?): Promise<number[]>` (Task 1).
- Produces: no new exports — this task only changes `PericiaForm`'s internal behavior. Its DOM contract for tests: a `<p>` with the exact text `Este colaborador já está atribuído a outra perícia nesse mesmo dia e horário.` appears when there's a conflict; the "Salvar perícia" button gains `disabled` in that state.

- [ ] **Step 1: Write the failing tests**

Add to `src/features/pericias/components/pericia-form.test.tsx` — first add the new mock to the existing `vi.mock('../actions', ...)` block (currently lines 8-11):

```ts
vi.mock('../actions', () => ({
  createPericia: vi.fn(async () => ({ success: true, data: { id: 5 } })),
  updatePericia: vi.fn(async () => ({ success: true, data: { id: 5 } })),
  getColaboradoresIndisponiveis: vi.fn(async () => []),
}));
```

Then add this import near the top (after the existing imports, to access the mock directly in tests):

```ts
import { getColaboradoresIndisponiveis } from '../actions';
```

Then append these tests inside the existing `describe('PericiaForm', ...)` block (after the last existing `it`, before the closing `});`):

```ts
  it('dims a colaborador already booked at the selected date/time but keeps it clickable, and blocks save if chosen', async () => {
    vi.mocked(getColaboradoresIndisponiveis).mockResolvedValue([2]);
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <PericiaForm
        peritos={[{ id: 1, nome: 'Carlos' }]}
        colaboradores={[{ id: 2, nome: 'Bruna' }, { id: 3, nome: 'Duda' }]}
        onSaved={onSaved}
        onError={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText('Data agendada'), '2026-08-10');
    await user.type(screen.getByLabelText('Hora agendada'), '14:00');
    await new Promise((r) => setTimeout(r, 350));

    expect(getColaboradoresIndisponiveis).toHaveBeenCalledWith('2026-08-10', '14:00', undefined);

    await user.click(screen.getByRole('combobox', { name: /colaborador/i }));
    const busyOption = await screen.findByRole('option', { name: 'Bruna' });
    expect(busyOption.className).toMatch(/opacity-40/);
    await user.click(busyOption);

    expect(
      await screen.findByText('Este colaborador já está atribuído a outra perícia nesse mesmo dia e horário.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar perícia/i })).toBeDisabled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('does not restrict the colaborador select when no date/time is set', async () => {
    const user = userEvent.setup();
    render(
      <PericiaForm
        peritos={[{ id: 1, nome: 'Carlos' }]}
        colaboradores={[{ id: 2, nome: 'Bruna' }]}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />
    );

    await user.click(screen.getByRole('combobox', { name: /colaborador/i }));
    const option = await screen.findByRole('option', { name: 'Bruna' });
    expect(option.className ?? '').not.toMatch(/opacity-40/);

    expect(getColaboradoresIndisponiveis).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /salvar perícia/i })).not.toBeDisabled();
  });

  it('flags the conflict retroactively when a date/time is filled in after a colaborador was already selected', async () => {
    vi.mocked(getColaboradoresIndisponiveis).mockResolvedValue([2]);
    const user = userEvent.setup();
    render(
      <PericiaForm
        peritos={[{ id: 1, nome: 'Carlos' }]}
        colaboradores={[{ id: 2, nome: 'Bruna' }]}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />
    );

    await user.click(screen.getByRole('combobox', { name: /colaborador/i }));
    await user.click(await screen.findByText('Bruna'));
    expect(screen.getByRole('button', { name: /salvar perícia/i })).not.toBeDisabled();

    await user.type(screen.getByLabelText('Data agendada'), '2026-08-10');
    await user.type(screen.getByLabelText('Hora agendada'), '14:00');
    await new Promise((r) => setTimeout(r, 350));

    expect(
      await screen.findByText('Este colaborador já está atribuído a outra perícia nesse mesmo dia e horário.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar perícia/i })).toBeDisabled();
  });

  it('clears the conflict and re-enables save when the date is cleared', async () => {
    vi.mocked(getColaboradoresIndisponiveis).mockResolvedValue([2]);
    const user = userEvent.setup();
    render(
      <PericiaForm
        peritos={[{ id: 1, nome: 'Carlos' }]}
        colaboradores={[{ id: 2, nome: 'Bruna' }]}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText('Data agendada'), '2026-08-10');
    await user.type(screen.getByLabelText('Hora agendada'), '14:00');
    await new Promise((r) => setTimeout(r, 350));
    await user.click(screen.getByRole('combobox', { name: /colaborador/i }));
    await user.click(await screen.findByText('Bruna'));
    expect(screen.getByRole('button', { name: /salvar perícia/i })).toBeDisabled();

    await user.clear(screen.getByLabelText('Data agendada'));

    expect(
      screen.queryByText('Este colaborador já está atribuído a outra perícia nesse mesmo dia e horário.')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar perícia/i })).not.toBeDisabled();
  });

  it('passes the pericia id to exclude itself from the conflict check when editing', async () => {
    vi.mocked(getColaboradoresIndisponiveis).mockResolvedValue([]);
    render(
      <PericiaForm
        pericia={{
          id: 9,
          processoId: 1,
          municipioId: 3550308,
          peritoId: 1,
          colaboradorId: 2,
          dataAgendada: '2026-08-10',
          horaAgendada: '14:00',
          situacao: 'marcada',
          processo: { id: 1, numero: 'P-1', autor: 'A', reu: 'B' },
          municipio: { id: 3550308, nome: 'São Paulo', uf: 'SP' },
        }}
        peritos={[{ id: 1, nome: 'Carlos' }]}
        colaboradores={[{ id: 2, nome: 'Bruna' }]}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />
    );

    await new Promise((r) => setTimeout(r, 350));

    expect(getColaboradoresIndisponiveis).toHaveBeenCalledWith('2026-08-10', '14:00', 9);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/pericias/components/pericia-form.test.tsx`
Expected: FAIL — `getColaboradoresIndisponiveis` is never called, no dimming/message/disable logic exists yet.

- [ ] **Step 3: Add the reactive conflict check to `PericiaForm`**

In `src/features/pericias/components/pericia-form.tsx`, add to the imports (after the existing `import { createPericia, updatePericia } from '../actions';` on line 11):

```ts
import { useEffect, useState } from 'react';
```

(replacing the existing `import { useState } from 'react';` on line 3 with `import { useEffect, useState } from 'react';`), and add:

```ts
import { createPericia, updatePericia, getColaboradoresIndisponiveis } from '../actions';
```

(replacing the existing line 11).

Add this state after the existing `const [saving, setSaving] = useState(false);` (line 41):

```ts
  const [busyColaboradorIds, setBusyColaboradorIds] = useState<number[]>([]);
```

Add this effect after the state declarations, before `const peritoItems = ...` (line 43):

```ts
  useEffect(() => {
    if (!dataAgendada || !horaAgendada) {
      setBusyColaboradorIds([]);
      return;
    }
    const handle = setTimeout(() => {
      getColaboradoresIndisponiveis(dataAgendada, horaAgendada, pericia?.id).then(setBusyColaboradorIds);
    }, 300);
    return () => clearTimeout(handle);
  }, [dataAgendada, horaAgendada, pericia?.id]);

  const colaboradorConflict = colaboradorId !== '' && busyColaboradorIds.includes(Number(colaboradorId));
```

Change `handleSubmit` (currently starting at line 46) to check the conflict first — replace:

```ts
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!processo || !municipio || !peritoId) {
      onError('Preencha processo, município e perito.');
      return;
    }
```

with:

```ts
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!processo || !municipio || !peritoId) {
      onError('Preencha processo, município e perito.');
      return;
    }
    if (colaboradorConflict) {
      onError('Este colaborador já está atribuído a outra perícia nesse mesmo dia e horário.');
      return;
    }
```

Change the Colaborador `Select` block (currently lines 106-121) — replace:

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

with:

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
              <SelectItem
                key={c.id}
                value={String(c.id)}
                className={busyColaboradorIds.includes(c.id) ? 'opacity-40' : undefined}
              >
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {colaboradorConflict && (
          <p className="text-sm text-destructive">
            Este colaborador já está atribuído a outra perícia nesse mesmo dia e horário.
          </p>
        )}
      </div>
```

Change the Save button (currently line 135) — replace:

```tsx
      <Button type="submit" disabled={saving} className="w-full">
```

with:

```tsx
      <Button type="submit" disabled={saving || colaboradorConflict} className="w-full">
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/pericias/components/pericia-form.test.tsx`
Expected: PASS, all tests (existing 4 + 5 new).

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all tests pass, no new type errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/pericias/components/pericia-form.tsx src/features/pericias/components/pericia-form.test.tsx
git commit -m "feat: block scheduling a colaborador already booked at the same date/time"
```

---

## Manual verification (after both tasks)

Automated tests exercise the logic against mocks. After Task 2 is committed:

1. Run `npm run dev`, open the Perícias screen, create a Perícia with a Colaborador and a Data/Hora.
2. Create a second Perícia, pick the same Data/Hora — confirm that Colaborador's option in the select looks visually dimmed (light gray) but is still clickable.
3. Click it anyway — confirm the red message appears and "Salvar perícia" is disabled.
4. Change the Colaborador to a different, non-conflicting one — confirm the message disappears and Save re-enables.
5. Re-select the conflicting Colaborador, then clear the Data field — confirm the message disappears and Save re-enables (no date means no restriction).
6. Edit the FIRST Perícia (the one that originally owns that date/time/colaborador) — confirm it does NOT flag a conflict with itself.
