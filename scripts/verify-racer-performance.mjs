// Run against a local static server. Supply an installed Playwright module path
// through PLAYWRIGHT_MODULE if it is not installed in this project.
// Example: RACER_SECONDS=900 RACER_BASELINE=8a81399 node scripts/verify-racer-performance.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const seconds = Number(process.env.RACER_SECONDS || 900);
if (!Number.isFinite(seconds) || seconds < 10) throw new Error('RACER_SECONDS must be at least 10');
const base = process.env.RACER_URL || 'http://127.0.0.1:3017/galactic-racers/';
const output = path.resolve(process.env.RACER_OUTPUT || '/tmp/racer-sustained');
fs.mkdirSync(output, { recursive: true });
const baseline = process.env.RACER_BASELINE;
const variants = baseline ? ['baseline', 'current'] : ['current'];
const thermal = () => { try { return execFileSync('pmset',['-g','therm'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}); } catch { return 'Thermal status unavailable'; } };
const report = { seconds, baseline, browser: null, note: 'Headless workload/pacing check; not a battery, temperature or physical display benchmark.', runs: [] };
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
 report.browser = browser.version();
 for (const variant of variants) {
  const page = await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))errors.push(m.text());});
  if (variant==='baseline') await page.route('**/galactic-racers/**', async route => {
   const url=new URL(route.request().url()); const file=url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname;
   if (!/\.(js|html)$/.test(file)) return route.continue();
   try {
    const body=execFileSync('git',['show',`${baseline}:public${file}`],{cwd:path.resolve(import.meta.dirname,'..'),stdio:['ignore','pipe','pipe']});
    await route.fulfill({body,contentType:file.endsWith('.js')?'application/javascript':'text/html'});
   } catch { await route.continue(); }
  });
  await page.addInitScript(()=>{localStorage.setItem('ir.quality','high');localStorage.setItem('ir.frameRate','60');});
  await page.goto(base+'?profile=1');
  await page.waitForFunction(()=>typeof Game!=='undefined'&&Game.desc());
  const adapter=await page.evaluate(async()=>{const a=await navigator.gpu.requestAdapter({powerPreference:'low-power'});return a?.info?{vendor:a.info.vendor,architecture:a.info.architecture,device:a.info.device,description:a.info.description}:null;});
  await page.evaluate(()=>{
   Game.ui.select({planetId:'halcyon',raceId:Planets.RACES.find(r=>r.planet==='halcyon').id,craft:null,craftSeed:1,seed:'efficiency-sustained',mode:'race'});Game.tweak({autopilot:true,laps:10000});UI.show(null);
   const render=Gpu.render;let previous=0;window.racerIntervals=[];
   Gpu.render=s=>{const now=performance.now();if(previous)racerIntervals.push(now-previous);previous=now;render(s);};
  });
  await page.waitForTimeout(6000);
  await page.evaluate(()=>{window.racerIntervals=[];});
  const run={variant,adapter,configuration:await page.evaluate(()=>({planet:Game.ui.planet().id,race:Game.ui.race().id,seed:Game.ui.seed(),quality:Gpu.getQuality()})),thermalBefore:thermal(),samples:[],errors};report.runs.push(run);
  const started=Date.now();
  while(Date.now()-started<seconds*1000) {
   await page.waitForTimeout(Math.min(30000,seconds*1000-(Date.now()-started)));
   const sample=await page.evaluate(()=>{
    const sorted=window.racerIntervals.splice(0).sort((a,b)=>a-b),at=p=>sorted[Math.max(0,Math.ceil(sorted.length*p)-1)]||0;
    return {count:sorted.length,frameMs:{p50:at(.5),p95:at(.95),p99:at(.99)},performance:Game.ui.performance(),race:Game.debug().race,heap:performance.memory?.usedJSHeapSize};
   });
   sample.elapsedSeconds=(Date.now()-started)/1000;run.samples.push(sample);
   console.log(JSON.stringify({variant,elapsed:Math.round(sample.elapsedSeconds),frameMs:sample.frameMs,scale:sample.performance.renderScale,errors:errors.length}));
   fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report,null,2));
  }
  run.thermalAfter=thermal();await page.screenshot({path:path.join(output,`${variant}-final.png`)});await page.close();
 }
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report,null,2));
 if(report.runs.some(r=>r.errors.length))throw new Error('Browser errors recorded; see results.json');
} finally { await browser.close(); }
