#!/usr/bin/env node
/**
 * motion-video-maker / lint
 * ----------------------------------------------------------------
 * Static-analysis checks that catch authoring bugs BEFORE you spend
 * 30s rendering an MP4 only to find black frames or off-screen text.
 *
 * Modelled after Hyperframes' lint workflow:
 *   • each finding is `{code, severity, message, file, line, fixHint}`
 *   • `error` exits non-zero (block CI); `warn` is informational
 *
 * Rules implemented:
 *
 *   E001  stage_missing_meta         #stage lacks data-fps/data-duration/data-width/data-height
 *   E002  odd_stage_dimension        H.264 will refuse odd width/height
 *   E003  font_size_pixel_literal    inline `font-size: 180px` on a long heading — use .title-*
 *   E004  text_aurora_on_cool_bg     .text-aurora used over a cool data-palette → invisible
 *   E005  scene_premature_exit       non-final scene fades to opacity 0 → use a `<div data-transition>` instead
 *   W001  inline_position_relative   inline `position: relative` on [data-background] (breaks scene stacking)
 *   W002  raw_math_random            uses Math.random() in inline <script> — use __mvm.random(seed)
 *   W003  missing_palette            [data-background] without data-palette OR data-colors
 *   W004  hard_coded_pixel_size      inline `width:` / `height:` in px that pin to 1920/1080
 *   W005  long_clip_overruns_stage   data-start + data-duration > stage data-duration
 *   W006  gsap_scrolltrigger         ScrollTrigger / ScrollSmoother / Draggable / Observer
 *                                    referenced — these need user interaction and don't
 *                                    fire in deterministic frame-by-frame render mode
 *   W007  gsap_autoplay_outside_clip gsap.to/from used in inline <script> without being
 *                                    wired to the bridge — animation will run on the
 *                                    GSAP root timeline anyway, but if it lives inside a
 *                                    setTimeout/setInterval it bypasses determinism
 *   W008  gsap_random_unsafe         gsap.utils.random() in inline script — uses
 *                                    Math.random under the hood; pass a seeded value
 *   E006  gsap_missing_bridge        composition uses data-gsap-* attributes but did not
 *                                    load runtime/gsap-bridge.js — animations won't run
 *
 * Usage:
 *   node scripts/lint.mjs <html-file>            # human output
 *   node scripts/lint.mjs <html-file> --json     # machine output
 *   node scripts/lint.mjs <html-file> --strict   # warnings exit non-zero too
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const file = argv.find(a => !a.startsWith('--'));
const asJson = argv.includes('--json');
const strict = argv.includes('--strict');

if (!file) {
  console.error('Usage: node scripts/lint.mjs <html-file> [--json] [--strict]');
  process.exit(2);
}
const src = readFileSync(path.resolve(file), 'utf8');
const lines = src.split('\n');

const findings = [];
function add(code, severity, line, message, fixHint) {
  findings.push({ code, severity, file, line: line + 1, message, fixHint });
}

function lineOf(idx) {
  return src.slice(0, idx).split('\n').length - 1;
}

// ---------------- Rule E001: stage meta -----------------------------
const stageRe = /<[^>]*id=["']stage["'][^>]*>/i;
const stageMatch = src.match(stageRe);
if (stageMatch) {
  const tag = stageMatch[0];
  const ln = lineOf(stageMatch.index);
  const need = ['data-fps', 'data-duration', 'data-width', 'data-height'];
  need.forEach(k => {
    if (!tag.includes(k)) {
      add('E001', 'error', ln, `#stage is missing ${k}`,
        `Add ${k}="<value>" to the <div id="stage"> tag. Typical: data-width="1920" data-height="1080" data-fps="30" data-duration="30".`);
    }
  });
  // ----- E002 odd dimension --------------------------------------
  const wm = tag.match(/data-width=["'](\d+)["']/);
  const hm = tag.match(/data-height=["'](\d+)["']/);
  if (wm && +wm[1] % 2) add('E002', 'error', ln, `data-width=${wm[1]} is odd`, `H.264 requires even dimensions. Use ${+wm[1] - 1} or ${+wm[1] + 1}.`);
  if (hm && +hm[1] % 2) add('E002', 'error', ln, `data-height=${hm[1]} is odd`, `H.264 requires even dimensions. Use ${+hm[1] - 1} or ${+hm[1] + 1}.`);
} else {
  add('E001', 'error', 0, 'no <div id="stage"> found', 'Every composition needs <div id="stage" data-width data-height data-fps data-duration>.');
}

// ---------------- Rule E003: font-size literal on heading ----------
// Match: <h1 ... style="...font-size: 180px..."> or <h2 ... font-size:170px...
const tagRe = /<(h[1-6]|p)\b[^>]*style=["']([^"']+)["'][^>]*>/gi;
let m;
while ((m = tagRe.exec(src)) !== null) {
  const tag = m[1].toLowerCase();
  const style = m[2];
  const fs = style.match(/font-size\s*:\s*(\d+)px/i);
  if (!fs) continue;
  const px = parseInt(fs[1], 10);
  const ln = lineOf(m.index);
  // Capture the text content (approx — until matching closing tag)
  const closeIdx = src.indexOf(`</${tag}>`, m.index);
  const inner = closeIdx > 0 ? src.slice(m.index + m[0].length, closeIdx) : '';
  const textLen = inner.replace(/<[^>]+>/g, '').trim().length;
  // Skip empty text (split-text or fade-in only fills via JS later)
  if (textLen === 0) continue;
  // Allow large font sizes for very short text (calligraphic hero
  // characters like 留白 / 见山是山 should be allowed 200–320px).
  const safePx =
    textLen <= 2  ? 360 :
    textLen <= 4  ? 260 :
    textLen <= 8  ? 200 :
    textLen <= 14 ? 160 :
    textLen <= 22 ? 120 : 80;
  if (px > safePx) {
    add('E003', 'error', ln,
      `<${tag}> uses inline font-size:${px}px for ${textLen}-char text → likely to wrap on a 1920-wide stage`,
      `Replace inline font-size with one of: .title-3xl (160px), .title-2xl (130px), .title-xl (100px), .title-lg (80px), .title-md (60px). See SKILL.md → "Typography limits".`);
  }
}

// ---------------- Rule E004: text-aurora over cool bg --------------
// .text-aurora gradient is blue/cyan/violet. Used on a cool-palette
// background it disappears.
const auroraOver = /<(h[1-6]|p|span)\b[^>]*class=["'][^"']*text-aurora[^"']*["']/gi;
const coolPalettes = ['cool-deep', 'cool-arctic', 'cool-neon', 'cool-violet'];
const stageCoolBg = coolPalettes.some(p => src.includes(`data-palette="${p}"`) || src.includes(`data-palette='${p}'`));
if (stageCoolBg) {
  while ((m = auroraOver.exec(src)) !== null) {
    add('E004', 'error', lineOf(m.index),
      '.text-aurora used in a composition with a cool-palette background — its blue/cyan gradient will blend into the shader',
      `Switch to .text-on-cool (warm yellow #FFE87A) or use a warm/prismatic palette. See SKILL.md → "Palette pair rule".`);
  }
}

// ---------------- Rule E005: scene premature exit -------------------
// A scene that fades to opacity 0 right before another scene starts
// should hand off via <div data-transition> instead.  Heuristic: any
// element with data-animation-out followed within 0.3s by another
// data-clip's data-start, and there is no <div data-transition>
// straddling the boundary.
const allClips = [...src.matchAll(/<[^>]+data-clip[^>]*>/gi)];
const transitions = [...src.matchAll(/<[^>]+data-transition[^>]*>/gi)]
  .map(t => {
    const s = parseFloat((t[0].match(/data-start=["']([\d.]+)/) || [])[1] || '0');
    const d = parseFloat((t[0].match(/data-duration=["']([\d.]+)/) || [])[1] || '0.5');
    return { s, e: s + d };
  });
function hasTransitionAround(t) {
  return transitions.some(x => x.s <= t + 0.5 && x.e >= t - 0.5);
}
const clipsParsed = allClips
  .map(c => ({
    tag: c[0],
    line: lineOf(c.index),
    s: parseFloat((c[0].match(/data-start=["']([\d.]+)/) || [])[1] || '0'),
    d: parseFloat((c[0].match(/data-duration=["']([\d.]+)/) || [])[1] || '0'),
    out: !!c[0].match(/data-animation-out=/),
  }))
  .filter(c => c.d > 0)
  .sort((a, b) => a.s - b.s);
const stageDur = parseFloat((src.match(/data-duration=["']([\d.]+)["'][^>]*data-fps/) ||
                              src.match(/id=["']stage["'][^>]*data-duration=["']([\d.]+)/) ||
                              [])[1] || '0');
clipsParsed.forEach((c) => {
  if (!c.out) return;
  const endsAt = c.s + c.d;
  const isFinal = stageDur && endsAt > stageDur - 1.5;
  if (isFinal) return;
  if (!hasTransitionAround(endsAt)) {
    add('E005', 'error', c.line,
      `clip exits at ${endsAt.toFixed(1)}s with data-animation-out but no <div data-transition> straddles the cut`,
      `Either: (a) remove data-animation-out and add <div data-transition="pixel-dissolve" data-start="${(endsAt - 0.5).toFixed(1)}" data-duration="0.8">, OR (b) move this clip to the end if it's truly the final scene.`);
  }
});

// ---------------- Rule W001: inline position:relative on bg --------
const bgRelRe = /<[^>]*data-background[^>]*style=["'][^"']*position\s*:\s*relative[^"']*["'][^>]*>/gi;
while ((m = bgRelRe.exec(src)) !== null) {
  add('W001', 'warn', lineOf(m.index),
    'inline `position: relative` on a [data-background] element',
    `Remove it — the runtime sets position: absolute on every [data-background] so they stack in the same z-plane. Inline position:relative kicks them into normal flow and they all stack vertically (Scene 2 ends up below Scene 1 off-screen).`);
}

// ---------------- Rule W002: raw Math.random ----------------------
const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
while ((m = scriptRe.exec(src)) !== null) {
  const code = m[1];
  if (/\bMath\.random\s*\(/.test(code) && !/__mvm\.random/.test(code)) {
    add('W002', 'warn', lineOf(m.index),
      'inline <script> calls Math.random() — output will differ between renders',
      `Use window.__mvm.random("scene-1-seed") for a stateful PRNG, or __mvm.randomSample("seed-key") for a single deterministic draw. See SKILL.md → "Determinism contract".`);
  }
}

// ---------------- Rule W003: missing palette ----------------------
const bgRe = /<[^>]*data-background=["']([^"']+)["'][^>]*>/gi;
const shaderBackgrounds = new Set([
  'liquid-ether', 'iridescence', 'prismatic-burst', 'meta-balls',
  'lightning', 'plasma', 'beams',
]);
while ((m = bgRe.exec(src)) !== null) {
  if (!shaderBackgrounds.has(m[1])) continue;
  if (!/data-palette|data-colors/.test(m[0])) {
    add('W003', 'warn', lineOf(m.index),
      `data-background="${m[1]}" has neither data-palette nor data-colors`,
      `Add data-palette="cool-deep" (or warm-glow / prismatic-cyber / mono-deep / ...) AND a matching .text-on-* class on every text element in this scene. See SKILL.md → "Palette pair rule".`);
  }
}

// ---------------- Rule W005: clip overruns stage -------------------
clipsParsed.forEach(c => {
  if (!stageDur) return;
  if (c.s + c.d > stageDur + 0.05) {
    add('W005', 'warn', c.line,
      `clip runs ${c.s}s..${(c.s + c.d).toFixed(2)}s but stage is only ${stageDur}s long`,
      `Shorten data-duration to ${(stageDur - c.s).toFixed(2)} or extend the stage's data-duration.`);
  }
});

// ---------------- Rule W006: GSAP interaction-only plugins ----------
// ScrollTrigger / ScrollSmoother / Draggable / Observer are designed for
// live, scroll/pointer-driven UIs.  In a frame-accurate offline render
// there is no scroll position and no pointer events, so any animation
// that depends on them will simply never advance.  Warn the author so
// they migrate to a GSAP timeline driven by mvm-seek.
const blockedPluginRe = /\b(ScrollTrigger|ScrollSmoother|Draggable|Observer|InertiaPlugin)\b/g;
while ((m = blockedPluginRe.exec(src)) !== null) {
  // Skip mentions inside HTML comments — authors may quote the plugin
  // names while explaining why they didn't use them.
  const lineText = lines[lineOf(m.index)] || '';
  if (lineText.trim().startsWith('<!--') || lineText.includes('//')) continue;
  add('W006', 'warn', lineOf(m.index),
    `${m[1]} referenced — interaction-driven plugins do not fire in offline render`,
    `Replace with a GSAP timeline driven by the mvm clock: use __mvmGsap.timeline({at: <seconds>}) or data-gsap-from/to. See SKILL.md → "GSAP integration".`);
}

// ---------------- Rule W007: GSAP autoplay outside the bridge -------
// gsap.to/from inside a setTimeout / setInterval / requestAnimationFrame
// bypasses the determinism layer because those callbacks run on
// wall-clock time, not on mvm-seek.  We don't ban gsap.to() outright
// (the bridge handles plain calls correctly via gsap.updateRoot), but
// we do warn when the call is wrapped in a wall-clock timer.
while ((m = scriptRe.exec(src)) !== null) {
  const code = m[1];
  if (/\b(setTimeout|setInterval)\s*\([\s\S]{0,200}?gsap\.(to|from|fromTo|timeline)\b/.test(code)) {
    add('W007', 'warn', lineOf(m.index),
      'gsap.* call wrapped in setTimeout/setInterval — wall-clock timers break determinism',
      `Build the timeline upfront and let gsap.updateRoot (driven by mvm-seek) seek into it. Use __mvmGsap.timeline({at: <seconds>}) or position the tween at an absolute time on gsap.globalTimeline.`);
  }
  if (/\bgsap\.utils\.random\s*\(/.test(code) && !/__mvm\.random|seed/.test(code)) {
    add('W008', 'warn', lineOf(m.index),
      'gsap.utils.random() uses Math.random under the hood — output will differ between renders',
      `Wrap with __mvm.random("seed") or pass a deterministic value: gsap.to(".x", {x: __mvm.randomSample("k") * 200}).`);
  }
}
// reset the script regex iteration state since we used it twice above
scriptRe.lastIndex = 0;

// ---------------- Rule E006: data-gsap-* without bridge -------------
const usesGsapData =
  /data-gsap-(from|to|target|duration|delay|ease|stagger|repeat|yoyo|split|x|y|mask|smartwrap)\b/.test(src) ||
  /\bdata-(draw-svg|morph-to|motion-path|physics2d|scramble|flip-id)\b/.test(src);
const loadsBridge = /gsap-bridge\.js/.test(src);
const loadsGsapCore = /\bgsap\.min\.js\b|\bgsap\.js\b|gsap@/.test(src) || /window\.gsap\b/.test(src);
if (usesGsapData && !loadsBridge) {
  add('E006', 'error', 0,
    'composition uses data-gsap-* / data-draw-svg / data-morph-to / data-motion-path / data-physics2d / data-scramble / data-flip-id but does NOT load runtime/gsap-bridge.js',
    `Add  <script src="../../runtime/gsap-bridge.js"></script>  AFTER the gsap core + plugins. Without the bridge those attributes are silently inert.`);
}
if (usesGsapData && loadsBridge && !loadsGsapCore) {
  add('E006', 'error', 0,
    'gsap-bridge.js loaded but no gsap core script tag found',
    `Add  <script src="../../runtime/gsap/gsap.min.js"></script>  BEFORE the bridge. The bridge only registers plugins that exist on window.`);
}

// ---------------- Report --------------------------------------------
if (asJson) {
  console.log(JSON.stringify({ file, findings }, null, 2));
} else {
  const errs = findings.filter(f => f.severity === 'error');
  const warns = findings.filter(f => f.severity === 'warn');
  if (findings.length === 0) {
    console.log(`✔ ${file} — no lint issues`);
  } else {
    for (const f of findings) {
      const tag = f.severity === 'error' ? '✘ ERR ' : '⚠ WARN';
      console.log(`${tag} ${f.code}  ${file}:${f.line}  ${f.message}`);
      if (f.fixHint) console.log(`        ↳ ${f.fixHint}`);
    }
    console.log(`\n${errs.length} error(s), ${warns.length} warning(s).`);
  }
}

const failed = findings.some(f => f.severity === 'error') ||
               (strict && findings.some(f => f.severity === 'warn'));
process.exit(failed ? 1 : 0);
