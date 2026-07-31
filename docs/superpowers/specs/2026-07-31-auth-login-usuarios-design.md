# Autenticação e Gestão de Usuários (Pacote B) — Design

**Contexto:** o app hoje só tem login por e-mail/senha (funcional) e um botão "Entrar com Google" que dá erro (provedor nunca foi habilitado no Supabase). Não existe nenhum jeito de criar uma conta nova a partir do app — o único usuário existente foi criado por um script de linha de comando (`scripts/seed-admin.ts`). Também não existe "esqueci minha senha" nem uma tela onde o próprio usuário troque nome/senha. Este spec cobre essas 4 lacunas. Foco principal, por pedido do usuário: login (Google + criação de conta).

## Escopo

1. Login com Google — habilitar de verdade (configuração externa + pequeno ajuste de tratamento de erro).
2. Admin cria usuário por e-mail/senha diretamente no app (tela Perfis).
3. Esqueci minha senha (e-mail padrão do Supabase, sem SMTP customizado).
4. Configurações de perfil — próprio usuário troca nome e senha.

Decisões já validadas com o usuário: manter Google OAuth funcionando E manter criação por e-mail/senha (as duas coexistem); admin-criado usuário recebe senha temporária definida pelo próprio admin (não consome cota de e-mail); fluxo de reset de senha usa o envio padrão do Supabase (2 e-mails/hora, cota compartilhada por todo o projeto — aceitável para o volume desta equipe).

## 1. Login com Google

O código de app já existe e está correto: `signInWithGoogle` (`src/features/auth/actions.ts:33-43`) chama `supabase.auth.signInWithOAuth({ provider: 'google', ... })`, e `src/app/auth/callback/route.ts` troca o `code` pela sessão. O erro atual (`Unsupported provider: provider is not enabled`) é 100% configuração externa, não código:

**Passos manuais (feitos junto com o usuário, fora do código, nos dois projetos Supabase):**
1. Google Cloud Console → criar um projeto (ou usar um existente) → tela de consentimento OAuth → criar credenciais "OAuth client ID" do tipo "Web application".
2. Redirect URI autorizada: `https://<project-ref>.supabase.co/auth/v1/callback` — uma para o projeto dev (`wpssipdxpfmvcamldpum`) e outra para produção (`ralyhgneesqpfijpvxii`), já que cada projeto Supabase tem sua própria URL de callback. Pode ser dois Client IDs separados (um por ambiente) ou um único Client ID com as duas Redirect URIs autorizadas — mais simples usar um único.
3. No painel do Supabase de cada projeto: Authentication → Providers → Google → habilitar, colar Client ID e Client Secret.
4. Conferir que `NEXT_PUBLIC_SITE_URL` (usado em `redirectTo`) está correto em cada ambiente (`.env.local` para dev, variável de ambiente da Vercel para produção) — já existe, só validar o valor.

**Mudança de código (pequena):** hoje `src/app/auth/callback/route.ts` redireciona para `/login?error=auth` quando a troca de código falha, mas `login/page.tsx`/`LoginForm` nunca leem esse parâmetro — o erro é descartado silenciosamente. Ajuste: `LoginPage` passa a receber `searchParams: Promise<{ error?: string }>` (mesmo padrão async já usado em `src/app/(app)/page.tsx`) e, se `error === 'auth'`, renderiza `"Não foi possível concluir o login com Google. Tente novamente."` acima do botão Google.

## 2. Admin cria usuário por e-mail/senha

**Novo cliente Supabase com service-role key**, isolado num arquivo próprio para deixar claro que é privilegiado e nunca deve ser importado em código client-side:

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

`SUPABASE_SERVICE_ROLE_KEY` não tem prefixo `NEXT_PUBLIC_`, então o Next.js já nunca inclui esse valor no bundle do navegador; `createAdminClient` só é chamado de dentro de server actions (`'use server'`), nunca de um componente client.

**Schema novo** (`src/features/perfis/schemas.ts`, adicionado ao arquivo existente):
```ts
export const createUserSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
  role: z.enum(roleOptions),
});
```

**Nova server action** (`src/features/perfis/actions.ts`), seguindo o mesmo padrão de `scripts/seed-admin.ts` (criar o usuário no Auth, depois ajustar a linha que o trigger `handle_new_user` já inseriu em `profiles` com `role='pendente'`):
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
`requireRole(['admin'])` roda antes de qualquer coisa — só admin chega perto da service-role key. Mensagens de erro do Supabase (ex.: e-mail já cadastrado) já vêm em texto razoável; não precisa de mapeamento especial como o `23503` das exclusões.

**UI:** botão "Novo usuário" na tela Perfis (`src/app/(app)/perfis/page.tsx` + um novo `PerfisScreen` client component, já que hoje a página é só `listProfiles()` + `<PerfisTable>` sem estado nenhum — precisa de `useState` para abrir/fechar o dialog, no mesmo padrão de `PeritosScreen`). Dialog com formulário (`CreateUserForm`, novo componente): campos Nome, E-mail, Senha, e um `Select` de Perfil com `roleOptions` (mesmo componente/estilo já usado em `PerfisTable`). Ao salvar: `toast.success('Usuário criado')`, fecha o dialog, `router.refresh()`.

## 3. Esqueci minha senha

**Duas páginas novas**, ambas fora do grupo `(app)` (não precisam de sidebar/role aprovada):

- `src/app/esqueci-senha/page.tsx` — formulário com um campo de e-mail. Server action nova `requestPasswordReset` (`src/features/auth/actions.ts`):
  ```ts
  export async function requestPasswordReset(email: string): Promise<void> {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/redefinir-senha`,
    });
  }
  ```
  A action **não retorna erro nem sucesso diferenciado** — a página sempre mostra a mesma mensagem ("Se esse e-mail existir, enviamos um link de recuperação.") depois de chamar a action, para não revelar quais e-mails têm conta no sistema.

- `src/app/redefinir-senha/page.tsx` — para onde o link do e-mail leva. O Supabase já autentica uma sessão de recuperação temporária ao abrir o link (via o `#access_token=...&type=recovery` no fragmento da URL — isso nunca chega ao servidor, só existe no navegador). Por isso essa troca de senha **não pode** ser uma server action normal (o `createClient()` de `@/lib/supabase/server`, baseado em cookies, não veria essa sessão a tempo); precisa ser uma chamada client-side, usando `createClient()` de `@/lib/supabase/client` (já existe no projeto, criado para o SSR do Supabase, mas hoje não é importado em lugar nenhum — será o primeiro uso). Um novo componente `'use client'` (`redefinir-senha-form.tsx`) chama `supabase.auth.updateUser({ password })` direto no navegador e redireciona para `/login` com uma mensagem de sucesso.

**Link na tela de login:** `LoginForm` ganha um link "Esqueci minha senha" abaixo do campo de senha, apontando para `/esqueci-senha`.

**Middleware (`src/features/auth/route-guard.ts`):** `/esqueci-senha` entra em `PUBLIC_PATHS` (mesmo tratamento de `/login`). `/redefinir-senha` precisa de uma regra própria: como o link de recuperação autentica a pessoa com QUALQUER perfil que ela já tenha (inclusive `pendente`, num caso raro de conta Google ainda não aprovada que também tem senha), a rota precisa ficar acessível **independente do status de aprovação** — senão a pessoa é redirecionada para `/pendente` antes de conseguir trocar a senha:
  ```ts
  const RECOVERY_PATH = '/redefinir-senha';

  export function resolveRedirect({ path, isAuthenticated, role }: RouteGuardInput): string | null {
    if (path.startsWith(RECOVERY_PATH)) return null;
    const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));
    // ...resto igual, sem mudança
  }
  ```

## 4. Configurações de perfil (nome e senha)

Nova feature `src/features/meu-perfil/` (nome próprio, diferente de `perfis` que é a tela administrativa de todos os usuários).

**Segurança do RLS:** hoje só `admin` pode dar UPDATE em `profiles` (`profiles_update_admin`). Não dá pra simplesmente adicionar uma policy `id = auth.uid()` para updates — como o Supabase expõe a tabela via REST/RPC diretamente para qualquer cliente autenticado (não só através das server actions deste app), uma policy de UPDATE que só filtra por `id = auth.uid()` sem restringir *quais colunas* mudam deixaria qualquer usuário autenticado se autopromover a `admin` com uma chamada HTTP direta. Em vez disso, uma função `SECURITY DEFINER` que só altera `nome`, chamada via RPC — mesmo padrão já usado em `current_role()` nesse projeto:

```sql
-- supabase/migrations/20260731000001_update_own_nome_rpc.sql
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
Aplicada nos dois projetos (dev e produção, com confirmação explícita antes de tocar produção — mesma regra já seguida no Pacote A).

**Schemas** (`src/features/meu-perfil/schemas.ts`):
```ts
export const updateNomeSchema = z.object({ nome: z.string().min(1, 'Nome é obrigatório') });
export const updatePasswordSchema = z.object({ password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres') });
```

**Actions** (`src/features/meu-perfil/actions.ts`):
```ts
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
`updateOwnPassword` não toca a tabela `profiles`, então não depende da RPC acima — `supabase.auth.updateUser` já funciona hoje sem exigir a senha atual (a sessão logada já prova identidade).

**Página:** `src/app/(app)/meu-perfil/page.tsx` (server component) chama `getCurrentProfile()` (já existe em `src/features/auth/guards.ts`, cacheado por request) e renderiza `<MeuPerfilScreen profile={profile} />` com dois formulários independentes (trocar nome / trocar senha), cada um com seu próprio estado de pending/erro via `useTransition`, no mesmo padrão já usado em `PerfisTable`.

**Nav:** novo item em `NAV_ITEMS` (`src/components/shared/sidebar.tsx`), visível para `admin` e `gerencia` (os únicos que chegam à sidebar — `pendente` nunca sai de `/pendente`):
```ts
{ href: '/meu-perfil', label: 'Meu perfil', roles: ['admin', 'gerencia'], icon: UserCog },
```

## Testes

- `route-guard.test.ts`: casos novos para `/esqueci-senha` (público) e `/redefinir-senha` (sempre acessível, inclusive com `role: 'pendente'` ou `role: null`).
- `perfis/actions.test.ts`: `createUser` sucesso (mocka `createAdminClient`), erro do Auth (e-mail duplicado), erro de validação (senha curta).
- `meu-perfil/actions.test.ts`: `updateOwnNome` sucesso/erro (mocka `.rpc`), `updateOwnPassword` sucesso/erro (mocka `.auth.updateUser`).
- `auth/actions.test.ts`: `requestPasswordReset` chama `resetPasswordForEmail` com o e-mail e `redirectTo` corretos.
- Componentes: `CreateUserForm` (validação client + submit), `MeuPerfilScreen` (dois formulários independentes), página de esqueci-senha (sempre mostra a mensagem genérica após submit).
- `login-form.test.tsx`: cobrir o novo link "Esqueci minha senha".

## Fora de escopo (não mexe)

- Trocar o próprio e-mail (fica só nome + senha, como pedido).
- SMTP customizado — fica para depois, se o limite de 2 e-mails/hora virar problema real.
- Qualquer novo papel além de `pendente`/`gerencia`/`admin`.
- Editar/excluir usuários existentes além de trocar o `role` (já existente) — sem exclusão de conta nesta rodada.
- Excel export de Perícias — pacote separado, ainda não iniciado.
