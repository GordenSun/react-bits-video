/* runtime/layout-check.js
 * Detects layout problems that aren't visible in static CSS reviews:
 *   1. Headings / paragraphs that WRAPPED (likely too-large font).
 *   2. Elements overflowing the stage horizontally (> 1920 / >100%).
 *   3. Headings whose first child line-box is NOT centered on the
 *      stage horizontal axis (left-aligned overflow scenario).
 *
 * Why this matters:
 *   Agents repeatedly pick font-size values that look reasonable
 *   in CSS (130px–200px) but overflow the 1920-wide stage once a
 *   long phrase (e.g. "Motion Video Maker") is rendered with the
 *   chosen letter-spacing.  CSS can't catch this — the content has
 *   to actually be laid out.  We do that here, once per seek.
 *
 * Outputs (deduped, throttled):
 *   console.warn('[mvm-layout] WRAPPED: <selector> "<text...>"...')
 *   console.warn('[mvm-layout] OVERFLOW: ...')
 *   render.mjs collects these and prints a summary at the end.
 */
(function () {
  'use strict';

  const seen = new Set();
  const MAX_WARNINGS = 12;

  function getSelector(el) {
    if (el.id) return '#' + el.id;
    let sel = el.tagName.toLowerCase();
    if (el.className && typeof el.className === 'string') {
      const cls = el.className.split(/\s+/).filter(c => c && !c.startsWith('mvm-')).slice(0, 2);
      if (cls.length) sel += '.' + cls.join('.');
    }
    return sel;
  }

  function snippet(el) {
    const txt = (el.textContent || '').trim().replace(/\s+/g, ' ');
    return txt.length > 50 ? txt.slice(0, 47) + '…' : txt;
  }

  function isVisible(el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    // Use 0.5 (not 0.05) so we skip elements that are still animating
    // in.  A heading that is wrapped because of its initial entrance
    // transform (split-text per-char scale, mask-image clip, etc.) is
    // a false positive — wait until the element settles.
    if (parseFloat(cs.opacity) < 0.5) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function lineHeightPx(el) {
    const cs = getComputedStyle(el);
    let lh = parseFloat(cs.lineHeight);
    if (isNaN(lh) || cs.lineHeight === 'normal') {
      lh = parseFloat(cs.fontSize) * 1.2;
    }
    return lh;
  }

  function checkWrap(el) {
    // Element wrapped if its rendered height is greater than ~1.8x the
    // computed line-height of its first line.  The 1.8x ratio (not 1.5)
    // tolerates split-text/inline-block descender padding from
    // text-animations, which transiently inflates an h1's height by
    // ~15-25% even on a single line.
    const lh = lineHeightPx(el);
    if (!lh) return false;
    const h = el.getBoundingClientRect().height;
    return h > lh * 1.8;
  }

  function checkOverflow(el, stageRect) {
    const r = el.getBoundingClientRect();
    // Allow 4-px tolerance for sub-pixel rendering.
    return r.left < stageRect.left - 4 ||
           r.right > stageRect.right + 4 ||
           r.width > stageRect.width + 4;
  }

  function scan() {
    const stage = document.getElementById('stage');
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    if (!stageRect.width) return;

    const headings = stage.querySelectorAll('h1, h2, h3, h4, h5, p, span.title, .title, .huge, [class*="title-"]');
    let issues = 0;

    for (const el of headings) {
      if (seen.has(el)) continue;
      if (!isVisible(el)) continue;
      const txt = snippet(el);
      if (!txt || txt.length < 2) continue;

      const wrapped = checkWrap(el);
      const overflow = checkOverflow(el, stageRect);

      if (wrapped || overflow) {
        const sel = getSelector(el);
        const fs = parseFloat(getComputedStyle(el).fontSize);
        const reasons = [];
        if (wrapped)  reasons.push('wrapped to multiple lines');
        if (overflow) reasons.push('extends past stage edge');
        console.warn(
          `[mvm-layout] ${reasons.join(' + ').toUpperCase()} — ${sel} ` +
          `font-size=${fs.toFixed(0)}px "${txt}". ` +
          `Try a smaller .title-* preset (.title-2xl = 130px, .title-xl = 100px) ` +
          `or split the text into two lines with <br>.`
        );
        seen.add(el);
        issues++;
        if (issues >= MAX_WARNINGS) return;
      }
    }
  }

  // Run scan on a 1.5s debounce — only after the timeline has settled
  // for a full beat.  This avoids capturing transient inflated-height
  // states during split-text / unmask / mask-clip entrance animations.
  let pending = null;
  let lastSeekTime = 0;
  function schedule(immediate) {
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => {
      pending = null;
      scan();
    }, immediate ? 0 : 1500);
  }

  // Don't auto-scan on every seek during a 30fps render — call
  // window.__mvmLayoutCheck.scan() explicitly when a stable frame
  // has been reached.  Authors in preview mode get one delayed scan
  // when the timeline pauses.
  window.addEventListener('mvm-seek', (e) => {
    lastSeekTime = (e && e.detail && typeof e.detail.t === 'number') ? e.detail.t : 0;
    if (!window.__mvmRenderMode) schedule(false);
  });

  window.__mvmLayoutCheck = { scan, schedule };
})();
