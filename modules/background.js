const STORAGE_KEY = 'chat_appearance_v1';
const DEFAULTS = { animation: 'dots', speed: 1, density: 75, opacity: 65 };

function readSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      animation: ['dots', 'orbits', 'math', 'none'].includes(saved.animation) ? saved.animation : DEFAULTS.animation,
      speed: clamp(saved.speed, 0.2, 2, DEFAULTS.speed),
      density: Math.round(clamp(saved.density, 30, 140, DEFAULTS.density)),
      opacity: clamp(saved.opacity, 10, 100, DEFAULTS.opacity) / 100
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
  return [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16));
}

function rgba(rgb, alpha) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

export function initBackgroundAnimation() {
  const canvas = document.getElementById('backgroundCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let settings = readSettings();
  let accent = parseHex(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  let dots = [];
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
      alpha: Math.random() * 0.3 + 0.35
    }));
  }

  function clear() {
    ctx.clearRect(0, 0, width, height);
  }

  function drawDots(delta) {
    const step = delta / 16.67;
    const reach = Math.min(150, Math.max(85, Math.sqrt((width * height) / dots.length) * 1.05));
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

  function drawOrbits(delta) {
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
    const grid = 54;
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(accent, 0.065 * settings.opacity);
    for (let x = 0; x < width; x += grid) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += grid) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    const centerY = height * 0.52;
    ctx.strokeStyle = rgba(accent, 0.13 * settings.opacity);
    ctx.beginPath(); ctx.moveTo(0, centerY); ctx.lineTo(width, centerY); ctx.stroke();

    const curves = [
      { amplitude: Math.min(90, height * 0.12), frequency: 0.012, offset: 0, alpha: 0.36 },
      { amplitude: Math.min(55, height * 0.075), frequency: 0.019, offset: Math.PI * 0.65, alpha: 0.22 }
    ];
    for (const curve of curves) {
      ctx.strokeStyle = rgba(accent, curve.alpha * settings.opacity);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 3) {
        const y = centerY + Math.sin(x * curve.frequency + phase * settings.speed + curve.offset) * curve.amplitude;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    const formulas = ['y = sin(x + t)', 'f(x) = cos(2x)', '∑  Δx  π', '∫ f(x) dx', 'x² + y² = r²'];
    ctx.font = '13px ui-monospace, SFMono-Regular, Consolas, monospace';
    formulas.forEach((formula, index) => {
      const drift = (phase * 5 * settings.speed + index * 173) % (width + 220);
      const x = drift - 110;
      const y = 70 + index * Math.max(48, height * 0.12) + Math.sin(phase * 0.35 + index) * 10;
      ctx.fillStyle = rgba(accent, 0.2 * settings.opacity);
      ctx.fillText(formula, x, Math.min(height - 20, y));
    });
  }

  function drawStatic() {
    clear();
    if (settings.animation === 'math') drawMath();
    else if (settings.animation === 'orbits') drawOrbits(0);
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
    else if (settings.animation === 'orbits') drawOrbits(delta);
    else if (settings.animation === 'math') drawMath();
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
    settings = readSettings();
    accent = parseHex(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
    if (previousDensity !== settings.density) createDots();
    start();
  }

  resize();
  updateFromPreferences();
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('appearance:change', updateFromPreferences);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });
  reduceMotion.addEventListener?.('change', start);
}
