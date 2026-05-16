/**
 * motion-video-maker / scene transitions
 * ----------------------------------------------------------------
 * Inter-scene overlays that wipe / iris / dissolve / morph between
 * the outgoing and incoming scene.  A transition is declared as
 *
 *   <div data-transition="wipe-up"
 *        data-start="5.8" data-duration="0.8"
 *        data-color="#0a0a16"></div>
 *
 * It mounts a fullscreen <canvas> on top of everything (z-index 28)
 * and paints a frame-accurate transition mask based on the local
 * progress.  When the transition finishes, the canvas is cleared so
 * the underlying scene shows through again.
 *
 * Inspired by classic film transitions and react-bits' PixelTransition.
 */
(function () {
  'use strict';

  // ---------- Easing helpers (use registered easings) -----------
  function ease(name) {
    const E = (window.__mvm && window.__mvm.easing) || {};
    return E[name] || (t => t);
  }

  function getCanvas(el) {
    let c = el.querySelector('canvas.mvm-trans-canvas');
    if (!c) {
      c = document.createElement('canvas');
      c.className = 'mvm-trans-canvas';
      c.style.position = 'absolute';
      c.style.inset = '0';
      c.style.width = '100%';
      c.style.height = '100%';
      c.style.display = 'block';
      c.style.pointerEvents = 'none';
      el.appendChild(c);
    }
    const stage = document.getElementById('stage');
    const w = stage ? stage.clientWidth  || 1920 : 1920;
    const h = stage ? stage.clientHeight || 1080 : 1080;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return c;
  }

  function hexToRgb(hex) {
    const h = (hex || '#000').replace('#', '');
    const n = h.length === 3
      ? [h[0]+h[0], h[1]+h[1], h[2]+h[2]]
      : [h.slice(0,2), h.slice(2,4), h.slice(4,6)];
    return [parseInt(n[0],16), parseInt(n[1],16), parseInt(n[2],16)];
  }

  // ============== Transition kinds ==============================

  // Wipe — solid bar slides across the screen.
  // The bar reaches the opposite edge at p=0.5 (full cover), then
  // continues to slide out by p=1.  This achieves an inter-scene
  // transition with a single transition window: 0..0.5 hides outgoing,
  // 0.5..1 reveals incoming.
  function applyWipe(el, t) {
    const c = getCanvas(el);
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    const start = parseFloat(el.dataset.start) || 0;
    const dur = parseFloat(el.dataset.duration) || 0.8;
    const dir = el.dataset.dir || 'up'; // up | down | left | right | diag
    const color = el.dataset.color || '#0a0a14';
    const easeName = el.dataset.easing || 'easeInOutQuart';
    const e = ease(easeName);
    const local = t - start;
    if (local < 0 || local > dur) { ctx.clearRect(0, 0, w, h); return; }
    const p = e(Math.max(0, Math.min(1, local / dur)));

    // Map p to fill rectangle position
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = color;
    if (dir === 'up') {
      // bar enters from bottom, sits at y=0..h at p=0.5, leaves out top
      const top = h - p * 2 * h;
      ctx.fillRect(0, Math.max(0, top), w, h);
      if (p > 0.5) ctx.fillRect(0, 0, w, h - (p - 0.5) * 2 * h);
    } else if (dir === 'down') {
      const bottom = p * 2 * h;
      ctx.fillRect(0, 0, w, Math.min(h, bottom));
      if (p > 0.5) ctx.fillRect(0, (p - 0.5) * 2 * h, w, h);
    } else if (dir === 'left') {
      const right = w - p * 2 * w;
      ctx.fillRect(Math.max(0, right), 0, w, h);
      if (p > 0.5) ctx.fillRect(0, 0, w - (p - 0.5) * 2 * w, h);
    } else if (dir === 'right') {
      const left = p * 2 * w;
      ctx.fillRect(0, 0, Math.min(w, left), h);
      if (p > 0.5) ctx.fillRect((p - 0.5) * 2 * w, 0, w, h);
    } else if (dir === 'diag') {
      // Diagonal sweep using a rotated bar
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-Math.atan2(h, w));
      const diag = Math.sqrt(w * w + h * h);
      const x = -diag/2 + p * 2 * diag - diag/2;
      ctx.fillRect(x - diag/2, -diag/2, diag, diag);
      ctx.restore();
    }
  }

  // Iris / Circle Reveal
  function applyIris(el, t) {
    const c = getCanvas(el);
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    const start = parseFloat(el.dataset.start) || 0;
    const dur = parseFloat(el.dataset.duration) || 0.9;
    const color = el.dataset.color || '#0a0a14';
    const easeName = el.dataset.easing || 'easeInOutCubic';
    const e = ease(easeName);
    const local = t - start;
    if (local < 0 || local > dur) { ctx.clearRect(0, 0, w, h); return; }
    const p = e(Math.max(0, Math.min(1, local / dur)));
    const maxR = Math.sqrt(w * w + h * h) / 2;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = color;
    // 0..0.5 contract (mask covers everything except shrinking circle revealing outgoing)
    // 0.5..1 expand again (incoming scene revealed from center)
    if (p <= 0.5) {
      const r = maxR * (1 - p * 2);
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.arc(w / 2, h / 2, Math.max(0, r), 0, Math.PI * 2, true);
      ctx.fill('evenodd');
    } else {
      const r = maxR * ((p - 0.5) * 2);
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.arc(w / 2, h / 2, Math.max(0, r), 0, Math.PI * 2, true);
      ctx.fill('evenodd');
    }
  }

  // Pixel Dissolve — deterministic random-order tile mask
  // 0..0.5 reveals tiles (covers outgoing); 0.5..1 hides tiles (reveals incoming)
  function applyPixelDissolve(el, t) {
    const c = getCanvas(el);
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    const start = parseFloat(el.dataset.start) || 0;
    const dur = parseFloat(el.dataset.duration) || 0.9;
    const color = el.dataset.color || '#0a0a14';
    const tile = parseInt(el.dataset.tile, 10) || 28;
    const local = t - start;
    if (local < 0 || local > dur) { ctx.clearRect(0, 0, w, h); return; }
    const p = Math.max(0, Math.min(1, local / dur));

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = color;
    const cols = Math.ceil(w / tile);
    const rows = Math.ceil(h / tile);
    // Phase A: p in [0, 0.5] -> reveal coverage from 0 to 1
    // Phase B: p in [0.5, 1] -> reveal coverage from 1 to 0
    const cov = p < 0.5 ? p * 2 : 1 - (p - 0.5) * 2;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        // Deterministic "random" order in [0,1]
        const seed = (x * 73856093) ^ (y * 19349663);
        const order = ((Math.abs(seed) % 10007) / 10007);
        if (order < cov) {
          ctx.fillRect(x * tile, y * tile, tile, tile);
        }
      }
    }
  }

  // Shape Morph — animated rounded rectangle that grows to cover then shrinks
  function applyShape(el, t) {
    const c = getCanvas(el);
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    const start = parseFloat(el.dataset.start) || 0;
    const dur = parseFloat(el.dataset.duration) || 0.9;
    const color = el.dataset.color || '#0a0a14';
    const e = ease(el.dataset.easing || 'easeInOutCubic');
    const local = t - start;
    if (local < 0 || local > dur) { ctx.clearRect(0, 0, w, h); return; }
    const p = e(Math.max(0, Math.min(1, local / dur)));

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = color;
    // Two squares from corners that meet at center then split out
    if (p <= 0.5) {
      const k = p * 2;
      const sw = w * 0.6 * k;
      const sh = h * 1.2 * k;
      ctx.beginPath();
      roundRect(ctx, -sw * 0.2, h / 2 - sh / 2, sw, sh, 24);
      ctx.fill();
      ctx.beginPath();
      roundRect(ctx, w - sw * 0.8, h / 2 - sh / 2, sw, sh, 24);
      ctx.fill();
    } else {
      const k = (p - 0.5) * 2;
      ctx.fillRect(0, 0, w, h); // cover
      // erase a circle that grows
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      const r = Math.max(w, h) * k;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
  }

  // Flash transition — quick white/colored flash that fully covers then fades
  function applyFlash(el, t) {
    const c = getCanvas(el);
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    const start = parseFloat(el.dataset.start) || 0;
    const dur = parseFloat(el.dataset.duration) || 0.5;
    const color = el.dataset.color || '#ffffff';
    const local = t - start;
    if (local < 0 || local > dur) { ctx.clearRect(0, 0, w, h); return; }
    const p = Math.max(0, Math.min(1, local / dur));
    const [r, g, b] = hexToRgb(color);
    // Symmetric: fast in, slow out
    const alpha = p < 0.3 ? p / 0.3 : 1 - (p - 0.3) / 0.7;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = `rgba(${r},${g},${b},${Math.max(0, alpha)})`;
    ctx.fillRect(0, 0, w, h);
  }

  // Glitch transition — RGB-split panels + scanlines briefly tear the screen
  function applyGlitchTrans(el, t) {
    const c = getCanvas(el);
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    const start = parseFloat(el.dataset.start) || 0;
    const dur = parseFloat(el.dataset.duration) || 0.6;
    const local = t - start;
    if (local < 0 || local > dur) { ctx.clearRect(0, 0, w, h); return; }
    const p = Math.max(0, Math.min(1, local / dur));
    const strength = (1 - Math.abs(p - 0.5) * 2);

    ctx.clearRect(0, 0, w, h);
    // black horizontal panels that shift
    for (let i = 0; i < 12; i++) {
      const seedA = Math.sin(i * 13.37 + p * 90) * 0.5 + 0.5;
      if (seedA < strength * 0.7) {
        const yy = (i / 12) * h;
        const hh = h / 12 + 4;
        ctx.fillStyle = `rgba(10, 10, 16, ${0.7 + 0.3 * seedA})`;
        ctx.fillRect(0, yy, w, hh);
      }
    }
    // RGB split bars
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 6; i++) {
      const seed = Math.sin(i * 7.7 + p * 80) * 0.5 + 0.5;
      const yy = seed * h;
      const hh = 6 + seed * 20;
      ctx.fillStyle = `rgba(255, 80, 80, ${0.6 * strength})`;
      ctx.fillRect(0, yy, w, hh);
      ctx.fillStyle = `rgba(80, 220, 255, ${0.6 * strength})`;
      ctx.fillRect(0, yy + 4, w, hh);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------- Registration --------------------------------------
  const TRANSITIONS = {
    'wipe':            applyWipe,
    'wipe-up':         (el, t) => { el.dataset.dir = 'up';    applyWipe(el, t); },
    'wipe-down':       (el, t) => { el.dataset.dir = 'down';  applyWipe(el, t); },
    'wipe-left':       (el, t) => { el.dataset.dir = 'left';  applyWipe(el, t); },
    'wipe-right':      (el, t) => { el.dataset.dir = 'right'; applyWipe(el, t); },
    'iris':            applyIris,
    'circle-reveal':   applyIris,
    'pixel-dissolve':  applyPixelDissolve,
    'shape':           applyShape,
    'flash':           applyFlash,
    'glitch':          applyGlitchTrans,
  };

  function ensureMount(el) {
    if (el.__mvmTransMounted) return;
    // Position the transition wrapper so it covers the entire stage.
    el.style.position = 'absolute';
    el.style.inset = '0';
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.pointerEvents = 'none';
    el.style.zIndex = el.style.zIndex || '28';
    el.__mvmTransMounted = true;
  }

  function refreshCache() {
    cachedTransitions = Array.from(document.querySelectorAll('[data-transition]'));
    cachedTransitions.forEach(ensureMount);
  }

  let cachedTransitions = null;

  window.addEventListener('mvm-seek', (e) => {
    if (!cachedTransitions) refreshCache();
    const t = e.detail.time;
    cachedTransitions.forEach(el => {
      const fn = TRANSITIONS[el.dataset.transition];
      if (fn) fn(el, t);
    });
  });

  // Re-scan once the DOM is ready (in case transitions are added later)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refreshCache);
  } else {
    refreshCache();
  }

  window.__mvmTransitions = { TRANSITIONS, refresh: refreshCache };
})();
