# LewixWatchWeb

Interactive 3D viewer for an **ETA 6498-1** manual-winding watch movement —
orbit it, and open it into an exploded view that follows the real assembly
order.

Groundwork for a scroll-driven portfolio site in the vein of
[thewatch.60fps.fr](https://thewatch.60fps.fr/).

---

## Running it

```bash
npm install && npm run dev
```

Then open <http://localhost:5180>.

The committed `public/model/` output is all the viewer needs. You only have to
re-run the CAD pipeline if you change tessellation quality, the assembly-layer
mapping, or the materials.

## Controls

| Action | Input |
| --- | --- |
| Orbit | drag |
| Zoom | scroll |
| Pan | right-drag |
| Toggle exploded view | **Exploded view**, or `E` |
| Scrub the explode | the slider |
| Toggle render mode | **Finished / Technical**, or `M` |
| Reset camera + explode | **Reset**, or `R` |

Hovering a component names it in the top-right readout.

**Finished** is the per-component PBR metals — nickel bridges, brass wheels,
blued screws, ruby jewels. **Technical** swaps everything to one matte
non-metallic material, the way a CAD package would present it: no reflections
competing with the form, so bevels, gear teeth and the assembly order stay
legible.

---

## Where the model came from

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
