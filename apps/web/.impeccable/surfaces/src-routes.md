---
version: 1
slug: "src-routes"
primary_target: "src/routes"
related_targets: []
---

# Surface: Jade's World app (play, Roxy, parent)

Scope: the whole SPA in apps/web. The kid surfaces (sign-in page, kid picker, the home shelf) carry the console home most strongly. Rounds and game screens keep working as they are and inherit the shell quietly. The parent area uses the same shell at lower intensity.

Visitor mode: Operate (the sign-in page is Persuade).
- Kids (8–11) pick a game, Spelling or Math from one shelf, collect, and style Roxy.
- Parents load lists and check progress; accounts stay (no guest play).

Constraints:
- Laptop or iPad first, iPhone too; WCAG AA; no timers.
- Kids must not find it babyish.
- Rounds stay quiet; maple tiles and the four law colours stay in rounds.
- Appearance: Auto follows the device's prefers-color-scheme. Parents can force Day or Night in Settings.
- Never name the outside portal or console this was modelled on, in UI, code or docs.

## Direction contract

Scope: a rebrand. Jade's World is now a kids' games portal: her games up front, Spelling and Math two tiles among them. Brand (wordmark, app icon, splash), sign-in page, kid picker, the home (/play/$childId) and the Play home (folded into the home) change; rounds and game screens keep working.

THESIS: Jade's World is her console's home menu: one shelf of big square tiles, every game plus Spelling and Math, the one she played last first, one lit at a time. It refuses the album of places and the portal's endless thumbnail wall.

OWN-WORLD: A plain shell (Day: pale cool grey; Night: charcoal), no texture, no paper. Tiles are glossy rounded squares filled edge to edge with real art from each game; the lit tile wears a thick select-blue ring standing off its corner. One brand red owns the wordmark plate, notification counts and the tile's progress bar. Fredoka for names and counts, Lexend for lines. Round white action buttons sit under the shelf. Nothing else on the shell.

STORY: She picks herself on "Who's playing?", lands on the shelf with the last thing she played lit, sees its name above it and one line under it, slides or arrows along, and presses the tile to go. Counts on a tile say what's waiting (words, facts, a round to finish).

FIRST VIEWPORT (/play/$childId): Top bar: her sticker and name left, stars and tickets right as big numerals. Middle: the shelf, tiles about 40% of the viewport tall, the lit tile's name above it in Fredoka. Under it: the lit tile's one line and stat. Then three round buttons: Quests, Badges, Switch. Keyboard hints bottom right on a fine pointer.

FORM: Console Home, my top-ranked grounded candidate (IMPECCABLE'S PICK), chosen by the user over the roll (candidate 7, The Box Back). Seed key 66459f86, code-led. Signature interaction: the lit tile; arrows, Home/End, hover and focus move the ring along the shelf with a quick spring and the shelf glides to keep it in view; the order is most recently played first.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
