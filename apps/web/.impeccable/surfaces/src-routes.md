---
version: 1
slug: "src-routes"
primary_target: "src/routes"
related_targets: []
---

# Surface: Jade Learning app (play + parent)

Scope: whole SPA in apps/web. The play surfaces (/play/*) are the core; the parent area (/parent/*) and sign-in inherit the same world at lower intensity.
Visitor mode: Operate. The speller's task is to hear the word, ask bee questions, and spell it. The parent's task is to load lists and check trouble words.
Constraints:
- Laptop with a keyboard, or iPad with touch, the on-screen keyboard or a keyboard case.
- iOS audio needs a tap before sound can play.
- WCAG AA. No timers.

## Direction contract

THESIS: Every letter is a physical maple tile the speller places on a jade board, so a spelling is an object you can check piece by piece. The contract refuses the category default: a white card with a mascot and a green Check button.

OWN-WORLD:
- The ground is deep jade felt, and it owns the full viewport.
- Letters are maple tiles with a soft bevel, a pressed dark-ink letter and a small drop shadow.
- The only other colours are premium-square fields: marigold, coral, sky and stone. Each carries exactly one law:
  - marigold means right;
  - coral means the wrong letter;
  - sky means a missing letter;
  - stone means an extra letter.
- Feedback colour sits on tile edges and underlines. Letter ink stays dark.
- The type is a rounded, geometric, lowercase-friendly sans. Letterforms matter, so no condensed faces and no pixel faces.
- Mastery appears as five pips on every word tile.

STORY: The speller sees one word slot and a big Say-it tile. They ask "Definition?", "Sentence?" or "Origin?" as tiles on a rack, type or tap letters into squares, and press Check. Each tile then lights on its edge. A miss reveals the right spelling tile by tile, in time with the voice. The round ends with a scoreboard rack of the missed words.

FIRST VIEWPORT (/play/$child/$list/bee):
- The jade board fills the screen, with a thin top rail holding the child's avatar, "word 3 of 12" as a row of tiny tile dots, and an exit.
- Centre-top: a large round maple Say-it tile (about 120px) with a speaker glyph. A Slow tile sits beside it.
- Below that, a rack of three bee-question tiles: Definition, Sentence, Origin. An answer appears on a maple "card" strip under the rack.
- Centre: the answer row of tile squares, 64–88px each and scaling with word length. The primary action is a marigold Check key-tile at the right end of the row.
- On an iPad with the keyboard up, the rail collapses and the row stays above the keyboard.

FORM: Letter tiles on a game board. This was candidate 3 on my ordered list, seed 9f44c190. It is code-led. Raises taken from the challengers:
- Split-flap: the cascade reveal.
- Cloud edge: colour on edges only.
- Gravity rain: one colour, one law.
- Star atlas: the fixed five-pip mastery ramp.
- Monochrome canon: each feedback line points at its tile.

Signature interaction: tiles drop into squares with a short settle (spring, about 180ms). On Check, the tiles flip in a left-to-right cascade that reveals the edge colours. When a word is missed, the correct tiles clack in one per beat while the voice spells them.

Motion grammar:
- Short, physical settles.
- No floaty fades.
- Everything is disabled under reduced motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
