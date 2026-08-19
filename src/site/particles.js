import * as THREE from 'three'

/**
 * The dust ribbons behind the movement in the Mechanical Heart section.
 *
 * They are not a random cloud. The reference reads as a few long, braided
 * strands sweeping around the movement and crossing in front of it — so the
 * points are seeded along a handful of closed 3D curves with a soft radial
 * jitter, and each point keeps a phase so the whole ribbon can drift along
 * itself over time. A pure random cloud loses the sense of flow completely.
 */

const STRANDS = 7
const PER_STRAND = 2600

function strandCurve(i) {
  const pts = []
  const n = 9
  const tilt = (i / STRANDS - 0.5) * 1.3
  const phase = i * 1.9
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2
    // A lemniscate in XY, lifted into Z — this is what gives the
    // eye-shaped silhouette that crosses in front of the movement.
    const r = 1.9 + Math.sin(a * 2 + phase) * 0.7
    pts.push(
      new THREE.Vector3(
        Math.cos(a) * r * 1.7,
        Math.sin(a * 2 + phase) * 0.85 + tilt * 0.6,
        Math.sin(a) * r * 0.9 + Math.cos(a * 3 + phase) * 0.5
      )
    )
  }
  return new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5)
}

export function createParticles() {
  const count = STRANDS * PER_STRAND
  const pos = new Float32Array(count * 3)
  const seed = new Float32Array(count * 3) // along-curve t, radial angle, radius
  const size = new Float32Array(count)

  let n = 0
  for (let s = 0; s < STRANDS; s++) {
    const curve = strandCurve(s)
    const samples = curve.getSpacedPoints(512)
    for (let k = 0; k < PER_STRAND; k++) {
      const t = Math.random()
      const idx = Math.floor(t * 511)
      const p = samples[idx]

      // Cluster tightly to the curve: cubing the random pushes most points
      // into the core of the strand and leaves a thin haze around it.
      const rr = Math.pow(Math.random(), 3) * 0.3
      const a1 = Math.random() * Math.PI * 2
      const a2 = Math.acos(2 * Math.random() - 1)

      pos[n * 3] = p.x + Math.sin(a2) * Math.cos(a1) * rr
      pos[n * 3 + 1] = p.y + Math.sin(a2) * Math.sin(a1) * rr * 0.7
      pos[n * 3 + 2] = p.z + Math.cos(a2) * rr

      seed[n * 3] = t
      seed[n * 3 + 1] = a1
      seed[n * 3 + 2] = rr
      size[n] = 0.55 + Math.pow(Math.random(), 2) * 2.2
      n++
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uPixelRatio: { value: 1 },
      uSpread: { value: 1 },
      uColour: { value: new THREE.Color('#c9c9c9') },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aSeed;
      attribute float aSize;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uSpread;
      varying float vFade;

      void main() {
        vec3 p = position;

        // Slow breathing drift so the field never looks frozen.
        float w = uTime * 0.06 + aSeed.x * 6.2831;
        p += vec3(sin(w) * 0.09, cos(w * 1.3) * 0.06, sin(w * 0.7) * 0.09);
        p *= uSpread;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;

        // Fade the far half of the field so the strands read as depth
        // rather than as a flat scatter.
        vFade = smoothstep(-14.0, -2.0, mv.z);
        gl_PointSize = aSize * uPixelRatio * (7.5 / max(0.001, -mv.z));
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uColour;
      varying float vFade;

      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r = dot(d, d);
        if (r > 0.25) discard;
        float a = smoothstep(0.25, 0.04, r);
        gl_FragColor = vec4(uColour, a * uOpacity * vFade);
      }
    `,
  })

  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  points.visible = false
  return points
}
