(() => {
  const canvas = document.getElementById('snow-canvas');
  const ctx = canvas.getContext('2d');
  const glow = document.getElementById('snow-glow');
  const trigger = document.getElementById('snow-trigger');
  const flakeAsset = trigger.querySelector('img');
  const shovel = document.getElementById('shovel');
  const hitLayer = document.getElementById('snow-hits');
  const status = document.getElementById('snow-status');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width:1023px)');
  const N = 150;
  const FADE_ZONE = 105;

  // One height field belongs to the viewport floor, independently of document content.
  const cards = [0].map(() => {
    const hit = document.createElement('button');
    hit.type = 'button';
    hit.className = 'snow-hit';
    hit.hidden = true;
    hit.setAttribute('aria-label', 'Очистить снег внизу окна. Проведите курсором или пальцем; Enter — очистить весь сугроб.');
    hitLayer.append(hit);
    return { hit, h: new Float32Array(N), rect: { x: 0, y: 0, w: 1 }, visible: true };
  });

  let width = 1;
  let height = 1;
  let flakes = [];
  let debris = [];
  let frame = 0;
  let lastTime = 0;
  let until = 0;
  let budget = 0;
  let lastPointer = null;
  let totalLanded = 0;
  let activeTouch = null;
  let cycleRunning = false;
  let cycleCount = 0;
  let snowLevel = 0;
  let shovelDirection = -1;
  let shovelDirectionReferenceX = null;

  function setCycleState(active) {
    cycleRunning = active;
    trigger.classList.toggle('is-active', active && !reduced.matches);
    trigger.setAttribute('aria-busy', String(active));
  }

  // Only emission and falling flakes light the viewport floor.
  function syncGlow(now = performance.now(), immediate = false) {
    const active = !document.hidden && !reduced.matches && (now < until || flakes.length > 0);
    glow.classList.toggle('no-fade', immediate);
    glow.classList.toggle('is-active', active);
  }

  function cancelFall() {
    until = 0;
    flakes = [];
    debris = [];
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    setCycleState(false);
    document.body.classList.remove('snow-clearing');
    lastPointer = null;
    syncGlow(performance.now(), true);
    draw();
  }

  function indexAt(card, x) {
    return Math.max(0, Math.min(N - 1, Math.round((x - card.rect.x) / card.rect.w * (N - 1))));
  }

  function capAt(i) {
    const edge = .7 + .3 * Math.min(1, i / 6, (N - 1 - i) / 6);
    const base = mobile.matches
      ? 60 + 7 * Math.sin(i * .105) + 5 * Math.sin(i * .23 + 1)
      : 78 + 10 * Math.sin(i * .105) + 8 * Math.sin(i * .23 + 1);
    const step = mobile.matches ? 34 : 44;
    const limit = Math.min(mobile.matches ? 220 : 280, height * (mobile.matches ? .3 : .36));
    return Math.min(base + Math.max(0, snowLevel - 1) * step, limit) * edge;
  }

  function measure() {
    width = document.documentElement.clientWidth;
    height = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    for (const card of cards) {
      card.rect = { x: 0, y: height, w: width };
      card.h.forEach((v, i) => { card.h[i] = Math.min(v, capAt(i)); });
    }
    lastPointer = null;
    document.body.classList.remove('snow-clearing');
    updateHits();
    draw();
  }

  function updateHits() {
    for (const card of cards) {
      const max = Math.max(...card.h);
      card.hit.hidden = max < .45 && activeTouch === null;
      card.hit.style.left = '0px';
      card.hit.style.top = (height - max - 4) + 'px';
      card.hit.style.width = width + 'px';
      card.hit.style.height = (max + 4) + 'px';
    }
  }

  function deposit(card, x, amount) {
    const center = indexAt(card, x);
    const radius = Math.max(2, Math.ceil(18 / card.rect.w * N));
    for (let i = Math.max(0, center - radius); i <= Math.min(N - 1, center + radius); i++) {
      const f = Math.exp(-Math.pow((i - center) / radius, 2) * 2.5);
      const edge = .7 + .3 * Math.min(1, i / 6, (N - 1 - i) / 6);
      card.h[i] = Math.min(capAt(i), card.h[i] + amount * f * edge);
    }
    totalLanded++;
  }

  function particleOpacity(p) {
    const bottomFade = Math.max(0, Math.min(1, (height - p.y) / FADE_ZONE));
    return p.alpha * bottomFade;
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    for (const card of cards) {
      if (!card.visible || !card.h.some(v => v > .05)) continue;
      const { x, y, w } = card.rect;
      if (y < -4 || y > height + 30) continue;
      ctx.save();
      const fill = ctx.createLinearGradient(0, y - 24, 0, y + 3);
      fill.addColorStop(0, '#fff');
      fill.addColorStop(.65, '#fbfdff');
      fill.addColorStop(1, '#dcebf5');
      ctx.fillStyle = fill;
      ctx.strokeStyle = 'rgba(122,151,174,.72)';
      ctx.lineWidth = .9;
      ctx.shadowColor = 'rgba(56,82,105,.42)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = -6;
      ctx.beginPath();
      ctx.moveTo(x, y + 1);
      ctx.lineTo(x, y - card.h[0]);
      for (let i = 0; i < N - 1; i++) {
        const px = x + i / (N - 1) * w;
        const nx = x + (i + 1) / (N - 1) * w;
        ctx.quadraticCurveTo(px, y - card.h[i], (px + nx) / 2, y - (card.h[i] + card.h[i + 1]) / 2);
      }
      ctx.lineTo(x + w, y - card.h[N - 1]);
      ctx.lineTo(x + w, y + 1);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.shadowOffsetY = 0;
      ctx.stroke();
      ctx.restore();
    }

    if (flakeAsset.complete && flakeAsset.naturalWidth) {
      for (const p of flakes) {
        p.displayAlpha = particleOpacity(p);
        ctx.save();
        ctx.globalAlpha = p.displayAlpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.drawImage(flakeAsset, -p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    }

    for (const d of debris) {
      ctx.globalAlpha = Math.min(1, d.life * 2);
      ctx.fillStyle = '#f6fcff';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function ensureFrame() {
    if (!frame) {
      lastTime = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  function tick(now) {
    frame = 0;
    const dt = Math.min(.04, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    if (now < until && !reduced.matches) {
      budget += dt * (mobile.matches ? 32 : 54);
      while (budget >= 1 && flakes.length < 500) {
        budget--;
        const size = 14 + Math.random() * 18;
        flakes.push({
          x: Math.random() * width,
          y: -size,
          size,
          vy: Math.max(132, height * .2) + Math.random() * 74,
          vx: (Math.random() - .5) * 18,
          phase: Math.random() * Math.PI * 2,
          alpha: .58 + Math.random() * .4,
          displayAlpha: 0,
          angle: Math.random() * Math.PI * 2,
          spin: (Math.random() - .5) * 1.7
        });
      }
    }

    flakes = flakes.filter(p => {
      p.x += (p.vx + Math.sin(now / 780 + p.phase) * 11) * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      p.displayAlpha = particleOpacity(p);
      for (const card of cards) {
        const { x, y, w } = card.rect;
        if (!card.visible || y < 0 || p.x < x || p.x > x + w) continue;
        const surface = y - card.h[indexAt(card, p.x)];
        if (p.y + p.size * .28 >= surface) {
          deposit(card, p.x, 10 + p.size * .18);
          return false;
        }
      }
      return p.y < height + p.size && p.x > -p.size && p.x < width + p.size;
    });

    debris = debris.filter(d => {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 340 * dt;
      d.life -= dt;
      return d.life > 0 && d.y < height;
    });
    syncGlow(now);
    draw();
    updateHits();
    if (now < until || flakes.length || debris.length) {
      frame = requestAnimationFrame(tick);
    } else {
      setCycleState(false);
      status.textContent = 'Снег остался внизу окна. Проведите по нему курсором или пальцем, чтобы расчистить.';
    }
  }

  function play() {
    measure();
    const alreadyFalling = cycleRunning;
    const snowRemains = cards.some(card => card.h.some(value => value > 1));
    snowLevel = alreadyFalling || snowRemains ? snowLevel + 1 : 1;
    totalLanded = 0;
    cycleCount++;
    if (reduced.matches) {
      setCycleState(true);
      syncGlow(performance.now(), true);
      for (const card of cards.filter(c => c.visible)) {
        card.h.forEach((_, i) => { card.h[i] = capAt(i) * .9; });
      }
      draw();
      updateHits();
      setCycleState(false);
      status.textContent = 'Внизу окна появился снег. Движение отключено согласно настройкам устройства.';
      return;
    }
    setCycleState(true);
    status.textContent = alreadyFalling
      ? 'Снегопад продлён, сугроб станет выше.'
      : 'Начался снегопад. Снег оседает внизу окна. Его можно убрать курсором-лопатой или пальцем.';
    until = Math.max(performance.now(), until) + 7000;
    budget += 5;
    syncGlow();
    ensureFrame();
  }

  function brush(card, x, y, direction) {
    const radius = mobile.matches ? 24 : 27;
    const center = indexAt(card, x);
    const bins = Math.ceil(radius / card.rect.w * N);
    let removed = 0;
    for (let i = Math.max(0, center - bins); i <= Math.min(N - 1, center + bins); i++) {
      const binX = card.rect.x + i / (N - 1) * card.rect.w;
      const dx = Math.abs(binX - x);
      if (dx > radius || y + 10 < card.rect.y - card.h[i] || y - 12 > card.rect.y + 3) continue;
      const cut = Math.min(card.h[i], (1 - dx / radius) * 26);
      card.h[i] -= cut;
      removed += cut;
    }
    if (removed > 1 && !reduced.matches) {
      for (let i = 0; i < Math.min(8, Math.ceil(removed / 9)); i++) {
        if (debris.length < 150) {
          debris.push({
            x: x + (Math.random() - .5) * 12,
            y: Math.min(y, card.rect.y - 3),
            vx: (direction || 1) * (35 + Math.random() * 80),
            vy: -45 - Math.random() * 90,
            r: .7 + Math.random() * 2,
            life: .35 + Math.random() * .5
          });
        }
      }
    }
    draw();
    updateHits();
    if (cards.every(c => !c.h.some(value => value > 1))) snowLevel = 0;
    if (debris.length) ensureFrame();
  }

  function nearCard(x, y) {
    return cards.find(c => c.visible && c.h.some(v => v > .4) && x >= c.rect.x && x <= c.rect.x + c.rect.w && y >= c.rect.y - Math.max(...c.h) - 7 && y <= c.rect.y + 5);
  }

  function move(e, forced) {
    const x = e.clientX;
    const y = e.clientY;
    const card = forced || nearCard(x, y);
    document.body.classList.toggle('snow-clearing', !!card);
    if (!card) {
      lastPointer = null;
      shovelDirectionReferenceX = null;
      return;
    }
    if (shovelDirectionReferenceX === null) shovelDirectionReferenceX = x;
    const directionTravel = x - shovelDirectionReferenceX;
    if (Math.abs(directionTravel) >= 6) {
      shovelDirection = directionTravel > 0 ? 1 : -1;
      shovelDirectionReferenceX = x;
      shovel.dataset.direction = shovelDirection > 0 ? 'right' : 'left';
      shovel.style.setProperty('--shovel-flip', shovelDirection > 0 ? '-1' : '1');
    }
    shovel.style.left = (x - 28) + 'px';
    shovel.style.top = (y - 62) + 'px';
    const prev = lastPointer && lastPointer.card === card ? lastPointer : { x, y };
    const steps = Math.min(100, Math.max(1, Math.ceil(Math.hypot(x - prev.x, y - prev.y) / 6)));
    for (let i = 1; i <= steps; i++) {
      brush(card, prev.x + (x - prev.x) * i / steps, prev.y + (y - prev.y) * i / steps, Math.sign(x - prev.x));
    }
    lastPointer = { x, y, card };
  }

  trigger.addEventListener('click', play);
  window.addEventListener('pointermove', e => { if (e.pointerType !== 'touch') move(e); });
  window.addEventListener('pointerout', e => {
    if (!e.relatedTarget) {
      document.body.classList.remove('snow-clearing');
      lastPointer = null;
      shovelDirectionReferenceX = null;
    }
  });

  for (const card of cards) {
    card.hit.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        activeTouch = e.pointerId;
        card.hit.setPointerCapture(e.pointerId);
        move(e, card);
      }
    });
    card.hit.addEventListener('pointermove', e => {
      if ((e.pointerType === 'touch' || e.pointerType === 'pen') && card.hit.hasPointerCapture(e.pointerId)) move(e, card);
    });
    function endTouch() {
      activeTouch = null;
      lastPointer = null;
      shovelDirectionReferenceX = null;
      document.body.classList.remove('snow-clearing');
      updateHits();
    }
    card.hit.addEventListener('pointerup', endTouch);
    card.hit.addEventListener('pointercancel', endTouch);
    card.hit.addEventListener('lostpointercapture', endTouch);
    card.hit.addEventListener('click', e => {
      if (e.detail === 0) {
        card.h.fill(0);
        snowLevel = 0;
        debris = [];
        lastPointer = null;
        document.body.classList.remove('snow-clearing');
        draw();
        updateHits();
        status.textContent = 'Снег внизу окна убран.';
      }
    });
  }

  reduced.addEventListener('change', () => { if (reduced.matches) cancelFall(); });
  window.addEventListener('resize', measure);
  window.addEventListener('scroll', measure, { passive: true });
  window.visualViewport?.addEventListener('resize', measure);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelFall(); });
  window.addEventListener('pagehide', cancelFall);
  flakeAsset.addEventListener('load', draw);
  measure();

  // Read-only diagnostics support verification of the complete interaction cycle.
  Object.defineProperty(window, 'snowDiagnostics', {
    value: () => ({
      emitting: performance.now() < until,
      animating: !!frame,
      cycleRunning,
      cycleCount,
      snowLevel,
      particles: flakes.length,
      particleSamples: flakes.slice(0, 200).map(p => ({
        x: p.x,
        y: p.y,
        size: p.size,
        angle: p.angle,
        baseAlpha: p.alpha,
        displayAlpha: p.displayAlpha,
        distanceToBottom: height - p.y
      })),
      debris: debris.length,
      glowActive: glow.classList.contains('is-active'),
      fadeZone: FADE_ZONE,
      drawMode: 'png-image',
      snowflakeReady: flakeAsset.complete && !!flakeAsset.naturalWidth,
      snowflakeSource: flakeAsset.currentSrc || flakeAsset.src,
      shovelSource: shovel.currentSrc || shovel.src,
      shovelDirection: shovelDirection > 0 ? 'right' : 'left',
      shovelScaleX: shovelDirection > 0 ? -1 : 1,
      viewport: { width, height },
      landed: totalLanded,
      reduced: reduced.matches,
      cards: cards.filter(c => c.visible).map(c => ({
        rect: { ...c.rect },
        heights: Array.from(c.h),
        total: c.h.reduce((sum, value) => sum + value, 0),
        max: Math.max(...c.h)
      }))
    })
  });
})();
