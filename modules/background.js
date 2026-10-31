import * as Scenes from './bgScenes.js';
import { loadThemeParams, getThemeParams } from './themeSettings.js';

const STORAGE_KEY = 'chat_appearance_v1';
const GRAPHS_KEY = 'chat_graph_formulas';
const DEFAULTS = { animation: 'dots', speed: 1, density: 75, opacity: 65 };
export const ANIMATIONS = [
  'dots', 'orbits', 'math', 'platonic', 'tesseract', 'graphs',
  'blobs', 'blob_cycle', 'polylines', 'flicker', 'solar', 'cheese',
  'blackhole', 'puppet', 'wind', 'desert', 'glacier', 'sand', 'balls',
  'fireworks', 'hater', 'none',
];

function readSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      animation: ANIMATIONS.includes(saved.animation) ? saved.animation : DEFAULTS.animation,
      speed: clamp(saved.speed, 0.2, 2, DEFAULTS.speed),
      density: Math.round(clamp(saved.density, 30, 140, DEFAULTS.density)),
      opacity: clamp(saved.opacity, 10, 100, DEFAULTS.opacity) / 100,
    };
  } catch {
    return { ...DEFAULTS, opacity: DEFAULTS.opacity / 100 };
  }
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function parseHex(hex) {
  const value = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex.slice(1) : 'ff80ab';
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
}

function rgba(rgb, alpha) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

export function compileGraphExpression(source) {
  let src = String(source || '').trim();
  if (!src) throw new Error('пустое выражение');
  src = src.replace(/^(y|f\s*\(\s*x\s*\))\s*=\s*/i, '');
  if (!/^[0-9a-zA-Z_+\-*/^().,\s]+$/.test(src)) throw new Error('недопустимые символы');
  if (/\b(window|document|Function|eval|globalThis|this|import|constructor)\b/i.test(src)) {
    throw new Error('запрещённый идентификатор');
  }
  const allowed = new Set([
    'x', 't', 'pi', 'e', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
    'abs', 'sqrt', 'log', 'ln', 'exp', 'floor', 'ceil', 'min', 'max', 'pow', 'sign', 'hypot',
  ]);
  for (const id of src.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || []) {
    if (!allowed.has(id.toLowerCase())) throw new Error('неизвестная функция или переменная: ' + id);
  }
  const body = src
    .replace(/\^/g, '**')
    .replace(/\bpi\b/gi, 'Math.PI')
    .replace(/\be\b/g, 'Math.E')
    .replace(/\bsin\b/gi, 'Math.sin')
    .replace(/\bcos\b/gi, 'Math.cos')
    .replace(/\btan\b/gi, 'Math.tan')
    .replace(/\basin\b/gi, 'Math.asin')
    .replace(/\bacos\b/gi, 'Math.acos')
    .replace(/\batan\b/gi, 'Math.atan')
    .replace(/\babs\b/gi, 'Math.abs')
    .replace(/\bsqrt\b/gi, 'Math.sqrt')
    .replace(/\blog\b/gi, 'Math.log')
    .replace(/\bln\b/gi, 'Math.log')
    .replace(/\bexp\b/gi, 'Math.exp')
    .replace(/\bfloor\b/gi, 'Math.floor')
    .replace(/\bceil\b/gi, 'Math.ceil')
    .replace(/\bmin\b/gi, 'Math.min')
    .replace(/\bmax\b/gi, 'Math.max')
    .replace(/\bpow\b/gi, 'Math.pow')
    .replace(/\bsign\b/gi, 'Math.sign')
    .replace(/\bhypot\b/gi, 'Math.hypot');
  const fn = new Function('x', 't', `"use strict"; return (${body});`);
  const sample = fn(0.5, 0.1);
  if (typeof sample !== 'number' || Number.isNaN(sample)) {
    throw new Error('выражение должно возвращать число');
  }
  return fn;
}

export function loadGraphFormulas() {
  try {
    const fromTheme = loadThemeParams().graphs?.formulas;
    if (Array.isArray(fromTheme) && fromTheme.length) return fromTheme.map(String);
    const raw = JSON.parse(localStorage.getItem(GRAPHS_KEY) || '[]');
    if (Array.isArray(raw) && raw.length) return raw.map(String).filter(Boolean).slice(0, 12);
  } catch { /* ignore */ }
  return ['sin(x)', 'cos(x)*0.6', 'sin(x)*cos(x/2)'];
}

export function saveGraphFormulas(list) {
  const cleaned = (list || []).map(String).map((s) => s.trim()).filter(Boolean).slice(0, 12);
  localStorage.setItem(GRAPHS_KEY, JSON.stringify(cleaned));
  try {
    const all = loadThemeParams();
    all.graphs = { ...all.graphs, formulas: cleaned };
    localStorage.setItem('chat_theme_params_v1', JSON.stringify(all));
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('appearance:change'));
  return cleaned;
}

function rotX(p, a) {
  const c = Math.cos(a); const s = Math.sin(a);
  return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
}
function rotY(p, a) {
  const c = Math.cos(a); const s = Math.sin(a);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
}
function rotZ(p, a) {
  const c = Math.cos(a); const s = Math.sin(a);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
}
function rot4(p, plane, a) {
  const c = Math.cos(a); const s = Math.sin(a);
  const out = p.slice();
  out[plane[0]] = p[plane[0]] * c - p[plane[1]] * s;
  out[plane[1]] = p[plane[0]] * s + p[plane[1]] * c;
  return out;
}

const SOLIDS = {
  tetra: {
    verts: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((v) => {
      const n = Math.hypot(...v) || 1;
      return v.map((c) => c / n);
    }),
    edges: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]],
  },
  cube: {
    verts: Array.from({ length: 8 }, (_, i) => {
      const x = (i & 4) ? 1 : -1;
      const y = (i & 2) ? 1 : -1;
      const z = (i & 1) ? 1 : -1;
      const n = Math.hypot(x, y, z);
      return [x / n, y / n, z / n];
    }),
    edges: (() => {
      const e = [];
      for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) {
        let bits = 0;
        for (let k = 0; k < 3; k++) if (((a >> k) & 1) !== ((b >> k) & 1)) bits++;
        if (bits === 1) e.push([a, b]);
      }
      return e;
    })(),
  },
  octa: {
    verts: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
    edges: [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [2, 5], [3, 4], [3, 5]],
  },
};

function makeTesseract() {
  const verts = [];
  for (let i = 0; i < 16; i++) {
    verts.push([(i & 1) ? 1 : -1, (i & 2) ? 1 : -1, (i & 4) ? 1 : -1, (i & 8) ? 1 : -1]);
  }
  const edges = [];
  for (let a = 0; a < 16; a++) for (let b = a + 1; b < 16; b++) {
    let bits = 0;
    for (let k = 0; k < 4; k++) if (((a >> k) & 1) !== ((b >> k) & 1)) bits++;
    if (bits === 1) edges.push([a, b]);
  }
  return { verts, edges };
}
const TESSERACT = makeTesseract();

const PLANETS = [
  { name: 'Mercury', a: 0.39, period: 0.24, size: 2.2, color: '#b1b1b1' },
  { name: 'Venus', a: 0.72, period: 0.62, size: 3.2, color: '#e6c07b' },
  { name: 'Earth', a: 1.0, period: 1.0, size: 3.4, color: '#6ca0ff' },
  { name: 'Mars', a: 1.52, period: 1.88, size: 2.6, color: '#ff6b4a' },
  { name: 'Jupiter', a: 5.2, period: 11.86, size: 7.5, color: '#d2b48c' },
  { name: 'Saturn', a: 9.5, period: 29.46, size: 6.5, color: '#f0d59a', ring: true },
  { name: 'Uranus', a: 19.2, period: 84.0, size: 4.5, color: '#7fdbd4' },
  { name: 'Neptune', a: 30.1, period: 164.8, size: 4.4, color: '#4169e1' },
  { name: 'Pluto', a: 39.5, period: 248.0, size: 1.8, color: '#c4a484' },
];

export function initBackgroundAnimation() {
  const canvas = document.getElementById('bgDots');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let width = 0; let height = 0; let dpr = 1;
  let settings = readSettings();
  let themeAll = loadThemeParams();
  let theme = getThemeParams(settings.animation, themeAll);
  let accent = parseHex(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  let dots = []; let solids = []; let graphFns = [];
  let sceneBlobs = []; let sceneBlobCycle = null; let sceneGlass = [];
  let sceneFlicker = null; let sceneCheese = null; let sceneWind = [];
  let sceneSand = []; let sceneBalls = []; let sceneFireworks = null;
  let sceneDesert = null; let sceneBlackHole = [];
  let phase = 0; let lastFrame = 0; let frameId = 0;
  const frameInterval = 1000 / 30;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function refreshTheme() {
    themeAll = loadThemeParams();
    theme = getThemeParams(settings.animation, themeAll);
  }

  function createDots() {
    const count = theme.density || settings.density;
    dots = Array.from({ length: count }, () => ({
      x: Math.random() * Math.max(width, 1),
      y: Math.random() * Math.max(height, 1),
      vx: (Math.random() - 0.5) * 0.55,
      vy: (Math.random() - 0.5) * 0.55,
      radius: Math.random() * 1.5 + 1,
      phase: Math.random() * Math.PI * 2,
      alpha: Math.random() * 0.3 + 0.35,
    }));
  }

  function createSolids() {
    const types = ['tetra', 'cube', 'octa'];
    const n = Math.max(1, Math.min(20, Math.round(theme.count || 5)));
    const sizeMul = theme.size || 1;
    const spinMul = theme.spin || 0.35;
    solids = Array.from({ length: n }, (_, i) => {
      const scale = (36 + Math.random() * 40) * sizeMul;
      return {
        type: types[i % types.length],
        x: Math.random() * width, y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.9 * (theme.speed || 1),
        vy: (Math.random() - 0.5) * 0.9 * (theme.speed || 1),
        rx: Math.random() * Math.PI * 2,
        ry: Math.random() * Math.PI * 2,
        rz: Math.random() * Math.PI * 2,
        spin: [
          (Math.random() - 0.5) * 0.003 * spinMul,
          (Math.random() - 0.5) * 0.003 * spinMul,
          (Math.random() - 0.5) * 0.003 * spinMul,
        ],
        scale, r: scale * 0.55,
      };
    });
  }

  function initScenes() {
    sceneBlobs = Scenes.createBlobs(width, height, theme);
    sceneBlobCycle = Scenes.createBlobCycle(width, height, theme);
    sceneGlass = Scenes.createGlass(width, height, theme);
    sceneFlicker = Scenes.createFlickerGrid(width, height, theme);
    sceneCheese = Scenes.createCheese(width, height);
    sceneWind = Scenes.createWind(width, height, theme);
    sceneSand = Scenes.createSand(width, height, theme);
    sceneBalls = Scenes.createBalls(width, height, theme);
    sceneFireworks = Scenes.createFireworks();
    sceneDesert = Scenes.createDesert(width, height);
    sceneBlackHole = Scenes.createBlackHole(width, height, theme);
  }

  function reloadGraphs() {
    graphFns = [];
    const list = theme.formulas || loadGraphFormulas();
    for (const src of list) {
      try { graphFns.push({ src, fn: compileGraphExpression(src) }); }
      catch (e) { console.warn('График пропущен:', src, e.message); }
    }
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    createDots(); createSolids(); initScenes(); reloadGraphs();
    drawStatic();
  }

  function clear() { ctx.clearRect(0, 0, width, height); }

  function env(delta) {
    return {
      width, height, delta, speed: settings.speed, opacity: settings.opacity,
      accent, phase, params: theme, _blobCanvas: env._blobCanvas, _blobCtx: env._blobCtx,
    };
  }

  function drawDots(delta) {
    const step = delta / 16.67;
    const reach = theme.linkDist || 140;
    for (const dot of dots) {
      dot.x += dot.vx * settings.speed * step;
      dot.y += dot.vy * settings.speed * step;
      if (dot.x < -4 || dot.x > width + 4) dot.vx *= -1;
      if (dot.y < -4 || dot.y > height + 4) dot.vy *= -1;
    }
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const a = dots[i]; const b = dots[j];
        const dx = a.x - b.x; const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= reach * reach) continue;
        const d = Math.sqrt(d2);
        ctx.strokeStyle = rgba(accent, (1 - d / reach) * 0.22 * settings.opacity);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    for (const dot of dots) {
      ctx.fillStyle = rgba(accent, dot.alpha * settings.opacity);
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.radius * (theme.size || 1), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawOrbits() {
    const rings = Math.max(2, Math.min(10, Math.round(theme.rings || 5)));
    const cx = width * 0.5; const cy = height * 0.5;
    const base = Math.min(width, height) * 0.13;
    const rotation = phase * 0.18 * settings.speed;
    for (let index = 0; index < rings; index++) {
      const radius = base + index * Math.min(24, base * 0.13);
      ctx.strokeStyle = rgba(accent, (0.08 + index * 0.012) * settings.opacity * (theme.glow || 1));
      ctx.beginPath();
      ctx.ellipse(cx, cy, radius * (1.35 + index * 0.035), radius * 0.55, rotation + index * 0.38, 0, Math.PI * 2);
      ctx.stroke();
      const angle = rotation * (index % 2 ? -1 : 1) + index * 1.4;
      const x = cx + Math.cos(angle) * radius * (1.35 + index * 0.035);
      const y = cy + Math.sin(angle) * radius * 0.55;
      ctx.fillStyle = rgba(accent, (0.45 + index * 0.06) * settings.opacity);
      ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawMath() {
    const waves = Math.max(1, Math.min(8, Math.round(theme.waves || 3)));
    const midY = height * 0.5;
    const amp = Math.min(height * 0.18, 120) * (theme.amplitude || 1);
    for (let i = 0; i < waves; i++) {
      ctx.beginPath();
      ctx.strokeStyle = rgba(accent, (0.35 - i * 0.05) * settings.opacity);
      ctx.lineWidth = 1.4;
      for (let x = 0; x <= width; x += 3) {
        const y = midY
          + Math.sin(x * (0.01 + i * 0.004) + phase * settings.speed + i) * amp * (1 - i * 0.12)
          + Math.sin(x * 0.03 + phase * 0.5) * amp * 0.12;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function drawPlatonic(delta) {
    const step = delta / 16.67;
    const speed = settings.speed * (theme.speed || 1);
    for (const s of solids) {
      s.x += s.vx * speed * step;
      s.y += s.vy * speed * step;
      s.rx += s.spin[0] * speed * step * 10;
      s.ry += s.spin[1] * speed * step * 10;
      s.rz += s.spin[2] * speed * step * 10;
      if (s.x < s.r) { s.x = s.r; s.vx = Math.abs(s.vx); }
      if (s.x > width - s.r) { s.x = width - s.r; s.vx = -Math.abs(s.vx); }
      if (s.y < s.r) { s.y = s.r; s.vy = Math.abs(s.vy); }
      if (s.y > height - s.r) { s.y = height - s.r; s.vy = -Math.abs(s.vy); }
    }
    for (let i = 0; i < solids.length; i++) {
      for (let j = i + 1; j < solids.length; j++) {
        const a = solids[i]; const b = solids[j];
        const dx = b.x - a.x; const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const min = a.r + b.r;
        if (dist >= min) continue;
        const nx = dx / dist; const ny = dy / dist;
        const overlap = (min - dist) / 2;
        a.x -= nx * overlap; a.y -= ny * overlap;
        b.x += nx * overlap; b.y += ny * overlap;
        const avn = a.vx * nx + a.vy * ny;
        const bvn = b.vx * nx + b.vy * ny;
        a.vx += (bvn - avn) * nx; a.vy += (bvn - avn) * ny;
        b.vx += (avn - bvn) * nx; b.vy += (avn - bvn) * ny;
      }
    }
    for (const s of solids) {
      const mesh = SOLIDS[s.type];
      if (!mesh) continue;
      const projected = mesh.verts.map((v) => {
        let p = v.map((c) => c * s.scale * 0.02);
        p = rotX(p, s.rx); p = rotY(p, s.ry); p = rotZ(p, s.rz);
        const depth = 1 + p[2] * 0.15;
        return [s.x + p[0] * 28 / depth, s.y + p[1] * 28 / depth, p[2]];
      });
      ctx.strokeStyle = rgba(accent, 0.35 * settings.opacity);
      ctx.lineWidth = 1.2;
      for (const [ia, ib] of mesh.edges) {
        ctx.beginPath();
        ctx.moveTo(projected[ia][0], projected[ia][1]);
        ctx.lineTo(projected[ib][0], projected[ib][1]);
        ctx.stroke();
      }
      for (const p of projected) {
        ctx.fillStyle = rgba(accent, Math.min(0.9, (0.35 + (p[2] + 1) * 0.15) * settings.opacity));
        ctx.beginPath(); ctx.arc(p[0], p[1], 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawTesseract() {
    const cx = width / 2; const cy = height / 2;
    const t = phase * settings.speed * (theme.spin || 1);
    const scale = Math.min(width, height) * 0.22 * (theme.scale || 1);
    const projected = TESSERACT.verts.map((v) => {
      let p = v.slice();
      p = rot4(p, [0, 1], t * 0.7);
      p = rot4(p, [2, 3], t * 0.55);
      p = rot4(p, [0, 3], t * 0.35);
      p = rot4(p, [1, 2], t * 0.25);
      const w = 2.6 / (3.2 - p[3]);
      const z = 2.4 / (3 - p[2] * w);
      return [cx + p[0] * w * scale * z, cy + p[1] * w * scale * z, p[2] * w];
    });
    for (const [ia, ib] of TESSERACT.edges) {
      const a = projected[ia]; const b = projected[ib];
      const depth = ((a[2] + b[2]) * 0.5 + 1.2) / 2.4;
      ctx.strokeStyle = rgba(accent, (0.12 + depth * 0.35) * settings.opacity);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
  }

  function drawSolar() {
    const cx = width / 2; const cy = height / 2;
    const maxA = 39.5;
    const scale = Math.min(width, height) * 0.45 / maxA * (theme.scale || 1);
    const t = phase * settings.speed * 0.15 * (theme.speed || 1);
    const sunR = 10;
    const sunG = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunR * 3);
    sunG.addColorStop(0, `rgba(255,220,100,${0.95 * settings.opacity})`);
    sunG.addColorStop(1, 'rgba(255,160,40,0)');
    ctx.fillStyle = sunG;
    ctx.beginPath(); ctx.arc(cx, cy, sunR * 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,210,80,${settings.opacity})`;
    ctx.beginPath(); ctx.arc(cx, cy, sunR, 0, Math.PI * 2); ctx.fill();
    ctx.font = "italic 11px 'Palatino Linotype', Palatino, Georgia, serif";
    for (const p of PLANETS) {
      ctx.strokeStyle = `rgba(255,255,255,${0.08 * settings.opacity})`;
      ctx.beginPath(); ctx.arc(cx, cy, p.a * scale, 0, Math.PI * 2); ctx.stroke();
      const angle = t * (1 / p.period) * Math.PI * 2;
      const incl = p.name === 'Pluto' ? 0.92 : 1;
      const x = cx + Math.cos(angle) * p.a * scale;
      const y = cy + Math.sin(angle) * p.a * scale * incl;
      if (p.ring) {
        ctx.strokeStyle = `rgba(240,213,154,${0.35 * settings.opacity})`;
        ctx.beginPath(); ctx.ellipse(x, y, p.size * 1.8, p.size * 0.55, angle, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = p.color;
      ctx.globalAlpha = settings.opacity;
      ctx.beginPath(); ctx.arc(x, y, p.size, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      if (theme.labels !== false) {
        ctx.fillStyle = `rgba(240,230,255,${0.75 * settings.opacity})`;
        ctx.fillText(p.name, x + p.size + 4, y - 2);
      }
    }
  }

  function drawScene(delta = 16) {
    const e = env(delta);
    env._blobCanvas = e._blobCanvas;
    env._blobCtx = e._blobCtx;
    switch (settings.animation) {
      case 'dots': drawDots(delta); break;
      case 'orbits': drawOrbits(); break;
      case 'math': drawMath(); break;
      case 'platonic': drawPlatonic(delta); break;
      case 'tesseract': drawTesseract(); break;
      case 'graphs':
        if (!graphFns.length) reloadGraphs();
        Scenes.drawGraphsScene(ctx, graphFns, e);
        break;
      case 'blobs': Scenes.drawBlobs(ctx, sceneBlobs, e); break;
      case 'blob_cycle': Scenes.drawBlobCycle(ctx, sceneBlobCycle, e); break;
      case 'polylines': Scenes.drawGlass(ctx, sceneGlass, e); break;
      case 'flicker': Scenes.drawFlickerGrid(ctx, sceneFlicker, e); break;
      case 'solar': drawSolar(); break;
      case 'cheese': Scenes.drawCheese(ctx, sceneCheese, e); break;
      case 'blackhole': Scenes.drawBlackHole(ctx, sceneBlackHole, e); break;
      case 'puppet': Scenes.drawPuppetWaves(ctx, e); break;
      case 'wind': Scenes.drawWind(ctx, sceneWind, e); break;
      case 'desert': Scenes.drawDesert(ctx, sceneDesert, e); break;
      case 'glacier': Scenes.drawGlacier(ctx, e); break;
      case 'sand': Scenes.drawSand(ctx, sceneSand, e); break;
      case 'balls': Scenes.drawBalls(ctx, sceneBalls, e); break;
      case 'fireworks': Scenes.drawFireworks(ctx, sceneFireworks, e); break;
      case 'hater': break; // DOM theme
      default: break;
    }
  }

  function drawStatic() {
    clear();
    if (settings.animation === 'none' || settings.animation === 'hater' || reduceMotion.matches) return;
    drawScene(16);
  }

  function stop() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
  }

  function frame(now) {
    frameId = 0;
    if (document.hidden || settings.animation === 'none' || settings.animation === 'hater' || reduceMotion.matches) return;
    if (now - lastFrame < frameInterval) {
      frameId = requestAnimationFrame(frame);
      return;
    }
    const delta = lastFrame ? Math.min(50, now - lastFrame) : frameInterval;
    lastFrame = now;
    phase += 0.012 * settings.speed * (delta / frameInterval);
    clear();
    drawScene(delta);
    frameId = requestAnimationFrame(frame);
  }

  function start() {
    stop();
    lastFrame = 0;
    clear();
    document.body.classList.toggle('theme-hater', settings.animation === 'hater');
    if (settings.animation === 'none' || settings.animation === 'hater' || document.hidden || reduceMotion.matches) return;
    frameId = requestAnimationFrame(frame);
  }

  function updateFromPreferences() {
    const prev = settings.animation;
    settings = readSettings();
    accent = parseHex(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
    refreshTheme();
    createDots(); createSolids(); initScenes();
    if (settings.animation === 'graphs' || prev === 'graphs') reloadGraphs();
    start();
  }

  resize();
  updateFromPreferences();
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('appearance:change', updateFromPreferences);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
  reduceMotion.addEventListener?.('change', start);
}
