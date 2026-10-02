# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Subjects: **Spelling** and **Math**, behind one subject hub (`/play/$childId`). They share sessions, per-answer saving, the offline queue, resume, Leitner review, stars/streaks/badges and the voice. **Games** sits beside them; its first game is **Roxy**, a dress-up studio where stars earned in practice unlock items.

Jade's World is a spelling bee and math practice app for 8–11 year olds. Spelling leads; the lines below describe it.
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
                          # Both on their sides too, for devices.spec.ts and the keyboard spec only.
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

**Roxy (Games, `/play/$childId/games/roxy`):**
- Pure logic lives in `packages/core/src/roxy/` (`@jade/core/roxy`): `catalog.ts` (items by slot, costs, holiday collections), `look.ts` (`LookSchema`, `normalizeLook`, `wear`, `fingerprint`, `starterLook`), `holidays.ts`, `palettes.ts`. Art lives in `apps/web/src/components/roxy/art/`, one map per slot keyed by item id; `art.test.ts` checks the catalog and art match and that every item renders on every body.
- In code a character is a **look**, never an "avatar": `avatar` already means the number on a kid's tile.
- A look stores palette keys, not hex. `normalizeLook` drops wrong colours, fills defaults, and rejects a dress worn with a top or bottom.
- Each child starts from `starterLook(childId)`, which is seeded, uses only free items, and differs per child.
- `roxy_looks.fingerprint` is unique across everyone, so no two saved looks in Jade's World are the same. A duplicate returns 409 `taken` (`mine` says whose it was). The gallery holds 12 looks per child.
- **Stars:** `child_stats.total_stars` is lifetime (badges read it) and never goes down; `stars_spent` holds what Roxy has spent, and the balance is the difference. `POST …/roxy/unlock` inserts the unlock first, then charges only if the balance covers it, else removes the row (409 `stars`). It's idempotent. A holiday gift is never sold (403 `gift`); it's only ever claimed.
- **Holidays:** a collection opens 7 days before the first day, by the family's `day`. Lunar and lunisolar dates come from the `HOLIDAY_DATES` table, which runs to 2030; a test fails when it runs out. `POST …/roxy/claim` gives the gift free only inside the window and within a day of the server's date. Parents turn holidays off in Settings (`parent_settings.roxy_holidays_off`), which hides their items too.
- The studio keeps the look on the device (`jade.roxy.{childId}`) and autosaves it with `PUT …/roxy/current` after 1.2s, or when back online, then keeps what the server kept. A 4xx other than 429 is final: the draft gives way to the server's copy instead of retrying forever. Items hidden by a parent's holidays switch are taken off by the server (`withoutHolidays`, `homeWithoutHolidays`), never refused; only never-unlocked items get 403. Unlocking, claiming and saving need a connection. `GET …/roxy?day=` is in the `jade-data` cache with `ignoreSearch`.
- **Pets** are the `pet` and `petwear` slots (`petwear` needs a pet; `normalizeLook` drops it otherwise). `petName` is on the look but left out of the fingerprint, so renaming a pet isn't a new look.
- **Games are built with three.js** (`three` + `@react-three/fiber`), loaded only on game screens (`lazy()`), never on Spelling, Math or parent screens.
- **3D Roxy** lives in `components/roxy/three/`. `RoxyModel` builds her from the look: `body.tsx` (proportions per body shape, `radiusAt` for clothes to wrap, the face as the studio's SVG features on a sphere patch via `world/texture.ts`), `hair.tsx`, `clothes.tsx` (tops, dresses, jackets and bottoms are specs, such as sleeve length, hem and pattern, over lathed shells), `accessories.tsx`, `animals.tsx` (gem ears and tails, moon-gem heads, pets). Arms, legs and head hang from pivots, so `walking` (a ref, 0–1) swings them and `pose` (on the look, not in the fingerprint) sets the arms. `model.test.ts` fails if a wearable item has no 3D model. Item thumbnails and gallery cards are still the SVG.
- Game screens use `GameScreen.tsx`. The scene is the screen and the chrome floats small in its corners on `.glass` (DESIGN.md "Game screens"):
  - Top-left: a back `.orb` and the masthead (`eyebrow`, and a `title` whose `<span>` word is berry; `accent(label)` does a place name).
  - Top-right: `orbs`, then Full screen (Fullscreen API where it exists; iPhone Safari has none) and Show/Hide panel.
  - Bottom: keyboard `hints` (fine pointer, only when there's room), `prompt` and `actions` in the centre, and `status` on the right (under the title on a phone). `touch` controls get their own row on touch screens.
  - The panel is a floating glass sheet whose open state is remembered per screen (`panelKey`, `jade.roxy.panel.*`). Places start it closed (`panelOpen={false}`); `reveal` opens it when a hotspot is used.
  - The backdrop is `--scene-top`/`--scene-ground`, re-tinted for Day and Night.
- **Walking Roxy directly** (places, and home while playing), beside tap-to-walk:
  - `world/drive.ts` is pure and tested: `keysToInput`, `toWorld` (camera-relative) and `stepFree` (slides along walls, using `isFree` in `path.ts`).
  - `useDrive` reads WASD, the arrows and Space into a ref the frame loop reads; it ignores keys while typing, in tab lists, in the panel and in dialogs. `TouchControls` writes the stick and Hop into the same ref.
  - `Walkers` takes `drive` and `onMove`. A hop is one 0.4s arc per press, with none under reduced motion.
  - Places only: dragging turns the view up to 30° (`WorldCanvas orbit`), and it eases back after 3s. A drag never counts as a tap. Home stays fixed.
  - "Press E": `placeTargets` (PlaceScene) and `nearest` (`world/near.ts`) find what she's beside; E or the prompt's button does what a tap would.
- **Go to…** (`Destinations.tsx`): a dialog on the studio, home and every place, listing them all with "· here" on the current one.
- **Roxy's home** (`games/roxy/home`, `world/HomeScene.tsx`): one 10×8 room seen from a fixed angle with an orthographic camera. Furniture is built from rounded shapes in code with toon shading (`world/Furniture.tsx`); `furniture.test.ts` checks every catalog piece has a model.
  - The home is `HomeSchema` in `core/roxy/home.ts`: wallpaper, floor, and up to 40 placed pieces on whole squares (walls: `back`/`left`). `normalizeHome` drops pieces outside the room or on top of other furniture (rugs go under). Stored in `roxy_homes`, returned as `home` on `GET …/roxy`, saved with `PUT …/roxy/home` (403 if it holds locked furniture), kept on the device as `jade.roxyhome.{childId}` and autosaved like the look.
  - Furniture unlocks through the same `POST …/roxy/unlock` and `roxy_unlocks` rows as clothes; a core test keeps their ids apart.
  - Every 3D action has a DOM button too (add, turn, move by one square, put away). If WebGL can't start, the room says so and decorating still works. Reduced motion: no walking or bobbing, Roxy just appears where tapped.
- **Town** (`games/roxy/town`, `games/roxy/place/$placeId`): the park, pet shop and school (`PLACES` in `core/roxy/places.ts`), each a `world/PlaceScene.tsx` scene on the shared `world/stage.tsx` (camera, light, Roxy and pet walking). Each place hides five finds (`FINDS`); tap one, or "Help me look", and Roxy walks over and picks it up (`POST …/roxy/find`, idempotent, `roxy_finds`; `finds` comes back on `GET …/roxy`). Finds never earn stars. Offline, a find is kept in `jade.roxyfinds.{childId}` and sent when back online (`useSendFinds`), not through the practice queue. Picking one up plays `FindBurst` (it floats over Roxy's head and pops). The school's chalkboard links to Spelling and Math; the pet shop links to the studio's Pets tab (`?tab=pets`). A web test checks every find is placed in its scene.
  - **Walking** (`world/path.ts`): each place lists `blocks` (prop footprints; the home uses floor furniture's footprints) and Roxy's route is A* on a quarter-square grid, straightened. A tap on something stops her beside it. `path.test.ts` checks every find can be reached from the start without crossing a block, so give a new floor prop a block. Her position is set once and then only the frame loop moves her.
  - **Pacing** (`world/pace.tsx`): the canvases are `frameloop="demand"`. Anything that moves calls `useWake()`'s function each frame (`"ambient"` for scenery that never stops: 30fps); left alone a scene draws at 15fps (4 with reduced motion). `useContextLoss` turns a WebGL context that isn't given back within 3s into the no-3D fallback.
  - A few town props are **generated models** (Tripo text-to-3D) in `public/models/town/`: the park's tree, bench and slide, the pet shop counter, and the school's desks, teacher's desk and bookshelf. `world/Model.tsx` loads them (meshopt), swaps their material for the shared toon, sizes them by height and falls back to the code-built prop while loading or if loading fails. Scenery that never takes palette colours is generated; Roxy, clothes and furniture stay in code. The cat, dog, bunny and hamster are generated too (`public/models/pets/`, `GENERATED_PETS` in `three/GeneratedPet.tsx`), each modelled white with grey markings: a shader paints light fur c1 and mid greys c2 (swapped for the hamster, whose body is c1), keeping the eyes, nose and pink parts. Per pet, `split` sets where grey ends and `keep` how coloured a texel must be to keep its colour; check a new pet's texture against them. They have no rig (Tripo couldn't rig the cat's stubby legs), so code waddles them while they move; with petwear on, the code-built pet shows instead, since accessories hang off fixed points. Cut each file down before committing (one 512px WebP colour map, no normal/ORM maps, meshopt); `Model.test.ts` checks this. They're precached (`glb` in `globPatterns`).

**Admin (Better Auth admin plugin):**
- Endpoints live under `/api/auth/admin/*` (list, ban, set role, impersonate); the client has `adminClient()` on `authClient.admin`.
- Promote a parent in D1: `update user set role = 'admin' where email = '…'`. The session cookie cache holds the old role for up to 5 minutes, so sign in again.
- A banned parent can't sign in and their sessions are revoked. Impersonation sessions last 1 hour (`session.impersonated_by`).
- The UI is `parent/admin.tsx` (an Admin key in the parent nav, only for `role = "admin"`): find a family, ban or lift a ban, "Sign in as". `_authed` puts `impersonating` in the route context; while it's true a bar offers "Back to my account" (not on play screens) and the PIN gate stays open.
- Switching accounts (`lib/admin.ts`) refuses while practice is still queued, then forgets the device and reloads, so one family's data never shows under the other.

**Day and Night (`lib/theme.ts`):**
- `parent_settings.appearance` is `auto`, `day` or `night` (Settings → Day and Night). Auto follows the device's `prefers-color-scheme`, live.
- It's applied as `data-theme` on `<html>`. `index.css` holds Night as the default tokens and Day under `:root[data-theme="day"]`; shadows and recesses are `--tone-*` tokens so both themes own them.
- The choice is copied to localStorage (`jade.appearance`) so an inline script in `index.html` lights the page before first paint and offline. `_authed` reads `/api/parent` on every signed-in screen and applies the account's choice.
- `<meta name="theme-color">` follows the theme; the PWA manifest colours stay at Night's page.

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

Read `PRODUCT.md` (product truth) and `DESIGN.md` (the visual system) before any UI work. The world is a **sticker album on jade pages**: practice happens with maple letter tiles on the page, and what a kid earns (badges, stars) and their places (Spelling, Math, Games) are die-cut stickers (`.sticker`, `.foil`, `.slot` in `packages/ui/src/styles/index.css`). Page colours are the `page-*` tokens.

**Colour laws** hold everywhere and never mean anything else:
- marigold = right
- coral = wrong letter
- sky = missing letter
- stone = extra letter

**Rules:**
- Feedback colour goes on tile edges and corner marks. Letter ink stays dark.
- No emoji as icons; use lucide.
- Kids are identified by their initial tile plus a chosen point value.

**iPad and iPhone:**
- The round screen sizes itself to `--vvh` (`useVisualViewport`) so the answer row stays above the on-screen keyboard. `compact` (keyboard up, or under 480px tall: a phone on its side) tightens both rounds.
- Audio is unlocked on the first tap (`speaker.unlock()`) through one shared `<audio>` element.
- The typing input disables autocorrect and spellcheck, which would otherwise give answers away.
- **Safe areas:** the installed app draws under the notch and home bar (`viewport-fit=cover`, `black-translucent`). Pages pad with `p-safe-*`, `px-safe-*`, `py-safe-*`, `pt-safe-*`, `pb-safe-*` (`packages/ui/src/styles/index.css`): the larger of that spacing step and the inset, so `py-safe-6` replaces `py-6`, and `md:px-safe-10` replaces `md:px-10` (an iPhone on its side is wider than `md`). Insets are read through `--safe-*`, never `env()` directly, so e2e can fake a notch.
- `short:` is a phone on its side (landscape, ≤32rem tall, under `lg`): `GameScreen`'s panel moves beside the scene.
- Hand-written `:hover` rules sit in `@media (hover: hover)` (a tap leaves `:hover` stuck on iOS); keys, tiles and stickers have `touch-action: manipulation` (no double-tap zoom) and no long-press callout. Inputs stay ≥16px or iOS zooms in.
- `useWakeLock` keeps the screen on during a round and on game screens. `useCoarsePointer` (`lib/hooks.ts`) is the live touch-screen check.
- iOS never offers to install: parents on iPhone or iPad Safari get `InstallHint` in the parent area (`lib/install.ts`; dismissed for good in `jade.install-dismissed`). Launch screens are `public/splash/` from `scripts/splash.mjs`, linked in `index.html` and kept out of the precache.

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

Production: **https://jadesworld.app** (Worker `jade`, custom domain). It was first deployed 2026-09-28 as `jade-learning` at jade.bauman.workers.dev and renamed to `jade` the same day, with D1 `jade-learning`, R2 `jade-learning-audio` and the `BETTER_AUTH_SECRET` secret set. On 2026-10-01 the app became **Jade's World** on jadesworld.app; workers.dev is off and `www.jadesworld.app` 301s to the apex through a zone Redirect Rule (the asset layer answers before the Worker, so the redirect can't live in code).

```bash
pnpm db:migrate:remote   # after adding a migration
pnpm run deploy          # build + wrangler deploy
```

- `vars.BETTER_AUTH_URL` in `wrangler.jsonc` is the production origin. Local dev overrides it with `BETTER_AUTH_URL=http://localhost:5190` in `apps/web/.dev.vars`, so keep that line or local sign-in breaks.
- `BETTER_AUTH_URL` must match the domain in `routes`, because Better Auth checks the request origin against it. Change both together.
