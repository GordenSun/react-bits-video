import puppeteer from 'puppeteer';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const html = path.resolve(process.argv[2]);
const t = parseFloat(process.argv[3] || '7');
const out = process.argv[4] || '/tmp/snap.png';
const browser = await puppeteer.launch({ headless:'new', args:[
  '--no-sandbox','--allow-file-access-from-files','--font-render-hinting=none',
  '--enable-webgl','--use-gl=angle','--use-angle=metal','--enable-unsafe-swiftshader','--ignore-gpu-blocklist',
]});
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => { window.__mvmRenderMode = true; });
await page.goto(pathToFileURL(html).href, { waitUntil:'networkidle0'});
await page.waitForFunction(()=>window.__mvm&&window.__mvm.ready===true);
await page.setViewport({width:1920,height:1080,deviceScaleFactor:1});
await page.evaluate(()=>{document.body.classList.remove('mvm-preview');const s=document.getElementById('stage');s.style.position='absolute';s.style.left='0';s.style.top='0';});
await page.evaluate((tt)=>window.__mvm.seek(tt), t);
await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
await page.screenshot({path:out, clip:{x:0,y:0,width:1920,height:1080}});
await browser.close();
console.log('saved',out);
