# thewatch.60fps.fr — teardown

Captured 2026-08-19 at 1465x757 viewport (desktop).

## Stack (theirs)
Svelte + GSAP/ScrollTrigger + three.js + Lenis. Two bundles: `index-*.js` (gsap/three vendor),
`the-watch.*.js` (app + lenis). Fonts **Nekst** (display) + **Inter** (UI copy).

- `new Lenis({ duration: 4 })` — very long smoothing tail. This is why the whole site
  feels like it glides; matching it matters more than any single tween.
- Debug URL params exist: `?autoscroll` (+ `?autoscrollspeed=N`, default 20px/frame),
  `?materials`. Handy for capture.
- DOM: `#loader` (SVG ring + "Now loading"), `#canvas-wrapper`, `#root`.
- **Canvas renders ABOVE the DOM copy.** The watch always occludes text, never the reverse.

## Page metrics
- Total scroll height 31802px, viewport 757px → ~42 viewport units.
- Section heights are multiples of one viewport unit (757): 1u, 2.28u, 3u, 4u, 4.5u...

| # | y | h | class | content |
|---|---|---|---|---|
| 0 | 0 | 757 | — | Hero: FS 60P |
| 1 | 757 | 1726 | big-text-section | THE / TIMELESS / AUTOMATIC / 60MM / WATCH |
| 2 | 2483 | 2271 | — | Case & Finishes · Dial & Complications |
| 3 | 4754 | 2271 | — | Exploded view (Disassembly) — drag & tap to explore |
| 4 | 7025 | 3028 | — | Mechanical Heart |
| 5 | 10053 | 2271 | — | FS60P highly precise automatic movement |
| 6 | 12324 | 2271 | single-part-section | 34/62 Elegant Contours |
| 7 | 14595 | 2271 | — | Refined Dial / Polished Hands / Premium Bezel |
| 8 | 16866 | 2271 | single-part-section | 35/62 Slim Profile |
| 9 | 19137 | 3028 | single-part-section | 36/62 Bracelet |
| 10 | 22165 | 1660 | big-text-section | Classic Edition / Sport Chronograph |
| 11 | 23825 | 3407 | — | Colourways 01–04 |
| 12 | 27232 | 1343 | — | MODEL 146GR parts/weights table |
| 13 | 29180 | 757 | — | Outro FS 60P |

## Palette
- Page bg `#EBEBEB`, loader bg `#EBEBEB`.
- Background is NOT flat: a large soft radial/blurred grey blob sits top-right and drifts
  with scroll. Reads as a studio softbox falloff behind the product.
- Type black `#000`/`#111`; inactive copy ~`#0006`; big-text inactive `#B0B0B0`-ish.

## Section 0 — Hero (0–757)
- Giant `FS 60P` split into two words, per-char spans (`.st-word` > `.st-char`),
  Nekst Light, ~clamped to viewport width, letters sit left+right of centre.
- Thin 1px circle outline behind the watch (~570px dia) with a quadrant tint and a
  progress arc stroked along the top-right — same arc as the loader, carried over.
- Bottom-left: `Color / Silver Steel` (11px Inter) and `MODEL` (grey) `146GR` (black), Nekst.
- Watch: dead centre, dial facing camera, upright.

## Section 1 — big-text (757–2483)
Stack of full-bleed lines that scroll up through the viewport:
`FS—60P` · `THE` · `TIMELESS` · `AUTOMATIC` · `60MM` · `WATCH /`
- Lines are centred-ish, huge (~190px), Nekst Light, and **tint by distance from viewport
  centre**: the line crossing the middle is near-black, the ones above/below wash out to
  light grey. Lines overlap vertically (line-height < 1).
- Watch rotates continuously with scroll: dial-front → tilted 3/4 → **edge-on ring**
  (bracelet circle, ~y1250) → **caseback/movement visible** (~y1500) → 3/4 side (~y1800)
  → back to dial-front (~y2100).
- Right column fades in two copy blocks (`Chronograph`, `Automatic Movement`) — 13px Inter,
  label in grey above a black paragraph, ~250px wide, right-aligned column at x≈1068.
- Left: a faint outlined dial glyph (circle + tick marks + two subdial holes) that scales up.

## Section 2 — Case & Finishes (2483–4754)
- Left column (x≈264, w≈195): two copy blocks stacked. Grey label + paragraph. They
  **activate in sequence**: block 1 goes black while block 2 stays grey, then block 2 goes
  black as you scroll on.
- Two small grey circular glyphs above them (step markers / dial pips), ~44px.
- **Vertical marquee**: giant black `FS—60P` letters, each rotated 90°, stacked and scrolling
  UP the centre column behind the watch. Letters are ~200px tall.
- Right: static rotated `FS—60P` label at x≈1100, mid-height.
- Watch: dial-front, drifts left of centre, then rotates to 3/4 profile by y3700.

## Section 3 — Disassembly / exploded (4754–7025)
The centrepiece. Background lerps from `#EBEBEB` to a **mid grey ~#8C8C8C** and the scene
gains a ground/horizon: a 1px horizon line at viewport mid plus a soft floor gradient.

Beats, in order:
1. Watch turns fully side-on (bracelet reads as a ring, case at left).
2. Case parts peel off toward camera-left along the case axis. Tiny screws lead the way.
3. Camera dollies **through** the stack — parts sweep past the edges of frame.
4. Settles into a flat elevation: 6 discs spread across the width, all facing the camera
   at a slight angle, floating on the horizon line.
5. Each part drops a thin vertical **leader line** down to a rotated (90°) label:
   `Dial · Tourbillon · Mainplate · Barrel · Backplate · Weight`.
6. UI: a small circled-cursor pill at top centre — `(icon) Click to explore` (grey "Click",
   black "to explore"). At the right edge, a circle badge `HOLD TO EXPLORE`.
7. Reassembles/recedes and the background drives to near-black for section 4.

Interaction (theirs): drag to orbit the exploded stack, click a part to open a detail card
(`Close / Name / Function` panel), long-press ("hold to explore") stops Lenis and pushes the
camera in — `LONGPRESS_TOGGLE` stops scroll while held.

## Section 4 — Mechanical Heart (7025–10053)
- Background **black** (#0A0A0A).
- A large **particle system** fills the frame: thousands of small light-grey dots swept along
  curved ribbon paths that loop around the movement like an eye / lemniscate. Near the start
  they read as fine streaks, later as discrete round dots — i.e. the point size and the
  camera distance both animate.
- Movement (no case/bracelet) floats centre, small, tilting from face-on to a steep
  top-down as you scroll; it lands nearly flat by y9700.
- Left column: `MECHANICAL` (grey) / `HEART` (white) at ~72px Nekst, then copy blocks
  `Automatic Movement` + paragraph, `Diameter` / `60mm`.
- Bottom-right: a huge grey **counter** `42′ → 43′ → 45′ …` (Nekst, ~200px) that increments
  with scroll — the power reserve tick. Half off-canvas to the right.

## Section 5 — Highly precise (10053–12324)
- Still black. Another big-text stack, same mechanic as section 1 but inverted:
  `FS—60P` · `/ HIGHLY` · `PRECISE` · `AUTOMATIC` · `MOVEMENT`.
  The centred line is **white**, the rest fall away to ~#2A2A2A.
- Watch is back, whole, in a dark/gunmetal finish — the same model under a dark environment,
  not a different material.
- Particles continue and thin out.
- Right column copy: `Self-Winding Movement`, `Reliability`. Left: the faint dial glyph again.
- Background lifts back to light near the end of the section.

## Section 6 — Elegant Contours (12324–14595) `single-part-section`
- Light again. **Technical-drawing overlay**: thin 1px hairlines forming a crosshair —
  a full-width horizontal rule at y≈378, a vertical rule at x≈733, short segment ticks, and
  a small `+` glyph at the intersection. Lines are ~#CFCFCF.
- Centred title `ELEGANT` / `CONTOURS` (Nekst Light ~86px, second line offset right),
  then a two-line 13px Inter caption under it.
- Watch is a big close-up, cropped by the bottom of the frame, rotating slowly.
- Top-left of the section: a counter `34 / 62`.

## Section 7 — Refined Dial (14595–16866)
- Watch **very large, right of frame**, dial facing camera, slowly counter-rotating and
  drifting right as you scroll. Bleeds off the right and bottom edges.
- Left column x≈264: three copy blocks — `Refined Dial`, `Polished Hands`, `Premium Bezel` —
  activating one at a time (active = black label-grey + black body; inactive ≈ 25% opacity).
- Faint **diagonal** hairlines cross the background (~#DEDEDE), plus the horizontal rule at
  y≈378. They translate slowly — a drifting technical grid, not a fixed one.

## Section 8 — Slim Profile (16866–19137) `single-part-section`
- Same crosshair overlay + centred `SLIM` / `PROFILE` title and 3-line caption as section 6.
- Watch seen **edge-on from below**: the case band fills the lower half, crown and pushers
  centred, bracelet falling away left and right past the frame edge. Rises and levels out
  through the section.
- Counter `35 / 62`.

## Section 9 — Bracelet (19137–22165) `single-part-section`
- Title `BRACELET` + 3-line caption, same overlay.
- The bracelet **explodes into individual links** spread across the full width, oversized,
  then **compresses back together** into a solid band as you scroll — a horizontal
  accordion. Links are alternately H-shaped (outer) and barrel-shaped (inner).
- Camera sits close, links pass out of frame left and right.
- Counter `36 / 62`.

## Section 10 — Editions (22165–23825) `big-text-section`
- Light again. Big-text stack repeats: `FS—60P` · `THE` · `TIMELESS` · `AUTOMATIC` ·
  `60MM` · `WATCH /`, same centre-focus tint.
- A **photo card** (~218×340, 6px radius) slides in from the right edge and continues
  travelling left/up across the section — a dark studio product shot.
- Right column copy: `Classic Edition`, `Sport Chronograph`.

## Section 11 — Colourways (23825–27232)
- Background becomes a **desaturated purple-grey vertical gradient** (~#6E6A72 → #9C99A0),
  much darker than the rest of the site.
- Per colourway: the name set **huge and ghosted** behind the watch on two lines
  (`SILVER` / `STEEL`), ~15% lighter than the bg. Small `Silver Steel` label pinned left at
  y=378, `01 / 04` pinned right at y=378.
- Watch rotates through 3/4 → side → 3/4 while the colour swaps between slides.
- The hero's circle outline + progress arc returns on the first slide.
- A `SELECT MODEL` circle badge sits half-off the right edge.

## Section 12 — Model breakdown (27232–28575)
- Back to light. `MODEL` in grey ~150px over `146GR` in black — `146GR` is revealed by a
  **horizontal mask that wipes from the middle outward**, so mid-scroll the glyphs read as
  broken/half-drawn shapes. Very distinctive.
- Right: a photo card (~294×186) and, under it, a **Color chip card** — bordered rounded
  box, small dot, `Color / Silver Steel`, with a circular dial glyph on its right.
- Then a **spec table**, one row per part, revealing top-to-bottom as you scroll:
  `+  Dial            01   Mechanism        11 Gr`
  Hands 02/1 · Crystal 03/12 · Bezel 04/16 · Lugs 05/18 · Strap 06/34 · Buckle 07/8 ·
  Crown 08/3 · Caseback 09/14 · Movement 10/29.
  Row height ≈76px, 1px rule between rows that **draws in from the left**; rows fade up from
  ~20% to 100% as they approach mid-viewport.

## Section 13 — Outro (29180–end)
- Giant `FS 60P` again, exactly like the hero.
- **All four colourways line up in front of it**: silver, black, gold, rose gold, each turned
  3/4, evenly spaced across the width, overlapping the letterforms.
- `SELECT MODEL` circle badge half-off the right edge.

## Recurring furniture
- Copy block: 11px Inter grey label (`#0006`), 4px gap, 13px/1.35 black paragraph, ~250px wide.
- Circle badges (`HOLD TO EXPLORE`, `SELECT MODEL`) sit half-off the right edge, ~64px,
  1px border, 9px uppercase Inter, two lines.
- Section counters (`34 / 62`) are 11px Inter.
- Everything animates off ONE thing: scroll position. No autoplay, no time-based loops
  except the particle field and the watch's own idle drift.
