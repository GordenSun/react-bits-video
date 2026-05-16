/**
 * motion-video-maker / component library
 * ----------------------------------------------------------------
 * High-quality text & visual animation components, inspired by
 * React-Bits but reimplemented as plain HTML/CSS/Canvas/WebGL so
 * the composition is a single self-contained HTML file.
 *
 * Activated by declarative attributes:
 *   <h1 data-clip data-text-animation="split-text" data-start="0"
 *       data-duration="3" data-stagger="0.05">你好世界</h1>
 *
 * Every component is deterministic — it reads its progress from
 * the global timeline `window.__mvmTime` so renders are
 * pixel-identical across machines.
 */
(function () {
  'use strict';

  const { easing: E, lerp, clamp01 } = window.__mvm;

  // Resolve a "component animation duration" — prefer `data-anim-duration`
  // so an element can have a long `data-clip` visibility window while the
  // text/fx animation itself runs for a different (usually shorter) time.
  function compDur(el, fallback) {
    const v = parseFloat(el.dataset.animDuration);
    if (!isNaN(v) && v > 0) return v;
    const v2 = parseFloat(el.dataset.duration);
    if (!isNaN(v2) && v2 > 0) return v2;
    return fallback;
  }

  // ============== TEXT EFFECTS ==================================

  // Helper: replace text node with per-character spans (idempotent).
  // When the parent uses a transparent-text-with-background trick (e.g.
  // `text-fire`, `text-aurora`), we copy the gradient onto each span so
  // the effect survives the wrapping.
  function splitChars(el, mode = 'char') {
    if (el.dataset.mvmSplit === mode) return Array.from(el.querySelectorAll('.mvm-char'));
    const raw = el.dataset.text || el.textContent;
    el.dataset.text = raw;
    const cs = window.getComputedStyle(el);
    const isTransparent =
      cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)' || cs.color === 'rgba(0, 0, 0, 0)';
    const inheritBg = isTransparent && cs.backgroundImage && cs.backgroundImage !== 'none';
    const bgStyle = inheritBg ? {
      backgroundImage: cs.backgroundImage,
      backgroundSize: cs.backgroundSize,
      backgroundPosition: cs.backgroundPosition,
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      color: 'transparent',
      WebkitTextFillColor: 'transparent',
    } : null;
    el.textContent = '';
    const tokens = mode === 'word' ? raw.split(/(\s+)/) : Array.from(raw);
    const spans = [];
    tokens.forEach(tok => {
      if (tok === '') return;
      if (/^\s+$/.test(tok)) { el.appendChild(document.createTextNode(tok)); return; }
      const span = document.createElement('span');
      span.className = 'mvm-char';
      span.textContent = tok;
      span.style.display = 'inline-block';
      span.style.willChange = 'transform, opacity, filter';
      if (bgStyle) Object.assign(span.style, bgStyle);
      el.appendChild(span);
      spans.push(span);
    });
    el.dataset.mvmSplit = mode;
    return spans;
  }

  // ---- Split Text (staggered fade+slide up) --------------------
  function applySplitText(el, t) {
    const start = parseFloat(el.dataset.start) || 0;
    const stagger = parseFloat(el.dataset.stagger) || 0.04;
    const charDur = parseFloat(el.dataset.charDuration) || 0.7;
    const mode = el.dataset.splitMode || 'char';
    const dy = parseFloat(el.dataset.travel) || 50;
    const easeName = el.dataset.easing || 'easeOutQuart';
    const ease = E[easeName] || E.easeOutQuart;
    const chars = splitChars(el, mode);
    chars.forEach((c, i) => {
      const local = t - start - i * stagger;
      const p = ease(clamp01(local / charDur));
      c.style.opacity = p;
      c.style.transform = `translate3d(0, ${(1 - p) * dy}px, 0)`;
    });
  }

  // ---- Blur Text -----------------------------------------------
  function applyBlurText(el, t) {
    const start = parseFloat(el.dataset.start) || 0;
    const stagger = parseFloat(el.dataset.stagger) || 0.06;
    const charDur = parseFloat(el.dataset.charDuration) || 0.9;
    const mode = el.dataset.splitMode || 'char';
    const ease = E[el.dataset.easing || 'easeOutCubic'];
    const chars = splitChars(el, mode);
    chars.forEach((c, i) => {
      const local = t - start - i * stagger;
      const p = ease(clamp01(local / charDur));
      c.style.opacity = p;
      c.style.filter = `blur(${(1 - p) * 16}px)`;
      c.style.transform = `translate3d(0, ${(1 - p) * 14}px, 0)`;
    });
  }

  // ---- Shiny Text (animated metallic sheen) --------------------
  function applyShinyText(el, t) {
    if (!el.dataset.mvmShinyInit) {
      el.style.backgroundImage =
        'linear-gradient(110deg, rgba(255,255,255,0.05) 30%, rgba(255,255,255,0.95) 50%, rgba(255,255,255,0.05) 70%)';
      el.style.backgroundSize = '300% 100%';
      el.style.webkitBackgroundClip = 'text';
      el.style.backgroundClip = 'text';
      el.style.color = 'transparent';
      el.dataset.mvmShinyInit = '1';
    }
    const start = parseFloat(el.dataset.start) || 0;
    const speed = parseFloat(el.dataset.speed) || 3;
    const local = t - start;
    const pos = ((local * speed * 100) % 300) - 100;
    el.style.backgroundPosition = `${-pos}% 0%`;
  }

  // ---- Gradient Text (animated rainbow) ------------------------
  function applyGradientText(el, t) {
    if (!el.dataset.mvmGradInit) {
      const colors = el.dataset.colors ||
        '#ff7e5f,#feb47b,#ff7e5f,#ffb88c,#86A8E7,#7F7FD5,#86A8E7';
      el.style.backgroundImage = `linear-gradient(90deg, ${colors})`;
      el.style.backgroundSize = '300% 100%';
      el.style.webkitBackgroundClip = 'text';
      el.style.backgroundClip = 'text';
      el.style.color = 'transparent';
      el.dataset.mvmGradInit = '1';
    }
    const start = parseFloat(el.dataset.start) || 0;
    const speed = parseFloat(el.dataset.speed) || 0.6;
    const local = t - start;
    const pos = (local * speed * 100) % 300;
    el.style.backgroundPosition = `${pos}% 50%`;
  }

  // ---- Glitch Text (RGB split jitter) --------------------------
  function applyGlitchText(el, t) {
    const start = parseFloat(el.dataset.start) || 0;
    const intensity = parseFloat(el.dataset.intensity) || 4;
    const local = t - start;
    // Pseudo-random based on time (deterministic)
    const jitter = (Math.sin(local * 47.3) * 10000) % 1;
    const ox = (Math.sin(local * 71.2) * intensity);
    const oy = (Math.cos(local * 53.7) * intensity * 0.4);
    el.style.textShadow =
      `${ox}px ${oy}px 0 #ff003c, ${-ox}px ${-oy}px 0 #00f0ff`;
    if (Math.abs(jitter) > 0.4) {
      el.style.transform = `translate(${jitter * 4}px, 0) skewX(${jitter * 6}deg)`;
    } else {
      el.style.transform = 'none';
    }
  }

  // ---- Decrypted / Scrambled text reveal -----------------------
  const SCRAMBLE_GLYPHS = '!<>-_\\/[]{}—=+*^?#01アイウエオカキクケコサシスセソ漢字文测试时间永恒';
  function applyDecryptedText(el, t) {
    const start = parseFloat(el.dataset.start) || 0;
    const total = compDur(el, 2.5);
    if (!el.dataset.text) el.dataset.text = el.textContent;
    const target = el.dataset.text;
    const local = t - start;
    if (local <= 0) { el.textContent = ''; return; }
    if (local >= total) { el.textContent = target; return; }
    const p = clamp01(local / total);
    const settled = Math.floor(p * target.length);
    let out = '';
    for (let i = 0; i < target.length; i++) {
      if (i < settled) out += target[i];
      else if (target[i] === ' ' || target[i] === '\n') out += target[i];
      else {
        // Deterministic pseudo-random glyph based on (i, time)
        const idx = Math.floor(((Math.sin(i * 13.37 + t * 60) * 10000) % SCRAMBLE_GLYPHS.length + SCRAMBLE_GLYPHS.length) % SCRAMBLE_GLYPHS.length);
        out += SCRAMBLE_GLYPHS[idx];
      }
    }
    el.textContent = out;
  }

  // ---- Typewriter Text -----------------------------------------
  function applyTypeText(el, t) {
    const start = parseFloat(el.dataset.start) || 0;
    const cps = parseFloat(el.dataset.cps) || 14; // chars per second
    if (!el.dataset.text) el.dataset.text = el.textContent;
    const txt = el.dataset.text;
    const local = t - start;
    if (local <= 0) { el.textContent = ''; return; }
    const n = Math.min(txt.length, Math.floor(local * cps));
    const cursor = (Math.floor(local * 2) % 2) ? '|' : ' ';
    el.textContent = txt.slice(0, n) + cursor;
  }

  // ---- Rotating Text (cycle phrases) ---------------------------
  function applyRotatingText(el, t) {
    const start = parseFloat(el.dataset.start) || 0;
    const phrases = (el.dataset.phrases || '').split('|');
    const each = parseFloat(el.dataset.each) || 1.5;
    if (!phrases.length) return;
    const local = Math.max(0, t - start);
    const idx = Math.floor(local / each) % phrases.length;
    const within = (local % each) / each;
    if (el.dataset.mvmRotLast !== String(idx)) {
      el.textContent = phrases[idx];
      el.dataset.mvmRotLast = String(idx);
    }
    // ease-in / ease-out within slice
    const inP = clamp01(within * 4);
    const outP = clamp01((within - 0.75) * 4);
    const op = inP * (1 - outP);
    const ty = (1 - inP) * 30 + outP * -30;
    el.style.opacity = op;
    el.style.display = 'inline-block';
    el.style.transform = `translate3d(0, ${ty}px, 0)`;
  }

  // ---- Count Up -----------------------------------------------
  // Two modes:
  //   default        — element.textContent is updated each frame
  //   data-odometer  — rendered as per-digit rolling columns
  function applyCountUp(el, t) {
    const start = parseFloat(el.dataset.start) || 0;
    const dur = compDur(el, 2);
    const from = parseFloat(el.dataset.from) || 0;
    const to = parseFloat(el.dataset.to) || 100;
    const decimals = parseInt(el.dataset.decimals, 10) || 0;
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const sep = el.dataset.separator || '';
    const ease = E[el.dataset.easing || 'easeOutCubic'];
    const local = t - start;
    const pRaw = clamp01(local / dur);
    const p = ease(pRaw);
    // After the configured animation duration, snap to `to`. This is
    // important for springs which can settle near-but-not-exactly 1.
    const v = pRaw >= 1 ? to : lerp(from, to, p);
    const odometer = el.dataset.odometer === 'true' || el.dataset.odometer === '1';
    if (odometer) {
      renderOdometer(el, v, to, decimals, prefix, suffix, sep);
    } else {
      let s = v.toFixed(decimals);
      if (sep) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
      el.textContent = prefix + s + suffix;
    }
  }

  // ---- Odometer renderer --------------------------------------
  // Each integer digit is a vertical 0..9 stack of glyphs whose Y
  // offset corresponds to the *continuous* value at that decimal
  // place — so we get true mechanical-odometer rolling.
  function renderOdometer(el, value, to, decimals, prefix, suffix, sep) {
    // Determine final digit string to size the columns
    const finalStr = formatNumber(to, decimals, '');
    const targetIntDigits = finalStr.replace(/[^\d]/g, '').length;
    // We don't pad with leading zeros — only as many digit columns
    // as the largest number needs.
    if (!el.__mvmOdomReady || el.__mvmOdomDigits !== targetIntDigits) {
      buildOdometer(el, targetIntDigits, decimals, prefix, suffix, sep);
      el.__mvmOdomReady = true;
      el.__mvmOdomDigits = targetIntDigits;
    }
    // Compute the current full integer / fractional string with sep
    const intPart = Math.floor(value);
    // String of the integer portion at most targetIntDigits long
    const intStr = String(intPart).padStart(targetIntDigits, '0');
    // For odometer rolling: each digit column's continuous value =
    // (value / 10^(position from right)) mod 10
    const cols = el.__mvmOdomCols;
    const positions = el.__mvmOdomDigitPositions;
    // Render: each digit column shows its current integer digit + a
    // small "flip" bump applied right after the digit changes.  This
    // gives a tactile "mechanical odometer" feel without depending on
    // the brittle overflow+transform stack-translation trick.
    const firstNonZero = intStr.search(/[1-9]/);
    cols.forEach((stack, idx) => {
      const pos = positions[idx];
      if (pos == null) return;
      const power = Math.pow(10, pos);
      // True digit at this position
      const dig = Math.floor(value / power) % 10;
      // Sub-unit progress at this position: how far we've gone toward the
      // NEXT carry.  Only flips visually when very close to the carry,
      // so stable values display flat.
      const subDigit = (value / power) % 1;
      // Map 0.82..1.0 → 0..1, else clamp to 0
      const flipFrac = subDigit > 0.82 ? (subDigit - 0.82) / 0.18 : 0;
      const face = stack.firstElementChild;
      if (face && face.textContent !== String(dig)) {
        face.textContent = String(dig);
      }
      const flip = Math.sin(flipFrac * Math.PI);
      const rot   = flip * 45;
      const scale = 1 - flip * 0.12;
      face.style.transformOrigin = '50% 50%';
      face.style.transform = `perspective(380px) rotateX(${-rot}deg) scale(${scale})`;
      face.style.opacity = String(1 - flip * 0.5);
      // Leading-zero handling
      const intIdx = countDigitsBefore(positions, idx);
      const shouldHide = (firstNonZero >= 0 && intIdx < firstNonZero) && intPart > 0;
      stack.parentElement.style.visibility = shouldHide ? 'hidden' : 'visible';
    });
    // Sync separators with their neighbour digit
    const wrap = el.firstElementChild;
    const seps = wrap ? wrap.querySelectorAll('.mvm-odom-sep') : [];
    seps.forEach(s => {
      const prev = s.previousElementSibling;
      if (prev && prev.classList.contains('mvm-odom-col')) {
        s.style.visibility = prev.style.visibility;
      }
    });
  }

  function countDigitsBefore(positions, idx) {
    let n = 0;
    for (let i = 0; i < idx; i++) if (positions[i] != null) n++;
    return n;
  }

  function decimalsCount(d) { return d || 0; }

  function formatNumber(v, decimals, sep) {
    let s = Number(v).toFixed(decimals);
    if (sep) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
    return s;
  }

  function buildOdometer(el, intDigits, decimals, prefix, suffix, sep) {
    el.innerHTML = '';
    el.style.lineHeight = '1';
    el.__mvmOdomCols = [];
    el.__mvmOdomDigitPositions = [];

    // Flex container so digit columns share a stable baseline
    const wrap = document.createElement('div');
    wrap.style.display = 'inline-flex';
    wrap.style.alignItems = 'flex-start';
    wrap.style.lineHeight = '1';
    el.appendChild(wrap);

    if (prefix) {
      const pre = document.createElement('div');
      pre.textContent = prefix;
      pre.style.lineHeight = '1';
      wrap.appendChild(pre);
    }

    for (let i = 0; i < intDigits; i++) {
      const placeFromRight = intDigits - 1 - i;
      if (sep && i > 0 && placeFromRight % 3 === 2) {
        const sepEl = document.createElement('div');
        sepEl.className = 'mvm-odom-sep';
        sepEl.textContent = sep;
        sepEl.style.lineHeight = '1';
        wrap.appendChild(sepEl);
        el.__mvmOdomCols.push(null);
        el.__mvmOdomDigitPositions.push(null);
      }
      // Each col is a block-level div with explicit width + height +
      // overflow:hidden so transformed children are reliably clipped
      // in every browser.
      const col = document.createElement('div');
      col.className = 'mvm-odom-col';
      col.style.height = '1em';
      col.style.minWidth = '0.62em';
      col.style.lineHeight = '1';
      col.style.overflow = 'hidden';
      col.style.position = 'relative';
      col.style.textAlign = 'center';
      col.style.flex = '0 0 auto';

      const stack = document.createElement('div');
      stack.className = 'mvm-odom-stack';
      stack.style.lineHeight = '1';
      stack.style.width = '100%';
      // Single child "face" — we update its textContent + transform
      // per-frame to simulate a mechanical odometer flip.
      const face = document.createElement('div');
      face.style.height = '1em';
      face.style.lineHeight = '1em';
      face.style.willChange = 'transform, opacity';
      face.textContent = '0';
      stack.appendChild(face);
      col.appendChild(stack);
      wrap.appendChild(col);
      el.__mvmOdomCols.push(stack);
      el.__mvmOdomDigitPositions.push(placeFromRight);
    }

    if (suffix) {
      const suf = document.createElement('div');
      suf.textContent = suffix;
      suf.style.lineHeight = '1';
      wrap.appendChild(suf);
    }
  }

  // ---- Shuffle ----------------------------------------------
  function applyShuffleText(el, t) {
    const start = parseFloat(el.dataset.start) || 0;
    const dur = compDur(el, 1.4);
    if (!el.dataset.text) el.dataset.text = el.textContent;
    const target = el.dataset.text;
    const local = t - start;
    if (local <= 0) { el.textContent = ''; return; }
    if (local >= dur) { el.textContent = target; return; }
    const p = clamp01(local / dur);
    let out = '';
    for (let i = 0; i < target.length; i++) {
      const charProgress = clamp01((p - i / target.length * 0.6) * 3);
      if (target[i] === ' ' || target[i] === '\n') { out += target[i]; continue; }
      if (charProgress >= 1) out += target[i];
      else {
        const idx = Math.floor(((Math.sin(i * 9.7 + t * 90) * 10000) % SCRAMBLE_GLYPHS.length + SCRAMBLE_GLYPHS.length) % SCRAMBLE_GLYPHS.length);
        out += SCRAMBLE_GLYPHS[idx];
      }
    }
    el.textContent = out;
  }

  // ============== NEW TEXT ANIMATIONS (diversification pack) ====

  // ---- mask-text -----------------------------------------------
  // Whole-text mask reveal — wipe direction set by data-mask-from
  // ("left" / "right" / "top" / "bottom" / "center").  Looks great
  // for big editorial headlines.
  function applyMaskText(el, t) {
    const start = parseFloat(el.dataset.start) || 0;
    const dur = compDur(el, 1.0);
    const ease = E[el.dataset.easing || 'easeInOutQuart'];
    const from = el.dataset.maskFrom || 'left';
    const local = t - start;
    if (local <= 0) { el.style.clipPath = 'inset(0 100% 0 0)'; el.style.opacity = '1'; return; }
    if (local >= dur) { el.style.clipPath = 'none'; return; }
    const p = ease(clamp01(local / dur));
    let cp;
    switch (from) {
      case 'right':  cp = `inset(0 0 0 ${(1 - p) * 100}%)`; break;
      case 'top':    cp = `inset(${(1 - p) * 100}% 0 0 0)`; break;
      case 'bottom': cp = `inset(0 0 ${(1 - p) * 100}% 0)`; break;
      case 'center': cp = `inset(0 ${(1 - p) * 50}% 0 ${(1 - p) * 50}%)`; break;
      default:       cp = `inset(0 ${(1 - p) * 100}% 0 0)`;
    }
    el.style.clipPath = cp;
    el.style.opacity = '1';
  }

  // ---- wave-text -----------------------------------------------
  // Per-char vertical sine wave that travels left→right; characters
  // animate in by riding the crest.
  function applyWaveText(el, t) {
    const start = parseFloat(el.dataset.start) || 0;
    const stagger = parseFloat(el.dataset.stagger) || 0.04;
    const charDur = parseFloat(el.dataset.charDuration) || 0.6;
    const amp     = parseFloat(el.dataset.amplitude) || 40;
    const wave    = parseFloat(el.dataset.wave) || 1.2;
    const ease    = E[el.dataset.easing || 'easeOutQuart'];
    splitChars(el, el.dataset.splitMode || 'char');
    const chars = el.querySelectorAll('.mvm-char');
    const local = t - start;
    chars.forEach((c, i) => {
      const charStart = i * stagger;
      const p = ease(clamp01((local - charStart) / charDur));
      const wavePh = (local - charStart) * wave;
      const lift = Math.sin(wavePh * Math.PI * 2) * Math.exp(-Math.max(0, local - charStart - charDur) * 4);
      c.style.opacity = String(p);
      c.style.display = 'inline-block';
      c.style.transform = `translate3d(0, ${(1 - p) * amp + lift * 18}px, 0)`;
    });
  }

  // ---- scramble-text -------------------------------------------
  // Like shuffle-text but with full Latin/digit/symbol scramble,
  // and the reveal sweeps left→right while later positions cycle
  // glyphs more rapidly.  Use for short technical phrases.
  function applyScrambleText(el, t) {
    const start = parseFloat(el.dataset.start) || 0;
    const dur = compDur(el, 1.6);
    if (!el.dataset.text) el.dataset.text = el.textContent;
    const target = el.dataset.text;
    const local = t - start;
    if (local <= 0) { el.textContent = ''.padEnd(target.length, ' '); return; }
    if (local >= dur) { el.textContent = target; return; }
    const p = clamp01(local / dur);
    const glyphs = '!@#$%&*+=<>?{}[]/\\|01101001';
    let out = '';
    for (let i = 0; i < target.length; i++) {
      const ch = target[i];
      if (ch === ' ' || ch === '\n') { out += ch; continue; }
      const charP = clamp01((p - (i / target.length) * 0.5) * 2.5);
      if (charP >= 1) {
        out += ch;
      } else {
        // pick a glyph deterministically from t and position
        const seed = Math.floor(t * 60 + i * 17);
        const idx = ((seed * 2654435761) >>> 0) % glyphs.length;
        out += glyphs[idx];
      }
    }
    el.textContent = out;
  }

  // ============== BACKGROUNDS ===================================

  // Each background component initializes once and updates per-tick
  function getCanvas(el) {
    let c = el.querySelector('canvas.mvm-bg-canvas');
    if (!c) {
      c = document.createElement('canvas');
      c.className = 'mvm-bg-canvas';
      c.style.position = 'absolute';
      c.style.inset = '0';
      c.style.width = '100%';
      c.style.height = '100%';
      c.style.display = 'block';
      // Only set position if the element is currently `static` —
      // never trample an author's (or CSS's) `absolute` / `fixed`.
      if (getComputedStyle(el).position === 'static') {
        el.style.position = 'relative';
      }
      el.appendChild(c);
    }
    // sync resolution
    const w = el.clientWidth || 1920;
    const h = el.clientHeight || 1080;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return c;
  }

  // ---- Particles ----------------------------------------------
  function applyParticles(el, t) {
    const c = getCanvas(el);
    const ctx = c.getContext('2d');
    const N = parseInt(el.dataset.count, 10) || 90;
    const color = el.dataset.color || 'rgba(255,255,255,0.9)';
    const baseSize = parseFloat(el.dataset.size) || 2.2;
    if (!el.__mvmParticles) {
      const rng = mulberry32(parseInt(el.dataset.seed, 10) || 1337);
      el.__mvmParticles = Array.from({ length: N }, () => ({
        x: rng(), y: rng(),
        vx: (rng() - 0.5) * 0.04,
        vy: (rng() - 0.5) * 0.04,
        r: 0.4 + rng() * 1.6,
        ph: rng() * Math.PI * 2,
      }));
    }
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = color;
    el.__mvmParticles.forEach(p => {
      const x = ((p.x + p.vx * t) % 1 + 1) % 1 * c.width;
      const y = ((p.y + p.vy * t) % 1 + 1) % 1 * c.height;
      const a = 0.4 + 0.6 * (Math.sin(t * 1.7 + p.ph) * 0.5 + 0.5);
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(x, y, p.r * baseSize, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  // ---- Star Field (galaxy) ------------------------------------
  function applyStarField(el, t) {
    const c = getCanvas(el);
    const ctx = c.getContext('2d');
    const N = parseInt(el.dataset.count, 10) || 240;
    const speed = parseFloat(el.dataset.speed) || 0.6;
    if (!el.__mvmStars) {
      const rng = mulberry32(parseInt(el.dataset.seed, 10) || 7331);
      el.__mvmStars = Array.from({ length: N }, () => ({
        x: rng() - 0.5, y: rng() - 0.5,
        z: rng(),
        b: 0.5 + rng() * 0.5,
      }));
    }
    ctx.fillStyle = el.dataset.bg || 'rgba(5,7,18,0.4)';
    ctx.fillRect(0, 0, c.width, c.height);
    const cx = c.width / 2, cy = c.height / 2;
    el.__mvmStars.forEach(s => {
      const z = (s.z + t * speed * 0.05) % 1;
      const k = 1 / (1 - z);
      const x = cx + s.x * c.width * k;
      const y = cy + s.y * c.height * k;
      if (x < 0 || x > c.width || y < 0 || y > c.height) return;
      const r = Math.max(0.2, k * 1.2);
      const a = s.b * (z * 0.9 + 0.1);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ---- Aurora gradient ----------------------------------------
  function applyAurora(el, t) {
    const c = getCanvas(el);
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    // Honor data-palette (named preset, looked up via shaders.js)
    // before falling back to the canvas-bg specific default.
    const colors = (
      el.dataset.colors ||
      (window.__mvmShaders && window.__mvmShaders.resolvePalette(el.dataset.palette)) ||
      '#3a1c71,#d76d77,#ffaf7b,#3a1c71'
    ).split(',');
    // Animated radial gradient stops
    ctx.fillStyle = '#06060c';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < colors.length; i++) {
      const x = w * (0.5 + Math.sin(t * 0.4 + i * 1.7) * 0.4);
      const y = h * (0.5 + Math.cos(t * 0.3 + i * 2.1) * 0.4);
      const r = Math.max(w, h) * 0.55;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, colors[i] + 'b8');
      g.addColorStop(1, colors[i] + '00');
      ctx.fillStyle = g;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---- Threads (sinusoidal lines) -----------------------------
  function applyThreads(el, t) {
    const c = getCanvas(el);
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    ctx.fillStyle = el.dataset.bg || '#0a0a14';
    ctx.fillRect(0, 0, w, h);
    const lines = parseInt(el.dataset.lines, 10) || 60;
    const color = el.dataset.color || 'rgba(180,200,255,0.18)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    for (let i = 0; i < lines; i++) {
      ctx.beginPath();
      const yBase = (i / lines) * h;
      for (let x = 0; x <= w; x += 12) {
        const y = yBase
          + Math.sin((x / w) * Math.PI * 3 + t * 0.6 + i * 0.18) * 20
          + Math.sin((x / w) * Math.PI * 7 + t * 0.9 + i * 0.32) * 8;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  // ---- Letter Glitch (matrix-style) ----------------------------
  function applyLetterGlitch(el, t) {
    const c = getCanvas(el);
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    const cell = parseInt(el.dataset.cell, 10) || 22;
    const cols = Math.ceil(w / cell);
    const rows = Math.ceil(h / cell);
    ctx.fillStyle = el.dataset.bg || '#04060a';
    ctx.fillRect(0, 0, w, h);
    ctx.font = `${cell - 6}px "JetBrains Mono", "Courier New", monospace`;
    ctx.textBaseline = 'top';
    const colors = (el.dataset.colors || '#00ff9c,#2af598,#009efd,#5b86e5').split(',');
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        // Deterministic per-cell hash + time
        const seed = (x * 73856093 ^ y * 19349663);
        const slot = Math.floor(t * 6 + ((seed >>> 0) % 17));
        const k = Math.abs(Math.sin(seed + slot)) ;
        const a = 0.15 + k * 0.75;
        const ch = SCRAMBLE_GLYPHS[(seed + slot * 7) % SCRAMBLE_GLYPHS.length] || '0';
        ctx.fillStyle = colors[(seed + slot) % colors.length] + Math.floor(a * 255).toString(16).padStart(2, '0');
        ctx.fillText(ch, x * cell + 3, y * cell + 3);
      }
    }
  }

  // ---- Waves ---------------------------------------------------
  function applyWaves(el, t) {
    const c = getCanvas(el);
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    ctx.fillStyle = el.dataset.bg || '#070716';
    ctx.fillRect(0, 0, w, h);
    const colors = (el.dataset.colors || '#7F7FD5,#86A8E7,#91EAE4').split(',');
    for (let layer = 0; layer < 3; layer++) {
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) {
        const y = h * 0.5
          + Math.sin((x / w) * Math.PI * 2 + t * 0.4 + layer * 1.3) * (40 + layer * 20)
          + Math.sin((x / w) * Math.PI * 5 + t * 0.7 + layer * 0.6) * (12 + layer * 6)
          + layer * 60;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, colors[layer] + 'd0');
      grad.addColorStop(1, colors[layer] + '20');
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  // ---- Hyperspeed (radial speed lines) ------------------------
  function applyHyperspeed(el, t) {
    const c = getCanvas(el);
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    const N = parseInt(el.dataset.count, 10) || 220;
    ctx.fillStyle = 'rgba(2,4,12,0.3)';
    ctx.fillRect(0, 0, w, h);
    if (!el.__mvmHS) {
      const rng = mulberry32(parseInt(el.dataset.seed, 10) || 9001);
      el.__mvmHS = Array.from({ length: N }, () => ({
        a: rng() * Math.PI * 2,
        z: rng(),
        s: 0.4 + rng() * 0.8,
      }));
    }
    const cx = w / 2, cy = h / 2;
    const colors = (el.dataset.colors || '#ffffff,#ffd8a8,#ffe2b3').split(',');
    el.__mvmHS.forEach((p, i) => {
      const z = (p.z + t * p.s * 0.5) % 1;
      const r1 = Math.pow(z, 2) * Math.max(w, h);
      const r2 = Math.pow(Math.min(1, z + 0.04), 2) * Math.max(w, h);
      const x1 = cx + Math.cos(p.a) * r1;
      const y1 = cy + Math.sin(p.a) * r1;
      const x2 = cx + Math.cos(p.a) * r2;
      const y2 = cy + Math.sin(p.a) * r2;
      ctx.strokeStyle = colors[i % colors.length] + Math.floor(z * 255).toString(16).padStart(2, '0');
      ctx.lineWidth = Math.max(1, z * 2);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });
  }

  // ---- Dot Grid -----------------------------------------------
  function applyDotGrid(el, t) {
    const c = getCanvas(el);
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    ctx.fillStyle = el.dataset.bg || '#0a0c14';
    ctx.fillRect(0, 0, w, h);
    const gap = parseInt(el.dataset.gap, 10) || 28;
    const color = el.dataset.color || '#5b86e5';
    for (let y = gap / 2; y < h; y += gap) {
      for (let x = gap / 2; x < w; x += gap) {
        const dx = x - w / 2, dy = y - h / 2;
        const d = Math.sqrt(dx * dx + dy * dy);
        const wave = Math.sin(d * 0.012 - t * 1.6) * 0.5 + 0.5;
        const r = 0.6 + wave * 2.4;
        const a = 0.2 + wave * 0.7;
        ctx.fillStyle = color + Math.floor(a * 255).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ---- Clock face (analog) ------------------------------------
  function applyClock(el, t) {
    const c = getCanvas(el);
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const radius = Math.min(w, h) * 0.42;
    const speed = parseFloat(el.dataset.speed) || 1;
    const start = parseFloat(el.dataset.start) || 0;
    const tt = (t - start) * speed;
    // outer ring
    ctx.strokeStyle = el.dataset.ring || '#ffffff60';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    // tick marks
    ctx.lineWidth = 2;
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
      const r1 = radius * (i % 5 === 0 ? 0.88 : 0.93);
      const r2 = radius * 0.99;
      ctx.strokeStyle = i % 5 === 0 ? '#ffffffcc' : '#ffffff66';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }
    // hands: seconds, minutes, hours
    const sa = (tt * Math.PI * 2) - Math.PI / 2;
    const ma = ((tt / 60) * Math.PI * 2) - Math.PI / 2;
    const ha = ((tt / 3600) * Math.PI * 2 * 12) - Math.PI / 2;
    drawHand(ctx, cx, cy, ha, radius * 0.55, 6, '#ffffff');
    drawHand(ctx, cx, cy, ma, radius * 0.78, 4, '#ffffff');
    drawHand(ctx, cx, cy, sa, radius * 0.92, 2, '#ff5577');
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff5577';
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
  }
  function drawHand(ctx, cx, cy, a, len, w, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(a) * len * 0.1, cy - Math.sin(a) * len * 0.1);
    ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    ctx.stroke();
  }

  // ---- Magnet Lines (vector field) ----------------------------
  // A grid of short line segments that align with a time-varying
  // vector field (multiple moving "poles" attract / repel).
  function applyMagnetLines(el, t) {
    const c = getCanvas(el);
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    ctx.fillStyle = el.dataset.bg || '#0a0a14';
    ctx.fillRect(0, 0, w, h);
    const gap = parseInt(el.dataset.gap, 10) || 60;
    const len = parseFloat(el.dataset.length) || 26;
    const colors = (el.dataset.colors || '#5BC0EB,#9d8df1').split(',');
    const poles = parseInt(el.dataset.poles, 10) || 3;

    // Animated pole positions (deterministic from seed)
    const pps = [];
    for (let i = 0; i < poles; i++) {
      const ph = i * 1.7;
      pps.push([
        w * (0.5 + 0.35 * Math.sin(t * 0.4 + ph)),
        h * (0.5 + 0.35 * Math.cos(t * 0.3 + ph * 1.3)),
      ]);
    }

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let y = gap; y < h; y += gap) {
      for (let x = gap; x < w; x += gap) {
        // Sum vector contributions from poles (1/r falloff)
        let vx = 0, vy = 0;
        for (let i = 0; i < poles; i++) {
          const dx = pps[i][0] - x, dy = pps[i][1] - y;
          const d2 = Math.max(2000, dx * dx + dy * dy);
          const inv = 1 / Math.sqrt(d2);
          vx += dx * inv;
          vy += dy * inv;
        }
        const vl = Math.sqrt(vx * vx + vy * vy) || 1;
        vx = vx / vl * len;
        vy = vy / vl * len;
        // Color cycles through the palette
        const cIdx = Math.floor(((x * 73856093) ^ (y * 19349663)) >>> 0) % colors.length;
        ctx.strokeStyle = colors[cIdx];
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(x - vx / 2, y - vy / 2);
        ctx.lineTo(x + vx / 2, y + vy / 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- Ribbons (flowing parametric ribbons) -------------------
  function applyRibbons(el, t) {
    const c = getCanvas(el);
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    ctx.fillStyle = el.dataset.bg || '#08081a';
    ctx.fillRect(0, 0, w, h);
    const ribbonCount = parseInt(el.dataset.count, 10) || 5;
    const colors = (el.dataset.colors || '#FF6363,#5BC0EB,#9d8df1,#FFD400,#2af598').split(',');

    for (let r = 0; r < ribbonCount; r++) {
      const baseY = h * (0.2 + r * 0.16);
      const amp = 60 + r * 20;
      const phase = r * 1.7 + t * 0.6;
      // Build a smooth ribbon path; render with width modulation
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const x = (i / 80) * w;
        const y = baseY
          + amp * Math.sin((x / w) * Math.PI * 2 + phase)
          + 30 * Math.sin((x / w) * Math.PI * 5 + phase * 1.3)
          + 12 * Math.sin((x / w) * Math.PI * 11 + phase * 2.0);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      // Stroke with 3 widths to create a glow
      const col = colors[r % colors.length];
      [
        { lw: 28, a: 0.06 },
        { lw: 14, a: 0.15 },
        { lw: 6,  a: 0.35 },
        { lw: 2,  a: 0.85 },
      ].forEach(({ lw, a }) => {
        ctx.strokeStyle = withAlpha(col, a);
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      });
    }
  }

  function withAlpha(hex, a) {
    const h = hex.replace('#', '');
    const n = h.length === 3
      ? [h[0]+h[0], h[1]+h[1], h[2]+h[2]]
      : [h.slice(0,2), h.slice(2,4), h.slice(4,6)];
    return `rgba(${parseInt(n[0],16)},${parseInt(n[1],16)},${parseInt(n[2],16)},${a})`;
  }

  // ---- Film grain noise overlay -------------------------------
  function applyNoise(el, t) {
    const c = getCanvas(el);
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    const id = ctx.createImageData(Math.ceil(w / 2), Math.ceil(h / 2));
    const data = id.data;
    const strength = parseFloat(el.dataset.strength) || 18;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.sin(i * 12.9898 + t * 78.233) * 43758.5453) % 1;
      const v = 128 + n * strength;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 28;
    }
    // upscale via temp canvas
    const tmp = document.createElement('canvas');
    tmp.width = id.width; tmp.height = id.height;
    tmp.getContext('2d').putImageData(id, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, w, h);
  }

  // ============== Mulberry32 PRNG (deterministic) ===============
  function mulberry32(a) {
    return function () {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ============== Register and wire up =========================
  const TEXT = {
    'split-text': applySplitText,
    'blur-text': applyBlurText,
    'shiny-text': applyShinyText,
    'gradient-text': applyGradientText,
    'glitch-text': applyGlitchText,
    'decrypted-text': applyDecryptedText,
    'type-text': applyTypeText,
    'typewriter': applyTypeText,
    'rotating-text': applyRotatingText,
    'count-up': applyCountUp,
    'shuffle-text': applyShuffleText,
    'mask-text': applyMaskText,
    'wave-text': applyWaveText,
    'scramble-text': applyScrambleText,
  };
  const BG = {
    'particles': applyParticles,
    'starfield': applyStarField,
    'aurora': applyAurora,
    'threads': applyThreads,
    'letter-glitch': applyLetterGlitch,
    'waves': applyWaves,
    'hyperspeed': applyHyperspeed,
    'dot-grid': applyDotGrid,
    'noise': applyNoise,
    'magnet-lines': applyMagnetLines,
    'ribbons': applyRibbons,
  };
  const FX = {
    'clock': applyClock,
  };

  // Discover at first seek; cache.
  let cachedTextEls = null;
  let cachedBgEls = null;
  let cachedFxEls = null;
  function refreshCache() {
    cachedTextEls = Array.from(document.querySelectorAll('[data-text-animation]'));
    cachedBgEls = Array.from(document.querySelectorAll('[data-background]'));
    cachedFxEls = Array.from(document.querySelectorAll('[data-fx]'));
  }

  window.addEventListener('mvm-seek', (e) => {
    if (!cachedTextEls) refreshCache();
    const t = e.detail.time;
    cachedBgEls.forEach(el => { const fn = BG[el.dataset.background]; if (fn) fn(el, t); });
    cachedTextEls.forEach(el => { const fn = TEXT[el.dataset.textAnimation]; if (fn) fn(el, t); });
    cachedFxEls.forEach(el => { const fn = FX[el.dataset.fx]; if (fn) fn(el, t); });
  });

  // Expose for advanced authors
  window.__mvm.components = { TEXT, BG, FX, refresh: refreshCache };
})();
