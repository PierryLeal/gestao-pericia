# Melhorias Pós-Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Categorizar Relação/Resultado do Perito em valores fixos coloridos, adicionar filtros novos em Perícias/Processos/Peritos/Colaboradores, e aplicar máscaras de telefone/CPF.

**Architecture:** Migration SQL para os novos enums Postgres, seguida de mudanças em schema/actions/componentes por feature, reaproveitando os padrões já existentes no projeto (`situacaoOptions`, `StatusBadge`, `ProcessoCombobox`/`MunicipioCombobox`, `PericiasFilters`).

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, Supabase (Postgres + supabase-js), Tailwind v4, Zod, Vitest + React Testing Library.

## Global Constraints

- Nenhuma biblioteca nova (máscaras são funções puras próprias, comboboxes reaproveitam `Command`/`Popover` já usados no projeto).
- Toda busca/filtro novo é resolvido no servidor via query param na URL (mesmo padrão de `PericiasFilters`), não filtro client-side.
- Cores de badge reaproveitam os tokens `--status-*`/`--muted-foreground` já existentes em `globals.css` — nenhuma variável CSS nova.
- Enums novos seguem a convenção já usada por `pericia_situacao`: minúsculo, sem acento, em inglês semântico do domínio (ex: `otima`, não `Ótima`).

---

## Task 1: Migration + schema/tipos para Relação/Resultado categorizados

**Files:**
- Create: `supabase/migrations/20260729000001_perito_categorias.sql`
- Modify: `src/lib/supabase/database.types.ts`
- Modify: `src/features/peritos/schemas.ts`
- Test: `src/features/peritos/schemas.test.ts`

**Interfaces:**
- Produces: `relacaoOptions = ['ruim', 'neutra', 'boa', 'otima']`, `resultadoOptions = ['negativo', 'parcial', 'positivo']`, `RelacaoValue`, `ResultadoValue` types, exported from `schemas.ts`. Consumed by Tasks 2-5.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260729000001_perito_categorias.sql`:

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

alter table public.peritos add column resultados_new public.perito_resultado;
update public.peritos set resultados_new = case
  when resultados <= 3 then 'negativo'
  when resultados <= 6 then 'parcial'
  else 'positivo'
end::public.perito_resultado;
alter table public.peritos alter column resultados_new set not null;
alter table public.peritos alter column resultados_new set default 'parcial';
alter table public.peritos drop column resultados;
alter table public.peritos rename column resultados_new to resultados;
```

- [ ] **Step 2: Apply the migration**

Run: `supabase db push` (or the project's equivalent command for applying migrations to the linked Supabase project — check `package.json` scripts / README for the exact command used so far in this repo before running).
Expected: migration applies without error; `select relacao, resultados from peritos limit 5;` in the Supabase SQL editor shows the new text values, not numbers.

- [ ] **Step 3: Update generated types**

In `src/lib/supabase/database.types.ts`, replace the `peritos` table's `relacao`/`resultados` fields (currently `number`) with the new union types. Add the type aliases near the top, next to `PericiaSituacao`:

```ts
export type PericiaSituacao = 'pendente' | 'marcada' | 'realizada' | 'cancelada';
export type ProfileRoleValue = 'pendente' | 'gerencia' | 'admin';
export type PeritoRelacao = 'ruim' | 'neutra' | 'boa' | 'otima';
export type PeritoResultado = 'negativo' | 'parcial' | 'positivo';
```

Then in the `peritos` table definition, change:

```ts
      peritos: {
        Row: {
          id: number; nome: string; contato: string; formacao: string; crea: string;
          documento: string; ja_trabalhamos: boolean; relacao: PeritoRelacao; resultados: PeritoResultado;
          created_at: string;
        };
        Insert: {
          nome: string; contato?: string; formacao?: string; crea?: string; documento?: string;
          ja_trabalhamos?: boolean; relacao?: PeritoRelacao; resultados?: PeritoResultado;
        };
        Update: Partial<Database['public']['Tables']['peritos']['Insert']>;
        Relationships: [];
      };
```

- [ ] **Step 4: Write the failing schema test**

Create `src/features/peritos/schemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { peritoSchema, relacaoOptions, resultadoOptions } from './schemas';

describe('peritoSchema', () => {
  it('accepts the known relacao and resultado values', () => {
    const result = peritoSchema.safeParse({
      nome: 'Carlos', relacao: 'boa', resultados: 'positivo',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a relacao value outside the fixed set', () => {
    const result = peritoSchema.safeParse({ nome: 'Carlos', relacao: 'excelente' });
    expect(result.success).toBe(false);
  });

  it('exports the exact option lists used by the UI', () => {
    expect(relacaoOptions).toEqual(['ruim', 'neutra', 'boa', 'otima']);
    expect(resultadoOptions).toEqual(['negativo', 'parcial', 'positivo']);
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npm run test -- src/features/peritos/schemas`
Expected: FAIL — `relacaoOptions`/`resultadoOptions` don't exist, `relacao`/`resultados` still typed as numbers.

- [ ] **Step 6: Update the schema**

Replace `src/features/peritos/schemas.ts`:

```ts
import { z } from 'zod';

export const relacaoOptions = ['ruim', 'neutra', 'boa', 'otima'] as const;
export const resultadoOptions = ['negativo', 'parcial', 'positivo'] as const;

export const peritoSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório'),
  contato: z.string().trim().default(''),
  formacao: z.string().trim().default(''),
  crea: z.string().trim().default(''),
  documento: z.string().trim().default(''),
  jaTrabalhamos: z.boolean().default(false),
  relacao: z.enum(relacaoOptions).default('neutra'),
  resultados: z.enum(resultadoOptions).default('parcial'),
});

export type PeritoInput = z.infer<typeof peritoSchema>;
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm run test -- src/features/peritos/schemas`
Expected: all 3 pass.

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: errors in `perito-form.tsx`, `peritos-table.tsx`, `pericias-table.tsx`, and their tests — `relacao`/`resultados` are no longer numbers. That's expected; Tasks 3-5 fix those call sites.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260729000001_perito_categorias.sql src/lib/supabase/database.types.ts src/features/peritos/schemas.ts src/features/peritos/schemas.test.ts
git commit -m "feat: categorize perito relacao/resultados into fixed enum values"
```

---

## Task 2: RelacaoBadge / ResultadoBadge

**Files:**
- Create: `src/components/shared/relacao-badge.tsx`
- Create: `src/components/shared/resultado-badge.tsx`
- Test: `src/components/shared/relacao-badge.test.tsx`
- Test: `src/components/shared/resultado-badge.test.tsx`

**Interfaces:**
- Consumes: `relacaoOptions`/`resultadoOptions`/types from Task 1's `schemas.ts`.
- Produces: `<RelacaoBadge relacao={...} />`, `<ResultadoBadge resultado={...} />`. Consumed by Tasks 4-5.

- [ ] **Step 1: Write the failing tests**

Create `src/components/shared/relacao-badge.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RelacaoBadge } from './relacao-badge';

describe('RelacaoBadge', () => {
  it.each([
    ['ruim', 'Ruim'],
    ['neutra', 'Neutra'],
    ['boa', 'Boa'],
    ['otima', 'Ótima'],
  ] as const)('renders the label for %s', (relacao, label) => {
    render(<RelacaoBadge relacao={relacao} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
```

Create `src/components/shared/resultado-badge.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ResultadoBadge } from './resultado-badge';

describe('ResultadoBadge', () => {
  it.each([
    ['negativo', 'Negativo'],
    ['parcial', 'Parcial'],
    ['positivo', 'Positivo'],
  ] as const)('renders the label for %s', (resultado, label) => {
    render(<ResultadoBadge resultado={resultado} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/components/shared/relacao-badge src/components/shared/resultado-badge`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Write RelacaoBadge**

Create `src/components/shared/relacao-badge.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import type { PeritoRelacao } from '@/lib/supabase/database.types';

const STYLES: Record<PeritoRelacao, string> = {
  ruim: 'bg-[var(--status-cancelada)]/15 text-[var(--status-cancelada)]',
  neutra: 'bg-muted-foreground/15 text-muted-foreground',
  boa: 'bg-[var(--status-marcada)]/15 text-[var(--status-marcada)]',
  otima: 'bg-[var(--status-realizada)]/15 text-[var(--status-realizada)]',
};

const LABELS: Record<PeritoRelacao, string> = {
  ruim: 'Ruim',
  neutra: 'Neutra',
  boa: 'Boa',
  otima: 'Ótima',
};

export function RelacaoBadge({ relacao }: { relacao: PeritoRelacao }) {
  return <Badge className={STYLES[relacao]}>{LABELS[relacao]}</Badge>;
}
```

- [ ] **Step 4: Write ResultadoBadge**

Create `src/components/shared/resultado-badge.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import type { PeritoResultado } from '@/lib/supabase/database.types';

const STYLES: Record<PeritoResultado, string> = {
  negativo: 'bg-[var(--status-cancelada)]/15 text-[var(--status-cancelada)]',
  parcial: 'bg-muted-foreground/15 text-muted-foreground',
  positivo: 'bg-[var(--status-realizada)]/15 text-[var(--status-realizada)]',
};

const LABELS: Record<PeritoResultado, string> = {
  negativo: 'Negativo',
  parcial: 'Parcial',
  positivo: 'Positivo',
};

export function ResultadoBadge({ resultado }: { resultado: PeritoResultado }) {
  return <Badge className={STYLES[resultado]}>{LABELS[resultado]}</Badge>;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test -- src/components/shared/relacao-badge src/components/shared/resultado-badge`
Expected: all 7 pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/relacao-badge.tsx src/components/shared/resultado-badge.tsx src/components/shared/relacao-badge.test.tsx src/components/shared/resultado-badge.test.tsx
git commit -m "feat: add RelacaoBadge and ResultadoBadge components"
```

---

## Task 3: PeritoForm — selects em vez de números

**Files:**
- Modify: `src/features/peritos/components/perito-form.tsx`
- Modify: `src/features/peritos/components/perito-form.test.tsx`

**Interfaces:**
- Consumes: `relacaoOptions`/`resultadoOptions` (Task 1).
- Produces: no change to `PeritoForm`'s own props — `perito.relacao`/`perito.resultados` are now strings, not numbers.

- [ ] **Step 1: Update the failing test**

Replace `src/features/peritos/components/perito-form.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PeritoForm } from './perito-form';

vi.mock('../actions', () => ({
  createPerito: vi.fn(async () => ({ success: false, error: 'Nome é obrigatório' })),
  updatePerito: vi.fn(),
}));

describe('PeritoForm', () => {
  it('calls onError with the message returned by the action when validation fails', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    render(<PeritoForm onSaved={vi.fn()} onError={onError} />);

    await user.click(screen.getByRole('button', { name: /salvar perito/i }));

    expect(onError).toHaveBeenCalledWith('Nome é obrigatório');
  });

  it('pre-fills fields when editing an existing perito', () => {
    render(
      <PeritoForm
        perito={{
          id: 1, nome: 'Carlos', contato: '11999999999', formacao: 'Eng.', crea: '123',
          documento: '000', jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo',
        }}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Nome')).toHaveValue('Carlos');
    expect(screen.getByRole('combobox', { name: /relação/i })).toHaveTextContent('Boa');
    expect(screen.getByRole('combobox', { name: /resultado/i })).toHaveTextContent('Positivo');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/features/peritos/components/perito-form`
Expected: FAIL — `perito-form.tsx` still uses number inputs, `perito.relacao`/`resultados` type mismatch.

- [ ] **Step 3: Rewrite PeritoForm**

Replace `src/features/peritos/components/perito-form.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createPerito, updatePerito, type Perito } from '../actions';
import { relacaoOptions, resultadoOptions, type PeritoInput } from '../schemas';

const RELACAO_LABELS: Record<(typeof relacaoOptions)[number], string> = {
  ruim: 'Ruim', neutra: 'Neutra', boa: 'Boa', otima: 'Ótima',
};
const RESULTADO_LABELS: Record<(typeof resultadoOptions)[number], string> = {
  negativo: 'Negativo', parcial: 'Parcial', positivo: 'Positivo',
};

export function PeritoForm({
  perito,
  onSaved,
  onError,
}: {
  perito?: Perito;
  onSaved: (perito: Perito) => void;
  onError: (message: string) => void;
}) {
  const [nome, setNome] = useState(perito?.nome ?? '');
  const [contato, setContato] = useState(perito?.contato ?? '');
  const [formacao, setFormacao] = useState(perito?.formacao ?? '');
  const [crea, setCrea] = useState(perito?.crea ?? '');
  const [documento, setDocumento] = useState(perito?.documento ?? '');
  const [jaTrabalhamos, setJaTrabalhamos] = useState(perito?.jaTrabalhamos ?? false);
  const [relacao, setRelacao] = useState<PeritoInput['relacao']>(perito?.relacao ?? 'neutra');
  const [resultados, setResultados] = useState<PeritoInput['resultados']>(perito?.resultados ?? 'parcial');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const input: PeritoInput = { nome, contato, formacao, crea, documento, jaTrabalhamos, relacao, resultados };
    const result = perito ? await updatePerito(perito.id, input) : await createPerito(input);
    setSaving(false);
    if (!result.success) {
      onError(result.error);
      return;
    }
    onSaved(result.data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contato">Contato</Label>
        <Input id="contato" value={contato} onChange={(e) => setContato(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="formacao">Formação</Label>
        <Input id="formacao" value={formacao} onChange={(e) => setFormacao(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="crea">CREA</Label>
          <Input id="crea" value={crea} onChange={(e) => setCrea(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="documento">Documento</Label>
          <Input id="documento" value={documento} onChange={(e) => setDocumento(e.target.value)} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="ja-trabalhamos" checked={jaTrabalhamos} onCheckedChange={setJaTrabalhamos} />
        <Label htmlFor="ja-trabalhamos">Já trabalhamos com este perito</Label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="relacao">Relação</Label>
          <Select value={relacao} onValueChange={(v) => setRelacao(v as PeritoInput['relacao'])}>
            <SelectTrigger id="relacao"><SelectValue /></SelectTrigger>
            <SelectContent>
              {relacaoOptions.map((r) => (
                <SelectItem key={r} value={r}>{RELACAO_LABELS[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="resultados">Resultado</Label>
          <Select value={resultados} onValueChange={(v) => setResultados(v as PeritoInput['resultados'])}>
            <SelectTrigger id="resultados"><SelectValue /></SelectTrigger>
            <SelectContent>
              {resultadoOptions.map((r) => (
                <SelectItem key={r} value={r}>{RESULTADO_LABELS[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" disabled={saving} className="w-full">
        {saving && <Loader2 className="size-4 animate-spin" />}
        {saving ? 'Salvando...' : 'Salvar perito'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/features/peritos/components/perito-form`
Expected: both pass.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors from this file or its test.

- [ ] **Step 6: Commit**

```bash
git add src/features/peritos/components/perito-form.tsx src/features/peritos/components/perito-form.test.tsx
git commit -m "feat: PeritoForm uses category selects for relacao/resultados"
```

---

## Task 4: `lib/masks` — máscaras de telefone e CPF

**Files:**
- Create: `src/lib/masks.ts`
- Test: `src/lib/masks.test.ts`

**Interfaces:**
- Produces: `formatPhone(value: string): string`, `formatCPF(value: string): string`. Consumed by Task 5 (PeritoForm and ColaboradorForm).

- [ ] **Step 1: Write the failing test**

Create `src/lib/masks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatPhone, formatCPF } from './masks';

describe('formatPhone', () => {
  it('formats progressively as digits are typed', () => {
    expect(formatPhone('1')).toBe('(1');
    expect(formatPhone('11')).toBe('(11');
    expect(formatPhone('119999')).toBe('(11) 9999');
    expect(formatPhone('11999998888')).toBe('(11) 99999-8888');
  });

  it('strips non-digit characters and caps at 11 digits', () => {
    expect(formatPhone('(11) 99999-8888extra')).toBe('(11) 99999-8888');
  });

  it('returns an empty string for empty input', () => {
    expect(formatPhone('')).toBe('');
  });
});

describe('formatCPF', () => {
  it('formats progressively as digits are typed', () => {
    expect(formatCPF('123')).toBe('123');
    expect(formatCPF('123456')).toBe('123.456');
    expect(formatCPF('123456789')).toBe('123.456.789');
    expect(formatCPF('12345678900')).toBe('123.456.789-00');
  });

  it('strips non-digit characters and caps at 11 digits', () => {
    expect(formatCPF('123.456.789-00extra')).toBe('123.456.789-00');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/masks`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the masks**

Create `src/lib/masks.ts`:

```ts
export function formatPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

export function formatCPF(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/lib/masks`
Expected: all 6 pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/masks.ts src/lib/masks.test.ts
git commit -m "feat: add phone and CPF input mask helpers"
```

---

## Task 5: Aplicar máscaras — PeritoForm e ColaboradorForm

**Files:**
- Modify: `src/features/colaboradores/components/colaborador-form.tsx`
- Modify: `src/features/colaboradores/components/colaborador-form.test.tsx`
- Modify: `src/features/peritos/components/perito-form.tsx`
- Modify: `src/features/peritos/components/perito-form.test.tsx`

**Interfaces:**
- Consumes: `formatPhone`/`formatCPF` (Task 4), `PeritoForm` (Task 3, plain-text contato/documento at this point).

- [ ] **Step 1: Write the failing ColaboradorForm test**

In `src/features/colaboradores/components/colaborador-form.test.tsx`, add this test to the existing `describe('ColaboradorForm', ...)` block (keep the existing two tests as-is):

```tsx
  it('formats the contato field as the user types', async () => {
    const user = userEvent.setup();
    render(<ColaboradorForm onSaved={vi.fn()} onError={vi.fn()} />);

    await user.type(screen.getByLabelText('Contato'), '11999998888');

    expect(screen.getByLabelText('Contato')).toHaveValue('(11) 99999-8888');
  });
```

- [ ] **Step 2: Write the failing PeritoForm tests**

In `src/features/peritos/components/perito-form.test.tsx`, add these two tests to the existing `describe('PeritoForm', ...)` block:

```tsx
  it('formats the contato field as the user types', async () => {
    const user = userEvent.setup();
    render(<PeritoForm onSaved={vi.fn()} onError={vi.fn()} />);

    await user.type(screen.getByLabelText('Contato'), '11999998888');

    expect(screen.getByLabelText('Contato')).toHaveValue('(11) 99999-8888');
  });

  it('formats the documento field as CPF as the user types', async () => {
    const user = userEvent.setup();
    render(<PeritoForm onSaved={vi.fn()} onError={vi.fn()} />);

    await user.type(screen.getByLabelText('Documento'), '12345678900');

    expect(screen.getByLabelText('Documento')).toHaveValue('123.456.789-00');
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test -- src/features/colaboradores/components/colaborador-form src/features/peritos/components/perito-form`
Expected: FAIL — neither form masks its inputs yet.

- [ ] **Step 4: Apply the mask to ColaboradorForm**

In `src/features/colaboradores/components/colaborador-form.tsx`, add the import:

```ts
import { formatPhone } from '@/lib/masks';
```

Change the `contato` state initializer and its input's `onChange`:

```tsx
  const [contato, setContato] = useState(formatPhone(colaborador?.contato ?? ''));
```

```tsx
        <Input
          id="contato" value={contato} onChange={(e) => setContato(formatPhone(e.target.value))}
          placeholder="(99) 99999-9999"
        />
```

- [ ] **Step 5: Apply the masks to PeritoForm**

In `src/features/peritos/components/perito-form.tsx`, add the import:

```ts
import { formatPhone, formatCPF } from '@/lib/masks';
```

Change the `contato` and `documento` state initializers:

```tsx
  const [contato, setContato] = useState(formatPhone(perito?.contato ?? ''));
```

```tsx
  const [documento, setDocumento] = useState(formatCPF(perito?.documento ?? ''));
```

And their inputs' `onChange`:

```tsx
        <Input
          id="contato" value={contato} onChange={(e) => setContato(formatPhone(e.target.value))}
          placeholder="(99) 99999-9999"
        />
```

```tsx
          <Input
            id="documento" value={documento} onChange={(e) => setDocumento(formatCPF(e.target.value))}
            placeholder="999.999.999-99"
          />
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test -- src/features/colaboradores/components/colaborador-form src/features/peritos/components/perito-form`
Expected: all pass (3 in colaborador-form, 4 in perito-form).

- [ ] **Step 7: Commit**

```bash
git add src/features/colaboradores/components/colaborador-form.tsx src/features/colaboradores/components/colaborador-form.test.tsx src/features/peritos/components/perito-form.tsx src/features/peritos/components/perito-form.test.tsx
git commit -m "feat: mask contato (phone) and documento (CPF) fields"
```

---

## Task 6: PeritosTable e PericiasTable — badges em vez de X/10

**Files:**
- Modify: `src/features/pericias/actions.ts`
- Modify: `src/features/peritos/components/peritos-table.tsx`
- Modify: `src/features/pericias/components/pericias-table.tsx`
- Modify: `src/features/pericias/components/pericias-table.test.tsx`

**Interfaces:**
- Consumes: `RelacaoBadge`/`ResultadoBadge` (Task 2), `PeritoRelacao`/`PeritoResultado` types (Task 1).

- [ ] **Step 1: Fix the PericiaListItem type**

`PericiaListItem` in `src/features/pericias/actions.ts` still hand-types the embedded perito's `relacao`/`resultados` as `number` (it doesn't come from `database.types.ts` automatically — it's a manually written return type). Update the import and the type:

```ts
import type { PericiaSituacao, PeritoRelacao, PeritoResultado } from '@/lib/supabase/database.types';
```

```ts
  perito: {
    id: number; nome: string; contato: string; formacao: string; crea: string;
    jaTrabalhamos: boolean; relacao: PeritoRelacao; resultados: PeritoResultado;
  };
```

(replacing the current `relacao: number; resultados: number;` at the end of that block.)

- [ ] **Step 2: Update PeritosTable**

In `src/features/peritos/components/peritos-table.tsx`, add the imports:

```ts
import { RelacaoBadge } from '@/components/shared/relacao-badge';
import { ResultadoBadge } from '@/components/shared/resultado-badge';
```

Replace the two data cells:

```tsx
            <TableCell><RelacaoBadge relacao={item.relacao} /></TableCell>
            <TableCell><ResultadoBadge resultado={item.resultados} /></TableCell>
```

(replacing the current `<TableCell>{item.relacao}/10</TableCell>` and `<TableCell>{item.resultados}/10</TableCell>` lines.)

- [ ] **Step 3: Update the failing pericias-table test**

In `src/features/pericias/components/pericias-table.test.tsx`, update the `items` fixture's `perito` block to use the new enum values instead of numbers:

```tsx
    perito: {
      id: 1, nome: 'Carlos Lima', contato: '(11) 90000-0000', formacao: 'Eng. Civil', crea: '123456',
      jaTrabalhamos: true, relacao: 'boa', resultados: 'positivo',
    },
```

Update the expanded-detail assertion (currently checks for `/CREA: 123456/` text that includes `Relação: 8/10`) — replace:

```tsx
    expect(screen.getByText(/CREA: 123456/)).toBeInTheDocument();
```

with:

```tsx
    expect(screen.getByText(/CREA: 123456/)).toBeInTheDocument();
    expect(screen.getByText('Boa')).toBeInTheDocument();
    expect(screen.getByText('Positivo')).toBeInTheDocument();
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm run test -- src/features/pericias/components/pericias-table`
Expected: FAIL — `pericias-table.tsx` still renders the raw `Relação: {relacao}/10` text, and `item.perito.relacao` is now a string so the old template breaks anyway.

- [ ] **Step 5: Update PericiasTable's expanded detail block**

In `src/features/pericias/components/pericias-table.tsx`, add the imports:

```ts
import { RelacaoBadge } from '@/components/shared/relacao-badge';
import { ResultadoBadge } from '@/components/shared/resultado-badge';
```

Replace the Perito detail `<p>` block:

```tsx
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Perito</p>
                        <p className="text-sm">
                          Contato: {item.perito.contato} · Formação: {item.perito.formacao} · CREA: {item.perito.crea}
                          <br />
                          Já trabalhamos: {item.perito.jaTrabalhamos ? 'Sim' : 'Não'}
                        </p>
                        <div className="mt-1 flex gap-1.5">
                          <RelacaoBadge relacao={item.perito.relacao} />
                          <ResultadoBadge resultado={item.perito.resultados} />
                        </div>
                      </div>
```

(replacing the current single `<p>` that includes `Relação: {item.perito.relacao}/10 · Resultados: {item.perito.resultados}/10`.)

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test -- src/features/pericias/components/pericias-table`
Expected: all 5 pass.

- [ ] **Step 7: Full suite and type-check**

Run: `npm run test && npx tsc --noEmit`
Expected: all pass, no type errors. This confirms `PericiaListItem['perito']['relacao']` (fixed in Step 1) lines up with `RelacaoBadge`'s prop type end to end.

- [ ] **Step 8: Commit**

```bash
git add src/features/pericias/actions.ts src/features/peritos/components/peritos-table.tsx src/features/pericias/components/pericias-table.tsx src/features/pericias/components/pericias-table.test.tsx
git commit -m "feat: show relacao/resultados as colored badges instead of X/10"
```

---

## Task 7: `listPericias` — novos filtros (data, local, perito, colaborador)

**Files:**
- Modify: `src/features/pericias/actions.ts`
- Modify: `src/features/pericias/actions.test.ts` (if it doesn't exist yet, create it following the pattern of `src/features/processos/actions.test.ts`)

**Interfaces:**
- Produces: `listPericias(filters: { situacao?; busca?; data?: string; municipioId?: number; peritoId?: number; colaboradorId?: number })`. Consumed by Task 9 (`page.tsx`, `PericiasFilters`).

- [ ] **Step 1: Extend the shared query-builder mock to capture `.eq()` calls**

`src/features/pericias/actions.test.ts` already has a `periciasQueryBuilder()` helper (used by the `listPericias` describe block) whose `eq: vi.fn(() => builder)` doesn't currently record what it was called with. Add a capture array next to the existing `periciasSelectCalls` array (near the top of the file, right after it) and use it in `eq`:

```ts
const periciasSelectCalls: string[] = [];
const periciasEqCalls: [string, unknown][] = [];
let periciasQueryResult: { data: unknown[] | null; error: { message: string } | null } = {
  data: [],
  error: null,
};

function periciasQueryBuilder() {
  const builder = {
    select: vi.fn((arg: string) => {
      periciasSelectCalls.push(arg);
      return builder;
    }),
    order: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      periciasEqCalls.push([column, value]);
      return builder;
    }),
    filter: vi.fn(() => builder),
    then: (resolve: (v: typeof periciasQueryResult) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(periciasQueryResult).then(resolve, reject),
  };
  return builder;
}
```

(Only the `eq` line changes from what's already there — `select`/`order`/`filter`/`then` stay exactly as they are today.)

Then extend the existing `beforeEach` that resets `periciasSelectCalls.length = 0` to also reset the new array:

```ts
beforeEach(() => {
  periciasSelectCalls.length = 0;
  periciasEqCalls.length = 0;
  periciasQueryResult = { data: [], error: null };
});
```

- [ ] **Step 2: Write the failing tests**

Add these four tests inside the existing `describe('listPericias', ...)` block in `src/features/pericias/actions.test.ts`, after the two tests already there:

```ts
  it('filters by data when provided', async () => {
    await listPericias({ data: '2026-08-01' });
    expect(periciasEqCalls).toContainEqual(['data_agendada', '2026-08-01']);
  });

  it('filters by municipioId when provided', async () => {
    await listPericias({ municipioId: 3550308 });
    expect(periciasEqCalls).toContainEqual(['municipio_id', 3550308]);
  });

  it('filters by peritoId when provided', async () => {
    await listPericias({ peritoId: 7 });
    expect(periciasEqCalls).toContainEqual(['perito_id', 7]);
  });

  it('filters by colaboradorId when provided', async () => {
    await listPericias({ colaboradorId: 3 });
    expect(periciasEqCalls).toContainEqual(['colaborador_id', 3]);
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test -- src/features/pericias/actions`
Expected: FAIL — `listPericias` doesn't accept/apply `data`/`municipioId`/`peritoId`/`colaboradorId` yet.

- [ ] **Step 4: Extend listPericias**

In `src/features/pericias/actions.ts`, change the `filters` parameter type and add the new `.eq()` calls, right after the existing `busca` block:

```ts
export async function listPericias(
  filters: {
    situacao?: string; busca?: string; data?: string;
    municipioId?: number; peritoId?: number; colaboradorId?: number;
  } = {}
): Promise<PericiaListItem[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  let query = supabase
    .from('pericias')
    .select(`
      id, data_agendada, hora_agendada, situacao,
      processo:processos!inner ( id, numero, autor, reu ),
      municipio:municipios!inner ( id, nome, uf ),
      perito:peritos!inner ( id, nome, contato, formacao, crea, ja_trabalhamos, relacao, resultados ),
      colaborador:colaboradores ( id, nome, contato, formacao, interno )
    `)
    .order('data_agendada', { ascending: false });

  if (filters.situacao && situacaoOptions.includes(filters.situacao as (typeof situacaoOptions)[number])) {
    query = query.eq('situacao', filters.situacao as PericiaSituacao);
  }
  if (filters.busca) {
    query = query.filter('processo.numero', 'ilike', postgrestQuoted(`%${filters.busca}%`));
  }
  if (filters.data) {
    query = query.eq('data_agendada', filters.data);
  }
  if (filters.municipioId) {
    query = query.eq('municipio_id', filters.municipioId);
  }
  if (filters.peritoId) {
    query = query.eq('perito_id', filters.peritoId);
  }
  if (filters.colaboradorId) {
    query = query.eq('colaborador_id', filters.colaboradorId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  // ... rest of the function (row mapping) is unchanged
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test -- src/features/pericias/actions`
Expected: all pass, including the pre-existing `situacao`/`busca` tests.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors from this file (`(app)/page.tsx` doesn't pass the new filters yet, which is fine — they're optional).

- [ ] **Step 7: Commit**

```bash
git add src/features/pericias/actions.ts src/features/pericias/actions.test.ts
git commit -m "feat: listPericias accepts data/municipio/perito/colaborador filters"
```

---

## Task 8: OptionCombobox compartilhado

**Files:**
- Create: `src/components/shared/option-combobox.tsx`
- Test: `src/components/shared/option-combobox.test.tsx`

**Interfaces:**
- Produces: `<OptionCombobox options={{id,nome}[]} value={number|null} onChange={(id: number) => void} placeholder="..." />`. A searchable dropdown over an already-loaded list (no server round-trip) — consumed by Task 9 for the Perito/Colaborador filters in `PericiasFilters`.

- [ ] **Step 1: Write the failing test**

Create `src/components/shared/option-combobox.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { OptionCombobox } from './option-combobox';

const options = [
  { id: 1, nome: 'Carlos Lima' },
  { id: 2, nome: 'Diana Souza' },
];

describe('OptionCombobox', () => {
  it('shows the placeholder when nothing is selected', () => {
    render(<OptionCombobox options={options} value={null} onChange={vi.fn()} placeholder="Selecione um perito" />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Selecione um perito');
  });

  it('shows the selected option name', () => {
    render(<OptionCombobox options={options} value={1} onChange={vi.fn()} placeholder="Selecione um perito" />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Carlos Lima');
  });

  it('calls onChange with the id of the option the user picks', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<OptionCombobox options={options} value={null} onChange={onChange} placeholder="Selecione um perito" />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('Diana Souza'));

    expect(onChange).toHaveBeenCalledWith(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/components/shared/option-combobox`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write OptionCombobox**

Create `src/components/shared/option-combobox.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export function OptionCombobox({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: { id: number; nome: string }[];
  value: number | null;
  onChange: (id: number) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button type="button" variant="outline" role="combobox" className="w-full justify-between" />}
      >
        {selected ? selected.nome : placeholder}
        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Buscar..." />
          <CommandList>
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.nome}
                  onSelect={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === option.id ? 'opacity-100' : 'opacity-0')} />
                  {option.nome}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/components/shared/option-combobox`
Expected: all 3 pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/option-combobox.tsx src/components/shared/option-combobox.test.tsx
git commit -m "feat: add shared OptionCombobox for small pre-loaded option lists"
```

---

## Task 9: PericiasFilters — Data, Local, Perito, Colaborador

**Files:**
- Modify: `src/features/pericias/components/pericias-filters.tsx`
- Modify: `src/features/pericias/components/pericias-filters.test.tsx`
- Modify: `src/features/pericias/components/pericias-screen.tsx`
- Modify: `src/app/(app)/page.tsx`

**Interfaces:**
- Consumes: `MunicipioCombobox` (existing), `OptionCombobox` (Task 8), `listPericias`'s new filter params (Task 7).
- Produces: `<PericiasFilters peritos={PeritoOption[]} colaboradores={ColaboradorOption[]} />` (adds two required props — breaking change to this component's signature, only caller is `PericiasScreen`, updated in this same task).

- [ ] **Step 1: Write the failing tests**

Add to `src/features/pericias/components/pericias-filters.test.tsx` (keep the existing two tests; update every `render(<PericiasFilters />)` call in them to `render(<PericiasFilters peritos={[]} colaboradores={[]} />)` since the component now requires those props):

```tsx
  it('pushes municipioId when a município is selected in the Local filter', async () => {
    params = new URLSearchParams();
    const user = userEvent.setup();
    render(<PericiasFilters peritos={[]} colaboradores={[]} />);

    await user.click(screen.getByText('selecionar município'));

    expect(push).toHaveBeenCalledWith(expect.stringContaining('municipioId=3550308'));
  });

  it('pushes peritoId when a perito is selected in the Perito filter', async () => {
    params = new URLSearchParams();
    const user = userEvent.setup();
    render(<PericiasFilters peritos={[{ id: 1, nome: 'Carlos Lima' }]} colaboradores={[]} />);

    await user.click(screen.getByRole('combobox', { name: /perito/i }));
    await user.click(await screen.findByText('Carlos Lima'));

    expect(push).toHaveBeenCalledWith(expect.stringContaining('peritoId=1'));
  });

  it('pushes data when a date is picked', async () => {
    params = new URLSearchParams();
    const user = userEvent.setup();
    render(<PericiasFilters peritos={[]} colaboradores={[]} />);

    await user.type(screen.getByLabelText('Data'), '2026-08-01');

    expect(push).toHaveBeenCalledWith(expect.stringContaining('data=2026-08-01'));
  });
```

Also mock `MunicipioCombobox` at the top of the file (it isn't mocked yet since `PericiasFilters` didn't use it before):

```tsx
vi.mock('@/features/municipios/components/municipio-combobox', () => ({
  MunicipioCombobox: ({ onChange }: { onChange: (m: { id: number; nome: string; uf: string }) => void }) => (
    <button type="button" onClick={() => onChange({ id: 3550308, nome: 'São Paulo', uf: 'SP' })}>
      selecionar município
    </button>
  ),
}));
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/features/pericias/components/pericias-filters`
Expected: FAIL — `PericiasFilters` doesn't accept `peritos`/`colaboradores` props, has no Data/Local/Perito fields.

- [ ] **Step 3: Rewrite PericiasFilters**

Replace `src/features/pericias/components/pericias-filters.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MunicipioCombobox } from '@/features/municipios/components/municipio-combobox';
import { OptionCombobox } from '@/components/shared/option-combobox';
import { situacaoOptions } from '../schemas';

type PeritoOption = { id: number; nome: string };
type ColaboradorOption = { id: number; nome: string };

export function PericiasFilters({
  peritos,
  colaboradores,
}: {
  peritos: PeritoOption[];
  colaboradores: ColaboradorOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busca, setBusca] = useState(searchParams.get('busca') ?? '');

  useEffect(() => {
    if (busca === (searchParams.get('busca') ?? '')) return;
    const handle = setTimeout(() => updateParam('busca', busca), 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/?${params.toString()}`);
  }

  const municipioId = searchParams.get('municipioId');
  const peritoId = searchParams.get('peritoId');
  const colaboradorId = searchParams.get('colaboradorId');

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Input
        placeholder="Buscar por número do processo"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="max-w-xs"
      />
      <Select
        defaultValue={searchParams.get('situacao') ?? 'all'}
        onValueChange={(value) => updateParam('situacao', !value || value === 'all' ? '' : value)}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Situação" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as situações</SelectItem>
          {situacaoOptions.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="space-y-1">
        <Label htmlFor="data-filtro" className="sr-only">Data</Label>
        <Input
          id="data-filtro" type="date" className="w-40"
          defaultValue={searchParams.get('data') ?? ''}
          onChange={(e) => updateParam('data', e.target.value)}
        />
      </div>
      <div className="w-56">
        <MunicipioCombobox
          value={municipioId ? Number(municipioId) : null}
          selected={null}
          onChange={(municipio) => updateParam('municipioId', String(municipio.id))}
        />
      </div>
      <div className="w-56">
        <OptionCombobox
          options={peritos}
          value={peritoId ? Number(peritoId) : null}
          onChange={(id) => updateParam('peritoId', String(id))}
          placeholder="Perito"
        />
      </div>
      <div className="w-56">
        <OptionCombobox
          options={colaboradores}
          value={colaboradorId ? Number(colaboradorId) : null}
          onChange={(id) => updateParam('colaboradorId', String(id))}
          placeholder="Colaborador"
        />
      </div>
    </div>
  );
}
```

Note: `MunicipioCombobox`'s `selected` is passed as `null` always (it only has the id, not the full município object, on a fresh page load) — the combobox trigger shows its placeholder instead of the previously-picked município's name after a reload. This is a known, accepted simplification (see spec §3) — the filter itself still works correctly via the URL param regardless of what the trigger displays.

- [ ] **Step 4: Wire PericiasScreen to pass peritos/colaboradores through**

In `src/features/pericias/components/pericias-screen.tsx`, find `<PericiasFilters />` and change it to:

```tsx
      <PericiasFilters peritos={peritos} colaboradores={colaboradores} />
```

(`peritos`/`colaboradores` are already props of `PericiasScreen` — no new prop needed there.)

- [ ] **Step 5: Wire page.tsx's filter reading**

In `src/app/(app)/page.tsx`, update the `searchParams` type and the `listPericias` call:

```tsx
export default async function PericiasPage({
  searchParams,
}: {
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
  // ... rest unchanged
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test -- src/features/pericias`
Expected: all pass.

- [ ] **Step 7: Full suite and type-check**

Run: `npm run test && npx tsc --noEmit`
Expected: all pass, no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/features/pericias/components/pericias-filters.tsx src/features/pericias/components/pericias-filters.test.tsx src/features/pericias/components/pericias-screen.tsx "src/app/(app)/page.tsx"
git commit -m "feat: add data/local/perito/colaborador filters to Pericias"
```

---

## Task 10: Busca no servidor — Processos, Peritos, Colaboradores actions

**Files:**
- Modify: `src/features/processos/actions.ts`
- Modify: `src/features/processos/actions.test.ts`
- Modify: `src/features/peritos/actions.ts`
- Test: `src/features/peritos/actions.test.ts` (create if it doesn't exist)
- Modify: `src/features/colaboradores/actions.ts`
- Test: `src/features/colaboradores/actions.test.ts` (create if it doesn't exist)

**Interfaces:**
- Produces: `listProcessos(busca?: string)`, `listPeritos(busca?: string)`, `listColaboradores(busca?: string)`. Consumed by Tasks 11-13.

- [ ] **Step 1: Extend the listProcessos mock to support `.or()`**

`src/features/processos/actions.test.ts` currently defines `mockSelect = vi.fn(() => ({ order: mockOrder, eq: mockEq }))`. Add an `mockOr` that also resolves through `mockOrder`, and wire it into `mockSelect`:

```ts
const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockOrder = vi.fn();
const mockOr = vi.fn(() => ({ order: mockOrder }));
const mockSelect = vi.fn(() => ({ order: mockOrder, eq: mockEq, or: mockOr }));
const mockUpdateEq = vi.fn(() => ({ select: () => ({ single: mockSingle }) }));
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
```

(Only `mockOr` is new and `mockSelect` gains the `or: mockOr` key — `mockSingle`/`mockEq`/`mockOrder`/`mockUpdateEq`/`mockUpdate` are unchanged from what's already in the file.)

- [ ] **Step 2: Write the failing tests**

Add a new `describe('listProcessos busca', ...)` block in `src/features/processos/actions.test.ts`, after the existing `describe('listProcessos', ...)` block:

```ts
describe('listProcessos busca', () => {
  beforeEach(() => vi.clearAllMocks());

  it('filters by numero/autor/reu when busca is provided', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    await listProcessos('Souza');
    expect(mockOr).toHaveBeenCalledWith(expect.stringContaining('numero.ilike'));
  });

  it('does not filter when busca is empty', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    await listProcessos();
    expect(mockOr).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test -- src/features/processos/actions`
Expected: FAIL — `listProcessos` takes no arguments today, and the existing `describe('listProcessos', ...)` test also breaks momentarily since `mockOrder` now needs `or` on the object `select()` returns (it already does after Step 1, so only the two new tests should fail here).

- [ ] **Step 4: Update listProcessos**

In `src/features/processos/actions.ts`, replace the `listProcessos` function:

```ts
export async function listProcessos(busca?: string): Promise<Processo[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  let query = supabase.from('processos').select('id, numero, autor, reu');
  if (busca?.trim()) {
    const pattern = postgrestQuoted(`%${busca}%`);
    query = query.or(`numero.ilike.${pattern},autor.ilike.${pattern},reu.ilike.${pattern}`);
  }
  const { data, error } = await query.order('numero');
  if (error) throw new Error(error.message);
  return data ?? [];
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test -- src/features/processos/actions`
Expected: all pass, including the pre-existing `listProcessos`/`getProcesso`/`updateProcesso` tests.

- [ ] **Step 6: Write the failing test file for listPeritos**

Create `src/features/peritos/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listPeritos } from './actions';

const mockOrder = vi.fn();
const mockIlike = vi.fn(() => ({ order: mockOrder }));
const mockSelect = vi.fn(() => ({ order: mockOrder, ilike: mockIlike }));

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ select: mockSelect }),
  })),
}));

describe('listPeritos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('filters by nome when busca is provided', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    await listPeritos('Carlos');
    expect(mockIlike).toHaveBeenCalledWith('nome', '%Carlos%');
  });

  it('does not filter when busca is empty', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    await listPeritos();
    expect(mockIlike).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npm run test -- src/features/peritos/actions`
Expected: FAIL — `listPeritos` takes no arguments today.

- [ ] **Step 8: Update listPeritos**

In `src/features/peritos/actions.ts`, replace the `listPeritos` function:

```ts
export async function listPeritos(busca?: string): Promise<Perito[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  let query = supabase.from('peritos').select('*');
  if (busca?.trim()) {
    query = query.ilike('nome', `%${busca}%`);
  }
  const { data, error } = await query.order('nome');
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromRow);
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npm run test -- src/features/peritos/actions`
Expected: both pass.

- [ ] **Step 10: Write the failing test file for listColaboradores**

Create `src/features/colaboradores/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listColaboradores } from './actions';

const mockOrder = vi.fn();
const mockIlike = vi.fn(() => ({ order: mockOrder }));
const mockSelect = vi.fn(() => ({ order: mockOrder, ilike: mockIlike }));

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ select: mockSelect }),
  })),
}));

describe('listColaboradores', () => {
  beforeEach(() => vi.clearAllMocks());

  it('filters by nome when busca is provided', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    await listColaboradores('Bruna');
    expect(mockIlike).toHaveBeenCalledWith('nome', '%Bruna%');
  });

  it('does not filter when busca is empty', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    await listColaboradores();
    expect(mockIlike).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 11: Run the test to verify it fails**

Run: `npm run test -- src/features/colaboradores/actions`
Expected: FAIL — `listColaboradores` takes no arguments today.

- [ ] **Step 12: Update listColaboradores**

In `src/features/colaboradores/actions.ts`, replace the `listColaboradores` function:

```ts
export async function listColaboradores(busca?: string): Promise<Colaborador[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  let query = supabase.from('colaboradores').select('*');
  if (busca?.trim()) {
    query = query.ilike('nome', `%${busca}%`);
  }
  const { data, error } = await query.order('nome');
  if (error) throw new Error(error.message);
  return data ?? [];
}
```

- [ ] **Step 13: Run the test to verify it passes**

Run: `npm run test -- src/features/colaboradores/actions`
Expected: both pass.

- [ ] **Step 14: Full suite and type-check**

Run: `npm run test && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 15: Commit**

```bash
git add src/features/processos/actions.ts src/features/processos/actions.test.ts src/features/peritos/actions.ts src/features/peritos/actions.test.ts src/features/colaboradores/actions.ts src/features/colaboradores/actions.test.ts
git commit -m "feat: listProcessos/listPeritos/listColaboradores accept a busca filter"
```

---

## Task 11: ProcessosFilters

**Files:**
- Create: `src/features/processos/components/processos-filters.tsx`
- Test: `src/features/processos/components/processos-filters.test.tsx`
- Modify: `src/features/processos/components/processos-screen.tsx`
- Modify: `src/app/(app)/processos/page.tsx`

**Interfaces:**
- Consumes: `listProcessos(busca?)` (Task 10).
- Produces: `<ProcessosFilters />`. Consumed by `ProcessosScreen`.

- [ ] **Step 1: Write the failing test**

Create `src/features/processos/components/processos-filters.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ProcessosFilters } from './processos-filters';

const push = vi.fn();
let params = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => params,
}));

describe('ProcessosFilters', () => {
  it('does not push a navigation on mount when nothing changed', async () => {
    params = new URLSearchParams();
    render(<ProcessosFilters />);
    await new Promise((r) => setTimeout(r, 350));
    expect(push).not.toHaveBeenCalled();
  });

  it('pushes the busca value after the user types and the debounce elapses', async () => {
    params = new URLSearchParams();
    const user = userEvent.setup();
    render(<ProcessosFilters />);

    await user.type(screen.getByPlaceholderText('Buscar por número, autor ou réu'), 'Souza');
    await new Promise((r) => setTimeout(r, 350));

    expect(push).toHaveBeenCalledWith('/processos?busca=Souza');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/features/processos/components/processos-filters`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write ProcessosFilters**

Create `src/features/processos/components/processos-filters.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';

export function ProcessosFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busca, setBusca] = useState(searchParams.get('busca') ?? '');

  useEffect(() => {
    if (busca === (searchParams.get('busca') ?? '')) return;
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (busca) params.set('busca', busca);
      else params.delete('busca');
      router.push(`/processos?${params.toString()}`);
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  return (
    <Input
      placeholder="Buscar por número, autor ou réu"
      value={busca}
      onChange={(e) => setBusca(e.target.value)}
      className="max-w-xs"
    />
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/features/processos/components/processos-filters`
Expected: both pass.

- [ ] **Step 5: Wire into ProcessosScreen and the page**

In `src/features/processos/components/processos-screen.tsx`, import `ProcessosFilters` and render it right above `<Suspense>`/`<ProcessosTableAsync>`:

```tsx
import { ProcessosFilters } from './processos-filters';
```

```tsx
      <ProcessosFilters />
      <Suspense fallback={<TableSkeleton columns={4} />}>
        <ProcessosTableAsync itemsPromise={itemsPromise} onEdit={openEdit} />
      </Suspense>
```

In `src/app/(app)/processos/page.tsx`, accept `searchParams` and pass `busca` through:

```tsx
import { listProcessos } from '@/features/processos/actions';
import { ProcessosScreen } from '@/features/processos/components/processos-screen';

export default async function ProcessosPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>;
}) {
  const { busca } = await searchParams;
  const itemsPromise = listProcessos(busca);
  return <ProcessosScreen itemsPromise={itemsPromise} />;
}
```

Note: `page.tsx` now awaits `searchParams` before returning, which reintroduces a small blocking window before the static shell (title/button) paints — same tradeoff already accepted for the Perícias page in the prior session's work, and it's a fast, non-DB await, not the table's own data fetch.

- [ ] **Step 6: Run the full suite and type-check**

Run: `npm run test && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/features/processos/components/processos-filters.tsx src/features/processos/components/processos-filters.test.tsx src/features/processos/components/processos-screen.tsx "src/app/(app)/processos/page.tsx"
git commit -m "feat: add search filter to Processos"
```

---

## Task 12: PeritosFilters

**Files:**
- Create: `src/features/peritos/components/peritos-filters.tsx`
- Test: `src/features/peritos/components/peritos-filters.test.tsx`
- Modify: `src/features/peritos/components/peritos-screen.tsx`
- Modify: `src/app/(app)/peritos/page.tsx`

**Interfaces:**
- Consumes: `listPeritos(busca?)` (Task 10).
- Produces: `<PeritosFilters />`.

- [ ] **Step 1: Write the failing test**

Create `src/features/peritos/components/peritos-filters.test.tsx` (mirror Task 11 Step 1 exactly, swap route/placeholder):

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PeritosFilters } from './peritos-filters';

const push = vi.fn();
let params = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => params,
}));

describe('PeritosFilters', () => {
  it('does not push a navigation on mount when nothing changed', async () => {
    params = new URLSearchParams();
    render(<PeritosFilters />);
    await new Promise((r) => setTimeout(r, 350));
    expect(push).not.toHaveBeenCalled();
  });

  it('pushes the busca value after the user types and the debounce elapses', async () => {
    params = new URLSearchParams();
    const user = userEvent.setup();
    render(<PeritosFilters />);

    await user.type(screen.getByPlaceholderText('Buscar por nome'), 'Carlos');
    await new Promise((r) => setTimeout(r, 350));

    expect(push).toHaveBeenCalledWith('/peritos?busca=Carlos');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/features/peritos/components/peritos-filters`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write PeritosFilters**

Create `src/features/peritos/components/peritos-filters.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';

export function PeritosFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busca, setBusca] = useState(searchParams.get('busca') ?? '');

  useEffect(() => {
    if (busca === (searchParams.get('busca') ?? '')) return;
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (busca) params.set('busca', busca);
      else params.delete('busca');
      router.push(`/peritos?${params.toString()}`);
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  return (
    <Input
      placeholder="Buscar por nome"
      value={busca}
      onChange={(e) => setBusca(e.target.value)}
      className="max-w-xs"
    />
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/features/peritos/components/peritos-filters`
Expected: both pass.

- [ ] **Step 5: Wire into PeritosScreen and the page**

In `src/features/peritos/components/peritos-screen.tsx`, import and render `<PeritosFilters />` right above the `<Suspense>` block (same placement as Task 11 Step 5).

In `src/app/(app)/peritos/page.tsx`:

```tsx
import { listPeritos } from '@/features/peritos/actions';
import { PeritosScreen } from '@/features/peritos/components/peritos-screen';

export default async function PeritosPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>;
}) {
  const { busca } = await searchParams;
  const itemsPromise = listPeritos(busca);
  return <PeritosScreen itemsPromise={itemsPromise} />;
}
```

- [ ] **Step 6: Run the full suite and type-check**

Run: `npm run test && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/features/peritos/components/peritos-filters.tsx src/features/peritos/components/peritos-filters.test.tsx src/features/peritos/components/peritos-screen.tsx "src/app/(app)/peritos/page.tsx"
git commit -m "feat: add search filter to Peritos"
```

---

## Task 13: ColaboradoresFilters

**Files:**
- Create: `src/features/colaboradores/components/colaboradores-filters.tsx`
- Test: `src/features/colaboradores/components/colaboradores-filters.test.tsx`
- Modify: `src/features/colaboradores/components/colaboradores-screen.tsx`
- Modify: `src/app/(app)/colaboradores/page.tsx`

**Interfaces:**
- Consumes: `listColaboradores(busca?)` (Task 10).
- Produces: `<ColaboradoresFilters />`.

- [ ] **Step 1: Write the failing test**

Create `src/features/colaboradores/components/colaboradores-filters.test.tsx` (mirror Task 11/12):

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ColaboradoresFilters } from './colaboradores-filters';

const push = vi.fn();
let params = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => params,
}));

describe('ColaboradoresFilters', () => {
  it('does not push a navigation on mount when nothing changed', async () => {
    params = new URLSearchParams();
    render(<ColaboradoresFilters />);
    await new Promise((r) => setTimeout(r, 350));
    expect(push).not.toHaveBeenCalled();
  });

  it('pushes the busca value after the user types and the debounce elapses', async () => {
    params = new URLSearchParams();
    const user = userEvent.setup();
    render(<ColaboradoresFilters />);

    await user.type(screen.getByPlaceholderText('Buscar por nome'), 'Bruna');
    await new Promise((r) => setTimeout(r, 350));

    expect(push).toHaveBeenCalledWith('/colaboradores?busca=Bruna');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/features/colaboradores/components/colaboradores-filters`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write ColaboradoresFilters**

Create `src/features/colaboradores/components/colaboradores-filters.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';

export function ColaboradoresFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busca, setBusca] = useState(searchParams.get('busca') ?? '');

  useEffect(() => {
    if (busca === (searchParams.get('busca') ?? '')) return;
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (busca) params.set('busca', busca);
      else params.delete('busca');
      router.push(`/colaboradores?${params.toString()}`);
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  return (
    <Input
      placeholder="Buscar por nome"
      value={busca}
      onChange={(e) => setBusca(e.target.value)}
      className="max-w-xs"
    />
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/features/colaboradores/components/colaboradores-filters`
Expected: both pass.

- [ ] **Step 5: Wire into ColaboradoresScreen and the page**

In `src/features/colaboradores/components/colaboradores-screen.tsx`, import and render `<ColaboradoresFilters />` right above the `<Suspense>` block.

In `src/app/(app)/colaboradores/page.tsx`:

```tsx
import { listColaboradores } from '@/features/colaboradores/actions';
import { ColaboradoresScreen } from '@/features/colaboradores/components/colaboradores-screen';

export default async function ColaboradoresPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>;
}) {
  const { busca } = await searchParams;
  const itemsPromise = listColaboradores(busca);
  return <ColaboradoresScreen itemsPromise={itemsPromise} />;
}
```

- [ ] **Step 6: Run the full suite and type-check**

Run: `npm run test && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/features/colaboradores/components/colaboradores-filters.tsx src/features/colaboradores/components/colaboradores-filters.test.tsx src/features/colaboradores/components/colaboradores-screen.tsx "src/app/(app)/colaboradores/page.tsx"
git commit -m "feat: add search filter to Colaboradores"
```

---

## Task 14: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full automated suite**

Run: `npm run test`
Expected: every test from Tasks 1-13 passes.

- [ ] **Step 2: Type-check, lint, and build**

Run: `npx tsc --noEmit && npx eslint . && npm run build`
Expected: no type errors, no new lint errors (the pre-existing `perfis-table.test.tsx` unused-var warning is fine), production build succeeds.

- [ ] **Step 3: Grep for leftover numeric relacao/resultados handling**

Run: `grep -rn "relacao}/10\|resultados}/10\|relacao: 0,\|resultados: 0," src/ | grep -v node_modules`
Expected: no matches — confirms no stray `/10` display or numeric default was left behind.

- [ ] **Step 4: Manual QA checklist**

Using `npm run dev` against the real Supabase project (apply the migration from Task 1 to that project first if not already applied):

- [ ] Editing a Perito shows Relação/Resultado as dropdowns with the 4/3 category labels, not a number input.
- [ ] The Peritos list and the expanded Perícia detail row show colored badges (verde/azul/cinza/vermelho as specified) instead of "X/10".
- [ ] Typing in the Perito/Colaborador Contato field formats it live as `(99) 99999-9999`.
- [ ] Typing in the Perito Documento field formats it live as `999.999.999-99`.
- [ ] On the Perícias screen, filtering by Data shows only perícias on that exact day; filtering by Local/Perito/Colaborador narrows the list correctly; filters combine (e.g. situação + perito together).
- [ ] Processos, Peritos, and Colaboradores screens each have a working search box that narrows the list via the server (URL gets a `busca` param).
- [ ] No console errors on any of the above screens.

- [ ] **Step 5: Fix any gaps found during QA, then re-run Steps 1-3**
