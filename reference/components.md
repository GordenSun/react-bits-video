# Component Reference

Detailed prop tables and authoring notes for every built-in animation
component. The runtime (`runtime/components.js`) is fully introspectable;
extend it with `window.__mvm.register('your-anim', fn)`.

---

## Text Animations (`[data-text-animation]`)

All text components receive their progress from the global timeline; no
JavaScript is needed in author HTML. They share these common attributes:

- `data-start` — when the animation begins (seconds).
- `data-anim-duration` — animation length (overrides `data-duration`).
- `data-easing` — see SKILL.md easing list (default varies per component).

### split-text

Per-character (or per-word) staggered enter with optional translate.

| Attribute | Default | Notes |
|---|---|---|
| `data-stagger` | `0.04` | Delay between characters in seconds |
| `data-char-duration` | `0.7` | Per-character animation length |
| `data-split-mode` | `char` | `char` or `word` |
| `data-travel` | `50` | Y-translate distance (px) |
| `data-easing` | `easeOutQuart` | Per-char easing |

When the parent uses gradient text (`-webkit-text-fill-color: transparent`
with a `background-image: linear-gradient(...)`), the splitter automatically
copies the gradient onto each character span — so `text-fire`, `text-gold`,
`text-aurora`, `text-silver` all combine seamlessly with `split-text`.

### blur-text

Per-character blur → focus with subtle translate.

| Attribute | Default |
|---|---|
| `data-stagger` | `0.06` |
| `data-char-duration` | `0.9` |
| `data-split-mode` | `char` |

### shiny-text

Sweeping metallic highlight across the text.

| Attribute | Default |
|---|---|
| `data-speed` | `3` | Higher = faster sweep |

The text becomes transparent with a `linear-gradient` background; works on
any plain text.

### gradient-text

Animated color-shift gradient.

| Attribute | Default |
|---|---|
| `data-colors` | `'#ff7e5f,#feb47b,...'` | Comma-separated colors |
| `data-speed` | `0.6` | Cycles per second |

### glitch-text

RGB split and jitter, deterministic.

| Attribute | Default |
|---|---|
| `data-intensity` | `4` | RGB-split distance (px) |

### decrypted-text

Hacker-style character scramble that progressively settles into the target
string from left to right.

| Attribute | Default |
|---|---|
| `data-anim-duration` | `2.5` | How long the decryption takes |

The internal glyph alphabet covers ASCII symbols, katakana, and selected
CJK glyphs (`漢字文测试时间永恒`), so the scramble looks visually rich for
Chinese text too.

### type-text

Typewriter effect with blinking cursor.

| Attribute | Default |
|---|---|
| `data-cps` | `14` | Characters per second |

### rotating-text

Cycle through phrases.

| Attribute | Default |
|---|---|
| `data-phrases` | _required_ | Pipe-separated list `phrase1\|phrase2\|...` |
| `data-each` | `1.5` | Seconds per phrase |

Embed inside a containing element with a fixed `min-width` so the layout
doesn't jump as phrases change length.

### mask-text

Whole-element clip-path reveal — the text wipes in along an axis.

| Attribute | Default | Notes |
|---|---|---|
| `data-mask-from` | `left` | `left` / `right` / `top` / `bottom` / `center` |
| `data-anim-duration` | `1.0` | |
| `data-easing` | `easeInOutQuart` | |

> **Important:** `mask-text` uses CSS `clip-path: inset(...)`.  In
> Chromium (including headless), `clip-path` interacts poorly with
> `-webkit-text-fill-color: transparent` + `background-clip: text` — the
> gradient fill is hidden under the clip.  Use `mask-text` only on
> solid-color text, OR fall back to `split-text` for gradient titles.

### wave-text

Per-character vertical sine wave. Characters animate in by riding the
wave crest, then continue with a gentle sustained oscillation.

| Attribute | Default | Notes |
|---|---|---|
| `data-stagger` | `0.04` | |
| `data-char-duration` | `0.6` | |
| `data-amplitude` | `40` | Peak Y travel (px) |
| `data-wave` | `1.2` | Wave frequency |
| `data-easing` | `easeOutQuart` | |

Great for poetic phrases, marketing taglines, motion-graphics quotes.

### scramble-text

Like `shuffle-text` but with a wider symbol palette
(`!@#$%&*+={}[]\|01101001`) and a sharper left-to-right resolve.  Use
for technical labels (`init_payload()`, `cargo run --release`,
`hash:0xdeadbeef`).

| Attribute | Default |
|---|---|
| `data-anim-duration` | `1.6` |

### count-up

Animated numeric counter with formatting.

| Attribute | Default | Notes |
|---|---|---|
| `data-from` | `0` | Start value |
| `data-to` | `100` | End value |
| `data-anim-duration` | `2` | Counter duration |
| `data-decimals` | `0` | Decimal places (text mode only) |
| `data-prefix` | `''` | Prepended string (`$`, `~`, etc.) |
| `data-suffix` | `''` | Appended string (`%`, `x`, ...) |
| `data-separator` | `''` | Thousands separator (`','`, `' '`) — works in both modes |
| `data-easing` | `easeOutCubic` | |
| `data-odometer` | `false` | When `true`, renders one DOM column per digit so each digit can flip mechanically as it carries (perspective + opacity dip when `sub-digit > 0.82`).  Use a solid color — gradient-text classes won't propagate through the inner per-digit divs. |

### shuffle-text

Reveals the target string from left to right, scrambling unset characters.

| Attribute | Default |
|---|---|
| `data-anim-duration` | `1.4` |

---

## Backgrounds (`[data-background]`)

Each background mounts a `<canvas>` and re-renders on every `mvm-seek`
event. Performance scales with stage resolution; for 4K you may want to
reduce `data-count` parameters by ~50%.

### aurora

Soft moving radial gradients combined with lighter blending.

| Attribute | Default |
|---|---|
| `data-colors` | `'#3a1c71,#d76d77,#ffaf7b,#3a1c71'` | Comma-separated |

### particles

Deterministic drifting field of glowing dots.

| Attribute | Default |
|---|---|
| `data-count` | `90` | Number of particles |
| `data-color` | `'rgba(255,255,255,0.9)'` | Particle fill |
| `data-size` | `2.2` | Base radius multiplier |
| `data-seed` | `1337` | PRNG seed for reproducibility |

### starfield

Galaxy-style parallax stars warping outward from the screen center.

| Attribute | Default |
|---|---|
| `data-count` | `240` |
| `data-speed` | `0.6` |
| `data-seed` | `7331` |
| `data-bg` | `'rgba(5,7,18,0.4)'` | Per-frame background tint |

### threads

Sinusoidal lines forming a fabric-like texture.

| Attribute | Default |
|---|---|
| `data-lines` | `60` |
| `data-color` | `'rgba(180,200,255,0.18)'` |
| `data-bg` | `'#0a0a14'` |

### waves

Three stacked sinusoidal layers in different colors.

| Attribute | Default |
|---|---|
| `data-colors` | `'#7F7FD5,#86A8E7,#91EAE4'` |
| `data-bg` | `'#070716'` |

### dot-grid

Pulsing dots forming concentric ripples.

| Attribute | Default |
|---|---|
| `data-gap` | `28` | Pixels between dot centers |
| `data-color` | `'#5b86e5'` | |
| `data-bg` | `'#0a0c14'` | |

### hyperspeed

Radial speed-line streaks like a Star Wars jump.

| Attribute | Default |
|---|---|
| `data-count` | `220` |
| `data-colors` | `'#ffffff,#ffd8a8,#ffe2b3'` |
| `data-seed` | `9001` |

### letter-glitch

Matrix-style scrolling glyph cells.

| Attribute | Default |
|---|---|
| `data-cell` | `22` | Cell size in px |
| `data-colors` | `'#00ff9c,#2af598,#009efd,#5b86e5'` |
| `data-bg` | `'#04060a'` |

### noise

Film-grain overlay; use `mix-blend-mode: overlay` and a low opacity (~0.2).

| Attribute | Default |
|---|---|
| `data-strength` | `18` | Noise amplitude |

### magnet-lines

A grid of short line segments that align with a time-varying vector field
produced by multiple orbiting "magnetic poles".  Great for systems /
architecture scenes, or as a subtle decoration that suggests "structure".

| Attribute | Default |
|---|---|
| `data-gap` | `60` | Grid cell size (px) |
| `data-length` | `26` | Line length (px) |
| `data-colors` | `'#5BC0EB,#9d8df1'` | Comma-separated palette cycled per cell |
| `data-poles` | `3` | Number of moving attractors |
| `data-bg` | `'#0a0a14'` | |

### ribbons

N parametric flowing ribbons painted with multiple stroke widths to build
a glow.  Each ribbon is a smooth multi-harmonic sine path animated over
time.  Nice for music / hype intros.

| Attribute | Default |
|---|---|
| `data-count` | `5` | Number of ribbons |
| `data-colors` | `'#FF6363,#5BC0EB,#9d8df1,#FFD400,#2af598'` | One color per ribbon (cycled) |
| `data-bg` | `'#08081a'` | |

### WebGL shader backgrounds

These are mounted from `runtime/shaders.js` (must be loaded after
`components.js`).  All six accept `data-colors` as 4 hex stops, plus
`data-intensity`, `data-scale`, `data-seed`.

| `data-background` | Notes |
|---|---|
| `liquid-ether` | Domain-warped fbm fluid with iridescent rim. |
| `iridescence` | Curved rainbow interference bands radiating from a moving focal point. |
| `prismatic-burst` | Center-radiating volumetric light with chromatic split. |
| `lightning` | Procedural lightning bolts with flicker + bloom. |
| `plasma` | Classic organic plasma noise turbulence. |
| `beams` | Crossing rotating light beams + hot spot. |
| `meta-balls` | N orbiting isosurface meta-balls with gradient interior + chromatic edge highlight. |

---

## Effects (`[data-fx]`)

### clock

Analog clock with hour, minute, second hands.

| Attribute | Default |
|---|---|
| `data-speed` | `1` | Time multiplier (`60` = 1 sec real ≈ 1 minute of clock motion) |

Use a square container so the clock face stays circular.

---

## Element-level effects (`[data-effect]`)

Decorations that attach to **an existing host element** and animate around
it.  They overlay a `<canvas>` inside the host (which is auto-set to
`position: relative` if it isn't already) — so they coexist with the
element's own `data-animation` / `data-text-animation`.

### electric-border

Three RGB-shifted noise-perturbed arcs flow around the host's rounded
perimeter.  Renders 4 stacked stroke widths per arc to build a glow.

| Attribute | Default | Notes |
|---|---|---|
| `data-color` | `#FF6363` | Arc 1 (R) |
| `data-color2` | `#FFD400` | Arc 2 (G) |
| `data-color3` | `#5BC0EB` | Arc 3 (B) |
| `data-intensity` | `1.0` | Arc displacement amplitude multiplier |
| `data-speed` | `1.5` | How fast arcs slide around (cycles/sec) |
| `data-padding` | `24` | Outset padding (px) — bigger gives more glow room |
| `data-border-radius` | `18` (or host CSS) | Corner radius of the perimeter path |

### star-border

N small 4-point stars orbit the host's perimeter with comet-like trails.

| Attribute | Default | Notes |
|---|---|---|
| `data-color` | `#FFFFFF` | Star color (single hex) |
| `data-count` | `6` | Number of orbiting stars |
| `data-tail` | `14` | Trail sample count behind each star |
| `data-speed` | `0.25` | Orbit speed (revolutions/sec) |
| `data-size` | `4` | Star radius (px) — glow scales 5× |
| `data-padding` | `30` | Outset padding (px) |

### image-trail

While the host's `data-clip` is in its **in-animation window** (defined by
`data-start` + `data-in-duration`), draws N ghost copies positioned at
progressively-earlier points in the same animation.  Each ghost has its
opacity multiplied by `decay^(i+1)` so the trail fades cleanly.

| Attribute | Default | Notes |
|---|---|---|
| `data-trail-count` | `5` | Number of ghosts |
| `data-trail-stride` | `0.06` | Time offset between successive ghosts (sec) |
| `data-trail-decay` | `0.55` | Opacity multiplier per ghost index (geometric) |

The ghost reuses the host's `data-animation` (or `data-animation-in`) name
to compute its style — so trails work with `fadeInLeft`, `pop`, `slideUp`,
etc.  Ghosts are inserted as siblings **before** the host in DOM order, so
the main element stays on top.

---

## Outer Animations (`[data-animation]`)

Available presets for `data-animation` / `data-animation-out` (apply to any
`data-clip` element):

### Core (always there)

| Name | Notes |
|---|---|
| `fadeIn` / `fadeOut` | Pure opacity |
| `fadeInUp` / `fadeInDown` / `fadeInLeft` / `fadeInRight` | Opacity + translate |
| `slideUp` / `slideDown` | Translate only |
| `zoomIn` / `zoomOut` | Opacity + scale |
| `pop` | Overshoot scale (back-out feel) |
| `blurIn` / `blurOut` | Opacity + 24px blur |
| `rotateIn` | Opacity + rotate -180° + scale |
| `swing3D` | 3D rotateX from -90° (top hinge) |
| `floatIn` | Opacity + translate + sine bounce |

### Diversification pack (added so parallel elements can use different presets)

| Name | Visual feel | Best for |
|---|---|---|
| `unmaskUp` / `unmaskDown` / `unmaskLeft` / `unmaskRight` | Pure clip-path reveal (no opacity transition) — feels cinematic, "curtain pull" | Titles, headlines, hero quotes |
| `flipInX` | 3D rotateX from 92° (bottom hinge) | Cards flipping face-up |
| `flipInY` | 3D rotateY from -92° (left hinge) | Side panels, comparison cards |
| `cubeIn` | rotateX-50° + translateY-100px (top hinge) | "A face of a cube tumbling into place" |
| `magneticIn` | Tangent slide + small overshoot landing | Buttons / interactive elements being "pulled" |
| `glitchIn` | RGB-split drop-shadow + jitter that lands cleanly | Technical / hacker / chaotic moments |
| `skewIn` | Sheared landing (skewY/skewX → 0) | Editorial subhead, asymmetric layouts |
| `kenBurnsIn` | Slow zoom (1.18 → 1.0) + horizontal drift | Photos, video plates, calm reveals |
| `slideBlurIn` | translateX-60 + blur-12 → 0 | Editorial body text |
| `dropIn` | Falls from above (~260px) with a small bounce settle | Statements, "drops the mic" moments |
| `irisIn` | clip-path circle-reveal + scale | Spotlight moments, "the eye opens" |

### Picking presets to maximize variety

When you have N parallel siblings, draw one preset from each of these
buckets in rotation:

- Mask: `unmaskUp/Down/Left/Right`
- 3D:   `flipInX`, `flipInY`, `cubeIn`, `swing3D`
- Blur: `blurIn`, `slideBlurIn`
- Phys: `magneticIn`, `dropIn`, `floatIn`
- Glitch/skew: `glitchIn`, `skewIn`
- Iris/Ken: `irisIn`, `kenBurnsIn`

Register custom presets at composition load time:

```html
<script>
  window.__mvm.register('myCustomEnter', t => ({
    opacity: t,
    transform: `translateY(${(1-t)*120}px) scale(${0.8 + t*0.2})`,
  }));
</script>
```

---

## Easing Functions

All available via `data-easing` / `data-easing-out`:

`linear`, `easeIn`, `easeOut`, `easeInOut`,
`easeOutCubic`, `easeInOutCubic`,
`easeOutQuart`, `easeInOutQuart`,
`easeOutQuint`,
`easeOutExpo`, `easeInOutExpo`,
`easeOutBack` (overshoot),
`easeOutElastic` (springy),
`easeOutBounce` (decaying bounce).
