const STORAGE_KEY = 'chat_appearance_v1';
const GRAPHS_KEY = 'chat_graph_formulas';
const DEFAULTS = { animation: 'dots', speed: 1, density: 75, opacity: 65 };
const ANIMATIONS = ['dots', 'orbits', 'math', 'platonic', 'tesseract', 'graphs', 'none'];

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
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
}

function rgba(rgb, alpha) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/** Безопасная компиляция f(x, t) для режима графиков. */
export function compileGraphExpression(source) {
  let src = String(source || '').trim();
  if (!src) throw new Error('пустое выражение');
  // y = ... или f(x) = ...
  src = src.replace(/^(y|f\s*\(\s*x\s*\))\s*=\s*/i, '');
  if (!/^[0-9a-zA-Z_+\-*/^().,\s]+$/.test(src)) {
    throw new Error('недопустимые символы');
  }
  const forbidden = /\b(window|document|Function|eval|globalThis|this|import|constructor)\b/i;
  if (forbidden.test(src)) throw new Error('запрещённый идентификатор');

  let body = src
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

  // после замен не должно остаться неизвестных идентификаторов кроме x, t, Math
  if (/[a-zA-Z_][a-zA-Z0-9_]*/.test(body.replace(/\b(Math|x|t)\b/g, ''))) {
    throw new Error('неизвестная функция или переменная');
  }

  // eslint-disable-next-line no-new-func
  const fn = new Function('x', 't', `"use strict"; return (${body});`);
  // пробный вызов
  const sample = fn(0, 0);
  if (typeof sample !== 'number') throw new Error('выражение должно возвращать число');
  return fn;
}

export function loadGraphFormulas() {
  try {
    const raw = JSON.parse(localStorage.getItem(GRAPHS_KEY) || '[]');
    if (!Array.isArray(raw)) return defaultGraphFormulas();
    const list = raw.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 12);
    return list.length ? list : defaultGraphFormulas();
  } catch {
    return defaultGraphFormulas();
  }
}

export function saveGraphFormulas(list) {
  const cleaned = (list || []).map(String).map((s) => s.trim()).filter(Boolean).slice(0, 12);
  localStorage.setItem(GRAPHS_KEY, JSON.stringify(cleaned));
  window.dispatchEvent(new CustomEvent('appearance:change'));
  return cleaned;
}

function defaultGraphFormulas() {
  return ['sin(x)', 'cos(x) * 0.6', 'sin(x) * cos(x / 2)'];
}

// --- 3D helpers ---
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

function project3(p, width, height, scale, ox, oy) {
  const z = p[2] + 4;
  const f = scale / z;
  return [ox + p[0] * f, oy + p[1] * f, z];
}

// Platonic solid templates (unit-ish)
const SOLIDS = {
  tetra: {
    verts: [
      [1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1],
    ].map((v) => {
      const n = Math.hypot(...v) || 1;
      return v.map((c) => c / n);
    }),
    edges: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]],
  },
  cube: {
    verts: [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => {
      const n = Math.hypot(x, y, z) || 1;
      return [x / n, y / n, z / n];
    }))),
    edges: (() => {
      const e = [];
      for (let i = 0; i < 8; i++) {
        for (let j = i + 1; j < 8; j++) {
          let diff = 0;
          // rebuild verts order: xyy pattern
          const bits = (a) => [(a & 4) ? 1 : -1, (a & 2) ? 1 : -1, (a & 1) ? 1 : -1];
          // use index bit Hamming
        }
      }
      // explicit cube edges by index 0..7 where index = x*4+y*2+z
      const idx = (x, y, z) => (x + 1) / 2 * 4 + (y + 1) / 2 * 2 + (z + 1) / 2;
      // Actually verts built as x,y,z nested - index = ((x+1)/2)*4 + ((y+1)/2)*2 + ((z+1)/2)
      for (let a = 0; a < 8; a++) {
        for (let b = a + 1; b < 8; b++) {
          let bits = 0;
          for (let k = 0; k < 3; k++) if (((a >> k) & 1) !== ((b >> k) & 1)) bits++;
          if (bits === 1) e.push([a, b]);
        }
      }
      return e;
    })(),
  },
  octa: {
    verts: [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
    ],
    edges: [
      [0, 2], [0, 3], [0, 4], [0, 5],
      [1, 2], [1, 3], [1, 4], [1, 5],
      [2, 4], [2, 5], [3, 4], [3, 5],
    ],
  },
};

// Fix cube verts to match bit-index edges
SOLIDS.cube.verts = Array.from({ length: 8 }, (_, i) => {
  const x = (i & 4) ? 1 : -1;
  const y = (i & 2) ? 1 : -1;
  const z = (i & 1) ? 1 : -1;
  const n = Math.hypot(x, y, z);
  return [x / n, y / n, z / n];
});

function makeTesseract() {
  const verts = [];
  for (let i = 0; i < 16; i++) {
    verts.push([
      (i & 1) ? 1 : -1,
      (i & 2) ? 1 : -1,
      (i & 4) ? 1 : -1,
      (i & 8) ? 1 : -1,
    ]);
  }
  const edges = [];
  for (let a = 0; a < 16; a++) {
    for (let b = a + 1; b < 16; b++) {
      let bits = 0;
      for (let k = 0; k < 4; k++) if (((a >> k) & 1) !== ((b >> k) & 1)) bits++;
      if (bits === 1) edges.push([a, b]);
    }
  }
  return { verts, edges };
}

const TESSERACT = makeTesseract();

function rot4(p, plane, a) {
  const c = Math.cos(a); const s = Math.sin(a);
  const out = p.slice();
  const [i, j] = plane;
  out[i] = p[i] * c - p[j] * s;
  out[j] = p[i] * s + p[j] * c;
  return out;
}

export function initBackgroundAnimation() {
  const canvas = document.getElementById('bgDots');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let settings = readSettings();
  let accent = parseHex(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  let dots = [];
  let solids = [];
  let graphFns = [];
  let phase = 0;
  let lastFrame = 0;
  let frameId = 0;
  const frameInterval = 1000 / 30;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    createDots();
    createSolids();
    drawStatic();
  }

  function createDots() {
    const count = settings.density;
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
    const types = ['tetra', 'cube', 'octa', 'tetra', 'cube'];
    const n = Math.max(3, Math.min(7, Math.round(settings.density / 25)));
    solids = Array.from({ length: n }, (_, i) => {
      const type = types[i % types.length];
      const scale = 40 + Math.random() * 50;
      return {
        type,
        x: Math.random() * width,
        y: Math.random() * height,
        z: 0,
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,
        rx: Math.random() * Math.PI * 2,
        ry: Math.random() * Math.PI * 2,
        rz: Math.random() * Math.PI * 2,
        spin: [
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02,
        ],
        scale,
        r: scale * 0.55,
      };
    });
  }

  function reloadGraphs() {
    graphFns = [];
    for (const src of loadGraphFormulas()) {
      try {
        graphFns.push({ src, fn: compileGraphExpression(src) });
      } catch (error) {
        console.warn('График пропущен:', src, error.message);
      }
    }
  }

  function clear() {
    ctx.clearRect(0, 0, width, height);
  }

  function drawDots(delta) {
    const step = delta / 16.67;
    const reach = Math.min(150, Math.max(85, Math.sqrt((width * height) / Math.max(dots.length, 1)) * 1.05));
    for (const dot of dots) {
      dot.x += dot.vx * settings.speed * step;
      dot.y += dot.vy * settings.speed * step;
      if (dot.x < -4 || dot.x > width + 4) dot.vx *= -1;
      if (dot.y < -4 || dot.y > height + 4) dot.vy *= -1;
    }

    for (let i = 0; i < dots.length; i++) {
      const a = dots[i];
      for (let j = i + 1; j < dots.length; j++) {
        const b = dots[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared >= reach * reach) continue;
        const distance = Math.sqrt(distanceSquared);
        const alpha = (1 - distance / reach) * 0.22 * settings.opacity;
        ctx.strokeStyle = rgba(accent, alpha);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    for (const dot of dots) {
      const pulse = 1 + Math.sin(phase + dot.phase) * 0.12;
      ctx.fillStyle = rgba(accent, dot.alpha * settings.opacity);
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.radius * pulse, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawOrbits() {
    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const base = Math.min(width, height) * 0.13;
    const rotation = phase * 0.18 * settings.speed;
    ctx.lineWidth = 1;
    for (let index = 0; index < 5; index++) {
      const radius = base + index * Math.min(24, base * 0.13);
      ctx.strokeStyle = rgba(accent, (0.08 + index * 0.012) * settings.opacity);
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radius * (1.35 + index * 0.035), radius * 0.55, rotation + index * 0.38, 0, Math.PI * 2);
      ctx.stroke();
      const angle = rotation * (index % 2 ? -1 : 1) + index * 1.4;
      const x = centerX + Math.cos(angle) * radius * (1.35 + index * 0.035);
      const y = centerY + Math.sin(angle) * radius * 0.55;
      ctx.fillStyle = rgba(accent, (0.45 + index * 0.06) * settings.opacity);
      ctx.beginPath();
      ctx.arc(x, y, 2.2 + (index % 2), 0, Math.PI * 2);
      ctx.fill();
    }
    const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, base * 1.5);
    glow.addColorStop(0, rgba(accent, 0.09 * settings.opacity));
    glow.addColorStop(1, rgba(accent, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(centerX, centerY, base * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMath() {
    const midY = height * 0.5;
    const amp = Math.min(height * 0.18, 120);
    const waves = [
      { freq: 0.012, phase: 0, amp: 1, alpha: 0.35 },
      { freq: 0.02, phase: 1.2, amp: 0.55, alpha: 0.22 },
      { freq: 0.007, phase: 2.4, amp: 1.35, alpha: 0.16 },
    ];
    for (const wave of waves) {
      ctx.beginPath();
      ctx.strokeStyle = rgba(accent, wave.alpha * settings.opacity);
      ctx.lineWidth = 1.4;
      for (let x = 0; x <= width; x += 3) {
        const y = midY
          + Math.sin(x * wave.freq + phase * settings.speed + wave.phase) * amp * wave.amp
          + Math.sin(x * wave.freq * 0.37 + phase * 0.6) * amp * 0.15 * wave.amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function drawPlatonic(delta) {
    const step = delta / 16.67;
    const speed = settings.speed;

    // move + bounce walls
    for (const s of solids) {
      s.x += s.vx * speed * step;
      s.y += s.vy * speed * step;
      s.rx += s.spin[0] * speed * step * 60;
      s.ry += s.spin[1] * speed * step * 60;
      s.rz += s.spin[2] * speed * step * 60;
      if (s.x < s.r) { s.x = s.r; s.vx = Math.abs(s.vx); }
      if (s.x > width - s.r) { s.x = width - s.r; s.vx = -Math.abs(s.vx); }
      if (s.y < s.r) { s.y = s.r; s.vy = Math.abs(s.vy); }
      if (s.y > height - s.r) { s.y = height - s.r; s.vy = -Math.abs(s.vy); }
    }

    // soft collisions
    for (let i = 0; i < solids.length; i++) {
      for (let j = i + 1; j < solids.length; j++) {
        const a = solids[i];
        const b = solids[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const minDist = a.r + b.r;
        if (dist >= minDist) continue;
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = (minDist - dist) / 2;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;
        // exchange normal velocity component
        const avn = a.vx * nx + a.vy * ny;
        const bvn = b.vx * nx + b.vy * ny;
        a.vx += (bvn - avn) * nx;
        a.vy += (bvn - avn) * ny;
        b.vx += (avn - bvn) * nx;
        b.vy += (avn - bvn) * ny;
      }
    }

    ctx.lineWidth = 1.2;
    for (const s of solids) {
      const mesh = SOLIDS[s.type];
      if (!mesh) continue;
      const projected = mesh.verts.map((v) => {
        let p = v.map((c) => c * s.scale * 0.02);
        p = rotX(p, s.rx);
        p = rotY(p, s.ry);
        p = rotZ(p, s.rz);
        // orthographic-ish with slight perspective
        const depth = 1 + p[2] * 0.15;
        return [s.x + p[0] * 28 / depth, s.y + p[1] * 28 / depth, p[2]];
      });

      ctx.strokeStyle = rgba(accent, 0.35 * settings.opacity);
      for (const [ia, ib] of mesh.edges) {
        const a = projected[ia];
        const b = projected[ib];
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
      // vertices
      for (const p of projected) {
        const alpha = (0.35 + (p[2] + 1) * 0.15) * settings.opacity;
        ctx.fillStyle = rgba(accent, Math.min(0.9, alpha));
        ctx.beginPath();
        ctx.arc(p[0], p[1], 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawTesseract() {
    const cx = width * 0.5;
    const cy = height * 0.5;
    const t = phase * settings.speed;
    const scale = Math.min(width, height) * 0.22;

    const projected = TESSERACT.verts.map((v) => {
      let p = v.slice();
      p = rot4(p, [0, 1], t * 0.7);
      p = rot4(p, [2, 3], t * 0.55);
      p = rot4(p, [0, 3], t * 0.35);
      p = rot4(p, [1, 2], t * 0.25);
      // 4D -> 3D perspective on w
      const w = 2.6 / (3.2 - p[3]);
      const x3 = p[0] * w;
      const y3 = p[1] * w;
      const z3 = p[2] * w;
      // 3D -> 2D
      const z = 2.4 / (3 - z3);
      return [cx + x3 * scale * z, cy + y3 * scale * z, z3];
    });

    ctx.lineWidth = 1.15;
    for (const [ia, ib] of TESSERACT.edges) {
      const a = projected[ia];
      const b = projected[ib];
      const depth = ((a[2] + b[2]) * 0.5 + 1.2) / 2.4;
      ctx.strokeStyle = rgba(accent, (0.12 + depth * 0.35) * settings.opacity);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    for (const p of projected) {
      ctx.fillStyle = rgba(accent, (0.25 + (p[2] + 1) * 0.2) * settings.opacity);
      ctx.beginPath();
      ctx.arc(p[0], p[1], 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGraphs() {
    if (!graphFns.length) reloadGraphs();
    if (!graphFns.length) return;

    const midY = height * 0.5;
    const midX = width * 0.5;
    // x from -range..range maps to width
    const xRange = Math.PI * 4;
    const yScale = Math.min(height * 0.22, 140);
    const t = phase * settings.speed;

    // axes
    ctx.strokeStyle = rgba(accent, 0.12 * settings.opacity);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.moveTo(midX, 0);
    ctx.lineTo(midX, height);
    ctx.stroke();

    const colors = graphFns.map((_, i) => {
      const hueShift = (i * 47) % 360;
      // approximate accent-tinted variants via alpha only; keep same accent
      return (0.55 - i * 0.06);
    });

    graphFns.forEach((item, index) => {
      ctx.beginPath();
      ctx.strokeStyle = rgba(accent, Math.max(0.18, colors[index]) * settings.opacity);
      ctx.lineWidth = 1.6;
      let started = false;
      const step = Math.max(2, Math.floor(width / 400));
      for (let px = 0; px <= width; px += step) {
        const x = ((px - midX) / width) * xRange * 2;
        let yVal;
        try {
          yVal = item.fn(x, t);
        } catch {
          started = false;
          continue;
        }
        if (!Number.isFinite(yVal)) {
          started = false;
          continue;
        }
        const py = midY - yVal * yScale;
        if (py < -50 || py > height + 50) {
          started = false;
          continue;
        }
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
    });
  }

  function drawStatic() {
    clear();
    if (settings.animation === 'none' || reduceMotion.matches) return;
    if (settings.animation === 'dots') drawDots(16);
    else if (settings.animation === 'orbits') drawOrbits();
    else if (settings.animation === 'math') drawMath();
    else if (settings.animation === 'platonic') drawPlatonic(16);
    else if (settings.animation === 'tesseract') drawTesseract();
    else if (settings.animation === 'graphs') drawGraphs();
  }

  function stop() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
  }

  function frame(now) {
    frameId = 0;
    if (document.hidden || settings.animation === 'none' || reduceMotion.matches) return;
    if (now - lastFrame < frameInterval) {
      frameId = requestAnimationFrame(frame);
      return;
    }
    const delta = lastFrame ? Math.min(50, now - lastFrame) : frameInterval;
    lastFrame = now;
    phase += 0.012 * settings.speed * (delta / frameInterval);
    clear();
    if (settings.animation === 'dots') drawDots(delta);
    else if (settings.animation === 'orbits') drawOrbits();
    else if (settings.animation === 'math') drawMath();
    else if (settings.animation === 'platonic') drawPlatonic(delta);
    else if (settings.animation === 'tesseract') drawTesseract();
    else if (settings.animation === 'graphs') drawGraphs();
    frameId = requestAnimationFrame(frame);
  }

  function start() {
    stop();
    lastFrame = 0;
    clear();
    if (settings.animation === 'none' || document.hidden || reduceMotion.matches) return;
    frameId = requestAnimationFrame(frame);
  }

  function updateFromPreferences() {
    const previousDensity = settings.density;
    const previousAnim = settings.animation;
    settings = readSettings();
    accent = parseHex(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
    if (previousDensity !== settings.density) {
      createDots();
      createSolids();
    }
    if (settings.animation === 'graphs' || previousAnim === 'graphs') reloadGraphs();
    if (settings.animation === 'platonic' && !solids.length) createSolids();
    start();
  }

  resize();
  reloadGraphs();
  updateFromPreferences();
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('appearance:change', updateFromPreferences);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });
  reduceMotion.addEventListener?.('change', start);
}
