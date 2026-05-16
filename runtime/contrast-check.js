/**
 * motion-video-maker / contrast-check.js
 * ----------------------------------------------------------------
 * Auto-detects "invisible text" — elements where the computed text
 * color and the *effective* background color are within ΔL < 0.25
 * (very low luminance contrast).
 *
 * Why this exists:
 * Other agents authoring compositions sometimes give an element a
 * `background-color: white` without remembering to also set
 * `color: black`, producing text that is invisible against its own
 * background.  This script logs ONE actionable warning per offending
 * element so the issue surfaces immediately during preview/render
 * instead of after a 5-minute MP4 export.
 *
 * Runs lazily — first scan happens on the first `mvm-seek` event,
 * then re-runs roughly every 0.5s of timeline progression.  All
 * findings are printed to `console.warn` so they are captured by
 * `render.mjs`.
 */
(function () {
  'use strict';

  // Parse "rgb(r, g, b)" / "rgba(...)" → [r, g, b, a]
  function parseColor(s) {
    if (!s) return null;
    if (s === 'transparent') return [0, 0, 0, 0];
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(',').map(p => parseFloat(p.trim()));
    return [parts[0], parts[1], parts[2], parts[3] == null ? 1 : parts[3]];
  }

  function relLuminance([r, g, b]) {
    const s = [r, g, b].map(v => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
  }

  // WCAG 2 contrast ratio
  function contrast(c1, c2) {
    const L1 = relLuminance(c1);
    const L2 = relLuminance(c2);
    const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
    return (hi + 0.05) / (lo + 0.05);
  }

  // Walk up parents until we find a non-transparent background. Falls
  // back to body bg → stage var → black.
  function effectiveBg(el) {
    let cur = el;
    while (cur && cur !== document.documentElement) {
      const bg = parseColor(getComputedStyle(cur).backgroundColor);
      if (bg && bg[3] > 0.1) return bg;
      cur = cur.parentElement;
    }
    return [10, 10, 15, 1]; // fallback to --mvm-bg
  }

  // Detect "did the author hide text on purpose?" — opacity 0,
  // visibility hidden, or display none ⇒ skip.
  function isVisuallyHidden(el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none') return true;
    if (cs.visibility === 'hidden') return true;
    if (parseFloat(cs.opacity) < 0.05) return true;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return true;
    return false;
  }

  // Element actually has visible text (not just a flex container)
  function hasOwnText(el) {
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
        return true;
      }
    }
    return false;
  }

  // Gradient-fill text (background-clip: text + transparent color)
  // skips contrast checks because the visible color is the background
  // image, not the computed `color`.
  function isGradientText(cs) {
    if (cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)' || cs.color === 'rgba(0, 0, 0, 0)') {
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;
    }
    return false;
  }

  const seen = new Set();   // dedupe — one warning per element
  const MIN_RATIO = 2.2;    // anything under is "essentially invisible"

  function scan() {
    const stage = document.getElementById('stage');
    if (!stage) return;
    const all = stage.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,div,li,strong,em,b,i,a,code,figcaption,button,label,td,th,caption,small');
    let issues = 0;
    for (const el of all) {
      if (seen.has(el)) continue;
      if (!hasOwnText(el)) continue;
      if (isVisuallyHidden(el)) continue;
      const cs = getComputedStyle(el);
      if (isGradientText(cs)) continue;
      const fg = parseColor(cs.color);
      if (!fg || fg[3] < 0.2) continue;       // text already transparent — author choice
      const bg = effectiveBg(el);
      if (!bg) continue;
      const ratio = contrast(fg, bg);
      if (ratio < MIN_RATIO) {
        const tag = el.tagName.toLowerCase();
        const cls = el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).slice(0, 2).join('.') : '';
        const id = el.id ? '#' + el.id : '';
        const txt = (el.textContent || '').trim().slice(0, 40).replace(/\s+/g, ' ');
        // eslint-disable-next-line no-console
        console.warn(
          `[mvm-contrast] LOW CONTRAST ${ratio.toFixed(2)}:1 — ` +
          `text "${txt}" (color ${cs.color}) on background rgba(${bg.join(',')}) ` +
          `at <${tag}${id}${cls}>. ` +
          `Fix: add .mvm-light / .mvm-card-dark, or set color/background explicitly.`
        );
        seen.add(el);
        issues++;
        if (issues >= 12) { // cap output to avoid log flooding
          console.warn('[mvm-contrast] ... more low-contrast elements suppressed.');
          return;
        }
      }
    }
  }

  let lastScanTime = -1;
  window.addEventListener('mvm-seek', (e) => {
    const t = e.detail.time;
    // First scan at t=0, then every ~0.5s of timeline progression
    if (lastScanTime < 0 || Math.abs(t - lastScanTime) > 0.5) {
      lastScanTime = t;
      // Defer one microtask so component-driven DOM (odometer columns,
      // type-text expansions) is up to date.
      Promise.resolve().then(scan);
    }
  });

  window.__mvmContrastCheck = { scan, MIN_RATIO };
})();
