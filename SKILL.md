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
  renderer.  Now also bundles the full GSAP animation engine (gsap 3.15)
  with deterministic seek bridge — every plugin including SplitText,
  DrawSVGPlugin, MorphSVGPlugin, MotionPathPlugin, Physics2DPlugin,
  PhysicsPropsPlugin, Flip, ScrambleTextPlugin, TextPlugin, CustomEase,
  CustomWiggle, CustomBounce, EasePack — driven by mvm-seek so two
  renders are still byte-identical.  Authors can use declarative
  data-gsap-from / data-gsap-to / data-draw-svg / data-morph-to /
  data-motion-path / data-physics2d / data-scramble / data-gsap-split
  attributes, OR build full programmatic GSAP timelines via
  __mvmGsap.timeline({at: <seconds>}).  Use when the user asks to make
  an animated landing page, motion-graphics intro, kinetic typography,
  data-stat reveal, Chinese-text animation, SVG logo draw, shape morph,
  rocket flying along a curve, confetti burst, decrypting text, or
  HTML-to-video pipeline; or mentions Remotion, Hyperframes, React-Bits,
  GSAP, GreenSock, motion graphics, animated typography, shader
  background, electric border, image trail, meta balls, mask reveal,
  wave text, "make a video", or names any of the GSAP plugins above.
---

# motion-video-maker

A self-contained skill for authoring **cinematic HTML animations** and
rendering them to **frame-accurate MP4** video. One composition = one HTML
file driven by a tiny deterministic timeline runtime.

## Hard Rules — READ FIRST (non-negotiable)

These prevent the bugs we keep seeing in agent-generated videos.
`scripts/lint.mjs` enforces most of them and exits non-zero on violations.

| ❌ Don't | ✅ Do |
|---|---|
| `style="font-size: 180px"` on a long heading | use `.title-2xl` / `.title-xl` / `.title-lg` class (see [Typography limits](#typography-limits)) |
| `.text-aurora` (blue-cyan gradient) over a cool palette | match palette family → use `.text-on-cool` instead |
| `data-background` without `data-palette` and without `data-colors` | always pick a named palette (`cool-deep`, `warm-glow`, etc.) |
| `style="position: relative"` on a `[data-background]` element | leave it alone — CSS already sets `position: absolute` |
| `Math.random()` / `Date.now()` / `new Date()` inside `<script>` | use `__mvm.random("seed")` / pass `t` from `mvm-seek` event |
| odd `data-width` / `data-height` (e.g. 1921×1081) | use even integers — H.264 refuses odd dimensions |
| `data-animation-out` on a non-final scene without a `<div data-transition>` | bridge the cut with a transition (pixel-dissolve / iris / glitch / wipe-left / flash) |
| inline `<style>` with `transition:` / `@keyframes` | use `data-animation` + the runtime — CSS transitions don't seek and break determinism |
| fade non-final scenes to opacity 0 | only the **last** scene may fade to black; everything else must hand off via a transition |
| `background-image: url(...)` (CSS bg image, browser doesn't fire load event) | use `<img class="bg-img" style="position:absolute;inset:0;">` |
| `gsap.utils.random(...)` / `Math.random()` inside any `gsap.to/from/timeline` value | wrap with `__mvm.random("seed")` or pass a deterministic precomputed value — see [GSAP integration](#gsap-integration--every-plugin-deterministic-bridged) |
| `setTimeout(() => gsap.to(...), 1000)` / wall-clock-driven GSAP construction | build the timeline at parse-time, anchor it with `__mvmGsap.timeline({at: <s>})` so `mvm-seek` drives it |
| Importing / referencing `ScrollTrigger` / `ScrollSmoother` / `Draggable` / `Observer` / `InertiaPlugin` | these need user interaction that doesn't exist in offline render — use a GSAP timeline driven by `mvm-seek` instead |
| Loading `gsap-bridge.js` BEFORE `gsap.min.js` and the plugin scripts | always load gsap core + plugins FIRST, then the bridge — the bridge only registers what already exists on `window` |

Run `node scripts/lint.mjs path/to/index.html` before rendering. Add
`--strict` in CI so warnings also fail.

## Determinism Contract

Two renders of the same HTML file MUST produce byte-identical MP4 output.
The runtime + render pipeline already enforce this — but author code can
break it. The rules:

1. **Never call `Math.random()`** in inline scripts. Use one of:
   - `window.__mvm.random("a-stable-string-seed")` → stateful PRNG function
   - `window.__mvm.randomSample("seed")` → one deterministic value
2. **Never call `Date.now()` / `new Date()` / `performance.now()`** for
   anything visible. Time MUST come from the `mvm-seek` event detail.
3. **Never use CSS `transition` / `animation`** on stage elements — those
   don't respect the timeline's seek mechanism, so they play in preview
   but appear "frozen" in the rendered MP4.
4. **Never use `setTimeout` / `setInterval`** to drive visuals. The renderer
   issues `seek(t)` at 30 fps step boundaries; any wall-clock-driven code
   will skip frames.
5. **All async resources go through `delayRender` / `continueRender`**:
   ```js
   const h = window.__mvm.delayRender('Loading hero image');
   img.onload  = () => window.__mvm.continueRender(h);
   img.onerror = () => window.__mvm.cancelRender(new Error('hero image failed'));
   ```
   The renderer waits for `__mvm.ready === true` (i.e. all handles cleared)
   before screenshotting each frame; failures surface immediately with the
   pending handle labels printed.

## Scene Transitions — non-negotiable rules

Borrowed from Hyperframes. Failing these is the #1 reason a video feels
"choppy" or "broken".

1. **Every scene boundary must have a `<div data-transition>`.** Pick one
   of: `pixel-dissolve` / `iris` / `glitch` / `wipe-left` / `wipe-right`
   / `wipe-up` / `wipe-down` / `flash`. The transition straddles the cut.
2. **Every text/element must have a `data-animation` (entrance).** Don't
   appear out of nothing — fade, slide, drop, mask in.
3. **Don't add `data-animation-out` to a non-final scene.** The transition
   IS the exit. Adding an extra fade-out makes the screen go blank for
   ~0.3s and looks like a bug. `scripts/lint.mjs` flags this as `E005`.
4. **Only the final scene may fade to opacity 0.** Earlier scenes hand off
   via the transition; the last scene closes the video.

```html
<!-- Scene 1 -->
<div data-background="meta-balls" data-palette="warm-glow"
     data-clip data-start="0" data-duration="5.8"
     data-animation="fadeIn"></div>   <!-- ✅ entrance only -->

<!-- Transition (bridges 5.3s → 6.0s) -->
<div data-transition="pixel-dissolve" data-start="5.3" data-duration="0.7"></div>

<!-- Scene 2 starts at 5.8s -->
<div data-background="liquid-ether" data-palette="cool-deep"
     data-clip data-start="5.8" data-duration="5.5"
     data-animation="fadeIn"></div>   <!-- ✅ no data-animation-out -->
```

## Style Presets — 8 recipes to start from or hybridise

Each preset is a **complete vibe**: palette + typography + animation
pattern + transition + pacing. They're not classes you import; they're
**templates you copy from** when you want a recognisable look. Hybridise
freely — use Asian Ink typography with Glitch Tech transitions, etc.

### 1. Cinematic Trailer

> Big serif over warm darkness. Long beats, single ideas per scene.
> Feels like a film opening.

| | |
|---|---|
| **Palette** | `warm-glow` / `warm-ember` / `mono-deep` |
| **Background** | `meta-balls` (slow `data-intensity="0.8"`) / `lightning` (sparingly) / solid `#0a0606` |
| **Typography** | `.title-3xl` or `.title-2xl`, `cn-serif` (Noto Serif SC), `letter-spacing: 0.04em` |
| **Text color** | `.text-on-warm` (off-white) or `#FFE87A` |
| **Entrance** | `data-text-animation="split-text"` with `data-stagger="0.06"` `data-easing="easeOutQuart"` |
| **Pacing** | 5–8s per scene, hold one idea at a time |
| **Transitions** | `flash` (0.4s) between climactic beats, `iris` (1.0s) for softer cuts |
| **Camera** | `data-camera-zoom="1.08"` (slow push-in) on hero shots |
| **Avoid** | bright pinks, fast cuts, springBouncy, glitch-text |

### 2. Glitch Tech / Cyberpunk

> Hard cuts, electric edges, decrypting text. Reads "future" or "hacker".

| | |
|---|---|
| **Palette** | `cool-neon` / `prismatic-cyber` / `mono-ink` |
| **Background** | `lightning` (`data-intensity="1.4"`), `prismatic-burst`, `letter-glitch` canvas |
| **Typography** | `.title-xl` mono fonts (`cn-mono` / JetBrains Mono), `text-transform: uppercase`, `letter-spacing: 0.25em` |
| **Text color** | `.text-on-prismatic` (white + halo) or `#5BC0EB` / `#FFD400` accents |
| **Entrance** | `data-text-animation="decrypted-text"` / `glitch-text` / `scramble-text` |
| **Pacing** | 1.5–3s clips, **lots of them**. Quick rhythm. |
| **Transitions** | `glitch` (0.5s) almost everywhere, occasional `pixel-dissolve` (0.4s) |
| **Effects** | `data-effect="electric-border"` on hero card, `star-border` accents |
| **Avoid** | cn-brush, slow ease, warm palettes, single-scene 8s holds |

### 3. Asian Ink / 中国风水墨

> 留白、宋体、行楷。Soft paper background, brushed accents, slow rhythm.

| | |
|---|---|
| **Palette** | `light-paper` (background) or `warm-ember` (subtle dark) |
| **Background** | solid `#f7f5ef` paper, or `aurora warm-ember` very faint, or a `iridescence` shader at `data-intensity="0.3"` |
| **Typography** | `cn-serif` (Noto Serif SC) for body, `cn-brush` (Ma Shan Zheng / Long Cang) for hero accents, `.title-2xl` to `.title-3xl` |
| **Text color** | `.text-on-light` (deep ink `#1a0a08`) or `#3a1c08` |
| **Entrance** | `data-animation="unmaskUp"` or `unmaskRight` slow (`data-in-duration="1.2"`), `data-easing="easeInOutQuart"` |
| **Pacing** | 6–10s per scene. Let the brush strokes breathe. |
| **Transitions** | `wipe-up` or `wipe-left` (1.2s) with `data-color="#f7f5ef"`, soft `flash` (0.5s) |
| **Special** | red seal stamp: small square `mvm-card` with cn-brush "印", `data-animation="dropIn"` |
| **Avoid** | electric-border, glitch, neon palettes, mono fonts |

### 4. Data Story

> Hero numbers + supporting cards. Each stat lands with weight.

| | |
|---|---|
| **Palette** | `cool-deep` (background), accents via `.mvm-stat--red/cool/warm` borders |
| **Background** | `liquid-ether cool-deep` or `iridescence cool-violet`, kept moving but quiet |
| **Typography** | `.mvm-stat` preset (built-in 120px digit + label), `.title-lg` for section headers |
| **Entrance** | `data-text-animation="count-up"` + `data-odometer="true"` on every number; stat cards `data-animation="magneticIn"` / `dropIn` / `slideBlurIn` (alternate for variety) |
| **Pacing** | 3.5–5s per stat, 1s in / 2s hold / 1s out |
| **Transitions** | `iris` (0.7s) between stat groups, `pixel-dissolve` between sections |
| **Layout** | 1, 2, or 3 stats stacked vertically with `gap: 32px` |
| **Avoid** | text-aurora, glitch-text, busy shaders behind the numbers |

### 5. Pop Vibrant

> Saturated colors, bouncy springs, candy. Reads "consumer brand" or
> "playful product".

| | |
|---|---|
| **Palette** | `prismatic-vapor` / `prismatic-magic` / custom `data-colors="#FF3CAC,#FFD400,#2af598,#5BC0EB"` |
| **Background** | `meta-balls`, `iridescence` at high `data-intensity="1.2"` |
| **Typography** | `cn-sans` (Noto Sans SC) bold, `.title-xl`/`title-2xl`, can mix multiple sizes in one scene |
| **Entrance** | `data-easing="springBouncy"` or `springWobbly` everywhere; `data-animation="cubeIn"` / `flipInX` / `magneticIn` (rotate per scene for variety) |
| **Pacing** | 3–5s clips, lots of motion |
| **Transitions** | `pixel-dissolve` with bright `data-color="#FFD400"`, occasional `flash` |
| **Avoid** | cn-serif, slow ease, mono palette |

### 6. Minimal Editorial

> 90% empty space. Tiny eyebrow over a giant serif. One movement at a time.

| | |
|---|---|
| **Palette** | `mono-graphite` or solid `#0a0a14` (no shader) |
| **Background** | `<div>` with solid color OR `iridescence cool-violet` at `data-intensity="0.25"` |
| **Typography** | One huge `.title-3xl` (160px) + one tiny `.body-sm` eyebrow; serif everywhere |
| **Entrance** | `unmaskUp` very slow (`data-in-duration="1.4"`), `easeInOutQuart` |
| **Pacing** | 8–12s per scene, very few scenes (3–4 total in 30s) |
| **Camera** | `data-camera-zoom="1.06"` ken-burns push on background, **never on text** |
| **Transitions** | `wipe-up` (1.2s) only |
| **Avoid** | crowded compositions, multiple animations per scene, decorative effects |

### 7. Liquid Dreamy

> Iridescent shaders, soft text, ethereal pacing. Reads "calm" or "luxury".

| | |
|---|---|
| **Palette** | `cool-violet` / `prismatic-vapor` |
| **Background** | `iridescence` (`data-intensity="0.7" data-scale="1.4"`), layered with a `aurora` at low opacity |
| **Typography** | `cn-wenkai` (LXGW WenKai), `.title-2xl`, `letter-spacing: 0.12em` |
| **Text color** | `.text-on-cool-soft` (warm cream) |
| **Entrance** | `data-animation="slideBlurIn"` `data-easing="springGentle"`; `blur-text` for body |
| **Pacing** | 6–8s scenes, slow drift |
| **Transitions** | long `flash` (0.8s) with `data-color="#9d8df1"` (lavender), `iris` (1.2s) |
| **Avoid** | hard cuts, glitch, springBouncy, primary colors |

### 8. Documentary

> Sepia-ish, slow zoom on stills, somber typography, long holds.

| | |
|---|---|
| **Palette** | `warm-autumn` / `mono-graphite` (desaturated) |
| **Background** | A real `<img>` photo (b/w or duotone via CSS `filter: grayscale(80%) sepia(20%)`) OR `aurora warm-autumn` at low intensity |
| **Typography** | `cn-serif`, `.title-lg`/`title-md`, body uses `.body-md` |
| **Entrance** | `fadeIn` + `data-camera-zoom="1.15"` (slow ken-burns); subtitles use `unmaskUp` |
| **Pacing** | 8–14s per scene, **lots of held screen time** |
| **Transitions** | `wipe-right` (1.5s) only; very slow `flash` (0.6s) for chapter breaks |
| **Avoid** | shaders, bright colors, fast text animations |

### Hybridising — yes, do it

The presets are starting points, not boxes. Real "stand-out" videos
cross-pollinate:

- **"Cinematic + Glitch"** — warm palette + serif type + occasional
  glitch transition + decrypted-text eyebrow. Hero shot stays cinematic,
  intro chyrons feel tech.
- **"Asian Ink + Data Story"** — paper background + ink red stat
  numbers + cn-brush labels. Annual report visual language.
- **"Liquid Dreamy + Pop Vibrant"** — iridescent shader + bouncy spring.
  Reads "beauty / cosmetics brand".

When in doubt: **commit to one style for 80% of the runtime, sprinkle
the other style on 1 scene as contrast**. Pure-blend rarely reads.

```
motion-video-maker/
├── runtime/        # timeline.js, components.js, spring.js, shaders.js,
│   │               # transitions.js, effects.js, styles.css,
│   │               # contrast-check.js, layout-check.js,
│   │               # gsap-bridge.js   (← determinism bridge for GSAP)
│   └── gsap/       # gsap.min.js + every plugin we ship: CustomEase,
│                   # CustomWiggle, CustomBounce, EasePack,
│                   # DrawSVGPlugin, MorphSVGPlugin, MotionPathPlugin,
│                   # Physics2DPlugin, PhysicsPropsPlugin, Flip,
│                   # SplitText, ScrambleTextPlugin, TextPlugin
├── assets/fonts/   # 12 open-source Chinese fonts (auto-installed)
├── scripts/        # render.mjs, preview.mjs, install-fonts.mjs,
│                   # new-video.mjs, debug.mjs, snap.mjs, lint.mjs
├── templates/      # base.html, diagnostic.html, showcase.html,
│                   # effects-showcase.html (signature effects sampler)
├── examples/       # time-flies/ (30s reference)
│                   # raycast-deep-dive/    (40s v1: canvas only)
│                   # raycast-deep-dive-v2/ (40s v2: + spring + shaders + transitions)
│                   # raycast-deep-dive-v3/ (40s v3: + electric-border / image-trail / odometer)
│                   # gsap-showcase/        (42s GSAP plugin sampler — every plugin in one file)
└── reference/      # components.md, workflow.md
```

## Creative Latitude — these are tools, not training wheels

The Hard Rules above prevent **broken** videos. They are NOT a recipe for
**good** videos. Many compositions look identical because agents stop at
"safe and lint-clean" instead of pushing the medium. **Push the medium.**

What "push the medium" means in practice:

1. **Pick a STYLE first, primitives second.** Don't reach for `split-text`
   + `fadeIn` + `meta-balls` by reflex. Decide what the video should
   *feel* like (see [Style decision tree](#style-decision-tree)), then
   pick primitives that serve that feeling. The same primitive read
   differently in different styles — `split-text` at 0.04 stagger feels
   urgent and confident; the same animation at 0.2 stagger with `springGentle`
   easing feels meditative.

2. **Combine primitives to invent new effects.** Every "signature" effect
   in this Skill (electric-border, image-trail, odometer flip) is a
   composition of simpler parts. You can do the same:
   - `mask-text` + `gradient-text` on a duplicate layered behind = neon
     edge title that bleeds color through the negative space.
   - `image-trail` + a small camera-pan = parallax-feeling depth.
   - Two `liquid-ether` shaders with different `data-palette` and
     opposite `data-scale`, blended `mix-blend-mode: screen` =
     iridescent fluid impossible to get with one shader.
   - `wave-text` with `data-amplitude="3"` + `springSnap` = subtle
     "breathing" hero title for slow scenes.

3. **Bend the timeline.** A 30s video doesn't need 6 scenes of 5s each.
   - Cinematic trailers spend 8s on a single hero shot then sprint
     through 4 quick cuts in 6s.
   - Glitch / tech videos use very short clips (1.2–2s) with hard cuts
     between shaders + glitch transitions.
   - Editorial / minimalist videos hold one scene for 12s with a slow
     `kenBurnsIn` on the background.

4. **Custom animations are welcome.** If none of the built-in
   `data-animation` values fit, you can:
   - Write your own keyframe-like animation by listening to `mvm-seek`
     and applying transforms based on `event.detail.time`. See
     `runtime/components.js` for the pattern.
   - Use `data-effect="custom"` with inline `style="--my-anim-progress: ..."`
     to drive your own CSS variables off the timeline.
   - Compose multiple `data-animation` by nesting elements with
     independent animations.

5. **Camera moves**. Wrap a scene in `<div class="mvm-cam" data-camera-zoom="1.15"
   data-camera-pan-x="-40" data-camera-pan-y="20">` and the whole scene
   slowly zooms / pans across its lifetime. Subtle camera moves are the
   single biggest "I am watching a film, not a slideshow" cue.

You are encouraged to read users' descriptive cues literally and translate
them. "Cinematic", "elegant", "punchy", "ink wash", "data-driven", "playful",
"otherworldly", "vintage", "futurist", "documentary" — each maps to a
different combination of palette / typography / motion. See
[Style Presets](#style-presets) for 8 ready-made recipes you can adopt or
hybridise.

## Style decision tree — pick by user intent

When the user describes the *feeling* but not the parts, use this map:

| User mentions... | Style preset | Why |
|---|---|---|
| "电影感 / cinematic / trailer / epic" | **Cinematic Trailer** | slow + big serif + warm/mono + flash transitions |
| "科技 / cyber / tech / futurist / glitch" | **Glitch Tech** | electric-border + glitch-text + prismatic/cool + fast cuts |
| "水墨 / 中国风 / 书法 / 古典 / ink" | **Asian Ink** | cn-brush + paper palette + slow unmask + Ma Shan Zheng |
| "数据 / data / report / 业绩 / stats" | **Data Story** | odometer + mvm-stat + cards + drop / magnetic entry |
| "活泼 / playful / pop / bouncy / 卡通" | **Pop Vibrant** | saturated + springBouncy + meta-balls + cube/flip |
| "极简 / minimal / 高级 / editorial / 杂志" | **Minimal Editorial** | huge serif + lots of whitespace + slow ken burns |
| "梦幻 / 流体 / liquid / dreamy / 治愈" | **Liquid Dreamy** | iridescence + slow + soft + warm-soft tones |
| "纪录片 / documentary / 历史 / 沉稳" | **Documentary** | desaturated + ken-burns + long holds + serif body |
| 没说，但内容像 PPT 介绍 | **Cinematic Trailer** | safest default, looks production-grade |
| 没说，但内容是产品发布 | **Glitch Tech** or **Cinematic** | depends on product vibe |

If the user mixes cues ("中国风但要现代感"), **hybridise**: take Asian Ink's
typography + palette and Cinematic Trailer's camera moves + flash.

**You decide.** Don't always ask back — read the prompt for tone cues and
commit to a style. Variety is the goal.

---

**Every composition MUST include this script chain in this order:**

```html
<script src="../../runtime/spring.js"></script>       <!-- physics -->
<script src="../../runtime/timeline.js"></script>     <!-- seekable timeline -->
<script src="../../runtime/components.js"></script>   <!-- text / canvas bg -->
<script src="../../runtime/shaders.js"></script>      <!-- WebGL shader bg  -->
<script src="../../runtime/transitions.js"></script>  <!-- scene transitions -->
<script src="../../runtime/effects.js"></script>      <!-- electric / star / image-trail -->

<!-- GSAP — load any plugins you'll use BEFORE the bridge.
     The bridge tolerates missing plugins; drop ones you don't need. -->
<script src="../../runtime/gsap/gsap.min.js"></script>
<script src="../../runtime/gsap/CustomEase.min.js"></script>
<script src="../../runtime/gsap/EasePack.min.js"></script>
<script src="../../runtime/gsap/SplitText.min.js"></script>
<script src="../../runtime/gsap/DrawSVGPlugin.min.js"></script>
<script src="../../runtime/gsap/MorphSVGPlugin.min.js"></script>
<script src="../../runtime/gsap/MotionPathPlugin.min.js"></script>
<script src="../../runtime/gsap/Physics2DPlugin.min.js"></script>
<script src="../../runtime/gsap/Flip.min.js"></script>
<script src="../../runtime/gsap/ScrambleTextPlugin.min.js"></script>
<script src="../../runtime/gsap-bridge.js"></script>   <!-- MUST come AFTER gsap -->
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

## GSAP integration — every plugin, deterministic, bridged

The runtime now bundles **GSAP 3.15** plus every plugin Webflow makes free
(see lineage). All of them animate on the same `mvm-seek` clock as
the native runtime — two renders are still byte-identical.

### What you get

| Capability | Plugin | data-* attribute | Programmatic |
|---|---|---|---|
| Tween any CSS / transform property with arbitrary ease | core | `data-gsap-from` / `data-gsap-to` | `__mvmGsap.timeline({at}).to(...)` |
| Per-line / -word / -char text reveals with masks | SplitText | `data-gsap-split="lines,words,chars"` | `SplitText.create(...)` then tween |
| Stroke draw on an SVG path | DrawSVGPlugin | `data-draw-svg="0% 100%"` | `gsap.fromTo(path, {drawSVG:'0 0'}, {drawSVG:'100%'})` |
| Morph one SVG path into another | MorphSVGPlugin | `data-morph-to="#otherPath"` | `gsap.to(p, {morphSVG:'#x'})` |
| Animate any element along an SVG path | MotionPathPlugin | `data-motion-path="#pathId"` | `gsap.to(el, {motionPath:{path}})` |
| Velocity / angle / gravity physics | Physics2DPlugin | `data-physics2d='{"velocity":300,"angle":-80,"gravity":600}'` | `gsap.to(el, {physics2D: {...}})` |
| Per-property velocity / acceleration | PhysicsPropsPlugin | (programmatic only) | `gsap.to(el, {physicsProps: {x:{velocity}}})` |
| FLIP layout transitions between scenes | Flip | `class="mvm-flip" data-flip-id="x" data-flip-at="3.0"` | `Flip.getState() / Flip.from()` |
| Decoder scramble | ScrambleTextPlugin | `data-scramble='{"text":"DONE"}'` | `gsap.to(el, {scrambleText: {...}})` |
| Type / replace text content over time | TextPlugin | (programmatic only) | `gsap.to(el, {text: "new"})` |
| Custom cubic / SVG easing curves | CustomEase | `data-easing="mvm.<name>"` | `__mvmGsap.registerCustomEase(name, def)` |
| Wiggle / oscillating ease | CustomWiggle | `data-easing="mywiggle"` | `CustomWiggle.create("mywiggle", {...})` |
| Real bounce ease | CustomBounce | `data-easing="mybounce"` | `CustomBounce.create("mybounce", {...})` |
| SlowMo / RoughEase / ExpoScaleEase | EasePack | `data-easing="slow(0.7,0.7)"` etc. | string in any tween's `ease` |

**Deliberately omitted** (because they need user interaction that
doesn't exist in offline render):

- `ScrollTrigger` / `ScrollSmoother` — there is no scroll
- `Draggable` / `Observer` / `InertiaPlugin` — there is no pointer

If you reference these, `scripts/lint.mjs` raises `W006`. Replace
them with a timeline that you anchor onto `gsap.globalTimeline` —
the bridge will seek into it on every `mvm-seek`.

### How the bridge works (the determinism contract)

1. The bridge calls `gsap.ticker.lagSmoothing(0)` and removes
   `gsap.updateRoot` from `gsap.ticker` so GSAP's RAF clock never
   advances anything on its own in render mode.
2. On every `mvm-seek` event the bridge calls
   `gsap.updateRoot(seekTime)` — the official "drive me from a
   custom clock" API. Every tween, child timeline, and plugin
   advances to that exact absolute second. ([gsap.com/docs](https://gsap.com/docs/v3/GSAP/gsap.updateRoot()))
3. The bridge proxies `window.__mvm.easing` so any GSAP ease string
   (e.g. `"power2.inOut"`, `"back.out(1.7)"`, `"elastic.out(1, 0.3)"`)
   silently resolves through `gsap.parseEase(...)` and is then
   available to the *native* `data-animation` system too. So you
   can write `data-animation="fadeInUp" data-easing="back.out(1.6)"`
   and the runtime now understands it.
4. Anything you author with `data-gsap-from` / `data-gsap-to` / etc.
   becomes a `gsap.fromTo(...)` tween anchored at the host element's
   `data-start + data-gsap-delay`. The clip's lifecycle still owns
   visibility — GSAP only handles the tween itself.

> **Author hard-rules:**
> - Don't wrap `gsap.to()` / `gsap.from()` in `setTimeout` /
>   `setInterval` / `requestAnimationFrame`. Wall-clock timers
>   bypass `gsap.updateRoot` and produce different output every
>   render. `lint.mjs W007` flags this.
> - Don't call `gsap.utils.random()` — it uses `Math.random` under
>   the hood. Wrap with `__mvm.random("seed")` or pass a
>   pre-computed deterministic value. `lint.mjs W008` flags this.
> - Build the timeline at parse-time; don't try to construct new
>   tweens inside an `mvm-seek` handler (that fires every frame
>   and would create thousands of tweens).

### Declarative recipes — copy these

#### 1) Drop-in tween (works on any element with `data-clip`)

```html
<h1 class="title text-readable"
    data-clip data-start="2.0" data-duration="6"
    data-gsap-from='{"y":120,"opacity":0,"rotationX":-30}'
    data-gsap-to='{"y":0,"opacity":1,"rotationX":0}'
    data-gsap-duration="1.0"
    data-gsap-ease="back.out(1.4)">Hello GSAP</h1>
```

#### 2) Pro SplitText (line / word / char reveal with mask)

```html
<h1 class="title"
    data-clip data-start="0.6" data-duration="5"
    data-gsap-split="lines,words,chars"
    data-gsap-mask="lines"
    data-gsap-stagger="0.05" data-gsap-duration="0.9"
    data-gsap-y="120" data-gsap-ease="power3.out">动画引擎</h1>
```

`data-gsap-mask="lines"` clips each line to its own bounding box —
characters that translate up appear "lifted" out of an invisible
slot. Combine with a serif font for an editorial feel.

#### 3) DrawSVG — animate a stroke

```html
<svg class="logo" viewBox="0 0 1100 520">
  <path d="M 80 440 L 80 100 L 240 360 L 400 100 L 400 440"
        fill="none" stroke="#FFD400" stroke-width="4"
        data-clip data-start="6.4" data-duration="5"
        data-draw-svg="0% 100%"
        data-gsap-duration="1.6"
        data-gsap-ease="power2.inOut" />
</svg>
```

The path MUST have a visible `stroke` (CSS or attribute). Multiple
paths can share `data-clip data-start` to draw simultaneously, or
stagger them by 0.2-0.5s for a "logotype building itself" effect.

#### 4) MorphSVG — square → triangle → star

Hide the target shapes (so they don't render their own strokes/fill),
keep the visible morphing path, and animate it through targets:

```html
<svg viewBox="0 0 540 540">
  <!-- targets are visibility:hidden so only their `d` matters -->
  <path id="shape-triangle" style="visibility:hidden"
        d="M 270 60 L 480 470 L 60 470 Z" />
  <path id="shape-star" style="visibility:hidden"
        d="M 270 60 L 320 220 L 480 220 L 350 320 L 400 480
           L 270 380 L 140 480 L 190 320 L 60 220 L 220 220 Z" />

  <!-- The visible path morphs through them. First hop is declarative,
       further hops are sequenced on a real GSAP timeline. -->
  <path id="morph"
        d="M 80 80 L 460 80 L 460 460 L 80 460 Z"
        fill="none" stroke="#5BC0EB" stroke-width="6"
        data-clip data-start="12.4" data-duration="5"
        data-morph-to="#shape-triangle"
        data-gsap-duration="1.0" />
</svg>

<script>
  document.addEventListener('DOMContentLoaded', () => {
    const tl = window.__mvmGsap.timeline({ at: 13.6 });
    tl.to('#morph', { morphSVG: '#shape-star',   duration: 1, ease: 'power2.inOut' })
      .to('#morph', { morphSVG: '#shape-circle', duration: 1, ease: 'power2.inOut' }, '+=0.4');
  });
</script>
```

#### 5) MotionPath — anything along an SVG path

```html
<svg class="track" viewBox="0 0 1280 540" style="position:absolute;top:50%;left:50%;
     transform:translate(-50%,-50%); width:1280px; height:540px;">
  <path id="rocket-path" d="M 60 480 C 260 480 360 60 640 270
                            C 920 480 1020 60 1220 60"
        fill="none" stroke="#FFD400" stroke-width="2"
        stroke-dasharray="4 6" />
</svg>

<div style="position:absolute; left:0; top:0; font-size:84px;"
     data-clip data-start="18.6" data-duration="5"
     data-motion-path="#rocket-path"
     data-motion-path-rotate="true"
     data-gsap-duration="4.6"
     data-gsap-ease="power1.inOut">🚀</div>
```

`data-motion-path-rotate="true"` rotates the host to follow the
tangent of the curve (great for arrows, comets, planes).

#### 6) Physics2D confetti — programmatic, deterministic

```html
<div id="conf-host" style="position:absolute; left:960px; top:540px;"></div>
<script>
  document.addEventListener('DOMContentLoaded', () => {
    const host = document.getElementById('conf-host');
    const palette = ['#FF6363', '#FFD400', '#5BC0EB', '#9d8df1', '#2af598'];
    const rng = window.__mvm.random('confetti'); // deterministic PRNG
    const tl = window.__mvmGsap.timeline({ at: 24.6 }); // anchor at 24.6s
    for (let i = 0; i < 60; i++) {
      const dot = document.createElement('div');
      Object.assign(dot.style, {
        position:'absolute', left:'0', top:'0',
        width:'22px', height:'22px', borderRadius:'4px',
        background: palette[Math.floor(rng() * palette.length)],
      });
      host.appendChild(dot);
      const angle    = -90 + (rng() * 160 - 80);
      const velocity = 700 + rng() * 700;
      const gravity  = 1400 + rng() * 400;
      const dur      = 2.4 + rng() * 0.9;
      tl.to(dot, { physics2D: { velocity, angle, gravity },
                   rotation: (rng() - 0.5) * 1080,
                   duration: dur, ease: 'none' }, 0);
      tl.to(dot, { opacity: 0, duration: 0.6, ease: 'power2.in' }, dur - 0.6);
    }
  });
</script>
```

Use `__mvm.random("seed")` for the RNG so the burst pattern is
identical between renders. Lint rule `W008` enforces this.

#### 7) ScrambleText — decoder reveal

```html
<p class="text-readable"
   data-clip data-start="30.6" data-duration="5"
   data-scramble='{"text":"DECRYPTING ACCESS","chars":"upperAndLowerCase"}'
   data-gsap-duration="2.0">▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓</p>

<!-- with custom CJK character pool -->
<p data-clip data-start="32" data-duration="3"
   data-scramble='{"text":"动画即数据","chars":"龙腾虎跃春夏秋冬天地"}'
   data-gsap-duration="1.4">?????</p>
```

`chars` accepts:
- `"upperAndLowerCase"` / `"upperCase"` / `"lowerCase"` — Latin
- `"01"` — binary
- any string of glyphs to cycle through (works perfectly with CJK)

#### 8) Programmatic timeline — full GSAP sequencing

When you want to choreograph 10+ elements in one scene:

```html
<script>
  document.addEventListener('DOMContentLoaded', () => {
    const cells = document.querySelectorAll('.grid-cell');
    // Custom ease registered via the bridge
    window.__mvmGsap.registerCustomEase(
      'mvm.swoop',
      'M0,0 C0.2,0.0 0.0,0.6 0.4,0.85 0.7,1.05 0.8,0.98 1,1'
    );
    const tl = window.__mvmGsap.timeline({ at: 36.4 });
    tl.from(cells, {
        y: 240, opacity: 0, scale: 0.4, rotation: -12,
        stagger: { each: 0.06, from: 'center' },
        duration: 0.9, ease: 'mvm.swoop',
      }, 0)
      .to(cells, {
        scale: 1.08, duration: 0.4, ease: 'sine.inOut',
        stagger: { each: 0.04, from: 'edges' },
        yoyo: true, repeat: 1,
      }, 1.4)
      .to(cells, {
        rotationY: 360, duration: 1.2, ease: 'power2.inOut',
        stagger: { each: 0.08, from: 'start', grid: [2, 4], axis: 'x' },
      }, 2.6);
  });
</script>
```

`__mvmGsap.timeline({at: 36.4})` returns a real `gsap.timeline()`
that has been added to `gsap.globalTimeline` at absolute time
`36.4s`. Internal positioning (`0`, `1.4`, `'+=0.2'`, `'<'`, …)
follows GSAP's [position parameter](https://gsap.com/docs/v3/GSAP/Timeline)
verbatim.

### CustomEase / CustomWiggle / CustomBounce / EasePack

These plug straight into the runtime's existing easing table. Once
the bridge mounts, `data-easing="<gsap-ease-name>"` works on any
mvm-native preset:

```html
<!-- power easings (the most useful for video pacing) -->
<h1 data-animation="fadeInUp" data-easing="power3.out">…</h1>
<h2 data-animation="slideBlurIn" data-easing="expo.inOut">…</h2>

<!-- back / elastic / bounce -->
<p  data-animation="pop" data-easing="back.out(1.7)">…</p>
<p  data-animation="dropIn" data-easing="elastic.out(1, 0.3)">…</p>

<!-- EasePack -->
<p  data-animation="fadeIn" data-easing="slow(0.7, 0.7, false)">…</p>
<p  data-animation="zoomIn" data-easing="rough({clamp:true,points:20})">…</p>

<!-- Author-defined CustomEase -->
<script>
  document.addEventListener('DOMContentLoaded', () => {
    window.__mvmGsap.registerCustomEase('mvm.swoop',
      'M0,0 C0.2,0.0 0.0,0.6 0.4,0.85 0.7,1.05 0.8,0.98 1,1');
  });
</script>
<h1 data-animation="fadeInUp" data-easing="mvm.swoop">…</h1>

<!-- CustomWiggle / CustomBounce -->
<script>
  CustomWiggle.create('myWiggle', { wiggles: 6, type: 'random' });
  CustomBounce.create('myBounce', { strength: 0.7, squash: 3 });
</script>
<div data-gsap-from='{"rotation":-30}' data-gsap-to='{"rotation":30}'
     data-gsap-duration="1.5" data-gsap-ease="myWiggle">…</div>
```

### When to use mvm-native vs GSAP

| Goal | Use |
|---|---|
| Quick entrance from the 24-preset table (`fadeInUp`, `unmaskUp`, `magneticIn`, …) | mvm `data-animation=` |
| Per-character text animation that doesn't need lines or masks | mvm `data-text-animation="split-text"` |
| Stagger over arbitrary properties / arbitrary easing | GSAP `data-gsap-from` / `data-gsap-to` |
| Line-aware split, mask reveal, autoSplit on font-load | GSAP `data-gsap-split` |
| Stroke draw, shape morph, motion path | GSAP plugins (DrawSVG / MorphSVG / MotionPath) |
| Particle bursts with physics | GSAP `Physics2DPlugin` |
| Choreographing 5+ elements with overlapping time positions | `__mvmGsap.timeline({at})` |
| Layout transitions between scenes (FLIP) | GSAP `Flip` |
| Custom mathematical ease curve (cubic-bezier or SVG path) | GSAP `CustomEase` (use anywhere) |

The two systems compose freely — use whichever reads best for the
scene. Existing examples (`time-flies`, `raycast-deep-dive-v*`)
still use the mvm-native attributes; new compositions are
encouraged to mix the two for richer motion.

### Where to look

- **`runtime/gsap-bridge.js`** — the determinism layer. Read this
  to understand exactly how `mvm-seek` drives every GSAP tween.
- **`runtime/gsap/`** — bundled GSAP 3.15 + every plugin (UMD).
- **`examples/gsap-showcase/index.html`** — 7-scene 42s reference
  exercising each plugin (SplitText / DrawSVG / MorphSVG /
  MotionPath / Physics2D / ScrambleText / programmatic timeline +
  CustomEase). Render with `npm run render:gsap`.

## Typography limits — never write `font-size: 180px` for a long title

The stage is **1920×1080**.  At that width, "Motion Video Maker" wraps
mid-word once you go above ~140px; longer phrases like
"HTML 驱动的电影级动画引擎" need even smaller sizes.  Always pick from
the safe scale instead of writing px:

```html
<!-- ✅ Safe — fits 1920px stage for typical 15–22 char titles -->
<h1 class="title-2xl text-on-warm">Motion Video Maker</h1>

<!-- ✅ Also safe — for shorter, punchier hero titles -->
<h1 class="title-3xl text-on-cool">时间飞逝</h1>

<!-- ❌ Don't do this — wraps to two left-aligned lines on a 1920 stage -->
<h1 style="font-size: 180px;">Motion Video Maker</h1>
```

### Safe font-size scale (verified non-wrapping @ 1920×1080)

| Class | font-size | Safe up to (latin / CJK) |
|---|---|---|
| `.title-3xl` | 160px | 14 chars / 12 chars |
| `.title-2xl` | 130px | 18 chars / 15 chars |
| `.title-xl`  | 100px | 22 chars / 18 chars |
| `.title-lg`  |  80px | 28 chars / 22 chars |
| `.title-md`  |  60px | 38 chars / 28 chars |
| `.title-sm`  |  44px | wide subtitles |
| `.body-lg/md/sm` | 40/32/24px | paragraphs |

The runtime ships `layout-check.js`: any heading that wraps or extends
past the stage edge produces a `[mvm-layout]` console.warn during
rendering, and the render script prints a summary at the end so you
know to dial down the font size before re-rendering.

### Center by default

The runtime now applies `text-align: center; margin: 0 auto; max-width: 92%`
to every `#stage h1–h6, #stage p`.  Flex containers no longer cause
left-aligned titles when text wraps.  Set `text-align: left` (or
`.pos-left` / `.pos-right`) on the element if you actually want it
off-center.

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
| **remotion** | Frame-accurate deterministic seek; image2pipe → ffmpeg encoder; chrome launch flags; `delayRender` / `continueRender` / `cancelRender` API. |
| **GSAP** ([greensock/gsap-skills](https://github.com/greensock/gsap-skills)) | The full animation engine — core tweens, timelines, easing, plus every plugin (SplitText, DrawSVGPlugin, MorphSVGPlugin, MotionPathPlugin, Physics2DPlugin, PhysicsPropsPlugin, Flip, ScrambleTextPlugin, TextPlugin, CustomEase, CustomWiggle, CustomBounce, EasePack). All free and bundled in `runtime/gsap/`; integrated through `runtime/gsap-bridge.js` which routes `gsap.updateRoot` through `mvm-seek` for byte-identical determinism. |

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
- **[examples/gsap-showcase/index.html](examples/gsap-showcase/index.html)** — 42s GSAP plugin sampler: SplitText (line-mask + char stagger, Scene 1) → DrawSVG (4-stroke "MVM" wordmark, Scene 2) → MorphSVG (square→triangle→star→circle→square, Scene 3) → MotionPath (rocket on a curved path, Scene 4) → Physics2D (60-piece confetti burst, Scene 5) → ScrambleText (Latin + CJK pools, Scene 6) → programmatic GSAP timeline + CustomEase + 4-axis grid stagger (Scene 7). Render with `npm run render:gsap`.
- **[examples/time-flies-v2/index.html](examples/time-flies-v2/index.html)** — 42s reflective piece on time. Showcases the elegant serif default (思源宋体 Black for 「时间飞逝」/「活在当下」titles, 霞鹜文楷 for poetic quotes), 7 different shader backgrounds, 6 inter-scene transitions, 12+ entrance animations, and the full odometer chain (463 → 70 → 3,600 → 86,400 → 525,600). See `contact-sheet.jpg`.
- **[examples/optimization-v5-summary.jpg](examples/optimization-v5-summary.jpg)** — 6-frame proof that both v5 fixes landed: typography upgrade + Scene 2 overflow fix.
- **[templates/showcase.html](templates/showcase.html)** — 6-cell grid that renders every shader at once.
- **[templates/effects-showcase.html](templates/effects-showcase.html)** — 6-cell sampler for electric-border, star-border, image-trail, meta-balls, magnet-lines, ribbons.
- **[templates/readable-showcase.html](templates/readable-showcase.html)** — 12-cell grid that tests `.text-readable` / `data-scrim` against busy shaders, plus a sampler for the 10 new outer-animation and 3 new text-animation presets.
