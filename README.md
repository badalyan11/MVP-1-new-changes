# Life Journal

A private photo-and-story album you grow over time, or build from one experience.
Albums can be shared with the people who were there.

- **Keep adding over time**: a journal you add small memories to (`+ Add Memory`).
- **Create from an experience**: upload many photos into the album's Photo Library, then arrange them into pages.
- Photos belong to the **album**, not to a page. Remove a photo from a page and the original stays in the library.
- Nothing on a page is required: photos, words, title and date are all optional.
- Real accounts (Supabase), private by default, invite people by link.
- Optional AI writing help that never invents facts (Cloudflare Worker → Anthropic).

React 18 · Vite · TypeScript · Tailwind · Supabase (auth, Postgres, Storage) · Cloudflare Workers.

## Run it on your computer

Needs Node 18+.

```bash
npm install
npm run dev
```

Open the address it prints (usually http://localhost:5173).

With no configuration the app runs in **local mode**: a "Continue" button replaces sign-in and all data
stays in this browser. To use real accounts, do the Supabase setup below and copy `.env.example` to `.env`.

## 1. Supabase setup (accounts, database, photo storage)

1. Create a free project at https://supabase.com.
2. **SQL Editor → New query**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql), click **Run**.
   (It is safe to run again later.) This creates the tables, the privacy rules (row-level security), the
   invitation functions and the private `album-photos` storage bucket.
3. **Project Settings → API**: copy the *Project URL* and the *anon public* key.
4. **Authentication → URL Configuration**: set *Site URL* to your Cloudflare address, and add
   `https://YOUR-SITE/**` and `http://localhost:5173/**` to *Redirect URLs*. Password reset emails return to
   `/reset-password`.
5. **Authentication → Providers → Email**: keep it on. Turn "Confirm email" on or off as you like.

## 2. Cloudflare deploy

The repo deploys with Cloudflare Workers Builds running `npx wrangler deploy` (see `wrangler.jsonc`).
In your Cloudflare project → **Settings**:

- **Build variables** (used while building): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
  These are baked into the site at build time, so **re-deploy after changing them**.
- **Secrets / Variables** (used by the Worker at run time):
  - `ANTHROPIC_API_KEY` (secret) enables AI writing. Without it the app still works; the writing helper
    just tidies spelling/spacing and says so.
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY` so the Worker can check that the person asking is signed in.
  - `AI_MODEL` (optional) overrides the default model.

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server (local mode, or cloud if `.env` is set) |
| `npm run build` | Type-check and build into `dist/` |
| `npm run dev:worker` | Build, then run the app + AI Worker together on :8788 (needs `.dev.vars`) |
| `npm run test:db` | Runs the privacy rules against a real in-memory Postgres (PGlite) |
| `npm run typecheck:worker` | Type-check the Worker |

## How it fits together

```
src/
  pages/        screens (My journals, album reader, editor, Manage pages, Add memory, settings, sign in…)
  components/   page renderer, photo library, flip-book pieces, share modal, editor canvas
  context/      AuthContext (who is signed in), AlbumContext (album state, undo/redo, autosave)
  lib/store/    one interface, two backends: supabaseStore (cloud) and localStore (browser only)
  lib/          layouts, crop math, page styles, AI client, helpers
worker/index.ts      POST /api/ai (writing help)
supabase/schema.sql  tables, security rules, invitation functions, storage rules
supabase/tests/      privacy-rule tests
```

Page coordinates are percentages of the page, so a layout looks the same on any screen. Crops are stored as
zoom + position and never alter the original photo.
