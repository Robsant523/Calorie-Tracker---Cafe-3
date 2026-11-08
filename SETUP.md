# Supabase setup — Phase 1

CalFuel is a plain HTML/CSS/JavaScript web app. It currently saves goals, food entries, and history in browser `localStorage`. Phase 1 adds the Supabase dependency, public configuration, and a shared client module. The existing UI still uses local storage; sign-up, database tables, and cloud sync arrive in later phases.

## 1. Create your project manually

1. Sign in to the [Supabase dashboard](https://supabase.com/dashboard) and create a project in your organization.
2. Choose a project name and region, set a strong database password, and wait for provisioning. Keep the database password in your password manager; this browser app does not need it.
3. Open the project's **Connect** dialog or **Settings → API Keys**. Copy the project URL and public key. Use the modern **publishable** key (`sb_publishable_...`) where available, or the legacy **anon** key. The environment variable below is named `PUBLIC_SUPABASE_ANON_KEY` for compatibility and accepts either public format.
4. Never copy a **secret** (`sb_secret_...`), **service_role** key, JWT signing secret, or database connection string into this app. The build rejects secret/service-role keys supplied in the public-key field.

Supabase's [API key guide](https://supabase.com/docs/guides/getting-started/api-keys) explains these key types. Public keys are visible in the downloaded client bundle; environment variables prevent hardcoding configuration in source, but do not make browser values secret. User access will be enforced by RLS in Phase 2.

## 2. Enable email authentication

In **Authentication → Sign In / Providers**, open **Email** (the navigation may also say **Providers**). Enable email/password sign-in and keep **Confirm email** enabled. Set the minimum password length to at least **8** to match the validation planned for Phase 3. Save changes.

See [Supabase email/password authentication](https://supabase.com/docs/guides/auth/passwords). Email sign-in is normally enabled by default, but verify this in your own project.

## 3. Set the redirect URLs

In **Authentication → URL Configuration**:

- While developing locally, set **Site URL** to `http://localhost:4173/`.
- Add `http://localhost:4173/` to **Redirect URLs**. Add `http://127.0.0.1:4173/` only if you also open the app with that address.
- Before deploying auth, set **Site URL** to the actual production URL and add that exact URL to **Redirect URLs**. If you keep the existing CalFuel host, use `https://calfuel-cafe3.robertsantiago0523.chatgpt.site/`.
- Keep the local URLs for development. Use exact production URLs rather than a broad wildcard. Phase 3 will send email confirmations back to the app's root URL; no `/auth/callback` route is implemented in Phase 1.

The Site URL is Supabase's default confirmation destination. See [redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls).

## 4. Configure your local app

Requirements: Node.js 22 or newer, npm, and Python 3 for the existing static preview server.

From the project directory:

```bash
cd "/Users/robertsantiago/Documents/Codex/2026-09-12/using/outputs/CalFuel"
npm ci
cp .env.example .env
```

Skip the `cp` command if `.env` already exists so you keep your current values. Edit `.env` in your editor and fill in:

```dotenv
PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

These are placeholders, not usable credentials. `.env` and `.env.*` are ignored by Git, except the empty `.env.example`. Do not paste keys into source files or commit the generated `dist/lib/` bundle. Shell/CI environment variables take precedence over `.env`. Only the two explicitly named public values are included in the bundle.

## 5. Verify Phase 1

```bash
npm run check:supabase
npm test
npm start
```

1. `check:supabase` should report valid public configuration without printing either value. This is a local format check, not a live connection or authentication test.
2. Open `http://localhost:4173/`. The existing local tracker should work normally. There are no sign-up/log-in buttons yet.
3. Confirm `http://localhost:4173/.env` and `http://localhost:4173/.git/config` return **404**. The server now serves only `dist/`, not the repository root.
4. `git check-ignore .env dist/lib/supabase.mjs` should list both paths. `git status --short` must not show your `.env`.
5. Stop the server with Ctrl+C. Restart `npm start` after changing `.env` or source files so the output is rebuilt. The menu refresh commands synchronize menu data into the served output directly.

If both values are blank, `npm run build` still produces a working local tracker. `check:supabase` fails with setup instructions, and requesting the client throws an actionable configuration error. Supplying only one value or a privileged key fails the build.

The generated module is `dist/lib/supabase.mjs`, built from `lib/supabase.mjs`. Future auth and data modules should import `getSupabaseClient()` from that shared module instead of calling `createClient()` again. It returns one lazily created client with session persistence, token refresh, and URL session detection enabled. Phase 3 will attach the auth listener and connect it to the UI.

## Building for hosting

Set the same two public environment variables in the build environment and run `npm ci` followed by `npm run build`. Deploy only the generated `dist/` directory. The small esbuild step bundles the npm SDK; existing app scripts remain plain JavaScript. The build copies an explicit list of public assets and the menu data, excluding `.env`, Git metadata, and source tooling. Never deploy the repository root or use the old root-level Python server after adding `.env`.

`npm run preview` serves the last completed build without rebuilding. `npm start` builds first. `npm run refresh-menu` now refreshes the source/served snapshots and commits and pushes only those four files to `origin/main`. For local testing without publishing to GitHub, use `npm run refresh-menu:local`. See README.md for Git prerequisites and hosting deployment behavior. Generated output must be rebuilt for each environment and must not be published after a failed build.

## Phase boundary

Stop here after verifying setup. Phase 2 adds the SQL schema and RLS. Phase 3 adds email/password authentication. Phase 4 connects entries and goals to cloud storage. Phase 5 offers migration of existing browser data. Phase 6 verifies the completed integration with two accounts. No real Supabase project, schema, user, or data has been created by these Phase 1 changes.
