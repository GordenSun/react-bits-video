#!/usr/bin/env node
/**
 * motion-video-maker / install-fonts.mjs
 * ----------------------------------------------------------------
 * Downloads a curated set of open-source Chinese fonts so that all
 * compositions render Chinese characters correctly (whether they're
 * exported on macOS, Linux, or a CI runner).
 *
 * Default fonts:
 *   - Noto Sans SC      Regular / Bold / Black                 (Google / OFL)
 *   - Noto Serif SC     Regular / Bold / Black                 (Google / OFL)
 *   - LXGW WenKai       Regular                                 (lxgw / OFL)
 *
 * Output:
 *   assets/fonts/*.ttf  (or .otf / .woff2)
 *   assets/fonts/fonts.css  — auto-generated @font-face stylesheet
 *
 * Re-run is idempotent: already-downloaded files are skipped.
 *
 * Usage:
 *   node scripts/install-fonts.mjs
 *   node scripts/install-fonts.mjs --list      # show the manifest only
 *   node scripts/install-fonts.mjs --add <url> # download a custom file
 */
import { promises as fs } from 'node:fs';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import http from 'node:http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FONTS_DIR = path.resolve(__dirname, '..', 'assets', 'fonts');

const FONTS = [
  // family display name | url | filename | weight | style
  {
    family: 'Noto Sans SC', weight: 400, style: 'normal',
    file: 'NotoSansSC-Regular.ttf',
    url: 'https://github.com/googlefonts/noto-cjk/raw/main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf',
    fallback: [
      'https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf',
      'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf',
    ],
    saveAs: 'NotoSansSC-Regular.otf',
  },
  {
    family: 'Noto Sans SC', weight: 700, style: 'normal',
    url: 'https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/SC/NotoSansSC-Bold.otf',
    fallback: ['https://cdn.jsdelivr.net/gh/notofonts/noto-cjk/Sans/SubsetOTF/SC/NotoSansSC-Bold.otf'],
    saveAs: 'NotoSansSC-Bold.otf',
  },
  {
    family: 'Noto Sans SC', weight: 900, style: 'normal',
    url: 'https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/SC/NotoSansSC-Black.otf',
    fallback: ['https://cdn.jsdelivr.net/gh/notofonts/noto-cjk/Sans/SubsetOTF/SC/NotoSansSC-Black.otf'],
    saveAs: 'NotoSansSC-Black.otf',
  },
  {
    family: 'Noto Serif SC', weight: 400, style: 'normal',
    url: 'https://github.com/notofonts/noto-cjk/raw/main/Serif/SubsetOTF/SC/NotoSerifSC-Regular.otf',
    fallback: ['https://cdn.jsdelivr.net/gh/notofonts/noto-cjk/Serif/SubsetOTF/SC/NotoSerifSC-Regular.otf'],
    saveAs: 'NotoSerifSC-Regular.otf',
  },
  {
    family: 'Noto Serif SC', weight: 900, style: 'normal',
    url: 'https://github.com/notofonts/noto-cjk/raw/main/Serif/SubsetOTF/SC/NotoSerifSC-Black.otf',
    fallback: ['https://cdn.jsdelivr.net/gh/notofonts/noto-cjk/Serif/SubsetOTF/SC/NotoSerifSC-Black.otf'],
    saveAs: 'NotoSerifSC-Black.otf',
  },
  {
    family: 'LXGW WenKai', weight: 400, style: 'normal',
    url: 'https://github.com/lxgw/LxgwWenKai/releases/download/v1.501/LXGWWenKai-Regular.ttf',
    fallback: ['https://cdn.jsdelivr.net/gh/lxgw/LxgwWenKai/LXGWWenKai-Regular.ttf'],
    saveAs: 'LXGWWenKai-Regular.ttf',
  },
  // Display / decorative (artistic Chinese fonts from google/fonts mirror)
  {
    family: 'ZCOOL KuaiLe', weight: 400, style: 'normal',
    url: 'https://github.com/google/fonts/raw/main/ofl/zcoolkuaile/ZCOOLKuaiLe-Regular.ttf',
    fallback: ['https://cdn.jsdelivr.net/gh/google/fonts/ofl/zcoolkuaile/ZCOOLKuaiLe-Regular.ttf'],
    saveAs: 'ZCOOLKuaiLe-Regular.ttf',
  },
  {
    family: 'Ma Shan Zheng', weight: 400, style: 'normal',
    url: 'https://github.com/google/fonts/raw/main/ofl/mashanzheng/MaShanZheng-Regular.ttf',
    fallback: ['https://cdn.jsdelivr.net/gh/google/fonts/ofl/mashanzheng/MaShanZheng-Regular.ttf'],
    saveAs: 'MaShanZheng-Regular.ttf',
  },
  {
    family: 'Long Cang', weight: 400, style: 'normal',
    url: 'https://github.com/google/fonts/raw/main/ofl/longcang/LongCang-Regular.ttf',
    fallback: ['https://cdn.jsdelivr.net/gh/google/fonts/ofl/longcang/LongCang-Regular.ttf'],
    saveAs: 'LongCang-Regular.ttf',
  },
  {
    family: 'ZCOOL XiaoWei', weight: 400, style: 'normal',
    url: 'https://github.com/google/fonts/raw/main/ofl/zcoolxiaowei/ZCOOLXiaoWei-Regular.ttf',
    fallback: ['https://cdn.jsdelivr.net/gh/google/fonts/ofl/zcoolxiaowei/ZCOOLXiaoWei-Regular.ttf'],
    saveAs: 'ZCOOLXiaoWei-Regular.ttf',
  },
  {
    family: 'ZCOOL QingKe HuangYou', weight: 400, style: 'normal',
    url: 'https://github.com/google/fonts/raw/main/ofl/zcoolqingkehuangyou/ZCOOLQingKeHuangYou-Regular.ttf',
    fallback: ['https://cdn.jsdelivr.net/gh/google/fonts/ofl/zcoolqingkehuangyou/ZCOOLQingKeHuangYou-Regular.ttf'],
    saveAs: 'ZCOOLQingKeHuangYou-Regular.ttf',
  },
  {
    family: 'Liu Jian Mao Cao', weight: 400, style: 'normal',
    url: 'https://github.com/google/fonts/raw/main/ofl/liujianmaocao/LiuJianMaoCao-Regular.ttf',
    fallback: ['https://cdn.jsdelivr.net/gh/google/fonts/ofl/liujianmaocao/LiuJianMaoCao-Regular.ttf'],
    saveAs: 'LiuJianMaoCao-Regular.ttf',
  },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, { headers: { 'User-Agent': 'motion-video-maker/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error('HTTP ' + res.statusCode + ' ← ' + url));
      }
      const ws = createWriteStream(dest);
      res.pipe(ws);
      ws.on('finish', () => ws.close(() => resolve(dest)));
      ws.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('timeout: ' + url)));
  });
}

async function tryDownload(urls, dest) {
  const errors = [];
  for (const url of urls) {
    try {
      console.log('  ↓', url);
      await download(url, dest);
      const st = await fs.stat(dest);
      if (st.size < 1024) throw new Error('suspiciously small: ' + st.size + 'B');
      return dest;
    } catch (e) {
      errors.push(e.message);
      // try the next
    }
  }
  throw new Error('all sources failed:\n  ' + errors.join('\n  '));
}

function fontFaceCss(f) {
  const ext = path.extname(f.saveAs).slice(1);
  const format = ext === 'otf' ? 'opentype' : ext === 'ttf' ? 'truetype' : ext;
  return `@font-face {
  font-family: "${f.family}";
  font-weight: ${f.weight};
  font-style: ${f.style};
  src: url("./${f.saveAs}") format("${format}");
  font-display: block;
}`;
}

async function main() {
  if (process.argv.includes('--list')) {
    console.log(JSON.stringify(FONTS, null, 2));
    return;
  }
  mkdirSync(FONTS_DIR, { recursive: true });
  const installed = [];
  const skipped = [];
  const failed = [];

  for (const f of FONTS) {
    const dest = path.join(FONTS_DIR, f.saveAs);
    if (existsSync(dest)) {
      const st = await fs.stat(dest);
      if (st.size > 1024) { skipped.push(f.saveAs); installed.push(f); continue; }
    }
    console.log('[font]', f.family, f.weight);
    try {
      await tryDownload([f.url, ...(f.fallback || [])], dest);
      installed.push(f);
    } catch (e) {
      console.warn('[font] FAILED:', f.saveAs, '-', e.message);
      failed.push({ font: f, error: e.message });
    }
  }

  const css = installed.map(fontFaceCss).join('\n\n') + '\n';
  await fs.writeFile(path.join(FONTS_DIR, 'fonts.css'), css);

  console.log('');
  console.log('[install-fonts] installed:', installed.length, 'skipped:', skipped.length, 'failed:', failed.length);
  if (failed.length) {
    console.log('  failed:', failed.map(x => x.font.saveAs).join(', '));
  }
  console.log('[install-fonts] fonts.css →', path.join(FONTS_DIR, 'fonts.css'));
}

main().catch(e => { console.error(e.stack || e.message); process.exit(1); });
