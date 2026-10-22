---
name: Jade's World
description: A kids' games portal laid out as a console's home menu, a plain shell with one shelf of big square tiles, one lit at a time, where Spelling and Math sit among the games and every letter a kid handles in a round is a maple tile checked piece by piece.
colors:
  page: "#212224"
  page-deep: "#18191b"
  page-raised: "#2c2d2f"
  page-line: "#3c3d3f"
  page-ink: "#f1f2f4"
  page-muted: "#acaeb2"
  page-pit: "#121315"
  page-day: "#eceef2"
  page-deep-day: "#dde1e7"
  page-raised-day: "#ffffff"
  page-line-day: "#cdd2db"
  page-ink-day: "#1b2130"
  page-muted-day: "#555e70"
  page-pit-day: "#d5d9e1"
  brand: "#d62c27"
  select: "#1d9bf0"
  select-day-name: "color-mix(in oklab, #1d9bf0 78%, black)"
  action-white: "#ffffff"
  action-ink: "#1b2130"
  vinyl: "#dfe8e3"
  vinyl-day: "#fbfdfb"
  vinyl-ink: "#12332c"
  foil-ink: "#1d2430"
  spell: "#17795e"
  math: "#5b4bc4"
  roxy: "#b8326f"
  sticker-ink: "#f4fbf7"
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
  scene-top: "#cfe9f4"
  scene-ground: "#f4ead8"
typography:
  display:
    fontFamily: "Fredoka Variable, Fredoka, ui-rounded, system-ui, sans-serif"
    fontSize: "3rem to 3.75rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Fredoka Variable, Fredoka, ui-rounded, system-ui, sans-serif"
    fontSize: "2.25rem to 3rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  shelf-name:
    fontFamily: "Fredoka Variable, Fredoka, ui-rounded, system-ui, sans-serif"
    fontSize: "clamp(1.3rem, calc(var(--tile) * 0.085), 2.6rem) (sized from the tile)"
    fontWeight: 600
    lineHeight: 1
  title:
    fontFamily: "Fredoka Variable, Fredoka, ui-rounded, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.3
  numeral:
    fontFamily: "Fredoka Variable, Fredoka, ui-rounded, system-ui, sans-serif"
    fontSize: "1.5rem to 1.875rem"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "tnum"
  body:
    fontFamily: "Lexend Variable, Lexend, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  shelf-line:
    fontFamily: "Lexend Variable, Lexend, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.55
  action-label:
    fontFamily: "Lexend Variable, Lexend, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1
  label:
    fontFamily: "Fredoka Variable, Fredoka, ui-rounded, system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 600
    lineHeight: 1.25
  wordmark:
    fontFamily: "Fredoka Variable, Fredoka, ui-rounded, system-ui, sans-serif"
    fontSize: "18px to 36px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.005em"
  tile:
    fontFamily: "var(--tile-face, Fredoka Variable), ui-rounded, system-ui, sans-serif"
    fontSize: "0.56em of tile edge"
    fontWeight: 600
    lineHeight: 1
rounded:
  tile: "18%"
  kbd: "0.3rem"
  plaque: "0.7rem"
  field: "0.8rem"
  key: "0.85rem"
  rack: "0.9rem"
  slot: "1.1rem"
  patch: "1.25rem"
  shelf-tile: "1.4rem"
  sticker: "1.5rem"
  sheet: "1.75rem"
  pill: "9999px"
spacing:
  shelf-tile: "clamp(10rem, min(44dvh, 34vw), 24rem)"
  shelf-tile-phone: "min(62vw, 38dvh)"
  shelf-tile-portrait: "min(60vw, 40dvh)"
  shelf-gap: "clamp(0.9rem, 1.6vw, 1.5rem)"
  shelf-gutter: "max(1.25rem, safe inset); max(3rem, safe inset) from md"
  shelf-head: "3.75rem"
  ring-width: "0.3rem"
  ring-offset: "0.35rem"
  home-inline: "1.25rem; 3rem from md"
  home-action: "3.5rem"
  key-min-height: "3rem"
  key-inline: "1.1rem"
  tile-gap: "10% of tile edge (min 3px)"
  rack: "0.5rem 0.75rem 0.9rem"
components:
  shelf-tile:
    backgroundColor: "{colors.page-raised}"
    rounded: "{rounded.shelf-tile}"
    size: "{spacing.shelf-tile}"
  shelf-name:
    textColor: "{colors.select}"
    typography: "{typography.shelf-name}"
  shelf-count:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.action-white}"
    rounded: "{rounded.pill}"
    height: "2rem"
    padding: "0 0.5rem"
  shelf-progress:
    backgroundColor: "{colors.brand}"
    rounded: "{rounded.pill}"
    height: "0.45rem"
  brand-sticker:
    textColor: "{colors.brand}"
    typography: "{typography.wordmark}"
  home-action:
    backgroundColor: "{colors.action-white}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.pill}"
    size: "3.5rem"
  key:
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
  key-pressed:
    backgroundColor: "{colors.page-deep}"
    textColor: "{colors.page-ink}"
    rounded: "{rounded.key}"
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
    height: "3.5rem"
  key-check-disabled:
    backgroundColor: "{colors.page-pit}"
    textColor: "{colors.page-muted}"
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
    padding: "{spacing.rack}"
  patch:
    backgroundColor: "{colors.page-raised}"
    textColor: "{colors.page-ink}"
    rounded: "{rounded.patch}"
    padding: "1.5rem to 2rem"
  field:
    backgroundColor: "{colors.page-pit}"
    textColor: "{colors.page-ink}"
    rounded: "{rounded.field}"
    padding: "0.7rem 0.95rem"
    height: "3rem"
  sheet:
    backgroundColor: "{colors.page-raised}"
    textColor: "{colors.page-ink}"
    rounded: "{rounded.sheet}"
    padding: "1.5rem; 2rem from md"
    width: "min(40rem, 100vw - 2rem)"
  kid-sticker:
    backgroundColor: "{colors.action-white}"
    textColor: "{colors.vinyl-ink}"
    rounded: "{rounded.pill}"
    size: "40px to 136px"
  sticker-subject:
    backgroundColor: "{colors.math}"
    textColor: "{colors.sticker-ink}"
    rounded: "{rounded.sticker}"
  foil:
    textColor: "{colors.foil-ink}"
    rounded: "{rounded.pill}"
  ticket:
    backgroundColor: "{colors.roxy}"
    textColor: "{colors.sticker-ink}"
    padding: "0.375rem 0.95rem 0.375rem 0.85rem"
  word-sticker:
    backgroundColor: "{colors.action-white}"
    textColor: "{colors.vinyl-ink}"
    rounded: "{rounded.pill}"
    padding: "0.28em 0.7em 0.32em"
  slot:
    textColor: "{colors.page-muted}"
    rounded: "{rounded.slot}"
  glass:
    backgroundColor: "{colors.page-raised}"
    textColor: "{colors.page-ink}"
    rounded: "{rounded.pill}"
    height: "3rem"
---

# Design System: Jade's World

## Overview

**Creative North Star: "Console Home"**

Jade's World is a games portal laid out as a console's home menu. A plain shell holds one shelf of big glossy square tiles: every game (Roxy, Roxy's town, Gobble Town, Jelly Blocks, Campfire Woods) and Spelling and Math among them, the one the kid pressed last first. One tile is lit at a time. The lit tile wears a thick select-blue ring standing off its corners, grows a touch on a quick spring, and shows its name above it in blue. Under the shelf sit one line about the lit tile and a row of round white action buttons. One brand red owns the wordmark sticker, the counts on tiles and the progress bars. Nothing else is on the shell. There is no texture, no paper and no decoration.

The shell has two lights and one set of token names. **Night** (the CSS default) is neutral charcoal, lit a touch from above. **Day** is a pale cool grey, a touch brighter at the top. The parent picks Auto, Day or Night in Settings, and Auto follows the device live. The tiles carry the colour: real art captured from each game or round, edge to edge; Spelling and Math are their own rounds mid-answer, on the subject hue. Rounds are where the quiet craft lives: maple letter tiles judged by four law colours, unchanged from before the portal. Game screens are unchanged too: the scene fills the window, always daylit, with small glass chrome in the corners. What a kid earns keeps its material: badges are stickers, stars and streak are silver foil, tickets are berry stubs.

Density is low and scale is big. A tile is about 40% of the viewport tall, so a kid can pick one from across the table. Motion is short: the ring springs, the name fades up, tiles drop and flip in rounds, and nothing loops.

**Key Characteristics:**
- A plain shell in two lights: Night charcoal, Day pale cool grey. No texture, no paper.
- One shelf of big square tiles (1.4rem corners, a top-corner gloss), each filled edge to edge with art from its game. Spelling and Math are two tiles among the games.
- One lit tile at a time: a 0.3rem select-blue ring 0.35rem off its corners, a 1.035 scale on a spring, and its name above in Fredoka.
- One brand red for the wordmark sticker, the corner counts and the progress bars.
- Round white action buttons with their word beneath (Quests, Badges, More time, Who's playing?).
- "Who's playing?": each kid a big round vinyl sticker that takes the same select ring.
- Maple tiles and the four law colours inside rounds, and in the captured picture of a round on the Spelling and Math tiles.
- Earned materials kept: badge stickers in a subject hue or foil, silver foil for stars and streak, berry tickets.
- Fredoka for names, counts and keys; Lexend for lines.

## Colors

A neutral shell in two lights, one brand red, one select blue, three subject hues, fixed white for actions and identity, warm maple for what is handled in a round, and four law colours that each carry one meaning.

### Primary (the shell)
Night values are the unsuffixed keys and the CSS default. The Day values (`-day` keys) replace them under `:root[data-theme="day"]` with the same variable names.
- **Charcoal Shell** (page / page-day): the shell. It is the middle of the page light and the browser `theme-color`, which is switched per light before first paint. The PWA manifest and the launch screens stay on Night's value.
- **Shell Shadow** (page-deep / page-deep-day): the html background, the foot of the page light, pressed keys, the `go` key's text, unfinished quest cards and unearned badge discs.
- **Raised Shell** (page-raised / page-raised-day): resting keys, the sheet, the patch (at 70%), and a shelf tile's face before its art loads. By Day it is pure white.
- **Shell Seam** (page-line / page-line-day): field borders, dividers, the scrollbar thumb, and the empty track of a goal strip.
- **Shell Pit** (page-pit / page-pit-day): where a tile goes. Empty squares, fields and the disabled Check recess.

### Secondary (brand and select)
- **Brand Red** (brand): the wordmark sticker's letters, the app icon and launch-screen tile, the round count on a shelf tile's corner (with a white 0.18rem ring), the progress bar along a waiting round's tile, and the filling strip of a star goal while Play is shut. The same in both lights.
- **Select Blue** (select): the lit tile's ring, the lit tile's name at Night, and the ring on "Who's playing?" and on focused action buttons. By Day the name darkens to **Select Name Day** (select-day-name, 4.7:1 on the Day shell); the ring stays select.
- **Action White** (action-white, shaded to #f1f3f6 and #e3e7ec) with **Action Ink** (action-ink): the face and glyph of the round action buttons. They are fixed in both lights.

### Tertiary (subject hues, maple and the four laws)
- **Spelling Green** (spell): the Spelling tile's ground, Spelling badges and stickers.
- **Math Grape** (math): the Math tile's ground, math topic stickers, the due-facts sticker and math badges.
- **Play Berry** (roxy): tickets and the ticket glyph in the home's top bar, finished quest stickers, Roxy-flavoured badges, the Roxy tile before her look loads, the joystick knob and the loading drop.
- **Sticker Ink** (sticker-ink): all text and marks printed on a subject hue. A `.sticker[data-place]` re-points `page-ink`, `page-muted`, `page-deep` and `page-raised` to it, so its contents need no special casing.
- **Maple** (maple, with maple-hi, maple-lo and the walnut maple-deep): every tile, key-tile, plaque and rack, always under a grain texture and a 172deg highlight gradient. It is never a flat fill.
- **Marigold** (marigold, bevel marigold-deep): *right*. The lower edge of a correct tile, a revealed spelling, and the Check key.
- **Coral** (coral): *wrong letter*. The tile edge plus a corner mark with an X.
- **Sky** (sky): *missing letter*. An empty square's underline plus a corner mark with a plus.
- **Stone** (stone): *extra letter*. The tile edge plus a corner mark with a minus.

### Neutral
- **Shell Ink** (page-ink / page-ink-day): all text on the shell, the focus ring, the caret, filled pips, and the `go` key's face.
- **Shell Muted** (page-muted / page-muted-day): secondary text, stats beside the shelf line, and empty pip rings (7.2:1 at Night, 5.6:1 by Day).
- **Vinyl** (vinyl / vinyl-day) and **Vinyl Ink** (vinyl-ink): the white rim of stickers and foil chips, and the ink on kid stickers, word labels and discs.
- **Foil Ink** (foil-ink): text on foil.
- **Walnut Ink** (ink) and **Soft Ink** (ink-soft): letters on maple, and point numbers.
- **Scene Sky and Sand** (scene-top, scene-ground): the backdrop behind every game scene, in both themes.

### Named Rules
**The One Light Rule.** Exactly one tile on the shelf is lit, and select blue marks only that tile (its ring and its name) or the thing under the keyboard or pointer on a picker. Blue is never decoration, a link colour or a fill.

**The One Red Rule.** Brand red is the wordmark sticker, a count of what's waiting, and how far something has come. It never marks an error and never appears in a round or on a tile's letters, so it can't be read beside coral as "wrong".

**The One Law Rule.** Each law colour means one thing everywhere: marigold is right, coral is a wrong letter, sky is a missing letter, stone is an extra letter. Test: if you can't finish "this colour here means ___" with its law, the colour is wrong.

**The Edge-Only Rule.** Feedback colour lives on tile edges (the `--tile-edge` bevel), underlines and corner marks. It never goes on the letter or the tile face. Letter ink stays dark on every tile.

**The Mark Beside Colour Rule.** Every non-right law also carries a corner mark (X, plus or minus) and an aria-label such as "b, wrong letter". Colour is never the only signal.

**The Earned Material Rule.** Stars, streak and milestone badges are holographic silver foil, never gold or marigold, because marigold means right. Other badges are stickers in a subject hue. What games pay is a berry ticket, never foil. Free games show no wallet at all.

**The Two Lights Rule.** Night and Day share every token name. New surfaces use `page-*` colours and `--tone-*` shadows, never a hard-coded shell hex or a fixed shadow rgb. Only materials are fixed: maple, brand red, action white, vinyl and foil, and the white and dark scrims printed on tile art.

## Typography

**Display Font:** Fredoka Variable (with ui-rounded, system-ui)
**Body Font:** Lexend Variable (with system-ui)
**Tile Font:** the per-child `--tile-face`: Fredoka (default), Andika, Lexend or Atkinson Hyperlegible.

**Character:** Fredoka gives names, numerals and keys a round, toy-solid voice that reads as a game, not a worksheet. Lexend is the calm voice for the one line under the shelf, sheet copy and parent screens.

### Hierarchy
- **Display** (600, 3rem to 3.75rem at md, line-height 1.05): the sign-in headline, "Every game your kid loves, plus spelling and math, on one shelf."
- **Headline** (600, 2.25rem to 3rem at md): "Who's playing?" and section heads on inner screens.
- **Shelf name** (600, clamp 1.4rem to 2.1rem, line-height 1, one line): the lit tile's name, 1rem above its top-left corner, in select blue. Only the lit name shows.
- **Title** (600, 1.5rem): the kid's name in the home's top bar, sheet titles ("Your badges · 3 of 12", "Today's quests"), and "The games", "Spelling" and "Math" on the sign-in page.
- **Numeral** (Fredoka 600, 1.5rem to 1.875rem at md, tabular): stars and tickets in the top bar. Every count (shelf counts, foil chips, quest progress) uses tabular figures.
- **Shelf line** (Lexend 500, 1.125rem, balanced): the one line under the shelf. Its stat sits beside it in Lexend 600 at 0.875rem in Shell Muted.
- **Body** (Lexend 400, 1rem; 1.125rem for the sign-in lede, max 48ch): sheet copy, helper text and parent screens.
- **Action label** (Lexend 600, 0.875rem): the word under each round action button.
- **Label** (Fredoka 600, 1.05rem): every key label.
- **Wordmark** (Fredoka 700, 0.005em): "jade's world" as a red die-cut sticker. 36px on sign-in, 26px on the kid picker, 22px in the parent header, 18px in the home's footer.
- **Tile letter** (tile face 600, 0.56 of the edge): debossed, with a light lower lip and a shadowed upper lip.

### Named Rules
**The Child's Face Rule.** Every tile uses `--font-tile`, set from `data-font` on the play subtree, never a hard-coded family, so a child's chosen face reaches every tile in a round.

**The Lowercase Word Rule.** Words are shown as typed, usually lowercase. Don't uppercase or letter-space tile letters, key labels, shelf names or words on labels.

## Layout

**The home (`/play/$childId`).** A three-row grid filling `100dvh`. Inline padding is 1.25rem, rising to 3rem from md, with `py-safe-5` (`py-safe-7` from md).
- **Top bar:** the kid's sticker (48px) and name on the left; stars and, unless games are Free, tickets on the right as big numerals beside a silver lucide Star (never marigold, which means right) and a berry Ticket.
- **Middle, the shelf:** one row of square tiles, vertically centred. A tile is `clamp(10rem, min(44dvh, 34vw), 24rem)` on a laptop, `min(62vw, 38dvh)` on a phone (so the next tile peeks in from the edge), `min(60vw, 40dvh)` on an upright tablet (so a tile and a half show), and `min(30dvh, 28vw)` on a phone on its side, padded 2.4rem above. The gap is `clamp(0.9rem, 1.6vw, 1.5rem)`. The row scrolls sideways with mandatory snap and no scrollbar. It is padded 3.75rem above (room for the name) and 1.25rem below, with a gutter that grows from md and respects the safe inset, so the ring, the name and the lift never clip. Under it, in a 5rem-tall slot, sit the lit tile's line and stat (a game's best score or finds; a waiting round says "Finish …: 2 of 5 done" and its tile drops the count, leaving the bar). While games are shut, a line under it always says what opens them, in words ("Earn 6 more stars to open the games", then the star strip), and when a shut game is lit it adds one go key to the first subject on the shelf. Hover and keyboard share one light (hovering a tile focuses it); a swipe that leaves the lit tile off-screen hands the light to the tile at the shelf's start; Enter with nothing focused opens the lit tile, but only once a key has been let go on the page (never a held or repeated Enter carried over from "Who's playing?"). Arrows on the round buttons don't pull focus back to the shelf, and while a round button has focus the lit tile's ring steps back to 35%, so only one ring is bright. Pressing a shut game shakes it once (`tile-nudge`) and lights it, so the line under the shelf offers the way to practice; shut tiles are `aria-disabled`, and only the lit one's lock carries a word. The shelf always opens at its start, and a scroll position the browser restores later (on reload or back) never moves the light: if it carries the lit tile out of view, the shelf brings it back.
- **Footer:** the round action buttons on the left (1.25rem apart, 1.75rem from md). On the right, keyboard hints ("← → choose · Enter play" in `.kbd` keys, only from lg with a fine pointer) and the wordmark at 18px.

**Shelf order.** Most recently pressed first, saved per kid on the device (`jade.shelf.{childId}`). A new kid starts Roxy, Gobble Town, Jelly Blocks, Spelling, Campfire Woods, Math, Roxy's town. A round waiting to be finished leads the shelf (the newer of the two), and it is lit on arrival. While Play is shut, the light starts on the first tile the kid can open.

**Moving the light.** The arrows, Home and End move the light from anywhere on the page, unless a field, a list, a tab list or an open sheet has the keys. Hovering with a mouse or focusing a tile lights it too. The shelf glides to centre the lit tile (it jumps instead under reduced motion). Enter, Space or a press opens the lit tile. The shelf is one tab stop (roving `tabIndex`).

**Sign-in page (`/`).** A two-column grid (1.2fr and 1fr from md, max 72rem). Left: the wordmark at 36px (with a Sign in key beside it on a phone), the display headline, a muted lede, then the demo shelf. Right: the account patch. Below, across both columns: three columns for The games, Spelling (with the maple demo row "necessary" and its one coral tile explained) and Math, then one muted line for parents. The **demo shelf** always ends on whole tiles: a grid of four equal columns (three on a phone). Each tile is sized from its column by a container query (`--tile: 100cqi`), and the first is lit, with its name above.

**Kid picker ("Who's playing?").** The wordmark (26px) and a Parents key on top. Then the centred headline over each kid as a 136px round vinyl sticker with their name below in Fredoka 500 at 1.5rem, wrapping and centred, 2rem apart (3rem from md). Hovering or focusing a kid gives their sticker the select ring and scales it to 1.04.

**Rounds (unchanged).** A single centred column (max 64rem for rounds, 56rem for results) on the plain shell. The spelling round runs top to bottom: rail, Say-it disc, bee-question rack, spoken plaque, answer row with Check, then pips. The math round runs rail, Say-it, story plaque, problem row, feedback, keypad. Round screens size to `var(--vvh, 100dvh)`, so the answer row stays above the iPad keyboard. `compact` (keyboard up, or under 480px tall) tightens both rounds.

**Row fit.** Tile rows never wrap. `fitTile(width, count, max)` picks the edge as `floor(width / (n + 0.1(n - 1)))`, capped at 88px (84px for the problem row, 80px for reveal, 72px for the bank, 40px for the sign-in demo row), with a gap of 10% of the edge (at least 3px).

**Inner screens.** The Spelling home, Math topic picker, results and parent area stay single centred columns on the shell (parent area max 72rem), using keys, patches, subject stickers and word labels.

**Safe areas and targets.** Pages pad with the `*-safe-*` utilities, the larger of the spacing step and the inset read through `--safe-*`. Every key is at least 3rem tall, the action buttons are 3.5rem discs, the sheet's Close is 3rem square, glass orbs are 3rem, and a shelf tile is never under 10rem.

Breakpoints are Tailwind defaults: sm 640px, md 768px (gutters and padding grow), lg 1024px (keyboard hints). The shelf also changes at 40rem wide (a phone) and on portrait screens from 40rem. `short:` is a phone on its side.

## Elevation & Depth

Depth is soft and low. The shell is flat, with one gradient of light from the top. Tiles and buttons sit just above it on two-part drops, and fields and pits are pressed into it. Shadows are `--tone-*` tokens, so they read in both lights: Night `--tone-drop` is `rgb(6 6 7 / 0.5)` and Day is `rgb(27 33 48 / 0.16)`. Maple keeps its own fixed highlights.

### Shadow Vocabulary
- **Shelf tile** (`0 0.5rem 1rem -0.4rem var(--tone-drop-deep), 0 0.08rem 0.2rem var(--tone-drop)`; lit `0 0.9rem 1.8rem -0.6rem …, 0 0.1rem 0.25rem …`): the lit tile casts further as it grows. A gloss band sits on top (`linear-gradient(150deg, white 22% → 4% by 28%, clear from 29%)` with a 1px inner white line at 12%).
- **Action button** (`inset 0 -0.15rem 0 rgb(27 33 48 / 0.08), 0 0.35rem 0.7rem -0.25rem var(--tone-drop-deep), 0 0.05rem 0.12rem var(--tone-drop)`).
- **Brand sticker** (an SVG filter in `Brand`: an edge of black at 0.3, blur 0.018em, and a drop of black at 0.32, 0.05em down, blur 0.03em): both are cast by the cut line, not the letters. The faint edge keeps the white line visible on Day's pale shell; the soft drop lifts it. Fixed in both lights.
- **Shelf count** (`0 0 0 0.18rem #fff, 0 0.2rem 0.4rem rgb(0 0 0 / 0.3)`): a white ring that separates the red from any art.
- **Key** (`inset 0 1px 0 var(--tone-lit), inset 0 0 0 1px var(--tone-key-line), 0 0.25em 0.5em -0.2em var(--tone-drop-deep)`). The `go` key adds a bevel of its own ink.
- **Tile** (`inset 0 -0.3em 0 var(--tile-edge), inset 0 1px 0 rgb(255 255 255 / .6), inset 0 0 0 1px rgb(120 78 34 / .12), 0 .35em .7em -.1em var(--tone-drop)`): the bevel colour is the law slot.
- **Sticker** (`0 0.55rem 1.1rem -0.45rem var(--tone-drop-deep), 0 0.08rem 0.18rem var(--tone-drop)`) and **foil** (`inset 0 1px 0 rgb(255 255 255 / .8), 0 .3rem .6rem -.25rem var(--tone-drop-deep)`).
- **Glass** (`inset 0 1px 0 var(--tone-lit), inset 0 0 0 1px var(--tone-key-line), 0 .4em 1.2em -.4em var(--tone-drop)`, over `page-raised` with a 14px blur): game-screen chrome only. By Day the glass is 72% thick; at Night it is 86% and its muted ink lightens to `#c6c8cc` (`--glass-alpha`, `--glass-muted`), because the scene behind is always daylit and shows through, and the shell's muted grey would sink under 3:1 on it. Under `prefers-reduced-transparency` it goes solid.
- **Recessed** (square and disabled Check: `inset 0 .2em .5em var(--tone-recess), inset 0 -1px 0 var(--tone-pit-lip)`; field and pressed key: `inset 0 .15em .4em var(--tone-recess)`).

### Named Rules
**The Plain Shell Rule.** The body is `--page-light` (a top-lit gradient into page-deep at Night, a brightened top by Day) and nothing else. No texture, paper, pattern or illustration goes on the shell. The colour on a screen comes from the tiles' art.

**The Grain-Not-Flat Rule.** Every maple surface stacks one of four grain textures over a 172deg gradient. A flat maple fill is a defect.

## Shapes

Corners are soft. Shelf tiles are squares with 1.4rem corners, clipping their art. Keys are 0.85rem, fields 0.8rem, patches 1.25rem and sheets 1.75rem. Letter tiles and squares use an 18% radius at every size. Action buttons, kid stickers, shelf counts, progress bars, lock pills, foil chips and glass orbs are full rounds. The select ring is an outline 0.3rem wide standing 0.35rem off a tile's corners (0.4rem off a kid sticker), so it follows the corner rather than hugging it.

Tilt survives only on the wordmark and earned stickers: the wordmark sits at -3deg, badge stickers cycle through -5, 4, -3, 6, -4, 3, -6, 4deg by position, and finished quest stickers, being full-width rows, sit at only -0.6, 0.5 and -0.4deg. Shelf tiles and action buttons are square to the screen. In Tiles mode the bank's tiles are scattered at -4 to +4deg, deterministically.

## Components

### Shelf tile (the signature)
A glossy rounded square filled edge to edge with its game's art.
- **Art:** a game's tile is a captured WebP (`public/tiles/*.webp`, `object-fit: cover`). Roxy's tile is her live SVG look. Spelling and Math are captured rounds too, mid-answer and on the subject hue (Tiles mode with "nec" placed on spell green; a times-table with "1" typed above the keypad on grape), with no law colour, since nothing has been checked yet. Art is `alt=""`; the button's aria-label names the tile, its count, a quest in it, and whether it's locked and why.
- **Lit:** `data-lit` sets the ring colour to select, scales to 1.035 and deepens the drop. Keyboard focus shows the same ring.
- **Name plate:** every unlit tile carries its name along its foot in white Fredoka 600 (6% of the tile, 0.75rem to 1.2rem, up to two lines) on a dark shade rising from the bottom edge, with a lock glyph before it on a shut game. The lit tile's plate fades out, since its name stands above it. A kid can tell every tile apart without lighting or launching it. Over a progress bar the plate sits higher.
- **Count:** a red round in the top-right corner (0.65rem in), with a white Fredoka 650 numeral, "99+" past 99. It shows words due, else this week's unstarted words, or facts due.
- **Quest:** a white disc in the top-left corner with the Quests button's target glyph, on a game holding one of today's quests not yet done (not while Play is shut). When that tile is lit, the line under the shelf says the quest in words ("Quest: Gobble another hole · 0 of 1 · 10 tickets") beside the same disc, so the marker explains itself. Both corner marks are 10% of the tile (1.5rem to 2.25rem). By day the white discs (these and the action buttons) carry a hairline so they keep their edge on the pale shell.
- **Progress:** a red bar 0.45rem tall along the foot (0.8rem in) over a dark 55% track, for a round waiting to be finished. It is never under 6% wide.
- **Locked (Play shut):** the art is muted (`saturate(0.35) brightness(0.85)`) with a lock glyph on its name plate; the lit one shows a dark pill instead with its word ("After practice" or "Out of time"), icon only on a phone on its side. It is never hidden. While Play is shut, Spelling and Math move to the front of the shelf, so it opens on them, uncut. The line always says what opens the games, in words ("Earn 6 more stars to open the games", "Finish a round to open the games") with a star goal's red strip after it ("4 of 10 today"); a lit game adds a `go` key to the nearest subject (not on a phone on its side, where the line and strip share one row and Spelling and Math are in view at the shelf's start). Out of time, it says so and offers minutes for stars.
- **Press:** scale 0.98.

### Shelf name and line
The lit tile's name sits above its top-left corner in select blue. The others are invisible but present (opacity 0, 0.3rem lower), so the name fades up when the light moves. Under the shelf is one line (`aria-describedby` of every tile) and an optional stat: a best score, finds, "2 of 5 done", or a holiday collection. The line block stands under the lit tile's left edge (`--lit-x`, measured each frame the shelf scrolls, easing 300ms when the light moves), so name, tile and line share one edge; near the end of the shelf it stops where it still fits.

### Action buttons
A round white 3.5rem disc with a 1.5rem lucide glyph in Action Ink, and its word beneath in Shell Ink. Quests, Badges, More time (only when time costs stars) and "Who's playing?" (to the kid picker). Hover lifts the disc 2px and press scales it to 0.95, both on the spring. Focus draws the select ring around the whole button, 0.4rem off it. On a phone on its side the discs are 2.75rem, so the shelf, its line and the buttons fit without the page scrolling. Each of Quests, Badges and More time opens a sheet; Quests wears a red count of quests ready to collect. On a phone the sheets sit at the bottom edge, full width, so Close is in thumb reach. The wordmark and key hints sit at the footer's right; an upright phone leaves them out, so the buttons keep one row.

### Sheet
A native `<dialog>` in the shell's light: Raised Shell, a 1.75rem radius, up to 40rem wide, 1.5rem padding (2rem from md), over a 55% black backdrop. A Fredoka 1.5rem title sits beside a square Close key. Esc, Close or a tap on the backdrop closes it, and the shelf keys stop while it's open.
- **Badges:** the kid's foil star and streak chips (or one line before a first star), then a three-column grid. Earned badges are 64px stickers (72px from md), foil or subject hue, placed with `sticker-place` 60ms apart. Unearned badges are a Shell Shadow disc with the glyph in Shell Muted, the label (0.875rem) and how to earn it in smaller type beneath, and "(not yet)" for screen readers.
- **Quests:** three rows, each led by its game's tile art (64px, 72px from md; Roxy's live look for the studio). One still to do is a Shell Shadow row with the quest, "n of N", its tickets and a chevron: one button that closes the sheet and opens its game, as pressing its tile would (the select ring on hover and focus). While Play is shut the cards are plain, under a line saying when they open. A finished one is a berry sticker with Collect (a `go` key with its ticket) or "Done!".
- **More time:** minutes left today in words, what stars buy, then the buy key. The top bar shows minutes left beside the star and ticket counts whenever time costs stars.

### Wordmark (`Brand`)
"jade's world" as a die-cut vinyl sticker (`.brand-sticker`), the kind a kid sticks on a laptop. The letters are brand-red Fredoka 700 at 0.005em, inside one white cut line drawn by an SVG filter in `Brand`: the letters' shape grown by 0.12em (`feMorphology` dilate, worked out from the `size` prop in pixels), rounded off and filled white. It is a filter, not a text stroke, because Fredoka's outlines overlap and a stroke leaves specks of shell where they cross. The sticker is turned -3deg and casts the brand sticker shadow. The j is dotless, and a red five-point star (0.36em) dots it, inside the same cut line, as on the app icon. Red on the white line is 4.9:1. It is fixed in both lights. It belongs with the earned stickers' material, not the shell's.

### Buttons (the key)
One class, `.key`, with variants in `data-variant`.
- **Shape:** 0.85rem corners, at least 3rem tall, 1.1rem inline padding, Fredoka 600 at 1.05rem.
- **Default:** Raised Shell with Shell Ink. Every ordinary action. (Markup still writes `data-variant="felt"` in places; no rule targets it.)
- **Go:** a Shell Ink face with Shell Shadow text. The one primary non-check action per view ("Create family account", "Go to Spelling", Collect).
- **Tile and Check:** grained maple, and marigold-tinted maple, only for what the speller handles in a round. A disabled Check is an empty pit recess, not a faded marigold.
- **States:** hover brightens to 1.08 (inside `@media (hover: hover)`), press translates 1px (maple sinks 0.12em), disabled is 0.45 opacity. Selected (`data-pressed="true"`) is pressed into the shell, and a toggle that's on adds an ink bar under its label.

### Kid sticker (`KidTile`)
A round white vinyl disc with the kid's initial at 0.52 of its size, and their chosen number on a foil chip (at least 22px) over the lower-right edge. 136px on the picker, 48px in the home's top bar, 40px in round rails.

### Earned materials
- **Sticker:** a printed face, a 0.35rem vinyl rim, a 158deg gloss, the sticker drop and a fixed tilt. `data-place` (spell, math, roxy) prints the subject hue with Sticker Ink. It is used for badges, finished quests, Spelling-home lists and badges, Math topic and due-facts stickers, and results' new badges. A sticker that is a link lifts 3px on hover and focus.
- **Foil:** a 118deg silver, periwinkle, lilac and mint gradient with Foil Ink and a vinyl rim. Used for stars and streak, the kid number chip, the Spelling home's progress strip and milestone badges.
- **Ticket:** a berry stub with punched sides and a dotted perforation after its mark. It is games' money.
- **Slot:** a dashed outline for something not yet earned, on the Spelling home's next badge and in Pending.
- **Word sticker and vinyl disc:** white vinyl labels for words and single facts outside a round (inner screens and the parent area).

### Tile, Square, AnswerRow, ProblemRow, Keypad (rounds, unchanged)
- **Tile:** maple, 14 to 88px, letter at 0.56 of the edge. `data-law` recolours the lower bevel and adds a corner mark (24% of the edge, at least 12px). A letter tile is `role="img"` with its law in the label.
- **Square:** recessed into Shell Pit. The active square gets a 2px ink ring, and a missing letter adds a sky underline.
- **AnswerRow:** typed tiles then squares, with a blinking ink caret bar when the speller taps back into the word, and Check or Next at its right end.
- **ProblemRow:** only numbers and the answer are tiles. Operators are ink marks drawn on the shell at 0.6 of the edge.
- **Keypad:** the only math input, a 3-column grid of maple keys (3.5rem) with a full-width Check below. It never uses a text field.
- **Plaque and rack:** maple for a spoken definition or a story, and a walnut shelf for bee questions and results scoreboards.
- **Pips:** five 9px mastery dots, filled in ink with empty dots as Shell Muted rings.

### Inputs / Fields
Recessed into Shell Pit, with Shell Ink text, a 1px Shell Seam border, 0.8rem corners and at least 3rem tall, at 16px or more so iOS doesn't zoom. Selects draw a muted chevron (one per light). Focus is the global ink outline at a 1px offset. Spelling fields turn off autocorrect, autocapitalize and spellcheck.

### Navigation
The parent header puts the wordmark (22px) on the left and the section keys on the right (Lists, Kids, Friends, Settings, and Admin for an admin; the current one pressed), then the way out, "Who’s playing?" with a lucide `Users` mark: the same words as the kid side’s own key to that screen, so the door has one name from both sides. With a PIN set, leaving locks the area, so the key carries a small lucide `Lock` on its mark and is named "Who’s playing? Locks the parent area". On a phone the section keys are an even grid under the brand; where the way out can’t share the brand’s row (under 22.25rem) it goes after them. The PIN gate’s way out is the same raised key, beside Sign out. Errors are a Shell Shadow bubble with a lucide alert mark, never coral or red.

### Game screens (unchanged)
The scene fills the window on the `--scene-top` to `--scene-ground` sky, always daylit. Chrome floats small in the corners on `.glass`: a back orb and the masthead top-left, 48px orbs top-right, the prompt and actions bottom-centre, the status bottom-right, and a floating glass panel. Nothing is printed straight on the scene: the masthead (the title alone, in Fredoka on a glass pill; the eyebrow is its spoken context, never a visible kicker) and the keyboard hints sit on glass too, so they read on any scene, whether a daylit park, Campfire Woods at night, or a stage a kid painted navy. The title stays on one line, shrinking (to 1rem) to what the corner keys leave, and where even that won't fit the pill hides and only a reader hears it; the keys never wrap. `.eyebrow` (0.75rem uppercase) is only a tray or group label, like Jelly Blocks' Hold and Next.

**Roxy's studio.** Eight drawers (the catalog's Makeup folds into Face and Gems into Extras), one Tab stop with arrows, Home and End between them; on an upright phone they're one row that scrolls sideways. In each drawer the kid's own things come first, then the locked ones, each locked tile carrying a dark pill with a Ticket glyph and its price (a Gift glyph for a holiday gift). Wardrobe tiles have three states: under the pointer or the keyboard, the select-blue ring (one light, as on the home shelf); worn, an ink ring and a check; a locked thing being tried on, a dashed ink ring. A two-colour item labels its grids "Main colour" and "Second colour". Trying a locked thing opens a prompt stuck to the foot of the panel, so the kid keeps their place, and a short wallet offers "Go to town" beside "Not now". The action bar is one row: a Pose key (its poses on a small glass row above it), Undo, Surprise me, Save look; Save is off while a locked thing is worn or the look is already saved. Saving flashes the stage white once (none with reduced motion) and says no one else in Jade's World has this exact Roxy; a twin of the kid's own saved look says so, rather than blaming someone else.

### Motion
- **Lit tile spring** (transform 260ms `cubic-bezier(0.34, 1.56, 0.64, 1)`, outline colour 120ms ease-out, drop 260ms ease-out-expo): the ring snaps on while the tile overshoots a little to 1.035. The kid picker's ring and the action buttons' lift use the same spring (260ms and 200ms).
- **Name fade** (opacity 160ms ease-out, rise from 0.3rem in 220ms ease-out-expo).
- **Shelf glide:** `scrollIntoView` centring the lit tile, smooth unless reduced motion.
- **Rounds:** tile-drop (240ms), tile-flip (420ms cascade, 55ms per tile), tile-nudge (360ms), tile-land (420ms), all on ease-out-expo `cubic-bezier(0.16, 1, 0.3, 1)`.
- **sticker-place** (320ms): earned badges in the sheet and on results.
- **Reduced motion:** the shelf tile and name lose their transitions and the lit tile doesn't scale (the ring alone marks it). A global rule cuts every animation and transition to 1ms with no delay.

## Assets and provenance

Every shipping raster and its source:
- **Game tiles** (`apps/web/public/tiles/town.webp`, `gobble.webp`, `jelly.webp`, `woods.webp`): 720×720 WebP at quality 82, captured 2026-10-18 with headless Playwright Chromium (SwiftShader WebGL) from the app's own dev server. The viewport was 1200×1200, with every DOM element but the canvas hidden. town is `/games/roxy/place/park` after 9s. gobble is `/games/gobble` with the test hooks `setSeed(7)` and `setState("late-game")`, paused. jelly is `/games/jelly` with `setSeed(3)` and `setState("late-game")`, paused. woods is `/games/woods` after Start, with `setState("dusk")`. Each was cropped and resized with ImageMagick: town 1000×1000+100+60, gobble 860×860+176+200, jelly 700×700+250+450 (recropped 2026-10-19 to the stack), woods 1000×1000+100+150. No generated imagery and no third-party assets.
- **Spelling and Math tiles** (`spelling.webp`, `math.webp`): 720×720 WebP at quality 82, captured 2026-10-20 the same way from real rounds at 1000×800, DPR 2, with reduced motion: the page, `#root` and `main` painted the subject hue and the header and live regions hidden. spelling is a Tiles round after Start with its word's first three letters typed, clipped 600×600+170+124; math is a Times tables round after Start with "1" typed, clipped 600×600+200+122.
- **Roxy's tile:** her live SVG look (`RoxyFigure`, viewBox `40 20 320 320`).
- **Icons** (`public/favicon.svg`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`): authored in `apps/web/scripts/icon-mark.mjs`, the wordmark's j and its star as one die-cut sticker (red ink stroke 72 inside a white cut 140; the favicon is heavier at 84/156 with a larger star), turned -8deg with a soft shadow under it, on a rounded square a shade under brand red (gradient #bf2a25 → #8f1814), so the brand-red j reads as a letter, not a white outline. They are rendered by `scripts/icons.sh` with rsvg-convert. The favicon draws a larger star, the maskable icon scales the mark to 0.76 to stay inside the 80% circle, and the touch icon is full bleed on #a8201c.
- **Launch screens** (`public/splash/*.png`): from `scripts/splash.mjs`, the red tile at 30% of the short side on the Night shell gradient (#28292c → #212224 → #18191b). They are rendered with rsvg-convert and quantised to 256 colours, undithered, with ImageMagick.
- **Textures:** maple grain is authored SVG `feTurbulence` in `index.css`. Town props and pets are generated 3D models documented in CLAUDE.md, not shell rasters.

## Do's and Don'ts

### Do:
- **Do** keep exactly one tile lit, marked by the select ring, the 1.035 spring and its name above. Test: arrows, Home, End, hover and focus all move the same single light.
- **Do** fill a shelf tile edge to edge with real art from its game, or for Spelling and Math, a captured round on the subject hue.
- **Do** use brand red only for the wordmark sticker, waiting counts and progress.
- **Do** put feedback colour only on tile edges, underlines and corner marks. Test: with the law colours desaturated, every judged tile still shows its mark and its aria-label names the law.
- **Do** keep maple to rounds and to the picture of a round (the Spelling and Math tiles, the sign-in demo row). Those pictures are `aria-hidden` and never pressed as tiles.
- **Do** print stars, streak and milestone badges on silver foil, and other earned badges as subject-hue stickers.
- **Do** colour new surfaces with `page-*` tokens and `--tone-*` shadows, and check them in both Day and Night.
- **Do** keep text on brand red and on subject hues at 4.5:1 or better at its size.
- **Do** end a static shelf (like the sign-in demo) on whole tiles. Only the live shelf may let the next tile peek in.
- **Do** put hand-written `:hover` rules inside `@media (hover: hover)`, and give tiles, keys and stickers `touch-action: manipulation`.
- **Do** pad pages with the `*-safe-*` utilities and read insets through `--safe-*`.
- **Do** size answer tiles through `fitTile` and round screens to `var(--vvh, 100dvh)`.
- **Do** render tile letters in `--font-tile`.
- **Do** check each new animation under `prefers-reduced-motion`.

### Don't:
- **Don't** put texture, paper, patterns or illustration on the shell.
- **Don't** use select blue as decoration, a link colour or a fill, or light two tiles at once.
- **Don't** use brand red for errors, warnings or anything in a round. Errors are a Shell Shadow bubble.
- **Don't** use marigold for a generic primary action or a reward. Marigold means right.
- **Don't** use coral, sky or stone for anything except wrong, missing and extra letters.
- **Don't** tint a tile face or colour a letter's ink to show feedback.
- **Don't** fill maple flat or use raster wood.
- **Don't** hide a shut game. Grey it with a lock and say what opens it.
- **Don't** hard-code a Night hex or a fixed shadow rgb on a themed surface.
- **Don't** let the answer row wrap onto two lines.
- **Don't** add looping motion, confetti or particle effects.
- **Don't** name the outside portal, console or games that this or any game was modelled on, in UI, code or docs.
