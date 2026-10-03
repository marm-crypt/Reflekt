# Reflekt Demo

Reflekt is a React journaling app built as a continuation of the Reflekt concept. This portfolio demo includes journaling prompts, local draft saving, mood analysis, editable entries, search, and a reflection dashboard.

The app can run in two modes:

- Demo mode: entries are saved to this browser with `localStorage`.
- Supabase mode: auth and entries use a Supabase project when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured.

## Local Development

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

## Portfolio Demo Build

Use this for GitHub + Render Static Sites:

```bash
npm run build:demo
```

This builds the app into `docs/` with `VITE_DEMO_MODE=true`, so the demo works without Supabase.

## Render Static Site Settings

If creating the Render site manually:

```txt
Build command: npm ci && npm run build:demo
Publish directory: docs
Environment variable: VITE_DEMO_MODE=true
SPA rewrite: /* -> /index.html
```

If using Render Blueprint, this repo includes `render.yaml`.

## Optional Supabase Mode

Copy `.env.example` to `.env` and fill in:

```txt
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_DEMO_MODE=false
```

The app expects a `journal_entries` table with fields used by the UI: `id`, `user_id`, `title`, `content`, `mood`, `themes`, `created_at`, and `updated_at`.
