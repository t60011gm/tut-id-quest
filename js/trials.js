/* =========================================================================
 * 南應大室研所大冒險 · 導師試煉小遊戲
 * 每個小遊戲是 fn(容器, 試煉資料, { win, teacher }) → 清理函式。
 * 題目與答案都在 data/quests.js，這裡只處理玩法。
 * 操作一律用「點選」而不是拖曳，滑鼠、觸控、鍵盤都能玩。
 * 由 main.js 呼叫 installTrials(registerTrial) 註冊。
 * ========================================================================= */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 回饋文字：正確綠、錯誤紅、提示中性
function say(el, text, kind = '') { el.className = `tg-say ${kind}`; el.textContent = text; }

export function installTrials(registerTrial) {

  /* ───────── 黃教益：找出關鍵人物（社會網路分析）───────── */
  registerTrial('network', (box, data, { win }) => {
    let round = 0, timer = 0, left = 20, alive = true;
    box.innerHTML = `<div class="tg-head"><span class="tg-step"></span><b class="tg-ask"></b></div>
      <div class="tg-timer"><i></i></div>
      <svg class="tg-net" viewBox="0 0 400 300" role="group" aria-label="人際網路圖"></svg>
      <p class="tg-say"></p>`;
    const svg = box.querySelector('svg'), sayEl = box.querySelector('.tg-say'), bar = box.querySelector('.tg-timer i');
    // 簡易力導向排版：固定亂數種子，每次畫出來都一樣
    function layout(r) {
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const P = Object.fromEntries(r.nodes.map((n, i) => [n, { x: 200 + Math.cos(i * 2.4) * 90 + rnd() * 10, y: 150 + Math.sin(i * 2.4) * 70 + rnd() * 10 }]));
      for (let it = 0; it < 300; it++) {
        const F = Object.fromEntries(r.nodes.map((n) => [n, { x: 0, y: 0 }]));
        for (const a of r.nodes) for (const b of r.nodes) {
          if (a === b) continue;
          const dx = P[a].x - P[b].x, dy = P[a].y - P[b].y, d2 = Math.max(80, dx * dx + dy * dy);
          F[a].x += dx / d2 * 900; F[a].y += dy / d2 * 900;
        }
        for (const [a, b] of r.edges) {
          const dx = P[b].x - P[a].x, dy = P[b].y - P[a].y, d = Math.hypot(dx, dy) || 1, k = (d - 70) * 0.04;
          F[a].x += dx / d * k; F[a].y += dy / d * k; F[b].x -= dx / d * k; F[b].y -= dy / d * k;
        }
        for (const n of r.nodes) { P[n].x = Math.min(370, Math.max(30, P[n].x + F[n].x)); P[n].y = Math.min(275, Math.max(25, P[n].y + F[n].y)); }
      }
      return P;
    }
    function show() {
      const r = data.rounds[round], P = layout(r);
      box.querySelector('.tg-step').textContent = `第 ${round + 1} / ${data.rounds.length} 題`;
      box.querySelector('.tg-ask').textContent = r.ask;
      svg.innerHTML = r.edges.map(([a, b]) => `<line x1="${P[a].x}" y1="${P[a].y}" x2="${P[b].x}" y2="${P[b].y}"/>`).join('') +
        r.nodes.map((n) => `<g class="tg-node" data-n="${n}" tabindex="0" role="button" aria-label="${n}"><circle cx="${P[n].x}" cy="${P[n].y}" r="17"/><text x="${P[n].x}" y="${P[n].y + 5}">${n}</text></g>`).join('');
      say(sayEl, '點出你的答案。');
      left = 20; clearInterval(timer);
      timer = setInterval(() => {
        left -= 0.1; bar.style.width = `${Math.max(0, left / 20 * 100)}%`;
        if (left <= 0) { clearInterval(timer); say(sayEl, `時間到！提示：${r.why}`, 'hint'); }
      }, 100);
    }
    async function choose(n) {
      const r = data.rounds[round], g = svg.querySelector(`[data-n="${n}"]`);
      if (n === r.answer) {
        clearInterval(timer); g.classList.add('ok'); say(sayEl, `答對了！${r.why}`, 'ok');
        await sleep(2600); if (!alive) return;
        round++; if (round >= data.rounds.length) win(); else show();
      } else {
        g.classList.add('bad'); setTimeout(() => g.classList.remove('bad'), 600);
        say(sayEl, '不是這位，再想想看。', 'bad');
      }
    }
    svg.addEventListener('click', (e) => { const g = e.target.closest('.tg-node'); if (g && !g.classList.contains('ok')) choose(g.dataset.n); });
    svg.addEventListener('keydown', (e) => { const g = e.target.closest('.tg-node'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); choose(g.dataset.n); } });
    show();
    return () => { alive = false; clearInterval(timer); };
  });

  /* ───────── 馮一鳴：工序排排看（室內設計實務）───────── */
  registerTrial('sequence', (box, data, { win }) => {
    const BUDGET = 8;
    let order, budget, picked = null;
    box.innerHTML = `<div class="tg-head"><span class="tg-step">點兩張卡片交換位置</span><b>預算 <span class="tg-budget"></span></b></div>
      <ol class="tg-seq"></ol>
      <div class="trial-actions"><button type="button" class="q-btn primary" data-a="check">確認順序</button></div>
      <p class="tg-say"></p>`;
    const list = box.querySelector('.tg-seq'), sayEl = box.querySelector('.tg-say'), budEl = box.querySelector('.tg-budget');
    function reset() {
      do order = shuffle(data.steps.map((_, i) => i)); while (order.every((v, i) => v === i));
      budget = BUDGET; picked = null; render(); say(sayEl, '把工程排成正確的施工順序。');
    }
    function render(marks = null) {
      budEl.innerHTML = Array.from({ length: BUDGET }, (_, i) => `<i class="${i < budget ? 'on' : ''}"></i>`).join('');
      list.innerHTML = order.map((si, i) => `<li><button type="button" data-i="${i}" class="${picked === i ? 'picked' : ''} ${marks ? (marks[i] ? 'ok' : 'bad') : ''}"><span>${i + 1}</span>${esc(data.steps[si].name)}</button></li>`).join('');
    }
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]'); if (!b) return;
      const i = +b.dataset.i;
      if (picked === null) picked = i;
      else { [order[picked], order[i]] = [order[i], order[picked]]; picked = null; }
      render();
    });
    box.querySelector('[data-a="check"]').addEventListener('click', async () => {
      const marks = order.map((si, i) => si === i), wrong = marks.filter((m) => !m).length;
      if (!wrong) {
        render(marks);
        say(sayEl, '順序完全正確！', 'ok');
        list.querySelectorAll('li').forEach((li, i) => li.insertAdjacentHTML('beforeend', `<small>${esc(data.steps[i].why)}</small>`));
        await sleep(3200); win(); return;
      }
      budget = Math.max(0, budget - wrong);
      render(marks);
      if (budget <= 0) { say(sayEl, '預算用完了，工程重來！', 'bad'); await sleep(1600); reset(); }
      else say(sayEl, `有 ${wrong} 張放錯了（紅色），扣 ${wrong} 格預算。再調整看看。`, 'bad');
    });
    reset();
    return () => {};
  });

  /* ───────── 林傑仁：拼出好提示詞（AI 應用、設計運算）───────── */
  registerTrial('prompt', (box, data, { win }) => {
    const CATS = [['style', '風格'], ['palette', '色調'], ['material', '材質'], ['light', '光線']];
    // 每個選項對應的畫面元素（程式繪製的示意空間）
    const LOOK = {
      palette: { '白與淺木色': ['#f4f1ea', '#d8b98f'], '灰黑與鏽紅': ['#6d6a68', '#8a3b2a'], '米白與原木': ['#efe6d2', '#b88a5a'], '墨綠與金': ['#1f4a3c', '#c9a227'] },
      material: { '淺色木材與棉麻': 'wood', '水泥與黑鐵': 'concrete', '原木、和紙與藺草': 'tatami', '大理石與絲絨': 'marble' },
      light: { '大面窗自然光': 'window', '裸燈泡與軌道燈': 'bulbs', '紙燈罩柔和光': 'paper', '水晶吊燈與重點照明': 'chandelier' },
      style: { '北歐風': 'sofa', '工業風': 'leather', '日式禪風': 'low', '現代奢華': 'velvet' }
    };
    function draw(cv, a) {
      const c = cv.getContext('2d'), W = cv.width, H = cv.height;
      const [wall, accent] = LOOK.palette[a.palette] || ['#ddd', '#999'];
      c.fillStyle = wall; c.fillRect(0, 0, W, H);
      const floorY = H * 0.68, mt = LOOK.material[a.material];
      c.fillStyle = mt === 'concrete' ? '#8d8b88' : mt === 'marble' ? '#ece8e2' : mt === 'tatami' ? '#c9c08a' : '#d6b88c'; c.fillRect(0, floorY, W, H - floorY);
      c.strokeStyle = 'rgba(0,0,0,.15)'; c.lineWidth = 1;
      if (mt === 'wood') for (let x = 0; x < W; x += 18) { c.beginPath(); c.moveTo(x, floorY); c.lineTo(x - 30, H); c.stroke(); }
      if (mt === 'tatami') for (let x = 0; x < W; x += 60) c.strokeRect(x, floorY, 60, (H - floorY) / 2), c.strokeRect(x + 30, floorY + (H - floorY) / 2, 60, (H - floorY) / 2);
      if (mt === 'marble') { c.strokeStyle = 'rgba(120,120,120,.35)'; for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(k * 50, floorY); c.quadraticCurveTo(k * 50 + 30, floorY + 30, k * 50 + 10, H); c.stroke(); } }
      if (mt === 'concrete') { c.fillStyle = 'rgba(0,0,0,.06)'; for (let k = 0; k < 40; k++) c.fillRect((k * 53) % W, floorY + (k * 29) % (H - floorY), 3, 3); }
      const lt = LOOK.light[a.light];
      if (lt === 'window') { c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(W * 0.08, H * 0.12, W * 0.3, H * 0.42); c.fillStyle = 'rgba(255,250,220,.25)'; c.beginPath(); c.moveTo(W * 0.08, H * 0.54); c.lineTo(W * 0.38, H * 0.54); c.lineTo(W * 0.6, H); c.lineTo(W * 0.2, H); c.fill(); }
      if (lt === 'bulbs') { c.strokeStyle = '#222'; for (let k = 0; k < 3; k++) { const x = W * (0.3 + k * 0.2); c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H * 0.25); c.stroke(); c.fillStyle = '#ffd36b'; c.beginPath(); c.arc(x, H * 0.27, 7, 0, Math.PI * 2); c.fill(); } }
      if (lt === 'paper') { c.fillStyle = '#fff6dc'; c.beginPath(); c.ellipse(W * 0.5, H * 0.22, 26, 30, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(255,240,200,.25)'; c.beginPath(); c.arc(W * 0.5, H * 0.3, 90, 0, Math.PI * 2); c.fill(); }
      if (lt === 'chandelier') { c.fillStyle = '#c9a227'; c.fillRect(W * 0.5 - 30, H * 0.14, 60, 6); for (let k = 0; k < 5; k++) { c.fillStyle = '#fff4c8'; c.beginPath(); c.moveTo(W * 0.5 - 28 + k * 14, H * 0.2); c.lineTo(W * 0.5 - 24 + k * 14, H * 0.3); c.lineTo(W * 0.5 - 32 + k * 14, H * 0.3); c.fill(); } }
      const fs = LOOK.style[a.style], sx = W * 0.55, sy = floorY;
      c.fillStyle = accent;
      if (fs === 'low') { c.fillRect(sx - 60, sy - 14, 120, 14); c.fillRect(sx - 50, sy - 30, 100, 16); }
      else if (fs === 'leather') { c.fillStyle = '#6b3a22'; c.fillRect(sx - 70, sy - 40, 140, 40); c.fillStyle = '#222'; c.fillRect(W * 0.12, sy - 90, 8, 90); c.fillRect(W * 0.28, sy - 90, 8, 90); for (let k = 0; k < 3; k++) c.fillRect(W * 0.12, sy - 30 - k * 28, W * 0.17, 4); }
      else if (fs === 'velvet') { c.beginPath(); c.roundRect(sx - 75, sy - 46, 150, 46, 18); c.fill(); c.fillStyle = '#eee'; c.fillRect(sx - 30, sy - 8, 60, 8); }
      else { c.beginPath(); c.roundRect(sx - 70, sy - 42, 140, 36, 8); c.fill(); c.fillStyle = '#b08a5a'; c.fillRect(sx - 60, sy - 6, 4, 6); c.fillRect(sx + 56, sy - 6, 4, 6); }
    }
    let round = 0;
    const pick = {};
    box.innerHTML = `<div class="tg-head"><span class="tg-step"></span><b class="tg-ask"></b></div>
      <div class="tg-pair"><figure><canvas width="320" height="200"></canvas><figcaption>目標空間</figcaption></figure><figure><canvas width="320" height="200"></canvas><figcaption>你的生成結果</figcaption></figure></div>
      <div class="tg-cats">${CATS.map(([k, n]) => `<div class="tg-cat" data-k="${k}"><b>${n}</b>${data.options[k].map((o) => `<button type="button" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`).join('')}</div>
      <div class="trial-actions"><button type="button" class="q-btn primary" data-a="gen">生成</button></div>
      <p class="tg-say"></p>`;
    const [cvT, cvG] = box.querySelectorAll('canvas'), sayEl = box.querySelector('.tg-say');
    function show() {
      const r = data.rounds[round];
      box.querySelector('.tg-step').textContent = `第 ${round + 1} / ${data.rounds.length} 回合`;
      box.querySelector('.tg-ask').textContent = r.target;
      draw(cvT, r.answer);
      for (const [k] of CATS) delete pick[k];
      box.querySelectorAll('.tg-cat button').forEach((b) => b.classList.remove('on', 'ok', 'bad'));
      const g = cvG.getContext('2d'); g.fillStyle = '#e8dcc2'; g.fillRect(0, 0, cvG.width, cvG.height);
      say(sayEl, '每一類選一個關鍵字，再按「生成」。');
    }
    box.querySelector('.tg-cats').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const cat = b.closest('.tg-cat');
      cat.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      cat.querySelectorAll('button').forEach((x) => x.classList.remove('ok', 'bad'));
      pick[cat.dataset.k] = b.dataset.v;
    });
    box.querySelector('[data-a="gen"]').addEventListener('click', async () => {
      if (CATS.some(([k]) => !pick[k])) { say(sayEl, '每一類都要選一個關鍵字喔。', 'hint'); return; }
      const r = data.rounds[round];
      draw(cvG, pick);
      let hit = 0;
      for (const [k, n] of CATS) {
        const ok = pick[k] === r.answer[k]; hit += ok;
        box.querySelector(`.tg-cat[data-k="${k}"] button.on`).classList.add(ok ? 'ok' : 'bad');
      }
      if (hit === 4) {
        say(sayEl, '完全吻合！提示詞清楚，AI 就能生成你要的空間。', 'ok');
        await sleep(2400); round++;
        if (round >= data.rounds.length) win(); else show();
      } else say(sayEl, `吻合度 ${hit} / 4。紅色的關鍵字和目標不一致，換一個試試。`, 'bad');
    });
    show();
    return () => {};
  });

  /* ───────── 徐灝：接出一座扭轉塔（設計運算、AI 整合）───────── */
  registerTrial('nodes', (box, data, { win }) => {
    // 節點位置（百分比）：寬螢幕三欄由左到右；窄螢幕兩欄（左邊參數、右邊處理流程）
    const narrow = box.clientWidth < 560;
    const POS = narrow
      ? { rect: [3, 3], floors: [3, 36], twist: [3, 69], copy: [53, 3], rotate: [53, 36], loft: [53, 69] }
      : { rect: [5, 5], floors: [5, 38], twist: [5, 71], copy: [33, 16], rotate: [58, 40], loft: [80, 40] };
    const wires = {}; // 輸入埠 → 輸出節點
    let from = null, stage = 'wire';
    box.innerHTML = `<div class="tg-head"><span class="tg-step">先點節點右側的輸出點，再點另一個節點左側的輸入點</span></div>
      <div class="tg-graph ${narrow ? 'narrow' : ''}"><svg class="tg-wires" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>${data.nodes.map((n) => `
        <div class="tg-gnode" data-id="${n.id}" style="left:${POS[n.id][0]}%;top:${POS[n.id][1]}%">
          ${(n.in || []).map((p) => `<button type="button" class="tg-port in" data-port="${n.id}.${esc(p)}">${esc(p)}</button>`).join('')}
          <b>${esc(n.name)}</b>${n.desc ? `<small>${esc(n.desc)}</small>` : ''}
          <button type="button" class="tg-port out" data-out="${n.id}">${esc(n.out)} ▸</button>
        </div>`).join('')}</div>
      <div class="tg-tower" hidden><div class="tg-pair"><figure><canvas width="220" height="220"></canvas><figcaption>目標：扭轉 ${data.answer.twist}°</figcaption></figure><figure><canvas width="220" height="220"></canvas><figcaption>你的塔：<b class="tg-deg">0</b>°</figcaption></figure></div>
        <input type="range" min="0" max="180" step="1" value="0" aria-label="扭轉角度"></div>
      <div class="trial-actions"><button type="button" class="q-btn" data-a="clear">清除連線</button><button type="button" class="q-btn primary" data-a="check">檢查連線</button></div>
      <p class="tg-say"></p>`;
    const svg = box.querySelector('.tg-wires'), graph = box.querySelector('.tg-graph'), sayEl = box.querySelector('.tg-say');
    const portXY = (el) => { const g = graph.getBoundingClientRect(), r = el.getBoundingClientRect(); return [((r.left + r.width / 2) - g.left) / g.width * 100, ((r.top + r.height / 2) - g.top) / g.height * 100]; };
    function drawWires(marks = {}) {
      svg.innerHTML = Object.entries(wires).map(([port, out]) => {
        const a = portXY(box.querySelector(`[data-out="${out}"]`)), b = portXY(box.querySelector(`[data-port="${port}"]`));
        const mx = (a[0] + b[0]) / 2;
        return `<path class="${marks[port] === undefined ? '' : marks[port] ? 'ok' : 'bad'}" d="M${a[0]},${a[1]} C${mx},${a[1]} ${mx},${b[1]} ${b[0]},${b[1]}"/>`;
      }).join('');
    }
    graph.addEventListener('click', (e) => {
      if (stage !== 'wire') return;
      const o = e.target.closest('[data-out]'), i = e.target.closest('[data-port]');
      if (o) { from = o.dataset.out; graph.querySelectorAll('[data-out]').forEach((x) => x.classList.toggle('on', x === o)); say(sayEl, '再點要接上的輸入點。'); }
      else if (i && from) {
        if (i.dataset.port.split('.')[0] === from) { say(sayEl, '節點不能接到自己身上。', 'bad'); return; }
        wires[i.dataset.port] = from; from = null;
        graph.querySelectorAll('[data-out]').forEach((x) => x.classList.remove('on'));
        drawWires(); say(sayEl, `已接 ${Object.keys(wires).length} 條線。`);
      }
    });
    const ro = new ResizeObserver(() => drawWires()); ro.observe(graph);
    box.querySelector('[data-a="clear"]').addEventListener('click', () => { for (const k in wires) delete wires[k]; drawWires(); say(sayEl, '連線已清除。'); });
    // 扭轉塔：每層是一個方形，逐層旋轉，以等角視角畫出
    function tower(cv, deg) {
      const c = cv.getContext('2d'), W = cv.width, H = cv.height, N = 14;
      c.clearRect(0, 0, W, H);
      for (let k = 0; k < N; k++) {
        const a = deg / (N - 1) * k * Math.PI / 180, y = H - 30 - k * 11;
        c.beginPath();
        for (let q = 0; q < 4; q++) { const ang = a + q * Math.PI / 2 + Math.PI / 4, x = W / 2 + Math.cos(ang) * 50, yy = y + Math.sin(ang) * 22; q ? c.lineTo(x, yy) : c.moveTo(x, yy); }
        c.closePath(); c.fillStyle = `hsla(190, 60%, ${45 + k * 2.5}%, .55)`; c.fill(); c.strokeStyle = '#1f4f6f'; c.lineWidth = 1.2; c.stroke();
      }
    }
    const [cvT, cvM] = box.querySelectorAll('.tg-tower canvas'), slider = box.querySelector('input[type=range]');
    tower(cvT, data.answer.twist); tower(cvM, 0);
    slider.addEventListener('input', () => { box.querySelector('.tg-deg').textContent = slider.value; tower(cvM, +slider.value); });
    box.querySelector('[data-a="check"]').addEventListener('click', async (e) => {
      if (stage === 'wire') {
        const want = Object.fromEntries(data.answer.wires.map(([o, p]) => [p, o]));
        const marks = {}; let ok = 0;
        for (const p of Object.keys(wires)) { marks[p] = want[p] === wires[p]; ok += marks[p]; }
        drawWires(marks);
        if (ok === data.answer.wires.length && Object.keys(wires).length === ok) {
          say(sayEl, `連線全對！${data.why} 現在拉動滑桿，讓塔的扭轉角度符合目標。`, 'ok');
          stage = 'twist'; box.querySelector('.tg-tower').hidden = false; e.currentTarget.textContent = '確認角度';
          box.querySelector('[data-a="clear"]').hidden = true;
        } else say(sayEl, `接對 ${ok} 條，還需要 ${data.answer.wires.length} 條。紅線接錯了，按「清除連線」或重接該輸入點。`, 'bad');
      } else {
        const d = Math.abs(+slider.value - data.answer.twist);
        if (d <= data.answer.tolerance) { say(sayEl, '扭轉角度吻合！改一個參數，整座塔就跟著變。', 'ok'); await sleep(2200); win(); }
        else say(sayEl, `差了 ${d}°，再調整看看。`, 'bad');
      }
    });
    return () => ro.disconnect();
  });

  /* ───────── 陳念祖：教室空氣保衛戰（室內空氣品質、智慧控制）───────── */
  registerTrial('airflow', (box, data, { win }) => {
    // 模擬參數（遊戲化的時間尺度）：每人每秒增加的二氧化碳、各設備的換氣率與耗電
    const GEN = 0.9, MAXP = 30, BUDGET = 80;
    const DEV = [{ vent: 0.08, power: 2.4 }, { vent: 0.035, power: 0.8 }, { vent: 0, power: 0.4 }, { vent: 0, power: 0.4 }];
    const { co2: LIMIT, outdoor: OUT, seconds: DUR } = data.limits;
    let on = [false, false, false, false], co2, used, t, raf = 0, last = 0, running = false;
    box.innerHTML = `<div class="tg-head"><span class="tg-step">剩餘 <b class="tg-time"></b> 秒</span><b>教室人數 <span class="tg-people"></span></b></div>
      <div class="tg-meters">
        <div><span>二氧化碳</span><div class="tg-meter co2"><i></i><em style="left:${(LIMIT - 400) / 1000 * 100}%"></em></div><b class="tg-co2"></b></div>
        <div><span>耗電</span><div class="tg-meter energy"><i></i></div><b class="tg-energy"></b></div>
      </div>
      <canvas class="tg-room" width="480" height="220"></canvas>
      <div class="tg-devices">${data.devices.map((d, i) => `<button type="button" data-d="${i}" aria-pressed="false"><b>${esc(d.name)}</b><small>耗電：${esc(d.energy)}</small></button>`).join('')}</div>
      <div class="trial-actions"><button type="button" class="q-btn primary" data-a="go">開始上課</button></div>
      <p class="tg-say"></p>`;
    const q = (s) => box.querySelector(s), sayEl = q('.tg-say'), cv = q('.tg-room'), c = cv.getContext('2d');
    // 重新開始只重設濃度、耗電與時間；玩家事先選好的設備保持開著
    function reset() { co2 = 600; used = 0; t = 0; renderDevices(); draw(); }
    function renderDevices() { box.querySelectorAll('[data-d]').forEach((b, i) => { b.classList.toggle('on', on[i]); b.setAttribute('aria-pressed', String(on[i])); }); }
    const people = () => Math.min(MAXP, Math.floor(t / 16 * MAXP));
    function draw() {
      const W = cv.width, H = cv.height, P = people();
      c.fillStyle = '#f4ecdc'; c.fillRect(0, 0, W, H);
      c.strokeStyle = '#6b5a42'; c.lineWidth = 6; c.strokeRect(3, 3, W - 6, H - 6);
      c.fillStyle = on[0] ? '#9fd8ff' : '#6b5a42'; for (let k = 0; k < 3; k++) c.fillRect(70 + k * 140, 0, 70, 7);
      if (on[0]) { c.fillStyle = 'rgba(159,216,255,.35)'; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(70 + k * 140, 7); c.lineTo(140 + k * 140, 7); c.lineTo(150 + k * 140, 60); c.lineTo(60 + k * 140, 60); c.fill(); } }
      c.fillStyle = on[1] ? '#7dffb0' : '#bbb'; c.fillRect(W - 46, H - 40, 34, 26);
      c.fillStyle = on[2] ? '#ffd36b' : '#bbb'; c.beginPath(); c.arc(W / 2, H / 2, 14, 0, Math.PI * 2); c.fill();
      if (on[2]) { c.strokeStyle = '#c99a2e'; c.lineWidth = 3; const a = performance.now() / 120; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(W / 2, H / 2); c.lineTo(W / 2 + Math.cos(a + k * 2.1) * 26, H / 2 + Math.sin(a + k * 2.1) * 26); c.stroke(); } }
      c.fillStyle = on[3] ? '#c3adff' : '#bbb'; c.fillRect(14, H - 40, 26, 30);
      for (let k = 0; k < P; k++) { const x = 70 + (k % 10) * 36, y = 70 + Math.floor(k / 10) * 46; c.fillStyle = '#c9a06a'; c.fillRect(x - 12, y + 10, 24, 8); c.fillStyle = ['#3a8ee6', '#e5484d', '#46b35b', '#f28c28'][k % 4]; c.beginPath(); c.arc(x, y, 8, 0, Math.PI * 2); c.fill(); }
      const ratio = Math.min(1, Math.max(0, (co2 - 400) / 1000));
      c.fillStyle = `rgba(120, 90, 160, ${ratio * 0.35})`; c.fillRect(0, 0, W, H);
      q('.tg-time').textContent = Math.max(0, Math.ceil(DUR - t));
      q('.tg-people').textContent = P;
      q('.tg-co2').textContent = `${Math.round(co2)} ppm`;
      q('.tg-energy').textContent = `${Math.round(used)} / ${BUDGET}`;
      const m = q('.tg-meter.co2 i'); m.style.width = `${ratio * 100}%`; m.classList.toggle('warn', co2 > LIMIT * 0.9);
      q('.tg-meter.energy i').style.width = `${Math.min(100, used / BUDGET * 100)}%`;
    }
    function step(now) {
      if (!running) return;
      const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt;
      const vent = DEV.reduce((s, d, i) => s + (on[i] ? d.vent : 0), 0);
      co2 += (GEN * people() - vent * (co2 - OUT)) * dt;
      used += DEV.reduce((s, d, i) => s + (on[i] ? d.power : 0), 0) * dt;
      draw();
      if (co2 > LIMIT) return end(`二氧化碳超過 ${LIMIT} ppm 了！同學開始打瞌睡……再試一次。`);
      if (used > BUDGET) return end('耗電超過預算了！試著只在需要時開窗。');
      if (t >= DUR) { running = false; say(sayEl, `成功！整堂課都維持在 ${LIMIT} ppm 以下。${data.answer}`, 'ok'); setTimeout(win, 3600); return; }
      raf = requestAnimationFrame(step);
    }
    function end(msg) { running = false; say(sayEl, msg, 'bad'); q('[data-a="go"]').hidden = false; q('[data-a="go"]').textContent = '重新開始'; }
    box.querySelector('.tg-devices').addEventListener('click', (e) => {
      const b = e.target.closest('[data-d]'); if (!b) return;
      const i = +b.dataset.d; on[i] = !on[i]; renderDevices(); draw();
      if (on[i]) say(sayEl, data.devices[i].note, DEV[i].vent ? '' : 'hint');
    });
    q('[data-a="go"]').addEventListener('click', (e) => {
      reset(); running = true; e.currentTarget.hidden = true; last = performance.now();
      say(sayEl, '學生陸續進教室了，注意二氧化碳！');
      raf = requestAnimationFrame(step);
    });
    reset(); say(sayEl, '先想想要開哪些設備，再按「開始上課」。上課中也可以隨時開關。');
    return () => { running = false; cancelAnimationFrame(raf); };
  });

  /* ───────── 黃琨智：循環輸送帶（循環設計、建材環境性能）───────── */
  registerTrial('sorting', (box, data, { win }) => {
    // 題目流程：材料分類穿插二選一，答錯的會排回隊伍後面再出一次
    const queue = [];
    shuffle(data.items).forEach((it, i) => { queue.push({ type: 'item', it }); if (i % 3 === 2 && data.choices[(i - 2) / 3]) queue.push({ type: 'choice', it: data.choices[(i - 2) / 3] }); });
    const total = queue.length;
    let done = 0, cur = null, lock = false;
    box.innerHTML = `<div class="tg-head"><span class="tg-step"></span><b>完成 <span class="tg-done"></span></b></div>
      <div class="tg-belt"><div class="tg-crate"></div></div>
      <div class="tg-bins"></div>
      <p class="tg-say"></p>`;
    const q = (s) => box.querySelector(s), crate = q('.tg-crate'), bins = q('.tg-bins'), sayEl = q('.tg-say');
    function next() {
      q('.tg-done').textContent = `${done} / ${total}`;
      if (!queue.length) { say(sayEl, '全部送到正確的去處了！', 'ok'); setTimeout(win, 1800); return; }
      cur = queue.shift(); lock = false;
      crate.classList.remove('in'); void crate.offsetWidth; crate.classList.add('in');
      if (cur.type === 'item') {
        q('.tg-step').textContent = '這個材料該送去哪裡？';
        crate.innerHTML = `<b>${esc(cur.it.name)}</b>`;
        bins.innerHTML = data.bins.map((b, i) => `<button type="button" data-v="${esc(b)}"><span>${i + 1}</span>${esc(b)}</button>`).join('');
      } else {
        q('.tg-step').textContent = '環境性能二選一';
        crate.innerHTML = `<b>${esc(cur.it.ask)}</b>`;
        bins.innerHTML = cur.it.options.map((o, i) => `<button type="button" data-v="${esc(o)}"><span>${i + 1}</span>${esc(o)}</button>`).join('');
      }
    }
    async function answer(v) {
      if (lock || !cur) return; lock = true;
      const it = cur.it, ok = v === it.answer;
      bins.querySelectorAll('button').forEach((b) => { if (b.dataset.v === it.answer) b.classList.add('ok'); else if (b.dataset.v === v) b.classList.add('bad'); });
      if (ok) { done++; say(sayEl, `正確！${it.why}`, 'ok'); }
      else { queue.push(cur); say(sayEl, `應該是「${it.answer}」。${it.why}（稍後會再出一次）`, 'bad'); }
      await sleep(ok ? 2000 : 3200);
      next();
    }
    bins.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) answer(b.dataset.v); });
    const onKey = (e) => { const n = +e.key; if (n >= 1 && n <= 3) { const b = bins.querySelectorAll('button')[n - 1]; if (b) answer(b.dataset.v); } };
    window.addEventListener('keydown', onKey);
    next();
    return () => window.removeEventListener('keydown', onKey);
  });

  /* ───────── 江博鴻：一層一層印上去（數位製造）───────── */
  registerTrial('stack', (box, data, { win }) => {
    const GOAL = data.goal.layers, W = 360, H = 400, LH = 22, MIN_W = 14;
    let layers, cur, dir, speed, raf = 0, alive = true, over = false, last = 0;
    box.innerHTML = `<div class="tg-head"><span class="tg-step">點一下畫面（或按空白鍵）鋪下一層</span><b>層數 <span class="tg-layers"></span> / ${GOAL}</b></div>
      <canvas class="tg-stack" width="${W}" height="${H}" tabindex="0" aria-label="3D 列印疊層"></canvas>
      <div class="trial-actions"><button type="button" class="q-btn" data-a="retry" hidden>重新列印</button></div>
      <p class="tg-say"></p>`;
    const cv = box.querySelector('canvas'), c = cv.getContext('2d'), sayEl = box.querySelector('.tg-say'), retry = box.querySelector('[data-a="retry"]');
    function reset() {
      layers = [{ x: W / 2 - 70, w: 140 }]; dir = 1; speed = 150; over = false;
      cur = { x: 0, w: 140 }; retry.hidden = true; say(sayEl, '噴頭左右移動，對準下面那一層時按下。');
      box.querySelector('.tg-layers').textContent = 0;
    }
    function draw() {
      c.fillStyle = '#22303f'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#5a5f69'; c.fillRect(0, H - 18, W, 18); // 列印平台
      const shift = Math.max(0, layers.length - 13) * LH; // 疊高後畫面往下捲
      layers.forEach((L, i) => {
        const y = H - 18 - (i + 1) * LH + shift;
        c.fillStyle = i === 0 ? '#8a8f9b' : `hsl(${24 + i * 2}, 85%, ${52 + (i % 2) * 6}%)`;
        c.fillRect(L.x, y, L.w, LH - 2);
      });
      if (!over) {
        const y = H - 18 - (layers.length + 1) * LH + shift;
        c.fillStyle = 'rgba(255, 200, 120, .9)'; c.fillRect(cur.x, y, cur.w, LH - 2);
        c.fillStyle = '#c9ccd1'; c.fillRect(cur.x + cur.w / 2 - 10, y - 26, 20, 18); // 噴頭
        c.fillStyle = '#e5484d'; c.beginPath(); c.moveTo(cur.x + cur.w / 2 - 6, y - 8); c.lineTo(cur.x + cur.w / 2 + 6, y - 8); c.lineTo(cur.x + cur.w / 2, y - 2); c.fill();
      }
    }
    function loop(now) {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!over) {
        cur.x += dir * speed * dt;
        if (cur.x + cur.w > W) { cur.x = W - cur.w; dir = -1; }
        if (cur.x < 0) { cur.x = 0; dir = 1; }
      }
      draw(); cv.dataset.off = Math.round(cur.x - layers[layers.length - 1].x); // 給自動測試讀取
      raf = requestAnimationFrame(loop);
    }
    function drop() {
      if (over) return;
      const below = layers[layers.length - 1];
      const l = Math.max(cur.x, below.x), r = Math.min(cur.x + cur.w, below.x + below.w), w = r - l;
      if (w < MIN_W) { over = true; retry.hidden = false; say(sayEl, '這一層完全懸空，塌下來了！懸空的部分需要支撐。', 'bad'); return; }
      layers.push({ x: l, w });
      const n = layers.length - 1;
      box.querySelector('.tg-layers').textContent = n;
      if (n >= GOAL) { over = true; say(sayEl, '列印完成！一層一層堆疊，就是積層製造的原理。', 'ok'); setTimeout(() => alive && win(), 2200); return; }
      say(sayEl, w < cur.w - 2 ? `對齊偏了，懸空的 ${Math.round(cur.w - w)} 單位被裁掉。` : '完美對齊！', w < cur.w - 2 ? 'hint' : 'ok');
      cur = { x: dir > 0 ? 0 : W - w, w }; speed = Math.min(330, speed + 14);
    }
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); drop(); });
    const onKey = (e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); drop(); } };
    window.addEventListener('keydown', onKey);
    retry.addEventListener('click', reset);
    reset(); last = performance.now(); raf = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); };
  });

  /* ───────── 陳冠帆：站得住的木構架（實構築、木構造）───────── */
  registerTrial('bracing', (box, data, { win }) => {
    let lv = 0, braces, testing = false, raf = 0;
    box.innerHTML = `<div class="tg-head"><span class="tg-step"></span><b class="tg-ask"></b></div>
      <svg class="tg-frame" viewBox="0 0 360 300" role="group" aria-label="木構架"></svg>
      <div class="trial-actions"><button type="button" class="q-btn" data-a="clear">拆掉斜撐</button><button type="button" class="q-btn primary" data-a="wind">加風力</button></div>
      <p class="tg-say"></p>`;
    const svg = box.querySelector('svg'), sayEl = box.querySelector('.tg-say');
    const dims = () => { const m = data.levels[lv].frame.match(/(\d+)\s*跨\s*×\s*(\d+)\s*層/); return { cols: +m[1], rows: +m[2] }; };
    // sway：每層的側向位移（0 = 不動）
    function draw(sway = []) {
      const { cols, rows } = dims(), bw = Math.min(110, 260 / cols), bh = Math.min(110, 230 / rows);
      const x0 = 180 - cols * bw / 2, y0 = 270;
      const X = (c, r) => x0 + c * bw + (sway.slice(0, r).reduce((a, b) => a + b, 0)), Y = (r) => y0 - r * bh;
      let html = `<rect x="20" y="${y0}" width="320" height="14" class="tg-ground"/>`;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const k = `${c},${r}`, pts = [[X(c, r), Y(r)], [X(c + 1, r), Y(r)], [X(c + 1, r + 1), Y(r + 1)], [X(c, r + 1), Y(r + 1)]];
        html += `<polygon class="tg-bay ${braces.has(k) ? 'on' : ''}" data-k="${k}" points="${pts.map((p) => p.join(',')).join(' ')}" tabindex="0" role="button" aria-label="第 ${r + 1} 層第 ${c + 1} 跨"/>`;
        if (braces.has(k)) html += `<line class="tg-brace" x1="${pts[0][0]}" y1="${pts[0][1]}" x2="${pts[2][0]}" y2="${pts[2][1]}"/>`;
      }
      for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) html += `<line class="tg-post" x1="${X(c, r)}" y1="${Y(r)}" x2="${X(c, r + 1)}" y2="${Y(r + 1)}"/>`;
      for (let r = 1; r <= rows; r++) html += `<line class="tg-beam" x1="${X(0, r) - 8}" y1="${Y(r)}" x2="${X(cols, r) + 8}" y2="${Y(r)}"/>`;
      for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) html += `<circle class="tg-joint" cx="${X(c, r)}" cy="${Y(r)}" r="5"/>`;
      if (sway.length && sway.some((s) => s !== 0)) html += `<text x="330" y="40" class="tg-wind">→ 風</text>`;
      svg.innerHTML = html;
    }
    function show() {
      const L = data.levels[lv];
      braces = new Set(); testing = false;
      box.querySelector('.tg-step').textContent = `第 ${lv + 1} / ${data.levels.length} 關`;
      box.querySelector('.tg-ask').textContent = `${L.name}（${L.frame}）`;
      draw(); say(sayEl, '點格子放入或拿掉斜撐，再按「加風力」測試。');
    }
    function toggle(k) { if (testing) return; braces.has(k) ? braces.delete(k) : braces.add(k); draw(); }
    svg.addEventListener('click', (e) => { const p = e.target.closest('[data-k]'); if (p) toggle(p.dataset.k); });
    svg.addEventListener('keydown', (e) => { const p = e.target.closest('[data-k]'); if (p && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(p.dataset.k); } });
    box.querySelector('[data-a="clear"]').addEventListener('click', () => { if (!testing) { braces.clear(); draw(); } });
    box.querySelector('[data-a="wind"]').addEventListener('click', () => {
      if (testing) return;
      const L = data.levels[lv], { rows } = dims();
      // 梁把同一層各跨連成一體：每一層只要有一支斜撐就穩
      const stable = Array.from({ length: rows }, (_, r) => [...braces].some((k) => +k.split(',')[1] === r));
      testing = true;
      const t0 = performance.now();
      const anim = (now) => {
        const k = Math.min(1, (now - t0) / 1400);
        draw(stable.map((ok) => (ok ? Math.sin(k * Math.PI * 4) * 2 * (1 - k) : Math.sin(k * Math.PI / 2) * 38)));
        if (k < 1) { raf = requestAnimationFrame(anim); return; }
        testing = false;
        if (stable.every(Boolean)) {
          if (braces.size > L.minBraces) { say(sayEl, `站得住了！不過用了 ${braces.size} 支斜撐，其實最少只要 ${L.minBraces} 支。拿掉多餘的再試一次。`, 'hint'); draw(); return; }
          say(sayEl, `構架站穩了！${L.why}`, 'ok');
          setTimeout(() => { lv++; if (lv >= data.levels.length) win(); else show(); }, 2800);
        } else say(sayEl, '構架被風吹歪了！有一層還沒有抵抗側力的斜撐。', 'bad');
      };
      raf = requestAnimationFrame(anim);
    });
    show();
    return () => cancelAnimationFrame(raf);
  });

  /* ───────── 張怡棻：社區提案（社區總體營造、創新產業）───────── */
  registerTrial('matching', (box, data, { win }) => {
    const partners = shuffle(data.wishes.map((w) => w.best.partner));
    const places = shuffle([...new Set(data.wishes.flatMap((w) => [w.best.place, ...w.ok]))]);
    const MAX = data.wishes.length * 3, PASS = 12;
    box.innerHTML = `<div class="tg-head"><span class="tg-step">每個心願選一組夥伴和一個地點</span><b>過關門檻 ${PASS} / ${MAX} 分</b></div>
      <div class="tg-wishes">${data.wishes.map((w, i) => `
        <div class="tg-wish" data-i="${i}"><b>${esc(w.wish)}<small>社造面向：${esc(w.aspect)}</small></b>
          <label><span>夥伴</span><select data-f="partner"><option value="">請選擇</option>${partners.map((p) => `<option>${esc(p)}</option>`).join('')}</select></label>
          <label><span>地點</span><select data-f="place"><option value="">請選擇</option>${places.map((p) => `<option>${esc(p)}</option>`).join('')}</select></label>
          <p class="tg-wish-note"></p></div>`).join('')}</div>
      <div class="trial-actions"><button type="button" class="q-btn primary" data-a="submit">提交提案</button></div>
      <p class="tg-say"></p>`;
    const sayEl = box.querySelector('.tg-say');
    box.querySelector('[data-a="submit"]').addEventListener('click', async () => {
      let score = 0, blank = false;
      box.querySelectorAll('.tg-wish').forEach((el) => {
        const w = data.wishes[+el.dataset.i], pa = el.querySelector('[data-f="partner"]').value, pl = el.querySelector('[data-f="place"]').value;
        if (!pa || !pl) blank = true;
        let pts = 0, note = '';
        if (pa === w.best.partner && pl === w.best.place) { pts = 3; note = '最佳組合 +3'; }
        else if (pa === w.best.partner && w.ok.includes(pl)) { pts = 1; note = `可行 +1（最佳地點是「${w.best.place}」）`; }
        else note = pa !== w.best.partner ? `夥伴不太合適，建議「${w.best.partner}」` : '地點不太合適';
        score += pts;
        el.classList.remove('ok', 'mid', 'bad'); el.classList.add(pts === 3 ? 'ok' : pts ? 'mid' : 'bad');
        el.querySelector('.tg-wish-note').textContent = pa && pl ? note : '';
      });
      if (blank) { say(sayEl, '還有心願沒有配好夥伴或地點。', 'hint'); return; }
      if (score >= PASS) { say(sayEl, `提案通過！總分 ${score} / ${MAX}。`, 'ok'); await sleep(2600); win(); }
      else say(sayEl, `總分 ${score} / ${MAX}，還差一點。看看各心願的建議，調整後再提交。`, 'bad');
    });
    return () => {};
  });

  /* ───────── 許鹿麗：規劃一間店（商業空間、設計公司經營）───────── */
  registerTrial('storeplan', (box, data, { win }) => {
    // 店面平面上的位置（百分比，入口在下方中央）；顧客動線依序經過這些位置
    const SPOT = { '入口內側 2 公尺': [50, 78], '入口後的右手邊': [80, 58], '店的最深處': [50, 13], '沿牆面': [14, 40], '靠近出口': [24, 80] };
    const PATH = ['入口內側 2 公尺', '入口後的右手邊', '店的最深處', '沿牆面', '靠近出口'];
    const place = {}; let picked = null, walking = false, raf = 0;
    const cost = (n) => (data.items.find((i) => i.name === n) || { cost: 0 }).cost;
    const spent = () => Object.values(place).reduce((s, n) => s + cost(n), 0);
    box.innerHTML = `<div class="tg-head"><span class="tg-step">先點設施，再點店裡的位置</span><b>預算 <span class="tg-spent"></span></b></div>
      <div class="tg-palette">${data.items.map((it) => `<button type="button" data-item="${esc(it.name)}">${esc(it.name)}<small>${it.cost ? `花費 ${it.cost}` : '免費'}</small></button>`).join('')}</div>
      <div class="tg-shop"><span class="tg-door">入口</span>${data.slots.map((sl) => `<button type="button" class="tg-slot" data-slot="${esc(sl.slot)}" style="left:${SPOT[sl.slot][0]}%;top:${SPOT[sl.slot][1]}%"><small>${esc(sl.slot)}</small><b>空位</b></button>`).join('')}<i class="tg-shopper" hidden></i></div>
      <div class="trial-actions"><button type="button" class="q-btn primary" data-a="open">開店</button></div>
      <p class="tg-say"></p>`;
    const q = (s) => box.querySelector(s), sayEl = q('.tg-say'), shopper = q('.tg-shopper');
    function render() {
      q('.tg-spent').textContent = `${spent()} / ${data.budget}`;
      q('.tg-spent').classList.toggle('over', spent() > data.budget);
      box.querySelectorAll('[data-item]').forEach((b) => b.classList.toggle('on', b.dataset.item === picked));
      box.querySelectorAll('.tg-slot').forEach((b) => { const n = place[b.dataset.slot]; b.querySelector('b').textContent = n || '空位'; b.classList.toggle('filled', !!n); b.classList.remove('ok', 'bad'); });
    }
    q('.tg-palette').addEventListener('click', (e) => { const b = e.target.closest('[data-item]'); if (!b || walking) return; picked = picked === b.dataset.item ? null : b.dataset.item; render(); });
    q('.tg-shop').addEventListener('click', (e) => {
      const b = e.target.closest('.tg-slot'); if (!b || walking) return;
      const k = b.dataset.slot;
      if (picked) { for (const s in place) if (place[s] === picked) delete place[s]; place[k] = picked; picked = null; }
      else delete place[k];
      render();
    });
    q('[data-a="open"]').addEventListener('click', () => {
      if (walking) return;
      if (data.slots.some((sl) => !place[sl.slot])) { say(sayEl, '五個位置都要放設施才能開店。', 'hint'); return; }
      if (spent() > data.budget) { say(sayEl, `超出預算 ${spent() - data.budget}！換掉比較貴又不必要的設施。`, 'bad'); return; }
      walking = true; shopper.hidden = false;
      const pts = [[50, 100], ...PATH.map((p) => SPOT[p]), [50, 100]];
      const t0 = performance.now(), dur = 4200;
      const anim = (now) => {
        const k = Math.min(1, (now - t0) / dur), f = k * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), u = f - i;
        shopper.style.left = `${pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u}%`; shopper.style.top = `${pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u}%`;
        if (k < 1) { raf = requestAnimationFrame(anim); return; }
        walking = false; shopper.hidden = true;
        let ok = 0; const tips = [];
        data.slots.forEach((sl) => {
          const good = place[sl.slot] === sl.best, b = q(`.tg-slot[data-slot="${sl.slot}"]`);
          b.classList.add(good ? 'ok' : 'bad'); ok += good;
          if (!good) tips.push(`「${sl.slot}」適合放${sl.best}：${sl.why}`);
        });
        if (ok === data.slots.length) { say(sayEl, '客人逛完整間店才走到櫃台結帳，動線完美！', 'ok'); setTimeout(win, 2600); }
        else say(sayEl, `${ok} / ${data.slots.length} 個位置放對。${tips[0]}`, 'bad');
      };
      raf = requestAnimationFrame(anim);
    });
    render(); say(sayEl, '顧客會從入口進來，照動線逛完全店，最後在櫃台結帳。');
    return () => cancelAnimationFrame(raf);
  });

  /* ───────── 連棠琁：品牌一致性檢查（品牌形象與永續）───────── */
  registerTrial('spotbrand', (box, data, { win }) => {
    const COL = (data.spec.color.match(/#[0-9a-f]{6}/i) || ['#e05d8c'])[0];
    let left = 60, timer = 0, found = new Set(), phase = 'spot';
    const wrong = data.applications.filter((a) => !a.ok).map((a) => a.name);
    // 用 canvas 畫出各應用的示意圖，錯誤處依資料的 error 描述呈現
    function logo(c, x, y, r, { color = COL, stretch = 1 } = {}) {
      c.save(); c.translate(x, y); c.scale(stretch, 1);
      c.strokeStyle = color; c.lineWidth = r * 0.22; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
      c.fillStyle = color; c.fillRect(-r * 0.45, -r * 0.5, r * 0.3, r); c.fillRect(r * 0.15, -r * 0.5, r * 0.3, r);
      c.restore();
    }
    function word(c, x, y, size, { color = '#2c2216', hand = false } = {}) {
      c.fillStyle = color; c.font = hand ? `italic ${size}px "LXGW WenKai TC", cursive` : `900 ${size}px "Noto Sans TC", sans-serif`;
      c.textAlign = 'center'; c.fillText(hand ? 'Tut · Id' : 'TUT · ID', x, y);
    }
    function paint(cv, app) {
      const c = cv.getContext('2d'), W = cv.width, H = cv.height, e = app.error || '';
      const color = /橘/.test(e) ? '#f28c28' : COL, stretch = /拉長|變形/.test(e) ? 1.9 : 1, hand = /字體|手寫/.test(e);
      c.fillStyle = '#f7f2e8'; c.fillRect(0, 0, W, H);
      const n = app.name;
      if (/招牌/.test(n)) { c.fillStyle = '#3a2a1e'; c.fillRect(20, 40, W - 40, H - 80); c.fillStyle = '#fff'; c.fillRect(30, 50, W - 60, H - 100); logo(c, W * 0.32, H / 2, 24, { color, stretch }); word(c, W * 0.66, H / 2 + 8, 22, { color, hand }); }
      else if (/袋/.test(n)) { c.fillStyle = color; c.fillRect(W / 2 - 45, 30, 90, H - 50); c.strokeStyle = '#2c2216'; c.lineWidth = 3; c.beginPath(); c.arc(W / 2, 32, 22, Math.PI, 0); c.stroke(); logo(c, W / 2, H / 2, 22, { color: '#fff', stretch }); word(c, W / 2, H - 34, 14, { color: '#fff', hand }); }
      else if (/網站/.test(n)) { c.fillStyle = '#fff'; c.fillRect(14, 16, W - 28, H - 32); c.fillStyle = '#ddd'; c.fillRect(14, 16, W - 28, 14); c.fillStyle = color; c.fillRect(14, 30, W - 28, 30); logo(c, 40, 45, 10, { color: '#fff', stretch }); word(c, W / 2, H / 2 + 22, 22, { color, hand }); c.fillStyle = '#ccc'; c.fillRect(40, H - 46, W - 80, 6); c.fillRect(40, H - 34, W - 120, 6); }
      else if (/識別證/.test(n)) { c.fillStyle = '#fff'; c.fillRect(W / 2 - 50, 14, 100, H - 28); c.fillStyle = color; c.fillRect(W / 2 - 50, 14, 100, 26); logo(c, W / 2, 70, 16, { color, stretch }); word(c, W / 2, H - 34, 14, { color, hand }); }
      else { c.fillStyle = '#fff'; c.fillRect(20, 30, W - 40, H - 60); c.fillStyle = color; c.fillRect(20, H - 44, W - 40, 14); logo(c, 60, H / 2 - 6, 18, { color, stretch }); word(c, W * 0.62, H / 2, 18, { color, hand }); }
    }
    box.innerHTML = `<div class="tg-head"><span class="tg-step">剩餘 <b class="tg-left"></b> 秒・找出 ${wrong.length} 個錯誤</span><b>已找到 <span class="tg-found">0</span> / ${wrong.length}</b></div>
      <div class="tg-spec"><canvas width="90" height="90"></canvas><ul><li>${esc(data.spec.mark)}</li><li>${esc(data.spec.color)}</li><li>${esc(data.spec.type)}</li></ul></div>
      <div class="tg-apps">${data.applications.map((a, i) => `<button type="button" class="tg-app" data-i="${i}"><canvas width="200" height="150"></canvas><span>${esc(a.name)}</span></button>`).join('')}</div>
      <div class="tg-pack" hidden><b>${esc(data.packaging.ask)}</b><div class="tg-bins">${data.packaging.options.map((o) => `<button type="button" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div></div>
      <p class="tg-say"></p>`;
    const q = (s) => box.querySelector(s), sayEl = q('.tg-say');
    const specCv = q('.tg-spec canvas'), sc = specCv.getContext('2d'); sc.fillStyle = '#fff'; sc.fillRect(0, 0, 90, 90); logo(sc, 45, 45, 28);
    box.querySelectorAll('.tg-app').forEach((b) => paint(b.querySelector('canvas'), data.applications[+b.dataset.i]));
    function tick() {
      left -= 1; q('.tg-left').textContent = Math.max(0, left);
      if (left <= 0) {
        clearInterval(timer);
        wrong.forEach((n) => { const b = [...box.querySelectorAll('.tg-app')].find((x) => data.applications[+x.dataset.i].name === n); if (!found.has(n)) b.classList.add('missed'); });
        say(sayEl, '時間到！虛線框的是沒找到的錯誤。按任一應用重新開始。', 'bad'); phase = 'timeout';
      }
    }
    function start() { left = 60; found = new Set(); phase = 'spot'; box.querySelectorAll('.tg-app').forEach((b) => b.classList.remove('ok', 'bad', 'missed')); q('.tg-found').textContent = 0; q('.tg-left').textContent = left; clearInterval(timer); timer = setInterval(tick, 1000); say(sayEl, '仔細比對標誌形狀、顏色與字體。'); }
    q('.tg-apps').addEventListener('click', async (e) => {
      const b = e.target.closest('.tg-app'); if (!b) return;
      if (phase === 'timeout') { start(); return; }
      if (phase !== 'spot') return;
      const a = data.applications[+b.dataset.i];
      if (a.ok) { b.classList.add('bad'); setTimeout(() => b.classList.remove('bad'), 700); left = Math.max(1, left - 5); say(sayEl, `「${a.name}」符合規範喔，扣 5 秒。`, 'bad'); return; }
      if (found.has(a.name)) return;
      found.add(a.name); b.classList.add('ok'); q('.tg-found').textContent = found.size;
      say(sayEl, `找到了！${a.name}：${a.error}`, 'ok');
      if (found.size === wrong.length) {
        clearInterval(timer); phase = 'pack';
        await sleep(1600); q('.tg-pack').hidden = false; say(sayEl, '最後一題：選出最永續的包裝。');
      }
    });
    q('.tg-pack').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-v]'); if (!b || phase !== 'pack') return;
      const p = data.packaging;
      if (b.dataset.v === p.answer) { b.classList.add('ok'); phase = 'done'; say(sayEl, `正確！${p.why}`, 'ok'); await sleep(2600); win(); }
      else { b.classList.add('bad'); say(sayEl, '這個方案的環境負擔比較高，再想想。', 'bad'); }
    });
    start();
    return () => clearInterval(timer);
  });

  /* ───────── 吳宛蓉：風格情緒板（室內美學與風格）───────── */
  registerTrial('moodboard', (box, data, { win }) => {
    const CATS = [['furniture', '家具'], ['material', '材質'], ['color', '色彩'], ['light', '燈光']];
    // 每個選項在情緒板上的示意（色塊、紋理、剪影）
    const SW = {
      '白與淺灰': ['#f4f4f2', '#c9cbcf'], '灰、黑與鏽紅': ['#6d6a68', '#1f1f22', '#8a3b2a'], '米白與原木色': ['#efe6d2', '#b88a5a'], '墨綠與金': ['#1f4a3c', '#c9a227'],
      '淺色橡木': '#d8b98f', '清水模與黑鐵': '#8d8b88', '原木、和紙與藺草': '#c9b98a', '大理石與金屬': '#ece8e2'
    };
    function tile(c, x, y, w, h, cat, v) {
      c.fillStyle = '#fff'; c.fillRect(x, y, w, h);
      if (!v) { c.strokeStyle = '#d9c49a'; c.setLineDash([5, 4]); c.strokeRect(x + 4, y + 4, w - 8, h - 8); c.setLineDash([]); return; }
      if (cat === 'color') { const cs = SW[v]; cs.forEach((col, i) => { c.fillStyle = col; c.fillRect(x + i * w / cs.length, y, w / cs.length, h); }); }
      else if (cat === 'material') {
        c.fillStyle = SW[v]; c.fillRect(x, y, w, h); c.strokeStyle = 'rgba(0,0,0,.18)';
        for (let k = 0; k < 8; k++) { c.beginPath(); if (/橡木|原木/.test(v)) { c.moveTo(x + k * w / 8, y); c.quadraticCurveTo(x + k * w / 8 + 8, y + h / 2, x + k * w / 8, y + h); } else if (/大理石/.test(v)) { c.moveTo(x, y + k * h / 8); c.quadraticCurveTo(x + w / 2, y + k * h / 8 + 14, x + w, y + k * h / 8 - 6); } else { c.moveTo(x + (k * 37) % w, y + (k * 23) % h); c.lineTo(x + (k * 37) % w + 2, y + (k * 23) % h + 2); } c.stroke(); }
        if (/黑鐵/.test(v)) { c.fillStyle = '#1f1f22'; c.fillRect(x, y + h - 14, w, 14); }
        if (/金屬/.test(v)) { c.fillStyle = '#c9a227'; c.fillRect(x, y + h - 10, w, 10); }
      } else if (cat === 'furniture') {
        c.fillStyle = '#f3ede2'; c.fillRect(x, y, w, h); const cx = x + w / 2, by = y + h - 18;
        if (/布面/.test(v)) { c.fillStyle = '#c9cbcf'; c.beginPath(); c.roundRect(cx - 42, by - 30, 84, 26, 6); c.fill(); c.fillStyle = '#b08a5a'; c.fillRect(cx - 36, by - 4, 3, 10); c.fillRect(cx + 33, by - 4, 3, 10); }
        else if (/皮革/.test(v)) { c.fillStyle = '#6b3a22'; c.fillRect(cx - 40, by - 30, 80, 30); c.fillStyle = '#1f1f22'; c.fillRect(x + 8, y + 10, 4, h - 28); c.fillRect(x + 8, y + 22, 24, 3); c.fillRect(x + 8, y + 40, 24, 3); }
        else if (/低矮/.test(v)) { c.fillStyle = '#b88a5a'; c.fillRect(cx - 44, by - 10, 88, 12); c.fillRect(cx - 34, by - 18, 68, 8); }
        else { c.fillStyle = '#1f4a3c'; c.beginPath(); c.roundRect(cx - 44, by - 34, 88, 30, 14); c.fill(); c.fillStyle = '#ece8e2'; c.fillRect(cx - 22, by, 44, 6); }
      } else {
        c.fillStyle = '#2c2a28'; c.fillRect(x, y, w, h); const cx = x + w / 2;
        if (/自然光/.test(v)) { c.fillStyle = '#fff8e0'; c.fillRect(x + 12, y + 10, w - 24, h - 20); c.strokeStyle = '#ddd'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx, y + 10); c.lineTo(cx, y + h - 10); c.stroke(); c.lineWidth = 1; }
        else if (/裸燈泡/.test(v)) { for (let k = 0; k < 3; k++) { const lx = x + 20 + k * (w - 40) / 2; c.strokeStyle = '#888'; c.beginPath(); c.moveTo(lx, y); c.lineTo(lx, y + h / 2); c.stroke(); c.fillStyle = '#ffd36b'; c.beginPath(); c.arc(lx, y + h / 2 + 6, 7, 0, Math.PI * 2); c.fill(); } }
        else if (/紙燈罩/.test(v)) { c.fillStyle = 'rgba(255,240,200,.3)'; c.beginPath(); c.arc(cx, y + h / 2, h * 0.45, 0, Math.PI * 2); c.fill(); c.fillStyle = '#fff6dc'; c.beginPath(); c.ellipse(cx, y + h / 2, 18, 22, 0, 0, Math.PI * 2); c.fill(); }
        else { c.fillStyle = '#c9a227'; c.fillRect(cx - 26, y + 14, 52, 5); for (let k = 0; k < 5; k++) { c.fillStyle = '#fff4c8'; c.beginPath(); c.arc(cx - 24 + k * 12, y + 30, 4, 0, Math.PI * 2); c.fill(); } }
      }
    }
    let round = 0; const pick = {};
    box.innerHTML = `<div class="tg-head"><span class="tg-step"></span><b class="tg-ask"></b></div>
      <canvas class="tg-board" width="480" height="300"></canvas>
      <div class="tg-cats">${CATS.map(([k, n]) => `<div class="tg-cat" data-k="${k}"><b>${n}</b>${data.options[k].map((o) => `<button type="button" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`).join('')}</div>
      <div class="trial-actions"><button type="button" class="q-btn primary" data-a="done">完成情緒板</button></div>
      <p class="tg-say"></p>`;
    const cv = box.querySelector('.tg-board'), c = cv.getContext('2d'), sayEl = box.querySelector('.tg-say');
    function board() {
      c.fillStyle = '#efe6d2'; c.fillRect(0, 0, 480, 300);
      const L = [[16, 16, 270, 160, 'furniture'], [298, 16, 166, 160, 'light'], [16, 188, 220, 96, 'material'], [248, 188, 216, 96, 'color']];
      L.forEach(([x, y, w, h, k]) => { c.save(); c.shadowColor = 'rgba(0,0,0,.2)'; c.shadowBlur = 6; c.shadowOffsetY = 2; tile(c, x, y, w, h, k, pick[k]); c.restore(); });
    }
    function show() {
      const r = data.rounds[round];
      box.querySelector('.tg-step').textContent = `第 ${round + 1} / ${data.rounds.length} 回合`;
      box.querySelector('.tg-ask').textContent = `主題：${r.style}`;
      for (const [k] of CATS) delete pick[k];
      box.querySelectorAll('.tg-cat button').forEach((b) => b.classList.remove('on', 'ok', 'bad'));
      board(); say(sayEl, `為「${r.style}」挑出最協調的家具、材質、色彩與燈光。`);
    }
    box.querySelector('.tg-cats').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const cat = b.closest('.tg-cat');
      cat.querySelectorAll('button').forEach((x) => { x.classList.toggle('on', x === b); x.classList.remove('ok', 'bad'); });
      pick[cat.dataset.k] = b.dataset.v; board();
    });
    box.querySelector('[data-a="done"]').addEventListener('click', async () => {
      if (CATS.some(([k]) => !pick[k])) { say(sayEl, '每一類都要挑一個喔。', 'hint'); return; }
      const r = data.rounds[round]; let hit = 0;
      for (const [k] of CATS) { const ok = pick[k] === r.answer[k]; hit += ok; box.querySelector(`.tg-cat[data-k="${k}"] button.on`).classList.add(ok ? 'ok' : 'bad'); }
      if (hit === 4) {
        say(sayEl, `協調度 100%！${r.why}`, 'ok'); await sleep(2800); round++;
        if (round >= data.rounds.length) win(); else show();
      } else say(sayEl, `協調度 ${hit * 25}%。紅色的元素和「${r.style}」不太搭，換一個試試。`, 'bad');
    });
    show();
    return () => {};
  });
}
