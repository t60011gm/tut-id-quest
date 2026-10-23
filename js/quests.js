/* =========================================================================
 * 南應大室研所大冒險 · 任務系統
 * 每位導師兩階段：
 *   第一階段（採集）：接任務後，該區採集場出現小怪；淨化小怪取得道具
 *   第二階段（試煉）：「○○老師的試煉」小遊戲，通關得到徽章與知識小卡
 * 任務內容在 data/quests.js；這裡只處理流程、3D 小怪與介面。
 * 小遊戲以 registerTrial(類型, 函式) 註冊；尚未註冊的試煉會顯示「製作中」。
 * ========================================================================= */
import * as THREE from 'three';

export const QUEST_KEY = 'tutIdQuest.quests.v1';
const GAMES = {};
/* 小遊戲註冊：fn(容器, 試煉資料, { win, fail, teacher }) 回傳清理函式（可省略） */
export function registerTrial(type, fn) { GAMES[type] = fn; }

const STAGE = { NEW: 0, COLLECT: 1, TRIAL: 2, DONE: 3 };
const DEV = new URLSearchParams(location.search).has('dev'); // ?dev 才會出現「直接通過」測試鈕

export function initQuests(api) {
  const { scene, $, esc, isTouch, heightAt, faculty, RG, FIELD_R, npcs, state, player, mat, sound } = api;
  const Q = window.QUESTS;
  const noop = () => {};
  if (!Q) return { update: noop, pick: () => false, interact: () => false, cardHTML: () => '', bindCard: noop, nearMonster: null };

  /* ---------- 進度存檔 ---------- */
  let save = { quick: false, t: {} };
  try { save = { ...save, ...JSON.parse(localStorage.getItem(QUEST_KEY) || '{}') }; } catch (e) { /* 讀不到就從頭開始 */ }
  const persist = () => { try { localStorage.setItem(QUEST_KEY, JSON.stringify(save)); } catch (e) { /* 忽略 */ } };
  const need = () => (save.quick ? Q.settings.quickCount : Q.settings.count);
  const st = (id) => save.t[id] || (save.t[id] = { stage: STAGE.NEW, got: 0 });
  const byId = Object.fromEntries(faculty.map((f) => [f.id, f]));
  const qOf = (f) => Q.teachers[f.id];
  const regionOf = (f) => RG[f.region] || RG.capital;
  const fieldOf = (f) => regionOf(f).field;

  /* ---------- 小怪模型：依 shape 組出可愛的造型 ---------- */
  const white = mat('#ffffff'), black = mat('#1d1a18');
  function eyes(g, y, z, s = 1) {
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.17 * s, 10, 8), white); e.position.set(sx * 0.24 * s, y, z); g.add(e);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.09 * s, 8, 6), black); p.position.set(sx * 0.24 * s, y, z + 0.12 * s); g.add(p);
    }
  }
  const SHAPES = {
    blob(g, c) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12), mat(c)); b.scale.y = 0.75; b.position.y = 0.62; g.add(b); eyes(g, 0.8, 0.68); return b; },
    cube(g, c) {
      const m = mat(c, { emissive: c, emissiveIntensity: 0.45 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), m); b.position.y = 0.9; g.add(b); eyes(g, 1.05, 0.56);
      for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), m); s.userData.orbit = k; g.add(s); }
      return b;
    },
    sprite(g, c) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), mat(c, { emissive: c, emissiveIntensity: 0.3 })); b.position.y = 1.6; g.add(b); eyes(g, 1.68, 0.46, 0.8);
      const wm = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, side: THREE.DoubleSide });
      for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), wm); w.position.set(sx * 0.6, 1.75, -0.1); w.userData.wing = sx; g.add(w); }
      return b;
    },
    cloud(g, c) {
      const m = mat(c, { transparent: true, opacity: 0.85 });
      const b = new THREE.Group(); b.position.y = 1.1; g.add(b);
      [[0, 0, 0, 0.75], [0.6, -0.1, 0, 0.55], [-0.6, -0.05, 0, 0.6], [0.1, 0.4, -0.1, 0.5]].forEach(([x, y, z, r]) => { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), m); s.position.set(x, y, z); b.add(s); });
      eyes(g, 1.15, 0.7);
      return b;
    },
    golem(g, c) {
      const m = mat(c);
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 0.9), m); b.position.y = 0.75; g.add(b);
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.65, 0.7), m); h.position.y = 1.65; g.add(h); eyes(g, 1.7, 0.36, 0.8);
      for (const sx of [-1, 1]) { const a = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), m); a.position.set(sx * 0.78, 0.75, 0); a.userData.arm = sx; g.add(a); }
      return b;
    },
    bug(g, c) {
      const m = mat(c);
      const b = new THREE.Group(); b.position.y = 0.45; g.add(b);
      [[0, 0, -0.55, 0.42], [0, 0.05, 0, 0.36], [0, 0.12, 0.5, 0.38]].forEach(([x, y, z, r]) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), m); s.position.set(x, y, z); b.add(s); });
      eyes(g, 0.72, 0.85, 0.7);
      for (const sx of [-1, 1]) {
        const an = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 4), black); an.position.set(sx * 0.15, 1.05, 0.75); an.rotation.set(0.6, 0, sx * -0.4); g.add(an);
        for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 4), black); l.position.set(sx * 0.42, 0.25, -0.35 + k * 0.4); l.rotation.z = sx * 0.9; l.userData.leg = k; g.add(l); }
      }
      return b;
    }
  };

  /* ---------- 採集場的小怪 ---------- */
  const monsters = [];
  const hits = [];
  function despawn(id) {
    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      if (m.id !== id) continue;
      scene.remove(m.group); hits.splice(hits.indexOf(m.hit), 1); monsters.splice(i, 1);
    }
  }
  function spawn(id) {
    despawn(id);
    const s = st(id), f = byId[id], q = Q.teachers[id], fd = fieldOf(f);
    if (s.stage !== STAGE.COLLECT || !fd) return;
    const n = Math.max(0, need() - s.got);
    for (let k = 0; k < n; k++) {
      const g = new THREE.Group();
      const body = (SHAPES[q.stage1.monster.shape] || SHAPES.blob)(g, q.stage1.monster.color || regionOf(f).color);
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * (FIELD_R - 3);
      const x = fd.x + Math.cos(a) * d, z = fd.z + Math.sin(a) * d;
      g.position.set(x, heightAt(x, z), z); scene.add(g);
      const hit = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 1; g.add(hit);
      const m = { id, f, q, group: g, body, hit, field: fd, ph: Math.random() * 6, goal: new THREE.Vector2(x, z), gone: -1 };
      hit.userData.monster = m;
      monsters.push(m); hits.push(hit);
    }
  }

  /* ---------- 介面元素 ---------- */
  const toastEl = $('#qtoast'), trackEl = $('#qtrack'), promptEl = $('#qprompt'), logEl = $('#quest-log');
  let toastTimer = 0;
  function toast(f, text, sub = '') {
    toastEl.style.setProperty('--region', regionOf(f).color);
    toastEl.innerHTML = `<b>${esc(f.name)}</b><span>${esc(text)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}`;
    toastEl.hidden = false; toastEl.classList.remove('show'); void toastEl.offsetWidth; toastEl.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, 5200);
  }
  const MARK = ['!', '…', '?', '★'];
  function refreshMarks() {
    for (const n of npcs) {
      if (!Q.teachers[n.f.id]) continue;
      let m = n.label.querySelector('.q-mark');
      if (!m) { m = document.createElement('span'); m.className = 'q-mark'; n.label.appendChild(m); }
      const s = st(n.f.id).stage;
      m.textContent = MARK[s]; m.dataset.stage = s;
    }
  }
  function refreshTracker() {
    const active = faculty.filter((f) => Q.teachers[f.id] && [STAGE.COLLECT, STAGE.TRIAL].includes(st(f.id).stage));
    trackEl.hidden = !active.length;
    trackEl.innerHTML = active.map((f) => {
      const s = st(f.id), q = qOf(f);
      const text = s.stage === STAGE.COLLECT ? `${q.stage1.item.name} ${s.got}/${need()}・${fieldOf(f).name}` : '回去接受試煉';
      return `<button type="button" data-t="${f.id}" style="--region:${regionOf(f).color}"><i></i><b>${esc(f.name)}</b><span>${esc(text)}</span></button>`;
    }).join('');
  }
  trackEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    const f = byId[b.dataset.t];
    if (st(f.id).stage === STAGE.COLLECT) goField(f); else api.selectTeacher(f);
  });

  function refreshAll() { persist(); refreshMarks(); refreshTracker(); renderLog(); }
  const allDone = () => faculty.filter((x) => Q.teachers[x.id]).every((x) => st(x.id).stage === STAGE.DONE);

  /* ---------- 前往採集場 ---------- */
  function goField(f) {
    const fd = fieldOf(f); if (!fd) return;
    api.closeCard(); api.closeCodexIfNarrow();
    const len = Math.hypot(fd.x, fd.z) || 1, ix = -fd.x / len, iz = -fd.z / len; // 朝島中心的方向
    if (state.mode === 'explore') {
      const ex = fd.x + ix * (FIELD_R + 3), ez = fd.z + iz * (FIELD_R + 3);
      api.teleport(ex, ez, Math.atan2(ix, iz));
    } else {
      const target = new THREE.Vector3(fd.x, heightAt(fd.x, fd.z) + 2, fd.z);
      api.flyTo({ target, pos: target.clone().add(new THREE.Vector3(ix * 26, 20, iz * 26)) });
    }
    toast(f, qOf(f).stage1.lines.hint, `採集場：${fd.name}`);
  }

  /* ---------- 導師卡上的任務區塊 ---------- */
  function cardHTML(f) {
    const q = qOf(f); if (!q) return '';
    const s = st(f.id), fd = fieldOf(f);
    let body = '';
    if (s.stage === STAGE.NEW) body = `<p class="q-line">「${esc(q.stage1.lines.accept)}」</p><button type="button" class="q-btn" data-q="accept">接受任務</button>`;
    else if (s.stage === STAGE.COLLECT) body = `<p>收集 <b>${esc(q.stage1.item.name)}</b> <span class="q-count">${s.got} / ${need()}</span>・淨化「${esc(q.stage1.monster.name)}」</p><p class="q-hint">${esc(q.stage1.lines.hint)}</p><button type="button" class="q-btn" data-q="go">前往${esc(fd.name)}</button>`;
    else if (s.stage === STAGE.TRIAL) body = `<p class="q-line">「${esc(q.stage1.lines.done)}」</p><button type="button" class="q-btn primary" data-q="trial">開始試煉</button>`;
    else body = `<p>已獲得徽章 <b class="q-badge-name">${esc(q.badge)}</b></p><button type="button" class="q-btn" data-q="trial">再挑戰一次試煉</button>`;
    return `<section class="sect quest"><h4>${esc(q.stage2.title.split('：')[0])}</h4>${body}</section>`;
  }
  function bindCard(sheet, f) {
    const sec = sheet.querySelector('.quest'); if (!sec) return;
    sec.addEventListener('click', (e) => {
      const b = e.target.closest('[data-q]'); if (!b) return;
      const s = st(f.id);
      if (b.dataset.q === 'accept') {
        s.stage = STAGE.COLLECT; s.got = 0; spawn(f.id); refreshAll();
        sound.sfx('card');
        const html = cardHTML(f); sec.outerHTML = html; bindCard(sheet, f);
        toast(f, qOf(f).stage1.lines.accept);
      } else if (b.dataset.q === 'go') goField(f);
      else if (b.dataset.q === 'trial') { api.closeCard(); openTrial(f); }
    });
  }

  /* ---------- 淨化小遊戲：縮小的光圈與目標圈重疊時按下 ---------- */
  const pf = $('#purify'), pfCanvas = pf.querySelector('canvas'), pfCtx = pfCanvas.getContext('2d');
  let qte = null;
  function startPurify(m) {
    if (qte || state.card) return;
    state.busy = true;
    qte = { m, t0: performance.now(), shake: 0, done: false, msg: '' };
    pf.style.setProperty('--region', regionOf(m.f).color);
    pf.querySelector('.pf-name').textContent = m.q.stage1.monster.name;
    pf.querySelector('.pf-msg').textContent = isTouch ? '光圈和目標圈重疊時，點一下！' : '光圈和目標圈重疊時，按空白鍵或點一下！';
    pf.hidden = false;
    requestAnimationFrame(drawPurify);
  }
  function endPurify() { qte = null; pf.hidden = true; state.busy = false; }
  const PF_R = 62, PF_TOL = 13, PF_DUR = 1500;
  const pfRadius = () => { const k = ((performance.now() - qte.t0) % PF_DUR) / PF_DUR; return 150 - k * 130; };
  function drawPurify() {
    if (!qte) return;
    const c = pfCtx, W = pfCanvas.width, H = pfCanvas.height, col = regionOf(qte.m.f).color;
    c.clearRect(0, 0, W, H);
    c.save(); c.translate(W / 2 + (qte.shake > 0 ? Math.sin(qte.shake * 60) * 6 : 0), H / 2);
    qte.shake = Math.max(0, qte.shake - 0.016);
    c.lineWidth = PF_TOL * 2; c.strokeStyle = 'rgba(255,255,255,0.12)'; c.beginPath(); c.arc(0, 0, PF_R, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 3; c.strokeStyle = col; c.beginPath(); c.arc(0, 0, PF_R, 0, Math.PI * 2); c.stroke();
    if (!qte.done) {
      const r = pfRadius(), close = Math.abs(r - PF_R) < PF_TOL;
      c.lineWidth = 5; c.strokeStyle = close ? '#ffd36b' : '#ffffff'; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
    } else {
      const k = Math.min(1, (performance.now() - qte.doneAt) / 500);
      c.globalAlpha = 1 - k; c.fillStyle = col; c.beginPath(); c.arc(0, 0, PF_R * (1 + k), 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
    }
    c.restore();
    requestAnimationFrame(drawPurify);
  }
  function pressPurify() {
    if (!qte || qte.done) return;
    if (Math.abs(pfRadius() - PF_R) < PF_TOL) {
      qte.done = true; qte.doneAt = performance.now();
      pf.querySelector('.pf-msg').textContent = '淨化成功！';
      sound.sfx('purify');
      const m = qte.m;
      setTimeout(() => { endPurify(); collect(m); }, 520);
    } else {
      qte.shake = 0.3; sound.sfx('miss');
      pf.querySelector('.pf-msg').textContent = '差一點！再試一次';
    }
  }
  pf.addEventListener('pointerdown', (e) => { if (e.target.closest('.pf-close')) return; e.preventDefault(); pressPurify(); });
  pf.querySelector('.pf-close').addEventListener('click', endPurify);

  function collect(m) {
    const s = st(m.id);
    m.gone = performance.now();
    s.got = Math.min(need(), s.got + 1);
    const q = m.q;
    if (s.got >= need()) {
      s.stage = STAGE.TRIAL;
      setTimeout(() => despawn(m.id), 700);
      toast(m.f, q.stage1.lines.done, `回到${m.f.name}老師身邊，接受試煉`);
    } else toast(m.f, `取得「${q.stage1.item.name}」`, `${s.got} / ${need()}`);
    refreshAll();
  }

  /* ---------- 試煉視窗 ---------- */
  const tr = $('#trial'), trBody = tr.querySelector('.trial-body');
  let trialCleanup = null, trialTeacher = null;
  function openTrial(f) {
    const q = qOf(f); if (!q) return;
    trialTeacher = f; state.busy = true; state.paused = true;
    tr.style.setProperty('--region', regionOf(f).color);
    tr.querySelector('.trial-title').textContent = q.stage2.title;
    trBody.innerHTML = `
      <p class="trial-intro">${esc(q.stage2.intro)}</p>
      <p class="trial-rules">${esc(q.stage2.rules)}</p>
      <div class="trial-actions"><button type="button" class="q-btn primary" data-tr="start">開始試煉</button></div>`;
    tr.hidden = false;
    trBody.querySelector('[data-tr="start"]').focus({ preventScroll: true });
  }
  function startGame() {
    const f = trialTeacher, q = qOf(f), game = GAMES[q.stage2.game];
    trBody.innerHTML = '<div class="trial-game"></div>';
    const box = trBody.querySelector('.trial-game');
    if (!game) {
      box.innerHTML = `<p class="trial-wip">這個試煉還在製作中，敬請期待！</p>
        <div class="trial-actions"><button type="button" class="q-btn" data-tr="close">先離開</button>${DEV ? '<button type="button" class="q-btn primary" data-tr="devwin">（測試）直接通過</button>' : ''}</div>`;
      return;
    }
    trialCleanup = game(box, q.stage2, { teacher: f, win: () => winTrial(), fail: () => {} }) || null;
  }
  function winTrial() {
    const f = trialTeacher, q = qOf(f), s = st(f.id);
    if (trialCleanup) { trialCleanup(); trialCleanup = null; }
    const first = s.stage !== STAGE.DONE;
    s.stage = STAGE.DONE; refreshAll();
    sound.sfx('visit');
    trBody.innerHTML = `
      <div class="trial-win">
        <div class="badge-medal big" style="--region:${regionOf(f).color}"><span>${esc(q.badge)}</span></div>
        <h3>${first ? '試煉通過！獲得徽章' : '再次通過試煉！'}</h3>
        <p class="trial-intro">「${esc(q.stage2.win)}」</p>
        <div class="knowledge"><h4>知識小卡：${esc(q.stage2.knowledge.title)}</h4><ul>${q.stage2.knowledge.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>
        <div class="trial-actions">${allDone() ? '<button type="button" class="q-btn primary" data-tr="cert">領取試煉合格證</button>' : ''}<button type="button" class="q-btn ${allDone() ? '' : 'primary'}" data-tr="close">收下徽章</button></div>
      </div>`;
    trBody.querySelector('[data-tr="close"]').focus({ preventScroll: true });
    if (allDone()) toast(f, '十二枚徽章全部到手！', '你已通過所有導師的試煉，可以領取試煉合格證');
  }
  function closeTrial() {
    if (trialCleanup) { trialCleanup(); trialCleanup = null; }
    tr.hidden = true; state.busy = false; state.paused = false; trialTeacher = null;
  }
  tr.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tr]'); if (!b) { if (e.target === tr) closeTrial(); return; }
    if (b.dataset.tr === 'start') startGame();
    else if (b.dataset.tr === 'close') closeTrial();
    else if (b.dataset.tr === 'devwin') winTrial();
    else if (b.dataset.tr === 'cert') showCertificate();
    else if (b.dataset.tr === 'download') downloadCertificate();
  });
  tr.querySelector('.trial-close').addEventListener('click', closeTrial);

  // 淨化與試煉開著時攔下鍵盤，避免角色移動或觸發其他快捷鍵
  window.addEventListener('keydown', (e) => {
    if (qte) {
      if (e.code === 'Escape') endPurify();
      else if (['Space', 'KeyE', 'Enter'].includes(e.code)) pressPurify();
      e.preventDefault(); e.stopImmediatePropagation();
    } else if (!tr.hidden && e.code === 'Escape') { closeTrial(); e.stopImmediatePropagation(); }
  }, true);

  /* ---------- 試煉合格證（全破獎勵，招生紀念，非正式文件） ---------- */
  function drawCertificate(cv, name) {
    const c = cv.getContext('2d'), W = cv.width, H = cv.height;
    const g = c.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.7); g.addColorStop(0, '#fbf3df'); g.addColorStop(1, '#ead9b4');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#a8322b'; c.lineWidth = 6; c.strokeRect(24, 24, W - 48, H - 48);
    c.strokeStyle = '#c9a227'; c.lineWidth = 2; c.strokeRect(36, 36, W - 72, H - 72);
    c.textAlign = 'center'; c.fillStyle = '#2c2216';
    c.font = '600 18px "Cinzel", serif'; c.fillText('TUT · INTERIOR DESIGN · M.A.', W / 2, 92);
    c.font = '900 46px "Noto Serif TC", serif'; c.fillText('南應大室研所大冒險・試煉合格證', W / 2, 152);
    c.font = '400 24px "LXGW WenKai TC", serif'; c.fillStyle = '#4a3a26';
    c.fillText('茲證明', W / 2, 212);
    c.font = '900 52px "Noto Serif TC", serif'; c.fillStyle = '#a8322b'; c.fillText(name || '冒險者', W / 2, 276);
    c.font = '400 22px "LXGW WenKai TC", serif'; c.fillStyle = '#4a3a26';
    c.fillText('已走遍南應室研大陸，通過十二位導師的試煉，獲得以下徽章：', W / 2, 324);
    const list = faculty.filter((f) => Q.teachers[f.id]);
    list.forEach((f, i) => {
      const col = i % 6, row = Math.floor(i / 6), x = W / 2 + (col - 2.5) * 136, y = 400 + row * 120, r = 38;
      c.fillStyle = regionOf(f).color; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#c9a227'; c.lineWidth = 4; c.stroke();
      c.fillStyle = '#fff'; c.font = '900 15px "Noto Serif TC", serif';
      const b = qOf(f).badge; c.fillText(b.slice(0, 2), x, y - 2); c.fillText(b.slice(2), x, y + 17);
      c.fillStyle = '#4a3a26'; c.font = '400 14px "Noto Sans TC", sans-serif'; c.fillText(`${f.name}老師`, x, y + r + 20);
    });
    const d = new Date();
    c.font = '400 18px "Noto Sans TC", sans-serif'; c.fillStyle = '#4a3a26';
    c.fillText(`台南應用科技大學 室內設計系碩士班　${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`, W / 2, H - 92);
    c.font = '400 13px "Noto Sans TC", sans-serif'; c.fillStyle = '#8a7a5e';
    c.fillText('本合格證為招生互動遊戲「南應大室研所大冒險」的紀念，非正式學歷或修業證明。', W / 2, H - 60);
  }
  function showCertificate() {
    if (tr.hidden) { tr.hidden = false; state.busy = true; state.paused = true; }
    tr.style.setProperty('--region', '#a8322b');
    tr.querySelector('.trial-title').textContent = '試煉合格證';
    trBody.innerHTML = `
      <label class="cert-name"><span>合格證上的名字</span><input type="text" maxlength="12" placeholder="冒險者" value="${esc(save.name || '')}"></label>
      <canvas class="cert-canvas" width="1000" height="760" aria-label="試煉合格證預覽"></canvas>
      <p class="trial-rules">恭喜走遍大陸！可以下載合格證留念或分享。下一段旅程，就從報考碩士班開始。</p>
      <div class="trial-actions">
        <button type="button" class="q-btn primary" data-tr="download">下載合格證</button>
        <a class="q-btn" href="${esc((window.WORLD.links || {}).admissions || '#')}" target="_blank" rel="noopener">報考碩士班 ↗</a>
        <button type="button" class="q-btn" data-tr="close">關閉</button>
      </div>`;
    const cv = trBody.querySelector('canvas'), input = trBody.querySelector('input');
    const redraw = () => drawCertificate(cv, input.value.trim());
    input.addEventListener('input', () => { save.name = input.value.trim(); persist(); redraw(); });
    // 字型可能還在載入，載完再畫一次
    redraw(); if (document.fonts) document.fonts.ready.then(redraw);
  }
  function downloadCertificate() {
    const cv = trBody.querySelector('.cert-canvas'); if (!cv) return;
    const a = document.createElement('a');
    a.href = cv.toDataURL('image/png'); a.download = `南應大室研所大冒險-試煉合格證${save.name ? '-' + save.name : ''}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- 任務日誌（圖鑑的「任務」分頁） ---------- */
  function renderLog() {
    const list = faculty.filter((f) => Q.teachers[f.id]);
    const done = list.filter((f) => st(f.id).stage === STAGE.DONE).length;
    const STATUS = ['尚未接受', '採集中', '待試煉', '已通過'];
    logEl.innerHTML = `
      <label class="quick-toggle"><input type="checkbox" id="quick-mode" ${save.quick ? 'checked' : ''}><span><b>快速模式</b>每位導師的採集數量從 ${Q.settings.count} 個減為 ${Q.settings.quickCount} 個，適合招生攤位</span></label>
      ${done === list.length ? '<button type="button" class="q-btn primary cert-btn" data-cert>領取試煉合格證</button>' : ''}
      <h3 class="log-head">徽章牆 <small>${done} / ${list.length}</small></h3>
      <div class="badge-wall">${list.map((f) => {
        const ok = st(f.id).stage === STAGE.DONE;
        return `<div class="badge-medal ${ok ? '' : 'locked'}" style="--region:${regionOf(f).color}" title="${esc(f.name)}"><span>${ok ? esc(qOf(f).badge) : '？'}</span><small>${esc(f.name)}</small></div>`;
      }).join('')}</div>
      <h3 class="log-head">任務進度</h3>
      <div class="quest-rows">${list.map((f) => {
        const s = st(f.id);
        const detail = s.stage === STAGE.COLLECT ? `${qOf(f).stage1.item.name} ${s.got}/${need()}` : STATUS[s.stage];
        return `<button type="button" class="quest-row" data-t="${f.id}" data-stage="${s.stage}" style="--region:${regionOf(f).color}"><i></i><b>${esc(f.name)}</b><span>${esc(detail)}</span></button>`;
      }).join('')}</div>
      <button type="button" class="reset-all" data-reset-open>重置所有進度</button>`;
  }
  logEl.addEventListener('change', (e) => {
    if (e.target.id !== 'quick-mode') return;
    save.quick = e.target.checked;
    for (const f of faculty) { // 切換後重新計算：已達標的直接進入試煉階段
      const s = st(f.id);
      if (s.stage === STAGE.COLLECT && s.got >= need()) s.stage = STAGE.TRIAL;
      if (s.stage === STAGE.COLLECT || s.stage === STAGE.TRIAL) spawn(f.id);
    }
    refreshAll();
  });
  logEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-reset-open]')) { api.openReset(); return; }
    if (e.target.closest('[data-cert]')) { api.closeCodexIfNarrow(); showCertificate(); return; }
    const b = e.target.closest('.quest-row'); if (!b) return;
    const f = byId[b.dataset.t];
    if (st(f.id).stage === STAGE.COLLECT) goField(f); else api.selectTeacher(f, { fromCodex: true });
  });

  /* ---------- 每幀更新：小怪閒晃、探險模式的靠近提示 ---------- */
  let nearMonster = null;
  const tmp = new THREE.Vector3();
  function update(t, dt) {
    for (const m of monsters) {
      const g = m.group;
      if (m.gone > 0) { // 淨化後縮小消失
        const k = Math.min(1, (performance.now() - m.gone) / 400);
        g.scale.setScalar(Math.max(0.001, 1 + k * 0.4 - k * 1.4)); continue;
      }
      // 在採集場內隨機閒晃
      const dx = m.goal.x - g.position.x, dz = m.goal.y - g.position.z, d = Math.hypot(dx, dz);
      if (d < 0.5) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (FIELD_R - 3); m.goal.set(m.field.x + Math.cos(a) * r, m.field.z + Math.sin(a) * r); }
      else { const sp = 1.1 * dt / d; g.position.x += dx * sp; g.position.z += dz * sp; g.rotation.y = Math.atan2(dx, dz); }
      g.position.y = heightAt(g.position.x, g.position.z) + Math.abs(Math.sin(t * 3 + m.ph)) * 0.25;
      m.body.scale.set(1 + Math.sin(t * 6 + m.ph) * 0.04, 1 - Math.sin(t * 6 + m.ph) * 0.04, 1);
      g.children.forEach((c) => {
        if (c.userData.orbit !== undefined) { const a = t * 2 + c.userData.orbit * 2.1; c.position.set(Math.cos(a) * 1, 1.3 + Math.sin(a * 2) * 0.2, Math.sin(a) * 1); c.visible = Math.sin(t * 13 + c.userData.orbit) > -0.6; }
        if (c.userData.wing) c.rotation.y = c.userData.wing * (0.4 + Math.sin(t * 18) * 0.5);
        if (c.userData.arm) c.rotation.x = Math.sin(t * 4 + c.userData.arm) * 0.5;
        if (c.userData.leg !== undefined) c.rotation.x = Math.sin(t * 14 + c.userData.leg * 2) * 0.4;
      });
    }
    // 探險模式：靠近小怪時顯示淨化提示
    let near = null;
    if (state.mode === 'explore' && !state.card && !qte) {
      let nd = 3.4;
      for (const m of monsters) { if (m.gone > 0) continue; const d = Math.hypot(m.group.position.x - player.position.x, m.group.position.z - player.position.z); if (d < nd) { nd = d; near = m; } }
    }
    if (near !== nearMonster) {
      nearMonster = near;
      api.quests.nearMonster = near;
      if (near) promptEl.innerHTML = isTouch ? `點「淨化」對付 <b>${esc(near.q.stage1.monster.name)}</b>` : `按 <b>E</b> 淨化 <b>${esc(near.q.stage1.monster.name)}</b>`;
      promptEl.hidden = !near;
      api.syncInteract();
    }
  }
  function pick(ray) {
    if (!hits.length) return false;
    const h = ray.intersectObjects(hits, false)[0];
    if (!h) return false;
    startPurify(h.object.userData.monster);
    return true;
  }
  function interact() { if (nearMonster && !qte) { startPurify(nearMonster); return true; } return false; }

  // 載入時：還在採集中的任務重新放出小怪
  faculty.forEach((f) => { if (Q.teachers[f.id] && st(f.id).stage === STAGE.COLLECT) spawn(f.id); });
  refreshMarks(); refreshTracker(); renderLog();  // 載入時不寫入存檔，重置後才會是乾淨的
  const self = { update, pick, interact, cardHTML, bindCard, nearMonster: null, openTrial };
  // 測試用（Playwright）：查看小怪數量、直接收集、開啟淨化視窗
  self.debug = {
    monsters: () => monsters.filter((m) => m.gone < 0).length,
    save: () => JSON.parse(JSON.stringify(save)),
    collectOne: (id) => { const m = monsters.find((x) => x.id === id && x.gone < 0); if (m) collect(m); return !!m; },
    completeAll: () => { faculty.forEach((f) => { if (Q.teachers[f.id]) st(f.id).stage = STAGE.DONE; }); refreshAll(); },
    showCertificate: () => showCertificate(),
    firstPos: () => { const m = monsters.find((x) => x.gone < 0); return m && { x: m.group.position.x, z: m.group.position.z }; },
    purify: (id) => { const m = monsters.find((x) => x.id === id && x.gone < 0); if (m) startPurify(m); return !!m; }
  };
  api.quests = self;
  return self;
}
