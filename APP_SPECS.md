# Reflekt App Specs (Current Build)

Last updated: 2026-02-08
Project path: `journal-test`

## 1) Product Summary
Reflekt is a private journaling web app with:
- Supabase auth + per-user journal storage
- AI-assisted journaling prompts (with Ollama and local fallbacks)
- AI title suggestions (with Ollama and local fallbacks)
- Entry mood analysis and editable entries
- Dashboard with weekly reflection metrics and theme detection

## 2) Tech Stack
- Frontend: React 18 + Vite + React Router (`HashRouter`)
- Backend/data: Supabase (`@supabase/supabase-js`)
- AI/NLP:
  - Local sentiment scoring via `sentiment`
  - Ollama prompt/title generation via `/api/ollama` proxy or localhost fallbacks
- Styling: CSS (`styles.css`) + Heroicons
- Deploy target: GitHub Pages-style static build in `docs/`

## 3) Routing and Navigation
- `/` -> Home (journal composer + prompt engine + latest entries)
- `/dashboard` -> Protected dashboard (reflection + history)
- `/auth` -> Sign in / sign up / password reset
- Unknown routes redirect to `/`
- Router mode: hash routing (`#/...`) to support static hosting

## 4) Authentication Specs
Auth provider: Supabase.

Features:
- Sign in with email/password
- Sign up with first name, last name, email, password
- Password reset email flow
- Email verification notice after signup when session is not immediately created
- Remember-me toggle behavior in sign-in UI
- Protected dashboard route when no session

Session handling:
- App boots with `supabase.auth.getSession()`
- Subscribes to `onAuthStateChange`
- Logout via `supabase.auth.signOut()`

## 5) Data Model (from app usage)
Table used: `journal_entries`

Fields currently read/written by app:
- `id`
- `user_id`
- `title`
- `content`
- `mood`
- `themes`
- `created_at`
- `updated_at`
- (optional in updates) `mood_confidence`, `mood_tokens`

Sorting behavior:
- Entries are shown newest-first by timestamp (`created_at` / fallback `updated_at`)

## 6) Home Page Specs
Primary purpose: create entries quickly with AI support.

Features:
- Time-based greeting and theme (morning/afternoon/evening/night)
- Prompt card with shuffle button
- Entry textarea + optional title
- Voice recording for entry input (Web Speech API)
- Title suggestion button (local immediate + AI refinement)
- Draft autosave to localStorage
- Save entry flow with mood tagging
- Latest entries list with "Load past entries"

Prompt behavior:
- Uses local prompt candidates immediately
- Fetches AI prompts asynchronously from Ollama
- Keeps a pool and rotates prompts
- Tracks shown/used prompts to reduce repeats
- Keeps shuffle responsive (does not block on network)
- If exhausted for current context, user sees guidance message

Auto-title behavior:
- If title is blank or `untitled`, app generates local title suggestion and saves that
- Title suggestions are constrained to short chat-like length (2-5 words)

## 7) Prompt Engine Specs (`lib/aiPromptEngine.js`)
Design goals in current engine:
- Controlled-language prompts (avoid awkward/robotic phrasing)
- Domain-aware prompt templates (work, school, relationships, health, money, etc.)
- No raw weird phrase injection into prompt templates
- Safe validation and filtering for prompts
- Infinite-feeling rotation via curated templates + optional AI expansion

Core exported APIs used by app:
- `buildPromptContext(entries)`
- `generatePromptsWithOllama(context, signal)`
- `getPromptCandidates(entries)`
- `getContextualFallbackPrompts(entries)`
- `pickPrompt(exclude, entries, stats)`
- `pickPersonalizedFromPool(pool, exclude, stats)`
- `markPromptShown(stats, prompt)`
- `markPromptCompleted(stats, prompt, content)`
- `generateTitleSuggestionsLocal({ content, currentTitle })`
- `generateTitleSuggestionsWithOllama({ content, currentTitle, signal })`

Prompt generation strategy:
- Local template batch is always available
- AI expansion is optional and gated by signal quality
- Sensitive/low-signal modes avoid unstable expansions

Ollama endpoints attempted:
- `/api/ollama/api/generate` (via Vite proxy)
- `http://127.0.0.1:11434/api/generate`
- `http://localhost:11434/api/generate`

Model candidates:
- `gemma3:4b`
- `llama3.2:3b`

## 8) Title Engine Specs
Goals:
- Keep titles concise and natural
- Ground titles in real context (not random metaphor fragments)
- Tone-match entry (positive grounded vs heavy but non-dramatic)

Rules:
- Hard length limit: 2-5 words
- Meta-token cleanup (`prompt`, `model`, `cache`, etc.)
- Relevance scoring against detected domain/situation/tone
- Penalize quirky object-only titles not tied to main context

Example expected style:
- `Work Stress Check-In`
- `Tough Day at Work`
- `School Pressure Today`
- `Low Energy Tonight`

## 9) Dashboard Specs (`pages/Dashboard.jsx`)
Primary purpose: reflection and trend overview.

Features:
- Weekly reflection card
- Daily streak metric
- Average words per entry
- Top weekly themes (keyword + stored theme parsing)
- Week activity view with previous/next week controls
- Monthly grouped entry history
- Entry cards with edit/delete from dashboard

Theme detection:
- Uses a curated `THEME_LIBRARY`
- Honors explicit stored themes when present
- Also infers themes from title/content keyword matching

## 10) Entry Card Specs (`components/EntryCard.jsx`)
Features:
- View/edit/delete entry
- Inline title/content editing
- Date override editing (changes `created_at` while preserving time)
- Optional voice recording during edit
- Mood analysis on save using `sentiment` package
- Mood badges: Great / Good / Okay / Bad / Awful

## 11) Search Specs
Implemented in app header for signed-in users:
- Search title + content by substring
- Returns up to 24 results
- Escape key and outside click close behavior
- Mobile and desktop behavior differ (desktop open by default)

## 12) Local Storage Keys (Current)
Per-user and/or context-aware keys include:
- `reflekt_draft_<userId|anon>`
- `reflekt_prompt_stats_<userId|anon>`
- `reflekt_used_prompts_<userId|anon>`
- `reflekt_shown_prompts_<userId|anon>_<contextFingerprint>`
- `reflekt_ai_prompts_v11_<userId|anon>_<YYYY-MM-DD>_<contextFingerprint>`
- `reflekt_prompt_engine_reset_v11_<userId|anon>`
- `reflekt_first_entry_done`

Cache behavior:
- Legacy AI prompt caches are cleaned up
- Prompt engine reset key performs one-time v11 reset of relevant prompt caches/stats

## 13) Environment and Config
Required env vars:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Build/deploy config:
- Vite base path: `/journal-test/`
- Build output directory: `docs`
- Homepage in `package.json`: `https://marm-crypt.github.io/journal-test/`

## 14) Deployment Specs
Build command:
- `npm run build`

Output:
- Static bundle written to `docs/`

Expected hosting setup:
- Repo branch: `main`
- Served directory: `/docs` (GitHub Pages style)

## 15) Known Operational Notes
- Ollama can timeout/fail; app falls back to local prompt/title generation
- Prompt system avoids blocking UX while network/model generation runs
- Build currently warns about JS chunk size > 500kB; app still builds and runs

## 16) Suggested Ongoing Tracking Process
When you change behavior, update this file in the same PR/commit under:
- Route changes
- Prompt/title logic changes
- LocalStorage key/version changes
- Supabase schema field changes
- Deployment path/settings changes
