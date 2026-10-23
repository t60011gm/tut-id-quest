/* =========================================================================
 * 南應大室研所大冒險 · 採集戰（第一階段的動作小遊戲）
 * 一場採集戰的邏輯都在「場地座標」中進行：原點是採集場中心，半徑 ARENA_R。
 * 同一套邏輯有兩種畫法：2D 小視窗（draw2D，本檔）與 3D 採集場（js/fight3d.js）。
 *
 * 每個玩法是 GAMES 裡的一筆：
 *   setup(E)        擺放場景與小怪
 *   update(E, dt)   每幀更新
 *   action(E)       玩家按下道具鍵
 *   hit(E, m, s)    玩家的投射物打中小怪（可省略）
 *   onHurt(E)       玩家被打到時的額外效果（可省略）
 *   bot(E)          自動試玩用：回傳 { x, z, act, avoid }（目標點、是否按道具、要閃避的小怪）
 * 難度：簡易版被打到會掉一個道具（撿回來即可）；正常版有 5 格體力，歸零就失敗重來。
 * ========================================================================= */

export const ARENA_R = 12;
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/* 線段 AB 與 CD 是否相交 */
function segHit(ax, az, bx, bz, cx, cz, dx, dz) {
  const d = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx);
  if (Math.abs(d) < 1e-9) return false;
  const u = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / d;
  const v = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / d;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1;
}
/* 點是否在多邊形內 */
function inPoly(x, z, pts) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
}

/* =========================================================================
 * 場地引擎
 * ========================================================================= */
export function createArena(o) {
  const G = GAMES[o.type];
  const R = ARENA_R;
  let uid = 0;
  const timers = [];
  const E = {
    R, G, type: o.type, hard: !!o.hard, k: o.hard ? 1 : 0.85, need: o.need, got: 0, t: 0,
    done: false, result: null, reason: '',
    color: o.color || '#e2b45c', monster: o.monster, item: o.item,
    P: { x: 0, z: R - 3, face: Math.PI, hp: 5, max: 5, inv: 0, cd: 0, carry: null, speed: 7, moving: false, kx: 0, kz: 0 },
    mons: [], props: [], lines: [], shots: [], fx: [], drops: [], data: {},
    meter: '', msg: '', msgT: 0, bot: false, sfx: o.sfx || (() => {}), onEnd: o.onEnd || (() => {})
  };
  const P = E.P;

  /* ---------- 小工具 ---------- */
  E.say = (text, sec = 2.4) => { E.msg = text; E.msgT = sec; };
  E.pop = (x, z, text, color = '#ffffff') => E.fx.push({ kind: 'pop', x, z, text, color, t: 0, life: 1.1 });
  E.burst = (x, z, color = E.color, r = 1.6) => E.fx.push({ kind: 'burst', x, z, color, r, t: 0, life: 0.5 });
  E.later = (sec, fn) => timers.push({ at: E.t + sec, fn });
  E.mon = (m) => {
    const mm = { id: ++uid, x: 0, z: 0, r: 0.8, shape: E.monster.shape, color: E.monster.color, harm: true, alive: true,
      hp: 1, vis: 1, scale: 1, ring: null, tint: null, bar: null, dots: null, carry: null, stun: 0, face: rnd(0, TAU),
      kx: 0, kz: 0, deadT: 0, data: {}, ...m };
    E.mons.push(mm); return mm;
  };
  E.kill = (m) => { if (!m.alive) return; m.alive = false; m.harm = false; m.deadT = 0.001; };
  E.prop = (kind, x, z, opt = {}) => { const p = { id: ++uid, kind, x, z, r: 1, solid: false, label: '', bar: null, data: {}, ...opt }; E.props.push(p); return p; };
  E.unprop = (p) => { const i = E.props.indexOf(p); if (i >= 0) E.props.splice(i, 1); };
  E.shoot = (x, z, tx, tz, opt = {}) => {
    const d = Math.hypot(tx - x, tz - z) || 1, sp = opt.speed || 14;
    E.shots.push({ id: ++uid, x, z, vx: (tx - x) / d * sp, vz: (tz - z) / d * sp, life: opt.life || 0.9, r: opt.r || 0.35, color: opt.color || '#ffffff', enemy: !!opt.enemy });
  };
  E.shootFace = (opt) => E.shoot(P.x, P.z, P.x + Math.sin(P.face), P.z + Math.cos(P.face), opt);
  E.nearest = (list, x, z, maxD = Infinity, pred = () => true) => {
    let best = null, bd = maxD;
    for (const m of list) { if (m.alive === false || !pred(m)) continue; const d = Math.hypot(m.x - x, m.z - z); if (d < bd) { bd = d; best = m; } }
    return best;
  };
  /* 自動瞄準：射程內最近的小怪，並把玩家轉向它 */
  E.aim = (maxD, pred = () => true) => {
    const m = E.nearest(E.mons, P.x, P.z, maxD, pred);
    if (m) P.face = Math.atan2(m.x - P.x, m.z - P.z);
    return m;
  };
  E.toward = (m, tx, tz, sp, dt) => {
    const dx = tx - m.x, dz = tz - m.z, d = Math.hypot(dx, dz);
    if (d > 1e-3) { const s = Math.min(d, sp * dt) / d; m.x += dx * s; m.z += dz * s; m.face = Math.atan2(dx, dz); }
    return d;
  };
  E.away = (m, fx, fz, sp, dt) => E.toward(m, m.x * 2 - fx, m.z * 2 - fz, sp, dt);
  E.wander = (m, sp, dt, rmax = R - 1.5) => {
    const g = m.data.goal || (m.data.goal = E.randPos(0, rmax));
    if (E.toward(m, g.x, g.z, sp, dt) < 0.4) m.data.goal = E.randPos(0, rmax);
  };
  E.randPos = (rmin = 0, rmax = R - 2) => { const a = rnd(0, TAU), d = Math.sqrt(rnd((rmin / rmax) ** 2, 1)) * rmax; return { x: Math.sin(a) * d, z: Math.cos(a) * d }; };
  E.edgePos = () => { const a = rnd(0, TAU); return { x: Math.sin(a) * (R - 0.8), z: Math.cos(a) * (R - 0.8) }; };
  E.knock = (m, from, power) => { const d = dist(m, from) || 1; m.kx = (m.x - from.x) / d * power; m.kz = (m.z - from.z) / d * power; };
  const keepIn = (m, rr) => { const d = Math.hypot(m.x, m.z); if (d > rr) { m.x *= rr / d; m.z *= rr / d; } };

  /* ---------- 得分、受傷、輸贏 ---------- */
  E.gain = (n = 1, x = P.x, z = P.z) => {
    if (E.done) return;
    E.got = Math.min(E.need, E.got + n);
    E.pop(x, z, `+${n} ${E.item.name}`, '#ffe08a'); E.sfx('pickup');
    if (E.got >= E.need) E.win();
  };
  /* 簡易版：掉一個道具在附近，撿回來就好 */
  E.drop = () => {
    if (E.got <= 0) return false;
    E.got--;
    const a = rnd(0, TAU), d = rnd(2.5, 4); const pt = { x: P.x + Math.sin(a) * d, z: P.z + Math.cos(a) * d }; keepIn(pt, R - 1.5);
    E.drops.push({ id: ++uid, x: pt.x, z: pt.z, t: 0 });
    return true;
  };
  E.hurt = (src) => {
    if (E.done || P.inv > 0) return;
    P.inv = 1.3; E.knock(P, src, 11); E.sfx('hurt');
    if (G.onHurt) G.onHurt(E, src);
    if (E.hard) {
      P.hp--; E.pop(P.x, P.z, '-1', '#ff6b6b');
      if (P.hp <= 0) E.fail('體力耗盡，倒下了');
      else E.say(`被打到了！剩 ${P.hp} 格體力`);
    } else if (E.drop()) E.say(`${E.item.name}掉了！快撿回來`);
    else E.say('被打到了！小心一點');
  };
  E.win = () => { if (E.done) return; E.done = true; E.result = 'win'; E.onEnd(E); };
  E.fail = (reason) => { if (E.done) return; E.done = true; E.result = 'fail'; E.reason = reason; E.sfx('fail'); E.onEnd(E); };
  E.act = () => { if (E.done || P.cd > 0) return; P.cd = G.cd || 0.3; G.action(E); };

  /* ---------- 每幀更新 ---------- */
  function movePlayer(mx, mz, dt) {
    let len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; len = 1; }
    P.moving = len > 0.05;
    let nx = P.x + mx * P.speed * dt + P.kx * dt, nz = P.z + mz * P.speed * dt + P.kz * dt;
    const kd = Math.exp(-7 * dt); P.kx *= kd; P.kz *= kd;
    for (const p of E.props) {
      if (!p.solid) continue;
      const dx = nx - p.x, dz = nz - p.z, d = Math.hypot(dx, dz), min = p.r + 0.5;
      if (d < min && d > 1e-4) { nx = p.x + dx / d * min; nz = p.z + dz / d * min; }
    }
    P.x = nx; P.z = nz; keepIn(P, R - 0.6);
    if (P.moving) P.face = Math.atan2(mx, mz);
  }
  function botInput() {
    const b = G.bot(E) || {};
    let mx = 0, mz = 0;
    if (b.x !== undefined) { const dx = b.x - P.x, dz = b.z - P.z, d = Math.hypot(dx, dz); if (d > 0.3) { mx = dx / d; mz = dz / d; } }
    for (const m of b.avoid || []) { // 閃避：太靠近的小怪產生推力
      if (!m.alive) continue;
      const dx = P.x - m.x, dz = P.z - m.z, d = Math.hypot(dx, dz) || 1, rr = m.r + 2.4;
      if (d < rr) { mx += dx / d * (rr - d) * 1.2; mz += dz / d * (rr - d) * 1.2; }
    }
    return { mx, mz, act: !!b.act };
  }
  E.update = (dt, input = { mx: 0, mz: 0 }) => {
    dt = Math.min(dt, 0.05);
    for (const f of E.fx) f.t += dt;
    E.fx = E.fx.filter((f) => f.t < f.life);
    for (const m of E.mons) if (!m.alive) m.deadT += dt;
    E.mons = E.mons.filter((m) => m.alive || m.deadT < 0.45);
    if (E.done) return;
    E.t += dt;
    P.inv = Math.max(0, P.inv - dt); P.cd = Math.max(0, P.cd - dt); E.msgT -= dt;
    const inp = E.bot && G.bot ? botInput() : input;
    movePlayer(inp.mx || 0, inp.mz || 0, dt);
    if (inp.act) E.act();
    for (let i = timers.length - 1; i >= 0; i--) if (E.t >= timers[i].at) { const tm = timers.splice(i, 1)[0]; tm.fn(); }
    G.update(E, dt);
    if (E.done) return;
    // 小怪：擊退、留在場內、碰到玩家
    const kd = Math.exp(-6 * dt);
    for (const m of E.mons) {
      if (!m.alive) continue;
      m.x += m.kx * dt; m.z += m.kz * dt; m.kx *= kd; m.kz *= kd;
      m.stun = Math.max(0, m.stun - dt);
      if (!m.free) keepIn(m, R - 0.5);
      if (m.harm && m.stun <= 0 && dist(m, P) < m.r * m.scale + 0.45) E.hurt(m);
    }
    // 投射物
    for (const s of E.shots) {
      s.x += s.vx * dt; s.z += s.vz * dt; s.life -= dt;
      if (Math.hypot(s.x, s.z) > R) s.life = 0;
      if (s.life <= 0) continue;
      if (s.enemy) { if (dist(s, P) < s.r + 0.5) { s.life = 0; E.hurt(s); } continue; }
      for (const m of E.mons) {
        if (!m.alive || m.shootable === false) continue;
        if (dist(s, m) < m.r * m.scale + s.r) { s.life = 0; if (G.hit) G.hit(E, m, s); break; }
      }
    }
    E.shots = E.shots.filter((s) => s.life > 0);
    // 掉落的道具：走過去就撿回來
    for (const d of E.drops) { d.t += dt; if (dist(d, P) < 1.2) { d.gone = true; E.gain(1, d.x, d.z); } }
    E.drops = E.drops.filter((d) => !d.gone);
  };
  /* 測試用：不畫圖，直接用固定時間步模擬（給 Playwright 檢查每個玩法都能自動破關） */
  E.simulate = (sec, step = 1 / 30) => { for (let t = 0; t < sec && !E.done; t += step) E.update(step); return E.result; };

  G.setup(E);
  return E;
}

/* =========================================================================
 * 十二個玩法
 * ========================================================================= */
const GAMES = {};
export const FIGHT_TYPES = () => Object.keys(GAMES);
const WARN = '#ff5d5d';

/* ── 黃教益：連線法杖（捕獲）── 牽起三隻孤島史萊姆、連成三角形就收服；流言黑球會打斷連線 */
GAMES.link = {
  cd: 0.3,
  setup(E) {
    for (let i = 0; i < 7; i++) E.mon({ ...E.randPos(2), harm: false, kind: 'slime' });
    for (let i = 0; i < 2; i++) E.mon({ ...E.edgePos(), kind: 'rumor', shape: 'blob', color: '#4b3f5c', ring: WARN, r: 0.75, shootable: false });
    E.data.links = [];
  },
  update(E, dt) {
    const L = E.data.links, P = E.P;
    for (const m of E.mons) {
      if (!m.alive) continue;
      if (m.kind === 'rumor') { if (dist(m, P) < 7) E.toward(m, P.x, P.z, 2.3 * E.k, dt); else E.wander(m, 1.4, dt); continue; }
      const i = L.indexOf(m);
      if (i < 0) { E.wander(m, 1.6, dt); continue; }
      const back = 1.8 + i * 1.3;
      E.toward(m, P.x - Math.sin(P.face) * back, P.z - Math.cos(P.face) * back, 6.3, dt);
      if (dist(m, P) > 7.5) { L.splice(i, 1); m.ring = null; E.say('拉太遠，連線斷了！'); E.sfx('miss'); }
    }
    const lines = L.map((m, i) => ({ pts: [[(i ? L[i - 1] : P).x, (i ? L[i - 1] : P).z], [m.x, m.z]], color: '#ffd36b', w: 0.22 }));
    if (L.length === 3) {
      lines.push({ pts: [[L[2].x, L[2].z], [L[0].x, L[0].z]], color: '#ffd36b', w: 0.22 });
      E.data.close = (E.data.close || 0) + dt;
      if (E.data.close > 0.45) { // 三角閉合：收服
        const cx = (L[0].x + L[1].x + L[2].x) / 3, cz = (L[0].z + L[1].z + L[2].z) / 3;
        L.forEach((m) => { E.kill(m); E.burst(m.x, m.z, '#ffd36b'); });
        E.data.links = []; E.data.close = 0;
        E.say('三角閉合！孤島變成了網路');
        for (let k = 0; k < 3; k++) E.later(1 + k * 0.4, () => E.mon({ ...E.edgePos(), harm: false, kind: 'slime' }));
        E.gain(2, cx, cz);
      }
    }
    E.lines = lines;
    E.meter = `連線 ${E.data.links.length} / 3`;
  },
  action(E) {
    const L = E.data.links;
    if (L.length >= 3) return;
    const m = E.aim(5, (x) => x.kind === 'slime' && !L.includes(x));
    if (!m) { E.say('靠近孤島史萊姆再使用連線法杖'); return; }
    L.push(m); m.ring = '#ffd36b'; E.sfx('shoot'); E.pop(m.x, m.z, '連線！', '#ffd36b');
  },
  onHurt(E) {
    if (!E.data.links.length) return;
    E.data.links.forEach((m) => { m.ring = null; }); E.data.links = [];
    E.say('流言打斷了你的連線！');
  },
  bot(E) {
    const L = E.data.links, P = E.P;
    const m = E.nearest(E.mons, P.x, P.z, Infinity, (x) => x.kind === 'slime' && !L.includes(x));
    const avoid = E.mons.filter((x) => x.kind === 'rumor');
    if (!m || L.length >= 3) return { avoid };
    return { x: m.x, z: m.z, act: dist(m, P) < 4.5, avoid };
  }
};

/* ── 馮一鳴：工地圍籬盾（防守）── 拖延怪來偷建材，用盾擊退；打兩下會掉出建材樣品 */
GAMES.guard = {
  cd: 0.45,
  setup(E) {
    E.data.pile = E.prop('pile', 0, 0, { r: 1.7, solid: true, hp: 12, max: 12, label: '建材堆' });
    E.data.next = 1.2; E.P.z = 4;
  },
  update(E, dt) {
    const pile = E.data.pile, R = E.R;
    E.data.next -= dt;
    if (E.data.next <= 0 && E.mons.filter((m) => m.alive).length < 6) {
      E.data.next = Math.max(1.5, 2.8 - E.t * 0.02) / E.k;
      E.mon({ ...E.edgePos(), hp: 2 });
    }
    for (const m of E.mons) {
      if (!m.alive || m.stun > 0) continue;
      if (m.data.carry) { // 搬著樣品往外逃
        const d = Math.hypot(m.x, m.z) || 1;
        m.free = true;
        E.toward(m, m.x / d * (R + 2), m.z / d * (R + 2), 2.9 * E.k, dt);
        if (d > R - 0.6) { E.kill(m); E.say('樣品被搬走了…'); }
      } else if (dist(m, pile) < pile.r + m.r + 0.15) {
        m.data.carry = true; m.carry = '#d9c49a';
        pile.hp--; E.pop(pile.x, pile.z, '-1 建材', '#ff8a7a'); E.sfx('miss');
        if (pile.hp <= 0) {
          if (E.hard) { E.fail('建材堆被搬空了，工程延宕！'); return; }
          pile.hp = 6; E.drop(); E.say('建材堆被搬空了！緊急補貨，但掉了一個樣品');
        }
      } else E.toward(m, pile.x, pile.z, 2.3 * E.k, dt);
    }
    pile.bar = pile.hp / pile.max;
    E.meter = `建材堆 ${pile.hp} / ${pile.max}`;
  },
  action(E) {
    const P = E.P, pile = E.data.pile;
    E.fx.push({ kind: 'swing', x: P.x, z: P.z, r: 3.2, color: '#e2b45c', t: 0, life: 0.3 });
    for (const m of E.mons) {
      if (!m.alive || dist(m, P) > 3.2 + m.r) continue;
      E.knock(m, P, 9); m.stun = 0.8; m.hp--; E.sfx('hit');
      if (m.hp <= 0) {
        if (m.data.carry) pile.hp = Math.min(pile.max, pile.hp + 1);
        E.kill(m); E.burst(m.x, m.z); E.gain(1, m.x, m.z);
      }
    }
  },
  bot(E) {
    const pile = E.data.pile, P = E.P;
    let best = null, bd = 1e9;
    for (const m of E.mons) { if (!m.alive) continue; const d = dist(m, pile) - (m.data.carry ? 6 : 0); if (d < bd) { bd = d; best = m; } }
    if (!best) return { x: 0, z: 3 };
    return { x: best.x, z: best.z, act: dist(best, P) < 2.8 };
  }
};

/* ── 林傑仁：去噪光槍（攻擊）── 雜訊蟲閃爍時打不中，變清楚的瞬間才打得到 */
GAMES.denoise = {
  cd: 0.28,
  setup(E) { for (let i = 0; i < 5; i++) this.spawn(E); E.data.fire = 2.5; },
  spawn(E) { E.mon({ ...E.randPos(3), hp: 2, r: 0.75, data: { ph: 'glitch', tt: rnd(0.8, 2.5), jump: 0 } }); },
  update(E, dt) {
    const P = E.P;
    for (const m of E.mons) {
      if (!m.alive) continue;
      const d = m.data; d.tt -= dt;
      if (d.ph === 'glitch') {
        m.vis = 0.3 + 0.35 * Math.abs(Math.sin(E.t * 23 + m.id));
        d.jump -= dt;
        if (d.jump <= 0) { d.jump = 0.7; m.x += rnd(-2.5, 2.5); m.z += rnd(-2.5, 2.5); }
        if (d.tt <= 0) { d.ph = 'clear'; d.tt = 1.6 / E.k; m.ring = '#3ee6ff'; }
      } else {
        m.vis = 1;
        E.toward(m, P.x, P.z, 1.2 * E.k, dt);
        if (d.tt <= 0) { d.ph = 'glitch'; d.tt = rnd(2, 3.2); m.ring = null; }
      }
      m.scale = 0.75 + 0.125 * m.hp;
    }
    E.data.fire -= dt;
    if (E.data.fire <= 0) {
      E.data.fire = rnd(1.4, 2.4) / E.k;
      const s = E.nearest(E.mons, P.x, P.z, 10, (m) => m.data.ph === 'glitch');
      if (s) E.shoot(s.x, s.z, P.x, P.z, { enemy: true, speed: 6 * E.k, color: '#ff4fd8', life: 2.5, r: 0.3 });
    }
    E.meter = '等它變清楚（藍圈）再打';
  },
  action(E) {
    const m = E.aim(10, (x) => x.data.ph === 'clear') || E.aim(10);
    E.sfx('shoot');
    if (m) E.shoot(E.P.x, E.P.z, m.x, m.z, { speed: 18, color: '#3ee6ff', life: 0.9 });
    else E.shootFace({ speed: 18, color: '#3ee6ff', life: 0.9 });
  },
  hit(E, m) {
    if (m.data.ph !== 'clear') { E.pop(m.x, m.z, 'MISS', '#c8c8c8'); E.say('還在閃爍，等它變清楚再打！'); return; }
    m.hp--; E.sfx('hit'); E.burst(m.x, m.z, '#3ee6ff', 1.2);
    if (m.hp <= 0) { E.kill(m); E.pop(m.x, m.z, '去噪完成', '#3ee6ff'); E.later(1, () => this.spawn(E)); E.gain(1, m.x, m.z); }
  },
  bot(E) {
    const P = E.P;
    const m = E.nearest(E.mons, P.x, P.z, Infinity, (x) => x.data.ph === 'clear') || E.nearest(E.mons, P.x, P.z);
    if (!m) return {};
    const d = dist(m, P);
    const t = d > 6 ? m : d < 3.5 ? { x: P.x * 2 - m.x, z: P.z * 2 - m.z } : P;
    return { x: t.x, z: t.z, act: m.data.ph === 'clear' && d < 9, avoid: E.mons };
  }
};

/* ── 徐灝：節點發射器（捕獲）── 放節點自動連線，斷線精靈沿參數曲線飛，穿過連線就抓到 */
GAMES.nodes = {
  cd: 0.35,
  MAX: 9,
  setup(E) { E.data.nodes = []; for (let i = 0; i < 4; i++) this.spawn(E); E.data.v = 0; },
  spawn(E) {
    const d = { A: rnd(5, 9.5), B: rnd(5, 9.5), a: rnd(0.45, 0.75), b: rnd(0.45, 0.75), p: rnd(0, TAU), q: rnd(0, TAU), cx: rnd(-1.5, 1.5), cz: rnd(-1.5, 1.5), tt: rnd(0, 20) };
    const m = E.mon({ r: 0.7, data: d });
    this.place(m, 0);
  },
  place(m, dt) {
    const d = m.data; d.tt += dt;
    m.x = d.cx + d.A * Math.sin(d.a * d.tt + d.p); m.z = d.cz + d.B * Math.sin(d.b * d.tt + d.q);
  },
  segs(E) {
    const N = E.data.nodes, s = [];
    for (let i = 1; i < N.length; i++) s.push([N[i - 1], N[i]]);
    if (N.length === 3) s.push([N[2], N[0]]);
    return s.map(([a, b]) => ({ a, b, ok: dist(a, b) <= this.MAX }));
  },
  update(E, dt) {
    const N = E.data.nodes;
    for (let i = N.length - 1; i >= 0; i--) { N[i].life -= dt; N[i].bar = N[i].life / 14; if (N[i].life <= 0) { E.unprop(N[i]); N.splice(i, 1); } }
    const segs = this.segs(E);
    for (const m of E.mons) {
      if (!m.alive) continue;
      const px = m.x, pz = m.z;
      this.place(m, dt * E.k);
      for (const s of segs) {
        if (s.ok && segHit(px, pz, m.x, m.z, s.a.x, s.a.z, s.b.x, s.b.z)) {
          E.kill(m); E.burst(m.x, m.z, '#c3adff'); E.pop(m.x, m.z, '接上了！', '#c3adff');
          E.later(1.2, () => this.spawn(E)); E.gain(1, m.x, m.z); break;
        }
      }
    }
    E.lines = segs.map((s) => ({ pts: [[s.a.x, s.a.z], [s.b.x, s.b.z]], color: s.ok ? '#c3adff' : 'rgba(255,93,93,.55)', w: s.ok ? 0.26 : 0.1, dash: !s.ok }));
    E.meter = `節點 ${N.length} / 3（連線最長 ${this.MAX} 公尺）`;
  },
  action(E) {
    const N = E.data.nodes, P = E.P;
    if (N.length >= 3) E.unprop(N.shift());
    const n = E.prop('node', P.x, P.z, { r: 0.4, life: 14, bar: 1 });
    N.push(n); E.sfx('shoot');
    if (N.length > 1 && dist(N[N.length - 2], n) > this.MAX) E.say('節點離太遠，連線接不上！');
  },
  bot(E) {
    const V = [[0, -5.2], [4.5, 2.6], [-4.5, 2.6]], P = E.P;
    const [x, z] = V[E.data.v % 3];
    const there = Math.hypot(P.x - x, P.z - z) < 0.7;
    if (there && P.cd <= 0) E.data.v++;
    return { x, z, act: there, avoid: E.mons };
  }
};

/* ── 陳念祖：感測器＋換氣扇（攻擊）── 霧團看不見，跟著嗶聲找到後，用風扇吹進排風口 */
GAMES.sensor = {
  cd: 0.4,
  setup(E) {
    E.data.vents = [0, 1, 2].map((k) => { const a = k * TAU / 3 + Math.PI; return E.prop('vent', Math.sin(a) * (E.R - 1.4), Math.cos(a) * (E.R - 1.4), { r: 1.8, label: '排風口' }); });
    for (let i = 0; i < 3; i++) this.spawn(E);
    E.data.beep = 0; E.P.z = 0;
  },
  spawn(E) { E.mon({ ...E.randPos(3, E.R - 4), r: 1.3, harm: false, vis: 0.12, data: { vx: 0, vz: 0, exp: 0 } }); },
  update(E, dt) {
    const P = E.P;
    let nd = 1e9;
    for (const m of E.mons) {
      if (!m.alive) continue;
      const d = m.data, dp = dist(m, P); nd = Math.min(nd, dp);
      m.vis += ((dp < 5 ? 1 : 0.1) - m.vis) * Math.min(1, dt * 4);
      if (Math.hypot(d.vx, d.vz) > 0.2) {
        m.x += d.vx * dt; m.z += d.vz * dt;
        const kd = Math.exp(-1.6 * dt); d.vx *= kd; d.vz *= kd;
        const r = Math.hypot(m.x, m.z);
        if (r > E.R - 1) { const nx = m.x / r, nz = m.z / r, dot = d.vx * nx + d.vz * nz; if (dot > 0) { d.vx -= 2 * dot * nx; d.vz -= 2 * dot * nz; } }
      } else E.wander(m, 0.8 * E.k, dt);
      for (const v of E.data.vents) {
        if (dist(m, v) < v.r * 0.85) {
          E.kill(m); E.burst(v.x, v.z, '#bfe8ff', 2.2); E.pop(v.x, v.z, '排出去了！', '#bfe8ff');
          E.later(2, () => this.spawn(E)); E.gain(1, v.x, v.z); break;
        }
      }
      if (!m.alive) continue;
      if (dp < m.r + 0.4) { d.exp += dt; if (d.exp > 1.1) { d.exp = 0; E.say('咳咳！霧團裡空氣太差'); E.hurt(m); } }
      else d.exp = Math.max(0, d.exp - dt);
    }
    const lv = clamp01(1 - (nd - 1) / 10), bars = Math.round(lv * 5);
    E.meter = `污染濃度 ${'▮'.repeat(bars)}${'▯'.repeat(5 - bars)}`;
    E.data.beep -= dt;
    if (E.data.beep <= 0) { E.data.beep = 0.15 + (1 - lv) * 1.2; if (lv > 0.2) E.sfx('beep'); }
  },
  action(E) {
    const P = E.P;
    E.aim(5.5, (m) => m.vis > 0.4);
    E.fx.push({ kind: 'cone', x: P.x, z: P.z, face: P.face, r: 5.5, color: '#bfe8ff', t: 0, life: 0.35 });
    E.sfx('shoot');
    let any = false;
    for (const m of E.mons) {
      if (!m.alive) continue;
      const dx = m.x - P.x, dz = m.z - P.z, d = Math.hypot(dx, dz) || 1;
      if (d > 5.5 + m.r) continue;
      let da = Math.atan2(dx, dz) - P.face; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) > 0.95 && d > m.r) continue;
      const pw = 10 - d; m.data.vx = dx / d * pw; m.data.vz = dz / d * pw; any = true;
    }
    if (!any) E.say('附近沒有霧團，跟著感測器的嗶聲找');
  },
  bot(E) {
    const P = E.P;
    const c = E.nearest(E.mons, P.x, P.z);
    if (!c) return {};
    const v = E.nearest(E.data.vents, c.x, c.z);
    const dx = v.x - c.x, dz = v.z - c.z, d = Math.hypot(dx, dz) || 1;
    const sx = c.x - dx / d * 2.5, sz = c.z - dz / d * 2.5;
    const moving = Math.hypot(c.data.vx, c.data.vz) > 1;
    return { x: sx, z: sz, act: !moving && Math.hypot(P.x - sx, P.z - sz) < 1.1 };
  }
};

/* ── 黃琨智：拆解槌（攻擊＋分類）── 敲碎廢料魔像，把材料丟進對的回收站；太久沒分類會重新組回魔像 */
const MATS = [{ k: 'wood', name: '木料', color: '#b07a45' }, { k: 'brick', name: '紅磚', color: '#c4553a' }, { k: 'glass', name: '玻璃', color: '#6fc3d8' }];
GAMES.recycle = {
  cd: 0.35,
  setup(E) {
    E.data.bins = MATS.map((mt, k) => { const a = k * TAU / 3 + Math.PI / 3; return E.prop('bin', Math.sin(a) * (E.R - 1.8), Math.cos(a) * (E.R - 1.8), { r: 1.2, solid: true, color: mt.color, label: mt.name, data: mt }); });
    E.data.chunks = []; E.data.next = 0.5; E.P.z = 0;
  },
  golem(E, pos) { E.mon({ ...(pos || E.randPos(4, 8)), hp: 3, r: 0.95 }); },
  update(E, dt) {
    const P = E.P, C = E.data.chunks;
    const golem = E.mons.find((m) => m.alive);
    if (golem && golem.stun <= 0) E.toward(golem, P.x, P.z, 1.7 * E.k, dt);
    for (const c of C) { c.life -= dt; c.bar = c.life / 20; }
    const expired = C.filter((c) => c.life <= 0);
    if (expired.length) { // 沒分類完的材料又組回魔像
      const cx = C.reduce((s, c) => s + c.x, 0) / C.length, cz = C.reduce((s, c) => s + c.z, 0) / C.length;
      C.forEach((c) => E.unprop(c)); E.data.chunks = [];
      E.say('廢料又組回魔像了！'); this.golem(E, { x: cx, z: cz });
    }
    if (!golem && !E.data.chunks.length && !P.carry) { E.data.next -= dt; if (E.data.next <= 0) { E.data.next = 1; this.golem(E); } }
    E.meter = P.carry ? `拿著：${P.carry.name} → 丟進同色回收站` : '敲碎魔像，撿起材料分類';
  },
  action(E) {
    const P = E.P, C = E.data.chunks;
    if (P.carry) {
      const bin = E.nearest(E.data.bins, P.x, P.z, 1.2 + 1.6);
      if (bin) {
        if (bin.data.k === P.carry.k) { E.burst(bin.x, bin.z, bin.color); E.pop(bin.x, bin.z, '分類正確', '#ffffff'); P.carry = null; E.gain(1, bin.x, bin.z); }
        else {
          E.say(`${P.carry.name}不是丟這裡！`); E.sfx('miss');
          const d = Math.hypot(bin.x, bin.z) || 1;
          C.push(E.prop('chunk', bin.x - bin.x / d * 3, bin.z - bin.z / d * 3, { r: 0.45, color: P.carry.color, label: P.carry.name, data: P.carry, life: 12 }));
          P.carry = null;
        }
        return;
      }
    } else {
      const c = E.nearest(C, P.x, P.z, 1.8);
      if (c) { C.splice(C.indexOf(c), 1); E.unprop(c); P.carry = c.data; E.sfx('shoot'); return; }
    }
    E.fx.push({ kind: 'swing', x: P.x, z: P.z, r: 3, color: '#9be37a', t: 0, life: 0.3 });
    const g = E.aim(3 + 0.95);
    if (!g) return;
    g.hp--; g.stun = 0.5; E.knock(g, P, 6); E.sfx('hit'); E.burst(g.x, g.z, '#8c7a66', 1.2);
    if (g.hp <= 0) {
      E.kill(g);
      const kinds = [...MATS].sort(() => Math.random() - 0.5);
      kinds.forEach((mt, i) => { const a = i * TAU / 3 + rnd(0, 1); const pt = { x: g.x + Math.sin(a) * 2, z: g.z + Math.cos(a) * 2 }; const r = Math.hypot(pt.x, pt.z); if (r > E.R - 3) { pt.x *= (E.R - 3) / r; pt.z *= (E.R - 3) / r; } C.push(E.prop('chunk', pt.x, pt.z, { r: 0.45, color: mt.color, label: mt.name, data: mt, life: 20 })); });
      E.say('拆解成功！把材料分類丟進回收站');
    }
  },
  bot(E) {
    const P = E.P;
    if (P.carry) { const b = E.data.bins.find((x) => x.data.k === P.carry.k); return { x: b.x, z: b.z, act: dist(b, P) < b.r + 1.4 }; }
    const c = E.nearest(E.data.chunks, P.x, P.z);
    if (c) return { x: c.x, z: c.z, act: dist(c, P) < 1.5 };
    const g = E.mons.find((m) => m.alive);
    if (g) return { x: g.x, z: g.z, act: dist(g, P) < 2.6 };
    return {};
  }
};

/* ── 江博鴻：熱熔噴嘴（捕獲）── 走過的路留下線材，繞一圈把卡料小怪圍起來；被咬到的線會斷 */
GAMES.trail = {
  cd: 0.3,
  setup(E) { for (let i = 0; i < 5; i++) this.spawn(E); E.data.trail = [[E.P.x, E.P.z]]; E.data.on = true; },
  spawn(E) { E.mon({ ...E.randPos(3), r: 0.6, data: { st: 'run', tt: rnd(1, 3), px: 0, pz: 0 } }); },
  update(E, dt) {
    const P = E.P;
    let T = E.data.trail;
    for (const m of E.mons) {
      if (!m.alive) continue;
      const d = m.data; d.px = m.x; d.pz = m.z; d.tt -= dt;
      if (d.st === 'run') {
        if (dist(m, P) < 3) E.away(m, P.x, P.z, 4 * E.k, dt); else E.wander(m, 3.4 * E.k, dt);
        if (d.tt <= 0) { d.st = 'chew'; d.tt = rnd(2.5, 3.5) / E.k; m.ring = '#f28c28'; }
      } else if (d.tt <= 0) { d.st = 'run'; d.tt = rnd(2, 3.5); m.ring = null; }
    }
    if (E.data.on) {
      const last = T[T.length - 1];
      if (Math.hypot(P.x - last[0], P.z - last[1]) >= 0.45) {
        T.push([P.x, P.z]); if (T.length > 90) T.shift();
        for (let i = 0; i < T.length - 8; i++) { // 繞回之前的路線：形成封閉圈
          if (Math.hypot(T[i][0] - P.x, T[i][1] - P.z) < 0.7) {
            const poly = T.slice(i);
            const got = E.mons.filter((m) => m.alive && inPoly(m.x, m.z, poly));
            if (got.length) { got.forEach((m) => { E.kill(m); E.burst(m.x, m.z, '#f28c28'); E.later(1.5, () => this.spawn(E)); }); E.say(`圈住 ${got.length} 隻！`); E.gain(got.length, P.x, P.z); }
            else E.say('圈到空氣了，再試一次');
            T = E.data.trail = [[P.x, P.z]];
            break;
          }
        }
      }
    }
    // 跑動的小怪咬斷線材
    for (const m of E.mons) {
      if (!m.alive || m.data.st !== 'run') continue;
      for (let i = 0; i < T.length - 4; i++) {
        if (segHit(m.data.px, m.data.pz, m.x, m.z, T[i][0], T[i][1], T[i + 1][0], T[i + 1][1])) {
          T = E.data.trail = T.slice(i + 1); E.say('線材被咬斷了！'); E.sfx('miss'); break;
        }
      }
    }
    E.lines = T.length > 1 ? [{ pts: T, color: '#ffb347', w: 0.32 }] : [];
    E.meter = `噴嘴：${E.data.on ? '出料中' : '暫停'}（橘圈＝正在啃線材，最好抓）`;
  },
  action(E) {
    E.data.on = !E.data.on; E.data.trail = [[E.P.x, E.P.z]];
    E.say(E.data.on ? '噴嘴開始出料' : '噴嘴暫停，線材清空'); E.sfx('shoot');
  },
  bot(E) {
    const P = E.P;
    if (!E.data.on) return { act: true };
    const m = E.nearest(E.mons, P.x, P.z, Infinity, (x) => x.data.st === 'chew') || E.nearest(E.mons, P.x, P.z);
    if (!m) return {};
    if (E.data.tg !== m) { E.data.tg = m; E.data.trail = [[P.x, P.z]]; }
    const th = Math.atan2(P.x - m.x, P.z - m.z) + 0.75;
    const t = { x: m.x + Math.sin(th) * 2.4, z: m.z + Math.cos(th) * 2.4 };
    const r = Math.hypot(t.x, t.z); if (r > E.R - 1) { t.x *= (E.R - 1) / r; t.z *= (E.R - 1) / r; }
    return t;
  }
};

/* ── 陳冠帆：木槌（防守）── 白蟻從地底冒出來啃木柱，敲掉牠們；兵蟻會追著你咬 */
GAMES.whack = {
  cd: 0.3,
  setup(E) {
    E.data.posts = [0, 1, 2, 3].map((k) => { const a = Math.PI / 4 + k * Math.PI / 2; return E.prop('post', Math.sin(a) * 5.5, Math.cos(a) * 5.5, { r: 0.6, solid: true, hp: 10, max: 10, bar: 1 }); });
    E.data.next = 1; E.data.sol = 6; E.data.kills = 0; E.P.z = 0;
  },
  update(E, dt) {
    const P = E.P, posts = E.data.posts;
    E.data.next -= dt;
    if (E.data.next <= 0 && E.mons.filter((m) => m.alive && m.kind === 'termite').length < 9) {
      E.data.next = rnd(0.8, 1.3) / E.k;
      const p = pick(posts), a = rnd(0, TAU);
      E.mon({ x: p.x + Math.sin(a) * 1.1, z: p.z + Math.cos(a) * 1.1, r: 0.45, harm: false, kind: 'termite', vis: 0, data: { post: p, up: 0 } });
    }
    E.data.sol -= dt;
    if (E.data.sol <= 0) { E.data.sol = 7 / E.k; E.mon({ ...E.edgePos(), r: 0.6, kind: 'soldier', color: '#d9b77a', ring: WARN }); }
    for (const m of E.mons) {
      if (!m.alive) continue;
      if (m.kind === 'soldier') { E.toward(m, P.x, P.z, 2.6 * E.k, dt); continue; }
      const d = m.data;
      if (d.up < 0.4) { d.up += dt; m.vis = d.up / 0.4; m.scale = 0.4 + d.up * 1.5; continue; }
      m.face = Math.atan2(d.post.x - m.x, d.post.z - m.z) + Math.sin(E.t * 20 + m.id) * 0.3;
      d.post.hp -= 0.32 * dt * E.k;
    }
    for (const p of posts) {
      p.bar = p.hp / p.max;
      if (p.hp <= 0) {
        if (E.hard) { E.fail('木柱被白蟻啃倒了！'); return; }
        p.hp = p.max * 0.5;
        E.mons.forEach((m) => { if (m.data.post === p) E.kill(m); });
        E.drop(); E.say('木柱倒了！換上新柱子，但掉了一個構件');
      }
    }
    E.meter = `已敲走白蟻 ${E.data.kills} 隻（每 2 隻得 1 個${E.item.name}）`;
  },
  action(E) {
    const P = E.P;
    E.fx.push({ kind: 'swing', x: P.x, z: P.z, r: 2.4, color: '#d39a5e', t: 0, life: 0.25 });
    let n = 0;
    for (const m of E.mons) {
      if (!m.alive || dist(m, P) > 2.4 + m.r) continue;
      E.kill(m); E.burst(m.x, m.z, '#f3e6cc', 1); n++; E.data.kills++;
      if (E.data.kills % 2 === 0) E.gain(1, m.x, m.z);
    }
    if (n) E.sfx('hit');
  },
  bot(E) {
    const P = E.P;
    const s = E.nearest(E.mons, P.x, P.z, 4, (m) => m.kind === 'soldier');
    if (s) return { x: s.x, z: s.z, act: dist(s, P) < 2.4 };
    let best = null, bc = 0;
    for (const p of E.data.posts) { const c = E.mons.filter((m) => m.alive && m.data.post === p).length; if (c > bc || (c === bc && best && p.hp < best.hp)) { bc = c; best = p; } }
    if (!best) return { x: 0, z: 0 };
    const d = dist(best, P) || 1;
    const t = { x: best.x + (P.x - best.x) / d * 1.3, z: best.z + (P.z - best.z) / d * 1.3 };
    return { x: t.x, z: t.z, act: !!E.nearest(E.mons, P.x, P.z, 2.2, (m) => m.kind === 'termite' && m.data.up >= 0.4) };
  }
};

/* ── 張怡棻：社區邀請函（捕獲，不打怪）── 陪在冷漠霧靈身邊讓牠暖起來，帶回社區布告欄 */
GAMES.escort = {
  cd: 0.6,
  setup(E) {
    E.data.board = E.prop('board', 0, 0, { r: 1.3, solid: true, label: '社區布告欄' });
    for (let i = 0; i < 5; i++) this.spawn(E);
    for (let i = 0; i < 2; i++) E.mon({ ...E.edgePos(), kind: 'gust', shape: 'cloud', color: '#4a566a', ring: WARN, r: 0.8, shootable: false });
    E.P.z = 4;
  },
  spawn(E) { E.mon({ ...E.randPos(4), r: 0.9, harm: false, kind: 'spirit', bar: 0, data: { warm: 0, calm: 0, follow: false } }); },
  update(E, dt) {
    const P = E.P, board = E.data.board;
    const fol = E.mons.filter((m) => m.alive && m.data.follow);
    for (const m of E.mons) {
      if (!m.alive) continue;
      if (m.kind === 'gust') { if (dist(m, P) < 8) E.toward(m, P.x, P.z, 2.2 * E.k, dt); else E.wander(m, 1.2, dt); continue; }
      const d = m.data;
      if (d.follow) {
        const i = fol.indexOf(m), back = 1.8 + i * 1.2;
        E.toward(m, P.x - Math.sin(P.face) * back, P.z - Math.cos(P.face) * back, 6.5, dt);
        if (dist(m, board) < board.r + 2.6) {
          E.kill(m); E.burst(m.x, m.z, '#ffcf8a'); E.pop(board.x, board.z, '收到心願卡！', '#ffcf8a');
          E.later(1.5, () => this.spawn(E)); E.gain(1, board.x, board.z);
        }
        continue;
      }
      d.calm -= dt;
      const dp = dist(m, P);
      if (dp < 3.4) d.warm += dt / 2.2; else d.warm = Math.max(0, d.warm - dt / 5);
      if (d.calm > 0) { /* 收到邀請函，停下來聽你說 */ }
      else if (dp < 2) E.away(m, P.x, P.z, 2 * E.k, dt);
      else E.wander(m, 1.3, dt);
      if (d.warm >= 1) {
        if (fol.length >= 3) d.warm = 0.99;
        else { d.follow = true; m.tint = '#ffcf8a'; m.ring = '#ffcf8a'; m.bar = null; fol.push(m); E.say('居民願意跟你走了！帶回布告欄'); E.sfx('shoot'); }
      }
      if (!d.follow) m.bar = d.warm;
    }
    E.meter = `跟著你的居民 ${fol.length} / 3`;
  },
  action(E) {
    const m = E.aim(7, (x) => x.kind === 'spirit' && !x.data.follow);
    if (!m) { E.say('附近沒有冷漠霧靈'); return; }
    E.shoot(E.P.x, E.P.z, m.x, m.z, { speed: 12, color: '#fff3c4', life: 0.8 }); E.sfx('shoot');
  },
  hit(E, m) {
    if (m.kind !== 'spirit' || m.data.follow) return;
    m.data.calm = 2.5; m.data.warm = Math.min(0.99, m.data.warm + 0.25); E.pop(m.x, m.z, '願意聽聽看', '#fff3c4');
  },
  onHurt(E) {
    let n = 0;
    for (const m of E.mons) if (m.alive && m.data.follow) { m.data.follow = false; m.data.warm = 0.3; m.tint = null; m.ring = null; E.knock(m, E.P, 6); n++; }
    if (n) E.say('冷言冷語把大家吹散了…');
  },
  bot(E) {
    const P = E.P, board = E.data.board;
    const fol = E.mons.filter((m) => m.alive && m.data.follow).length;
    const avoid = E.mons.filter((m) => m.kind === 'gust');
    const m = E.nearest(E.mons, P.x, P.z, Infinity, (x) => x.kind === 'spirit' && !x.data.follow);
    if (fol >= 3 || (fol && (!m || dist(m, P) > 6))) return { x: board.x, z: board.z, avoid };
    if (!m) return { avoid };
    const d = dist(m, P) || 1;
    return { x: m.x + (P.x - m.x) / d * 2, z: m.z + (P.z - m.z) / d * 2, act: d < 7 && m.data.calm <= 0, avoid };
  }
};

/* ── 許鹿麗：收銀算盤（收集＋攻擊）── 搶在吞噬怪之前撿預算金幣；敲牠們會把吃掉的金幣吐出來 */
GAMES.coins = {
  cd: 0.4,
  setup(E) {
    E.data.coins = []; E.data.have = 0; E.data.next = 0;
    for (let i = 0; i < 9; i++) this.coin(E);
    for (let i = 0; i < 3; i++) E.mon({ ...E.randPos(4), r: 0.8, harm: false, data: { belly: 0 } });
    E.P.z = 0;
  },
  coin(E, pt = E.randPos(1)) { E.data.coins.push(E.prop('coin', pt.x, pt.z, { r: 0.4 })); },
  update(E, dt) {
    const P = E.P, C = E.data.coins;
    E.data.next -= dt;
    if (C.length < 9 && E.data.next <= 0) { E.data.next = 1.1; this.coin(E); }
    for (const m of E.mons) {
      if (!m.alive || m.stun > 0) continue;
      const big = m.data.belly >= 3;
      m.harm = big; m.ring = big ? WARN : null; m.scale = 1 + Math.min(3, m.data.belly) * 0.15;
      if (big) { E.toward(m, P.x, P.z, 2.7 * E.k, dt); continue; }
      const c = E.nearest(C, m.x, m.z);
      if (!c) { E.wander(m, 1.5, dt); continue; }
      if (E.toward(m, c.x, c.z, 2.3 * E.k, dt) < m.r * m.scale + 0.3) { C.splice(C.indexOf(c), 1); E.unprop(c); m.data.belly++; E.pop(m.x, m.z, '吃掉預算！', '#ff8a7a'); }
    }
    for (let i = C.length - 1; i >= 0; i--) {
      if (dist(C[i], P) < 1) {
        const c = C.splice(i, 1)[0]; E.unprop(c); E.sfx('beep'); E.data.have++;
        if (E.data.have >= 3) { E.data.have = 0; E.gain(1, c.x, c.z); }
      }
    }
    E.meter = `預算金幣 ${E.data.have} / 3（湊滿 3 枚換 1 份${E.item.name}）`;
  },
  action(E) {
    const P = E.P;
    E.fx.push({ kind: 'swing', x: P.x, z: P.z, r: 2.6, color: '#46b35b', t: 0, life: 0.3 });
    for (const m of E.mons) {
      if (!m.alive || dist(m, P) > 2.6 + m.r * m.scale) continue;
      m.stun = 2; E.knock(m, P, 7); E.sfx('hit');
      for (let k = 0; k < m.data.belly; k++) { const a = rnd(0, TAU), d = rnd(1.5, 2.5); const pt = { x: m.x + Math.sin(a) * d, z: m.z + Math.cos(a) * d }; const r = Math.hypot(pt.x, pt.z); if (r > E.R - 1.5) { pt.x *= (E.R - 1.5) / r; pt.z *= (E.R - 1.5) / r; } this.coin(E, pt); }
      if (m.data.belly) E.pop(m.x, m.z, '吐出來！', '#ffe08a');
      m.data.belly = 0; m.harm = false; m.ring = null; m.scale = 1;
    }
  },
  bot(E) {
    const P = E.P;
    const fat = E.nearest(E.mons, P.x, P.z, 6, (m) => m.data.belly >= 2 && m.stun <= 0);
    if (fat) return { x: fat.x, z: fat.z, act: dist(fat, P) < 2.6 };
    const c = E.nearest(E.data.coins, P.x, P.z);
    return c ? { x: c.x, z: c.z, avoid: E.mons.filter((m) => m.harm) } : {};
  }
};

/* ── 連棠琁：標準色噴槍（防守）── 褪色怪會把招牌吸成灰色；顏料有限，到中央回收補給站補充 */
const BRAND = '#e05d8c';
GAMES.paint = {
  cd: 0.3,
  setup(E) {
    E.data.signs = [0, 1, 2].map((k) => { const a = k * TAU / 3 + Math.PI; return E.prop('sign', Math.sin(a) * 6.5, Math.cos(a) * 6.5, { r: 0.9, solid: true, sat: 1, bar: 1, color: BRAND }); });
    E.data.station = E.prop('station', 0, 0, { r: 1.3, label: '回收補給站' });
    E.data.ammo = 6; E.data.next = 1.5; E.data.rf = 0; E.P.z = 3;
  },
  update(E, dt) {
    const P = E.P, S = E.data.signs;
    E.data.next -= dt;
    if (E.data.next <= 0 && E.mons.filter((m) => m.alive).length < 5) { E.data.next = 2.3 / E.k; E.mon({ ...E.edgePos(), r: 0.7, data: { sign: pick(S) } }); }
    const drained = new Set();
    for (const m of E.mons) {
      if (!m.alive) continue;
      if (m.data.leaving) { const d = Math.hypot(m.x, m.z) || 1; m.free = true; E.toward(m, m.x / d * (E.R + 2), m.z / d * (E.R + 2), 5, dt); if (d > E.R - 0.6) E.kill(m); continue; }
      const s = m.data.sign;
      if (E.toward(m, s.x, s.z, 2.2 * E.k, dt) < s.r + 1.2) { s.sat -= 0.06 * dt * E.k; drained.add(s); m.ring = '#9a9a9a'; } else m.ring = null;
    }
    for (const s of S) {
      if (!drained.has(s)) s.sat = Math.min(1, s.sat + 0.015 * dt);
      s.bar = s.sat;
      if (s.sat <= 0) {
        if (E.hard) { E.fail('招牌褪成灰色了，品牌形象失守！'); return; }
        s.sat = 0.5; E.drop(); E.say('招牌褪色了！緊急補色，但掉了一個品牌元素');
      }
    }
    if (dist(P, E.data.station) < 1.7 && E.data.ammo < 6) {
      E.data.rf += dt;
      if (E.data.rf > 0.35) { E.data.rf = 0; E.data.ammo++; E.sfx('beep'); if (E.data.ammo === 6) E.say('顏料補滿了（回收再利用）'); }
    }
    E.meter = `顏料 ${'●'.repeat(E.data.ammo)}${'○'.repeat(6 - E.data.ammo)}`;
  },
  action(E) {
    if (E.data.ammo <= 0) { E.say('顏料用完了！回中央的回收補給站補充'); E.sfx('miss'); return; }
    E.data.ammo--; E.sfx('shoot');
    const m = E.aim(7.5, (x) => !x.data.leaving);
    if (m) E.shoot(E.P.x, E.P.z, m.x, m.z, { speed: 15, color: BRAND, life: 0.7 });
    else E.shootFace({ speed: 15, color: BRAND, life: 0.7 });
  },
  hit(E, m) {
    if (m.data.leaving) return;
    m.data.leaving = true; m.harm = false; m.tint = BRAND; m.ring = null; E.sfx('hit');
    E.pop(m.x, m.z, '恢復品牌色！', BRAND); E.gain(1, m.x, m.z);
  },
  bot(E) {
    const P = E.P;
    if (E.data.ammo <= 0) return { x: 0, z: 0 };
    let best = null, bd = 1e9;
    for (const m of E.mons) { if (!m.alive || m.data.leaving) continue; const d = dist(m, m.data.sign); if (d < bd) { bd = d; best = m; } }
    if (!best) return { x: 0, z: 1.5 };
    const d = dist(best, P);
    return { x: best.x, z: best.z, act: d < 7, avoid: d < 3 ? [best] : [] };
  }
};

/* ── 吳宛蓉：取景框（捕獲）── 混搭怪身上的風格一直在換，三樣都一致（金圈）的瞬間按快門 */
export const STYLES = [{ n: '北歐', c: '#e8d3a8' }, { n: '工業', c: '#6b6b6b' }, { n: '日式', c: '#9fb57a' }, { n: '古典', c: '#c9a227' }];
GAMES.frame = {
  cd: 0.5,
  setup(E) { for (let i = 0; i < 4; i++) this.spawn(E); },
  mix() { let a; do { a = [0, 1, 2].map(() => Math.floor(Math.random() * 4)); } while (a[0] === a[1] && a[1] === a[2]); return a; },
  spawn(E) { const m = E.mon({ ...E.randPos(3), r: 0.8, harm: false, data: { st: 'mix', tt: rnd(1.5, 3.5), sw: 0, angry: 0, s: 0 } }); m.dots = this.mix().map((i) => STYLES[i].c); },
  update(E, dt) {
    const P = E.P;
    for (const m of E.mons) {
      if (!m.alive) continue;
      const d = m.data; d.tt -= dt;
      if (d.st === 'mix') {
        d.sw -= dt;
        if (d.sw <= 0) { d.sw = 0.45; m.dots = this.mix().map((i) => STYLES[i].c); }
        if (d.tt <= 0) { d.st = 'match'; d.tt = 1.6 / E.k; d.s = Math.floor(Math.random() * 4); m.dots = [0, 0, 0].map(() => STYLES[d.s].c); m.ring = '#ffd36b'; }
      } else if (d.tt <= 0) { d.st = 'mix'; d.tt = rnd(2.5, 4); m.ring = null; }
      if (d.angry > 0) { d.angry -= dt; m.harm = true; E.toward(m, P.x, P.z, 3.6 * E.k, dt); if (d.st === 'mix') m.ring = WARN; }
      else { m.harm = false; if (d.st === 'mix') m.ring = null; E.wander(m, 1.6 * E.k, dt); }
    }
    E.meter = '三個風格點同色（金圈）時按快門';
  },
  action(E) {
    const P = E.P;
    E.fx.push({ kind: 'flash', x: P.x, z: P.z, r: 7.5, color: '#ffffff', t: 0, life: 0.25 });
    const m = E.aim(7.5, (x) => x.data.st === 'match') || E.aim(7.5);
    if (!m) { E.say('取景框裡沒有混搭怪，再靠近一點'); return; }
    if (m.data.st === 'match') {
      E.kill(m); E.burst(m.x, m.z, '#ffd36b'); E.pop(m.x, m.z, `${STYLES[m.data.s].n}風，構圖完成！`, '#ffd36b');
      E.later(1.5, () => this.spawn(E)); E.gain(1, m.x, m.z);
    } else { m.data.angry = 2.2; E.say('風格太亂，拍不成！混搭怪生氣了'); E.sfx('miss'); }
  },
  bot(E) {
    const P = E.P;
    const ok = E.nearest(E.mons, P.x, P.z, 7, (x) => x.data.st === 'match');
    const m = ok || E.nearest(E.mons, P.x, P.z);
    if (!m) return {};
    const d = dist(m, P);
    const t = d > 4.5 ? m : d < 2.8 ? { x: P.x * 2 - m.x, z: P.z * 2 - m.z } : P;
    return { x: t.x, z: t.z, act: !!ok, avoid: E.mons.filter((x) => x.data.angry > 0) };
  }
};

/* =========================================================================
 * 2D 小視窗的畫法（俯視）
 * ========================================================================= */
const SHADE = (hex, k) => { // 調亮（k>0）或調暗（k<0）
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = (c) => Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
};
const mix = (a, b, k) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const ch = (s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k); return `rgb(${ch(16)},${ch(8)},${ch(0)})`; };

const VK = 1.35; // 2D 俯視時角色畫大一點比較好認（碰撞範圍不變）
function drawEyes(c, x, y, s, face) {
  const ox = Math.sin(face) * s * 0.18, oy = Math.cos(face) * s * 0.18;
  for (const sx of [-1, 1]) {
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x + sx * s * 0.3 + ox, y - s * 0.15 + oy, s * 0.22, 0, TAU); c.fill();
    c.fillStyle = '#1d1a18'; c.beginPath(); c.arc(x + sx * s * 0.3 + ox * 1.6, y - s * 0.15 + oy * 1.6, s * 0.11, 0, TAU); c.fill();
  }
}
function drawMon(c, m, S, t) {
  const x = m.x * S, y = m.z * S, s = m.r * S * VK * m.scale * (m.alive ? 1 : Math.max(0.01, 1 - m.deadT / 0.45));
  const col = m.tint || m.color;
  c.save(); c.globalAlpha = m.alive ? m.vis : Math.max(0, 1 - m.deadT / 0.45);
  c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(x, y + s * 0.55, s * 0.95, s * 0.4, 0, 0, TAU); c.fill();
  if (m.ring && m.alive) { c.strokeStyle = m.ring; c.lineWidth = 3; c.beginPath(); c.arc(x, y, Math.max(1, s * 1.35 + Math.sin(t * 6) * 2), 0, TAU); c.stroke(); }
  const bob = Math.abs(Math.sin(t * 5 + m.id)) * s * 0.12, yy = y - bob;
  c.fillStyle = col; c.strokeStyle = SHADE(col.startsWith('#') ? col : '#888888', -0.35); c.lineWidth = 2;
  switch (m.shape) {
    case 'cube': c.beginPath(); c.roundRect(x - s * 0.8, yy - s * 0.85, s * 1.6, s * 1.6, s * 0.25); c.fill(); c.stroke(); break;
    case 'sprite':
      c.fillStyle = 'rgba(255,255,255,.75)';
      for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(x + sx * s * 0.85, yy - s * 0.3, s * 0.55, s * 0.3 + Math.sin(t * 18) * s * 0.12, sx * 0.4, 0, TAU); c.fill(); }
      c.fillStyle = col; c.beginPath(); c.arc(x, yy, s * 0.75, 0, TAU); c.fill(); c.stroke(); break;
    case 'cloud': [[0, 0, 0.8], [0.6, 0.1, 0.55], [-0.6, 0.1, 0.6], [0.1, -0.45, 0.5]].forEach(([dx, dy, r]) => { c.beginPath(); c.arc(x + dx * s, yy + dy * s, r * s, 0, TAU); c.fill(); }); break;
    case 'golem': c.beginPath(); c.roundRect(x - s * 0.8, yy - s * 0.5, s * 1.6, s * 1.1, 4); c.fill(); c.stroke(); c.beginPath(); c.roundRect(x - s * 0.55, yy - s * 1.15, s * 1.1, s * 0.75, 4); c.fill(); c.stroke(); break;
    case 'bug': {
      c.save(); c.translate(x, yy); c.rotate(-m.face + Math.PI);
      c.strokeStyle = '#1d1a18'; c.lineWidth = 1.5;
      for (let k = -1; k <= 1; k++) for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(0, k * s * 0.45); c.lineTo(sx * s * 0.95, k * s * 0.45 + Math.sin(t * 20 + k) * 3); c.stroke(); }
      c.fillStyle = col; [[0.6, 0.48], [0, 0.42], [-0.55, 0.45]].forEach(([dy, r]) => { c.beginPath(); c.arc(0, dy * s, r * s, 0, TAU); c.fill(); });
      c.restore(); break;
    }
    default: c.beginPath(); c.ellipse(x, yy, s * 0.95, s * 0.78, 0, 0, TAU); c.fill(); c.stroke();
  }
  drawEyes(c, x, m.shape === 'golem' ? yy - s * 0.75 : yy, s * 0.8, m.face);
  if (m.dots) m.dots.forEach((dc, i) => { c.fillStyle = dc; c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.arc(x + (i - 1) * s * 0.7, yy - s * 1.45, s * 0.28, 0, TAU); c.fill(); c.stroke(); });
  if (m.carry) { c.fillStyle = m.carry; c.fillRect(x - s * 0.35, yy - s * 1.6, s * 0.7, s * 0.55); }
  if (m.bar !== null && m.bar !== undefined) bar(c, x, yy - s * 1.35, s * 1.6, m.bar, '#ffcf8a');
  c.restore();
}
function bar(c, x, y, w, v, col) {
  c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  c.fillStyle = col; c.fillRect(x - w / 2, y, w * clamp01(v), 4);
}
function label(c, x, y, text, color = '#2c2216') {
  c.font = '600 12px "Noto Sans TC", sans-serif'; c.textAlign = 'center';
  c.lineWidth = 3; c.strokeStyle = 'rgba(255,250,235,.85)'; c.strokeText(text, x, y); c.fillStyle = color; c.fillText(text, x, y);
}
function drawProp(c, p, S, t, E) {
  const x = p.x * S, y = p.z * S, r = p.r * S;
  switch (p.kind) {
    case 'pile':
      [['#a7744a', -0.5, 0.2], ['#c9c2b4', 0.35, 0.3], ['#d9c49a', -0.1, -0.35]].forEach(([col, dx, dy]) => { c.fillStyle = col; c.strokeStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.roundRect(x + dx * r - r * 0.5, y + dy * r - r * 0.35, r, r * 0.7, 3); c.fill(); c.stroke(); });
      bar(c, x, y - r - 10, r * 2, p.bar, '#e2b45c'); label(c, x, y + r + 14, p.label); break;
    case 'post':
      c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.arc(x + 3, y + 3, r, 0, TAU); c.fill();
      c.fillStyle = '#8a5a36'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      c.strokeStyle = '#c08452'; c.lineWidth = 1.5; for (const k of [0.65, 0.35]) { c.beginPath(); c.arc(x, y, r * k, 0, TAU); c.stroke(); }
      bar(c, x, y - r - 10, r * 2.4, p.bar, p.bar > 0.35 ? '#9be37a' : '#ff6b6b'); break;
    case 'vent':
      c.fillStyle = '#2b3240'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      c.strokeStyle = '#8fa3b8'; c.lineWidth = 3;
      for (let k = 0; k < 4; k++) { const a = t * 6 + k * Math.PI / 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85); c.stroke(); }
      c.strokeStyle = '#bfe8ff'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
      label(c, x, y + r + 14, p.label, '#1d3a52'); break;
    case 'bin':
      c.fillStyle = p.color; c.strokeStyle = SHADE(p.color, -0.4); c.lineWidth = 2;
      c.beginPath(); c.roundRect(x - r, y - r * 0.8, r * 2, r * 1.6, 5); c.fill(); c.stroke();
      c.fillStyle = '#fff'; c.font = '900 13px "Noto Sans TC", sans-serif'; c.textAlign = 'center'; c.fillText(p.label, x, y + 5);
      label(c, x, y + r + 12, '回收站'); break;
    case 'chunk':
      c.fillStyle = p.color; c.strokeStyle = '#fff'; c.lineWidth = 2;
      c.beginPath(); c.roundRect(x - r, y - r, r * 2, r * 2, 3); c.fill(); c.stroke();
      c.fillStyle = '#fff'; c.font = '900 11px "Noto Sans TC", sans-serif'; c.textAlign = 'center'; c.fillText(p.label[0], x, y + 4);
      bar(c, x, y - r - 9, r * 2.4, p.bar, '#ffffff'); break;
    case 'board':
      c.fillStyle = '#7a5230'; c.beginPath(); c.roundRect(x - r * 1.3, y - r, r * 2.6, r * 2, 4); c.fill();
      ['#fff7dc', '#ffd6e0', '#d6f0ff', '#fff2b3'].forEach((col, i) => { c.fillStyle = col; c.fillRect(x - r * 1.1 + (i % 2) * r * 1.15, y - r * 0.8 + Math.floor(i / 2) * r * 0.85, r * 0.95, r * 0.7); });
      label(c, x, y + r + 14, p.label); break;
    case 'coin':
      c.fillStyle = '#c9a227'; c.beginPath(); c.ellipse(x, y, r * Math.abs(Math.cos(t * 3 + p.id)) + 2, r, 0, 0, TAU); c.fill();
      c.fillStyle = '#ffe08a'; c.beginPath(); c.ellipse(x, y, (r * Math.abs(Math.cos(t * 3 + p.id)) + 2) * 0.65, r * 0.65, 0, 0, TAU); c.fill(); break;
    case 'sign': {
      const col = mix('#9a9a9a', p.color, clamp01(p.sat));
      c.fillStyle = '#3a3a3a'; c.fillRect(x - 3, y, 6, r);
      c.fillStyle = col; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.roundRect(x - r * 1.4, y - r, r * 2.8, r * 1.4, 4); c.fill(); c.stroke();
      c.fillStyle = '#fff'; c.font = '900 12px "Noto Sans TC", sans-serif'; c.textAlign = 'center'; c.fillText('TUT·ID', x, y - r * 0.15);
      bar(c, x, y - r - 10, r * 2.4, p.bar, p.bar > 0.35 ? p.color : '#9a9a9a'); break;
    }
    case 'station':
      c.fillStyle = 'rgba(70,179,91,.25)'; c.beginPath(); c.arc(x, y, r * 1.3, 0, TAU); c.fill();
      ['#e05d8c', '#46b35b', '#e2b45c'].forEach((col, i) => { const a = i * TAU / 3 + t; c.fillStyle = col; c.beginPath(); c.roundRect(x + Math.cos(a) * r * 0.55 - 6, y + Math.sin(a) * r * 0.55 - 7, 12, 14, 3); c.fill(); });
      label(c, x, y + r * 1.3 + 13, p.label); break;
    case 'node':
      c.fillStyle = 'rgba(195,173,255,.3)'; c.beginPath(); c.arc(x, y, r * 2 + Math.sin(t * 5) * 2, 0, TAU); c.fill();
      c.fillStyle = '#c3adff'; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r * 1.2, 0, TAU); c.fill(); c.stroke();
      bar(c, x, y - r * 2 - 8, r * 3, p.bar, '#c3adff'); break;
  }
}
function drawPlayer(c, E, S, t) {
  const P = E.P, x = P.x * S, y = P.z * S, s = 0.55 * S * VK;
  if (P.inv > 0 && Math.floor(t * 14) % 2) return;
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x, y + s * 0.5, s, s * 0.45, 0, 0, TAU); c.fill();
  c.fillStyle = '#e2b45c'; c.beginPath(); c.moveTo(x + Math.sin(P.face) * s * 1.7, y + Math.cos(P.face) * s * 1.7);
  c.lineTo(x + Math.sin(P.face + 0.5) * s * 0.9, y + Math.cos(P.face + 0.5) * s * 0.9); c.lineTo(x + Math.sin(P.face - 0.5) * s * 0.9, y + Math.cos(P.face - 0.5) * s * 0.9); c.fill();
  c.fillStyle = '#2f4a7a'; c.strokeStyle = '#e2b45c'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#f3d2b0'; c.beginPath(); c.arc(x, y - s * 0.15, s * 0.5, 0, TAU); c.fill();
  if (P.carry) { c.fillStyle = P.carry.color; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.roundRect(x - s * 0.5, y - s * 2, s, s * 0.8, 3); c.fill(); c.stroke(); }
}
export function draw2D(c, E, W, t) {
  const S = W / (2 * (E.R + 1));
  c.save(); c.clearRect(0, 0, W, W); c.translate(W / 2, W / 2);
  // 地面
  const g = c.createRadialGradient(0, 0, 10, 0, 0, E.R * S);
  g.addColorStop(0, '#9fcf7a'); g.addColorStop(1, '#6fae5a');
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, E.R * S, 0, TAU); c.fill();
  c.fillStyle = E.color; c.globalAlpha = 0.12; c.fill(); c.globalAlpha = 1;
  c.setLineDash([8, 7]); c.lineWidth = 3; c.strokeStyle = E.color; c.beginPath(); c.arc(0, 0, E.R * S, 0, TAU); c.stroke(); c.setLineDash([]);
  // 平放的東西
  for (const p of E.props) if (['vent', 'station', 'coin', 'node', 'chunk'].includes(p.kind)) drawProp(c, p, S, t, E);
  for (const l of E.lines) {
    c.strokeStyle = l.color; c.lineWidth = Math.max(2, l.w * S); c.lineCap = 'round'; c.lineJoin = 'round';
    if (l.dash) c.setLineDash([6, 6]);
    c.beginPath(); l.pts.forEach(([x, z], i) => (i ? c.lineTo(x * S, z * S) : c.moveTo(x * S, z * S))); c.stroke(); c.setLineDash([]);
  }
  for (const d of E.drops) {
    const x = d.x * S, y = d.z * S - Math.abs(Math.sin(t * 4)) * 4, s = 9;
    c.fillStyle = E.color; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath();
    for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, rr = k % 2 ? s * 0.45 : s; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath(); c.fill(); c.stroke();
  }
  for (const f of E.fx) {
    const k = f.t / f.life;
    if (f.kind === 'burst') { c.strokeStyle = f.color; c.globalAlpha = 1 - k; c.lineWidth = 4; c.beginPath(); c.arc(f.x * S, f.z * S, f.r * S * (0.4 + k), 0, TAU); c.stroke(); }
    else if (f.kind === 'swing' || f.kind === 'flash') { c.fillStyle = f.color; c.globalAlpha = (1 - k) * 0.3; c.beginPath(); c.arc(f.x * S, f.z * S, f.r * S, 0, TAU); c.fill(); }
    else if (f.kind === 'cone') { c.fillStyle = f.color; c.globalAlpha = (1 - k) * 0.45; c.beginPath(); c.moveTo(f.x * S, f.z * S); c.arc(f.x * S, f.z * S, f.r * S, Math.PI / 2 - f.face - 0.95, Math.PI / 2 - f.face + 0.95); c.closePath(); c.fill(); }
    c.globalAlpha = 1;
  }
  // 立著的東西依前後排序
  const stand = [...E.props.filter((p) => !['vent', 'station', 'coin', 'node', 'chunk'].includes(p.kind)).map((p) => ({ z: p.z, f: () => drawProp(c, p, S, t, E) })),
    ...E.mons.map((m) => ({ z: m.z, f: () => drawMon(c, m, S, t) })), { z: E.P.z, f: () => drawPlayer(c, E, S, t) }];
  stand.sort((a, b) => a.z - b.z).forEach((o) => o.f());
  for (const s of E.shots) { c.fillStyle = s.color; c.strokeStyle = s.enemy ? '#ffffff' : 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.beginPath(); c.arc(s.x * S, s.z * S, s.r * S, 0, TAU); c.fill(); c.stroke(); }
  for (const f of E.fx) if (f.kind === 'pop') { c.globalAlpha = 1 - (f.t / f.life) ** 2; label(c, f.x * S, f.z * S - 20 - f.t * 30, f.text, '#2c2216'); c.globalAlpha = 1; }
  c.restore();
}
