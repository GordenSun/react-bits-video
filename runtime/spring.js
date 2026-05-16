/**
 * motion-video-maker / spring physics
 * ----------------------------------------------------------------
 * Deterministic, stateless, time-accurate spring evaluator built on
 * the closed-form solution of a damped harmonic oscillator.  Given a
 * (stiffness, damping, mass) tuple and time `t`, we return a
 * normalized progress value in [0, 1+] that overshoots / oscillates
 * like a real spring — but is FULLY DETERMINISTIC across renders
 * (no integration, no state, identical for every frame seek).
 *
 * Why not just integrate?
 *   The renderer calls seek(t) on random frames, sometimes out of
 *   order, sometimes 10 frames apart.  An integrator would drift.
 *   A closed-form solution is bit-identical regardless of how it is
 *   sampled — perfect for frame-accurate video.
 *
 * Equations (mass = 1):
 *   ω₀  = √(k)                 // natural frequency
 *   ζ   = c / (2·√(k·m))       // damping ratio
 *   under-damped  (ζ < 1):  x(t) = 1 − e^(−ζω₀t)·(cos(ωd·t) + (ζω₀/ωd)·sin(ωd·t))
 *   critically    (ζ = 1):  x(t) = 1 − e^(−ω₀t)·(1 + ω₀t)
 *   over-damped   (ζ > 1):  x(t) = 1 − ((r₁·e^(r₂·t) − r₂·e^(r₁·t)) / (r₁ − r₂))
 *   where ωd = ω₀·√(1 − ζ²),
 *         r₁,₂ = −ω₀·(ζ ± √(ζ² − 1))
 *
 * Reference: https://motion.dev/docs/spring  (math chapter)
 */
(function () {
  'use strict';

  /**
   * @param {number} t        seconds since start (>= 0)
   * @param {object} cfg      spring configuration
   * @param {number} cfg.stiffness   k  (default 170)
   * @param {number} cfg.damping     c  (default 26)
   * @param {number} cfg.mass        m  (default 1)
   * @param {number} cfg.velocity    initial velocity (default 0)
   * @returns {number}        progress (typically [0, 1+], overshoots possible)
   */
  function springAt(t, cfg) {
    const k = cfg.stiffness ?? 170;
    const c = cfg.damping ?? 26;
    const m = cfg.mass ?? 1;
    const v0 = cfg.velocity ?? 0;
    const w0 = Math.sqrt(k / m);
    const zeta = c / (2 * Math.sqrt(k * m));

    if (t <= 0) return 0;

    let x;
    if (Math.abs(zeta - 1) < 1e-4) {
      // Critically damped
      x = 1 - Math.exp(-w0 * t) * (1 + (w0 + v0) * t);
    } else if (zeta < 1) {
      // Under-damped (bouncy)
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      const env = Math.exp(-zeta * w0 * t);
      x = 1 - env * (Math.cos(wd * t) + ((zeta * w0 + v0) / wd) * Math.sin(wd * t));
    } else {
      // Over-damped (smooth, no oscillation)
      const r = w0 * Math.sqrt(zeta * zeta - 1);
      const r1 = -zeta * w0 + r;
      const r2 = -zeta * w0 - r;
      const c1 = (-1 * r2 - v0) / (r1 - r2);
      const c2 = (1 + v0 / r1) - c1; // simplified
      x = 1 + c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
    }
    return x;
  }

  /**
   * Estimate when the spring "settles" within `precision` of 1.
   * Used to derive a normalized duration so authors can keep talking
   * in seconds.
   */
  function springSettleTime(cfg, precision = 0.005) {
    const k = cfg.stiffness ?? 170;
    const c = cfg.damping ?? 26;
    const m = cfg.mass ?? 1;
    const w0 = Math.sqrt(k / m);
    const zeta = c / (2 * Math.sqrt(k * m));
    // Time for envelope e^(-zeta·w0·t) to fall below precision:
    const tau = -Math.log(precision) / Math.max(0.01, zeta * w0);
    // Pad slightly for residual oscillation in under-damped systems.
    return zeta < 1 ? tau * 1.2 : tau;
  }

  /**
   * 6 named spring presets, calibrated for video pacing.
   * Each preset settles in ~0.6-1.4s of real time.
   *
   *   springGentle  — slow, smooth, no overshoot  (over-damped)
   *   springSoft    — light bounce, settles fast  (slight under-damped)
   *   springSnap    — fast, no overshoot          (critically damped)
   *   springSmooth  — medium, very light bounce
   *   springBouncy  — noticeable bounce, lively
   *   springWobbly  — long oscillation, playful
   *   springStiff   — very fast, snappy
   */
  const PRESETS = {
    springGentle:  { stiffness: 120, damping: 28 },  // over-damped feel
    springSoft:    { stiffness: 170, damping: 22 },
    springSnap:    { stiffness: 380, damping: 38 },
    springSmooth:  { stiffness: 200, damping: 26 },
    springBouncy:  { stiffness: 260, damping: 18 },
    springWobbly:  { stiffness: 180, damping: 10 },
    springStiff:   { stiffness: 500, damping: 30 },
  };

  /**
   * Build an "easing function" interface — given normalized progress p in [0,1]
   * (where 1 corresponds to settle time), return current value.
   *
   * This lets springs slot into the existing easing system that takes p in [0,1].
   *
   *   const e = springEasing('springBouncy');
   *   e(0.5)   // -> approx 1.08 (overshoot peak)
   *   e(1.0)   // -> approx 1.0 (settled)
   */
  function springEasing(presetName, options = {}) {
    const base = PRESETS[presetName] || PRESETS.springSmooth;
    const cfg = { ...base, ...options };
    const settle = springSettleTime(cfg);
    return p => springAt(p * settle, cfg);
  }

  /**
   * Build a spring evaluator for AUTHORING in real seconds.
   * Returns f(t) where t is real seconds; value reaches ~1 at settle time.
   */
  function springAbsolute(presetName, options = {}) {
    const base = PRESETS[presetName] || PRESETS.springSmooth;
    const cfg = { ...base, ...options };
    return t => springAt(t, cfg);
  }

  // Expose
  window.__mvmSpring = {
    at: springAt,
    settleTime: springSettleTime,
    easing: springEasing,
    absolute: springAbsolute,
    presets: PRESETS,
  };
})();
