# UX/UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reformulate the Gestão de Perícias app's UX/UI: modal-based CRUD (list-only pages + create/edit dialogs), toast feedback, loading skeletons, an accordion replacing tooltips on the perícias listing, a new Processos management screen, a collapsible sidebar, and a dark teal visual identity.

**Architecture:** Each entity (Peritos, Colaboradores, Processos, Perícias) gets a client-side "Screen" component that owns a single reused `Dialog` for both create and edit, wrapping the entity's existing form (adapted to `onSaved`/`onError` callbacks instead of page navigation). Toast (sonner) replaces inline form error text. `loading.tsx` files use Next's built-in Suspense mechanism for route-transition skeletons — no new routing library. The color/type system is CSS variables in `globals.css` (Tailwind v4 CSS-first), so no component code depends on the palette directly.

**Tech Stack:** Next.js 16, Tailwind CSS v4, shadcn/ui (Base UI), sonner (toast), lucide-react (icons), `next/font/google` (Space Grotesk, IBM Plex Sans, IBM Plex Mono), Vitest + Testing Library.

## Global Constraints

- Dark theme only — no light mode, no theme toggle, for this iteration.
- Palette: `background #0A1614`, `card/surface #101F1D`, `primary/accent #35C2AE`, `primary-foreground #07211D`, `foreground #EDEFEE`, `muted-foreground #8FA6A3`, `border/input #1E3634`, `destructive #E06A5F`. Status colors: pendente `#D9A441`, marcada `#4A9FE0`, realizada `#4ABE7A`, cancelada `#E06A5F`.
- Typography: Space Grotesk for headings (`font-heading` utility, already referenced by `DialogTitle`), IBM Plex Sans for body (`font-sans`, the default), IBM Plex Mono for tabular/data fields (`font-mono` utility, applied selectively, not globally).
- Every create/edit form lives inside a `Dialog`, triggered from a "Screen" component (button + table + one reused dialog with `editing: T | null` state). No more dedicated `/nova` or `/[id]` pages for Peritos, Colaboradores, or Perícias.
- Every entity table row gets an edit affordance: a pencil icon button (lucide `Pencil`), never click-the-whole-row (the perícias row already uses click for the accordion toggle).
- Toast (`sonner`) is the only feedback channel for save success/failure — remove the inline `{error && <p>}` pattern from forms being touched in this plan.
- `shadcn/ui` in this project is built on `@base-ui/react`, not Radix — composition uses a `render` prop (`<Trigger render={<Button/>}>`), not `asChild`. `Select` needs an `items` prop (`Record<string, ReactNode>`) for `SelectValue` to show a label instead of the raw value, whenever the select's `value` isn't already human-readable (id-based selects).
- This codebase's ESLint forbids `no-explicit-any` — never use `any` to route around a type error; find the actual cause (see the original implementation plan's Tasks 13/15 for precedent: missing `Relationships` metadata in `database.types.ts`).
- `required` HTML attributes on inputs block jsdom's synthetic form submission in tests before any JS handler runs — do not add `required` to inputs in forms whose tests submit them incomplete (matches the existing codebase convention already applied to `perito-form.tsx`/`colaborador-form.tsx`/`pericia-form.tsx`).
- TDD: write/update the failing test before the implementation for every unit with behavior; commit after each green test.

---

## Task 1: Color tokens and fonts

**Files:**
- Modify: `src/app/globals.css` (full replacement of the `:root` block and removal of the `.dark` block)
- Modify: `src/app/layout.tsx` (swap Geist fonts for Space Grotesk / IBM Plex Sans / IBM Plex Mono)

**Interfaces:**
- Produces: the CSS variables `--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--primary-foreground`, `--secondary`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--border`, `--input`, `--ring`, `--sidebar*`, `--status-pendente`/`--status-marcada`/`--status-realizada`/`--status-cancelada`, and the `font-heading`/`font-sans`/`font-mono` Tailwind utilities — every later task's styling relies on these existing.

**Note on hover states (spec §2.3):** `components/ui/button.tsx`'s `buttonVariants` already has `hover:bg-primary/80` (default), `hover:bg-muted` (outline/ghost), and `components/ui/table.tsx`'s `TableRow` already has `hover:bg-muted/50` built in. Swapping the color tokens in this task is sufficient to give buttons and table rows the spec's hover treatment — no separate hover-state code is needed anywhere else.

- [ ] **Step 1: Replace the color tokens in `globals.css`**

Replace the `:root { ... }` and `.dark { ... }` blocks (and the `@custom-variant dark (&:is(.dark *));` line, since there is no dark-mode toggle in this app — the palette below **is** the only theme) with:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --font-heading: var(--font-heading);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}

:root {
  --background: #0a1614;
  --foreground: #edefee;
  --card: #101f1d;
  --card-foreground: #edefee;
  --popover: #101f1d;
  --popover-foreground: #edefee;
  --primary: #35c2ae;
  --primary-foreground: #07211d;
  --secondary: #16302d;
  --secondary-foreground: #edefee;
  --muted: #142523;
  --muted-foreground: #8fa6a3;
  --accent: #16302d;
  --accent-foreground: #edefee;
  --destructive: #e06a5f;
  --border: #1e3634;
  --input: #1e3634;
  --ring: #35c2ae;
  --chart-1: #35c2ae;
  --chart-2: #4a9fe0;
  --chart-3: #4abe7a;
  --chart-4: #d9a441;
  --chart-5: #e06a5f;
  --radius: 0.625rem;
  --sidebar: #101f1d;
  --sidebar-foreground: #edefee;
  --sidebar-primary: #35c2ae;
  --sidebar-primary-foreground: #07211d;
  --sidebar-accent: #16302d;
  --sidebar-accent-foreground: #edefee;
  --sidebar-border: #1e3634;
  --sidebar-ring: #35c2ae;

  --status-pendente: #d9a441;
  --status-marcada: #4a9fe0;
  --status-realizada: #4abe7a;
  --status-cancelada: #e06a5f;
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
  h1, h2, h3 {
    @apply font-heading;
  }
}
```

- [ ] **Step 2: Swap the fonts in `layout.tsx`**

Replace the `Geist`/`Geist_Mono` imports and usage in `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Gestão de Perícias",
  description: "Sistema de gestão de perícias, processos, peritos e colaboradores.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${spaceGrotesk.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed with no errors. This is a pure styling/config change with no unit-testable logic — verification is type-check + build succeeding, plus a visual check with `npm run dev` (background dark teal, IBM Plex body text, Space Grotesk headings) if you have a way to view it.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: apply dark teal color palette and new typography"
```

---

## Task 2: StatusBadge uses theme tokens

**Files:**
- Modify: `src/components/shared/status-badge.tsx`

**Interfaces:**
- Consumes: `--status-pendente`/`--status-marcada`/`--status-realizada`/`--status-cancelada` (Task 1).
- No signature change — `StatusBadge({ situacao })` keeps the same props, only internal styling changes.

- [ ] **Step 1: Replace the hardcoded Tailwind color classes**

```tsx
import { Badge } from '@/components/ui/badge';
import type { PericiaListItem } from '@/features/pericias/actions';

const STYLES: Record<PericiaListItem['situacao'], string> = {
  pendente: 'bg-[var(--status-pendente)]/15 text-[var(--status-pendente)]',
  marcada: 'bg-[var(--status-marcada)]/15 text-[var(--status-marcada)]',
  realizada: 'bg-[var(--status-realizada)]/15 text-[var(--status-realizada)]',
  cancelada: 'bg-[var(--status-cancelada)]/15 text-[var(--status-cancelada)]',
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

- [ ] **Step 2: Verify**

Run: `npm run test -- src/features/pericias && npx tsc --noEmit`
Expected: existing tests that render `StatusBadge` (via `PericiasTable`) still pass — this only changes CSS classes, not text content.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/status-badge.tsx
git commit -m "feat: use theme status colors in StatusBadge"
```

---

## Task 3: Login page signature panel

**Files:**
- Modify: `src/app/login/page.tsx`

**Interfaces:**
- No new exports — page component only.

- [ ] **Step 1: Add the gradient panel**

```tsx
import { signInWithGoogle } from '@/features/auth/actions';
import { LoginForm } from '@/features/auth/components/login-form';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-gradient-to-br from-[#0A1614] via-[#123330] to-[#1F5C52] p-12 lg:flex">
        <span className="font-heading text-2xl font-semibold text-foreground">Gestão de Perícias</span>
        <p className="max-w-sm text-sm text-muted-foreground">
          Cadastro e acompanhamento de perícias, processos, peritos e colaboradores em um só lugar.
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8 shadow-sm">
          <h1 className="font-heading text-xl font-semibold lg:hidden">Gestão de Perícias</h1>
          <form action={signInWithGoogle}>
            <Button type="submit" variant="outline" className="w-full">
              Entrar com Google
            </Button>
          </form>
          <div className="relative text-center text-xs text-muted-foreground">
            <span className="bg-card px-2">ou</span>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors. No existing test targets `login/page.tsx` directly (only `LoginForm` has its own test, which this doesn't touch).

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat: add signature gradient panel to login page"
```

---

## Task 4: Toast and skeleton infrastructure

**Files:**
- Create: `src/components/ui/sonner.tsx`, `src/components/ui/skeleton.tsx` (via `shadcn add`)
- Create: `src/components/shared/table-skeleton.tsx`
- Test: `src/components/shared/table-skeleton.test.tsx`
- Modify: `src/app/(app)/layout.tsx` (mount `<Toaster />`)
- Modify: `src/features/processos/components/processo-combobox.tsx`, `src/features/municipios/components/municipio-combobox.tsx` (spec §3.3 — replace the "Buscando..." text with a spinner)

**Interfaces:**
- Produces: `toast` (re-exported by the `sonner` package, imported directly as `import { toast } from 'sonner'` everywhere a Screen component needs it — no local wrapper), `<TableSkeleton columns={number} rows?={number} />` from `@/components/shared/table-skeleton`. Every later task's Screen/loading.tsx consumes these.

- [ ] **Step 1: Add the shadcn components**

```bash
npx shadcn add sonner skeleton
```

- [ ] **Step 2: Check the generated `sonner.tsx` for a `next-themes` dependency**

Open `src/components/ui/sonner.tsx`. This project has no theme switcher (single dark theme, Task 1), so it must not depend on the `next-themes` package (not installed, and installing it just for this would be unused surface). If the generated file imports `useTheme` from `next-themes`, replace that with a hardcoded theme:

```tsx
"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
```

If the generated file already has no `next-themes` import (some shadcn registry versions ship a static theme by default), leave it as generated.

- [ ] **Step 3: Write the failing TableSkeleton test**

Create `src/components/shared/table-skeleton.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TableSkeleton } from './table-skeleton';

describe('TableSkeleton', () => {
  it('renders the requested number of rows and columns', () => {
    const { container } = render(<TableSkeleton columns={4} rows={3} />);
    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(3);
    expect(rows[0].querySelectorAll('td')).toHaveLength(4);
  });

  it('defaults to 5 rows when rows is not specified', () => {
    const { container } = render(<TableSkeleton columns={2} />);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(5);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm run test -- src/components/shared/table-skeleton`
Expected: FAIL — `./table-skeleton` doesn't exist.

- [ ] **Step 5: Write TableSkeleton**

Create `src/components/shared/table-skeleton.tsx`:

```tsx
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';

export function TableSkeleton({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <Table>
      <TableBody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <TableRow key={rowIndex}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <TableCell key={colIndex}>
                <Skeleton className="h-4 w-full" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test -- src/components/shared/table-skeleton`
Expected: both tests pass.

- [ ] **Step 7: Mount the Toaster in the app shell**

Modify `src/app/(app)/layout.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/features/auth/guards';
import { Sidebar } from '@/components/shared/sidebar';
import { Toaster } from '@/components/ui/sonner';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (profile.role === 'pendente') redirect('/pendente');

  return (
    <div className="flex min-h-screen">
      <Sidebar role={profile.role} />
      <main className="flex-1 overflow-auto p-6">{children}</main>
      <Toaster />
    </div>
  );
}
```

- [ ] **Step 8: Replace the combobox loading text with a spinner**

In `src/features/processos/components/processo-combobox.tsx`, add `Loader2` to the existing `lucide-react` import and replace:

```tsx
<CommandEmpty>{isPending ? 'Buscando...' : 'Nenhum processo encontrado.'}</CommandEmpty>
```

with:

```tsx
<CommandEmpty>
  {isPending ? (
    <span className="flex items-center justify-center gap-2">
      <Loader2 className="size-4 animate-spin" /> Buscando...
    </span>
  ) : (
    'Nenhum processo encontrado.'
  )}
</CommandEmpty>
```

In `src/features/municipios/components/municipio-combobox.tsx`, apply the same change to its `CommandEmpty`:

```tsx
<CommandEmpty>
  {isPending ? (
    <span className="flex items-center justify-center gap-2">
      <Loader2 className="size-4 animate-spin" /> Buscando...
    </span>
  ) : (
    'Digite ao menos 2 letras.'
  )}
</CommandEmpty>
```

- [ ] **Step 9: Run the full suite and type-check**

Run: `npm run test && npx tsc --noEmit`
Expected: all tests pass (no existing test asserts the literal "Buscando..." text for either combobox, so this is a safe visual-only change — confirm by checking `novo-processo-dialog.test.tsx` and any municipio combobox test still pass), no type errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add toast/skeleton infrastructure and combobox loading spinners"
```

---

## Task 5: Sidebar collapse

**Files:**
- Modify: `src/components/shared/sidebar.tsx`
- Modify: `src/components/shared/sidebar.test.tsx`

**Interfaces:**
- No change to `Sidebar({ role: Role })`'s public signature. `NAV_ITEMS` in this task covers Perícias/Peritos/Colaboradores/Perfis only — Task 8 adds a Processos entry to this same array.

- [ ] **Step 1: Write the failing collapse tests**

Replace `src/components/shared/sidebar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sidebar } from './sidebar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

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

  it('collapses on toggle click and hides labels', async () => {
    const user = userEvent.setup();
    render(<Sidebar role="admin" />);
    expect(screen.getByText('Peritos')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /recolher/i }));

    expect(screen.queryByText('Peritos')).not.toBeInTheDocument();
    expect(localStorage.getItem('sidebar-collapsed')).toBe('true');
  });

  it('restores collapsed state from localStorage on mount', () => {
    localStorage.setItem('sidebar-collapsed', 'true');
    render(<Sidebar role="admin" />);
    expect(screen.queryByText('Peritos')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npm run test -- src/components/shared/sidebar`
Expected: the collapse/localStorage tests FAIL (no toggle button exists yet); the existing role-based tests still PASS.

- [ ] **Step 3: Write the collapsible Sidebar**

Replace `src/components/shared/sidebar.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ClipboardList, UserCheck, Users, ShieldCheck,
  PanelLeftClose, PanelLeftOpen, LogOut, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Role } from '@/features/auth/guards';
import { signOut } from '@/features/auth/actions';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

export const NAV_ITEMS: { href: string; label: string; roles: Role[]; icon: LucideIcon }[] = [
  { href: '/', label: 'Perícias', roles: ['admin', 'gerencia'], icon: ClipboardList },
  { href: '/peritos', label: 'Peritos', roles: ['admin', 'gerencia'], icon: UserCheck },
  { href: '/colaboradores', label: 'Colaboradores', roles: ['admin', 'gerencia'], icon: Users },
  { href: '/perfis', label: 'Perfis', roles: ['admin'], icon: ShieldCheck },
];

const STORAGE_KEY = 'sidebar-collapsed';

function NavLink({
  href, label, Icon, active, collapsed,
}: {
  href: string; label: string; Icon: LucideIcon; active: boolean; collapsed: boolean;
}) {
  const link = (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-sidebar-accent',
        collapsed && 'justify-center px-0',
        active && 'bg-sidebar-accent text-sidebar-accent-foreground'
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && label}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger render={<div />}>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === 'true') setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <nav
      className={cn(
        'flex h-full flex-col gap-1 border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground transition-all duration-200',
        collapsed ? 'w-16 items-center' : 'w-56'
      )}
    >
      {!collapsed && (
        <span className="mb-4 px-2 font-heading text-lg font-semibold">Gestão de Perícias</span>
      )}
      {items.map((item) => (
        <NavLink
          key={item.href}
          href={item.href}
          label={item.label}
          Icon={item.icon}
          active={pathname === item.href}
          collapsed={collapsed}
        />
      ))}
      <div className={cn('mt-auto flex flex-col gap-1 pt-4', collapsed && 'items-center')}>
        <form action={signOut} className="w-full">
          <Button
            type="submit"
            variant="ghost"
            className={cn('w-full justify-start gap-2', collapsed && 'justify-center px-0')}
          >
            <LogOut className="size-4 shrink-0" />
            {!collapsed && 'Sair'}
          </Button>
        </form>
        <Button
          type="button"
          variant="ghost"
          className={cn('w-full justify-start gap-2', collapsed && 'justify-center px-0')}
          onClick={toggleCollapsed}
        >
          {collapsed ? <PanelLeftOpen className="size-4 shrink-0" /> : <PanelLeftClose className="size-4 shrink-0" />}
          {!collapsed && 'Recolher'}
        </Button>
      </div>
    </nav>
  );
}
```

`NAV_ITEMS` is exported (not just a module-local const) so Task 8 can extend it without re-deriving its shape.

If `TooltipTrigger render={<div />}` wrapping a `<Link>` doesn't fire the tooltip correctly on hover (verify visually or by re-running this task's own test suite — the tests above don't exercise the collapsed-tooltip path directly, only that labels disappear), the fallback is to drop the `render` prop and let `TooltipTrigger` render its own default element wrapping the link's *contents* directly rather than the whole `<Link>` — but try the composition above first, it follows the same pattern already proven to work in `tooltip-cell.tsx`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/components/shared/sidebar`
Expected: all 5 tests pass.

- [ ] **Step 5: Run the full suite and type-check**

Run: `npm run test && npx tsc --noEmit`
Expected: all pass (this file is imported by `(app)/layout.tsx`, so a break here is global).

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/sidebar.tsx src/components/shared/sidebar.test.tsx
git commit -m "feat: make sidebar collapsible with persisted state"
```

---

## Task 6: Processos — listProcessos, getProcesso, updateProcesso

**Files:**
- Modify: `src/features/processos/actions.ts`
- Test: `src/features/processos/actions.test.ts` (new file)

**Interfaces:**
- Consumes: `processoSchema`/`ProcessoInput` (existing), `requireRole` (existing), `createClient` (existing), `Processo` type (existing, already exported from this file).
- Produces: `listProcessos(): Promise<Processo[]>`, `getProcesso(id: number): Promise<Processo | null>`, `updateProcesso(id: number, input: ProcessoInput): Promise<ActionResult<Processo>>`. Consumed by Task 8 (Processos screen).

- [ ] **Step 1: Write the failing tests**

Create `src/features/processos/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listProcessos, getProcesso, updateProcesso } from './actions';

const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockOrder = vi.fn();
const mockSelect = vi.fn(() => ({ order: mockOrder, eq: mockEq }));
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

describe('listProcessos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the ordered list of processos', async () => {
    mockOrder.mockResolvedValue({ data: [{ id: 1, numero: 'P-1', autor: 'A', reu: 'B' }], error: null });
    const result = await listProcessos();
    expect(result).toEqual([{ id: 1, numero: 'P-1', autor: 'A', reu: 'B' }]);
  });
});

describe('getProcesso', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });
    const result = await getProcesso(999);
    expect(result).toBeNull();
  });

  it('returns the processo when found', async () => {
    mockSingle.mockResolvedValue({ data: { id: 1, numero: 'P-1', autor: 'A', reu: 'B' }, error: null });
    const result = await getProcesso(1);
    expect(result).toEqual({ id: 1, numero: 'P-1', autor: 'A', reu: 'B' });
  });
});

describe('updateProcesso', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns an error for invalid input without touching the database', async () => {
    const result = await updateProcesso(1, { numero: '', autor: 'A', reu: 'B' });
    expect(result).toEqual({ success: false, error: 'Número do processo é obrigatório' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('updates a valid processo', async () => {
    mockSingle.mockResolvedValue({ data: { id: 1, numero: 'P-2', autor: 'A', reu: 'B' }, error: null });
    const result = await updateProcesso(1, { numero: 'P-2', autor: 'A', reu: 'B' });
    expect(result).toEqual({ success: true, data: { id: 1, numero: 'P-2', autor: 'A', reu: 'B' } });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/features/processos/actions`
Expected: FAIL — `listProcessos`/`getProcesso`/`updateProcesso` are not exported yet.

- [ ] **Step 3: Add the three functions to `actions.ts`**

Append to `src/features/processos/actions.ts` (after `createProcesso`):

```ts
export async function listProcessos(): Promise<Processo[]> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { data, error } = await supabase.from('processos').select('id, numero, autor, reu').order('numero');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getProcesso(id: number): Promise<Processo | null> {
  await requireRole(['admin', 'gerencia']);
  const supabase = await createClient();
  const { data, error } = await supabase.from('processos').select('id, numero, autor, reu').eq('id', id).single();
  if (error || !data) return null;
  return data;
}

export async function updateProcesso(id: number, input: ProcessoInput): Promise<ActionResult<Processo>> {
  await requireRole(['admin', 'gerencia']);
  const parsed = processoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('processos')
    .update(parsed.data)
    .eq('id', id)
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

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/features/processos/actions`
Expected: all pass.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/processos/actions.ts src/features/processos/actions.test.ts
git commit -m "feat: add listProcessos, getProcesso, updateProcesso actions"
```

---

## Task 7: Extract ProcessoForm, refactor NovoProcessoDialog

**Files:**
- Create: `src/features/processos/components/processo-form.tsx`
- Test: `src/features/processos/components/processo-form.test.tsx`
- Modify: `src/features/processos/components/novo-processo-dialog.tsx`

**Interfaces:**
- Consumes: `createProcesso`/`updateProcesso` (Task 6), `Processo` type (existing).
- Produces: `<ProcessoForm processo? onSaved onError submitLabel? />` — consumed by Task 8 (Processos screen) and by `NovoProcessoDialog` (this task).

- [ ] **Step 1: Write the failing ProcessoForm tests**

Create `src/features/processos/components/processo-form.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ProcessoForm } from './processo-form';

vi.mock('../actions', () => ({
  createProcesso: vi.fn(async (input: { numero: string; autor: string; reu: string }) => ({
    success: true,
    data: { id: 1, ...input },
  })),
  updateProcesso: vi.fn(async (id: number, input: { numero: string; autor: string; reu: string }) => ({
    success: true,
    data: { id, ...input },
  })),
}));

describe('ProcessoForm', () => {
  it('pre-fills fields when editing an existing processo', () => {
    render(
      <ProcessoForm
        processo={{ id: 5, numero: 'P-5', autor: 'Ana', reu: 'Bia' }}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Número do processo')).toHaveValue('P-5');
    expect(screen.getByLabelText('Autor')).toHaveValue('Ana');
    expect(screen.getByLabelText('Réu')).toHaveValue('Bia');
  });

  it('calls updateProcesso and onSaved when editing', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <ProcessoForm
        processo={{ id: 5, numero: 'P-5', autor: 'Ana', reu: 'Bia' }}
        onSaved={onSaved}
        onError={vi.fn()}
      />
    );
    await user.click(screen.getByRole('button', { name: /salvar processo/i }));
    expect(onSaved).toHaveBeenCalledWith({ id: 5, numero: 'P-5', autor: 'Ana', reu: 'Bia' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/features/processos/components/processo-form`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write ProcessoForm**

Create `src/features/processos/components/processo-form.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createProcesso, updateProcesso, type Processo } from '../actions';

export function ProcessoForm({
  processo,
  onSaved,
  onError,
  submitLabel = 'Salvar processo',
}: {
  processo?: Processo;
  onSaved: (processo: Processo) => void;
  onError: (message: string) => void;
  submitLabel?: string;
}) {
  const [numero, setNumero] = useState(processo?.numero ?? '');
  const [autor, setAutor] = useState(processo?.autor ?? '');
  const [reu, setReu] = useState(processo?.reu ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const input = { numero, autor, reu };
    const result = processo ? await updateProcesso(processo.id, input) : await createProcesso(input);
    setSaving(false);
    if (!result.success) {
      onError(result.error);
      return;
    }
    onSaved(result.data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="numero">Número do processo</Label>
        <Input id="numero" value={numero} onChange={(e) => setNumero(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="autor">Autor</Label>
        <Input id="autor" value={autor} onChange={(e) => setAutor(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reu">Réu</Label>
        <Input id="reu" value={reu} onChange={(e) => setReu(e.target.value)} />
      </div>
      <Button type="submit" disabled={saving} className="w-full">
        {saving && <Loader2 className="size-4 animate-spin" />}
        {saving ? 'Salvando...' : submitLabel}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/features/processos/components/processo-form`
Expected: both pass.

- [ ] **Step 5: Refactor NovoProcessoDialog to use ProcessoForm**

Replace `src/features/processos/components/novo-processo-dialog.tsx`:

```tsx
'use client';

import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProcessoForm } from './processo-form';
import type { Processo } from '../actions';

export function NovoProcessoDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (processo: Processo) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo processo</DialogTitle>
        </DialogHeader>
        <ProcessoForm
          submitLabel="Salvar e vincular"
          onSaved={(processo) => {
            toast.success('Processo criado com sucesso');
            onCreated(processo);
            onOpenChange(false);
          }}
          onError={(message) => toast.error(message)}
        />
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Run the existing NovoProcessoDialog test to confirm it still passes unchanged**

Run: `npm run test -- src/features/processos/components/novo-processo-dialog`
Expected: PASS with no test-file changes needed — the button label ("Salvar e vincular"), field labels, and `onCreated`/`onOpenChange` behavior are unchanged from the caller's perspective; only the internal implementation moved into `ProcessoForm`. If it fails, do not edit the test to make it pass — the refactor introduced a real behavior change; find and fix it.

- [ ] **Step 7: Run the full suite and type-check**

Run: `npm run test && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/features/processos/components/processo-form.tsx src/features/processos/components/processo-form.test.tsx src/features/processos/components/novo-processo-dialog.tsx
git commit -m "refactor: extract ProcessoForm and reuse it in NovoProcessoDialog"
```

---

## Task 8: Processos screen, table, page, sidebar entry

**Files:**
- Create: `src/features/processos/components/processos-table.tsx`
- Create: `src/features/processos/components/processos-screen.tsx`
- Test: `src/features/processos/components/processos-screen.test.tsx`
- Create: `src/app/(app)/processos/page.tsx`
- Create: `src/app/(app)/processos/loading.tsx`
- Modify: `src/components/shared/sidebar.tsx` (add the Processos nav entry)

**Interfaces:**
- Consumes: `listProcessos` (Task 6), `Processo` type (existing), `ProcessoForm` (Task 7), `TableSkeleton` (Task 4), `NAV_ITEMS` (Task 5, extending the same array).
- Produces: the `/processos` route.

- [ ] **Step 1: Add the Processos entry to the sidebar**

In `src/components/shared/sidebar.tsx`, add `Folder` to the `lucide-react` import list, and insert a new entry into `NAV_ITEMS` between Perícias and Peritos:

```ts
import {
  ClipboardList, Folder, UserCheck, Users, ShieldCheck,
  PanelLeftClose, PanelLeftOpen, LogOut, type LucideIcon,
} from 'lucide-react';

export const NAV_ITEMS: { href: string; label: string; roles: Role[]; icon: LucideIcon }[] = [
  { href: '/', label: 'Perícias', roles: ['admin', 'gerencia'], icon: ClipboardList },
  { href: '/processos', label: 'Processos', roles: ['admin', 'gerencia'], icon: Folder },
  { href: '/peritos', label: 'Peritos', roles: ['admin', 'gerencia'], icon: UserCheck },
  { href: '/colaboradores', label: 'Colaboradores', roles: ['admin', 'gerencia'], icon: Users },
  { href: '/perfis', label: 'Perfis', roles: ['admin'], icon: ShieldCheck },
];
```

- [ ] **Step 2: Write the failing ProcessosScreen test**

Create `src/features/processos/components/processos-screen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ProcessosScreen } from './processos-screen';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock('../actions', () => ({
  createProcesso: vi.fn(async (input: { numero: string; autor: string; reu: string }) => ({
    success: true,
    data: { id: 9, ...input },
  })),
  updateProcesso: vi.fn(async (id: number, input: { numero: string; autor: string; reu: string }) => ({
    success: true,
    data: { id, ...input },
  })),
}));

const items = [{ id: 1, numero: 'P-1', autor: 'Ana', reu: 'Bia' }];

describe('ProcessosScreen', () => {
  it('opens the create dialog and saves a new processo', async () => {
    const user = userEvent.setup();
    render(<ProcessosScreen items={items} />);

    await user.click(screen.getByRole('button', { name: /novo processo/i }));
    await user.type(screen.getByLabelText('Número do processo'), 'P-2');
    await user.type(screen.getByLabelText('Autor'), 'Carla');
    await user.type(screen.getByLabelText('Réu'), 'Davi');
    await user.click(screen.getByRole('button', { name: /salvar processo/i }));

    expect(refresh).toHaveBeenCalled();
  });

  it('opens the edit dialog pre-filled with the selected processo', async () => {
    const user = userEvent.setup();
    render(<ProcessosScreen items={items} />);

    await user.click(screen.getByRole('button', { name: /editar p-1/i }));

    expect(screen.getByLabelText('Número do processo')).toHaveValue('P-1');
    expect(screen.getByRole('heading', { name: 'Editar processo' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test -- src/features/processos/components/processos-screen`
Expected: FAIL — `./processos-screen` and `./processos-table` don't exist.

- [ ] **Step 4: Write ProcessosTable**

Create `src/features/processos/components/processos-table.tsx`:

```tsx
'use client';

import { Pencil } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import type { Processo } from '../actions';

export function ProcessosTable({ items, onEdit }: { items: Processo[]; onEdit: (processo: Processo) => void }) {
  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhum processo cadastrado.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Número</TableHead>
          <TableHead>Autor</TableHead>
          <TableHead>Réu</TableHead>
          <TableHead className="w-12" />
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
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 5: Write ProcessosScreen**

Create `src/features/processos/components/processos-screen.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProcessosTable } from './processos-table';
import { ProcessoForm } from './processo-form';
import type { Processo } from '../actions';

export function ProcessosScreen({ items }: { items: Processo[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Processo | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(processo: Processo) {
    setEditing(processo);
    setDialogOpen(true);
  }

  function handleSaved() {
    toast.success(editing ? 'Processo atualizado' : 'Processo criado');
    setDialogOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Processos</h1>
        <Button type="button" onClick={openCreate}>
          <Plus className="size-4" />
          Novo processo
        </Button>
      </div>
      <ProcessosTable items={items} onEdit={openEdit} />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar processo' : 'Novo processo'}</DialogTitle>
          </DialogHeader>
          <ProcessoForm
            processo={editing ?? undefined}
            onSaved={handleSaved}
            onError={(message) => toast.error(message)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test -- src/features/processos/components/processos-screen`
Expected: both tests pass.

- [ ] **Step 7: Write the page and loading skeleton**

Create `src/app/(app)/processos/page.tsx`:

```tsx
import { listProcessos } from '@/features/processos/actions';
import { ProcessosScreen } from '@/features/processos/components/processos-screen';

export default async function ProcessosPage() {
  const items = await listProcessos();
  return <ProcessosScreen items={items} />;
}
```

Create `src/app/(app)/processos/loading.tsx`:

```tsx
import { TableSkeleton } from '@/components/shared/table-skeleton';

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-36 animate-pulse rounded-md bg-muted" />
      </div>
      <TableSkeleton columns={4} />
    </div>
  );
}
```

- [ ] **Step 8: Run the full suite and type-check**

Run: `npm run test && npx tsc --noEmit`
Expected: all pass, including the updated `sidebar.test.tsx` from Task 5 (it doesn't assert against Processos, so it stays green).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add Processos listing/edit screen and sidebar entry"
```

---

## Task 9: Peritos — modal CRUD

**Files:**
- Modify: `src/features/peritos/components/perito-form.tsx`
- Modify: `src/features/peritos/components/perito-form.test.tsx`
- Modify: `src/features/peritos/components/peritos-table.tsx`
- Create: `src/features/peritos/components/peritos-screen.tsx`
- Test: `src/features/peritos/components/peritos-screen.test.tsx`
- Modify: `src/app/(app)/peritos/page.tsx`
- Create: `src/app/(app)/peritos/loading.tsx`
- Delete: `src/app/(app)/peritos/novo/page.tsx`, `src/app/(app)/peritos/[id]/page.tsx`

**Interfaces:**
- Consumes: `createPerito`/`updatePerito`/`Perito` (existing), `TableSkeleton` (Task 4).
- Produces: `<PeritoForm perito? onSaved onError />` (signature change from the current `router.push`-based version), `<PeritosTable items onEdit />` (adds `onEdit`), `<PeritosScreen items />`.

- [ ] **Step 1: Rewrite the failing PeritoForm test**

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
          documento: '000', jaTrabalhamos: true, relacao: 8, resultados: 9,
        }}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Nome')).toHaveValue('Carlos');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/features/peritos/components/perito-form`
Expected: FAIL — `PeritoForm` doesn't accept `onSaved`/`onError` yet.

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
import { createPerito, updatePerito, type Perito } from '../actions';
import type { PeritoInput } from '../schemas';

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
  const [relacao, setRelacao] = useState(perito?.relacao ?? 0);
  const [resultados, setResultados] = useState(perito?.resultados ?? 0);
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

- [ ] **Step 5: Add the edit icon to PeritosTable**

Replace `src/features/peritos/components/peritos-table.tsx`:

```tsx
'use client';

import { Pencil } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import type { Perito } from '../actions';

export function PeritosTable({ items, onEdit }: { items: Perito[]; onEdit: (perito: Perito) => void }) {
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
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>{item.nome}</TableCell>
            <TableCell>{item.contato}</TableCell>
            <TableCell>{item.formacao}</TableCell>
            <TableCell>{item.crea}</TableCell>
            <TableCell>{item.relacao}/10</TableCell>
            <TableCell>{item.resultados}/10</TableCell>
            <TableCell>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => onEdit(item)}>
                <Pencil className="size-4" />
                <span className="sr-only">Editar {item.nome}</span>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 6: Write the failing PeritosScreen test**

Create `src/features/peritos/components/peritos-screen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PeritosScreen } from './peritos-screen';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock('../actions', () => ({
  createPerito: vi.fn(async (input: unknown) => ({ success: true, data: { id: 9, ...(input as object) } })),
  updatePerito: vi.fn(async (id: number, input: unknown) => ({ success: true, data: { id, ...(input as object) } })),
}));

const items = [{
  id: 1, nome: 'Carlos', contato: '', formacao: '', crea: '', documento: '',
  jaTrabalhamos: false, relacao: 0, resultados: 0,
}];

describe('PeritosScreen', () => {
  it('opens the edit dialog pre-filled with the selected perito', async () => {
    const user = userEvent.setup();
    render(<PeritosScreen items={items} />);

    await user.click(screen.getByRole('button', { name: /editar carlos/i }));

    expect(screen.getByLabelText('Nome')).toHaveValue('Carlos');
    expect(screen.getByRole('heading', { name: 'Editar perito' })).toBeInTheDocument();
  });

  it('closes the dialog and refreshes after a successful save', async () => {
    const user = userEvent.setup();
    render(<PeritosScreen items={items} />);

    await user.click(screen.getByRole('button', { name: /novo perito/i }));
    await user.type(screen.getByLabelText('Nome'), 'Diana');
    await user.click(screen.getByRole('button', { name: /salvar perito/i }));

    expect(refresh).toHaveBeenCalled();
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npm run test -- src/features/peritos/components/peritos-screen`
Expected: FAIL — `./peritos-screen` doesn't exist.

- [ ] **Step 8: Write PeritosScreen**

Create `src/features/peritos/components/peritos-screen.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PeritosTable } from './peritos-table';
import { PeritoForm } from './perito-form';
import type { Perito } from '../actions';

export function PeritosScreen({ items }: { items: Perito[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Perito | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(perito: Perito) {
    setEditing(perito);
    setDialogOpen(true);
  }

  function handleSaved() {
    toast.success(editing ? 'Perito atualizado' : 'Perito criado');
    setDialogOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Peritos</h1>
        <Button type="button" onClick={openCreate}>
          <Plus className="size-4" />
          Novo perito
        </Button>
      </div>
      <PeritosTable items={items} onEdit={openEdit} />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar perito' : 'Novo perito'}</DialogTitle>
          </DialogHeader>
          <PeritoForm perito={editing ?? undefined} onSaved={handleSaved} onError={(message) => toast.error(message)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npm run test -- src/features/peritos/components/peritos-screen`
Expected: both pass.

- [ ] **Step 10: Rewire the page, add loading, remove old routes**

Replace `src/app/(app)/peritos/page.tsx`:

```tsx
import { listPeritos } from '@/features/peritos/actions';
import { PeritosScreen } from '@/features/peritos/components/peritos-screen';

export default async function PeritosPage() {
  const items = await listPeritos();
  return <PeritosScreen items={items} />;
}
```

Create `src/app/(app)/peritos/loading.tsx`:

```tsx
import { TableSkeleton } from '@/components/shared/table-skeleton';

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
      </div>
      <TableSkeleton columns={7} />
    </div>
  );
}
```

Remove the now-unused pages:

```bash
git rm "src/app/(app)/peritos/novo/page.tsx"
git rm "src/app/(app)/peritos/[id]/page.tsx"
```

- [ ] **Step 11: Run the full suite and type-check**

Run: `npm run test && npx tsc --noEmit`
Expected: all pass. No remaining file should reference `/peritos/novo` or `/peritos/[id]` (the sidebar and everywhere else already only ever linked to `/peritos`).

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: convert Peritos to list + modal CRUD"
```

---

## Task 10: Colaboradores — modal CRUD

**Files:**
- Modify: `src/features/colaboradores/components/colaborador-form.tsx`
- Modify: `src/features/colaboradores/components/colaborador-form.test.tsx`
- Modify: `src/features/colaboradores/components/colaboradores-table.tsx`
- Create: `src/features/colaboradores/components/colaboradores-screen.tsx`
- Test: `src/features/colaboradores/components/colaboradores-screen.test.tsx`
- Modify: `src/app/(app)/colaboradores/page.tsx`
- Create: `src/app/(app)/colaboradores/loading.tsx`
- Delete: `src/app/(app)/colaboradores/novo/page.tsx`, `src/app/(app)/colaboradores/[id]/page.tsx`

**Interfaces:**
- Consumes: `createColaborador`/`updateColaborador`/`Colaborador` (existing), `TableSkeleton` (Task 4).
- Produces: `<ColaboradorForm colaborador? onSaved onError />`, `<ColaboradoresTable items onEdit />`, `<ColaboradoresScreen items />`. Mirrors Task 9 exactly, different fields.

- [ ] **Step 1: Rewrite the failing ColaboradorForm test**

Replace `src/features/colaboradores/components/colaborador-form.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ColaboradorForm } from './colaborador-form';

vi.mock('../actions', () => ({
  createColaborador: vi.fn(async () => ({ success: false, error: 'Nome é obrigatório' })),
  updateColaborador: vi.fn(),
}));

describe('ColaboradorForm', () => {
  it('calls onError with the message returned by the action when validation fails', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    render(<ColaboradorForm onSaved={vi.fn()} onError={onError} />);

    await user.click(screen.getByRole('button', { name: /salvar colaborador/i }));

    expect(onError).toHaveBeenCalledWith('Nome é obrigatório');
  });

  it('pre-fills fields when editing an existing colaborador', () => {
    render(
      <ColaboradorForm
        colaborador={{ id: 1, nome: 'Bruna', contato: '11988887777', formacao: 'Direito', interno: false }}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Nome')).toHaveValue('Bruna');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/features/colaboradores/components/colaborador-form`
Expected: FAIL.

- [ ] **Step 3: Rewrite ColaboradorForm**

Replace `src/features/colaboradores/components/colaborador-form.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { createColaborador, updateColaborador, type Colaborador } from '../actions';
import type { ColaboradorInput } from '../schemas';

export function ColaboradorForm({
  colaborador,
  onSaved,
  onError,
}: {
  colaborador?: Colaborador;
  onSaved: (colaborador: Colaborador) => void;
  onError: (message: string) => void;
}) {
  const [nome, setNome] = useState(colaborador?.nome ?? '');
  const [contato, setContato] = useState(colaborador?.contato ?? '');
  const [formacao, setFormacao] = useState(colaborador?.formacao ?? '');
  const [interno, setInterno] = useState(colaborador?.interno ?? true);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const input: ColaboradorInput = { nome, contato, formacao, interno };
    const result = colaborador
      ? await updateColaborador(colaborador.id, input)
      : await createColaborador(input);
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
      <div className="flex items-center gap-2">
        <Switch id="interno" checked={interno} onCheckedChange={setInterno} />
        <Label htmlFor="interno">Colaborador interno</Label>
      </div>
      <Button type="submit" disabled={saving} className="w-full">
        {saving && <Loader2 className="size-4 animate-spin" />}
        {saving ? 'Salvando...' : 'Salvar colaborador'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/features/colaboradores/components/colaborador-form`
Expected: both pass.

- [ ] **Step 5: Add the edit icon to ColaboradoresTable**

Replace `src/features/colaboradores/components/colaboradores-table.tsx`:

```tsx
'use client';

import { Pencil } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import type { Colaborador } from '../actions';

export function ColaboradoresTable({ items, onEdit }: { items: Colaborador[]; onEdit: (colaborador: Colaborador) => void }) {
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
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>{item.nome}</TableCell>
            <TableCell>{item.contato}</TableCell>
            <TableCell>{item.formacao}</TableCell>
            <TableCell>{item.interno ? 'Interno' : 'Externo'}</TableCell>
            <TableCell>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => onEdit(item)}>
                <Pencil className="size-4" />
                <span className="sr-only">Editar {item.nome}</span>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 6: Write the failing ColaboradoresScreen test**

Create `src/features/colaboradores/components/colaboradores-screen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ColaboradoresScreen } from './colaboradores-screen';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock('../actions', () => ({
  createColaborador: vi.fn(async (input: unknown) => ({ success: true, data: { id: 9, ...(input as object) } })),
  updateColaborador: vi.fn(async (id: number, input: unknown) => ({ success: true, data: { id, ...(input as object) } })),
}));

const items = [{ id: 1, nome: 'Bruna', contato: '', formacao: '', interno: true }];

describe('ColaboradoresScreen', () => {
  it('opens the edit dialog pre-filled with the selected colaborador', async () => {
    const user = userEvent.setup();
    render(<ColaboradoresScreen items={items} />);

    await user.click(screen.getByRole('button', { name: /editar bruna/i }));

    expect(screen.getByLabelText('Nome')).toHaveValue('Bruna');
    expect(screen.getByRole('heading', { name: 'Editar colaborador' })).toBeInTheDocument();
  });

  it('closes the dialog and refreshes after a successful save', async () => {
    const user = userEvent.setup();
    render(<ColaboradoresScreen items={items} />);

    await user.click(screen.getByRole('button', { name: /novo colaborador/i }));
    await user.type(screen.getByLabelText('Nome'), 'Eduardo');
    await user.click(screen.getByRole('button', { name: /salvar colaborador/i }));

    expect(refresh).toHaveBeenCalled();
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npm run test -- src/features/colaboradores/components/colaboradores-screen`
Expected: FAIL — module doesn't exist.

- [ ] **Step 8: Write ColaboradoresScreen**

Create `src/features/colaboradores/components/colaboradores-screen.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ColaboradoresTable } from './colaboradores-table';
import { ColaboradorForm } from './colaborador-form';
import type { Colaborador } from '../actions';

export function ColaboradoresScreen({ items }: { items: Colaborador[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Colaborador | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(colaborador: Colaborador) {
    setEditing(colaborador);
    setDialogOpen(true);
  }

  function handleSaved() {
    toast.success(editing ? 'Colaborador atualizado' : 'Colaborador criado');
    setDialogOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Colaboradores</h1>
        <Button type="button" onClick={openCreate}>
          <Plus className="size-4" />
          Novo colaborador
        </Button>
      </div>
      <ColaboradoresTable items={items} onEdit={openEdit} />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar colaborador' : 'Novo colaborador'}</DialogTitle>
          </DialogHeader>
          <ColaboradorForm
            colaborador={editing ?? undefined}
            onSaved={handleSaved}
            onError={(message) => toast.error(message)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npm run test -- src/features/colaboradores/components/colaboradores-screen`
Expected: both pass.

- [ ] **Step 10: Rewire the page, add loading, remove old routes**

Replace `src/app/(app)/colaboradores/page.tsx`:

```tsx
import { listColaboradores } from '@/features/colaboradores/actions';
import { ColaboradoresScreen } from '@/features/colaboradores/components/colaboradores-screen';

export default async function ColaboradoresPage() {
  const items = await listColaboradores();
  return <ColaboradoresScreen items={items} />;
}
```

Create `src/app/(app)/colaboradores/loading.tsx`:

```tsx
import { TableSkeleton } from '@/components/shared/table-skeleton';

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
      </div>
      <TableSkeleton columns={5} />
    </div>
  );
}
```

Remove the now-unused pages:

```bash
git rm "src/app/(app)/colaboradores/novo/page.tsx"
git rm "src/app/(app)/colaboradores/[id]/page.tsx"
```

- [ ] **Step 11: Run the full suite and type-check**

Run: `npm run test && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: convert Colaboradores to list + modal CRUD"
```

---

## Task 11: Perícias — PericiaForm callback conversion

**Files:**
- Modify: `src/features/pericias/components/pericia-form.tsx`
- Modify: `src/features/pericias/components/pericia-form.test.tsx`

**Interfaces:**
- Consumes: `createPericia`/`updatePericia` (existing).
- Produces: `<PericiaForm pericia? peritos colaboradores onSaved onError />` — `onSaved` now receives the new/updated perícia's `id: number` (not a page navigation). Consumed by Task 13 (Perícias screen).

- [ ] **Step 1: Rewrite the failing PericiaForm test**

Replace `src/features/pericias/components/pericia-form.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PericiaForm } from './pericia-form';
import type { Processo } from '@/features/processos/actions';
import type { MunicipioIBGE } from '@/lib/ibge/client';

vi.mock('../actions', () => ({
  createPericia: vi.fn(async () => ({ success: true, data: { id: 5 } })),
  updatePericia: vi.fn(async () => ({ success: true, data: { id: 5 } })),
}));

vi.mock('@/features/processos/components/processo-combobox', () => ({
  ProcessoCombobox: ({ onChange }: { onChange: (p: Processo) => void }) => (
    <button type="button" onClick={() => onChange({ id: 1, numero: 'P-1', autor: 'A', reu: 'B' })}>
      selecionar processo
    </button>
  ),
}));

vi.mock('@/features/municipios/components/municipio-combobox', () => ({
  MunicipioCombobox: ({ onChange }: { onChange: (m: MunicipioIBGE) => void }) => (
    <button type="button" onClick={() => onChange({ id: 3550308, nome: 'São Paulo', uf: 'SP' })}>
      selecionar município
    </button>
  ),
}));

describe('PericiaForm', () => {
  it('calls onError when processo, municipio, or perito are missing', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    render(<PericiaForm peritos={[{ id: 1, nome: 'Carlos' }]} colaboradores={[]} onSaved={vi.fn()} onError={onError} />);

    await user.click(screen.getByRole('button', { name: /salvar perícia/i }));

    expect(onError).toHaveBeenCalledWith('Preencha processo, município e perito.');
  });

  it('calls onSaved with the id once processo, municipio, and perito are set', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<PericiaForm peritos={[{ id: 1, nome: 'Carlos' }]} colaboradores={[]} onSaved={onSaved} onError={vi.fn()} />);

    await user.click(screen.getByText('selecionar processo'));
    await user.click(screen.getByText('selecionar município'));
    await user.type(screen.getByLabelText('Data agendada'), '2026-08-01');
    await user.type(screen.getByLabelText('Hora agendada'), '14:30');
    await user.click(screen.getByRole('combobox', { name: /perito/i }));
    await user.click(await screen.findByText('Carlos'));
    await user.click(screen.getByRole('button', { name: /salvar perícia/i }));

    expect(onSaved).toHaveBeenCalledWith(5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/features/pericias/components/pericia-form`
Expected: FAIL — current `PericiaForm` doesn't accept `onSaved`/`onError`.

- [ ] **Step 3: Rewrite PericiaForm**

Replace `src/features/pericias/components/pericia-form.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
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
  onSaved,
  onError,
}: {
  pericia?: PericiaInput & { id: number; processo: Processo; municipio: MunicipioIBGE };
  peritos: PeritoOption[];
  colaboradores: ColaboradorOption[];
  onSaved: (id: number) => void;
  onError: (message: string) => void;
}) {
  const [processo, setProcesso] = useState<Processo | null>(pericia?.processo ?? null);
  const [municipio, setMunicipio] = useState<MunicipioIBGE | null>(pericia?.municipio ?? null);
  const [peritoId, setPeritoId] = useState(pericia?.peritoId ? String(pericia.peritoId) : '');
  const [colaboradorId, setColaboradorId] = useState(
    pericia?.colaboradorId ? String(pericia.colaboradorId) : ''
  );
  const [dataAgendada, setDataAgendada] = useState(pericia?.dataAgendada ?? '');
  const [horaAgendada, setHoraAgendada] = useState(pericia?.horaAgendada ?? '');
  const [situacao, setSituacao] = useState<PericiaInput['situacao']>(pericia?.situacao ?? 'pendente');
  const [saving, setSaving] = useState(false);

  const peritoItems = Object.fromEntries(peritos.map((p) => [String(p.id), p.nome]));
  const colaboradorItems = Object.fromEntries(colaboradores.map((c) => [String(c.id), c.nome]));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!processo || !municipio || !peritoId) {
      onError('Preencha processo, município e perito.');
      return;
    }
    setSaving(true);
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
      onError(result.error);
      return;
    }
    onSaved(result.data.id);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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
          <Input id="data" type="date" value={dataAgendada} onChange={(e) => setDataAgendada(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hora">Hora agendada</Label>
          <Input id="hora" type="time" value={horaAgendada} onChange={(e) => setHoraAgendada(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="perito">Perito</Label>
        <Select items={peritoItems} value={peritoId} onValueChange={(v) => setPeritoId(v ?? '')}>
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
        <Select items={colaboradorItems} value={colaboradorId} onValueChange={(v) => setColaboradorId(v ?? '')}>
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

      <Button type="submit" disabled={saving} className="w-full">
        {saving && <Loader2 className="size-4 animate-spin" />}
        {saving ? 'Salvando...' : 'Salvar perícia'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/features/pericias/components/pericia-form`
Expected: both pass.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: errors are expected here — `pericias-table.tsx`/`nova/page.tsx`/`[id]/page.tsx` still call `PericiaForm` the old way. That's fine; Tasks 12–13 fix those call sites next. Confirm the errors are limited to those files, not a mistake in this task's own code.

- [ ] **Step 6: Commit**

```bash
git add src/features/pericias/components/pericia-form.tsx src/features/pericias/components/pericia-form.test.tsx
git commit -m "refactor: convert PericiaForm to onSaved/onError callbacks"
```

---

## Task 12: Perícias listing — accordion instead of tooltip

**Files:**
- Modify: `src/features/pericias/components/pericias-table.tsx`
- Modify: `src/features/pericias/components/pericias-table.test.tsx`

**Interfaces:**
- Consumes: `PericiaListItem` (existing), `StatusBadge` (Task 2).
- Produces: `<PericiasTable items onEdit />` (adds `onEdit`, removes the tooltip-based rendering). Consumed by Task 13 (Perícias screen).

- [ ] **Step 1: Rewrite the failing PericiasTable test**

Replace `src/features/pericias/components/pericias-table.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
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
  it('renders the required columns without the detail row initially', () => {
    render(<PericiasTable items={items} onEdit={vi.fn()} />);
    expect(screen.getByText('0001234-56.2026.8.26.0100')).toBeInTheDocument();
    expect(screen.getByText('São Paulo/SP')).toBeInTheDocument();
    expect(screen.getByText('Carlos Lima')).toBeInTheDocument();
    expect(screen.queryByText('Maria Souza × João Pereira')).not.toBeInTheDocument();
  });

  it('expands the detail row with processo/perito/colaborador blocks when the chevron is clicked', async () => {
    const user = userEvent.setup();
    render(<PericiasTable items={items} onEdit={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /detalhes da perícia/i }));

    expect(screen.getByText('Maria Souza × João Pereira')).toBeInTheDocument();
    expect(screen.getByText(/CREA: 123456/)).toBeInTheDocument();
    expect(screen.getByText('Nenhum colaborador vinculado.')).toBeInTheDocument();
  });

  it('collapses the detail row when the chevron is clicked again', async () => {
    const user = userEvent.setup();
    render(<PericiasTable items={items} onEdit={vi.fn()} />);

    const toggle = screen.getByRole('button', { name: /detalhes da perícia/i });
    await user.click(toggle);
    expect(screen.getByText('Maria Souza × João Pereira')).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.queryByText('Maria Souza × João Pereira')).not.toBeInTheDocument();
  });

  it('calls onEdit when the edit icon is clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<PericiasTable items={items} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: /editar perícia/i }));

    expect(onEdit).toHaveBeenCalledWith(items[0]);
  });

  it('shows a message when there are no items', () => {
    render(<PericiasTable items={[]} onEdit={vi.fn()} />);
    expect(screen.getByText('Nenhuma perícia encontrada.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/features/pericias/components/pericias-table`
Expected: FAIL — current implementation has no chevron toggle, no `onEdit` prop, and shows tooltips instead.

- [ ] **Step 3: Rewrite PericiasTable**

Replace `src/features/pericias/components/pericias-table.tsx`:

```tsx
'use client';

import { Fragment, useState } from 'react';
import { ChevronRight, Pencil } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { cn } from '@/lib/utils';
import type { PericiaListItem } from '../actions';

export function PericiasTable({ items, onEdit }: { items: PericiaListItem[]; onEdit: (item: PericiaListItem) => void }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhuma perícia encontrada.</p>;
  }

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <TableHead>Nº Processo</TableHead>
          <TableHead>Data - Hora</TableHead>
          <TableHead>Local</TableHead>
          <TableHead>Perito</TableHead>
          <TableHead>Colaborador</TableHead>
          <TableHead>Situação</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const isExpanded = expanded.has(item.id);
          return (
            <Fragment key={item.id}>
              <TableRow>
                <TableCell>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => toggle(item.id)}>
                    <ChevronRight className={cn('size-4 transition-transform', isExpanded && 'rotate-90')} />
                    <span className="sr-only">Detalhes da perícia {item.processo.numero}</span>
                  </Button>
                </TableCell>
                <TableCell>{item.processo.numero}</TableCell>
                <TableCell>
                  {new Date(`${item.dataAgendada}T${item.horaAgendada}`).toLocaleString('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </TableCell>
                <TableCell>{item.municipio.nome}/{item.municipio.uf}</TableCell>
                <TableCell>{item.perito.nome}</TableCell>
                <TableCell>
                  {item.colaborador ? item.colaborador.nome : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <StatusBadge situacao={item.situacao} />
                </TableCell>
                <TableCell>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => onEdit(item)}>
                    <Pencil className="size-4" />
                    <span className="sr-only">Editar perícia {item.processo.numero}</span>
                  </Button>
                </TableCell>
              </TableRow>
              {isExpanded && (
                <TableRow>
                  <TableCell colSpan={8} className="bg-muted/30">
                    <div className="grid gap-4 py-2 md:grid-cols-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Processo</p>
                        <p className="text-sm">{item.processo.autor} × {item.processo.reu}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Perito</p>
                        <p className="text-sm">
                          Contato: {item.perito.contato} · Formação: {item.perito.formacao} · CREA: {item.perito.crea}
                          <br />
                          Já trabalhamos: {item.perito.jaTrabalhamos ? 'Sim' : 'Não'} · Relação: {item.perito.relacao}/10 · Resultados: {item.perito.resultados}/10
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Colaborador</p>
                        {item.colaborador ? (
                          <p className="text-sm">
                            Contato: {item.colaborador.contato} · Formação: {item.colaborador.formacao} ·{' '}
                            {item.colaborador.interno ? 'Interno' : 'Externo'}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Nenhum colaborador vinculado.</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/features/pericias/components/pericias-table`
Expected: all 5 pass.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: the `pericias-table.tsx` errors from Task 11 are now gone. Remaining errors (if any) should be confined to `(app)/page.tsx`, `(app)/pericias/nova/page.tsx`, `(app)/pericias/[id]/page.tsx` — fixed in Task 13.

- [ ] **Step 6: Commit**

```bash
git add src/features/pericias/components/pericias-table.tsx src/features/pericias/components/pericias-table.test.tsx
git commit -m "feat: replace perícias tooltip columns with an expandable accordion row"
```

---

## Task 13: Perícias screen, page rewire, remove old routes

**Files:**
- Create: `src/features/pericias/components/pericias-screen.tsx`
- Test: `src/features/pericias/components/pericias-screen.test.tsx`
- Modify: `src/app/(app)/page.tsx`
- Create: `src/app/(app)/loading.tsx`
- Delete: `src/app/(app)/pericias/nova/page.tsx`, `src/app/(app)/pericias/[id]/page.tsx`

**Interfaces:**
- Consumes: `listPericias`/`getPericiaForEdit`/`PericiaListItem` (existing), `listPeritosOptions` (existing), `listColaboradoresOptions` (existing), `PericiasTable` (Task 12), `PericiaForm` (Task 11), `PericiasFilters` (existing, untouched), `TableSkeleton` (Task 4).
- Produces: `<PericiasScreen items peritos colaboradores getPericiaForEdit />`. This is the last file that removes the old page-navigation pattern — after this task, no component in the app calls `router.push` to a `/nova` or `/[id]` route for any of these four entities.

- [ ] **Step 1: Write the failing PericiasScreen test**

Create `src/features/pericias/components/pericias-screen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PericiasScreen } from './pericias-screen';
import type { PericiaListItem } from '../actions';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('../actions', () => ({
  createPericia: vi.fn(async () => ({ success: true, data: { id: 9 } })),
  updatePericia: vi.fn(async () => ({ success: true, data: { id: 1 } })),
}));

vi.mock('@/features/processos/components/processo-combobox', () => ({
  ProcessoCombobox: ({ selected }: { selected: { numero: string } | null }) => (
    <span>{selected ? selected.numero : 'processo vazio'}</span>
  ),
}));

vi.mock('@/features/municipios/components/municipio-combobox', () => ({
  MunicipioCombobox: ({ selected }: { selected: { nome: string } | null }) => (
    <span>{selected ? selected.nome : 'municipio vazio'}</span>
  ),
}));

const items: PericiaListItem[] = [
  {
    id: 1,
    dataAgendada: '2026-08-01',
    horaAgendada: '14:30',
    situacao: 'marcada',
    processo: { id: 1, numero: 'P-1', autor: 'A', reu: 'B' },
    municipio: { id: 3550308, nome: 'São Paulo', uf: 'SP' },
    perito: { id: 1, nome: 'Carlos', contato: '', formacao: '', crea: '', jaTrabalhamos: false, relacao: 0, resultados: 0 },
    colaborador: null,
  },
];

describe('PericiasScreen', () => {
  it('opens the edit dialog pre-filled after fetching the full record', async () => {
    const user = userEvent.setup();
    const getPericiaForEdit = vi.fn(async () => ({
      id: 1,
      processoId: 1,
      municipioId: 3550308,
      peritoId: 1,
      colaboradorId: null,
      dataAgendada: '2026-08-01',
      horaAgendada: '14:30',
      situacao: 'marcada' as const,
      processo: { id: 1, numero: 'P-1', autor: 'A', reu: 'B' },
      municipio: { id: 3550308, nome: 'São Paulo', uf: 'SP' },
    }));

    render(
      <PericiasScreen
        items={items}
        peritos={[{ id: 1, nome: 'Carlos' }]}
        colaboradores={[]}
        getPericiaForEdit={getPericiaForEdit}
      />
    );

    await user.click(screen.getByRole('button', { name: /editar perícia/i }));

    expect(getPericiaForEdit).toHaveBeenCalledWith(1);
    expect(await screen.findByRole('heading', { name: 'Editar perícia' })).toBeInTheDocument();
    expect(screen.getByText('P-1')).toBeInTheDocument();
  });

  it('shows an error toast and does not open the dialog when the record cannot be loaded', async () => {
    const user = userEvent.setup();
    const getPericiaForEdit = vi.fn(async () => null);

    render(
      <PericiasScreen
        items={items}
        peritos={[{ id: 1, nome: 'Carlos' }]}
        colaboradores={[]}
        getPericiaForEdit={getPericiaForEdit}
      />
    );

    await user.click(screen.getByRole('button', { name: /editar perícia/i }));

    expect(getPericiaForEdit).toHaveBeenCalledWith(1);
    expect(screen.queryByRole('heading', { name: 'Editar perícia' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/features/pericias/components/pericias-screen`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write PericiasScreen**

Create `src/features/pericias/components/pericias-screen.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PericiasTable } from './pericias-table';
import { PericiasFilters } from './pericias-filters';
import { PericiaForm } from './pericia-form';
import type { PericiaListItem } from '../actions';
import type { Processo } from '@/features/processos/actions';
import type { MunicipioIBGE } from '@/lib/ibge/client';
import type { PericiaInput } from '../schemas';

type PeritoOption = { id: number; nome: string };
type ColaboradorOption = { id: number; nome: string };
type EditingPericia = PericiaInput & { id: number; processo: Processo; municipio: MunicipioIBGE };

export function PericiasScreen({
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EditingPericia | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  async function openEdit(item: PericiaListItem) {
    setLoadingEdit(true);
    const full = await getPericiaForEdit(item.id);
    setLoadingEdit(false);
    if (!full) {
      toast.error('Não foi possível carregar essa perícia.');
      return;
    }
    setEditing(full);
    setDialogOpen(true);
  }

  function handleSaved() {
    toast.success(editing ? 'Perícia atualizada' : 'Perícia criada');
    setDialogOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Perícias</h1>
        <Button type="button" onClick={openCreate} disabled={loadingEdit}>
          <Plus className="size-4" />
          Nova perícia
        </Button>
      </div>
      <PericiasFilters />
      <PericiasTable items={items} onEdit={openEdit} />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar perícia' : 'Nova perícia'}</DialogTitle>
          </DialogHeader>
          <PericiaForm
            pericia={editing ?? undefined}
            peritos={peritos}
            colaboradores={colaboradores}
            onSaved={handleSaved}
            onError={(message) => toast.error(message)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/features/pericias/components/pericias-screen`
Expected: both pass.

- [ ] **Step 5: Rewire the home page, add loading, remove old routes**

Replace `src/app/(app)/page.tsx`:

```tsx
import { listPericias, getPericiaForEdit } from '@/features/pericias/actions';
import { listPeritosOptions } from '@/features/peritos/actions';
import { listColaboradoresOptions } from '@/features/colaboradores/actions';
import { PericiasScreen } from '@/features/pericias/components/pericias-screen';

export default async function PericiasPage({
  searchParams,
}: {
  searchParams: Promise<{ situacao?: string; busca?: string }>;
}) {
  const { situacao, busca } = await searchParams;
  const [items, peritos, colaboradores] = await Promise.all([
    listPericias({ situacao, busca }),
    listPeritosOptions(),
    listColaboradoresOptions(),
  ]);

  return (
    <PericiasScreen
      items={items}
      peritos={peritos}
      colaboradores={colaboradores}
      getPericiaForEdit={getPericiaForEdit}
    />
  );
}
```

Create `src/app/(app)/loading.tsx`:

```tsx
import { TableSkeleton } from '@/components/shared/table-skeleton';

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-8 w-28 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-9 w-full max-w-md animate-pulse rounded-md bg-muted" />
      <TableSkeleton columns={8} />
    </div>
  );
}
```

Remove the now-unused pages:

```bash
git rm "src/app/(app)/pericias/nova/page.tsx"
git rm "src/app/(app)/pericias/[id]/page.tsx"
```

If the `pericias/` and `pericias/nova/` directories are now empty, they are removed automatically by `git rm` deleting their only tracked file — no separate cleanup needed.

- [ ] **Step 6: Run the full suite, type-check, and build**

Run: `npm run test && npx tsc --noEmit && npm run build`
Expected: all pass; the build's route list should no longer include `/pericias/nova` or `/pericias/[id]` (or `/peritos/novo`, `/peritos/[id]`, `/colaboradores/novo`, `/colaboradores/[id]` from Tasks 9–10).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: convert Perícias to list + modal CRUD"
```

---

## Task 14: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full automated suite**

Run: `npm run test`
Expected: every test from Tasks 1–13 passes.

- [ ] **Step 2: Type-check, lint, and build**

Run: `npx tsc --noEmit && npx eslint . && npm run build`
Expected: no type errors, no lint errors, production build succeeds. Confirm the route list printed by `next build` matches: `/`, `/processos`, `/peritos`, `/colaboradores`, `/perfis`, `/login`, `/pendente`, `/auth/callback` — and does **not** include any `/nova` or `/[id]` route for perícias, peritos, or colaboradores.

- [ ] **Step 3: Grep for dangling references to the removed routes**

Run: `grep -rn "pericias/nova\|pericias/\[id\]\|peritos/novo\|peritos/\[id\]\|colaboradores/novo\|colaboradores/\[id\]" src/`
Expected: no matches (aside from this plan's own text if it were searched, which it isn't part of `src/`). Any match is a leftover `Link`/`router.push` that still points at a page that no longer exists.

- [ ] **Step 4: Manual QA checklist**

This step is for a human (or a session with a real browser) against the running app — not something a test command can verify. Using `npm run dev` against the live Supabase project:

- [ ] The app renders in the dark teal palette (near-black background, teal buttons/links, IBM Plex body text, Space Grotesk headings) on every screen, including `/login`.
- [ ] The sidebar shows Perícias, Processos, Peritos, Colaboradores, Perfis (admin) with icons; clicking the collapse toggle shrinks it to icons-only, and the collapsed state survives a page reload.
- [ ] On the Perícias listing, clicking a row's chevron expands a 3-column detail block (Processo/Perito/Colaborador) and collapses it again on a second click; the tooltip behavior is gone.
- [ ] "Nova perícia" opens a modal (not a page navigation); after saving, the modal closes, a success toast appears, and the list updates without a full page reload.
- [ ] Clicking a perícia's edit (pencil) icon opens the same modal pre-filled with that perícia's data (processo, município, perito, colaborador, data/hora, situação all correctly selected — not showing raw ids).
- [ ] The same create/edit/toast/refresh behavior works on Peritos, Colaboradores, and the new Processos screen.
- [ ] Submitting an invalid form (e.g. empty nome) shows an error toast and keeps the modal open with the entered data intact.
- [ ] Navigating between screens briefly shows a skeleton (throttle the network in devtools if it's too fast to see locally).
- [ ] No console warnings from Base UI (`nativeButton`/`render` composition) appear on any screen.

- [ ] **Step 5: Fix any gaps found during QA, then re-run Steps 1–3**

If QA uncovers a bug, fix it with its own test-first commit before considering the plan complete.
