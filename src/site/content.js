/**
 * All copy and section geometry in one place.
 *
 * `vh` is the section's scroll length in viewport heights. Every scroll
 * animation on the site is expressed as a progress 0..1 within its own
 * section, so changing a length here retimes that section and nothing else.
 */

export const SECTIONS = [
  { id: 'hero', vh: 100 },
  { id: 'timeless', vh: 228 },
  { id: 'case', vh: 300 },
  { id: 'disassembly', vh: 300 },
  { id: 'heart', vh: 400 },
  { id: 'precise', vh: 300 },
  { id: 'contours', vh: 300 },
  { id: 'dial', vh: 300 },
  { id: 'profile', vh: 300 },
  { id: 'bracelet', vh: 400 },
  { id: 'editions', vh: 219 },
  { id: 'colour', vh: 450 },
  { id: 'model', vh: 177 },
  { id: 'outro', vh: 100 },
]

export const BRAND = { name: 'LX', ref: '60P', weight: '146GR' }

/* The display stack, reused three times with different tints. */
export const TIMELESS_LINES = [
  { html: 'LX<i class="emdash"></i>60P', indent: 0 },
  { html: 'the', indent: 50.33 },
  { html: 'timeless', indent: 13.33 },
  { html: 'automatic', indent: 0 },
  { html: '60mm', indent: 0 },
  { html: 'watch&nbsp;/', indent: 9.58 },
]

export const PRECISE_LINES = [
  { html: 'LX<i class="emdash"></i>60P', indent: 0 },
  { html: '/&nbsp;highly', indent: 19.2 },
  { html: 'precise', indent: 0 },
  { html: 'automatic', indent: 0 },
  { html: 'movement', indent: 0 },
]

export const COPY = {
  timeless: [
    {
      label: 'Chronograph',
      body: 'A contemporary interpretation of the chronograph, combining precision engineering with refined aesthetics. Designed to capture every moment with accuracy and elegance.',
    },
    {
      label: 'Automatic Movement',
      body: 'Powered by a high-performance automatic calibre, delivering reliable precision and a smooth, continuous motion visible through every detail of the dial.',
    },
  ],
  case: [
    {
      label: 'Case & Finishes',
      body: 'Crafted with meticulous attention to detail, the case alternates between polished and satin-brushed surfaces, creating subtle contrasts that enhance its presence and reflect light with precision.',
    },
    {
      label: 'Dial & Complications',
      body: 'The dial reveals a layered composition with refined textures and carefully balanced subdials. Each element is designed to ensure clarity, depth, and a distinctive visual identity.',
    },
  ],
  heart: [
    {
      label: 'Automatic Movement',
      body: 'The movement regulates the balance wheel for consistent and precise timing',
    },
    { label: 'Diameter', body: '60mm' },
  ],
  precise: [
    {
      label: 'Self-Winding Movement',
      body: 'The movement regulates the balance wheel for consistent and precise timing.',
    },
    {
      label: 'Reliability',
      body: 'Built to maintain steady performance in a variety of conditions.',
    },
  ],
  dial: [
    { label: 'Refined Dial', body: 'A clean, elegant dial designed for readability and timeless appeal' },
    {
      label: 'Polished Hands',
      body: 'Sleek hour and minute hands glide smoothly, complementing the overall design',
    },
    {
      label: 'Premium Bezel',
      body: "The bezel adds depth and sophistication, highlighting the watch's contours and finish",
    },
  ],
  editions: [
    {
      label: 'Classic Edition',
      body: 'A timeless design combining elegance and precision for everyday wear.',
    },
    {
      label: 'Sport Chronograph',
      body: 'Durable and dynamic, crafted for active lifestyles without compromising style',
    },
  ],
}

export const PARTS = [
  { title: ['Elegant', 'Contours'], counter: '34 / 62', caption: 'The subtly curved dial and beveled edges highlight the craftsmanship and create a refined visual depth' },
  { title: ['Slim', 'Profile'], counter: '35 / 62', caption: 'The side view highlights the sleek, refined silhouette of the case, with gently curved edges and a perfectly polished finish' },
  { title: ['Bracelet'], counter: '36 / 62', caption: "Crafted from polished links, the bracelet combines durability with comfort, perfectly complementing the watch's design" },
]

/* The six assembly groups of the calibre, dial side first. These are the
   real ETA 6498-1 groupings from parts.json rather than invented part names,
   so the captions line up with what is actually coming apart on screen. */
export const EXPLODE_LABELS = [
  'Keyless works',
  'Main plate',
  'Going train',
  'Bridges',
  'Winding',
  'Balance',
]

export const COLOURWAYS = [
  { name: 'Silver Steel', ghost: ['Silver', 'Steel'], colour: 0xd9d9dd, rough: 0.16, metal: 1.0 },
  { name: 'Deep black', ghost: ['Deep', 'Black'], colour: 0x1c1c1e, rough: 0.28, metal: 1.0 },
  { name: 'Pure Gold', ghost: ['Pure', 'Gold'], colour: 0xd4af52, rough: 0.18, metal: 1.0 },
  { name: 'Rose Gold', ghost: ['Rose', 'Gold'], colour: 0xd39a7c, rough: 0.19, metal: 1.0 },
]

export const SPEC_ROWS = [
  ['Dial', '01', '11 Gr'],
  ['Hands', '02', '1 Gr'],
  ['Crystal', '03', '12 Gr'],
  ['Bezel', '04', '16 Gr'],
  ['Lugs', '05', '18 Gr'],
  ['Strap', '06', '34 Gr'],
  ['Buckle', '07', '8 Gr'],
  ['Crown', '08', '3 Gr'],
  ['Caseback', '09', '14 Gr'],
  ['Movement', '10', '29 Gr'],
]
