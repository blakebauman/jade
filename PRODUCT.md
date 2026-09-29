# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

- **Scaffold:** a pnpm and Turborepo monorepo modelled on `~/Sites/projects/memoturn`.
- **Frontend:** a React 19 SPA built with Vite 8 and TanStack Router, styled with Tailwind v4.
- **Backend:** one Cloudflare Worker serves both the static assets and a Hono API.
- **Cloudflare services:**
  - D1 through Drizzle for data.
  - R2 for cached speech audio.
  - Workers AI for text-to-speech, photo OCR and example sentences.
- **Auth:** Better Auth for parent accounts.
- **Offline:** a PWA with an IndexedDB queue so rounds work without a connection.

## Users

**Primary: the speller.**
- Aged 8–11, in the middle grades.
- Practices on a family laptop with a physical keyboard, or on an iPad using touch, the on-screen keyboard, or a keyboard case.
- Usually practices at home after school, or before a class spelling test or a spelling bee.
- The job is to learn this week's words well enough to spell them from hearing them alone, the way a real bee works.

**Secondary: the parent.**
- Signs in, sets up child profiles, and loads word lists. Lists come from the school sheet (pasted, CSV, or a photo) or from built-in grade packs.
- Checks which words are still causing trouble.
- The parent is the account holder. The child never manages credentials.

**Siblings:** a family can have more than one child profile.

## Product Purpose

The app helps a child improve their spelling by practicing the way a spelling bee works:
1. Hear the word.
2. Ask for the definition, a sentence or the origin.
3. Spell it.
4. Find out exactly which letters went wrong.

Success means the child spells the week's list correctly and without help. Missed words keep coming back through spaced review until they stick.

## Positioning

- Practice is audio-first and follows real bee etiquette: say again, definition, use it in a sentence, origin.
- Feedback marks each letter as right, wrong, missing or extra, rather than a bare right or wrong.
- Parents can load the actual school list in seconds, including from a photo of the worksheet.

## Operating Context

- Short sessions of 5–15 minutes with a list of 10–25 words, repeated across a week.
- The parent sets up a list once, and the child starts rounds on their own from a "Who's practicing?" screen.
- Audio is essential, so the device's speakers or headphones are on.
- **iPad is a first-class target:**
  - iPadOS Safari, and the app installed to the Home Screen as a PWA.
  - Portrait and landscape.
  - When the on-screen keyboard is up it covers about half the screen, so the word, the audio controls and the input must stay visible above it.
  - iOS only allows audio after a tap, so every round starts with a tap.

## Capabilities and Constraints

**Practice modes:**
- **Bee:** hear the word and type it.
- **Learn:** study the word, its syllables and meaning.
- **Tiles:** build the word from letter tiles.
- **Review:** Leitner spaced repetition over missed words.

**Word import:** paste, CSV, photo OCR (reviewed before saving), and built-in grade packs (Dolch K–3, plus curated 4th and 5th grade lists).

**Voice:** Deepgram Aura-2 through Workers AI, cached per word. The browser's `speechSynthesis` is the fallback.

**Dictionary data:** Free Dictionary API, Merriam-Webster Elementary when a key is configured, and Workers AI for kid-friendly sentences when neither has one.

**Rewards:** stars per word and per round, daily streaks, and badges.

**Terminology:**
- "round" is one pass through a list.
- "list" is the parent's word list.
- "pack" is a built-in list.
- "review" means words that are due.

## Brand Commitments

- The name is **Jade Learning**.

## Evidence on Hand

- There are no testimonials, users, metrics or school partnerships. Future work must not invent any.

## Product Principles

1. **The word is the hero.** During a round the only things on screen are listening, spelling and feedback. Everything else waits.
2. **Mistakes teach and never punish.** Every miss shows the correct spelling and exactly where the attempt went wrong, in encouraging language. There are no timers, lives or fail states.
3. **Bee-authentic.** Support the questions a speller may ask at a real bee, and phrase them the same way.
4. **Parent-light.** Getting a real school list into the app should take under a minute.
5. **Progress the child can feel.** Stars, streaks and "words mastered" should reflect real learning, not time spent.

## Accessibility & Inclusion

- WCAG 2.2 AA.
- Fully keyboard-operable, since typing is the primary input on a laptop.
- Fully touch-operable with targets of 44pt or more, since touch is the primary input on an iPad.
- Respects `prefers-reduced-motion`.
- Every audio cue has a visible equivalent.
- A per-child choice of font, including Lexend and Atkinson Hyperlegible.
