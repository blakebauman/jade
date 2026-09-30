# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Subjects: **Spelling** and **Math**, behind one subject hub (`/play/$childId`). They share sessions, per-answer saving, the offline queue, resume, Leitner review, stars/streaks/badges and the voice.

Jade Learning is a spelling bee and math practice app for 8–11 year olds. Spelling leads; the lines below describe it.
- **Who uses it:** a parent loads word lists; a child plays on a laptop or an iPad.
- **The loop:** hear the word, ask for the definition, a sentence or the origin, then spell it tile by tile, with feedback on every letter.
- **Missed words:** they come back through spaced review until they stick.

It runs as one Cloudflare Worker that serves a React SPA and a Hono API.

## Commands

```bash
pnpm dev                 # Apply local D1 migrations, then Vite + Worker on http://localhost:5190
                         # (5190, not 5173: another local project owns 5173 on this machine).
                         # Workers AI (TTS, OCR, sentences) always calls Cloudflare, even in dev, so
                         # `wrangler login` is required and usage is billed (fractions of a cent).
pnpm test                # All unit tests: core (vitest), api (vitest-pool-workers + miniflare D1/R2), web (jsdom)
pnpm test:e2e            # Playwright: laptop (Chromium), iPad Pro 11 (WebKit), iPhone 15. Starts `pnpm dev` if needed.
pnpm test:e2e:offline    # Opening the app offline, against a production build (vite preview on 4173, Chromium)
pnpm --filter @jade/api test -- -t "tts"   # One API test by name
pnpm typecheck           # tsc across packages
pnpm check               # Biome format + lint (write)
pnpm db:generate         # Drizzle: schema.ts → new SQL migration in packages/db/migrations
pnpm db:migrate:local    # Apply migrations to local D1 (miniflare state in apps/web/.wrangler)
pnpm db:migrate:remote   # Apply to the real D1 database
pnpm run deploy          # NOT `pnpm deploy`; pnpm's built-in shadows it (same as memoturn)
pnpm --filter @jade/web cf-typegen   # Regenerate worker-configuration.d.ts after editing wrangler.jsonc
```

## Architecture

```
apps/web            Vite 8 + TanStack Router (file routes, SPA) + @cloudflare/vite-plugin + vite-plugin-pwa
  src/worker.ts     Worker entry: `api.fetch`. The asset layer serves the SPA; only /api/* and /health reach the Worker
  src/routes        _authed/ (session gate) → profiles, parent/*, play/$childId/{index,round.$listId.$mode,results}
  src/lib           speaker.ts (audio), round.ts (zustand game state), offline.ts (Dexie queue), feedback.ts, import.ts
packages/api        Hono app: auth (Better Auth), children, lists, words, tts, import (OCR), sessions, parent
packages/core       Pure logic shared by client and server: gradeAttempt (letter alignment), Leitner SRS,
                    stars, streaks, badges, syllables, parseWordList, zod schemas, grade packs
packages/db         Drizzle sqlite schema for D1 + migrations (wrangler reads migrations_dir from here)
packages/ui         Tile/Square/Pips/KidTile components + the design tokens (src/styles/index.css)
packages/tsconfig   base / worker / library / spa presets (copied from memoturn)
```

### Bindings (`apps/web/wrangler.jsonc`)

| Binding | Type | Holds |
|---|---|---|
| `DB` | D1 | All data |
| `AUDIO` | R2 | TTS cache |
| `AI` | Workers AI | Speech, OCR, sentences |
| `RATE_LIMIT` | Rate limiter | Per-parent limits on the Workers AI calls |

Secrets:
- `BETTER_AUTH_SECRET` is required.
- `MW_KEY` is optional: a Merriam-Webster Elementary key.

### Key flows

**TTS** (`GET /api/tts?text&kind&voice`):
1. The key is `sha256(version|voice|kind|text)` and the object lives at `tts/{voice}/{kind}/{hash}.mp3` in R2.
2. On a miss, the Worker calls `@cf/deepgram/aura-2-en`, which returns MP3.
3. Responses are `immutable`, and the service worker caches them CacheFirst, so a list played once replays offline.
4. The client falls back to `speechSynthesis` on any error. Bump `CACHE_VERSION` in `routes/tts.ts` to invalidate every clip.

**Word info** (`GET /api/words/:word`):
1. Checks the global `word_info` cache.
2. Tries Merriam-Webster (if `MW_KEY` is set), then dictionaryapi.dev (2.5s timeout), then Workers AI `llama-3.1-8b-instruct-fast` with JSON schema output.
3. The AI sentence must contain the word or it is retried once.
4. Definitions have the word masked.
5. Rows missing a sentence or definition are retried after 24h.

**OCR** (`POST /api/import/ocr`):
- The client downscales to ≤1600px JPEG, which also converts iPad HEIC.
- The Worker runs `@cf/meta/llama-4-scout-17b-16e-instruct` over an `image_url` data URL.
- It returns candidate words only; the photo is never stored, and the parent confirms before saving.

**Math:**
- The engine lives in `packages/core/src/math/` and is pure and seeded:
  - `generate(skill, level, rng)` for the skills mul, div, addsub, mixed, fractions, decimals and problems, each at levels 1–5.
  - `checkAnswer` accepts equivalent fractions and decimals; "simplify" tasks require the simplest form.
  - `adaptLevel` moves up after 5 of 6 first-try and mostly-fluent answers, and down after 2 misses in the last 4.
  - `buildMathRound` builds the round. Word problems are authored templates in `problems.ts`.
- Attempts reuse the `attempts` table. `word` is the problem key (`m:mul:7x8`), and `skill` and `level` are set. Only repeatable facts (`m:mul:`, `m:div:`) get Leitner rows. Math keys are never passed through `normalizeWord`.
- The `skill_levels` table holds the level per child and skill. It's updated on math finish (`lib/math.ts`), and parents can set it with `PUT /api/children/:id/math-level`.
- `GET /api/children/:id/progress` keeps the spelling fields at the top level (excluding `m:` keys) and adds `math` (levels, factsDue, factBoxes, trouble).
- The UI lives in `routes/_authed/play/$childId/math/`: the topic picker, and `$topic` for the round (`mathreview` = due facts).
  - The on-screen `Keypad` is the only input. There is never a text field, so the iPad keyboard never opens.
  - Persisted state lives in `lib/mathRound.ts` (`jade.mathround`).

**Rounds (saved as they're played):**
- The client owns the round in the `useRound` zustand store, persisted to localStorage (`jade.round`) so an interrupted round can be continued ("Pick up where you left off" on the play home, `?resume=true`).
- `POST /api/sessions` runs on the first tap. `POST /api/sessions/:id/attempts` runs after **every** word and moves Leitner boxes, stars, words spelled, streak and badges immediately. `POST /api/sessions/:id/finish` closes the round, either at the end or when the speller taps ✕ ("Stop here? Your answers are saved"), and scores it from all stored attempts.
- Everything is idempotent. Attempts are keyed by client id, and only newly inserted rows count (`recordAttempts` uses `insert … on conflict do nothing returning`), so replays and a finish that re-sends everything never double-count. Totals are incremented in SQL.
- Writes go through an ordered op queue in IndexedDB (`lib/offline.ts`, Dexie `ops` table). Offline, they wait and flush in order on `online`. A 4xx other than 429 drops the op.
- Learn mode records attempts but never moves Leitner boxes.
- Offline, including opening the installed app with no connection:
  - `lib/device.ts` remembers the last confirmed user in localStorage (`jade.user`). `_authed` and `/` use it when the session check can't reach the server; a 401/403 always wins.
  - The service worker's `jade-data` cache (NetworkFirst) holds children, lists, list words, progress, `/api/parent` and word info. The spelling home prefetches every list's words.
  - Round loaders use `roundProgress` (fresh, else cached).
  - Sign-out forgets the device (user, `jade-data`, query cache) only after the server confirms it; offline it says it couldn't.
  - `pnpm test:e2e:offline` checks all this against a production build on port 4173. The build copies `.dev.vars` into `dist/jade/`, so the preview trusts `BETTER_AUTH_URL` from it (5190).

**Parent PIN** (optional, `parent_settings.pin_hash`):
- It's a speed bump for kids, not a security boundary. Only `POST /api/parent/verify-pin` checks it; the parent APIs don't.
- The unlock lives in sessionStorage (`jade.parent-unlocked`, `lib/parentLock.ts`) with the user id and the time of the last tap or key press.
- It locks again when the parent area unmounts (going to Practice), on sign-out (`forgetDevice`), in a new tab, and after `pinRelockMinutes` idle. The parent picks 1, 5, 15 or 30 minutes (default 5) in Settings.
- The gate fails closed: nothing shows until `/api/parent` answers, and if it can't be read the gate asks for the PIN.
- It can never strand a family: "Forgot the PIN?" takes the account password (`POST /api/parent/verify-password`) and lands on Settings (`?newPin=true`) to choose a new one, and the gate has its own Sign out. Setting a PIN asks for it twice.

**This week (parent lists):**
- `word_lists.archived_at` marks a past list; `list_children` says which kids a list is for (no rows: everyone, including kids added later). `PATCH /api/lists/:id` takes `archived` and `childIds`; only the parent's own kids are ever attached.
- `GET /api/lists` returns `archived`, `childIds` and `perChild` (each kid's last play and mastered count). The kids' Spelling screen filters with `listIsFor` (`lib/api.ts`), treating summaries cached before this change as current and for everyone.
- Archiving never touches Review: review is per child from `word_progress`, not per list.

**SRS and streaks:**
- SRS is driven by first-try correctness. A new word spelled right starts in box 2, due tomorrow; a miss goes to box 1, due now.
- Learn mode never moves boxes.
- Streaks use the family's local day, sent by the client as `day` (`YYYY-MM-DD`).

## Code style

- Biome: tabs, 140 columns, double quotes. Imports carry `.ts`/`.tsx` extensions (`allowImportingTsExtensions`).
- Shared versions live in the `pnpm-workspace.yaml` catalog; packages use `"catalog:"`.
- Web imports use `#/…` (package `imports` field) for `apps/web/src`.
- D1 limits a statement to 100 bound parameters, so chunk multi-row inserts. See `insertWordsStatements` (5 cols × 15 rows) and the attempt insert (10 cols × 9 rows).
- Never name endpoints with a trailing "z" (`/health`, not `/healthz`).

## Design

Read `PRODUCT.md` (product truth) and `DESIGN.md` (the visual system) before any UI work. The world is **letter tiles on a jade board**.

**Colour laws** hold everywhere and never mean anything else:
- marigold = right
- coral = wrong letter
- sky = missing letter
- stone = extra letter

**Rules:**
- Feedback colour goes on tile edges and corner marks. Letter ink stays dark.
- No emoji as icons; use lucide.
- Kids are identified by their initial tile plus a chosen point value.

**iPad specifics:**
- The round screen sizes itself to `--vvh` (`useVisualViewport`) so the answer row stays above the on-screen keyboard.
- Audio is unlocked on the first tap (`speaker.unlock()`) through one shared `<audio>` element.
- The typing input disables autocorrect and spellcheck, which would otherwise give answers away.

## Testing notes

- **API tests:**
  - They call `api.request(path, init, { ...env, AI: fakeAi(...) }, ctx)` directly, which lets each test stub Workers AI.
  - `vi.spyOn(globalThis, "fetch")` stubs the dictionary API.
  - Migrations come from `packages/db/migrations` via `readD1Migrations`.
- **Compatibility date:** pinned to 2026-08-22, the newest the vitest-pool-workers workerd supports. Keep `wrangler.jsonc` and `wrangler.test.jsonc` in step.
- **e2e:**
  - Stubs `/api/tts` with silent WAV and records only `<audio>` loads.
  - Prefetches of the next word are `fetch` requests and must not count as "spoken".
  - WebKit reports `<audio>` loads as resource type `other`, not `media`.

## Deploy

Production: **https://jade.bauman.workers.dev** (Worker `jade`). It was first deployed 2026-09-28 as `jade-learning` and renamed to `jade` the same day, with D1 `jade-learning`, R2 `jade-learning-audio` and the `BETTER_AUTH_SECRET` secret set.

```bash
pnpm db:migrate:remote   # after adding a migration
pnpm run deploy          # build + wrangler deploy
```

- `vars.BETTER_AUTH_URL` in `wrangler.jsonc` is the production origin. Local dev overrides it with `BETTER_AUTH_URL=http://localhost:5190` in `apps/web/.dev.vars`, so keep that line or local sign-in breaks.
- If you add a custom domain, update `BETTER_AUTH_URL`, because Better Auth checks the request origin against it.
