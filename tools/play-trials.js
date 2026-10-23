#!/usr/bin/env node
/* 試煉自動破關測試：依 data/quests.js 的答案，在瀏覽器裡自動玩完每個已完成的小遊戲，
 * 確認都能通關並拿到徽章，並把畫面截圖存到 dist/trials/。
 * 用法：node tools/play-trials.js            （桌機尺寸）
 *       MOBILE=1 node tools/play-trials.js   （手機尺寸）
 *       ONLY=hsu-hao,chen-nien-tsu node tools/play-trials.js   （只測指定老師）
 * 教室空氣那關是 45 秒的即時模擬，沒有 GPU 的環境會跑比較久。
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
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; // 預設：所有已完成的小遊戲
(async () => {
  const out = path.join(root, 'dist/trials'), mobile = process.env.MOBILE === '1';
  fs.mkdirSync(out, { recursive: true });
  const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const { chromium } = loadPlaywright();
  let fails = 0;
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1200, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && errs.push(m.text()));
  await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForSelector('#loading.done', { state: 'attached', timeout: 240000 });
  await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#loading.done', { state: 'attached', timeout: 240000 });
  await p.click('#btn-start'); await p.waitForTimeout(500);
  const tag = mobile ? 'm' : 'd';
  const SUPPORTED = ['network', 'sequence', 'prompt', 'nodes', 'airflow', 'sorting', 'stack', 'bracing', 'matching', 'storeplan', 'spotbrand', 'moodboard'];
  const ids = ONLY || await p.evaluate((sup) => Object.entries(window.QUESTS.teachers).filter(([, q]) => sup.includes(q.stage2.game)).map(([id]) => id), SUPPORTED);
  for (const id of ids) {
    const s2 = await p.evaluate((id) => window.QUESTS.teachers[id].stage2, id);
    await p.evaluate((id) => { const q = window.__quest; q.quests.openTrial(q.faculty.find((f) => f.id === id)); }, id);
    await p.waitForTimeout(400);
    await p.click('[data-tr="start"]'); await p.waitForTimeout(500);
    await p.screenshot({ path: `${out}/t-${tag}-${s2.game}-start.png` });
    const t0 = Date.now();
    if (s2.game === 'network') {
      for (const r of s2.rounds) { await p.click(`.tg-node[data-n="${r.answer}"]`); await p.waitForTimeout(3000); }
    } else if (s2.game === 'sequence') {
      const names = s2.steps.map((x) => x.name);
      for (let i = 0; i < names.length; i++) {
        const cur = await p.$$eval('.tg-seq button', (bs) => bs.map((b) => b.textContent.replace(/^\d+/, '')));
        const j = cur.indexOf(names[i]);
        if (j !== i) { await p.click(`.tg-seq [data-i="${i}"]`); await p.click(`.tg-seq [data-i="${j}"]`); }
      }
      await p.screenshot({ path: `${out}/t-${tag}-sequence-sorted.png` });
      await p.click('[data-a="check"]'); await p.waitForTimeout(3600);
    } else if (s2.game === 'prompt') {
      for (const r of s2.rounds) {
        for (const [k, v] of Object.entries(r.answer)) await p.click(`.tg-cat[data-k="${k}"] button[data-v="${v}"]`);
        await p.click('[data-a="gen"]'); await p.waitForTimeout(300);
        await p.screenshot({ path: `${out}/t-${tag}-prompt-gen.png` });
        await p.waitForTimeout(2500);
      }
    } else if (s2.game === 'nodes') {
      for (const [o, port] of s2.answer.wires) { await p.click(`[data-out="${o}"]`); await p.click(`[data-port="${port}"]`); }
      await p.screenshot({ path: `${out}/t-${tag}-nodes-wired.png` });
      await p.click('[data-a="check"]'); await p.waitForTimeout(400);
      await p.$eval('.tg-tower input', (el, v) => { el.value = v; el.dispatchEvent(new Event('input')); }, s2.answer.twist);
      await p.screenshot({ path: `${out}/t-${tag}-nodes-tower.png` });
      await p.click('[data-a="check"]'); await p.waitForTimeout(2600);
    } else if (s2.game === 'airflow') {
      await p.click('[data-d="1"]');
      await p.click('[data-a="go"]');
      // 自動控制：快到上限開窗，降下來關窗
      await p.evaluate(() => new Promise((res) => {
        const iv = setInterval(() => {
          const t = document.querySelector('.tg-co2'); if (!t) { clearInterval(iv); res(); return; }
          const v = parseFloat(t.textContent), w = document.querySelector('[data-d="0"]');
          if (v > 880 && !w.classList.contains('on')) w.click();
          if (v < 720 && w.classList.contains('on')) w.click();
          if (/成功|超過/.test(document.querySelector('.tg-say').textContent)) { clearInterval(iv); res(); }
        }, 150);
      }));
      await p.screenshot({ path: `${out}/t-${tag}-airflow-end.png` });
      await p.waitForTimeout(4000);
    } else if (s2.game === 'sorting') {
      const ans = {}; s2.items.forEach((x) => { ans[x.name] = x.answer; }); s2.choices.forEach((x) => { ans[x.ask] = x.answer; });
      for (let k = 0; k < 20; k++) {
        const txt = await p.evaluate(() => document.querySelector('.tg-crate b')?.textContent);
        if (!txt || !ans[txt]) break;
        await p.click(`.tg-bins button[data-v="${ans[txt]}"]`);
        if (k === 1) await p.screenshot({ path: `${out}/t-${tag}-sorting.png` });
        await p.waitForTimeout(2200);
        const winNow = await p.evaluate(() => !!document.querySelector('.trial-win'));
        if (winNow) break;
      }
      await p.waitForTimeout(2200);
    } else if (s2.game === 'stack') {
      // 在頁面內每幀檢查偏移，對齊時才按下
      await p.evaluate(() => new Promise((res) => {
        const cv = document.querySelector('.tg-stack');
        const step = () => {
          const msg = document.querySelector('.tg-say')?.textContent || '';
          if (!cv.isConnected || document.querySelector('.trial-win') || /完成/.test(msg)) { res(); return; }
          if (/塌/.test(msg)) document.querySelector('[data-a="retry"]').click(); // 塌了就重新列印
          // 沒有 GPU 的環境幀率很低，每幀移動距離大，容許誤差放寬到 8
          else if (Math.abs(+cv.dataset.off) <= 8) cv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
          requestAnimationFrame(step);
        };
        step();
      }));
      await p.screenshot({ path: `${out}/t-${tag}-stack-end.png` });
      await p.waitForTimeout(2600);
    } else if (s2.game === 'bracing') {
      for (const L of s2.levels) {
        const rows = +L.frame.match(/(\d+)\s*層/)[1];
        for (let r = 0; r < rows; r++) await p.click(`.tg-bay[data-k="0,${r}"]`);
        await p.click('[data-a="wind"]'); await p.waitForTimeout(1700);
        await p.screenshot({ path: `${out}/t-${tag}-bracing.png` });
        await p.waitForTimeout(3000);
      }
    } else if (s2.game === 'matching') {
      for (let i = 0; i < s2.wishes.length; i++) {
        await p.selectOption(`.tg-wish[data-i="${i}"] [data-f="partner"]`, s2.wishes[i].best.partner);
        await p.selectOption(`.tg-wish[data-i="${i}"] [data-f="place"]`, s2.wishes[i].best.place);
      }
      await p.click('[data-a="submit"]'); await p.waitForTimeout(300);
      await p.screenshot({ path: `${out}/t-${tag}-matching.png` });
      await p.waitForTimeout(2800);
    } else if (s2.game === 'storeplan') {
      for (const sl of s2.slots) { await p.click(`[data-item="${sl.best}"]`); await p.click(`.tg-slot[data-slot="${sl.slot}"]`); }
      await p.click('[data-a="open"]'); await p.waitForTimeout(2000);
      await p.screenshot({ path: `${out}/t-${tag}-storeplan.png` });
      await p.waitForTimeout(5500);
    } else if (s2.game === 'spotbrand') {
      const apps = await p.$$eval('.tg-app span', (xs) => xs.map((x) => x.textContent));
      for (const a of s2.applications.filter((x) => !x.ok)) await p.click(`.tg-app[data-i="${apps.indexOf(a.name)}"]`);
      await p.screenshot({ path: `${out}/t-${tag}-spotbrand.png` });
      await p.waitForTimeout(2000);
      await p.click(`.tg-pack [data-v="${s2.packaging.answer}"]`); await p.waitForTimeout(2900);
    } else if (s2.game === 'moodboard') {
      for (const r of s2.rounds) {
        for (const [k, v] of Object.entries(r.answer)) await p.click(`.tg-cat[data-k="${k}"] button[data-v="${v}"]`);
        await p.click('[data-a="done"]'); await p.waitForTimeout(300);
        await p.screenshot({ path: `${out}/t-${tag}-moodboard.png` });
        await p.waitForTimeout(2800);
      }
    }
    const stage = await p.evaluate((id) => window.__quest.quests.debug.save().t[id]?.stage, id);
    const winShown = await p.evaluate(() => !!document.querySelector('.trial-win'));
    const ok = stage === 3 && winShown; fails += !ok;
    console.log(`${ok ? '  ✓' : '  ✗'} ${id}（${s2.game}）${((Date.now() - t0) / 1000).toFixed(0)} 秒`);
    if (winShown) await p.screenshot({ path: `${out}/t-${tag}-${s2.game}-win.png` });
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  }
  await p.evaluate(() => { const d = window.__quest.quests.debug; d.completeAll(); d.showCertificate(); });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/t-${tag}-certificate.png` });
  if (errs.length) { fails++; console.log('  ✗ console 錯誤：' + errs.slice(0, 3).join(' | ')); }
  await b.close(); server.kill();
  console.log(fails ? `失敗 ${fails} 項` : `全部通關（截圖：${path.relative(root, out)}/）`);
  process.exit(fails ? 1 : 0);
})();
