#!/usr/bin/env node
/**
 * motion-video-maker / render.mjs
 * ----------------------------------------------------------------
 * Deterministic frame-accurate HTML → MP4 renderer.
 *
 * Usage:
 *   node scripts/render.mjs <composition.html> [output.mp4] [options]
 *
 * Options (key=value):
 *   fps=30           override stage fps
 *   duration=10      override stage duration (seconds)
 *   width=1920       override width
 *   height=1080      override height
 *   crf=18           x264 quality (0..51, lower = better)
 *   preset=slow      x264 encoder preset
 *   keepFrames=1     keep the PNG sequence in ./frames
 *
 * Algorithm:
 *   1. Launch headless Chromium via puppeteer.
 *   2. Open the composition HTML; set `window.__mvmRenderMode = true`
 *      so the preview loop does NOT auto-start.
 *   3. For frame i in [0, fps * duration):
 *        a. Set `window.__mvmTime = i / fps` and call `__mvm.seek(t)`.
 *        b. Await `page.evaluate` to flush pending paints + canvas redraws.
 *        c. Capture page.screenshot({type:'png'}) into ./frames/NNNNNN.png.
 *   4. Stream frames into ffmpeg via image2 (concat) → libx264 yuv420p MP4.
 *
 * Inspired by:
 *   - Remotion's deterministic seek + image2pipe pattern
 *   - Hyperframes' single-machine page-to-video capture engine
 */
import { promises as fs } from 'node:fs';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = { positional: [], options: {} };
  for (const a of argv.slice(2)) {
    if (a.includes('=')) {
      const [k, ...rest] = a.split('=');
      args.options[k] = rest.join('=');
    } else {
      args.positional.push(a);
    }
  }
  return args;
}

function log(...m) { console.log('[mvm]', ...m); }
function err(...m) { console.error('[mvm]', ...m); }

async function main() {
  const args = parseArgs(process.argv);
  const htmlInput = args.positional[0];
  if (!htmlInput) {
    err('Usage: node scripts/render.mjs <composition.html> [output.mp4]');
    process.exit(1);
  }
  const htmlPath = path.resolve(htmlInput);
  if (!existsSync(htmlPath)) { err('HTML not found:', htmlPath); process.exit(1); }

  const outPath = path.resolve(
    args.positional[1] ||
    htmlPath.replace(/\.html?$/i, '.mp4')
  );

  const framesDir = path.resolve(path.dirname(outPath), '.mvm-frames-' + Date.now());
  mkdirSync(framesDir, { recursive: true });

  // ---------- Launch browser -------------------------------------
  log('launching headless chromium');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--allow-file-access-from-files',
      '--disable-features=IsolateOrigins,site-per-process',
      '--font-render-hinting=none',
      '--enable-font-antialiasing',
      '--disable-gpu-vsync',
      '--hide-scrollbars',
      // Enable WebGL2 with software rasterizer (works on headless macOS)
      '--enable-webgl',
      '--use-gl=angle',
      '--use-angle=metal',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
    ],
    defaultViewport: null,
  });
  const page = await browser.newPage();

  // Forward browser console errors for easier debugging
  page.on('console', m => {
    if (m.type() === 'error') err('[browser]', m.text());
  });
  page.on('pageerror', e => err('[browser:exception]', e.message));

  // Inject render mode flag BEFORE the page scripts run
  await page.evaluateOnNewDocument(() => {
    window.__mvmRenderMode = true;
  });

  log('loading', htmlPath);
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle0' });

  // Wait for runtime to mount
  await page.waitForFunction(() => window.__mvm && window.__mvm.ready === true, { timeout: 15000 });

  // Read stage meta (with overrides)
  let meta = await page.evaluate(() => window.__mvm.meta());
  if (args.options.fps) meta.fps = parseInt(args.options.fps, 10);
  if (args.options.duration) meta.duration = parseFloat(args.options.duration);
  if (args.options.width)  meta.width = parseInt(args.options.width, 10);
  if (args.options.height) meta.height = parseInt(args.options.height, 10);

  log(`composition: ${meta.width}x${meta.height} @ ${meta.fps}fps, ${meta.duration}s`);

  // Set the viewport to exactly match the stage so the screenshot
  // captures the full canvas without scrollbars.  We also remove the
  // preview centering so the stage occupies (0,0).
  await page.setViewport({
    width: meta.width,
    height: meta.height,
    deviceScaleFactor: 1,
  });
  await page.evaluate(() => {
    document.body.classList.remove('mvm-preview');
    document.body.style.background = '#000';
    const s = document.getElementById('stage');
    if (s) {
      s.style.position = 'absolute';
      s.style.left = '0';
      s.style.top = '0';
      s.style.transform = 'none';
    }
  });

  const totalFrames = Math.round(meta.fps * meta.duration);
  const padLen = String(totalFrames).length + 1;
  log(`rendering ${totalFrames} frames →`, framesDir);

  // Allow the in-page components to discover elements
  await page.evaluate(() => window.__mvm.components && window.__mvm.components.refresh());

  // ---------- Per-frame capture ---------------------------------
  const t0 = Date.now();
  let lastReport = t0;
  for (let i = 0; i < totalFrames; i++) {
    const t = i / meta.fps;
    await page.evaluate(time => window.__mvm.seek(time), t);
    // Flush any pending layout/paint
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const filename = String(i).padStart(padLen, '0') + '.png';
    await page.screenshot({
      path: path.join(framesDir, filename),
      type: 'png',
      omitBackground: false,
      clip: { x: 0, y: 0, width: meta.width, height: meta.height },
    });
    const now = Date.now();
    if (now - lastReport > 1000) {
      const pct = ((i + 1) / totalFrames * 100).toFixed(1);
      const fps = ((i + 1) * 1000 / (now - t0)).toFixed(2);
      log(`frame ${i + 1}/${totalFrames}  (${pct}%, ${fps} fps capture)`);
      lastReport = now;
    }
  }
  log(`capture done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await browser.close();

  // ---------- Encode with ffmpeg --------------------------------
  const crf = args.options.crf || '18';
  const preset = args.options.preset || 'slow';
  log('encoding with ffmpeg (crf=' + crf + ' preset=' + preset + ')');

  await runFfmpeg([
    '-y',
    '-framerate', String(meta.fps),
    '-i', path.join(framesDir, `%0${padLen}d.png`),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', preset,
    '-crf', String(crf),
    '-movflags', '+faststart',
    outPath,
  ]);

  if (!args.options.keepFrames) {
    rmSync(framesDir, { recursive: true, force: true });
  } else {
    log('frames kept at', framesDir);
  }

  log('✔ done →', outPath);
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error('ffmpeg exit ' + code)));
  });
}

main().catch(e => { err(e.stack || e.message); process.exit(1); });
