# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Jade's World is a kids' games portal with practice built in. Its home (`/play/$childId`) is one shelf of tiles, laid out like a console's home: every game (Roxy's studio, the town, Gobble Town, Jelly Blocks, Campfire Woods) plus **Spelling** and **Math**, the one the kid played last first (`jade.shelf.{childId}`), one lit at a time. The old Play home (`games/`) redirects to it; quests, badges and more time are its buttons. Spelling and Math share sessions, per-answer saving, the offline queue, resume, Leitner review, stars/streaks/badges and the voice. Games pay their own **tickets**; practice stars stay apart unless a parent links them (see Learn and Play).

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
                          # E2E_GROUP=games runs only the 3D games' specs (one at a time), E2E_GROUP=other the rest;
                          # CI runs the laptop as those two jobs side by side, and stops a job after 3 failures.
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
| `RATE_LIMIT` | Rate limiter | Per-parent limits on the Workers AI calls and friend codes |
| `WOODS` | Durable Object (`WoodsWorld`, SQLite) | One Campfire Woods island per family, named by the parent's user id |

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
- `word_lists.archived_at` marks a past list; `list_children` says which kids a list is for, and only those kids see it (no rows: nobody yet). A new list with no `childIds` goes to the only kid in a one-kid family, else to nobody until the parent picks (the editor won't save without a pick); a family's first kid takes lists made before any kid existed; later kids start with none. Migration 0011 gave every old "everyone" list to the kids the family had then. `PATCH /api/lists/:id` takes `archived` and `childIds`; only the parent's own kids are ever attached.
- `GET /api/lists` returns `archived`, `childIds` and `perChild` (each kid's last play and mastered count). The kids' Spelling screen filters with `listIsFor` (`lib/api.ts`), treating summaries cached before lists had `childIds` at all as current and for everyone.
- Archiving never touches Review: review is per child from `word_progress`, not per list.

**Learn and Play (`core/src/play.ts`, `routes/play.ts`, `lib/play.ts`):**
- Games pay **tickets**: 10 per town find (first time only), and a game's go through `POST …/play/earn {key, tickets}` (once per key, e.g. `gobble:<seed>`, at most 30; nothing while Free). Wallets live on `child_stats`: `tickets_earned`/`tickets_spent`; `total_stars` is lifetime (badges read it, never goes down) and `stars_spent` is what games took.
- Per kid, `child_play` (no row = defaults: tickets, not linked, open): `free`; `stars` (stars can pay too); `practice_first` + `goal` (`round` = a finished round with ≥5 answers, `stars10`, `stars20`, on the family `day`, tallied in `daily_practice` by `recordAttempts` and finish); `time_costs` (5 stars buy 10 minutes, `minutes_bought`/`seconds_used`). Parents set it in Kids → Learn and Play (`PUT …/play`).
- Turning Free off runs `keepWhatsUsed`: anything worn, in a saved look or placed at home becomes an unlock (cost 0).
- `GET …/play?day=` returns settings, wallet, today, time and `shut`/`outOfTime`/`open` (in `jade-data` with `ignoreSearch`). `games/route.tsx` sends a closed kid from any game back to the home shelf (through `games/`, which redirects) (a speed bump, like the PIN) and runs `usePlayClock`: seconds count only while a game screen is visible, kept in `jade.playtime.{childId}`, sent every 30s/on hide to `POST …/play/time/used` (only ever moves forward, capped at what was bought). GameScreen shows minutes left (never seconds); at zero `TimeUp` covers the screen, unless a game passes `goInProgress` (it finishes the go first).
- Existing kids were migrated linked (`stars` on), so nothing they owned or saved for changed; new kids start unlinked.
- **Daily quests** (`core/src/quests.ts`, `lib/quests.ts`, `components/play/QuestBoard.tsx`): three a day, in the home shelf's Quests sheet, one from each of three games, seeded by kid and day (`questsFor`). They're play only: nothing about spelling or math. Games report `questEvent` (Gobble and Jelly at the end of a go, a town place on arrival, the studio on each try-on, Campfire Woods as each thing is done); progress lives on the device in `jade.quests.{childId}` and starts over each day. Collecting pays through `earnTickets` with key `quest:<day>-<id>`, so the server pays it once. A quest finished while Free is marked `unpaid` (just Done) and never pays, even after Free is turned off, as a go played on Free never does (#27).

**Roxy (Play, `/play/$childId/games/roxy`):**
- Pure logic lives in `packages/core/src/roxy/` (`@jade/core/roxy`): `catalog.ts` (items by slot, costs, holiday collections), `look.ts` (`LookSchema`, `normalizeLook`, `wear`, `fingerprint`, `starterLook`), `holidays.ts`, `palettes.ts`. Art lives in `apps/web/src/components/roxy/art/`, one map per slot keyed by item id; `art.test.ts` checks the catalog and art match and that every item renders on every body.
- In code a character is a **look**, never an "avatar": `avatar` already means the number on a kid's tile.
- **The character's name** is the kid's: `look.name`, unset meaning "Roxy" (`characterName`, `DEFAULT_NAME`). Like `petName` it's left out of the fingerprint, and putting a saved look back on keeps the name the kid uses now (the server merges it). It's picked in the studio's Body tab, and the studio nudges once (`jade.roxy.named.{childId}`). Titles and lines round the games (studio, town, home, Go to…, the home shelf, quests via `withName`) say it through `useCharacterName`; game copy says "your character" or the name, never a fixed "Roxy" or "she". In code and docs the character is still Roxy.
- A look stores palette keys, not hex. `normalizeLook` drops wrong colours, fills defaults, and rejects a dress worn with a top or bottom.
- Each child starts from `starterLook(childId)`, which is seeded, uses only free items, and differs per child. A new kid (`fresh` on `GET …/roxy`: nothing saved yet) picks a first look in the studio from `starterChoices` (that starter, one with short hair and trousers or shorts, one in other separates, both with no jewellery or blush, and one in a dress), so nobody is handed a look that doesn't feel like them.
- `roxy_looks.fingerprint` is unique across everyone, so no two saved looks in Jade's World are the same. A duplicate returns 409 `taken` (`mine` says whose it was). The gallery holds 12 looks per child.
- **Paying:** `POST …/roxy/unlock {itemId, pay}` with `pay` `tickets` (default) or `stars` (403 `stars-off` unless the kid's link allows it). It inserts the unlock first, then charges only if that wallet covers it, else removes the row (409 `tickets`/`stars`, with `wallet`). It's idempotent. While the kid's games are Free it charges nothing and stores nothing. A holiday gift is never sold (403 `gift`); it's only ever claimed. `GET …/roxy` returns `wallet` (`free`, `tickets`, and `stars` or null when not linked) and, while Free, every sold item in `unlocked`.
- **Holidays:** a collection opens 7 days before the first day, by the family's `day`. Lunar and lunisolar dates come from the `HOLIDAY_DATES` table, which runs to 2030; a test fails when it runs out. `POST …/roxy/claim` gives the gift free only inside the window and within a day of the server's date. Parents turn holidays off in Settings (`parent_settings.roxy_holidays_off`), which hides their items too.
- The studio keeps the look on the device (`jade.roxy.{childId}`) and autosaves it with `PUT …/roxy/current` after 1.2s, or when back online, then keeps what the server kept. A 4xx other than 429 is final: the draft gives way to the server's copy instead of retrying forever. Items hidden by a parent's holidays switch are taken off by the server (`withoutHolidays`, `homeWithoutHolidays`), never refused; only never-unlocked items get 403. Unlocking, claiming and saving need a connection. `GET …/roxy?day=` is in the `jade-data` cache with `ignoreSearch`.
- **Pets** are the `pet` and `petwear` slots (`petwear` needs a pet; `normalizeLook` drops it otherwise). `petName` is on the look but left out of the fingerprint, so renaming a pet isn't a new look.
- **Games are built with three.js** (`three` + `@react-three/fiber`), loaded only on game screens (`lazy()`), never on Spelling, Math or parent screens.
- **3D Roxy** lives in `components/roxy/three/`. `RoxyModel` builds her from the look: `body.tsx` (proportions per body shape, `radiusAt` for clothes to wrap, the face as the studio's SVG features on a sphere patch via `world/texture.ts`), `hair.tsx`, `clothes.tsx` (tops, dresses, jackets and bottoms are specs, such as sleeve length, hem and pattern, over lathed shells), `accessories.tsx`, `animals.tsx` (gem ears and tails, moon-gem heads, pets). Arms, legs and head hang from pivots, so `walking` (a ref, 0–1) swings them and `pose` (on the look, not in the fingerprint) sets the arms. `model.test.ts` fails if a wearable item has no 3D model. Item thumbnails and gallery cards are still the SVG.
  - Each pivot's contents sit in a `Part` (`Static` with `twoSided`), baked into one mesh, so she's about 10 draw calls, not 40; patterned fabric and the face stay separate. Nothing inside a `Part` can move on its own: pieces that do (a ponytail, pigtails: `hairSwing`) hang from their own pivots outside it.
  - Hair edges are `patch()` sphere patches with curved edges (`points` cuts the ends of locks, `hairline` lifts the cap off the forehead and takes it down to the nape at the back, so no style shows bare scalp from behind), cached by id: give a differently shaped patch its own id. Curls never cover the face (`cloudPoints`, tested in `hair.test.ts`). Clothes end in a darker rolled `Hem`. Every Roxy material carries a soft rim of light (`rimLight` in `shapes.tsx`; baked parts use `roxyBaked()`).
  - Motion: poses ease, walking bobs and leans, she glances about at rest, hops when something new is tried on (with a burst of twinkles, `sparkle.tsx`), and blinks (`Face` swaps to a closed-eyes texture). Reduced motion stops all of it, blinking too. Her parts are built once per look (skin and what she wears), so a change of pose never rebakes them.
- Game screens use `GameScreen.tsx`. The scene is the screen and the chrome floats small in its corners on `.glass` (DESIGN.md "Game screens"):
  - Top-left: a back `.orb` and the masthead (`eyebrow`, and a `title` whose `<span>` word is berry; `accent(label)` does a place name).
  - Top-right: `orbs`, then Full screen (Fullscreen API where it exists; iPhone Safari has none) and Show/Hide panel.
  - Bottom: keyboard `hints` (fine pointer, only when there's room), `prompt` and `actions` in the centre, and `status` on the right (under the title on a phone). `touch` controls get their own row on touch screens.
  - The panel is a floating glass sheet whose open state is remembered per screen (`panelKey`, `jade.roxy.panel.*`). Places start it closed (`panelOpen={false}`); `reveal` opens it when a hotspot is used.
  - The backdrop is `--scene-top`/`--scene-ground`: the day's sky in both themes. Games are always lit by day; Day and Night theme only the UI round them (the glass chrome). Words printed straight on the scene (the masthead, keyboard hints) sit in `.scene-day`, which takes Day's tokens so they read at Night.
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
- **Town** (`games/roxy/town`, `games/roxy/place/$placeId`): the park, pet shop and school (`PLACES` in `core/roxy/places.ts`), each a `world/PlaceScene.tsx` scene on the shared `world/stage.tsx` (camera, light, Roxy and pet walking). Each place is its own file in `world/place/` (`park.tsx`, `petshop.tsx`, `school.tsx`, with `parkKit.tsx`, `indoorKit.tsx` and the shared `kit.tsx`). Each place hides five finds (`FINDS`); tap one, or "Help me look", and Roxy walks over and picks it up (`POST …/roxy/find`, idempotent, `roxy_finds`; `finds` comes back on `GET …/roxy`). Finds never earn stars. Offline, a find is kept in `jade.roxyfinds.{childId}` and sent when back online (`useSendFinds`), not through the practice queue. Picking one up plays `FindBurst` (it floats over Roxy's head in a glow and pops in a ring of stars, drawn over the scenery). Finds and hotspots are `Tappable`: they grow under a mouse pointer, and a hidden find twinkles every few seconds (not with reduced motion). The school's chalkboard links to Spelling and Math; the pet shop links to the studio's Pets tab (`?tab=pets`). A web test checks every find is placed in its scene.
  - **Look** (the town is a toy diorama, kept cheap enough for an iPhone):
    - `world/light.tsx` `TownLights`: a sun from the front-right with soft PCF shadows (2048), a sky/ground fill and a cool rim. `useNight()` is always false: games are drawn by day whatever the theme. The Night rig (moonlight, lamps and windows lit by a few small `pointLight`s) is kept, unused, should a game want its own night. Colour stays untone-mapped (`flat`). `ShadowFlags` makes every solid mesh cast and receive, except basic or see-through materials, `userData.noShadow`, and receive-only subtrees marked `userData.noCast` (Roxy and her pet, who have contact blobs; the houses behind the park; anything that moves).
    - `world/batch.tsx` `Static` bakes every plain one-sided toon shape inside it into one vertex-coloured mesh (two-sided, mirrored, glowing, see-through or textured parts are left as they are). Put a place's static, untapped scenery in it (no Model/Suspense, nothing animated, children with stable identity); what's baked can't change afterwards. `cast={false}` for low ground detail. `twoSided` bakes two-sided shells too (front and a turned-round copy). Without it the shadow pass doubles hundreds of draw calls.
    - `place/board.tsx` draws the diorama's sides (turf and soil outdoors, a timber plinth indoors) and a table shadow underneath. The park's board grows (`backdrop.extend`) to hold `place/street.tsx`: a road, parked toy cars, lamps and the generated pet shop, school and cottages, which Roxy can't walk to.
    - Nothing that casts moves, so the shadow map is drawn only when the scene changes (`ShadowFlags` sets `needsUpdate`; `autoUpdate` is off). Anything that moves must not cast: Roxy, the pet, finds and bursts are `noCast`, as are the ducks, bird, butterflies, fish and spinners; meshes under 0.6 squares or flatter than 0.1 never cast. Lamps' `pointLight`s stay mounted at intensity 0 by day, so a night wouldn't recompile shaders.
    - Dev builds put the renderer's counts on `window.__THREE_GAME_DIAGNOSTICS__` (calls, triangles, visible meshes, shadow casters). On a phone the park is about 90 calls and 210k triangles a frame (about 110 and 320k on a frame that redraws shadows); the rooms are under 110 calls.
  - **Walking** (`world/path.ts`): each place lists `blocks` (prop footprints; the home uses floor furniture's footprints) and Roxy's route is A* on a quarter-square grid, straightened. A tap on something stops her beside it. `path.test.ts` checks every find can be reached from the start without crossing a block, so give a new floor prop a block. Her position is set once and then only the frame loop moves her.
  - **Pacing** (`world/pace.tsx`): the canvases are `frameloop="demand"`. Anything that moves calls `useWake()`'s function each frame (`"ambient"` for scenery that never stops: 30fps); left alone a scene draws at 15fps (4 with reduced motion). `useContextLoss` turns a WebGL context that isn't given back within 3s into the no-3D fallback.
  - A few town props are **generated models** (Tripo text-to-3D) in `public/models/town/`: the park's tree, bench and slide, the pet shop counter, the school's desks, teacher's desk and bookshelf, and the street's pet shop, school and cottage (`street-*`). `world/Model.tsx` loads them (meshopt), swaps their material for the shared toon, sizes them by height and falls back to the code-built prop while loading or if loading fails. Scenery that never takes palette colours is generated; Roxy, clothes and furniture stay in code. The cat, dog, bunny, hamster, goldfish, turtle and frog are generated too (`public/models/pets/`, `GENERATED_PETS` in `three/GeneratedPet.tsx`), each modelled white with grey markings: a shader paints light fur c1 and mid greys c2 (swapped for the hamster, whose body is c1), keeping the eyes, nose and pink parts. Per pet, `split` sets where grey ends, `keep` how coloured a texel must be to keep its colour, `dark` how dark (eyes) and `turn` which way the model faces (find the eyes); check a new pet's texture against them. The goldfish's model swims in the code-built `Bowl` (`three/bowl.tsx`: faint glass, only the inside of the water drawn, so the fish shows in its own colour), and its accessories go on the bowl. They have no rig (Tripo couldn't rig the cat's stubby legs), so code waddles them while they move. Petwear hangs off each one's `anchors` (head, neck, neck radius, and a `bib` for the bandana, which stands upright on a chubby chest), measured from the model; the accessory waddles with the pet. Cut each file down before committing (one 512px WebP colour map, no normal/ORM maps, meshopt); `Model.test.ts` checks this. They're precached (`glb` in `globPatterns`).

**Gobble Town (Play, `/play/$childId/games/gobble`):** a Hole.io-style game against computer players (no online play).
- The player is a hole in a toy town. Anything that fits (`fits`: narrower than 0.92 of the hole) and is mostly over it falls in, and the hole grows (`r = R0 + GROW·√size`). Too-big things lean toward the hole. A hole 1.2× bigger gobbles a smaller one (`EATS`), which comes back small 3s later, keeping its score, and is safe for 3s. A round is a 3s countdown and 2 minutes; the leaderboard is by score.
- **Rules** are pure and seeded in `components/gobble/`:
  - `town.ts`: an 84×84 board, 4×4 blocks of 16, roads 4 wide. Every placement checks for room, and the player's start is kept clear.
  - `kinds.ts`: 20 kinds, each with a footprint `r`, height, value, tint colours and milestones.
  - `sim.ts`: `newGame`, `step(g, dt, steer)`, bots in `think`/`decide`, and `autopilot` for tests.
  - `sim.test.ts` plays whole rounds. It checks that a good player reaches houses and wins most seeds, that the bots grow, and that more than 10% of the town still stands at 80s. Re-run it after tuning `R0`, `GROW`, the speed or the bot `skill`.
- **Drawing** (`GobbleScene.tsx`):
  - **Holes:** a stencil disc (renderOrder -10) marks each hole. The ground, board and blob shadows draw only where the stencil isn't 1, and the dark shaft (a BackSide cylinder) only where it is, so things visibly drop in.
  - **Shapes and instancing:** `props.ts` builds each kind in code as one vertex-coloured geometry, with a `tint` attribute for parts that take each copy's paint and a `glow` geometry lit at Night. They're drawn as one `InstancedMesh` per kind per quarter of the town, so off-screen quarters are culled. Eaten copies are swapped out and `count` lowered (`drop`), so late game draws little.
  - **No generated models:** dozens of trees and houses at 3–7.5k triangles each blew the phone budget.
  - **Budget:** active play is at most about 66 calls and 320k triangles.
  - **Stepping:** the scene steps the rules at 60Hz in `useFrame`, while `running`.
- **Screen** (`games/gobble.tsx`):
  - **Input:** WASD or the arrows (`useDrive`), or a floating drag stick anywhere on the scene. In-play messages sit in the scene overlay with `pointer-events-none`, so a thumb's drag isn't caught.
  - **Pause and sound:** P, Escape or hiding the tab pauses. Sound is recorded (ElevenLabs, `audio/*.mp3`, prompts in `audio/prompts.tsv`): gulps in four sizes by value (`gulpSize`), the milestone, a gobble either way, win/lose jingles and a 24s (12 bars at 120 BPM, cut on the bar lines from a Music API track, stereo) music loop under play (`setMusic`, faded while paused or over). Until a recording loads, or offline before it was ever heard, `sound.ts` synthesises it as before; the countdown pips are always synthesised. Muting is remembered (`jade.gobble.muted`).
  - **Best score and tickets:** the best score is kept on the device (`jade.gobble.best.{childId}`). Tickets are paid at the end (`earnTickets`, key `gobble:<seed>`).
  - **Test hooks:** dev builds expose `window.__THREE_GAME_TEST_HOOKS__` (`setSeed`, `setState` with `ready`, `active-play`, `late-game`, `gobbled`, `results`, `at-school`, `at-petshop`, and `setPausedForScreenshot`). `e2e/gobble.spec.ts` uses them to jump to the results.

**Jelly Blocks (Play, `/play/$childId/games/jelly`):** falling blocks in a toy jar, after holtsetio's *Softbody Tetris* (threejs.org showcase). Never "Tetris" in the UI.
- **Rules** (`components/jelly/sim.ts`, pure and seeded, `sim.test.ts`): a 10×20 jar (+2 hidden rows), 7-bag, SRS turns with wall kicks (y up), ghost, Hold once per piece, lock delay 0.5s with 15 resets, DAS 170ms / ARR 50ms in the sim, full rows pop for `CLEAR_S` before the rows above drop. Gravity `0.9·0.84^(level−1)`s a row, a level per 10 rows; the kid starts Slow, Medium or Fast (level 1/4/7, `jade.jelly.speed`). Every cube has an id (`id·8+type` in the grid) so the scene can follow it. `autopilot` plays for tests and hooks.
- **Renderer:** the only game on `three/webgpu` `WebGPURenderer` (WebGL 2 where there's no WebGPU, the renderer picks). A lost GPU device rebuilds the canvas on WebGL 2 (`forceWebGL`); after 3 losses the screen says 3D can't be shown. Headless Playwright Chromium always loses its WebGPU device within seconds (its software adapter, not our code), so e2e and headless captures exercise the WebGL 2 rebuild; headed Chromium on a real GPU stays on WebGPU.
- **Jelly** (`JellyScene.tsx`): all cubes are one instanced rounded box. Each copy carries spring state (squash, sideways lean) in an instanced attribute, and the TSL `positionNode` squishes the cube per vertex on the GPU: the top sinks and the middle bulges, the top lags a sideways step. Landings ripple through the stack; popped rows swell and burst into droplets in their flavour. Reduced motion: no wobble, no droplets. About 8 calls and ≤ 45k triangles a frame.
- **Layout:** the page lays out the Hold/Next trays (beside the jar, or a strip above it on an upright phone) around an empty slot; the camera fits the jar to that slot (`setViewOffset`). Input: arrows/WASD, Space drop, C/Shift hold, Z turn back, P/Escape pause; touch keys for two thumbs (moves repeat while held); swipes on the jar (across steps, down faster, flick down drops, flick up holds, tap turns), fingers followed with Touch Events like Gobble's, the swipe's "on" kept apart from the id (iOS ids can be negative); `e2e/jelly.spec.ts` drives real CDP touch with a negative id.
- **Tickets:** one per row popped, at the end (`jelly:<seed>`, at most 30). Best score on the device (`jade.jelly.best.{childId}`). When play time runs out mid-game, the falling piece is the last one (`game.lastPiece`: the sim ends with `over` `why: "time"` once it's down and its rows have popped; more time bought takes it back).
- **Test hooks** (dev): `setSeed`, `setState` (`ready`, `active-play`, `late-game`, `results`), `setAutopilot`, `setPausedForScreenshot`; `e2e/jelly.spec.ts`.

**Campfire Woods (Play, `/play/$childId/games/woods`):** a first-person block island per family. Kids dig blocks into a bag, build with them, and keep a campfire fed through the night. Family and linked friends play on it live.
- **Rules** are pure in `packages/core/src/woods/` (`@jade/core/woods`), shared by the island and the screen:
  - `volume.ts`: the island is 96×96×48 bytes, indexed `x + W·(z + D·y)`. An edit on the wire is one int, `packEdit(i, b)` (`i << 6 | b`).
  - `blocks.ts`: `B`. Block ids are bytes on the wire, so never renumber one; add new ones at the end. Wool and torches refill each morning (`REFILLS`).
  - `terrain.ts`: `generate(seed, gen)` builds the island from the seed: a flat camp clearing round the fire, woods, hills, beach and sea, ores by depth, bedrock. Only edits are ever stored, so an island keeps the generator it was made with: the DO stores `gen` in `meta` (none = 1) and sends it on `welcome`. Version 1 is oaks only and must stay byte-for-byte (a test pins its hash); version 2 (`TERRAIN_LATEST`) adds worn paths (a ring round the camp and four trails), mossy boulders, birch and pine, bushes, and plants (tall grass, flowers, toadstools: `draw: "plant"`, non-solid, crossed quads). Add a new version rather than changing an old one. Plants grow and are planted only on soil (`holdsPlant`), digging under one picks it too, and the camp (within 7 of the fire) stays mown. `spawnPoint` is 5 steps from the fire on version 2, 3 on version 1.
  - `clock.ts`: a 6-minute day then a 4-minute night (`phaseAt`). Fire fuel burns 1/s; logs 45, planks 20, coal 60. `fireRadius` follows the fuel. `rainAt(seed, elapsed)`: about four days in ten have one 75s shower in the daytime, the same on every screen (rain streaks in `rain.ts`, a greyer sky, nearer fog, a hiss in the ambience). Rain only falls where the sky is open: `IslandState.tops` keeps each column's highest rain-stopping block.
  - `craft.ts`: `RECIPES` made from the bag with `craft {recipe}` (the island replies `crafted`): a log (either kind) into 4 planks, coal and a plank into 4 torches, and, by the lit fire only, 2 sand into glass and 2 stone into brick. `craftUses` picks which blocks a recipe takes.
  - `night.ts`: 3 `lostAnimals` a night, placed where a kid can walk from camp (`walkable`). `deerAt` is the Night Deer's path, the same on every screen, so it's never sent.
  - `goals.ts`: `GOALS` pay tickets once each, keyed `woods:<id>`.
  - `protocol.ts`: the zod `clientMsg` and the `ServerMsg` type.
- **The island** (`packages/api/src/woods/WoodsWorld.ts`) is one Durable Object per family, with SQLite storage and hibernatable WebSockets. `apps/web/src/worker.ts` exports it.
  - **Storage:** `meta` (seed, clock, fire, lost animals, animals home, guests' building), `edits` (one row per changed cell, with `prev` and `by_family`), `inv` and `stats` per kid.
  - **Authority:** it judges every edit (reach, inventory, never the fire's cell, nobody walled in, 20 a second, at most 200k edits) and answers `refused`, so the screen puts the block back.
  - **Clock:** an alarm ticks it every second, and only while a socket is open, so nights pass only while someone plays. At nightfall it places lost animals. A night counts only if the fire never went out. While fuel is under 25% at night, the deer snuffs the nearest built torch every 20s.
  - **RPC:** `online`, `kickFamily`, `undoFamily` and `setGuestsBuild`. `tick(dt)` is public for tests.
  - **Routes:** `GET /api/children/:id/woods/ws?island=` checks the kid is the parent's own and the island is theirs or a linked friend's, then forwards headers (`WOODS_HEADERS`, URI-encoded). `GET …/woods/islands` lists ours plus friends', each with who's on now.
- **Friends** (`routes/friends.ts`, `/api/parent/friends`; Parent → Friends):
  - Codes are 8 characters with no 0/O/1/I/L, single use, 48 hours, and never usable by the parent who made one. One parent makes a code, the other looks it up and accepts.
  - A link is `friend_links` (smaller id first). `parent_settings.family_label` is what friends see. `woods_guests_build` decides whether friends can build or only look.
  - Unlinking kicks visitors both ways at once. "Undo" puts back what a family changed on our island (today, or ever).
  - Visitors are shown by initial (family by name). There's no chat: four emotes only.
- **The screen** (`components/woods/`):
  - `world.ts` `IslandState` holds the socket (reconnect with backoff, offline wait, kicked) and the screen's own copy of the volume. Edits show at once and are taken back on `refused`.
  - `mesher.ts` (in `mesher.worker.ts`) meshes per 16×16 full-height column: visible faces only, corner occlusion, solid and see-through meshes. That's at most 72 meshes, about 30 calls and 40k triangles in view. `atlas.ts` draws the 16px tiles in code.
  - `physics.ts` steps an AABB one axis at a time and auto-hops one-block steps. `raycast.ts` is DDA, looking through water.
  - **Block light:** `lightAround` (mesher) spreads light from torches (11), the campfire (12) and gems (5) a level a block through anything that isn't a solid cube, so it never leaks through walls; each face takes the light of the cell it faces as a `blockLight` attribute, and the terrain's shader adds it as a warm glow (`torchGlow`, strongest at night). The worker redraws every column within 15 blocks of an edit near a light. Solid blocks also get a small per-position shade so walls don't repeat.
  - `WoodsScene.tsx` uses plain WebGL Lambert with vertex AO, grass and leaves tinted by a low-frequency meadow noise (`tintAt`), and water that shimmers (`onBeforeCompile` on water's tile only). `sky.ts` is a gradient dome with a pixel sun and moon crossing it and instanced clouds; fog takes the horizon colour. One directional light is the sun by day and the moon by night and casts shadows round the kid (`quality`: 2048 desktop, 1024 phone, none on a software renderer, which also draws at 0.75). The campfire and the 2 nearest torches get pointLights.
  - `camp.ts`: the teepee campfire (layered flame cones that `flicker`, an ember bed, a halo), log benches, tent, woodpile and lantern, round the fire's cell. `bake.ts` merges every plain one-colour mesh under a group into one lit and one glowing vertex-coloured mesh: use it for any model built from many boxes (the camp, the Night Deer's body and legs), or draw calls multiply in the shadow pass.
  - `vfx.ts` `Effects`: pooled effects in 3 draw objects (an instanced cube pool, an additive point layer, a soft point layer): dig `chips` and `burst`, a build `pop`, fire embers and smoke (`setFire`), `sparks` when fed, a `smokePuff` when the deer snuffs a torch, `stars` when an animal comes home, and fireflies at night. Cells are a block's low corner. Fewer on phones, gentler with reduced motion.
  - `held.ts`: the block in hand (or a hand), hung off the camera and drawn over the world; it bobs, swings while digging and dips on building (still with reduced motion).
  - `sound.ts`: `ambience({ sun, fireDistance, fireStrength, running })` four times a second (birds, wind, crickets, an owl, the fire crackling nearer it), `stopAmbience()` on leaving, `step(block)`, `jump`, `land`, `snuff`, `lowFire`.
  - Recorded sounds (ElevenLabs, `audio/*.mp3`, prompts in `audio/prompts.tsv`; manifest in `samples.ts`, loader shared with Gobble in `lib/samples.ts`; the service worker keeps every game's `.mp3` in `jade-game-audio` once heard): the day, night (low-passed: generated crickets come out shrill), rain and fire beds, digging by material (`digSound`), footsteps by surface (`stepSound`, sliced from walking takes), placing, feeding, chimes, the owl, dawn, snuff, `splash`, and each animal's call. File names are the ids (`name-N.mp3` are takes of one sound); `samples.test.ts` keeps them and `SHOT_IDS` in step. At night the nearest lost animal calls every 5–8s, panned to its side and louder nearer (`ambience({ lost })`); it calls gladly coming home and when patted. They load after `unlock()` (about 1MB, mono); until one arrives, or if it fails, that sound is synthesised as before (the calls have no synth: they're just silent). Taps, jumps, landings and `lowFire` are always synthesised. Loops carry 0.1s of wrap-around either side of `loopStart`/`loopEnd`, so MP3 padding never reaches the seam; keep that if you replace one. `LOOP_TRIM` sets each bed's level.
  - At night `WatchingEyes` puts a few pairs of shy glints between the trees (seeded per night, one instanced call) that blink and slip away when a kid comes within 7 blocks; an animal just brought home hops for joy. Animals living at camp can be patted (the Use action when one's within reach: hearts, a hop; this screen only), and the panel lists who lives at camp. Under water the fog closes in blue-green, the screen tints and the ambience muffles; jumping in splashes.
  - The models in `models.ts` draw figures (shoes, a striped jumper, a face and hair, skin and hair picked from the label; a name tile and emote bubbles), animals (with a soft glow underfoot while lost) and the Night Deer (walking legs, antlers and eyes that glow through the fog).
  - Build anything three.js should keep in one `useMemo`: React may run a memo twice, and three.js moves an object into whichever group adds it last.
  - **Input:** on a fine pointer, pointer lock: the mouse looks, holding the left button digs, the right builds, the wheel or 1–9 picks a block. Escape lets the mouse go without pausing ("Click to look round" takes it back; headless CI browsers can't hold pointer lock at all), and P or hiding the tab pauses. On touch, Touch Events: a drag looks, a held finger (260ms) digs under it, a quick tap builds there. `TouchControls` walks, E or the Use button feeds the fire or picks up an animal.
  - The game needs the internet: offline, it says so and starts when back. `goInProgress` is on at night. `jade.woods.nights.{childId}` feeds the Campfire Woods tile's line on the home shelf.
  - **Quests:** woods is one of the daily-quest games (`QuestEvent` `{ game: "woods", did, n }`): the screen reports each dig and build the island confirms, each feeding, rescue and thing made.
  - **HUD:** the status (a little day/night dial and minutes, the fire meter, animals home) sits bottom right, or under the title on a phone; at night a hint points to the nearest lost animal; a gentle nudge when the fire runs low.
  - **Test hooks** (dev): `peek`, `block`, `lookAt`, `mine`, `place`, `select`, `setState` (`active-play`, `day`, `dusk`, `night`, `low-fire`, `deer`, `lost-animal`, `torches` (a real ring of torches round the camp), `rain` (the middle of the next shower): into play at that time of day, this screen only; `world.fuelShown` holds the fire for a capture) and `setPausedForScreenshot`. `e2e/woods.spec.ts` covers two kids on one island, two linked families, and real CDP touch.

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
- Games aren't themed: their scenes are always daylit (`useNight()` is false, `--scene-*` is the day sky), and only the UI round them follows Day and Night. Campfire Woods has its own clock's night, which isn't the theme. While its sky is dark, `sceneDark` gives the words printed on the scene Night's ink.

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

Read `PRODUCT.md` (product truth) and `DESIGN.md` (the visual system) before any UI work. The world is a **console home**: a plain shell (Night charcoal, Day pale grey, the `page-*` tokens) with one shelf of big square tiles (`.shelf`, `.shelf-tile`, `packages/ui/src/styles/index.css`). Tiles carry real art from each game (`public/tiles/*.webp`, captured from the games and rounds; Roxy's is her live look). One brand red (`--color-brand`) owns the wordmark, a die-cut sticker of "jade's world" (`Brand`, `.brand-sticker`), the app icon (`scripts/icon-mark.mjs`, then `scripts/icons.sh` and `scripts/splash.mjs`), counts and progress; one select blue (`--color-select`) owns the lit tile's ring. Never name the outside portal or console the home was modelled on. Earned things (badges, foil chips, `.slot`) keep their sticker materials.
- **Maple tiles only in rounds:** wood is for letters and digits a kid handles in a round (answer rows, tile bank, keypad, bee-question rack, results). Everywhere else is the shell and vinyl: kids (`KidTile`, a round `.kid-sticker`), words in lists (`WordRack`, a `.word-sticker` label) and small discs (`.vinyl-disc`).

**Colour laws** hold everywhere and never mean anything else:
- marigold = right
- coral = wrong letter
- sky = missing letter
- stone = extra letter

**Rules:**
- Feedback colour goes on tile edges and corner marks. Letter ink stays dark.
- No emoji as icons; use lucide.
- Kids are identified by their initial on a round vinyl sticker plus a chosen number on a foil chip (`KidTile`).
- **Coed:** copy never assumes the kid's gender. Say "your kid", "they" or the kid's name, never "she" or "he" for the player, in the UI, docs and code comments alike. Roxy is a character; her pronouns are hers.

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
