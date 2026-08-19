import './style.css'
import Lenis from 'lenis'
import { createScene } from './scene.js'
import { buildDOM, measure } from './dom.js'
import { COLOURWAYS, EXPLODE_LABELS, EXPLODE_PARTS } from './content.js'

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t)
const lerp = (a, b, t) => a + (b - a) * t
const smooth = (t) => t * t * (3 - 2 * t)

/** Progress of `x` across [a,b], clamped and eased. */
const band = (x, a, b) => smooth(clamp01((x - a) / (b - a)))

function mixHex(a, b, t) {
  const ar = (a >> 16) & 255
  const ag = (a >> 8) & 255
  const ab = a & 255
  const br = (b >> 16) & 255
  const bg = (b >> 8) & 255
  const bb = b & 255
  return `rgb(${Math.round(lerp(ar, br, t))},${Math.round(lerp(ag, bg, t))},${Math.round(
    lerp(ab, bb, t)
  )})`
}

/* Background palette, keyed to the scroll story. Each entry is
   [sectionId, progress, baseColour, blobColour, blobAlpha]. */
const BG_KEYS = [
  ['hero', 0, 0xebebeb, 0x8f8f8f, 0.85],
  ['case', 1, 0xebebeb, 0x8f8f8f, 0.85],
  ['disassembly', 0.18, 0xbdbdbd, 0x6f6f6f, 0.5],
  ['disassembly', 0.42, 0x8f8f8f, 0x5a5a5a, 0.45],
  ['disassembly', 0.86, 0x585858, 0x2a2a2a, 0.4],
  ['heart', 0.05, 0x0a0a0a, 0x1c1c1c, 0.5],
  ['precise', 0.6, 0x0a0a0a, 0x202020, 0.5],
  ['precise', 0.95, 0xebebeb, 0x8f8f8f, 0.85],
  ['bracelet', 1, 0xebebeb, 0x8f8f8f, 0.85],
  ['editions', 1, 0xebebeb, 0x8f8f8f, 0.8],
  ['colour', 0.05, 0x6f6b74, 0x4a4750, 0.6],
  ['colour', 0.95, 0x6f6b74, 0x4a4750, 0.6],
  ['model', 0.08, 0xebebeb, 0x8f8f8f, 0.8],
  ['outro', 1, 0xebebeb, 0x8f8f8f, 0.85],
]

/* ------------------------------------------------------------------ */

const root = document.getElementById('root')
const canvas = document.getElementById('stage')
const loader = document.getElementById('loader')
const loaderArc = document.getElementById('loaderArc')

const bg = document.createElement('div')
bg.id = 'bg'
bg.style.cssText =
  'position:fixed;inset:0;z-index:0;pointer-events:none;background:#ebebeb'
const blob = document.createElement('div')
blob.style.cssText = 'position:absolute;inset:-30%;filter:blur(0px)'
bg.appendChild(blob)
document.body.insertBefore(bg, document.getElementById('app'))

let ranges = buildDOM(root)

/* ---- cached DOM ---------------------------------------------------- */
const $ = (s, c = document) => c.querySelector(s)
const $$ = (s, c = document) => [...c.querySelectorAll(s)]

const sec = (id) => document.getElementById('sec-' + id)

const els = {
  heroChars: $$('#sec-hero .st-char'),
  heroRing: $('#sec-hero .hero__ring'),
  heroMeta: $('#sec-hero .hero__meta'),
  heroModel: $('#sec-hero .hero__model'),
  heroArc: $('#sec-hero #heroArc'),
  bigStacks: $$('.bigtext__wrap'),
  marquee: $('.vmarquee__track'),
  vlabel: $('.vlabel'),
  pips: $('.pips'),
  leaders: $$('#sec-disassembly .leader'),
  pill: $('#sec-disassembly .explore-pill'),
  uilayer: $('#sec-disassembly .uilayer'),
  holdBadge: $('#holdBadge'),
  holdRing: $('#holdBadge .badge__ring circle'),
  partCard: $('#partCard'),
  partName: $('#partName'),
  partFn: $('#partFn'),
  partClose: $('#partClose'),
  reserve: $('.heart__reserve'),
  heartTitle: $('.heart__title'),
  editionCard: $('#editionCard'),
  colours: $$('#sec-colour .colour'),
  colourRing: $('#sec-colour .hero__ring'),
  specRows: $$('.spec-row'),
  modelNum: $('.model__num span'),
  modelWrap: $('.model__wrap'),
  specCard: $('.spec-card'),
  outroChars: $$('#sec-outro .st-char'),
  badges: $$('.badge'),
}

/* Section pin elements need explicit heights matched to their sections. */
function relayout() {
  ranges = measure()
  api?.resolveTimeline(ranges)
}

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */

let api = null
let lenis = null
let scrollY = 0
let started = false

function setLoader(p) {
  const dash = 2168
  loaderArc.style.strokeDashoffset = String(dash * (1 - clamp01(p)))
}

;(async () => {
  setLoader(0.04)
  api = await createScene(canvas, (p) => setLoader(0.05 + p * 0.9))
  setLoader(1)

  // Editorial stills, rendered from the same model and lighting as the stage.
  const shots = [
    [els.editionCard, 436, 680, { rx: -0.16, ry: -0.62, s: 2.35, y: -0.05, bg: 0x141416 }],
    [$('#specPhoto'), 588, 372, { rx: -0.5, ry: -0.75, s: 2.1, y: 0.02, bg: 0x17171a }],
  ]
  for (const [el, w, h, opts] of shots) {
    if (!el) continue
    const c = api.productShot(w, h, opts)
    c.style.cssText = 'width:100%;height:100%;display:block;object-fit:cover'
    el.appendChild(c)
  }

  relayout()
  window.addEventListener('resize', () => {
    api.resize()
    relayout()
  })

  window.addEventListener('pointermove', (e) => {
    api.state.pointerTarget.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      -((e.clientY / window.innerHeight) * 2 - 1)
    )
  })

  lenis = new Lenis({ duration: 4 })
  window.__lenis = lenis
  window.__scene = api
  // Handles for driving the page by hand. Necessary rather than convenient:
  // in an automated browser the tab is usually hidden, which throttles
  // requestAnimationFrame to about 1Hz and makes anything scroll-driven
  // impossible to observe from the outside.
  window.__tick = (y) => {
    // Optional scroll override: tick() reads the module's own `scrollY`,
    // which only the rAF loop refreshes, so driving the page by hand has to
    // set it explicitly or every DOM effect silently runs on a stale value.
    if (y != null) {
      scrollY = y
      window.scrollTo(0, y)
    }
    tick(performance.now() / 1000)
    api.render()
  }

  bindInteraction()

  // Prime one frame before revealing, so the first paint already has the
  // watch composed rather than flashing an empty stage.
  tick(0)
  api.render()

  await new Promise((r) => setTimeout(r, 260))
  loader.style.transition = 'opacity .7s ease'
  loader.style.opacity = '0'
  setTimeout(() => loader.remove(), 800)
  started = true

  requestAnimationFrame(raf)
})()

let last = 0
function raf(t) {
  const dt = Math.min(0.05, (t - last) / 1000 || 0.016)
  last = t
  lenis?.raf(t)
  scrollY = window.scrollY || document.documentElement.scrollTop
  tick(t / 1000, dt)
  api.render()
  requestAnimationFrame(raf)
}

/* ------------------------------------------------------------------ *
 * Per-frame DOM + scene drive
 * ------------------------------------------------------------------ */

/** Progress 0..1 through a section by id, from its top to its bottom. */
function prog(id) {
  const r = ranges[id]
  if (!r) return 0
  return clamp01((scrollY - r.top) / Math.max(1, r.height))
}

/** Progress through a section's *pinned travel* (top .. bottom - 1vh). */
function pin(id) {
  const r = ranges[id]
  if (!r) return 0
  const travel = Math.max(1, r.height - window.innerHeight)
  return clamp01((scrollY - r.top) / travel)
}

function abs(id, p) {
  const r = ranges[id]
  return r ? r.top + r.height * p : 0
}

function bgAt(scroll) {
  const keys = BG_KEYS.map((k) => ({ s: abs(k[0], k[1]), base: k[2], blob: k[3], a: k[4] }))
  keys.sort((a, b) => a.s - b.s)
  // Clamp by duplicating the end key rather than returning it raw — the
  // caller wants resolved css strings, and a raw key has none.
  const flat = (k) => ({
    css: mixHex(k.base, k.base, 0),
    blobCss: mixHex(k.blob, k.blob, 0),
    a: k.a,
    darkness: clamp01(1 - ((k.base >> 16) & 255) / 140),
  })
  if (scroll <= keys[0].s) return flat(keys[0])
  const lastK = keys[keys.length - 1]
  if (scroll >= lastK.s) return flat(lastK)
  let i = 1
  while (i < keys.length && keys[i].s < scroll) i++
  const a = keys[i - 1]
  const b = keys[i]
  const t = smooth(clamp01((scroll - a.s) / Math.max(1, b.s - a.s)))
  return {
    css: mixHex(a.base, b.base, t),
    blobCss: mixHex(a.blob, b.blob, t),
    a: lerp(a.a, b.a, t),
    dark: t < 0.5 ? a.base : b.base,
    darkness: clamp01(
      1 - (((a.base >> 16) & 255) * (1 - t) + ((b.base >> 16) & 255) * t) / 140
    ),
  }
}

function tick(time) {
  const vh = window.innerHeight
  const vw = window.innerWidth
  const mid = scrollY + vh / 2

  /* ---- background ------------------------------------------------- */
  const b = bgAt(scrollY)
  bg.style.background = b.css
  const bx = 70 + Math.sin(scrollY * 0.00022) * 12
  const by = 22 + Math.cos(scrollY * 0.00017) * 16
  // Two overlapping falloffs, not one: a tight core plus a very wide skirt.
  // A single radial reads as a vignette; the pair reads as a softbox
  // wrapping round behind the product, which is what the reference has.
  blob.style.background =
    `radial-gradient(38% 44% at ${bx}% ${by}%, ${b.blobCss} 0%, transparent 70%),` +
    `radial-gradient(78% 90% at ${bx + 8}% ${by - 6}%, ${b.blobCss} 0%, transparent 72%)`
  blob.style.opacity = String(b.a ?? 0.5)
  api.setDarkness(clamp01(b.darkness))
  document.body.classList.toggle('is-dark', b.darkness > 0.55)

  /* ---- hero -------------------------------------------------------- */
  {
    const p = prog('hero')
    const r = ranges.hero
    if (r) {
      els.heroChars.forEach((c, i) => {
        const d = i * 0.045
        const t = clamp01((p - d) * 2.4)
        c.style.transform = `translateY(${-p * 34}%)`
      })
      els.heroRing.style.opacity = String(1 - band(p, 0.2, 0.55))
      els.heroRing.style.transform = `translate(-50%,-50%) scale(${1 + p * 0.12})`
      const fade = 1 - band(p, 0.15, 0.5)
      els.heroMeta.style.opacity = String(fade)
      els.heroModel.style.opacity = String(fade)
      if (els.heroArc) els.heroArc.style.opacity = String(1 - band(p, 0.1, 0.4))
    }
  }

  /* ---- big text stacks: exactly one line inked at a time ----------- */
  // Thresholding on distance-to-centre lets two neighbouring lines qualify
  // at once, because the stack's line-height is smaller than a line box.
  // Picking the single nearest line is both simpler and what the reference
  // actually does.
  for (const wrap of els.bigStacks) {
    const lines = wrap.children
    let best = null
    let bestD = Infinity
    for (const line of lines) {
      const rect = line.getBoundingClientRect()
      const d = Math.abs(rect.top + rect.height / 2 - vh / 2)
      if (d < bestD) {
        bestD = d
        best = line
      }
    }
    for (const line of lines) line.classList.toggle('on', line === best && bestD < vh * 0.42)
  }

  /* ---- copy columns: activate in sequence --------------------------- */
  activateCopy('timeless', [0.42, 0.62])
  activateCopy('case', [0.14, 0.42])
  activateCopy('heart', [0.2, 0.45])
  activateCopy('precise', [0.34, 0.6])
  activateCopy('dial', [0.16, 0.42, 0.66])
  activateCopy('editions', [0.2, 0.55])

  /* ---- case & finishes marquee -------------------------------------- */
  {
    const p = prog('case')
    if (els.marquee) {
      const h = els.marquee.scrollHeight || 1
      els.marquee.style.transform = `translateX(-50%) translateY(${
        vh * 0.5 - p * (h * 0.5 + vh * 0.9)
      }px)`
      els.marquee.style.opacity = String(band(p, 0.02, 0.12) * (1 - band(p, 0.9, 1)))
    }
    if (els.vlabel) {
      els.vlabel.style.opacity = String(band(p, 0.22, 0.36) * (1 - band(p, 0.86, 0.98)))
      els.vlabel.style.color = `rgba(0,0,0,${lerp(1, 0.28, band(p, 0.55, 0.85))})`
    }
    if (els.pips) els.pips.style.opacity = String(band(p, 0.05, 0.15) * (1 - band(p, 0.9, 1)))
  }

  /* ---- disassembly labels ------------------------------------------- */
  {
    const p = prog('disassembly')
    const r = ranges.disassembly
    const show = band(p, 0.32, 0.44) * (1 - band(p, 0.7, 0.8))
    if (els.pill) els.pill.style.opacity = String(show)
    els.leaders.forEach((el, i) => {
      const x = api.columnScreenX(i)
      if (x == null) return
      el.style.opacity = String(show)
      el.style.left = x + 'px'
      const top = vh * 0.5 + vh * 0.02
      const stem = el.querySelector('.stem')
      stem.style.height = Math.max(0, vh * 0.965 - top - vh * 0.16) + 'px'
    })
    const badge = sec('disassembly').querySelector('.badge')
    if (badge) badge.style.opacity = String(band(p, 0.5, 0.62) * (1 - band(p, 0.78, 0.88)))
    // The horizon lives inside the sticky stage, so it has to be gone before
    // that stage unsticks — otherwise its gradient edge slides up the frame
    // as a hard band.
    const horizon = sec('disassembly').querySelector('.horizon')
    if (horizon) horizon.style.opacity = String(band(p, 0.1, 0.25) * (1 - band(p, 0.6, 0.75)))

    // The UI layer is fixed and full-viewport, so park it when the section is
    // nowhere near — otherwise it stays in the paint tree for the whole page.
    if (els.uilayer && r) {
      const near = scrollY > r.top - vh && scrollY < r.bottom + vh
      els.uilayer.style.visibility = near ? 'visible' : 'hidden'
    }
    driveInteraction(p)
  }

  /* ---- mechanical heart --------------------------------------------- */
  {
    const p = prog('heart')
    const pr = prog('precise')
    // Particles live across the heart section and thin out through
    // "highly precise", which is what carries the dark chapter together.
    const inHeart = band(prog('disassembly'), 0.82, 0.98)
    const out = 1 - band(pr, 0.55, 0.9)
    api.state.particleOpacity = clamp01(inHeart * out) * 0.95
    api.state.particleSpread = lerp(0.72, 1.25, clamp01(p * 0.7 + pr * 0.3))

    if (els.heartTitle) {
      els.heartTitle.style.opacity = String(band(p, 0.08, 0.22) * (1 - band(p, 0.72, 0.9)))
      els.heartTitle.style.transform = `translateY(${(0.5 - p) * 6}vh)`
    }
    if (els.reserve) {
      const mins = 42 + Math.floor(p * 6)
      els.reserve.textContent = mins + '’'
      els.reserve.style.opacity = String(band(p, 0.05, 0.2) * (1 - band(p, 0.75, 0.92)))
      els.reserve.style.transform = `translateY(${(0.5 - p) * 10}vh)`
    }
  }

  /* ---- single-part sections: fade heads in and out ------------------ */
  for (const id of ['contours', 'profile', 'bracelet']) {
    const s = sec(id)
    if (!s) continue
    const p = prog(id)
    const head = s.querySelector('.part__head')
    const tech = s.querySelector('.tech')
    const counter = s.querySelector('.counter')
    const v = band(p, 0.04, 0.2) * (1 - band(p, 0.72, 0.92))
    if (head) {
      head.style.opacity = String(v)
      head.style.transform = `translateX(-50%) translateY(${(0.4 - p) * 5}vh)`
    }
    if (tech) tech.style.opacity = String(band(p, 0.02, 0.16) * (1 - band(p, 0.8, 0.96)))
    if (counter) counter.style.opacity = String(v)
  }

  /* ---- refined dial hairlines --------------------------------------- */
  {
    const s = sec('dial')
    const p = prog('dial')
    const tech = s?.querySelector('.tech')
    if (tech) {
      tech.style.opacity = String(band(p, 0.05, 0.2) * (1 - band(p, 0.8, 0.95)))
      tech.style.transform = `translateY(${(0.5 - p) * 12}vh)`
    }
  }

  /* ---- editions photo card ------------------------------------------ */
  {
    const p = prog('editions')
    const r = ranges.editions
    if (els.editionCard && r) {
      // The card is positioned inside a plain (unpinned) section, so anchor
      // it to the current scroll to make it behave as if it were fixed, then
      // animate its offset on top of that.
      const x = lerp(vw * 0.99, vw * 0.02, smooth(p))
      const y = lerp(vh * 0.34, vh * 0.02, smooth(p))
      els.editionCard.style.left = x + 'px'
      els.editionCard.style.top = scrollY - r.top + y + 'px'
      els.editionCard.style.opacity = String(band(p, 0.06, 0.18) * (1 - band(p, 0.86, 1)))
    }
  }

  /* ---- colourways ---------------------------------------------------- */
  {
    const p = prog('colour')
    const n = COLOURWAYS.length
    const idx = Math.min(n - 1, Math.floor(p * n))
    if (idx !== api.state.colour) {
      api.state.colour = idx
      api.applyColourway(idx)
    }
    els.colours.forEach((el, i) => {
      const local = clamp01(p * n - i)
      const v = i === idx ? 1 : 0
      el.style.opacity = String(
        band(p * n - i, -0.02, 0.12) * (1 - band(p * n - i, 0.88, 1.02))
      )
      const ghost = el.querySelector('.colour__ghost')
      if (ghost) ghost.style.transform = `translate(-50%,-50%) translateY(${(0.5 - local) * 4}vh)`
    })
    if (els.colourRing) {
      els.colourRing.style.opacity = String(
        band(p, 0.02, 0.1) * (1 - band(p, 0.2, 0.3))
      )
    }
    const badge = sec('colour').querySelector('.badge')
    if (badge) badge.style.opacity = String(band(p, 0.05, 0.15))
  }

  /* ---- model breakdown ----------------------------------------------- */
  {
    const r = ranges.model
    if (r) {
      const heroP = clamp01((scrollY - r.top) / Math.max(1, window.innerHeight * 2))
      // "146GR" is uncovered by a mask that opens from the middle out —
      // mid-scroll the glyphs read as half-drawn shapes, which is the
      // signature of this section.
      if (els.modelNum) {
        const open = smooth(clamp01((heroP - 0.06) * 2.4))
        const half = 50 * open
        els.modelNum.parentElement.style.clipPath = `polygon(0 ${50 - half}%,100% ${
          50 - half
        }%,100% ${50 + half}%,0 ${50 + half}%)`
      }
      if (els.modelWrap) els.modelWrap.style.opacity = String(1 - band(heroP, 0.78, 1))
      if (els.specCard) els.specCard.style.opacity = String(band(heroP, 0.05, 0.2) * (1 - band(heroP, 0.78, 1)))

      els.specRows.forEach((row) => {
        const rect = row.getBoundingClientRect()
        const c = rect.top + rect.height / 2
        // Rows brighten as they rise into the upper half and hold there.
        const t = clamp01(1 - (c - vh * 0.12) / (vh * 0.78))
        row.style.opacity = String(lerp(0.12, 1, smooth(clamp01(t))))
        row.style.setProperty('--rule', `${smooth(clamp01(t * 1.15)) * 100}%`)
        row.querySelector('.wt').style.opacity = String(smooth(clamp01(t)))
      })
    }
  }

  /* ---- outro ---------------------------------------------------------- */
  {
    const p = prog('outro')
    els.outroChars.forEach((c, i) => {
      c.style.transform = `translateY(${(1 - band(p, i * 0.03, 0.5 + i * 0.03)) * 30}%)`
    })
  }

  /* ---- scene ----------------------------------------------------------- */
  api.update(scrollY, time)
}

function activateCopy(id, thresholds) {
  const s = sec(id)
  if (!s) return
  const p = prog(id)
  const blocks = s.querySelectorAll('.copy')
  blocks.forEach((el, i) => {
    const on = band(p, thresholds[i] - 0.06, thresholds[i] + 0.06)
    const off = 1 - band(p, (thresholds[i + 1] ?? 1.4) + 0.02, (thresholds[i + 1] ?? 1.6) + 0.16)
    const fadeOut = 1 - band(p, 0.82, 0.96)
    el.style.opacity = String(lerp(0.25, 1, on * off) * fadeOut)
  })
}


/* ------------------------------------------------------------------ *
 * Disassembly interaction
 *
 * Three gestures share one pointer: drag orbits the stack, a tap selects a
 * part, and a press-and-hold pushes the camera in with the page scroll
 * stopped. They are told apart by movement and time, resolved on pointerup,
 * so nothing commits until the gesture is actually over.
 * ------------------------------------------------------------------ */

const HOLD_MS = 420 // press this long without moving and it becomes a hold
const DRAG_SLOP = 6 // px of movement before a tap becomes a drag
const RING_LENGTH = 308 // circumference of the badge ring at r=49

const gesture = {
  down: false,
  moved: false,
  holding: false,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  downAt: 0,
}

let interactive = false

/** Is the stage currently offering itself to the pointer? */
function setInteractive(on) {
  if (on === interactive) return
  interactive = on
  stage.classList.toggle('is-interactive', on)
  if (!on) {
    endHold()
    selectColumn(-1)
    api.state.hover = -1
    api.state.orbitTarget.set(0, 0)
    api.state.liftTarget = 0
  }
}

function syncDolly() {
  api.state.dollyTarget = gesture.holding ? 1.15 : api.state.selected >= 0 ? 0.5 : 0
}

function selectColumn(col) {
  const st = api.state
  if (st.selected === col) return
  st.selected = col

  if (col >= 0) {
    const part = EXPLODE_PARTS[col] || { name: EXPLODE_LABELS[col], fn: '' }
    els.partName.textContent = part.name
    els.partFn.textContent = part.fn
    els.partCard.classList.add('is-open')
    els.partCard.setAttribute('aria-hidden', 'false')

    const world = api.worldPerScreen()
    if (window.innerWidth < 900) {
      // On a phone the card is full width along the bottom, so there is no
      // "beside" to move the part to — lift the stack into the top half
      // instead and leave it horizontally where it is.
      st.panTarget = st.pan + (api.columnWorldX(col) - 0)
      st.liftTarget = 0.24 * world.h
    } else {
      // Slide the chosen column left of centre so the card has clear space.
      // Computed once, from where the column is right now, so it cannot chase
      // its own output frame to frame.
      st.panTarget = st.pan + (api.columnWorldX(col) - -0.16 * world.w)
      st.liftTarget = 0
    }
  } else {
    els.partCard.classList.remove('is-open')
    els.partCard.setAttribute('aria-hidden', 'true')
    st.panTarget = 0
    st.liftTarget = 0
  }
  syncDolly()
}

function beginHold() {
  if (gesture.holding || !interactive) return
  gesture.holding = true
  lenis?.stop()
  document.body.classList.add('is-holding')
  syncDolly()
}

function endHold() {
  if (!gesture.holding) return
  gesture.holding = false
  lenis?.start()
  document.body.classList.remove('is-holding')
  syncDolly()
}

function onDown(e) {
  if (!interactive) return
  gesture.down = true
  gesture.moved = false
  gesture.startX = gesture.lastX = e.clientX
  gesture.startY = gesture.lastY = e.clientY
  gesture.downAt = performance.now()
}

function onMove(e) {
  if (!interactive) return

  if (!gesture.down) {
    const col = api.pickColumn(e.clientX, e.clientY)
    api.state.hover = col
    stage.classList.toggle('is-over', col >= 0)
    return
  }

  const dx = e.clientX - gesture.lastX
  const dy = e.clientY - gesture.lastY
  gesture.lastX = e.clientX
  gesture.lastY = e.clientY

  if (
    !gesture.moved &&
    Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY) > DRAG_SLOP
  ) {
    gesture.moved = true
    stage.classList.add('is-dragging')
  }

  if (!gesture.moved) return

  // Deliberately shallow. This is a nudge to see round a part, not a
  // turntable — let it swing far and the carefully aimed elevation is gone.
  const st = api.state
  st.orbitTarget.x = clampAbs(st.orbitTarget.x + dx * 0.0022, 0.6)
  st.orbitTarget.y = clampAbs(st.orbitTarget.y + dy * 0.0016, 0.26)
}

function onUp(e) {
  const wasHolding = gesture.holding
  const moved = gesture.moved
  endHold()
  gesture.down = false
  gesture.moved = false
  stage.classList.remove('is-dragging')
  if (!interactive) return

  // A drag or a hold consumes the gesture; only a clean tap selects.
  if (moved || wasHolding) return
  const col = api.pickColumn(e.clientX, e.clientY)
  selectColumn(col === api.state.selected ? -1 : col)
}

const clampAbs = (v, m) => (v > m ? m : v < -m ? -m : v)

const stage = document.getElementById('canvas-wrapper')

function bindInteraction() {
  stage.addEventListener('pointerdown', onDown)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)

  els.partClose?.addEventListener('click', () => selectColumn(-1))
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') selectColumn(-1)
  })

  // The captions are buttons too — the gesture should not be the only way in,
  // and they are the part of this that works with a keyboard.
  els.leaders.forEach((el) => {
    const i = Number(el.dataset.i)
    el.addEventListener('click', () => selectColumn(api.state.selected === i ? -1 : i))
    el.addEventListener('pointerenter', () => {
      if (interactive) api.state.hover = i
    })
    el.addEventListener('pointerleave', () => {
      if (interactive && api.state.hover === i) api.state.hover = -1
    })
  })
}

/** Called every frame from tick() while the disassembly section is on screen. */
function driveInteraction(p) {
  // Only offer the pointer while the parts are actually spread out. Outside
  // that window the canvas has to stay click-through or the page stops
  // scrolling under the cursor.
  setInteractive(p > 0.3 && p < 0.76)

  const st = api.state
  const active = st.selected >= 0 ? st.selected : st.hover
  els.leaders.forEach((el, i) => {
    el.classList.toggle('is-active', active >= 0 && i === active)
    el.classList.toggle('is-dim', active >= 0 && i !== active)
  })

  // The hold is detected here rather than on a timer, so the trigger and the
  // ring that announces it read the same clock — and so a throttled timer
  // cannot leave the ring full with nothing having happened.
  const held = gesture.down && !gesture.moved ? performance.now() - gesture.downAt : 0
  if (held >= HOLD_MS) beginHold()

  if (els.holdRing) {
    const t = gesture.holding ? 1 : clamp01(held / HOLD_MS)
    els.holdRing.style.strokeDashoffset = String(RING_LENGTH * (1 - t))
    els.holdBadge?.classList.toggle('is-armed', t > 0)
  }
}
