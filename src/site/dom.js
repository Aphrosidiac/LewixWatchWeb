import {
  SECTIONS,
  EXPLODE_PARTS,
  BRAND,
  TIMELESS_LINES,
  PRECISE_LINES,
  COPY,
  PARTS,
  EXPLODE_LABELS,
  COLOURWAYS,
  SPEC_ROWS,
} from './content.js'

const h = (tag, cls, html) => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html != null) e.innerHTML = html
  return e
}

/** Split a string into per-character spans so each glyph can be animated. */
function splitChars(text) {
  return [...text]
    .map((c) => `<span class="st-char">${c === ' ' ? '&nbsp;' : c}</span>`)
    .join('')
}

function copyBlock({ label, body }) {
  return `<div class="copy"><div class="copy__label">${label}</div><div class="copy__body">${body}</div></div>`
}

function copyCol(blocks, style) {
  return `<div class="copy-col" style="${style}">${blocks.map(copyBlock).join('')}</div>`
}

/** The faint outlined dial glyph — circle, tick ring, two subdial holes. */
function dialGlyph(size = 120, stroke = '#d5d5d5') {
  const ticks = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2
    const r0 = 42
    const r1 = i % 6 === 0 ? 33 : 36
    return `<line x1="${50 + Math.sin(a) * r0}" y1="${50 - Math.cos(a) * r0}" x2="${
      50 + Math.sin(a) * r1
    }" y2="${50 - Math.cos(a) * r1}" stroke="${stroke}" stroke-width="1"/>`
  }).join('')
  return `<svg class="dial-glyph" width="${size}" height="${size}" viewBox="0 0 100 100" fill="none">
    <circle cx="50" cy="50" r="47" fill="${stroke}" fill-opacity=".18"/>
    ${ticks}
    <circle cx="50" cy="38" r="7" fill="#fff" fill-opacity=".55"/>
    <circle cx="50" cy="57" r="8" fill="#fff" fill-opacity=".55"/>
  </svg>`
}

/** The hero / colourway dial circle plus its progress arc. */
function ringSvg() {
  return `<svg class="hero__ring" viewBox="0 0 700 700" fill="none">
    <path fill="#000" fill-opacity=".028" d="M350 350 350 5A345 345 0 0 0 105 107Z"/>
    <path fill="#fff" fill-opacity=".1" d="M350 350 105 107A345 345 0 0 0 202 620Z"/>
    <circle cx="350" cy="350" r="345" stroke="#c9c9c9" stroke-width="1"/>
    <path id="heroArc" d="M350 5a345 345 0 0 1 244 101" stroke="#111" stroke-width="2" fill="none"/>
    <path d="M350 695a345 345 0 0 0 244-101" stroke="#e8e2c6" stroke-width="2" fill="none"/>
    <line x1="350" y1="5" x2="350" y2="695" stroke="#d8d8d8" stroke-width="1"/>
  </svg>`
}

function bigTextStack(lines, extraClass = '') {
  const spans = lines
    .map(
      (l, i) =>
        `<span class="bl" data-i="${i}" style="margin-left:${l.indent}vw">${l.html}</span>`
    )
    .join('')
  return `<div class="bigtext__wrap ${extraClass}">${spans}</div>`
}

export function buildDOM(root) {
  const vh = () => window.innerHeight
  const frag = document.createDocumentFragment()

  const make = (def, inner, cls = '') => {
    const s = h('section', cls)
    s.id = 'sec-' + def.id
    s.dataset.id = def.id
    s.style.height = def.vh + 'vh'
    const pin = h('div', 'pin')
    pin.innerHTML = inner
    s.appendChild(pin)
    frag.appendChild(s)
    return s
  }

  /** A section whose children scroll with the document rather than pin. */
  const flow = (def, inner, cls = '') => {
    const s = h('section', cls + ' flow')
    s.id = 'sec-' + def.id
    s.dataset.id = def.id
    s.style.height = def.vh + 'vh'
    s.innerHTML = inner
    frag.appendChild(s)
    return s
  }

  const S = Object.fromEntries(SECTIONS.map((s) => [s.id, s]))

  /* 0 — hero -------------------------------------------------------- */
  make(
    S.hero,
    `${ringSvg()}
     <div class="hero__inner">
       <h1 class="hero__title">
         <span class="hero__word">${splitChars(BRAND.name)}</span>
         <span class="hero__word">${splitChars(BRAND.ref)}</span>
       </h1>
     </div>
     <div class="hero__meta"><span>Color</span>Silver Steel</div>
     <div class="hero__model"><b>MODEL</b><i>${BRAND.weight}</i></div>`,
    'hero'
  )

  /* 1 — timeless ---------------------------------------------------- *
   * The display stack and its copy scroll WITH the document here — they
   * are not pinned. That is what makes each line pass through the middle
   * of the frame and take the ink as it goes.                            */
  flow(
    S.timeless,
    `<div class="bigtext" style="position:absolute;left:0;right:0;top:19.8vh">
       ${bigTextStack(TIMELESS_LINES)}
     </div>
     <div class="glyph-slot" style="position:absolute;left:9.6vw;top:176vh">${dialGlyph(
       120
     )}</div>
     ${copyCol(COPY.timeless, 'left:72.9vw;top:170.7vh')}`
  )

  /* 2 — case & finishes --------------------------------------------- */
  make(
    S.case,
    `<div class="vmarquee"><div class="vmarquee__track">LX—60P&nbsp;LX—60P</div></div>
     <div class="vlabel">LX—60P</div>
     <div class="pips" style="left:18vw;top:20.5vh"><i></i><i></i></div>
     ${copyCol(COPY.case, 'left:18vw;top:30.5vh')}`
  )

  /* 3 — disassembly -------------------------------------------------- */
  make(
    S.disassembly,
    `<div class="horizon"></div>
     <div class="uilayer">
       <div class="explore-pill">
         <span class="ring"></span>
         <span class="pointer-only"><em>Click</em>&nbsp;to explore</span>
         <span class="touch-only"><em>Drag &amp; tap</em>&nbsp;to explore</span>
       </div>
       <div class="leaders">${EXPLODE_LABELS.map(
         (n, i) =>
           `<button class="leader" data-i="${i}" type="button"><span class="stem"></span><span class="name">${n}</span></button>`
       ).join('')}</div>
       <div class="badge badge--hold" id="holdBadge">
         <svg class="badge__ring" viewBox="0 0 100 100" aria-hidden="true">
           <circle cx="50" cy="50" r="49" />
         </svg>
         <span>Hold to<br>explore</span>
       </div>
       <aside class="partcard" id="partCard" aria-hidden="true">
         <button class="partcard__close" id="partClose" type="button">
           <span class="x" aria-hidden="true"></span>Close
         </button>
         <div class="partcard__row">
           <div class="partcard__label">Name</div>
           <div class="partcard__name" id="partName"></div>
         </div>
         <div class="partcard__row">
           <div class="partcard__label">Function</div>
           <div class="partcard__fn" id="partFn"></div>
         </div>
       </aside>
     </div>`
  )

  /* 4 — mechanical heart --------------------------------------------- */
  make(
    S.heart,
    `<div class="heart__title"><b>Mechanical</b><i>Heart</i></div>
     ${copyCol(COPY.heart, 'left:18vw;top:53vh')}
     <div class="heart__reserve">42&rsquo;</div>`,
    'on-dark'
  )

  /* 5 — highly precise ----------------------------------------------- */
  flow(
    S.precise,
    `<div class="bigtext dark" style="position:absolute;left:0;right:0;top:24vh">
       ${bigTextStack(PRECISE_LINES)}
     </div>
     <div class="glyph-slot" style="position:absolute;left:9.6vw;top:176vh;opacity:.25">${dialGlyph(
       120,
       '#555'
     )}</div>
     ${copyCol(COPY.precise, 'left:72.9vw;top:170.7vh')}`,
    'on-dark'
  )

  /* 6 / 8 / 9 — single-part sections ---------------------------------- */
  const partSection = (def, p) =>
    make(
      def,
      `<div class="tech">
         <i class="h"></i><i class="v"></i>
         <i class="diag" style="transform:rotate(38deg) translateX(-22vw)"></i>
         <i class="diag" style="transform:rotate(-38deg) translateX(22vw)"></i>
         <span class="plus"></span>
       </div>
       <div class="part__head">
         <div class="part__title">${p.title.map((t) => `<span>${t}</span>`).join('')}</div>
         <div class="part__caption">${p.caption}</div>
       </div>
       <div class="counter" style="left:2.05vw;top:5.2vh">${p.counter}</div>`,
      'part'
    )

  partSection(S.contours, PARTS[0])

  /* 7 — refined dial --------------------------------------------------- */
  make(
    S.dial,
    `<div class="tech">
       <i class="h"></i>
       <i class="diag" style="transform:rotate(34deg) translateX(-14vw);background:#e4e4e4"></i>
       <i class="diag" style="transform:rotate(-34deg) translateX(10vw);background:#e4e4e4"></i>
     </div>
     ${copyCol(COPY.dial, 'left:18vw;top:29vh;gap:4.2vh')}`
  )

  partSection(S.profile, PARTS[1])
  partSection(S.bracelet, PARTS[2])

  /* 10 — editions ------------------------------------------------------ */
  flow(
    S.editions,
    `<div class="bigtext" style="position:absolute;left:0;right:0;top:16vh">
       ${bigTextStack(TIMELESS_LINES)}
     </div>
     <div class="photo-card" id="editionCard" style="width:14.9vw;aspect-ratio:218/340"></div>
     ${copyCol(COPY.editions, 'left:72.9vw;top:150vh')}`
  )

  /* 11 — colourways ---------------------------------------------------- */
  make(
    S.colour,
    `${ringSvg()}
     ${COLOURWAYS.map(
       (c, i) =>
         `<div class="colour" data-i="${i}">
            <div class="colour__ghost">${c.ghost.map((g) => `<div>${g}</div>`).join('')}</div>
            <div class="colour__name">${c.name}</div>
            <div class="colour__index">0${i + 1} / 0${COLOURWAYS.length}</div>
          </div>`
     ).join('')}
     <div class="badge">Select<br>model</div>`,
    'colour-sec'
  )

  /* 12 — model breakdown ------------------------------------------------ */
  const specRows = SPEC_ROWS.map(
    ([name, ix, wt], i) =>
      `<div class="spec-row" data-i="${i}">
         <span class="plus">+</span>
         <span class="nm">${name}</span>
         <span class="ix">${ix}</span>
         <span class="mech">Mechanism</span>
         <span class="wt">${wt}</span>
       </div>`
  ).join('')

  const modelSec = h('section')
  modelSec.id = 'sec-model'
  modelSec.dataset.id = 'model'
  modelSec.innerHTML = `
    <div class="model-hero"><div class="pin" id="modelHero">
      <div class="model__wrap">
        <b>MODEL</b>
        <span class="model__num"><span>${BRAND.weight}</span></span>
      </div>
      <div class="spec-card" style="top:50%;transform:translateY(-50%)">
        <div class="spec-card__photo" id="specPhoto"></div>
        <div class="spec-card__chip">
          <span class="dot"></span>
          <span class="txt"><em>Color</em>Silver Steel</span>
          ${dialGlyph(50, '#d8d8d8')}
        </div>
      </div>
    </div></div>
    <div class="spec-table">${specRows}</div>`
  frag.appendChild(modelSec)

  /* 13 — outro ---------------------------------------------------------- */
  make(
    S.outro,
    `<div class="outro__inner">
       <h1 class="outro__title">
         <span>${splitChars(BRAND.name)}</span>
         <span>${splitChars(BRAND.ref)}</span>
       </h1>
     </div>
     <div class="badge">Select<br>model</div>`,
    'outro'
  )

  root.appendChild(frag)

  /* Section scroll ranges, resolved once the layout is real. */
  return measure()
}

export function measure() {
  const out = {}
  document.querySelectorAll('#root > section').forEach((s) => {
    const top = s.offsetTop
    out[s.dataset.id] = { el: s, top, height: s.offsetHeight, bottom: top + s.offsetHeight }
  })
  return out
}
