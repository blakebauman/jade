---
version: 1
slug: "src-routes"
primary_target: "src/routes"
related_targets: []
---

# Surface: Jade's World app (play, Roxy, parent)

Scope: the whole SPA in apps/web. The kid hub, profiles and Roxy carry the album most strongly. Rounds inherit the page quietly. The parent area uses the same page at lower intensity.

Visitor mode: Operate.
- Kids (8–11) start rounds, collect, and style Roxy.
- Parents load lists and check progress.

Constraints:
- Laptop or iPad; WCAG AA; no timers.
- Kids must not find it babyish.
- Rounds stay quiet.
- Day is soft daylight, never paper white. Night is a warm, dim reading lamp, never pitch black.
- Appearance: Auto follows the device's prefers-color-scheme. Parents can force Day or Night in Settings.

## Direction contract

Scope of this direction: the brand (wordmark, app icon, splash), kid identity (KidTile everywhere), profiles, and the subject hub /play/$childId. Rounds keep their maple tiles, because a kid handles letters and digits there; the landing demo row is a round mechanic and keeps them too. The sticker album idea and the four law colours stay. The jade ground may change.

THESIS: Jade's World is one place at a time. Spelling, Play and Math each fill the whole screen, one flick apart, and Learn and Play get equal billing by construction. It refuses the dashboard of cards, and the wooden-tile brand that said "spelling app" when the app is now as much play as practice.

OWN-WORLD: Every place is a full-bleed sticker page printed in its hue (spell jade, math grape, roxy berry), with a white vinyl rim inset around the screen edge and one gloss band, so the screen is the sticker. Each place owns its centre with its own media: Roxy's current look stands huge on Play; Spelling and Math carry giant cropped lettering printed a tint off their hue. White die-cut sticker glyphs stack down a right rail. The wordmark is die-cut vinyl lettering, "jade's world" in Fredoka, with a white rim, lift shadow and a foil star for the j's dot. Kids are round die-cut initial stickers with their number on a foil chip. Nothing is wood outside the rounds.

STORY: A kid picks her round sticker, lands on the place she was last in (or Spelling), sees one place at a time with its name, what's waiting and one go key, and flicks or arrows to the next. The top tabs always name all three places, so she never forgets Play or Math is there.

FIRST VIEWPORT (/play/$childId): The current place fills the viewport edge to edge in its hue, inside a vinyl rim. Top: three tabs, Spelling · Play · Math, centred, the current one filled. Top-left: the wordmark, small. Right rail, vertically centred: her round initial sticker (switch kid), foil streak, foil stars, badges "n of N" (opens the sheet), all 48px or larger. Bottom-left, anchored low: the place name at display size, one line of what's waiting, the resume line when there is one, and one go key. Centre: the place's media, never UI. Play shows the wallet beside its go key, or the closed slot in its place.

FORM: One Thing at a Time, a dealt challenger (full-bleed vertical feed grammar: one item per viewport, right rail of glyphs, caption low-left, hard snap), chosen by the user over the roll (candidate 5, The Park Map) and the pick (Letter Beads). Seed key 19ea8b26, code-led. Signature interaction: a hard scroll-snap between places, with the rail's sticker glyphs and the tabs following; the incoming place's caption rises in once it lands. Arrow keys, Page Up/Down and the tabs move between places; reduced motion snaps with no rise.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
