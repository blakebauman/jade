---
name: Jade Learning
description: Spelling bee practice on a jade felt board, where every letter is a maple tile you can check piece by piece.
colors:
  felt: "#0e4f43"
  felt-deep: "#093a31"
  felt-raised: "#135c4e"
  felt-line: "#1a6a5a"
  felt-ink: "#e3f3ec"
  felt-muted: "#a3d0c0"
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
  patch: "1.25rem"
  pip: "9999px"
spacing:
  tile-gap: "10% of tile edge (min 3px)"
  word-gap: "3px"
  key-inline: "1.1rem"
  key-min-height: "3rem"
  rack: "0.5rem 0.75rem 0.9rem"
  page-inline: "1rem"
  page-inline-md: "2rem"
components:
  key-felt:
    backgroundColor: "{colors.felt-raised}"
    textColor: "{colors.felt-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.key}"
    padding: "0 1.1rem"
    height: "3rem"
  key-go:
    backgroundColor: "{colors.felt-ink}"
    textColor: "{colors.felt-deep}"
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
  key-pressed:
    backgroundColor: "{colors.felt-deep}"
    textColor: "{colors.felt-ink}"
    rounded: "{rounded.key}"
  tile:
    backgroundColor: "{colors.maple}"
    textColor: "{colors.ink}"
    typography: "{typography.tile}"
    rounded: "{rounded.tile}"
    size: "14px to 88px"
  square:
    backgroundColor: "{colors.felt-deep}"
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
    backgroundColor: "{colors.felt-raised}"
    rounded: "{rounded.patch}"
    padding: "1.25rem"
  field:
    backgroundColor: "{colors.felt-deep}"
    textColor: "{colors.felt-ink}"
    rounded: "{rounded.field}"
    padding: "0.7rem 0.95rem"
    height: "3rem"
---

# Design System: Jade Learning

## Overview

**Creative North Star: "The Tile Board"**

Every letter is a physical maple tile placed on a jade felt board, so a spelling is an object you can check piece by piece. The felt owns the whole viewport on every route, from sign-in to the round. Everything the speller handles is carved from maple: letter tiles, the Say-it disc, bee-question keys, plaques and racks. Every other surface is a patch of the same felt, sometimes raised and sometimes pressed in.

The palette is two materials (jade felt and maple) plus four law colours. Each law colour carries exactly one meaning, and it appears only on tile edges, underlines and corner marks. Letter ink stays dark on every tile. Density stays low during a round, where the word is the only subject. Parent screens use the same board at lower intensity, with felt patches, felt keys and small tile racks for words.

Depth is physical rather than decorative. Tiles have a lit top edge, a pressed lower bevel and a soft drop onto the felt. Squares are recessed. Textures are authored SVG turbulence (feTurbulence) with no raster assets: four maple-grain variants, plus felt nap and mottle. Motion is short and physical: tiles settle, flip and nudge. Nothing floats or fades.

**Key Characteristics:**
- Jade felt ground on every route, lit from above with nap and mottle textures.
- Maple is reserved for things the speller handles; everything else is felt.
- Four law colours with one meaning each, shown only on edges, underlines and corner marks.
- Radius is proportional (18%), so a 14px progress tile and an 88px play tile read as the same object.
- Rounded Fredoka for display and tiles, Lexend for reading, and a per-child tile face.
- Short physical motion (drop, flip cascade, nudge), all collapsed under reduced motion.

## Colors

Two materials and four laws: deep jade felt for the ground, warm maple for handled objects, and four premium-square colours that each carry a single meaning.

### Primary
- **Jade Felt** (felt): the board. It is the body field, the centre of the lit radial gradient, and the colour under every texture. It is also the PWA theme colour.
- **Deep Felt** (felt-deep): the edge of the board's lighting, the html background, pressed keys, empty squares (mixed toward black), fields, note bubbles and `kbd` chips.
- **Raised Felt** (felt-raised): resting felt keys, and the parent `patch` panel at 70% opacity.
- **Felt Seam** (felt-line): field borders, list dividers at 50% opacity, and the scrollbar thumb.

### Secondary
- **Maple** (maple): the face of every tile, key-tile, plaque and the Say-it disc. It is always layered under a grain texture and a 172deg highlight gradient. It is never a flat fill.
- **Maple Highlight** (maple-hi): the lit top of the maple gradient.
- **Maple Bevel** (maple-lo): the pressed lower edge of an unjudged tile and a key-tile, and the dividers inside a rack at 40% opacity.
- **Rack Walnut** (maple-deep): the darker, end-grain wood of the rack that tiles stand on.

### Tertiary (the four laws)
- **Marigold** (marigold): *right*. The lower edge of a correct tile, the tiles of a revealed spelling, and the Check key, because Check asks "is this right?". Its bevel is **Marigold Deep** (marigold-deep).
- **Coral** (coral): *wrong letter*. The tile edge plus a coral corner mark with an X.
- **Sky** (sky): *missing letter*. The underline of an empty square where a letter belongs, plus a sky corner mark with a plus.
- **Stone** (stone): *extra letter*. The tile edge plus a stone corner mark with a minus.

### Neutral
- **Chalk** (felt-ink): all text on felt, focus rings, filled pips, caret and accent colour, and the face of the primary `go` key.
- **Lichen** (felt-muted): secondary text on felt (5.6:1 on felt), empty pip rings, and the brand's "learning" wordmark.
- **Walnut Ink** (ink): text on maple and on the rack.
- **Soft Ink** (ink-soft): point numbers on tiles, and star or flame glyphs on plaques.

### Named Rules
**The One Law Rule.** Each law colour means one thing everywhere: marigold is right, coral is a wrong letter, sky is a missing letter, stone is an extra letter. Test: if you can't finish the sentence "this colour here means ___" with that colour's law, the colour is wrong.

**The Edge-Only Rule.** Feedback colour lives on tile edges (the `--tile-edge` bevel), underlines and the corner mark. It never goes on the letter or the tile face. Letter ink stays dark on every tile.

**The Marigold Is Earned Rule.** Marigold never marks a generic primary action. The primary non-check action is chalk felt (`go`). On retry, correct letters lose their marigold, so marigold only confirms a finished word.

**The Mark Beside Colour Rule.** Every non-right law also carries a corner mark (X, plus or minus on a white-stroked disc) and an aria-label such as "b, wrong letter". Colour is never the only signal. Right carries no mark and is confirmed by the result line.

## Typography

**Display Font:** Fredoka Variable (with ui-rounded, system-ui)
**Body Font:** Lexend Variable (with system-ui)
**Tile Font:** the per-child `--tile-face`, which is one of Fredoka (default), Andika, Lexend or Atkinson Hyperlegible.

**Character:** Rounded, geometric and lowercase-friendly. Fredoka gives tiles and headings a friendly, toy-like solidity. Lexend is the calm reading voice for definitions, sentences and parent copy. There are no condensed faces and no pixel faces.

### Hierarchy
- **Display** (600, 2.25rem to 3rem at md, -0.01em, balanced wrap): page and state headlines such as "Good work. Let's polish a few." and "12 words. Ready?".
- **Headline** (600, 1.875rem): section heads such as "Pick a list" and "Spellers".
- **Title** (500 to 600, 1.25rem to 1.5rem): list names, speller names, "Words to practice", and the result line "Spot on!".
- **Body** (Lexend 400, 1rem, text-lg for feedback lines, max 40 to 60ch): definitions, sentences, helper text. Secondary copy uses Lichen at text-sm.
- **Label** (Fredoka 600, 1.05rem): all key labels. Counters use tabular numerals.
- **Tile letter** (tile face 600, 0.56 of the tile edge, line-height 1): debossed with a light lower lip and a shadowed upper lip. Point numbers use Lexend 600 at 0.18 of the edge.

### Named Rules
**The Child's Face Rule.** Tile letters take their face from `data-font` on the play subtree (`fredoka`, `andika`, `lexend`, `atkinson`). Every tile uses `--font-tile`, never a hard-coded family, so a child's chosen face reaches every tile in the round. All four faces are bundled locally through @fontsource.

**The Lowercase Word Rule.** Words are shown as the speller types them, usually lowercase. Don't uppercase or letter-space tile letters or key labels. The only tracking in the build is on PIN fields.

## Layout

The board is a single centred column. The round uses max-width 64rem (`max-w-5xl`), the parent area 72rem, and results 56rem. Inline padding is 1rem to 1.25rem, rising to 2rem to 2.5rem at md (768px).

**Spelling round.** The round is laid out top to bottom: a thin top rail (exit key, KidTile, mode and list label, a row of 14px progress tiles, and an n/N counter); then the Say-it disc and a Slowly key; then the bee-question rack; then the spoken-answer plaque; then the answer row with the Check or Next key at its right end; then the pips and status line. Vertical rhythm is gap-7 at rest.

**Math round.** The same rail (exit key, KidTile, "Math · topic" label, progress tiles, n/N counter), then a smaller 64px Say-it disc labelled "Read it again" (the problem is already on screen), then a word problem's story on a plaque (max 52ch) when there is one, then the problem row, then the feedback line, then the keypad (max 24rem wide) or a Next / Finish key (3.5rem). The column is centred at rest with gap-6. There is no keyboard lock: math never opens the on-screen keyboard, so the screen only needs `100dvh`.

**Subject hub.** The child's KidTile and name, the streak-and-stars plaque, then one "Pick up where you left off" patch with a row per unfinished subject, then two subject racks side by side from md (one column below). Each rack spells its subject in 48px tiles ("spell", "math") with the subject name and what's waiting in it ("3 words to review").

**Row fit.** Tile rows never wrap: the answer row, the problem row, the reveal row, the landing demo row. `fitTile(width, count, max)` picks the tile edge as `floor(width / (n + 0.1(n - 1)))`, capped at 88px (84px for the problem row, 80px for the reveal row, 72px for the tile bank), sets the gap to 10% of the edge (at least 3px), then steps the edge down until the tiles plus rounded gaps really fit. Width is measured before the first paint, so a row never flashes at a default size. The row is sized for the longer of the target word and what's on it, so tiles don't jump in size while the speller types. Long words get smaller tiles, never two lines.

**iPad keyboard handling.** `useVisualViewport` writes the visual-viewport height to `--vvh` on `<html>` and flags the keyboard as up when that height is below 78% of `innerHeight`. The round main uses `min-height: var(--vvh, 100dvh)` and locks to `--vvh` while the keyboard is up. In that state the rail drops the KidTile and label, the Say-it disc shrinks to 60% (120px to 72px), the spoken-answer plaque hides, the Slowly and Check labels go screen-reader-only, and the column justifies to the top. The viewport meta sets `interactive-widget=resizes-content` and `viewport-fit=cover`.

**Targets.** Every key is at least 3rem (48px) tall; math keypad keys are 3.5rem. Icon-only keys are square: 44px (`size-11`) for the round exit and 48px for results' hear-word key. Check and Next are 3.5rem, and Start is 4rem.

**Input.** A transparent full-size `<input>` overlays the answer row. It sets `autocorrect="off"`, `autocapitalize="none"`, `spellcheck=false` and `autocomplete="off"`, with 16px text (so iOS doesn't zoom), `enterkeyhint="done"` and a transparent caret. The parent word entry field sets the same autocorrect trio.

Breakpoints are Tailwind defaults: sm 640px, md 768px, lg 1024px.

## Elevation & Depth

Depth is physical material, not UI elevation. Maple objects sit *on* the felt: an inset bevel on the lower edge, a 1px lit top edge, and a soft, low, green-black drop shadow (`rgb(3 25 20 / 0.55)`). Squares and fields sit *in* the felt, with inset shadows. Felt keys are barely raised. Shadow units are in `em`, so depth scales with tile size.

### Shadow Vocabulary
- **Tile** (`inset 0 -0.3em 0 var(--tile-edge), inset 0 1px 0 rgb(255 255 255 / .6), inset 0 0 0 1px rgb(120 78 34 / .12), 0 .35em .7em -.1em rgb(3 25 20 / .55)`): every letter tile. The bevel colour is the law slot.
- **Key-tile / Check** (`inset 0 -0.22em 0 var(--key-edge), inset 0 1px 0 rgb(255 255 255 / .55), 0 .3em .6em -.15em rgb(3 25 20 / .55)`): maple keys. On press the key drops 0.12em and the bevel thins to 0.08em.
- **Plaque** (`inset 0 -0.2em 0 maple-lo, inset 0 1px 0 rgb(255 255 255 / .55), 0 .3em .6em -.2em rgb(3 25 20 / .55)`).
- **Rack** (`inset 0 1px 0 rgb(255 230 190 / .35), inset 0 -.35rem 0 rgb(80 48 18 / .45), 0 .4rem .9rem -.2rem rgb(3 25 20 / .6)`).
- **Felt key** (`inset 0 1px 0 rgb(255 255 255 / .08), inset 0 0 0 1px rgb(255 255 255 / .05), 0 .25em .5em -.2em rgb(3 25 20 / .6)`). The `go` key adds a chalk bevel (`inset 0 -.18em 0`).
- **Recessed** (square: `inset 0 .2em .5em rgb(0 0 0 / .45), inset 0 -1px 0 rgb(255 255 255 / .06)`; field and pressed key: `inset 0 .15em .4em rgb(0 0 0 / .4)`).

### Named Rules
**The Grain-Not-Flat Rule.** Every maple surface stacks a grain texture over a 172deg highlight gradient. Tiles pick one of four grain variants (`data-grain` 0 to 3, derived from the letter or index), so neighbours rarely match. A flat maple fill is a defect.

**The Felt Is Lit Rule.** The body stacks felt mottle (512px), felt nap (128px) and a radial gradient lit from the top centre, fixed to the viewport. New surfaces sit on this field; they don't paint their own opaque backgrounds.

## Shapes

Corners are soft and proportional. Tiles and squares use an 18% radius at every size. Keys (0.85rem), fields (0.8rem), plaques (0.7rem), racks (0.9rem) and patches (1.25rem) are gently rounded rectangles. The Say-it control is a fully round maple disc. Pips and the pip backing are full pills. Tiles in the Tiles-mode bank are scattered with a deterministic rotation of -4 to +4 degrees. The brand's "j" is lifted by 4px and rotated -6 degrees, as if just placed. There are no hairline borders on maple. Fields carry a 1px felt-line border.

## Components

### Buttons (the key)
One class, `.key`, with variants set by `data-variant`. The hierarchy follows what the object *is*.
- **Shape:** gently rounded (0.85rem), at least 3rem tall, 1.1rem inline padding, Fredoka 600 at 1.05rem, and an icon gap of 0.5rem.
- **Felt (default, no variant):** raised felt with chalk text. It is every ordinary action: nav, Done, Add, Try again, the exit, and take-back. The markup sometimes writes `data-variant="felt"`, but no CSS rule targets it; it renders the default.
- **Go (`data-variant="go"`):** the chalk felt face with deep felt text and a chalk bevel. It is the one primary non-check action per view: Review, Bee, Save list, Next word, Practice missed, Create.
- **Tile (`data-variant="tile"`):** grained maple. Only for things the speller handles: Slowly, the bee questions (Definition, Sentence, Origin) and results' hear-word.
- **Check (`data-variant="check"`):** a marigold-tinted maple face with a marigold-deep bevel, at the right end of the answer row. The label becomes screen-reader-only below sm and while the keyboard is up.
- **Hover / Active / Disabled:** hover sets brightness to 1.08. Active translates 1px (maple keys sink 0.12em and thin their bevel). Disabled drops to 0.45 opacity with a not-allowed cursor. A disabled Check is the exception: it sits as an empty recess in the felt (square shadow, Lichen label) instead of a faded marigold, which reads olive. Focus uses the global chalk ring (3px, offset 3px).
- **Selected (`data-pressed="true"`):** pressed into the felt, with a felt-deep face and an inset shadow. Use it for segmented choices (sign-in or sign-up, list import tabs) and the active parent nav item (alongside `aria-current="page"`).

### Tile
The maple letter tile. `size` is the edge in px, from 14 (progress rail) to 88 (answer row). The letter is 0.56 of the edge, and an optional point number sits bottom-right at 0.18. `law` sets `data-law`, which recolours the lower bevel and adds the corner mark (a disc at 24% of the edge, minimum 12px). A letter tile is `role="img"` and its label includes the law.

### Square
An empty place on the board: recessed, deep felt, 18% radius. The active square (the next slot during spelling or retry) gets a 2px chalk ring at 70% opacity with a felt offset. A **missing-letter square** adds a sky underline (`inset 0 -0.3em 0 sky`) and the label "missing letter".

### Pips
Five 9px mastery dots (Leitner box 1 to 5). Filled dots are chalk and empty dots are a 1.5px Lichen ring. The same ramp is used in play, results and parent progress. The label reads "Mastery n of 5" or "New word". On maple, pips sit on a felt-deep pill at 80% opacity.

### KidTile
A child's identity: their initial on a maple tile, with their chosen number as the tile's point value. It appears at 40px in the rail, 48px on the play home and larger on profiles.

### WordTiles
A whole word as a small tile rack with a 3px gap, used in lists (about 22 to 30px) and results (34px). It takes optional per-letter laws. Results show the correct word in all-marigold beside the attempt, with coral, sky and stone marks.

### AnswerRow
The play row. It holds typed tiles, then squares (every remaining square when the length hint is on, otherwise one caret square). After Check, the row shows the grade alignment, with missing letters as sky squares in place. A feedback note bubble (felt-deep, with an arrow) points at the first flagged cell. The trailing slot holds Check or Next. See Layout for the fit rule.

### Plaque, Rack, Patch
- **Plaque:** a small maple object (0.7rem radius, grain 3) for badges, streak and star stats, and the spoken definition or sentence. Badges and stats are never flat fills.
- **Rack:** the walnut shelf tiles stand on. It holds the bee questions and the results scoreboard of missed words.
- **Maple fill (`.maple`):** grain and gradient for maple shapes that aren't tiles, such as fraction-bar pieces and array counters in math explanations.
- **Patch:** a calm raised-felt panel for parent screens (felt-raised at 70%, 1.25rem radius, a 1px top light). It is a slightly raised patch of board, not a card.

### Inputs / Fields
- **Style:** recessed deep felt (felt-deep mixed 85% toward black), chalk text, a 1px felt-line border, 0.8rem radius, at least 3rem tall. Selects draw a Lichen chevron in inline SVG.
- **Focus:** the global chalk outline at a 1px offset.

### Navigation
The parent header puts the Brand (four tiles "jade" plus "learning" in Lichen) on the left. On the right are felt keys: Lists, Spellers and Settings, with the active item `data-pressed`, then Practice and an icon-only sign-out. It wraps on narrow widths.

### Keypad
The only math input: real buttons, never a text field, so the iPad keyboard never opens. A 3-column grid (0.5rem gap, max 24rem) of maple tile keys 7–9 / 4–6 / 1–3, then 0 and a felt delete key. A fraction bar or decimal point key appears beside 0 only when the problem needs it; otherwise 0 spans two columns. Comparison problems swap the digits for a row of `<` `=` `>` maple keys with a felt Clear key. A full-width Check key sits below; it's an empty recess until there's something to check. Keys are 3.5rem tall (3rem in the compact variant) at 1.5rem type. A laptop keyboard types into it too (digits, `/ . < = >`, Backspace, Enter, ↑ to hear it again).

### ProblemRow
The problem laid out on the board, sized by `fitTile` from its total characters (capped at 84px). **The Chalk Operator Rule:** only numbers and the answer are tiles, because only they are handled; operators (+ − × ÷ = < >) are chalk marks drawn on the felt in Fredoka 600 at 0.6 of the tile edge (0.38 for "of"), 0.62 of the edge wide. Each digit is its own maple tile (6% gap). A fraction stacks its numerator tiles over a 4px chalk bar over its denominator tiles, at 72% of the row's tile size. The answer slot is an active square; typed digits drop in with a half-size caret square after them; after Check the answer tiles take their law (right or wrong) and flip in the usual cascade. The row is one `role="img"` whose label reads the problem aloud ("7 times 8 equals blank").

### Math explanation
A second miss opens a recessed felt well (felt-deep at 60%, 1.5rem radius): "The answer is" beside the answer in marigold tiles dropping in one per beat, the working in body type (balanced wrap), and a picture when one helps. **Dot array:** grained maple discs 8–18px on a felt-deep panel, rows × columns, for facts up to 10 × 10. **Fraction bars:** 28px bars with a Lichen ring, split into equal parts, the counted parts grained maple and the rest recessed felt, each labelled n/d in tabular figures. Results repeat the same language on the rack under "Worth another look": the problem, its answer in marigold tiles, the first wrong answer in coral-edged tiles.

### Confirm
The in-place "are you sure?" that replaces the browser's confirm box: a patch (1rem padding) that appears where the action was (under the round's rail, inside the kid's row, beside Save and Delete). A Fredoka 1.125rem question, an optional Lichen note, then two felt keys: the safe choice first ("Keep going", "Cancel") and focused, the action second. Escape backs out, and a round's own keys pause while it's open. It is an `alertdialog`, not a modal: nothing behind it is blocked or dimmed.

### Pending board
When a screen's data takes longer than about a second, the board shows three 40px maple tiles dropping in (120ms apart) beside an active square, over "Setting up the board…" in Lichen. One drop, no looping spinner.

### Motion
- **tile-drop** (240ms, ease-out-expo `cubic-bezier(0.16, 1, 0.3, 1)`; from -18px at 1.06 scale to rest): typed tiles, revealed tiles, stars and badges. Staggers are 70 to 140ms for decorative rows.
- **tile-flip** (420ms, a rotateX to 88 degrees and back): on Check, judged tiles flip in a left-to-right cascade at 55ms per tile, revealing edge colour. The cascade replays each Check through the tile key.
- **tile-nudge** (360ms, -5px then +4px): the whole row on retry.
- **tile-land** (420ms, from -56px at 1.14 scale with a small settle): star tiles on a results screen with two or three stars.
- **Perfect round:** after the stars land, they flip left to right (110ms apart) and each comes up with a marigold edge at the flip's midpoint. This is the celebration; there is no confetti or particle effect.
- **Reveal:** the correct spelling drops in one tile per spoken letter.
- **Reduced motion:** a global rule forces animation and transition durations to 1ms with one iteration, and the reveal shows the whole word at once (`prefersReducedMotion()`).

## Do's and Don'ts

### Do:
- **Do** put feedback colour only on `--tile-edge`, underlines and corner marks. Test: with the law colours desaturated, every judged tile still shows an X, plus or minus mark, and its aria-label names the law.
- **Do** use maple (`data-variant="tile"` or `"check"`) only for things the speller handles. Test: if a key isn't part of listening to, asking about or checking the word, it's felt.
- **Do** use exactly one `go` key per view for the primary non-check action, in chalk felt.
- **Do** mark selection with `data-pressed="true"` (plus `aria-current` for nav), never with a colour change.
- **Do** size answer tiles through `fitTile` so tile edge and gap scale together (gap = 10% of the edge). Test: a 15-letter word at 375px fits on one line.
- **Do** size round screens to `var(--vvh, 100dvh)` and collapse the rail while the keyboard is up. Test: on iPad with the on-screen keyboard up, the Say-it disc, the answer row and Check are all visible.
- **Do** keep every tap target at least 44px: text keys are 48px or more, and square icon-only keys are 44 to 48px.
- **Do** set `autocorrect="off"`, `autocapitalize="none"` and `spellcheck={false}` on any field that takes a spelling.
- **Do** render tile letters in `--font-tile` so the child's chosen face applies.
- **Do** keep motion to tile-drop, tile-land, tile-flip and tile-nudge on ease-out-expo, and check each new animation under `prefers-reduced-motion`.
- **Do** take math answers on the keypad only. Test: a math round has no `input` or `textarea` anywhere.
- **Do** draw operators as chalk marks on the felt; only numbers and answers are tiles.
- **Do** ask "are you sure?" in place with Confirm, with the safe choice first and focused.

### Don't:
- **Don't** use marigold for a generic primary, "start" or "continue" action. Marigold means right.
- **Don't** use coral, sky or stone for anything except wrong, missing and extra letters: no coral error banners, sky links or stone disabled states.
- **Don't** tint a tile face or colour a letter's ink to show feedback.
- **Don't** fill maple flat or use raster wood. Every maple surface carries a grain texture over the 172deg gradient.
- **Don't** put white cards, flat panels or opaque page backgrounds over the felt. Parent panels are `patch`.
- **Don't** let the answer row wrap onto two lines.
- **Don't** add floaty fades, long easings or looping motion.
- **Don't** use condensed or pixel faces, or uppercase tile letters.
- **Don't** use the browser's `confirm()` or a modal for a yes/no; they belong to no part of the board.
- **Don't** add particle effects (confetti, sparkles). Celebration is the star tiles landing and, on a perfect round, flipping to marigold.
