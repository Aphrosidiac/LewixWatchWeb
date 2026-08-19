import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { buildFinishTextures } from './finishes.js'

// parts.json gives each ETA part number its place in the assembly order —
// negative on the dial side, 0 at the main plate, positive up through the
// bridges to the balance. Explode is just that number scaled along the
// movement's axis, which the build puts on world +Y.
const EXPLODE_AXIS = new THREE.Vector3(0, 1, 0)
const EXPLODE_SPACING = 0.22
const EXPLODE_EASE = 0.075

// Opening the assembly makes it roughly twice as tall as it is wide, so the
// camera has to pull back or the ends fall out of frame. This is applied as a
// per-frame multiplier on the *current* eye-to-target distance rather than by
// snapping to a computed one, so it rides on top of whatever zoom the user has
// dialled in instead of fighting it.
const EXPLODE_DOLLY = 0.62

const canvas = document.getElementById('stage')
const loaderEl = document.getElementById('loader')
const loaderFill = document.getElementById('loaderFill')
const loaderPct = document.getElementById('loaderPct')
const readout = document.getElementById('readout')
const explodeBtn = document.getElementById('explodeBtn')
const explodeRange = document.getElementById('explodeRange')
const spinBtn = document.getElementById('spinBtn')
const resetBtn = document.getElementById('resetBtn')
const finishBtn = document.getElementById('finishBtn')
const finishLabel = document.getElementById('finishLabel')

// ------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
})
// Capped at 1.5 rather than 2. The AO pass and its denoise run per pixel, so on
// a retina display a ratio of 2 means 4.4M pixels of screen-space work every
// frame — the single biggest cost in the frame. 1.5 is visually near-identical
// on this content and cuts that by ~44%.
const PIXEL_RATIO_CAP = 1.5
renderer.setPixelRatio(Math.min(window.devicePixelRatio, PIXEL_RATIO_CAP))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
// Every part is metallic, so the environment supplies nearly all the visible
// colour. At full strength a studio env blows the whole movement out to a flat
// white; pulling exposure and env intensity down is what lets nickel, brass
// and blued steel read as different materials.
renderer.toneMappingExposure = 0.82

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0b0c0e)

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.05, 100)
const HOME_CAM = new THREE.Vector3(2.6, 1.7, 3.1)
camera.position.copy(HOME_CAM)

// Procedural studio environment — metals need reflections far more than they
// need textures, and this avoids shipping an HDRI.
const pmrem = new THREE.PMREMGenerator(renderer)
pmrem.compileEquirectangularShader()
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
scene.environmentIntensity = 0.7

// Directional lights do the shaping the environment can't: a hard key to pick
// out bevels and gear teeth, and a cool rim to separate parts from the
// background once they drift apart in the exploded view.
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
// The shadow map is a full re-render of all 264k triangles. The light is fixed
// and the geometry only moves while the explode is animating, so re-rendering
// it every frame is wasted work during ordinary orbiting — the camera moving
// does not change a single shadow. Driven manually from the loop instead.
renderer.shadowMap.autoUpdate = false
renderer.shadowMap.needsUpdate = true

const key = new THREE.DirectionalLight(0xffffff, 1.5)
key.position.set(4, 6, 4)
key.castShadow = true
key.shadow.mapSize.set(2048, 2048)
// Watch parts are thin flat discs stacked millimetres apart, which is the worst
// case for shadow acne. normalBias offsets along the surface normal and handles
// it far better than a constant depth bias, which would need to be so large it
// detached the shadows from their casters.
key.shadow.bias = -0.0004
key.shadow.normalBias = 0.012
scene.add(key)

const rim = new THREE.DirectionalLight(0xc9d4ff, 0.9)
rim.position.set(-5, 2, -4)
scene.add(rim)

const fill = new THREE.DirectionalLight(0xffe9c4, 0.35)
fill.position.set(0, -4, 2)
scene.add(fill)

// -------------------------------------------------------------- compositing
// Ground-truth ambient occlusion is what separates this from a flat CAD
// viewport: it darkens the contact between stacked bridges, the recesses the
// wheels sit in, and the gaps between gear teeth. Without it every part reads
// as floating regardless of how good the materials are.
const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))

const gtao = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight)
gtao.output = GTAOPass.OUTPUT.Default
composer.addPass(gtao)

// The composer writes to a render target, so tone mapping and the sRGB
// conversion have to be applied explicitly at the end of the chain — the
// renderer's own settings are bypassed.
composer.addPass(new OutputPass())

// radius is in world units, and the whole movement is ~2 units across, so this
// is roughly a 1mm occlusion radius — tuned to crevices between parts rather
// than to the silhouette of the assembly.
// 8 samples rather than 16. This content is dense small-scale detail where the
// denoise pass hides the extra noise anyway, so the second 8 samples cost real
// frame time and buy almost nothing visible.
gtao.updateGtaoMaterial({
  radius: 0.055,
  distanceExponent: 1.0,
  thickness: 0.35,
  scale: 1.1,
  samples: 8,
  distanceFallOff: 1.0,
  screenSpaceRadius: false,
})
gtao.updatePdMaterial({
  lumaPhi: 10,
  depthPhi: 2,
  normalPhi: 3,
  radius: 4,
  radiusExponent: 1,
  rings: 2,
  samples: 8,
})

// ------------------------------------------------------------------ controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.dampingFactor = 0.06
controls.rotateSpeed = 0.75
controls.minDistance = 1.2
controls.maxDistance = 14
controls.autoRotate = true
controls.autoRotateSpeed = 0.9
controls.target.set(0, 0, 0)

// --------------------------------------------------------------------- state
const parts = []
let explodeTarget = 0
let explodeCurrent = 0
let layerMid = 0
let layerSpan = 0

// -------------------------------------------------------------------- loading
const manager = new THREE.LoadingManager()
manager.onProgress = (_url, loaded, total) => {
  const pct = total ? Math.round((loaded / total) * 100) : 0
  loaderFill.style.width = `${pct}%`
  loaderPct.textContent = `${pct}%`
}
manager.onLoad = () => {
  loaderFill.style.width = '100%'
  loaderPct.textContent = '100%'
  setTimeout(() => loaderEl.classList.add('is-done'), 220)
}

/**
 * Leading token of a part name: "105M Barrel bridge" -> "105M".
 *
 * Only the token is used to look up the assembly layer, never the full name,
 * so neither the duplicate suffixes on repeated hardware ("5105 Screw for
 * barrel bridge 2") nor any whitespace mangling in the glTF round-trip can
 * break the mapping.
 */
function tokenOf(name) {
  const n = (name || '').trim()
  if (/^incabloc/i.test(n)) return 'Incabloc'
  return n.split(/[\s_]+/)[0]
}

// ------------------------------------------------------------------ finishes
const finishTextures = buildFinishTextures(renderer)

// Base metal per material class. `roughness` here is the *ceiling*: three
// multiplies it by the roughnessMap, so the graining modulates downward from
// this value rather than around it.
const METALS = {
  nickel: { color: 0xc2c7cc, metalness: 1.0, roughness: 0.52 },
  brass: { color: 0xcaa964, metalness: 1.0, roughness: 0.46 },
  pale: { color: 0xdcdee3, metalness: 1.0, roughness: 0.36 },
  steel: { color: 0xaab0b8, metalness: 1.0, roughness: 0.44 },
  screw: { color: 0x9aa2ad, metalness: 1.0, roughness: 0.26 },
  ruby: { color: 0x7a1f4d, metalness: 0.0, roughness: 0.12 },
}

const BUMP_SCALE = {
  perlage: 0.0016,
  cotes: 0.0012,
  radial: 0.0011,
  brush: 0.0008,
  polish: 0.0004,
  none: 0,
}

// One material per (metal, finish) pair, shared across every part that uses it.
const finishedCache = new Map()

function finishedMaterial(materialKey = 'steel', finishKey = 'brush') {
  const cacheKey = `${materialKey}|${finishKey}`
  if (finishedCache.has(cacheKey)) return finishedCache.get(cacheKey)

  const base = METALS[materialKey] ?? METALS.steel
  const tex = finishTextures[finishKey]

  const mat = new THREE.MeshStandardMaterial({
    color: base.color,
    metalness: base.metalness,
    roughness: base.roughness,
    roughnessMap: tex ?? null,
    bumpMap: tex ?? null,
    bumpScale: BUMP_SCALE[finishKey] ?? 0,
  })

  finishedCache.set(cacheKey, mat)
  return mat
}

const gltfLoader = new GLTFLoader(manager)

Promise.all([
  fetch('model/parts.json').then((r) => {
    if (!r.ok) throw new Error(`parts.json ${r.status}`)
    return r.json()
  }),
  new Promise((resolve, reject) =>
    gltfLoader.load('model/watch.glb', resolve, undefined, reject)
  ),
])
  .then(([meta, gltf]) => {
    const root = gltf.scene
    scene.add(root)

    const tokens = meta.tokens || {}
    const unmapped = new Set()

    root.traverse((node) => {
      if (!node.isMesh) return
      node.frustumCulled = false
      node.castShadow = true
      node.receiveShadow = true

      const tok = tokenOf(node.name)
      const entry = tokens[tok]
      if (!entry) unmapped.add(`${node.name} (token ${tok})`)

      parts.push({
        mesh: node,
        layer: entry ? Number(entry.layer) : 0,
        label: node.name,
        home: node.position.clone(),
        finished: finishedMaterial(entry?.material, entry?.finish),
      })
    })

    if (!parts.length) {
      console.error('[viewer] GLB contained no meshes')
      loaderPct.textContent = 'model contained no meshes'
      return
    }
    if (unmapped.size) {
      console.warn(`[viewer] ${unmapped.size} unmapped part(s):`, [...unmapped])
    }

    // Spread outward from the middle of the stack so the assembly stays
    // centred instead of drifting off-frame as it opens.
    const [lo, hi] = meta.layerRange ?? [0, 0]
    layerMid = (lo + hi) / 2
    layerSpan = hi - lo

    const metaSub = document.getElementById('metaSub')
    if (metaSub) {
      metaSub.textContent = `Manual-winding movement · ${parts.length} components`
    }

    frameAssembly(root)

    // The GLB ships flat PBR factors with no maps; the finished materials are
    // built here in the viewer. Nothing swaps them in until setFinish runs, so
    // this call is what actually puts the surface finishes on screen.
    setFinish(true)

    // First shadow render, now that there is geometry to cast one.
    renderer.shadowMap.needsUpdate = true

    console.log(`[viewer] ${parts.length} parts loaded, layers ${lo} to ${hi}`)

    // Debug handle — handy for poking at materials and camera from the console.
    window.viewer = {
      parts, scene, camera, controls, finishTextures,
      setExplode, setFinish, renderer, composer, gtao, key,
    }
  })
  .catch((err) => {
    console.error('[viewer] failed to load model', err)
    loaderPct.textContent = 'model failed to load'
  })

const modelSize = new THREE.Vector3(2, 2, 2)

/** Fit the camera to whatever scale the model actually came in at. */
function frameAssembly(root) {
  const box = new THREE.Box3().setFromObject(root)
  const centre = box.getCenter(new THREE.Vector3())
  box.getSize(modelSize)

  root.position.sub(centre)
  for (const p of parts) p.home.copy(p.mesh.position)

  const dist = fitDistance()

  HOME_CAM.copy(new THREE.Vector3(0.62, 0.4, 0.75).normalize().multiplyScalar(dist))
  camera.position.copy(HOME_CAM)
  controls.minDistance = Math.max(modelSize.x, modelSize.z) * 0.3
  controls.maxDistance = dist * 6
  controls.update()

  fitShadowCamera()
}

/**
 * Size the shadow frustum to the *exploded* extent, not the closed one.
 *
 * Opening the assembly spreads it far along Y; a frustum fitted to the closed
 * model would clip those shadows away exactly when the view needs them most.
 */
function fitShadowCamera() {
  const spread = (layerSpan / 2) * EXPLODE_SPACING
  const radius = Math.max(modelSize.x, modelSize.z) / 2
  const extent = Math.max(radius, spread + modelSize.y) * 1.3

  const cam = key.shadow.camera
  cam.left = -extent
  cam.right = extent
  cam.top = extent
  cam.bottom = -extent
  cam.near = 0.1
  cam.far = extent * 8
  cam.updateProjectionMatrix()
}

/**
 * Distance at which the assembly fits the frame.
 *
 * Fitting the bounding *sphere* is far too conservative here: the winding stem
 * projects well past the disc, inflating the sphere to roughly 1.5x the radius
 * of the part anyone is actually looking at, which leaves the movement small
 * and marooned in the middle of the canvas. Fitting the box is tighter.
 *
 * camera.fov is the vertical field of view, so the width constraint has to be
 * divided through by the aspect — otherwise the model overflows sideways on a
 * portrait viewport.
 */
function fitDistance() {
  const vFov = (camera.fov * Math.PI) / 180
  const halfHeight = modelSize.y / 2
  const halfWidth = Math.max(modelSize.x, modelSize.z) / 2

  const distH = halfHeight / Math.tan(vFov / 2)
  const distW = halfWidth / Math.tan(vFov / 2) / camera.aspect

  return Math.max(distH, distW) * 1.06
}

// -------------------------------------------------------------------- hover
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
let hoverLabel = ''

canvas.addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1
})
canvas.addEventListener('pointerleave', () => {
  pointer.set(999, 999)
})

function updateHover() {
  if (!parts.length || pointer.x > 1) {
    if (hoverLabel) {
      hoverLabel = ''
      readout.innerHTML = '<span>&nbsp;</span>'
    }
    return
  }
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObjects(parts.map((p) => p.mesh), false)
  const label = hits.length ? (hits[0].object.userData.part_label || hits[0].object.name) : ''
  if (label !== hoverLabel) {
    hoverLabel = label
    readout.innerHTML = label ? `<span>${label}</span>` : '<span>&nbsp;</span>'
  }
}

// ------------------------------------------------------------------- explode
function setExplode(value, { syncSlider = true, syncButton = true } = {}) {
  explodeTarget = Math.min(1, Math.max(0, value))
  if (syncSlider) explodeRange.value = String(Math.round(explodeTarget * 100))
  if (syncButton) explodeBtn.setAttribute('aria-pressed', explodeTarget > 0.5 ? 'true' : 'false')
}

explodeBtn.addEventListener('click', () => {
  setExplode(explodeTarget > 0.5 ? 0 : 1)
})

explodeRange.addEventListener('input', () => {
  setExplode(Number(explodeRange.value) / 100, { syncSlider: false })
})

spinBtn.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate
  spinBtn.setAttribute('aria-pressed', String(controls.autoRotate))
})

// ------------------------------------------------------------------- finish
// Two ways to read the same geometry. "Finished" is the PBR metals the build
// assigns per component — nickel bridges, brass wheels, ruby jewels. "Technical"
// swaps every part to one matte, near-white, non-metallic material, which is
// how a CAD package would present it: no reflections competing with the form,
// so bevels, gear teeth and the assembly order stay legible.
const technicalMaterial = new THREE.MeshStandardMaterial({
  color: 0xd5d8dd,
  metalness: 0.0,
  roughness: 0.68,
})

let finished = true

function setFinish(next) {
  finished = next
  for (const p of parts) {
    p.mesh.material = finished ? p.finished : technicalMaterial
  }
  finishBtn.setAttribute('aria-pressed', String(finished))
  finishLabel.textContent = finished ? 'Finished' : 'Technical'
}

finishBtn.addEventListener('click', () => setFinish(!finished))

resetBtn.addEventListener('click', () => {
  setExplode(0)
  camera.position.copy(HOME_CAM)
  controls.target.set(0, 0, 0)
  controls.update()
})

window.addEventListener('keydown', (e) => {
  if (e.key === 'e' || e.key === 'E') setExplode(explodeTarget > 0.5 ? 0 : 1)
  if (e.key === 'r' || e.key === 'R') resetBtn.click()
  if (e.key === 'm' || e.key === 'M') setFinish(!finished)
})

// --------------------------------------------------------------------- loop
const offset = new THREE.Vector3()
const eye = new THREE.Vector3()
let explodePrev = 0

function tick() {
  requestAnimationFrame(tick)

  explodeCurrent += (explodeTarget - explodeCurrent) * EXPLODE_EASE
  if (Math.abs(explodeTarget - explodeCurrent) < 1e-4) explodeCurrent = explodeTarget

  for (const p of parts) {
    offset.copy(EXPLODE_AXIS).multiplyScalar((p.layer - layerMid) * EXPLODE_SPACING * explodeCurrent)
    p.mesh.position.copy(p.home).add(offset)
  }

  // Dolly on the delta, so user zoom between frames is preserved.
  const delta = explodeCurrent - explodePrev
  if (Math.abs(delta) > 1e-6) {
    eye.subVectors(camera.position, controls.target).multiplyScalar(1 + delta * EXPLODE_DOLLY)
    camera.position.copy(controls.target).add(eye)
    // Geometry actually moved, so the shadow map is now stale.
    renderer.shadowMap.needsUpdate = true
  }
  explodePrev = explodeCurrent

  updateHover()
  controls.update()
  composer.render()
}
tick()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
  gtao.setSize(window.innerWidth, window.innerHeight)

  // Keep the home framing correct for the new aspect, so Reset still fits.
  HOME_CAM.normalize().multiplyScalar(fitDistance())
})
