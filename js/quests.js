/* =========================================================================
 * 南應大室研所大冒險 · 任務系統
 * 每位導師兩階段：
 *   第一階段（採集戰）：接任務時拿到老師的道具，到採集場打一場動作小遊戲取得道具
 *     先選難度：簡易版（2D 小視窗，被打到掉道具）／正常版（3D 採集場，有體力條）；手機一律用 2D 小視窗
 *     玩法邏輯在 js/fight.js，3D 畫法在 js/fight3d.js
 *   第二階段（試煉）：「○○老師的試煉」小遊戲，通關得到徽章與知識小卡
 * 任務內容在 data/quests.js；這裡只處理流程、3D 小怪與介面。
 * 小遊戲以 registerTrial(類型, 函式) 註冊；尚未註冊的試煉會顯示「製作中」。
 * ========================================================================= */
import * as THREE from 'three';
import { createArena, draw2D } from './fight.js?v=2';
import { createFight3D } from './fight3d.js?v=2';

export const QUEST_KEY = 'tutIdQuest.quests.v1';
const GAMES = {};
/* 小遊戲註冊：fn(容器, 試煉資料, { win, fail, teacher }) 回傳清理函式（可省略） */
export function registerTrial(type, fn) { GAMES[type] = fn; }

const STAGE = { NEW: 0, COLLECT: 1, TRIAL: 2, DONE: 3 };
const WORLD = document.documentElement.dataset.world || 'fantasy'; // 開場選的世界觀（main.js 設定）
const DEV = new URLSearchParams(location.search).has('dev'); // ?dev 才會出現「直接通過」測試鈕

export function initQuests(api) {
  const { scene, camera, $, esc, isTouch, heightAt, faculty, RG, FIELD_R, npcs, state, player, mat, sound } = api;
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

  /* 依世界換造型：現代戴棒球帽、穿球鞋，精靈變成無人機；未來是霓虹發光、外框線與天線 */
  const TOP = { blob: 1.25, cube: 1.5, sprite: 2.15, cloud: 1.9, golem: 2.0, bug: 0.95 };
  function skin(g, shape, c) {
    if (WORLD === 'modern') {
      if (shape === 'sprite') {
        g.children.forEach((o) => { if (o.userData.wing) o.visible = false; });
        for (const [x, z] of [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]]) {
          const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.08), mat('#3b4048')); arm.position.set(x * 0.6, 1.95, z * 0.6); arm.rotation.y = Math.atan2(z, x); g.add(arm);
          const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 12), mat('#dfe6ee', { transparent: true, opacity: 0.7 })); rotor.position.set(x, 2.0, z); rotor.userData.rotor = true; g.add(rotor);
        }
        return;
      }
      if (shape === 'bug') return;
      const y = TOP[shape], capM = mat(['#e5484d', '#2f6fbf', '#f2c230'][c.length % 3]);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), capM); cap.position.y = y - 0.12; g.add(cap);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.4), capM); brim.position.set(0, y - 0.1, 0.45); g.add(brim);
      if (shape === 'blob' || shape === 'golem') for (const sx of [-0.35, 0.35]) { const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.5), mat('#ffffff')); shoe.position.set(sx, 0.08, 0.12); g.add(shoe); }
    } else if (WORLD === 'cyber') {
      const neon = mat(c, { emissive: c, emissiveIntensity: 0.55 });
      const edge = new THREE.LineBasicMaterial({ color: '#3ef0ff', transparent: true, opacity: 0.75 });
      g.traverse((o) => {
        if (!o.isMesh || !o.material.color || o.material.color.getHexString() !== new THREE.Color(c).getHexString()) return;
        o.material = o.material.transparent ? mat(c, { emissive: c, emissiveIntensity: 0.55, transparent: true, opacity: o.material.opacity }) : neon;
        if (o.geometry.attributes.position.count < 400) o.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 30), edge));
      });
      const y = TOP[shape];
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 4), mat('#1b1e2c')); ant.position.set(0.2, y + 0.2, 0); g.add(ant);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat('#ff4fd8', { emissive: '#ff4fd8', emissiveIntensity: 2 })); tip.position.set(0.2, y + 0.52, 0); tip.userData.blink = true; g.add(tip);
    }
  }
  const SKINNED = Object.fromEntries(Object.entries(SHAPES).map(([k, fn]) => [k, (g, c) => { const b = fn(g, c); skin(g, k, c); return b; }]));

  /* 小怪的局部動畫（方塊環繞、翅膀、手臂、腳），閒晃小怪與採集戰共用 */
  function animateMon(g, t) {
    g.children.forEach((c) => {
      if (c.userData.orbit !== undefined) { const a = t * 2 + c.userData.orbit * 2.1; c.position.set(Math.cos(a) * 1, 1.3 + Math.sin(a * 2) * 0.2, Math.sin(a) * 1); c.visible = Math.sin(t * 13 + c.userData.orbit) > -0.6; }
      if (c.userData.wing) c.rotation.y = c.userData.wing * (0.4 + Math.sin(t * 18) * 0.5);
      if (c.userData.arm) c.rotation.x = Math.sin(t * 4 + c.userData.arm) * 0.5;
      if (c.userData.leg !== undefined) c.rotation.x = Math.sin(t * 14 + c.userData.leg * 2) * 0.4;
      if (c.userData.rotor) c.rotation.y = t * 25;
      if (c.userData.blink) c.visible = Math.sin(t * 6) > -0.3;
    });
  }

  /* ---------- 採集場裡閒晃的小怪（接任務後出現，點牠或靠近按 E 開始採集戰） ---------- */
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
    if (fight && fieldOf(fight.f) === fd) return; // 這塊採集場正在打採集戰，場上由採集戰接手
    for (let k = 0; k < 3; k++) {
      const g = new THREE.Group();
      const body = (SKINNED[q.stage1.monster.shape] || SKINNED.blob)(g, q.stage1.monster.color || regionOf(f).color);
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
      const text = s.stage === STAGE.COLLECT ? `採集戰：${q.stage1.game.title}` : '回去接受試煉';
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
    else if (s.stage === STAGE.COLLECT) body = `<p>採集戰「${esc(q.stage1.game.title)}」：用 <b>${esc(q.stage1.game.tool)}</b> 取得 <b>${esc(q.stage1.item.name)}</b> ×${need()}</p><p class="q-hint">${esc(q.stage1.lines.hint)}</p><div class="q-btns"><button type="button" class="q-btn primary" data-q="fight">開始採集戰</button><button type="button" class="q-btn" data-q="go">前往${esc(fd.name)}</button></div>`;
    else if (s.stage === STAGE.TRIAL) body = `<p class="q-line">「${esc(q.stage1.lines.done)}」</p><button type="button" class="q-btn primary" data-q="trial">開始試煉</button>`;
    else body = `<p>已獲得徽章 <b class="q-badge-name">${esc(q.badge)}</b></p><button type="button" class="q-btn" data-q="trial">再挑戰一次試煉</button>`;
    // 接過任務後可以單獨重置這位老師，從接任務重新玩一次
    const reset = s.stage !== STAGE.NEW ? '<button type="button" class="q-reset" data-q="reset">重置這位老師的任務</button>' : '';
    return `<section class="sect quest"><h4>${esc(q.stage2.title.split('：')[0])}</h4>${body}${reset}</section>`;
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
      else if (b.dataset.q === 'fight') { api.closeCard(); openFight(f); }
      else if (b.dataset.q === 'trial') { api.closeCard(); openTrial(f); }
      else if (b.dataset.q === 'reset') {
        // 按第一次先確認，3 秒內再按一次才真的重置
        if (!b.classList.contains('confirm')) {
          b.classList.add('confirm'); b.textContent = '確定重置？再按一次（徽章也會收回）';
          setTimeout(() => { if (b.isConnected) { b.classList.remove('confirm'); b.textContent = '重置這位老師的任務'; } }, 3000);
          return;
        }
        resetTeacher(f);
        sec.outerHTML = cardHTML(f); bindCard(sheet, f);
        toast(f, '任務已重置', '可以重新接受任務，再玩一次採集戰與試煉');
      }
    });
  }
  function resetTeacher(f) {
    if (fight && fight.f.id === f.id) stopFight();
    save.t[f.id] = { stage: STAGE.NEW, got: 0 };
    despawn(f.id); refreshAll();
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
  /* ---------- 採集戰：選難度 → 2D 小視窗或 3D 採集場 → 結果 ---------- */
  let fight = null; // { f, E, mode: '2d'|'3d', hard, input, r3, raf, cleanup }
  const gameOf = (f) => qOf(f).stage1.game;
  const hudHTML = (f) => `
    <div class="fh-top"><b class="fh-title">${esc(gameOf(f).title)}</b><span class="fh-prog"></span><span class="fh-hp"></span></div>
    <div class="fh-meter"></div>
    <div class="fh-msg" aria-live="polite"></div>`;
  function paintHud(root, E) {
    const f = fight.f;
    root.querySelector('.fh-prog').textContent = `${qOf(f).stage1.item.name} ${E.got} / ${E.need}`;
    root.querySelector('.fh-hp').innerHTML = E.hard ? Array.from({ length: E.P.max }, (_, i) => `<i class="${i < E.P.hp ? 'on' : ''}"></i>`).join('') : '<small>簡易版</small>';
    root.querySelector('.fh-meter').textContent = E.meter;
    const msg = root.querySelector('.fh-msg'), text = E.msgT > 0 ? E.msg : '';
    if (msg.textContent !== text) msg.textContent = text;
  }
  function newArena(f, hard) {
    const q = qOf(f);
    return createArena({
      type: gameOf(f).type, hard, need: need(), world: WORLD, monster: q.stage1.monster, item: q.stage1.item, color: regionOf(f).color,
      sfx: (n) => sound.sfx(n), onEnd: (E) => setTimeout(() => endFight(E), E.result === 'win' ? 700 : 900)
    });
  }

  /* 簡報：老師交給你的道具、玩法、難度選擇 */
  function openFight(f) {
    const q = qOf(f), g = gameOf(f); if (!g) return;
    if (fight) return;
    trialTeacher = f; state.busy = true; state.paused = true;
    tr.style.setProperty('--region', regionOf(f).color);
    tr.querySelector('.trial-title').textContent = `採集戰：${g.title}`;
    trBody.innerHTML = `
      <div class="tool-get"><span class="tool-icon">${esc(g.tool.slice(-1))}</span><div><small>${esc(f.name)}老師交給你</small><b>${esc(g.tool)}</b><p>${esc(g.toolDesc)}</p></div></div>
      <p class="trial-rules">${esc(g.rules)}<br>目標：取得 <b>${need()}</b> 個「${esc(q.stage1.item.name)}」。</p>
      <div class="diff-pick">
        <button type="button" data-tr="fight-easy"><b>簡易版</b><span>小視窗遊玩<br>被打到會掉道具，撿回來就好</span></button>
        <button type="button" data-tr="fight-hard"><b>正常版</b><span>${isTouch ? '小視窗遊玩' : '直接在採集場裡打'}<br>有 5 格體力，倒下要重來</span></button>
      </div>
      <p class="fight-keys">${isTouch ? '操作：左下搖桿移動，右下按鈕使用道具' : '操作：WASD／方向鍵移動，空白鍵使用道具'}</p>`;
    tr.hidden = false;
    trBody.querySelector('[data-tr="fight-easy"]').focus({ preventScroll: true });
  }
  const sameField = (f) => faculty.filter((x) => Q.teachers[x.id] && fieldOf(x) === fieldOf(f));
  function startFight(f, hard) {
    sameField(f).forEach((x) => despawn(x.id)); // 同一塊採集場的閒晃小怪先收起來
    if (hard && !isTouch) start3D(f); else start2D(f, hard);
  }

  /* 2D 小視窗（簡易版、手機） */
  function start2D(f, hard) {
    const g = gameOf(f), E = newArena(f, hard);
    trialTeacher = f; state.busy = true; state.paused = true; tr.hidden = false;
    tr.querySelector('.trial-title').textContent = `採集戰：${g.title}`;
    trBody.innerHTML = `
      <div class="fight2d">
        <div class="fh">${hudHTML(f)}</div>
        <div class="f2-stage"><canvas class="f2-canvas" aria-label="採集戰場地"></canvas></div>
        <div class="f2-ctrl">
          ${isTouch ? '<div class="f2-joy" aria-hidden="true"><span class="knob"></span></div>' : `<p class="fight-keys">WASD／方向鍵移動・空白鍵使用「${esc(g.tool)}」</p>`}
          <button type="button" class="f2-act">${esc(g.tool)}</button>
        </div>
      </div>`;
    const cv = trBody.querySelector('.f2-canvas'), ctx = cv.getContext('2d'), hud = trBody.querySelector('.fh');
    const keys = new Set(), joy = { x: 0, z: 0 };
    let W = 0;
    const fit = () => {
      const box = trBody.querySelector('.f2-stage');
      const css = Math.max(240, Math.min(box.clientWidth, window.innerHeight - (isTouch ? 330 : 360), 560));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.style.width = cv.style.height = css + 'px'; cv.width = cv.height = Math.round(css * dpr); W = cv.width;
    };
    fit(); window.addEventListener('resize', fit);
    const MOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
    const ACT = ['Space', 'Enter', 'KeyE', 'KeyJ', 'KeyK'];
    const kd = (e) => {
      if (tr.hidden || e.target.closest('input, textarea')) return;
      if (MOVE[e.code]) { keys.add(e.code); e.preventDefault(); }
      else if (ACT.includes(e.code)) { if (!e.target.closest('button') || e.target.classList.contains('f2-act')) { E.act(); e.preventDefault(); } }
    };
    const ku = (e) => keys.delete(e.code);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    trBody.querySelector('.f2-act').addEventListener('pointerdown', (e) => { e.preventDefault(); E.act(); });
    trBody.querySelector('.f2-act').addEventListener('click', (e) => { if (e.detail === 0) E.act(); }); // 鍵盤按 Enter 觸發的 click
    const js = trBody.querySelector('.f2-joy');
    if (js) {
      const knob = js.querySelector('.knob'); let pid = null;
      const mv = (e) => {
        const r = js.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy), max = r.width * 0.36; if (d > max) { dx = dx / d * max; dy = dy / d * max; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`; joy.x = dx / max; joy.z = dy / max;
      };
      js.addEventListener('pointerdown', (e) => { pid = e.pointerId; js.setPointerCapture(pid); mv(e); e.preventDefault(); });
      js.addEventListener('pointermove', (e) => { if (e.pointerId === pid) mv(e); });
      const end = (e) => { if (e.pointerId !== pid) return; pid = null; joy.x = joy.z = 0; knob.style.transform = ''; };
      js.addEventListener('pointerup', end); js.addEventListener('pointercancel', end);
    }
    let last = performance.now();
    const loop = (now) => {
      if (!fight || fight.E !== E) return;
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
      let mx = joy.x, mz = joy.z;
      for (const k of keys) { mx += MOVE[k][0]; mz += MOVE[k][1]; }
      for (let k = 0; k < (fight.speed || 1) && !E.done; k++) E.update(dt, { mx, mz });
      draw2D(ctx, E, W, now / 1000);
      paintHud(hud, E);
      fight.raf = requestAnimationFrame(loop);
    };
    fight = { f, E, mode: '2d', hard };
    fight.cleanup = () => {
      cancelAnimationFrame(fight.raf);
      window.removeEventListener('resize', fit); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
    };
    trialCleanup = () => stopFight();
    fight.raf = requestAnimationFrame(loop);
    trBody.querySelector('.f2-act').focus({ preventScroll: true });
  }

  /* 3D 採集場（正常版，桌機） */
  const hudEl = $('#fight-hud');
  function start3D(f) {
    const fd = fieldOf(f), E = newArena(f, true);
    tr.hidden = true; state.busy = false; state.paused = false; trialTeacher = null;
    api.closeCard();
    if (state.mode !== 'explore') api.setMode('explore');
    const P = E.P, wx = fd.x + P.x, wz = fd.z + P.z;
    api.teleport(wx, wz, Math.atan2(-Math.sin(P.face), -Math.cos(P.face)));
    const input = { mx: 0, mz: 0 };
    const r3 = createFight3D({ scene, camera, player, heightAt, mat, SHAPES: SKINNED, animateMon, origin: { x: fd.x, z: fd.z }, E });
    state.moveHook = (mx, mz) => { input.mx = mx; input.mz = mz; return E.P.moving; };
    hudEl.style.setProperty('--region', regionOf(f).color);
    hudEl.querySelector('.fh').innerHTML = hudHTML(f);
    hudEl.querySelector('.fh-act').textContent = `${gameOf(f).tool}（空白鍵）`;
    hudEl.hidden = false;
    fight = { f, E, mode: '3d', hard: true, input, r3, origin: fd };
    fight.cleanup = () => { r3.dispose(); state.moveHook = null; hudEl.hidden = true; };
    toast(f, `「${gameOf(f).tool}」準備好了！`, gameOf(f).rules);
  }
  hudEl.querySelector('.fh-act').addEventListener('click', () => { if (fight && fight.mode === '3d') fight.E.act(); });
  hudEl.querySelector('.fh-quit').addEventListener('click', () => abandonFight());

  function stopFight() {
    if (!fight) return;
    const f = fight.f;
    fight.cleanup(); fight = null;
    sameField(f).forEach((x) => { if (st(x.id).stage === STAGE.COLLECT) spawn(x.id); });
  }
  function abandonFight() {
    if (!fight) return;
    const f = fight.f;
    stopFight();
    toast(f, '先撤退了', '準備好再回來挑戰採集戰');
  }
  function endFight(E) {
    if (!fight || fight.E !== E) return;
    const f = fight.f, hard = fight.hard, q = qOf(f), s = st(f.id);
    stopFight();
    trialTeacher = f; state.busy = true; state.paused = true;
    tr.style.setProperty('--region', regionOf(f).color);
    tr.querySelector('.trial-title').textContent = `採集戰：${gameOf(f).title}`;
    if (E.result === 'win') {
      if (s.stage === STAGE.COLLECT) { s.stage = STAGE.TRIAL; s.got = need(); despawn(f.id); }
      refreshAll(); sound.sfx('visit');
      trBody.innerHTML = `
        <div class="trial-win">
          <div class="badge-medal big" style="--region:${regionOf(f).color}"><span>${esc(q.stage1.item.name)}</span></div>
          <h3>採集完成！</h3>
          <p class="trial-intro">取得 ${E.need} 個「${esc(q.stage1.item.name)}」${E.hard ? '（正常版）' : ''}</p>
          <p class="trial-intro">${esc(f.name)}老師：「${esc(q.stage1.lines.done)}」</p>
          <div class="trial-actions"><button type="button" class="q-btn primary" data-tr="to-trial">接受試煉</button><button type="button" class="q-btn" data-tr="close">稍後再說</button></div>
        </div>`;
      toast(f, q.stage1.lines.done, `回到${f.name}老師身邊，或直接接受試煉`);
    } else {
      trBody.innerHTML = `
        <div class="trial-win">
          <h3>${esc(E.reason || '失敗了')}</h3>
          <p class="trial-intro">這次取得 ${E.got} / ${E.need} 個「${esc(q.stage1.item.name)}」。正常版倒下就要重來，也可以改用簡易版。</p>
          <div class="trial-actions"><button type="button" class="q-btn primary" data-tr="${hard ? 'fight-hard' : 'fight-easy'}">再試一次</button>${hard ? '<button type="button" class="q-btn" data-tr="fight-easy">改用簡易版</button>' : ''}<button type="button" class="q-btn" data-tr="close">先離開</button></div>
        </div>`;
    }
    tr.hidden = false;
    trBody.querySelector('.q-btn').focus({ preventScroll: true });
  }
  /* 測試或快速完成：直接把第一階段標成完成 */
  function completeCollect(f) {
    const s = st(f.id); if (s.stage !== STAGE.COLLECT) return;
    s.stage = STAGE.TRIAL; s.got = need(); despawn(f.id); refreshAll();
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
    else if (b.dataset.tr === 'fight-easy' || b.dataset.tr === 'fight-hard') { const f = trialTeacher; if (trialCleanup) { trialCleanup(); trialCleanup = null; } startFight(f, b.dataset.tr === 'fight-hard'); }
    else if (b.dataset.tr === 'to-trial') openTrial(trialTeacher);
  });
  tr.querySelector('.trial-close').addEventListener('click', closeTrial);

  // 試煉視窗開著時 Esc 關閉；3D 採集戰中 Esc 撤退
  window.addEventListener('keydown', (e) => {
    if (!tr.hidden && e.code === 'Escape') { closeTrial(); e.stopImmediatePropagation(); }
    else if (fight && fight.mode === '3d' && e.code === 'Escape') { abandonFight(); e.stopImmediatePropagation(); }
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
        const detail = s.stage === STAGE.COLLECT ? `採集戰：${qOf(f).stage1.game.title}` : STATUS[s.stage];
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

  /* ---------- 每幀更新：採集戰、小怪閒晃、探險模式的靠近提示 ---------- */
  let nearMonster = null;
  function update(t, dt) {
    if (fight && fight.mode === '3d') {
      const E = fight.E, P = E.P, o = fight.origin;
      // 切回導覽模式、或從圖鑑／小地圖瞬移到別處，就當作撤退
      if (state.mode !== 'explore' || Math.hypot(player.position.x - o.x - P.x, player.position.z - o.z - P.z) > 4) abandonFight();
      else {
        for (let k = 0; k < (fight.speed || 1) && fight && !E.done; k++) E.update(dt, fight.input);
        if (fight) { // 可能剛結束
          player.position.set(o.x + P.x, heightAt(o.x + P.x, o.z + P.z), o.z + P.z);
          player.rotation.y = P.face;
          fight.r3.update(t);
          paintHud(hudEl, E);
        }
      }
    }
    for (const m of monsters) {
      const g = m.group;
      if (m.gone > 0) { // 消失動畫
        const k = Math.min(1, (performance.now() - m.gone) / 400);
        g.scale.setScalar(Math.max(0.001, 1 + k * 0.4 - k * 1.4)); continue;
      }
      // 在採集場內隨機閒晃
      const dx = m.goal.x - g.position.x, dz = m.goal.y - g.position.z, d = Math.hypot(dx, dz);
      if (d < 0.5) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (FIELD_R - 3); m.goal.set(m.field.x + Math.cos(a) * r, m.field.z + Math.sin(a) * r); }
      else { const sp = 1.1 * dt / d; g.position.x += dx * sp; g.position.z += dz * sp; g.rotation.y = Math.atan2(dx, dz); }
      g.position.y = heightAt(g.position.x, g.position.z) + Math.abs(Math.sin(t * 3 + m.ph)) * 0.25;
      m.body.scale.set(1 + Math.sin(t * 6 + m.ph) * 0.04, 1 - Math.sin(t * 6 + m.ph) * 0.04, 1);
      animateMon(g, t);
    }
    // 探險模式：靠近小怪時顯示採集戰提示
    let near = null;
    if (state.mode === 'explore' && !state.card && !fight) {
      let nd = 3.4;
      for (const m of monsters) { if (m.gone > 0) continue; const d = Math.hypot(m.group.position.x - player.position.x, m.group.position.z - player.position.z); if (d < nd) { nd = d; near = m; } }
    }
    if (near !== nearMonster) {
      nearMonster = near;
      api.quests.nearMonster = near;
      if (near) promptEl.innerHTML = isTouch ? `點「挑戰」開始採集戰：<b>${esc(near.q.stage1.game.title)}</b>` : `按 <b>E</b> 開始採集戰：<b>${esc(near.q.stage1.game.title)}</b>`;
      promptEl.hidden = !near;
      api.syncInteract();
    }
  }
  function pick(ray) {
    if (fight && fight.mode === '3d') { fight.E.act(); return true; } // 採集戰中點畫面＝使用道具
    if (!hits.length) return false;
    const h = ray.intersectObjects(hits, false)[0];
    if (!h) return false;
    openFight(h.object.userData.monster.f);
    return true;
  }
  function interact() {
    if (fight && fight.mode === '3d') { fight.E.act(); return true; }
    if (nearMonster) { openFight(nearMonster.f); return true; }
    return false;
  }

  // 載入時：還在採集中的任務重新放出小怪
  faculty.forEach((f) => { if (Q.teachers[f.id] && st(f.id).stage === STAGE.COLLECT) spawn(f.id); });
  refreshMarks(); refreshTracker(); renderLog();  // 載入時不寫入存檔，重置後才會是乾淨的
  const self = { update, pick, interact, cardHTML, bindCard, nearMonster: null, openTrial, openFight };
  // 測試用（Playwright）：查看小怪數量、直接完成採集、操作採集戰
  self.debug = {
    monsters: () => monsters.filter((m) => m.gone < 0).length,
    save: () => JSON.parse(JSON.stringify(save)),
    collectOne: (id) => { completeCollect(byId[id]); return false; },
    fight: () => fight && { mode: fight.mode, got: fight.E.got, need: fight.E.need, done: fight.E.done, result: fight.E.result, hp: fight.E.P.hp, t: fight.E.t },
    fightBot: (on = true) => { if (fight) fight.E.bot = on; return !!fight; },
    fightSpeed: (n) => { if (fight) fight.speed = n; }, // 3D 測試用：每幀多跑幾步（軟體繪圖太慢）
    startFight: (id, hard) => { const f = byId[id]; if (!fight) { tr.hidden = true; startFight(f, hard); } },
    simulate: (id, hard, sec = 300) => { const E = newArena(byId[id], hard); E.onEnd = () => {}; E.bot = true; E.simulate(sec); return { result: E.result, t: E.t, got: E.got }; },
    resetTeacher: (id) => resetTeacher(byId[id]),
    completeAll: () => { faculty.forEach((f) => { if (Q.teachers[f.id]) st(f.id).stage = STAGE.DONE; }); refreshAll(); },
    showCertificate: () => showCertificate(),
    firstPos: () => { const m = monsters.find((x) => x.gone < 0); return m && { x: m.group.position.x, z: m.group.position.z }; }
  };
  api.quests = self;
  return self;
}
