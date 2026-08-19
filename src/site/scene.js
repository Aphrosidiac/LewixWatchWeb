import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { buildEnvironments } from './env.js'
import { createParticles } from './particles.js'
import { buildFinishTextures } from '../finishes.js'
import { COLOURWAYS, EXPLODE_LABELS } from './content.js'

const DEG = Math.PI / 180

/* ------------------------------------------------------------------ *
 * Pose track
 *
 * One continuous curve through the whole page. Each key is anchored to a
 * section and a progress within it, so retiming a section in content.js
 * drags its keys along and the curve stays smooth across the joins.
 * Missing channels inherit from the previous key.
 * ------------------------------------------------------------------ */

/* Which object owns the stage, by scroll. Subjects are hard cuts, never
   crossfades: every cut in this story happens on a frame where the outgoing
   and incoming objects read as the same thin sliver, so a cut is invisible
   and a crossfade would only muddy it. Keeping subjects separate also means
   the pose curve never has to interpolate between two objects' unrelated
   coordinate frames. */
const SUBJECTS = [
  ['hero', 0, 'watch'],
  ['disassembly', 0.07, 'movement'],
  ['precise', 0.02, 'watch'],
  ['bracelet', 0.03, 'bracelet'],
  // Clear the stage before the next section's headline scrolls in — the
  // bracelet section is tall enough that its last stretch overlaps it.
  ['bracelet', 0.84, 'none'],
  ['editions', 0.02, 'none'],
  ['colour', 0.02, 'watch'],
  ['model', 0.02, 'none'],
  ['outro', 0, 'lineup'],
]

const KEYS = [
  // ---- watch: hero -> case & finishes ----------------------------------
  { at: ['hero', 0], subject: 'watch', focus: 0, rx: -2 * DEG, ry: 0, rz: 0, x: 0, y: 0, z: 0, s: 1.42 },
  { at: ['hero', 1], rx: -4 * DEG, ry: -26 * DEG, s: 1.58 },

  // one full revolution through the display stack
  { at: ['timeless', 0.14], ry: -46 * DEG, s: 1.62 },
  { at: ['timeless', 0.29], rx: -3 * DEG, ry: -92 * DEG, s: 1.66 },
  { at: ['timeless', 0.43], rx: 2 * DEG, ry: -142 * DEG, s: 1.6, x: 0.03 },
  { at: ['timeless', 0.6], rx: -1 * DEG, ry: -222 * DEG, s: 1.52, x: -0.02 },
  { at: ['timeless', 0.78], rx: -2 * DEG, ry: -360 * DEG, s: 1.44, x: 0 },
  { at: ['timeless', 1], rx: -2 * DEG, ry: -360 * DEG, s: 1.44 },

  { at: ['case', 0.18], rx: -2 * DEG, ry: -360 * DEG, s: 1.44, x: 0 },
  { at: ['case', 0.36], rx: -1 * DEG, ry: -374 * DEG, s: 1.5, x: -0.02 },
  { at: ['case', 0.55], rx: 0, ry: -424 * DEG, s: 1.54, x: -0.03 },
  { at: ['case', 0.78], rx: 0, ry: -448 * DEG, s: 1.6, x: -0.03 },
  { at: ['case', 1], rx: 0, ry: -450 * DEG, s: 1.66, x: -0.02 },
  // held edge-on right up to the cut, so the swap lands on a sliver
  { at: ['disassembly', 0.07], rx: 0, ry: -450 * DEG, s: 1.66, x: -0.02 },

  // ---- movement: disassembly -> mechanical heart -----------------------
  // The rig's base already stands the movement up facing camera, so ry here
  // is a turn away from the viewer and rx is a tip toward the top-down.
  { at: ['disassembly', 0.07], subject: 'movement', rx: 0, ry: -90 * DEG, rz: 0, x: 0, y: 0, z: 0, s: 1.5, explode: 0 },
  { at: ['disassembly', 0.17], rx: -4 * DEG, ry: -56 * DEG, s: 1.62, x: 0.06, z: 0.7, explode: 0.34 },
  { at: ['disassembly', 0.31], rx: -3 * DEG, ry: -22 * DEG, s: 1.5, x: 0.02, z: 0.35, explode: 0.82 },
  { at: ['disassembly', 0.45], rx: -1 * DEG, ry: -7 * DEG, s: 1.2, x: 0, z: 0, explode: 1 },
  { at: ['disassembly', 0.62], rx: -1 * DEG, ry: -4 * DEG, s: 1.2, x: -0.01, z: 0, explode: 1 },
  { at: ['disassembly', 0.8], rx: 0, ry: 5 * DEG, s: 1.55, x: -0.14, z: 1.15, explode: 1.2 },
  { at: ['disassembly', 1], rx: 5 * DEG, ry: 0, s: 0.9, x: 0, z: 0, explode: 0.02 },

  { at: ['heart', 0.06], rx: 6 * DEG, ry: 0, s: 0.88, y: 0, explode: 0 },
  { at: ['heart', 0.3], rx: 16 * DEG, ry: -14 * DEG, s: 0.95, y: 0.01 },
  { at: ['heart', 0.58], rx: 40 * DEG, ry: -34 * DEG, s: 0.98, y: 0.02 },
  { at: ['heart', 0.82], rx: 62 * DEG, ry: -58 * DEG, s: 0.88, y: 0.05 },
  { at: ['heart', 1], rx: 74 * DEG, ry: -74 * DEG, s: 0.76, y: 0.06 },

  // ---- watch again: highly precise -> slim profile ----------------------
  { at: ['precise', 0.02], subject: 'watch', focus: 0, rx: 16 * DEG, ry: -20 * DEG, rz: 0, x: 0, y: 0.03, z: 0, s: 1.1 },
  { at: ['precise', 0.42], rx: 2 * DEG, ry: -6 * DEG, s: 1.5, y: 0 },
  { at: ['precise', 0.72], rx: -2 * DEG, ry: 0, s: 1.62, y: 0 },
  { at: ['precise', 1], rx: -2 * DEG, ry: 2 * DEG, s: 1.72, y: -0.02 },

  // From here the close-ups are framed on the CASE, not on the bounding box
  // of the whole loop — `focus` slides the model so the dial sits at the rig
  // origin. Without it every one of these poses has to carry a hand-tuned
  // offset that breaks the moment the scale changes.
  { at: ['contours', 0.12], focus: 1, rx: 24 * DEG, ry: 3 * DEG, s: 1.8, x: 0, y: -0.42, z: 0.2 },
  { at: ['contours', 0.5], rx: 14 * DEG, ry: 5 * DEG, s: 1.95, y: -0.37, z: 0.3 },
  { at: ['contours', 0.88], rx: 4 * DEG, ry: 7 * DEG, s: 2.1, y: -0.32, z: 0.4 },
  { at: ['contours', 1], rx: 1 * DEG, ry: 8 * DEG, s: 2.15, y: -0.3, z: 0.42 },

  { at: ['dial', 0.15], focus: 1, rx: 0, ry: 9 * DEG, s: 2.3, x: 0.06, y: -0.08, z: 0.4 },
  { at: ['dial', 0.5], rx: -2 * DEG, ry: 13 * DEG, s: 2.5, x: 0.14, y: -0.01, z: 0.5 },
  { at: ['dial', 1], rx: -4 * DEG, ry: 17 * DEG, s: 2.7, x: 0.18, y: 0.03, z: 0.55 },

  // Looking straight down the bracelet's own axis, rolled so the case sits at
  // the top of the loop and the strap falls away either side.
  { at: ['profile', 0.12], focus: 1, rx: -16 * DEG, ry: -90 * DEG, rz: -74 * DEG, s: 2.7, x: 0, y: -0.5, z: 0.3 },
  { at: ['profile', 0.5], rx: -8 * DEG, ry: -90 * DEG, rz: -70 * DEG, s: 2.95, y: -0.44, z: 0.4 },
  { at: ['profile', 1], rx: -2 * DEG, ry: -91 * DEG, rz: -67 * DEG, s: 3.1, y: -0.38, z: 0.45 },

  // ---- bracelet ---------------------------------------------------------
  { at: ['bracelet', 0.03], subject: 'bracelet', focus: 0, rx: 0, ry: 0, rz: 0, s: 1, x: 0, y: -0.12, z: 0, explode: 1 },
  { at: ['bracelet', 0.42], y: -0.1, explode: 0.6 },
  { at: ['bracelet', 0.72], y: -0.06, explode: 0.16 },
  { at: ['bracelet', 0.84], y: -0.05, explode: 0 },

  // ---- editions / model breakdown: type only ---------------------------
  { at: ['editions', 0.02], subject: 'none', s: 1 },

  // ---- colourways -------------------------------------------------------
  { at: ['colour', 0.02], subject: 'watch', focus: 0, rx: -4 * DEG, ry: -36 * DEG, rz: 0, x: 0, y: 0, z: 0, s: 1.5 },
  { at: ['colour', 0.22], rx: -2 * DEG, ry: -54 * DEG, s: 1.56 },
  { at: ['colour', 0.45], rx: -3 * DEG, ry: -22 * DEG, s: 1.5 },
  { at: ['colour', 0.68], rx: -2 * DEG, ry: -44 * DEG, s: 1.52 },
  { at: ['colour', 0.9], rx: -3 * DEG, ry: -30 * DEG, s: 1.5 },
  { at: ['colour', 1], rx: -3 * DEG, ry: -38 * DEG, s: 1.42 },

  { at: ['model', 0.02], subject: 'none', s: 1 },

  // ---- outro: the four finishes lined up -------------------------------
  { at: ['outro', 0], subject: 'lineup', rx: -3 * DEG, ry: -34 * DEG, rz: 0, x: 0, y: 0, z: 0, s: 0.92 },
  { at: ['outro', 1], rx: -3 * DEG, ry: -34 * DEG, s: 0.92 },
]

const CHANNELS = ['rx', 'ry', 'rz', 'x', 'y', 'z', 's', 'explode', 'focus']

const smoothstep = (t) => t * t * (3 - 2 * t)
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t)

/* ------------------------------------------------------------------ */

function normalise(obj, target = 1) {
  const box = new THREE.Box3().setFromObject(obj)
  const size = new THREE.Vector3()
  const centre = new THREE.Vector3()
  box.getSize(size)
  box.getCenter(centre)
  const k = target / Math.max(size.x, size.y, size.z)
  obj.scale.multiplyScalar(k)
  obj.position.sub(centre.multiplyScalar(k))
  return { size, k }
}

/**
 * A bracelet link: a shallow cylindrical shell, not a slab.
 *
 * Flat-fronted links render dead: a plane facing a soft studio sky reflects
 * one uniform patch of it and reads as grey card. Curving the front face by
 * even a few degrees sweeps the reflection across the link, which is the
 * whole reason a polished bracelet reads as metal.
 */
function linkGeometry(width, height, depth, arc) {
  // Radius that makes a shell of the given arc span `width`.
  const radius = width / (2 * Math.sin(arc / 2))
  const g = new THREE.CylinderGeometry(radius, radius, height, 24, 1, false, -arc / 2, arc)
  // Flatten the shell to the depth we want, then centre it on its own bounds.
  g.scale(1, 1, depth / radius)
  g.computeVertexNormals()
  return g.center()
}

export async function createScene(canvas, onProgress) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  })
  renderer.setClearAlpha(0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 200)
  camera.position.set(0, 0, 5)

  const envs = buildEnvironments(renderer)
  scene.environment = envs.light

  // The dark chapter kills the environment's contribution, and a calibre lit
  // only by a black room is a black disc. One raking key restores the
  // gold-on-nickel reading without lifting the background.
  const key = new THREE.DirectionalLight(0xffffff, 0)
  key.position.set(-1.4, 2.2, 2.6)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0xcfd6e6, 0)
  rim.position.set(2.2, -0.6, -1.8)
  scene.add(rim)

  /* ---- subjects ---------------------------------------------------- */
  const stage = new THREE.Group()
  scene.add(stage)

  const watchRig = new THREE.Group()
  const movementRig = new THREE.Group()
  const braceletRig = new THREE.Group()
  const lineupRig = new THREE.Group()
  stage.add(watchRig, movementRig, braceletRig, lineupRig)

  // ZYX puts the roll LAST, in world space. With the default XYZ order the
  // roll is applied in the model's own frame, where it just spins the watch
  // about its dial instead of rotating the framed composition — which makes
  // the side-on profile shot impossible to aim.
  for (const r of [watchRig, movementRig, braceletRig, lineupRig]) r.rotation.order = 'ZYX' 

  const particles = createParticles()
  scene.add(particles)

  /* ---- load -------------------------------------------------------- */
  const loader = new GLTFLoader()
  const loaded = { a: 0, b: 0 }
  const report = () => onProgress?.(clamp01((loaded.a + loaded.b) / 2))

  const load = (url, key) =>
    new Promise((res, rej) =>
      loader.load(
        url,
        (g) => {
          loaded[key] = 1
          report()
          res(g)
        },
        (e) => {
          if (e.total) {
            loaded[key] = e.loaded / e.total
            report()
          }
        },
        rej
      )
    )

  const [watchGltf, movementGltf] = await Promise.all([
    load('./model/luxury-watch.glb', 'a'),
    load('./model/watch.glb', 'b'),
  ])

  /* ---- watch ------------------------------------------------------- */
  const watch = watchGltf.scene
  const metalMeshes = []
  const dialMeshes = []
  const _size = new THREE.Vector3()

  watch.traverse((o) => {
    if (!o.isMesh) return
    o.frustumCulled = false

    // Strip the donor model's engraved brand text. The site is branded
    // LX 60P; leaving someone else's logo on the dial is not an option.
    if (/^Text/i.test(o.name)) {
      o.visible = false
      return
    }

    const src = o.material
    const mat = src?.name || ''

    o.geometry.computeBoundingBox()
    o.geometry.boundingBox.getSize(_size)
    const span = Math.max(_size.x, _size.y, _size.z)

    // Case, bracelet and dial share materials in this export, so material
    // name alone cannot separate them. Size does: anything spanning more
    // than a few model units is structure, everything smaller is dial
    // furniture sitting inside the case.
    const isStructure = span > 5

    // A large flat disc among the structure meshes is the caseback. Left as
    // polished steel it renders as a featureless white mirror the moment the
    // watch turns past three-quarters — the one angle that kills the whole
    // section. Smoked sapphire reads correctly instead.
    const dims = [_size.x, _size.y, _size.z].sort((a, b) => b - a)
    const isCaseback = isStructure && dims[0] > 8 && dims[1] > 8 && dims[2] < 4 && /DarkPins/i.test(mat)

    // The source is doubleSided throughout and its winding is not
    // consistent — culling backfaces here turns the polished bracelet inside
    // out and it renders as a black silhouette.
    const m = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide })
    m.name = mat

    if (/Glass/i.test(mat)) {
      m.color.set(0xffffff)
      m.metalness = 0
      m.roughness = 0.02
      m.transmission = 0.97
      m.thickness = 0.08
      m.ior = 1.52
      m.transparent = true
      m.envMapIntensity = 1.5
    } else if (isCaseback) {
      m.color.set(0x131318)
      m.metalness = 0.85
      m.roughness = 0.1
      m.envMapIntensity = 1.1
      dialMeshes.push(o)
    } else if (isStructure || /MetalGrey/i.test(mat)) {
      // Case, bezel, lugs, crown, pushers, bracelet, hands.
      m.color.set(0xdadade)
      m.metalness = 1
      m.roughness = /DarkPins/i.test(mat) ? 0.3 : 0.14
      m.envMapIntensity = 1.3
      o.userData.metal = true
      metalMeshes.push(o)
    } else if (/Image|Image2|Green/i.test(mat)) {
      // Dial plate and subdials — keep the baked guilloché as a value map
      // but drive it dark so it reads as a black sunburst dial.
      m.map = src?.map || null
      if (m.map) m.map.colorSpace = THREE.SRGBColorSpace
      m.color.set(0x4a4a52)
      m.metalness = 0.55
      m.roughness = 0.4
      m.envMapIntensity = 0.9
      dialMeshes.push(o)
    } else if (/Black/i.test(mat)) {
      m.color.set(0x08080a)
      m.metalness = 0.4
      m.roughness = 0.3
      m.envMapIntensity = 1.0
      dialMeshes.push(o)
    } else {
      m.color.set(0xb9b9c0)
      m.metalness = 0.9
      m.roughness = 0.25
      m.envMapIntensity = 1.1
      o.userData.metal = true
      metalMeshes.push(o)
    }

    o.material = m
  })

  normalise(watch, 1)
  const watchBase = new THREE.Group()
  watchBase.add(watch)
  watchRig.add(watchBase)

  // Where the dial actually sits inside the bracelet loop. The bounding box
  // centre is somewhere in the middle of the strap, so any close-up framed on
  // it points the camera at empty air.
  const watchHome = watch.position.clone()
  const caseCentre = new THREE.Vector3()
  if (dialMeshes.length) {
    // Box3.expandByObject reads each mesh's matrixWorld and does NOT refresh
    // its ancestors, so without this the box comes back in the model's
    // pre-normalise scale — five times too big, and the offset throws the
    // watch clean out of frame.
    scene.updateMatrixWorld(true)
    const box = new THREE.Box3()
    for (const o of dialMeshes) box.expandByObject(o)
    box.getCenter(caseCentre)
    watchBase.worldToLocal(caseCentre)
  }

  /* ---- movement ---------------------------------------------------- */
  const movement = movementGltf.scene
  let tokens = {}
  try {
    const meta = await fetch('./model/parts.json').then((r) => r.json())
    tokens = meta.tokens || {}
  } catch {
    tokens = {}
  }

  const finishes = buildFinishTextures(renderer)

  const MOVEMENT_MATS = {
    nickel: { color: 0xc9c9ce, metalness: 1, roughness: 0.22 },
    brass: { color: 0xc8a45c, metalness: 1, roughness: 0.26 },
    steel: { color: 0xd7d7dc, metalness: 1, roughness: 0.14 },
    blued: { color: 0x2a3f78, metalness: 1, roughness: 0.12 },
    ruby: { color: 0x9b2237, metalness: 0.1, roughness: 0.08 },
  }

  const movementParts = []

  movement.traverse((o) => {
    if (!o.isMesh) return
    o.frustumCulled = false
    // The viewer resolves a part's layer from the LEADING token of its mesh
    // name, never the full string — duplicate suffixes and glTF name
    // mangling both survive that.
    const token = (o.name || '').trim().split(/[\s_.]/)[0]
    const info = tokens[token] || {}
    const spec = MOVEMENT_MATS[info.material] || MOVEMENT_MATS.nickel
    const fin = finishes[info.finish]
    o.material = new THREE.MeshPhysicalMaterial({
      ...spec,
      envMapIntensity: 1.35,
      // The graining IS the roughness variation on a real movement, and the
      // same grooves catch light as relief — one map, both jobs.
      roughnessMap: fin || null,
      bumpMap: fin || null,
      bumpScale: fin ? 0.0016 : 0,
    })
    movementParts.push({ mesh: o, layer: info.layer ?? 0, home: null })
  })

  normalise(movement, 1)
  const movementBase = new THREE.Group()
  movementBase.add(movement)
  // The calibre is modelled with its stacking axis on Y (see parts.json),
  // i.e. lying flat. Stand it up so the plate faces the camera; every pose
  // key for this subject is then a tilt away from front-on.
  movementBase.rotation.x = -Math.PI / 2
  movementRig.add(movementBase)

  // Cache each part's rest position so the explode can be a pure offset.
  movement.updateWorldMatrix(true, true)
  for (const p of movementParts) p.home = p.mesh.position.clone()

  // Assign an explode slot per part. The ETA layer numbers already encode
  // assembly order, but for the six labelled columns the reference uses,
  // bucket them into six groups spread across the width.
  // Spreading on the raw layer number clumps the stack: the ETA has eleven
  // parts on layer +1 and one on layer −2.6, so a linear map piles most of
  // the movement into two overlapping columns and pushes the centre of mass
  // off-frame. Rank the distinct layers instead and hand each an evenly
  // spaced column, which is also what makes the six captions line up.
  const distinct = [...new Set(movementParts.map((p) => p.layer))].sort((a, b) => a - b)
  const nCol = EXPLODE_LABELS.length
  const _s = new THREE.Vector3()
  let wSum = 0
  let wSlot = 0
  for (const p of movementParts) {
    const rank = distinct.indexOf(p.layer) / Math.max(1, distinct.length - 1)
    p.column = Math.min(nCol - 1, Math.round(rank * (nCol - 1)))
    // Sit on the caption's column, with a hair of scatter so parts sharing a
    // layer do not z-fight into a single silhouette.
    p.slot = p.column / (nCol - 1) + (rank - p.column / (nCol - 1)) * 0.35

    p.mesh.geometry.computeBoundingBox()
    p.mesh.geometry.boundingBox.getSize(_s)
    p.weight = Math.max(_s.x, _s.y, _s.z)
    wSum += p.weight
    wSlot += p.weight * p.slot
  }
  // Centre the exploded row on where the mass actually is. The main plate is
  // far larger than anything else in this calibre, so centring on the numeric
  // middle of the slots parks the composition well left of frame.
  const slotBias = wSum > 0 ? wSlot / wSum : 0.5

  /* ---- bracelet ---------------------------------------------------- */
  const OUTER = 13
  // Brushed outer links against mirror-polished inner links — the contrast
  // between the two finishes is what a steel bracelet actually looks like.
  const linkMatOuter = new THREE.MeshPhysicalMaterial({
    color: 0xc9c9ce,
    metalness: 1,
    roughness: 0.3,
    envMapIntensity: 1.25,
    side: THREE.DoubleSide,
  })
  const linkMatInner = new THREE.MeshPhysicalMaterial({
    color: 0xe6e6ea,
    metalness: 1,
    roughness: 0.045,
    envMapIntensity: 1.5,
    side: THREE.DoubleSide,
  })
  // Outer links are H-shaped: a narrow waist with a wider block at each end
  // that the inner link tucks between. Building it from three curved shells
  // keeps the rolling highlight and gets the silhouette right.
  const gWaist = linkGeometry(0.115, 0.58, 0.068, 1.5)
  const gCapT = linkGeometry(0.19, 0.17, 0.07, 1.15)
  const gCapB = gCapT.clone()
  gCapT.translate(0, 0.205, 0)
  gCapB.translate(0, -0.205, 0)
  const gOuter = mergeGeometries([gWaist, gCapT, gCapB], false)
  const gInner = linkGeometry(0.115, 0.24, 0.072, 1.7)
  const links = []
  for (let i = 0; i < OUTER; i++) {
    const a = new THREE.Mesh(gOuter, linkMatOuter)
    const b = new THREE.Mesh(gInner, linkMatInner)
    a.userData.i = i * 2
    b.userData.i = i * 2 + 1
    links.push(a, b)
    braceletRig.add(a, b)
  }
  for (const l of links) l.frustumCulled = false

  /* ---- outro line-up ------------------------------------------------ */
  const lineup = COLOURWAYS.map((c, i) => {
    const clone = watchBase.clone(true)
    clone.traverse((o) => {
      if (!o.isMesh) return
      o.material = o.material.clone()
      // Only the structure takes the finish. Tinting by material name would
      // catch the dial too, and a gold watch with a gold dial reads as a toy.
      if (o.userData.metal) {
        o.material.color.setHex(c.colour)
        o.material.roughness = c.rough
      }
    })
    clone.position.x = (i - (COLOURWAYS.length - 1) / 2) * 0.62
    lineupRig.add(clone)
    return clone
  })

  /* ---- resolved key timeline --------------------------------------- */
  let tracks = {}
  let subjectCuts = []

  function resolveTimeline(ranges) {
    const filled = {}
    let subject = 'watch'
    tracks = {}
    for (const k of KEYS) {
      if (k.subject) subject = k.subject
      const [id, p] = k.at
      const r = ranges[id]
      if (!r) continue
      const out = { scroll: r.top + r.height * p }
      for (const c of CHANNELS) {
        if (k[c] !== undefined) filled[c] = k[c]
        out[c] = filled[c] ?? 0
      }
      ;(tracks[subject] ||= []).push(out)
    }
    for (const t of Object.values(tracks)) t.sort((a, b) => a.scroll - b.scroll)

    subjectCuts = SUBJECTS.map(([id, p, name]) => ({
      scroll: ranges[id] ? ranges[id].top + ranges[id].height * p : 0,
      name,
    })).sort((a, b) => a.scroll - b.scroll)
  }

  function subjectAt(scroll) {
    let name = subjectCuts[0]?.name || 'watch'
    for (const c of subjectCuts) {
      if (scroll >= c.scroll) name = c.name
      else break
    }
    return name
  }

  function poseAt(scroll) {
    const subject = subjectAt(scroll)
    const track = tracks[subject]
    if (!track || !track.length) return { subject, rx: 0, ry: 0, rz: 0, x: 0, y: 0, z: 0, s: 1, explode: 0 }
    if (scroll <= track[0].scroll) return { ...track[0], subject }
    const last = track[track.length - 1]
    if (scroll >= last.scroll) return { ...last, subject }
    let i = 1
    while (i < track.length && track[i].scroll < scroll) i++
    const a = track[i - 1]
    const b = track[i]
    const t = smoothstep(clamp01((scroll - a.scroll) / Math.max(1, b.scroll - a.scroll)))
    const out = { subject }
    for (const c of CHANNELS) out[c] = a[c] + (b[c] - a[c]) * t
    return out
  }

  /* ---- runtime state ------------------------------------------------ */
  const state = {
    darkness: 0, // 0 light env, 1 dark env
    particleOpacity: 0,
    particleSpread: 1,
    colour: 0,
    pointer: new THREE.Vector2(),
    pointerTarget: new THREE.Vector2(),
  }

  let W = 1
  let H = 1
  let dpr = 1

  function resize() {
    W = window.innerWidth
    H = window.innerHeight
    dpr = Math.min(window.devicePixelRatio || 1, 1.75)
    renderer.setPixelRatio(dpr)
    renderer.setSize(W, H, false)
    camera.aspect = W / H
    // Keep the composition framed on height, so the watch holds its size
    // relative to the type as the window widens.
    camera.fov = 30 * Math.max(1, 1 + (0.82 - Math.min(1, W / H) * 0.55) * 0)
    camera.updateProjectionMatrix()
    particles.material.uniforms.uPixelRatio.value = dpr
  }

  /** Screen-space X offset in world units at the subject plane. */
  function worldPerScreen() {
    const dist = camera.position.z
    const hh = Math.tan((camera.fov * DEG) / 2) * dist
    return { h: hh * 2, w: hh * 2 * camera.aspect }
  }

  function applyColourway(index) {
    const c = COLOURWAYS[index]
    if (!c) return
    for (const o of metalMeshes) {
      o.material.color.setHex(c.colour)
      o.material.roughness = c.rough
    }
  }

  /**
   * Render a still of the watch into a 2D canvas — used for the editorial
   * cards in the editions and breakdown sections.
   *
   * Faking these with CSS gradients was the alternative; rendering them from
   * the same model and the same lighting means the card and the live stage
   * can never drift apart, and it costs one frame at load.
   */
  function productShot(w, h, opts = {}) {
    const rt = new THREE.WebGLRenderTarget(w, h, {
      colorSpace: THREE.SRGBColorSpace,
      samples: 4,
    })

    const saved = {
      bg: scene.background,
      pos: watchRig.position.clone(),
      rot: watchRig.rotation.clone(),
      scl: watchRig.scale.clone(),
      wp: watch.position.clone(),
      vis: [watchRig.visible, movementRig.visible, braceletRig.visible, lineupRig.visible, particles.visible],
      aspect: camera.aspect,
      exposure: renderer.toneMappingExposure,
      envI: metalMeshes.map((o) => o.material.envMapIntensity),
    }

    scene.background = new THREE.Color(opts.bg ?? 0x141416)
    watchRig.visible = true
    movementRig.visible = braceletRig.visible = lineupRig.visible = particles.visible = false
    watch.position.copy(watchHome).addScaledVector(caseCentre, -(opts.focus ?? 1))
    watchRig.position.set(opts.x ?? 0, opts.y ?? 0, 0)
    watchRig.rotation.set(opts.rx ?? -0.18, opts.ry ?? -0.5, opts.rz ?? 0)
    watchRig.scale.setScalar(opts.s ?? 2.2)
    renderer.toneMappingExposure = opts.exposure ?? 0.82
    for (const o of metalMeshes) o.material.envMapIntensity = 0.85

    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setRenderTarget(rt)
    renderer.render(scene, camera)

    const buf = new Uint8Array(w * h * 4)
    renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf)
    renderer.setRenderTarget(null)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    const img = ctx.createImageData(w, h)
    // WebGL reads bottom-up; the 2D canvas is top-down.
    for (let y = 0; y < h; y++) {
      const src = (h - 1 - y) * w * 4
      img.data.set(buf.subarray(src, src + w * 4), y * w * 4)
    }
    ctx.putImageData(img, 0, 0)

    scene.background = saved.bg
    watchRig.position.copy(saved.pos)
    watchRig.rotation.copy(saved.rot)
    watchRig.scale.copy(saved.scl)
    watch.position.copy(saved.wp)
    ;[watchRig.visible, movementRig.visible, braceletRig.visible, lineupRig.visible, particles.visible] = saved.vis
    camera.aspect = saved.aspect
    camera.updateProjectionMatrix()
    renderer.toneMappingExposure = saved.exposure
    metalMeshes.forEach((o, i) => (o.material.envMapIntensity = saved.envI[i]))
    rt.dispose()

    return canvas
  }

  function setDarkness(v) {
    if (Math.abs(v - state.darkness) < 0.002) return
    state.darkness = v

    // Swapping to a genuinely dark environment is the obvious move and it is
    // wrong: a mirror-finish metal lit only by a black room renders black, so
    // the calibre disappears exactly where the story wants it centre stage.
    // Keep the studio lighting and take the *page* dark instead — pull the
    // watch's environment response down so it reads gunmetal, and leave the
    // movement fully lit.
    renderer.toneMappingExposure = 1.0 - v * 0.26
    for (const o of metalMeshes) o.material.envMapIntensity = 1.3 - v * 0.72
    for (const o of dialMeshes) o.material.envMapIntensity = 1.0 - v * 0.5
    key.intensity = v * 1.1
    rim.intensity = v * 0.5
  }

  /* ---- per-frame ---------------------------------------------------- */
  const tmp = new THREE.Vector3()

  function update(scroll, time) {
    const pose = poseAt(scroll)
    if (!pose) return

    const world = worldPerScreen()

    watchRig.visible = pose.subject === 'watch'
    movementRig.visible = pose.subject === 'movement'
    braceletRig.visible = pose.subject === 'bracelet'
    lineupRig.visible = pose.subject === 'lineup'

    // Mouse parallax — small, and only enough to make the object feel held
    // rather than pinned.
    state.pointer.lerp(state.pointerTarget, 0.06)

    // Slide the model so either its bounding box (focus 0) or the dial
    // (focus 1) sits on the rig origin.
    watch.position.copy(watchHome).addScaledVector(caseCentre, -(pose.focus || 0))

    const rigs = [watchRig, movementRig, braceletRig, lineupRig]
    for (const rig of rigs) {
      if (!rig.visible) continue
      rig.position.set(pose.x * world.w, pose.y * world.h, pose.z)
      rig.rotation.set(
        pose.rx + state.pointer.y * 0.06,
        pose.ry + state.pointer.x * 0.09,
        pose.rz
      )
      rig.scale.setScalar(pose.s)
    }

    if (movementRig.visible) {
      const e = pose.explode
      for (const p of movementParts) {
        p.mesh.position.copy(p.home)
        // Spread along the rig's X, which stays camera-right through the
        // whole section, and collapse the assembled stacking offset as the
        // parts separate so the exploded state lands as a flat elevation
        // rather than a receding queue.
        p.mesh.position.x += (p.slot - slotBias) * 3.7 * e
        p.mesh.position.y *= Math.max(0, 1 - e * 0.75)
        p.mesh.position.z += Math.sin(p.slot * 31.7) * 0.01 * e
      }
    }

    if (braceletRig.visible) {
      const e = pose.explode
      const n = links.length
      for (const l of links) {
        const i = l.userData.i
        const centred = i - (n - 1) / 2
        const pitch = 0.152 + e * 0.32
        l.position.set(centred * pitch, 0, 0)
        // A few degrees of alternating yaw. Dead-flat links all mirror the
        // same patch of the studio and read as one grey stripe; angling them
        // lets the strip lights rake across alternate faces.
        l.rotation.set(0, (i % 2 ? 1 : -1) * 0.13 - centred * 0.012, 0)
        l.scale.setScalar(1 + e * 0.1)
      }
    }

    // Particles ride with the movement so the strands stay wrapped around it.
    particles.visible = state.particleOpacity > 0.002
    particles.material.uniforms.uTime.value = time
    particles.material.uniforms.uOpacity.value = state.particleOpacity
    particles.material.uniforms.uSpread.value = state.particleSpread
    particles.rotation.y = -scroll * 0.00012
    particles.rotation.z = Math.sin(scroll * 0.00006) * 0.16
  }

  function render() {
    renderer.render(scene, camera)
  }

  /* Project a movement part column to screen space, for the DOM leader
     lines in the disassembly section. */
  function columnScreenX(column) {
    const found = movementParts.filter((p) => p.column === column)
    if (!found.length) return null
    tmp.set(0, 0, 0)
    for (const p of found) tmp.add(p.mesh.getWorldPosition(new THREE.Vector3()))
    tmp.divideScalar(found.length)
    tmp.project(camera)
    return (tmp.x * 0.5 + 0.5) * W
  }

  resize()
  applyColourway(0)

  return {
    renderer,
    scene,
    camera,
    stage,
    watch: watchBase,
    movementParts,
    links,
    particles,
    state,
    resize,
    resolveTimeline,
    poseAt,
    update,
    render,
    setDarkness,
    applyColourway,
    productShot,
    columnScreenX,
    worldPerScreen,
  }
}
