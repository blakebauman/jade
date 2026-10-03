---
name: Jade's World
description: A sticker album on jade pages that fills up with practice, where every letter is a maple tile you can check piece by piece.
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
  pip: "9999px"
spacing:
  tile-gap: "10% of tile edge (min 3px)"
  word-gap: "3px"
  key-inline: "1.1rem"
  key-min-height: "3rem"
  rack: "0.5rem 0.75rem 0.9rem"
  vinyl-rim: "0.35rem"
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
---

# Design System: Jade's World

## Overview

**Creative North Star: "The Sticker Album"**

Jade's World is a sticker album that fills up. The ground on every route is a glossy album page in jade, and practice earns what goes on it. The album's places (Spelling, Math, Games) are die-cut vinyl stickers pressed onto the page, each printed in its own hue. Badges are stickers too, stuck down at a small tilt once earned and printed as dashed empty slots until then. Stars and streak are holographic silver foil. Inside every place the speller still handles maple letter tiles, and the four law colours still judge them letter by letter.

The page has two lights and one set of token names. **Night** (the default in CSS) is the deep jade page under a warm reading lamp that pools on the upper left. **Day** is a mint-jade liner page in daylight, with the page's gloss catching it in one soft diagonal band. The parent picks Auto, Day or Night in Settings; Auto follows the device's light or dark setting live. Every surface reads `page-*` and `--tone-*`, so it works in both lights without a second rule.

Density stays low during a round, where the word is the only subject and the album recedes to a plain lit page. The hub is a two-page spread; parent screens use the same page at lower intensity, with patches, page keys and small tile racks for words. Depth is physical: stickers lift off the page, tiles sit on it, squares and fields are pressed into it. Textures are authored SVG turbulence with no raster assets. Motion is short and physical: stickers are placed, tiles drop, flip and nudge. Nothing floats or loops.

**Key Characteristics:**
- A jade album page on every route, in two lights (Night under a lamp, Day with a gloss band), with paper tooth and mottle.
- Die-cut vinyl stickers for the album's places and earned badges: printed hue face, white vinyl rim, gloss highlight, soft lift shadow, fixed small tilt.
- One printed hue per place: jade for Spelling, grape for Math, berry for Roxy and Games. None is a law colour.
- Holographic silver foil for stars, streak and milestone badges, never gold.
- Dashed slots printed on the page for anything not yet earned.
- Maple tiles for everything the speller handles, judged by four law colours shown only on edges, underlines and corner marks.
- Rounded Fredoka for display and tiles, Lexend for reading, and a per-child tile face.
- Short physical motion (sticker-place, tile-drop, flip cascade, nudge), all collapsed under reduced motion.

## Colors

A jade page in two lights, three printed place hues, silver foil, warm maple for handled objects, and four law colours that each carry a single meaning.

### Primary (the page)
Night values are the frontmatter's unsuffixed keys and the CSS default; Day values (`-day` keys) replace them under `:root[data-theme="day"]` with the same variable names.
- **Jade Page** (page / page-day): the album page. It is the centre of the page light and the colour under every texture. It is also the browser `theme-color`, switched per light before first paint.
- **Page Shadow** (page-deep / page-deep-day): the far edge of the page light, the html background, pressed keys, the `go` key's text, and note bubbles.
- **Raised Page** (page-raised / page-raised-day): resting page keys, the `patch` panel at 70% opacity, and a sticker's face when it has no place.
- **Page Seam** (page-line / page-line-day): field borders, list dividers at 50% opacity, the scrollbar thumb, and the dashed outline and faint silhouette of an empty slot.
- **Page Pit** (page-pit / page-pit-day): where a tile goes. Empty squares, fields, the disabled Check recess and unpractised cells in the parent progress grid.

### Secondary (the album's stickers)
- **Vinyl** (vinyl / vinyl-day): the white die-cut rim of every sticker and foil chip, and the stitches down the album spine.
- **Spelling Jade** (spell): the printed face of the Spelling sticker and of spelling-flavoured badges.
- **Math Grape** (math): the printed face of the Math sticker, every math topic sticker, the due-facts sticker and math badges.
- **Roxy Berry** (roxy): the printed face of the Games sticker, the Roxy sticker and Roxy-flavoured badges.
- **Sticker Ink** (sticker-ink): all text, pips and keys printed on a place hue. A placed sticker re-points `page-ink` to it, so contents need no special casing.
- **Holographic Foil** (a 118deg silver-to-periwinkle-to-lilac-to-mint gradient, ink foil-ink): stars, streak and the milestone badges (week of practice, star collector, 100 right). Values live in the sidecar.

At Night, place stickers sit under the lamp a step quieter (saturate 0.9, brightness 0.94); by Day they print at full strength.

### Tertiary (maple and the four laws)
- **Maple** (maple): the face of every tile, key-tile, plaque and the Say-it disc, always under a grain texture and a 172deg highlight gradient. Never a flat fill. **Maple Highlight** (maple-hi) is the lit top; **Maple Bevel** (maple-lo) is the pressed lower edge; **Rack Walnut** (maple-deep) is the shelf tiles stand on.
- **Marigold** (marigold): *right*. The lower edge of a correct tile, the tiles of a revealed spelling, and the Check key, because Check asks "is this right?". Its bevel is **Marigold Deep** (marigold-deep).
- **Coral** (coral): *wrong letter*. The tile edge plus a coral corner mark with an X.
- **Sky** (sky): *missing letter*. The underline of an empty square where a letter belongs, plus a sky corner mark with a plus.
- **Stone** (stone): *extra letter*. The tile edge plus a stone corner mark with a minus.

### Neutral
- **Chalk** (page-ink): all text on the page, focus rings, filled pips, caret and accent colour, and the face of the primary `go` key. By Day it is a deep jade ink.
- **Lichen** (page-muted): secondary text on the page (5.6:1 at Night, 6.0:1 by Day), empty pip rings, and slot labels.
- **Walnut Ink** (ink): text on maple and on the rack.
- **Soft Ink** (ink-soft): point numbers on tiles.

### Named Rules
**The One Law Rule.** Each law colour means one thing everywhere: marigold is right, coral is a wrong letter, sky is a missing letter, stone is an extra letter. Test: if you can't finish the sentence "this colour here means ___" with that colour's law, the colour is wrong.

**The Edge-Only Rule.** Feedback colour lives on tile edges (the `--tile-edge` bevel), underlines and the corner mark. It never goes on the letter or the tile face. Letter ink stays dark on every tile.

**The Marigold Is Earned Rule.** Marigold never marks a generic primary action. The primary non-check action is the chalk `go` key. On retry, correct letters lose their marigold, so marigold only confirms a finished word.

**The Mark Beside Colour Rule.** Every non-right law also carries a corner mark (X, plus or minus on a white-stroked disc) and an aria-label such as "b, wrong letter". Colour is never the only signal. Right carries no mark and is confirmed by the result line.

**The Place Hue Rule.** Each place has exactly one printed hue (spell, math, roxy) and it marks that place everywhere: its sticker, its topic stickers, its badges. A place hue is paint, never feedback, and text on it is always Sticker Ink. A new place gets a new hue that sits clear of marigold, coral, sky and stone.

**The Silver Foil Rule.** Stars, streak and milestone badges are holographic silver foil. Nothing that rewards is ever gold or marigold, because marigold means right.

**The Ticket Rule.** What games pay and spend is a ticket (`.ticket`): a berry stub with punched sides and a dotted perforation after its mark, with the count in Sticker Ink. Foil means practice and a ticket means play, so a ticket is never foil and a star is never a ticket. Free games show no wallet at all.

**The Two Lights Rule.** Night and Day share every token name. New surfaces use `page-*` colours and `--tone-*` shadow tones, never a hard-coded page hex or a fixed shadow rgb, so they light correctly in both. Test: switch Settings → Day and Night; nothing disappears or inverts.

## Typography

**Display Font:** Fredoka Variable (with ui-rounded, system-ui)
**Body Font:** Lexend Variable (with system-ui)
**Tile Font:** the per-child `--tile-face`, which is one of Fredoka (default), Andika, Lexend or Atkinson Hyperlegible.

**Character:** Rounded, geometric and lowercase-friendly. Fredoka gives tiles, headings and sticker labels a friendly, toy-like solidity. Lexend is the calm reading voice for definitions, sentences and parent copy. There are no condensed faces and no pixel faces.

### Hierarchy
- **Display** (600, 2.25rem to 3rem at md, -0.01em, balanced wrap): page and state headlines such as "Who's practicing?" and "12 words. Ready?". Place sticker labels ("Spelling", "Math") use Fredoka 600 at 2.25rem.
- **Headline** (600, 1.875rem): section heads such as "What shall we practice?", "Math: pick a topic" and "Kids".
- **Title** (500 to 600, 1.25rem to 1.5rem): list names, speller names, "Your badges", "Pick up where you left off", and the result line "Spot on!".
- **Body** (Lexend 400, 1rem, text-lg for feedback lines, max 40 to 60ch): definitions, sentences, helper text. Secondary copy uses Lichen at text-sm. Sticker notes ("1 word to review") are Lexend 500.
- **Label** (Fredoka 600, 1.05rem): all key labels. Counters, foil numbers and badge counts use tabular numerals.
- **Tile letter** (tile face 600, 0.56 of the tile edge, line-height 1): debossed with a light lower lip and a shadowed upper lip. Point numbers use Lexend 600 at 0.18 of the edge.

### Named Rules
**The Child's Face Rule.** Tile letters take their face from `data-font` on the play subtree (`fredoka`, `andika`, `lexend`, `atkinson`). Every tile uses `--font-tile`, never a hard-coded family, so a child's chosen face reaches every tile in the round. All four faces are bundled locally through @fontsource.

**The Lowercase Word Rule.** Words are shown as the speller types them, usually lowercase. Don't uppercase or letter-space tile letters or key labels. The only tracking in the build is on PIN fields.

## Layout

Every route is a single centred column on the album page. The round uses max-width 64rem (`max-w-5xl`), the hub 72rem (`max-w-6xl`), the parent area 72rem, and results 56rem. Inline padding is 1.25rem, rising to 2.5rem at md (768px).

**Album spread (subject hub).** A header with the KidTile (48px) and name on the left and two foil chips (streak, stars) on the right. Below it, from md, a three-column grid `minmax(0,1fr) 2.5rem minmax(0,1fr)`: the left page, the stitched spine, the right page. The left page holds "What shall we practice?", the "Pick up where you left off" patch (one row per unfinished subject, the most recent one's Continue is the `go` key) and the Spelling and Math stickers, each spelling its word in 44px tiles. The right page holds the Games sticker (berry, showing the child's current Roxy look) and the badge sheet: a 3- or 4-column grid of 64px (72px at md) badge stickers and slots, with "n of N" in Lichen. Below md the pages stack and the spine turns into a horizontal stitched seam between them.

**Kid picker (profiles).** Each child is an album cover: a 176px (208px at md) sticker with a 104px KidTile and their name, tilted ±2.5deg alternately.

**Spelling home.** The foil progress strip (streak, stars, words mastered), one `go` key chosen for the kid, then each list as a sticker on the raised page (the one up next tilted -1deg), with its first words on a walnut rack and one suggested way. Earned badges follow as pill stickers in a wrapping row, with the next badge as a dashed pill slot ("Next: …").

**Math topic picker.** A due-facts sticker in grape (three 52px fact tiles fanned at -7, 0, +7deg, then the Review `go` key) above a stack of grape topic stickers, each with a 52px icon tile, Pips for its level and a Lichen hint.

**Spelling round.** Top to bottom: a thin top rail (exit key, KidTile, mode and list label, a row of 14px progress tiles, and an n/N counter); the Say-it disc and a Slowly key; the bee-question rack; the spoken-answer plaque; the answer row with the Check or Next key at its right end; then the pips and status line. Vertical rhythm is gap-7 at rest. Rounds stay on the plain lit page: no stickers, no foil.

**Math round.** The same rail (exit key, KidTile, "Math · topic" label, progress tiles, n/N counter), then a smaller 64px Say-it disc labelled "Read it again", then a word problem's story on a plaque (max 52ch) when there is one, then the problem row, then the feedback line, then the keypad (max 24rem wide) or a Next / Finish key (3.5rem). The column is centred at rest with gap-6. Math never opens the on-screen keyboard, so the screen only needs `100dvh`.

**Row fit.** Tile rows never wrap: the answer row, the problem row, the reveal row, the landing demo row. `fitTile(width, count, max)` picks the tile edge as `floor(width / (n + 0.1(n - 1)))`, capped at 88px (84px for the problem row, 80px for the reveal row, 72px for the tile bank), sets the gap to 10% of the edge (at least 3px), then steps the edge down until the tiles plus rounded gaps really fit. Width is measured before the first paint, so a row never flashes at a default size. The row is sized for the longer of the target word and what's on it, so tiles don't jump in size while the speller types. Long words get smaller tiles, never two lines.

**iPad keyboard handling.** `useVisualViewport` writes the visual-viewport height to `--vvh` on `<html>` and flags the keyboard as up when that height is below 80% of the tallest height seen at the current width (reset on rotation; Safari shrinks `innerHeight` with the keyboard, so that can't be the yardstick). The round main uses `min-height: var(--vvh, 100dvh)` and locks to `--vvh` while the keyboard is up. In that state the rail drops the KidTile and label, the Say-it disc shrinks to 60% (120px to 72px), the spoken-answer plaque hides, the Slowly and Check labels go screen-reader-only, and the column justifies to the top. The viewport meta sets `interactive-widget=resizes-content` and `viewport-fit=cover`.

**Targets.** Every key is at least 3rem (48px) tall; math keypad keys are 3.5rem. Icon-only keys are square: 44px (`size-11`) for the round exit and 48px for results' hear-word key. Check and Next are 3.5rem, and Start is 4rem. Place stickers are whole links at least 8rem (12rem with a tile word) tall.

**Input.** A transparent full-size `<input>` overlays the answer row. It sets `autocorrect="off"`, `autocapitalize="none"`, `spellcheck=false` and `autocomplete="off"`, with 16px text (so iOS doesn't zoom), `enterkeyhint="done"` and a transparent caret. A tap on the row moves the caret to the nearest gap between tiles, iPhone-style, so a missed letter can go in mid-word without backspacing. The native caret is kept in step with that gap (`gapFromX` in `components/round/caret.ts`). The parent word entry field sets the same autocorrect trio.

Breakpoints are Tailwind defaults: sm 640px, md 768px (where the spread opens into two pages), lg 1024px.

## Elevation & Depth

Depth is physical material, not UI elevation, in three heights. **Lifted:** stickers and foil sit just off the page on a soft two-part lift shadow, and an interactive sticker lifts 3px further on hover, as if a corner were being peeled. **On the page:** maple objects have an inset bevel on the lower edge, a 1px lit top edge, and a soft, low drop; page keys are barely raised. **In the page:** squares, fields, the disabled Check and pressed keys are recessed with inset shadows. Shadow units on tiles and keys are in `em`, so depth scales with tile size.

Shadow colours are tones, not fixed values, so depth reads in both lights: `--tone-drop` (Night `rgb(3 25 20 / 0.55)`, Day `rgb(22 74 58 / 0.26)`), `--tone-drop-deep`, `--tone-lit`, `--tone-key-line`, `--tone-recess` and `--tone-pit-lip`. Maple's own inner highlights (white lip, walnut bevel) stay fixed because maple doesn't change with the light.

### Shadow Vocabulary
- **Sticker** (`0 0.55rem 1.1rem -0.45rem var(--tone-drop-deep), 0 0.08rem 0.18rem var(--tone-drop)`; hover `0 0.9rem 1.5rem -0.5rem …, 0 0.1rem 0.2rem …` with `translateY(-3px)`): every sticker, over a 158deg gloss highlight in its `::before`.
- **Foil** (`inset 0 1px 0 rgb(255 255 255 / 0.8), 0 0.3rem 0.6rem -0.25rem var(--tone-drop-deep)`): streak and star chips, milestone badges.
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

**The Peel Rule.** Only stickers lift. A sticker that is a link or button rises 3px on hover and presses 1px on tap, keeping its tilt; a sticker that is just a picture (an earned badge) never moves after it is placed.

## Shapes

Corners are soft and proportional. Tiles and squares use an 18% radius at every size. Keys (0.85rem), fields (0.8rem), plaques (0.7rem), racks (0.9rem) and patches (1.25rem) are gently rounded rectangles. Stickers are die-cut with a generous 1.5rem radius and a 0.35rem vinyl rim; badge stickers tighten to 1rem, and inline badge stickers and foil chips are full pills (with a 3px rim on the pills). Slots are 1.1rem with a 2px dashed outline. The Say-it control is a fully round maple disc. Pips are full pills.

Tilt is part of the form. Stickers carry a small fixed tilt (`--tilt`): place stickers ±1.5 to 2deg, album covers ±2.5deg, badge stickers cycling through -5, 4, -3, 6, -4, 3, -6, 4deg by position, so the page looks pressed by hand but never shifts between visits. Tiles in the Tiles-mode bank are scattered with a deterministic rotation of -4 to +4 degrees. The brand's "j" is lifted by 4px and rotated -6 degrees, as if just placed. There are no hairline borders on maple; fields carry a 1px page-line border.

The spine is the album's binding: each page darkens toward a gutter, and a 3px line of vinyl stitches (10px on, 12px off, 55% opacity) runs down it, masked to fade at both ends. Below md it runs across.

## Components

### Buttons (the key)
One class, `.key`, with variants set by `data-variant`. The hierarchy follows what the object *is*.
- **Shape:** gently rounded (0.85rem), at least 3rem tall, 1.1rem inline padding, Fredoka 600 at 1.05rem, and an icon gap of 0.5rem.
- **Page key (default, no variant):** raised page with chalk text. It is every ordinary action: nav, Done, Add, Try again, the exit, and take-back. The markup often writes `data-variant="felt"`, a leftover name; no CSS rule targets it and it renders the default.
- **Go (`data-variant="go"`):** the chalk face with page-deep text and a chalk bevel. It is the one primary non-check action per view: Continue, Review, Bee, Save list, Next word, Practice missed, Create. On a place sticker it inherits Sticker Ink, so it reads as a light key on the hue.
- **Tile (`data-variant="tile"`):** grained maple. Only for things the speller handles: Slowly, the bee questions (Definition, Sentence, Origin) and results' hear-word.
- **Check (`data-variant="check"`):** a marigold-tinted maple face with a marigold-deep bevel, at the right end of the answer row. The label becomes screen-reader-only below sm and while the keyboard is up.
- **Hover / Active / Disabled:** hover sets brightness to 1.08. Active translates 1px (maple keys sink 0.12em and thin their bevel). Disabled drops to 0.45 opacity with a not-allowed cursor. A disabled Check is the exception: it sits as an empty recess in the page pit (Lichen label) instead of a faded marigold, which reads olive. Focus uses the global chalk ring (3px, offset 3px).
- **Selected (`data-pressed="true"`):** pressed into the page, with a page-deep face and an inset shadow. Use it for segmented choices (sign-in or sign-up, list import tabs, Settings → Day and Night: Auto, Day, Night) and the active parent nav item (alongside `aria-current="page"`).
- **Toggle on (`data-toggle` with `data-pressed`):** a chalk bar under the label on top of the pressed recess, plus a check where the label has room, so a row of "on" keys never reads as disabled. Navigation keys stay plain pressed.

### Sticker
A die-cut vinyl sticker pressed onto the page: a printed face (`--sticker-face`), a 0.35rem vinyl rim, a gloss highlight across the top-left (158deg, white 30% fading out by 35%), the lift shadow and its own tilt.
- **Place stickers (`data-place="spell" | "math" | "roxy"`):** print the place hue and switch the contents to Sticker Ink (`page-ink`, `page-muted` and `page-deep` are re-pointed inside, so keys, pips and muted text follow). Spelling and Math stickers on the hub carry their word in 44px tiles over a 2.25rem label and a note of what's waiting; the Games sticker carries the child's current Roxy look in an 80–96px frame instead.
- **Plain stickers (no place):** print the raised page with page ink. Used for album covers on the kid picker and for list stickers on the Spelling home.
- **Badge stickers:** earned badges, faced by `badgeFace`: milestones (medal, trophy, library) are foil; the rest take a place hue (sprout spell; sparkles and flame roxy; star, grid and pie math). Never a law colour. Square on the hub's sheet, pills inline on the Spelling home and on results ("New badge: …").
- **States:** a link or button sticker lifts 3px on hover and presses 1px on tap, keeping its tilt. Focus uses the global chalk ring.

### Foil
Holographic silver: a 118deg gradient through silver, periwinkle, lilac and mint, with foil-ink text, a 0.2rem vinyl rim and a bright top lip. It is a full pill by default. Uses: the hub's streak and star chips (lucide Flame and Star, Fredoka 600 1.25rem tabular number), the Spelling home's progress strip (1rem radius), the Games sticker's holiday-collection chip, and milestone badge stickers.

### Ticket
The games' money, printed in Play's berry: a stub whose sides are punched out (a mask, so it carries no outer shadow) with a gloss band and a dotted perforation between the lucide ticket mark and the count. On the hub and the Play home it sits beside a foil "stars to spend" chip only while a parent lets stars pay in games; in a game's corner it is as tall as the 48px glass keys.

### Learn and Play
The hub spread's left page is Learn ("What shall we practice?", Spelling, Math, badges); the right is Play ("What shall we play?", the wallet, one berry Play sticker with Roxy). The header's foil star counts every star ever earned. When Play is closed (practice first not met, or out of play time) the Play sticker is a `.slot` that says what opens it ("Earn 6 more stars today", "6 of 10 stars") or offers minutes for stars; the first time it opens on a day, the sticker is placed with `sticker-place`. In a game, play time is a glass pill of whole minutes ("12 min", then "1 min left", announced once), never ticking seconds; when it runs out a glass sheet ("That's your play time", "Back to Play") covers the scene over a page-deep scrim.

### Slot
An empty sticker place printed on the page: a 2px dashed page-line outline, a faint page-deep wash, and the badge's lucide icon as a silhouette at 70% opacity. Its label sits below (or inside, on a pill slot) in Lichen, and screen readers hear "(not yet)". A slot never animates and never takes a hue.

### Spine
The binding between the hub's two pages, `aria-hidden`: a 2.5rem gutter column that shades toward its centre with a stitched vinyl seam. Below md it is a 1.5rem horizontal seam between the stacked pages.

### Tile
The maple letter tile. `size` is the edge in px, from 14 (progress rail) to 104 (album cover KidTile); answer rows top out at 88. The letter is 0.56 of the edge, and an optional point number sits bottom-right at 0.18. `law` sets `data-law`, which recolours the lower bevel and adds the corner mark (a disc at 24% of the edge, minimum 12px). A letter tile is `role="img"` and its label includes the law.

### Square
An empty place for a tile: recessed into the page pit, 18% radius. The active square (the next slot during spelling or retry) gets a 2px chalk ring at 70% opacity with a page offset, but only while the caret is at the end of the word. A **missing-letter square** adds a sky underline (`inset 0 -0.3em 0 sky`) and the label "missing letter".

### Pips
Five 9px mastery dots (Leitner box 1 to 5, or a math topic's level). Filled dots are chalk and empty dots are a 1.5px Lichen ring. The same ramp is used in play, results and parent progress; on a place sticker they print in Sticker Ink. The label reads "Mastery n of 5", "Level n of 5" or "New word". On maple, pips sit on a page-deep pill at 80% opacity.

### KidTile
A child's identity: their initial on a maple tile, with their chosen number as the tile's point value. It appears at 40px in the rail, 48px in play headers and 104px on album covers.

### WordTiles
A whole word as a small tile rack with a 3px gap, used in lists (about 22 to 30px) and results (34px). It takes optional per-letter laws. Results show the correct word in all-marigold beside the attempt, with coral, sky and stone marks.

### AnswerRow
The play row. It holds typed tiles, then squares (every remaining square when the length hint is on, otherwise one caret square). When the speller taps back into the word, a thin chalk **caret bar** (about 6% of the tile wide, 80% tall, blinking unless reduced motion is on) sits in that gap instead of the ring. Typed tiles are keyed by letter rather than by position, so a letter put in mid-word drops in where it goes and the rest stay still. After Check, the row shows the grade alignment, with missing letters as sky squares in place. A feedback note bubble (page-deep, with an arrow) points at the first flagged cell. The trailing slot holds Check or Next. See Layout for the fit rule.

### Plaque, Rack, Patch
- **Plaque:** a small maple object (0.7rem radius, grain 3) for the spoken definition or sentence, a word problem's story, and small counts in the Roxy studio and parent progress. Never a flat fill.
- **Rack:** the walnut shelf tiles stand on. It holds the bee questions, list previews and the results scoreboard of missed words.
- **Maple fill (`.maple`):** grain and gradient for maple shapes that aren't tiles, such as fraction-bar pieces and array counters in math explanations.
- **Patch:** a calm printed panel on the page (page-raised at 70%, 1.25rem radius, a 1px top light and a key-line outline). It is a slightly raised area of the same page, not a card. It holds "Pick up where you left off", Confirm and parent panels.

### Inputs / Fields
- **Style:** recessed page pit, chalk text, a 1px page-line border, 0.8rem radius, at least 3rem tall. Selects draw a Lichen chevron in inline SVG (one per light).
- **Focus:** the global chalk outline at a 1px offset.

### Navigation
The parent header puts the Brand (five tiles "jade's", the j lifted, plus "world" on a small die-cut sticker with no place hue, tilted 3deg) on the left. On the right are page keys: Lists, Kids and Settings, with the current section `data-pressed` (list and progress pages count as Lists and Kids), then Practice with a back arrow, set apart from the section keys. On a phone the three section keys drop to their own full-width row. Sign-out lives in Settings → Account and on the PIN gate, never beside Practice. Sub-pages open with a page back key ("← Lists", "← Kids"); play screens open with "← Subjects".

**Brand mark.** The wordmark's lifted maple "j" tile, die-cut as the album's first sticker (white vinyl rim, gloss, -7deg tilt, soft lift shadow) with a holographic foil star stuck on its upper right corner, on the jade page under the lamp. It is the favicon and every app icon; all of them are generated from `apps/web/scripts/icon-mark.mjs` by `scripts/icons.sh`. The maskable icon keeps the mark inside the central 80% circle, and the iOS touch icon is full bleed.

Parent word racks (`WordRack`) fit their row: tiles shrink for a long word in a narrow row down to 14–16px, so a rack never pushes the page sideways or its ✕ off-screen. Words read from a photo wear a dashed Lichen outline and a small "check" until the parent fixes or accepts them; they drop onto the rack one after another as they arrive.

The parent landing page is **This week**: current lists as patches (a rack preview, then each kid it's for as a small KidTile with their own "played Tuesday · 8 of 12 mastered"), past lists folded under a key with "Use again", and grade packs folded under "Start from a grade pack".

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

### Pending board
When a screen's data takes longer than about a second, the page shows three 40px maple tiles dropping in (120ms apart) beside an active square, over "Setting up the board…" in Lichen. One drop, no looping spinner.

### Motion
- **sticker-place** (320ms, ease-out-expo; from -14px, turned 7deg further anticlockwise than its tilt, at 1.07 scale, settling at its own `--tilt`): earned badges on the hub's sheet (60ms apart) and new badges on results (from 300ms, 120ms apart).
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

- **Where it can appear:** only on game screens and in a maple-framed stage (a `.rack`), item thumbnails, the gallery, and the child's current look on the berry Games sticker (the hub's right page and the Games screen). It never decorates other screens.
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
- **Town places are dioramas:** each sits on a board you can see the sides of (turf and soil outdoors, a timber plinth indoors) with a soft table shadow under it, and the park is one corner of a street of shops and houses. The sun casts soft, light shadows from the front-right (never hard or black); Roxy and her pet keep their faint round shadow instead. At Night the light turns to blue moonlight and lamps and windows glow warm. Hidden finds twinkle now and then, and a find pops in a glow and a ring of little stars.
- **Camera:** the home is fixed (its room has no front or right walls). In town places a drag turns the view up to 30° either way and it eases back after a moment; it snaps back under reduced motion. No zoom, no swoops.
- **Walking:** tap the ground and she walks there, or walk her with WASD or the arrows (a stick on touch screens) and hop with Space (the Hop key). Walking up to a find or a hotspot shows a prompt: "Press E to pick up the golden acorn" (a button on touch).
- **Motion:** a short walk with a gentle bob, a hop, a slow breath while standing, and the pet trotting after. All of it stops under reduced motion. No confetti or camera swoops.
- **Every action has a button too,** so nothing is canvas only.

### Game screens
Studio, home and places fill the window with the scene. Their chrome is the one exception to "nothing floats": small and in the corners, so the scene is the screen.

- **Glass:** chrome over a live scene is `.glass`, frosted page (`page-raised` at 72% with a 14px blur), so it re-tints with Day and Night. Never use it on album pages.
- **Top-left:** a round back `.orb`, then the masthead: an `.eyebrow` (tiny uppercase, letter-spaced, `page-muted`) over a big Fredoka title whose second word is berry ("The **park**", "Roxy **and Mochi**").
- **Top-right:** round 48px `.orb` icon keys (each named by its aria-label, shown as a tooltip), led by play time (when it costs stars), the ticket and, when linked, the stars to spend: screen links, Go to…, Full screen, Show/Hide panel.
- **Bottom-left:** keyboard hints with `.kbd` keys on a mouse-and-keyboard screen; the stick on a touch one. **Bottom-right:** the status line (a berry dot and "2 of 5 found"). **Bottom-centre:** the action row (Undo, Save look) or the prompt.
- **Panel:** a floating glass sheet, on the right on wide screens and along the bottom on narrow ones. It starts open in the studio and when decorating, closed in places, and remembers what the kid chose.
- **Go to…:** a dialog listing the studio, Roxy's home and every place, with "· here" on the current one.
- **Backdrop:** `--scene-top` → `--scene-ground` (pale sky to sand in Day, a jade dusk at Night).
- **Loading:** a soft berry drop breathing (`.breathe`) and "Getting Roxy ready…".

## Do's and Don'ts

### Do:
- **Do** put feedback colour only on `--tile-edge`, underlines and corner marks. Test: with the law colours desaturated, every judged tile still shows an X, plus or minus mark, and its aria-label names the law.
- **Do** use maple (`data-variant="tile"` or `"check"`) only for things the speller handles. Test: if a key isn't part of listening to, asking about or checking the word, it's a page key.
- **Do** use exactly one `go` key per view for the primary non-check action, in chalk.
- **Do** mark selection with `data-pressed="true"` (plus `aria-current` for nav), never with a colour change.
- **Do** make each place a sticker in its own hue (spell, math, roxy) with Sticker Ink text, and give it a small fixed tilt (±1.5 to 2deg).
- **Do** print stars, streak and milestone badges on holographic silver foil.
- **Do** show anything not yet earned as a dashed slot with its silhouette and a Lichen label that says what it is.
- **Do** colour new surfaces with `page-*` tokens and `--tone-*` shadows, and check them in both Day and Night.
- **Do** size answer tiles through `fitTile` so tile edge and gap scale together (gap = 10% of the edge). Test: a 15-letter word at 375px fits on one line.
- **Do** size round screens to `var(--vvh, 100dvh)` and collapse the rail while the keyboard is up. Test: on iPad with the on-screen keyboard up, the Say-it disc, the answer row and Check are all visible.
- **Do** keep every tap target at least 44px: text keys are 48px or more, and square icon-only keys are 44 to 48px.
- **Do** set `autocorrect="off"`, `autocapitalize="none"` and `spellcheck={false}` on any field that takes a spelling.
- **Do** render tile letters in `--font-tile` so the child's chosen face applies.
- **Do** keep motion to sticker-place, tile-drop, tile-land, tile-flip and tile-nudge on ease-out-expo, and check each new animation under `prefers-reduced-motion`.
- **Do** take math answers on the keypad only. Test: a math round has no `input` or `textarea` anywhere.
- **Do** draw operators as chalk marks on the page; only numbers and answers are tiles.
- **Do** ask "are you sure?" in place with Confirm, with the safe choice first and focused.

### Don't:
- **Don't** use marigold for a generic primary, "start" or "continue" action. Marigold means right.
- **Don't** use coral, sky or stone for anything except wrong, missing and extra letters: no coral error banners, sky links, stone disabled states, or law-coloured stickers.
- **Don't** make a reward gold. Foil is silver; a place hue is paint, not praise.
- **Don't** tint a tile face or colour a letter's ink to show feedback.
- **Don't** fill maple flat or use raster wood. Every maple surface carries a grain texture over the 172deg gradient.
- **Don't** put white cards, flat panels or opaque page backgrounds over the album page. White belongs to a sticker's vinyl rim; parent panels are `patch`.
- **Don't** put dark ink on a place hue; text on a sticker face is Sticker Ink.
- **Don't** randomise tilts per render; a sticker keeps the tilt it was placed with.
- **Don't** hard-code a Night hex or a fixed shadow rgb on a new surface; it breaks Day.
- **Don't** let the answer row wrap onto two lines.
- **Don't** add floaty fades, long easings or looping motion.
- **Don't** use condensed or pixel faces, or uppercase tile letters.
- **Don't** use the browser's `confirm()` or a modal for a yes/no; they belong to no part of the album.
- **Don't** add particle effects (confetti, sparkles). Celebration is stickers being placed and star tiles landing and, on a perfect round, flipping to marigold.
