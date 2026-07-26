# Gestão de Perícias — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a SaaS for managing perícias (expert examinations), the processos (legal cases) they belong to, and the peritos/colaboradores involved, hosted entirely on free tiers.

**Architecture:** Single Next.js 15 (App Router, TypeScript) project deployed to Vercel, using Supabase (Postgres + Auth + RLS) as the only backend service. Server Actions handle all writes; Server Components fetch data directly via the Supabase server client. Zod schemas are the single source of truth for validation, shared between forms and server actions. Municípios are looked up live from the public IBGE API and cached (upserted) into a local table on first use, so the app never depends on IBGE at read time.

**Tech Stack:** Next.js 15 + TypeScript, Tailwind CSS + shadcn/ui, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Zod, Vitest + Testing Library + jsdom, Vercel (hosting), Supabase (Postgres/Auth hosting, free tier).

## Global Constraints

- Hosting must be free: Vercel free tier (front+back) + Supabase free tier (Postgres+Auth). No paid services.
- Roles: `admin` (tudo + controle de perfis), `gerencia` (CRUD completo, sem tela de perfis), `pendente` (sem acesso, aguarda aprovação).
- Seed admin user for testing: email `admin@admin.com`, password `admin123` (Supabase requires ≥6 char passwords).
- `pericia.situacao` ∈ `pendente | marcada | realizada | cancelada`.
- `perito.relacao` and `perito.resultados` are integers constrained to `0..10`.
- `processo.numero` is unique.
- `pericia.processo_id`, `municipio_id`, `perito_id` are required (`ON DELETE RESTRICT`); `colaborador_id` is optional (`ON DELETE SET NULL`).
- Município data comes from the public IBGE API (`servicodados.ibge.gov.br`) and is cached locally.
- Every table listed in §5.1 of the spec (Nº Processo, Data-Hora, Local, Perito, Colaborador, Situação) must show a tooltip with the extra fields listed in the spec.
- Permissions are enforced in two layers: Next.js middleware/guards AND Postgres RLS policies.
- TDD: write the failing test before the implementation for every unit with business logic (schemas, guards, actions, non-trivial components). Commit after each green test.
- **Runtime reality check (discovered during Task 1/2 execution, supersedes the Tech Stack line above):** `create-next-app@latest` and `shadcn@latest` installed **Next.js 16.2.12, React 19.2.4, Tailwind CSS v4** (CSS-first config, no `tailwind.config.js`), and shadcn/ui components built on **`@base-ui/react` instead of Radix UI**. Base UI has no `asChild` prop — polymorphic composition uses a `render` prop instead: `<Trigger render={<Button variant="outline" />}>children</Trigger>` (the outer component's children and other props win; the render element supplies the base tag/its own props). Every code block below already uses `render` instead of `asChild`. Confirmed empirically (throwaway RTL renders) before any task past Task 2 was dispatched: `SelectTrigger` still renders `role="combobox"`, `Switch` keeps its `checked`/`onCheckedChange` API, and `Tooltip` shows its content on hover via `userEvent.hover()` + `findBy` with no `TooltipProvider` wrapper required. `Command`/`CommandInput`/`CommandItem` are unaffected (still built on `cmdk`, not Base UI).

---

## Task 1: Project scaffolding (Next.js + TypeScript + Tailwind + test toolchain)

**Files:**
- Create: entire Next.js project at repo root (`package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `.gitignore`, `eslint.config.mjs`)
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Test: `src/app/page.test.tsx` (temporary smoke test, removed in Task 16 when the real home page lands)

**Interfaces:**
- Produces: a runnable Next.js app (`npm run dev`) and a runnable test command (`npm run test`), used by every later task.

- [ ] **Step 1: Scaffold the Next.js app**

Run in the repo root (already a git repo, currently empty except `docs/`):

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Accept defaults for any remaining prompt.

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr zod lucide-react
```

- [ ] **Step 3: Install test dependencies**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event tsx
```

- [ ] **Step 4: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Add test scripts to `package.json`**

Add to the `"scripts"` section:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Write and run a smoke test**

Create `src/app/page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Page from './page';

describe('smoke test', () => {
  it('renders the default page', () => {
    render(<Page />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
```

Run: `npm run test`
Expected: 1 passed.

- [ ] **Step 7: Verify the dev server boots**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest/RTL test toolchain"
```

---

## Task 2: shadcn/ui setup

**Files:**
- Create: `components.json`, `src/lib/utils.ts`, `src/components/ui/*` (generated by shadcn CLI)
- Test: `src/components/ui/button.test.tsx`

**Interfaces:**
- Produces: `cn()` helper in `@/lib/utils`, and the `Button`, `Input`, `Label`, `Table`, `Dialog`, `Tooltip`, `Select`, `Command`, `Popover`, `Badge`, `Switch`, `Card`, `Separator` components under `@/components/ui/*`, used by every UI task from here on.

- [ ] **Step 1: Initialize shadcn/ui**

```bash
npx shadcn@latest init -d
```

- [ ] **Step 2: Add the components this project needs**

```bash
npx shadcn@latest add button input label table dialog tooltip select command popover badge switch card separator
```

- [ ] **Step 3: Write a smoke test for the generated Button**

Create `src/components/ui/button.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Salvar</Button>);
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npm run test`
Expected: all tests pass (smoke test from Task 1 + this one).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: set up shadcn/ui component library"
```

---

## Task 3: Supabase client helpers, database types, env template

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/middleware.ts`
- Create: `src/lib/supabase/database.types.ts`
- Create: `src/lib/action-result.ts`
- Create: `.env.local.example`
- Modify: `.gitignore` (ensure `.env.local` is ignored — `create-next-app` already does this, just verify)

**Interfaces:**
- Produces: `createClient()` (browser, sync) from `@/lib/supabase/client`; `createClient()` (server, async) from `@/lib/supabase/server`; `updateSession(request): Promise<{response, user, role}>` from `@/lib/supabase/middleware`; `Database` type from `@/lib/supabase/database.types`; `ActionResult<T> = { success: true; data: T } | { success: false; error: string }` from `@/lib/action-result`. Every later feature imports these.

- [ ] **Step 1: Write the database types**

Create `src/lib/supabase/database.types.ts`:

```ts
export type PericiaSituacao = 'pendente' | 'marcada' | 'realizada' | 'cancelada';
export type ProfileRoleValue = 'pendente' | 'gerencia' | 'admin';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; nome: string; email: string; role: ProfileRoleValue; created_at: string };
        Insert: { id: string; nome?: string; email: string; role?: ProfileRoleValue };
        Update: Partial<{ nome: string; email: string; role: ProfileRoleValue }>;
      };
      municipios: {
        Row: { id: number; nome: string; uf: string };
        Insert: { id: number; nome: string; uf: string };
        Update: Partial<{ nome: string; uf: string }>;
      };
      processos: {
        Row: { id: number; numero: string; autor: string; reu: string; created_at: string };
        Insert: { numero: string; autor: string; reu: string };
        Update: Partial<{ numero: string; autor: string; reu: string }>;
      };
      peritos: {
        Row: {
          id: number; nome: string; contato: string; formacao: string; crea: string;
          documento: string; ja_trabalhamos: boolean; relacao: number; resultados: number;
          created_at: string;
        };
        Insert: {
          nome: string; contato?: string; formacao?: string; crea?: string; documento?: string;
          ja_trabalhamos?: boolean; relacao?: number; resultados?: number;
        };
        Update: Partial<Database['public']['Tables']['peritos']['Insert']>;
      };
      colaboradores: {
        Row: { id: number; nome: string; contato: string; formacao: string; interno: boolean; created_at: string };
        Insert: { nome: string; contato?: string; formacao?: string; interno?: boolean };
        Update: Partial<Database['public']['Tables']['colaboradores']['Insert']>;
      };
      pericias: {
        Row: {
          id: number; processo_id: number; data_agendada: string; hora_agendada: string;
          municipio_id: number; perito_id: number; colaborador_id: number | null;
          situacao: PericiaSituacao; created_at: string;
        };
        Insert: {
          processo_id: number; data_agendada: string; hora_agendada: string; municipio_id: number;
          perito_id: number; colaborador_id?: number | null; situacao?: PericiaSituacao;
        };
        Update: Partial<Database['public']['Tables']['pericias']['Insert']>;
      };
    };
  };
};
```

- [ ] **Step 2: Write the browser client**

Create `src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: Write the server client**

Create `src/lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; session refresh is handled by middleware.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 4: Write the middleware session helper**

Create `src/lib/supabase/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { ProfileRoleValue } from './database.types';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  let role: ProfileRoleValue | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    role = (profile?.role as ProfileRoleValue) ?? null;
  }

  return { response, user, role };
}
```

- [ ] **Step 5: Write the shared action result type**

Create `src/lib/action-result.ts`:

```ts
export type ActionResult<T> = { success: true; data: T } | { success: false; error: string };
```

- [ ] **Step 6: Write the env template**

Create `.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=
```

Copy it to `.env.local` locally (left empty until Task 21) — `.env.local` must stay untracked, confirm `.gitignore` already lists it (create-next-app adds this by default).

- [ ] **Step 7: Verify the project still builds**

Run: `npx tsc --noEmit`
Expected: no type errors (env vars are asserted with `!`, which is fine at compile time).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Supabase client/server/middleware helpers and database types"
```

---

## Task 4: Database schema migration

**Files:**
- Create: `supabase/config.toml` and `supabase/migrations/` (via `supabase init`)
- Create: `supabase/migrations/20260726000001_init_schema.sql`

**Interfaces:**
- Produces: the `profiles`, `municipios`, `processos`, `peritos`, `colaboradores`, `pericias` tables and the `pericia_situacao` / `profile_role` enums that every server action in later tasks reads/writes.

- [ ] **Step 1: Initialize the Supabase project structure**

```bash
npx supabase init
```

This creates `supabase/config.toml` and `supabase/migrations/` without needing Docker or a live project.

- [ ] **Step 2: Write the schema migration**

Create `supabase/migrations/20260726000001_init_schema.sql`:

```sql
create type public.pericia_situacao as enum ('pendente', 'marcada', 'realizada', 'cancelada');
create type public.profile_role as enum ('pendente', 'gerencia', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  email text not null,
  role public.profile_role not null default 'pendente',
  created_at timestamptz not null default now()
);

create table public.municipios (
  id integer primary key, -- codigo IBGE
  nome text not null,
  uf char(2) not null
);

create table public.processos (
  id bigint generated always as identity primary key,
  numero text not null unique,
  autor text not null,
  reu text not null,
  created_at timestamptz not null default now()
);

create table public.peritos (
  id bigint generated always as identity primary key,
  nome text not null,
  contato text not null default '',
  formacao text not null default '',
  crea text not null default '',
  documento text not null default '',
  ja_trabalhamos boolean not null default false,
  relacao smallint not null default 0 check (relacao between 0 and 10),
  resultados smallint not null default 0 check (resultados between 0 and 10),
  created_at timestamptz not null default now()
);

create table public.colaboradores (
  id bigint generated always as identity primary key,
  nome text not null,
  contato text not null default '',
  formacao text not null default '',
  interno boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.pericias (
  id bigint generated always as identity primary key,
  processo_id bigint not null references public.processos (id) on delete restrict,
  data_agendada date not null,
  hora_agendada time not null,
  municipio_id integer not null references public.municipios (id) on delete restrict,
  perito_id bigint not null references public.peritos (id) on delete restrict,
  colaborador_id bigint references public.colaboradores (id) on delete set null,
  situacao public.pericia_situacao not null default 'pendente',
  created_at timestamptz not null default now()
);

create index pericias_processo_id_idx on public.pericias (processo_id);
create index pericias_perito_id_idx on public.pericias (perito_id);
create index pericias_data_agendada_idx on public.pericias (data_agendada);
```

- [ ] **Step 3: Review the migration for correctness**

Confirm against the spec's diagram (§3.1) and integrity rules (§3.2): every FK, the `ON DELETE` behavior, the `0..10` checks, and `numero` uniqueness are present. No live database is available yet — actual application of this migration happens in Task 21 once the Supabase project exists (`supabase link` + `supabase db push`, or pasted into the SQL editor).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add initial database schema migration"
```

---

## Task 5: Profile auto-provisioning trigger + RLS policies

**Files:**
- Create: `supabase/migrations/20260726000002_profile_trigger.sql`
- Create: `supabase/migrations/20260726000003_rls_policies.sql`

**Interfaces:**
- Consumes: tables from Task 4.
- Produces: automatic `profiles` row creation on signup (role `pendente`), and RLS policies gating every table by `profiles.role`, which the app relies on as its second permission layer (first layer is Task 9/10's guards).

- [ ] **Step 1: Write the profile-creation trigger**

Create `supabase/migrations/20260726000002_profile_trigger.sql`:

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), new.email, 'pendente');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 2: Write the RLS policies**

Create `supabase/migrations/20260726000003_rls_policies.sql`:

```sql
alter table public.profiles enable row level security;
alter table public.municipios enable row level security;
alter table public.processos enable row level security;
alter table public.peritos enable row level security;
alter table public.colaboradores enable row level security;
alter table public.pericias enable row level security;

-- security definer avoids infinite recursion when this is called from a policy on profiles itself
create or replace function public.current_role()
returns public.profile_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.current_role() = 'admin');

create policy "profiles_update_admin" on public.profiles
  for update using (public.current_role() = 'admin');

create policy "municipios_select_approved" on public.municipios
  for select using (public.current_role() in ('gerencia', 'admin'));
create policy "municipios_insert_approved" on public.municipios
  for insert with check (public.current_role() in ('gerencia', 'admin'));
create policy "municipios_update_approved" on public.municipios
  for update using (public.current_role() in ('gerencia', 'admin'));

create policy "processos_all_approved" on public.processos
  for all using (public.current_role() in ('gerencia', 'admin'))
  with check (public.current_role() in ('gerencia', 'admin'));

create policy "peritos_all_approved" on public.peritos
  for all using (public.current_role() in ('gerencia', 'admin'))
  with check (public.current_role() in ('gerencia', 'admin'));

create policy "colaboradores_all_approved" on public.colaboradores
  for all using (public.current_role() in ('gerencia', 'admin'))
  with check (public.current_role() in ('gerencia', 'admin'));

create policy "pericias_all_approved" on public.pericias
  for all using (public.current_role() in ('gerencia', 'admin'))
  with check (public.current_role() in ('gerencia', 'admin'));
```

- [ ] **Step 3: Review the policies**

Confirm every table has RLS enabled and every policy checks `current_role()` against the allowed roles from the spec (§4): `pendente` gets nothing, `gerencia`/`admin` get full CRUD on domain tables, only `admin` can update `profiles`. Application happens together with Task 4's migration in Task 21.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add profile auto-provisioning trigger and RLS policies"
```

---

## Task 6: Admin seed script

**Files:**
- Create: `scripts/seed-admin.ts`

**Interfaces:**
- Consumes: `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` env vars (server-only, never exposed to the client).
- Produces: a `admin@admin.com` / `admin123` user with `profiles.role = 'admin'`, run once against the live Supabase project in Task 21.

- [ ] **Step 1: Write the seed script**

Create `scripts/seed-admin.ts`:

```ts
import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  const supabase = createClient(url, serviceKey);

  const { data, error } = await supabase.auth.admin.createUser({
    email: 'admin@admin.com',
    password: 'admin123',
    email_confirm: true,
  });
  if (error) throw error;

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ role: 'admin', nome: 'Administrador' })
    .eq('id', data.user.id);
  if (profileError) throw profileError;

  console.log(`Admin seeded: ${data.user.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add a package.json script**

Add to `"scripts"`:

```json
"seed:admin": "tsx scripts/seed-admin.ts"
```

- [ ] **Step 3: Type-check the script**

Run: `npx tsc --noEmit`
Expected: no type errors. (Execution against a live project happens in Task 21, after the Supabase project and migrations exist.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add admin seed script"
```

---

## Task 7: Shared Zod schemas

**Files:**
- Create: `src/features/processos/schemas.ts`
- Create: `src/features/municipios/schemas.ts`
- Create: `src/features/peritos/schemas.ts`
- Create: `src/features/colaboradores/schemas.ts`
- Create: `src/features/pericias/schemas.ts`
- Create: `src/features/perfis/schemas.ts`
- Test: `src/features/pericias/schemas.test.ts`
- Test: `src/features/peritos/schemas.test.ts`

**Interfaces:**
- Produces: `processoSchema`/`ProcessoInput`, `municipioSchema`/`MunicipioInput`, `peritoSchema`/`PeritoInput`, `colaboradorSchema`/`ColaboradorInput`, `periciaSchema`/`PericiaInput`/`situacaoOptions`, `roleOptions`/`Role`/`updateRoleSchema` — consumed by every action and form in later tasks.

- [ ] **Step 1: Write the failing schema tests**

Create `src/features/peritos/schemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { peritoSchema } from './schemas';

describe('peritoSchema', () => {
  it('accepts a valid perito', () => {
    const result = peritoSchema.safeParse({
      nome: 'João Silva',
      contato: '(11) 99999-0000',
      formacao: 'Engenharia Civil',
      crea: '123456',
      documento: '111.111.111-11',
      jaTrabalhamos: true,
      relacao: 8,
      resultados: 9,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty nome', () => {
    const result = peritoSchema.safeParse({ nome: '' });
    expect(result.success).toBe(false);
  });

  it('rejects relacao above 10', () => {
    const result = peritoSchema.safeParse({ nome: 'X', relacao: 11 });
    expect(result.success).toBe(false);
  });

  it('rejects resultados below 0', () => {
    const result = peritoSchema.safeParse({ nome: 'X', resultados: -1 });
    expect(result.success).toBe(false);
  });
});
```

Create `src/features/pericias/schemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { periciaSchema } from './schemas';

describe('periciaSchema', () => {
  it('accepts a valid pericia', () => {
    const result = periciaSchema.safeParse({
      processoId: 1,
      dataAgendada: '2026-08-01',
      horaAgendada: '14:30',
      municipioId: 3550308,
      peritoId: 1,
      colaboradorId: null,
      situacao: 'marcada',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid situacao', () => {
    const result = periciaSchema.safeParse({
      processoId: 1,
      dataAgendada: '2026-08-01',
      horaAgendada: '14:30',
      municipioId: 1,
      peritoId: 1,
      situacao: 'invalida',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed date', () => {
    const result = periciaSchema.safeParse({
      processoId: 1,
      dataAgendada: '01/08/2026',
      horaAgendada: '14:30',
      municipioId: 1,
      peritoId: 1,
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npm run test`
Expected: FAIL — `./schemas` modules don't exist yet.

- [ ] **Step 3: Write the schemas**

Create `src/features/processos/schemas.ts`:

```ts
import { z } from 'zod';

export const processoSchema = z.object({
  numero: z.string().trim().min(1, 'Número do processo é obrigatório'),
  autor: z.string().trim().min(1, 'Autor é obrigatório'),
  reu: z.string().trim().min(1, 'Réu é obrigatório'),
});

export type ProcessoInput = z.infer<typeof processoSchema>;
```

Create `src/features/municipios/schemas.ts`:

```ts
import { z } from 'zod';

export const municipioSchema = z.object({
  id: z.number().int().positive(),
  nome: z.string().trim().min(1),
  uf: z.string().length(2),
});

export type MunicipioInput = z.infer<typeof municipioSchema>;
```

Create `src/features/peritos/schemas.ts`:

```ts
import { z } from 'zod';

export const peritoSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório'),
  contato: z.string().trim().default(''),
  formacao: z.string().trim().default(''),
  crea: z.string().trim().default(''),
  documento: z.string().trim().default(''),
  jaTrabalhamos: z.boolean().default(false),
  relacao: z.number().int().min(0).max(10).default(0),
  resultados: z.number().int().min(0).max(10).default(0),
});

export type PeritoInput = z.infer<typeof peritoSchema>;
```

Create `src/features/colaboradores/schemas.ts`:

```ts
import { z } from 'zod';

export const colaboradorSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório'),
  contato: z.string().trim().default(''),
  formacao: z.string().trim().default(''),
  interno: z.boolean().default(true),
});

export type ColaboradorInput = z.infer<typeof colaboradorSchema>;
```

Create `src/features/pericias/schemas.ts`:

```ts
import { z } from 'zod';

export const situacaoOptions = ['pendente', 'marcada', 'realizada', 'cancelada'] as const;

export const periciaSchema = z.object({
  processoId: z.number().int().positive('Selecione um processo'),
  dataAgendada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  horaAgendada: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida'),
  municipioId: z.number().int().positive('Selecione um município'),
  peritoId: z.number().int().positive('Selecione um perito'),
  colaboradorId: z.number().int().positive().nullable().default(null),
  situacao: z.enum(situacaoOptions).default('pendente'),
});

export type PericiaInput = z.infer<typeof periciaSchema>;
```

Create `src/features/perfis/schemas.ts`:

```ts
import { z } from 'zod';

export const roleOptions = ['pendente', 'gerencia', 'admin'] as const;
export type Role = (typeof roleOptions)[number];

export const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(roleOptions),
});
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Zod schemas for all domain entities"
```

---

## Task 8: IBGE municípios client

**Files:**
- Create: `src/lib/ibge/client.ts`
- Test: `src/lib/ibge/client.test.ts`

**Interfaces:**
- Produces: `searchMunicipios(query: string): Promise<MunicipioIBGE[]>` and `type MunicipioIBGE = { id: number; nome: string; uf: string }`, consumed by the `MunicipioCombobox` in Task 14. Plain browser-callable module (no `'use server'`) — it calls the public IBGE API directly.

- [ ] **Step 1: Write the failing test**

Create `src/lib/ibge/client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchMunicipios, __resetMunicipioCache } from './client';

const sampleResponse = [
  { id: 3550308, nome: 'São Paulo', microrregiao: { mesorregiao: { UF: { sigla: 'SP' } } } },
  { id: 3304557, nome: 'Rio de Janeiro', microrregiao: { mesorregiao: { UF: { sigla: 'RJ' } } } },
  { id: 3106200, nome: 'Belo Horizonte', microrregiao: { mesorregiao: { UF: { sigla: 'MG' } } } },
];

describe('searchMunicipios', () => {
  beforeEach(() => {
    __resetMunicipioCache();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => sampleResponse }))
    );
  });

  it('returns an empty array for queries shorter than 2 characters', async () => {
    const results = await searchMunicipios('s');
    expect(results).toEqual([]);
  });

  it('filters municipios by name, case-insensitively', async () => {
    const results = await searchMunicipios('rio');
    expect(results).toEqual([{ id: 3304557, nome: 'Rio de Janeiro', uf: 'RJ' }]);
  });

  it('caches the full list after the first request', async () => {
    await searchMunicipios('paulo');
    await searchMunicipios('belo');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('throws when the IBGE API responds with an error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => [] })));
    await expect(searchMunicipios('rio')).rejects.toThrow('Falha ao buscar municípios');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test`
Expected: FAIL — `./client` module doesn't exist.

- [ ] **Step 3: Write the client**

Create `src/lib/ibge/client.ts`:

```ts
export type MunicipioIBGE = {
  id: number;
  nome: string;
  uf: string;
};

type IbgeMunicipioResponse = {
  id: number;
  nome: string;
  microrregiao?: { mesorregiao?: { UF?: { sigla?: string } } };
};

let cache: MunicipioIBGE[] | null = null;

async function loadAll(): Promise<MunicipioIBGE[]> {
  if (cache) return cache;
  const res = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios');
  if (!res.ok) throw new Error('Falha ao buscar municípios');
  const data: IbgeMunicipioResponse[] = await res.json();
  cache = data.map((m) => ({
    id: m.id,
    nome: m.nome,
    uf: m.microrregiao?.mesorregiao?.UF?.sigla ?? '',
  }));
  return cache;
}

export async function searchMunicipios(query: string): Promise<MunicipioIBGE[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const all = await loadAll();
  const normalized = trimmed.toLowerCase();
  return all.filter((m) => m.nome.toLowerCase().includes(normalized)).slice(0, 20);
}

export function __resetMunicipioCache() {
  cache = null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add IBGE municipios search client"
```

---

## Task 9: Auth guards and route-guard resolver

**Files:**
- Create: `src/features/auth/guards.ts`
- Create: `src/features/auth/route-guard.ts`
- Test: `src/features/auth/guards.test.ts`
- Test: `src/features/auth/route-guard.test.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server` (Task 3).
- Produces: `getCurrentProfile(): Promise<CurrentProfile | null>`, `requireRole(roles: Role[]): Promise<CurrentProfile>`, `type Role = 'pendente' | 'gerencia' | 'admin'`, `type CurrentProfile = { id: string; nome: string; email: string; role: Role }` from `guards.ts`; `resolveRedirect(input: RouteGuardInput): string | null`, `type RouteGuardInput = { path: string; isAuthenticated: boolean; role: Role | null }` from `route-guard.ts`. Consumed by Task 10 (middleware), Task 12 (app layout), and every server action from Task 13 onward.

- [ ] **Step 1: Write the failing guards test**

Create `src/features/auth/guards.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCurrentProfile, requireRole } from './guards';

const mockGetUser = vi.fn();
const mockSingle = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockSingle,
        }),
      }),
    }),
  })),
}));

describe('getCurrentProfile', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockSingle.mockReset();
  });

  it('returns null when there is no authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const profile = await getCurrentProfile();
    expect(profile).toBeNull();
  });

  it('returns the profile row for an authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockSingle.mockResolvedValue({ data: { id: 'u1', nome: 'Ana', email: 'ana@x.com', role: 'admin' } });
    const profile = await getCurrentProfile();
    expect(profile).toEqual({ id: 'u1', nome: 'Ana', email: 'ana@x.com', role: 'admin' });
  });
});

describe('requireRole', () => {
  it('throws UNAUTHENTICATED when there is no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expect(requireRole(['admin'])).rejects.toThrow('UNAUTHENTICATED');
  });

  it('throws FORBIDDEN when the role is not allowed', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockSingle.mockResolvedValue({ data: { id: 'u1', nome: 'Ana', email: 'ana@x.com', role: 'gerencia' } });
    await expect(requireRole(['admin'])).rejects.toThrow('FORBIDDEN');
  });

  it('resolves with the profile when the role is allowed', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockSingle.mockResolvedValue({ data: { id: 'u1', nome: 'Ana', email: 'ana@x.com', role: 'admin' } });
    const profile = await requireRole(['admin', 'gerencia']);
    expect(profile.id).toBe('u1');
  });
});
```

- [ ] **Step 2: Write the failing route-guard test**

Create `src/features/auth/route-guard.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveRedirect } from './route-guard';

describe('resolveRedirect', () => {
  it('sends unauthenticated users to /login', () => {
    expect(resolveRedirect({ path: '/', isAuthenticated: false, role: null })).toBe('/login');
  });

  it('does not redirect unauthenticated users already on /login', () => {
    expect(resolveRedirect({ path: '/login', isAuthenticated: false, role: null })).toBeNull();
  });

  it('sends authenticated users away from /login', () => {
    expect(resolveRedirect({ path: '/login', isAuthenticated: true, role: 'admin' })).toBe('/');
  });

  it('sends pendente users to /pendente from any other page', () => {
    expect(resolveRedirect({ path: '/', isAuthenticated: true, role: 'pendente' })).toBe('/pendente');
  });

  it('does not redirect pendente users already on /pendente', () => {
    expect(resolveRedirect({ path: '/pendente', isAuthenticated: true, role: 'pendente' })).toBeNull();
  });

  it('sends non-pendente users away from /pendente', () => {
    expect(resolveRedirect({ path: '/pendente', isAuthenticated: true, role: 'gerencia' })).toBe('/');
  });

  it('blocks non-admin users from /perfis', () => {
    expect(resolveRedirect({ path: '/perfis', isAuthenticated: true, role: 'gerencia' })).toBe('/');
  });

  it('allows admin users on /perfis', () => {
    expect(resolveRedirect({ path: '/perfis', isAuthenticated: true, role: 'admin' })).toBeNull();
  });

  it('allows approved users on ordinary pages', () => {
    expect(resolveRedirect({ path: '/peritos', isAuthenticated: true, role: 'gerencia' })).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `./guards` and `./route-guard` don't exist yet.

- [ ] **Step 4: Write the guards**

Create `src/features/auth/guards.ts`:

```ts
import { createClient } from '@/lib/supabase/server';
import type { ProfileRoleValue } from '@/lib/supabase/database.types';

export type Role = ProfileRoleValue;

export type CurrentProfile = {
  id: string;
  nome: string;
  email: string;
  role: Role;
};

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, nome, email, role')
    .eq('id', user.id)
    .single();
  return (profile as CurrentProfile) ?? null;
}

export async function requireRole(roles: Role[]): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error('UNAUTHENTICATED');
  if (!roles.includes(profile.role)) throw new Error('FORBIDDEN');
  return profile;
}
```

- [ ] **Step 5: Write the route-guard resolver**

Create `src/features/auth/route-guard.ts`:

```ts
import type { Role } from './guards';

export type RouteGuardInput = {
  path: string;
  isAuthenticated: boolean;
  role: Role | null;
};

const PUBLIC_PATHS = ['/login', '/auth/callback'];

export function resolveRedirect({ path, isAuthenticated, role }: RouteGuardInput): string | null {
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!isAuthenticated) {
    return isPublic ? null : '/login';
  }
  if (path === '/login') return '/';
  if (role === 'pendente') {
    return path === '/pendente' ? null : '/pendente';
  }
  if (path === '/pendente') return '/';
  if (path.startsWith('/perfis') && role !== 'admin') return '/';
  return null;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add auth guards and route-guard resolver"
```

---

## Task 10: Middleware wiring

**Files:**
- Create: `src/middleware.ts`

**Interfaces:**
- Consumes: `updateSession` (Task 3), `resolveRedirect` (Task 9).
- Produces: request-level route protection, the first of the app's three permission layers.

- [ ] **Step 1: Write the middleware**

Create `src/middleware.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { resolveRedirect } from '@/features/auth/route-guard';

export async function middleware(request: NextRequest) {
  const { response, user, role } = await updateSession(request);

  const target = resolveRedirect({
    path: request.nextUrl.pathname,
    isAuthenticated: Boolean(user),
    role,
  });

  if (target) {
    const url = request.nextUrl.clone();
    url.pathname = target;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: wire route protection into Next.js middleware"
```

---

## Task 11: Login, auth actions, callback route, pendente page

**Files:**
- Create: `src/features/auth/actions.ts`
- Create: `src/features/auth/components/login-form.tsx`
- Create: `src/app/login/page.tsx`
- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/pendente/page.tsx`
- Test: `src/features/auth/components/login-form.test.tsx`

**Interfaces:**
- Consumes: `createClient` (Task 3).
- Produces: `signInWithPassword(prevState, formData)`, `signInWithGoogle()`, `signOut()`, `type AuthActionState = { error: string } | null` from `@/features/auth/actions`; `LoginForm` component. Consumed by Task 12's app layout (`signOut`) and by the login/pendente pages here.

- [ ] **Step 1: Write the failing LoginForm test**

Create `src/features/auth/components/login-form.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { LoginForm } from './login-form';

vi.mock('../actions', () => ({
  signInWithPassword: vi.fn(async () => ({ error: 'E-mail ou senha inválidos' })),
}));

describe('LoginForm', () => {
  it('shows the error returned by the sign-in action', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText('E-mail'), 'admin@admin.com');
    await user.type(screen.getByLabelText('Senha'), 'wrong-pass');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText('E-mail ou senha inválidos')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test`
Expected: FAIL — `login-form.tsx` doesn't exist.

- [ ] **Step 3: Write the auth actions**

Create `src/features/auth/actions.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const credentialsSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
});

export type AuthActionState = { error: string } | null;

export async function signInWithPassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: 'E-mail ou senha inválidos' };
  }
  redirect('/');
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
  });
  if (error || !data.url) {
    throw new Error('Não foi possível iniciar o login com Google');
  }
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
```

- [ ] **Step 4: Write the LoginForm component**

Create `src/features/auth/components/login-form.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { signInWithPassword, type AuthActionState } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function LoginForm() {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(
    signInWithPassword,
    null
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" name="password" type="password" required />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Entrando...' : 'Entrar'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 6: Write the login page**

Create `src/app/login/page.tsx`:

```tsx
import { signInWithGoogle } from '@/features/auth/actions';
import { LoginForm } from '@/features/auth/components/login-form';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="w-full max-w-sm space-y-6 rounded-lg border bg-background p-8 shadow-sm">
        <h1 className="text-xl font-semibold">Gestão de Perícias</h1>
        <form action={signInWithGoogle}>
          <Button type="submit" variant="outline" className="w-full">
            Entrar com Google
          </Button>
        </form>
        <div className="relative text-center text-xs text-muted-foreground">
          <span className="bg-background px-2">ou</span>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Write the OAuth callback route**

Create `src/app/auth/callback/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
```

- [ ] **Step 8: Write the pendente page**

Create `src/app/pendente/page.tsx`:

```tsx
import { signOut } from '@/features/auth/actions';
import { Button } from '@/components/ui/button';

export default function PendentePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-xl font-semibold">Aguardando aprovação</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Seu acesso foi registrado, mas ainda precisa ser liberado por um administrador. Você será
        notificado assim que seu perfil for aprovado.
      </p>
      <form action={signOut}>
        <Button type="submit" variant="outline">Sair</Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 9: Run the full test suite and build**

Run: `npm run test && npx tsc --noEmit`
Expected: all tests pass, no type errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add login page, auth actions, OAuth callback, and pendente page"
```

---

## Task 12: App shell layout and sidebar

**Files:**
- Create: `src/components/shared/sidebar.tsx`
- Create: `src/app/(app)/layout.tsx`
- Test: `src/components/shared/sidebar.test.tsx`

**Interfaces:**
- Consumes: `getCurrentProfile` (Task 9), `Role` (Task 9).
- Produces: `Sidebar({ role: Role })` component; the `(app)` route group layout that every protected page (Tasks 16–20) renders under.

- [ ] **Step 1: Write the failing Sidebar test**

Create `src/components/shared/sidebar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Sidebar } from './sidebar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

describe('Sidebar', () => {
  it('shows Perfis for admin', () => {
    render(<Sidebar role="admin" />);
    expect(screen.getByText('Perfis')).toBeInTheDocument();
  });

  it('hides Perfis for gerencia', () => {
    render(<Sidebar role="gerencia" />);
    expect(screen.queryByText('Perfis')).not.toBeInTheDocument();
  });

  it('always shows Perícias, Peritos, and Colaboradores', () => {
    render(<Sidebar role="gerencia" />);
    expect(screen.getByText('Perícias')).toBeInTheDocument();
    expect(screen.getByText('Peritos')).toBeInTheDocument();
    expect(screen.getByText('Colaboradores')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test`
Expected: FAIL — `./sidebar` doesn't exist.

- [ ] **Step 3: Write the Sidebar**

Create `src/components/shared/sidebar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { Role } from '@/features/auth/guards';

const NAV_ITEMS: { href: string; label: string; roles: Role[] }[] = [
  { href: '/', label: 'Perícias', roles: ['admin', 'gerencia'] },
  { href: '/peritos', label: 'Peritos', roles: ['admin', 'gerencia'] },
  { href: '/colaboradores', label: 'Colaboradores', roles: ['admin', 'gerencia'] },
  { href: '/perfis', label: 'Perfis', roles: ['admin'] },
];

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <nav className="flex h-full w-56 flex-col gap-1 border-r bg-muted/30 p-4">
      <span className="mb-4 px-2 text-lg font-semibold">Gestão de Perícias</span>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'rounded-md px-3 py-2 text-sm font-medium hover:bg-muted',
            pathname === item.href && 'bg-muted text-foreground'
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 5: Write the app shell layout**

Create `src/app/(app)/layout.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/features/auth/guards';
import { Sidebar } from '@/components/shared/sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (profile.role === 'pendente') redirect('/pendente');

  return (
    <div className="flex min-h-screen">
      <Sidebar role={profile.role} />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 6: Move the smoke-test home page out of the way**

Delete `src/app/page.tsx` and `src/app/page.test.tsx` from Task 1 — the real home page (perícias listing) is created inside `(app)/` in Task 16, at the same `/` route. Keeping both would collide.

Run: `git rm src/app/page.tsx src/app/page.test.tsx`

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add role-aware sidebar and protected app shell layout"
```

---

## Task 13: Processos — actions, combobox, "novo processo" dialog

**Files:**
- Create: `src/features/processos/actions.ts`
- Create: `src/features/processos/components/novo-processo-dialog.tsx`
- Create: `src/features/processos/components/processo-combobox.tsx`
- Test: `src/features/processos/components/novo-processo-dialog.test.tsx`

**Interfaces:**
- Consumes: `processoSchema`/`ProcessoInput` (Task 7), `requireRole` (Task 9), `createClient` (Task 3).
- Produces: `searchProcessos(query: string): Promise<Processo[]>`, `createProcesso(input: ProcessoInput): Promise<ActionResult<Processo>>`, `type Processo = { id: number; numero: string; autor: string; reu: string }`; `<ProcessoCombobox value colaborador... />`; `<NovoProcessoDialog />`. Consumed by the `PericiaForm` in Task 17.

- [ ] **Step 1: Write the failing dialog test**

Create `src/features/processos/components/novo-processo-dialog.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { NovoProcessoDialog } from './novo-processo-dialog';

vi.mock('../actions', () => ({
  createProcesso: vi.fn(async (input: { numero: string; autor: string; reu: string }) => ({
    success: true,
    data: { id: 42, ...input },
  })),
}));

describe('NovoProcessoDialog', () => {
  it('calls onCreated with the new processo and closes on success', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const onOpenChange = vi.fn();

    render(<NovoProcessoDialog open onOpenChange={onOpenChange} onCreated={onCreated} />);

    await user.type(screen.getByLabelText('Número do processo'), '0001234-56.2026.8.26.0100');
    await user.type(screen.getByLabelText('Autor'), 'Maria Souza');
    await user.type(screen.getByLabelText('Réu'), 'João Pereira');
    await user.click(screen.getByRole('button', { name: /salvar e vincular/i }));

    expect(onCreated).toHaveBeenCalledWith({
      id: 42,
      numero: '0001234-56.2026.8.26.0100',
      autor: 'Maria Souza',
      reu: 'João Pereira',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the processos actions**

Create `src/features/processos/actions.ts`:

```ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/features/auth/guards';
import type { ActionResult } from '@/lib/action-result';
import { processoSchema, type ProcessoInput } from './schemas';

export type Processo = { id: number; numero: string; autor: string; reu: string };

export async function searchProcessos(query: string): Promise<Processo[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  let request = supabase.from('processos').select('id, numero, autor, reu').order('numero').limit(20);
  if (query.trim()) {
    request = request.or(`numero.ilike.%${query}%,autor.ilike.%${query}%,reu.ilike.%${query}%`);
  }
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createProcesso(input: ProcessoInput): Promise<ActionResult<Processo>> {
  await requireRole(['admin', 'gerencia']);
  const parsed = processoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('processos')
    .insert(parsed.data)
    .select('id, numero, autor, reu')
    .single();
  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Já existe um processo com esse número' };
    }
    return { success: false, error: error.message };
  }
  return { success: true, data };
}
```

- [ ] **Step 4: Write the "novo processo" dialog**

Create `src/features/processos/components/novo-processo-dialog.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createProcesso, type Processo } from '../actions';

export function NovoProcessoDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (processo: Processo) => void;
}) {
  const [numero, setNumero] = useState('');
  const [autor, setAutor] = useState('');
  const [reu, setReu] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await createProcesso({ numero, autor, reu });
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onCreated(result.data);
    setNumero('');
    setAutor('');
    setReu('');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo processo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="numero">Número do processo</Label>
            <Input id="numero" value={numero} onChange={(e) => setNumero(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="autor">Autor</Label>
            <Input id="autor" value={autor} onChange={(e) => setAutor(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reu">Réu</Label>
            <Input id="reu" value={reu} onChange={(e) => setReu(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar e vincular'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 6: Write the processo combobox**

Create `src/features/processos/components/processo-combobox.tsx`:

```tsx
'use client';

import { useEffect, useState, useTransition } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { searchProcessos, type Processo } from '../actions';
import { NovoProcessoDialog } from './novo-processo-dialog';

export function ProcessoCombobox({
  value,
  selected,
  onChange,
}: {
  value: number | null;
  selected: Processo | null;
  onChange: (processo: Processo) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Processo[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const handle = setTimeout(() => {
      startTransition(async () => {
        setResults(await searchProcessos(query));
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button type="button" variant="outline" role="combobox" className="w-full justify-between" />}
        >
          {selected ? `${selected.numero} — ${selected.autor} x ${selected.reu}` : 'Selecione um processo'}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Buscar processo..." value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>{isPending ? 'Buscando...' : 'Nenhum processo encontrado.'}</CommandEmpty>
              <CommandGroup>
                {results.map((processo) => (
                  <CommandItem
                    key={processo.id}
                    value={String(processo.id)}
                    onSelect={() => {
                      onChange(processo);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === processo.id ? 'opacity-100' : 'opacity-0')} />
                    {processo.numero} — {processo.autor} x {processo.reu}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  setOpen(false);
                  setDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Novo processo
              </Button>
            </div>
          </Command>
        </PopoverContent>
      </Popover>
      <NovoProcessoDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={onChange} />
    </>
  );
}
```

- [ ] **Step 7: Type-check and run the full suite**

Run: `npm run test && npx tsc --noEmit`
Expected: all tests pass, no type errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add processos search/create actions and combobox with inline creation"
```

---

## Task 14: Municípios — upsert action and combobox

**Files:**
- Create: `src/features/municipios/actions.ts`
- Create: `src/features/municipios/components/municipio-combobox.tsx`
- Test: `src/features/municipios/actions.test.ts`

**Interfaces:**
- Consumes: `municipioSchema`/`MunicipioInput` (Task 7), `requireRole` (Task 9), `createClient` (Task 3), `searchMunicipios`/`MunicipioIBGE` (Task 8).
- Produces: `upsertMunicipio(input: MunicipioInput): Promise<MunicipioInput>`; `<MunicipioCombobox />`. Consumed by `PericiaForm` in Task 17.

- [ ] **Step 1: Write the failing action test**

Create `src/features/municipios/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { upsertMunicipio } from './actions';

const mockUpsert = vi.fn();

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ upsert: mockUpsert }),
  })),
}));

describe('upsertMunicipio', () => {
  beforeEach(() => mockUpsert.mockReset());

  it('upserts a valid municipio and returns it', async () => {
    mockUpsert.mockResolvedValue({ error: null });
    const result = await upsertMunicipio({ id: 3550308, nome: 'São Paulo', uf: 'SP' });
    expect(result).toEqual({ id: 3550308, nome: 'São Paulo', uf: 'SP' });
    expect(mockUpsert).toHaveBeenCalledWith({ id: 3550308, nome: 'São Paulo', uf: 'SP' });
  });

  it('throws when the upsert fails', async () => {
    mockUpsert.mockResolvedValue({ error: { message: 'db error' } });
    await expect(upsertMunicipio({ id: 1, nome: 'X', uf: 'SP' })).rejects.toThrow('db error');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test`
Expected: FAIL — `./actions` doesn't exist.

- [ ] **Step 3: Write the municipios actions**

Create `src/features/municipios/actions.ts`:

```ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/features/auth/guards';
import { municipioSchema, type MunicipioInput } from './schemas';

export async function upsertMunicipio(input: MunicipioInput): Promise<MunicipioInput> {
  await requireRole(['admin', 'gerencia']);
  const parsed = municipioSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from('municipios').upsert(parsed);
  if (error) throw new Error(error.message);
  return parsed;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 5: Write the municipio combobox**

Create `src/features/municipios/components/municipio-combobox.tsx`:

```tsx
'use client';

import { useEffect, useState, useTransition } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { searchMunicipios, type MunicipioIBGE } from '@/lib/ibge/client';
import { upsertMunicipio } from '../actions';

export function MunicipioCombobox({
  value,
  selected,
  onChange,
}: {
  value: number | null;
  selected: MunicipioIBGE | null;
  onChange: (municipio: MunicipioIBGE) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MunicipioIBGE[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const handle = setTimeout(() => {
      startTransition(async () => {
        setResults(await searchMunicipios(query));
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  async function handleSelect(municipio: MunicipioIBGE) {
    await upsertMunicipio(municipio);
    onChange(municipio);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button type="button" variant="outline" role="combobox" className="w-full justify-between" />}
      >
        {selected ? `${selected.nome}/${selected.uf}` : 'Selecione um município'}
        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar município..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{isPending ? 'Buscando...' : 'Digite ao menos 2 letras.'}</CommandEmpty>
            <CommandGroup>
              {results.map((municipio) => (
                <CommandItem
                  key={municipio.id}
                  value={String(municipio.id)}
                  onSelect={() => handleSelect(municipio)}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === municipio.id ? 'opacity-100' : 'opacity-0')} />
                  {municipio.nome}/{municipio.uf}
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

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add municipio upsert action and IBGE-backed combobox"
```

---

## Task 15: Perícias — server actions

**Files:**
- Create: `src/features/pericias/actions.ts`
- Test: `src/features/pericias/actions.test.ts`

**Interfaces:**
- Consumes: `periciaSchema`/`PericiaInput`/`situacaoOptions` (Task 7), `requireRole` (Task 9), `createClient` (Task 3).
- Produces: `listPericias(filters): Promise<PericiaListItem[]>`, `createPericia(input): Promise<ActionResult<{id:number}>>`, `updatePericia(id, input): Promise<ActionResult<{id:number}>>`, `getPericiaForEdit(id): Promise<(PericiaInput & {id:number; processo: Processo; municipio: MunicipioIBGE}) | null>`, `type PericiaListItem`. Consumed by Task 16 (listing) and Task 17 (form/pages).

- [ ] **Step 1: Write the failing tests**

Create `src/features/pericias/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPericia, updatePericia } from './actions';

const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockInsert = vi.fn(() => ({ select: mockSelect }));
const mockEq = vi.fn(() => ({ error: null }));
const mockUpdate = vi.fn(() => ({ eq: mockEq }));

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ insert: mockInsert, update: mockUpdate }),
  })),
}));

const validInput = {
  processoId: 1,
  dataAgendada: '2026-08-01',
  horaAgendada: '14:30',
  municipioId: 3550308,
  peritoId: 1,
  colaboradorId: null,
  situacao: 'marcada' as const,
};

describe('createPericia', () => {
  beforeEach(() => {
    mockSingle.mockReset();
  });

  it('returns an error for invalid input without touching the database', async () => {
    const result = await createPericia({ ...validInput, processoId: 0 });
    expect(result).toEqual({ success: false, error: 'Selecione um processo' });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('inserts a valid pericia and returns its id', async () => {
    mockSingle.mockResolvedValue({ data: { id: 10 }, error: null });
    const result = await createPericia(validInput);
    expect(result).toEqual({ success: true, data: { id: 10 } });
    expect(mockInsert).toHaveBeenCalledWith({
      processo_id: 1,
      data_agendada: '2026-08-01',
      hora_agendada: '14:30',
      municipio_id: 3550308,
      perito_id: 1,
      colaborador_id: null,
      situacao: 'marcada',
    });
  });
});

describe('updatePericia', () => {
  it('updates an existing pericia', async () => {
    const result = await updatePericia(10, validInput);
    expect(result).toEqual({ success: true, data: { id: 10 } });
    expect(mockUpdate).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `./actions` doesn't exist.

- [ ] **Step 3: Write the pericias actions**

Create `src/features/pericias/actions.ts`:

```ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/features/auth/guards';
import type { ActionResult } from '@/lib/action-result';
import type { Processo } from '@/features/processos/actions';
import type { MunicipioIBGE } from '@/lib/ibge/client';
import { periciaSchema, type PericiaInput } from './schemas';

export type PericiaListItem = {
  id: number;
  dataAgendada: string;
  horaAgendada: string;
  situacao: PericiaInput['situacao'];
  processo: { id: number; numero: string; autor: string; reu: string };
  municipio: { id: number; nome: string; uf: string };
  perito: {
    id: number; nome: string; contato: string; formacao: string; crea: string;
    jaTrabalhamos: boolean; relacao: number; resultados: number;
  };
  colaborador: { id: number; nome: string; contato: string; formacao: string; interno: boolean } | null;
};

function toRow(input: PericiaInput) {
  return {
    processo_id: input.processoId,
    data_agendada: input.dataAgendada,
    hora_agendada: input.horaAgendada,
    municipio_id: input.municipioId,
    perito_id: input.peritoId,
    colaborador_id: input.colaboradorId,
    situacao: input.situacao,
  };
}

export async function listPericias(
  filters: { situacao?: string; busca?: string } = {}
): Promise<PericiaListItem[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  let query = supabase
    .from('pericias')
    .select(`
      id, data_agendada, hora_agendada, situacao,
      processo:processos ( id, numero, autor, reu ),
      municipio:municipios ( id, nome, uf ),
      perito:peritos ( id, nome, contato, formacao, crea, ja_trabalhamos, relacao, resultados ),
      colaborador:colaboradores ( id, nome, contato, formacao, interno )
    `)
    .order('data_agendada', { ascending: false });

  if (filters.situacao) {
    query = query.eq('situacao', filters.situacao);
  }
  if (filters.busca) {
    query = query.filter('processo.numero', 'ilike', `%${filters.busca}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    dataAgendada: row.data_agendada,
    horaAgendada: row.hora_agendada,
    situacao: row.situacao,
    processo: row.processo,
    municipio: row.municipio,
    perito: {
      id: row.perito.id,
      nome: row.perito.nome,
      contato: row.perito.contato,
      formacao: row.perito.formacao,
      crea: row.perito.crea,
      jaTrabalhamos: row.perito.ja_trabalhamos,
      relacao: row.perito.relacao,
      resultados: row.perito.resultados,
    },
    colaborador: row.colaborador
      ? {
          id: row.colaborador.id,
          nome: row.colaborador.nome,
          contato: row.colaborador.contato,
          formacao: row.colaborador.formacao,
          interno: row.colaborador.interno,
        }
      : null,
  }));
}

export async function createPericia(input: PericiaInput): Promise<ActionResult<{ id: number }>> {
  await requireRole(['admin', 'gerencia']);
  const parsed = periciaSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from('pericias').insert(toRow(parsed.data)).select('id').single();
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function updatePericia(
  id: number,
  input: PericiaInput
): Promise<ActionResult<{ id: number }>> {
  await requireRole(['admin', 'gerencia']);
  const parsed = periciaSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from('pericias').update(toRow(parsed.data)).eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, data: { id } };
}

export async function getPericiaForEdit(
  id: number
): Promise<(PericiaInput & { id: number; processo: Processo; municipio: MunicipioIBGE }) | null> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pericias')
    .select(`
      id, data_agendada, hora_agendada, situacao, perito_id, colaborador_id,
      processo:processos ( id, numero, autor, reu ),
      municipio:municipios ( id, nome, uf )
    `)
    .eq('id', id)
    .single();
  if (error || !data) return null;
  const row = data as any;
  return {
    id: row.id,
    processoId: row.processo.id,
    dataAgendada: row.data_agendada,
    horaAgendada: row.hora_agendada,
    municipioId: row.municipio.id,
    peritoId: row.perito_id,
    colaboradorId: row.colaborador_id,
    situacao: row.situacao,
    processo: row.processo,
    municipio: row.municipio,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add pericias list/create/update/get server actions"
```

---

## Task 16: Perícias — listing page (home)

**Files:**
- Create: `src/components/shared/tooltip-cell.tsx`
- Create: `src/components/shared/status-badge.tsx`
- Create: `src/features/pericias/components/pericias-table.tsx`
- Create: `src/features/pericias/components/pericias-filters.tsx`
- Create: `src/app/(app)/page.tsx`
- Test: `src/features/pericias/components/pericias-table.test.tsx`

**Interfaces:**
- Consumes: `listPericias`/`PericiaListItem` (Task 15), `situacaoOptions` (Task 7).
- Produces: `<TooltipCell label detail />`, `<StatusBadge situacao />`, `<PericiasTable items />`, `<PericiasFilters />`, and the `/` route — the app's home page.

- [ ] **Step 1: Write the failing table test**

Create `src/features/pericias/components/pericias-table.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { PericiasTable } from './pericias-table';
import type { PericiaListItem } from '../actions';

const items: PericiaListItem[] = [
  {
    id: 1,
    dataAgendada: '2026-08-01',
    horaAgendada: '14:30',
    situacao: 'marcada',
    processo: { id: 1, numero: '0001234-56.2026.8.26.0100', autor: 'Maria Souza', reu: 'João Pereira' },
    municipio: { id: 3550308, nome: 'São Paulo', uf: 'SP' },
    perito: {
      id: 1, nome: 'Carlos Lima', contato: '(11) 90000-0000', formacao: 'Eng. Civil', crea: '123456',
      jaTrabalhamos: true, relacao: 8, resultados: 9,
    },
    colaborador: null,
  },
];

describe('PericiasTable', () => {
  it('renders the required columns', () => {
    render(<PericiasTable items={items} />);
    expect(screen.getByText('0001234-56.2026.8.26.0100')).toBeInTheDocument();
    expect(screen.getByText('São Paulo/SP')).toBeInTheDocument();
    expect(screen.getByText('Carlos Lima')).toBeInTheDocument();
    expect(screen.getByText('Marcada')).toBeInTheDocument();
  });

  it('shows the autor x reu tooltip on hover over the processo number', async () => {
    const user = userEvent.setup();
    render(<PericiasTable items={items} />);
    await user.hover(screen.getByText('0001234-56.2026.8.26.0100'));
    expect(await screen.findByText('Maria Souza × João Pereira')).toBeInTheDocument();
  });

  it('shows a dash when there is no colaborador', () => {
    render(<PericiasTable items={items} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows a message when there are no items', () => {
    render(<PericiasTable items={[]} />);
    expect(screen.getByText('Nenhuma perícia encontrada.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the shared TooltipCell and StatusBadge**

Create `src/components/shared/tooltip-cell.tsx`:

```tsx
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function TooltipCell({ label, detail }: { label: React.ReactNode; detail: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="cursor-default" />}>{label}</TooltipTrigger>
      <TooltipContent>{detail}</TooltipContent>
    </Tooltip>
  );
}
```

Create `src/components/shared/status-badge.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import type { PericiaListItem } from '@/features/pericias/actions';

const STYLES: Record<PericiaListItem['situacao'], string> = {
  pendente: 'bg-yellow-100 text-yellow-800',
  marcada: 'bg-blue-100 text-blue-800',
  realizada: 'bg-green-100 text-green-800',
  cancelada: 'bg-red-100 text-red-800',
};

const LABELS: Record<PericiaListItem['situacao'], string> = {
  pendente: 'Pendente',
  marcada: 'Marcada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
};

export function StatusBadge({ situacao }: { situacao: PericiaListItem['situacao'] }) {
  return <Badge className={STYLES[situacao]}>{LABELS[situacao]}</Badge>;
}
```

- [ ] **Step 4: Write the PericiasTable**

Create `src/features/pericias/components/pericias-table.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TooltipCell } from '@/components/shared/tooltip-cell';
import { StatusBadge } from '@/components/shared/status-badge';
import type { PericiaListItem } from '../actions';

export function PericiasTable({ items }: { items: PericiaListItem[] }) {
  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhuma perícia encontrada.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nº Processo</TableHead>
          <TableHead>Data - Hora</TableHead>
          <TableHead>Local</TableHead>
          <TableHead>Perito</TableHead>
          <TableHead>Colaborador</TableHead>
          <TableHead>Situação</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <Link href={`/pericias/${item.id}`}>
                <TooltipCell label={item.processo.numero} detail={`${item.processo.autor} × ${item.processo.reu}`} />
              </Link>
            </TableCell>
            <TableCell>
              {new Date(`${item.dataAgendada}T${item.horaAgendada}`).toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </TableCell>
            <TableCell>
              <TooltipCell
                label={`${item.municipio.nome}/${item.municipio.uf}`}
                detail={`${item.municipio.nome} - ${item.municipio.uf}`}
              />
            </TableCell>
            <TableCell>
              <TooltipCell
                label={item.perito.nome}
                detail={
                  `Contato: ${item.perito.contato} | Formação: ${item.perito.formacao} | ` +
                  `CREA: ${item.perito.crea} | Já trabalhamos: ${item.perito.jaTrabalhamos ? 'Sim' : 'Não'} | ` +
                  `Relação: ${item.perito.relacao}/10 | Resultados: ${item.perito.resultados}/10`
                }
              />
            </TableCell>
            <TableCell>
              {item.colaborador ? (
                <TooltipCell
                  label={item.colaborador.nome}
                  detail={
                    `Contato: ${item.colaborador.contato} | Formação: ${item.colaborador.formacao} | ` +
                    `${item.colaborador.interno ? 'Interno' : 'Externo'}`
                  }
                />
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              <StatusBadge situacao={item.situacao} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 6: Write the filters component**

Create `src/features/pericias/components/pericias-filters.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { situacaoOptions } from '../schemas';

export function PericiasFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busca, setBusca] = useState(searchParams.get('busca') ?? '');

  useEffect(() => {
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

  return (
    <div className="flex gap-3">
      <Input
        placeholder="Buscar por número do processo"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="max-w-xs"
      />
      <Select
        defaultValue={searchParams.get('situacao') ?? 'all'}
        onValueChange={(value) => updateParam('situacao', value === 'all' ? '' : value)}
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
    </div>
  );
}
```

- [ ] **Step 7: Write the home page**

Create `src/app/(app)/page.tsx`:

```tsx
import Link from 'next/link';
import { listPericias } from '@/features/pericias/actions';
import { PericiasTable } from '@/features/pericias/components/pericias-table';
import { PericiasFilters } from '@/features/pericias/components/pericias-filters';
import { Button } from '@/components/ui/button';

export default async function PericiasPage({
  searchParams,
}: {
  searchParams: Promise<{ situacao?: string; busca?: string }>;
}) {
  const { situacao, busca } = await searchParams;
  const items = await listPericias({ situacao, busca });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Perícias</h1>
        <Button render={<Link href="/pericias/nova" />}>Nova perícia</Button>
      </div>
      <PericiasFilters />
      <PericiasTable items={items} />
    </div>
  );
}
```

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add pericias listing page with tooltips, status badges, and filters"
```

---

## Task 17: Perícias — form, cadastro/edição pages

**Files:**
- Create: `src/features/pericias/components/pericia-form.tsx`
- Create: `src/app/(app)/pericias/nova/page.tsx`
- Create: `src/app/(app)/pericias/[id]/page.tsx`
- Test: `src/features/pericias/components/pericia-form.test.tsx`

**Interfaces:**
- Consumes: `createPericia`/`updatePericia`/`getPericiaForEdit` (Task 15), `ProcessoCombobox` (Task 13), `MunicipioCombobox` (Task 14), `listPeritosOptions` (Task 18), `listColaboradoresOptions` (Task 19).
- Produces: `<PericiaForm pericia? peritos colaboradores />`, the `/pericias/nova` and `/pericias/[id]` routes.

> Note: this task depends on `listPeritosOptions` and `listColaboradoresOptions` from Tasks 18/19. If executing tasks out of order, implement Task 18 and 19's actions files first, or stub these two functions locally and replace the stub when those tasks land.

- [ ] **Step 1: Write the failing form test**

Create `src/features/pericias/components/pericia-form.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PericiaForm } from './pericia-form';

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock('../actions', () => ({
  createPericia: vi.fn(async () => ({ success: true, data: { id: 5 } })),
  updatePericia: vi.fn(async () => ({ success: true, data: { id: 5 } })),
}));

vi.mock('@/features/processos/components/processo-combobox', () => ({
  ProcessoCombobox: ({ onChange }: { onChange: (p: any) => void }) => (
    <button type="button" onClick={() => onChange({ id: 1, numero: 'P-1', autor: 'A', reu: 'B' })}>
      selecionar processo
    </button>
  ),
}));

vi.mock('@/features/municipios/components/municipio-combobox', () => ({
  MunicipioCombobox: ({ onChange }: { onChange: (m: any) => void }) => (
    <button type="button" onClick={() => onChange({ id: 3550308, nome: 'São Paulo', uf: 'SP' })}>
      selecionar município
    </button>
  ),
}));

describe('PericiaForm', () => {
  it('requires processo, municipio, and perito before submitting', async () => {
    const user = userEvent.setup();
    render(<PericiaForm peritos={[{ id: 1, nome: 'Carlos' }]} colaboradores={[]} />);

    await user.click(screen.getByRole('button', { name: /salvar perícia/i }));

    expect(await screen.findByText('Preencha processo, município e perito.')).toBeInTheDocument();
  });

  it('submits successfully once processo, municipio, and perito are set', async () => {
    const user = userEvent.setup();
    render(<PericiaForm peritos={[{ id: 1, nome: 'Carlos' }]} colaboradores={[]} />);

    await user.click(screen.getByText('selecionar processo'));
    await user.click(screen.getByText('selecionar município'));
    await user.type(screen.getByLabelText('Data agendada'), '2026-08-01');
    await user.type(screen.getByLabelText('Hora agendada'), '14:30');
    await user.click(screen.getByRole('combobox', { name: /perito/i }));
    await user.click(await screen.findByText('Carlos'));
    await user.click(screen.getByRole('button', { name: /salvar perícia/i }));

    expect(pushMock).toHaveBeenCalledWith('/');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the PericiaForm**

Create `src/features/pericias/components/pericia-form.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProcessoCombobox } from '@/features/processos/components/processo-combobox';
import { MunicipioCombobox } from '@/features/municipios/components/municipio-combobox';
import { createPericia, updatePericia } from '../actions';
import { situacaoOptions, type PericiaInput } from '../schemas';
import type { Processo } from '@/features/processos/actions';
import type { MunicipioIBGE } from '@/lib/ibge/client';

type PeritoOption = { id: number; nome: string };
type ColaboradorOption = { id: number; nome: string };

export function PericiaForm({
  pericia,
  peritos,
  colaboradores,
}: {
  pericia?: PericiaInput & { id: number; processo: Processo; municipio: MunicipioIBGE };
  peritos: PeritoOption[];
  colaboradores: ColaboradorOption[];
}) {
  const router = useRouter();
  const [processo, setProcesso] = useState<Processo | null>(pericia?.processo ?? null);
  const [municipio, setMunicipio] = useState<MunicipioIBGE | null>(pericia?.municipio ?? null);
  const [peritoId, setPeritoId] = useState(pericia?.peritoId ? String(pericia.peritoId) : '');
  const [colaboradorId, setColaboradorId] = useState(
    pericia?.colaboradorId ? String(pericia.colaboradorId) : ''
  );
  const [dataAgendada, setDataAgendada] = useState(pericia?.dataAgendada ?? '');
  const [horaAgendada, setHoraAgendada] = useState(pericia?.horaAgendada ?? '');
  const [situacao, setSituacao] = useState<PericiaInput['situacao']>(pericia?.situacao ?? 'pendente');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!processo || !municipio || !peritoId) {
      setError('Preencha processo, município e perito.');
      return;
    }
    setSaving(true);
    setError(null);
    const input: PericiaInput = {
      processoId: processo.id,
      municipioId: municipio.id,
      peritoId: Number(peritoId),
      colaboradorId: colaboradorId ? Number(colaboradorId) : null,
      dataAgendada,
      horaAgendada,
      situacao,
    };
    const result = pericia ? await updatePericia(pericia.id, input) : await createPericia(input);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
      <div className="space-y-2">
        <Label>Processo</Label>
        <ProcessoCombobox value={processo?.id ?? null} selected={processo} onChange={setProcesso} />
      </div>

      <div className="space-y-2">
        <Label>Município</Label>
        <MunicipioCombobox value={municipio?.id ?? null} selected={municipio} onChange={setMunicipio} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="data">Data agendada</Label>
          <Input id="data" type="date" value={dataAgendada} onChange={(e) => setDataAgendada(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hora">Hora agendada</Label>
          <Input id="hora" type="time" value={horaAgendada} onChange={(e) => setHoraAgendada(e.target.value)} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="perito">Perito</Label>
        <Select value={peritoId} onValueChange={setPeritoId}>
          <SelectTrigger id="perito"><SelectValue placeholder="Selecione um perito" /></SelectTrigger>
          <SelectContent>
            {peritos.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="colaborador">Colaborador (opcional)</Label>
        <Select value={colaboradorId} onValueChange={setColaboradorId}>
          <SelectTrigger id="colaborador"><SelectValue placeholder="Selecione um colaborador" /></SelectTrigger>
          <SelectContent>
            {colaboradores.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="situacao">Situação</Label>
        <Select value={situacao} onValueChange={(v) => setSituacao(v as PericiaInput['situacao'])}>
          <SelectTrigger id="situacao"><SelectValue /></SelectTrigger>
          <SelectContent>
            {situacaoOptions.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={saving}>
        {saving ? 'Salvando...' : 'Salvar perícia'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 5: Write the cadastro and edição pages**

Create `src/app/(app)/pericias/nova/page.tsx`:

```tsx
import { PericiaForm } from '@/features/pericias/components/pericia-form';
import { listPeritosOptions } from '@/features/peritos/actions';
import { listColaboradoresOptions } from '@/features/colaboradores/actions';

export default async function NovaPericiaPage() {
  const [peritos, colaboradores] = await Promise.all([listPeritosOptions(), listColaboradoresOptions()]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Nova perícia</h1>
      <PericiaForm peritos={peritos} colaboradores={colaboradores} />
    </div>
  );
}
```

Create `src/app/(app)/pericias/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { getPericiaForEdit } from '@/features/pericias/actions';
import { listPeritosOptions } from '@/features/peritos/actions';
import { listColaboradoresOptions } from '@/features/colaboradores/actions';
import { PericiaForm } from '@/features/pericias/components/pericia-form';

export default async function EditarPericiaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [pericia, peritos, colaboradores] = await Promise.all([
    getPericiaForEdit(Number(id)),
    listPeritosOptions(),
    listColaboradoresOptions(),
  ]);
  if (!pericia) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Editar perícia</h1>
      <PericiaForm pericia={pericia} peritos={peritos} colaboradores={colaboradores} />
    </div>
  );
}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no type errors (requires Tasks 18/19's `listPeritosOptions`/`listColaboradoresOptions` to exist).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add pericia form and cadastro/edicao pages"
```

---

## Task 18: Peritos — actions, table, form, pages

**Files:**
- Create: `src/features/peritos/actions.ts`
- Create: `src/features/peritos/components/peritos-table.tsx`
- Create: `src/features/peritos/components/perito-form.tsx`
- Create: `src/app/(app)/peritos/page.tsx`
- Create: `src/app/(app)/peritos/novo/page.tsx`
- Create: `src/app/(app)/peritos/[id]/page.tsx`
- Test: `src/features/peritos/components/perito-form.test.tsx`

**Interfaces:**
- Consumes: `peritoSchema`/`PeritoInput` (Task 7), `requireRole` (Task 9), `createClient` (Task 3).
- Produces: `listPeritos()`, `listPeritosOptions()`, `getPerito(id)`, `createPerito(input)`, `updatePerito(id, input)`, `type Perito`; `<PeritosTable items />`, `<PeritoForm perito? />`; `/peritos`, `/peritos/novo`, `/peritos/[id]` routes.

- [ ] **Step 1: Write the failing form test**

Create `src/features/peritos/components/perito-form.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PeritoForm } from './perito-form';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

vi.mock('../actions', () => ({
  createPerito: vi.fn(async () => ({ success: false, error: 'Nome é obrigatório' })),
}));

describe('PeritoForm', () => {
  it('shows the error returned by the action when validation fails', async () => {
    const user = userEvent.setup();
    render(<PeritoForm />);

    await user.click(screen.getByRole('button', { name: /salvar perito/i }));

    expect(await screen.findByText('Nome é obrigatório')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the peritos actions**

Create `src/features/peritos/actions.ts`:

```ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/features/auth/guards';
import type { ActionResult } from '@/lib/action-result';
import { peritoSchema, type PeritoInput } from './schemas';

export type Perito = {
  id: number; nome: string; contato: string; formacao: string; crea: string;
  documento: string; jaTrabalhamos: boolean; relacao: number; resultados: number;
};

function toRow(input: PeritoInput) {
  return {
    nome: input.nome,
    contato: input.contato,
    formacao: input.formacao,
    crea: input.crea,
    documento: input.documento,
    ja_trabalhamos: input.jaTrabalhamos,
    relacao: input.relacao,
    resultados: input.resultados,
  };
}

function fromRow(row: any): Perito {
  return {
    id: row.id, nome: row.nome, contato: row.contato, formacao: row.formacao, crea: row.crea,
    documento: row.documento, jaTrabalhamos: row.ja_trabalhamos, relacao: row.relacao, resultados: row.resultados,
  };
}

export async function listPeritos(): Promise<Perito[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { data, error } = await supabase.from('peritos').select('*').order('nome');
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromRow);
}

export async function listPeritosOptions(): Promise<{ id: number; nome: string }[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { data, error } = await supabase.from('peritos').select('id, nome').order('nome');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPerito(id: number): Promise<Perito | null> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { data, error } = await supabase.from('peritos').select('*').eq('id', id).single();
  if (error || !data) return null;
  return fromRow(data);
}

export async function createPerito(input: PeritoInput): Promise<ActionResult<Perito>> {
  await requireRole(['admin', 'gerencia']);
  const parsed = peritoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from('peritos').insert(toRow(parsed.data)).select('*').single();
  if (error) return { success: false, error: error.message };
  return { success: true, data: fromRow(data) };
}

export async function updatePerito(id: number, input: PeritoInput): Promise<ActionResult<Perito>> {
  await requireRole(['admin', 'gerencia']);
  const parsed = peritoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from('peritos').update(toRow(parsed.data)).eq('id', id).select('*').single();
  if (error) return { success: false, error: error.message };
  return { success: true, data: fromRow(data) };
}
```

- [ ] **Step 4: Write the PeritoForm**

Create `src/features/peritos/components/perito-form.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { createPerito, updatePerito, type Perito } from '../actions';
import type { PeritoInput } from '../schemas';

export function PeritoForm({ perito }: { perito?: Perito }) {
  const router = useRouter();
  const [nome, setNome] = useState(perito?.nome ?? '');
  const [contato, setContato] = useState(perito?.contato ?? '');
  const [formacao, setFormacao] = useState(perito?.formacao ?? '');
  const [crea, setCrea] = useState(perito?.crea ?? '');
  const [documento, setDocumento] = useState(perito?.documento ?? '');
  const [jaTrabalhamos, setJaTrabalhamos] = useState(perito?.jaTrabalhamos ?? false);
  const [relacao, setRelacao] = useState(perito?.relacao ?? 0);
  const [resultados, setResultados] = useState(perito?.resultados ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const input: PeritoInput = { nome, contato, formacao, crea, documento, jaTrabalhamos, relacao, resultados };
    const result = perito ? await updatePerito(perito.id, input) : await createPerito(input);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push('/peritos');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
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
          <Label htmlFor="relacao">Relação (0 a 10)</Label>
          <Input
            id="relacao" type="number" min={0} max={10} value={relacao}
            onChange={(e) => setRelacao(Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="resultados">Resultados (0 a 10)</Label>
          <Input
            id="resultados" type="number" min={0} max={10} value={resultados}
            onChange={(e) => setResultados(Number(e.target.value))}
          />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={saving}>
        {saving ? 'Salvando...' : 'Salvar perito'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 6: Write the PeritosTable**

Create `src/features/peritos/components/peritos-table.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Perito } from '../actions';

export function PeritosTable({ items }: { items: Perito[] }) {
  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhum perito cadastrado.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Contato</TableHead>
          <TableHead>Formação</TableHead>
          <TableHead>CREA</TableHead>
          <TableHead>Relação</TableHead>
          <TableHead>Resultados</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <Link href={`/peritos/${item.id}`} className="hover:underline">{item.nome}</Link>
            </TableCell>
            <TableCell>{item.contato}</TableCell>
            <TableCell>{item.formacao}</TableCell>
            <TableCell>{item.crea}</TableCell>
            <TableCell>{item.relacao}/10</TableCell>
            <TableCell>{item.resultados}/10</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 7: Write the peritos pages**

Create `src/app/(app)/peritos/page.tsx`:

```tsx
import Link from 'next/link';
import { listPeritos } from '@/features/peritos/actions';
import { PeritosTable } from '@/features/peritos/components/peritos-table';
import { Button } from '@/components/ui/button';

export default async function PeritosPage() {
  const items = await listPeritos();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Peritos</h1>
        <Button render={<Link href="/peritos/novo" />}>Novo perito</Button>
      </div>
      <PeritosTable items={items} />
    </div>
  );
}
```

Create `src/app/(app)/peritos/novo/page.tsx`:

```tsx
import { PeritoForm } from '@/features/peritos/components/perito-form';

export default function NovoPeritoPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Novo perito</h1>
      <PeritoForm />
    </div>
  );
}
```

Create `src/app/(app)/peritos/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { getPerito } from '@/features/peritos/actions';
import { PeritoForm } from '@/features/peritos/components/perito-form';

export default async function EditarPeritoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perito = await getPerito(Number(id));
  if (!perito) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Editar perito</h1>
      <PeritoForm perito={perito} />
    </div>
  );
}
```

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add peritos CRUD actions, table, form, and pages"
```

---

## Task 19: Colaboradores — actions, table, form, pages

**Files:**
- Create: `src/features/colaboradores/actions.ts`
- Create: `src/features/colaboradores/components/colaboradores-table.tsx`
- Create: `src/features/colaboradores/components/colaborador-form.tsx`
- Create: `src/app/(app)/colaboradores/page.tsx`
- Create: `src/app/(app)/colaboradores/novo/page.tsx`
- Create: `src/app/(app)/colaboradores/[id]/page.tsx`
- Test: `src/features/colaboradores/components/colaborador-form.test.tsx`

**Interfaces:**
- Consumes: `colaboradorSchema`/`ColaboradorInput` (Task 7), `requireRole` (Task 9), `createClient` (Task 3).
- Produces: `listColaboradores()`, `listColaboradoresOptions()`, `getColaborador(id)`, `createColaborador(input)`, `updateColaborador(id, input)`, `type Colaborador`; `<ColaboradoresTable items />`, `<ColaboradorForm colaborador? />`; `/colaboradores`, `/colaboradores/novo`, `/colaboradores/[id]` routes.

- [ ] **Step 1: Write the failing form test**

Create `src/features/colaboradores/components/colaborador-form.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ColaboradorForm } from './colaborador-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('../actions', () => ({
  createColaborador: vi.fn(async () => ({ success: false, error: 'Nome é obrigatório' })),
}));

describe('ColaboradorForm', () => {
  it('shows the error returned by the action when validation fails', async () => {
    const user = userEvent.setup();
    render(<ColaboradorForm />);

    await user.click(screen.getByRole('button', { name: /salvar colaborador/i }));

    expect(await screen.findByText('Nome é obrigatório')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the colaboradores actions**

Create `src/features/colaboradores/actions.ts`:

```ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/features/auth/guards';
import type { ActionResult } from '@/lib/action-result';
import { colaboradorSchema, type ColaboradorInput } from './schemas';

export type Colaborador = { id: number; nome: string; contato: string; formacao: string; interno: boolean };

function toRow(input: ColaboradorInput) {
  return { nome: input.nome, contato: input.contato, formacao: input.formacao, interno: input.interno };
}

export async function listColaboradores(): Promise<Colaborador[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { data, error } = await supabase.from('colaboradores').select('*').order('nome');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listColaboradoresOptions(): Promise<{ id: number; nome: string }[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { data, error } = await supabase.from('colaboradores').select('id, nome').order('nome');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getColaborador(id: number): Promise<Colaborador | null> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { data, error } = await supabase.from('colaboradores').select('*').eq('id', id).single();
  if (error || !data) return null;
  return data;
}

export async function createColaborador(input: ColaboradorInput): Promise<ActionResult<Colaborador>> {
  await requireRole(['admin', 'gerencia']);
  const parsed = colaboradorSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.from('colaboradores').insert(toRow(parsed.data)).select('*').single();
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function updateColaborador(
  id: number,
  input: ColaboradorInput
): Promise<ActionResult<Colaborador>> {
  await requireRole(['admin', 'gerencia']);
  const parsed = colaboradorSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('colaboradores').update(toRow(parsed.data)).eq('id', id).select('*').single();
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}
```

- [ ] **Step 4: Write the ColaboradorForm**

Create `src/features/colaboradores/components/colaborador-form.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { createColaborador, updateColaborador, type Colaborador } from '../actions';
import type { ColaboradorInput } from '../schemas';

export function ColaboradorForm({ colaborador }: { colaborador?: Colaborador }) {
  const router = useRouter();
  const [nome, setNome] = useState(colaborador?.nome ?? '');
  const [contato, setContato] = useState(colaborador?.contato ?? '');
  const [formacao, setFormacao] = useState(colaborador?.formacao ?? '');
  const [interno, setInterno] = useState(colaborador?.interno ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const input: ColaboradorInput = { nome, contato, formacao, interno };
    const result = colaborador
      ? await updateColaborador(colaborador.id, input)
      : await createColaborador(input);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push('/colaboradores');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contato">Contato</Label>
        <Input id="contato" value={contato} onChange={(e) => setContato(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="formacao">Formação</Label>
        <Input id="formacao" value={formacao} onChange={(e) => setFormacao(e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <Switch id="interno" checked={interno} onCheckedChange={setInterno} />
        <Label htmlFor="interno">Colaborador interno</Label>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={saving}>
        {saving ? 'Salvando...' : 'Salvar colaborador'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 6: Write the ColaboradoresTable**

Create `src/features/colaboradores/components/colaboradores-table.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Colaborador } from '../actions';

export function ColaboradoresTable({ items }: { items: Colaborador[] }) {
  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhum colaborador cadastrado.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Contato</TableHead>
          <TableHead>Formação</TableHead>
          <TableHead>Tipo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <Link href={`/colaboradores/${item.id}`} className="hover:underline">{item.nome}</Link>
            </TableCell>
            <TableCell>{item.contato}</TableCell>
            <TableCell>{item.formacao}</TableCell>
            <TableCell>{item.interno ? 'Interno' : 'Externo'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 7: Write the colaboradores pages**

Create `src/app/(app)/colaboradores/page.tsx`:

```tsx
import Link from 'next/link';
import { listColaboradores } from '@/features/colaboradores/actions';
import { ColaboradoresTable } from '@/features/colaboradores/components/colaboradores-table';
import { Button } from '@/components/ui/button';

export default async function ColaboradoresPage() {
  const items = await listColaboradores();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Colaboradores</h1>
        <Button render={<Link href="/colaboradores/novo" />}>Novo colaborador</Button>
      </div>
      <ColaboradoresTable items={items} />
    </div>
  );
}
```

Create `src/app/(app)/colaboradores/novo/page.tsx`:

```tsx
import { ColaboradorForm } from '@/features/colaboradores/components/colaborador-form';

export default function NovoColaboradorPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Novo colaborador</h1>
      <ColaboradorForm />
    </div>
  );
}
```

Create `src/app/(app)/colaboradores/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { getColaborador } from '@/features/colaboradores/actions';
import { ColaboradorForm } from '@/features/colaboradores/components/colaborador-form';

export default async function EditarColaboradorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const colaborador = await getColaborador(Number(id));
  if (!colaborador) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Editar colaborador</h1>
      <ColaboradorForm colaborador={colaborador} />
    </div>
  );
}
```

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add colaboradores CRUD actions, table, form, and pages"
```

---

## Task 20: Perfis — controle de perfis (admin only)

**Files:**
- Create: `src/features/perfis/actions.ts`
- Create: `src/features/perfis/components/perfis-table.tsx`
- Create: `src/app/(app)/perfis/page.tsx`
- Test: `src/features/perfis/components/perfis-table.test.tsx`

**Interfaces:**
- Consumes: `roleOptions`/`Role`/`updateRoleSchema` (Task 7), `requireRole` (Task 9), `createClient` (Task 3).
- Produces: `listProfiles(): Promise<ProfileRow[]>`, `updateProfileRole(userId, role): Promise<ActionResult<null>>`, `type ProfileRow`; `<PerfisTable profiles />`; `/perfis` route.

- [ ] **Step 1: Write the failing table test**

Create `src/features/perfis/components/perfis-table.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PerfisTable } from './perfis-table';

const updateProfileRole = vi.fn(async () => ({ success: true, data: null }));

vi.mock('../actions', () => ({
  updateProfileRole: (...args: unknown[]) => updateProfileRole(...args),
}));

describe('PerfisTable', () => {
  it('lists every profile with its current role', () => {
    render(
      <PerfisTable
        profiles={[{ id: 'u1', nome: 'Ana', email: 'ana@x.com', role: 'pendente' }]}
      />
    );
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('ana@x.com')).toBeInTheDocument();
  });

  it('calls updateProfileRole when a new role is chosen', async () => {
    const user = userEvent.setup();
    render(
      <PerfisTable
        profiles={[{ id: 'u1', nome: 'Ana', email: 'ana@x.com', role: 'pendente' }]}
      />
    );

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('gerencia'));

    expect(updateProfileRole).toHaveBeenCalledWith('u1', 'gerencia');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the perfis actions**

Create `src/features/perfis/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/features/auth/guards';
import type { ActionResult } from '@/lib/action-result';
import { updateRoleSchema, type Role } from './schemas';

export type ProfileRow = { id: string; nome: string; email: string; role: Role };

export async function listProfiles(): Promise<ProfileRow[]> {
  await requireRole(['admin']);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nome, email, role')
    .order('created_at');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateProfileRole(userId: string, role: Role): Promise<ActionResult<null>> {
  await requireRole(['admin']);
  const parsed = updateRoleSchema.safeParse({ userId, role });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({ role: parsed.data.role }).eq('id', parsed.data.userId);
  if (error) return { success: false, error: error.message };
  revalidatePath('/perfis');
  return { success: true, data: null };
}
```

- [ ] **Step 4: Write the PerfisTable**

Create `src/features/perfis/components/perfis-table.tsx`:

```tsx
'use client';

import { useTransition } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateProfileRole, type ProfileRow } from '../actions';
import { roleOptions } from '../schemas';

export function PerfisTable({ profiles }: { profiles: ProfileRow[] }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>E-mail</TableHead>
          <TableHead>Perfil</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {profiles.map((profile) => (
          <TableRow key={profile.id}>
            <TableCell>{profile.nome}</TableCell>
            <TableCell>{profile.email}</TableCell>
            <TableCell>
              <Select
                value={profile.role}
                disabled={isPending}
                onValueChange={(role) =>
                  startTransition(() => {
                    updateProfileRole(profile.id, role as ProfileRow['role']);
                  })
                }
              >
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 6: Write the perfis page**

Create `src/app/(app)/perfis/page.tsx`:

```tsx
import { listProfiles } from '@/features/perfis/actions';
import { PerfisTable } from '@/features/perfis/components/perfis-table';

export default async function PerfisPage() {
  const profiles = await listProfiles();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Controle de perfis</h1>
      <PerfisTable profiles={profiles} />
    </div>
  );
}
```

- [ ] **Step 7: Run the full test suite and type-check**

Run: `npm run test && npx tsc --noEmit`
Expected: all tests pass, no type errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add perfis controle page for admin role management"
```

---

## Task 21: Deployment runbook — Supabase, Google OAuth, Vercel

**Files:**
- Create: `README.md`

This task is a manual runbook the project owner (not an automated worker) carries out in the Supabase, Google Cloud, and Vercel dashboards — none of it can be scripted without the owner's own accounts. Write it into `README.md` and follow it step by step.

- [ ] **Step 1: Create the Supabase project**

1. Go to supabase.com, create a free account/organization, and create a new project (free tier).
2. Note the project's **Project URL** and **anon public key** (Project Settings → API) and the **service_role key** (same page — keep this secret, server-only).

- [ ] **Step 2: Apply the database migrations**

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This applies the three migration files from Tasks 4–5 in order. Verify in the Supabase dashboard (Table Editor) that `profiles`, `municipios`, `processos`, `peritos`, `colaboradores`, and `pericias` all exist, and that `Authentication → Policies` shows the RLS policies from Task 5.

- [ ] **Step 3: Configure Google OAuth**

1. In Google Cloud Console, create an OAuth 2.0 Client ID (Web application).
2. Authorized redirect URI: `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`.
3. Copy the Client ID and Client Secret into Supabase: Authentication → Providers → Google, paste them in, enable the provider.

- [ ] **Step 4: Set local environment variables and seed the admin user**

Fill in `.env.local` (from the `.env.local.example` template in Task 3):

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

Run:

```bash
npm run seed:admin
```

Expected output: `Admin seeded: <uuid>`. Verify in Supabase Table Editor that `profiles` has a row for `admin@admin.com` with `role = admin`.

- [ ] **Step 5: Verify locally**

```bash
npm run dev
```

Visit `http://localhost:3000`, sign in with `admin@admin.com` / `admin123`, confirm the perícias listing loads and the sidebar shows Perfis.

- [ ] **Step 6: Deploy to Vercel**

1. Push this repository to GitHub (create a new repo, `git remote add origin <url>`, `git push -u origin main`).
2. In Vercel, import the GitHub repo (free Hobby plan).
3. Add the same four environment variables from Step 4, but set `NEXT_PUBLIC_SITE_URL` to the Vercel deployment URL (e.g. `https://gestao-pericia.vercel.app`).
4. Deploy.
5. Back in Google Cloud Console, add `https://<your-vercel-domain>/auth/callback` is not needed (redirect goes through Supabase), but add the Vercel domain to Supabase Authentication → URL Configuration → Redirect URLs so `signInWithOAuth` is allowed to redirect there.

- [ ] **Step 7: Write the README**

Create `README.md` documenting: what the project is, the tech stack, how to run it locally (`npm install`, `.env.local` setup, `npm run dev`), how to run tests (`npm run test`), and a condensed version of Steps 1–6 above as the deployment guide, plus the test admin credentials (`admin@admin.com` / `admin123`).

- [ ] **Step 8: Commit**

```bash
git add README.md .env.local.example
git commit -m "docs: add deployment runbook and project README"
```

---

## Task 22: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full automated test suite**

Run: `npm run test`
Expected: every test from Tasks 1–20 passes.

- [ ] **Step 2: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors, production build succeeds.

- [ ] **Step 3: Manual QA checklist against the spec (§5)**

Using the deployed app (or `npm run dev` against the live Supabase project from Task 21), sign in as `admin@admin.com` and confirm:

- [ ] Login page shows both the Google button and the e-mail/senha form.
- [ ] A brand-new Google sign-in lands on `/pendente` and cannot reach any other page.
- [ ] Promoting that user to `gerencia` on `/perfis` grants them access to Perícias/Peritos/Colaboradores but not `/perfis` (direct URL redirects to `/`).
- [ ] Perícias listing shows all six required columns, and hovering Nº Processo, Local, Perito, and Colaborador shows the tooltip content specified in §5.1.
- [ ] Filtering by situação and searching by número de processo both narrow the list.
- [ ] "Nova perícia" → selecting an existing processo works, and "Novo processo" creates and auto-selects a processo without leaving the form.
- [ ] Selecting a município searches the live IBGE list; picking one and reloading the perícia later still shows the correct município (confirms the local upsert cache works).
- [ ] Creating a perito with relação/resultados outside 0–10 is rejected by the form.
- [ ] Creating a colaborador and toggling Interno/Externo works and reflects correctly in the peritos/colaboradores tooltip on the perícias listing.
- [ ] Signing out returns to `/login`, and visiting any protected URL while signed out redirects to `/login`.

- [ ] **Step 4: Fix any gaps found during QA, then re-run Steps 1–3**

If QA uncovers a bug, fix it with its own test-first commit before considering the plan complete.
