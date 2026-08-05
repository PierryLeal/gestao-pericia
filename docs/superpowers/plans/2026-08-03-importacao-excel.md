# Importação em massa via planilha Excel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new "Importar planilha" screen with two tabs (Perícias e Processos / Peritos e Colaboradores), each doing upload → server-side parse+resolve → editable preview → confirm → commit → report, per the approved design spec.

**Architecture:** A new `src/features/importacao/` feature directory following the project's established `actions.ts` + `schemas`-adjacent `types.ts` + `components/` + `lib/` layout. Pure parsing/mapping functions live in `lib/` (no DB, fully unit-testable). Two pairs of server actions (`previewImportacaoPericias`/`confirmarImportacaoPericias` and `previewImportacaoPeritosColaboradores`/`confirmarImportacaoPeritosColaboradores`) do the actual `exceljs` parsing and Supabase reads/writes, reusing the project's existing `listPeritos`/`listColaboradores`/`listProcessos`/`listPericias`/`searchMunicipios` actions for resolution rather than writing new queries. One screen component renders both tabs.

**Tech Stack:** Next.js 16 App Router + React 19, `exceljs` (already a dependency, pinned `^4.4.0`, used today for export — this plan uses its read side, `workbook.xlsx.load(buffer)`), Zod, Vitest/RTL, Base UI components.

## Global Constraints

- Every server action in this plan starts with `await requireRole(['admin', 'gerencia'])`, matching every other mutable/read action in the project.
- `src/lib/supabase/database.types.ts` is hand-maintained, not CLI-generated (confirmed unchanged this session) — this plan adds **zero new columns and zero new tables**, so it needs **no migration and no edits to `database.types.ts`**. Every write in this plan goes through the existing `createPericia`/`updatePericia`/`createProcesso`/`updateProcesso`/`createPerito`/`updatePerito`/`createColaborador`/`updateColaborador` actions (or their `toRow`/schema shapes), never raw inserts.
- Name matching ("já existe no cadastro") is **case- and accent-insensitive**, using the project's existing `normalizeForSearch` helper (`src/lib/search.ts`, already used by `matchesSearch`) for equality comparisons: `normalizeForSearch(a) === normalizeForSearch(b)`.
- Município resolution reuses `searchMunicipios` (`src/lib/ibge/client.ts`) for the network fetch/cache, then narrows its substring-matched candidates down to an **exact** normalized-name match; on more than one exact match, prefers the one with `uf === 'MG'`.
- `Date`/time cell values from `exceljs` must be read with LOCAL getters, never `toISOString()`, mirroring the existing `formatDateLocal`/`formatTimeLocal` helpers in `src/features/pericias/lib/calendario-mapping.ts` (this plan adds its own copies in `src/features/importacao/lib/date-parsing.ts`, since importing across feature folders for two one-line helpers isn't warranted — see Task 1).
- All manual browser verification in this plan runs against the **dev** Supabase project (`wpssipdxpfmvcamldpum`) only. Never test file uploads against production.
- Column identification for **both** tabs is by **header text**, not fixed column position (Tab 2 requires this per the spec; this plan applies the same robustness to Tab 1 for consistency and because real spreadsheets get columns reordered by whoever maintains them — a deliberate extension of the spec, not a deviation from it).
- Confirm actions never trust the `idExistente` values coming back from the client's (possibly stale) preview state for deciding whether to create a new Perito/Colaborador — they re-resolve names against a **fresh** DB read at confirm time, and maintain an in-memory "created in this batch" map so that the same new name appearing on multiple rows of one sheet is created once and reused, not duplicated.

---

## Task 1: Shared types + Tab 1 pure parsing functions

**Files:**
- Create: `src/features/importacao/types.ts`
- Create: `src/features/importacao/lib/pericia-parser.ts`
- Create: `src/features/importacao/lib/pericia-parser.test.ts`
- Create: `src/features/importacao/lib/date-parsing.ts`
- Create: `src/features/importacao/lib/date-parsing.test.ts`
- Create: `src/features/importacao/lib/header-lookup.ts`
- Create: `src/features/importacao/lib/header-lookup.test.ts`

**Interfaces:**
- Consumes: `PericiaInput` from `../pericias/schemas` (existing), `PeritoInput` from `../peritos/schemas` (existing).
- Produces: `PreviewStatus`, `NaoProcessada`, `PericiaPreviewRow`, `PreviewImportacaoPericiasResult`, `RelatorioImportacaoPericias`, `ColaboradorPreviewRow`, `PeritoPreviewRow`, `PreviewImportacaoPeritosColaboradoresResult`, `RelatorioImportacaoPeritosColaboradores` (all from `types.ts`); `parseColunaPericia`, `mapSituacao` (from `lib/pericia-parser.ts`); `parseDataCelula`, `parseHoraCelula` (from `lib/date-parsing.ts`); `encontrarIndiceColuna` (from `lib/header-lookup.ts`) — all consumed by Tasks 2, 3, 5, 6.

- [ ] **Step 1: Create the shared preview/report types**

Create `src/features/importacao/types.ts`:

```ts
import type { PericiaInput } from '../pericias/schemas';
import type { PeritoInput } from '../peritos/schemas';

export type PreviewStatus = 'ok' | 'atencao' | 'duplicada';

export type NaoProcessada = {
  linhaOriginal: number;
  texto: string;
  motivo: string;
};

export type PericiaPreviewRow = {
  linhaOriginal: number;
  status: PreviewStatus;
  motivo: string | null;
  processoNumero: string;
  processoAutor: string;
  processoReu: string;
  processoEscritorio: string;
  processoIdExistente: number | null;
  dataAgendada: string | null;
  horaAgendada: string | null;
  municipioId: number | null;
  municipioNome: string;
  municipioUf: string;
  peritoNome: string;
  peritoIdExistente: number | null;
  colaboradorNome: string;
  colaboradorIdExistente: number | null;
  situacao: PericiaInput['situacao'];
  observacoes: string | null;
};

export type PreviewImportacaoPericiasResult = {
  linhas: PericiaPreviewRow[];
  naoProcessadas: NaoProcessada[];
};

export type RelatorioImportacaoPericias = {
  processosCriados: number;
  processosAtualizados: number;
  periciasCriadas: number;
  peritosCriados: number;
  colaboradoresCriados: number;
  puladasPorDuplicidade: number;
};

export type ColaboradorPreviewRow = {
  linhaOriginal: number;
  status: PreviewStatus;
  motivo: string | null;
  nome: string;
  contato: string;
  idExistente: number | null;
};

export type PeritoPreviewRow = {
  linhaOriginal: number;
  status: PreviewStatus;
  motivo: string | null;
  nome: string;
  contato: string;
  formacao: string;
  crea: string;
  documento: string;
  jaTrabalhamos: boolean;
  relacao: PeritoInput['relacao'];
  resultados: PeritoInput['resultados'];
  idExistente: number | null;
};

export type PreviewImportacaoPeritosColaboradoresResult = {
  colaboradores: ColaboradorPreviewRow[];
  peritos: PeritoPreviewRow[];
  naoProcessadas: NaoProcessada[];
};

export type RelatorioImportacaoPeritosColaboradores = {
  peritosCriados: number;
  peritosAtualizados: number;
  colaboradoresCriados: number;
  colaboradoresAtualizados: number;
};
```

- [ ] **Step 2: Write the failing tests for the PERÍCIA-column parser and SITUAÇÃO mapper**

Create `src/features/importacao/lib/pericia-parser.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseColunaPericia, mapSituacao } from './pericia-parser';

describe('parseColunaPericia', () => {
  it('parses "autor x reu - numero"', () => {
    expect(parseColunaPericia('João x Maria - 0001234-56.2026')).toEqual({
      autor: 'João', reu: 'Maria', numeroProcesso: '0001234-56.2026',
    });
  });

  it('assigns "Vale" as reu when there is no " x " separator', () => {
    expect(parseColunaPericia('PAULO MONTEIRO - 5001808-87.2020.8.13.0301')).toEqual({
      autor: 'PAULO MONTEIRO', reu: 'Vale', numeroProcesso: '5001808-87.2020.8.13.0301',
    });
  });

  it('does not split on "x" inside a name (e.g. "Alex")', () => {
    expect(parseColunaPericia('Alex Souza - 123456')).toEqual({
      autor: 'Alex Souza', reu: 'Vale', numeroProcesso: '123456',
    });
  });

  it('matches "x" case-insensitively', () => {
    expect(parseColunaPericia('João X Maria - 123456')).toEqual({
      autor: 'João', reu: 'Maria', numeroProcesso: '123456',
    });
  });

  it('returns null when there is no " - " separator at all', () => {
    expect(parseColunaPericia('texto sem separador nenhum')).toBeNull();
  });

  it('uses the LAST " - " when the name portion itself contains a hyphenated word', () => {
    expect(parseColunaPericia('Silva - Junior x Réu - 123456')).toEqual({
      autor: 'Silva - Junior', reu: 'Réu', numeroProcesso: '123456',
    });
  });

  it('returns null when the numero portion would be empty', () => {
    expect(parseColunaPericia('João x Maria - ')).toBeNull();
  });
});

describe('mapSituacao', () => {
  it('maps "CAMPO" (case-insensitive) to marcada', () => {
    expect(mapSituacao('CAMPO')).toEqual({ situacao: 'marcada', reconhecida: true });
    expect(mapSituacao('campo')).toEqual({ situacao: 'marcada', reconhecida: true });
  });

  it('maps empty or whitespace-only to pendente', () => {
    expect(mapSituacao('')).toEqual({ situacao: 'pendente', reconhecida: true });
    expect(mapSituacao('   ')).toEqual({ situacao: 'pendente', reconhecida: true });
  });

  it('flags any other value as not recognized, defaulting to pendente', () => {
    expect(mapSituacao('REALIZADA')).toEqual({ situacao: 'pendente', reconhecida: false });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/features/importacao/lib/pericia-parser.test.ts`
Expected: FAIL — `./pericia-parser` does not exist.

- [ ] **Step 4: Write `pericia-parser.ts`**

Create `src/features/importacao/lib/pericia-parser.ts`:

```ts
import type { PericiaInput } from '../../pericias/schemas';

export type PericiaParseada = {
  autor: string;
  reu: string;
  numeroProcesso: string;
};

/**
 * "autor x réu - número do processo". The LAST " - " is treated as the
 * autor/réu ↔ número boundary, since a processo número never contains a
 * space-hyphen-space sequence but an autor/réu name occasionally does
 * (e.g. a compound surname).
 */
export function parseColunaPericia(texto: string): PericiaParseada | null {
  const trimmed = texto.trim();
  const lastDashIndex = trimmed.lastIndexOf(' - ');
  if (lastDashIndex === -1) return null;

  const nomePart = trimmed.slice(0, lastDashIndex).trim();
  const numeroProcesso = trimmed.slice(lastDashIndex + 3).trim();
  if (!nomePart || !numeroProcesso) return null;

  // " x " as a standalone word (surrounded by whitespace), not a letter inside
  // a name like "Alex" or "Max".
  const xMatch = nomePart.match(/^(.*?)\s+x\s+(.*)$/i);
  if (xMatch) {
    return { autor: xMatch[1].trim(), reu: xMatch[2].trim(), numeroProcesso };
  }
  return { autor: nomePart, reu: 'Vale', numeroProcesso };
}

export function mapSituacao(valor: string): { situacao: PericiaInput['situacao']; reconhecida: boolean } {
  const trimmed = valor.trim().toLowerCase();
  if (!trimmed) return { situacao: 'pendente', reconhecida: true };
  if (trimmed === 'campo') return { situacao: 'marcada', reconhecida: true };
  return { situacao: 'pendente', reconhecida: false };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/importacao/lib/pericia-parser.test.ts`
Expected: PASS, all tests.

- [ ] **Step 6: Write the failing tests for date/hora cell parsing**

Create `src/features/importacao/lib/date-parsing.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseDataCelula, parseHoraCelula } from './date-parsing';

describe('parseDataCelula', () => {
  it('formats a Date cell value using local getters (YYYY-MM-DD)', () => {
    expect(parseDataCelula(new Date(2026, 8, 20, 0, 0))).toBe('2026-09-20');
  });

  it('parses a DD/MM/YYYY text value', () => {
    expect(parseDataCelula('20/09/2026')).toBe('2026-09-20');
  });

  it('parses a YYYY-MM-DD text value as-is', () => {
    expect(parseDataCelula('2026-09-20')).toBe('2026-09-20');
  });

  it('returns null for an empty or unparseable value', () => {
    expect(parseDataCelula('')).toBeNull();
    expect(parseDataCelula(null)).toBeNull();
    expect(parseDataCelula('não é uma data')).toBeNull();
  });
});

describe('parseHoraCelula', () => {
  it('formats a Date cell value using local getters (HH:MM)', () => {
    expect(parseHoraCelula(new Date(1899, 11, 30, 14, 30))).toBe('14:30');
  });

  it('parses an HH:MM text value', () => {
    expect(parseHoraCelula('14:30')).toBe('14:30');
  });

  it('parses an HH:MM:SS text value by dropping the seconds', () => {
    expect(parseHoraCelula('14:30:00')).toBe('14:30');
  });

  it('returns null for an empty or unparseable value', () => {
    expect(parseHoraCelula('')).toBeNull();
    expect(parseHoraCelula(null)).toBeNull();
    expect(parseHoraCelula('não é uma hora')).toBeNull();
  });
});
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `npx vitest run src/features/importacao/lib/date-parsing.test.ts`
Expected: FAIL — `./date-parsing` does not exist.

- [ ] **Step 8: Write `date-parsing.ts`**

Create `src/features/importacao/lib/date-parsing.ts`:

```ts
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function parseDataCelula(value: unknown): string | null {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;

  return null;
}

export function parseHoraCelula(value: unknown): string | null {
  if (value instanceof Date) {
    return `${pad2(value.getHours())}:${pad2(value.getMinutes())}`;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  return `${match[1]}:${match[2]}`;
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx vitest run src/features/importacao/lib/date-parsing.test.ts`
Expected: PASS, all tests.

- [ ] **Step 10: Write the failing tests for header-based column lookup**

Create `src/features/importacao/lib/header-lookup.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { encontrarIndiceColuna, encontrarLinhaComTexto } from './header-lookup';

async function criarPlanilha(linhas: string[][]): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Teste');
  linhas.forEach((linha) => worksheet.addRow(linha));
  return worksheet;
}

describe('encontrarIndiceColuna', () => {
  it('finds a column by one of its accepted header spellings, case-insensitively', async () => {
    const worksheet = await criarPlanilha([['PERÍCIA', 'data', 'Hora']]);
    const headerRow = worksheet.getRow(1);
    expect(encontrarIndiceColuna(headerRow, ['PERÍCIA', 'PERICIA'])).toBe(1);
    expect(encontrarIndiceColuna(headerRow, ['DATA'])).toBe(2);
  });

  it('returns null when no accepted spelling is found', async () => {
    const worksheet = await criarPlanilha([['PERÍCIA', 'DATA']]);
    const headerRow = worksheet.getRow(1);
    expect(encontrarIndiceColuna(headerRow, ['LOCAL'])).toBeNull();
  });
});

describe('encontrarLinhaComTexto', () => {
  it('returns the row number of the first row containing a cell matching the text exactly (case-insensitive)', async () => {
    const worksheet = await criarPlanilha([
      ['COLABORADORES ÉTICA', 'CONTATO'],
      ['Ana', '31999990000'],
      [],
      ['PERITO', 'CONTATO', 'FORMAÇÃO'],
      ['Carlos', '31988880000', 'Eng. Civil'],
    ]);
    expect(encontrarLinhaComTexto(worksheet, 'PERITO')).toBe(4);
  });

  it('returns null when no row contains the text', async () => {
    const worksheet = await criarPlanilha([['A', 'B'], ['C', 'D']]);
    expect(encontrarLinhaComTexto(worksheet, 'PERITO')).toBeNull();
  });
});
```

- [ ] **Step 11: Run tests to verify they fail**

Run: `npx vitest run src/features/importacao/lib/header-lookup.test.ts`
Expected: FAIL — `./header-lookup` does not exist.

- [ ] **Step 12: Write `header-lookup.ts`**

Create `src/features/importacao/lib/header-lookup.ts`:

```ts
import type { Row, Worksheet } from 'exceljs';

function normalizarTextoCelula(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
}

/** Returns the 1-based column index of the first cell in `row` whose text
 *  matches (case-insensitively) one of `nomesAceitos`, or null if none do. */
export function encontrarIndiceColuna(row: Row, nomesAceitos: string[]): number | null {
  const aceitos = nomesAceitos.map((n) => n.trim().toLowerCase());
  let indiceEncontrado: number | null = null;
  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    if (indiceEncontrado !== null) return;
    if (aceitos.includes(normalizarTextoCelula(cell.value))) {
      indiceEncontrado = colNumber;
    }
  });
  return indiceEncontrado;
}

/** Returns the 1-based row number of the first row in `worksheet` containing
 *  a cell whose text matches `texto` exactly (case-insensitive), or null. */
export function encontrarLinhaComTexto(worksheet: Worksheet, texto: string): number | null {
  const alvo = texto.trim().toLowerCase();
  let linhaEncontrada: number | null = null;
  worksheet.eachRow((row, rowNumber) => {
    if (linhaEncontrada !== null) return;
    let encontrouNaLinha = false;
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (normalizarTextoCelula(cell.value) === alvo) encontrouNaLinha = true;
    });
    if (encontrouNaLinha) linhaEncontrada = rowNumber;
  });
  return linhaEncontrada;
}
```

- [ ] **Step 13: Run tests to verify they pass**

Run: `npx vitest run src/features/importacao/lib/header-lookup.test.ts`
Expected: PASS, all tests.

- [ ] **Step 14: Full suite, typecheck, lint**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass, no new type errors, zero eslint errors.

- [ ] **Step 15: Commit**

```bash
git add src/features/importacao/types.ts src/features/importacao/lib/pericia-parser.ts src/features/importacao/lib/pericia-parser.test.ts src/features/importacao/lib/date-parsing.ts src/features/importacao/lib/date-parsing.test.ts src/features/importacao/lib/header-lookup.ts src/features/importacao/lib/header-lookup.test.ts
git commit -m "feat: add shared import types and pure parsing helpers"
```

---

## Task 2: Tab 1 preview server action

**Files:**
- Create: `src/features/importacao/actions.ts`
- Create: `src/features/importacao/actions.test.ts`

**Interfaces:**
- Consumes: everything from Task 1 (`types.ts`, `lib/pericia-parser.ts`, `lib/date-parsing.ts`, `lib/header-lookup.ts`); `listPeritos` (`../peritos/actions`), `listColaboradores` (`../colaboradores/actions`), `listProcessos` (`../processos/actions`), `listPericias` (`../pericias/actions`), `searchMunicipios` (`@/lib/ibge/client`), `normalizeForSearch` (`@/lib/search`) — all existing, unchanged.
- Produces: `previewImportacaoPericias(fileBuffer: ArrayBuffer): Promise<PreviewImportacaoPericiasResult>` — consumed by Task 4 (UI) and re-used internally by Task 3 (confirm re-resolves rather than calling preview again, but shares its column-header constants — see Task 3).

- [ ] **Step 1: Write the failing tests for `previewImportacaoPericias`**

Create `src/features/importacao/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import { previewImportacaoPericias } from './actions';

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

const mockListPeritos = vi.fn();
const mockListColaboradores = vi.fn();
const mockListProcessos = vi.fn();
const mockListPericias = vi.fn();
const mockSearchMunicipios = vi.fn();

vi.mock('@/features/peritos/actions', () => ({ listPeritos: (...args: unknown[]) => mockListPeritos(...args) }));
vi.mock('@/features/colaboradores/actions', () => ({
  listColaboradores: (...args: unknown[]) => mockListColaboradores(...args),
}));
vi.mock('@/features/processos/actions', () => ({ listProcessos: (...args: unknown[]) => mockListProcessos(...args) }));
vi.mock('@/features/pericias/actions', () => ({ listPericias: (...args: unknown[]) => mockListPericias(...args) }));
vi.mock('@/lib/ibge/client', () => ({ searchMunicipios: (...args: unknown[]) => mockSearchMunicipios(...args) }));

async function criarBuffer(linhas: (string | number)[][]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Perícias');
  linhas.forEach((linha) => worksheet.addRow(linha));
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

const HEADER = ['PERÍCIA', 'DATA', 'HORA', 'LOCAL', 'PERITO', 'CAMPO', 'SITUAÇÃO', 'OBS', 'ESCRITÓRIOS'];

beforeEach(() => {
  vi.clearAllMocks();
  mockListPeritos.mockResolvedValue([{ id: 1, nome: 'Cleber', contato: '', formacao: '', crea: '', documento: '', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo' }]);
  mockListColaboradores.mockResolvedValue([{ id: 2, nome: 'João', contato: '', formacao: '' }]);
  mockListProcessos.mockResolvedValue([]);
  mockListPericias.mockResolvedValue([]);
  mockSearchMunicipios.mockResolvedValue([{ id: 3106200, nome: 'Belo Horizonte', uf: 'MG' }]);
});

describe('previewImportacaoPericias', () => {
  it('parses a well-formed row into an "ok" preview row with all references resolved', async () => {
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '20/09/2026', '10:00', 'Belo Horizonte', 'Cleber', 'João', 'CAMPO', 'levar EPI', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.naoProcessadas).toEqual([]);
    expect(result.linhas).toHaveLength(1);
    expect(result.linhas[0]).toMatchObject({
      status: 'ok',
      processoNumero: '0001234-56.2026',
      processoAutor: 'Maria',
      processoReu: 'João',
      processoEscritorio: 'PMRA',
      processoIdExistente: null,
      dataAgendada: '2026-09-20',
      horaAgendada: '10:00',
      municipioId: 3106200,
      municipioNome: 'Belo Horizonte',
      municipioUf: 'MG',
      peritoNome: 'Cleber',
      peritoIdExistente: 1,
      colaboradorNome: 'João',
      colaboradorIdExistente: 2,
      situacao: 'marcada',
      observacoes: 'levar EPI',
    });
  });

  it('sends an unparseable PERÍCIA cell to naoProcessadas instead of linhas', async () => {
    const buffer = await criarBuffer([HEADER, ['texto sem separador', '', '', '', '', '', '', '', '']]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas).toEqual([]);
    expect(result.naoProcessadas).toEqual([
      { linhaOriginal: 2, texto: 'texto sem separador', motivo: 'não foi possível identificar o número do processo' },
    ]);
  });

  it('flags a row as atencao with a município combobox target when the city has no match', async () => {
    mockSearchMunicipios.mockResolvedValue([]);
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '', '', 'Cidade Inexistente', 'Cleber', '', '', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].status).toBe('atencao');
    expect(result.linhas[0].motivo).toBe('município não encontrado');
    expect(result.linhas[0].municipioId).toBeNull();
  });

  it('prefers the MG match when a city name is ambiguous across states', async () => {
    mockSearchMunicipios.mockResolvedValue([
      { id: 1, nome: 'Bom Jesus', uf: 'RS' },
      { id: 2, nome: 'Bom Jesus', uf: 'MG' },
      { id: 3, nome: 'Bom Jesus', uf: 'PI' },
    ]);
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '', '', 'Bom Jesus', 'Cleber', '', '', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].municipioId).toBe(2);
    expect(result.linhas[0].municipioUf).toBe('MG');
  });

  it('flags a row atencao and requires manual perito selection when PERITO is blank', async () => {
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '', '', 'Belo Horizonte', '', '', '', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].status).toBe('atencao');
    expect(result.linhas[0].motivo).toBe('perito não informado');
    expect(result.linhas[0].peritoIdExistente).toBeNull();
  });

  it('marks a perito/colaborador name not found in the cadastro as null id (will be auto-created)', async () => {
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '', '', 'Belo Horizonte', 'Perito Novo', 'Colaborador Novo', '', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].peritoNome).toBe('Perito Novo');
    expect(result.linhas[0].peritoIdExistente).toBeNull();
    expect(result.linhas[0].colaboradorNome).toBe('Colaborador Novo');
    expect(result.linhas[0].colaboradorIdExistente).toBeNull();
    expect(result.linhas[0].status).toBe('ok');
  });

  it('reuses an existing processo by número and overwrites autor/reu/escritorio from the sheet', async () => {
    mockListProcessos.mockResolvedValue([{ id: 9, numero: '0001234-56.2026', autor: 'Antigo', reu: 'Antigo', escritorio: 'ANTIGO' }]);
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '', '', 'Belo Horizonte', 'Cleber', '', '', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].processoIdExistente).toBe(9);
    expect(result.linhas[0].processoAutor).toBe('Maria');
  });

  it('flags SITUAÇÃO values other than CAMPO/blank as atencao, defaulting to pendente', async () => {
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '', '', 'Belo Horizonte', 'Cleber', '', 'REALIZADA', '', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].situacao).toBe('pendente');
    expect(result.linhas[0].status).toBe('atencao');
    expect(result.linhas[0].motivo).toBe('situação não reconhecida');
  });

  it('marks a row as duplicada when an existing pericia matches on the full composite key', async () => {
    mockListProcessos.mockResolvedValue([{ id: 9, numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA' }]);
    mockListPericias.mockResolvedValue([
      {
        id: 100, dataAgendada: '2026-09-20', horaAgendada: '10:00', situacao: 'marcada', observacoes: 'levar EPI',
        processo: { id: 9, numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA' },
        municipio: { id: 3106200, nome: 'Belo Horizonte', uf: 'MG' },
        perito: { id: 1, nome: 'Cleber', contato: '', formacao: '', crea: '', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo' },
        colaborador: { id: 2, nome: 'João', contato: '', formacao: '' },
      },
    ]);
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '20/09/2026', '10:00', 'Belo Horizonte', 'Cleber', 'João', 'CAMPO', 'levar EPI', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].status).toBe('duplicada');
  });

  it('does NOT mark as duplicada when only the observação differs (the multi-especialista case)', async () => {
    mockListProcessos.mockResolvedValue([{ id: 9, numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA' }]);
    mockListPericias.mockResolvedValue([
      {
        id: 100, dataAgendada: '2026-09-20', horaAgendada: '10:00', situacao: 'marcada', observacoes: 'civil',
        processo: { id: 9, numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA' },
        municipio: { id: 3106200, nome: 'Belo Horizonte', uf: 'MG' },
        perito: { id: 1, nome: 'Cleber', contato: '', formacao: '', crea: '', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo' },
        colaborador: { id: 2, nome: 'João', contato: '', formacao: '' },
      },
    ]);
    const buffer = await criarBuffer([
      HEADER,
      ['Maria x João - 0001234-56.2026', '20/09/2026', '10:00', 'Belo Horizonte', 'Cleber', 'João', 'CAMPO', 'agronômica', 'PMRA'],
    ]);

    const result = await previewImportacaoPericias(buffer);

    expect(result.linhas[0].status).toBe('ok');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/importacao/actions.test.ts`
Expected: FAIL — `./actions` does not exist.

- [ ] **Step 3: Write `previewImportacaoPericias`**

Create `src/features/importacao/actions.ts`:

```ts
'use server';

import ExcelJS from 'exceljs';
import { requireRole } from '@/features/auth/guards';
import { searchMunicipios } from '@/lib/ibge/client';
import { normalizeForSearch } from '@/lib/search';
import { listPeritos } from '@/features/peritos/actions';
import { listColaboradores } from '@/features/colaboradores/actions';
import { listProcessos } from '@/features/processos/actions';
import { listPericias } from '@/features/pericias/actions';
import { parseColunaPericia, mapSituacao } from './lib/pericia-parser';
import { parseDataCelula, parseHoraCelula } from './lib/date-parsing';
import { encontrarIndiceColuna } from './lib/header-lookup';
import type { NaoProcessada, PericiaPreviewRow, PreviewImportacaoPericiasResult } from './types';

const COLUNAS_PERICIA_ACEITAS: Record<string, string[]> = {
  pericia: ['PERÍCIA', 'PERICIA'],
  data: ['DATA'],
  hora: ['HORA'],
  local: ['LOCAL'],
  perito: ['PERITO'],
  campo: ['CAMPO'],
  situacao: ['SITUAÇÃO', 'SITUACAO'],
  obs: ['OBS', 'OBS.', 'OBSERVAÇÕES', 'OBSERVACOES'],
  escritorios: ['ESCRITÓRIOS', 'ESCRITORIOS', 'ESCRITÓRIO', 'ESCRITORIO'],
};

function textoCelula(row: ExcelJS.Row, indice: number | null): string {
  if (indice === null) return '';
  const value = row.getCell(indice).value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'text' in value) return String((value as { text: unknown }).text ?? '');
  return String(value);
}

async function resolverMunicipio(nomeCidade: string): Promise<{ id: number; nome: string; uf: string } | null> {
  if (!nomeCidade.trim()) return null;
  const candidatos = await searchMunicipios(nomeCidade);
  const exatos = candidatos.filter((m) => normalizeForSearch(m.nome) === normalizeForSearch(nomeCidade));
  if (exatos.length === 0) return null;
  if (exatos.length === 1) return exatos[0];
  return exatos.find((m) => m.uf === 'MG') ?? exatos[0];
}

export async function previewImportacaoPericias(fileBuffer: ArrayBuffer): Promise<PreviewImportacaoPericiasResult> {
  await requireRole(['admin', 'gerencia']);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(fileBuffer));
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { linhas: [], naoProcessadas: [] };

  const [peritos, colaboradores, processos, periciasExistentes] = await Promise.all([
    listPeritos(), listColaboradores(), listProcessos(), listPericias(),
  ]);

  const headerRow = worksheet.getRow(1);
  const indices = Object.fromEntries(
    Object.entries(COLUNAS_PERICIA_ACEITAS).map(([chave, nomes]) => [chave, encontrarIndiceColuna(headerRow, nomes)])
  ) as Record<keyof typeof COLUNAS_PERICIA_ACEITAS, number | null>;

  const linhas: PericiaPreviewRow[] = [];
  const naoProcessadas: NaoProcessada[] = [];

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const textoPericia = textoCelula(row, indices.pericia);
    if (!textoPericia.trim()) continue;

    const parseado = parseColunaPericia(textoPericia);
    if (!parseado) {
      naoProcessadas.push({
        linhaOriginal: rowNumber, texto: textoPericia,
        motivo: 'não foi possível identificar o número do processo',
      });
      continue;
    }

    const motivos: string[] = [];

    const processoExistente = processos.find(
      (p) => normalizeForSearch(p.numero) === normalizeForSearch(parseado.numeroProcesso)
    );

    const nomeCidade = textoCelula(row, indices.local);
    const municipio = await resolverMunicipio(nomeCidade);
    if (!municipio) motivos.push('município não encontrado');

    const nomePerito = textoCelula(row, indices.perito);
    if (!nomePerito.trim()) motivos.push('perito não informado');
    const peritoExistente = nomePerito.trim()
      ? peritos.find((p) => normalizeForSearch(p.nome) === normalizeForSearch(nomePerito))
      : undefined;

    const nomeColaborador = textoCelula(row, indices.campo);
    const colaboradorExistente = nomeColaborador.trim()
      ? colaboradores.find((c) => normalizeForSearch(c.nome) === normalizeForSearch(nomeColaborador))
      : undefined;

    const { situacao, reconhecida } = mapSituacao(textoCelula(row, indices.situacao));
    if (!reconhecida) motivos.push('situação não reconhecida');

    const dataAgendada = parseDataCelula(indices.data !== null ? row.getCell(indices.data).value : null);
    const horaAgendada = parseHoraCelula(indices.hora !== null ? row.getCell(indices.hora).value : null);
    const observacoesTexto = textoCelula(row, indices.obs);
    const observacoes = observacoesTexto.trim() || null;
    const escritorio = textoCelula(row, indices.escritorios).trim();

    const duplicada = periciasExistentes.some((p) =>
      normalizeForSearch(p.processo.numero) === normalizeForSearch(parseado.numeroProcesso) &&
      p.dataAgendada === dataAgendada &&
      p.horaAgendada === horaAgendada &&
      normalizeForSearch(p.perito.nome) === normalizeForSearch(nomePerito) &&
      normalizeForSearch(p.colaborador?.nome ?? '') === normalizeForSearch(nomeColaborador) &&
      (p.observacoes ?? '') === (observacoes ?? '')
    );

    linhas.push({
      linhaOriginal: rowNumber,
      status: duplicada ? 'duplicada' : motivos.length > 0 ? 'atencao' : 'ok',
      motivo: duplicada ? 'perícia já importada anteriormente' : motivos[0] ?? null,
      processoNumero: parseado.numeroProcesso,
      processoAutor: parseado.autor,
      processoReu: parseado.reu,
      processoEscritorio: escritorio,
      processoIdExistente: processoExistente?.id ?? null,
      dataAgendada,
      horaAgendada,
      municipioId: municipio?.id ?? null,
      municipioNome: municipio?.nome ?? nomeCidade,
      municipioUf: municipio?.uf ?? '',
      peritoNome: nomePerito,
      peritoIdExistente: peritoExistente?.id ?? null,
      colaboradorNome: nomeColaborador,
      colaboradorIdExistente: colaboradorExistente?.id ?? null,
      situacao,
      observacoes,
    });
  }

  return { linhas, naoProcessadas };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/importacao/actions.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Full suite, typecheck, lint**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass, no new type errors, zero eslint errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/importacao/actions.ts src/features/importacao/actions.test.ts
git commit -m "feat: add preview server action for Perícias/Processos import"
```

---

## Task 3: Tab 1 confirm server action

**Files:**
- Modify: `src/features/importacao/actions.ts`
- Modify: `src/features/importacao/actions.test.ts`

**Interfaces:**
- Consumes: `PericiaPreviewRow`, `RelatorioImportacaoPericias` (Task 1); `createProcesso`/`updateProcesso` (`../processos/actions`), `createPerito` (`../peritos/actions`), `createColaborador` (`../colaboradores/actions`), `createPericia` (`../pericias/actions`) — all existing, unchanged; `listPeritos`/`listColaboradores`/`listProcessos`/`listPericias` (Task 2, same imports).
- Produces: `confirmarImportacaoPericias(linhas: PericiaPreviewRow[]): Promise<RelatorioImportacaoPericias>` — consumed by Task 4 (UI).

- [ ] **Step 1: Write the failing tests for `confirmarImportacaoPericias`**

Add to `src/features/importacao/actions.test.ts`. First extend the existing mocks at the top of the file with the write-side actions:

```ts
const mockCreateProcesso = vi.fn();
const mockUpdateProcesso = vi.fn();
const mockCreatePerito = vi.fn();
const mockCreateColaborador = vi.fn();
const mockCreatePericia = vi.fn();

vi.mock('@/features/processos/actions', () => ({
  listProcessos: (...args: unknown[]) => mockListProcessos(...args),
  createProcesso: (...args: unknown[]) => mockCreateProcesso(...args),
  updateProcesso: (...args: unknown[]) => mockUpdateProcesso(...args),
}));
vi.mock('@/features/peritos/actions', () => ({
  listPeritos: (...args: unknown[]) => mockListPeritos(...args),
  createPerito: (...args: unknown[]) => mockCreatePerito(...args),
}));
vi.mock('@/features/colaboradores/actions', () => ({
  listColaboradores: (...args: unknown[]) => mockListColaboradores(...args),
  createColaborador: (...args: unknown[]) => mockCreateColaborador(...args),
}));
vi.mock('@/features/pericias/actions', () => ({
  listPericias: (...args: unknown[]) => mockListPericias(...args),
  createPericia: (...args: unknown[]) => mockCreatePericia(...args),
}));
```

(This replaces the four narrower `vi.mock` calls already added in Task 2 for these same four modules — each module is mocked once, with all the functions this file needs from it.)

Then add, at the end of `src/features/importacao/actions.test.ts`:

```ts
import { confirmarImportacaoPericias } from './actions';
import type { PericiaPreviewRow } from './types';

function linhaBase(overrides: Partial<PericiaPreviewRow> = {}): PericiaPreviewRow {
  return {
    linhaOriginal: 2,
    status: 'ok',
    motivo: null,
    processoNumero: '0001234-56.2026',
    processoAutor: 'Maria',
    processoReu: 'João',
    processoEscritorio: 'PMRA',
    processoIdExistente: null,
    dataAgendada: '2026-09-20',
    horaAgendada: '10:00',
    municipioId: 3106200,
    municipioNome: 'Belo Horizonte',
    municipioUf: 'MG',
    peritoNome: 'Cleber',
    peritoIdExistente: 1,
    colaboradorNome: 'João',
    colaboradorIdExistente: 2,
    situacao: 'marcada',
    observacoes: null,
    ...overrides,
  };
}

describe('confirmarImportacaoPericias', () => {
  beforeEach(() => {
    mockCreateProcesso.mockResolvedValue({ success: true, data: { id: 50, numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA' } });
    mockUpdateProcesso.mockResolvedValue({ success: true, data: { id: 9, numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA' } });
    mockCreatePerito.mockResolvedValue({ success: true, data: { id: 60, nome: 'Novo Perito' } });
    mockCreateColaborador.mockResolvedValue({ success: true, data: { id: 70, nome: 'Novo Colaborador' } });
    mockCreatePericia.mockResolvedValue({ success: true, data: { id: 100 } });
    mockListPericias.mockResolvedValue([]);
  });

  it('creates a new processo when processoIdExistente is null, then creates the pericia', async () => {
    const relatorio = await confirmarImportacaoPericias([linhaBase()]);

    expect(mockCreateProcesso).toHaveBeenCalledWith({
      numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA',
    });
    expect(mockCreatePericia).toHaveBeenCalledWith({
      processoId: 50, municipioId: 3106200, peritoId: 1, colaboradorId: 2,
      dataAgendada: '2026-09-20', horaAgendada: '10:00', situacao: 'marcada', observacoes: null,
    });
    expect(relatorio.processosCriados).toBe(1);
    expect(relatorio.processosAtualizados).toBe(0);
    expect(relatorio.periciasCriadas).toBe(1);
  });

  it('updates the existing processo (overwriting autor/reu/escritorio) when processoIdExistente is set', async () => {
    const relatorio = await confirmarImportacaoPericias([linhaBase({ processoIdExistente: 9 })]);

    expect(mockUpdateProcesso).toHaveBeenCalledWith(9, {
      numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA',
    });
    expect(mockCreateProcesso).not.toHaveBeenCalled();
    expect(relatorio.processosAtualizados).toBe(1);
  });

  it('auto-creates a perito with just the name when peritoIdExistente is null', async () => {
    await confirmarImportacaoPericias([linhaBase({ processoIdExistente: 9, peritoNome: 'Novo Perito', peritoIdExistente: null })]);

    expect(mockCreatePerito).toHaveBeenCalledWith({
      nome: 'Novo Perito', contato: '', formacao: '', crea: '', documento: '',
      jaTrabalhamos: false, relacao: 'neutra', resultados: 'parcial',
    });
    expect(mockCreatePericia).toHaveBeenCalledWith(expect.objectContaining({ peritoId: 60 }));
  });

  it('creates the same new perito only once across two rows referencing it, reusing the id on the second row', async () => {
    const linhas = [
      linhaBase({ linhaOriginal: 2, processoIdExistente: 9, peritoNome: 'Novo Perito', peritoIdExistente: null }),
      linhaBase({ linhaOriginal: 3, processoIdExistente: 9, peritoNome: 'Novo Perito', peritoIdExistente: null, horaAgendada: '11:00' }),
    ];

    await confirmarImportacaoPericias(linhas);

    expect(mockCreatePerito).toHaveBeenCalledTimes(1);
    expect(mockCreatePericia).toHaveBeenNthCalledWith(1, expect.objectContaining({ peritoId: 60 }));
    expect(mockCreatePericia).toHaveBeenNthCalledWith(2, expect.objectContaining({ peritoId: 60 }));
  });

  it('leaves colaboradorId null when colaboradorNome is blank, without creating a colaborador', async () => {
    await confirmarImportacaoPericias([linhaBase({ processoIdExistente: 9, colaboradorNome: '', colaboradorIdExistente: null })]);

    expect(mockCreateColaborador).not.toHaveBeenCalled();
    expect(mockCreatePericia).toHaveBeenCalledWith(expect.objectContaining({ colaboradorId: null }));
  });

  it('re-checks duplicidade against a fresh DB read and skips a row that now matches an existing pericia', async () => {
    mockListPericias.mockResolvedValue([
      {
        id: 100, dataAgendada: '2026-09-20', horaAgendada: '10:00', situacao: 'marcada', observacoes: null,
        processo: { id: 9, numero: '0001234-56.2026', autor: 'Maria', reu: 'João', escritorio: 'PMRA' },
        municipio: { id: 3106200, nome: 'Belo Horizonte', uf: 'MG' },
        perito: { id: 1, nome: 'Cleber', contato: '', formacao: '', crea: '', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo' },
        colaborador: { id: 2, nome: 'João', contato: '', formacao: '' },
      },
    ]);

    const relatorio = await confirmarImportacaoPericias([linhaBase({ processoIdExistente: 9 })]);

    expect(mockCreatePericia).not.toHaveBeenCalled();
    expect(relatorio.periciasCriadas).toBe(0);
    expect(relatorio.puladasPorDuplicidade).toBe(1);
  });

  it('skips a row whose own status is duplicada without a fresh-DB check', async () => {
    const relatorio = await confirmarImportacaoPericias([linhaBase({ processoIdExistente: 9, status: 'duplicada' })]);

    expect(mockCreatePericia).not.toHaveBeenCalled();
    expect(relatorio.puladasPorDuplicidade).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/importacao/actions.test.ts`
Expected: FAIL — `confirmarImportacaoPericias` does not exist.

- [ ] **Step 3: Write `confirmarImportacaoPericias`**

In `src/features/importacao/actions.ts`, update the imports:

```ts
import { createProcesso, updateProcesso, listProcessos } from '@/features/processos/actions';
import { createPerito, listPeritos } from '@/features/peritos/actions';
import { createColaborador, listColaboradores } from '@/features/colaboradores/actions';
import { createPericia, listPericias } from '@/features/pericias/actions';
```

(replacing the four narrower `listX` imports already present from Task 2). Add at the end of the file:

```ts
export async function confirmarImportacaoPericias(linhas: PericiaPreviewRow[]): Promise<RelatorioImportacaoPericias> {
  await requireRole(['admin', 'gerencia']);

  const periciasAtuais = await listPericias();

  const peritosCriadosNesteLote = new Map<string, number>();
  const colaboradoresCriadosNesteLote = new Map<string, number>();

  const relatorio: RelatorioImportacaoPericias = {
    processosCriados: 0, processosAtualizados: 0, periciasCriadas: 0,
    peritosCriados: 0, colaboradoresCriados: 0, puladasPorDuplicidade: 0,
  };

  for (const linha of linhas) {
    if (linha.status === 'duplicada') {
      relatorio.puladasPorDuplicidade++;
      continue;
    }

    const jaExiste = periciasAtuais.some((p) =>
      normalizeForSearch(p.processo.numero) === normalizeForSearch(linha.processoNumero) &&
      p.dataAgendada === linha.dataAgendada &&
      p.horaAgendada === linha.horaAgendada &&
      normalizeForSearch(p.perito.nome) === normalizeForSearch(linha.peritoNome) &&
      normalizeForSearch(p.colaborador?.nome ?? '') === normalizeForSearch(linha.colaboradorNome) &&
      (p.observacoes ?? '') === (linha.observacoes ?? '')
    );
    if (jaExiste) {
      relatorio.puladasPorDuplicidade++;
      continue;
    }

    let processoId = linha.processoIdExistente;
    if (processoId) {
      const resultado = await updateProcesso(processoId, {
        numero: linha.processoNumero, autor: linha.processoAutor, reu: linha.processoReu, escritorio: linha.processoEscritorio,
      });
      if (resultado.success) relatorio.processosAtualizados++;
    } else {
      const resultado = await createProcesso({
        numero: linha.processoNumero, autor: linha.processoAutor, reu: linha.processoReu, escritorio: linha.processoEscritorio,
      });
      if (!resultado.success) continue;
      processoId = resultado.data.id;
      relatorio.processosCriados++;
    }

    let peritoId = linha.peritoIdExistente;
    if (!peritoId && linha.peritoNome.trim()) {
      const chave = normalizeForSearch(linha.peritoNome);
      peritoId = peritosCriadosNesteLote.get(chave) ?? null;
      if (!peritoId) {
        const resultado = await createPerito({
          nome: linha.peritoNome, contato: '', formacao: '', crea: '', documento: '',
          jaTrabalhamos: false, relacao: 'neutra', resultados: 'parcial',
        });
        if (resultado.success) {
          peritoId = resultado.data.id;
          peritosCriadosNesteLote.set(chave, peritoId);
          relatorio.peritosCriados++;
        }
      }
    }
    if (!peritoId) continue;

    let colaboradorId = linha.colaboradorIdExistente;
    if (!colaboradorId && linha.colaboradorNome.trim()) {
      const chave = normalizeForSearch(linha.colaboradorNome);
      colaboradorId = colaboradoresCriadosNesteLote.get(chave) ?? null;
      if (!colaboradorId) {
        const resultado = await createColaborador({ nome: linha.colaboradorNome, contato: '', formacao: '' });
        if (resultado.success) {
          colaboradorId = resultado.data.id;
          colaboradoresCriadosNesteLote.set(chave, colaboradorId);
          relatorio.colaboradoresCriados++;
        }
      }
    }

    const resultadoPericia = await createPericia({
      processoId,
      municipioId: linha.municipioId as number,
      peritoId,
      colaboradorId: colaboradorId ?? null,
      dataAgendada: linha.dataAgendada,
      horaAgendada: linha.horaAgendada,
      situacao: linha.situacao,
      observacoes: linha.observacoes,
    });
    if (resultadoPericia.success) relatorio.periciasCriadas++;
  }

  return relatorio;
}
```

`confirmarImportacaoPericias` only fetches `listPericias()` fresh — it's the one list the dedup re-check needs (per the design spec's "confirm never trusts the preview's resolved IDs, but re-checks duplicidade against current DB state" rule). Perito/Colaborador/Processo resolution, by contrast, is driven entirely by the (possibly user-edited) `linha.*IdExistente` fields the preview already resolved — a null id means "create it," a set id means "reuse it," and there's no dedup concern for those three (only Pericias have a duplicate-detection key), so re-fetching them here would be unused work.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/importacao/actions.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Full suite, typecheck, lint**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass, no new type errors, zero eslint errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/importacao/actions.ts src/features/importacao/actions.test.ts
git commit -m "feat: add confirm server action for Perícias/Processos import"
```

---

## Task 4: Tab 1 UI (upload, editable preview, confirm, report) + route + nav entry

**Files:**
- Create: `src/features/importacao/components/pericias-preview-table.tsx`
- Create: `src/features/importacao/components/pericias-preview-table.test.tsx`
- Create: `src/features/importacao/components/importar-planilha-screen.tsx`
- Create: `src/features/importacao/components/importar-planilha-screen.test.tsx`
- Create: `src/app/(app)/importar/page.tsx`
- Modify: `src/components/shared/sidebar.tsx`

**Interfaces:**
- Consumes: `previewImportacaoPericias`, `confirmarImportacaoPericias` (Tasks 2-3); `PericiaPreviewRow`, `RelatorioImportacaoPericias` (Task 1); `situacaoOptions` from `../../pericias/schemas` (existing); `MunicipioCombobox` (`@/features/municipios/components/municipio-combobox`, existing); `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell` (`@/components/ui/table`, existing); `Input`, `Select`/`SelectTrigger`/`SelectContent`/`SelectItem`/`SelectValue`, `Button` (existing).
- Produces: `PericiasPreviewTable({ linhas, onChange }: { linhas: PericiaPreviewRow[]; onChange: (linhas: PericiaPreviewRow[]) => void })`; `ImportarPlanilhaScreen` — the latter is the leaf of Tab 1's work, extended by Task 8 to add the second tab.

- [ ] **Step 1: Write the failing tests for `PericiasPreviewTable`**

Create `src/features/importacao/components/pericias-preview-table.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PericiasPreviewTable } from './pericias-preview-table';
import type { PericiaPreviewRow } from '../types';

vi.mock('@/features/municipios/components/municipio-combobox', () => ({
  MunicipioCombobox: ({ onChange }: { onChange: (m: { id: number; nome: string; uf: string }) => void }) => (
    <button type="button" onClick={() => onChange({ id: 99, nome: 'Ouro Preto', uf: 'MG' })}>
      selecionar município
    </button>
  ),
}));

function linhaBase(overrides: Partial<PericiaPreviewRow> = {}): PericiaPreviewRow {
  return {
    linhaOriginal: 2, status: 'ok', motivo: null,
    processoNumero: '0001234-56.2026', processoAutor: 'Maria', processoReu: 'João', processoEscritorio: 'PMRA',
    processoIdExistente: null, dataAgendada: '2026-09-20', horaAgendada: '10:00',
    municipioId: 3106200, municipioNome: 'Belo Horizonte', municipioUf: 'MG',
    peritoNome: 'Cleber', peritoIdExistente: 1, colaboradorNome: 'João', colaboradorIdExistente: 2,
    situacao: 'marcada', observacoes: null,
    ...overrides,
  };
}

describe('PericiasPreviewTable', () => {
  it('shows every row with its processo número and município', () => {
    render(<PericiasPreviewTable linhas={[linhaBase()]} onChange={vi.fn()} />);
    expect(screen.getByText('0001234-56.2026')).toBeInTheDocument();
    expect(screen.getByText(/Belo Horizonte/)).toBeInTheDocument();
  });

  it('marks a new perito/colaborador name with a "(novo)" indicator', () => {
    render(
      <PericiasPreviewTable
        linhas={[linhaBase({ peritoNome: 'Perito Novo', peritoIdExistente: null })]}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText(/Perito Novo/)).toBeInTheDocument();
    expect(screen.getByText('(novo)')).toBeInTheDocument();
  });

  it('shows a município combobox and calls onChange with the picked município when status is atencao with no município', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PericiasPreviewTable
        linhas={[linhaBase({ status: 'atencao', motivo: 'município não encontrado', municipioId: null, municipioNome: 'Cidade X', municipioUf: '' })]}
        onChange={onChange}
      />
    );

    await user.click(screen.getByText('selecionar município'));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ municipioId: 99, municipioNome: 'Ouro Preto', municipioUf: 'MG' }),
    ]);
  });

  it('lets the user edit the situação of a flagged row via the select', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PericiasPreviewTable
        linhas={[linhaBase({ status: 'atencao', motivo: 'situação não reconhecida' })]}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('combobox', { name: /situação/i }));
    await user.click(await screen.findByRole('option', { name: 'realizada' }));

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ situacao: 'realizada' })]);
  });

  it('shows duplicada rows dimmed with an explanatory reason', () => {
    render(
      <PericiasPreviewTable
        linhas={[linhaBase({ status: 'duplicada', motivo: 'perícia já importada anteriormente' })]}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('perícia já importada anteriormente')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/importacao/components/pericias-preview-table.test.tsx`
Expected: FAIL — `./pericias-preview-table` does not exist.

- [ ] **Step 3: Write `PericiasPreviewTable`**

Create `src/features/importacao/components/pericias-preview-table.tsx`:

```tsx
'use client';

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MunicipioCombobox } from '@/features/municipios/components/municipio-combobox';
import { situacaoOptions, type PericiaInput } from '../../pericias/schemas';
import { cn } from '@/lib/utils';
import type { PericiaPreviewRow } from '../types';

export function PericiasPreviewTable({
  linhas,
  onChange,
}: {
  linhas: PericiaPreviewRow[];
  onChange: (linhas: PericiaPreviewRow[]) => void;
}) {
  function atualizarLinha(index: number, patch: Partial<PericiaPreviewRow>) {
    onChange(linhas.map((linha, i) => (i === index ? { ...linha, ...patch } : linha)));
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Processo</TableHead>
          <TableHead>Data - Hora</TableHead>
          <TableHead>Local</TableHead>
          <TableHead>Perito</TableHead>
          <TableHead>Colaborador</TableHead>
          <TableHead>Situação</TableHead>
          <TableHead>Obs.</TableHead>
          <TableHead>Escritório</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((linha, index) => (
          <TableRow
            key={linha.linhaOriginal}
            className={cn(
              linha.status === 'atencao' && 'bg-destructive/10',
              linha.status === 'duplicada' && 'opacity-50'
            )}
          >
            <TableCell>
              <Input
                value={linha.processoNumero}
                onChange={(e) => atualizarLinha(index, { processoNumero: e.target.value })}
              />
            </TableCell>
            <TableCell>
              <div className="flex gap-1">
                <Input
                  type="date" value={linha.dataAgendada ?? ''}
                  onChange={(e) => atualizarLinha(index, { dataAgendada: e.target.value || null })}
                />
                <Input
                  type="time" value={linha.horaAgendada ?? ''}
                  onChange={(e) => atualizarLinha(index, { horaAgendada: e.target.value || null })}
                />
              </div>
            </TableCell>
            <TableCell>
              {linha.municipioId ? (
                `${linha.municipioNome}/${linha.municipioUf}`
              ) : (
                <MunicipioCombobox
                  value={null}
                  selected={null}
                  onChange={(m) =>
                    atualizarLinha(index, { municipioId: m.id, municipioNome: m.nome, municipioUf: m.uf })
                  }
                />
              )}
            </TableCell>
            <TableCell>
              <Input
                value={linha.peritoNome}
                onChange={(e) => atualizarLinha(index, { peritoNome: e.target.value, peritoIdExistente: null })}
              />
              {!linha.peritoIdExistente && linha.peritoNome.trim() && (
                <span className="ml-1 text-xs text-muted-foreground">(novo)</span>
              )}
            </TableCell>
            <TableCell>
              <Input
                value={linha.colaboradorNome}
                onChange={(e) => atualizarLinha(index, { colaboradorNome: e.target.value, colaboradorIdExistente: null })}
              />
              {!linha.colaboradorIdExistente && linha.colaboradorNome.trim() && (
                <span className="ml-1 text-xs text-muted-foreground">(novo)</span>
              )}
            </TableCell>
            <TableCell>
              <Select
                value={linha.situacao}
                onValueChange={(v) => atualizarLinha(index, { situacao: v as PericiaInput['situacao'] })}
              >
                <SelectTrigger aria-label="Situação"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {situacaoOptions.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Input
                value={linha.observacoes ?? ''}
                onChange={(e) => atualizarLinha(index, { observacoes: e.target.value || null })}
              />
            </TableCell>
            <TableCell>
              <Input
                value={linha.processoEscritorio}
                onChange={(e) => atualizarLinha(index, { processoEscritorio: e.target.value })}
              />
            </TableCell>
            {linha.motivo && (
              <TableCell className="text-xs text-muted-foreground">{linha.motivo}</TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/importacao/components/pericias-preview-table.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 5: Write the failing tests for `ImportarPlanilhaScreen` (Tab 1 only)**

Create `src/features/importacao/components/importar-planilha-screen.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ImportarPlanilhaScreen } from './importar-planilha-screen';

const mockPreviewPericias = vi.fn();
const mockConfirmarPericias = vi.fn();
vi.mock('../actions', () => ({
  previewImportacaoPericias: (...args: unknown[]) => mockPreviewPericias(...args),
  confirmarImportacaoPericias: (...args: unknown[]) => mockConfirmarPericias(...args),
  previewImportacaoPeritosColaboradores: vi.fn(async () => ({ colaboradores: [], peritos: [], naoProcessadas: [] })),
  confirmarImportacaoPeritosColaboradores: vi.fn(),
}));

function arquivoFake(nome = 'planilha.xlsx') {
  return new File(['conteudo'], nome, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

describe('ImportarPlanilhaScreen — aba Perícias e Processos', () => {
  it('processes an uploaded file and shows the preview table', async () => {
    mockPreviewPericias.mockResolvedValue({
      linhas: [{
        linhaOriginal: 2, status: 'ok', motivo: null,
        processoNumero: '0001234-56.2026', processoAutor: 'Maria', processoReu: 'João', processoEscritorio: 'PMRA',
        processoIdExistente: null, dataAgendada: '2026-09-20', horaAgendada: '10:00',
        municipioId: 3106200, municipioNome: 'Belo Horizonte', municipioUf: 'MG',
        peritoNome: 'Cleber', peritoIdExistente: 1, colaboradorNome: 'João', colaboradorIdExistente: 2,
        situacao: 'marcada', observacoes: null,
      }],
      naoProcessadas: [],
    });
    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);

    const input = screen.getByLabelText(/planilha de perícias/i);
    await user.upload(input, arquivoFake());

    await waitFor(() => expect(screen.getByText('0001234-56.2026')).toBeInTheDocument());
  });

  it('shows naoProcessadas rows in a separate, non-editable list', async () => {
    mockPreviewPericias.mockResolvedValue({
      linhas: [],
      naoProcessadas: [{ linhaOriginal: 3, texto: 'texto ruim', motivo: 'não foi possível identificar o número do processo' }],
    });
    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);

    await user.upload(screen.getByLabelText(/planilha de perícias/i), arquivoFake());

    await waitFor(() => expect(screen.getByText('texto ruim')).toBeInTheDocument());
    expect(screen.getByText('não foi possível identificar o número do processo')).toBeInTheDocument();
  });

  it('calls confirmarImportacaoPericias with the (possibly edited) preview rows and shows the report', async () => {
    mockPreviewPericias.mockResolvedValue({
      linhas: [{
        linhaOriginal: 2, status: 'ok', motivo: null,
        processoNumero: '0001234-56.2026', processoAutor: 'Maria', processoReu: 'João', processoEscritorio: 'PMRA',
        processoIdExistente: null, dataAgendada: '2026-09-20', horaAgendada: '10:00',
        municipioId: 3106200, municipioNome: 'Belo Horizonte', municipioUf: 'MG',
        peritoNome: 'Cleber', peritoIdExistente: 1, colaboradorNome: 'João', colaboradorIdExistente: 2,
        situacao: 'marcada', observacoes: null,
      }],
      naoProcessadas: [],
    });
    mockConfirmarPericias.mockResolvedValue({
      processosCriados: 1, processosAtualizados: 0, periciasCriadas: 1,
      peritosCriados: 0, colaboradoresCriados: 0, puladasPorDuplicidade: 0,
    });
    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);

    await user.upload(screen.getByLabelText(/planilha de perícias/i), arquivoFake());
    await waitFor(() => expect(screen.getByText('0001234-56.2026')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /confirmar importação/i }));

    await waitFor(() => expect(mockConfirmarPericias).toHaveBeenCalledWith([
      expect.objectContaining({ processoNumero: '0001234-56.2026' }),
    ]));
    expect(await screen.findByText(/1 perícia criada/i)).toBeInTheDocument();
  });

  it('disables the confirm button when there are no ok/atencao rows', async () => {
    mockPreviewPericias.mockResolvedValue({ linhas: [], naoProcessadas: [] });
    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);

    await user.upload(screen.getByLabelText(/planilha de perícias/i), arquivoFake());

    await waitFor(() => expect(screen.getByRole('button', { name: /confirmar importação/i })).toBeDisabled());
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npx vitest run src/features/importacao/components/importar-planilha-screen.test.tsx`
Expected: FAIL — `./importar-planilha-screen` does not exist.

- [ ] **Step 7: Write `ImportarPlanilhaScreen` (Tab 1 only — Task 8 adds the second tab)**

Create `src/features/importacao/components/importar-planilha-screen.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  previewImportacaoPericias, confirmarImportacaoPericias,
} from '../actions';
import type { PericiaPreviewRow, NaoProcessada, RelatorioImportacaoPericias } from '../types';
import { PericiasPreviewTable } from './pericias-preview-table';

export function ImportarPlanilhaScreen() {
  const [linhas, setLinhas] = useState<PericiaPreviewRow[]>([]);
  const [naoProcessadas, setNaoProcessadas] = useState<NaoProcessada[]>([]);
  const [relatorio, setRelatorio] = useState<RelatorioImportacaoPericias | null>(null);
  const [processando, setProcessando] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRelatorio(null);
    setProcessando(true);
    try {
      const buffer = await file.arrayBuffer();
      const resultado = await previewImportacaoPericias(buffer);
      setLinhas(resultado.linhas);
      setNaoProcessadas(resultado.naoProcessadas);
    } finally {
      setProcessando(false);
      e.target.value = '';
    }
  }

  async function handleConfirmar() {
    setProcessando(true);
    try {
      const resultado = await confirmarImportacaoPericias(linhas);
      setRelatorio(resultado);
      setLinhas([]);
    } finally {
      setProcessando(false);
    }
  }

  const podeConfirmar = linhas.some((l) => l.status === 'ok' || l.status === 'atencao');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Importar planilha</h1>

      <div className="space-y-2">
        <Label htmlFor="upload-pericias">Planilha de Perícias e Processos</Label>
        <input id="upload-pericias" type="file" accept=".xlsx" onChange={handleUpload} disabled={processando} />
      </div>

      {linhas.length > 0 && (
        <>
          <PericiasPreviewTable linhas={linhas} onChange={setLinhas} />
          <Button type="button" onClick={handleConfirmar} disabled={!podeConfirmar || processando}>
            Confirmar importação
          </Button>
        </>
      )}

      {naoProcessadas.length > 0 && (
        <div className="space-y-1">
          <h2 className="text-sm font-medium text-muted-foreground">Linhas não processadas</h2>
          {naoProcessadas.map((n) => (
            <p key={n.linhaOriginal} className="text-sm">
              Linha {n.linhaOriginal}: &quot;{n.texto}&quot; — {n.motivo}
            </p>
          ))}
        </div>
      )}

      {relatorio && (
        <div className="rounded-md border p-4 text-sm">
          <p>{relatorio.processosCriados} processo(s) criado(s), {relatorio.processosAtualizados} atualizado(s).</p>
          <p>{relatorio.periciasCriadas} perícia(s) criada(s).</p>
          <p>{relatorio.peritosCriados} perito(s) criado(s), {relatorio.colaboradoresCriados} colaborador(es) criado(s).</p>
          <p>{relatorio.puladasPorDuplicidade} linha(s) pulada(s) por duplicidade.</p>
        </div>
      )}
    </div>
  );
}
```

Note the `previewImportacaoPeritosColaboradores`/`confirmarImportacaoPeritosColaboradores` mocks in the test file's `vi.mock('../actions', ...)` reference functions that don't exist yet in `actions.ts` at this point in the plan — that's expected and fine, since `vi.mock` factories are not type-checked against the real module at the call site the way a real import is; Task 6 adds the real exports before anything imports them for real.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/features/importacao/components/importar-planilha-screen.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 9: Create the route**

Create `src/app/(app)/importar/page.tsx`:

```tsx
import { ImportarPlanilhaScreen } from '@/features/importacao/components/importar-planilha-screen';

export default function ImportarPage() {
  return <ImportarPlanilhaScreen />;
}
```

- [ ] **Step 10: Add the nav entry**

In `src/components/shared/sidebar.tsx`, add `Upload` to the `lucide-react` import (alongside the existing icon imports), and insert a new entry into `NAV_ITEMS` right after `/colaboradores`, before `/perfis`:

```ts
  { href: '/colaboradores', label: 'Colaboradores', roles: ['admin', 'gerencia'], icon: Users },
  { href: '/importar', label: 'Importar', roles: ['admin', 'gerencia'], icon: Upload },
  { href: '/perfis', label: 'Perfis', roles: ['admin'], icon: ShieldCheck },
```

- [ ] **Step 11: Full suite, typecheck, lint, and build**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src && npm run build`
Expected: all tests pass, no new type errors, zero eslint errors, build succeeds.

- [ ] **Step 12: Commit**

```bash
git add src/features/importacao/components/pericias-preview-table.tsx src/features/importacao/components/pericias-preview-table.test.tsx src/features/importacao/components/importar-planilha-screen.tsx src/features/importacao/components/importar-planilha-screen.test.tsx "src/app/(app)/importar/page.tsx" src/components/shared/sidebar.tsx
git commit -m "feat: add Perícias/Processos import UI, route, and nav entry"
```

---

## Task 5: Tab 2 pure parsing functions

**Files:**
- Create: `src/features/importacao/lib/perito-colaborador-parser.ts`
- Create: `src/features/importacao/lib/perito-colaborador-parser.test.ts`

**Interfaces:**
- Consumes: `PeritoInput` from `../../peritos/schemas` (existing, for the `relacao`/`resultados` literal types).
- Produces: `mapJaTrabalhamos(texto: string): boolean`, `mapRelacao(texto: string): { relacao: PeritoInput['relacao']; reconhecida: boolean }`, `mapResultados(texto: string): { resultados: PeritoInput['resultados']; reconhecida: boolean }` — consumed by Task 6.

- [ ] **Step 1: Write the failing tests**

Create `src/features/importacao/lib/perito-colaborador-parser.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mapJaTrabalhamos, mapRelacao, mapResultados } from './perito-colaborador-parser';

describe('mapJaTrabalhamos', () => {
  it('maps "SIM" and "X" (case-insensitive) to true', () => {
    expect(mapJaTrabalhamos('SIM')).toBe(true);
    expect(mapJaTrabalhamos('sim')).toBe(true);
    expect(mapJaTrabalhamos('x')).toBe(true);
    expect(mapJaTrabalhamos('X')).toBe(true);
  });

  it('maps empty and "NÃO" to false', () => {
    expect(mapJaTrabalhamos('')).toBe(false);
    expect(mapJaTrabalhamos('NÃO')).toBe(false);
    expect(mapJaTrabalhamos('não')).toBe(false);
  });
});

describe('mapRelacao', () => {
  it('maps the known values case-insensitively', () => {
    expect(mapRelacao('BOA')).toEqual({ relacao: 'boa', reconhecida: true });
    expect(mapRelacao('otima')).toEqual({ relacao: 'otima', reconhecida: true });
    expect(mapRelacao('ruim')).toEqual({ relacao: 'ruim', reconhecida: true });
  });

  it('maps empty to neutra', () => {
    expect(mapRelacao('')).toEqual({ relacao: 'neutra', reconhecida: true });
  });

  it('flags an unrecognized value, defaulting to neutra', () => {
    expect(mapRelacao('excelente')).toEqual({ relacao: 'neutra', reconhecida: false });
  });
});

describe('mapResultados', () => {
  it('maps the known values case-insensitively', () => {
    expect(mapResultados('POSITIVO')).toEqual({ resultados: 'positivo', reconhecida: true });
    expect(mapResultados('negativo')).toEqual({ resultados: 'negativo', reconhecida: true });
  });

  it('maps empty to parcial', () => {
    expect(mapResultados('')).toEqual({ resultados: 'parcial', reconhecida: true });
  });

  it('flags an unrecognized value, defaulting to parcial', () => {
    expect(mapResultados('excelente')).toEqual({ resultados: 'parcial', reconhecida: false });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/importacao/lib/perito-colaborador-parser.test.ts`
Expected: FAIL — `./perito-colaborador-parser` does not exist.

- [ ] **Step 3: Write `perito-colaborador-parser.ts`**

Create `src/features/importacao/lib/perito-colaborador-parser.ts`:

```ts
import type { PeritoInput } from '../../peritos/schemas';

export function mapJaTrabalhamos(texto: string): boolean {
  const trimmed = texto.trim().toLowerCase();
  return trimmed === 'sim' || trimmed === 'x';
}

const RELACAO_VALORES: PeritoInput['relacao'][] = ['ruim', 'neutra', 'boa', 'otima'];

export function mapRelacao(texto: string): { relacao: PeritoInput['relacao']; reconhecida: boolean } {
  const trimmed = texto.trim().toLowerCase();
  if (!trimmed) return { relacao: 'neutra', reconhecida: true };
  const encontrada = RELACAO_VALORES.find((v) => v === trimmed);
  return encontrada ? { relacao: encontrada, reconhecida: true } : { relacao: 'neutra', reconhecida: false };
}

const RESULTADO_VALORES: PeritoInput['resultados'][] = ['negativo', 'parcial', 'positivo'];

export function mapResultados(texto: string): { resultados: PeritoInput['resultados']; reconhecida: boolean } {
  const trimmed = texto.trim().toLowerCase();
  if (!trimmed) return { resultados: 'parcial', reconhecida: true };
  const encontrada = RESULTADO_VALORES.find((v) => v === trimmed);
  return encontrada ? { resultados: encontrada, reconhecida: true } : { resultados: 'parcial', reconhecida: false };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/importacao/lib/perito-colaborador-parser.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Full suite, typecheck, lint**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass, no new type errors, zero eslint errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/importacao/lib/perito-colaborador-parser.ts src/features/importacao/lib/perito-colaborador-parser.test.ts
git commit -m "feat: add Perito/Colaborador field-mapping parsers"
```

---

## Task 6: Tab 2 preview server action

**Files:**
- Modify: `src/features/importacao/actions.ts`
- Modify: `src/features/importacao/actions.test.ts`

**Interfaces:**
- Consumes: `mapJaTrabalhamos`/`mapRelacao`/`mapResultados` (Task 5); `encontrarLinhaComTexto`, `encontrarIndiceColuna` (Task 1); `listPeritos`, `listColaboradores` (already imported); `PeritoPreviewRow`, `ColaboradorPreviewRow`, `PreviewImportacaoPeritosColaboradoresResult` (Task 1).
- Produces: `previewImportacaoPeritosColaboradores(fileBuffer: ArrayBuffer): Promise<PreviewImportacaoPeritosColaboradoresResult>` — consumed by Task 8 (UI).

- [ ] **Step 1: Write the failing tests**

Add to `src/features/importacao/actions.test.ts`:

```ts
import { previewImportacaoPeritosColaboradores } from './actions';

async function criarPlanilhaPeritosColaboradores(linhas: (string | number)[][]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Peritos e Colaboradores');
  linhas.forEach((linha) => worksheet.addRow(linha));
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

describe('previewImportacaoPeritosColaboradores', () => {
  beforeEach(() => {
    mockListPeritos.mockResolvedValue([]);
    mockListColaboradores.mockResolvedValue([]);
  });

  it('splits the sheet into Colaborador rows (before "PERITO") and Perito rows (from "PERITO" onward)', async () => {
    const buffer = await criarPlanilhaPeritosColaboradores([
      ['COLABORADORES ÉTICA', 'CONTATO'],
      ['Ana', '31999990000'],
      [],
      ['PERITO', 'CONTATO', 'FORMAÇÃO', 'CREA', 'CPF', 'JÁ TRABALHAMOS?', 'RELAÇÃO', 'RESULTADOS'],
      ['Carlos', '31988880000', 'Eng. Civil', 'CREA-123', '111.222.333-44', 'SIM', 'boa', 'positivo'],
    ]);

    const result = await previewImportacaoPeritosColaboradores(buffer);

    expect(result.colaboradores).toEqual([
      expect.objectContaining({ nome: 'Ana', contato: '31999990000', status: 'ok', idExistente: null }),
    ]);
    expect(result.peritos).toEqual([
      expect.objectContaining({
        nome: 'Carlos', contato: '31988880000', formacao: 'Eng. Civil', crea: 'CREA-123',
        documento: '111.222.333-44', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo',
        status: 'ok', idExistente: null,
      }),
    ]);
  });

  it('marks a colaborador/perito name that already exists with its existing id', async () => {
    mockListColaboradores.mockResolvedValue([{ id: 5, nome: 'Ana', contato: '', formacao: '' }]);
    const buffer = await criarPlanilhaPeritosColaboradores([
      ['COLABORADORES ÉTICA', 'CONTATO'],
      ['Ana', '31999990000'],
      ['PERITO', 'CONTATO', 'FORMAÇÃO', 'CREA', 'CPF', 'JÁ TRABALHAMOS?', 'RELAÇÃO', 'RESULTADOS'],
    ]);

    const result = await previewImportacaoPeritosColaboradores(buffer);

    expect(result.colaboradores[0].idExistente).toBe(5);
  });

  it('flags an unrecognized relação/resultados as atencao', async () => {
    const buffer = await criarPlanilhaPeritosColaboradores([
      ['COLABORADORES ÉTICA', 'CONTATO'],
      ['PERITO', 'CONTATO', 'FORMAÇÃO', 'CREA', 'CPF', 'JÁ TRABALHAMOS?', 'RELAÇÃO', 'RESULTADOS'],
      ['Carlos', '', '', '', '', '', 'excelente', 'positivo'],
    ]);

    const result = await previewImportacaoPeritosColaboradores(buffer);

    expect(result.peritos[0].status).toBe('atencao');
    expect(result.peritos[0].motivo).toBe('relação não reconhecida');
  });

  it('finds columns identified by header text even when reordered', async () => {
    const buffer = await criarPlanilhaPeritosColaboradores([
      ['COLABORADORES ÉTICA', 'CONTATO'],
      ['PERITO', 'FORMAÇÃO', 'CONTATO', 'RESULTADOS', 'RELAÇÃO', 'JÁ TRABALHAMOS?', 'CREA', 'CPF'],
      ['Carlos', 'Eng. Civil', '31988880000', 'positivo', 'boa', 'SIM', 'CREA-123', '111.222.333-44'],
    ]);

    const result = await previewImportacaoPeritosColaboradores(buffer);

    expect(result.peritos[0]).toMatchObject({
      nome: 'Carlos', formacao: 'Eng. Civil', contato: '31988880000',
      resultados: 'positivo', relacao: 'boa', jaTrabalhamos: true, crea: 'CREA-123', documento: '111.222.333-44',
    });
  });

  it('returns an empty result when the "PERITO" header row is never found', async () => {
    const buffer = await criarPlanilhaPeritosColaboradores([['COLABORADORES ÉTICA', 'CONTATO'], ['Ana', '31999990000']]);

    const result = await previewImportacaoPeritosColaboradores(buffer);

    expect(result.colaboradores).toEqual([]);
    expect(result.peritos).toEqual([]);
    expect(result.naoProcessadas).toEqual([
      { linhaOriginal: 0, texto: '', motivo: 'não foi possível encontrar o cabeçalho "PERITO" na planilha' },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/importacao/actions.test.ts`
Expected: FAIL — `previewImportacaoPeritosColaboradores` does not exist.

- [ ] **Step 3: Write `previewImportacaoPeritosColaboradores`**

In `src/features/importacao/actions.ts`, update the imports:

```ts
import { mapJaTrabalhamos, mapRelacao, mapResultados } from './lib/perito-colaborador-parser';
import { encontrarIndiceColuna, encontrarLinhaComTexto } from './lib/header-lookup';
import type {
  NaoProcessada, PericiaPreviewRow, PreviewImportacaoPericiasResult, RelatorioImportacaoPericias,
  ColaboradorPreviewRow, PeritoPreviewRow, PreviewImportacaoPeritosColaboradoresResult,
} from './types';
```

(this replaces the narrower `encontrarIndiceColuna`-only import and the narrower `types` import already present). Add at the end of the file:

```ts
const COLUNAS_COLABORADOR_ACEITAS: Record<string, string[]> = {
  nome: ['COLABORADORES ÉTICA', 'COLABORADORES ETICA', 'COLABORADOR'],
  contato: ['CONTATO'],
};

const COLUNAS_PERITO_ACEITAS: Record<string, string[]> = {
  nome: ['PERITO'],
  contato: ['CONTATO'],
  formacao: ['FORMAÇÃO', 'FORMACAO'],
  crea: ['CREA'],
  documento: ['CPF'],
  jaTrabalhamos: ['JÁ TRABALHAMOS?', 'JA TRABALHAMOS?', 'JÁ TRABALHAMOS', 'JA TRABALHAMOS'],
  relacao: ['RELAÇÃO', 'RELACAO'],
  resultados: ['RESULTADOS'],
};

export async function previewImportacaoPeritosColaboradores(
  fileBuffer: ArrayBuffer
): Promise<PreviewImportacaoPeritosColaboradoresResult> {
  await requireRole(['admin', 'gerencia']);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(fileBuffer));
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { colaboradores: [], peritos: [], naoProcessadas: [] };

  const linhaPerito = encontrarLinhaComTexto(worksheet, 'PERITO');
  if (linhaPerito === null) {
    return {
      colaboradores: [], peritos: [],
      naoProcessadas: [{ linhaOriginal: 0, texto: '', motivo: 'não foi possível encontrar o cabeçalho "PERITO" na planilha' }],
    };
  }

  const [peritosAtuais, colaboradoresAtuais] = await Promise.all([listPeritos(), listColaboradores()]);

  const headerColaboradorRow = worksheet.getRow(1);
  const indicesColaborador = Object.fromEntries(
    Object.entries(COLUNAS_COLABORADOR_ACEITAS).map(([chave, nomes]) => [chave, encontrarIndiceColuna(headerColaboradorRow, nomes)])
  ) as Record<keyof typeof COLUNAS_COLABORADOR_ACEITAS, number | null>;

  const colaboradores: ColaboradorPreviewRow[] = [];
  for (let rowNumber = 2; rowNumber < linhaPerito; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const nome = textoCelula(row, indicesColaborador.nome);
    if (!nome.trim()) continue;
    const contato = textoCelula(row, indicesColaborador.contato);
    const existente = colaboradoresAtuais.find((c) => normalizeForSearch(c.nome) === normalizeForSearch(nome));
    colaboradores.push({
      linhaOriginal: rowNumber, status: 'ok', motivo: null, nome, contato, idExistente: existente?.id ?? null,
    });
  }

  const headerPeritoRow = worksheet.getRow(linhaPerito);
  const indicesPerito = Object.fromEntries(
    Object.entries(COLUNAS_PERITO_ACEITAS).map(([chave, nomes]) => [chave, encontrarIndiceColuna(headerPeritoRow, nomes)])
  ) as Record<keyof typeof COLUNAS_PERITO_ACEITAS, number | null>;

  const peritos: PeritoPreviewRow[] = [];
  for (let rowNumber = linhaPerito + 1; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const nome = textoCelula(row, indicesPerito.nome);
    if (!nome.trim()) continue;

    const motivos: string[] = [];
    const { relacao, reconhecida: relacaoReconhecida } = mapRelacao(textoCelula(row, indicesPerito.relacao));
    if (!relacaoReconhecida) motivos.push('relação não reconhecida');
    const { resultados, reconhecida: resultadosReconhecida } = mapResultados(textoCelula(row, indicesPerito.resultados));
    if (!resultadosReconhecida) motivos.push('resultados não reconhecido');

    const existente = peritosAtuais.find((p) => normalizeForSearch(p.nome) === normalizeForSearch(nome));
    peritos.push({
      linhaOriginal: rowNumber,
      status: motivos.length > 0 ? 'atencao' : 'ok',
      motivo: motivos[0] ?? null,
      nome,
      contato: textoCelula(row, indicesPerito.contato),
      formacao: textoCelula(row, indicesPerito.formacao),
      crea: textoCelula(row, indicesPerito.crea),
      documento: textoCelula(row, indicesPerito.documento),
      jaTrabalhamos: mapJaTrabalhamos(textoCelula(row, indicesPerito.jaTrabalhamos)),
      relacao,
      resultados,
      idExistente: existente?.id ?? null,
    });
  }

  return { colaboradores, peritos, naoProcessadas: [] };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/importacao/actions.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Full suite, typecheck, lint**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass, no new type errors, zero eslint errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/importacao/actions.ts src/features/importacao/actions.test.ts
git commit -m "feat: add preview server action for Peritos/Colaboradores import"
```

---

## Task 7: Tab 2 confirm server action

**Files:**
- Modify: `src/features/importacao/actions.ts`
- Modify: `src/features/importacao/actions.test.ts`

**Interfaces:**
- Consumes: `ColaboradorPreviewRow`, `PeritoPreviewRow`, `RelatorioImportacaoPeritosColaboradores` (Task 1); `createColaborador`/`updateColaborador` (`../colaboradores/actions`), `createPerito`/`updatePerito` (`../peritos/actions`) — existing.
- Produces: `confirmarImportacaoPeritosColaboradores(colaboradores: ColaboradorPreviewRow[], peritos: PeritoPreviewRow[]): Promise<RelatorioImportacaoPeritosColaboradores>` — consumed by Task 8 (UI).

- [ ] **Step 1: Write the failing tests**

Add to `src/features/importacao/actions.test.ts`. First extend the `colaboradores/actions` and `peritos/actions` mocks (already present from Task 3) with `updateColaborador`/`updatePerito`:

```ts
const mockUpdateColaborador = vi.fn();
const mockUpdatePerito = vi.fn();

vi.mock('@/features/peritos/actions', () => ({
  listPeritos: (...args: unknown[]) => mockListPeritos(...args),
  createPerito: (...args: unknown[]) => mockCreatePerito(...args),
  updatePerito: (...args: unknown[]) => mockUpdatePerito(...args),
}));
vi.mock('@/features/colaboradores/actions', () => ({
  listColaboradores: (...args: unknown[]) => mockListColaboradores(...args),
  createColaborador: (...args: unknown[]) => mockCreateColaborador(...args),
  updateColaborador: (...args: unknown[]) => mockUpdateColaborador(...args),
}));
```

(replacing the two narrower `vi.mock` calls for these modules already present from Task 3). Then add:

```ts
import { confirmarImportacaoPeritosColaboradores } from './actions';
import type { ColaboradorPreviewRow, PeritoPreviewRow } from './types';

describe('confirmarImportacaoPeritosColaboradores', () => {
  beforeEach(() => {
    mockCreateColaborador.mockResolvedValue({ success: true, data: { id: 5, nome: 'Ana' } });
    mockUpdateColaborador.mockResolvedValue({ success: true, data: { id: 5, nome: 'Ana' } });
    mockCreatePerito.mockResolvedValue({ success: true, data: { id: 6, nome: 'Carlos' } });
    mockUpdatePerito.mockResolvedValue({ success: true, data: { id: 6, nome: 'Carlos' } });
  });

  it('creates a new colaborador when idExistente is null', async () => {
    const colaborador: ColaboradorPreviewRow = {
      linhaOriginal: 2, status: 'ok', motivo: null, nome: 'Ana', contato: '31999990000', idExistente: null,
    };
    const relatorio = await confirmarImportacaoPeritosColaboradores([colaborador], []);

    expect(mockCreateColaborador).toHaveBeenCalledWith({ nome: 'Ana', contato: '31999990000', formacao: '' });
    expect(relatorio.colaboradoresCriados).toBe(1);
  });

  it('overwrites an existing colaborador when idExistente is set', async () => {
    const colaborador: ColaboradorPreviewRow = {
      linhaOriginal: 2, status: 'ok', motivo: null, nome: 'Ana', contato: '31999990000', idExistente: 5,
    };
    const relatorio = await confirmarImportacaoPeritosColaboradores([colaborador], []);

    expect(mockUpdateColaborador).toHaveBeenCalledWith(5, { nome: 'Ana', contato: '31999990000', formacao: '' });
    expect(relatorio.colaboradoresAtualizados).toBe(1);
  });

  it('creates a new perito with all fields when idExistente is null', async () => {
    const perito: PeritoPreviewRow = {
      linhaOriginal: 2, status: 'ok', motivo: null, nome: 'Carlos', contato: '31988880000',
      formacao: 'Eng. Civil', crea: 'CREA-123', documento: '111.222.333-44',
      jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo', idExistente: null,
    };
    const relatorio = await confirmarImportacaoPeritosColaboradores([], [perito]);

    expect(mockCreatePerito).toHaveBeenCalledWith({
      nome: 'Carlos', contato: '31988880000', formacao: 'Eng. Civil', crea: 'CREA-123',
      documento: '111.222.333-44', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo',
    });
    expect(relatorio.peritosCriados).toBe(1);
  });

  it('overwrites an existing perito with all fields when idExistente is set', async () => {
    const perito: PeritoPreviewRow = {
      linhaOriginal: 2, status: 'ok', motivo: null, nome: 'Carlos', contato: '31988880000',
      formacao: 'Eng. Civil', crea: 'CREA-123', documento: '111.222.333-44',
      jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo', idExistente: 6,
    };
    const relatorio = await confirmarImportacaoPeritosColaboradores([], [perito]);

    expect(mockUpdatePerito).toHaveBeenCalledWith(6, {
      nome: 'Carlos', contato: '31988880000', formacao: 'Eng. Civil', crea: 'CREA-123',
      documento: '111.222.333-44', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo',
    });
    expect(relatorio.peritosAtualizados).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/importacao/actions.test.ts`
Expected: FAIL — `confirmarImportacaoPeritosColaboradores` does not exist.

- [ ] **Step 3: Write `confirmarImportacaoPeritosColaboradores`**

In `src/features/importacao/actions.ts`, update the imports:

```ts
import { createPerito, updatePerito, listPeritos } from '@/features/peritos/actions';
import { createColaborador, updateColaborador, listColaboradores } from '@/features/colaboradores/actions';
```

(replacing the earlier, narrower imports of these two modules). Add at the end of the file:

```ts
export async function confirmarImportacaoPeritosColaboradores(
  colaboradores: ColaboradorPreviewRow[],
  peritos: PeritoPreviewRow[]
): Promise<RelatorioImportacaoPeritosColaboradores> {
  await requireRole(['admin', 'gerencia']);

  const relatorio: RelatorioImportacaoPeritosColaboradores = {
    peritosCriados: 0, peritosAtualizados: 0, colaboradoresCriados: 0, colaboradoresAtualizados: 0,
  };

  for (const linha of colaboradores) {
    const input = { nome: linha.nome, contato: linha.contato, formacao: '' };
    if (linha.idExistente) {
      const resultado = await updateColaborador(linha.idExistente, input);
      if (resultado.success) relatorio.colaboradoresAtualizados++;
    } else {
      const resultado = await createColaborador(input);
      if (resultado.success) relatorio.colaboradoresCriados++;
    }
  }

  for (const linha of peritos) {
    const input = {
      nome: linha.nome, contato: linha.contato, formacao: linha.formacao, crea: linha.crea,
      documento: linha.documento, jaTrabalhamos: linha.jaTrabalhamos, relacao: linha.relacao, resultados: linha.resultados,
    };
    if (linha.idExistente) {
      const resultado = await updatePerito(linha.idExistente, input);
      if (resultado.success) relatorio.peritosAtualizados++;
    } else {
      const resultado = await createPerito(input);
      if (resultado.success) relatorio.peritosCriados++;
    }
  }

  return relatorio;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/importacao/actions.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Full suite, typecheck, lint**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: all pass, no new type errors, zero eslint errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/importacao/actions.ts src/features/importacao/actions.test.ts
git commit -m "feat: add confirm server action for Peritos/Colaboradores import"
```

---

## Task 8: Tab 2 UI (second tab) + final verification

**Files:**
- Create: `src/features/importacao/components/peritos-colaboradores-preview-table.tsx`
- Create: `src/features/importacao/components/peritos-colaboradores-preview-table.test.tsx`
- Modify: `src/features/importacao/components/importar-planilha-screen.tsx`
- Modify: `src/features/importacao/components/importar-planilha-screen.test.tsx`

**Interfaces:**
- Consumes: `previewImportacaoPeritosColaboradores`, `confirmarImportacaoPeritosColaboradores` (Tasks 6-7); `ColaboradorPreviewRow`, `PeritoPreviewRow`, `RelatorioImportacaoPeritosColaboradores` (Task 1); `relacaoOptions`, `resultadoOptions` from `../../peritos/schemas` (existing); `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` — check `src/components/ui/` for an existing tabs primitive first; if none exists, this task adds one wrapping Base UI's `Tabs` component following the same thin-wrapper pattern as every other `src/components/ui/*.tsx` file in this project (e.g. `select.tsx`, `dialog.tsx`) rather than hand-rolling tab-switching state.
- Produces: `PeritosColaboradoresPreviewTable({ colaboradores, peritos, onChangeColaboradores, onChangePeritos }: {...})` — leaf of this plan.

- [ ] **Step 1: Check whether a Tabs primitive already exists**

Run: `ls src/components/ui/ | grep -i tab`
If a `tabs.tsx` already exists, read it and reuse its exports (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`) in Step 6 below instead of creating a new one, and skip Step 2. If it does not exist, proceed to Step 2.

- [ ] **Step 2: Create the Tabs UI primitive (only if Step 1 found none)**

Create `src/components/ui/tabs.tsx`, following the same thin-wrapper-over-Base-UI pattern as `src/components/ui/select.tsx`:

```tsx
"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1", className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex flex-1 items-center justify-center rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap outline-none data-selected:bg-background data-selected:text-foreground data-selected:shadow-sm",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("mt-4 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
```

Confirm `@base-ui/react/tabs` exports `Root`/`List`/`Tab`/`Panel` with this shape before proceeding — run `grep -n "export" node_modules/@base-ui/react/tabs/index.d.ts` (or equivalent) and adjust the sub-component names above to match if they differ (Base UI's actual export names take precedence over this snippet).

- [ ] **Step 3: Write the failing tests for `PeritosColaboradoresPreviewTable`**

Create `src/features/importacao/components/peritos-colaboradores-preview-table.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PeritosColaboradoresPreviewTable } from './peritos-colaboradores-preview-table';
import type { ColaboradorPreviewRow, PeritoPreviewRow } from '../types';

function colaboradorBase(overrides: Partial<ColaboradorPreviewRow> = {}): ColaboradorPreviewRow {
  return { linhaOriginal: 2, status: 'ok', motivo: null, nome: 'Ana', contato: '31999990000', idExistente: null, ...overrides };
}

function peritoBase(overrides: Partial<PeritoPreviewRow> = {}): PeritoPreviewRow {
  return {
    linhaOriginal: 2, status: 'ok', motivo: null, nome: 'Carlos', contato: '31988880000',
    formacao: 'Eng. Civil', crea: 'CREA-123', documento: '111.222.333-44',
    jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo', idExistente: null,
    ...overrides,
  };
}

describe('PeritosColaboradoresPreviewTable', () => {
  it('shows colaborador rows in one table and perito rows in another', () => {
    render(
      <PeritosColaboradoresPreviewTable
        colaboradores={[colaboradorBase()]}
        peritos={[peritoBase()]}
        onChangeColaboradores={vi.fn()}
        onChangePeritos={vi.fn()}
      />
    );
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Carlos')).toBeInTheDocument();
  });

  it('lets the user edit a flagged relação via the select', async () => {
    const user = userEvent.setup();
    const onChangePeritos = vi.fn();
    render(
      <PeritosColaboradoresPreviewTable
        colaboradores={[]}
        peritos={[peritoBase({ status: 'atencao', motivo: 'relação não reconhecida' })]}
        onChangeColaboradores={vi.fn()}
        onChangePeritos={onChangePeritos}
      />
    );

    await user.click(screen.getByRole('combobox', { name: /relação/i }));
    await user.click(await screen.findByRole('option', { name: 'otima' }));

    expect(onChangePeritos).toHaveBeenCalledWith([expect.objectContaining({ relacao: 'otima' })]);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run src/features/importacao/components/peritos-colaboradores-preview-table.test.tsx`
Expected: FAIL — `./peritos-colaboradores-preview-table` does not exist.

- [ ] **Step 5: Write `PeritosColaboradoresPreviewTable`**

Create `src/features/importacao/components/peritos-colaboradores-preview-table.tsx`:

```tsx
'use client';

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { relacaoOptions, resultadoOptions, type PeritoInput } from '../../peritos/schemas';
import { cn } from '@/lib/utils';
import type { ColaboradorPreviewRow, PeritoPreviewRow } from '../types';

export function PeritosColaboradoresPreviewTable({
  colaboradores,
  peritos,
  onChangeColaboradores,
  onChangePeritos,
}: {
  colaboradores: ColaboradorPreviewRow[];
  peritos: PeritoPreviewRow[];
  onChangeColaboradores: (linhas: ColaboradorPreviewRow[]) => void;
  onChangePeritos: (linhas: PeritoPreviewRow[]) => void;
}) {
  function atualizarColaborador(index: number, patch: Partial<ColaboradorPreviewRow>) {
    onChangeColaboradores(colaboradores.map((linha, i) => (i === index ? { ...linha, ...patch } : linha)));
  }
  function atualizarPerito(index: number, patch: Partial<PeritoPreviewRow>) {
    onChangePeritos(peritos.map((linha, i) => (i === index ? { ...linha, ...patch } : linha)));
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Colaboradores</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Contato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {colaboradores.map((linha, index) => (
              <TableRow key={linha.linhaOriginal} className={cn(linha.status === 'atencao' && 'bg-destructive/10')}>
                <TableCell>
                  <Input value={linha.nome} onChange={(e) => atualizarColaborador(index, { nome: e.target.value })} />
                </TableCell>
                <TableCell>
                  <Input value={linha.contato} onChange={(e) => atualizarColaborador(index, { contato: e.target.value })} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Peritos</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Formação</TableHead>
              <TableHead>CREA</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Já trabalhamos?</TableHead>
              <TableHead>Relação</TableHead>
              <TableHead>Resultados</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {peritos.map((linha, index) => (
              <TableRow key={linha.linhaOriginal} className={cn(linha.status === 'atencao' && 'bg-destructive/10')}>
                <TableCell>
                  <Input value={linha.nome} onChange={(e) => atualizarPerito(index, { nome: e.target.value })} />
                </TableCell>
                <TableCell>
                  <Input value={linha.contato} onChange={(e) => atualizarPerito(index, { contato: e.target.value })} />
                </TableCell>
                <TableCell>
                  <Input value={linha.formacao} onChange={(e) => atualizarPerito(index, { formacao: e.target.value })} />
                </TableCell>
                <TableCell>
                  <Input value={linha.crea} onChange={(e) => atualizarPerito(index, { crea: e.target.value })} />
                </TableCell>
                <TableCell>
                  <Input value={linha.documento} onChange={(e) => atualizarPerito(index, { documento: e.target.value })} />
                </TableCell>
                <TableCell>
                  <Switch
                    checked={linha.jaTrabalhamos}
                    onCheckedChange={(checked) => atualizarPerito(index, { jaTrabalhamos: checked })}
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={linha.relacao}
                    onValueChange={(v) => atualizarPerito(index, { relacao: v as PeritoInput['relacao'] })}
                  >
                    <SelectTrigger aria-label="Relação"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {relacaoOptions.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={linha.resultados}
                    onValueChange={(v) => atualizarPerito(index, { resultados: v as PeritoInput['resultados'] })}
                  >
                    <SelectTrigger aria-label="Resultados"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {resultadoOptions.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/features/importacao/components/peritos-colaboradores-preview-table.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 7: Write the failing tests for the second tab in `ImportarPlanilhaScreen`**

Add to `src/features/importacao/components/importar-planilha-screen.test.tsx`, replacing the two placeholder mock functions in the top-of-file `vi.mock('../actions', ...)` (`previewImportacaoPeritosColaboradores`/`confirmarImportacaoPeritosColaboradores`, currently plain `vi.fn()`s) with tracked mocks:

```tsx
const mockPreviewPeritosColaboradores = vi.fn();
const mockConfirmarPeritosColaboradores = vi.fn();
vi.mock('../actions', () => ({
  previewImportacaoPericias: (...args: unknown[]) => mockPreviewPericias(...args),
  confirmarImportacaoPericias: (...args: unknown[]) => mockConfirmarPericias(...args),
  previewImportacaoPeritosColaboradores: (...args: unknown[]) => mockPreviewPeritosColaboradores(...args),
  confirmarImportacaoPeritosColaboradores: (...args: unknown[]) => mockConfirmarPeritosColaboradores(...args),
}));
```

Then add:

```tsx
describe('ImportarPlanilhaScreen — aba Peritos e Colaboradores', () => {
  it('shows the second tab, processes its upload, and confirms it independently from Tab 1', async () => {
    mockPreviewPeritosColaboradores.mockResolvedValue({
      colaboradores: [{ linhaOriginal: 2, status: 'ok', motivo: null, nome: 'Ana', contato: '', idExistente: null }],
      peritos: [],
      naoProcessadas: [],
    });
    mockConfirmarPeritosColaboradores.mockResolvedValue({
      peritosCriados: 0, peritosAtualizados: 0, colaboradoresCriados: 1, colaboradoresAtualizados: 0,
    });
    const user = userEvent.setup();
    render(<ImportarPlanilhaScreen />);

    await user.click(screen.getByRole('tab', { name: /peritos e colaboradores/i }));
    await user.upload(screen.getByLabelText(/planilha de peritos/i), arquivoFake());

    await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /confirmar importação/i }));

    await waitFor(() => expect(mockConfirmarPeritosColaboradores).toHaveBeenCalledWith(
      [expect.objectContaining({ nome: 'Ana' })],
      []
    ));
    expect(await screen.findByText(/1 colaborador\(es\) criado/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Run tests to verify they fail**

Run: `npx vitest run src/features/importacao/components/importar-planilha-screen.test.tsx`
Expected: FAIL — no second tab exists yet.

- [ ] **Step 9: Add the second tab to `ImportarPlanilhaScreen`**

Rewrite `src/features/importacao/components/importar-planilha-screen.tsx` in full:

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  previewImportacaoPericias, confirmarImportacaoPericias,
  previewImportacaoPeritosColaboradores, confirmarImportacaoPeritosColaboradores,
} from '../actions';
import type {
  PericiaPreviewRow, NaoProcessada, RelatorioImportacaoPericias,
  ColaboradorPreviewRow, PeritoPreviewRow, RelatorioImportacaoPeritosColaboradores,
} from '../types';
import { PericiasPreviewTable } from './pericias-preview-table';
import { PeritosColaboradoresPreviewTable } from './peritos-colaboradores-preview-table';

export function ImportarPlanilhaScreen() {
  const [linhas, setLinhas] = useState<PericiaPreviewRow[]>([]);
  const [naoProcessadas, setNaoProcessadas] = useState<NaoProcessada[]>([]);
  const [relatorio, setRelatorio] = useState<RelatorioImportacaoPericias | null>(null);
  const [processandoPericias, setProcessandoPericias] = useState(false);

  const [colaboradores, setColaboradores] = useState<ColaboradorPreviewRow[]>([]);
  const [peritos, setPeritos] = useState<PeritoPreviewRow[]>([]);
  const [naoProcessadasPeritos, setNaoProcessadasPeritos] = useState<NaoProcessada[]>([]);
  const [relatorioPeritos, setRelatorioPeritos] = useState<RelatorioImportacaoPeritosColaboradores | null>(null);
  const [processandoPeritos, setProcessandoPeritos] = useState(false);

  async function handleUploadPericias(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRelatorio(null);
    setProcessandoPericias(true);
    try {
      const buffer = await file.arrayBuffer();
      const resultado = await previewImportacaoPericias(buffer);
      setLinhas(resultado.linhas);
      setNaoProcessadas(resultado.naoProcessadas);
    } finally {
      setProcessandoPericias(false);
      e.target.value = '';
    }
  }

  async function handleConfirmarPericias() {
    setProcessandoPericias(true);
    try {
      const resultado = await confirmarImportacaoPericias(linhas);
      setRelatorio(resultado);
      setLinhas([]);
    } finally {
      setProcessandoPericias(false);
    }
  }

  async function handleUploadPeritos(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRelatorioPeritos(null);
    setProcessandoPeritos(true);
    try {
      const buffer = await file.arrayBuffer();
      const resultado = await previewImportacaoPeritosColaboradores(buffer);
      setColaboradores(resultado.colaboradores);
      setPeritos(resultado.peritos);
      setNaoProcessadasPeritos(resultado.naoProcessadas);
    } finally {
      setProcessandoPeritos(false);
      e.target.value = '';
    }
  }

  async function handleConfirmarPeritos() {
    setProcessandoPeritos(true);
    try {
      const resultado = await confirmarImportacaoPeritosColaboradores(colaboradores, peritos);
      setRelatorioPeritos(resultado);
      setColaboradores([]);
      setPeritos([]);
    } finally {
      setProcessandoPeritos(false);
    }
  }

  const podeConfirmarPericias = linhas.some((l) => l.status === 'ok' || l.status === 'atencao');
  const podeConfirmarPeritos = colaboradores.length > 0 || peritos.length > 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Importar planilha</h1>

      <Tabs defaultValue="pericias">
        <TabsList>
          <TabsTrigger value="pericias">Perícias e Processos</TabsTrigger>
          <TabsTrigger value="peritos">Peritos e Colaboradores</TabsTrigger>
        </TabsList>

        <TabsContent value="pericias" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="upload-pericias">Planilha de Perícias e Processos</Label>
            <input id="upload-pericias" type="file" accept=".xlsx" onChange={handleUploadPericias} disabled={processandoPericias} />
          </div>

          {linhas.length > 0 && (
            <>
              <PericiasPreviewTable linhas={linhas} onChange={setLinhas} />
              <Button type="button" onClick={handleConfirmarPericias} disabled={!podeConfirmarPericias || processandoPericias}>
                Confirmar importação
              </Button>
            </>
          )}

          {naoProcessadas.length > 0 && (
            <div className="space-y-1">
              <h2 className="text-sm font-medium text-muted-foreground">Linhas não processadas</h2>
              {naoProcessadas.map((n) => (
                <p key={n.linhaOriginal} className="text-sm">
                  Linha {n.linhaOriginal}: &quot;{n.texto}&quot; — {n.motivo}
                </p>
              ))}
            </div>
          )}

          {relatorio && (
            <div className="rounded-md border p-4 text-sm">
              <p>{relatorio.processosCriados} processo(s) criado(s), {relatorio.processosAtualizados} atualizado(s).</p>
              <p>{relatorio.periciasCriadas} perícia(s) criada(s).</p>
              <p>{relatorio.peritosCriados} perito(s) criado(s), {relatorio.colaboradoresCriados} colaborador(es) criado(s).</p>
              <p>{relatorio.puladasPorDuplicidade} linha(s) pulada(s) por duplicidade.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="peritos" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="upload-peritos">Planilha de Peritos e Colaboradores</Label>
            <input id="upload-peritos" type="file" accept=".xlsx" onChange={handleUploadPeritos} disabled={processandoPeritos} />
          </div>

          {(colaboradores.length > 0 || peritos.length > 0) && (
            <>
              <PeritosColaboradoresPreviewTable
                colaboradores={colaboradores}
                peritos={peritos}
                onChangeColaboradores={setColaboradores}
                onChangePeritos={setPeritos}
              />
              <Button type="button" onClick={handleConfirmarPeritos} disabled={!podeConfirmarPeritos || processandoPeritos}>
                Confirmar importação
              </Button>
            </>
          )}

          {naoProcessadasPeritos.length > 0 && (
            <div className="space-y-1">
              <h2 className="text-sm font-medium text-muted-foreground">Linhas não processadas</h2>
              {naoProcessadasPeritos.map((n) => (
                <p key={n.linhaOriginal} className="text-sm">{n.motivo}</p>
              ))}
            </div>
          )}

          {relatorioPeritos && (
            <div className="rounded-md border p-4 text-sm">
              <p>{relatorioPeritos.peritosCriados} perito(s) criado(s), {relatorioPeritos.peritosAtualizados} atualizado(s).</p>
              <p>{relatorioPeritos.colaboradoresCriados} colaborador(es) criado(s), {relatorioPeritos.colaboradoresAtualizados} atualizado(s).</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `npx vitest run src/features/importacao/components/importar-planilha-screen.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 11: Full suite, typecheck, lint, and build**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src && npm run build`
Expected: all tests pass, zero type errors, zero eslint errors, build succeeds.

- [ ] **Step 12: Commit**

```bash
git add src/components/ui/tabs.tsx src/features/importacao/components/peritos-colaboradores-preview-table.tsx src/features/importacao/components/peritos-colaboradores-preview-table.test.tsx src/features/importacao/components/importar-planilha-screen.tsx src/features/importacao/components/importar-planilha-screen.test.tsx
git commit -m "feat: add Peritos/Colaboradores import UI as the second tab"
```

(Omit `src/components/ui/tabs.tsx` from the `git add` if Step 1 found it already existed.)

---

## Manual verification (after all 8 tasks)

Every step below runs against the **dev** Supabase project (`wpssipdxpfmvcamldpum`) only — never production.

1. Run `npm run dev`, log in, open `/importar`. Confirm "Importar" appears in the sidebar between "Colaboradores" and "Perfis", and the page shows two tabs.
2. Build a small `.xlsx` test sheet for the Perícias/Processos tab with the columns from the spec (a header row + a few data rows), covering: a well-formed row with an existing processo número, a row with a brand-new processo número, a row whose PERÍCIA text has no " x " (Réu should preview as "Vale"), a row with a city name not in the IBGE base, a row with an unrecognized SITUAÇÃO value, and a row identical to an already-imported one (upload it twice) to see the "duplicada" status appear on the second upload.
3. Upload it. Confirm the preview table shows the right número/autor/réu split, "(novo)" next to any perito/colaborador name not already in the dev database, the município combobox in place of a city that didn't resolve, and the situação select on the flagged row.
4. Edit a couple of cells in the preview (situação, observações) and confirm the edit sticks before you click "Confirmar importação".
5. Click "Confirmar importação". Confirm the report numbers match what you expect, then check `/` (Perícias) and `/processos` to see the new/updated records for real.
6. Re-upload the exact same sheet. Confirm every previously-imported row now shows `duplicada` in the preview and the confirm step reports them as puladas, not re-created.
7. Switch to the Peritos e Colaboradores tab. Build a test sheet with a "COLABORADORES ÉTICA" section, a blank row, then a "PERITO" section with reordered columns (e.g. put FORMAÇÃO before CONTATO) to confirm the header-based column lookup still works. Include one perito name that already exists in the dev database and one that doesn't.
8. Upload, confirm the preview shows both sections, edit a relação/resultados value, confirm the import, and check `/peritos` and `/colaboradores` to see the existing perito's fields overwritten and the new one created.
