# Export de Perícias para Excel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Exportar Excel" button to the Perícias screen that downloads the currently-filtered list as a `.xlsx` file, including two columns (Autor, Réu) not shown on screen.

**Architecture:** A single new client component reads the active URL filters, calls the existing `listPericias` server action directly (no new backend code), and builds/downloads the `.xlsx` entirely in the browser using `exceljs`'s browser build.

**Tech Stack:** Next.js 16 App Router + React 19, `exceljs` (new dependency), `sonner` for toasts, Vitest/RTL.

## Global Constraints

- No new server action, schema, or migration — `listPericias(filters)` (`src/features/pericias/actions.ts:37`) already returns every field needed, filters already applied server-side.
- `exceljs` resolves its `browser` package.json field automatically when imported as a bare `import ExcelJS from 'exceljs'` from a `'use client'` file — confirmed by inspecting the published package (`"browser": "./dist/exceljs.min.js"`). Do not import a `dist/...` subpath directly.
- Use `workbook.xlsx.writeBuffer()` (works in both Node and browser builds), not `writeFile()` (Node-only, uses `fs`, not available in the browser bundle).
- Column order and mapping are exact, per the design spec — do not reorder or rename.
- `jsdom` (this project's test environment) does not implement `URL.createObjectURL`/`URL.revokeObjectURL` — the test must stub both before exercising the download path.

---

### Task 1: `ExportPericiasButton` component + wiring

**Files:**
- Modify: `package.json` (add `exceljs` dependency)
- Create: `src/features/pericias/components/export-pericias-button.tsx`
- Create: `src/features/pericias/components/export-pericias-button.test.tsx`
- Modify: `src/features/pericias/components/pericias-screen.tsx`

**Interfaces:**
- Consumes: `listPericias(filters)` from `../actions` (already exists, unchanged: `Promise<PericiaListItem[]>`, where `PericiaListItem` is `src/features/pericias/actions.ts:11-23`). `useSearchParams` from `next/navigation`.
- Produces: `ExportPericiasButton` — a self-contained `<Button>`, no props, no exported helpers other than the component itself. Consumed by `PericiasScreen`.

- [ ] **Step 1: Install the dependency**

Run: `npm install exceljs@^4.4.0`
Expected: `package.json`/`package-lock.json` updated, `exceljs` present in `node_modules`.

- [ ] **Step 2: Write the failing tests**

Create `src/features/pericias/components/export-pericias-button.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportPericiasButton } from './export-pericias-button';

const mockListPericias = vi.fn();
vi.mock('../actions', () => ({
  listPericias: (...args: unknown[]) => mockListPericias(...args),
}));

let searchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
}));

const mockAddRow = vi.fn();
const mockAddRows = vi.fn();
const mockWriteBuffer = vi.fn();
const mockAddWorksheet = vi.fn(() => ({
  columns: [],
  addRow: mockAddRow,
  addRows: mockAddRows,
  getRow: vi.fn(() => ({})),
}));

vi.mock('exceljs', () => ({
  default: {
    Workbook: vi.fn(() => ({
      addWorksheet: mockAddWorksheet,
      xlsx: { writeBuffer: mockWriteBuffer },
    })),
  },
}));

const items = [
  {
    id: 1,
    dataAgendada: '2026-09-16',
    horaAgendada: '10:00',
    situacao: 'pendente' as const,
    processo: { id: 5, numero: '0001234-56.2026', autor: 'Autor X', reu: 'Réu Y' },
    municipio: { id: 3, nome: 'Belo Horizonte', uf: 'MG' },
    perito: {
      id: 7, nome: 'Cleber', contato: '', formacao: '', crea: '',
      jaTrabalhamos: true, relacao: 'boa' as const, resultados: 'positivo' as const,
    },
    colaborador: null,
  },
];

describe('ExportPericiasButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParams = new URLSearchParams();
    mockWriteBuffer.mockResolvedValue(new Uint8Array([1, 2, 3]));
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    window.URL.revokeObjectURL = vi.fn();
  });

  it('calls listPericias with the filters read from the current URL', async () => {
    searchParams = new URLSearchParams(
      'situacao=marcada&busca=1234&dataInicio=2026-09-01&dataFim=2026-09-30&municipioId=3&peritoId=7&colaboradorId=2'
    );
    mockListPericias.mockResolvedValue(items);
    const user = userEvent.setup();
    render(<ExportPericiasButton />);

    await user.click(screen.getByRole('button', { name: /exportar excel/i }));

    expect(mockListPericias).toHaveBeenCalledWith({
      situacao: 'marcada',
      busca: '1234',
      dataInicio: '2026-09-01',
      dataFim: '2026-09-30',
      municipioId: 3,
      peritoId: 7,
      colaboradorId: 2,
    });
  });

  it('omits unset filters instead of sending empty strings', async () => {
    mockListPericias.mockResolvedValue(items);
    const user = userEvent.setup();
    render(<ExportPericiasButton />);

    await user.click(screen.getByRole('button', { name: /exportar excel/i }));

    expect(mockListPericias).toHaveBeenCalledWith({});
  });

  it('shows an informational message and does not build a workbook when there is nothing to export', async () => {
    mockListPericias.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<ExportPericiasButton />);

    await user.click(screen.getByRole('button', { name: /exportar excel/i }));

    expect(await screen.findByText('Nenhuma perícia para exportar com os filtros atuais.')).toBeInTheDocument();
    expect(mockAddWorksheet).not.toHaveBeenCalled();
  });

  it('builds the workbook with the 9 columns in order and triggers a download', async () => {
    mockListPericias.mockResolvedValue(items);
    const user = userEvent.setup();
    render(<ExportPericiasButton />);

    await user.click(screen.getByRole('button', { name: /exportar excel/i }));

    expect(await screen.findByText('Planilha exportada')).toBeInTheDocument();
    expect(mockAddWorksheet).toHaveBeenCalledWith('Perícias');
    const worksheet = mockAddWorksheet.mock.results[0].value;
    expect(worksheet.columns.map((c: { header: string }) => c.header)).toEqual([
      'Nº Processo', 'Data', 'Hora', 'Local', 'Perito', 'Colaborador', 'Situação', 'Autor', 'Réu',
    ]);
    expect(mockAddRows).toHaveBeenCalledWith([
      {
        numero: '0001234-56.2026',
        data: new Date('2026-09-16'),
        hora: '10:00',
        local: 'Belo Horizonte/MG',
        perito: 'Cleber',
        colaborador: '',
        situacao: 'Pendente',
        autor: 'Autor X',
        reu: 'Réu Y',
      },
    ]);
    expect(window.URL.createObjectURL).toHaveBeenCalled();
  });

  it('shows an error message when listPericias fails', async () => {
    mockListPericias.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    render(<ExportPericiasButton />);

    await user.click(screen.getByRole('button', { name: /exportar excel/i }));

    expect(await screen.findByText('Não foi possível exportar as perícias.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/features/pericias/components/export-pericias-button.test.tsx`
Expected: FAIL — `./export-pericias-button` does not exist.

- [ ] **Step 4: Write `ExportPericiasButton`**

Create `src/features/pericias/components/export-pericias-button.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ExcelJS from 'exceljs';
import { toast } from 'sonner';
import { FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { listPericias } from '../actions';

const SITUACAO_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  marcada: 'Marcada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
};

export function ExportPericiasButton() {
  const searchParams = useSearchParams();
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const filters: Parameters<typeof listPericias>[0] = {};
      const situacao = searchParams.get('situacao');
      const busca = searchParams.get('busca');
      const dataInicio = searchParams.get('dataInicio');
      const dataFim = searchParams.get('dataFim');
      const municipioId = searchParams.get('municipioId');
      const peritoId = searchParams.get('peritoId');
      const colaboradorId = searchParams.get('colaboradorId');
      if (situacao) filters.situacao = situacao;
      if (busca) filters.busca = busca;
      if (dataInicio) filters.dataInicio = dataInicio;
      if (dataFim) filters.dataFim = dataFim;
      if (municipioId) filters.municipioId = Number(municipioId);
      if (peritoId) filters.peritoId = Number(peritoId);
      if (colaboradorId) filters.colaboradorId = Number(colaboradorId);

      const items = await listPericias(filters);
      if (items.length === 0) {
        toast.info('Nenhuma perícia para exportar com os filtros atuais.');
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Perícias');
      worksheet.columns = [
        { header: 'Nº Processo', key: 'numero', width: 20 },
        { header: 'Data', key: 'data', width: 14 },
        { header: 'Hora', key: 'hora', width: 10 },
        { header: 'Local', key: 'local', width: 22 },
        { header: 'Perito', key: 'perito', width: 22 },
        { header: 'Colaborador', key: 'colaborador', width: 22 },
        { header: 'Situação', key: 'situacao', width: 14 },
        { header: 'Autor', key: 'autor', width: 22 },
        { header: 'Réu', key: 'reu', width: 22 },
      ];
      worksheet.getRow(1).font = { bold: true };
      worksheet.addRows(
        items.map((item) => ({
          numero: item.processo.numero,
          data: item.dataAgendada ? new Date(item.dataAgendada) : '',
          hora: item.horaAgendada ?? '',
          local: `${item.municipio.nome}/${item.municipio.uf}`,
          perito: item.perito.nome,
          colaborador: item.colaborador?.nome ?? '',
          situacao: SITUACAO_LABELS[item.situacao] ?? item.situacao,
          autor: item.processo.autor,
          reu: item.processo.reu,
        }))
      );

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const today = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `pericias-${today}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success('Planilha exportada');
    } catch {
      toast.error('Não foi possível exportar as perícias.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={handleExport} disabled={exporting}>
      <FileSpreadsheet className="size-4" />
      {exporting ? 'Exportando...' : 'Exportar Excel'}
    </Button>
  );
}
```

The `SITUACAO_LABELS` map is a local duplicate of `src/components/shared/status-badge.tsx:11-16`'s `LABELS` constant — that file's version is typed against `PericiaListItem['situacao']` and colocated with its badge styling, and importing it here would create a coupling between the export feature and a display-only component. Keeping the labels as an independent local copy in this file matches this project's tolerance elsewhere for small duplicated string maps over cross-feature imports (e.g. `roleOptions` is redefined rather than imported across features).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/pericias/components/export-pericias-button.test.tsx`
Expected: PASS, all 5 tests.

- [ ] **Step 6: Wire the button into `PericiasScreen`**

In `src/features/pericias/components/pericias-screen.tsx`, add the import:

```tsx
import { ExportPericiasButton } from './export-pericias-button';
```

Then change the header `div` (currently):

```tsx
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Perícias</h1>
        <Button type="button" onClick={openCreate} disabled={loadingEdit}>
          <Plus className="size-4" />
          Nova perícia
        </Button>
      </div>
```

to:

```tsx
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Perícias</h1>
        <div className="flex items-center gap-2">
          <ExportPericiasButton />
          <Button type="button" onClick={openCreate} disabled={loadingEdit}>
            <Plus className="size-4" />
            Nova perícia
          </Button>
        </div>
      </div>
```

- [ ] **Step 7: Full suite, typecheck, and build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all tests pass (existing + 5 new), no new type errors, build succeeds (confirms `exceljs`'s browser build actually bundles cleanly for the client — this is the one integration risk in this task).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/features/pericias/components/export-pericias-button.tsx src/features/pericias/components/export-pericias-button.test.tsx src/features/pericias/components/pericias-screen.tsx
git commit -m "feat: add Excel export for the Perícias list"
```

---

## Manual verification (after the automated task above)

Automated tests mock `exceljs` entirely, so they don't prove the real `.xlsx` file opens correctly. After Task 1 is committed:

1. Run `npm run dev`, open the Perícias screen, apply a couple of filters (e.g. a date range), click "Exportar Excel".
2. Confirm a file named `pericias-<today>.xlsx` downloads.
3. Open it in Excel (or any spreadsheet app) and confirm: 9 columns in the right order with bold headers, the Data column contains real dates (not text, not "Não agendado"), Situação shows the Portuguese labels, Autor/Réu are populated, and the row count matches what the filtered on-screen table shows.
4. Clear all filters, export again, confirm it now includes every Perícia.
5. Filter down to zero results, click export, confirm the "Nenhuma perícia para exportar com os filtros atuais." toast appears and no file downloads.
