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
- **Offline:** a PWA with an IndexedDB queue so rounds work without a connection. A family signed in on the device can open the installed app offline.

## Users

**Primary: the child.** In spelling they're the speller; the UI calls them kids.
- Built first for one 4th grader, who was 9 in October 2026. The design, content and games grow with her: pitch them at her age now, not younger, and let them get older as she does.
- Aged 8–11, in the middle grades.
- Practices on a family laptop with a physical keyboard, or on an iPad using touch, the on-screen keyboard, or a keyboard case.
- Usually practices at home after school, or before a class spelling test, a spelling bee or a math quiz.
- **Spelling:** learn this week's words well enough to spell them from hearing them alone, the way a real bee works.
- **Math:** get times tables and division facts fast and sure, and handle mental math, fractions, decimals and word problems at the right level.

**Secondary: the parent.**
- Signs in, sets up child profiles, and loads word lists. Lists come from the school sheet (pasted, CSV, or a photo) or from built-in grade packs.
- Chooses each child's math topics and times tables, and can nudge a math level if it feels too easy or too hard.
- Checks which words and facts are still causing trouble.
- The parent is the account holder. The child never manages credentials.

**Siblings:** a family can have more than one child profile.

## Product Purpose

The app has two subjects behind one subject hub. Spelling leads; math shares its rounds, saving, rewards and voice.

**Spelling** works the way a spelling bee works:
1. Hear the word.
2. Ask for the definition, a sentence or the origin.
3. Spell it.
4. Find out exactly which letters went wrong.

Success means the child spells the week's list correctly and without help. Missed words keep coming back through spaced review until they stick.

**Math** reads each problem aloud and lays it out as tiles; the child answers on an on-screen keypad. A first miss gets another go. A second miss shows the answer, how to get it, and a picture where one helps (a dot array for a fact, fraction bars for fractions). Levels adjust on their own, and missed times-table and division facts come back through the same spaced review as words.

## Positioning

- Practice is audio-first and follows real bee etiquette: say again, definition, use it in a sentence, origin.
- Feedback marks each letter as right, wrong, missing or extra, rather than a bare right or wrong.
- Parents can load the actual school list in seconds, including from a photo of the worksheet.
- Math adapts per skill from accuracy and pace, with no clock, and explains every missed answer.

## Operating Context

- Short sessions of 5–15 minutes: a list of 10–25 words, repeated across a week, or a math round of about 10 problems.
- The parent sets up lists and math topics once, and the child starts rounds on their own from a "Who's practicing?" screen, then picks a subject.
- A round can be stopped and picked up later; answers are saved as they're given.
- Audio is essential, so the device's speakers or headphones are on.
- **iPad is a first-class target:**
  - iPadOS Safari, and the app installed to the Home Screen as a PWA.
  - Portrait and landscape.
  - When the on-screen keyboard is up it covers about half the screen, so the word, the audio controls and the input must stay visible above it. Math never opens it: the keypad is the only input.
  - iOS only allows audio after a tap, so every round starts with a tap.

## Capabilities and Constraints

**Spelling modes:**
- **Bee:** hear the word and type it.
- **Learn:** study the word, its syllables and meaning.
- **Tiles:** build the word from letter tiles.
- **Review:** Leitner spaced repetition over missed words.

**Math topics:**
- **Times tables:** multiplication and division facts, from the tables the parent picks (2–12).
- **Mental math:** add, subtract and multiply in your head, including mixed and multi-step problems.
- **Fractions & decimals:** equivalent fractions, simplifying, decimals and comparing. Equivalent answers count unless the task asks for simplest form.
- **Word problems:** short authored story problems, read aloud.
- **Facts review:** Leitner spaced repetition over missed times-table and division facts.
- Each skill has levels 1–5. A skill moves up after 5 of the last 6 answers are right first time and mostly fluent, and down after 2 misses in the last 4.

**Word import:** paste, CSV, photo OCR (reviewed before saving), and built-in grade packs (Dolch K–3, plus curated 4th and 5th grade lists).

**Voice:** Deepgram Aura-2 through Workers AI, cached per word. The browser's `speechSynthesis` is the fallback.

**Dictionary data:** Free Dictionary API, Merriam-Webster Elementary when a key is configured, and Workers AI for kid-friendly sentences when neither has one.

**Rewards:** stars per word or problem and per round, daily streaks, and badges, shared across both subjects.

**Terminology:**
- "subject" is spelling or math.
- "round" is one pass through a list, or one set of math problems.
- "list" is the parent's word list.
- "pack" is a built-in list.
- "topic" is a math area the child picks from; "skill" is what a level belongs to.
- "fact" is a times-table or division fact.
- "review" means words or facts that are due.
- "kids" is the parent-facing word for child profiles.

## Brand Commitments

- The name is **Jade's World**.

## Evidence on Hand

- There are no testimonials, users, metrics or school partnerships. Future work must not invent any.

## Product Principles

1. **The word or problem is the hero.** During a round the only things on screen are listening, answering and feedback. Everything else waits.
2. **Mistakes teach and never punish.** Every miss shows the correct answer and what went wrong: the exact letters in spelling, the working in math. The language is encouraging. There are no timers, lives or fail states.
3. **Bee-authentic.** Support the questions a speller may ask at a real bee, and phrase them the same way.
4. **Parent-light.** Getting a real school list into the app should take under a minute.
5. **Progress the child can feel.** Stars, streaks, "words mastered" and "facts mastered" should reflect real learning, not time spent.
6. **Never lose practice.** Answers are saved as they're given, wait on the device when offline, and are never silently discarded.

## Accessibility & Inclusion

- WCAG 2.2 AA.
- Fully keyboard-operable, since typing is the primary input on a laptop. Math takes digits and symbols from a physical keyboard as well as the on-screen keypad.
- Fully touch-operable with targets of 44pt or more, since touch is the primary input on an iPad.
- Respects `prefers-reduced-motion`.
- Every audio cue has a visible equivalent.
- A per-child choice of font, including Lexend and Atkinson Hyperlegible.
