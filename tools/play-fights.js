#!/usr/bin/env node
/* 採集戰自動破關測試：用 js/fight.js 每個玩法內建的自動玩法（bot），
 * 1. 先在頁面裡快速模擬簡易版／正常版各數場，確認都打得贏；
 * 2. 再實際開啟採集戰畫面讓 bot 玩到結束，截圖存到 dist/fights/。
 * 用法：node tools/play-fights.js            （桌機：簡易版 2D 小視窗）
 *       MODE=3d node tools/play-fights.js    （桌機：正常版 3D 採集場，軟體繪圖會比較慢）
 *       MOBILE=1 node tools/play-fights.js   （手機尺寸：2D 小視窗與觸控按鈕）
 *       ONLY=hsu-hao,chen-nien-tsu node tools/play-fights.js   （只測指定老師）
 *       WORLD=modern node tools/play-fights.js  （指定世界觀：fantasy／modern／cyber）
 */
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* 改找全域安裝 */ }
  return require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
}
const root = path.resolve(__dirname, '..');
const PORT = 8000 + Math.floor(Math.random() * 900);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const MODE = process.env.MODE === '3d' ? '3d' : '2d';
(async () => {
  const out = path.join(root, 'dist/fights'), mobile = process.env.MOBILE === '1';
  fs.mkdirSync(out, { recursive: true });
  const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const { chromium } = loadPlaywright();
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : (MODE === '3d' ? { viewport: { width: 960, height: 600 } } : { viewport: { width: 1280, height: 800 } }));
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  let fails = 0;
  try {
    await p.goto(`http://localhost:${PORT}/${process.env.WORLD ? '?world=' + process.env.WORLD : ''}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p.waitForSelector('#loading.done', { state: 'attached', timeout: 240000 });
    // 所有導師都先進入「採集中」
    await p.evaluate(() => {
      const t = {}; Object.keys(window.QUESTS.teachers).forEach((id) => { t[id] = { stage: 1, got: 0 }; });
      localStorage.clear(); localStorage.setItem('tutIdQuest.quests.v1', JSON.stringify({ quick: false, t }));
    });
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#loading.done', { state: 'attached', timeout: 240000 });
    await p.click('#btn-start'); await p.waitForTimeout(500);
    const ids = ONLY || await p.evaluate(() => Object.keys(window.QUESTS.teachers));
    const tag = (process.env.WORLD ? process.env.WORLD[0] : '') + (mobile ? 'm' : MODE === '3d' ? '3d' : 'd');
    for (const id of ids) {
      const type = await p.evaluate((id) => window.QUESTS.teachers[id].stage1.game.type, id);
      // 1. 快速模擬
      const sim = await p.evaluate((id) => [false, false, false, true, true, true].map((hard) => window.__quest.quests.debug.simulate(id, hard)), id);
      const simOk = sim.slice(0, 3).every((r) => r.result === 'win') && sim.filter((r) => r.result === 'win').length >= 4;
      // 2. 實際畫面
      if (MODE === '2d') {
        await p.evaluate((id) => { const q = window.__quest; q.quests.openFight(q.faculty.find((f) => f.id === id)); }, id);
        await p.waitForTimeout(id === ids[0] ? 1500 : 300);
        if (id === ids[0]) await p.screenshot({ path: `${out}/f-${tag}-brief.png` });
        await p.click('[data-tr="fight-easy"]');
      } else {
        await p.evaluate((id) => window.__quest.quests.debug.startFight(id, true), id);
      }
      await p.waitForTimeout(1200);
      await p.evaluate((m) => { const d = window.__quest.quests.debug; d.fightBot(true); d.fightSpeed(m === '3d' ? 8 : 3); }, MODE);
      await p.waitForTimeout(MODE === '3d' ? 6000 : 3500);
      await p.screenshot({ path: `${out}/f-${tag}-${type}.png` });
      const t0 = Date.now();
      let res = null;
      while (Date.now() - t0 < (MODE === '3d' ? 300000 : 180000)) {
        res = await p.evaluate(() => window.__quest.quests.debug.fight());
        if (!res || res.done) break;
        await p.waitForTimeout(500);
      }
      await p.waitForTimeout(1500);
      const won = await p.evaluate((id) => window.__quest.quests.debug.save().t[id].stage === 2, id);
      if (id === ids[0]) await p.screenshot({ path: `${out}/f-${tag}-result.png` });
      await p.keyboard.press('Escape');
      const ok = simOk && won;
      if (!ok) fails++;
      console.log(`${ok ? '  ✓' : '  ✗'} ${id}（${type}）模擬 ${sim.map((r) => (r.result === 'win' ? Math.round(r.t) + 's' : r.result || '逾時')).join(' ')}｜實玩${won ? '通關' : '未通關'} ${Math.round((Date.now() - t0) / 1000)} 秒`);
    }
  } catch (e) { fails++; console.error(e); }
  if (errs.length) { fails++; console.log('console 錯誤：', errs.slice(0, 5).join(' | ')); }
  await b.close(); server.kill();
  console.log(fails ? `失敗 ${fails} 項` : `全部通關（截圖：dist/fights/）`);
  process.exit(fails ? 1 : 0);
})();
