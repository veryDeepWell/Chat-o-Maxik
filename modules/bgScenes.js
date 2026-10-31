/** Сцены фона с персональными параметрами темы. */

export function rgba(rgb, a) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
}
function rand(a, b) { return a + Math.random() * (b - a); }
function hsl(h, s, l, a = 1) { return `hsla(${((h % 360) + 360) % 360}, ${s}%, ${l}%, ${a})`; }

// ---- Blobs (metaball-ish clear edges, merge when close) ----
export function createBlobs(w, h, p) {
  const n = Math.max(4, Math.min(40, Math.round(p.count || 14)));
  const size = p.size || 1;
  return Array.from({ length: n }, () => ({
    x: rand(0, w), y: rand(0, h),
    vx: rand(-0.45, 0.45), vy: rand(-0.45, 0.45),
    r: rand(16, 34) * size,
    h: rand(0, 360), baseH: 0,
  })).map((b) => { b.baseH = b.h; return b; });
}

export function drawBlobs(ctx, blobs, env) {
  const { width, height, delta, speed, opacity, accent, params } = env;
  const colored = Boolean(params.colored);
  const merge = params.mergeStrength ?? 1;
  const step = (delta / 16.67) * speed;

  for (const b of blobs) {
    b.x += b.vx * step * 2;
    b.y += b.vy * step * 2;
    if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
    if (b.x > width - b.r) { b.x = width - b.r; b.vx = -Math.abs(b.vx); }
    if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); }
    if (b.y > height - b.r) { b.y = height - b.r; b.vy = -Math.abs(b.vy); }
  }

  for (let i = 0; i < blobs.length; i++) {
    for (let j = i + 1; j < blobs.length; j++) {
      const a = blobs[i]; const b = blobs[j];
      const dx = b.x - a.x; const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const touch = a.r + b.r;
      if (dist < touch * 1.4) {
        const approach = 1 - dist / (touch * 1.4);
        a.vx *= 1 - approach * 0.03 * step * merge;
        a.vy *= 1 - approach * 0.03 * step * merge;
        b.vx *= 1 - approach * 0.03 * step * merge;
        b.vy *= 1 - approach * 0.03 * step * merge;
        if (colored) {
          const mid = (a.h + b.h) / 2;
          a.h += (mid - a.h) * 0.03 * step;
          b.h += (mid - b.h) * 0.03 * step;
        }
      } else if (colored) {
        a.h += (a.baseH - a.h) * 0.012 * step;
        b.h += (b.baseH - b.h) * 0.012 * step;
      }
    }
  }

  // offscreen buffer for threshold metaballs
  if (!env._blobCanvas) {
    env._blobCanvas = document.createElement('canvas');
    env._blobCtx = env._blobCanvas.getContext('2d', { willReadFrequently: true });
  }
  const bc = env._blobCanvas;
  const bctx = env._blobCtx;
  const scale = Math.min(1, 500 / Math.max(width, height));
  const bw = Math.max(1, Math.floor(width * scale));
  const bh = Math.max(1, Math.floor(height * scale));
  if (bc.width !== bw || bc.height !== bh) { bc.width = bw; bc.height = bh; }
  bctx.clearRect(0, 0, bw, bh);
  bctx.globalCompositeOperation = 'source-over';
  for (const b of blobs) {
    const x = b.x * scale; const y = b.y * scale; const r = b.r * scale * 1.15;
    const g = bctx.createRadialGradient(x, y, 0, x, y, r);
    if (colored) {
      g.addColorStop(0, hsl(b.h, 72, 58, 1));
      g.addColorStop(1, hsl(b.h, 72, 58, 0));
    } else {
      g.addColorStop(0, rgba(accent, 1));
      g.addColorStop(1, rgba(accent, 0));
    }
    bctx.fillStyle = g;
    bctx.beginPath();
    bctx.arc(x, y, r, 0, Math.PI * 2);
    bctx.fill();
  }
  // threshold for hard edge merge
  try {
    const img = bctx.getImageData(0, 0, bw, bh);
    const d = img.data;
    const thr = 90;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      if (a > thr) {
        d[i + 3] = Math.min(255, Math.floor(220 * opacity));
      } else {
        d[i + 3] = 0;
      }
    }
    bctx.putImageData(img, 0, 0);
  } catch (_) {
    // tainted / restricted — soft fallback already drawn
  }
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.drawImage(bc, 0, 0, width, height);
  ctx.restore();
}

// ---- Blob cycle: strong explode, no merge at center ----
export function createBlobCycle(w, h, p) {
  return {
    phase: 'wait', timer: 0,
    center: { x: w / 2, y: h / 2 },
    bits: [],
    p,
  };
}

export function drawBlobCycle(ctx, state, env) {
  const { width, height, delta, speed, opacity, accent, params } = env;
  const step = (delta / 16.67) * speed;
  state.timer += step;
  const force = params.explodeForce ?? 1.8;
  const nBits = Math.max(8, Math.min(40, Math.round(params.bits || 18)));
  const wallPad = Math.min(width, height) * 0.1;

  if (state.phase === 'wait') {
    const pulse = 55 + Math.sin(state.timer * 0.1) * 6;
    const g = ctx.createRadialGradient(state.center.x, state.center.y, 0, state.center.x, state.center.y, pulse);
    g.addColorStop(0, rgba(accent, 0.75 * opacity));
    g.addColorStop(1, rgba(accent, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(state.center.x, state.center.y, pulse, 0, Math.PI * 2);
    ctx.fill();
    // hard edge ring
    ctx.strokeStyle = rgba(accent, 0.55 * opacity);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(state.center.x, state.center.y, pulse * 0.85, 0, Math.PI * 2);
    ctx.stroke();
    if (state.timer > 35) {
      state.phase = 'explode';
      state.timer = 0;
      state.bits = Array.from({ length: nBits }, (_, i) => {
        const ang = (i / nBits) * Math.PI * 2 + rand(-0.15, 0.15);
        const sp = rand(3.5, 7.5) * force;
        return {
          x: state.center.x, y: state.center.y,
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          r: rand(10, 24), h: rand(0, 360),
        };
      });
    }
    return;
  }

  if (state.phase === 'explode') {
    for (const b of state.bits) {
      b.x += b.vx * step;
      b.y += b.vy * step;
      b.vx *= 0.992;
      b.vy *= 0.992;
      const minX = -wallPad, maxX = width + wallPad, minY = -wallPad, maxY = height + wallPad;
      if (b.x < minX) { b.x = minX; b.vx *= -0.15; }
      if (b.x > maxX) { b.x = maxX; b.vx *= -0.15; }
      if (b.y < minY) { b.y = minY; b.vy *= -0.15; }
      if (b.y > maxY) { b.y = maxY; b.vy *= -0.15; }
      ctx.fillStyle = hsl(b.h, 75, 55, 0.7 * opacity);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hsl(b.h, 75, 35, 0.5 * opacity);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (state.timer > 55) { state.phase = 'gather'; state.timer = 0; }
    return;
  }

  // gather: move to center but stay as separate blobs (no merge)
  let near = 0;
  const gather = params.gatherSpeed ?? 1;
  for (const b of state.bits) {
    const dx = state.center.x - b.x;
    const dy = state.center.y - b.y;
    const dist = Math.hypot(dx, dy) || 1;
    const v = (3.2 / Math.max(8, b.r)) * gather;
    b.x += (dx / dist) * v * step * 20;
    b.y += (dy / dist) * v * step * 20;
    // soft separation so they don't stack into one
    for (const o of state.bits) {
      if (o === b) continue;
      const ox = b.x - o.x; const oy = b.y - o.y;
      const od = Math.hypot(ox, oy) || 0.001;
      const min = (b.r + o.r) * 0.85;
      if (od < min) {
        b.x += (ox / od) * (min - od) * 0.5;
        b.y += (oy / od) * (min - od) * 0.5;
      }
    }
    if (dist < 80) near++;
    ctx.fillStyle = hsl(b.h, 75, 55, 0.65 * opacity);
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hsl(b.h, 75, 35, 0.45 * opacity);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  if (near >= state.bits.length * 0.85 && state.timer > 40) {
    state.phase = 'wait';
    state.timer = 0;
    state.bits = [];
  }
}

// ---- Stained glass ----
export function createGlass(w, h, p) {
  const n = Math.max(6, Math.min(40, Math.round(p.pieces || 14)));
  const size = p.size || 0.85;
  return Array.from({ length: n }, () => {
    const cx = rand(w * 0.1, w * 0.9);
    const cy = rand(h * 0.1, h * 0.9);
    const s = rand(28, 55) * size;
    const verts = 3 + Math.floor(rand(0, 3));
    return {
      cx, cy,
      vx: rand(-0.25, 0.25), vy: rand(-0.25, 0.25),
      rot: rand(0, Math.PI * 2),
      spin: rand(-0.008, 0.008),
      h: rand(0, 360),
      pts: Array.from({ length: verts }, (_, i) => {
        const a = (i / verts) * Math.PI * 2 + rand(-0.2, 0.2);
        const r = s * rand(0.55, 1);
        return { a, r };
      }),
    };
  });
}

export function drawGlass(ctx, pieces, env) {
  const { width, height, delta, speed, opacity, params } = env;
  const step = (delta / 16.67) * speed;
  const alpha = (params.alpha ?? 0.45) * opacity;

  // draw to buffer with lighter composition for glass overlap
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const g of pieces) {
    g.cx += g.vx * step * 1.5;
    g.cy += g.vy * step * 1.5;
    g.rot += g.spin * step * 40;
    if (g.cx < 0 || g.cx > width) g.vx *= -1;
    if (g.cy < 0 || g.cy > height) g.vy *= -1;
    ctx.beginPath();
    g.pts.forEach((p, i) => {
      const x = g.cx + Math.cos(p.a + g.rot) * p.r;
      const y = g.cy + Math.sin(p.a + g.rot) * p.r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = hsl(g.h, 70, 55, alpha);
    ctx.fill();
    ctx.strokeStyle = hsl(g.h, 50, 30, alpha * 0.8);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

// ---- Scale grid flicker with ripple ----
export function createFlickerGrid(w, h, p) {
  const cols = Math.max(6, Math.min(28, Math.round(p.cols || 14)));
  const rows = Math.max(5, Math.min(22, Math.round(p.rows || 10)));
  const pts = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      pts.push({
        ix: x, iy: y,
        phase: rand(0, Math.PI * 2),
        kick: 0,
      });
    }
  }
  return { cols, rows, pts, kickTimer: 0 };
}

export function drawFlickerGrid(ctx, grid, env) {
  const { width, height, delta, speed, opacity, accent, phase, params } = env;
  const step = (delta / 16.67) * speed;
  const cols = grid.cols; const rows = grid.rows;
  const padX = width * 0.06; const padY = height * 0.08;
  const cellW = (width - padX * 2) / Math.max(1, cols - 1);
  const cellH = (height - padY * 2) / Math.max(1, rows - 1);
  const ripple = params.ripple ?? 1;
  const linkA = (params.linkAlpha ?? 0.2) * opacity;

  grid.kickTimer += step;
  if (grid.kickTimer > 40 + Math.random() * 50) {
    grid.kickTimer = 0;
    const victim = grid.pts[Math.floor(Math.random() * grid.pts.length)];
    victim.kick = 1;
  }

  // propagate kick as ripple
  for (const p of grid.pts) {
    if (p.kick > 0.01) {
      for (const o of grid.pts) {
        if (o === p) continue;
        const d = Math.hypot(o.ix - p.ix, o.iy - p.iy);
        if (d > 0 && d < 3.5) {
          o.kick = Math.max(o.kick, p.kick * (1 - d / 3.5) * 0.92);
        }
      }
      p.kick *= 0.92;
    }
  }

  const pos = grid.pts.map((p) => {
    const baseX = padX + p.ix * cellW;
    const baseY = padY + p.iy * cellH;
    const fl = Math.sin(phase * 2 + p.phase) * 1.2;
    const kx = Math.sin(p.kick * Math.PI) * 6 * ripple;
    const ky = Math.cos(p.kick * Math.PI * 1.3) * 6 * ripple;
    return { x: baseX + fl + kx, y: baseY + fl * 0.7 + ky, p };
  });

  ctx.strokeStyle = rgba(accent, linkA);
  ctx.lineWidth = 1;
  for (const a of pos) {
    for (const b of pos) {
      if (b.p.ix === a.p.ix + 1 && b.p.iy === a.p.iy) {
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      if (b.p.iy === a.p.iy + 1 && b.p.ix === a.p.ix) {
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
  }

  for (const a of pos) {
    const r = 2.2 + a.p.kick * 2;
    ctx.fillStyle = rgba(accent, (0.35 + a.p.kick * 0.4) * opacity);
    ctx.beginPath();
    ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---- Graphs with grid + crawling labels ----
export function drawGraphsScene(ctx, graphFns, env) {
  const { width, height, phase, speed, opacity, accent, params } = env;
  const midY = height * 0.5;
  const midX = width * 0.5;
  const xRange = params.xRange || Math.PI * 4;
  const yScale = Math.min(height * 0.22, 140) * (params.yScale || 1);
  const t = phase * speed;

  if (params.showGrid !== false) {
    ctx.strokeStyle = rgba(accent, 0.08 * opacity);
    ctx.lineWidth = 1;
    const stepX = width / 16;
    const stepY = height / 12;
    for (let x = 0; x <= width; x += stepX) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y <= height; y += stepY) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    ctx.strokeStyle = rgba(accent, 0.2 * opacity);
    ctx.beginPath();
    ctx.moveTo(0, midY); ctx.lineTo(width, midY);
    ctx.moveTo(midX, 0); ctx.lineTo(midX, height);
    ctx.stroke();
  }

  graphFns.forEach((item, index) => {
    ctx.beginPath();
    ctx.strokeStyle = rgba(accent, (0.55 - index * 0.08) * opacity);
    ctx.lineWidth = 1.7;
    let started = false;
    const step = Math.max(2, Math.floor(width / 420));
    for (let px = 0; px <= width; px += step) {
      const x = ((px - midX) / width) * xRange * 2;
      let yVal;
      try { yVal = item.fn(x, t); } catch { started = false; continue; }
      if (!Number.isFinite(yVal)) { started = false; continue; }
      const py = midY - yVal * yScale;
      if (py < -80 || py > height + 80) { started = false; continue; }
      if (!started) { ctx.moveTo(px, py); started = true; }
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    if (params.crawlLabels !== false) {
      const crawl = ((t * 12 + index * 90) % (width + 160)) - 80;
      ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      ctx.fillStyle = rgba(accent, 0.45 * opacity);
      ctx.fillText(item.src, crawl, 28 + index * 18);
    }
  });
}

// ---- Cheese no spin, smaller arc ----
export function createCheese(w, h) {
  return { x: w * 0.3, y: h * 0.4, vx: 1.4, vy: 1.0, size: 48 };
}
export function drawCheese(ctx, cheese, env) {
  const { width, height, delta, speed, opacity, params } = env;
  const step = (delta / 16.67) * speed * (params.speed || 1);
  const size = cheese.size * (params.size || 1) * 0.75; // 25% smaller arc overall
  cheese.x += cheese.vx * step * 2;
  cheese.y += cheese.vy * step * 2;
  if (cheese.x < size || cheese.x > width - size) cheese.vx *= -1;
  if (cheese.y < size || cheese.y > height - size) cheese.vy *= -1;
  // no rotation
  ctx.save();
  ctx.translate(cheese.x, cheese.y);
  ctx.globalAlpha = 0.92 * opacity;
  const start = -0.35;
  const end = start + (1.5 * 0.75); // 25% smaller arc span
  ctx.fillStyle = '#f4c430';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, size, start, end);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8b010';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, size * 0.92, start, end);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d4a017';
  [[18, 8, 4], [24, -2, 3.5], [12, 16, 3]].forEach(([hx, hy, hr]) => {
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();
}

// ---- Black hole particles ----
export function createBlackHole(w, h, p) {
  const n = Math.max(40, Math.min(400, Math.round(p.particles || 160)));
  return Array.from({ length: n }, () => {
    const ang = rand(0, Math.PI * 2);
    const r = rand(40, Math.min(w, h) * 0.48);
    return { ang, r, spin: rand(0.004, 0.02), size: rand(0.8, 2.2) };
  });
}

export function drawBlackHole(ctx, parts, env) {
  const { width, height, delta, speed, opacity, accent, params } = env;
  const cx = width / 2; const cy = height / 2;
  const pull = params.pull ?? 1;
  const disc = params.disc ?? 1;
  const step = (delta / 16.67) * speed;
  const horizon = Math.min(width, height) * 0.06;

  // accretion disc glow
  const g = ctx.createRadialGradient(cx, cy, horizon, cx, cy, Math.min(width, height) * 0.35 * disc);
  g.addColorStop(0, rgba(accent, 0.2 * opacity));
  g.addColorStop(0.5, rgba(accent, 0.05 * opacity));
  g.addColorStop(1, rgba(accent, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(width, height) * 0.35 * disc, 0, Math.PI * 2);
  ctx.fill();

  for (const p of parts) {
    p.ang += p.spin * step * 8 * (1 + (200 / (p.r + 10)));
    p.r -= (0.35 + (30 / (p.r + 5))) * pull * step;
    if (p.r < horizon * 1.1) {
      p.r = rand(Math.min(width, height) * 0.25, Math.min(width, height) * 0.48);
      p.ang = rand(0, Math.PI * 2);
    }
    const x = cx + Math.cos(p.ang) * p.r;
    const y = cy + Math.sin(p.ang) * p.r * 0.72; // slight tilt
    const a = Math.min(0.9, (40 / p.r) * opacity);
    ctx.fillStyle = rgba(accent, a);
    ctx.beginPath();
    ctx.arc(x, y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // event horizon
  ctx.fillStyle = `rgba(0,0,0,${0.92 * opacity})`;
  ctx.beginPath();
  ctx.arc(cx, cy, horizon, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(accent, 0.45 * opacity);
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ---- Wind ----
export function createWind(w, h, p) {
  const n = Math.max(20, Math.min(150, Math.round(p.count || 50)));
  return Array.from({ length: n }, () => ({
    x: rand(0, w), y: rand(0, h),
    len: rand(0.7, 1.3),
    phase: rand(0, Math.PI * 2),
    spd: rand(0.8, 2.2),
  }));
}
export function drawWind(ctx, streams, env) {
  const { width, height, delta, speed, opacity, accent, phase, params } = env;
  const step = (delta / 16.67) * speed * (params.speed || 1);
  const baseLen = params.length || 90;
  for (const s of streams) {
    s.x += s.spd * step * 3.5;
    s.y += Math.sin(phase * 2 + s.phase) * 0.35 * step;
    if (s.x > width + 60) { s.x = -60; s.y = rand(0, height); }
    const len = baseLen * s.len;
    ctx.strokeStyle = rgba(accent, 0.22 * opacity);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.bezierCurveTo(
      s.x + len * 0.3, s.y + Math.sin(phase + s.phase) * 10,
      s.x + len * 0.65, s.y + Math.cos(phase + s.phase) * 10,
      s.x + len, s.y
    );
    ctx.stroke();
  }
}

// ---- Desert with theme colors ----
export function createDesert(w, h) {
  return {
    tumble: { x: w * 0.2, y: h * 0.72, vx: 1.2, rot: 0 },
    critters: Array.from({ length: 3 }, () => ({
      kind: Math.random() > 0.5 ? 'scorpion' : 'snake',
      x: rand(0, w), y: h * 0.78 + rand(0, h * 0.12),
      vx: rand(-0.6, 0.6) || 0.3,
      phase: rand(0, 10),
    })),
  };
}

export function drawDesert(ctx, state, env) {
  const { width, height, delta, speed, opacity, accent, phase, params } = env;
  const step = (delta / 16.67) * speed;
  // sky uses accent-tinted dark, sand uses accent mixed with warm neutral via accent only + white/black
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, rgba(accent, 0.08 * opacity));
  sky.addColorStop(1, rgba(accent, 0.2 * opacity));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const dunes = Math.max(3, Math.min(7, Math.round(params.dunes || 4)));
  for (let layer = 0; layer < dunes; layer++) {
    const base = height * (0.5 + layer * 0.08);
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, base);
    for (let x = 0; x <= width; x += 12) {
      const y = base
        + Math.sin(x * 0.007 + phase * 0.3 * speed + layer) * (14 + layer * 5)
        + Math.sin(x * 0.018 + layer) * 5;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = rgba(accent, (0.1 + layer * 0.07) * opacity);
    ctx.fill();
  }

  // cacti
  const cactusX = [width * 0.18, width * 0.55, width * 0.82];
  for (const cx of cactusX) {
    const base = height * 0.72;
    ctx.fillStyle = rgba(accent, 0.55 * opacity);
    ctx.fillRect(cx - 4, base - 40, 8, 40);
    ctx.fillRect(cx - 14, base - 28, 10, 4);
    ctx.fillRect(cx - 14, base - 28, 4, 16);
    ctx.fillRect(cx + 4, base - 22, 10, 4);
    ctx.fillRect(cx + 10, base - 22, 4, 12);
  }

  if (params.tumble !== false) {
    const t = state.tumble;
    t.x += t.vx * step * 2;
    t.rot += 0.08 * step;
    t.y = height * 0.74 + Math.sin(phase * 2) * 3;
    if (t.x > width + 20) t.x = -20;
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.rot);
    ctx.strokeStyle = rgba(accent, 0.5 * opacity);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-8, 0); ctx.lineTo(8, 0);
    ctx.moveTo(0, -8); ctx.lineTo(0, 8);
    ctx.stroke();
    ctx.restore();
  }

  if (params.critters !== false) {
    for (const c of state.critters) {
      c.x += c.vx * step * 1.5;
      if (c.x < -20) c.x = width + 20;
      if (c.x > width + 20) c.x = -20;
      ctx.fillStyle = rgba(accent, 0.4 * opacity);
      if (c.kind === 'scorpion') {
        ctx.beginPath();
        ctx.arc(c.x, c.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = rgba(accent, 0.35 * opacity);
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.quadraticCurveTo(c.x + 6, c.y - 8, c.x + 4, c.y - 12);
        ctx.stroke();
      } else {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const sx = c.x + i * 5;
          const sy = c.y + Math.sin(phase * 3 + i + c.phase) * 2;
          if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.strokeStyle = rgba(accent, 0.4 * opacity);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }
}

// ---- Glacier ----
export function drawGlacier(ctx, env) {
  const { width, height, phase, speed, opacity, accent, params } = env;
  const scale = params.scale || 1.25;
  const waterLine = height * 0.58;
  // cold wash
  const cold = ctx.createLinearGradient(0, 0, 0, height);
  cold.addColorStop(0, rgba(accent, 0.06 * opacity));
  cold.addColorStop(1, rgba(accent, 0.16 * opacity));
  ctx.fillStyle = cold;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = rgba(accent, 0.18 * opacity);
  ctx.fillRect(0, waterLine, width, height - waterLine);

  for (let i = 0; i < 6; i++) {
    const y = waterLine + 8 + i * 16 + Math.sin(phase * speed + i) * 2;
    ctx.strokeStyle = rgba(accent, 0.12 * opacity);
    ctx.beginPath();
    for (let x = 0; x <= width; x += 14) {
      const yy = y + Math.sin(x * 0.025 + phase * speed * 2 + i) * 2;
      if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  const cx = width * 0.5;
  const s = 1.15 * scale;
  // above water
  ctx.fillStyle = rgba(accent, 0.42 * opacity);
  ctx.beginPath();
  ctx.moveTo(cx - 140 * s, waterLine);
  ctx.lineTo(cx - 110 * s, waterLine - 95 * s);
  ctx.lineTo(cx - 30 * s, waterLine - 130 * s);
  ctx.lineTo(cx + 50 * s, waterLine - 85 * s);
  ctx.lineTo(cx + 130 * s, waterLine - 60 * s);
  ctx.lineTo(cx + 150 * s, waterLine);
  ctx.closePath();
  ctx.fill();
  // cracks
  ctx.strokeStyle = rgba(accent, 0.25 * opacity);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 40 * s, waterLine - 20 * s);
  ctx.lineTo(cx - 20 * s, waterLine - 90 * s);
  ctx.moveTo(cx + 20 * s, waterLine - 10 * s);
  ctx.lineTo(cx + 45 * s, waterLine - 70 * s);
  ctx.stroke();
  // under water
  ctx.fillStyle = rgba(accent, 0.22 * opacity);
  ctx.beginPath();
  ctx.moveTo(cx - 140 * s, waterLine);
  ctx.lineTo(cx - 120 * s, waterLine + 100 * s);
  ctx.lineTo(cx + 120 * s, waterLine + 110 * s);
  ctx.lineTo(cx + 150 * s, waterLine);
  ctx.closePath();
  ctx.fill();

  const chunks = Math.max(4, Math.min(16, Math.round(params.chunks || 8)));
  for (let i = 0; i < chunks; i++) {
    const x = ((i * 97 + phase * speed * 10) % (width + 50)) - 25;
    const y = waterLine + 6 + Math.sin(phase + i) * 3;
    ctx.fillStyle = rgba(accent, 0.35 * opacity);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 20, y - 7);
    ctx.lineTo(x + 36, y + 2);
    ctx.lineTo(x + 14, y + 9);
    ctx.closePath();
    ctx.fill();
  }
}

// ---- Balls with optional collisions ----
export function createBalls(w, h, p) {
  const n = Math.max(4, Math.min(30, Math.round(p.count || 12)));
  const size = p.size || 1;
  return Array.from({ length: n }, () => ({
    x: rand(40, w - 40), y: rand(40, h - 40),
    vx: rand(-2.2, 2.2), vy: rand(-2.2, 2.2),
    r: rand(10, 20) * size, h: rand(0, 360),
  }));
}
export function drawBalls(ctx, balls, env) {
  const { width, height, delta, speed, opacity, params } = env;
  const step = (delta / 16.67) * speed;
  const collide = params.collide !== false;
  for (const b of balls) {
    b.x += b.vx * step * 2;
    b.y += b.vy * step * 2;
    if (b.x < b.r || b.x > width - b.r) b.vx *= -1;
    if (b.y < b.r || b.y > height - b.r) b.vy *= -1;
  }
  if (collide) {
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i]; const b = balls[j];
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
  }
  for (const b of balls) {
    const g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, 0, b.x, b.y, b.r);
    g.addColorStop(0, hsl(b.h, 80, 70, 0.85 * opacity));
    g.addColorStop(1, hsl(b.h, 80, 40, 0.5 * opacity));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---- Fireworks variety ----
export function createFireworks() {
  return { rockets: [], sparks: [], timer: 0 };
}
export function drawFireworks(ctx, fw, env) {
  const { width, height, delta, speed, opacity, params } = env;
  const step = (delta / 16.67) * speed;
  const rate = params.rate || 1;
  const heightMul = params.height || 1;
  const variety = params.variety || 1;
  fw.timer += step * rate;
  if (fw.timer > 18) {
    fw.timer = 0;
    const kind = Math.random();
    fw.rockets.push({
      x: rand(width * 0.1, width * 0.9),
      y: height + 10,
      vx: rand(-0.8, 0.8) * variety,
      vy: rand(-9.5, -5.2) * heightMul,
      h: rand(0, 360),
      kind: kind < 0.2 ? 'flare' : kind < 0.5 ? 'double' : kind < 0.75 ? 'ring' : 'burst',
      exploded: false,
    });
  }
  for (const r of fw.rockets) {
    if (r.exploded) continue;
    r.x += r.vx * step * 2;
    r.y += r.vy * step;
    r.vy += 0.07 * step;
    ctx.fillStyle = hsl(r.h, 90, 60, opacity);
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.kind === 'flare' ? 2 : 2.6, 0, Math.PI * 2);
    ctx.fill();
    if (r.vy >= -0.4 || r.y < height * (0.12 + Math.random() * 0.15)) {
      r.exploded = true;
      const spawn = (count, speedMul, lifeMul = 1) => {
        for (let i = 0; i < count; i++) {
          const ang = (i / count) * Math.PI * 2 + rand(-0.1, 0.1);
          const sp = rand(1.2, 4.2) * speedMul;
          fw.sparks.push({
            x: r.x, y: r.y,
            vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
            life: lifeMul, h: r.h + rand(-30, 30),
            trail: r.kind === 'flare',
          });
        }
      };
      if (r.kind === 'flare') {
        for (let i = 0; i < 12; i++) {
          fw.sparks.push({
            x: r.x, y: r.y,
            vx: rand(-0.3, 0.3), vy: rand(0.5, 2.5),
            life: 1.2, h: r.h, trail: true,
          });
        }
      } else if (r.kind === 'ring') {
        spawn(28, 1.1, 1);
      } else if (r.kind === 'double') {
        spawn(24, 1, 1);
        // secondary delayed via negative life marker handled as second wave positions
        spawn(16, 0.55, 0.85);
      } else {
        spawn(36, 1.2, 1);
      }
    }
  }
  fw.rockets = fw.rockets.filter((r) => !r.exploded);
  for (const s of fw.sparks) {
    s.x += s.vx * step * 2;
    s.y += s.vy * step * 2;
    s.vy += 0.05 * step;
    s.life -= 0.01 * step;
    if (s.life <= 0) continue;
    ctx.fillStyle = hsl(s.h, 90, 60, s.life * opacity);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.trail ? 1.4 : 2.1, 0, Math.PI * 2);
    ctx.fill();
  }
  fw.sparks = fw.sparks.filter((s) => s.life > 0);
}

export function drawPuppetWaves(ctx, env) {
  const { width, height, phase, speed, opacity, accent, params } = env;
  const layers = Math.max(3, Math.min(10, Math.round(params.layers || 6)));
  const ampMul = params.amp || 1;
  for (let i = 0; i < layers; i++) {
    const yBase = height * (0.35 + i * 0.09);
    const amp = (12 + i * 4) * ampMul;
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

export function createSand(w, h, p) {
  const n = Math.max(40, Math.min(300, Math.round(p.count || 120)));
  return Array.from({ length: n }, () => ({
    x: rand(0, w), y: rand(-h, h), vy: rand(1.2, 3.2),
    r: rand(1, 2.5) * (p.size || 1), h: rand(0, 360),
  }));
}
export function drawSand(ctx, grains, env) {
  const { width, height, delta, speed, opacity } = env;
  const step = (delta / 16.67) * speed;
  for (const g of grains) {
    g.y += g.vy * step * 2.5;
    g.x += Math.sin(g.y * 0.02) * 0.3;
    if (g.y > height + 5) { g.y = -5; g.x = rand(0, width); g.h = rand(0, 360); }
    ctx.fillStyle = hsl(g.h, 70, 55, 0.55 * opacity);
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.fill();
  }
}
