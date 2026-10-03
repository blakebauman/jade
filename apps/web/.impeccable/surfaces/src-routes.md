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

THESIS: Jade's World is a sticker album that fills up. Practice earns what goes on its pages, and Roxy lives in it. It refuses the category default of white cards with a mascot, and it refuses the old single-purpose spelling board.

OWN-WORLD: The ground is a glossy album page in jade. By Day it is a mint-jade liner page with a soft diagonal sheen. By Night it is the deep jade page under a warm lamp pool. The album's things are die-cut vinyl stickers: a white vinyl rim, a gloss highlight, a soft lift shadow and a slight tilt. Stars and streak are holographic silver foil, never gold, because marigold means right. Anything not yet earned is an empty sticker slot printed on the page: a dashed outline with a faint silhouette. Maple letter tiles and the four law colours are unchanged. Each subject has one sticker hue: jade for Spelling, grape for Math, berry for Roxy. None of these is a law colour.

STORY: A kid opens the album to their spread. The left page is Learn: "Pick up where you left off", a Spelling and a Math sticker, and their badges, with slots still to fill. The right page is Play: what they have to spend and one berry Play sticker with Roxy on it. They tap a sticker, play a quiet round on the page, and come back to find a new sticker placed. If a parent asked for practice first, Play is a printed slot until the day's goal is met, and then its sticker is placed.

FIRST VIEWPORT (/play/$childId): A two-page spread with a stitched spine down the middle (stacked on phones). The header has the KidTile, the name, and foil chips for streak and stars. On the left page: the resume panel, with the one go key, then large Spelling and Math stickers that carry their tile words. The header's foil star counts every star ever earned. On the left page, after the subject stickers: the badge sheet, with earned stickers tilted and placed and unearned ones as dashed slots. On the right page: "What shall we play?", the wallet (berry ticket stub; a foil "to spend" chip only while stars are linked), and the berry Play sticker with Roxy's current look, or the closed-Play `.slot` that says what opens it.

FORM: Sticker Album, IMPECCABLE’S PICK (candidate 1 on my ordered list; the roll assigned candidate 6, Under Jade's Sky). Seed key 646887de, code-led. Signature interaction: a sticker is placed by dropping and rotating to its tilt with a small settle, and it lifts a little on hover or press as if being peeled. Motion stays short and physical, and none of it runs under reduced motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
