/**
 * motion-video-maker / element effects
 * ----------------------------------------------------------------
 * Decorative effects that attach to existing elements via
 * `data-effect="electric-border" | "star-border" | "image-trail"`.
 *
 * Inspired by react-bits ElectricBorder, StarBorder, and ImageTrail.
 * Re-implemented from scratch as plain canvas/SVG, fully driven by
 * the deterministic timeline (no requestAnimationFrame here).
 */
(function () {
  'use strict';

  // ---------- Shared helpers ------------------------------------
  function getOverlayCanvas(el, key, zIndex = 5) {
    let c = el.querySelector('canvas.mvm-fx-' + key);
    if (!c) {
      c = document.createElement('canvas');
      c.className = 'mvm-fx-' + key;
      c.style.position = 'absolute';
      c.style.pointerEvents = 'none';
      c.style.zIndex = String(zIndex);
      c.style.display = 'block';
      if (getComputedStyle(el).position === 'static') {
        el.style.position = 'relative';
      }
      el.appendChild(c);
    }
    return c;
  }

  function hash21(x, y) {
    let s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi,     yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = hash21(xi, yi);
    const b = hash21(xi + 1, yi);
    const c = hash21(xi, yi + 1);
    const d = hash21(xi + 1, yi + 1);
    return (1 - v) * ((1 - u) * a + u * b) + v * ((1 - u) * c + u * d);
  }
  function fbm(x, y, octaves = 4) {
    let v = 0, amp = 0.5, freq = 1.0;
    for (let i = 0; i < octaves; i++) {
      v += amp * noise2(x * freq, y * freq);
      amp *= 0.5; freq *= 2.0;
    }
    return v;
  }

  // Sample a point on the rounded perimeter of `el` at parameter
  // p ∈ [0, 1].  Returns an [x, y] coordinate in element-local pixels.
  function perimeterPoint(w, h, r, p) {
    const radius = Math.min(r, Math.min(w, h) / 2);
    // Edge lengths (corners use quarter-circles)
    const top = w - 2 * radius;
    const right = h - 2 * radius;
    const bottom = w - 2 * radius;
    const left = h - 2 * radius;
    const arc = (Math.PI / 2) * radius;
    const total = top + right + bottom + left + 4 * arc;
    let d = p * total;
    // top edge (left → right)
    if (d < top) return [radius + d, 0];
    d -= top;
    // top-right corner
    if (d < arc) {
      const a = (d / arc) * (Math.PI / 2) - Math.PI / 2;
      return [w - radius + Math.cos(a) * radius, radius + Math.sin(a) * radius];
    }
    d -= arc;
    // right edge (top → bottom)
    if (d < right) return [w, radius + d];
    d -= right;
    // bottom-right corner
    if (d < arc) {
      const a = (d / arc) * (Math.PI / 2);
      return [w - radius + Math.cos(a) * radius, h - radius + Math.sin(a) * radius];
    }
    d -= arc;
    // bottom edge (right → left)
    if (d < bottom) return [w - radius - d, h];
    d -= bottom;
    // bottom-left corner
    if (d < arc) {
      const a = (d / arc) * (Math.PI / 2) + Math.PI / 2;
      return [radius + Math.cos(a) * radius, h - radius + Math.sin(a) * radius];
    }
    d -= arc;
    // left edge (bottom → top)
    if (d < left) return [0, h - radius - d];
    d -= left;
    // top-left corner
    if (d < arc) {
      const a = (d / arc) * (Math.PI / 2) + Math.PI;
      return [radius + Math.cos(a) * radius, radius + Math.sin(a) * radius];
    }
    return [radius, 0];
  }

  function syncCanvasSize(el, c, padding) {
    const r = el.getBoundingClientRect();
    // Use offsetWidth/Height to avoid being affected by transform animations
    const w = el.offsetWidth + padding * 2;
    const h = el.offsetHeight + padding * 2;
    c.style.left = `${-padding}px`;
    c.style.top  = `${-padding}px`;
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    if (c.width !== w || c.height !== h) {
      c.width = w; c.height = h;
    }
    return { w, h, pad: padding };
  }

  // ============== Electric Border ===============================
  // Multiple noise-perturbed paths traced around the element border,
  // with RGB chromatic split + accumulated glow.
  function applyElectricBorder(el, t) {
    const pad = parseFloat(el.dataset.padding) || 24;
    const c = getOverlayCanvas(el, 'electric', 1);
    const { w, h } = syncCanvasSize(el, c, pad);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    const borderR = parseFloat(el.dataset.borderRadius) || (el.style.borderRadius ? parseFloat(el.style.borderRadius) : 18);
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;
    const radius = borderR;

    const intensity = parseFloat(el.dataset.intensity) || 1.0;
    const speed     = parseFloat(el.dataset.speed)     || 1.5;
    const color1 = el.dataset.color  || '#FF6363';
    const color2 = el.dataset.color2 || '#FFD400';
    const color3 = el.dataset.color3 || '#5BC0EB';

    // 3 RGB-shifted arcs that run around the perimeter
    const arcs = [
      { color: color1, offset: 0.0, amp: 8 * intensity, freq: 4.5 },
      { color: color2, offset: 0.33, amp: 6 * intensity, freq: 5.5 },
      { color: color3, offset: 0.66, amp: 7 * intensity, freq: 6.5 },
    ];

    ctx.save();
    ctx.translate(pad, pad);

    arcs.forEach((arc, idx) => {
      const N = 280;
      const points = [];
      for (let i = 0; i <= N; i++) {
        const p = i / N;
        const [px, py] = perimeterPoint(innerW, innerH, radius, p);
        // outward normal — approximate via direction to center
        const cx = innerW / 2, cy = innerH / 2;
        let dx = px - cx, dy = py - cy;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        dx /= len; dy /= len;
        // noise displacement, both tangential and normal
        const ph = p * arc.freq + t * speed + arc.offset * 6.28 + idx * 1.7;
        const dispN = (fbm(ph, idx * 9.13, 4) - 0.5) * 2 * arc.amp;
        const dispT = (fbm(ph + 3.7, idx * 4.31, 3) - 0.5) * arc.amp * 0.3;
        points.push([
          px + dx * dispN + (-dy) * dispT,
          py + dy * dispN + ( dx) * dispT,
        ]);
      }
      // Draw glow with multiple stroke widths
      const baseGlow = [
        { w: 10, a: 0.10 * intensity },
        { w: 5,  a: 0.30 * intensity },
        { w: 2.4, a: 0.7 * intensity },
        { w: 1.1, a: 1.0 },
      ];
      baseGlow.forEach(({ w: lw, a }) => {
        ctx.strokeStyle = withAlpha(arc.color, a);
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < points.length; i++) {
          if (i === 0) ctx.moveTo(points[i][0], points[i][1]);
          else ctx.lineTo(points[i][0], points[i][1]);
        }
        ctx.stroke();
      });
    });

    ctx.restore();
  }

  // ============== Star Border ===================================
  // N small 4-point stars orbit around the perimeter; each star has
  // a comet-like trail extending behind it.
  function applyStarBorder(el, t) {
    const pad = parseFloat(el.dataset.padding) || 30;
    const c = getOverlayCanvas(el, 'star', 1);
    const { w, h } = syncCanvasSize(el, c, pad);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    const innerW = w - pad * 2;
    const innerH = h - pad * 2;
    const radius = parseFloat(el.dataset.borderRadius) || 18;

    const count = parseInt(el.dataset.count, 10) || 6;
    const speed = parseFloat(el.dataset.speed) || 0.25;
    const color = el.dataset.color || '#FFFFFF';
    const tailLen = parseInt(el.dataset.tail, 10) || 14;
    const size = parseFloat(el.dataset.size) || 4;

    ctx.save();
    ctx.translate(pad, pad);
    for (let i = 0; i < count; i++) {
      const baseP = i / count;
      // Trail samples
      for (let j = tailLen - 1; j >= 0; j--) {
        const p = ((baseP + t * speed - j * 0.005) % 1 + 1) % 1;
        const [px, py] = perimeterPoint(innerW, innerH, radius, p);
        const tailA = (1 - j / tailLen);
        const a = tailA * tailA * 0.85;
        // tail as fading line dot
        ctx.fillStyle = withAlpha(color, a * 0.55);
        ctx.beginPath();
        ctx.arc(px, py, size * 0.45 * tailA, 0, Math.PI * 2);
        ctx.fill();
      }
      // Head star with glow
      const p = ((baseP + t * speed) % 1 + 1) % 1;
      const [px, py] = perimeterPoint(innerW, innerH, radius, p);
      // Glow
      const grad = ctx.createRadialGradient(px, py, 0, px, py, size * 5);
      grad.addColorStop(0, withAlpha(color, 0.95));
      grad.addColorStop(0.3, withAlpha(color, 0.45));
      grad.addColorStop(1, withAlpha(color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, size * 5, 0, Math.PI * 2);
      ctx.fill();
      // 4-point star
      drawStar(ctx, px, py, size, color);
    }
    ctx.restore();
  }
  function drawStar(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    const long = r;
    const short = r * 0.32;
    ctx.moveTo(x, y - long);
    ctx.lineTo(x + short, y - short);
    ctx.lineTo(x + long, y);
    ctx.lineTo(x + short, y + short);
    ctx.lineTo(x, y + long);
    ctx.lineTo(x - short, y + short);
    ctx.lineTo(x - long, y);
    ctx.lineTo(x - short, y - short);
    ctx.closePath();
    ctx.fill();
  }

  // ============== Image Trail ===================================
  // While the element's `data-clip` is in its in-animation, draw a
  // chain of N "ghost" copies that lag the element's progress, each
  // fading out. Re-uses the timeline's animation presets via the
  // already-applied inline style on the element itself.
  function applyImageTrail(el, t) {
    const start = parseFloat(el.dataset.start) || 0;
    const inDur = parseFloat(el.dataset.inDuration) || 0.6;
    const count = parseInt(el.dataset.trailCount, 10) || 5;
    const stride = parseFloat(el.dataset.trailStride) || 0.06;
    const decay  = parseFloat(el.dataset.trailDecay) || 0.55;

    const local = t - start;
    // Only show trail during in-animation window
    if (local < 0 || local > inDur + count * stride + 0.05) {
      removeTrails(el);
      return;
    }
    ensureTrails(el, count);
    const ghosts = el.__mvmTrails || [];
    // Read the active transform & opacity by sampling the same animation
    // at an offset time.  We synthesize ghost transforms by reading
    // the element's data-animation preset directly.
    const animName = el.dataset.animation || el.dataset.animationIn || 'fadeIn';
    const ANIMS = window.__mvm && window.__mvm.anims;
    const E = window.__mvm && window.__mvm.easing;
    const easeName = el.dataset.easing || 'easeOutCubic';
    const ease = (E && E[easeName]) || (x => x);
    const animFn = ANIMS && ANIMS[animName];
    if (!animFn) return;

    ghosts.forEach((g, i) => {
      const ghostOffset = (i + 1) * stride;
      const ghostLocal = local - ghostOffset;
      if (ghostLocal < 0 || ghostLocal > inDur) {
        g.style.opacity = '0';
        return;
      }
      const p = ease(Math.max(0, Math.min(1, ghostLocal / inDur)));
      const style = animFn(p);
      // Apply animation style + extra alpha decay
      const fadeFactor = Math.pow(decay, i + 1);
      g.style.transform = style.transform || '';
      g.style.filter = style.filter || '';
      const opacityAttr = style.opacity != null ? style.opacity : 1;
      g.style.opacity = String(opacityAttr * fadeFactor);
    });
  }
  function ensureTrails(el, count) {
    if (el.__mvmTrails && el.__mvmTrails.length === count) return;
    removeTrails(el);
    el.__mvmTrails = [];
    // Mirror the host element's layout position so ghosts overlap it
    const left = el.offsetLeft;
    const top  = el.offsetTop;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    for (let i = 0; i < count; i++) {
      const g = el.cloneNode(true);
      g.querySelectorAll('canvas.mvm-fx-electric, canvas.mvm-fx-star, .mvm-ghost').forEach(n => n.remove());
      g.removeAttribute('data-effect');
      g.removeAttribute('data-clip');
      g.removeAttribute('data-animation');
      g.removeAttribute('data-animation-in');
      g.removeAttribute('data-animation-out');
      g.removeAttribute('id');
      g.classList.add('mvm-ghost');
      g.style.position = 'absolute';
      g.style.left  = left + 'px';
      g.style.top   = top + 'px';
      g.style.width = w + 'px';
      g.style.height = h + 'px';
      g.style.margin = '0';
      g.style.pointerEvents = 'none';
      g.style.opacity = '0';
      // Don't use negative z-index — that lets the parent's background
      // hide the ghost.  Keep ghosts above the parent bg but below the
      // main element via DOM order (we insertBefore the main).
      g.style.zIndex = '0';
      el.parentElement.insertBefore(g, el);
      el.__mvmTrails.push(g);
    }
  }
  function removeTrails(el) {
    if (!el.__mvmTrails) return;
    el.__mvmTrails.forEach(g => g.remove());
    el.__mvmTrails = null;
  }

  // ---------- Color util ----------------------------------------
  function withAlpha(hex, a) {
    const h = hex.replace('#', '');
    const n = h.length === 3
      ? [h[0]+h[0], h[1]+h[1], h[2]+h[2]]
      : [h.slice(0,2), h.slice(2,4), h.slice(4,6)];
    return `rgba(${parseInt(n[0],16)},${parseInt(n[1],16)},${parseInt(n[2],16)},${a})`;
  }

  // ============== Scrim (text-on-noisy-background safety) =======
  // Any element with `data-scrim="..."` gets a sibling backdrop
  // inserted at mount time.  Modes:
  //   "card"     — translucent rounded pill behind the element
  //   "radial"   — soft radial darkness from element center
  //   "blur"     — backdrop-filter blur + slight darken
  //   "auto"     — radial darkness + soft drop-shadow + stroke
  // Additional knobs:
  //   data-scrim-color    : "rgba(0,0,0,0.7)"
  //   data-scrim-blur     : "20px"
  //   data-scrim-padding  : "30"
  //   data-scrim-opacity  : "0.65"
  //   data-scrim-radius   : "20"
  function ensureScrim(el) {
    if (el.__mvmScrimMounted) return;
    el.__mvmScrimMounted = true;
    const mode = el.dataset.scrim;
    const color = el.dataset.scrimColor || 'rgba(0,0,0,0.7)';
    const pad = parseFloat(el.dataset.scrimPadding) || 28;
    const opacity = parseFloat(el.dataset.scrimOpacity) || 0.7;
    const radius = parseFloat(el.dataset.scrimRadius) || 18;
    const blur = el.dataset.scrimBlur || '18px';

    const scrim = document.createElement('div');
    scrim.className = 'mvm-scrim';
    scrim.style.position = 'absolute';
    scrim.style.pointerEvents = 'none';
    scrim.style.zIndex = '-1';
    scrim.style.left = `-${pad}px`;
    scrim.style.top  = `-${pad}px`;
    scrim.style.right = `-${pad}px`;
    scrim.style.bottom = `-${pad}px`;
    scrim.style.borderRadius = `${radius + pad}px`;

    switch (mode) {
      case 'card':
        scrim.style.background = color;
        scrim.style.backdropFilter = `blur(${blur}) saturate(140%)`;
        scrim.style.webkitBackdropFilter = scrim.style.backdropFilter;
        scrim.style.border = '1px solid rgba(255,255,255,0.10)';
        break;
      case 'blur':
        scrim.style.background = `rgba(0,0,0,${opacity * 0.55})`;
        scrim.style.backdropFilter = `blur(${blur})`;
        scrim.style.webkitBackdropFilter = `blur(${blur})`;
        break;
      case 'radial':
        scrim.style.background = `radial-gradient(ellipse at center, rgba(0,0,0,${opacity}) 0%, rgba(0,0,0,${opacity * 0.6}) 50%, rgba(0,0,0,0) 100%)`;
        break;
      case 'auto':
      default:
        scrim.style.background = `radial-gradient(ellipse at center, rgba(0,0,0,${opacity}) 0%, rgba(0,0,0,${opacity * 0.5}) 55%, rgba(0,0,0,0) 100%)`;
        // also give the host a subtle stroke + drop-shadow if author hasn't
        if (!el.style.textShadow) {
          el.style.textShadow = '0 2px 8px rgba(0,0,0,0.85), 0 4px 24px rgba(0,0,0,0.55)';
        }
        break;
    }
    // Make sure parent can absolutely-position the scrim — but never
    // trample an existing absolute/fixed/relative from CSS or author.
    if (getComputedStyle(el).position === 'static') {
      el.style.position = 'relative';
    }
    el.style.isolation = 'isolate';
    el.insertBefore(scrim, el.firstChild);
  }

  // ============== Registration =================================
  const EFFECTS = {
    'electric-border': applyElectricBorder,
    'star-border':     applyStarBorder,
    'image-trail':     applyImageTrail,
  };

  let cached = null;
  let cachedScrim = null;
  function refresh() {
    cached = Array.from(document.querySelectorAll('[data-effect]'));
    cachedScrim = Array.from(document.querySelectorAll('[data-scrim]'));
    cachedScrim.forEach(ensureScrim);
  }

  window.addEventListener('mvm-seek', (e) => {
    if (!cached) refresh();
    const t = e.detail.time;
    cached.forEach(el => {
      const fn = EFFECTS[el.dataset.effect];
      if (fn) fn(el, t);
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refresh);
  } else {
    refresh();
  }

  window.__mvmEffects = { EFFECTS, refresh };
})();
