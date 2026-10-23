#!/usr/bin/env node
/* 冒煙測試：用 Playwright 開桌機與手機兩種尺寸，走一遍主要流程並截圖。
 *
 * 用法：node tools/smoke-test.js [截圖資料夾，預設 dist/screens]
 * 需要 Playwright（npm i -g playwright 或專案內安裝皆可）與 python3（啟動本機伺服器）。
 * 沒有 GPU 的環境會用軟體繪圖，畫面很慢但流程一樣能跑。
 */
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* 改找全域安裝 */ }
  return require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
}

const root = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'dist/screens'));
const PORT = 8000 + Math.floor(Math.random() * 900);
const BASE = `http://localhost:${PORT}/`;
const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
};

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures.push(name);
};

async function run(browser, name, opts) {
  console.log(`\n[${name}]`);
  const page = await browser.newPage(opts);
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (s) => page.screenshot({ path: path.join(outDir, `${name}-${s}.png`) });

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('#loading.done', { timeout: 90000 });
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#loading.done', { timeout: 90000 });
  await page.click('#btn-start');
  await page.waitForTimeout(3500);
  await shot('tour');

  // 迷霧中的導師：應驅散迷霧並在幾秒內打開導師卡
  // 在頁面內計時，避免軟體繪圖造成的通訊延遲影響量測
  const target = await page.evaluate(() => {
    const q = window.__quest, card = document.querySelector('#card');
    const f = q.faculty.find((x) => !q.explored.has(x.region));
    const t0 = performance.now();
    new MutationObserver((_, ob) => { if (!card.hidden) { window.__cardMs = performance.now() - t0; ob.disconnect(); } })
      .observe(card, { attributes: true, attributeFilter: ['hidden'] });
    q.selectTeacher(f, { fromCodex: true });
    return { id: f.id, region: f.region };
  });
  await page.waitForFunction(() => window.__cardMs !== undefined, null, { timeout: 30000 });
  const ms = await page.evaluate(() => window.__cardMs);
  check('迷霧導師開卡', true, `${(ms / 1000).toFixed(1)} 秒`);
  check('區域已驅散', await page.evaluate((r) => window.__quest.explored.has(r), target.region));
  await page.waitForTimeout(800);
  const photoOk = await page.evaluate(() => { const i = document.querySelector('#card-sheet .frame img'); return !!i && i.complete && i.naturalWidth > 0; });
  check('導師照片載入', photoOk);
  await shot('card');

  // 導師卡：Tab 不會跑出卡片、Esc 關閉
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
  check('Tab 停在導師卡內', await page.evaluate(() => document.querySelector('#card-sheet').contains(document.activeElement)));
  await page.keyboard.press('Escape');
  check('Esc 關閉導師卡', await page.evaluate(() => document.querySelector('#card').hidden));

  // 圖鑑：收起時 inert，搜尋框內按 Esc 可關閉
  check('圖鑑收起時為 inert', await page.evaluate(() => document.querySelector('#codex').inert));
  await page.click('#btn-codex');
  await page.waitForTimeout(500);
  await page.fill('#codex-search', 'AI');
  await page.waitForTimeout(300);
  await shot('codex');
  await page.focus('#codex-search');
  await page.keyboard.press('Escape');
  check('搜尋框內 Esc 關閉圖鑑', await page.evaluate(() => !document.querySelector('#codex').classList.contains('open')));

  // 探險模式
  await page.evaluate(() => window.__quest.setMode('explore'));
  await page.waitForTimeout(1500);
  await shot('explore');

  check('沒有 console 錯誤', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const [name, opts] of Object.entries(VIEWPORTS)) await run(browser, name, opts);
  } catch (e) {
    failures.push(e.message);
    console.error(e);
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(`\n截圖：${outDir}`);
  if (failures.length) { console.log(`失敗 ${failures.length} 項`); process.exit(1); }
  console.log('全部通過');
})();
