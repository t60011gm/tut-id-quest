/* =========================================================================
 * 南應大室研所大冒險 · 採集戰的 3D 畫法（正常版，在採集場裡打）
 * 只負責把場地引擎（js/fight.js）的狀態畫成 3D 物件，不處理遊戲規則。
 * 物件在主迴圈 mergeStatic() 之後才建立，不會被合併。
 * ========================================================================= */
import * as THREE from 'three';

const TEXT_CACHE = new Map();
function textTex(text, color) {
  const key = text + '|' + color;
  if (TEXT_CACHE.has(key)) return TEXT_CACHE.get(key);
  const c = document.createElement('canvas'), x = c.getContext('2d');
  const font = '900 44px "Noto Sans TC", "PingFang TC", sans-serif';
  x.font = font; const w = Math.ceil(x.measureText(text).width) + 28;
  c.width = w; c.height = 64;
  x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 9; x.strokeStyle = 'rgba(20,16,10,.85)'; x.strokeText(text, w / 2, 34);
  x.fillStyle = color; x.fillText(text, w / 2, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const v = { t, aspect: w / 64 };
  TEXT_CACHE.set(key, v);
  return v;
}
function colorOf(s) {
  const m = /^rgba?\(([^)]+)\)/.exec(s);
  if (!m) return { c: new THREE.Color(s), a: 1 };
  const [r, g, b, a = 1] = m[1].split(',').map(Number);
  return { c: new THREE.Color(r / 255, g / 255, b / 255), a };
}

export function createFight3D({ scene, camera, player, heightAt, mat, SHAPES, animateMon, origin, E }) {
  const root = new THREE.Group(); scene.add(root);
  const own = []; // 這裡建立、結束時要釋放的材質與幾何
  const keep = (x) => { own.push(x); return x; };
  const H = (x, z) => heightAt(origin.x + x, origin.z + z);
  const at = (o, x, z, dy = 0) => o.position.set(origin.x + x, H(x, z) + dy, origin.z + z);
  const basic = (color, opts = {}) => keep(new THREE.MeshBasicMaterial({ color, ...opts }));
  const geo = (g) => keep(g);

  function sprite(text, color = '#ffffff', size = 0.7) {
    const { t, aspect } = textTex(text, color);
    const s = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })));
    s.scale.set(size * aspect, size, 1); s.renderOrder = 20;
    return s;
  }
  function barObj(w = 1.6, color = '#ffcf8a') {
    const g = new THREE.Group();
    const bg = new THREE.Mesh(geo(new THREE.PlaneGeometry(w + 0.12, 0.26)), basic('#1b1b1b', { transparent: true, opacity: 0.6, depthTest: false }));
    const fg = new THREE.Mesh(geo(new THREE.PlaneGeometry(w, 0.16)), basic(color, { depthTest: false }));
    bg.renderOrder = 18; fg.renderOrder = 19; fg.position.z = 0.01;
    g.add(bg, fg); g.userData = { fg, w };
    return g;
  }
  function setBar(b, v) {
    const k = Math.max(0.001, Math.min(1, v));
    b.userData.fg.scale.x = k; b.userData.fg.position.x = -(1 - k) * b.userData.w / 2;
    b.quaternion.copy(camera.quaternion);
  }

  /* ---------- 場地邊界：一圈半透明光牆 ---------- */
  const wall = new THREE.Mesh(geo(new THREE.CylinderGeometry(E.R, E.R, 1.6, 72, 1, true)), basic(E.color, { transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
  at(wall, 0, 0, 0.6); root.add(wall);

  /* ---------- 小怪 ---------- */
  const mons = new Map();
  function buildMon(m) {
    const g = new THREE.Group();
    const body = (SHAPES[m.shape] || SHAPES.blob)(g, m.color);
    const tintable = [], all = [];
    const base = new THREE.Color(m.color);
    g.traverse((o) => {
      if (!o.isMesh) return;
      keep(o.geometry);
      if (!o.material.visible) return;
      o.material = keep(o.material.clone()); o.material.transparent = true;
      all.push(o.material);
      if (o.material.color && o.material.color.equals(base)) tintable.push(o.material);
    });
    const ring = new THREE.Mesh(geo(new THREE.RingGeometry(1, 1.2, 36)), basic('#ffffff', { transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.12; g.add(ring);
    const dots = [0, 1, 2].map((i) => { const d = new THREE.Mesh(geo(new THREE.SphereGeometry(0.22, 10, 8)), basic('#ffffff')); d.position.set((i - 1) * 0.6, 2.7, 0); g.add(d); return d; });
    const carry = new THREE.Mesh(geo(new THREE.BoxGeometry(0.6, 0.45, 0.6)), basic('#d9c49a')); carry.position.y = 2.6; g.add(carry);
    const bar = barObj(1.6); bar.position.y = 3.1; g.add(bar);
    root.add(g);
    return { g, body, tintable, all, ring, dots, carry, bar, base };
  }
  function updMon(o, m, t) {
    const dead = !m.alive, k = dead ? Math.max(0.01, 1 - m.deadT / 0.45) : 1;
    at(o.g, m.x, m.z, Math.abs(Math.sin(t * 5 + m.id)) * 0.2);
    o.g.rotation.y = m.face;
    o.g.scale.setScalar(m.scale * (dead ? 1 + (1 - k) * 0.5 : 1) * (dead ? k : 1));
    const op = dead ? k : m.vis;
    for (const mm of o.all) mm.opacity = op;
    for (const mm of o.tintable) mm.color.set(m.tint || o.base);
    o.ring.visible = !!m.ring && !dead;
    if (m.ring) { o.ring.material.color.set(m.ring); o.ring.scale.setScalar(m.r * 1.15 * (1 + Math.sin(t * 6) * 0.06)); }
    o.dots.forEach((d, i) => { d.visible = !!m.dots && !dead; if (m.dots) { d.material.color.set(m.dots[i]); d.position.y = 2.7 + Math.sin(t * 4 + i) * 0.1; } });
    o.carry.visible = !!m.carry && !dead; if (m.carry) o.carry.material.color.set(m.carry);
    o.bar.visible = m.bar !== null && m.bar !== undefined && !dead; if (o.bar.visible) setBar(o.bar, m.bar);
    animateMon(o.g, t);
  }

  /* ---------- 場上道具 ---------- */
  const props = new Map();
  function buildProp(p) {
    const g = new THREE.Group(); const u = {};
    const add = (m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
    const box = (w, h, d, c) => new THREE.Mesh(geo(new THREE.BoxGeometry(w, h, d)), mat(c));
    const cyl = (r1, r2, h, c, n = 14) => new THREE.Mesh(geo(new THREE.CylinderGeometry(r1, r2, h, n)), mat(c));
    switch (p.kind) {
      case 'pile':
        add(box(1.4, 0.8, 1.1, '#a7744a'), -0.5, 0.4, 0.2); add(box(1.2, 0.7, 1.2, '#c9c2b4'), 0.6, 0.35, -0.2); add(box(1.1, 0.6, 0.9, '#d9c49a'), 0, 1.1, 0);
        u.bar = barObj(2.4, '#e2b45c'); u.bar.position.y = 2.4; g.add(u.bar);
        u.lab = sprite(p.label, '#ffe9b8', 0.6); u.lab.position.y = 3; g.add(u.lab); break;
      case 'post':
        u.pole = add(cyl(0.5, 0.55, 3.4, '#8a5a36'), 0, 1.7, 0); add(cyl(0.7, 0.7, 0.2, '#6b4426'), 0, 0.1, 0);
        u.bar = barObj(1.8, '#9be37a'); u.bar.position.y = 4.1; g.add(u.bar); break;
      case 'vent':
        add(cyl(p.r, p.r, 0.25, '#2b3240', 28), 0, 0.12, 0);
        u.fan = new THREE.Group(); u.fan.position.y = 0.3; g.add(u.fan);
        for (let k = 0; k < 4; k++) { const b = box(p.r * 1.6, 0.06, 0.32, '#8fa3b8'); b.rotation.y = k * Math.PI / 4; u.fan.add(b); }
        u.lab = sprite(p.label, '#bfe8ff', 0.55); u.lab.position.y = 1.4; g.add(u.lab); break;
      case 'bin':
        add(box(2.1, 1.4, 1.6, p.color), 0, 0.7, 0); add(box(2.2, 0.15, 1.7, '#3a3a3a'), 0, 1.45, 0);
        u.lab = sprite(p.label, '#ffffff', 0.75); u.lab.position.y = 2.2; g.add(u.lab); break;
      case 'chunk':
        add(box(0.75, 0.6, 0.75, p.color), 0, 0.35, 0).rotation.y = p.id;
        u.lab = sprite(p.label, '#ffffff', 0.45); u.lab.position.y = 1.2; g.add(u.lab);
        u.bar = barObj(1, '#ffffff'); u.bar.position.y = 1.65; g.add(u.bar); break;
      case 'board':
        add(cyl(0.12, 0.12, 2.6, '#6b4426', 6), -1.2, 1.3, 0); add(cyl(0.12, 0.12, 2.6, '#6b4426', 6), 1.2, 1.3, 0);
        add(box(2.8, 1.6, 0.15, '#7a5230'), 0, 1.8, 0);
        ['#fff7dc', '#ffd6e0', '#d6f0ff', '#fff2b3'].forEach((c, i) => add(box(1, 0.6, 0.04, c), -0.6 + (i % 2) * 1.2, 2.1 - Math.floor(i / 2) * 0.7, 0.1));
        u.lab = sprite(p.label, '#ffe9b8', 0.6); u.lab.position.y = 3.2; g.add(u.lab); break;
      case 'coin':
        u.coin = add(new THREE.Mesh(geo(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 18)), mat('#e8b923', { emissive: '#ffb300', emissiveIntensity: 0.5 })), 0, 0.7, 0);
        u.coin.rotation.x = Math.PI / 2; break;
      case 'sign':
        add(cyl(0.12, 0.12, 2.2, '#3a3a3a', 6), 0, 1.1, 0);
        u.panelMat = keep(mat(p.color).clone());
        add(new THREE.Mesh(geo(new THREE.BoxGeometry(2.6, 1.3, 0.18)), u.panelMat), 0, 2.4, 0);
        u.lab = sprite('TUT·ID', '#ffffff', 0.55); u.lab.position.set(0, 2.4, 0); g.add(u.lab);
        u.bar = barObj(2, p.color); u.bar.position.y = 3.4; g.add(u.bar);
        g.rotation.y = Math.atan2(-p.x, -p.z); break;
      case 'station':
        ['#e05d8c', '#46b35b', '#e2b45c'].forEach((c, i) => { const a = i * Math.PI * 2 / 3; add(cyl(0.32, 0.26, 0.6, c, 12), Math.cos(a) * 0.7, 0.3, Math.sin(a) * 0.7); });
        add(cyl(p.r * 1.25, p.r * 1.25, 0.06, '#46b35b', 28), 0, 0.03, 0);
        u.lab = sprite(p.label, '#c9f5b5', 0.55); u.lab.position.y = 1.6; g.add(u.lab); break;
      case 'node':
        add(new THREE.Mesh(geo(new THREE.SphereGeometry(0.45, 14, 10)), mat('#c3adff', { emissive: '#7c5cff', emissiveIntensity: 1 })), 0, 0.8, 0);
        add(new THREE.Mesh(geo(new THREE.CylinderGeometry(0.08, 0.08, 3, 6)), basic('#c3adff', { transparent: true, opacity: 0.45 })), 0, 1.5, 0);
        u.bar = barObj(1.1, '#c3adff'); u.bar.position.y = 1.7; g.add(u.bar); break;
    }
    root.add(g);
    return { g, u };
  }
  function updProp(o, p, t) {
    at(o.g, p.x, p.z);
    const u = o.u;
    if (u.bar) { u.bar.visible = p.bar !== null && p.bar !== undefined; if (u.bar.visible) setBar(u.bar, p.bar); }
    if (u.pole) u.pole.rotation.z = (1 - (p.bar ?? 1)) * 0.22;
    if (u.fan) u.fan.rotation.y = t * 6;
    if (u.coin) { u.coin.rotation.z = t * 3 + p.id; u.coin.position.y = 0.7 + Math.sin(t * 3 + p.id) * 0.12; }
    if (u.panelMat) u.panelMat.color.set('#9a9a9a').lerp(new THREE.Color(p.color), Math.max(0, Math.min(1, p.sat)));
  }

  /* ---------- 連線、線材（貼地的彩帶） ---------- */
  const ribbons = [];
  function updRibbon(i, l) {
    let r = ribbons[i];
    if (!r) {
      r = new THREE.Mesh(keep(new THREE.BufferGeometry()), basic('#ffffff', { transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      r.renderOrder = 5; r.frustumCulled = false; root.add(r); ribbons[i] = r;
    }
    const pts = l.pts, w = Math.max(0.12, l.w) * 1.3, pos = [];
    for (let k = 0; k < pts.length; k++) {
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const [x, z] = pts[k], y = H(x, z) + 0.18;
      pos.push(origin.x + x - tz * w, y, origin.z + z + tx * w, origin.x + x + tz * w, y, origin.z + z - tx * w);
    }
    const idx = [];
    for (let k = 0; k < pts.length - 1; k++) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    r.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); r.geometry.setIndex(idx);
    const { c, a } = colorOf(l.color); r.material.color.copy(c); r.material.opacity = a * (l.dash ? 0.6 : 0.95);
    r.visible = true;
  }

  /* ---------- 投射物、掉落物、特效 ---------- */
  const shots = new Map(), drops = new Map(), fxs = new Map();
  const shotGeo = geo(new THREE.SphereGeometry(1, 10, 8));
  const buildShot = (s) => { const m = new THREE.Mesh(shotGeo, basic(s.color)); m.scale.setScalar(s.r); root.add(m); return { g: m }; };
  const buildDrop = () => {
    const g = new THREE.Group();
    const gem = new THREE.Mesh(geo(new THREE.OctahedronGeometry(0.5)), mat(E.color, { emissive: E.color, emissiveIntensity: 0.9 })); gem.position.y = 1; g.add(gem);
    const beam = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.25, 0.25, 6, 8, 1, true)), basic(E.color, { transparent: true, opacity: 0.3, depthWrite: false })); beam.position.y = 3; g.add(beam);
    root.add(g); return { g, gem };
  };
  function buildFx(f) {
    if (f.kind === 'pop') { const s = sprite(f.text, f.color, 0.6); root.add(s); return { g: s, sprite: true }; }
    let g;
    if (f.kind === 'burst') g = new THREE.Mesh(geo(new THREE.RingGeometry(0.85, 1, 32)), basic(f.color, { transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    else if (f.kind === 'cone') g = new THREE.Mesh(geo(new THREE.CircleGeometry(1, 24, -0.95, 1.9)), basic(f.color, { transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    else g = new THREE.Mesh(geo(new THREE.CircleGeometry(1, 32)), basic(f.color, { transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    g.rotation.x = -Math.PI / 2; g.renderOrder = 6; root.add(g);
    return { g };
  }
  function updFx(o, f) {
    const k = f.t / f.life;
    if (o.sprite) { at(o.g, f.x, f.z, 2.6 + f.t * 1.6); o.g.material.opacity = 1 - k * k; return; }
    at(o.g, f.x, f.z, 0.25);
    if (f.kind === 'burst') { o.g.scale.setScalar(f.r * (0.4 + k)); o.g.material.opacity = 1 - k; }
    else if (f.kind === 'cone') { o.g.scale.setScalar(f.r); o.g.rotation.z = f.face - Math.PI / 2; o.g.material.opacity = (1 - k) * 0.5; }
    else { o.g.scale.setScalar(f.r); o.g.material.opacity = (1 - k) * 0.28; }
  }
  function sync(map, list, build, upd, t, key = (x) => x.id) {
    const seen = new Set();
    for (const x of list) {
      const id = key(x); seen.add(id);
      let o = map.get(id);
      if (!o) { o = build(x); map.set(id, o); }
      upd(o, x, t);
    }
    for (const [id, o] of map) if (!seen.has(id)) { o.g.removeFromParent(); map.delete(id); }
  }

  /* 玩家手上拿的材料 */
  const carry = new THREE.Mesh(geo(new THREE.BoxGeometry(0.7, 0.55, 0.7)), basic('#ffffff')); root.add(carry);

  function update(t) {
    sync(mons, E.mons, buildMon, updMon, t);
    sync(props, E.props, buildProp, updProp, t);
    E.lines.forEach((l, i) => updRibbon(i, l));
    for (let i = E.lines.length; i < ribbons.length; i++) ribbons[i].visible = false;
    sync(shots, E.shots, buildShot, (o, s) => at(o.g, s.x, s.z, 1.3), t);
    sync(drops, E.drops, buildDrop, (o, d) => { at(o.g, d.x, d.z); o.gem.rotation.y = t * 3; o.gem.position.y = 1 + Math.sin(t * 4) * 0.2; }, t);
    sync(fxs, E.fx, buildFx, updFx, t, (f) => f);
    carry.visible = !!E.P.carry;
    if (E.P.carry) { carry.material.color.set(E.P.carry.color); carry.position.set(player.position.x, player.position.y + 3.6, player.position.z); carry.rotation.y = t; }
    player.visible = !(E.P.inv > 0 && Math.floor(t * 14) % 2);
  }
  function dispose() {
    root.removeFromParent();
    own.forEach((x) => x.dispose && x.dispose());
    player.visible = true;
  }
  return { update, dispose };
}
