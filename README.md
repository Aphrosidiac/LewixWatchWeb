# LewixWatchWeb

Two things live here:

1. **The site** (`/`) — a scroll-driven product page for a fictional watch,
   **LX 60P**. Fourteen sections, one continuous camera move, everything driven
   by scroll position. Built as a recreation of
   [thewatch.60fps.fr](https://thewatch.60fps.fr/) — the flow, the timing and
   the layout are matched section for section; the watch itself is a different
   model.
2. **The viewer** (`/viewer.html`) — an interactive exploded view of a real
   **ETA 6498-1** movement, built from CAD. The site's disassembly section uses
   the same geometry.

---

## Running it

```bash
npm install && npm run dev
```

Then open <http://localhost:5180> for the site, or
<http://localhost:5180/viewer.html> for the movement viewer.

---

# The site

## How it is put together

| File | Job |
| --- | --- |
| [`src/site/content.js`](src/site/content.js) | every string, and each section's scroll length in viewport heights |
| [`src/site/dom.js`](src/site/dom.js) | builds all fourteen sections |
| [`src/site/scene.js`](src/site/scene.js) | the 3D stage, the pose track, the exploded movement |
| [`src/site/env.js`](src/site/env.js) | the studio lighting environment |
| [`src/site/particles.js`](src/site/particles.js) | the dust ribbons in the dark chapter |
| [`src/site/main.js`](src/site/main.js) | the scroll loop that drives DOM and scene together |

Vanilla JS, three.js and [Lenis](https://lenis.darkroom.engineering/). No
framework, no GSAP — the whole page is a single `requestAnimationFrame` loop
reading one number.

### One pose curve, not fifty scroll triggers

Everything the watch does is a single continuous curve through the page,
declared as a list of keys in `scene.js`:

```js
{ at: ['timeless', 0.29], rx: -3 * DEG, ry: -92 * DEG, s: 1.66 }
```

`at` is a section id and a progress within it, so retiming a section in
`content.js` drags its keys with it and the curve stays smooth across the join.
Channels that a key omits are inherited, so most keys are one or two numbers.

Subjects — the whole watch, the bare movement, the bracelet, the four-up
line-up — are **hard cuts, never crossfades**. Every cut is placed on a frame
where the outgoing and incoming objects both read as the same thin sliver, so
the cut is invisible; and keeping each subject's keys on its own track means
the curve never has to interpolate between two objects' unrelated coordinate
frames.

### The canvas is above the copy

`#canvas-wrapper` sits at `z-index: 2`, the sections at `1`. The watch always
occludes type and never the other way round. That single rule does most of the
compositing.

### Framing close-ups

The model is a closed bracelet loop, so its bounding-box centre is somewhere in
the middle of the strap. A `focus` channel slides the model until the **dial**
is on the rig origin, which is what makes the three close-up sections
(contours, dial, profile) aimable at all. The rigs also use `ZYX` rotation
order so roll is applied last, in world space — with the default order, roll
just spins the watch about its own dial and the side-on profile shot is
impossible to compose.

### Lighting

`env.js` paints an equirectangular studio to canvas rather than loading an HDR.
The important part is a **hard horizon**: a bright upper hemisphere over a dark
lower one. Polished steel is a mirror, so a smooth all-over grey environment
renders as smooth all-over grey plastic; the split gives every curved surface a
light half, a dark half and a crisp terminator, which is what reads as
"polished".

The dark chapter does **not** swap to a dark environment. A mirror-finish metal
lit by a black room renders black, and the calibre would disappear exactly
where the story wants it centre stage. Instead the page goes dark and the
watch's `envMapIntensity` is pulled down so it reads gunmetal, while the
movement stays fully lit.

### The editorial stills

The photo cards in the editions and breakdown sections are not stock images —
they are rendered from the same model and the same lighting at load time
(`productShot()` in `scene.js`) into a 2D canvas. Costs one frame, and the
cards can never drift out of step with the live stage.

## The model

`public/model/luxury-watch.glb` is a Sketchfab-style export whose every
material arrives with `metalness: 0`, which renders steel as grey plastic, and
whose case, bracelet and dial *share* materials — so material name alone cannot
separate them. Size can: anything spanning more than a few model units is
structure, everything smaller is dial furniture sitting inside the case. The
donor model's engraved brand text is hidden; this site is branded LX 60P.

## Fonts

**Nekst** (display) and **Inter** (UI) in `public/fonts/`. Inter is SIL Open
Font License. Nekst was mirrored from the reference site's own asset directory
to match its typography exactly — if you fork this for anything real, license
it properly from the foundry or substitute a geometric grotesque you own.

---

# The movement viewer

## Where the movement model came from

`source/` is the ETA 6498-1 assembly published on
[GrabCAD](https://grabcad.com/library/eta-6498-1-complete-watch-movement) by
**Steen Winther**. All credit for the CAD work is theirs; nothing in `source/`
was authored here.

> **On redistribution.** GrabCAD's terms cover downloading and using models as
> a member; they do not grant a right to redistribute. `source/` and the
> derived `public/model/watch.glb` are mirrored here for reproducibility of the
> pipeline, with attribution and no claim of authorship. If Steen Winther or
> GrabCAD would rather they weren't, open an issue and they come out — the
> pipeline in `scripts/` is the original work here and stands without them.
>
> The calibre is a real Swatch Group product. This is an unaffiliated technical
> demo; keep any public-facing use editorial and unbranded.

Most of that folder is `.sldprt` / `.sldasm` — proprietary SolidWorks binaries
with no free macOS reader. **They are not used.** The pipeline reads
`ETA 6498-1 Movement.IGS`, a neutral IGES export shipped alongside them.

## The pipeline

```bash
npm run setup    # one-time: Python venv with OCCT bindings + trimesh
npm run model    # IGES -> public/model/
```

One script, [`scripts/build_model.py`](scripts/build_model.py), driven by
OCCT's Python bindings (`cadquery-ocp` — the same kernel FreeCAD wraps) and
trimesh. Both install from PyPI in a couple of minutes.

> An earlier attempt used FreeCAD + Blender headless. Both were abandoned: the
> FreeCAD cask spent 15 minutes unpacking its ~2.5GB bundle at roughly 70KB/s
> and never finished. The PyPI route needs no GUI apps at all.

### Keeping parts separable and named

This is the whole reason the exploded view is possible, so it is worth being
precise about.

The IGES stores each component twice over: a **type-308 subfigure definition**
holding the geometry and its name, and a **type-408 singular subfigure
instance** placing it in the assembly. There are 40 definitions but 44
instances, because repeated hardware reuses one definition — three identical
barrel-bridge screws, two each for the train-wheel and pallet bridges.

So the script walks the 44 transfer roots, reads each one's name back through
its `Subfigure()` reference, and transfers roots **one at a time**. Name and
geometry are paired by construction rather than by assuming two lists came back
in the same order. Duplicate instances get numeric suffixes so they stay
addressable as separate meshes.

Two gotchas worth knowing if you touch this:

- `IGESCAFControl` (the name-preserving XCAF reader) is **not** in this build of
  `cadquery-ocp` — only `IGESControl`. Hence the manual name resolution.
- One part name, "303 Two–piece regulator", contains a cp1252 en-dash (0x96)
  which blows up `ToCString()` at the pybind boundary. `safe_name()` falls back
  to character-wise access and re-decodes.

### Failed-trim repair

Three screws — click, ratchet-wheel and crown-wheel — carry faces whose
trimming curves OCCT could not apply, so the underlying surface arrives
untrimmed and sprays ribbons right across the movement. Each affected part ends
up **wider than the main plate**, and the assembly's raw bounds came out at
52 × 59 × 20mm.

The signature is sharply bimodal: for a broken part the 95th-percentile face
radius is 15–22× the median, while every intact part in this assembly sits at
4.2× or below — a wide, unambiguous gap. `repair_failed_trims()` drops the far
faces of anything above 8×; the real screw bodies sit well inside the cutoff and
survive untouched.

After repair the raw bounds are **37.19 × 54.74 × 5.96mm**. The real 6498-1 is
36.6mm across and ~4.5mm thick, so the disc and thickness are both right — the
54.74 is the winding stem projecting radially, as it should.

### Assembly layers

`parts.json` maps each ETA part number to its place in the assembly. Negative is
the dial side, `0` is the main plate, positive stacks up the train side:

| Layer | Components |
| ---: | --- |
| −2.6 | setting-lever screws |
| −2.0 | keyless works — stem, winding & sliding pinions, yoke, setting levers and wheels |
| −1.4 | hour wheel |
| −1.0 | cannon pinion, minute wheel |
| **0** | **main plate** |
| +1.0 | going train — barrel, centre / third / second wheels, escape wheel, pallet fork |
| +2.0 | barrel, train-wheel and pallet bridges |
| +2.6 | their screws |
| +3.0 | winding works — ratchet wheel, crown wheel + ring, click |
| +3.6 | their screws |
| +4.0 | balance wheel |
| +5.0 | balance bridge |
| +5.4 | regulator, Incabloc shock setting |
| +6.0 | balance-bridge screw |

The viewer spreads parts from the midpoint of that range, so the assembly opens
about its centre instead of drifting off-frame.

To re-time or re-order the explode, edit `LAYERS` in
[`scripts/build_model.py`](scripts/build_model.py) and re-run — no viewer
changes needed.

The viewer resolves a part's layer from the **leading token** of its mesh name
("105M", "5105", "Incabloc"), never the full string, so neither the duplicate
suffixes nor any name mangling in the glTF round-trip can break the mapping.
Unmapped parts are warned about in the console rather than silently placed at 0.

---

## Layout

```
source/              CAD files as downloaded (the IGES is the one that matters)
scripts/             build_model.py — the whole pipeline
public/model/        watch.glb + parts.json, the only artefacts the site loads
src/                 viewer
.venv/               Python env from `npm run setup` (gitignored)
```

## Rendering

The CAD source carries **no materials at all** — see below — so everything on
screen is authored in the viewer.

**Surface finishes** ([`src/finishes.js`](src/finishes.js)) are drawn to canvas
at load time and used as both roughness and bump maps, because on a real
movement the graining *is* the roughness variation and the same grooves catch
the light as relief. Repeats are set from real decoration sizes rather than by
eye: the UV projection spans 54.7mm, so côtes de Genève at repeat 3 gives
1.66mm bands (genuine striping is 1.5–3mm), and perlage at repeat 7 gives
~0.87mm spots.

UVs are a planar projection down the movement axis, generated by the build
script. Parts with a `radial` finish get UVs centred on their own centroid and
normalised to their own extent — a shared global projection would centre every
wheel's turning marks on the movement's axis instead of its own.

**Ambient occlusion** (GTAO) is what separates this from a flat CAD viewport:
it darkens the contact between stacked bridges, the recesses the wheels sit in,
and the gaps between gear teeth. Without it every part reads as floating no
matter how good the materials are.

Three things are tuned for cost:

- Pixel ratio is capped at 1.5, not 2. The AO pass and its denoise run per
  pixel, so a retina ratio of 2 means ~4.4M pixels of screen-space work per
  frame.
- GTAO uses 8 samples, not 16. The denoise hides the extra noise on detail this
  dense.
- The shadow map is a full re-render of all 264k triangles, so it is driven
  manually — the light is fixed and the geometry only moves while the explode
  animates, so orbiting the camera does not invalidate a single shadow.

Thin stacked discs are the worst case for shadow acne; `normalBias` handles it,
where a constant depth bias large enough to work would detach the shadows from
their casters.

> **Frame rate is unverified.** It could not be measured from the automated
> browser pane — the tab reports `visibilityState: "hidden"`, which throttles
> `requestAnimationFrame` to ~1Hz, and timing `composer.render()` directly only
> measures CPU command submission because WebGL is asynchronous. Check it in a
> real browser window. If it needs more headroom, drop the pixel-ratio cap to
> 1.25 or the GTAO samples to 4 before sacrificing anything else.

## Notes

- 44 components, ~264k triangles, 9.6MB GLB. No Draco — trimesh doesn't emit
  it, and gzip on the wire covers most of the gap. Worth revisiting with
  `gltfpack`/meshopt if load time matters on the final site.
- This is the **movement only** — no case, dial, hands, crystal or strap. Those
  are still to be modelled for the full site.
- IGES is a *surface* format, so parts are not guaranteed watertight. Fine for
  rendering; booleans on this geometry would not be.
- The GrabCAD source is a real Swatch Group calibre. Keep the site's framing
  editorial and unbranded.
