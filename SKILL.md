---
name: motion-video-maker
description: >-
  Build polished, fluid, cinematic animations as standalone HTML pages and
  render them deterministically to MP4 video.  Ships with 14 text-animation
  components (split / blur / shiny / gradient / glitch / decrypted /
  typewriter / rotating / count-up with mechanical-odometer flip / shuffle
  / mask / wave / scramble), 11 canvas backgrounds, 7 WebGL fragment-shader
  backgrounds (liquid-ether, iridescence, prismatic-burst, lightning,
  plasma, beams, meta-balls), 24 outer-animation presets including 10
  diversification ones (unmaskUp/Down/Left/Right, flipInX/Y, cubeIn,
  magneticIn, glitchIn, skewIn, kenBurnsIn, slideBlurIn, dropIn, irisIn),
  8 scene-to-scene transitions, 3 element-level effects (electric-border,
  star-border, image-trail), a real spring-physics easing system, a
  text-readability layer (.text-readable, .text-stroke-dark, .text-card,
  .text-scrim and data-scrim runtime backdrop), 12 open-source Chinese
  fonts (Noto Sans/Serif SC, LXGW WenKai, ZCOOL series, Ma Shan Zheng,
  Long Cang, Liu Jian Mao Cao), and a puppeteer-driven frame-accurate
  renderer.  Use when the user asks to make an animated landing page,
  motion-graphics intro, kinetic typography, data-stat reveal,
  Chinese-text animation, or HTML-to-video pipeline; or mentions
  Remotion, Hyperframes, React-Bits, motion graphics, animated
  typography, shader background, electric border, image trail,
  meta balls, mask reveal, wave text, or "make a video".
---

# motion-video-maker

A self-contained skill for authoring **cinematic HTML animations** and
rendering them to **frame-accurate MP4** video. One composition = one HTML
file driven by a tiny deterministic timeline runtime.

```
motion-video-maker/
├── runtime/        # timeline.js, components.js, spring.js, shaders.js,
│                   # transitions.js, effects.js, styles.css
├── assets/fonts/   # 12 open-source Chinese fonts (auto-installed)
├── scripts/        # render.mjs, preview.mjs, install-fonts.mjs,
│                   # new-video.mjs, debug.mjs, snap.mjs
├── templates/      # base.html, diagnostic.html, showcase.html,
│                   # effects-showcase.html (signature effects sampler)
├── examples/       # time-flies/ (30s reference)
│                   # raycast-deep-dive/    (40s v1: canvas only)
│                   # raycast-deep-dive-v2/ (40s v2: + spring + shaders + transitions)
│                   # raycast-deep-dive-v3/ (40s v3: + electric-border / image-trail / odometer)
└── reference/      # components.md, workflow.md
```

**Every composition MUST include this script chain in this order:**

```html
<script src="../../runtime/spring.js"></script>       <!-- physics -->
<script src="../../runtime/timeline.js"></script>     <!-- seekable timeline -->
<script src="../../runtime/components.js"></script>   <!-- text / canvas bg -->
<script src="../../runtime/shaders.js"></script>      <!-- WebGL shader bg  -->
<script src="../../runtime/transitions.js"></script>  <!-- scene transitions -->
<script src="../../runtime/effects.js"></script>      <!-- electric / star / image-trail -->
```

## Quick Start

```bash
# 1) One-time setup (installs Chinese fonts; idempotent)
node scripts/install-fonts.mjs

# 2) Scaffold a new composition
node scripts/new-video.mjs my-video --duration 12 --fps 30 --bg aurora

# 3) Live-preview in a browser
node scripts/preview.mjs examples/my-video/index.html
#   → http://localhost:5173/examples/my-video/index.html

# 4) Render to MP4 (frame-accurate, deterministic)
node scripts/render.mjs examples/my-video/index.html examples/my-video/output.mp4
```

See [`examples/time-flies/index.html`](examples/time-flies/index.html) for a
complete 30-second reference composition that exercises every component.

## How a Composition Works

A composition is **one HTML file** with three layers:

1. **`<div id="stage" data-*>`** — declares pixel size, fps, total duration.
2. **`[data-background]`** — full-bleed animated backgrounds (canvas).
3. **`[data-clip]`** — any element that appears, moves, or animates.

```html
<div id="stage" data-composition-id="my-video"
     data-width="1920" data-height="1080"
     data-fps="30" data-duration="10">

  <div data-background="aurora"
       data-colors="#3a1c71,#d76d77,#ffaf7b"></div>

  <h1 class="title text-aurora"
      data-clip data-start="0.5" data-duration="9"
      data-text-animation="split-text"
      data-stagger="0.06" data-char-duration="0.9">你好，世界</h1>

  <p class="subtitle"
     data-clip data-start="1.4" data-duration="8"
     data-animation="fadeInUp" data-in-duration="0.8">第一帧</p>
</div>

<script src="../../runtime/timeline.js"></script>
<script src="../../runtime/components.js"></script>
```

The renderer (`render.mjs`) launches headless Chromium, sets
`window.__mvmRenderMode = true` to suppress the wall-clock preview loop,
then for every frame `i` calls `window.__mvm.seek(i / fps)` and screenshots
the page. Frames are encoded to H.264 MP4 via FFmpeg.

## Composition Attributes Reference

### Stage (`#stage`)

| Attribute | Purpose | Example |
|---|---|---|
| `data-width` / `data-height` | Canvas pixel size | `1920` / `1080` |
| `data-fps` | Frames per second | `30` (recommended) |
| `data-duration` | Total seconds | `30` |
| `data-background` | Page-level bg color | `#0a0a0f` |

### Clip (`[data-clip]`)

Governs **visibility window** and outer **in/out animation** of any element.

| Attribute | Purpose |
|---|---|
| `data-start` | When the clip first appears (seconds) |
| `data-duration` | How long the clip stays visible |
| `data-animation` (or `data-animation-in`) | In animation: `fadeIn` `fadeInUp` `fadeInDown` `fadeInLeft` `fadeInRight` `slideUp` `slideDown` `zoomIn` `zoomOut` `pop` `blurIn` `blurOut` `rotateIn` `swing3D` `floatIn` |
| `data-animation-out` | Out animation (any of the above ending in `Out` or any name from the list) |
| `data-in-duration` / `data-out-duration` | Animation duration (default 0.6s) |
| `data-easing` / `data-easing-out` | Standard: `linear` `easeIn` `easeOut` `easeInOut` `easeOutCubic` `easeInOutCubic` `easeOutQuart` `easeInOutQuart` `easeOutQuint` `easeOutExpo` `easeInOutExpo` `easeOutBack` `easeOutElastic` `easeOutBounce`. **Spring physics**: `springGentle` `springSoft` `springSnap` `springSmooth` `springBouncy` `springWobbly` `springStiff` |
| `data-hide-mode` | **`visibility` (default — keeps the layout slot so siblings DON'T jump when a later element fades in)** or `display` (legacy — removes from layout). Set `display` only when you actually want surrounding content to collapse into the empty space. |
| `data-scrim` | Auto-inject a backdrop layer behind the element so text stays readable on busy shader/particle backgrounds. Values: `card` (translucent dark pill + blur), `blur` (semi-dark + backdrop-filter blur), `radial` (radial darkness fade), `auto` (radial + auto drop-shadow). Tune with `data-scrim-padding`, `data-scrim-opacity`, `data-scrim-radius`, `data-scrim-color`, `data-scrim-blur`. |

**Available outer-animation presets** (for `data-animation` / `data-animation-in` / `data-animation-out`):

| Group | Names |
|---|---|
| **Fade / slide** | `fadeIn` `fadeOut` `fadeInUp` `fadeInDown` `fadeInLeft` `fadeInRight` `slideUp` `slideDown` |
| **Scale / pop** | `zoomIn` `zoomOut` `pop` `kenBurnsIn` `irisIn` |
| **Blur** | `blurIn` `blurOut` `slideBlurIn` |
| **Rotate / 3D** | `rotateIn` `swing3D` `flipInX` `flipInY` `cubeIn` `skewIn` |
| **Mask reveal** | `unmaskUp` `unmaskDown` `unmaskLeft` `unmaskRight` (clip-path inset – feels cinematic) |
| **Physics-ish** | `floatIn` `magneticIn` `dropIn` `glitchIn` |

> **Variety tip:** when you have N parallel elements (cards, list items, layers), give each one a *different* preset from a different group — that's exactly what turns a "generic" composition into a polished one.

### Text animations (`[data-text-animation]`)

Use **on the element whose text you want to animate**. Combine with `data-clip` so the element has a defined visibility window. The text component reads `data-anim-duration` for its own animation length, falling back to `data-duration`.

| `data-text-animation` | Effect | Key attributes |
|---|---|---|
| `split-text` | Per-char staggered fade+slide | `data-stagger` `data-char-duration` `data-travel` `data-split-mode` (`char`/`word`) |
| `blur-text` | Per-char blur → focus | `data-stagger` `data-char-duration` |
| `shiny-text` | Metallic sheen sweep | `data-speed` |
| `gradient-text` | Animated rainbow sweep | `data-colors` `data-speed` |
| `glitch-text` | RGB split + jitter | `data-intensity` |
| `decrypted-text` | Hacker-style decode | `data-anim-duration` |
| `type-text` | Typewriter + blinking cursor | `data-cps` (chars/second) |
| `rotating-text` | Cycle through phrases | `data-phrases` (pipe-separated) `data-each` |
| `count-up` | Animated number counter — set `data-odometer="true"` for **mechanical-flip rendering** (each digit is a separate column that gently rotates as it carries) | `data-from` `data-to` `data-anim-duration` `data-decimals` `data-prefix` `data-suffix` `data-separator` `data-odometer` |
| `shuffle-text` | Char shuffle reveal | `data-anim-duration` |
| `mask-text` | Whole-text clip-path reveal — wipe direction set by `data-mask-from` (`left` / `right` / `top` / `bottom` / `center`).  **Note:** does NOT compose well with `.text-raycast` / `.text-aurora` / `.text-fire` gradient classes that use `-webkit-text-fill-color: transparent` (Chromium hides the gradient under a clip-path).  Use on solid-color text or pair with `data-scrim`. | `data-mask-from` `data-anim-duration` `data-easing` |
| `wave-text` | Per-char vertical sine wave that travels across the text — characters ride the crest into place. | `data-stagger` `data-char-duration` `data-amplitude` `data-wave` `data-easing` |
| `scramble-text` | Symbol/digit scramble that resolves left→right (more aggressive than `shuffle-text` — uses `!@#$%&*+={}[]\\|01101001`). Great for technical labels. | `data-anim-duration` |

### Backgrounds (`[data-background]`)

Absolute-positioned full-stage backgrounds — both Canvas2D and WebGL.

**Canvas backgrounds** (lighter, no GPU):

| `data-background` | Effect | Key attributes |
|---|---|---|
| `aurora` | Lightful gradient orbs | `data-colors` |
| `particles` | Drifting particle field | `data-count` `data-color` `data-size` `data-seed` |
| `starfield` | Galaxy / parallax stars | `data-count` `data-speed` `data-seed` `data-bg` |
| `threads` | Sinusoidal flowing lines | `data-lines` `data-color` `data-bg` |
| `waves` | Layered ocean waves | `data-colors` `data-bg` |
| `dot-grid` | Pulsing radial dot grid | `data-gap` `data-color` `data-bg` |
| `hyperspeed` | Radial speed-line warp | `data-count` `data-colors` `data-seed` |
| `letter-glitch` | Matrix-style char cells | `data-cell` `data-colors` `data-bg` |
| `noise` | Film-grain overlay | `data-strength` |
| `magnet-lines` | Vector-field grid where short line segments align toward animated magnetic poles | `data-colors` `data-poles` `data-gap` `data-length` `data-bg` |
| `ribbons` | Multi-layer parametric flowing ribbons with glow | `data-colors` `data-count` `data-bg` |

**WebGL fragment-shader backgrounds** (richer, real shaders — require `shaders.js`):

| `data-background` | Effect | Common attributes |
|---|---|---|
| `liquid-ether` | Domain-warped fbm fluid, iridescent rim | `data-colors` (4 stops) `data-intensity` `data-scale` |
| `iridescence` | Curved rainbow interference bands | `data-colors` `data-intensity` `data-scale` `data-seed` |
| `prismatic-burst` | Center-radiating volumetric light + chromatic split | `data-colors` `data-intensity` |
| `lightning` | Procedural lightning bolts with flicker + glow | `data-colors` `data-intensity` `data-seed` |
| `plasma` | Classic organic plasma turbulence | `data-colors` `data-intensity` `data-scale` |
| `beams` | Crossing rotating light beams + hot spot | `data-colors` `data-intensity` |
| `meta-balls` | N orbiting isosurface meta-balls with gradient fill + chromatic edge highlight | `data-colors` `data-intensity` `data-scale` `data-seed` |

All shader backgrounds accept `data-colors` as 4 hex stops (e.g. `"#FF6363,#FF8B5E,#FFD400,#0a0a16"`).

### Scene transitions (`[data-transition]`)

Place a `<div data-transition="..." data-start="..." data-duration="...">`
**anywhere inside `#stage`** — it auto-mounts a fullscreen overlay canvas
that paints the transition over everything from `start` to `start+duration`.

| `data-transition` | Effect | Extra attributes |
|---|---|---|
| `wipe-up` / `wipe-down` / `wipe-left` / `wipe-right` | Solid bar sweeps across | `data-color` `data-easing` |
| `wipe` (with `data-dir="diag"`) | Diagonal sweep | as above |
| `iris` / `circle-reveal` | Circular mask shrinks then expands | `data-color` `data-easing` |
| `pixel-dissolve` | Deterministic tile reveal + hide | `data-color` `data-tile` |
| `shape` | Twin-shape morph with circle erase | `data-color` `data-easing` |
| `flash` | Quick full-screen flash | `data-color` (white default) |
| `glitch` | RGB-split + horizontal panel tear | — |

The full transition window is `duration`; half-way through (`p=0.5`) the
overlay is fully opaque so the underlying scenes can swap invisibly.

### Effects (`[data-fx]`)

| `data-fx` | Effect | Key attributes |
|---|---|---|
| `clock` | Analog clock with hands | `data-speed` (time multiplier) |

### Element-level effects (`[data-effect]`)

Decorations that attach to **an existing element** and animate around it.
Inspired by react-bits' ElectricBorder / StarBorder / ImageTrail.

| `data-effect` | Effect | Key attributes |
|---|---|---|
| `electric-border` | RGB-split, noise-perturbed electric arcs flowing around the element's rounded perimeter | `data-color` `data-color2` `data-color3` `data-intensity` `data-speed` `data-padding` `data-border-radius` |
| `star-border` | N glowing 4-point stars orbit the perimeter with comet trails | `data-color` `data-count` `data-tail` `data-speed` `data-size` `data-padding` |
| `image-trail` | While the element is *entering*, draws N ghost copies that lag the in-animation progress, fading out behind it. Reads the element's `data-animation` to reuse its in-style. | `data-trail-count` `data-trail-stride` `data-trail-decay` |

```html
<!-- card with electric flowing border, perfect for "chosen" highlights -->
<div class="card chosen"
     data-effect="electric-border"
     data-color="#FF6363" data-color2="#FFD400" data-color3="#5BC0EB"
     data-intensity="1.3" data-speed="1.4" data-padding="22"
     data-border-radius="18"
     data-clip data-start="2" data-duration="6"
     data-animation="pop" data-easing="springBouncy"
     style="opacity:0;">CHOSEN</div>

<!-- title with image-trail during its slide-in -->
<h1 data-effect="image-trail"
    data-trail-count="5" data-trail-stride="0.06" data-trail-decay="0.7"
    data-clip data-start="0" data-duration="4"
    data-animation="fadeInLeft" data-in-duration="0.9"
    data-easing="springSmooth">FLOW</h1>
```

## Background palette + matching text class — the PALETTE PAIR rule

This is the **#1 thing other agents got wrong** in the wild: choosing
a shader palette and a text gradient class from the same hue family,
producing invisible text. Examples observed:

- `.text-aurora` (cyan/blue/violet gradient) on `liquid-ether` with a
  blue/violet `data-colors` → text vanishes into the background.
- `.text-fire` (yellow/orange/red gradient) on `meta-balls` with a
  red/orange `data-colors` → text vanishes into the background.

To eliminate this entire class of bugs, the runtime now ships
**named palettes** for every shader and **matching text classes** that
have been hand-tuned for 4.5:1 contrast against that palette family.
You only ever have to pick one of each.

### Named palettes (`data-palette="..."`)

| Family | Palette names | Best with text class |
|---|---|---|
| **Cool** (blue / violet) | `cool-deep` `cool-arctic` `cool-neon` `cool-violet` | `.text-on-cool` (warm yellow) / `.text-on-cool-soft` |
| **Warm** (red / orange / gold) | `warm-glow` `warm-sunset` `warm-ember` `warm-autumn` | `.text-on-warm` (cool white-blue) / `.text-on-warm-soft` |
| **Prismatic** (rainbow / vapor) | `prismatic-cyber` `prismatic-vapor` `prismatic-magic` | `.text-on-prismatic` (pure white + heavy halo) |
| **Mono** (deep neutral) | `mono-deep` `mono-ink` `mono-graphite` | `.text-on-mono` (warm yellow) |
| **Light** (paper / misty) | `light-paper` `light-misty` | `.text-on-light` (dark ink) |

```html
<!-- ✅ Cool palette + cool text class -->
<div data-background="liquid-ether" data-palette="cool-deep"
     data-clip data-start="0" data-duration="6"
     data-animation="fadeIn" data-animation-out="fadeOut"></div>

<div class="scene-scrim" data-clip data-hide-mode="visibility"
     data-start="0" data-duration="5.5"
     style="position:absolute; inset:0; z-index:10; display:flex; ...">
  <p class="eyebrow text-on-cool">ANIMATION COMPONENTS</p>
  <h1 class="text-on-cool" style="font-size:120px; color:#fff;">标题</h1>
</div>

<!-- ❌ Don't do this — .text-aurora over a cool shader = invisible -->
<h1 class="text-aurora" ...>标题</h1>
```

### Drop-in stat-card preset (`.mvm-stat`)

When showing numeric stats on any shader, use the `.mvm-stat` family
to skip color-picking entirely. Pair the border accent with the
scene's palette family:

```html
<!-- Cool-themed scene → red/cool/warm accents from .mvm-stat--* -->
<div class="mvm-stat mvm-stat--red"
     data-clip ... data-animation="magneticIn">
  <span class="mvm-stat-num" data-text-animation="count-up" data-odometer="true"
        data-from="0" data-to="17">0</span>
  <span class="mvm-stat-label">种文字动画</span>
</div>
```

The stat card has a solid dark plate built-in (no contrast worry),
white digits, muted serif label, and the accent border lets you
differentiate three or four stats by hue without changing text color.

See **[`examples/skill-intro/index.html`](examples/skill-intro/index.html)** — 6 scenes,
6 different palettes, 0 contrast warnings.

## Color & contrast contract — READ THIS FIRST

The runtime gives every composition a **white-on-dark default**. Follow
three rules and your text will always be visible:

### Rule 1 — Always link `runtime/styles.css` BEFORE author CSS

```html
<head>
  <link rel="stylesheet" href="../../runtime/styles.css" />   <!-- FIRST -->
  <link rel="stylesheet" href="../../assets/fonts/fonts.css" />
  <style>/* your overrides */</style>
</head>
```

Without this, `#stage` has no default `color`/`background-color` and
the browser falls back to **black-on-white** — invisible against the
dark backgrounds you probably want.

### Rule 2 — If you set `background: light` on ANY element, also set `color: dark` (and vice versa)

`#stage` defaults to `background: var(--mvm-bg, #0a0a0f)` and
`color: var(--mvm-text, #fff)`.  Every descendant inherits the white
text **unless** you (or a class you apply) explicitly changes it.

This is the #1 mistake: an agent writes
```html
<div style="background: white; padding: 30px;">
  <h2>这个会看不见</h2>
</div>
```
…and the heading inherits white → invisible on white card. **Solution:**
use the paired utility classes, NEVER write half-pairs.

| If your container has… | Use this class |
|---|---|
| Dark background | `.mvm-card-dark` — paints dark + sets text white |
| Light background | `.mvm-card-light` — paints light + sets text dark |
| Need just text color | `.mvm-light` (white) / `.mvm-dark` (#0a0a0f) |
| Need full-scene theme flip | `.mvm-bg-light` / `.mvm-bg-dark` on the scene wrapper |
| Need a tonal mute | `.mvm-light-muted` / `.mvm-dark-muted` |

```html
<!-- ✅ Good — paired class -->
<div class="mvm-card-light">
  <h2>清晰可见 — 亮卡片自动配深字</h2>
</div>

<!-- ✅ Good — explicit pair -->
<div style="background:#FFD400; color:#1a0a08; padding:30px;">
  <h2>also fine — explicit dark text on yellow</h2>
</div>

<!-- ❌ Bad — only background, color forgotten -->
<div style="background: white; padding: 30px;">
  <h2>invisible — inherits white from #stage</h2>
</div>
```

### Rule 3 — Run the contrast checker (it's automatic during render)

`runtime/contrast-check.js` runs on every `mvm-seek` tick and walks
every visible text element under `#stage`, computes the WCAG luminance
ratio against its effective background, and emits a `console.warn` for
any element under **2.2:1** (essentially invisible).

`render.mjs` collects those warnings and prints a one-shot summary at
the end of the export so you never ship an MP4 with hidden text:

```
[mvm] ⚠ 2 LOW-CONTRAST TEXT ISSUE(S) DETECTED
[mvm]   • text "看不见" (color rgb(255,255,255)) on background rgba(255,255,255,1)
[mvm]     at <h2.subtitle>. Fix: add .mvm-light / .mvm-card-dark, or set color/background explicitly.
```

`templates/contrast-test.html` is a self-test page with 4 cells (2 bad
+ 2 good) you can use as a regression test of the safety net.

### Theming an entire composition

```html
<!-- Light-themed composition: flip --mvm-bg and --mvm-text on #stage -->
<div id="stage"
     style="--mvm-bg: #f7f5ef; --mvm-text: #0a0a0f;"
     data-width="1920" data-height="1080" data-fps="30" data-duration="10">
  <!-- now every default-text descendant is DARK on light, automatic -->
</div>
```

## Keeping text readable on busy backgrounds

Shader / particle / video backgrounds tend to swallow typography.  The
skill provides a **3-layer defense** — pick the strongest layer your
scene needs:

### Layer 1 — `.scene-scrim` on the scene container (recommended baseline)

Adds a CSS-only radial dark vignette covering the entire scene area,
sitting between the shader background and the foreground content.
Every text inside gets a "free" 30–60% darkness lift with no per-text
tuning.

| Class | Darkness profile |
|---|---|
| `.scene-scrim` | Radial 35–60% center→edge (default) |
| `.scene-scrim-soft` | 15–35% (subtle) |
| `.scene-scrim-strong` | 55–80% (heavy — turns bright backgrounds nearly black) |
| `.scene-scrim-top` | Linear 0–85% top edge (lower-third style) |
| `.scene-scrim-bottom` | Linear bottom edge gradient |

```html
<!-- Scene 4 in raycast-deep-dive-v4: iridescence shader auto-darkened -->
<div class="scene-scrim"
     data-clip data-hide-mode="visibility"
     data-start="14.5" data-duration="7.5"
     style="z-index: 10; position: absolute; inset: 0;">
   ... scene content ...
</div>
```

> **Important:** apply `.scene-scrim` to a container that already has
> `position: absolute / fixed / relative`. The `.scene-scrim` style
> does NOT set position itself (so it doesn't clobber your layout).

### Layer 2 — per-element wrappers when you need guaranteed contrast

| Helper | What it does | When to use |
|---|---|---|
| `.text-readable` | Multi-layer dark `text-shadow` only (safe with gradient text classes) | Default for any title sitting on a shader |
| `.text-stroke-dark` | 2px dark `-webkit-text-stroke` with `paint-order: stroke fill` | Solid-color body text |
| `.text-stroke-dark-thick` | 4px dark stroke variant | Captions on very bright backgrounds |
| `.text-glow-dark` | Heavy dark `text-shadow` alone | When you want extra "lift" without strokes |
| `.text-card` | Translucent dark rounded pill `backdrop-filter: blur(20px)` | Quotes / hero lower-thirds (best on shaders that support backdrop-filter) |
| **`.text-plate`** | **Solid dark `rgba(6,8,14,0.82)` rounded pill — NO backdrop-filter, works in EVERY render path** | **Use when you absolutely cannot afford the text to blend in** |
| `.text-plate-tight` / `-loose` / `-soft` / `-hard` | Padding & opacity variants of `.text-plate` | |
| `.text-scrim` | Built-in radial CSS scrim around the element | Pure CSS, render-frame-buffer safe |
| `data-scrim="card / radial / blur / auto"` | Runtime injects a backdrop element behind the host | One-off "make it readable" |
| `.scrim-top` / `.scrim-bottom` | Top/bottom edge gradient bars (lower-third feel) | News-ticker / broadcast captions |

### Layer 3 — color-pairing rule of thumb

If your text uses a *warm* gradient (`.text-raycast`, `.text-fire`,
`.text-gold`), give it a **cool** background shader (`liquid-ether`
with blue/violet palette, `iridescence` with cool stops). If your
text is *cool* (`.text-blue`, `.text-aurora`), choose a warm-dark
background. This single rule eliminates most readability bugs.

### Known gotchas (documented from real-world v3 → v4 fixes)

1. **`-webkit-text-fill-color: transparent` + 3D `transform` breaks
   gradient text in Chromium.**  `flipInX/Y`, `cubeIn`, `swing3D`,
   and `irisIn` introduce perspective; if you must use them, switch
   to solid `color: white` + `text-shadow` instead of a gradient class.
   That's what closing-title in `raycast-deep-dive-v4` does.
2. **`-webkit-text-stroke` on transparent-gradient text makes it
   appear hollow** — `.text-readable` deliberately uses only
   `text-shadow` (no stroke, no `filter`) so it composes safely with
   `.text-raycast` / `.text-aurora`.
3. **`mask-text` (clip-path) + gradient text also fails** in
   Chromium screenshot mode — fall back to `split-text` for gradient
   titles.

```html
<!-- Hero title on a busy shader: cool background + warm gradient + readable -->
<div data-background="liquid-ether"
     data-colors="#06061a,#1a1240,#2a2070,#0a3055"></div>
<h1 class="hero-title text-raycast text-readable"
    style="filter: drop-shadow(0 8px 40px rgba(255,99,99,0.5))
                   drop-shadow(0 4px 12px rgba(0,0,0,0.9));"
    data-clip data-start="0.7" data-duration="3.3"
    data-text-animation="split-text">RAYCAST 2.0</h1>

<!-- Closing quote with an explicit dark card -->
<p class="quote-text text-readable text-card"
   style="padding: 32px 80px;"
   data-clip data-start="35" data-duration="3"
   data-text-animation="wave-text">代码只是手段，产品才是目的。</p>

<!-- Generic "make it readable" -->
<h2 data-scrim="auto" data-scrim-padding="32"
    data-clip data-start="5" data-duration="4">任何标题</h2>
```

## Layout stability — siblings never jump when another sibling enters

Earlier versions used `display: none` as the default hide state, which
meant a later sibling appearing would re-trigger flex/grid layout and
push already-visible siblings around. **From this version on,
`data-hide-mode` defaults to `"visibility"` instead.**

What that means in practice:

- A hidden clip still **occupies its layout slot** (its width / height
  are reserved in the flex/grid track).
- When a sibling fades in, surrounding siblings keep their pixel
  position — **zero jump**.
- Your `transform` animations (translate, rotate, scale) still move the
  visual position freely; only the layout slot is preserved.

If you actually want the legacy "fully remove from layout" behaviour
(e.g. for a corner element that should completely disappear and let
surrounding content collapse into its slot), opt in explicitly:

```html
<div data-clip data-hide-mode="display"
     data-start="3" data-duration="2">temporary tooltip</div>
```

See `examples/raycast-deep-dive-v4/stability-readability.jpg` for a
visual proof: 5 timestamps of the same scene, every already-visible
element stays exactly where it was while new elements enter.

## Animation variety — avoid the "fadeIn everything" trap

A common mistake is to apply the same entrance animation to every
element in a scene.  The runtime ships **24 outer-animation presets**
across 6 groups so you can mix them:

```html
<!-- A row of 4 cards, each with a DIFFERENT animation preset -->
<div class="card" data-animation="unmaskLeft"  data-easing="easeInOutQuart">...</div>
<div class="card" data-animation="slideBlurIn" data-easing="springSoft">...</div>
<div class="card" data-animation="magneticIn"  data-easing="springBouncy">...</div>
<div class="card" data-animation="glitchIn"    data-easing="easeOutCubic">...</div>
```

This is exactly the technique used in `examples/raycast-deep-dive-v4/`
to upgrade from a "generic" v3 to a polished v4.

## Authoring Workflow

1. **Pick a duration.** 6–15s is great for hooks; 30s for fuller pieces.
2. **Sketch scenes by time.** E.g.: 0–4s opener, 4–9s point 1, 9–18s data, 18–30s finale.
3. **Pick one background per scene** (cross-fade by giving the prior bg `data-animation-out="fadeOut"`).
4. **Wrap each scene** in a container with `data-clip` (the default `data-hide-mode="visibility"` keeps the child layout stable) so all children share the same visibility window:
   ```html
   <div class="scene center"
        data-clip data-hide-mode="visibility"
        data-start="4.0" data-duration="5.0">
     ... clips here ...
   </div>
   ```
5. **Use `text-animation` for kinetic text**, plain `data-animation` for outer transforms (zoom, slide, fade).
6. **Preview at 15fps first** to iterate quickly:
   ```bash
   node scripts/render.mjs path/to/index.html /tmp/preview.mp4 fps=15 preset=ultrafast crf=24
   ```
7. **Render final at 30fps**:
   ```bash
   node scripts/render.mjs path/to/index.html path/to/output.mp4 fps=30 preset=medium crf=18
   ```

## Common Patterns

### Gradient text + character split

The runtime detects `color: transparent` + `background-clip: text` parents and
copies the gradient onto each split span, so the effect survives. Use the
preset classes `.text-aurora`, `.text-fire`, `.text-gold`, `.text-silver`.

```html
<h1 class="title text-fire"
    data-clip data-start="0" data-duration="4"
    data-text-animation="split-text" data-stagger="0.08">光阴似箭</h1>
```

### Scene-wide entrance + per-element timing

Outer scene controls visibility; inner clips animate in staggered:

```html
<div class="scene center" data-clip data-hide-mode="visibility"
     data-start="10" data-duration="6">
  <h1 data-clip data-start="10.2" data-duration="5.6"
      data-text-animation="split-text">标题</h1>
  <p  data-clip data-start="11.0" data-duration="4.8"
      data-animation="fadeInUp">副标题</p>
</div>
```

### Animated counter (plain or odometer-flip)

```html
<!-- plain (textContent updated per frame) -->
<span data-clip data-start="5" data-duration="6"
      data-text-animation="count-up"
      data-from="0" data-to="86400" data-anim-duration="3"
      data-separator="," data-easing="easeOutExpo">0</span>

<!-- odometer: per-digit columns rotate mechanically as they carry -->
<span style="font-size:200px; font-weight:900;"
      data-clip data-start="5" data-duration="6"
      data-text-animation="count-up"
      data-odometer="true"
      data-from="0" data-to="86400" data-anim-duration="3"
      data-separator="," data-easing="easeOutExpo">0</span>
```

> **Odometer caveat:** the inner per-digit divs do **not** inherit
> `background-clip: text` gradients. Use a solid `color` on the counter
> element instead of `.text-aurora` / `.text-fire`.

### Cross-fading backgrounds

```html
<div data-clip data-start="0" data-duration="12"
     data-animation="fadeIn" data-animation-out="fadeOut"
     data-background="aurora"></div>
<div data-clip data-start="11.5" data-duration="8"
     data-animation="fadeIn" data-animation-out="fadeOut"
     data-background="dot-grid"></div>
```

## Chinese Typography

Twelve preinstalled families (`assets/fonts/fonts.css`):

* **`Noto Sans SC`** 400/700/900 — modern sans
* **`Noto Serif SC`** 400/900 — classical serif
* **`LXGW WenKai`** 400 — calligraphic wenkai (霞鹜文楷)
* **`ZCOOL XiaoWei`** / **`ZCOOL KuaiLe`** / **`ZCOOL QingKe HuangYou`** — display
* **`Ma Shan Zheng`** (马善政毛笔) — brush strokes
* **`Long Cang`** (龙藏体) — calligraphic flow
* **`Liu Jian Mao Cao`** (柳建毛草) — running script

**Default body family changed in v5** — now prefers `Noto Serif SC`
(思源宋体) → `LXGW WenKai` (霞鹜文楷) → `STSong` / `Songti SC`, falling
back to the modern Noto Sans family.  This gives Chinese text a more
literary / elegant feel out of the box.  When you need the impact-heavy
modern look (e.g. big digit displays, monospace eyebrows), opt in via:

| Class | Family stack | When to use |
|---|---|---|
| `.cn-serif` | Noto Serif SC → Source Han Serif → STSong | Default body / titles (elegant) |
| `.cn-wenkai` (aliased to `.wenkai`) | LXGW WenKai → Noto Serif SC | Poetic quotes, calligraphic body |
| `.cn-sans` | Noto Sans SC → PingFang → YaHei | Big digit numbers / poster labels |
| `.cn-mono` (aliased to `.mono`) | JetBrains Mono | Code / timestamps / eyebrows |
| `.cn-poster` | ZCOOL XiaoWei → Noto Serif SC | Decorative posters |
| `.cn-brush` | Ma Shan Zheng → Long Cang → LXGW WenKai | 毛笔 brush titles (≤ 8 chars) |
| `.cn-running` | Long Cang → Liu Jian Mao Cao | 行草 running script |

`.title` / `.title-md` / `.title-sm` / `.huge` now default to the serif
family with looser tracking (`letter-spacing: 0.02em`) which makes large
Chinese headlines breathe properly. Add `.cn-sans` to force sans:

```html
<!-- elegant default — serif 思源宋体 Black -->
<h1 class="title">岁月静好</h1>

<!-- modern poster look -->
<h1 class="title cn-sans" style="letter-spacing: -0.02em;">2026 KEYNOTE</h1>

<!-- calligraphic poem -->
<p class="cn-wenkai" style="font-size: 60px;">「春水初生，春林初盛」</p>

<!-- brush 4-char title -->
<h1 class="cn-brush" style="font-size: 280px;">活在当下</h1>
```

Other helper classes: `.subtitle`, `.caption`, `.text-gold`,
`.text-aurora`, `.text-fire`, `.text-silver`, `.text-stroke`, `.glow`,
`.glow-cool`, plus the readability stack (`.text-readable`,
`.text-stroke-dark`, `.text-plate`, `.text-card`).

To add additional fonts, drop a TTF/OTF/WOFF2 into `assets/fonts/` and append
an `@font-face` rule to `assets/fonts/fonts.css`, or extend the manifest in
`scripts/install-fonts.mjs` and re-run it.

## Render Options

```bash
node scripts/render.mjs <input.html> [output.mp4] [key=value ...]
```

| Option | Default | Notes |
|---|---|---|
| `fps=` | from `data-fps` | Override frame rate |
| `duration=` | from `data-duration` | Override duration (s) |
| `width=` / `height=` | from `data-*` | Override stage size |
| `crf=` | `18` | x264 quality (lower = better, 16 archival, 23 web) |
| `preset=` | `slow` | `ultrafast` for previews, `medium`/`slow` for finals |
| `keepFrames=1` | off | Keep PNG sequence beside the MP4 |

## Debugging

If something doesn't appear:

1. `node scripts/debug.mjs <input.html> <time> <selector>`
   Dumps each matching element's computed `display` / `visibility` /
   `opacity` / `transform` / bounding rect at that instant.
2. `node scripts/snap.mjs <input.html> <time> <out.png>`
   Saves a high-res single-frame screenshot for visual inspection.
3. Open `scripts/preview.mjs` in a browser — the wall-clock loop runs and
   any JS error appears in DevTools.

## Lineage — What this skill borrows from where

| Borrowed from | What we took |
|---|---|
| **react-bits** | Component taxonomy (text / animations / backgrounds / decorations); naming (`split-text`, `blur-text`, `decrypted-text`, `iridescence`, `liquid-ether`, `prismatic-burst`, `lightning`, `plasma`, `beams`, `meta-balls`, `pixel-dissolve`, `electric-border`, `star-border`, `image-trail`, `magnet-lines`, `ribbons`, `odometer`); the "shader background" idea (we wrote our own GLSL from scratch instead of porting OGL). |
| **motion.dev / framer-motion** | Closed-form spring physics math (damped harmonic oscillator) for `springGentle/Soft/Snap/Smooth/Bouncy/Wobbly/Stiff`. |
| **hyperframes** | HTML-native composition; `data-*` attribute API; single `index.html` per video; puppeteer-screenshot frame capture. |
| **remotion** | Frame-accurate deterministic seek; image2pipe → ffmpeg encoder; chrome launch flags. |

The shader backgrounds (`liquid-ether`, `iridescence`, `meta-balls`, etc.)
are NOT ports of react-bits' OGL implementations — they are hand-written
GLSL fragment shaders using FBM noise, polar warps, isosurface fields and
procedural primitives. Element-level effects (`electric-border`,
`star-border`, `image-trail`) and canvas decorations (`magnet-lines`,
`ribbons`) are likewise re-implemented from scratch on plain Canvas2D, so
the runtime stays zero-dependency.

## Additional Resources

- **[reference/components.md](reference/components.md)** — full per-component prop tables and gotchas.
- **[reference/workflow.md](reference/workflow.md)** — step-by-step recipes (data video, ad bumper, social hook).
- **[examples/time-flies/index.html](examples/time-flies/index.html)** — annotated 30s reference composition.
- **[examples/raycast-deep-dive-v2/index.html](examples/raycast-deep-dive-v2/index.html)** — 40s deep-dive showing spring + shader + transition together.
- **[examples/raycast-deep-dive-v3/index.html](examples/raycast-deep-dive-v3/index.html)** — 40s v3 with electric-border on Hybrid card + magnet-lines architecture + image-trail rows + odometer memory counters.
- **[examples/raycast-deep-dive-v4/index.html](examples/raycast-deep-dive-v4/index.html)** — 40s v4: text-readability pass (`.scene-scrim` on every scene, gradient-on-3D-transform fixes), `data-hide-mode="visibility"` default that eliminates layout jitter, Scene-2 layout overhauled to centered flex (no more right-edge overflow on "macOS + Windows" tag), and 12+ different animation presets across 7 scenes.
- **[examples/time-flies-v2/index.html](examples/time-flies-v2/index.html)** — 42s reflective piece on time. Showcases the elegant serif default (思源宋体 Black for 「时间飞逝」/「活在当下」titles, 霞鹜文楷 for poetic quotes), 7 different shader backgrounds, 6 inter-scene transitions, 12+ entrance animations, and the full odometer chain (463 → 70 → 3,600 → 86,400 → 525,600). See `contact-sheet.jpg`.
- **[examples/optimization-v5-summary.jpg](examples/optimization-v5-summary.jpg)** — 6-frame proof that both v5 fixes landed: typography upgrade + Scene 2 overflow fix.
- **[templates/showcase.html](templates/showcase.html)** — 6-cell grid that renders every shader at once.
- **[templates/effects-showcase.html](templates/effects-showcase.html)** — 6-cell sampler for electric-border, star-border, image-trail, meta-balls, magnet-lines, ribbons.
- **[templates/readable-showcase.html](templates/readable-showcase.html)** — 12-cell grid that tests `.text-readable` / `data-scrim` against busy shaders, plus a sampler for the 10 new outer-animation and 3 new text-animation presets.
