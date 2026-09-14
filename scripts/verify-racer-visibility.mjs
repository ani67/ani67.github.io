// Run against this checkout's local preview. The diagnostic disables only the
// new instance visibility tests, then compares the result pixel-for-pixel.
// PLAYWRIGHT_MODULE can point to an existing Playwright installation.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(import.meta.dirname, '..');
const output = path.resolve(process.env.RACER_OUTPUT || '/tmp/racer-visibility');
const url = process.env.RACER_URL || 'http://127.0.0.1:3018/galactic-racers/';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const rows = [], errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1001, height: 703 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text());
  });
  await page.route('**/src/*.js*', route => {
    const name = path.basename(new URL(route.request().url()).pathname);
    let body = fs.readFileSync(path.join(root, 'public/galactic-racers/src', name), 'utf8');
    if (name === 'gpu.js') {
      const needle = 'if (!visible(bounds, frame, shadow ? 84 : 0))';
      if (!body.includes(needle)) throw new Error('Update the visibility diagnostic for the current renderer');
      body = body.replace(needle, 'if (!globalThis.disableInstanceCulling && !visible(bounds, frame, shadow ? 84 : 0))');
    }
    return route.fulfill({ body, contentType: 'application/javascript' });
  });
  await page.goto(url);
  await page.waitForFunction(() => typeof Game !== 'undefined' && Game.desc());
  for (const planet of ['halcyon', 'nullsector', 'embervale']) {
    await page.evaluate(id => {
      Game.ui.setPaused(false);
      Game.ui.setQuality('high');
      Game.ui.select({ planetId: id, seed: 'culling-edges', craft: null, craftSeed: 1, mode: 'race' });
      if (!window.originalRender) {
        window.originalRender = Gpu.render;
        Gpu.render = scene => { window.testScene = scene; originalRender(scene); };
      }
    }, planet);
    await page.waitForTimeout(800);
    await page.evaluate(() => Game.ui.setPaused(true));
    await page.waitForTimeout(100);
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      await page.evaluate(angle => {
        const car = Game.mp.cars()[0];
        testScene.particles = false;
        Frame.fill(testScene.frame, Game.desc(), {
          pos: [car.x, car.y + 5, car.z],
          look: [car.x + Math.sin(angle) * 40, car.y + 3, car.z + Math.cos(angle) * 40],
          fov: 65, aspect: 1001 / 703, time: 0,
          shadowCenter: [car.x, car.y, car.z], shadowSize: 180,
        }, {});
      }, angle);
      const shots = [];
      for (const disable of [false, true]) {
        await page.evaluate(disable => { window.disableInstanceCulling = disable; Gpu.render(testScene); }, disable);
        shots.push((await page.locator('#gl').screenshot()).toString('base64'));
      }
      const difference = await page.evaluate(async shots => {
        const arrays = [];
        for (const shot of shots) {
          const image = new Image(); image.src = 'data:image/png;base64,' + shot;
          await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
          const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
          arrays.push(context.getImageData(0, 0, canvas.width, canvas.height).data);
        }
        let max = 0, changed = 0;
        for (let i = 0; i < arrays[0].length; i++) {
          const difference = Math.abs(arrays[0][i] - arrays[1][i]);
          if (difference) changed++;
          max = Math.max(max, difference);
        }
        return { max, changed };
      }, shots);
      rows.push({ planet, angle, ...difference });
      console.log(rows.at(-1));
      if (angle === 0) fs.writeFileSync(path.join(output, `${planet}.png`), Buffer.from(shots[0], 'base64'));
    }
  }
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ rows, errors }, null, 2));
  if (errors.length || rows.some(row => row.max > 1)) throw new Error('Visibility comparison failed; inspect the results');
} finally {
  await browser.close();
}
