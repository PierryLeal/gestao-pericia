# Gestão de Perícias

Gestão de Perícias is a SaaS web application for managing forensic expert
examinations (*perícias*). It lets an organization track municípios, processos
(legal cases), peritos (experts), colaboradores (staff), and the perícias that
tie them together, with role-based access control (admin vs. regular user)
enforced both in the UI and at the database level via Supabase Row Level
Security (RLS).

## Tech stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling/UI:** Tailwind CSS 4, Base UI, `class-variance-authority`, `lucide-react` icons
- **Backend/Data:** Supabase (Postgres, Auth, RLS) via `@supabase/ssr` and `@supabase/supabase-js`
- **Validation:** Zod
- **Testing:** Vitest, Testing Library (`@testing-library/react`, `jest-dom`, `user-event`), jsdom
- **Tooling:** ESLint, `tsx` (for scripts, e.g. the admin seed script)

## Running locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment variable template and fill in the values (see
   [Deployment runbook](#deployment-runbook) below for where these come
   from):

   ```bash
   cp .env.local.example .env.local
   ```

   `.env.local` requires four variables:

   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   SUPABASE_SERVICE_ROLE_KEY=
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

   Then open [http://localhost:3000](http://localhost:3000).

### Test admin credentials

Once the database has been migrated and seeded (see the runbook below), you
can sign in locally or on a deployed instance with:

- **Email:** `admin@admin.com`
- **Password:** `admin123`

## Running tests

```bash
npm run test
```

(`npm run test:watch` runs Vitest in watch mode.)

## Deployment runbook

This section is a step-by-step guide for a human operator to provision a
Supabase project, configure Google OAuth, seed the admin user, verify the app
locally, and deploy to Vercel. None of these steps can be automated by an
agent — they require your own Supabase, Google Cloud, and Vercel/GitHub
accounts and browser-based sign-in/consent.

### 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com), create a free account/organization, and create a new project (free tier).
2. Note the project's **Project URL** and **anon public key** (Project Settings → API), and the **service_role key** (same page — keep this secret, server-only).

### 2. Apply the database migrations

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This applies the three migration files in `supabase/migrations/` in order
(`init_schema`, `profile_trigger`, `rls_policies`). Verify in the Supabase
dashboard (Table Editor) that `profiles`, `municipios`, `processos`,
`peritos`, `colaboradores`, and `pericias` all exist, and that
`Authentication → Policies` shows the RLS policies.

### 3. Configure Google OAuth

1. In [Google Cloud Console](https://console.cloud.google.com/), create an OAuth 2.0 Client ID (Web application).
2. Set the authorized redirect URI to:

   ```
   https://<your-supabase-project-ref>.supabase.co/auth/v1/callback
   ```

3. Copy the Client ID and Client Secret into Supabase: Authentication → Providers → Google, paste them in, and enable the provider.

### 4. Set local environment variables and seed the admin user

Fill in `.env.local` (copied from `.env.local.example`):

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

Then run:

```bash
npm run seed:admin
```

Expected output: `Admin seeded: <uuid>`. Verify in Supabase Table Editor that
`profiles` has a row for `admin@admin.com` with `role = admin`.

### 5. Verify locally

```bash
npm run dev
```

Visit `http://localhost:3000`, sign in with `admin@admin.com` / `admin123`,
and confirm the perícias listing loads and the sidebar shows Perfis.

### 6. Deploy to Vercel

1. Push this repository to GitHub (create a new repo, `git remote add origin <url>`, `git push -u origin main`).
2. In [Vercel](https://vercel.com), import the GitHub repo (free Hobby plan).
3. Add the same four environment variables from Step 4, but set `NEXT_PUBLIC_SITE_URL` to the Vercel deployment URL (e.g. `https://gestao-pericia.vercel.app`).
4. Deploy.
5. Back in Supabase, go to Authentication → URL Configuration → Redirect URLs and add your Vercel domain, so `signInWithOAuth` is allowed to redirect there.
