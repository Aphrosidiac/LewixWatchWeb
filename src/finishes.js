import * as THREE from 'three'

/**
 * Procedural surface finishes, drawn to canvas at load time.
 *
 * These are the decorations actually applied at the bench, and they are what
 * separates a "finished" movement from bare CAD: perlage on the main plate,
 * cotes de Geneve striping across the bridges, concentric turning marks on the
 * wheels, straight graining on the levers, near-mirror screw heads.
 *
 * Each pattern is a single greyscale image used as both roughnessMap and
 * bumpMap. That is deliberate — on a real movement the graining *is* the
 * roughness variation, and the same grooves catch light as relief. Generating
 * them here rather than shipping texture files keeps the site self-contained.
 *
 * Everything except `radial` tiles seamlessly, because those parts share one
 * assembly-wide UV projection and repeat across it. `radial` is centred per
 * part by the build script and is not tiled.
 */

const SIZE = 1024

function makeCanvas() {
  const c = document.createElement('canvas')
  c.width = SIZE
  c.height = SIZE
  return c
}

/** Overlapping circular graining — main plates. */
function perlage(ctx) {
  ctx.fillStyle = '#9a9a9a'
  ctx.fillRect(0, 0, SIZE, SIZE)

  const cells = 9
  const step = SIZE / cells
  const radius = step * 0.62

  ctx.lineWidth = 1

  for (let row = -1; row <= cells; row++) {
    for (let col = -1; col <= cells; col++) {
      // Offset alternate rows so the spots interlock the way a rotating
      // abrasive peg actually lays them down.
      const cx = (col + (row % 2 ? 0.5 : 0)) * step + step * 0.5
      const cy = row * step + step * 0.5

      for (let r = radius; r > 1.5; r -= 1.6) {
        const shade = 132 + Math.random() * 74
        ctx.strokeStyle = `rgb(${shade},${shade},${shade})`
        ctx.beginPath()
        const start = Math.random() * Math.PI * 2
        ctx.arc(cx, cy, r, start, start + Math.PI * 1.75)
        ctx.stroke()
      }
    }
  }
}

/** Cotes de Geneve — the parallel striping across bridges. */
function cotes(ctx) {
  const bands = 11
  const bandW = SIZE / bands

  for (let b = 0; b < bands; b++) {
    const x0 = b * bandW
    // Each band is cut in one pass, so it reads slightly brighter at the
    // leading edge and falls away across its width.
    const grad = ctx.createLinearGradient(x0, 0, x0 + bandW, 0)
    grad.addColorStop(0, '#7e7e7e')
    grad.addColorStop(0.22, '#c2c2c2')
    grad.addColorStop(1, '#8c8c8c')
    ctx.fillStyle = grad
    ctx.fillRect(x0, 0, bandW, SIZE)
  }

  // Fine tool marks running along the stripes.
  ctx.globalAlpha = 0.16
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * SIZE
    const y = Math.random() * SIZE
    const len = 12 + Math.random() * 90
    const shade = Math.random() > 0.5 ? 255 : 0
    ctx.strokeStyle = `rgb(${shade},${shade},${shade})`
    ctx.lineWidth = Math.random() < 0.8 ? 1 : 2
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x, y + len)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

/** Concentric turning marks — wheels and barrels. Centred, not tiled. */
function radial(ctx) {
  ctx.fillStyle = '#a4a4a4'
  ctx.fillRect(0, 0, SIZE, SIZE)

  const cx = SIZE / 2
  const cy = SIZE / 2

  ctx.lineWidth = 1
  for (let r = SIZE * 0.5; r > 0.5; r -= 1.15) {
    const shade = 128 + Math.random() * 88
    ctx.strokeStyle = `rgb(${shade},${shade},${shade})`
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }
}

/** Straight graining — levers, springs, the keyless works. */
function brush(ctx) {
  ctx.fillStyle = '#a0a0a0'
  ctx.fillRect(0, 0, SIZE, SIZE)

  for (let i = 0; i < 9000; i++) {
    const y = Math.random() * SIZE
    const x = Math.random() * SIZE
    const len = 30 + Math.random() * 260
    const shade = 120 + Math.random() * 100
    ctx.strokeStyle = `rgba(${shade},${shade},${shade},0.5)`
    ctx.lineWidth = Math.random() < 0.85 ? 1 : 2
    ctx.beginPath()
    // Wrap horizontally so the pattern tiles.
    ctx.moveTo(x, y)
    ctx.lineTo(x + len, y)
    ctx.stroke()
    if (x + len > SIZE) {
      ctx.beginPath()
      ctx.moveTo(x - SIZE, y)
      ctx.lineTo(x + len - SIZE, y)
      ctx.stroke()
    }
  }
}

/** Near-mirror, with only faint swirl — screw heads. */
function polish(ctx) {
  ctx.fillStyle = '#d8d8d8'
  ctx.fillRect(0, 0, SIZE, SIZE)

  ctx.globalAlpha = 0.1
  for (let i = 0; i < 900; i++) {
    const shade = 190 + Math.random() * 60
    ctx.strokeStyle = `rgb(${shade},${shade},${shade})`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(
      Math.random() * SIZE,
      Math.random() * SIZE,
      20 + Math.random() * 190,
      0,
      Math.PI * 2
    )
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

const PATTERNS = { perlage, cotes, radial, brush, polish }

// How many times each pattern repeats across the assembly-wide UV projection.
// `radial` is per-part and must not tile.
// Repeats are set from real decoration sizes, not by eye.
//
// The UV projection spans the assembly's 54.7mm. The cotes tile carries 11
// bands, so band width is 54.7 / (11 x repeat) mm: a repeat of 9 gives 0.55mm
// stripes, far finer than the real thing and too small to resolve — the bridges
// just look smooth. Genuine cotes de Geneve run about 1.5-3mm, so repeat 3
// (1.66mm) is right.
//
// Perlage spots are 9 per tile: repeat 7 puts them at ~0.87mm, matching the
// ~1mm peg used on a plate this size.
const REPEAT = {
  perlage: 7,
  cotes: 3,
  brush: 14,
  polish: 5,
  radial: 1,
}

/**
 * Build every finish texture once.
 * Returns { [finish]: THREE.CanvasTexture }.
 */
export function buildFinishTextures(renderer) {
  const maxAniso = renderer.capabilities.getMaxAnisotropy()
  const out = {}

  for (const [name, draw] of Object.entries(PATTERNS)) {
    const canvas = makeCanvas()
    draw(canvas.getContext('2d'))

    const tex = new THREE.CanvasTexture(canvas)
    const repeat = REPEAT[name] ?? 1

    if (name === 'radial') {
      // Per-part UVs already place the wheel inside 0..1; clamping stops the
      // rings from ghosting outside the part.
      tex.wrapS = THREE.ClampToEdgeWrapping
      tex.wrapT = THREE.ClampToEdgeWrapping
    } else {
      tex.wrapS = THREE.RepeatWrapping
      tex.wrapT = THREE.RepeatWrapping
      tex.repeat.set(repeat, repeat)
    }

    // Graining is high-frequency detail viewed at a glancing angle — without
    // anisotropic filtering it turns to mush the moment the part tilts away.
    tex.anisotropy = maxAniso
    tex.colorSpace = THREE.NoColorSpace // it is data, not colour
    tex.needsUpdate = true

    out[name] = tex
  }

  return out
}
