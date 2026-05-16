# Authoring Workflow Recipes

Step-by-step recipes for common composition types.

---

## Recipe 1 · Kinetic Title (5s, hook)

A 5-second opener that fades in a big bilingual title.

```bash
node scripts/new-video.mjs hook --duration 5 --fps 30 --bg aurora
```

Edit `examples/hook/index.html`:

```html
<div id="stage" data-composition-id="hook"
     data-width="1920" data-height="1080"
     data-fps="30" data-duration="5">

  <div data-background="aurora"
       data-colors="#0f3460,#16537e,#e94560,#0f3460"></div>

  <div class="scene center"
       data-clip data-hide-mode="visibility"
       data-start="0" data-duration="5">

    <h1 class="title text-aurora"
        data-clip data-start="0.3" data-duration="4.5"
        data-text-animation="split-text"
        data-stagger="0.08" data-char-duration="1.0">未来已来</h1>

    <p class="subtitle"
       data-clip data-start="1.6" data-duration="3.2"
       data-animation="fadeInUp" data-in-duration="0.8"
       data-animation-out="fadeOut" data-out-duration="0.5">THE FUTURE IS NOW</p>
  </div>
</div>
```

Render: `node scripts/render.mjs examples/hook/index.html`.

---

## Recipe 2 · Data Stat Reveal (12s)

Hero number with supporting metric and animated background.

```html
<div id="stage" data-composition-id="stat"
     data-width="1920" data-height="1080" data-fps="30" data-duration="12">

  <div data-background="dot-grid" data-color="#3b82f6" data-bg="#040814"></div>

  <div class="scene center" data-clip data-hide-mode="visibility"
       data-start="0" data-duration="12">

    <p class="caption"
       data-clip data-start="0.5" data-duration="11"
       data-animation="fadeInDown" data-in-duration="0.7">2026 · 全年新增用户</p>

    <span class="huge text-gold"
          data-clip data-start="1.2" data-duration="10"
          data-text-animation="count-up"
          data-from="0" data-to="1284690"
          data-anim-duration="4.5" data-separator=","
          data-easing="easeOutExpo">0</span>

    <p class="subtitle wenkai"
       data-clip data-start="6.0" data-duration="5.5"
       data-animation="blurIn" data-in-duration="1.1">
       较去年 <span class="text-fire">同比增长 312%</span></p>
  </div>
</div>
```

---

## Recipe 3 · Multi-Scene Story (30s)

Six scenes, each with its own background cross-fade. The reference
`examples/time-flies/index.html` is the canonical example — copy it as a
starting point for any narrative video.

Skeleton:

```html
<div id="stage" data-fps="30" data-duration="30">

  <!-- backgrounds, each cross-fading -->
  <div data-clip data-start="0"    data-duration="6"
       data-animation="fadeIn" data-animation-out="fadeOut"
       data-background="aurora"></div>
  <div data-clip data-start="5.5"  data-duration="6"
       data-animation="fadeIn" data-animation-out="fadeOut"
       data-background="threads"></div>
  <div data-clip data-start="11"   data-duration="6"
       data-animation="fadeIn" data-animation-out="fadeOut"
       data-background="dot-grid"></div>
  <div data-clip data-start="16.5" data-duration="7"
       data-animation="fadeIn" data-animation-out="fadeOut"
       data-background="waves"></div>
  <div data-clip data-start="23"   data-duration="7"
       data-animation="fadeIn"
       data-background="hyperspeed"></div>

  <!-- scenes -->
  <div class="scene center" data-clip data-hide-mode="visibility"
       data-start="0" data-duration="5"> ... opener ... </div>
  <div class="scene center" data-clip data-hide-mode="visibility"
       data-start="5" data-duration="6"> ... point 1 ... </div>
  <!-- etc -->

</div>
```

**Rule of thumb:** start each new scene's background 0.5s before the previous
ends so the cross-fade overlaps; start each scene container right when its
background hits full opacity.

---

## Recipe 4 · Social Vertical (1080×1920, 15s)

Same authoring approach, just swap dimensions:

```bash
node scripts/new-video.mjs vertical --width 1080 --height 1920 --duration 15 --fps 30 --bg hyperspeed
```

For TikTok-style "bouncy caption" text, stack split-text + outer pop animation:

```html
<h1 class="title" style="font-size: 200px;"
    data-clip data-start="0.4" data-duration="2"
    data-animation="pop" data-in-duration="0.6"
    data-text-animation="split-text"
    data-stagger="0.05" data-char-duration="0.5"
    data-easing="easeOutBack">炸裂！</h1>
```

---

## Recipe 5 · Square Loop (1080×1080, 6s, seamless)

For an OG-image-style loop, simply ensure the first and last frames have
identical state (e.g. use only background animations and a steady text overlay
with no in/out animations):

```html
<div id="stage" data-width="1080" data-height="1080"
     data-fps="30" data-duration="6">
  <div data-background="aurora"></div>
  <div class="scene center">
    <h1 class="title text-aurora glow" style="font-size: 140px;">永恒</h1>
  </div>
</div>
```

The aurora background uses sinusoidal motion so it visibly loops every ~12s;
choose `data-duration` to align with that cycle (3, 6, 9, 12, ...) for a near-
seamless loop. Use ffmpeg `-stream_loop` post-render if you need a longer asset.

---

## Performance Tips

| Setting | Effect |
|---|---|
| `fps=15` + `preset=ultrafast` + `crf=24` | Quick draft, ~4× faster |
| `fps=30` + `preset=medium` + `crf=18` | Default web/archive quality |
| `fps=60` + `preset=slow` + `crf=14` | Cinematic / motion-heavy content |

Backgrounds with `data-count` parameters (particles, starfield, hyperspeed,
letter-glitch) dominate render time. For a hot loop where you keep tweaking
text, swap to `data-background="aurora"` (pure radial-gradient blending) while
iterating, then restore your chosen background for the final render.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Element invisible despite `data-clip` window being active | Inline `style="opacity:0;"` was used as a "fallback" but the element has no `data-animation` to lift it. Either remove the inline style or add `data-animation="fadeIn"`. |
| Gradient text becomes pure transparent after `split-text` | Confirm parent has both `background-image: linear-gradient(...)` _and_ `background-clip: text` (the `.text-aurora`/`.text-fire`/etc. presets handle this). |
| Layout collapses below the stage | A child of `#stage` is `position: static` (default) and pushes itself out of the viewport. Make scene containers `position: absolute; inset: 0;` (or use the `.scene` preset class). |
| Chinese characters render as blocks (□) | Run `node scripts/install-fonts.mjs`. The CSS preset chain falls back to system Chinese fonts but having `Noto Sans SC` local makes builds reproducible across machines. |
| Render hangs after "loading" message | Browser failed to fire `__mvm.ready`. Open the HTML in a regular browser and check DevTools for JS errors. |
