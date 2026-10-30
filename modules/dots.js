export function initDots() {
  // На узких экранах не грузим лишнюю анимацию
  if (window.matchMedia('(max-width: 768px)').matches) return;

  const canvas = document.getElementById('bgDots') || document.querySelector('canvas.bg-dots');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let w = 0;
  let h = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  const COUNT = Math.min(160, Math.floor((w * h) / 12000) + 60);
  const DETECT = 140;
  const SPEED = 0.55;

  const dots = Array.from({ length: COUNT }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * SPEED,
    vy: (Math.random() - 0.5) * SPEED,
    r: Math.random() * 1.4 + 0.6,
    alpha: Math.random() * 0.35 + 0.2,
  }));

  function loop() {
    ctx.clearRect(0, 0, w, h);

    for (const d of dots) {
      d.x += d.vx;
      d.y += d.vy;
      if (d.x < 0 || d.x > w) d.vx *= -1;
      if (d.y < 0 || d.y > h) d.vy *= -1;
      d.x = Math.max(0, Math.min(w, d.x));
      d.y = Math.max(0, Math.min(h, d.y));
    }

    for (let i = 0; i < dots.length; i++) {
      const a = dots[i];
      for (let j = i + 1; j < dots.length; j++) {
        const b = dots[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < DETECT) {
          const t = 1 - dist / DETECT;
          ctx.strokeStyle = `rgba(255, 128, 171, ${t * 0.18})`;
          ctx.lineWidth = t * 1.2;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    for (const d of dots) {
      ctx.globalAlpha = d.alpha;
      ctx.fillStyle = '#ffb3d9';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    requestAnimationFrame(loop);
  }
  loop();
}
