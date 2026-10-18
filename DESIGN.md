---
name: Jade's World
description: A sticker album on jade pages, one place at a time, where everything outside a round is white vinyl and every letter a kid handles in a round is a maple tile checked piece by piece.
colors:
  page: "#0e4f43"
  page-deep: "#093a31"
  page-raised: "#135c4e"
  page-line: "#1a6a5a"
  page-ink: "#e3f3ec"
  page-muted: "#a3d0c0"
  page-pit: "#072e27"
  vinyl: "#dfe8e3"
  page-day: "#d4ebe1"
  page-deep-day: "#bcdccd"
  page-raised-day: "#e9f5ef"
  page-line-day: "#9cc7b4"
  page-ink-day: "#0d3a31"
  page-muted-day: "#335c4f"
  page-pit-day: "#b3d5c5"
  vinyl-day: "#fbfdfb"
  vinyl-cut: "#fbfdfb"
  vinyl-ink: "#12332c"
  spell: "#17795e"
  math: "#5b4bc4"
  roxy: "#b8326f"
  sticker-ink: "#f4fbf7"
  foil-ink: "#1d2430"
  maple: "#f1c98a"
  maple-hi: "#f9e0b3"
  maple-lo: "#c9965a"
  maple-deep: "#a87842"
  ink: "#23180f"
  ink-soft: "#5a4630"
  marigold: "#f2b632"
  marigold-deep: "#b9820f"
  coral: "#e5553b"
  sky: "#5aa9e6"
  stone: "#9a9186"
typography:
  display:
    fontFamily: "Fredoka Variable, Fredoka, ui-rounded, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 3rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Fredoka Variable, Fredoka, ui-rounded, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Fredoka Variable, Fredoka, ui-rounded, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.3
  body:
    fontFamily: "Lexend Variable, Lexend, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Fredoka Variable, Fredoka, ui-rounded, system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 600
    lineHeight: 1.25
  place-name:
    fontFamily: "Fredoka Variable, Fredoka, ui-rounded, system-ui, sans-serif"
    fontSize: "clamp(3.5rem, 11vw, 6rem)"
    fontWeight: 600
    lineHeight: 0.95
    letterSpacing: "-0.02em"
  place-print:
    fontFamily: "Fredoka Variable, Fredoka, ui-rounded, system-ui, sans-serif"
    fontSize: "min(58vh, 52vw)"
    fontWeight: 700
    lineHeight: 0.8
    letterSpacing: "-0.03em"
  wordmark:
    fontFamily: "Fredoka Variable, Fredoka, ui-rounded, system-ui, sans-serif"
    fontSize: "22px to 36px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.005em"
  tile:
    fontFamily: "var(--tile-face, Fredoka Variable), ui-rounded, system-ui, sans-serif"
    fontSize: "0.56em of tile edge"
    fontWeight: 600
    lineHeight: 1
rounded:
  tile: "18%"
  plaque: "0.7rem"
  field: "0.8rem"
  key: "0.85rem"
  rack: "0.9rem"
  badge-sticker: "1rem"
  slot: "1.1rem"
  patch: "1.25rem"
  sticker: "1.5rem"
  sheet: "1.75rem"
  place-face: "2rem"
  pip: "9999px"
spacing:
  tile-gap: "10% of tile edge (min 3px)"
  word-gap: "3px"
  key-inline: "1.1rem"
  key-min-height: "3rem"
  rack: "0.5rem 0.75rem 0.9rem"
  vinyl-rim: "0.35rem"
  place-rim: "0.4rem"
  place-inset: "max(0.625rem, safe inset); max(1rem, safe inset) from md"
  word-sticker: "0.28em 0.7em 0.32em"
  page-inline: "1.25rem"
  page-inline-md: "2.5rem"
components:
  key-page:
    backgroundColor: "{colors.page-raised}"
    textColor: "{colors.page-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.key}"
    padding: "0 1.1rem"
    height: "3rem"
  key-go:
    backgroundColor: "{colors.page-ink}"
    textColor: "{colors.page-deep}"
    typography: "{typography.label}"
    rounded: "{rounded.key}"
    padding: "0 1.1rem"
    height: "3rem"
  key-tile:
    backgroundColor: "{colors.maple}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.key}"
    padding: "0 1.1rem"
    height: "3rem"
  key-check:
    backgroundColor: "{colors.marigold}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.key}"
    padding: "0 1.25rem"
    height: "3.5rem"
  key-check-disabled:
    backgroundColor: "{colors.page-pit}"
    textColor: "{colors.page-muted}"
    rounded: "{rounded.key}"
  key-pressed:
    backgroundColor: "{colors.page-deep}"
    textColor: "{colors.page-ink}"
    rounded: "{rounded.key}"
  tile:
    backgroundColor: "{colors.maple}"
    textColor: "{colors.ink}"
    typography: "{typography.tile}"
    rounded: "{rounded.tile}"
    size: "14px to 88px"
  square:
    backgroundColor: "{colors.page-pit}"
    rounded: "{rounded.tile}"
  plaque:
    backgroundColor: "{colors.maple}"
    textColor: "{colors.ink}"
    rounded: "{rounded.plaque}"
  rack:
    backgroundColor: "{colors.maple-deep}"
    rounded: "{rounded.rack}"
    padding: "0.5rem 0.75rem 0.9rem"
  patch:
    backgroundColor: "{colors.page-raised}"
    textColor: "{colors.page-ink}"
    rounded: "{rounded.patch}"
    padding: "1.25rem"
  field:
    backgroundColor: "{colors.page-pit}"
    textColor: "{colors.page-ink}"
    rounded: "{rounded.field}"
    padding: "0.7rem 0.95rem"
    height: "3rem"
  sticker:
    backgroundColor: "{colors.page-raised}"
    textColor: "{colors.page-ink}"
    rounded: "{rounded.sticker}"
  sticker-spell:
    backgroundColor: "{colors.spell}"
    textColor: "{colors.sticker-ink}"
    rounded: "{rounded.sticker}"
    padding: "1.5rem"
  sticker-math:
    backgroundColor: "{colors.math}"
    textColor: "{colors.sticker-ink}"
    rounded: "{rounded.sticker}"
    padding: "1.5rem"
  sticker-roxy:
    backgroundColor: "{colors.roxy}"
    textColor: "{colors.sticker-ink}"
    rounded: "{rounded.sticker}"
    padding: "1rem"
  foil:
    textColor: "{colors.foil-ink}"
    rounded: "{rounded.pip}"
    padding: "0.375rem 0.875rem"
  slot:
    textColor: "{colors.page-line}"
    rounded: "{rounded.slot}"
  place-face-spell:
    backgroundColor: "{colors.spell}"
    textColor: "{colors.sticker-ink}"
    rounded: "{rounded.place-face}"
    height: "100dvh less the inset"
  place-face-roxy:
    backgroundColor: "{colors.roxy}"
    textColor: "{colors.sticker-ink}"
    rounded: "{rounded.place-face}"
    height: "100dvh less the inset"
  place-face-math:
    backgroundColor: "{colors.math}"
    textColor: "{colors.sticker-ink}"
    rounded: "{rounded.place-face}"
    height: "100dvh less the inset"
  place-tab:
    textColor: "{colors.sticker-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pip}"
    padding: "0 1rem"
    height: "2.75rem"
  place-tab-current:
    backgroundColor: "{colors.sticker-ink}"
    rounded: "{rounded.pip}"
    padding: "0 1rem"
    height: "2.75rem"
  kid-sticker:
    backgroundColor: "{colors.vinyl-cut}"
    textColor: "{colors.vinyl-ink}"
    rounded: "{rounded.pip}"
    size: "40px to 136px"
  vinyl-disc:
    backgroundColor: "{colors.vinyl-cut}"
    textColor: "{colors.vinyl-ink}"
    rounded: "{rounded.pip}"
    size: "20px to 56px"
  word-sticker:
    backgroundColor: "{colors.vinyl-cut}"
    textColor: "{colors.vinyl-ink}"
    rounded: "{rounded.pip}"
    padding: "0.28em 0.7em 0.32em"
  wordmark:
    backgroundColor: "{colors.vinyl-cut}"
    textColor: "{colors.foil-ink}"
    typography: "{typography.wordmark}"
  badge-sheet:
    backgroundColor: "{colors.page-raised-day}"
    textColor: "{colors.page-ink-day}"
    rounded: "{rounded.sheet}"
    padding: "1.5rem"
---

# Design System: Jade's World

## Overview

**Creative North Star: "The Sticker Album, One Place at a Time"**

Jade's World is a sticker album that fills up. The ground on every route is a glossy album page in jade, and practice earns what goes on it. The album's places (Spelling, Play, Math) are each printed in their own hue, and on the subject hub each one fills the screen as a single giant die-cut sticker, one flick from the next, so Learn and Play get equal billing. Everything a kid collects or is named by is white die-cut vinyl: the wordmark, her own round initial sticker, the words on a list, small discs. Badges are stickers stuck down at a small tilt once earned and printed as dashed empty slots until then. Stars and streak are holographic silver foil. Wood is reserved for the rounds: only where a kid handles letters or digits are there maple tiles, and the four law colours judge them letter by letter.

The page has two lights and one set of token names. **Night** (the default in CSS) is the deep jade page under a warm reading lamp that pools on the upper left. **Day** is a mint-jade liner page in daylight, with the page's gloss catching it in one soft diagonal band. The parent picks Auto, Day or Night in Settings; Auto follows the device's light or dark setting live. Every surface reads `page-*` and `--tone-*`, so it works in both lights without a second rule.

Density stays low during a round, where the word is the only subject and the album recedes to a plain lit page. The hub shows one place at a time, its media in the middle and its caption low on the left; parent screens use the same page at lower intensity, with patches, page keys and words on vinyl labels. Depth is physical: stickers lift off the page, tiles sit on it, squares and fields are pressed into it. Textures are authored SVG turbulence with no raster assets. Motion is short and physical: stickers are placed, tiles drop, flip and nudge. Nothing floats or loops.

**Key Characteristics:**
- A jade album page on every route, in two lights (Night under a lamp, Day with a gloss band), with paper tooth and mottle.
- Die-cut vinyl stickers for the album's places and earned badges: printed hue face, white vinyl rim, gloss highlight, soft lift shadow, fixed small tilt. On the hub a place is one screen-filling sticker.
- White vinyl for identity and words outside rounds: the die-cut wordmark, round kid stickers, word labels and small discs, always dark ink on white.
- One printed hue per place: jade for Spelling, grape for Math, berry for Play (Roxy and the games). None is a law colour.
- Holographic silver foil for stars, streak and milestone badges, never gold.
- Dashed slots printed on the page for anything not yet earned.
- Maple tiles only for what a kid handles in a round (answer row, tile bank, problem row, keypad, bee questions, spoken plaque, results), judged by four law colours shown only on edges, underlines and corner marks.
- Rounded Fredoka for display and tiles, Lexend for reading, and a per-child tile face.
- Short physical motion (sticker-place, place-rise, tile-drop, flip cascade, nudge), all collapsed under reduced motion.

## Colors

A jade page in two lights, three printed place hues, white vinyl, silver foil, warm maple for what's handled in a round, and four law colours that each carry a single meaning.

### Primary (the page)
Night values are the frontmatter's unsuffixed keys and the CSS default; Day values (`-day` keys) replace them under `:root[data-theme="day"]` with the same variable names.
- **Jade Page** (page / page-day): the album page. It is the centre of the page light and the colour under every texture. It is also the browser `theme-color`, switched per light before first paint.
- **Page Shadow** (page-deep / page-deep-day): the far edge of the page light, the html background, pressed keys, the `go` key's text, and note bubbles.
- **Raised Page** (page-raised / page-raised-day): resting page keys, the `patch` panel at 70% opacity, and a sticker's face when it has no place.
- **Page Seam** (page-line / page-line-day): field borders, list dividers at 50% opacity, the scrollbar thumb, and the dashed outline and faint silhouette of an empty slot.
- **Page Pit** (page-pit / page-pit-day): where a tile goes. Empty squares, fields, the disabled Check recess and unpractised cells in the parent progress grid.

### Secondary (the album's stickers)
- **Vinyl** (vinyl / vinyl-day): the white die-cut rim of every sticker, place face, foil chip and the badge sheet. It follows the light.
- **Vinyl Cut** (vinyl-cut): the fixed white of the vinyl family (kid stickers, discs, word labels, the wordmark's cut). Like maple it doesn't change with the light, so it reads on the page in either light and on any place hue. Discs and labels shade it from pure white at the upper left to a cool grey-green at the lower right.
- **Vinyl Ink** (vinyl-ink): the dark jade ink printed on vinyl: a kid's initial, a word on a label, a disc's letter or icon. The wordmark prints in Foil Ink instead.
- **Spelling Jade** (spell): the Spelling place page, its tab, and spelling-flavoured badges. It is also the app icon's top band.
- **Math Grape** (math): the Math place page, every math topic sticker, the due-facts sticker and math badges. The icon's bottom band.
- **Play Berry** (roxy): the Play place page, the Play home's stickers, tickets and Roxy-flavoured badges. The icon's middle band and the iOS touch icon's background.
- **Sticker Ink** (sticker-ink): all text, pips and keys printed on a place hue. A placed sticker re-points `page-ink` to it, so contents need no special casing.
- **Holographic Foil** (a 118deg silver-to-periwinkle-to-lilac-to-mint gradient, ink foil-ink): stars, streak, the milestone badges (week of practice, star collector, 100 right), the number chip on a kid sticker and the star dotting the wordmark's j. Values live in the sidecar.

At Night, place stickers and place faces sit under the lamp a step quieter (saturate 0.9, brightness 0.94); by Day they print at full strength. A place page re-points `page-line` to a half mix of Sticker Ink and the hue.

### Tertiary (maple and the four laws)
- **Maple** (maple): the face of every tile, key-tile, plaque and the Say-it disc, always under a grain texture and a 172deg highlight gradient, and only in a round (and on the landing page's demo row, which is a round mechanic). Never a flat fill. **Maple Highlight** (maple-hi) is the lit top; **Maple Bevel** (maple-lo) is the pressed lower edge; **Rack Walnut** (maple-deep) is the shelf tiles stand on.
- **Marigold** (marigold): *right*. The lower edge of a correct tile, the tiles of a revealed spelling, and the Check key, because Check asks "is this right?". Its bevel is **Marigold Deep** (marigold-deep).
- **Coral** (coral): *wrong letter*. The tile edge plus a coral corner mark with an X.
- **Sky** (sky): *missing letter*. The underline of an empty square where a letter belongs, plus a sky corner mark with a plus.
- **Stone** (stone): *extra letter*. The tile edge plus a stone corner mark with a minus.

### Neutral
- **Chalk** (page-ink): all text on the page, focus rings, filled pips, caret and accent colour, and the face of the primary `go` key. By Day it is a deep jade ink.
- **Lichen** (page-muted): secondary text on the page (5.6:1 at Night, 6.0:1 by Day), empty pip rings, and slot labels.
- **Walnut Ink** (ink): text on maple and on the rack.
- **Foil Ink** (foil-ink): text on foil, the wordmark's letters, and the glyphs on the hub rail's white discs.
- **Soft Ink** (ink-soft): point numbers on tiles.

### Named Rules
**The One Law Rule.** Each law colour means one thing everywhere: marigold is right, coral is a wrong letter, sky is a missing letter, stone is an extra letter. Test: if you can't finish the sentence "this colour here means ___" with that colour's law, the colour is wrong.

**The Edge-Only Rule.** Feedback colour lives on tile edges (the `--tile-edge` bevel), underlines and the corner mark. It never goes on the letter or the tile face. Letter ink stays dark on every tile.

**The Marigold Is Earned Rule.** Marigold never marks a generic primary action. The primary non-check action is the chalk `go` key. On retry, correct letters lose their marigold, so marigold only confirms a finished word.

**The Mark Beside Colour Rule.** Every non-right law also carries a corner mark (X, plus or minus on a white-stroked disc) and an aria-label such as "b, wrong letter". Colour is never the only signal. Right carries no mark and is confirmed by the result line.

**The Place Hue Rule.** Each place has exactly one printed hue (spell, math, roxy) and it marks that place everywhere: its sticker, its topic stickers, its badges. A place hue is paint, never feedback, and text on it is always Sticker Ink. A new place gets a new hue that sits clear of marigold, coral, sky and stone.

**The Silver Foil Rule.** Stars, streak and milestone badges are holographic silver foil. Nothing that rewards is ever gold or marigold, because marigold means right.

**The Ticket Rule.** What games pay and spend is a ticket (`.ticket`): a berry stub with punched sides and a dotted perforation after its mark, with the count in Sticker Ink. Foil means practice and a ticket means play, so a ticket is never foil and a star is never a ticket. Free games show no wallet at all.

**The Two Lights Rule.** Night and Day share every token name. New surfaces use `page-*` colours and `--tone-*` shadow tones, never a hard-coded page hex or a fixed shadow rgb, so they light correctly in both. Only materials are fixed: maple, vinyl-cut and foil keep their colours in both lights, and their lift shadows still use `--tone-drop-deep`. Test: switch Settings → Day and Night; nothing disappears or inverts.

**The Wood Is Handled Rule.** Maple appears only where a kid handles letters or digits in a round: the answer row, the tile bank, the math problem row and keypad, the bee-question rack, the spoken plaque, and results. Everywhere else a word, a letter or a count is white vinyl. Test: if nothing on the screen is typed, tapped into place or checked, there is no wood on it.

## Typography

**Display Font:** Fredoka Variable (with ui-rounded, system-ui)
**Body Font:** Lexend Variable (with system-ui)
**Tile Font:** the per-child `--tile-face`, which is one of Fredoka (default), Andika, Lexend or Atkinson Hyperlegible.

**Character:** Rounded, geometric and lowercase-friendly. Fredoka gives tiles, headings and sticker labels a friendly, toy-like solidity. Lexend is the calm reading voice for definitions, sentences and parent copy. There are no condensed faces and no pixel faces.

### Hierarchy
- **Display** (600, 2.25rem to 3rem at md, -0.01em, balanced wrap): page and state headlines such as "Who's practicing?" and "12 words. Ready?".
- **Place name** (600, 3.5rem to 6rem by viewport, line-height 0.95, -0.02em): the one headline on a hub place page ("Spelling", "Play", "Math"), low on the left in Sticker Ink.
- **Place print** (700, up to 58vh, line-height 0.8, -0.03em, rotated -7deg): giant decorative lettering ("spell", "7×8") printed across a place face a tint off its hue (78% hue, 22% white) and cropped by the rim. `aria-hidden`, never read, never a label.
- **Wordmark** (700, 22px to 36px, -0.005em): "ȷade's world" as die-cut vinyl type; see Brand mark.
- **Headline** (600, 1.875rem): section heads such as "What shall we practice?", "Math: pick a topic" and "Kids".
- **Title** (500 to 600, 1.25rem to 1.5rem): list names, speller names, "Your badges", "Pick up where you left off", and the result line "Spot on!".
- **Body** (Lexend 400, 1rem, text-lg for feedback lines, max 40 to 60ch): definitions, sentences, helper text. Secondary copy uses Lichen at text-sm. Sticker notes ("1 word to review") are Lexend 500.
- **Label** (Fredoka 600, 1.05rem): all key labels and the hub's place tabs (1rem). Counters, foil numbers, rail counts and badge counts use tabular numerals.
- **Tile letter** (tile face 600, 0.56 of the tile edge, line-height 1): debossed with a light lower lip and a shadowed upper lip. Point numbers use Lexend 600 at 0.18 of the edge.

### Named Rules
**The Child's Face Rule.** Tile letters take their face from `data-font` on the play subtree (`fredoka`, `andika`, `lexend`, `atkinson`). Every tile uses `--font-tile`, never a hard-coded family, so a child's chosen face reaches every tile in the round. All four faces are bundled locally through @fontsource.

**The Lowercase Word Rule.** Words are shown as the speller types them, usually lowercase. Don't uppercase or letter-space tile letters, key labels or words on vinyl labels. Positive tracking appears only on PIN fields; the big Fredoka sizes (place name, place print) are tightened, never spread.

## Layout

Every route but the hub is a single centred column on the album page. The round uses max-width 64rem (`max-w-5xl`), profiles 64rem, the parent area 72rem (`max-w-6xl`), and results 56rem. Inline padding is 1.25rem, rising to 2.5rem at md (768px).

**One place at a time (subject hub).** A vertical stack of three full-viewport place pages in the order Spelling, Play, Math, so Learn and Play alternate and neither is ever two flicks away. The scroller is `100dvh` with mandatory scroll-snap (`snap-stop: always`), no scrollbar and contained overscroll; each page is one place face inset from the screen edge by `place-inset`, with the album page showing round its rim. Over whichever place fills the screen floats one fixed layer of chrome, inside the rim:
- **Top-centre:** the Places tabs, always naming all three.
- **Top-left:** the wordmark at 22px, from sm only (on a phone the tabs own the top).
- **Right rail, vertically centred:** the kid sticker (52px, links to profiles), the foil streak, the foil stars, and a badges "n/N" button that opens the badge sheet. Each is a 48px disc with its count beneath in Fredoka 600.
- **Low left, the caption** (max 42rem, right padding kept clear of the rail): the place name at Place-name size, one real line of what's waiting ("3 words to review", "Week 7 · 6 new words", "4 facts to review"), then one key row: the go key ("Let's spell", "Let's play", "Let's do math"), or a Continue key with "· n of N" plus "All lists"/"All topics" when a round is waiting. Play puts its wallet beside the go key, or the closed slot in its place.
- **Centre, the media,** `aria-hidden` and never UI: Spelling prints "spell" and stands the newest list's first three words as word stickers (46px, then 34px, tilted -4, 3, -2deg); Play stands the child's current Roxy look full height on a soft blurred floor shadow, without her stage backdrop; Math prints "7×8".
The hub opens on the place last seen this visit (`jade.hub.place.{childId}` in sessionStorage), else where a round is waiting, else Spelling. Arrow and Page keys, the tabs, a flick or a scroll move one whole place.

**Kid picker (profiles).** The wordmark (26px) and a Parents page key on top, then "Who's practicing?" over each child as a big round kid sticker (136px), tilted ±4deg alternately, with their name below in Fredoka 500. No cover card behind it; the sticker lifts 4px on hover.

**Spelling home.** The foil progress strip (streak, stars, words mastered), one `go` key chosen for the kid, then each list as a sticker on the raised page (the one up next tilted -1deg), with its first words as word stickers and one suggested way. Earned badges follow as pill stickers in a wrapping row, with the next badge as a dashed pill slot ("Next: …").

**Math topic picker.** A due-facts sticker in grape (three 56px vinyl fact discs fanned at -7, 0, +7deg, then the Review `go` key) above a stack of grape topic stickers, each with a 52px vinyl icon disc, Pips for its level and a Lichen hint. The Spelling home's due-words sticker fans 48px vinyl letter discs the same way.

**Spelling round.** Top to bottom: a thin top rail (exit key, kid sticker, mode and list label, a row of 14px progress tiles, and an n/N counter); the Say-it disc and a Slowly key; the bee-question rack; the spoken-answer plaque; the answer row with the Check or Next key at its right end; then the pips and status line. Vertical rhythm is gap-7 at rest. Rounds stay on the plain lit page: no place stickers, no foil; the only vinyl is the kid sticker in the rail.

**Math round.** The same rail (exit key, kid sticker, "Math · topic" label, progress tiles, n/N counter), then a smaller 64px Say-it disc labelled "Read it again", then a word problem's story on a plaque (max 52ch) when there is one, then the problem row, then the feedback line, then the keypad (max 24rem wide) or a Next / Finish key (3.5rem). The column is centred at rest with gap-6. Math never opens the on-screen keyboard, so the screen only needs `100dvh`.

**Row fit.** Tile rows never wrap: the answer row, the problem row, the reveal row, the landing demo row. `fitTile(width, count, max)` picks the tile edge as `floor(width / (n + 0.1(n - 1)))`, capped at 88px (84px for the problem row, 80px for the reveal row, 72px for the tile bank), sets the gap to 10% of the edge (at least 3px), then steps the edge down until the tiles plus rounded gaps really fit. Width is measured before the first paint, so a row never flashes at a default size. The row is sized for the longer of the target word and what's on it, so tiles don't jump in size while the speller types. Long words get smaller tiles, never two lines.

**iPad keyboard handling.** `useVisualViewport` writes the visual-viewport height to `--vvh` on `<html>` and flags the keyboard as up when that height is below 80% of the tallest height seen at the current width (reset on rotation; Safari shrinks `innerHeight` with the keyboard, so that can't be the yardstick). The round main uses `min-height: var(--vvh, 100dvh)` and locks to `--vvh` while the keyboard is up. In that state the rail drops the kid sticker and label, the Say-it disc shrinks to 60% (120px to 72px), the spoken-answer plaque hides, the Slowly and Check labels go screen-reader-only, and the column justifies to the top. The viewport meta sets `interactive-widget=resizes-content` and `viewport-fit=cover`.

**Targets.** Every key is at least 3rem (48px) tall; math keypad keys are 3.5rem. Icon-only keys are square: 44px (`size-11`) for the round exit and 48px for results' hear-word key. Check and Next are 3.5rem, and Start is 4rem. Place stickers are whole links at least 8rem tall. Hub tabs are 44px tall, and every rail item is a 48px disc or larger.

**Input.** A transparent full-size `<input>` overlays the answer row. It sets `autocorrect="off"`, `autocapitalize="none"`, `spellcheck=false` and `autocomplete="off"`, with 16px text (so iOS doesn't zoom), `enterkeyhint="done"` and a transparent caret. A tap on the row moves the caret to the nearest gap between tiles, iPhone-style, so a missed letter can go in mid-word without backspacing. The native caret is kept in step with that gap (`gapFromX` in `components/round/caret.ts`). The parent word entry field sets the same autocorrect trio.

Breakpoints are Tailwind defaults: sm 640px (the hub's wordmark appears), md 768px (place insets and caption padding grow, Roxy moves from the upper middle to the lower right of the Play face), lg 1024px.

## Elevation & Depth

Depth is physical material, not UI elevation, in three heights. **Lifted:** stickers, place faces, vinyl and foil sit just off the page on a soft two-part lift shadow, and an interactive sticker lifts 3px further on hover, as if a corner were being peeled. **On the page:** maple objects have an inset bevel on the lower edge, a 1px lit top edge, and a soft, low drop; page keys are barely raised. **In the page:** squares, fields, the disabled Check and pressed keys are recessed with inset shadows. Shadow units on tiles and keys are in `em`, so depth scales with tile size.

Shadow colours are tones, not fixed values, so depth reads in both lights: `--tone-drop` (Night `rgb(3 25 20 / 0.55)`, Day `rgb(22 74 58 / 0.26)`), `--tone-drop-deep`, `--tone-lit`, `--tone-key-line`, `--tone-recess` and `--tone-pit-lip`. Maple's own inner highlights (white lip, walnut bevel) stay fixed because maple doesn't change with the light.

### Shadow Vocabulary
- **Sticker** (`0 0.55rem 1.1rem -0.45rem var(--tone-drop-deep), 0 0.08rem 0.18rem var(--tone-drop)`; hover `0 0.9rem 1.5rem -0.5rem …, 0 0.1rem 0.2rem …` with `translateY(-3px)`): every sticker, over a 158deg gloss highlight in its `::before`.
- **Place face** (`0 0.7rem 1.4rem -0.5rem var(--tone-drop-deep), 0 0.1rem 0.2rem var(--tone-drop)`): the screen-sized sticker of a hub place, under a softer gloss band (158deg, white 20% to 5% by 30%).
- **Vinyl** (disc and kid sticker: `inset 0 -0.05em 0 rgb(18 51 44 / .1), inset 0 0 0 1px rgb(18 51 44 / .06), 0 .04em .1em rgb(3 25 20 / .25), 0 .16em .32em -.1em var(--tone-drop-deep)`; word label: `inset 0 -.08em 0 …, 0 .06em .12em …, 0 .2em .4em -.16em var(--tone-drop-deep)`): in `em`, so the lift scales with the sticker. A strong gloss (158deg, white 70% to 10% by 36%) sits in `::before`.
- **Vinyl type** (`drop-shadow(0 .05em .04em rgb(3 25 20 / .3)) drop-shadow(0 .12em .16em var(--tone-drop))`): the wordmark, lifting the whole cut as one piece.
- **Foil** (`inset 0 1px 0 rgb(255 255 255 / 0.8), 0 0.3rem 0.6rem -0.25rem var(--tone-drop-deep)`): streak and star chips, milestone badges, a kid sticker's number chip.
- **Tile** (`inset 0 -0.3em 0 var(--tile-edge), inset 0 1px 0 rgb(255 255 255 / .6), inset 0 0 0 1px rgb(120 78 34 / .12), 0 .35em .7em -.1em var(--tone-drop)`): every letter tile. The bevel colour is the law slot.
- **Key-tile / Check** (`inset 0 -0.22em 0 var(--key-edge), inset 0 1px 0 rgb(255 255 255 / .55), 0 .3em .6em -.15em var(--tone-drop)`): maple keys. On press the key drops 0.12em and the bevel thins to 0.08em.
- **Plaque** (`inset 0 -0.2em 0 maple-lo, inset 0 1px 0 rgb(255 255 255 / .55), 0 .3em .6em -.2em var(--tone-drop)`).
- **Rack** (`inset 0 1px 0 rgb(255 230 190 / .35), inset 0 -.35rem 0 rgb(80 48 18 / .45), 0 .4rem .9rem -.2rem var(--tone-drop-deep)`).
- **Page key** (`inset 0 1px 0 var(--tone-lit), inset 0 0 0 1px var(--tone-key-line), 0 .25em .5em -.2em var(--tone-drop-deep)`). The `go` key adds a chalk bevel (`inset 0 -.18em 0`). The key-line outline keeps a raised key visible on the pale Day page.
- **Patch** (`inset 0 1px 0 var(--tone-lit), inset 0 0 0 1px var(--tone-key-line), 0 1px 0 var(--tone-recess)`).
- **Recessed** (square and disabled Check: `inset 0 .2em .5em var(--tone-recess), inset 0 -1px 0 var(--tone-pit-lip)`; field and pressed key: `inset 0 .15em .4em var(--tone-recess)`).

### Named Rules
**The Grain-Not-Flat Rule.** Every maple surface stacks a grain texture over a 172deg highlight gradient. Tiles pick one of four grain variants (`data-grain` 0 to 3, derived from the letter or index), so neighbours rarely match. A flat maple fill is a defect.

**The Page Is Lit Rule.** The body stacks page mottle (512px), paper tooth (128px) and `--page-light`, fixed to the viewport: at Night a warm lamp pool at the upper left over a radial falloff to page-deep; by Day a 118deg gloss band over a daylight radial. New surfaces sit on this page; they don't paint their own opaque backgrounds.

**The Peel Rule.** Only stickers lift. A sticker that is a link or button rises 3px on hover (a kid sticker on profiles, 4px) and presses 1px on tap, keeping its tilt; a sticker that is just a picture (an earned badge, a word label, a place face) never moves after it is placed.

## Shapes

Corners are soft and proportional. Tiles and squares use an 18% radius at every size. Keys (0.85rem), fields (0.8rem), plaques (0.7rem), racks (0.9rem) and patches (1.25rem) are gently rounded rectangles. Stickers are die-cut with a generous 1.5rem radius and a 0.35rem vinyl rim; badge stickers tighten to 1rem, and inline badge stickers and foil chips are full pills (with a 3px rim on the pills). A hub place face is the biggest sticker: 2rem radius, 0.4rem vinyl rim, clipping its media. The badge sheet is 1.75rem with a 0.35rem rim. The vinyl family is round: kid stickers and discs are circles, word labels are pills, and the wordmark's cut follows every letter. Slots are 1.1rem with a 2px dashed outline (round when they stand beside discs). The Say-it control is a fully round maple disc. Pips are full pills.

Tilt is part of the form. Stickers carry a small fixed tilt (`--tilt`): place stickers ±1.5 to 2deg, kid stickers on profiles ±4deg, word stickers on the Spelling place -4, 3, -2deg, fanned discs -7, 0, 7deg, badge stickers cycling through -5, 4, -3, 6, -4, 3, -6, 4deg by position, so the page looks pressed by hand but never shifts between visits. Place faces themselves stay square to the screen; their print is turned -7deg. Tiles in the Tiles-mode bank are scattered with a deterministic rotation of -4 to +4 degrees. The wordmark is turned -2deg and the icon's j -6deg. There are no hairline borders on maple; fields carry a 1px page-line border.

## Components

### Buttons (the key)
One class, `.key`, with variants set by `data-variant`. The hierarchy follows what the object *is*.
- **Shape:** gently rounded (0.85rem), at least 3rem tall, 1.1rem inline padding, Fredoka 600 at 1.05rem, and an icon gap of 0.5rem.
- **Page key (default, no variant):** raised page with chalk text. It is every ordinary action: nav, Done, Add, Try again, the exit, and take-back. The markup often writes `data-variant="felt"`, a leftover name; no CSS rule targets it and it renders the default.
- **Go (`data-variant="go"`):** the chalk face with page-deep text and a chalk bevel. It is the one primary non-check action per view: Continue, Review, Bee, Save list, Next word, Practice missed, Create. On a place sticker or a hub place page it inherits Sticker Ink, so it reads as a light key on the hue with dark hue-ink text: "Let's spell", "Let's play", "Let's do math".
- **Tile (`data-variant="tile"`):** grained maple. Only for things the speller handles: Slowly, the bee questions (Definition, Sentence, Origin) and results' hear-word.
- **Check (`data-variant="check"`):** a marigold-tinted maple face with a marigold-deep bevel, at the right end of the answer row. The label becomes screen-reader-only below sm and while the keyboard is up.
- **Hover / Active / Disabled:** hover sets brightness to 1.08. Active translates 1px (maple keys sink 0.12em and thin their bevel). Disabled drops to 0.45 opacity with a not-allowed cursor. A disabled Check is the exception: it sits as an empty recess in the page pit (Lichen label) instead of a faded marigold, which reads olive. Focus uses the global chalk ring (3px, offset 3px).
- **Selected (`data-pressed="true"`):** pressed into the page, with a page-deep face and an inset shadow. Use it for segmented choices (sign-in or sign-up, list import tabs, Settings → Day and Night: Auto, Day, Night) and the active parent nav item (alongside `aria-current="page"`).
- **Toggle on (`data-toggle` with `data-pressed`):** a chalk bar under the label on top of the pressed recess, plus a check where the label has room, so a row of "on" keys never reads as disabled. Navigation keys stay plain pressed.

### Sticker
A die-cut vinyl sticker pressed onto the page: a printed face (`--sticker-face`), a 0.35rem vinyl rim, a gloss highlight across the top-left (158deg, white 30% fading out by 35%), the lift shadow and its own tilt.
- **Place stickers (`data-place="spell" | "math" | "roxy"`):** print the place hue and switch the contents to Sticker Ink (`page-ink`, `page-muted` and `page-deep` are re-pointed inside, so keys, pips and muted text follow). Used for math topic stickers, the due-facts and due-words stickers, and the Play home's games. On the hub the same re-pointing applies to a whole place page (see Place page).
- **Plain stickers (no place):** print the raised page with page ink. Used for list stickers on the Spelling home.
- **Badge stickers:** earned badges, faced by `badgeFace`: milestones (medal, trophy, library) are foil; the rest take a place hue (sprout spell; sparkles and flame roxy; star, grid and pie math). Never a law colour. Square on the hub's sheet, pills inline on the Spelling home and on results ("New badge: …").
- **States:** a link or button sticker lifts 3px on hover and presses 1px on tap, keeping its tilt. Focus uses the global chalk ring.

### Foil
Holographic silver: a 118deg gradient through silver, periwinkle, lilac and mint, with foil-ink text, a 0.2rem vinyl rim and a bright top lip. It is a full pill by default. Uses: the hub rail's streak and star discs (48px, lucide Flame and Star, count beneath), the number chip on every kid sticker, the star dotting the wordmark's j, the Spelling home's progress strip (1rem radius), "stars to spend" chips, the Play home's holiday-collection chip, the town's finds count, and milestone badge stickers.

### Ticket
The games' money, printed in Play's berry: a stub whose sides are punched out (a mask, so it carries no outer shadow) with a gloss band and a dotted perforation between the lucide ticket mark and the count. On the hub's Play caption (beside "Let's play") and the Play home it sits beside a foil "stars to spend" chip only while a parent lets stars pay in games; in a game's corner it is as tall as the 48px glass keys.

### Learn and Play
On the hub Learn and Play take turns: Spelling, then Play, then Math, each a full place page with the same billing. The rail's foil star counts every star ever earned. When Play is closed (practice first not met, or out of play time) the Play caption swaps its line, go key and wallet for a small `.slot` that says what opens it ("Earn 6 more stars today", "6 of 10 stars") or offers minutes for stars, plus a "See the games" page key, and Roxy still stands on the face; on the Play home the games stay under it as `.slot` silhouettes (each game's art in the slot's ink, `.silhouette`), and they wait there too until Play has answered, so a shut game never flashes open; the first time it opens on a day, the Play face is placed with `sticker-place`. In a game, play time is a glass pill of whole minutes ("12 min", then "1 min left", announced once), never ticking seconds; when it runs out a glass sheet ("That's your play time", "Back to Play") covers the scene over a page-deep scrim.

### Slot
An empty sticker place printed on the page: a 2px dashed page-line outline, a faint page-deep wash, and the badge's lucide icon as a silhouette at 70% opacity. Its label sits below (or inside, on a pill slot) in Lichen, and screen readers hear "(not yet)". A slot never animates and never takes a hue.

### Place page
The hub's unit: one place filling the viewport as one big sticker pressed onto the page. Each is a snap-aligned `100dvh` section carrying its hue in `data-place` (which re-points the page tokens to Sticker Ink, as on a place sticker), with an absolutely inset place face: the hue, a 0.4rem vinyl rim, a 2rem radius, the place-face lift and one soft gloss band, clipping everything inside. Media sits behind (`aria-hidden`); the caption sits above it on the lower left. The current page's caption rises in once it lands (`place-rise`); the other pages hold still.
- **Places tabs:** a pill track (black at 15% over the hue, 4px padding) of three 44px Fredoka 600 tabs. The current tab is a filled Sticker Ink pill with its label in the current place's hue and `aria-current="location"`; the others are Sticker Ink at 85%. They follow the scroll, never the other way round.
- **Rail:** white and foil discs (48px) stacked down the right edge with 1.25rem gaps, counts beneath in Fredoka 600 with a soft dark text shadow so they read on any hue. Practice counts are foil; the badges button is a white disc with a foil-ink lucide Award.
- **Print:** see Typography. It is decoration for Spelling and Math only; Play's centre belongs to Roxy.

### Vinyl
The white die-cut material for identity and words outside a round: a radial white (pure white at the upper left, through #f6faf8, to #e2ebe7), Vinyl Ink text in Fredoka 600, the vinyl lift and a strong gloss in `::before`. It is fixed in both lights and reads on the page or on any hue.
- **Kid sticker (`KidTile`, `.kid-sticker`):** a child's identity: a round vinyl disc with their initial at 0.52 of its size, and their chosen number on a foil chip (at least 22px, 0.38 of the size) stuck over the lower-right edge. 136px on profiles, 64px in parent progress, 52px on the hub rail, 48px in play headers, 40px in round rails, 44px in the parent's number picker. The component keeps the name `KidTile` though it is no longer wood.
- **Disc (`.vinyl-disc`):** a small round vinyl sticker holding one letter, one fact or one icon: the fanned due-word letters (48px) and due facts (56px), math topic icons (52px), and the loading dots (40px, 20px in the photo reader).
- **Word sticker (`.word-sticker`, `WordRack`):** a word on a vinyl pill label, sized as 0.72 of the tile edge the caller gives, one line, never tracked or uppercased. Every list word outside a round wears one: hub media, Spelling home list previews, the parent's This week and list editor, parent progress trouble words and facts. Earned badges in parent progress and the Roxy studio's item counts and "Gift opened" use the same label with a lucide icon. With `dropDelay` it is placed with `sticker-place`.

### Badge sheet
The rail's badges button opens a native `<dialog>`: a light sheet in Day's tokens in both lights (`scene-day`, raised page, 0.35rem vinyl rim, 1.75rem radius, max 34rem) over a 55% black backdrop. "Your badges · n of N" in Fredoka with a square Close page key, then the badge grid: 3 columns (4 from sm) of 64px (72px at md) badge stickers and slots, labels in xs. Earned badges are placed with `sticker-place` 60ms apart. Esc, Close or a tap on the backdrop closes it, and the arrow keys stop moving places while it's open.

### Tile
The maple letter tile, only in rounds, results and the landing demo row. `size` is the edge in px, from 14 (progress rail) to 88 (answer rows). The letter is 0.56 of the edge, and an optional point number sits bottom-right at 0.18. `law` sets `data-law`, which recolours the lower bevel and adds the corner mark (a disc at 24% of the edge, minimum 12px). A letter tile is `role="img"` and its label includes the law.

### Square
An empty place for a tile: recessed into the page pit, 18% radius. The active square (the next slot during spelling or retry) gets a 2px chalk ring at 70% opacity with a page offset, but only while the caret is at the end of the word. A **missing-letter square** adds a sky underline (`inset 0 -0.3em 0 sky`) and the label "missing letter".

### Pips
Five 9px mastery dots (Leitner box 1 to 5, or a math topic's level). Filled dots are chalk and empty dots are a 1.5px Lichen ring. The same ramp is used in play, results and parent progress; on a place sticker they print in Sticker Ink. The label reads "Mastery n of 5", "Level n of 5" or "New word". On maple, pips sit on a page-deep pill at 80% opacity.

### WordTiles
A whole word as a small tile rack with a 3px gap, used in results (34px). It takes optional per-letter laws. Results show the correct word in all-marigold beside the attempt, with coral, sky and stone marks.

### AnswerRow
The play row. It holds typed tiles, then squares (every remaining square when the length hint is on, otherwise one caret square). When the speller taps back into the word, a thin chalk **caret bar** (about 6% of the tile wide, 80% tall, blinking unless reduced motion is on) sits in that gap instead of the ring. Typed tiles are keyed by letter rather than by position, so a letter put in mid-word drops in where it goes and the rest stay still. After Check, the row shows the grade alignment, with missing letters as sky squares in place. A feedback note bubble (page-deep, with an arrow) points at the first flagged cell. The trailing slot holds Check or Next. See Layout for the fit rule.

### Plaque, Rack, Patch
- **Plaque:** a small maple object (0.7rem radius, grain 3) for the spoken definition or sentence in a spelling round and a word problem's story in a math round. Never a flat fill, and never outside a round.
- **Rack:** the walnut shelf tiles stand on. It holds the bee questions and the results scoreboards of missed words and problems.
- **Maple fill (`.maple`):** grain and gradient for maple shapes that aren't tiles, such as fraction-bar pieces and array counters in math explanations.
- **Patch:** a calm printed panel on the page (page-raised at 70%, 1.25rem radius, a 1px top light and a key-line outline). It is a slightly raised area of the same page, not a card. It holds "Pick up where you left off", Confirm and parent panels.

### Inputs / Fields
- **Style:** recessed page pit, chalk text, a 1px page-line border, 0.8rem radius, at least 3rem tall. Selects draw a Lichen chevron in inline SVG (one per light).
- **Focus:** the global chalk outline at a 1px offset.

### Navigation
The parent header puts the wordmark (22px) on the left. On the right are page keys: Lists, Kids and Settings, with the current section `data-pressed` (list and progress pages count as Lists and Kids), then Practice with a back arrow, set apart from the section keys. On a phone the three section keys drop to their own full-width row. Sign-out lives in Settings → Account and on the PIN gate, never beside Practice. Sub-pages open with a page back key ("← Lists", "← Kids"); play screens open with "← Subjects".

**Wordmark (`Brand`).** "ȷade's world" cut from vinyl: Fredoka 700 letters in Foil Ink on a white cut that follows every letter (the same text drawn behind with a 0.36em white stroke, grown into the counters with stacked white drop-shadows), the vinyl-type lift, turned -2deg. The j is dotless and a holographic foil star (0.4em, foil-ink outline) is stuck on where its dot would be. It brings its own white, so it reads on the page in either light and on any place hue. Sizes: 36px on the landing page, 26px on profiles, 22px in the parent header and on the hub.

**App mark.** The icon is the three places stacked as the hub shows them, Spelling jade over Play berry over Math grape in equal bands, parted by thin Sticker Ink vinyl seams under a light gloss, with one white vinyl "j" (a rounded ink stroke in Foil Ink inside a wide white cut) and its foil-star dot lifted over them at -6deg. The favicon variant drops the seams and draws a bigger, flatter star so it holds at 16px. All icons and splash screens come from `apps/web/scripts/icon-mark.mjs` via `scripts/icons.sh` and `scripts/splash.mjs`. The maskable icon keeps the mark inside the central 80% circle; the iOS touch icon is full bleed on berry.

Parent word lists show each word as a word sticker that never wraps. Words read from a photo wear a dashed Lichen outline and a small "check" until the parent fixes or accepts them; they are placed one after another as they arrive, while vinyl discs beside a round slot show the sheet being read.

The parent landing page is **This week**: current lists as patches (word stickers for the first words, then each kid it's for as a small kid sticker with their own "played Tuesday · 8 of 12 mastered"), past lists folded under a key with "Use again", and grade packs folded under "Start from a grade pack".

The kids' Spelling home has exactly one chalk `go` key, chosen for the kid: carry on an unfinished round, else review due words, else the newest list's suggested way. The three ways are explained once, in words, above the lists; hints never live only in a tooltip. Starting a new round while one is unfinished asks in place first.

Errors in parent screens are a `Problem` note: a recessed page-deep bubble with a lucide alert mark, never coral. Status text ("Saved", "Saving…") stays plain Lichen, so the two never look alike.

### Keypad
The only math input: real buttons, never a text field, so the iPad keyboard never opens. A 3-column grid (0.5rem gap, max 24rem) of maple tile keys 7–9 / 4–6 / 1–3, then 0 and a page delete key. A fraction bar or decimal point key appears beside 0 only when the problem needs it; otherwise 0 spans two columns. Comparison problems swap the digits for a row of `<` `=` `>` maple keys with a page Clear key. A full-width Check key sits below; it's an empty recess until there's something to check. Keys are 3.5rem tall (3rem in the compact variant) at 1.5rem type. A laptop keyboard types into it too (digits, `/ . < = >`, Backspace, Enter, ↑ to hear it again).

### ProblemRow
The problem laid out on the page, sized by `fitTile` from its total characters (capped at 84px). **The Chalk Operator Rule:** only numbers and the answer are tiles, because only they are handled; operators (+ − × ÷ = < >) are chalk marks drawn on the page in Fredoka 600 at 0.6 of the tile edge (0.38 for "of"), 0.62 of the edge wide. Each digit is its own maple tile (6% gap). A fraction stacks its numerator tiles over a 4px chalk bar over its denominator tiles, at 72% of the row's tile size. The answer slot is an active square; typed digits drop in with a half-size caret square after them; after Check the answer tiles take their law (right or wrong) and flip in the usual cascade. The row is one `role="img"` whose label reads the problem aloud ("7 times 8 equals blank").

### Math explanation
A second miss opens a recessed well (page-deep at 60%, 1.5rem radius): "The answer is" beside the answer in marigold tiles dropping in one per beat, the working in body type (balanced wrap), and a picture when one helps. **Dot array:** grained maple discs 8–18px on a page-deep panel, rows × columns, for facts up to 10 × 10. **Fraction bars:** 28px bars with a Lichen ring, split into equal parts, the counted parts grained maple and the rest recessed page, each labelled n/d in tabular figures. Results repeat the same language on the rack under "Worth another look": the problem, its answer in marigold tiles, the first wrong answer in coral-edged tiles.

### Confirm
The in-place "are you sure?" that replaces the browser's confirm box: a patch (1rem padding) that appears where the action was (under the round's rail, inside the kid's row, beside Save and Delete). A Fredoka 1.125rem question, an optional Lichen note, then two page keys: the safe choice first ("Keep going", "Cancel") and focused, the action second. Escape backs out, and a round's own keys pause while it's open. It is an `alertdialog`, not a modal: nothing behind it is blocked or dimmed.

### Pending
When a screen's data takes longer than about a second, the page shows three 40px vinyl discs placed with `sticker-place` (120ms apart) beside a round dashed slot, over "Getting things ready…" in Lichen. One placing, no looping spinner.

### Motion
- **sticker-place** (320ms, ease-out-expo; from -14px, turned 7deg further anticlockwise than its tilt, at 1.07 scale, settling at its own `--tilt`): earned badges on the badge sheet (60ms apart), new badges on results (from 300ms, 120ms apart), the Pending discs, arriving word stickers, and the Play face the first time Play opens on a day.
- **place-rise** (520ms, ease-out-expo; from 0.9rem lower at 35% opacity): the current place's caption once its page lands. It starts mostly visible, so a skipped frame never hides it; under reduced motion it doesn't run at all, and places snap without smooth scrolling.
- **sticker lift** (180ms transform and shadow, ease-out-expo): hover and press on interactive stickers.
- **tile-drop** (240ms, ease-out-expo `cubic-bezier(0.16, 1, 0.3, 1)`; from -18px at 1.06 scale to rest): typed tiles, revealed tiles and stars. Staggers are 70 to 140ms for decorative rows.
- **tile-flip** (420ms, a rotateX to 88 degrees and back): on Check, judged tiles flip in a left-to-right cascade at 55ms per tile, revealing edge colour. The cascade replays each Check through the tile key.
- **tile-nudge** (360ms, -5px then +4px): the whole row on retry.
- **tile-land** (420ms, from -56px at 1.14 scale with a small settle): star tiles on a results screen with two or three stars.
- **Perfect round:** after the stars land, they flip left to right (110ms apart) and each comes up with a marigold edge at the flip's midpoint. This is the celebration; there is no confetti or particle effect.
- **Reveal:** the correct spelling drops in one tile per spoken letter.
- **Reduced motion:** a global rule forces animation and transition durations to 1ms with one iteration and no delay, so stickers appear placed and the reveal shows the whole word at once (`prefersReducedMotion()`).

### Roxy stage (Games)
Roxy is the one place character illustration lives. The character is a hand-authored, layered SVG doll (`apps/web/src/components/roxy/`), drawn on one body template (viewBox 400×640) so every item fits the slim, medium and round bodies.

- **Where it can appear:** only on game screens, item thumbnails, the gallery, the Play home, and the child's current look standing full height on the hub's Play face (without her stage backdrop). It never decorates other screens.
- **Colours:** Roxy's fabric, skin, hair and makeup palettes live in `@jade/core/roxy` (`palettes.ts`). They are paint, not feedback. The four law colours never mean right or wrong here, and no UI chrome around the stage uses them.
- **Outlines:** one soft dark line (`LINE` in `geometry.ts`), never pure black. Shading is the item's own colour darkened.
- **Motion:** the same rules apply. The moon gem's transform is a `tile-flip` of the stage. There are no sparkles, particles or looping animation.
- **Diversity:** 14 skin tones, 3 body shapes, and hair textures from straight to coily, locs and braids, with no default doll.
- **Holidays:** collections are joyful and accurate, never caricature. Religious symbols appear only as stage decoration, never as costumes.

### Roxy's world (three.js)
Games are built with three.js. The world is a doll's house and a little town, not a video game: seen from a raised corner (orthographic), so it reads like a picture-book page.

- **Roxy is a 3D toy.** She's built in code from soft rounded shapes with the same three-step toon shading as the furniture, and stands about three squares tall with a big head. Her face (eyes, brows, mouth, makeup, face paint) is the studio's own face art wrapped onto the front of the head, so every face option works in 3D. Pets are 3D too, drawn 1.5× life size next to her, as toys are.
- **Studio stage:** Roxy on a round stage with her chosen backdrop behind (the stage art, cropped to fill the screen, never stretched). Drag to turn her; she eases back to face you. Poses (stand, wave, hands on hips, cheer, twirl) save with the look.
- **Furniture is toy-like:** rounded shapes, flat pastel colour, three-step toon shading, soft light, no hard shadows (a faint round shadow sits under Roxy and her pet). Fabric colours come from the same palette as clothes.
- **Town places are dioramas:** each sits on a board you can see the sides of (turf and soil outdoors, a timber plinth indoors) with a soft table shadow under it, and the park is one corner of a street of shops and houses. The sun casts soft, light shadows from the front-right (never hard or black); Roxy and her pet keep their faint round shadow instead. It's always daytime in the town: Night themes the album and the glass chrome, never a game's scene. Hidden finds twinkle now and then, and a find pops in a glow and a ring of little stars.
- **Camera:** the home is fixed (its room has no front or right walls). In town places a drag turns the view up to 30° either way and it eases back after a moment; it snaps back under reduced motion. No zoom, no swoops.
- **Walking:** tap the ground and she walks there, or walk her with WASD or the arrows (a stick on touch screens) and hop with Space (the Hop key). Walking up to a find or a hotspot shows a prompt: "Press E to pick up the golden acorn" (a button on touch).
- **Motion:** a short walk with a gentle bob, a hop, a slow breath while standing, and the pet trotting after. All of it stops under reduced motion. No confetti or camera swoops.
- **Every action has a button too,** so nothing is canvas only.

### Game screens
Studio, home and places fill the window with the scene. Their chrome is the one exception to "nothing floats": small and in the corners, so the scene is the screen.

- **Glass:** chrome over a live scene is `.glass`, frosted page (`page-raised` at 72% with a 14px blur), so it re-tints with Day and Night. Never use it on album pages.
- **Top-left:** a round back `.orb`, then the masthead: a big Fredoka title whose second word is berry ("The **park**", "Roxy **and Mochi**"). The build also sets a tiny uppercase tracked line over it (`.eyebrow`); that line is carried, not a pattern for new surfaces.
- **Top-right:** round 48px `.orb` icon keys (each named by its aria-label, shown as a tooltip), led by play time (when it costs stars), the ticket and, when linked, the stars to spend: screen links, Go to…, Full screen, Show/Hide panel.
- **Bottom-left:** keyboard hints with `.kbd` keys on a mouse-and-keyboard screen; the stick on a touch one. **Bottom-right:** the status line (a berry dot and "2 of 5 found"). **Bottom-centre:** the action row (Undo, Save look) or the prompt.
- **Panel:** a floating glass sheet, on the right on wide screens and along the bottom on narrow ones. It starts open in the studio and when decorating, closed in places, and remembers what the kid chose.
- **Go to…:** a dialog listing the studio, Roxy's home and every place, with "· here" on the current one.
- **Backdrop:** `--scene-top` → `--scene-ground`, pale sky to sand in both themes (games are always daylit). Words printed straight on the scene, not on glass (the masthead, keyboard hints), use `.scene-day`, which carries Day's tokens, so they stay dark ink on the light sky at Night.
- **Loading:** a soft berry drop breathing (`.breathe`) and "Getting Roxy ready…".

## Do's and Don'ts

### Do:
- **Do** put feedback colour only on `--tile-edge`, underlines and corner marks. Test: with the law colours desaturated, every judged tile still shows an X, plus or minus mark, and its aria-label names the law.
- **Do** use maple (tiles, `data-variant="tile"` or `"check"`, plaques, racks) only in a round, for things the speller handles. Test: if a key isn't part of listening to, asking about or checking the word, it's a page key; if the screen isn't a round or its results, it has no wood.
- **Do** show words, letters and counts outside a round as white vinyl: a word sticker for a word, a vinyl disc for a single letter, fact or icon, a kid sticker for a child.
- **Do** keep kid stickers at 40px or larger, so the foil chip never covers the initial.
- **Do** use exactly one `go` key per view for the primary non-check action, in chalk.
- **Do** mark selection with `data-pressed="true"` (plus `aria-current` for nav), never with a colour change.
- **Do** make each place a sticker in its own hue (spell, math, roxy) with Sticker Ink text, and give it a small fixed tilt (±1.5 to 2deg). On the hub, a place is a whole place page: one name, one line of what's waiting, one go key, and media that is never UI.
- **Do** keep the hub's tabs naming all three places, in the order Spelling, Play, Math.
- **Do** print stars, streak and milestone badges on holographic silver foil.
- **Do** show anything not yet earned as a dashed slot with its silhouette and a Lichen label that says what it is.
- **Do** colour new surfaces with `page-*` tokens and `--tone-*` shadows, and check them in both Day and Night.
- **Do** size answer tiles through `fitTile` so tile edge and gap scale together (gap = 10% of the edge). Test: a 15-letter word at 375px fits on one line.
- **Do** size round screens to `var(--vvh, 100dvh)` and collapse the rail while the keyboard is up. Test: on iPad with the on-screen keyboard up, the Say-it disc, the answer row and Check are all visible.
- **Do** keep every tap target at least 44px: text keys are 48px or more, and square icon-only keys are 44 to 48px.
- **Do** set `autocorrect="off"`, `autocapitalize="none"` and `spellcheck={false}` on any field that takes a spelling.
- **Do** render tile letters in `--font-tile` so the child's chosen face applies.
- **Do** keep motion to sticker-place, place-rise, tile-drop, tile-land, tile-flip and tile-nudge on ease-out-expo, and check each new animation under `prefers-reduced-motion`.
- **Do** take math answers on the keypad only. Test: a math round has no `input` or `textarea` anywhere.
- **Do** draw operators as chalk marks on the page; only numbers and answers are tiles.
- **Do** ask "are you sure?" in place with Confirm, with the safe choice first and focused.

### Don't:
- **Don't** use marigold for a generic primary, "start" or "continue" action. Marigold means right.
- **Don't** use coral, sky or stone for anything except wrong, missing and extra letters: no coral error banners, sky links, stone disabled states, or law-coloured stickers.
- **Don't** make a reward gold. Foil is silver; a place hue is paint, not praise.
- **Don't** tint a tile face or colour a letter's ink to show feedback.
- **Don't** fill maple flat or use raster wood. Every maple surface carries a grain texture over the 172deg gradient.
- **Don't** put white cards, flat panels or opaque page backgrounds over the album page. White is vinyl only: a sticker's rim, a place face's rim, a kid sticker, a disc, a word label, the wordmark's cut. Parent panels are `patch`.
- **Don't** spell a word in tiles outside a round, or put a child's initial on maple. Wood says "handle this".
- **Don't** put dark ink straight on a place hue; text on a sticker face is Sticker Ink. Dark ink on a hue only ever sits on its own white vinyl or a Sticker Ink key.
- **Don't** randomise tilts per render; a sticker keeps the tilt it was placed with.
- **Don't** hard-code a Night hex or a fixed shadow rgb on a new surface; it breaks Day.
- **Don't** let the answer row wrap onto two lines.
- **Don't** add floaty fades, long easings or looping motion.
- **Don't** use condensed or pixel faces, or uppercase tile letters.
- **Don't** use the browser's `confirm()` or a modal for a yes/no; they belong to no part of the album.
- **Don't** add particle effects (confetti, sparkles). Celebration is stickers being placed and star tiles landing and, on a perfect round, flipping to marigold.
