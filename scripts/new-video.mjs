#!/usr/bin/env node
/**
 * motion-video-maker / new-video.mjs
 * ----------------------------------------------------------------
 * Scaffolds a brand-new composition under examples/<name>/index.html
 * with sensible defaults so authors can immediately tweak text and
 * timings rather than start from a blank file.
 *
 * Usage:
 *   node scripts/new-video.mjs <name>
 *   node scripts/new-video.mjs <name> --duration 12 --fps 30 --bg aurora
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const name = args[0];
if (!name || name.startsWith('-')) {
  console.error('Usage: node scripts/new-video.mjs <name> [--duration 10] [--fps 30] [--bg aurora]');
  process.exit(1);
}
const opts = { duration: 10, fps: 30, bg: 'aurora', width: 1920, height: 1080 };
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--duration') opts.duration = parseFloat(args[++i]);
  else if (args[i] === '--fps') opts.fps = parseInt(args[++i], 10);
  else if (args[i] === '--bg') opts.bg = args[++i];
  else if (args[i] === '--width') opts.width = parseInt(args[++i], 10);
  else if (args[i] === '--height') opts.height = parseInt(args[++i], 10);
}

const dir = path.join(ROOT, 'examples', name);
if (existsSync(dir)) {
  console.error('directory already exists:', dir);
  process.exit(1);
}
mkdirSync(dir, { recursive: true });

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>${name}</title>
  <!-- runtime/styles.css MUST load before any author CSS so the
       --mvm-bg / --mvm-text tokens are available and the white-on-dark
       defaults apply.  Color contract:
         • #stage default: bg #0a0a0f / text #ffffff (inherited)
         • Any element with background:light MUST also set color:dark.
         • Easiest: use .mvm-card-dark / .mvm-card-light pairs. -->
  <link rel="stylesheet" href="../../runtime/styles.css" />
  <link rel="stylesheet" href="../../assets/fonts/fonts.css" />
</head>
<body class="mvm-preview">
  <div id="stage"
       data-composition-id="${name}"
       data-width="${opts.width}"
       data-height="${opts.height}"
       data-fps="${opts.fps}"
       data-duration="${opts.duration}">

    <!-- Background — dark by default; set inline
         style="--mvm-bg: #f7f5ef; --mvm-text: #0a0a0f"  on #stage
         to flip to a light-themed composition. -->
    <div data-background="${opts.bg}"></div>

    <!-- Scene wrapper with built-in dark scrim to lift text off the
         shader.  data-hide-mode="visibility" (default) keeps already-
         visible siblings stable when others fade in. -->
    <div class="scene scene-scrim"
         data-clip data-hide-mode="visibility"
         data-start="0" data-duration="${opts.duration}"
         style="position: absolute; inset: 0; z-index: 10;">

      <h1 class="title text-aurora text-readable"
          data-clip data-start="0.3" data-duration="${opts.duration - 0.3}"
          data-text-animation="split-text"
          data-stagger="0.06" data-char-duration="0.9">${name}</h1>

      <p class="subtitle"
         data-clip data-start="1.4" data-duration="${opts.duration - 1.4}"
         data-animation="unmaskUp" data-in-duration="0.8"
         data-easing="easeInOutQuart">由 motion-video-maker 制作</p>
    </div>

    <div class="frame"></div>
  </div>

  <script src="../../runtime/spring.js"></script>
  <script src="../../runtime/timeline.js"></script>
  <script src="../../runtime/components.js"></script>
  <script src="../../runtime/shaders.js"></script>
  <script src="../../runtime/transitions.js"></script>
  <script src="../../runtime/effects.js"></script>
  <script src="../../runtime/contrast-check.js"></script>
  <script src="../../runtime/layout-check.js"></script>
</body>
</html>
`;
await fs.writeFile(path.join(dir, 'index.html'), html);
console.log('[mvm] new composition:', path.join(dir, 'index.html'));
console.log('[mvm] preview:  node scripts/preview.mjs examples/' + name + '/index.html');
console.log('[mvm] render:   node scripts/render.mjs examples/' + name + '/index.html');
