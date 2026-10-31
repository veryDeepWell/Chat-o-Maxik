/** Дополнительные сцены фона — математически простые, визуально «залипательные». */

export function rgba(rgb, a) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
}

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function hsl(h, s, l, a = 1) {
  return `hsla(${h % 360}, ${s}%, ${l}%, ${a})`;
}

// ---------------------------------------------------------------------------
// Блебы: сближаются → тормозят → сливаются (курс не меняют), расходятся → делятся
// ---------------------------------------------------------------------------
export function createBlobs(width, height, density, colored) {
  const n = Math.max(8, Math.min(28, Math.round(density / 5)));
  return Array.from({ length: n }, () => ({
    x: rand(0, width),
    y: rand(0, height),
    vx: rand(-0.55, 0.55),
    vy: rand(-0.55, 0.55),
    r: rand(18, 42),
    baseR: 0,
    h: rand(0, 360),
    baseH: 0,
    merge: null, // { partner, t }
  })).map((b) => {
    b.baseR = b.r;
    b.baseH = b.h;
    return b;
  });
}

export function drawBlobs(ctx, blobs, { width, height, delta, speed, opacity, accent, colored }) {
  const step = (delta / 16.67) * speed;
  const list = blobs;

  for (const b of list) {
    // soft boundary
    if (b.x < b.r) b.vx = Math.abs(b.vx);
    if (b.x > width - b.r) b.vx = -Math.abs(b.vx);
    if (b.y < b.r) b.vy = Math.abs(b.vy);
    if (b.y > height - b.r) b.vy = -Math.abs(b.vy);
  }

  // pairwise slow-down + visual merge without changing course vectors permanently
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const touch = a.r + b.r;
      if (dist < touch * 1.35) {
        // slow when approaching
        const approach = Math.max(0, 1 - dist / (touch * 1.35));
        a.vx *= 1 - approach * 0.04 * step;
        a.vy *= 1 - approach * 0.04 * step;
        b.vx *= 1 - approach * 0.04 * step;
        b.vy *= 1 - approach * 0.04 * step;
        // color mix toward average
        if (colored) {
          const mid = (a.h + b.h) / 2;
          a.h += (mid - a.h) * 0.02 * step;
          b.h += (mid - b.h) * 0.02 * step;
        }
      } else if (colored) {
        a.h += (a.baseH - a.h) * 0.01 * step;
        b.h += (b.baseH - b.h) * 0.01 * step;
      }
    }
  }

  for (const b of list) {
    b.x += b.vx * step * 2.2;
    b.y += b.vy * step * 2.2;
    // metaball-ish soft circle
    const g = ctx.createRadialGradient(b.x, b.y, b.r * 0.15, b.x, b.y, b.r);
    if (colored) {
      g.addColorStop(0, hsl(b.h, 70, 62, 0.55 * opacity));
      g.addColorStop(1, hsl(b.h, 70, 40, 0));
    } else {
      g.addColorStop(0, rgba(accent, 0.4 * opacity));
      g.addColorStop(1, rgba(accent, 0));
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Цикл: большая блеба → взрыв → сбор обратно
// ---------------------------------------------------------------------------
export function createBlobCycle(width, height) {
  return {
    phase: 'wait', // wait | explode | gather
    timer: 0,
    center: { x: width / 2, y: height / 2, r: 70 },
    bits: [],
  };
}

export function drawBlobCycle(ctx, state, { width, height, delta, speed, opacity, accent }) {
  const step = (delta / 16.67) * speed;
  state.timer += step;

  const wallPad = Math.min(width, height) * 0.1; // 10% «за границей» не улетают дальше

  if (state.phase === 'wait') {
    // growing center
    const pulse = 60 + Math.sin(state.timer * 0.08) * 8;
    state.center.r = pulse;
    const g = ctx.createRadialGradient(state.center.x, state.center.y, 0, state.center.x, state.center.y, pulse);
    g.addColorStop(0, rgba(accent, 0.7 * opacity));
    g.addColorStop(1, rgba(accent, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(state.center.x, state.center.y, pulse, 0, Math.PI * 2);
    ctx.fill();
    if (state.timer > 50) {
      state.phase = 'explode';
      state.timer = 0;
      const n = 18;
      state.bits = Array.from({ length: n }, (_, i) => {
        const ang = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
        const sp = rand(2.5, 5.5);
        return {
          x: state.center.x,
          y: state.center.y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          r: rand(8, 22),
          h: rand(0, 360),
        };
      });
    }
    return;
  }

  if (state.phase === 'explode') {
    for (const b of state.bits) {
      b.x += b.vx * step;
      b.y += b.vy * step;
      b.vx *= 0.985;
      b.vy *= 0.985;
      // wall at 10% outside screen damps inertia
      const minX = -wallPad;
      const maxX = width + wallPad;
      const minY = -wallPad;
      const maxY = height + wallPad;
      if (b.x < minX) { b.x = minX; b.vx *= -0.2; }
      if (b.x > maxX) { b.x = maxX; b.vx *= -0.2; }
      if (b.y < minY) { b.y = minY; b.vy *= -0.2; }
      if (b.y > maxY) { b.y = maxY; b.vy *= -0.2; }

      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, hsl(b.h, 75, 60, 0.65 * opacity));
      g.addColorStop(1, hsl(b.h, 75, 40, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (state.timer > 40) {
      state.phase = 'gather';
      state.timer = 0;
    }
    return;
  }

  // gather: crawl to center, speed ~ 1/r
  let allIn = true;
  for (const b of state.bits) {
    const dx = state.center.x - b.x;
    const dy = state.center.y - b.y;
    const dist = Math.hypot(dx, dy) || 1;
    const v = (2.8 / Math.max(6, b.r)) * step * 3;
    b.x += (dx / dist) * v * 18;
    b.y += (dy / dist) * v * 18;
    if (dist > b.r) allIn = false;

    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    g.addColorStop(0, hsl(b.h, 75, 60, 0.6 * opacity));
    g.addColorStop(1, hsl(b.h, 75, 40, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (allIn && state.timer > 25) {
    state.phase = 'wait';
    state.timer = 0;
    state.bits = [];
  }
}

// ---------------------------------------------------------------------------
// Ломаные фигуры, меняющие форму; в пересечениях — смена цвета
// ---------------------------------------------------------------------------
export function createPolylines(width, height) {
  const n = 5;
  return Array.from({ length: n }, (_, i) => ({
    h: (i * 67) % 360,
    pts: Array.from({ length: 6 }, () => ({
      x: rand(width * 0.1, width * 0.9),
      y: rand(height * 0.1, height * 0.9),
      tx: rand(width * 0.1, width * 0.9),
      ty: rand(height * 0.1, height * 0.9),
    })),
  }));
}

export function drawPolylines(ctx, lines, { width, height, delta, speed, opacity }) {
  const step = (delta / 16.67) * speed;
  for (const line of lines) {
    for (const p of line.pts) {
      p.x += (p.tx - p.x) * 0.02 * step;
      p.y += (p.ty - p.y) * 0.02 * step;
      if (Math.hypot(p.tx - p.x, p.ty - p.y) < 4) {
        p.tx = rand(width * 0.08, width * 0.92);
        p.ty = rand(height * 0.08, height * 0.92);
      }
    }
    ctx.strokeStyle = hsl(line.h, 70, 60, 0.45 * opacity);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    line.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
  }
  // crude intersection tint: draw soft blobs at midpoints between close segments
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i];
      const b = lines[j];
      for (let ia = 0; ia < a.pts.length; ia++) {
        for (let ib = 0; ib < b.pts.length; ib++) {
          const p = a.pts[ia];
          const q = b.pts[ib];
          if (Math.hypot(p.x - q.x, p.y - q.y) < 28) {
            const mx = (p.x + q.x) / 2;
            const my = (p.y + q.y) / 2;
            const mh = (a.h + b.h) / 2;
            ctx.fillStyle = hsl(mh, 80, 65, 0.2 * opacity);
            ctx.beginPath();
            ctx.arc(mx, my, 10, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Точки с лёгкой флуктуацией
// ---------------------------------------------------------------------------
export function createFlicker(width, height, density) {
  const n = Math.max(40, Math.min(220, density * 2));
  return Array.from({ length: n }, () => ({
    x: rand(0, width),
    y: rand(0, height),
    baseX: 0,
    baseY: 0,
    phase: rand(0, Math.PI * 2),
    r: rand(0.8, 2.2),
  })).map((p) => {
    p.baseX = p.x;
    p.baseY = p.y;
    return p;
  });
}

export function drawFlicker(ctx, pts, { delta, speed, opacity, accent, phase }) {
  const step = phase * speed;
  for (const p of pts) {
    const fx = Math.sin(step * 1.3 + p.phase) * 2.5 + Math.sin(step * 0.4 + p.phase * 2) * 1.2;
    const fy = Math.cos(step * 1.1 + p.phase) * 2.5 + Math.cos(step * 0.35 + p.phase * 1.7) * 1.2;
    ctx.fillStyle = rgba(accent, (0.25 + Math.sin(step + p.phase) * 0.15) * opacity);
    ctx.beginPath();
    ctx.arc(p.baseX + fx, p.baseY + fy, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Солнечная система (упрощённо-точные отношения периодов + Плутон)
// ---------------------------------------------------------------------------
const PLANETS = [
  // a — относительный радиус орбиты, period — годы, size — визуальный радиус, label
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

export function drawSolarSystem(ctx, { width, height, phase, speed, opacity }) {
  const cx = width / 2;
  const cy = height / 2;
  const maxA = 39.5;
  const scale = Math.min(width, height) * 0.45 / maxA;
  const t = phase * speed * 0.15;

  // sun
  const sunR = 10;
  const sunG = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunR * 3);
  sunG.addColorStop(0, `rgba(255, 220, 100, ${0.95 * opacity})`);
  sunG.addColorStop(1, `rgba(255, 160, 40, 0)`);
  ctx.fillStyle = sunG;
  ctx.beginPath();
  ctx.arc(cx, cy, sunR * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255, 210, 80, ${opacity})`;
  ctx.beginPath();
  ctx.arc(cx, cy, sunR, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "italic 11px 'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif";
  ctx.textAlign = 'left';

  for (const p of PLANETS) {
    // orbit
    ctx.strokeStyle = `rgba(255,255,255,${0.08 * opacity})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, p.a * scale, 0, Math.PI * 2);
    ctx.stroke();

    const angle = t * (1 / p.period) * Math.PI * 2;
    // Pluto: slight inclination fake via y scale
    const incl = p.name === 'Pluto' ? 0.92 : 1;
    const x = cx + Math.cos(angle) * p.a * scale;
    const y = cy + Math.sin(angle) * p.a * scale * incl;

    if (p.ring) {
      ctx.strokeStyle = `rgba(240, 213, 154, ${0.35 * opacity})`;
      ctx.beginPath();
      ctx.ellipse(x, y, p.size * 1.8, p.size * 0.55, angle, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = p.color;
    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.arc(x, y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = `rgba(240, 230, 255, ${0.75 * opacity})`;
    ctx.fillText(p.name, x + p.size + 4, y - 2);
  }

  // Sun label
  ctx.fillStyle = `rgba(255, 230, 160, ${0.8 * opacity})`;
  ctx.fillText('Sun', cx + sunR + 6, cy - 4);
}

// ---------------------------------------------------------------------------
// Сыр-скринсейвер
// ---------------------------------------------------------------------------
export function createCheese(width, height) {
  return {
    x: width * 0.3,
    y: height * 0.4,
    vx: 1.6,
    vy: 1.1,
    rot: 0,
    spin: 0.03,
    size: 48,
  };
}

export function drawCheese(ctx, cheese, { width, height, delta, speed, opacity }) {
  const step = (delta / 16.67) * speed;
  cheese.x += cheese.vx * step * 2;
  cheese.y += cheese.vy * step * 2;
  cheese.rot += cheese.spin * step * 2;
  if (cheese.x < cheese.size || cheese.x > width - cheese.size) cheese.vx *= -1;
  if (cheese.y < cheese.size || cheese.y > height - cheese.size) cheese.vy *= -1;

  ctx.save();
  ctx.translate(cheese.x, cheese.y);
  ctx.rotate(cheese.rot);
  ctx.globalAlpha = 0.9 * opacity;
  // wedge
  ctx.fillStyle = '#f4c430';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, cheese.size, -0.4, 1.1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8b010';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, cheese.size * 0.92, -0.4, 1.1);
  ctx.closePath();
  ctx.fill();
  // holes
  ctx.fillStyle = '#d4a017';
  [[20, 10, 5], [28, -5, 4], [15, 22, 3.5]].forEach(([hx, hy, hr]) => {
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Чёрная дыра сверху
// ---------------------------------------------------------------------------
export function drawBlackHole(ctx, { width, height, phase, speed, opacity, accent }) {
  const cx = width / 2;
  const cy = height / 2;
  const t = phase * speed;
  const maxR = Math.min(width, height) * 0.42;

  for (let i = 28; i >= 1; i--) {
    const r = (i / 28) * maxR;
    const twist = t * (0.4 + (28 - i) * 0.03);
    ctx.strokeStyle = rgba(accent, (0.04 + (i / 28) * 0.12) * opacity);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2; a += 0.08) {
      const rr = r * (1 + Math.sin(a * 3 + twist) * 0.03);
      const x = cx + Math.cos(a + twist * 0.3) * rr;
      const y = cy + Math.sin(a + twist * 0.3) * rr * 0.92;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  // event horizon
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.18);
  g.addColorStop(0, `rgba(0,0,0,${0.95 * opacity})`);
  g.addColorStop(0.7, `rgba(0,0,0,${0.7 * opacity})`);
  g.addColorStop(1, rgba(accent, 0.15 * opacity));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, maxR * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Кукольные волны (слои)
// ---------------------------------------------------------------------------
export function drawPuppetWaves(ctx, { width, height, phase, speed, opacity, accent }) {
  const layers = 6;
  for (let i = 0; i < layers; i++) {
    const yBase = height * (0.35 + i * 0.1);
    const amp = 12 + i * 4;
    const t = phase * speed * (0.6 + i * 0.08) + i;
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, yBase);
    for (let x = 0; x <= width; x += 8) {
      const y = yBase + Math.sin(x * 0.012 + t) * amp + Math.sin(x * 0.03 + t * 1.3) * amp * 0.25;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = rgba(accent, (0.05 + i * 0.03) * opacity);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Ветер / потоки
// ---------------------------------------------------------------------------
export function createWind(width, height, density) {
  const n = Math.max(30, Math.min(120, density));
  return Array.from({ length: n }, () => ({
    x: rand(0, width),
    y: rand(0, height),
    len: rand(20, 60),
    phase: rand(0, Math.PI * 2),
    speed: rand(0.8, 2.2),
  }));
}

export function drawWind(ctx, streams, { width, height, delta, speed, opacity, accent, phase }) {
  const step = (delta / 16.67) * speed;
  for (const s of streams) {
    s.x += s.speed * step * 3.5;
    s.y += Math.sin(phase * 2 + s.phase) * 0.4 * step;
    if (s.x > width + 40) {
      s.x = -40;
      s.y = rand(0, height);
    }
    ctx.strokeStyle = rgba(accent, 0.2 * opacity);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.bezierCurveTo(
      s.x + s.len * 0.3,
      s.y + Math.sin(phase + s.phase) * 8,
      s.x + s.len * 0.6,
      s.y + Math.cos(phase + s.phase) * 8,
      s.x + s.len,
      s.y
    );
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Пустыня
// ---------------------------------------------------------------------------
export function drawDesert(ctx, { width, height, phase, speed, opacity }) {
  const t = phase * speed * 0.5;
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, `rgba(25, 20, 40, ${0.5 * opacity})`);
  sky.addColorStop(1, `rgba(60, 40, 20, ${0.35 * opacity})`);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  for (let layer = 0; layer < 4; layer++) {
    const base = height * (0.45 + layer * 0.12);
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, base);
    for (let x = 0; x <= width; x += 10) {
      const y = base
        + Math.sin(x * 0.008 + t + layer) * (18 + layer * 6)
        + Math.sin(x * 0.02 + t * 1.5) * 6;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = `rgba(${180 - layer * 20}, ${140 - layer * 15}, ${70 - layer * 8}, ${(0.15 + layer * 0.08) * opacity})`;
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Ледник
// ---------------------------------------------------------------------------
export function drawGlacier(ctx, { width, height, phase, speed, opacity, accent }) {
  const waterLine = height * 0.55;
  // water
  ctx.fillStyle = `rgba(30, 60, 90, ${0.35 * opacity})`;
  ctx.fillRect(0, waterLine, width, height - waterLine);
  // ripples
  ctx.strokeStyle = rgba(accent, 0.12 * opacity);
  for (let i = 0; i < 5; i++) {
    const y = waterLine + 10 + i * 18 + Math.sin(phase * speed + i) * 3;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 12) {
      const yy = y + Math.sin(x * 0.03 + phase * speed * 2 + i) * 2;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // iceberg body
  const cx = width * 0.5;
  ctx.fillStyle = `rgba(200, 230, 255, ${0.45 * opacity})`;
  ctx.beginPath();
  ctx.moveTo(cx - 120, waterLine + 40);
  ctx.lineTo(cx - 90, waterLine - 80);
  ctx.lineTo(cx - 20, waterLine - 110);
  ctx.lineTo(cx + 40, waterLine - 70);
  ctx.lineTo(cx + 110, waterLine - 50);
  ctx.lineTo(cx + 130, waterLine + 50);
  ctx.closePath();
  ctx.fill();
  // underwater tint
  ctx.fillStyle = `rgba(100, 160, 200, ${0.25 * opacity})`;
  ctx.beginPath();
  ctx.moveTo(cx - 120, waterLine);
  ctx.lineTo(cx - 100, waterLine + 90);
  ctx.lineTo(cx + 100, waterLine + 100);
  ctx.lineTo(cx + 130, waterLine);
  ctx.closePath();
  ctx.fill();
  // floating ice chunks
  for (let i = 0; i < 6; i++) {
    const x = ((i * 97 + phase * speed * 8) % (width + 40)) - 20;
    const y = waterLine + 8 + Math.sin(phase + i) * 4;
    ctx.fillStyle = `rgba(220, 240, 255, ${0.4 * opacity})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 18, y - 6);
    ctx.lineTo(x + 32, y + 2);
    ctx.lineTo(x + 12, y + 8);
    ctx.closePath();
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Цветной песок сверху
// ---------------------------------------------------------------------------
export function createSand(width, height, density) {
  const n = Math.max(50, Math.min(250, density * 2));
  return Array.from({ length: n }, () => ({
    x: rand(0, width),
    y: rand(-height, height),
    vy: rand(1.2, 3.2),
    r: rand(1, 2.5),
    h: rand(0, 360),
  }));
}

export function drawSand(ctx, grains, { width, height, delta, speed, opacity }) {
  const step = (delta / 16.67) * speed;
  for (const g of grains) {
    g.y += g.vy * step * 2.5;
    g.x += Math.sin(g.y * 0.02) * 0.3;
    if (g.y > height + 5) {
      g.y = -5;
      g.x = rand(0, width);
      g.h = rand(0, 360);
    }
    ctx.fillStyle = hsl(g.h, 70, 55, 0.55 * opacity);
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Мячики
// ---------------------------------------------------------------------------
export function createBalls(width, height, density) {
  const n = Math.max(6, Math.min(20, Math.round(density / 8)));
  return Array.from({ length: n }, () => ({
    x: rand(30, width - 30),
    y: rand(30, height - 30),
    vx: rand(-2.5, 2.5),
    vy: rand(-2.5, 2.5),
    r: rand(10, 22),
    h: rand(0, 360),
  }));
}

export function drawBalls(ctx, balls, { width, height, delta, speed, opacity }) {
  const step = (delta / 16.67) * speed;
  for (const b of balls) {
    b.x += b.vx * step * 2;
    b.y += b.vy * step * 2;
    if (b.x < b.r || b.x > width - b.r) b.vx *= -1;
    if (b.y < b.r || b.y > height - b.r) b.vy *= -1;
    const g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, 0, b.x, b.y, b.r);
    g.addColorStop(0, hsl(b.h, 80, 70, 0.85 * opacity));
    g.addColorStop(1, hsl(b.h, 80, 40, 0.5 * opacity));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Фейерверки
// ---------------------------------------------------------------------------
export function createFireworks() {
  return { rockets: [], sparks: [], timer: 0 };
}

export function drawFireworks(ctx, fw, { width, height, delta, speed, opacity }) {
  const step = (delta / 16.67) * speed;
  fw.timer += step;
  if (fw.timer > 25) {
    fw.timer = 0;
    fw.rockets.push({
      x: rand(width * 0.15, width * 0.85),
      y: height + 10,
      vy: rand(-7, -4.5),
      h: rand(0, 360),
      exploded: false,
    });
  }
  for (const r of fw.rockets) {
    if (r.exploded) continue;
    r.y += r.vy * step;
    r.vy += 0.06 * step;
    ctx.fillStyle = hsl(r.h, 90, 60, opacity);
    ctx.beginPath();
    ctx.arc(r.x, r.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    if (r.vy >= -0.5 || r.y < height * 0.25) {
      r.exploded = true;
      for (let i = 0; i < 36; i++) {
        const ang = (i / 36) * Math.PI * 2;
        const sp = rand(1.5, 4);
        fw.sparks.push({
          x: r.x,
          y: r.y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          life: 1,
          h: r.h + rand(-20, 20),
        });
      }
    }
  }
  fw.rockets = fw.rockets.filter((r) => !r.exploded);
  for (const s of fw.sparks) {
    s.x += s.vx * step * 2;
    s.y += s.vy * step * 2;
    s.vy += 0.05 * step;
    s.life -= 0.012 * step;
    if (s.life <= 0) continue;
    ctx.fillStyle = hsl(s.h, 90, 60, s.life * opacity);
    ctx.beginPath();
    ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  fw.sparks = fw.sparks.filter((s) => s.life > 0);
}
