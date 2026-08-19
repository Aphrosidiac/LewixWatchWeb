import * as THREE from 'three'

/**
 * A hand-built studio environment, drawn to an equirectangular canvas.
 *
 * RoomEnvironment is fine for a CAD viewer but wrong here: it puts a lot of
 * small bright boxes around the subject, and polished steel picks every one of
 * them up as a hard speckle. A product shot wants a few large, soft sources —
 * one big overhead softbox, two side fills, a dark floor — so the case reads as
 * long smooth gradients with one crisp highlight rolling across it.
 */

const W = 1024
const H = 512

function paint(mode) {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')

  // Base: horizon gradient, sky over floor.
  const sky = mode.sky
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, sky.top)
  g.addColorStop(0.48, sky.horizonTop)
  g.addColorStop(0.52, sky.horizonBottom)
  g.addColorStop(1, sky.floor)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  const blob = (cx, cy, rx, ry, colour, alpha) => {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(rx, ry)
    const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
    rg.addColorStop(0, colour)
    rg.addColorStop(0.55, colour)
    rg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalAlpha = alpha
    ctx.fillStyle = rg
    ctx.beginPath()
    ctx.arc(0, 0, 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  for (const s of mode.sources) blob(s.x * W, s.y * H, s.rx * W, s.ry * H, s.colour, s.alpha)

  const tex = new THREE.CanvasTexture(c)
  tex.mapping = THREE.EquirectangularReflectionMapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

const LIGHT = {
  sky: {
    // A hard horizon is the whole trick. Polished steel is a mirror: it
    // shows whatever is around it, so a smooth all-over grey renders as
    // smooth all-over grey plastic. Splitting the environment into a bright
    // upper hemisphere and a dark lower one gives every curved surface a
    // light half, a dark half, and a crisp line where they meet — which is
    // what the eye reads as "polished".
    top: '#ffffff',
    horizonTop: '#f4f4f4',
    horizonBottom: '#3a3a3a',
    floor: '#585858',
  },
  sources: [
    // Main overhead softbox, slightly behind and above.
    { x: 0.5, y: 0.1, rx: 0.3, ry: 0.22, colour: '#ffffff', alpha: 1 },
    // Long vertical strip lights either side — these draw the streaks that
    // run down the case flanks and along each bracelet link.
    { x: 0.2, y: 0.36, rx: 0.055, ry: 0.34, colour: '#ffffff', alpha: 1 },
    { x: 0.8, y: 0.34, rx: 0.045, ry: 0.3, colour: '#ffffff', alpha: 0.9 },
    // A cooler kicker behind, to separate the silhouette from the page.
    { x: 0.5, y: 0.62, rx: 0.16, ry: 0.12, colour: '#dfe3ea', alpha: 0.5 },
    // White bounce card low and in front — this is what stops the underside
    // of every bracelet link from going to mud.
    { x: 0.0, y: 0.74, rx: 0.24, ry: 0.13, colour: '#ffffff', alpha: 0.75 },
    { x: 1.0, y: 0.74, rx: 0.24, ry: 0.13, colour: '#ffffff', alpha: 0.75 },
    // Black flags: without something genuinely dark to reflect, the metal
    // never gets its contrast back.
    { x: 0.33, y: 0.6, rx: 0.075, ry: 0.11, colour: '#000000', alpha: 0.7 },
    { x: 0.67, y: 0.62, rx: 0.075, ry: 0.11, colour: '#000000', alpha: 0.65 },
    // A large soft card directly behind the camera. Anything facing the
    // viewer head-on mirrors this patch, so leaving it dark makes every
    // flat-on surface — bracelet links especially — render as a black slab.
    { x: 0.0, y: 0.44, rx: 0.2, ry: 0.26, colour: '#e8e8e8', alpha: 0.9 },
    { x: 1.0, y: 0.44, rx: 0.2, ry: 0.26, colour: '#e8e8e8', alpha: 0.9 },
  ],
}

const DARK = {
  sky: {
    top: '#3c3c3c',
    horizonTop: '#242424',
    horizonBottom: '#080808',
    floor: '#000000',
  },
  sources: [
    { x: 0.5, y: 0.09, rx: 0.24, ry: 0.18, colour: '#ffffff', alpha: 1 },
    { x: 0.17, y: 0.38, rx: 0.04, ry: 0.3, colour: '#f0f0f0', alpha: 0.9 },
    { x: 0.83, y: 0.36, rx: 0.032, ry: 0.26, colour: '#c8c8c8', alpha: 0.7 },
    { x: 0.5, y: 0.58, rx: 0.14, ry: 0.12, colour: '#000000', alpha: 1 },
  ],
}

export function buildEnvironments(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader()

  const light = pmrem.fromEquirectangular(paint(LIGHT)).texture
  const dark = pmrem.fromEquirectangular(paint(DARK)).texture

  pmrem.dispose()
  return { light, dark }
}
