# Calendário de Perícias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new `/calendario` screen showing every scheduled Perícia as a colored card on a Month/Week/Day calendar, with click-to-edit and drag-to-reschedule (respecting the existing colaborador-conflict rule), plus a side list of unscheduled Perícias that can be dragged onto the calendar.

**Architecture:** `FullCalendar` (pinned to the last mutually-compatible `6.1.21` release across all its packages — see Global Constraints) renders a controlled `events` array derived from `listPericias()`. All mutations (drag-drop, "Não agendadas" drop) go through the existing `updatePericia` action followed by `router.refresh()`, matching this codebase's established mutation pattern — no new local optimistic state is introduced. Click-to-edit reuses the existing `PericiaForm` dialog verbatim.

**Tech Stack:** Next.js 16 App Router + React 19, `@fullcalendar/react` + `@fullcalendar/core` + `@fullcalendar/daygrid` + `@fullcalendar/timegrid` + `@fullcalendar/interaction` (new dependencies, all pinned `6.1.21`), Vitest/RTL.

## Global Constraints

- **Exact pinned versions, not ranges:** `@fullcalendar/react@6.1.21`, `@fullcalendar/core@6.1.21`, `@fullcalendar/daygrid@6.1.21`, `@fullcalendar/timegrid@6.1.21`, `@fullcalendar/interaction@6.1.21`. Verified directly against the published npm registry before writing this plan: `@fullcalendar/react`'s newest version (`7.0.2`) requires `@fullcalendar/core@^7`, but `@fullcalendar/daygrid`/`@fullcalendar/timegrid`/`@fullcalendar/interaction` have no GA release past `6.1.21` (their `7.x` line is still `beta`/`rc`) — installing "latest" of everything produces an unusable peer-dependency mismatch. `6.1.21` is the newest version where all five packages' peer dependencies line up cleanly (confirmed via `npm view <pkg>@6.1.21 peerDependencies` for each). Do not `npm install` these without an explicit version pin.
- Every server action call in this plan reuses EXISTING actions (`listPericias`, `updatePericia`, `getPericiaForEdit`, `getColaboradoresIndisponiveis`, `listPeritosOptions`, `listColaboradoresOptions`) — this plan adds zero new server actions and zero new database migrations.
- After any successful mutation (drag-drop reschedule), call `router.refresh()` and let the server component re-fetch — do not introduce local optimistic `items` state. This matches the existing convention in `src/features/pericias/components/pericias-screen.tsx` (`handleSaved`/`handleDelete` both just call `router.refresh()`).
- `FullCalendar` event `start` values must be read/written using LOCAL date/time getters (`date.getFullYear()`/`getMonth()`/`getDate()`/`getHours()`/`getMinutes()`), never `Date.prototype.toISOString()` — `toISOString()` converts to UTC and would silently shift the scheduled date/hour by the browser's timezone offset. Two small pure helpers (`formatDateLocal`/`formatTimeLocal`) in Task 1 centralize this so no task re-implements it incorrectly.
- Conflict-check-on-drag reuses `getColaboradoresIndisponiveis` from the already-merged colaborador-conflict-validation package (`src/features/pericias/actions.ts`) — do not duplicate this query.
- The conflict message on a blocked drag is `'Não é possível mover: o colaborador já está em outra perícia nesse dia e horário.'` (per the design spec) — different wording from the form's own conflict message, since this is a drag-specific action being rejected, not a save being blocked.

---

### Task 1: FullCalendar skeleton — month view, read-only, colored by situação

**Files:**
- Modify: `package.json` / `package-lock.json` (new pinned dependencies)
- Create: `src/features/pericias/lib/calendario-mapping.ts`
- Create: `src/features/pericias/lib/calendario-mapping.test.ts`
- Create: `src/features/pericias/components/calendario-screen.tsx`
- Create: `src/features/pericias/components/calendario-screen.test.tsx`
- Create: `src/app/(app)/calendario/page.tsx`
- Modify: `src/components/shared/sidebar.tsx`

**Interfaces:**
- Consumes: `PericiaListItem` and `listPericias()` from `../actions` (unchanged, existing).
- Produces: `periciaToEvent(item: PericiaListItem): CalendarEvent`, `splitAgendadasNaoAgendadas(items: PericiaListItem[]): { events: CalendarEvent[]; unscheduled: PericiaListItem[] }`, `formatDateLocal(date: Date): string`, `formatTimeLocal(date: Date): string` — all from `calendario-mapping.ts`, consumed by Tasks 2-5. `CalendarioScreen({ items, peritos, colaboradores, getPericiaForEdit }: {...})` — consumed/extended by Tasks 2-5.

- [ ] **Step 1: Install the pinned dependencies**

Run: `npm install @fullcalendar/react@6.1.21 @fullcalendar/core@6.1.21 @fullcalendar/daygrid@6.1.21 @fullcalendar/timegrid@6.1.21 @fullcalendar/interaction@6.1.21`
Expected: `package.json`/`package-lock.json` updated with these 5 packages at exactly `6.1.21`, no peer-dependency warnings printed.

- [ ] **Step 2: Write the failing tests for the mapping utility**

Create `src/features/pericias/lib/calendario-mapping.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { periciaToEvent, splitAgendadasNaoAgendadas, formatDateLocal, formatTimeLocal } from './calendario-mapping';
import type { PericiaListItem } from '../actions';

const scheduled: PericiaListItem = {
  id: 1,
  dataAgendada: '2026-09-20',
  horaAgendada: '10:00',
  situacao: 'marcada',
  processo: { id: 5, numero: '0001234-56.2026', autor: 'Autor X', reu: 'Réu Y' },
  municipio: { id: 3, nome: 'Belo Horizonte', uf: 'MG' },
  perito: {
    id: 7, nome: 'Cleber', contato: '', formacao: '', crea: '',
    jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo',
  },
  colaborador: null,
};

describe('periciaToEvent', () => {
  it('maps a scheduled pericia to a FullCalendar event colored by situação', () => {
    expect(periciaToEvent(scheduled)).toEqual({
      id: '1',
      title: '0001234-56.2026 — Cleber',
      start: '2026-09-20T10:00',
      backgroundColor: 'var(--status-marcada)',
      borderColor: 'var(--status-marcada)',
    });
  });

  it('uses a different color per situação', () => {
    expect(periciaToEvent({ ...scheduled, situacao: 'cancelada' }).backgroundColor).toBe('var(--status-cancelada)');
  });
});

describe('splitAgendadasNaoAgendadas', () => {
  it('puts pericias with both data and hora into events, leaves the rest unscheduled', () => {
    const semData: PericiaListItem = { ...scheduled, id: 2, dataAgendada: null, horaAgendada: null };
    const { events, unscheduled } = splitAgendadasNaoAgendadas([scheduled, semData]);
    expect(events).toEqual([periciaToEvent(scheduled)]);
    expect(unscheduled).toEqual([semData]);
  });

  it('treats a pericia with only data or only hora as unscheduled', () => {
    const soData: PericiaListItem = { ...scheduled, id: 3, horaAgendada: null };
    const { events, unscheduled } = splitAgendadasNaoAgendadas([soData]);
    expect(events).toEqual([]);
    expect(unscheduled).toEqual([soData]);
  });
});

describe('formatDateLocal / formatTimeLocal', () => {
  it('formats using local getters, not UTC', () => {
    const date = new Date(2026, 8, 20, 9, 5); // month is 0-indexed: September 20, 2026, 09:05 local
    expect(formatDateLocal(date)).toBe('2026-09-20');
    expect(formatTimeLocal(date)).toBe('09:05');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/features/pericias/lib/calendario-mapping.test.ts`
Expected: FAIL — `./calendario-mapping` does not exist.

- [ ] **Step 4: Write the mapping utility**

Create `src/features/pericias/lib/calendario-mapping.ts`:

```ts
import type { PericiaListItem } from '../actions';

const SITUACAO_COLORS: Record<PericiaListItem['situacao'], string> = {
  pendente: 'var(--status-pendente)',
  marcada: 'var(--status-marcada)',
  realizada: 'var(--status-realizada)',
  cancelada: 'var(--status-cancelada)',
};

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  backgroundColor: string;
  borderColor: string;
};

export function periciaToEvent(item: PericiaListItem): CalendarEvent {
  const color = SITUACAO_COLORS[item.situacao];
  return {
    id: String(item.id),
    title: `${item.processo.numero} — ${item.perito.nome}`,
    start: `${item.dataAgendada}T${item.horaAgendada}`,
    backgroundColor: color,
    borderColor: color,
  };
}

export function splitAgendadasNaoAgendadas(items: PericiaListItem[]): {
  events: CalendarEvent[];
  unscheduled: PericiaListItem[];
} {
  const events: CalendarEvent[] = [];
  const unscheduled: PericiaListItem[] = [];
  for (const item of items) {
    if (item.dataAgendada && item.horaAgendada) {
      events.push(periciaToEvent(item));
    } else {
      unscheduled.push(item);
    }
  }
  return { events, unscheduled };
}

export function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatTimeLocal(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}
```

The color values reuse the exact CSS custom properties `src/components/shared/status-badge.tsx` already reads (`STYLES`/`LABELS` there use the same `--status-*` variables) — this file does not import `status-badge.tsx` (that component also carries badge-specific opacity/text-color styling not relevant here), it re-derives its own `SITUACAO_COLORS` map from the same underlying CSS variables, which is the actual point of visual consistency (same color identity per situação, not shared component code).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/pericias/lib/calendario-mapping.test.ts`
Expected: PASS, all tests.

- [ ] **Step 6: Write the failing test for the screen component**

Create `src/features/pericias/components/calendario-screen.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CalendarioScreen } from './calendario-screen';
import type { PericiaListItem } from '../actions';

type CapturedProps = { events?: unknown[]; initialView?: string; plugins?: unknown[] };
const captured: { props: CapturedProps | null } = { props: null };

vi.mock('@fullcalendar/react', () => ({
  default: (props: CapturedProps) => {
    captured.props = props;
    return <div data-testid="fullcalendar-mock" />;
  },
}));
vi.mock('@fullcalendar/daygrid', () => ({ default: {} }));

const scheduled: PericiaListItem = {
  id: 1,
  dataAgendada: '2026-09-20',
  horaAgendada: '10:00',
  situacao: 'marcada',
  processo: { id: 5, numero: '0001234-56.2026', autor: 'Autor X', reu: 'Réu Y' },
  municipio: { id: 3, nome: 'Belo Horizonte', uf: 'MG' },
  perito: {
    id: 7, nome: 'Cleber', contato: '', formacao: '', crea: '',
    jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo',
  },
  colaborador: null,
};

describe('CalendarioScreen', () => {
  it('passes the scheduled pericias as FullCalendar events, starting in month view', () => {
    render(<CalendarioScreen items={[scheduled]} />);

    expect(captured.props?.initialView).toBe('dayGridMonth');
    expect(captured.props?.events).toEqual([
      {
        id: '1',
        title: '0001234-56.2026 — Cleber',
        start: '2026-09-20T10:00',
        backgroundColor: 'var(--status-marcada)',
        borderColor: 'var(--status-marcada)',
      },
    ]);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run src/features/pericias/components/calendario-screen.test.tsx`
Expected: FAIL — `./calendario-screen` does not exist.

- [ ] **Step 8: Write `CalendarioScreen`**

Create `src/features/pericias/components/calendario-screen.tsx`:

```tsx
'use client';

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import type { PericiaListItem } from '../actions';
import { splitAgendadasNaoAgendadas } from '../lib/calendario-mapping';

export function CalendarioScreen({ items }: { items: PericiaListItem[] }) {
  const { events } = splitAgendadasNaoAgendadas(items);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Calendário</h1>
      <FullCalendar
        plugins={[dayGridPlugin]}
        initialView="dayGridMonth"
        events={events}
        height="auto"
      />
    </div>
  );
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run src/features/pericias/components/calendario-screen.test.tsx`
Expected: PASS.

- [ ] **Step 10: Create the page**

Create `src/app/(app)/calendario/page.tsx`:

```tsx
import { listPericias } from '@/features/pericias/actions';
import { CalendarioScreen } from '@/features/pericias/components/calendario-screen';

export default async function CalendarioPage() {
  const items = await listPericias();
  return <CalendarioScreen items={items} />;
}
```

- [ ] **Step 11: Add the nav item**

In `src/components/shared/sidebar.tsx`, add `CalendarDays` to the `lucide-react` import (alongside `ClipboardList, Folder, UserCheck, Users, ShieldCheck, UserCog, PanelLeftClose, PanelLeftOpen, LogOut`), and insert a new entry into `NAV_ITEMS` right after the `/` (Perícias) entry, before `/processos`:

```ts
  { href: '/', label: 'Perícias', roles: ['admin', 'gerencia'], icon: ClipboardList },
  { href: '/calendario', label: 'Calendário', roles: ['admin', 'gerencia'], icon: CalendarDays },
  { href: '/processos', label: 'Processos', roles: ['admin', 'gerencia'], icon: Folder },
```

- [ ] **Step 12: Full suite, typecheck, lint, and build**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src && npm run build`
Expected: all tests pass, no new type errors, zero eslint errors, build succeeds (confirms FullCalendar's ESM/CJS packaging bundles cleanly under Next.js 16 + Turbopack — this is the one real integration-risk check in this task, since this is the first time this library is used in this project).

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json src/features/pericias/lib/calendario-mapping.ts src/features/pericias/lib/calendario-mapping.test.ts src/features/pericias/components/calendario-screen.tsx src/features/pericias/components/calendario-screen.test.tsx "src/app/(app)/calendario/page.tsx" src/components/shared/sidebar.tsx
git commit -m "feat: add read-only month-view Perícias calendar"
```

---

### Task 2: Não agendadas side list + click-to-edit

**Files:**
- Modify: `src/features/pericias/components/calendario-screen.tsx`
- Modify: `src/features/pericias/components/calendario-screen.test.tsx`
- Modify: `src/app/(app)/calendario/page.tsx`

**Interfaces:**
- Consumes: `splitAgendadasNaoAgendadas` (Task 1, now also used for its `unscheduled` half); `PericiaForm`, `getPericiaForEdit` — both already exist and are already used by `PericiasScreen` in exactly this shape.
- Produces: `CalendarioScreen` now also accepts `peritos`, `colaboradores`, `getPericiaForEdit` props (extending Task 1's signature). Consumed by Task 3 (drag source for the side list) and unchanged by Tasks 4-5.

- [ ] **Step 1: Write the failing tests**

Add to `src/features/pericias/components/calendario-screen.test.tsx` — first extend the fixture list and add mocks for `PericiaForm`'s dependencies (following the exact pattern already used in `pericias-screen.test.tsx`: a `getPericiaForEdit` prop passed in as a plain async function, not mocked via `vi.mock`, since `PericiasScreen` already establishes this as a prop-injection pattern rather than a module mock):

```tsx
  it('shows unscheduled pericias in a side list', () => {
    const unscheduled: PericiaListItem = { ...scheduled, id: 2, dataAgendada: null, horaAgendada: null };
    render(
      <CalendarioScreen
        items={[scheduled, unscheduled]}
        peritos={[{ id: 7, nome: 'Cleber' }]}
        colaboradores={[]}
        getPericiaForEdit={vi.fn()}
      />
    );

    expect(screen.getByText('Não agendadas')).toBeInTheDocument();
    expect(screen.getByText(/0001234-56.2026/)).toBeInTheDocument();
  });

  it('opens the edit dialog with the right data when a não-agendada item is clicked', async () => {
    const unscheduled: PericiaListItem = { ...scheduled, id: 2, dataAgendada: null, horaAgendada: null };
    const getPericiaForEdit = vi.fn(async () => ({
      id: 2,
      processoId: 5,
      municipioId: 3,
      peritoId: 7,
      colaboradorId: null,
      dataAgendada: null,
      horaAgendada: null,
      situacao: 'pendente' as const,
      processo: { id: 5, numero: '0001234-56.2026', autor: 'Autor X', reu: 'Réu Y' },
      municipio: { id: 3, nome: 'Belo Horizonte', uf: 'MG' },
    }));
    const user = userEvent.setup();
    render(
      <CalendarioScreen
        items={[unscheduled]}
        peritos={[{ id: 7, nome: 'Cleber' }]}
        colaboradores={[]}
        getPericiaForEdit={getPericiaForEdit}
      />
    );

    await user.click(screen.getByText(/0001234-56.2026/));

    expect(getPericiaForEdit).toHaveBeenCalledWith(2);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Editar perícia' })).toBeInTheDocument();
  });
```

Add the necessary imports at the top of the test file: `screen` alongside the existing `render` import from `@testing-library/react`, and `import userEvent from '@testing-library/user-event';`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/pericias/components/calendario-screen.test.tsx`
Expected: FAIL — `CalendarioScreen` doesn't yet render a side list, accept the new props, or open any dialog.

- [ ] **Step 3: Extend `CalendarioScreen`**

Replace `src/features/pericias/components/calendario-screen.tsx` entirely with:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PericiaForm } from './pericia-form';
import type { PericiaListItem } from '../actions';
import type { Processo } from '@/features/processos/actions';
import type { MunicipioIBGE } from '@/lib/ibge/client';
import type { PericiaInput } from '../schemas';
import { splitAgendadasNaoAgendadas } from '../lib/calendario-mapping';

type PeritoOption = { id: number; nome: string };
type ColaboradorOption = { id: number; nome: string };
type EditingPericia = PericiaInput & { id: number; processo: Processo; municipio: MunicipioIBGE };

export function CalendarioScreen({
  items,
  peritos,
  colaboradores,
  getPericiaForEdit,
}: {
  items: PericiaListItem[];
  peritos: PeritoOption[];
  colaboradores: ColaboradorOption[];
  getPericiaForEdit: (id: number) => Promise<EditingPericia | null>;
}) {
  const router = useRouter();
  const { events, unscheduled } = splitAgendadasNaoAgendadas(items);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EditingPericia | null>(null);

  async function openEdit(id: number) {
    const full = await getPericiaForEdit(id);
    if (!full) {
      toast.error('Não foi possível carregar essa perícia.');
      return;
    }
    setEditing(full);
    setDialogOpen(true);
  }

  function handleSaved() {
    toast.success('Perícia atualizada');
    setDialogOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Calendário</h1>
      <div className="flex gap-4">
        <div className="w-64 shrink-0 space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Não agendadas</h2>
          <div className="space-y-2">
            {unscheduled.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openEdit(item.id)}
                className="w-full rounded-md border p-2 text-left text-sm hover:bg-accent"
              >
                {item.processo.numero} — {item.perito.nome}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <FullCalendar
            plugins={[dayGridPlugin]}
            initialView="dayGridMonth"
            events={events}
            eventClick={(info) => openEdit(Number(info.event.id))}
            height="auto"
          />
        </div>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar perícia</DialogTitle>
          </DialogHeader>
          {editing && (
            <PericiaForm
              pericia={editing}
              peritos={peritos}
              colaboradores={colaboradores}
              onSaved={handleSaved}
              onError={(message) => toast.error(message)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

Note this dialog is edit-only (no "Nova perícia" path) — the spec's "Fora de escopo" explicitly excludes creating a Perícia from the calendar in this iteration.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/pericias/components/calendario-screen.test.tsx`
Expected: PASS, all tests (Task 1's + the 2 new ones). Task 1's original test still needs `peritos`/`colaboradores`/`getPericiaForEdit` props now — update that test's `render(<CalendarioScreen items={[scheduled]} />)` call to `render(<CalendarioScreen items={[scheduled]} peritos={[]} colaboradores={[]} getPericiaForEdit={vi.fn()} />)`.

- [ ] **Step 5: Update the page to pass the new props**

Replace `src/app/(app)/calendario/page.tsx` entirely with:

```tsx
import { listPericias, getPericiaForEdit } from '@/features/pericias/actions';
import { listPeritosOptions } from '@/features/peritos/actions';
import { listColaboradoresOptions } from '@/features/colaboradores/actions';
import { CalendarioScreen } from '@/features/pericias/components/calendario-screen';

export default async function CalendarioPage() {
  const [items, peritos, colaboradores] = await Promise.all([
    listPericias(),
    listPeritosOptions(),
    listColaboradoresOptions(),
  ]);
  return (
    <CalendarioScreen
      items={items}
      peritos={peritos}
      colaboradores={colaboradores}
      getPericiaForEdit={getPericiaForEdit}
    />
  );
}
```

- [ ] **Step 6: Full suite, typecheck, lint**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all tests pass, no new type errors, zero eslint errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/pericias/components/calendario-screen.tsx src/features/pericias/components/calendario-screen.test.tsx "src/app/(app)/calendario/page.tsx"
git commit -m "feat: add não-agendadas list and click-to-edit to the calendar"
```

---

### Task 3: Drag-to-reschedule with conflict checking

Covers BOTH drag interactions the spec requires: moving an event already on the calendar (`eventDrop`), and dragging a "Não agendadas" item onto the calendar to schedule it for the first time (`Draggable` + `eventReceive`). Both share one conflict-check-then-update function — `EventDropArg` and `EventReceiveArg` both expose the same `{ event: { id, start }, revert: () => void }` shape for what this plan needs from them, so there is exactly one code path to test and trust, not two parallel ones.

**Files:**
- Modify: `src/features/pericias/components/calendario-screen.tsx`
- Modify: `src/features/pericias/components/calendario-screen.test.tsx`

**Interfaces:**
- Consumes: `formatDateLocal`/`formatTimeLocal` (Task 1); `getColaboradoresIndisponiveis`, `updatePericia` from `../actions` (both already exist, already tested, from the merged colaborador-conflict-validation package).
- Produces: no new exports — internal behavior only. Consumed as-is by Tasks 4-5 (neither changes the drag logic).

- [ ] **Step 1: Write the failing tests**

Add to `src/features/pericias/components/calendario-screen.test.tsx`. First add the action mocks near the top of the file (after the existing `@fullcalendar/react`/`@fullcalendar/daygrid` mocks), plus a mock for the `Draggable` class:

```tsx
const mockUpdatePericia = vi.fn();
const mockGetColaboradoresIndisponiveis = vi.fn();
vi.mock('../actions', async () => {
  const actual = await vi.importActual('../actions');
  return {
    ...actual,
    updatePericia: (...args: unknown[]) => mockUpdatePericia(...args),
    getColaboradoresIndisponiveis: (...args: unknown[]) => mockGetColaboradoresIndisponiveis(...args),
  };
});

const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const mockDraggableConstructor = vi.fn();
const mockDraggableDestroy = vi.fn();
vi.mock('@fullcalendar/interaction', () => ({
  default: {},
  Draggable: class {
    constructor(...args: unknown[]) {
      mockDraggableConstructor(...args);
    }
    destroy() {
      mockDraggableDestroy();
    }
  },
}));
```

Then append these tests. Because `EventDropArg` and `EventReceiveArg` share the same `{ event, revert }` shape this plan actually reads, these tests exercise the shared logic once through `eventDrop` and once through `eventReceive` to prove BOTH wiring points reach the same conflict-checked update path, plus one test proving the `Draggable` source is actually registered:

```tsx
  describe('drag-to-reschedule', () => {
    const withColaborador: PericiaListItem = {
      ...scheduled,
      colaborador: { id: 9, nome: 'Ana', contato: '', formacao: '', interno: true },
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('registers a Draggable source for the não-agendadas list on mount', () => {
      render(
        <CalendarioScreen items={[scheduled]} peritos={[]} colaboradores={[]} getPericiaForEdit={vi.fn()} />
      );

      expect(mockDraggableConstructor).toHaveBeenCalledTimes(1);
      const [, settings] = mockDraggableConstructor.mock.calls[0];
      expect(settings.itemSelector).toBe('.calendario-nao-agendada-item');
    });

    it('reverts and shows an error toast when moving an existing event would create a colaborador conflict', async () => {
      mockGetColaboradoresIndisponiveis.mockResolvedValue([9]);
      render(
        <CalendarioScreen
          items={[withColaborador]}
          peritos={[]}
          colaboradores={[]}
          getPericiaForEdit={vi.fn()}
        />
      );

      const revert = vi.fn();
      await captured.eventDrop?.({
        event: { id: '1', start: new Date(2026, 9, 5, 11, 0) },
        revert,
      });

      expect(mockGetColaboradoresIndisponiveis).toHaveBeenCalledWith('2026-10-05', '11:00', 1);
      expect(revert).toHaveBeenCalled();
      expect(mockUpdatePericia).not.toHaveBeenCalled();
    });

    it('updates the pericia and refreshes when moving an existing event has no conflict', async () => {
      mockGetColaboradoresIndisponiveis.mockResolvedValue([]);
      mockUpdatePericia.mockResolvedValue({ success: true, data: { id: 1 } });
      render(
        <CalendarioScreen
          items={[withColaborador]}
          peritos={[]}
          colaboradores={[]}
          getPericiaForEdit={vi.fn()}
        />
      );

      const revert = vi.fn();
      await captured.eventDrop?.({
        event: { id: '1', start: new Date(2026, 9, 5, 11, 0) },
        revert,
      });

      expect(mockUpdatePericia).toHaveBeenCalledWith(1, {
        processoId: 5,
        municipioId: 3,
        peritoId: 7,
        colaboradorId: 9,
        dataAgendada: '2026-10-05',
        horaAgendada: '11:00',
        situacao: 'marcada',
      });
      expect(revert).not.toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();
    });

    it('skips the conflict check entirely when the pericia has no colaborador', async () => {
      mockUpdatePericia.mockResolvedValue({ success: true, data: { id: 1 } });
      render(
        <CalendarioScreen items={[scheduled]} peritos={[]} colaboradores={[]} getPericiaForEdit={vi.fn()} />
      );

      await captured.eventDrop?.({
        event: { id: '1', start: new Date(2026, 9, 5, 11, 0) },
        revert: vi.fn(),
      });

      expect(mockGetColaboradoresIndisponiveis).not.toHaveBeenCalled();
      expect(mockUpdatePericia).toHaveBeenCalled();
    });

    it('reverts a não-agendada drop onto the calendar when it would create a conflict', async () => {
      const semData: PericiaListItem = { ...withColaborador, id: 2, dataAgendada: null, horaAgendada: null };
      mockGetColaboradoresIndisponiveis.mockResolvedValue([9]);
      render(
        <CalendarioScreen items={[semData]} peritos={[]} colaboradores={[]} getPericiaForEdit={vi.fn()} />
      );

      const revert = vi.fn();
      await captured.eventReceive?.({
        event: { id: '2', start: new Date(2026, 9, 5, 11, 0) },
        revert,
      });

      expect(revert).toHaveBeenCalled();
      expect(mockUpdatePericia).not.toHaveBeenCalled();
    });

    it('schedules a não-agendada pericia when dropped onto the calendar with no conflict', async () => {
      const semData: PericiaListItem = { ...scheduled, id: 2, dataAgendada: null, horaAgendada: null };
      mockUpdatePericia.mockResolvedValue({ success: true, data: { id: 2 } });
      render(
        <CalendarioScreen items={[semData]} peritos={[]} colaboradores={[]} getPericiaForEdit={vi.fn()} />
      );

      await captured.eventReceive?.({
        event: { id: '2', start: new Date(2026, 9, 5, 11, 0) },
        revert: vi.fn(),
      });

      expect(mockUpdatePericia).toHaveBeenCalledWith(2, expect.objectContaining({
        dataAgendada: '2026-10-05',
        horaAgendada: '11:00',
      }));
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
```

This test style calls `captured.eventDrop`/`captured.eventReceive` (handler references captured off the mocked `FullCalendar`'s props, the same `captured` object Task 1 already set up) directly with a hand-built `info`-like object, rather than trying to simulate a real drag gesture through jsdom — FullCalendar's real drag interaction is DOM/pointer-event-driven in a way that doesn't reliably simulate in jsdom, so this plan tests the handler FUNCTION directly, the same pragmatic pattern Task 1 already established by mocking `@fullcalendar/react` itself. The real browser drag gesture (including the `Draggable` class's own pointer-tracking internals, which this plan does NOT mock away from reality inside a real browser — only inside these jsdom tests) is covered by this plan's final manual-verification checklist instead. Extend the `CapturedProps` type in the test file to include `eventDrop?: (info: { event: { id: string; start: Date }; revert: () => void }) => void | Promise<void>` and `eventReceive?: (info: { event: { id: string; start: Date }; revert: () => void }) => void | Promise<void>`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/pericias/components/calendario-screen.test.tsx`
Expected: FAIL — no `eventDrop`/`eventReceive` props are passed to `FullCalendar` yet, and no `Draggable` is constructed.

- [ ] **Step 3: Add drag-to-reschedule (both directions)**

In `src/features/pericias/components/calendario-screen.tsx`:

Add to imports:

```ts
import { useEffect, useRef, useState } from 'react';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import { getColaboradoresIndisponiveis, updatePericia } from '../actions';
import { splitAgendadasNaoAgendadas, formatDateLocal, formatTimeLocal } from '../lib/calendario-mapping';
```

(this replaces the existing `import { useState } from 'react';` line with the wider destructure above, since this task adds `useEffect`/`useRef`).

Add a ref for the "não agendadas" container, right after the existing `useState` declarations:

```ts
  const unscheduledContainerRef = useRef<HTMLDivElement>(null);
```

Add this shared handler inside the `CalendarioScreen` function body, before the `return` (both `eventDrop` and `eventReceive` will call it with their own `event`/`revert`):

```ts
  async function handleReschedule(event: { id: string; start: Date | null }, revert: () => void) {
    const id = Number(event.id);
    const item = items.find((i) => i.id === id);
    if (!item || !event.start) {
      revert();
      return;
    }
    const novaData = formatDateLocal(event.start);
    const novaHora = formatTimeLocal(event.start);

    if (item.colaborador) {
      const busyIds = await getColaboradoresIndisponiveis(novaData, novaHora, item.id);
      if (busyIds.includes(item.colaborador.id)) {
        revert();
        toast.error('Não é possível mover: o colaborador já está em outra perícia nesse dia e horário.');
        return;
      }
    }

    const result = await updatePericia(id, {
      processoId: item.processo.id,
      municipioId: item.municipio.id,
      peritoId: item.perito.id,
      colaboradorId: item.colaborador?.id ?? null,
      dataAgendada: novaData,
      horaAgendada: novaHora,
      situacao: item.situacao,
    });
    if (!result.success) {
      revert();
      toast.error(result.error);
      return;
    }
    toast.success('Perícia reagendada');
    router.refresh();
  }
```

Add an effect (also before the `return`) that registers the "não agendadas" list as a drag source once, on mount:

```ts
  useEffect(() => {
    if (!unscheduledContainerRef.current) return;
    const draggable = new Draggable(unscheduledContainerRef.current, {
      itemSelector: '.calendario-nao-agendada-item',
      eventData: (el) => ({
        id: el.dataset.periciaId,
        title: el.dataset.title,
      }),
    });
    return () => draggable.destroy();
  }, []);
```

`Draggable`'s `itemSelector` is re-evaluated by the library against the container's current children every time a drag starts, so this single effect (empty dependency array, registered once) keeps working correctly as `unscheduled` items are added or removed by later renders — it does not need to be re-created per render.

Change the "não agendadas" list markup — replace:

```tsx
        <div className="w-64 shrink-0 space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Não agendadas</h2>
          <div className="space-y-2">
            {unscheduled.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openEdit(item.id)}
                className="w-full rounded-md border p-2 text-left text-sm hover:bg-accent"
              >
                {item.processo.numero} — {item.perito.nome}
              </button>
            ))}
          </div>
        </div>
```

with:

```tsx
        <div className="w-64 shrink-0 space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Não agendadas</h2>
          <div ref={unscheduledContainerRef} className="space-y-2">
            {unscheduled.map((item) => (
              <button
                key={item.id}
                type="button"
                data-pericia-id={item.id}
                data-title={`${item.processo.numero} — ${item.perito.nome}`}
                onClick={() => openEdit(item.id)}
                className="calendario-nao-agendada-item w-full rounded-md border p-2 text-left text-sm hover:bg-accent"
              >
                {item.processo.numero} — {item.perito.nome}
              </button>
            ))}
          </div>
        </div>
```

Change the `FullCalendar` element's `plugins` array from `[dayGridPlugin]` to `[dayGridPlugin, interactionPlugin]`, and add `editable`, `eventDrop`, and `eventReceive`:

```tsx
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            events={events}
            editable
            eventClick={(info) => openEdit(Number(info.event.id))}
            eventDrop={(info) => handleReschedule(info.event, info.revert)}
            eventReceive={(info) => handleReschedule(info.event, info.revert)}
            height="auto"
          />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/pericias/components/calendario-screen.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 5: Full suite, typecheck, lint**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass, no new type errors, zero eslint errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/pericias/components/calendario-screen.tsx src/features/pericias/components/calendario-screen.test.tsx
git commit -m "feat: reschedule pericias by dragging calendar events, respecting colaborador conflicts"
```

---

### Task 4: Week and Day views

**Files:**
- Modify: `src/features/pericias/components/calendario-screen.tsx`
- Modify: `src/features/pericias/components/calendario-screen.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new consumed elsewhere — purely a `FullCalendar` configuration addition.

- [ ] **Step 1: Write the failing test**

Add to `src/features/pericias/components/calendario-screen.test.tsx`:

```tsx
  it('offers month/week/day view buttons in the header toolbar', () => {
    render(
      <CalendarioScreen items={[scheduled]} peritos={[]} colaboradores={[]} getPericiaForEdit={vi.fn()} />
    );

    expect(captured.props?.headerToolbar).toEqual({
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay',
    });
    expect(captured.props?.plugins).toEqual(
      expect.arrayContaining([expect.anything(), expect.anything(), expect.anything()])
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/pericias/components/calendario-screen.test.tsx`
Expected: FAIL — no `headerToolbar` prop is passed yet, and only 2 plugins are registered.

- [ ] **Step 3: Add week/day views**

In `src/features/pericias/components/calendario-screen.tsx`, add to imports:

```ts
import timeGridPlugin from '@fullcalendar/timegrid';
```

Change the `FullCalendar` element's `plugins` array to `[dayGridPlugin, timeGridPlugin, interactionPlugin]`, and add a `headerToolbar` prop:

```tsx
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            events={events}
            editable
            eventClick={(info) => openEdit(Number(info.event.id))}
            eventDrop={(info) => handleReschedule(info.event, info.revert)}
            eventReceive={(info) => handleReschedule(info.event, info.revert)}
            height="auto"
          />
```

No changes needed to `handleReschedule` — as verified against FullCalendar's own documented behavior before writing this plan, dragging an event within `dayGridMonth` preserves its original time-of-day automatically (only the date changes), while dragging within `timeGridWeek`/`timeGridDay` naturally produces a new `info.event.start` with both the new date AND the new time slot — `formatDateLocal`/`formatTimeLocal` already extract whatever `info.event.start` says, so the "month view only changes date, week/day view changes both" requirement from the spec is satisfied by FullCalendar's own view-specific drag mechanics, not by any code this task writes.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/pericias/components/calendario-screen.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 5: Full suite, typecheck, lint**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass, no new type errors, zero eslint errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/pericias/components/calendario-screen.tsx src/features/pericias/components/calendario-screen.test.tsx
git commit -m "feat: add week and day views to the calendar"
```

---

### Task 5: Client-side filters (Situação, Processo, Perito, Colaborador)

**Files:**
- Create: `src/features/pericias/components/calendario-filters.tsx`
- Create: `src/features/pericias/components/calendario-filters.test.tsx`
- Modify: `src/features/pericias/components/calendario-screen.tsx`
- Modify: `src/features/pericias/components/calendario-screen.test.tsx`

**Interfaces:**
- Consumes: `situacaoOptions` from `../schemas` (already exists, already used by `pericia-form.tsx`'s Situação select); `PeritoOption`/`ColaboradorOption` types (already defined inline in `calendario-screen.tsx` from Task 2).
- Produces: `CalendarioFilters` component with an `onChange` callback carrying the current filter values; consumed only by `CalendarioScreen` (leaf of this plan, nothing downstream).

- [ ] **Step 1: Write the failing tests for the filter bar**

Create `src/features/pericias/components/calendario-filters.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { CalendarioFilters } from './calendario-filters';

describe('CalendarioFilters', () => {
  it('reports the busca text as the user types', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CalendarioFilters peritos={[{ id: 1, nome: 'Cleber' }]} colaboradores={[]} onChange={onChange} />
    );

    await user.type(screen.getByLabelText('Processo'), '1234');

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ busca: '1234' })
    );
  });

  it('reports the selected perito id', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CalendarioFilters peritos={[{ id: 1, nome: 'Cleber' }]} colaboradores={[]} onChange={onChange} />
    );

    await user.click(screen.getByRole('combobox', { name: /perito/i }));
    await user.click(await screen.findByRole('option', { name: 'Cleber' }));

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ peritoId: 1 }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/pericias/components/calendario-filters.test.tsx`
Expected: FAIL — `./calendario-filters` does not exist.

- [ ] **Step 3: Write `CalendarioFilters`**

Create `src/features/pericias/components/calendario-filters.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { situacaoOptions, type PericiaInput } from '../schemas';

type PeritoOption = { id: number; nome: string };
type ColaboradorOption = { id: number; nome: string };

export type CalendarioFiltersValue = {
  situacao?: PericiaInput['situacao'];
  busca?: string;
  peritoId?: number;
  colaboradorId?: number;
};

export function CalendarioFilters({
  peritos,
  colaboradores,
  onChange,
}: {
  peritos: PeritoOption[];
  colaboradores: ColaboradorOption[];
  onChange: (value: CalendarioFiltersValue) => void;
}) {
  const [value, setValue] = useState<CalendarioFiltersValue>({});

  function update(patch: Partial<CalendarioFiltersValue>) {
    const next = { ...value, ...patch };
    setValue(next);
    onChange(next);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="calendario-busca">Processo</Label>
        <Input
          id="calendario-busca"
          value={value.busca ?? ''}
          onChange={(e) => update({ busca: e.target.value || undefined })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="calendario-situacao">Situação</Label>
        <Select
          value={value.situacao ?? 'todas'}
          onValueChange={(v) => update({ situacao: v === 'todas' ? undefined : (v as PericiaInput['situacao']) })}
        >
          <SelectTrigger id="calendario-situacao" className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            {situacaoOptions.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="calendario-perito">Perito</Label>
        <Select
          items={{ todos: 'Todos', ...Object.fromEntries(peritos.map((p) => [String(p.id), p.nome])) }}
          value={value.peritoId ? String(value.peritoId) : 'todos'}
          onValueChange={(v) => update({ peritoId: !v || v === 'todos' ? undefined : Number(v) })}
        >
          <SelectTrigger id="calendario-perito" className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {peritos.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="calendario-colaborador">Colaborador</Label>
        <Select
          items={{ todos: 'Todos', ...Object.fromEntries(colaboradores.map((c) => [String(c.id), c.nome])) }}
          value={value.colaboradorId ? String(value.colaboradorId) : 'todos'}
          onValueChange={(v) => update({ colaboradorId: !v || v === 'todos' ? undefined : Number(v) })}
        >
          <SelectTrigger id="calendario-colaborador" className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {colaboradores.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/pericias/components/calendario-filters.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the failing test for filtering applied to the calendar**

Add to `src/features/pericias/components/calendario-screen.test.tsx`:

```tsx
  it('reduces both the calendar events and the não-agendadas list when a filter is applied', async () => {
    const other: PericiaListItem = {
      ...scheduled,
      id: 2,
      dataAgendada: null,
      horaAgendada: null,
      perito: { ...scheduled.perito, id: 8, nome: 'Outro Perito' },
    };
    const user = userEvent.setup();
    render(
      <CalendarioScreen
        items={[scheduled, other]}
        peritos={[{ id: 7, nome: 'Cleber' }, { id: 8, nome: 'Outro Perito' }]}
        colaboradores={[]}
        getPericiaForEdit={vi.fn()}
      />
    );

    expect(captured.props?.events).toHaveLength(1);
    expect(screen.getByText(/Outro Perito/)).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: /perito/i }));
    await user.click(await screen.findByRole('option', { name: 'Cleber' }));

    expect(captured.props?.events).toHaveLength(1);
    expect(screen.queryByText(/Outro Perito/)).not.toBeInTheDocument();
  });
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/features/pericias/components/calendario-screen.test.tsx`
Expected: FAIL — `CalendarioScreen` doesn't render `CalendarioFilters` or apply any filtering yet.

- [ ] **Step 7: Wire filtering into `CalendarioScreen`**

In `src/features/pericias/components/calendario-screen.tsx`, add to imports:

```ts
import { CalendarioFilters, type CalendarioFiltersValue } from './calendario-filters';
```

Add state and a filtering step inside the component body, replacing the line `const { events, unscheduled } = splitAgendadasNaoAgendadas(items);` with:

```ts
  const [filters, setFilters] = useState<CalendarioFiltersValue>({});
  const filteredItems = items.filter((item) => {
    if (filters.situacao && item.situacao !== filters.situacao) return false;
    if (filters.busca && !item.processo.numero.toLowerCase().includes(filters.busca.toLowerCase())) return false;
    if (filters.peritoId && item.perito.id !== filters.peritoId) return false;
    if (filters.colaboradorId && item.colaborador?.id !== filters.colaboradorId) return false;
    return true;
  });
  const { events, unscheduled } = splitAgendadasNaoAgendadas(filteredItems);
```

Add `<CalendarioFilters peritos={peritos} colaboradores={colaboradores} onChange={setFilters} />` right after the `<h1>Calendário</h1>` line, before the `<div className="flex gap-4">` wrapper.

Note `handleReschedule` still looks up the dragged pericia via `items.find(...)` (the full unfiltered list), not `filteredItems` — a pericia currently hidden by a filter should never be reachable to drag in the first place (it's not rendered), so this is a non-issue in practice, but keeping the lookup against the full `items` array is the more defensive, obviously-correct choice — do not change that line.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/features/pericias/components/calendario-screen.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 9: Full suite, typecheck, lint, and build**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src && npm run build`
Expected: all pass, no new type errors, zero eslint errors, build succeeds.

- [ ] **Step 10: Commit**

```bash
git add src/features/pericias/components/calendario-filters.tsx src/features/pericias/components/calendario-filters.test.tsx src/features/pericias/components/calendario-screen.tsx src/features/pericias/components/calendario-screen.test.tsx
git commit -m "feat: add client-side filters to the calendar"
```

---

## Manual verification (after all 5 tasks)

Automated tests mock `@fullcalendar/react` entirely (necessary — real drag gestures don't simulate reliably in jsdom) and never render the real calendar library, so none of them prove FullCalendar itself actually renders, styles, or drags correctly in a real browser. After Task 5 is committed:

1. Run `npm run dev`, open `/calendario`. Confirm the sidebar shows "Calendário" between "Perícias" and "Processos", and the page shows a real month grid with colored event cards matching each Perícia's situação color from the main list.
2. Confirm the "Não agendadas" list shows every Perícia with no date/hora set.
3. Click a calendar event → confirm the edit dialog opens pre-filled correctly; click a "Não agendadas" item → same.
4. Drag a calendar event to a different day (month view) → confirm it updates, a success toast appears, and reloading the page shows the new date with the SAME time it had before.
5. Create two Perícias with the same colaborador at different times, then drag one on top of the other's exact date+time in month view → confirm it snaps back with the conflict error toast and nothing is saved (check by reloading).
6. Switch to Week view, then Day view, using the header toolbar buttons → confirm both render and the same click/drag behavior still works, and dragging within Week/Day view changes the time, not just the date.
7. Apply each filter (Situação, Processo, Perito, Colaborador) one at a time → confirm both the calendar events and the "Não agendadas" list shrink correctly, and clearing a filter brings items back.
8. Drag a "Não agendadas" item onto a calendar day. Task 3's automated tests already cover the `Draggable` source being registered and the `eventReceive`-triggered conflict-check/update logic directly (via `captured.eventReceive`) — what they do NOT cover is the real native drag gesture itself (pointer-down on a list item, drag across the DOM, drop onto a calendar cell), since that isn't reliable to simulate in jsdom. Pay close attention here: confirm the item disappears from "Não agendadas" and appears on the dropped day with a success toast, and that dropping onto a conflicting colaborador's day/time snaps back with the conflict error toast instead.
