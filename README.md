# Jade Learning

Spelling bee practice for 8–11 year olds, on laptop and iPad. Live at https://jade.bauman.workers.dev

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

## Stack

- **App:** a React 19 SPA with TanStack Router and Query, Tailwind v4, and PWA (offline) support.
- **Server:** a Hono API on one Cloudflare Worker.
- **Cloudflare:** D1 (Drizzle), R2 (audio cache), and Workers AI (speech, photo OCR, kid-friendly example sentences).
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
