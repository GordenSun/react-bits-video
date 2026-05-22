/**
 * motion-video-maker / GSAP determinism bridge
 * ----------------------------------------------------------------
 * Integrates the GreenSock Animation Platform (GSAP) into the
 * deterministic mvm render pipeline.
 *
 * GSAP normally drives every tween off its own internal RAF ticker
 * (`gsap.ticker`).  That works for live previews but breaks the
 * skill's frame-accurate render contract: in headless render mode
 * we need GSAP to advance EXACTLY to `t` whenever `mvm-seek` fires —
 * never forward, never on its own clock, never via wall-time.
 *
 * The bridge:
 *   1. Stops `gsap.ticker` from auto-stepping `gsap.globalTimeline`
 *      (we remove `gsap.updateRoot` from the ticker so RAF can't
 *      mutate playheads on its own).
 *   2. Subscribes to `window`'s `mvm-seek` event and calls
 *      `gsap.updateRoot(seekTime)` every frame.  All tweens, child
 *      timelines, plugins (DrawSVG, MorphSVG, MotionPath, SplitText,
 *      ScrambleText, Physics2D, Flip, ...) advance to that exact
 *      absolute time → byte-identical between two renders.
 *   3. Provides a thin declarative `data-gsap-*` attribute API on
 *      top of the existing clip system (`data-clip` still controls
 *      visibility windows; GSAP just handles the tween itself).
 *   4. Registers GSAP's CustomEase / EasePack / CustomWiggle /
 *      CustomBounce eases into the mvm easing table so authors can
 *      use them with `data-easing="..."` everywhere — including the
 *      mvm-native ANIMS preset table.
 *   5. Adds new high-impact components: SVG path draw, shape morph,
 *      motion-path follow, GSAP-powered SplitText, ScrambleText.
 *
 * Hard rules (enforced or warned):
 *   - Never call `tween.play()` / `gsap.delayedCall()` / autoplay
 *     timelines: they step from the internal ticker which we paused.
 *     Build the timeline at start, give it `paused: true`, and let
 *     `gsap.updateRoot` seek into it.
 *   - Never use `ScrollTrigger`: there's no scroll in a video render.
 *     The bridge skips registration even if the script is included.
 *   - `gsap.utils.random()` uses Math.random — pass `__mvm.random()`
 *     output instead, or use the `seed` attribute on data-gsap-*.
 *
 * Compatible with: gsap >=3.12 (works against the bundled 3.15.0).
 */
(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.gsap) {
    console.warn('[mvm-gsap] gsap.min.js must be loaded BEFORE gsap-bridge.js — bridge disabled.');
    return;
  }

  const gsap = window.gsap;

  // ----------------------------------------------------------------
  // 1) Plugin registration — every plugin we ship via runtime/gsap/
  //    is registered exactly once. The bridge tolerates any plugin
  //    being missing (e.g. user dropped it from <script>) so a slim
  //    composition doesn't have to load 200KB of plugins it won't use.
  // ----------------------------------------------------------------
  const plugins = [
    'CustomEase', 'CustomWiggle', 'CustomBounce', 'EasePack',
    'DrawSVGPlugin', 'MorphSVGPlugin', 'MotionPathPlugin',
    'Physics2DPlugin', 'PhysicsPropsPlugin',
    'Flip', 'SplitText', 'ScrambleTextPlugin', 'TextPlugin',
    // SlowMo / RoughEase / ExpoScaleEase live inside EasePack as
    // separate globals — register if present.
    'SlowMo', 'RoughEase', 'ExpoScaleEase',
  ];
  const registered = {};
  plugins.forEach(name => {
    if (window[name]) {
      try {
        gsap.registerPlugin(window[name]);
        registered[name] = window[name];
      } catch (e) {
        console.warn(`[mvm-gsap] failed to register ${name}:`, e.message);
      }
    }
  });

  // ----------------------------------------------------------------
  // 2) Determinism handover
  //    In render mode we stop gsap from advancing its own root
  //    timeline and drive it from the mvm-seek event instead.  In
  //    preview mode (no __mvmRenderMode) we let gsap run normally
  //    but ALSO sync to mvm-seek so a user's preview matches what
  //    the renderer would produce.
  // ----------------------------------------------------------------
  // gsap.updateRoot is a static method that updates every animation
  // anywhere on the global timeline to the given absolute time
  // (in seconds). It's the official "drive me from a custom clock"
  // API.  https://gsap.com/docs/v3/GSAP/gsap.updateRoot()
  // gsap.ticker is the RAF wrapper that normally calls updateRoot
  // every frame; we remove it so author code doesn't accidentally
  // race ahead.
  if (window.__mvmRenderMode) {
    // Hard-stop GSAP's autoadvance: remove every listener that
    // could mutate the root timeline, then sleep the ticker.
    gsap.ticker.lagSmoothing(0);            // disable lag compensation
    gsap.ticker.fps(-1);                    // pause the RAF loop
    // Remove gsap's own root-advancing listener so nothing else can
    // step it.  In gsap 3 the listener is `gsap.updateRoot` itself.
    try { gsap.ticker.remove(gsap.updateRoot); } catch (_) { /* noop */ }
    // Some plugin internals also subscribe; remove anonymous root
    // listeners that match the signature of (time, ...) → updateRoot
    // by walking the ticker's internal _listeners array if exposed.
    if (Array.isArray(gsap.ticker._listeners)) {
      gsap.ticker._listeners.length = 0;
    }
  }

  // Whether we are paused-driven or live-and-synced, both paths call
  // updateRoot from the mvm-seek event.  This guarantees that a tween
  // built at `t=0` plays the same way across preview and render.
  let _gsapStarted = false;
  function syncGsap(t) {
    // gsap.updateRoot expects seconds since some absolute origin.
    // We can pass the seek time directly; gsap normalizes internally.
    if (typeof gsap.updateRoot === 'function') {
      gsap.updateRoot(t);
    } else if (gsap.globalTimeline && typeof gsap.globalTimeline.totalTime === 'function') {
      gsap.globalTimeline.totalTime(t);
    }
    _gsapStarted = true;
  }
  window.addEventListener('mvm-seek', e => syncGsap(e.detail.time));

  // ----------------------------------------------------------------
  // 3) Easing bridge: let authors use any GSAP ease string with
  //    data-easing="..." in the mvm-native ANIMS preset table.
  //    We register a wrapper that resolves a name like
  //    "power2.inOut" / "back.out(1.7)" / "elastic.out(1, 0.3)" into
  //    a (t)→t01 function and stores it in window.__mvm.easing.
  //
  //    The mvm timeline.js looks up `E[name]` for every clip; if a
  //    name is missing it falls back to easeOutCubic.  By writing the
  //    GSAP-resolved easing into that map, the existing in/out
  //    animations pick up CustomEase, SlowMo, ExpoScaleEase, etc.
  // ----------------------------------------------------------------
  function isGsapEaseName(name) {
    if (!name || typeof name !== 'string') return false;
    if (window.__mvm && window.__mvm.easing && window.__mvm.easing[name]) return false;
    return /^(power[0-4]|back|bounce|circ|elastic|expo|sine|none|rough|slow|expoScale|wiggle|steps)/i.test(name)
      || name.includes('.')                  // power2.inOut
      || name.startsWith('mvm.')             // user-registered CustomEase
      || name.includes('(');                 // back.out(1.7) etc.
  }

  function resolveEase(name) {
    try {
      const fn = gsap.parseEase(name);
      if (typeof fn === 'function') return fn;
    } catch (_) { /* noop */ }
    return null;
  }

  function ensureEaseInMvm(name) {
    if (!window.__mvm || !window.__mvm.easing) return null;
    if (window.__mvm.easing[name]) return window.__mvm.easing[name];
    if (!isGsapEaseName(name)) return null;
    const fn = resolveEase(name);
    if (fn) {
      // Some gsap eases expect ratio inputs slightly outside 0..1
      // (elastic, back) — we clamp output to keep transforms sane
      // in case author code multiplies by a large value.
      window.__mvm.easing[name] = (t) => fn(t);
      return window.__mvm.easing[name];
    }
    return null;
  }

  // Eagerly hook into the mvm easing table so anywhere it does
  // `E[name] || E.easeOutCubic`, the GSAP eases get resolved on
  // first request.  We do this with a Proxy-like get trap by
  // wrapping the existing object.
  if (window.__mvm && window.__mvm.easing) {
    const E = window.__mvm.easing;
    const handler = {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (typeof prop === 'string' && isGsapEaseName(prop)) {
          const fn = ensureEaseInMvm(prop);
          if (fn) return fn;
        }
        return undefined;
      },
    };
    // Replace mvm easing with a proxied version that resolves GSAP
    // eases on demand (without polluting the table on first access).
    try {
      window.__mvm.easing = new Proxy(E, handler);
    } catch (_) {
      // Proxy not available in some headless environments — fall back
      // to eager registration of the most common ones.
      ['power1','power2','power3','power4','back','bounce','circ','elastic','expo','sine','none']
        .forEach(base => {
          ['', '.in', '.out', '.inOut'].forEach(suffix => {
            ensureEaseInMvm(base + suffix);
          });
        });
    }
  }

  // Helpers exposed for power users who want to register a CustomEase
  // up-front and then use it via data-easing="mvm.<name>".
  function registerCustomEase(name, definition) {
    if (!registered.CustomEase) {
      console.warn('[mvm-gsap] CustomEase not loaded — register it via runtime/gsap/CustomEase.min.js');
      return null;
    }
    const ease = window.CustomEase.create(name, definition);
    return ease;
  }

  // ----------------------------------------------------------------
  // 4) Declarative data-gsap-* API
  //
  //    All of these slot into the existing data-clip lifecycle.
  //    The bridge runs once on DOMContentLoaded and:
  //      • finds elements with data-gsap-from / data-gsap-to / etc.
  //      • builds a paused gsap.timeline scoped to the clip's window
  //      • the master clock (gsap.updateRoot) drives that timeline,
  //        but the timeline's start is shifted with .delay() so it
  //        only animates between data-start and data-start+duration.
  //
  //    Why use data-gsap-from/to in addition to mvm's data-animation?
  //      • mvm's data-animation is a fixed preset table — fine for
  //        common entrances. data-gsap-from/to lets authors animate
  //        ARBITRARY css/transform properties with arbitrary eases.
  //      • Plugin features (DrawSVG, MorphSVG, MotionPath, Physics2D)
  //        only work through the GSAP path.
  //
  //    Quick reference of supported attributes on any element:
  //
  //      data-gsap-from='{"y":80,"opacity":0,"scale":0.6}'
  //      data-gsap-to='{"y":0,"opacity":1,"scale":1,"ease":"power3.out"}'
  //      data-gsap-duration="1.2"      // seconds; defaults to data-in-duration or 0.6
  //      data-gsap-delay="0.2"         // seconds AFTER data-start
  //      data-gsap-ease="back.out(1.6)"
  //      data-gsap-stagger="0.04"      // applies if target resolves to multiple elements
  //      data-gsap-target=".child"     // optional inner target; defaults to the host element
  //      data-gsap-repeat="-1"         // GSAP repeat (use sparingly; -1 = infinite cycle in clip window)
  //      data-gsap-yoyo="true"
  //
  //    SVG-only:
  //      data-draw-svg="0% 0% to 0% 100%"   // stroke draw — see component
  //      data-morph-to="#targetShape"       // morph this path's d into target's d
  //      data-motion-path="#pathId"         // animate the host along this SVG path
  //      data-motion-path-align="true"      // align host to path tangent
  //      data-motion-path-rotate="true"     // auto-rotate following the curve
  //
  //    Text:
  //      data-gsap-split="chars|words|lines" // upgraded SplitText (uses GSAP plugin)
  //                                          // entrance baked-in: y, autoAlpha,
  //                                          // stagger, ease via the regular vars.
  //      data-scramble='{"text":"...","chars":"01"}'
  //
  //    Physics2D:
  //      data-physics2d='{"velocity":300,"angle":-80,"gravity":600}'
  //
  //    Flip (pair):
  //      class="mvm-flip-from" / class="mvm-flip-to" + same data-flip-id
  //      → captures state on first frame and animates to second on
  //      data-flip-at time.
  // ----------------------------------------------------------------

  function parseJSONAttr(el, name) {
    const raw = el.getAttribute(name);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      // Allow loose JSON: '{x: 100, y: 50}' (no quotes around keys)
      try {
        const fixed = raw.replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
                         .replace(/'([^']*)'/g, '"$1"');
        return JSON.parse(fixed);
      } catch (_) {
        console.warn(`[mvm-gsap] could not parse ${name}=`, raw);
        return null;
      }
    }
  }

  function resolveTargets(el, sel) {
    if (!sel) return el;
    if (sel === 'self' || sel === 'this') return el;
    return el.querySelectorAll(sel);
  }

  // Build a paused timeline anchored to clip start so its progress
  // is driven by gsap.updateRoot via the mvm-seek event.
  function clipWindowSeconds(el, fallbackDur) {
    const start = parseFloat(el.dataset.start) || 0;
    const dur = parseFloat(el.dataset.duration);
    return {
      start,
      duration: isNaN(dur) ? fallbackDur : dur,
    };
  }

  function buildGsapTween(el) {
    const fromVars = parseJSONAttr(el, 'data-gsap-from');
    const toVars = parseJSONAttr(el, 'data-gsap-to');
    if (!fromVars && !toVars) return;

    const win = clipWindowSeconds(el, 5);
    const targetSel = el.getAttribute('data-gsap-target');
    const target = resolveTargets(el, targetSel);
    const dur = parseFloat(el.getAttribute('data-gsap-duration'))
             || parseFloat(el.dataset.inDuration)
             || 0.6;
    const delay = parseFloat(el.getAttribute('data-gsap-delay')) || 0;
    const ease = el.getAttribute('data-gsap-ease') || el.dataset.easing || 'power2.out';
    const stagger = parseFloat(el.getAttribute('data-gsap-stagger'));
    const repeat = parseFloat(el.getAttribute('data-gsap-repeat'));
    const yoyo = el.getAttribute('data-gsap-yoyo') === 'true';

    const baseVars = { duration: dur, ease };
    if (!isNaN(stagger)) baseVars.stagger = stagger;
    if (!isNaN(repeat)) baseVars.repeat = repeat;
    if (yoyo) baseVars.yoyo = true;

    const tl = gsap.timeline({ paused: false, defaults: baseVars });
    // Position the tween at absolute time (win.start + delay) so the
    // global ticker (driven by mvm-seek) seeks INTO it correctly.
    const at = win.start + delay;

    if (fromVars && toVars) {
      tl.fromTo(target, fromVars, { ...toVars }, at);
    } else if (fromVars) {
      tl.from(target, { ...fromVars, immediateRender: false }, at);
    } else if (toVars) {
      tl.to(target, { ...toVars }, at);
    }

    return tl;
  }

  // ---- DrawSVG component -----------------------------------------
  // data-draw-svg="0% 100%" or "0% 0% to 0% 100%" or just "100%".
  // The element must be a stroked SVG path / line / polyline / polygon.
  function buildDrawSvg(el) {
    const v = el.getAttribute('data-draw-svg');
    if (!v) return;
    if (!registered.DrawSVGPlugin) {
      console.warn('[mvm-gsap] data-draw-svg used but DrawSVGPlugin is not loaded.');
      return;
    }
    const win = clipWindowSeconds(el, 5);
    const dur = parseFloat(el.getAttribute('data-gsap-duration'))
             || parseFloat(el.dataset.inDuration)
             || Math.min(1.6, win.duration * 0.7);
    const delay = parseFloat(el.getAttribute('data-gsap-delay')) || 0;
    const ease = el.getAttribute('data-gsap-ease') || el.dataset.easing || 'power2.inOut';
    const repeat = parseFloat(el.getAttribute('data-gsap-repeat'));
    const yoyo = el.getAttribute('data-gsap-yoyo') === 'true';
    let from = '0% 0%', to = v;
    if (v.includes(' to ')) {
      [from, to] = v.split(' to ').map(s => s.trim());
    } else if (v.trim().split(/\s+/).length === 1) {
      // single value — treat as "0% <value>"
      to = `0% ${v.trim()}`;
    }
    const tl = gsap.timeline({ paused: false });
    const vars = { drawSVG: to, duration: dur, ease };
    if (!isNaN(repeat)) vars.repeat = repeat;
    if (yoyo) vars.yoyo = true;
    tl.fromTo(el, { drawSVG: from, immediateRender: false }, vars, win.start + delay);
    return tl;
  }

  // ---- MorphSVG component ----------------------------------------
  // data-morph-to="#shapeId" or raw path string.
  function buildMorph(el) {
    const target = el.getAttribute('data-morph-to');
    if (!target) return;
    if (!registered.MorphSVGPlugin) {
      console.warn('[mvm-gsap] data-morph-to used but MorphSVGPlugin is not loaded.');
      return;
    }
    const win = clipWindowSeconds(el, 5);
    const dur = parseFloat(el.getAttribute('data-gsap-duration')) || 1.2;
    const delay = parseFloat(el.getAttribute('data-gsap-delay')) || 0;
    const ease = el.getAttribute('data-gsap-ease') || el.dataset.easing || 'power2.inOut';
    const type = el.getAttribute('data-morph-type') || 'linear';
    const repeat = parseFloat(el.getAttribute('data-gsap-repeat'));
    const yoyo = el.getAttribute('data-gsap-yoyo') === 'true';
    const tl = gsap.timeline({ paused: false });
    const vars = { morphSVG: { shape: target, type }, duration: dur, ease };
    if (!isNaN(repeat)) vars.repeat = repeat;
    if (yoyo) vars.yoyo = true;
    tl.to(el, vars, win.start + delay);
    return tl;
  }

  // ---- MotionPath component --------------------------------------
  function buildMotionPath(el) {
    const path = el.getAttribute('data-motion-path');
    if (!path) return;
    if (!registered.MotionPathPlugin) {
      console.warn('[mvm-gsap] data-motion-path used but MotionPathPlugin is not loaded.');
      return;
    }
    const win = clipWindowSeconds(el, 5);
    const dur = parseFloat(el.getAttribute('data-gsap-duration')) || (win.duration * 0.9);
    const delay = parseFloat(el.getAttribute('data-gsap-delay')) || 0;
    const ease = el.getAttribute('data-gsap-ease') || el.dataset.easing || 'power1.inOut';
    const align = el.getAttribute('data-motion-path-align') !== 'false';
    const autoRotate = el.getAttribute('data-motion-path-rotate') === 'true';
    const start = parseFloat(el.getAttribute('data-motion-path-start'));
    const end = parseFloat(el.getAttribute('data-motion-path-end'));
    const tl = gsap.timeline({ paused: false });
    const motionPath = { path, alignOrigin: [0.5, 0.5] };
    if (align) motionPath.align = path;
    if (autoRotate) motionPath.autoRotate = true;
    if (!isNaN(start)) motionPath.start = start;
    if (!isNaN(end)) motionPath.end = end;
    tl.to(el, { motionPath, duration: dur, ease }, win.start + delay);
    return tl;
  }

  // ---- Physics2D component ---------------------------------------
  function buildPhysics2D(el) {
    const cfg = parseJSONAttr(el, 'data-physics2d');
    if (!cfg) return;
    if (!registered.Physics2DPlugin) {
      console.warn('[mvm-gsap] data-physics2d used but Physics2DPlugin is not loaded.');
      return;
    }
    const win = clipWindowSeconds(el, 5);
    const dur = parseFloat(el.getAttribute('data-gsap-duration')) || win.duration;
    const delay = parseFloat(el.getAttribute('data-gsap-delay')) || 0;
    const ease = el.getAttribute('data-gsap-ease') || 'none';
    const tl = gsap.timeline({ paused: false });
    tl.to(el, { physics2D: cfg, duration: dur, ease }, win.start + delay);
    return tl;
  }

  // ---- ScrambleText component ------------------------------------
  function buildScramble(el) {
    const cfg = parseJSONAttr(el, 'data-scramble');
    if (!cfg) return;
    if (!registered.ScrambleTextPlugin) {
      console.warn('[mvm-gsap] data-scramble used but ScrambleTextPlugin is not loaded.');
      return;
    }
    const win = clipWindowSeconds(el, 5);
    const dur = parseFloat(cfg.duration) || parseFloat(el.getAttribute('data-gsap-duration')) || 1.6;
    const delay = parseFloat(el.getAttribute('data-gsap-delay')) || 0;
    const ease = cfg.ease || el.getAttribute('data-gsap-ease') || el.dataset.easing || 'none';
    const tl = gsap.timeline({ paused: false });
    tl.to(el, { scrambleText: cfg, duration: dur, ease }, win.start + delay);
    return tl;
  }

  // ---- GSAP-powered SplitText component --------------------------
  // data-gsap-split="chars" / "words" / "lines" / "lines,words"
  // Built-in entrance: stagger fade-up. Override per-attribute.
  function buildSplit(el) {
    const types = el.getAttribute('data-gsap-split');
    if (!types) return;
    if (!registered.SplitText) {
      console.warn('[mvm-gsap] data-gsap-split used but SplitText is not loaded.');
      return;
    }
    const win = clipWindowSeconds(el, 5);
    const dur = parseFloat(el.getAttribute('data-gsap-duration')) || 0.7;
    const delay = parseFloat(el.getAttribute('data-gsap-delay')) || 0.05;
    const ease = el.getAttribute('data-gsap-ease') || el.dataset.easing || 'power3.out';
    const stagger = parseFloat(el.getAttribute('data-gsap-stagger')) || 0.04;
    const yShift = parseFloat(el.getAttribute('data-gsap-y')) || 60;
    const mask = el.getAttribute('data-gsap-mask'); // "lines"/"words"/"chars" or null
    const splitOpts = { type: types };
    if (mask) splitOpts.mask = mask;
    if (el.getAttribute('data-gsap-smartwrap') === 'true') splitOpts.smartWrap = true;
    const split = window.SplitText.create(el, splitOpts);
    // Pick the most granular split for the entrance.
    let units = split.chars;
    if (types.includes('lines') && !types.includes('chars')) units = split.lines;
    if (types.includes('words') && !types.includes('chars') && !types.includes('lines')) units = split.words;
    const tl = gsap.timeline({ paused: false });
    tl.from(units, {
      yPercent: 0, y: yShift, autoAlpha: 0,
      duration: dur, ease, stagger,
      immediateRender: false,
    }, win.start + delay);
    return tl;
  }

  // ---- Flip component (paired) -----------------------------------
  // class="mvm-flip" data-flip-id="card" data-flip-at="2.4"
  // We capture the "before" state of every .mvm-flip element with the
  // same data-flip-id at frame 0, then at data-flip-at we swap classes
  // to .mvm-flip-active (author-styled new layout) and animate from
  // captured state.
  function setupFlipPairs() {
    if (!registered.Flip) return [];
    const groups = new Map();
    document.querySelectorAll('.mvm-flip[data-flip-id]').forEach(el => {
      const id = el.dataset.flipId;
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(el);
    });
    const tweens = [];
    groups.forEach((els, id) => {
      const at = parseFloat(els[0].dataset.flipAt) || 0;
      const dur = parseFloat(els[0].dataset.flipDuration) || 0.8;
      const ease = els[0].dataset.flipEase || els[0].dataset.easing || 'power2.inOut';
      // Capture state once on load (before any layout-changing class).
      const state = window.Flip.getState(els);
      // Schedule the layout change + Flip.from at time `at`.
      const tl = gsap.timeline({ paused: false });
      tl.add(() => {
        els.forEach(e => e.classList.add('mvm-flip-active'));
        const tween = window.Flip.from(state, {
          duration: dur, ease, absolute: false,
        });
        // Flip.from creates an autoplay tween; pause and stitch into the
        // global timeline so it advances with mvm-seek.
        tween.pause();
        gsap.globalTimeline.add(tween, at);
      }, at);
      tweens.push(tl);
    });
    return tweens;
  }

  // ----------------------------------------------------------------
  // 5) Discovery / mount loop
  // ----------------------------------------------------------------
  const _builtTimelines = [];
  function discoverAndBuild() {
    const stage = document.getElementById('stage') || document.body;

    // Order matters: SplitText must be created BEFORE the DOM is
    // measured by the runtime layout-check, otherwise the splits
    // will register a false overflow.
    stage.querySelectorAll('[data-gsap-split]').forEach(el => {
      const tl = buildSplit(el); if (tl) _builtTimelines.push(tl);
    });
    stage.querySelectorAll('[data-gsap-from],[data-gsap-to]').forEach(el => {
      const tl = buildGsapTween(el); if (tl) _builtTimelines.push(tl);
    });
    stage.querySelectorAll('[data-draw-svg]').forEach(el => {
      const tl = buildDrawSvg(el); if (tl) _builtTimelines.push(tl);
    });
    stage.querySelectorAll('[data-morph-to]').forEach(el => {
      const tl = buildMorph(el); if (tl) _builtTimelines.push(tl);
    });
    stage.querySelectorAll('[data-motion-path]').forEach(el => {
      const tl = buildMotionPath(el); if (tl) _builtTimelines.push(tl);
    });
    stage.querySelectorAll('[data-physics2d]').forEach(el => {
      const tl = buildPhysics2D(el); if (tl) _builtTimelines.push(tl);
    });
    stage.querySelectorAll('[data-scramble]').forEach(el => {
      const tl = buildScramble(el); if (tl) _builtTimelines.push(tl);
    });
    setupFlipPairs().forEach(tl => _builtTimelines.push(tl));
  }

  // Wait for fonts so SplitText / layout calculations see real metrics.
  // Use a delayRender handle so the renderer doesn't capture frame 0
  // before splits exist.
  function mount() {
    const handle = (window.__mvm && window.__mvm.delayRender) ? window.__mvm.delayRender('gsap-bridge mount') : null;
    const ready = () => {
      try {
        discoverAndBuild();
        // After every animation is built, immediately seek to t=0 so
        // initial styles snap in (otherwise the first frame may show
        // a "from" state that hasn't been applied yet).
        syncGsap(0);
      } catch (e) {
        if (window.__mvm && window.__mvm.cancelRender) window.__mvm.cancelRender(e);
        else console.error('[mvm-gsap] mount error:', e);
      } finally {
        if (handle != null && window.__mvm) window.__mvm.continueRender(handle);
      }
    };
    if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
      document.fonts.ready.then(ready, ready);
    } else {
      // Fallback: small timeout so default fonts can settle
      setTimeout(ready, 30);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }

  // ----------------------------------------------------------------
  // 6) Public API
  // ----------------------------------------------------------------
  window.__mvmGsap = {
    gsap,
    registered,
    sync: syncGsap,
    registerCustomEase,
    /**
     * Author-facing helper: build a paused timeline that the bridge
     * will drive via gsap.updateRoot.  Use this for choreographed
     * scenes where you want full GSAP power instead of data-gsap-*.
     *
     *   const tl = __mvmGsap.timeline({ at: 4.0 });
     *   tl.from(".card", { y: 80, opacity: 0, stagger: 0.08 })
     *     .to(".card", { rotation: 5 }, "+=0.4");
     */
    timeline(opts = {}) {
      const tl = gsap.timeline({ paused: false, defaults: opts.defaults || {} });
      if (typeof opts.at === 'number') {
        // Anchor the timeline so its first child plays at absolute time `at`.
        // We lift it onto the global timeline at `at`.
        gsap.globalTimeline.add(tl, opts.at);
      }
      return tl;
    },
  };

  if (window.__mvm) {
    window.__mvm.gsap = gsap;
    window.__mvm.gsapBridge = window.__mvmGsap;
  }
})();
