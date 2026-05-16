#!/usr/bin/env node
/**
 * Debug helper: open the composition at a specific time, dump
 * each `data-clip` element's computed visibility / opacity / display
 * so we can find why something isn't on screen.
 */
import puppeteer from 'puppeteer';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const html = path.resolve(process.argv[2] || 'examples/time-flies/index.html');
const time = parseFloat(process.argv[3] || '7');
const selector = process.argv[4] || '[data-clip],[data-fx]';

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox','--allow-file-access-from-files','--font-render-hinting=none'],
});
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => { window.__mvmRenderMode = true; });
await page.goto(pathToFileURL(html).href, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__mvm && window.__mvm.ready === true, { timeout: 15000 });
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
await page.evaluate(t => window.__mvm.seek(t), time);
await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

const dump = await page.evaluate((sel) => {
  return Array.from(document.querySelectorAll(sel)).map(el => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      cls: el.className || '',
      text: (el.textContent || '').slice(0, 40),
      txtAnim: el.dataset.textAnimation || '',
      fx: el.dataset.fx || '',
      start: el.dataset.start,
      dur: el.dataset.duration,
      display: cs.display,
      visibility: cs.visibility,
      opacity: cs.opacity,
      transform: cs.transform === 'none' ? '' : cs.transform.slice(0, 40),
      bg: cs.backgroundImage === 'none' ? '' : 'gradient',
      bgClip: cs.webkitBackgroundClip || cs.backgroundClip,
      color: cs.color,
      fill: cs.webkitTextFillColor,
      rect: `${r.left.toFixed(0)},${r.top.toFixed(0)} ${r.width.toFixed(0)}x${r.height.toFixed(0)}`,
    };
  });
}, selector);

console.log(`\nAt t=${time}s\n`);
console.log(JSON.stringify(dump, null, 2));
await browser.close();
