# Autenticação e Gestão de Usuários (Pacote B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Google login, let an admin create user accounts from inside the app, add a forgot-password flow, and let each user change their own name/password.

**Architecture:** Four largely independent additions on top of the existing Supabase-Auth-backed `profiles` table (roles `pendente`/`gerencia`/`admin`, `handle_new_user` trigger, `current_role()` RLS helper): a server-only service-role Supabase client for admin-driven user creation, two new public routes for the password-recovery flow, a new `SECURITY DEFINER` RPC for safe self-service name updates, and one small login-page error-display fix. Google OAuth itself needs no new code — only external configuration.

**Tech Stack:** Next.js 16 App Router + React 19 + Supabase (`@supabase/ssr`, `@supabase/supabase-js`) + Tailwind v4 + Zod + Vitest/RTL, Base UI-based `@/components/ui/*`.

## Global Constraints

- Every new/modified server action that mutates data calls `requireRole([...])` first — matches the project's existing convention (defense in depth even though middleware already gates routes).
- The service-role client (`src/lib/supabase/admin.ts`) is never imported from a client component (`'use client'` file) — only from `'use server'` action files.
- The new migration (`update_own_nome` RPC) is applied to the dev Supabase project (`wpssipdxpfmvcamldpum`) as part of its task. It is applied to production (`ralyhgneesqpfijpvxii`) ONLY in the plan's final task, and ONLY after asking the user for live, explicit confirmation at that exact moment — never assume earlier authorization covers it.
- Google OAuth setup (Google Cloud Console + Supabase dashboard) is configuration, not code — it is its own task, executed live with the user (not dispatched to a subagent).
- `src/lib/supabase/client.ts` (the browser Supabase client) already exists in the repo but has zero imports anywhere today — Task 6 is its first real usage. It is not dead code to leave alone; it exists precisely for this.
- Follow existing conventions exactly: `ActionResult<T>` return shape (`@/lib/action-result`), `toast.success`/`toast.error` + `router.refresh()` after mutations in Screens, `useTransition` for inline pending state (as in `PerfisTable`), Dialog-based create forms (as in `PeritosScreen`/`PeritoForm`). Do not invent new patterns.
- No action in this codebase uses `revalidatePath` except `src/features/perfis/actions.ts` (`updateProfileRole` calls `revalidatePath('/perfis')`) — new actions in `perfis/actions.ts` and `meu-perfil/actions.ts` follow that file's own existing pattern and call `revalidatePath` on their own route; actions elsewhere do not.

---

### Task 1: Server-only admin Supabase client

**Files:**
- Create: `src/lib/supabase/admin.ts`

**Interfaces:**
- Produces: `createAdminClient(): SupabaseClient<Database>` — a service-role client. Consumed by Task 3.

- [ ] **Step 1: Write the file**

```ts
// src/lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  return createClient<Database>(url, serviceKey);
}
```

This mirrors `scripts/seed-admin.ts:1,13` (`createClient(url, serviceKey)` from `@supabase/supabase-js`, not `@supabase/ssr`). `SUPABASE_SERVICE_ROLE_KEY` has no `NEXT_PUBLIC_` prefix, so Next.js already refuses to bundle it into client-side code — this file must still only ever be imported from `'use server'` files, never a `'use client'` component, as a second layer of safety.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/admin.ts
git commit -m "feat: add server-only Supabase admin client"
```

---

### Task 2: Route-guard changes for the password-recovery pages

**Files:**
- Modify: `src/features/auth/route-guard.ts`
- Test: `src/features/auth/route-guard.test.ts`

**Interfaces:**
- Produces: `/esqueci-senha` is public (unauthenticated-reachable); any path starting with `/redefinir-senha` bypasses ALL auth/role checks (reachable authenticated or not, any role). Consumed by Tasks 5 and 6 (the pages themselves) and by manual QA in the final task.

- [ ] **Step 1: Write the failing tests**

Add to `src/features/auth/route-guard.test.ts` (inside the existing `describe('resolveRedirect', ...)` block, after the last existing `it`):

```ts
  it('allows unauthenticated users on /esqueci-senha', () => {
    expect(resolveRedirect({ path: '/esqueci-senha', isAuthenticated: false, role: null })).toBeNull();
  });

  it('allows unauthenticated users on /redefinir-senha', () => {
    expect(resolveRedirect({ path: '/redefinir-senha', isAuthenticated: false, role: null })).toBeNull();
  });

  it('allows authenticated pendente users on /redefinir-senha (recovery must always be reachable)', () => {
    expect(resolveRedirect({ path: '/redefinir-senha', isAuthenticated: true, role: 'pendente' })).toBeNull();
  });

  it('allows authenticated users with a missing role on /redefinir-senha', () => {
    expect(resolveRedirect({ path: '/redefinir-senha', isAuthenticated: true, role: null })).toBeNull();
  });

  it('allows approved users on /redefinir-senha too', () => {
    expect(resolveRedirect({ path: '/redefinir-senha', isAuthenticated: true, role: 'admin' })).toBeNull();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/auth/route-guard.test.ts`
Expected: the 3 new tests with `role: 'pendente'` / `role: null` on `/redefinir-senha` FAIL (current logic redirects them to `/pendente`); the `/esqueci-senha` tests also FAIL (not yet in `PUBLIC_PATHS`, so an unauthenticated request redirects to `/login`).

- [ ] **Step 3: Update `resolveRedirect`**

In `src/features/auth/route-guard.ts`, replace:

```ts
const PUBLIC_PATHS = ['/login', '/auth/callback'];

export function resolveRedirect({ path, isAuthenticated, role }: RouteGuardInput): string | null {
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!isAuthenticated) {
    return isPublic ? null : '/login';
  }
```

with:

```ts
const PUBLIC_PATHS = ['/login', '/auth/callback', '/esqueci-senha'];
const RECOVERY_PATH = '/redefinir-senha';

export function resolveRedirect({ path, isAuthenticated, role }: RouteGuardInput): string | null {
  // The Supabase recovery link authenticates the user with whatever role
  // their account already has (including 'pendente' or a missing profile).
  // This page must stay reachable regardless, or they can never actually
  // set the new password.
  if (path.startsWith(RECOVERY_PATH)) return null;

  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!isAuthenticated) {
    return isPublic ? null : '/login';
  }
```

Leave every line after this unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/auth/route-guard.test.ts`
Expected: PASS, all tests (old and new).

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/route-guard.ts src/features/auth/route-guard.test.ts
git commit -m "feat: allow unauthenticated/unapproved access to password-recovery routes"
```

---

### Task 3: Admin-driven user creation — schema + server action

**Files:**
- Modify: `src/features/perfis/schemas.ts`
- Modify: `src/features/perfis/actions.ts`
- Create: `src/features/perfis/actions.test.ts`

**Interfaces:**
- Consumes: `createAdminClient` from `src/lib/supabase/admin.ts` (Task 1); `requireRole` from `@/features/auth/guards`; `ActionResult<T>` from `@/lib/action-result`; `Role`/`roleOptions` from `./schemas` (already exist).
- Produces: `createUserSchema` (Zod schema). `createUser(input: { nome: string; email: string; password: string; role: Role }): Promise<ActionResult<null>>`. Consumed by Task 4.

- [ ] **Step 1: Add the schema**

Add to `src/features/perfis/schemas.ts` (after the existing `updateRoleSchema`):

```ts
export const createUserSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
  role: z.enum(roleOptions),
});
```

- [ ] **Step 2: Write the failing tests**

Create `src/features/perfis/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUser } from './actions';

const mockCreateAuthUser = vi.fn();
const mockProfileUpdateEq = vi.fn();
const mockProfileUpdate = vi.fn(() => ({ eq: mockProfileUpdateEq }));

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'admin' })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { createUser: mockCreateAuthUser } },
    from: () => ({ update: mockProfileUpdate }),
  })),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const validInput = { nome: 'Novo Usuário', email: 'novo@x.com', password: 'senha123', role: 'gerencia' as const };

describe('createUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfileUpdateEq.mockResolvedValue({ error: null });
  });

  it('creates the auth user then sets nome/role on the profile', async () => {
    mockCreateAuthUser.mockResolvedValue({ data: { user: { id: 'new-id' } }, error: null });

    const result = await createUser(validInput);

    expect(result).toEqual({ success: true, data: null });
    expect(mockCreateAuthUser).toHaveBeenCalledWith({
      email: 'novo@x.com',
      password: 'senha123',
      email_confirm: true,
    });
    expect(mockProfileUpdate).toHaveBeenCalledWith({ nome: 'Novo Usuário', role: 'gerencia' });
    expect(mockProfileUpdateEq).toHaveBeenCalledWith('id', 'new-id');
  });

  it('returns a validation error for a too-short password without calling the Auth API', async () => {
    const result = await createUser({ ...validInput, password: '123' });

    expect(result).toEqual({ success: false, error: 'Senha deve ter ao menos 6 caracteres' });
    expect(mockCreateAuthUser).not.toHaveBeenCalled();
  });

  it('returns the Auth API error message (e.g. duplicate e-mail) without touching profiles', async () => {
    mockCreateAuthUser.mockResolvedValue({ data: { user: null }, error: { message: 'User already registered' } });

    const result = await createUser(validInput);

    expect(result).toEqual({ success: false, error: 'User already registered' });
    expect(mockProfileUpdate).not.toHaveBeenCalled();
  });

  it('returns the profile-update error when it fails', async () => {
    mockCreateAuthUser.mockResolvedValue({ data: { user: { id: 'new-id' } }, error: null });
    mockProfileUpdateEq.mockResolvedValue({ error: { message: 'update failed' } });

    const result = await createUser(validInput);

    expect(result).toEqual({ success: false, error: 'update failed' });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/features/perfis/actions.test.ts`
Expected: FAIL — `createUser` is not exported yet.

- [ ] **Step 4: Add the server action**

Add to `src/features/perfis/actions.ts` (after `updateProfileRole`; add `createAdminClient` and `createUserSchema` to the existing imports at the top of the file):

```ts
import { createAdminClient } from '@/lib/supabase/admin';
import { updateRoleSchema, createUserSchema, type Role } from './schemas';
```

```ts
export async function createUser(input: {
  nome: string; email: string; password: string; role: Role;
}): Promise<ActionResult<null>> {
  await requireRole(['admin']);
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  });
  if (error) return { success: false, error: error.message };

  const { error: profileError } = await admin
    .from('profiles')
    .update({ nome: parsed.data.nome, role: parsed.data.role })
    .eq('id', data.user.id);
  if (profileError) return { success: false, error: profileError.message };

  revalidatePath('/perfis');
  return { success: true, data: null };
}
```

`revalidatePath` is already imported in this file (used by `updateProfileRole`) — do not add a second import.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/perfis/actions.test.ts`
Expected: PASS, all 4 tests.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/perfis/schemas.ts src/features/perfis/actions.ts src/features/perfis/actions.test.ts
git commit -m "feat: add createUser server action for admin-driven account creation"
```

---

### Task 4: Admin-driven user creation — Perfis UI

**Files:**
- Modify: `src/app/(app)/perfis/page.tsx`
- Create: `src/features/perfis/components/perfis-screen.tsx`
- Create: `src/features/perfis/components/create-user-form.tsx`
- Create: `src/features/perfis/components/create-user-form.test.tsx`

**Interfaces:**
- Consumes: `createUser` and `createUserSchema` (Task 3); `roleOptions` from `./schemas`; `ProfileRow` from `./actions`; `ConfirmDialog`-sibling patterns are NOT used here (this is a create form, not a delete confirmation) — follow `PeritosScreen`/`PeritoForm` instead (`src/features/peritos/components/perito-form.tsx`, already read this session).
- Produces: `PerfisScreen({ profiles: ProfileRow[] })` — default export target for `perfis/page.tsx`. `CreateUserForm({ onSaved, onError }: { onSaved: () => void; onError: (message: string) => void })`.

- [ ] **Step 1: Write the failing test for `CreateUserForm`**

Create `src/features/perfis/components/create-user-form.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { CreateUserForm } from './create-user-form';

const mockCreateUser = vi.fn();
vi.mock('../actions', () => ({
  createUser: (...args: unknown[]) => mockCreateUser(...args),
}));

describe('CreateUserForm', () => {
  it('submits nome/email/password/role and calls onSaved on success', async () => {
    mockCreateUser.mockResolvedValue({ success: true, data: null });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<CreateUserForm onSaved={onSaved} onError={vi.fn()} />);

    await user.type(screen.getByLabelText('Nome'), 'Novo Usuário');
    await user.type(screen.getByLabelText('E-mail'), 'novo@x.com');
    await user.type(screen.getByLabelText('Senha'), 'senha123');
    await user.click(screen.getByRole('button', { name: /criar usuário/i }));

    expect(mockCreateUser).toHaveBeenCalledWith({
      nome: 'Novo Usuário', email: 'novo@x.com', password: 'senha123', role: 'pendente',
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it('calls onError with the message when creation fails', async () => {
    mockCreateUser.mockResolvedValue({ success: false, error: 'User already registered' });
    const onError = vi.fn();
    const user = userEvent.setup();
    render(<CreateUserForm onSaved={vi.fn()} onError={onError} />);

    await user.type(screen.getByLabelText('Nome'), 'Novo Usuário');
    await user.type(screen.getByLabelText('E-mail'), 'novo@x.com');
    await user.type(screen.getByLabelText('Senha'), 'senha123');
    await user.click(screen.getByRole('button', { name: /criar usuário/i }));

    expect(onError).toHaveBeenCalledWith('User already registered');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/perfis/components/create-user-form.test.tsx`
Expected: FAIL — module `./create-user-form` does not exist.

- [ ] **Step 3: Write `CreateUserForm`**

Create `src/features/perfis/components/create-user-form.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createUser } from '../actions';
import { roleOptions, type Role } from '../schemas';

export function CreateUserForm({
  onSaved,
  onError,
}: {
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('pendente');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const result = await createUser({ nome, email, password, role });
    setSaving(false);
    if (!result.success) {
      onError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha temporária</Label>
        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Perfil</Label>
        <Select value={role} onValueChange={(v) => setRole(v as Role)}>
          <SelectTrigger id="role" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {roleOptions.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={saving} className="w-full">
        {saving && <Loader2 className="size-4 animate-spin" />}
        {saving ? 'Criando...' : 'Criar usuário'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/perfis/components/create-user-form.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write `PerfisScreen`**

Create `src/features/perfis/components/perfis-screen.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PerfisTable } from './perfis-table';
import { CreateUserForm } from './create-user-form';
import type { ProfileRow } from '../actions';

export function PerfisScreen({ profiles }: { profiles: ProfileRow[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleSaved() {
    toast.success('Usuário criado');
    setDialogOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Controle de perfis</h1>
        <Button type="button" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Novo usuário
        </Button>
      </div>
      <PerfisTable profiles={profiles} />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
          </DialogHeader>
          <CreateUserForm onSaved={handleSaved} onError={(message) => toast.error(message)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 6: Wire it into the page**

Replace `src/app/(app)/perfis/page.tsx` entirely with:

```tsx
import { listProfiles } from '@/features/perfis/actions';
import { PerfisScreen } from '@/features/perfis/components/perfis-screen';

export default async function PerfisPage() {
  const profiles = await listProfiles();
  return <PerfisScreen profiles={profiles} />;
}
```

- [ ] **Step 7: Run the full test suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS, no new type errors.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/perfis/page.tsx" src/features/perfis/components/perfis-screen.tsx src/features/perfis/components/create-user-form.tsx src/features/perfis/components/create-user-form.test.tsx
git commit -m "feat: add Novo usuário dialog to the Perfis screen"
```

---

### Task 5: Esqueci minha senha — request page

**Files:**
- Modify: `src/features/auth/actions.ts`
- Create: `src/features/auth/actions.test.ts`
- Create: `src/app/esqueci-senha/page.tsx`
- Create: `src/features/auth/components/esqueci-senha-form.tsx`
- Create: `src/features/auth/components/esqueci-senha-form.test.tsx`

**Interfaces:**
- Consumes: `PUBLIC_PATHS` already includes `/esqueci-senha` (Task 2).
- Produces: `requestPasswordReset(email: string): Promise<void>`. `EsqueciSenhaForm` component. Consumed by Task 6 (the login page links here).

- [ ] **Step 1: Write the failing test for the action itself**

Create `src/features/auth/actions.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { requestPasswordReset } from './actions';

const mockResetPasswordForEmail = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { resetPasswordForEmail: mockResetPasswordForEmail },
  })),
}));

describe('requestPasswordReset', () => {
  it('calls resetPasswordForEmail with the given e-mail and the redefinir-senha redirect', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
    await requestPasswordReset('alguem@x.com');
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('alguem@x.com', {
      redirectTo: 'https://example.com/redefinir-senha',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/auth/actions.test.ts`
Expected: FAIL — `requestPasswordReset` is not exported yet.

- [ ] **Step 3: Add the server action**

Add to `src/features/auth/actions.ts` (after `signInWithGoogle`, before `signOut`):

```ts
export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/redefinir-senha`,
  });
}
```

The action deliberately never returns success/failure — the caller always shows the same message, so an attacker probing e-mails can't tell which ones have accounts.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/auth/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test for the form component**

Create `src/features/auth/components/esqueci-senha-form.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { EsqueciSenhaForm } from './esqueci-senha-form';

const mockRequestPasswordReset = vi.fn();
vi.mock('../actions', () => ({
  requestPasswordReset: (...args: unknown[]) => mockRequestPasswordReset(...args),
}));

describe('EsqueciSenhaForm', () => {
  it('shows the generic confirmation message after submitting, regardless of the action outcome', async () => {
    mockRequestPasswordReset.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<EsqueciSenhaForm />);

    await user.type(screen.getByLabelText('E-mail'), 'alguem@x.com');
    await user.click(screen.getByRole('button', { name: /enviar/i }));

    expect(mockRequestPasswordReset).toHaveBeenCalledWith('alguem@x.com');
    expect(
      await screen.findByText('Se esse e-mail existir, enviamos um link de recuperação.')
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/features/auth/components/esqueci-senha-form.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 7: Write `EsqueciSenhaForm`**

Create `src/features/auth/components/esqueci-senha-form.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { requestPasswordReset } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function EsqueciSenhaForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    await requestPasswordReset(email);
    setPending(false);
    setSent(true);
  }

  if (sent) {
    return <p className="text-sm text-muted-foreground">Se esse e-mail existir, enviamos um link de recuperação.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Enviando...' : 'Enviar link de recuperação'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/features/auth/components/esqueci-senha-form.test.tsx`
Expected: PASS.

- [ ] **Step 9: Create the page**

Create `src/app/esqueci-senha/page.tsx`:

```tsx
import Link from 'next/link';
import { EsqueciSenhaForm } from '@/features/auth/components/esqueci-senha-form';

export default function EsqueciSenhaPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8 shadow-sm">
        <div className="space-y-1.5">
          <h1 className="font-heading text-xl font-semibold">Esqueci minha senha</h1>
          <p className="text-sm text-muted-foreground">Informe seu e-mail para receber um link de recuperação.</p>
        </div>
        <EsqueciSenhaForm />
        <Link href="/login" className="block text-center text-sm text-muted-foreground hover:underline">
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 11: Commit**

```bash
git add src/features/auth/actions.ts src/features/auth/actions.test.ts src/app/esqueci-senha/page.tsx src/features/auth/components/esqueci-senha-form.tsx src/features/auth/components/esqueci-senha-form.test.tsx
git commit -m "feat: add esqueci-senha request page"
```

---

### Task 6: Redefinir senha — reset page + login link

**Files:**
- Create: `src/app/redefinir-senha/page.tsx`
- Create: `src/features/auth/components/redefinir-senha-form.tsx`
- Create: `src/features/auth/components/redefinir-senha-form.test.tsx`
- Modify: `src/features/auth/components/login-form.tsx`
- Modify: `src/features/auth/components/login-form.test.tsx`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/client` (the browser client — see Global Constraints; this is its first usage in the repo). `RECOVERY_PATH` bypass in route-guard (Task 2) makes `/redefinir-senha` reachable.
- Produces: `RedefinirSenhaForm` component. A "Esqueci minha senha" link in `LoginForm` pointing at `/esqueci-senha`.

- [ ] **Step 1: Write the failing test for `RedefinirSenhaForm`**

Create `src/features/auth/components/redefinir-senha-form.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { RedefinirSenhaForm } from './redefinir-senha-form';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockUpdateUser = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { updateUser: mockUpdateUser } }),
}));

describe('RedefinirSenhaForm', () => {
  it('updates the password via the browser client and redirects to /login on success', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<RedefinirSenhaForm />);

    await user.type(screen.getByLabelText('Nova senha'), 'novaSenha123');
    await user.click(screen.getByRole('button', { name: /salvar/i }));

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'novaSenha123' });
    expect(await screen.findByText(/senha atualizada/i)).toBeInTheDocument();
  });

  it('shows an error message when updateUser fails', async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: 'Password too weak' } });
    const user = userEvent.setup();
    render(<RedefinirSenhaForm />);

    await user.type(screen.getByLabelText('Nova senha'), '123456');
    await user.click(screen.getByRole('button', { name: /salvar/i }));

    expect(await screen.findByText('Password too weak')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/auth/components/redefinir-senha-form.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `RedefinirSenhaForm`**

Create `src/features/auth/components/redefinir-senha-form.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function RedefinirSenhaForm() {
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return <p className="text-sm text-muted-foreground">Senha atualizada. Você já pode fazer login com a nova senha.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Nova senha</Label>
        <Input
          id="password" type="password" required minLength={6}
          value={password} onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Salvando...' : 'Salvar nova senha'}
      </Button>
    </form>
  );
}
```

Note: this component does NOT redirect automatically — it shows a success message with, per Step 5, a link back to `/login` (simpler and more testable than a timed redirect; the user clicks through).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/auth/components/redefinir-senha-form.test.tsx`
Expected: PASS.

- [ ] **Step 5: Create the page**

Create `src/app/redefinir-senha/page.tsx`:

```tsx
import Link from 'next/link';
import { RedefinirSenhaForm } from '@/features/auth/components/redefinir-senha-form';

export default function RedefinirSenhaPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="font-heading text-xl font-semibold">Definir nova senha</h1>
        <RedefinirSenhaForm />
        <Link href="/login" className="block text-center text-sm text-muted-foreground hover:underline">
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write the failing test for the login-form link**

Add to `src/features/auth/components/login-form.test.tsx` (new `it` inside the existing `describe`):

```tsx
  it('links to the esqueci-senha page', () => {
    render(<LoginForm />);
    expect(screen.getByRole('link', { name: /esqueci minha senha/i })).toHaveAttribute('href', '/esqueci-senha');
  });
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run src/features/auth/components/login-form.test.tsx`
Expected: the new test FAILS — no such link exists yet.

- [ ] **Step 8: Add the link**

In `src/features/auth/components/login-form.tsx`, add `import Link from 'next/link';` to the imports, and insert the link between the password field's `div` and the `{state?.error && ...}` line:

```tsx
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" name="password" type="password" required />
      </div>
      <Link href="/esqueci-senha" className="block text-right text-sm text-muted-foreground hover:underline">
        Esqueci minha senha
      </Link>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx vitest run src/features/auth/components/login-form.test.tsx`
Expected: PASS, all tests.

- [ ] **Step 10: Full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS, no new type errors.

- [ ] **Step 11: Commit**

```bash
git add src/app/redefinir-senha/page.tsx src/features/auth/components/redefinir-senha-form.tsx src/features/auth/components/redefinir-senha-form.test.tsx src/features/auth/components/login-form.tsx src/features/auth/components/login-form.test.tsx
git commit -m "feat: add redefinir-senha page and link it from the login form"
```

---

### Task 7: Self-service nome update — RPC migration + actions

**Files:**
- Create: `supabase/migrations/20260731000001_update_own_nome_rpc.sql`
- Create: `src/features/meu-perfil/schemas.ts`
- Create: `src/features/meu-perfil/actions.ts`
- Create: `src/features/meu-perfil/actions.test.ts`

**Interfaces:**
- Consumes: `requireRole` from `@/features/auth/guards`; `ActionResult<T>` from `@/lib/action-result`; `createClient` from `@/lib/supabase/server`.
- Produces: Postgres RPC `update_own_nome(new_nome text)`. `updateNomeSchema`, `updatePasswordSchema`. `updateOwnNome(nome: string): Promise<ActionResult<null>>`, `updateOwnPassword(password: string): Promise<ActionResult<null>>`. Consumed by Task 8.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260731000001_update_own_nome_rpc.sql`:

```sql
create or replace function public.update_own_nome(new_nome text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if length(trim(new_nome)) = 0 then
    raise exception 'nome não pode ser vazio';
  end if;
  update public.profiles set nome = new_nome where id = auth.uid();
end;
$$;

grant execute on function public.update_own_nome(text) to authenticated;
```

This is `SECURITY DEFINER` (like the existing `current_role()` in `20260726000003_rls_policies.sql`) specifically so it can update `profiles` without a blanket self-UPDATE RLS policy — a blanket policy would let any authenticated user PATCH their own `role` via a direct REST call, since RLS `USING (id = auth.uid())` alone cannot restrict which columns change.

- [ ] **Step 2: Apply to the dev Supabase project**

Run: `npx supabase link --project-ref wpssipdxpfmvcamldpum && npx supabase db push`
Expected: `20260731000001_update_own_nome_rpc.sql` applied. Verify with `npx supabase migration list` — `20260731000001` shows under both `local` and `remote`.

Do NOT touch the production project (`ralyhgneesqpfijpvxii`) in this task — that happens only in the plan's final task, with live user confirmation.

- [ ] **Step 3: Write the schemas**

Create `src/features/meu-perfil/schemas.ts`:

```ts
import { z } from 'zod';

export const updateNomeSchema = z.object({ nome: z.string().min(1, 'Nome é obrigatório') });
export const updatePasswordSchema = z.object({ password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres') });
```

- [ ] **Step 4: Write the failing tests**

Create `src/features/meu-perfil/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateOwnNome, updateOwnPassword } from './actions';

const mockRpc = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock('@/features/auth/guards', () => ({
  requireRole: vi.fn(async () => ({ id: 'u1', nome: 'Ana', email: 'a@x.com', role: 'gerencia' })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    rpc: mockRpc,
    auth: { updateUser: mockUpdateUser },
  })),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

describe('updateOwnNome', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls the update_own_nome RPC with the new name', async () => {
    mockRpc.mockResolvedValue({ error: null });
    const result = await updateOwnNome('Novo Nome');
    expect(result).toEqual({ success: true, data: null });
    expect(mockRpc).toHaveBeenCalledWith('update_own_nome', { new_nome: 'Novo Nome' });
  });

  it('rejects an empty name without calling the RPC', async () => {
    const result = await updateOwnNome('');
    expect(result).toEqual({ success: false, error: 'Nome é obrigatório' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns the RPC error message on failure', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'boom' } });
    const result = await updateOwnNome('Novo Nome');
    expect(result).toEqual({ success: false, error: 'boom' });
  });
});

describe('updateOwnPassword', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls auth.updateUser with the new password', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    const result = await updateOwnPassword('novaSenha123');
    expect(result).toEqual({ success: true, data: null });
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'novaSenha123' });
  });

  it('rejects a too-short password without calling the Auth API', async () => {
    const result = await updateOwnPassword('123');
    expect(result).toEqual({ success: false, error: 'Senha deve ter ao menos 6 caracteres' });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('returns the Auth error message on failure', async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: 'weak password' } });
    const result = await updateOwnPassword('novaSenha123');
    expect(result).toEqual({ success: false, error: 'weak password' });
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `npx vitest run src/features/meu-perfil/actions.test.ts`
Expected: FAIL — `./actions` does not exist.

- [ ] **Step 6: Write the actions**

Create `src/features/meu-perfil/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/features/auth/guards';
import type { ActionResult } from '@/lib/action-result';
import { updateNomeSchema, updatePasswordSchema } from './schemas';

export async function updateOwnNome(nome: string): Promise<ActionResult<null>> {
  await requireRole(['admin', 'gerencia']);
  const parsed = updateNomeSchema.safeParse({ nome });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_own_nome', { new_nome: parsed.data.nome });
  if (error) return { success: false, error: error.message };
  revalidatePath('/meu-perfil');
  return { success: true, data: null };
}

export async function updateOwnPassword(password: string): Promise<ActionResult<null>> {
  await requireRole(['admin', 'gerencia']);
  const parsed = updatePasswordSchema.safeParse({ password });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/features/meu-perfil/actions.test.ts`
Expected: PASS, all 6 tests.

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. (`supabase.rpc` on the generated `Database` type needs no extra typing work — `@supabase/supabase-js`'s `rpc` accepts an arbitrary function name string at the type level for a `Database` type that doesn't declare a `Functions` map; if `tsc` complains here, add `Functions: { update_own_nome: { Args: { new_nome: string }; Returns: void } }` to the `public` key in `src/lib/supabase/database.types.ts`, sibling to the existing `Tables` key.)

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260731000001_update_own_nome_rpc.sql src/features/meu-perfil/schemas.ts src/features/meu-perfil/actions.ts src/features/meu-perfil/actions.test.ts
git commit -m "feat: add update_own_nome RPC and meu-perfil actions"
```

---

### Task 8: Self-service profile page + nav item

**Files:**
- Create: `src/app/(app)/meu-perfil/page.tsx`
- Create: `src/features/meu-perfil/components/meu-perfil-screen.tsx`
- Create: `src/features/meu-perfil/components/meu-perfil-screen.test.tsx`
- Modify: `src/components/shared/sidebar.tsx`

**Interfaces:**
- Consumes: `updateOwnNome`/`updateOwnPassword` (Task 7); `getCurrentProfile` from `@/features/auth/guards` (already exists, returns `CurrentProfile | null`, guaranteed non-null for any page under `(app)/` because `src/app/(app)/layout.tsx:9` already redirects to `/login` otherwise).
- Produces: `MeuPerfilScreen({ profile: CurrentProfile })`. New `NAV_ITEMS` entry for `/meu-perfil`.

- [ ] **Step 1: Write the failing test**

Create `src/features/meu-perfil/components/meu-perfil-screen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { MeuPerfilScreen } from './meu-perfil-screen';

const mockUpdateOwnNome = vi.fn();
const mockUpdateOwnPassword = vi.fn();
vi.mock('../actions', () => ({
  updateOwnNome: (...args: unknown[]) => mockUpdateOwnNome(...args),
  updateOwnPassword: (...args: unknown[]) => mockUpdateOwnPassword(...args),
}));

const profile = { id: 'u1', nome: 'Ana Souza', email: 'ana@x.com', role: 'gerencia' as const };

describe('MeuPerfilScreen', () => {
  it('submits the nome form independently from the password form', async () => {
    mockUpdateOwnNome.mockResolvedValue({ success: true, data: null });
    const user = userEvent.setup();
    render(<MeuPerfilScreen profile={profile} />);

    const nomeInput = screen.getByLabelText('Nome');
    await user.clear(nomeInput);
    await user.type(nomeInput, 'Ana Nova');
    await user.click(screen.getByRole('button', { name: /salvar nome/i }));

    expect(mockUpdateOwnNome).toHaveBeenCalledWith('Ana Nova');
    expect(mockUpdateOwnPassword).not.toHaveBeenCalled();
    expect(await screen.findByText('Nome atualizado')).toBeInTheDocument();
  });

  it('submits the password form independently from the nome form', async () => {
    mockUpdateOwnPassword.mockResolvedValue({ success: true, data: null });
    const user = userEvent.setup();
    render(<MeuPerfilScreen profile={profile} />);

    await user.type(screen.getByLabelText('Nova senha'), 'novaSenha123');
    await user.click(screen.getByRole('button', { name: /salvar senha/i }));

    expect(mockUpdateOwnPassword).toHaveBeenCalledWith('novaSenha123');
    expect(mockUpdateOwnNome).not.toHaveBeenCalled();
    expect(await screen.findByText('Senha atualizada')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/meu-perfil/components/meu-perfil-screen.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `MeuPerfilScreen`**

Create `src/features/meu-perfil/components/meu-perfil-screen.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import type { CurrentProfile } from '@/features/auth/guards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateOwnNome, updateOwnPassword } from '../actions';

export function MeuPerfilScreen({ profile }: { profile: CurrentProfile }) {
  const [nome, setNome] = useState(profile.nome);
  const [nomePending, startNomeTransition] = useTransition();
  const [nomeMessage, setNomeMessage] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [passwordPending, startPasswordTransition] = useTransition();
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  function handleNomeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNomeMessage(null);
    startNomeTransition(async () => {
      const result = await updateOwnNome(nome);
      setNomeMessage(result.success ? 'Nome atualizado' : result.error);
    });
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMessage(null);
    startPasswordTransition(async () => {
      const result = await updateOwnPassword(password);
      setPasswordMessage(result.success ? 'Senha atualizada' : result.error);
      if (result.success) setPassword('');
    });
  }

  return (
    <div className="max-w-sm space-y-8">
      <h1 className="text-2xl font-semibold">Meu perfil</h1>
      <form onSubmit={handleNomeSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        {nomeMessage && <p className="text-sm">{nomeMessage}</p>}
        <Button type="submit" disabled={nomePending}>
          {nomePending ? 'Salvando...' : 'Salvar nome'}
        </Button>
      </form>
      <form onSubmit={handlePasswordSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Nova senha</Label>
          <Input
            id="password" type="password" minLength={6}
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {passwordMessage && <p className="text-sm">{passwordMessage}</p>}
        <Button type="submit" disabled={passwordPending}>
          {passwordPending ? 'Salvando...' : 'Salvar senha'}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/meu-perfil/components/meu-perfil-screen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Create the page**

Create `src/app/(app)/meu-perfil/page.tsx`:

```tsx
import { getCurrentProfile } from '@/features/auth/guards';
import { MeuPerfilScreen } from '@/features/meu-perfil/components/meu-perfil-screen';

export default async function MeuPerfilPage() {
  const profile = await getCurrentProfile();
  return <MeuPerfilScreen profile={profile!} />;
}
```

The `!` is safe here: `src/app/(app)/layout.tsx:9` already redirects to `/login` before this page can render if `getCurrentProfile()` returns `null`.

- [ ] **Step 6: Add the nav item**

In `src/components/shared/sidebar.tsx`:
- Add `UserCog` to the `lucide-react` import (alongside `ClipboardList, Folder, UserCheck, Users, ShieldCheck, PanelLeftClose, PanelLeftOpen, LogOut`).
- Add a new entry to `NAV_ITEMS`, after the `/perfis` entry:

```ts
  { href: '/meu-perfil', label: 'Meu perfil', roles: ['admin', 'gerencia'], icon: UserCog },
```

- [ ] **Step 7: Full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS, no new type errors.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/meu-perfil/page.tsx" src/features/meu-perfil/components/meu-perfil-screen.tsx src/features/meu-perfil/components/meu-perfil-screen.test.tsx src/components/shared/sidebar.tsx
git commit -m "feat: add Meu perfil page and nav item"
```

---

### Task 9: Show a friendly message when Google login fails

**Files:**
- Modify: `src/app/login/page.tsx`
- Create: `src/app/login/page.test.tsx`

**Interfaces:**
- Consumes: nothing new (uses the existing `?error=auth` query param already set by `src/app/auth/callback/route.ts:17`).
- Produces: nothing consumed by later tasks — this is a leaf UI fix.

- [ ] **Step 1: Write the failing test**

Create `src/app/login/page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LoginPage from './page';

vi.mock('@/features/auth/actions', () => ({ signInWithGoogle: vi.fn() }));
vi.mock('@/features/auth/components/login-form', () => ({ LoginForm: () => <div /> }));

describe('LoginPage', () => {
  it('shows a friendly message when redirected here with ?error=auth', async () => {
    render(await LoginPage({ searchParams: Promise.resolve({ error: 'auth' }) }));
    expect(
      screen.getByText('Não foi possível concluir o login com Google. Tente novamente.')
    ).toBeInTheDocument();
  });

  it('shows no error message when there is no error param', async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(
      screen.queryByText('Não foi possível concluir o login com Google. Tente novamente.')
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/login/page.test.tsx`
Expected: FAIL — `LoginPage` does not accept a `searchParams` prop yet, error text never renders.

- [ ] **Step 3: Update `LoginPage`**

Replace `src/app/login/page.tsx` entirely with:

```tsx
import { signInWithGoogle } from '@/features/auth/actions';
import { LoginForm } from '@/features/auth/components/login-form';
import { Button } from '@/components/ui/button';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-gradient-to-br from-[#0A1614] via-[#123330] to-[#1F5C52] p-12 lg:flex">
        <div className="flex items-center gap-3">
          <img src="/logo-mark.png" alt="" className="size-10" />
          <span className="font-heading text-2xl font-semibold text-white">Gestão de Perícias</span>
        </div>
        <p className="max-w-sm text-sm text-white/70">
          Cadastro e acompanhamento de perícias, processos, peritos e colaboradores em um só lugar.
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8 shadow-sm">
          <div className="flex items-center gap-2 lg:hidden">
            <img src="/logo-mark.png" alt="" className="size-8" />
            <h1 className="font-heading text-xl font-semibold">Gestão de Perícias</h1>
          </div>
          {error === 'auth' && (
            <p className="text-sm text-destructive">
              Não foi possível concluir o login com Google. Tente novamente.
            </p>
          )}
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

Only the function signature (`searchParams` prop + `await searchParams`) and the new `{error === 'auth' && ...}` block are new; everything else is unchanged from the current file.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/login/page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS, no new type errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/login/page.tsx src/app/login/page.test.tsx
git commit -m "feat: show a friendly message when Google login fails"
```

---

### Task 10: Google OAuth — live configuration (CONTROLLER-EXECUTED, no subagent)

This task has no code. It is walked through live with the user, the same way the Vercel/GitHub CI/CD setup was done earlier this project. Do not dispatch this to an implementer subagent — talk the user through each step interactively, one at a time, confirming each before moving to the next.

- [ ] **Step 1:** Guide the user to Google Cloud Console → create/select a project → OAuth consent screen → Credentials → "Create OAuth client ID" (Web application).
- [ ] **Step 2:** Add both Redirect URIs as "Authorized redirect URIs" on that one client:
  - `https://wpssipdxpfmvcamldpum.supabase.co/auth/v1/callback` (dev)
  - `https://ralyhgneesqpfijpvxii.supabase.co/auth/v1/callback` (produção)
- [ ] **Step 3:** In the Supabase dashboard for `wpssipdxpfmvcamldpum`: Authentication → Providers → Google → enable, paste Client ID + Client Secret. Save.
- [ ] **Step 4:** Repeat Step 3 for `ralyhgneesqpfijpvxii` — this is a dashboard toggle, not a database write, so it does not require the usual production-migration confirmation gate, but confirm with the user before doing it anyway since it is still a production-facing change.
- [ ] **Step 5:** Confirm `NEXT_PUBLIC_SITE_URL` is correct in `.env.local` (dev) and in the Vercel project's environment variables (production) — read, don't guess; ask the user to confirm the production value if not already known from this session.
- [ ] **Step 6:** Test "Entrar com Google" end to end on the dev server, then (only after the user confirms) on production.

No commit — nothing in git changes in this task.

---

### Task 11: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (existing + all tests added in Tasks 1-9).

- [ ] **Step 2: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed with no errors.

- [ ] **Step 3: Manual QA in the browser (dev server, dev Supabase project)**

Cover, at minimum:
- Admin creates a new user (Perfis → "Novo usuário") with role `gerencia` → the new user can log in with that e-mail/temporary password immediately (no approval step needed, since the admin already set the role).
- Attempt to create a user with a duplicate e-mail → friendly error shown, dialog stays open.
- "Esqueci minha senha" from the login page → submit an e-mail → generic confirmation message shown regardless of whether the e-mail exists.
- Using the Supabase dashboard's local Inbucket/email log (or the hosted project's logs) for the dev project, retrieve the actual reset link and open it → lands on `/redefinir-senha`, sets a new password successfully → can log in with the new password.
- `/redefinir-senha` visited directly while NOT authenticated → does not redirect to `/login` (per Task 2).
- Meu perfil: change own name → reflected after refresh; change own password → can log out and log back in with the new password.
- Sidebar shows "Meu perfil" for both `admin` and `gerencia` roles.
- Google login (only after Task 10 is complete): full round trip on the dev project.

Take note of any regression; if found, fix and re-verify before proceeding — do not proceed to Step 4 with a known-broken flow.

- [ ] **Step 4: Apply the migration to production — ASK THE USER FOR EXPLICIT LIVE CONFIRMATION FIRST**

Do not run this until the user has explicitly confirmed, in this conversation, that it's OK to modify the production database right now. Once confirmed:

```bash
npx supabase link --project-ref ralyhgneesqpfijpvxii
npx supabase db push
npx supabase migration list
```

Expected: `20260731000001` shows under both `local` and `remote`.

```bash
npx supabase link --project-ref wpssipdxpfmvcamldpum
```

Switch the CLI link back to dev immediately after — do not leave it pointed at production.

- [ ] **Step 5: Smoke-test production**

After the migration is live, ask the user whether to also do a light smoke test in production (e.g. one admin logging into Meu perfil and confirming the page loads) before considering the package done. Do not create or delete real production user accounts as part of this test without the user's separate go-ahead.
