/** Персональные настройки каждой темы фона (не переносятся между темами). */

export const THEME_DEFAULTS = {
  dots: { density: 75, linkDist: 140, size: 1 },
  orbits: { rings: 5, glow: 1 },
  math: { waves: 3, amplitude: 1 },
  platonic: { count: 5, spin: 0.35, size: 1, speed: 1 },
  tesseract: { scale: 1, spin: 1 },
  graphs: {
    formulas: ['sin(x)', 'cos(x)*0.6', 'sin(x)*cos(x/2)'],
    showGrid: true,
    crawlLabels: true,
    xRange: 12.56,
    yScale: 1,
  },
  blobs: { count: 14, colored: false, size: 1, mergeStrength: 1 },
  blob_cycle: { bits: 18, explodeForce: 1.8, gatherSpeed: 1 },
  polylines: { pieces: 14, size: 0.85, alpha: 0.45 },
  flicker: { cols: 14, rows: 10, ripple: 1, linkAlpha: 0.2 },
  solar: { scale: 1, labels: true, speed: 1 },
  cheese: { size: 1, speed: 1 },
  blackhole: { particles: 160, pull: 1, disc: 1 },
  puppet: { layers: 6, amp: 1 },
  wind: { count: 50, length: 90, speed: 1 },
  desert: { dunes: 4, critters: true, tumble: true },
  glacier: { scale: 1.25, chunks: 8, chill: 1 },
  sand: { count: 120, size: 1 },
  balls: { count: 12, collide: true, size: 1 },
  fireworks: { rate: 1, height: 1, variety: 1 },
  hater: {},
  none: {},
};

const STORAGE = 'chat_theme_params_v1';

export function loadThemeParams() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE) || '{}');
    const out = {};
    for (const [key, defaults] of Object.entries(THEME_DEFAULTS)) {
      out[key] = { ...defaults, ...(raw[key] && typeof raw[key] === 'object' ? raw[key] : {}) };
    }
    return out;
  } catch {
    return Object.fromEntries(Object.entries(THEME_DEFAULTS).map(([k, v]) => [k, { ...v }]));
  }
}

export function saveThemeParams(all) {
  localStorage.setItem(STORAGE, JSON.stringify(all));
  window.dispatchEvent(new CustomEvent('appearance:change'));
}

export function getThemeParams(animation, all) {
  const defaults = THEME_DEFAULTS[animation] || {};
  const cur = (all && all[animation]) || {};
  return { ...defaults, ...cur };
}
