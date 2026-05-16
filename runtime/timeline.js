/**
 * motion-video-maker / timeline runtime
 * ----------------------------------------------------------------
 * A deterministic, seekable, frame-accurate timeline that drives
 * every animation in the composition from a single `currentTime`
 * value.  The renderer (puppeteer) calls `window.__mvmSeek(t)` for
 * every frame; the browser preview ticks `requestAnimationFrame`.
 *
 * Inspired by Remotion (deterministic seeking) and Hyperframes
 * (HTML data-attribute composition format), but completely
 * standalone — no React, no build step, no framework lock-in.
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;

  // ----------- Easing functions ---------------------------------
  const E = {
    linear: t => t,
    easeIn: t => t * t,
    easeOut: t => 1 - (1 - t) ** 2,
    easeInOut: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    easeOutCubic: t => 1 - Math.pow(1 - t, 3),
    easeInOutCubic: t => (t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2),
    easeOutQuart: t => 1 - Math.pow(1 - t, 4),
    easeInOutQuart: t => (t < 0.5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2),
    easeOutQuint: t => 1 - Math.pow(1 - t, 5),
    easeOutExpo: t => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    easeInOutExpo: t => {
      if (t === 0) return 0;
      if (t === 1) return 1;
      return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
    },
    easeOutBack: t => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    easeOutElastic: t => {
      const c4 = TAU / 3;
      return t === 0 ? 0 : t === 1 ? 1 :
        Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },
    easeOutBounce: t => {
      const n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    },
  };

  // ----------- Spring easings (lazy-bound from spring.js) -------
  // These resolve to physically-correct spring evaluators normalized
  // over the configured settle time, so they slot into the existing
  // 0..1 easing contract while producing real bounce/overshoot.
  const SPRING_NAMES = [
    'springGentle', 'springSoft', 'springSnap',
    'springSmooth', 'springBouncy', 'springWobbly', 'springStiff',
  ];
  SPRING_NAMES.forEach(name => {
    Object.defineProperty(E, name, {
      get() {
        return window.__mvmSpring ? window.__mvmSpring.easing(name) : E.easeOutQuart;
      },
    });
  });

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = t => Math.max(0, Math.min(1, t));
  const smoothstep = (a, b, t) => {
    const x = clamp01((t - a) / (b - a));
    return x * x * (3 - 2 * x);
  };

  // ===============================================================
  // DETERMINISTIC API — modelled after Remotion's delayRender /
  // continueRender / random / cancelRender so this Skill can make the
  // same "two renders → byte-identical output" guarantee.
  // ===============================================================

  // ---- (a) Async resource handles --------------------------------
  // Any async work (image decode, font load, fetch, etc.) should call
  // `__mvm.delayRender(label)`, then `continueRender(handle)` when done.
  // While handles are outstanding, `window.__mvmReady === false`.
  let _handleSeq = 0;
  const _handles = new Map();
  function delayRender(label) {
    const id = ++_handleSeq;
    _handles.set(id, { label: label || `handle ${id}`, started: Date.now() });
    window.__mvmReady = false;
    return id;
  }
  function continueRender(id) {
    _handles.delete(id);
    if (_handles.size === 0 && _domReady) window.__mvmReady = true;
  }
  function pendingHandleLabels() {
    return [..._handles.values()].map(h => h.label);
  }

  // ---- (b) Cancellable render -------------------------------------
  // Async failure should call `__mvm.cancelRender(err)` instead of
  // silently throwing; render.mjs polls __mvmCancelledError each frame
  // and aborts with the real error message instead of timing out.
  function cancelRender(err) {
    const msg = err && err.stack ? err.stack : String(err);
    window.__mvmCancelledError = msg;
    console.error('[mvm-cancel]', msg);
  }

  // ---- (c) Seeded random — mulberry32 ----------------------------
  // Math.random() in the browser is seeded per-process, so two renders
  // of the same composition produce different particle / starfield /
  // glitch frames.  Authors that need randomness must call this with
  // a fixed seed (string or number) — output is then deterministic.
  function hashCode(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seededRng(seed) {
    if (seed == null) {
      console.warn('[mvm-random] Math.random()-equivalent call with no seed — not deterministic. Pass a string/number seed.');
      return Math.random;
    }
    const n = typeof seed === 'string' ? hashCode(seed) : (seed >>> 0);
    return mulberry32(n || 1);
  }
  // Convenience: single sample from a stateless seed
  function randomSample(seed) {
    if (seed == null) return Math.random();
    const n = typeof seed === 'string' ? hashCode(seed) : (seed >>> 0);
    // single-step mulberry32 with a fixed advance so two callers
    // with the same seed always get the same value
    let a = ((n >>> 0) + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ----------- Composition discovery ----------------------------
  function getStage() {
    return document.getElementById('stage') || document.querySelector('[data-composition-id]');
  }

  function getStageMeta() {
    const s = getStage();
    if (!s) return { duration: 5, fps: 30, width: 1920, height: 1080 };
    return {
      duration: parseFloat(s.dataset.duration) || 5,
      fps: parseInt(s.dataset.fps, 10) || 30,
      width: parseInt(s.dataset.width, 10) || 1920,
      height: parseInt(s.dataset.height, 10) || 1080,
      background: s.dataset.background || '#0a0a0f',
    };
  }

  // ----------- Animation definitions ----------------------------
  // Each animation accepts (t01) where t01 is a 0..1 progress (post-easing)
  // and returns a CSS transform / opacity / filter style.
  const ANIMS = {
    fadeIn: t => ({ opacity: t }),
    fadeOut: t => ({ opacity: 1 - t }),
    fadeInUp: t => ({ opacity: t, transform: `translate3d(0, ${(1 - t) * 60}px, 0)` }),
    fadeInDown: t => ({ opacity: t, transform: `translate3d(0, ${(1 - t) * -60}px, 0)` }),
    fadeInLeft: t => ({ opacity: t, transform: `translate3d(${(1 - t) * -80}px, 0, 0)` }),
    fadeInRight: t => ({ opacity: t, transform: `translate3d(${(1 - t) * 80}px, 0, 0)` }),
    slideUp: t => ({ transform: `translate3d(0, ${(1 - t) * 100}%, 0)` }),
    slideDown: t => ({ transform: `translate3d(0, ${(1 - t) * -100}%, 0)` }),
    zoomIn: t => ({ opacity: t, transform: `scale(${0.6 + t * 0.4})` }),
    zoomOut: t => ({ opacity: 1 - t, transform: `scale(${1 + (1 - t) * 0.5})` }),
    pop: t => {
      // overshoot scale (back-out feel)
      const s = t < 0.6 ? lerp(0.4, 1.15, t / 0.6) : lerp(1.15, 1, (t - 0.6) / 0.4);
      return { opacity: clamp01(t * 2), transform: `scale(${s})` };
    },
    blurIn: t => ({ opacity: t, filter: `blur(${(1 - t) * 24}px)` }),
    blurOut: t => ({ opacity: 1 - t, filter: `blur(${t * 24}px)` }),
    rotateIn: t => ({ opacity: t, transform: `rotate(${(1 - t) * -180}deg) scale(${0.5 + t * 0.5})` }),
    swing3D: t => ({ opacity: t, transform: `perspective(800px) rotateX(${(1 - t) * 90}deg)`, transformOrigin: 'top center' }),
    floatIn: t => {
      const float = Math.sin(t * Math.PI) * 8;
      return { opacity: t, transform: `translate3d(0, ${(1 - t) * 40 - float}px, 0)` };
    },
    // -----------------------------------------------------------
    // NEW – diversification pack
    // -----------------------------------------------------------
    // Clip-path reveals (no opacity transition — feels cinematic).
    unmaskUp:    t => ({ clipPath: `inset(${(1 - t) * 100}% 0 0 0)` }),
    unmaskDown:  t => ({ clipPath: `inset(0 0 ${(1 - t) * 100}% 0)` }),
    unmaskLeft:  t => ({ clipPath: `inset(0 ${(1 - t) * 100}% 0 0)` }),
    unmaskRight: t => ({ clipPath: `inset(0 0 0 ${(1 - t) * 100}%)` }),
    // 3D flip in
    flipInX: t => ({
      opacity: clamp01(t * 2),
      transform: `perspective(900px) rotateX(${(1 - t) * 92}deg)`,
      transformOrigin: 'center bottom',
    }),
    flipInY: t => ({
      opacity: clamp01(t * 2),
      transform: `perspective(900px) rotateY(${(1 - t) * -92}deg)`,
      transformOrigin: 'left center',
    }),
    // Cube tumble – combines rotate + translate so it looks like a face
    // is dropping into place.
    cubeIn: t => ({
      opacity: clamp01(t * 2),
      transform: `perspective(900px) rotateX(${(1 - t) * -50}deg) translate3d(0, ${(1 - t) * -100}px, 0)`,
      transformOrigin: 'center top',
    }),
    // Magnetic in — element snaps in from a tangent vector with a
    // small overshoot, like it's being pulled by a magnet.
    magneticIn: t => {
      const overshoot = t < 0.78 ? t / 0.78 : 1 + (1 - (t - 0.78) / 0.22) * 0.08;
      return {
        opacity: clamp01(t * 1.8),
        transform: `translate3d(${(1 - overshoot) * 140}px, ${(1 - overshoot) * 60}px, 0) scale(${0.7 + overshoot * 0.3})`,
      };
    },
    // Glitch in — RGB-split jitter that lands cleanly
    glitchIn: t => {
      const jitter = (1 - t) * 8;
      const dx = Math.sin(t * 87) * jitter;
      const dy = Math.cos(t * 53) * jitter * 0.5;
      const shiftR = (1 - t) * 14;
      return {
        opacity: clamp01(t * 1.5),
        transform: `translate3d(${dx}px, ${dy}px, 0)`,
        filter: `drop-shadow(${shiftR}px 0 0 #FF003C) drop-shadow(${-shiftR}px 0 0 #00FFFF)`,
      };
    },
    // Skew in — sheared landing
    skewIn: t => ({
      opacity: t,
      transform: `translate3d(0, ${(1 - t) * 40}px, 0) skewY(${(1 - t) * 6}deg) skewX(${(1 - t) * -3}deg)`,
    }),
    // Ken-Burns slow zoom — small but very different from pop / zoom
    kenBurnsIn: t => {
      const s = 1.0 + (1 - t) * 0.18;
      const dx = (1 - t) * -30;
      return { opacity: t, transform: `translate3d(${dx}px, 0, 0) scale(${s})` };
    },
    // Slide+blur in — elegant editorial entrance
    slideBlurIn: t => ({
      opacity: clamp01(t * 2),
      transform: `translate3d(${(1 - t) * 60}px, 0, 0)`,
      filter: `blur(${(1 - t) * 12}px)`,
    }),
    // Drop in with bounce settling
    dropIn: t => {
      let s, dy;
      if (t < 0.68) {
        const p = t / 0.68;
        s = 1; dy = (1 - p) * -260;
      } else {
        const p = (t - 0.68) / 0.32;
        const bounce = Math.sin(p * Math.PI) * (1 - p) * 18;
        s = 1; dy = -bounce;
      }
      return { opacity: clamp01(t * 3), transform: `translate3d(0, ${dy}px, 0) scale(${s})` };
    },
    // Iris zoom (corner pivot)
    irisIn: t => ({
      opacity: clamp01(t * 1.8),
      transform: `scale(${0.05 + t * 0.95})`,
      transformOrigin: 'center center',
      clipPath: `circle(${t * 75}% at 50% 50%)`,
    }),
  };

  function applyStyle(el, style) {
    for (const k in style) el.style[k] = style[k];
  }

  // ----------- Per-clip evaluation ------------------------------
  // If the element ALSO declares a text/fx component (data-text-animation
  // or data-fx), then `data-clip` only governs visibility — the component
  // owns the visual styles for the active window.
  function evaluateClip(el, t) {
    const start = parseFloat(el.dataset.start) || 0;
    const dur = parseFloat(el.dataset.duration);
    const inDur = parseFloat(el.dataset.inDuration) || 0.6;
    const outDur = parseFloat(el.dataset.outDuration) || 0.6;
    const easingName = el.dataset.easing || 'easeOutCubic';
    const easingOutName = el.dataset.easingOut || 'easeInOutCubic';
    const easing = E[easingName] || E.easeOutCubic;
    const easingOut = E[easingOutName] || E.easeInOutCubic;
    const animIn = el.dataset.animation || el.dataset.animationIn || null;
    const animOut = el.dataset.animationOut || null;
    const hasDuration = !isNaN(dur);
    const hasComponent = !!(el.dataset.textAnimation || el.dataset.fx);
    // hide-mode: "visibility" (default — KEEPS layout slot so siblings
    // do not jump around when a later element fades in) or "display"
    // (legacy mode — removes the element entirely from layout).
    // Use "display" explicitly when you want a clip to genuinely vanish
    // and let surrounding content collapse into its space.
    const hideMode = el.dataset.hideMode || 'visibility';
    const hide = () => {
      if (hideMode === 'visibility') {
        el.style.visibility = 'hidden';
        el.style.opacity = '0';
      } else {
        el.style.display = 'none';
      }
    };
    const show = () => {
      if (hideMode === 'visibility') {
        el.style.visibility = '';
      } else {
        el.style.display = '';
      }
    };

    // Visibility window
    if (t < start) { hide(); return; }
    if (hasDuration && t > start + dur) { hide(); return; }
    show();

    const local = t - start;

    // In animation
    if (animIn && ANIMS[animIn] && local < inDur) {
      const p = easing(clamp01(local / inDur));
      applyStyle(el, ANIMS[animIn](p));
      return;
    }

    // Out animation
    if (hasDuration && animOut && ANIMS[animOut] && local > dur - outDur) {
      const p = easingOut(clamp01((local - (dur - outDur)) / outDur));
      applyStyle(el, ANIMS[animOut](p));
      return;
    }

    // Steady state — clear any inline styles set by previous in/out
    // animations so the component (or the author's CSS) takes over.
    // We do this even for hasComponent elements because the in/out
    // can drive an outer zoom/fade wrapper around the component.
    el.style.opacity = '';
    el.style.transform = '';
    el.style.filter = '';
  }

  // ----------- Public API ---------------------------------------
  function seekAll(t) {
    const stage = getStage();
    if (!stage) return;
    const clips = stage.querySelectorAll('[data-clip]');
    clips.forEach(c => evaluateClip(c, t));
    // Dispatch a custom event for component-internal animators (canvas, etc.)
    window.dispatchEvent(new CustomEvent('mvm-seek', { detail: { time: t } }));
    window.__mvmTime = t;
  }

  // Browser preview loop
  function startPreview() {
    const meta = getStageMeta();
    const startedAt = performance.now();
    function tick() {
      const elapsed = (performance.now() - startedAt) / 1000;
      const t = elapsed % meta.duration;
      seekAll(t);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ===== Stage validation =========================================
  // Reject compositions whose dimensions / fps / duration would crash
  // FFmpeg later.  Failing loudly here saves a 30s render that ends in
  // a cryptic libx264 error.
  function validateStage(m) {
    const warn = (msg) => console.warn(`[mvm-stage] ${msg} (see SKILL.md → Hard Rules)`);
    if (!Number.isFinite(m.width) || m.width <= 0) {
      throw new Error(`[mvm-stage] data-width must be a positive integer, got ${m.width}`);
    }
    if (!Number.isFinite(m.height) || m.height <= 0) {
      throw new Error(`[mvm-stage] data-height must be a positive integer, got ${m.height}`);
    }
    if (m.width % 2 || m.height % 2) {
      warn(`stage ${m.width}×${m.height} has odd dimension — H.264 requires even width/height. Use ${m.width - (m.width % 2)}×${m.height - (m.height % 2)}.`);
    }
    if (!Number.isFinite(m.fps) || m.fps <= 0 || m.fps > 120) {
      throw new Error(`[mvm-stage] data-fps must be 1..120, got ${m.fps}`);
    }
    if (!Number.isFinite(m.duration) || m.duration <= 0) {
      throw new Error(`[mvm-stage] data-duration must be a positive number of seconds, got ${m.duration}`);
    }
    // Per-clip sanity
    const stage = getStage();
    if (stage) {
      stage.querySelectorAll('[data-clip]').forEach(el => {
        const s = parseFloat(el.dataset.start || '0');
        const d = parseFloat(el.dataset.duration || String(m.duration));
        if (!Number.isFinite(s) || s < 0) warn(`clip has invalid data-start="${el.dataset.start}"`);
        if (!Number.isFinite(d) || d <= 0) warn(`clip has invalid data-duration="${el.dataset.duration}"`);
        if (s + d > m.duration + 0.01) {
          warn(`clip "${(el.textContent || '').trim().slice(0, 24)}" runs ${s}s..${(s + d).toFixed(2)}s but stage is only ${m.duration}s long — last ${(s + d - m.duration).toFixed(2)}s will never play.`);
        }
      });
    }
  }

  window.__mvm = {
    seek: seekAll,
    meta: getStageMeta,
    easing: E,
    lerp, clamp01, smoothstep,
    register(name, fn) { ANIMS[name] = fn; },
    anims: ANIMS,
    // Deterministic API (mirrors Remotion's contract)
    delayRender, continueRender, cancelRender,
    pendingHandles: pendingHandleLabels,
    random: seededRng,          // returns a stateful PRNG function
    randomSample,               // returns a single deterministic sample
    validateStage,
    get ready() { return _domReady && _handles.size === 0; },
  };

  // Allow renderer to wait for full readiness signal
  let _domReady = false;
  window.__mvmReady = false;
  window.__mvmCancelledError = null;
  document.addEventListener('DOMContentLoaded', () => {
    try { validateStage(getStageMeta()); }
    catch (e) { cancelRender(e); throw e; }
    if (!window.__mvmRenderMode) startPreview();
    _domReady = true;
    if (_handles.size === 0) window.__mvmReady = true;
  });
})();
