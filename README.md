# Jade's World

Spelling bee and math practice for 8–11 year olds, on a laptop, an iPad or a phone, with a world to play in between. Live at https://jadesworld.app

A kid picks their tile, then one of three places: **Spelling**, **Play** and **Math**.

A parent loads this week's school words: paste them, drop a CSV, snap a photo of the sheet, or start from a grade pack.

The speller then practices:
1. **Hear the word.** A natural voice speaks it (Deepgram Aura through Cloudflare Workers AI, cached).
2. **Ask about it,** the way you can at a real bee: definition, use it in a sentence, origin.
3. **Place the letters** tile by tile.
4. **See feedback on every letter:** right, wrong, missing, or extra.

Missed words come back in spaced review until they stick. Every round ends with a score, stars, and the words to practice.

**Modes:**
- **Bee:** hear it, spell it.
- **Tiles:** build it from letter tiles plus decoys.
- **Learn:** study syllables and meaning, then cover and spell.
- **Review:** due and missed words.

**Math** reads each problem aloud and takes answers on an on-screen keypad: times tables, mental math, fractions and decimals, and word problems. Levels (1–5 per skill) adjust on their own, every miss shows how to get the answer, and missed facts come back in the same spaced review.

**Play** is pure play, nothing about spelling or math:
- **Roxy:** a dress-up studio with pets and holiday collections, her home to decorate, and a 3D town (park, pet shop, school) with hidden finds.
- **Gobble Town:** a hole in a toy town that swallows whatever fits and grows, against computer players.
- **Jelly Blocks:** falling blocks in a jar, made of wobbling jelly.
- **Campfire Woods:** a first-person block island per family. Dig, build and keep the campfire going through the night, live with family and linked friends.
- **Daily quests:** three a day across the games.

Games pay their own **tickets**, so stars stay a record of practice. A parent decides per kid how the two meet: games free, stars that pay in games too, games that open after today's practice, or play time that costs stars.

## Stack

- **App:** a React 19 SPA with TanStack Router and Query, Tailwind v4, and PWA (offline) support.
- **Server:** a Hono API on one Cloudflare Worker.
- **Cloudflare:** D1 (Drizzle), R2 (audio cache), Workers AI (speech, photo OCR, kid-friendly example sentences), and a Durable Object per family for Campfire Woods.
- **Games:** three.js with React Three Fiber, loaded only on game screens (Jelly Blocks on WebGPU, falling back to WebGL 2).
- **Auth:** Better Auth. Parents sign in; kids choose their tile.
- **Repo:** a pnpm + Turborepo monorepo modelled on memoturn.

## Getting started

```bash
pnpm install
cp apps/web/.dev.vars.example apps/web/.dev.vars   # set BETTER_AUTH_SECRET
npx wrangler login                                 # Workers AI runs remotely even in dev
pnpm dev                                           # http://localhost:5190
```

- `pnpm test` runs the unit and API tests.
- `pnpm test:e2e` runs the full flow on laptop, iPad and phone.
- See [CLAUDE.md](CLAUDE.md) for architecture and deploy steps, [PRODUCT.md](PRODUCT.md) for the product, and [DESIGN.md](DESIGN.md) for the visual system.

## Word data credits

- Grade packs K–3 are the Dolch sight-word lists (public domain).
- Definitions come from [Free Dictionary API](https://dictionaryapi.dev/) and, if configured, the [Merriam-Webster Elementary Dictionary](https://dictionaryapi.com/). Merriam-Webster is free for non-commercial use.
