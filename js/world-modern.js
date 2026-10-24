/* =========================================================================
 * 南應大室研所大冒險 · 現代城市與鄉鎮
 * 六個街區的地標（MODERN_BUILDERS.<區域 id>）與全島的樹木、房屋、路燈（scenery）。
 * 由 main.js 依開場選擇的世界呼叫；K 是 main.js 提供的工具箱（mesh、mat、regionCtx…）。
 * 區域座標系同奇幻世界：local +z 指向市中心，導師站在 local v≈12，所以地標集中在 v < 7 與兩側。
 * ========================================================================= */
const TEX = new Map();
/* canvas 貼圖（快取） */
function ctex(K, key, w, h, draw) {
  if (!TEX.has(key)) {
    const t = K.canvasTex(w, h, draw);
    t.wrapS = t.wrapT = K.THREE.RepeatWrapping;
    TEX.set(key, t);
  }
  return TEX.get(key);
}
/* 依面的實際尺寸縮放 UV，讓窗格不會被拉長：unit 是一格貼圖代表的公尺數 */
function boxGeo(K, w, h, d, unit = 3) {
  const g = new K.THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const size = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // +x −x +y −y +z −z
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * size[f][0] / unit, uv.getY(i) * size[f][1] / unit); }
  return g;
}
/* 玻璃帷幕：藍色玻璃＋白色窗框，少數窗戶亮燈 */
const glassTex = (K) => ctex(K, 'glass', 64, 64, (c, w, h) => {
  c.fillStyle = '#9fc4e6'; c.fillRect(0, 0, w, h);
  const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, 'rgba(255,255,255,.45)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.2)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = '#eef3f7'; c.fillRect(0, 0, w, 4); c.fillRect(0, 0, 4, h); c.fillRect(30, 0, 3, h);
});
/* 住商大樓：米白牆面＋一排排窗戶 */
const facadeTex = (K) => ctex(K, 'facade', 64, 64, (c, w, h) => {
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#7f9ab3'; c.fillRect(10, 14, 18, 26); c.fillRect(36, 14, 18, 26);
  c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(12, 16, 6, 22); c.fillRect(38, 16, 6, 22);
  c.fillStyle = '#d6d0c4'; c.fillRect(0, 44, w, 4);
});
/* 紅磚牆 */
const brickTex = (K) => ctex(K, 'brick', 64, 64, (c, w, h) => {
  c.fillStyle = '#d9d2c8'; c.fillRect(0, 0, w, h);
  for (let y = 0, row = 0; y < h; y += 8, row++) for (let x = -16; x < w; x += 16) {
    const v = 200 + ((x * 3 + y * 7) % 40); c.fillStyle = `rgb(${v},${v - 10},${v - 16})`; c.fillRect(x + (row % 2) * 8 + 1, y + 1, 14, 6);
  }
});
/* 地磚 */
const paverTex = (K) => ctex(K, 'paver', 64, 64, (c, w, h) => {
  c.fillStyle = '#c9c9c9'; c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) { const v = 225 + ((x * 5 + y * 3) % 28); c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(x + 1, y + 1, 14, 14); }
});
/* 文字招牌 */
function signTex(K, text, bg, fg = '#ffffff') {
  return ctex(K, 'sign:' + text + bg, 128, 48, (c, w, h) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.fillStyle = fg; c.font = '900 26px "Noto Sans TC", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 + 1);
  });
}
const texMatOf = (K, t, color = '#ffffff', o = {}) => K.mat(color, { map: t, ...o });
const flatNoShadow = (m) => { m.castShadow = false; return m; };

/* 共用小物件 */
function tree(K, g, u, v, y, s = 1, leaf = '#4f9a45') {
  const { THREE, mesh, mat } = K;
  mesh(new THREE.CylinderGeometry(0.14 * s, 0.2 * s, 1.6 * s, 6), mat('#6b4a2f'), u, y + 0.8 * s, v, g);
  mesh(new THREE.IcosahedronGeometry(1.15 * s, 0), mat(leaf), u, y + 2.2 * s, v, g);
}
function lamp(K, g, u, v, y, col = '#fff2c4') {
  const { THREE, mesh, mat } = K;
  mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.4, 6), mat('#3b4048'), u, y + 1.7, v, g);
  flatNoShadow(mesh(new THREE.SphereGeometry(0.22, 8, 6), mat(col, { emissive: col, emissiveIntensity: 1.1 }), u, y + 3.5, v, g));
}
function bench(K, g, u, v, y, rot = 0) {
  const { THREE, mesh, mat } = K;
  const b = new THREE.Group(); b.position.set(u, y, v); b.rotation.y = rot; g.add(b);
  mesh(new THREE.BoxGeometry(1.6, 0.1, 0.5), mat('#b07a45'), 0, 0.5, 0, b);
  for (const sx of [-0.65, 0.65]) mesh(new THREE.BoxGeometry(0.08, 0.5, 0.45), mat('#3b4048'), sx, 0.25, 0, b);
}
/* 會動的 LED 大螢幕：每幀重畫 canvas */
function ledScreen(K, g, w, h, x, y, z, rotY, draw, fps = 8) {
  const { THREE } = K;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = Math.round(256 * h / w);
  const cx = cv.getContext('2d'); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
  m.position.set(x, y, z); m.rotation.y = rotY; g.add(m);
  let last = -1;
  return (time) => { const f = Math.floor(time * fps); if (f === last) return; last = f; draw(cx, cv.width, cv.height, time); t.needsUpdate = true; };
}

export const MODERN_BUILDERS = {
  /* ── 設計市中心：玻璃帷幕的設計中心大樓、市民廣場、噴水池、播放社會網路圖的大螢幕 ── */
  capital(r, K) {
    const { THREE, mesh, mat, animators, sparkles, camNear, hash2 } = K;
    const ctx = K.regionCtx(r), { g, col, ly } = ctx;
    const glass = texMatOf(K, glassTex(K)), facade = texMatOf(K, facadeTex(K), '#f4efe6'), paver = texMatOf(K, paverTex(K), '#e9e4da');
    // 市民廣場
    const plaza = mesh(new THREE.CylinderGeometry(17, 17.4, 0.6, 40), paver, 0, 0.1, 0, g); plaza.receiveShadow = true;
    plaza.geometry.attributes.uv.array.forEach((_, i, a) => { a[i] *= 6; });
    // 主樓：退縮的玻璃塔
    const tower = new THREE.Group(); tower.position.set(0, 0, -5); g.add(tower);
    mesh(boxGeo(K, 9, 16, 9, 2), glass, 0, 8, 0, tower);
    mesh(boxGeo(K, 7, 9, 7, 2), glass, 0, 20.5, 0, tower);
    mesh(new THREE.BoxGeometry(9.4, 0.5, 9.4), mat('#e9edf2'), 0, 16.2, 0, tower);
    mesh(new THREE.BoxGeometry(7.4, 0.8, 7.4), mat(r.color), 0, 25.3, 0, tower);
    mesh(new THREE.CylinderGeometry(0.08, 0.12, 5, 6), mat('#9aa0a8'), 1.8, 28, 1.8, tower);
    const beacon = flatNoShadow(mesh(new THREE.SphereGeometry(0.22, 8, 6), mat('#ff5b4a', { emissive: '#ff3b2a', emissiveIntensity: 1.5 }), 1.8, 30.6, 1.8, tower));
    K.dyn(beacon);
    col(0, -5, 6.6);
    // 低層裙樓：兩翼，正面有大雨遮
    for (const sx of [-1, 1]) {
      mesh(boxGeo(K, 7, 6, 8, 3), facade, sx * 8.5, 3, -3, g); col(sx * 8.5, -3, 4.6);
      mesh(new THREE.BoxGeometry(7.2, 0.4, 8.2), mat('#7c8794'), sx * 8.5, 6.2, -3, g);
    }
    mesh(new THREE.BoxGeometry(8, 0.35, 3.2), mat('#e9edf2'), 0, 4.4, 0.6, g);
    for (const sx of [-3.6, 3.6]) mesh(new THREE.CylinderGeometry(0.16, 0.16, 4.2, 8), mat('#c9ced6'), sx, 2.2, 1.9, g);
    // 設計中心字牌
    const nameT = signTex(K, '設計中心', r.color);
    flatNoShadow(mesh(new THREE.PlaneGeometry(4, 1.5), texMatOf(K, nameT), 0, 5.3, 2.25, g));
    // 噴水池
    const fy = ly(0, 8);
    mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.7, 28), mat('#d6d0c4'), 0, fy + 0.35, 8, g);
    const water = flatNoShadow(mesh(new THREE.CylinderGeometry(2.9, 2.9, 0.1, 28), mat('#6fc3e6', { emissive: '#2a8fc0', emissiveIntensity: 0.3 }), 0, fy + 0.65, 8, g));
    const jets = [0, 1, 2, 3, 4, 5].map((k) => {
      const a = k / 6 * Math.PI * 2;
      return flatNoShadow(mesh(new THREE.CylinderGeometry(0.05, 0.12, 1, 6), mat('#cdefff', { transparent: true, opacity: 0.75 }), Math.cos(a) * 1.4, fy + 1.1, 8 + Math.sin(a) * 1.4, g));
    });
    const center = flatNoShadow(mesh(new THREE.CylinderGeometry(0.1, 0.22, 1, 8), mat('#e6f8ff', { transparent: true, opacity: 0.8 }), 0, fy + 1.6, 8, g));
    sparkles(g, 40, '#bfefff', 2.2, fy + 0.8, fy + 3.4, 0.35, 1.4).position.z = 8;
    col(0, 8, 3.4);
    // 廣場上的樹與長椅、路燈
    for (const [u, v] of [[-13, 6], [13, 6], [-11, -11], [11, -11], [-14, -2], [14, -2]]) { tree(K, g, u, v, ly(u, v), 1.25); col(u, v, 0.6); }
    for (const [u, v, rot] of [[-5, 8, Math.PI / 2], [5, 8, -Math.PI / 2]]) bench(K, g, u, v, ly(u, v), rot);
    for (const [u, v] of [[-7, 13], [7, 13], [-15.5, 9], [15.5, 9]]) lamp(K, g, u, v, ly(u, v));
    // 大螢幕：社會網路圖一筆一筆連起來（社會網路分析）
    const pts = Array.from({ length: 14 }, (_, i) => [0.12 + hash2(i, 1) * 0.76, 0.15 + hash2(i, 2) * 0.7]);
    const links = []; pts.forEach((p, i) => pts.forEach((q, j) => { if (j > i && Math.hypot(p[0] - q[0], (p[1] - q[1]) * 0.6) < 0.26) links.push([i, j]); }));
    const screen = ledScreen(K, g, 6, 3.4, 0, 12, -0.44, 0, (c, w, h, time) => {
      c.fillStyle = '#0d2238'; c.fillRect(0, 0, w, h);
      const n = Math.floor((time * 2) % (links.length + 8));
      c.strokeStyle = '#ffd36b'; c.lineWidth = 2;
      links.slice(0, n).forEach(([a, b]) => { c.beginPath(); c.moveTo(pts[a][0] * w, pts[a][1] * h); c.lineTo(pts[b][0] * w, pts[b][1] * h); c.stroke(); });
      pts.forEach((p, i) => { const deg = links.slice(0, n).filter((l) => l.includes(i)).length; c.fillStyle = deg > 2 ? '#ff8a3d' : '#ffffff'; c.beginPath(); c.arc(p[0] * w, p[1] * h, 4 + deg * 1.6, 0, Math.PI * 2); c.fill(); });
      c.fillStyle = '#9fd1ff'; c.font = '700 13px sans-serif'; c.fillText('SOCIAL NETWORK · LIVE', 10, 18);
    });
    screen(0);
    mesh(new THREE.BoxGeometry(6.4, 3.8, 0.3), mat('#2b2f36'), 0, 12, -0.65, g);
    animators.push((t) => {
      beacon.visible = Math.floor(t * 1.5) % 2 === 0;
      if (!camNear(r, 220)) return;
      screen(t);
      jets.forEach((j, i) => { const k = 1 + Math.sin(t * 3 + i) * 0.35; j.scale.y = k; j.position.y = fy + 0.7 + k * 0.5; });
      center.scale.y = 2 + Math.sin(t * 2) * 0.5; center.position.y = fy + 0.7 + center.scale.y * 0.5;
      water.rotation.y += 0.002;
    });
  },

  /* ── 運算科技園區：玻璃辦公大樓、閃爍的資料中心、會思考的 AI 立方體 ── */
  forest(r, K) {
    const { THREE, mesh, mat, animators, camNear, sparkles, hash2 } = K;
    const ctx = K.regionCtx(r), { g, col, ly, clear } = ctx;
    const glass = texMatOf(K, glassTex(K), '#cfe8f0'), roofGreen = mat('#6fae4f'), white = mat('#eef1f4');
    // 三棟辦公大樓
    for (const [u, v, w, h, d] of [[-9, -5, 7, 12, 7], [9, -4, 6, 9, 8], [0, -11, 10, 7, 6]]) {
      mesh(boxGeo(K, w, h, d, 2.2), glass, u, h / 2, v, g);
      mesh(new THREE.BoxGeometry(w + 0.2, 0.5, d + 0.2), white, u, h + 0.25, v, g);
      mesh(new THREE.BoxGeometry(w - 0.8, 0.3, d - 0.8), roofGreen, u, h + 0.6, v, g);
      col(u, v, Math.max(w, d) * 0.6);
    }
    // 太陽能板
    for (let k = 0; k < 4; k++) { const p = mesh(new THREE.BoxGeometry(1.6, 0.08, 1.1), mat('#29466e'), -10.5 + (k % 2) * 2.2, 12.9, -6.2 + Math.floor(k / 2) * 2.2, g); p.rotation.x = -0.4; }
    // 資料中心：一排機櫃燈號閃爍
    const dc = new THREE.Group(); dc.position.set(10, ly(10, 6), 6); g.add(dc);
    mesh(new THREE.BoxGeometry(5, 3.2, 3.2), mat('#3b4048'), 0, 1.6, 0, dc);
    const ledGeo = new THREE.BoxGeometry(0.16, 0.08, 0.04), leds = [];
    for (let i = 0; i < 40; i++) { const m = flatNoShadow(mesh(ledGeo, mat('#3ef08a', { emissive: '#3ef08a', emissiveIntensity: 1.4 }), -2.1 + (i % 10) * 0.46, 0.6 + Math.floor(i / 10) * 0.6, 1.62, dc)); leds.push(m); }
    col(10, 6, 2.9);
    // AI 立方體：玻璃方塊裡的神經網路球
    const cy = ly(-4, 4);
    mesh(new THREE.BoxGeometry(3.6, 0.5, 3.6), mat('#c9ced6'), -4, cy + 0.25, 4, g);
    const cube = flatNoShadow(mesh(new THREE.BoxGeometry(3, 3, 3), mat('#bfe6ff', { transparent: true, opacity: 0.35, emissive: '#3aa0ff', emissiveIntensity: 0.25 }), -4, cy + 2.3, 4, g));
    K.dyn(cube);
    const brain = new THREE.Group(); brain.position.set(-4, cy + 2.3, 4); g.add(brain);
    const nodeM = mat('#ffffff', { emissive: '#3ee6ff', emissiveIntensity: 1.3 }), nodes = [];
    for (let i = 0; i < 18; i++) {
      const a = i * 2.4, y = (hash2(i, 3) - 0.5) * 1.6, rad = 0.4 + hash2(i, 5) * 0.6;
      nodes.push(flatNoShadow(mesh(new THREE.SphereGeometry(0.1, 6, 5), nodeM, Math.cos(a) * rad, y, Math.sin(a) * rad, brain)));
    }
    brain.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(nodes.flatMap((a, i) => nodes.filter((b, j) => j > i && a.position.distanceTo(b.position) < 0.8).flatMap((b) => [a.position, b.position]))),
      new THREE.LineBasicMaterial({ color: '#7fe8ff', transparent: true, opacity: 0.6 })));
    col(-4, 4, 2.2);
    // 園區草坪的小樹
    for (let k = 1, n = 0; n < 12 && k < 300; k++) {
      const a = hash2(k, 1.3) * Math.PI * 2, d = 9 + hash2(k, 2.1) * 9, u = Math.cos(a) * d, v = Math.sin(a) * d;
      if (!clear(u, v, 2)) continue; tree(K, g, u, v, ly(u, v), 0.9 + hash2(k, 4) * 0.4, '#3f8f4f'); col(u, v, 0.6); n++;
    }
    lamp(K, g, -6, 13, ly(-6, 13)); lamp(K, g, 6, 13, ly(6, 13));
    sparkles(brain, 30, '#9ff4ff', 1.4, -1.2, 1.4, 0.25, 0.6);
    animators.push((t, dt) => {
      if (!camNear(r)) return;
      leds.forEach((l, i) => { l.visible = hash2(i, Math.floor(t * 4 + i * 0.3)) > 0.3; });
      brain.rotation.y += dt * 0.6;
      nodes.forEach((m, i) => m.scale.setScalar(1 + Math.max(0, Math.sin(t * 3 - i * 0.7)) * 0.8));
      cube.rotation.y = Math.sin(t * 0.4) * 0.2;
    });
  },

  /* ── 環控綠能社區：稜線上的風力發電機、綠屋頂住宅、植生牆大樓、空氣品質看板 ── */
  valley(r, K) {
    const { THREE, mesh, mat, animators, camNear } = K;
    const ctx = K.regionCtx(r), { g, col, ly } = ctx;
    const wall = mat('#f4efe6'), grassRoof = mat('#6fbf4f'), wood = mat('#b98a5a');
    // 風力發電機（在山谷稜線上）
    const rotors = [];
    for (const [u, v] of [[-16, -16], [0, -22], [16, -16], [-22, 2], [22, 2]]) {
      const y = ly(u, v), tw = new THREE.Group(); tw.position.set(u, y, v); g.add(tw);
      mesh(new THREE.CylinderGeometry(0.22, 0.42, 14, 8), mat('#f4f6f8'), 0, 7, 0, tw);
      mesh(new THREE.BoxGeometry(0.7, 0.7, 1.6), mat('#f4f6f8'), 0, 14.2, 0, tw);
      const hub = new THREE.Group(); hub.position.set(0, 14.2, 0.9); tw.add(hub); K.dyn(hub);
      for (let k = 0; k < 3; k++) { const bl = mesh(new THREE.BoxGeometry(0.35, 5.6, 0.1), mat('#ffffff'), 0, 2.8, 0, new THREE.Group()); const arm = bl.parent; arm.rotation.z = k * Math.PI * 2 / 3; hub.add(arm); }
      tw.rotation.y = Math.atan2(-u, -v); // 葉片朝向谷地中心
      rotors.push(hub); col(u, v, 0.6);
    }
    // 綠屋頂住宅
    for (const [u, v, rot] of [[-9, -2, 0.3], [9, -2, -0.3], [-6, -10, 0.1], [6, -10, -0.1]]) {
      const h = new THREE.Group(); h.position.set(u, ly(u, v), v); h.rotation.y = rot; g.add(h);
      mesh(new THREE.BoxGeometry(4.4, 3, 4), wall, 0, 1.5, 0, h);
      mesh(new THREE.BoxGeometry(4.8, 0.5, 4.4), grassRoof, 0, 3.25, 0, h);
      mesh(new THREE.BoxGeometry(1, 1.8, 0.1), wood, 0.8, 0.9, 2.02, h);
      flatNoShadow(mesh(new THREE.BoxGeometry(1.2, 0.9, 0.1), mat('#9fd1ff', { emissive: '#ffe9b0', emissiveIntensity: 0.25 }), -1, 1.8, 2.02, h));
      for (let k = 0; k < 3; k++) flatNoShadow(mesh(new THREE.IcosahedronGeometry(0.35, 0), mat('#4f9a45'), -1.6 + k * 1.6, 3.7, -1.2 + k * 0.8, h));
      col(u, v, 2.8);
    }
    // 植生牆大樓（中央）
    mesh(new THREE.BoxGeometry(5, 9, 5), wall, 0, 4.5, -4, g);
    const greenWall = ctex(K, 'greenwall', 64, 64, (c, w, h) => {
      c.fillStyle = '#4f9a45'; c.fillRect(0, 0, w, h);
      for (let k = 0; k < 90; k++) { c.fillStyle = ['#6fbf4f', '#3d7f37', '#8fd16a', '#e6c84f'][k % 4]; c.beginPath(); c.arc((k * 37) % w, (k * 53) % h, 3 + (k % 3), 0, Math.PI * 2); c.fill(); }
    });
    flatNoShadow(mesh(new THREE.PlaneGeometry(4.6, 8.4), texMatOf(K, greenWall), 0, 4.6, -1.48, g));
    mesh(new THREE.BoxGeometry(5.4, 0.4, 5.4), grassRoof, 0, 9.2, -4, g);
    col(0, -4, 3.4);
    // 空氣品質看板：PM2.5、CO2、溫溼度即時跳動
    const board = ledScreen(K, g, 3.2, 2, 7, 3.4, 5, -0.5, (c, w, h, time) => {
      c.fillStyle = '#12301f'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#bfffd8'; c.font = '700 20px sans-serif'; c.fillText('室內空氣品質', 12, 26);
      [['PM2.5', 8 + Math.sin(time) * 3, 35, '#5affa0'], ['CO2', 620 + Math.sin(time * 0.7) * 80, 1000, '#ffd36b'], ['濕度', 55 + Math.sin(time * 0.5) * 5, 100, '#7fd8ff']].forEach(([k, v, max, cc], i) => {
        const y = 48 + i * 30; c.fillStyle = '#cfe'; c.font = '600 15px sans-serif'; c.fillText(k, 12, y + 12);
        c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(70, y, 130, 14); c.fillStyle = cc; c.fillRect(70, y, 130 * v / max, 14);
        c.fillStyle = '#fff'; c.fillText(String(Math.round(v)), 208, y + 12);
      });
    }, 4);
    mesh(new THREE.BoxGeometry(0.2, 3, 0.2), mat('#3b4048'), 7.2, 1.5, 4.6, g);
    mesh(new THREE.BoxGeometry(3.4, 2.2, 0.15), mat('#2b2f36'), 7, 3.4, 4.88, g).rotation.y = -0.5;
    // 分類回收站
    ['#3a8ee6', '#46b35b', '#f2c230', '#e5484d'].forEach((c, i) => { mesh(new THREE.BoxGeometry(0.8, 1.1, 0.8), mat(c), -8.5 + i * 0.95, ly(-7, 5) + 0.55, 5, g); });
    col(-7, 5, 2);
    animators.push((t, dt) => {
      rotors.forEach((h, i) => { h.rotation.z += dt * (1.2 + i * 0.1); });
      if (camNear(r)) board(t);
    });
  },

  /* ── 創客工藝村：鋸齒屋頂的老倉庫、貨櫃工作室、機械手臂、搭建中的木構涼亭 ── */
  workshop(r, K) {
    const { THREE, mesh, mat, animators, camNear } = K;
    const ctx = K.regionCtx(r), { g, col, ly } = ctx;
    const brick = texMatOf(K, brickTex(K), '#c7674a'), roofM = mat('#5c6068'), wood = K.texMat('wood', '#c8945a', 1);
    // 鋸齒屋頂倉庫
    const wh = new THREE.Group(); wh.position.set(0, 0, -8); g.add(wh);
    mesh(boxGeo(K, 16, 6, 9, 2.5), brick, 0, 3, 0, wh);
    for (let k = 0; k < 4; k++) {
      const tooth = mesh(new THREE.CylinderGeometry(1.6, 1.6, 9, 3), roofM, -6 + k * 4, 7, 0, wh);
      tooth.rotation.set(Math.PI / 2, 0, 0); tooth.scale.set(1.25, 1, 0.9);
      flatNoShadow(mesh(new THREE.PlaneGeometry(1.8, 8.6), mat('#bfe6ff', { emissive: '#ffd99a', emissiveIntensity: 0.2, side: THREE.DoubleSide }), -6 + k * 4 + 0.7, 7.3, 0, wh)).rotation.set(-Math.PI / 2, 0.95, Math.PI / 2);
    }
    mesh(new THREE.BoxGeometry(4, 4, 0.2), mat('#3b4048'), 0, 2, 4.55, wh);
    flatNoShadow(mesh(new THREE.PlaneGeometry(5, 1.3), texMatOf(K, signTex(K, '創客基地', r.color)), 0, 5, 4.6, wh));
    col(-5, -8, 4.6); col(0, -8, 4.6); col(5, -8, 4.6);
    // 貨櫃工作室
    for (const [u, v, c, rot] of [[-11, 2, '#2f6fbf', 0.2], [-10, 5.2, '#e0623a', 0.15], [11, 1, '#3f9a5a', -0.25]]) {
      const ct = new THREE.Group(); ct.position.set(u, ly(u, v), v); ct.rotation.y = rot; g.add(ct);
      mesh(new THREE.BoxGeometry(6, 2.6, 2.4), mat(c), 0, 1.3, 0, ct);
      for (let k = -2; k <= 2; k++) mesh(new THREE.BoxGeometry(0.08, 2.5, 2.45), mat(c, { emissive: '#000000' }), k * 1.2, 1.3, 0, ct);
      flatNoShadow(mesh(new THREE.PlaneGeometry(1.6, 1.4), mat('#bfe6ff', { emissive: '#ffd99a', emissiveIntensity: 0.3 }), 1.4, 1.4, 1.21, ct));
      col(u, v, 3);
    }
    // 機械手臂（數位製造）
    const base = new THREE.Group(); base.position.set(7, ly(7, -1), -1); g.add(base);
    mesh(new THREE.BoxGeometry(3, 0.8, 3), mat('#2b2f36'), 0, 0.4, 0, base);
    mesh(new THREE.BoxGeometry(1.4, 1.2, 1), mat('#c8945a'), 1.3, 1.4, 0, base);
    const a0 = K.dyn(new THREE.Group()); a0.position.y = 0.8; base.add(a0);
    mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.6, 12), mat('#f2a33a'), 0, 0.3, 0, a0);
    const a1 = new THREE.Group(); a1.position.y = 0.6; a0.add(a1);
    mesh(new THREE.BoxGeometry(0.45, 2.4, 0.45), mat('#f2a33a'), 0, 1.2, 0, a1);
    const a2 = new THREE.Group(); a2.position.y = 2.4; a1.add(a2);
    mesh(new THREE.BoxGeometry(0.35, 1.8, 0.35), mat('#f2a33a'), 0, 0.9, 0, a2);
    const tip = flatNoShadow(mesh(new THREE.ConeGeometry(0.15, 0.4, 8), mat('#ffffff', { emissive: '#7fd8ff', emissiveIntensity: 1.2 }), 0, 1.9, 0, a2));
    tip.rotation.x = Math.PI;
    col(7, -1, 1.8);
    // 搭建中的木構涼亭（實構築）：柱子先立，樑一根根架上去
    const pav = new THREE.Group(); pav.position.set(-6, ly(-6, 0), 0); g.add(pav);
    for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) { mesh(new THREE.BoxGeometry(0.35, 3.4, 0.35), wood, x, 1.7, z, pav); }
    const beams = [[0, 3.5, -2, 4.6, 0], [0, 3.5, 2, 4.6, 0], [-2, 3.8, 0, 4.6, Math.PI / 2], [2, 3.8, 0, 4.6, Math.PI / 2], [0, 4.1, 0, 4.6, Math.PI / 4]]
      .map(([x, y, z, L, rot]) => { const b = K.dyn(mesh(new THREE.BoxGeometry(L, 0.3, 0.3), wood, x, y, z, pav)); b.rotation.y = rot; return b; });
    col(-6, 0, 2.6);
    // 木料堆
    for (let k = 0; k < 6; k++) mesh(new THREE.BoxGeometry(3, 0.3, 0.3), wood, 1 + (k % 3) * 0.35, ly(1, 6) + 0.15 + Math.floor(k / 3) * 0.3, 6 + (k % 3) * 0.35, g);
    lamp(K, g, -5, 13, ly(-5, 13), '#ffd99a'); lamp(K, g, 5, 13, ly(5, 13), '#ffd99a');
    animators.push((t) => {
      if (!camNear(r)) return;
      a0.rotation.y = Math.sin(t * 0.7) * 1.2;
      a1.rotation.z = -0.4 + Math.sin(t * 1.1) * 0.35;
      a2.rotation.z = -1 + Math.sin(t * 1.3 + 1) * 0.5;
      tip.material.emissiveIntensity = 0.6 + Math.abs(Math.sin(t * 12)) * 1.2;
      const c = t % 10;
      beams.forEach((b, i) => { const k = Math.min(1, Math.max(0, (c - i * 1.4) / 0.8)); b.visible = k > 0 && c < 9.2; b.position.y = [3.5, 3.5, 3.8, 3.8, 4.1][i] + (1 - k) * 2; });
    });
  },

  /* ── 共創商店街：騎樓街屋、招牌與遮陽棚、週末市集攤位與燈串 ── */
  market(r, K) {
    const { THREE, mesh, mat, animators, camNear } = K;
    const ctx = K.regionCtx(r), { g, col, ly } = ctx;
    const shops = [['咖啡', '#6b4a2f', '#f4e3c8'], ['書店', '#2f6fbf', '#e6eef8'], ['設計', r.color, '#f8ecec'], ['花店', '#3f9a5a', '#eaf6ea'], ['麵包', '#c8794a', '#f8efe2'], ['選物', '#7a5ad8', '#efeaf8']];
    // 街屋排成 U 字形，騎樓都面向中間的市集廣場
    const spots = [[-8.5, -10, 0], [0, -11, 0], [8.5, -10, 0], [-14, -2.5, Math.PI / 2], [14, -2.5, -Math.PI / 2], [14, 5.5, -Math.PI / 2]];
    shops.forEach(([name, c, wallC], i) => {
      const [u, v, rot] = spots[i];
      const h = new THREE.Group(); h.position.set(u, ly(u, v), v); h.rotation.y = rot; g.add(h);
      mesh(boxGeo(K, 8, 9, 6, 3), texMatOf(K, facadeTex(K), wallC), 0, 4.5, 0, h);
      mesh(new THREE.BoxGeometry(8.2, 0.4, 6.2), mat('#8b8f96'), 0, 9.2, 0, h);
      // 騎樓：一樓內縮，正面兩根柱子
      mesh(new THREE.BoxGeometry(8, 3, 0.2), mat('#3b4048'), 0, 1.5, 1.8, h);
      flatNoShadow(mesh(new THREE.PlaneGeometry(6.6, 2.4), mat('#ffe6b0', { emissive: '#ffcf7a', emissiveIntensity: 0.4 }), 0, 1.4, 1.92, h));
      for (const sx of [-3.8, 3.8]) mesh(new THREE.BoxGeometry(0.5, 3.2, 0.5), mat('#e9e4da'), sx, 1.6, 3, h);
      const aw = mesh(new THREE.BoxGeometry(7.6, 0.15, 1.6), mat(c), 0, 3.3, 3.6, h); aw.rotation.x = 0.25;
      flatNoShadow(mesh(new THREE.PlaneGeometry(3.2, 1.2), texMatOf(K, signTex(K, name, c)), 0, 4.6, 3.02, h));
      col(u, v, 4);
    });
    // 市集攤位（廣場在靠近導師的前方）
    const tents = [];
    for (const [u, v, c] of [[-6, 2, '#e5484d'], [6, 2, '#3a8ee6'], [-7, -4, '#f2c230'], [7, -4, '#46b35b']]) {
      const t = new THREE.Group(); t.position.set(u, ly(u, v), v); g.add(t);
      for (const [x, z] of [[-1.2, -1], [1.2, -1], [-1.2, 1], [1.2, 1]]) mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), mat('#e9e4da'), x, 1.2, z, t);
      const roof = mesh(new THREE.ConeGeometry(2.1, 1, 4), mat(c), 0, 2.9, 0, t); roof.rotation.y = Math.PI / 4;
      mesh(new THREE.BoxGeometry(2.4, 0.9, 1.6), mat('#b07a45'), 0, 0.45, 0, t);
      ['#ffd36b', '#e5484d', '#46b35b'].forEach((cc, i) => mesh(new THREE.SphereGeometry(0.2, 8, 6), mat(cc), -0.6 + i * 0.6, 1.05, 0, t));
      col(u, v, 1.8); tents.push(t);
    }
    // 燈串
    const bulbs = [];
    const bulbMat = [mat('#fff1c4', { emissive: '#ffcf6b', emissiveIntensity: 1.2 }), mat('#ffd6e0', { emissive: '#ff8fa8', emissiveIntensity: 1.2 })];
    for (const [a, b] of [[[-6, 2], [6, 2]], [[-7, -4], [-6, 2]], [[6, 2], [7, -4]], [[-7, -4], [7, -4]]]) {
      const ya = ly(...a) + 3.4, yb = ly(...b) + 3.4;
      for (let k = 0; k <= 12; k++) {
        const s = k / 12, u = a[0] + (b[0] - a[0]) * s, v = a[1] + (b[1] - a[1]) * s, y = ya + (yb - ya) * s - Math.sin(s * Math.PI) * 0.6;
        bulbs.push(flatNoShadow(mesh(new THREE.SphereGeometry(0.11, 6, 4), bulbMat[k % 2], u, y, v, g)));
      }
    }
    for (const [u, v] of [[-5, 13], [5, 13], [-10, 9], [10, 9]]) lamp(K, g, u, v, ly(u, v));
    animators.push((t) => {
      if (!camNear(r)) return;
      bulbs.forEach((b, i) => { b.scale.setScalar(0.85 + Math.max(0, Math.sin(t * 3 + i * 0.6)) * 0.4); });
    });
  },

  /* ── 色彩文創園區：蒙德里安色塊美術館、彩色貨櫃工作室、旋轉彩帶雕塑、品牌看板 ── */
  plateau(r, K) {
    const { THREE, mesh, mat, animators, camNear } = K;
    const ctx = K.regionCtx(r), { g, col, ly } = ctx;
    const white = mat('#f6f4f0');
    // 美術館：白色量體＋原色窗格
    mesh(new THREE.BoxGeometry(12, 7, 8), white, 0, 3.5, -9, g);
    mesh(new THREE.BoxGeometry(7, 4, 6), white, 3, 9, -9.5, g);
    [[-4, 4, 3, 3, '#e5484d'], [-0.5, 2.5, 3.5, 2, '#f2c230'], [3, 5, 2, 3, '#2f6fbf'], [4.8, 2, 1.6, 2.4, '#1d1a18']].forEach(([x, y, w, h, c]) => flatNoShadow(mesh(new THREE.PlaneGeometry(w, h), mat(c), x, y, -4.98, g)));
    flatNoShadow(mesh(new THREE.PlaneGeometry(4.6, 1.3), texMatOf(K, signTex(K, '美術館', '#1d1a18')), 3, 9.4, -6.48, g));
    col(-3, -9, 4.4); col(3, -9, 4.4);
    // 彩色貨櫃工作室（堆疊）
    [['#e5484d', -11, 0, -1], ['#f2c230', -11, 2.6, -1], ['#2f6fbf', -13.6, 0, -1], ['#46b35b', 11, 0, -1], ['#e05d8c', 11, 2.6, -1]].forEach(([c, u, y, v]) => {
      const ct = mesh(new THREE.BoxGeometry(2.4, 2.6, 6), mat(c), u, ly(u, v) + 1.3 + y, v, g); ct.rotation.y = y ? 0.25 : 0;
    });
    col(-11, -1, 3.4); col(11, -1, 3.4);
    // 旋轉彩帶雕塑
    const sc = new THREE.Group(); sc.position.set(0, ly(0, 2), 2); g.add(sc);
    mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.6, 20), white, 0, 0.3, 0, sc);
    const ribbon = K.dyn(new THREE.Group()); ribbon.position.y = 0.6; sc.add(ribbon);
    const cols = ['#e5484d', '#f2a33a', '#f2c230', '#46b35b', '#3a8ee6', '#7a5ad8'];
    for (let k = 0; k < 18; k++) {
      const seg = mesh(new THREE.BoxGeometry(1.6, 0.35, 0.2), mat(cols[k % 6]), Math.cos(k * 0.6) * 0.6, k * 0.32, Math.sin(k * 0.6) * 0.6, ribbon);
      seg.rotation.y = -k * 0.6;
    }
    col(0, 2, 1.6);
    // 品牌看板：色票與標誌輪播（品牌形象）
    const bb = ledScreen(K, g, 4.4, 2.6, -7.5, 4.6, 6.5, 0.45, (c, w, h, time) => {
      const k = Math.floor(time / 2.5) % 3;
      c.fillStyle = ['#ffffff', '#1d1a18', '#f4efe6'][k]; c.fillRect(0, 0, w, h);
      const brand = ['#e05d8c', '#46b35b', '#3a8ee6'][k];
      c.fillStyle = brand; c.beginPath(); c.arc(w * 0.28, h / 2, h * 0.28, 0, Math.PI * 2); c.fill();
      c.fillStyle = k === 1 ? '#ffffff' : '#1d1a18'; c.font = '900 30px sans-serif'; c.fillText(['TUT·ID', 'GREEN', 'DESIGN'][k], w * 0.5, h / 2 + 10);
      ['#e05d8c', '#46b35b', '#3a8ee6', '#f2c230'].forEach((cc, i) => { c.fillStyle = cc; c.fillRect(w * 0.5 + i * 22, h * 0.72, 18, 12); });
    }, 4);
    for (const sx of [-1.8, 1.8]) mesh(new THREE.BoxGeometry(0.2, 3.4, 0.2), mat('#3b4048'), -7.5 + sx * Math.cos(0.45), ly(-7.5, 6.5) + 1.7, 6.5 - sx * Math.sin(0.45), g);
    mesh(new THREE.BoxGeometry(4.7, 2.9, 0.2), mat('#2b2f36'), -7.5 - Math.sin(0.45) * 0.12, 4.6, 6.5 - Math.cos(0.45) * 0.12, g).rotation.y = 0.45;
    // 塗鴉牆
    const graffiti = ctex(K, 'graffiti', 128, 64, (c, w, h) => {
      c.fillStyle = '#e9e4da'; c.fillRect(0, 0, w, h);
      cols.forEach((cc, i) => { c.strokeStyle = cc; c.lineWidth = 7; c.beginPath(); c.moveTo(i * 22, h); c.bezierCurveTo(i * 22 + 30, 0, i * 22 + 50, h, i * 22 + 80, 10); c.stroke(); });
      c.fillStyle = '#1d1a18'; c.font = '900 22px sans-serif'; c.fillText('COLOR!', 30, 40);
    });
    mesh(new THREE.BoxGeometry(8, 3, 0.4), white, 8, ly(8, 6) + 1.5, 6, g).rotation.y = -0.4;
    flatNoShadow(mesh(new THREE.PlaneGeometry(7.8, 2.8), texMatOf(K, graffiti), 8 + Math.sin(-0.4) * 0.21, ly(8, 6) + 1.5, 6 + Math.cos(-0.4) * 0.21, g)).rotation.y = -0.4;
    col(8, 6, 2);
    animators.push((t, dt) => {
      ribbon.rotation.y += dt * 0.5;
      if (camNear(r)) bb(t);
    });
  },

  /* ── 全島：樹木、沿路房屋與公寓、路燈、道路標線、少量岩石 ── */
  scenery(pts, K) {
    const { THREE, scene, regions, colliders, isTouch, heightAt, terrainInfo, isClear, hash2, sstep } = K;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    const roads = regions.filter((r) => r.id !== 'capital').map((r) => ({ r, ax: 0, az: 0, bx: r.x, bz: r.z, len: Math.hypot(r.x, r.z), ang: Math.atan2(r.x, r.z) }));
    const roadDist = (x, z) => Math.min(...roads.map((rd) => { const dx = rd.bx, dz = rd.bz, t = Math.max(0, Math.min(1, (x * dx + z * dz) / (dx * dx + dz * dz))); return Math.hypot(x - dx * t, z - dz * t); }));
    // 1. 房屋：沿路 6～16 公尺的點，蓋成街屋與公寓
    const houses = [], trees = [];
    pts.forEach((pt) => {
      const rd = roadDist(pt.x, pt.z);
      if (rd > 5.5 && rd < 15 && pt.nearD > 30 && houses.length < (isTouch ? 60 : 90) && hash2(pt.x, pt.z) < 0.65) houses.push(pt);
      else if (hash2(pt.z, pt.x) < 0.8) trees.push(pt);
    });
    const houseCols = ['#f4efe6', '#e9d8c4', '#dfe6ee', '#f2e2c8', '#e6eae0', '#f6dcd2'], roofCols = ['#b0503a', '#5c6068', '#3f6f9a', '#8a5a36'];
    const bodyM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), K.mat('#ffffff'), houses.length);
    const roofM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.62, 0.62, 1, 3), K.mat('#ffffff'), houses.length);
    const winM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), K.mat('#9fc4e6', { emissive: '#ffe1a0', emissiveIntensity: 0.15 }), houses.length);
    houses.forEach((pt, i) => {
      const rd = roads.reduce((b, rd) => { const t = Math.max(0, Math.min(1, (pt.x * rd.bx + pt.z * rd.bz) / (rd.len * rd.len))); const d = Math.hypot(pt.x - rd.bx * t, pt.z - rd.bz * t); return d < b.d ? { d, rd, t } : b; }, { d: 1e9 });
      // 面向道路
      const fx = rd.rd.bx * rd.t - pt.x, fz = rd.rd.bz * rd.t - pt.z;
      q.setFromAxisAngle(up, Math.atan2(fx, fz));
      const apt = Math.hypot(pt.x, pt.z) < 70 && hash2(pt.x, 9) < 0.35;
      const w = 3 + hash2(i, 1) * 1.5, d = 3 + hash2(i, 2) * 1.2, h = apt ? 7 + hash2(i, 3) * 6 : 2.6 + hash2(i, 4) * 1.4;
      m4.compose(p.set(pt.x, pt.h + h / 2, pt.z), q, s.set(w, h, d)); bodyM.setMatrixAt(i, m4);
      bodyM.setColorAt(i, col.set(houseCols[i % houseCols.length]));
      // 斜屋頂（公寓是平頂，屋頂縮成薄片）
      const rq = q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)));
      m4.compose(p.set(pt.x, pt.h + h + (apt ? 0.1 : 0.6), pt.z), rq, s.set(apt ? 0.2 : 1.6, apt ? d : d + 0.4, w + 0.4)); roofM.setMatrixAt(i, m4);
      roofM.setColorAt(i, col.set(apt ? '#8b8f96' : roofCols[i % roofCols.length]));
      // 正面一排窗
      const off = new THREE.Vector3(0, 0, d / 2 + 0.03).applyQuaternion(q);
      m4.compose(p.set(pt.x + off.x, pt.h + h * 0.55, pt.z + off.z), q, s.set(w * 0.7, Math.min(1, h * 0.25) * (apt ? h / 3 : 1), 0.05)); winM.setMatrixAt(i, m4);
      colliders.push({ x: pt.x, z: pt.z, r: Math.max(w, d) * 0.55 });
    });
    for (const im of [bodyM, roofM, winM]) { im.castShadow = true; im.receiveShadow = true; scene.add(im); }
    // 2. 樹：大部分是闊葉樹，少數針葉
    const trunkM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.32, 1.8, 5), new THREE.MeshStandardMaterial({ color: '#6b4a2f', flatShading: true }), trees.length);
    const crownM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.6, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.85 }), trees.length);
    trees.forEach((pt, i) => {
      const sc = 0.7 + hash2(i, 7) * 0.6;
      q.setFromAxisAngle(up, hash2(i, 8) * 6.28);
      m4.compose(p.set(pt.x, pt.h + 0.9 * sc, pt.z), q, s.set(sc, sc, sc)); trunkM.setMatrixAt(i, m4);
      const pine = i % 4 === 0;
      m4.compose(p.set(pt.x, pt.h + (pine ? 3.4 : 2.9) * sc, pt.z), q, s.set(sc * (pine ? 0.75 : 1.05), sc * (pine ? 1.7 : 0.95), sc * (pine ? 0.75 : 1.05))); crownM.setMatrixAt(i, m4);
      col.set('#4f9a45').lerp(new THREE.Color(pt.near.style.foliage), sstep(50, 22, pt.nearD)).multiplyScalar(0.85 + hash2(i, 9) * 0.3);
      crownM.setColorAt(i, col);
      colliders.push({ x: pt.x, z: pt.z, r: 0.5 * sc + 0.2, tree: true });
    });
    for (const im of [trunkM, crownM]) { im.castShadow = true; im.receiveShadow = true; scene.add(im); }
    // 3. 路燈與道路標線
    const lamps = [], dashes = [];
    roads.forEach((rd) => {
      const dx = rd.bx / rd.len, dz = rd.bz / rd.len;
      for (let d = rd.len * 0.3; d < rd.len * 0.76; d += 2.6) dashes.push({ x: dx * d, z: dz * d, ang: rd.ang });
      for (let d = rd.len * 0.32, k = 0; d < rd.len * 0.74; d += 9, k++) {
        const side = k % 2 ? 1 : -1, x = dx * d + dz * 3.6 * side, z = dz * d - dx * 3.6 * side;
        if (isClear(x, z, 0.4)) lamps.push({ x, z, side, ang: rd.ang });
      }
    });
    const dashM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.04, 1.3), new THREE.MeshBasicMaterial({ color: '#f4f1e6' }), dashes.length);
    dashes.forEach((d, i) => { q.setFromAxisAngle(up, d.ang); m4.compose(p.set(d.x, heightAt(d.x, d.z) + 0.08, d.z), q, s.set(1, 1, 1)); dashM.setMatrixAt(i, m4); });
    scene.add(dashM);
    const poleM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.1, 3.6, 6), K.mat('#3b4048'), lamps.length);
    const headM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.24, 8, 6), K.mat('#fff2c4', { emissive: '#ffd98a', emissiveIntensity: 1.2 }), lamps.length);
    lamps.forEach((l, i) => {
      const y = heightAt(l.x, l.z);
      m4.compose(p.set(l.x, y + 1.8, l.z), q.identity(), s.set(1, 1, 1)); poleM.setMatrixAt(i, m4);
      m4.compose(p.set(l.x, y + 3.7, l.z), q, s.set(1, 1, 1)); headM.setMatrixAt(i, m4);
      colliders.push({ x: l.x, z: l.z, r: 0.25 });
    });
    poleM.castShadow = true; scene.add(poleM, headM);
    // 4. 少量岩石（海邊）
    const rocks = [];
    for (let k = 0; rocks.length < 50 && k < 2000; k++) {
      const a = hash2(k, 0.5) * Math.PI * 2, d = 110 + hash2(k, 1.5) * 35, x = Math.cos(a) * d, z = Math.sin(a) * d, inf = terrainInfo(x, z);
      if (inf.h < 0.2 || inf.h > 6 || !isClear(x, z, 1)) continue;
      rocks.push({ x, z, h: inf.h });
    }
    const rockM = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#9a9a94', flatShading: true }), rocks.length);
    rocks.forEach((rk, i) => { const sc = 0.5 + hash2(i, 3) * 1.1; q.setFromEuler(new THREE.Euler(i, i * 2, 0)); m4.compose(p.set(rk.x, rk.h + sc * 0.3, rk.z), q, s.set(sc * 1.2, sc * 0.8, sc)); rockM.setMatrixAt(i, m4); });
    rockM.castShadow = true; scene.add(rockM);
  }
};
