/* =========================================================================
 * 南應大室研所大冒險 · 賽博龐克未來都市
 * 六個區塊的地標（CYBER_BUILDERS.<區域 id>）與全城的高樓、霓虹樹、道路燈帶、飛行車流（scenery）。
 * 由 main.js 依開場選擇的世界呼叫；K 是 main.js 提供的工具箱（mesh、mat、regionCtx…）。
 * 區域座標系同奇幻世界：local +z 指向中樞，導師站在 local v≈12，所以地標集中在 v < 7 與兩側。
 * ========================================================================= */
const TEX = new Map();
function ctex(K, key, w, h, draw) {
  if (!TEX.has(key)) { const t = K.canvasTex(w, h, draw); t.wrapS = t.wrapT = K.THREE.RepeatWrapping; TEX.set(key, t); }
  return TEX.get(key);
}
function boxGeo(K, w, h, d, unit = 3) {
  const g = new K.THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const size = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * size[f][0] / unit, uv.getY(i) * size[f][1] / unit); }
  return g;
}
const NEON = ['#3ef0ff', '#ff4fd8', '#ffd23e', '#7c5cff', '#4dffb0'];
/* 夜間大樓窗格：深色牆面，零星亮著青、紫、黃的窗 */
/* 建築外牆：淺灰混凝土板＋藍灰玻璃窗帶，窗框是金屬條 */
const windowTex = (K) => ctex(K, 'cyberwin', 64, 64, (c, w, h) => {
  c.fillStyle = '#c4c7cc'; c.fillRect(0, 0, w, h);
  for (let k = 0; k < 60; k++) { const v = 180 + (k * 37) % 40; c.fillStyle = `rgba(${v},${v},${v + 4},.5)`; c.fillRect((k * 23) % w, (k * 41) % h, 2, 2); }
  c.fillStyle = '#9a9ea6'; c.fillRect(0, 31, w, 1); c.fillRect(31, 0, 1, h); // 板縫
  for (let y = 4; y < h; y += 10) for (let x = 4; x < w; x += 10) { c.fillStyle = '#4a5d7e'; c.fillRect(x, y, 6, 5); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x, y, 6, 1); }
});
/* 窗戶的發光貼圖（與外牆窗格對齊）：亮著青、粉、黃、紫的窗，其餘不發光 */
const windowLitTex = (K) => ctex(K, 'cyberwinlit', 64, 64, (c, w, h) => {
  c.fillStyle = '#000000'; c.fillRect(0, 0, w, h);
  for (let y = 4; y < h; y += 10) for (let x = 4; x < w; x += 10) {
    const k = (x * 13 + y * 7) % 11;
    c.fillStyle = k < 5 ? ['#3ef0ff', '#ff7ae0', '#ffe28a', '#b9a8ff', '#9fe8ff'][k] : '#10161f';
    c.fillRect(x, y, 6, 5);
  }
});
/* 拉絲金屬板：直向細紋、板縫與鉚釘 */
const metalTex = (K) => ctex(K, 'metal', 64, 64, (c, w, h) => {
  c.fillStyle = '#d8dce2'; c.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x++) { const v = 200 + ((x * 29) % 37); c.fillStyle = `rgba(${v},${v + 3},${v + 8},.55)`; c.fillRect(x, 0, 1, h); }
  c.fillStyle = '#8f96a2'; c.fillRect(0, 31, w, 2); c.fillRect(31, 0, 2, h);
  c.fillStyle = '#a7aeb9'; for (const [x, y] of [[4, 4], [27, 4], [4, 27], [27, 27], [36, 36], [59, 36], [36, 59], [59, 59]]) { c.beginPath(); c.arc(x, y, 1.6, 0, Math.PI * 2); c.fill(); }
});
/* 清水混凝土：斑點與模板孔 */
const concreteTex = (K) => ctex(K, 'concrete', 64, 64, (c, w, h) => {
  c.fillStyle = '#d4d4d0'; c.fillRect(0, 0, w, h);
  for (let k = 0; k < 140; k++) { const v = 170 + (k * 53) % 70; c.fillStyle = `rgba(${v},${v},${v - 4},.6)`; c.fillRect((k * 31) % w, (k * 17 + k * k) % h, 2, 2); }
  c.fillStyle = '#a9aaa6'; c.fillRect(0, 31, w, 1); c.fillRect(31, 0, 1, h);
  c.fillStyle = '#9c9d99'; for (const [x, y] of [[10, 10], [52, 10], [10, 52], [52, 52]]) { c.beginPath(); c.arc(x, y, 1.8, 0, Math.PI * 2); c.fill(); }
});
/* 科幻建築材質：金屬（偏冷灰藍）與混凝土（暖灰），不用全黑 */
const metal = (K, c = '#a3acbb', o = {}) => K.mat(c, { map: metalTex(K), ...o });
const concrete = (K, c = '#b9bab8') => K.mat(c, { map: concreteTex(K) });
/* 霓虹招牌文字 */
function neonSign(K, text, color, w = 160) {
  return ctex(K, 'neon:' + text + color, w, 56, (c, cw, ch) => {
    c.fillStyle = 'rgba(8,8,20,0.85)'; c.fillRect(0, 0, cw, ch);
    c.strokeStyle = color; c.lineWidth = 3; c.shadowColor = color; c.shadowBlur = 10; c.strokeRect(4, 4, cw - 8, ch - 8);
    c.fillStyle = '#ffffff'; c.font = '900 28px "Noto Sans TC", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowBlur = 14; c.fillText(text, cw / 2, ch / 2 + 1);
  });
}
const glow = (K, c, k = 1.6) => K.mat(c, { emissive: c, emissiveIntensity: k });
const holoMat = (K, c, op = 0.55) => new K.THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: K.THREE.AdditiveBlending, depthWrite: false, side: K.THREE.DoubleSide });
const noShadow = (m) => { m.castShadow = false; return m; };

/* 共用小物件 */
function neonPylon(K, g, u, v, y, c) {
  const { THREE, mesh, mat } = K;
  mesh(new THREE.BoxGeometry(0.22, 3.6, 0.22), metal(K), u, y + 1.8, v, g);
  noShadow(mesh(new THREE.BoxGeometry(0.08, 3.2, 0.26), glow(K, c), u, y + 1.8, v, g));
  noShadow(mesh(new THREE.OctahedronGeometry(0.22), glow(K, c, 2), u, y + 3.8, v, g));
  K.addLight(g, u, y + 3.8, v, c, { pool: 4 });
}
/* 大樓窗格材質：白天只微微發亮，夜裡全亮 */
function windowMat(K) {
  const m = K.mat('#ffffff', { map: windowTex(K), emissiveMap: windowLitTex(K), emissive: '#ffffff', emissiveIntensity: 0.9 });
  m.userData.day = 0.12; m.userData.night = 1.4;
  return m;
}
function tower(K, g, u, v, y, w, h, d, c, unit = 3) {
  const { THREE, mesh, mat } = K;
  mesh(boxGeo(K, w, h, d, unit), windowMat(K), u, y + h / 2, v, g);
  mesh(new THREE.BoxGeometry(w + 0.2, 0.3, d + 0.2), metal(K), u, y + h + 0.15, v, g);
  for (const [x, z, L, rot] of [[0, d / 2 + 0.06, w, 0], [0, -d / 2 - 0.06, w, 0], [w / 2 + 0.06, 0, d, Math.PI / 2], [-w / 2 - 0.06, 0, d, Math.PI / 2]]) {
    const e = noShadow(mesh(new THREE.BoxGeometry(L, 0.12, 0.08), glow(K, c), u + x, y + h + 0.32, v + z, g)); e.rotation.y = rot;
  }
}
function holoScreen(K, g, w, h, x, y, z, rotY, draw, fps = 8) {
  const { THREE } = K;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = Math.round(256 * h / w);
  const cx = cv.getContext('2d'); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  m.position.set(x, y, z); m.rotation.y = rotY; g.add(m);
  let last = -1;
  return { mesh: m, update: (time) => { const f = Math.floor(time * fps); if (f === last) return; last = f; draw(cx, cv.width, cv.height, time); t.needsUpdate = true; } };
}
/* Zaha Hadid 風格的參數化流動高樓：圓角斷面（超橢圓）一層層往上，尺寸起伏、逐層扭轉、
 * 整體 S 形擺動，底部平滑外擴融入地面；回傳外殼幾何與每一圈的頂點（給屋頂與霓虹輪廓線用） */
function fluidSection(k) {
  const flare = (1 - k) ** 7 * 3.2; // 底部外擴
  return {
    a: 4.8 * (1 - k * 0.3) + Math.sin(k * Math.PI * 1.6) * 1.4 + flare,
    b: 3.3 * (1 - k * 0.25) + Math.sin(k * Math.PI * 1.6 + 0.9) * 1.0 + flare * 0.8,
    twist: k * 2.3,
    dx: Math.sin(k * Math.PI * 1.25) * 3.2,
    dz: -Math.sin(k * Math.PI * 0.85) * 1.6
  };
}
function fluidTower(K, H = 38, RINGS = 56, SEG = 56) {
  const { THREE } = K;
  const pos = [], uv = [], idx = [], rings = [];
  const n = 2.5; // 超橢圓指數：越大越方，2 是橢圓
  for (let i = 0; i <= RINGS; i++) {
    const k = i / RINGS, y = k * H, sc = fluidSection(k), ring = [];
    const ct = Math.cos(sc.twist), st = Math.sin(sc.twist);
    for (let j = 0; j <= SEG; j++) {
      const th = j / SEG * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
      const x0 = Math.sign(c) * Math.abs(c) ** (2 / n) * sc.a, z0 = Math.sign(s) * Math.abs(s) ** (2 / n) * sc.b;
      const x = x0 * ct - z0 * st + sc.dx, z = x0 * st + z0 * ct + sc.dz;
      pos.push(x, y, z); uv.push(j / SEG * 14, y / 2.6);
      if (j < SEG) ring.push(new THREE.Vector3(x, y, z));
    }
    rings.push(ring);
  }
  for (let i = 0; i < RINGS; i++) for (let j = 0; j < SEG; j++) {
    const a = i * (SEG + 1) + j, b = a + SEG + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  // 屋頂：最上一圈的扇形面
  const top = rings[RINGS], c = top.reduce((v, p) => v.add(p), new THREE.Vector3()).divideScalar(top.length);
  const cap = new THREE.BufferGeometry().setFromPoints([c, ...top]);
  const ci = []; for (let j = 0; j < top.length; j++) ci.push(0, 1 + ((j + 1) % top.length), 1 + j);
  cap.setIndex(ci); cap.computeVertexNormals();
  return { geo, cap, rings, top: c };
}
/* 流線外殼：白色平滑板帶＋深色水平帶窗；發光貼圖只有窗帶 */
const ribbonTex = (K) => ctex(K, 'ribbon', 64, 64, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ffffff'); g.addColorStop(0.76, '#e6ebf0'); g.addColorStop(0.77, '#5a7494'); g.addColorStop(1, '#3a5070');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(0, 50, w, 1);
  c.fillStyle = 'rgba(200,215,230,.45)'; for (let x = 0; x < w; x += 8) c.fillRect(x, 49, 1, h - 49);
});
const ribbonLitTex = (K) => ctex(K, 'ribbonlit', 64, 64, (c, w, h) => {
  c.fillStyle = '#000000'; c.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 8) { c.fillStyle = (x / 8) % 3 ? '#cfefff' : '#ffd6f4'; c.fillRect(x + 1, 51, 6, h - 53); }
});
/* 地面霓虹格線（中心向外的脈衝） */
function neonGrid(K, ctx, size, c1, cell = 2) {
  const mat = K.groundFX({ time: { value: 0 }, col: { value: new K.THREE.Color(c1) } },
    `uniform float time; uniform vec3 col; varying vec2 vP;
    void main(){
      vec2 gv = abs(fract(vP / ${cell.toFixed(1)}) - 0.5);
      float line = smoothstep(0.46, 0.5, max(gv.x, gv.y));
      float d = length(vP);
      float pulse = smoothstep(0.12, 0.0, abs(fract(d / 14.0 - time * 0.3) - 0.5));
      float a = line * (0.16 + pulse * 0.8) * smoothstep(${(size / 2).toFixed(1)}, ${(size / 2 - 6).toFixed(1)}, d);
      gl_FragColor = vec4(col * a, a);
    }`);
  K.drapedPlane(ctx, 0, 0, size, size, K.isTouch ? 30 : 50, mat);
  return mat;
}

export const CYBER_BUILDERS = {
  /* ── 設計中樞：階梯式巨塔、環繞的全像環、塔頂關係網路球、直衝天際的光柱 ── */
  capital(r, K) {
    const { THREE, mesh, mat, animators, camNear, hash2, sparkles } = K;
    const ctx = K.regionCtx(r), { g, col, ly } = ctx;
    const grid = neonGrid(K, ctx, 44, '#ff4fd8');
    mesh(new THREE.CylinderGeometry(16, 16.6, 0.5, 40), concrete(K, '#c9c9c6'), 0, 0.05, 0, g);
    // 參數化流動高樓（Zaha Hadid 風格）：白色流線外殼、水平帶窗、逐層扭轉的 S 形量體
    const H = 38, ft = fluidTower(K, H);
    const shellM = mat('#ffffff', { map: ribbonTex(K), emissiveMap: ribbonLitTex(K), emissive: '#ffffff', emissiveIntensity: 0.1 });
    shellM.userData.day = 0.06; shellM.userData.night = 1.25;
    const tower = new THREE.Group(); tower.position.set(0, 0, -3); g.add(tower);
    mesh(ft.geo, shellM, 0, 0, 0, tower);
    mesh(ft.cap, mat('#eef1f4'), 0, 0, 0, tower);
    col(0, -3, 7);
    // 霓虹輪廓線：沿著幾圈樓板勾出曲面，夜裡最明顯
    const contours = [10, 20, 30, 40, 48].map((ri, i) => {
      const pts = ft.rings[ri].map((p) => p.clone().multiplyScalar(1.004));
      const line = noShadow(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: NEON[i % 3], transparent: true, opacity: 0.85 })));
      tower.add(line); return line;
    });
    // 流線雨遮：從塔身前方流向廣場、再落回地面的曲面
    (() => {
      const S = 40, W = 8, pos = [], idx = [];
      for (let i = 0; i <= S; i++) {
        const k = i / S, v = -0.5 + k * 11, y = 7.5 * (1 - k) ** 1.6 + Math.sin(k * Math.PI) * 2.2, u0 = Math.sin(k * Math.PI * 1.3) * 1.6, w = W * (1 - k * 0.45);
        for (const side of [-1, 1]) pos.push(u0 + side * w / 2, Math.max(0.1, y + side * 0.6 * Math.sin(k * Math.PI)), v);
      }
      for (let i = 0; i < S; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      return mesh(geo, mat('#f6f8fa', { side: THREE.DoubleSide }), 0, 0, 0, g);
    })();
    // 塔頂關係網路球（社會網路分析）
    const net = new THREE.Group(); net.position.set(ft.top.x, H + 5, ft.top.z - 3); g.add(net);
    const np = Array.from({ length: 16 }, (_, i) => { const a = i * 2.4, y = (hash2(i, 2) - 0.5) * 5, rad = 2 + hash2(i, 3) * 2.2; return new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad); });
    const nodeM = np.map((p) => noShadow(mesh(new THREE.IcosahedronGeometry(0.32, 0), glow(K, '#ffd23e', 2), p.x, p.y, p.z, net)));
    net.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(np.flatMap((a, i) => np.filter((b, j) => j > i && a.distanceTo(b) < 3.4).flatMap((b) => [a, b]))), new THREE.LineBasicMaterial({ color: '#ff9ae8', transparent: true, opacity: 0.8 })));
    // 光柱
    const beam = noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.2, 120, 16, 1, true), holoMat(K, '#3ef0ff', 0.18)));
    beam.position.set(ft.top.x, H + 60, ft.top.z - 3); g.add(beam);
    // 漂浮的全像看板：新使用者歡迎畫面
    const sign = holoScreen(K, g, 7, 3, 0, 13, 7, 0, (c, w, h, time) => {
      c.clearRect(0, 0, w, h); c.fillStyle = 'rgba(30,10,60,0.55)'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#ff4fd8'; c.lineWidth = 3; c.strokeRect(3, 3, w - 6, h - 6);
      c.fillStyle = '#3ef0ff'; c.font = '900 30px sans-serif'; c.textAlign = 'center'; c.fillText('DESIGN NEXUS', w / 2, h * 0.42);
      c.fillStyle = '#ffffff'; c.font = '700 18px sans-serif'; c.fillText(`ONLINE · ${String(Math.floor(time * 7) % 1000).padStart(3, '0')} NODES`, w / 2, h * 0.72);
    });
    // 環狀廣場的霓虹柱
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 + 0.3, u = Math.cos(a) * 15.5, v = Math.sin(a) * 15.5; if (v > 8 && Math.abs(u) < 7) continue; neonPylon(K, g, u, v, ly(u, v), NEON[k % 3]); col(u, v, 0.4); }
    sparkles(g, 120, '#ff9ae8', 16, 1, 30, 0.4, 1.5);
    animators.push((t, dt) => {
      if (!camNear(r, 240)) return;
      grid.uniforms.time.value = t;
      contours.forEach((l, i) => { l.material.opacity = 0.45 + Math.max(0, Math.sin(t * 1.6 - i * 0.9)) * 0.55; });
      net.rotation.y += dt * 0.25;
      nodeM.forEach((m, i) => m.scale.setScalar(1 + Math.max(0, Math.sin(t * 2 - i * 0.7)) * 0.7));
      beam.material.opacity = 0.14 + Math.sin(t * 3) * 0.05;
      sign.update(t); sign.mesh.position.y = 13 + Math.sin(t * 0.8) * 0.3; sign.mesh.material.opacity = Math.random() < 0.03 ? 0.4 : 0.92;
    });
  },

  /* ── 神經網路區：伺服器尖塔林、往上流的資料光、中央神經核心與光纖 ── */
  forest(r, K) {
    const { THREE, mesh, mat, animators, camNear, hash2, sparkles } = K;
    const ctx = K.regionCtx(r), { g, col, ly, clear } = ctx;
    const grid = neonGrid(K, ctx, 40, '#3ef0ff', 1.6);
    // 資料流貼圖
    const streamTex = ctex(K, 'stream', 64, 256, (c, w, h) => {
      for (let k = 0; k < 16; k++) { const x = (k * 37) % w, y = (k * 71) % h, len = 20 + (k * 13) % 50; const gr = c.createLinearGradient(0, y, 0, y + len); gr.addColorStop(0, 'rgba(120,255,255,0)'); gr.addColorStop(1, 'rgba(160,255,255,1)'); c.fillStyle = gr; c.fillRect(x, y, 3, len); }
    });
    const spires = [];
    for (let k = 1, n = 0; n < 9 && k < 400; k++) {
      const a = hash2(k, 4.4) * Math.PI * 2, d = 7 + hash2(k, 2.2) * 12, u = Math.cos(a) * d, v = Math.sin(a) * d;
      if (!clear(u, v, 3)) continue;
      const h = 8 + hash2(k, 1.1) * 10, y = ly(u, v);
      mesh(new THREE.CylinderGeometry(0.5, 1.1, h, 6), metal(K, '#8a94a6'), u, y + h / 2, v, g);
      const st = streamTex.clone(); st.needsUpdate = true; st.repeat.set(2, h / 8);
      const s = noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.56, 1.16, h, 6, 1, true), new THREE.MeshBasicMaterial({ map: st, color: n % 2 ? '#7c5cff' : '#3ef0ff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
      s.position.set(u, y + h / 2, v); g.add(s); spires.push(st);
      noShadow(mesh(new THREE.OctahedronGeometry(0.6), glow(K, n % 2 ? '#c3adff' : '#3ef0ff', 2), u, y + h + 0.8, v, g));
      col(u, v, 1.2); n++;
    }
    // 中央神經核心：三層神經元
    const core = new THREE.Group(); core.position.set(0, 0, -2); g.add(core);
    mesh(new THREE.CylinderGeometry(2.4, 3, 1.2, 8), metal(K), 0, 0.6, 0, core);
    const orb = noShadow(mesh(new THREE.IcosahedronGeometry(2, 1), holoMat(K, '#3ef0ff', 0.35), 0, 6, 0, core));
    const inner = noShadow(mesh(new THREE.IcosahedronGeometry(1.1, 0), glow(K, '#7c5cff', 2), 0, 6, 0, core));
    K.dyn(orb); K.dyn(inner);
    const layers = [[6, 4.2, 3], [6, 3.4, 6], [3, 1.8, 9.5]];
    const lp = layers.map(([n, rad, y], li) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2 + li * 0.5; return new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad); }));
    const neurons = lp.flat().map((p) => noShadow(mesh(new THREE.IcosahedronGeometry(0.26, 0), glow(K, '#ffffff', 1.6), p.x, p.y, p.z, core)));
    const syn = []; for (let l = 0; l < 2; l++) lp[l].forEach((a) => lp[l + 1].forEach((b) => syn.push(a, b)));
    core.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(syn), new THREE.LineBasicMaterial({ color: '#7ff4ff', transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })));
    col(0, -2, 3);
    sparkles(g, 120, '#8ff7ff', 18, 0.5, 16, 0.45, 1.3);
    animators.push((t, dt) => {
      if (!camNear(r)) return;
      grid.uniforms.time.value = t;
      spires.forEach((st, i) => { st.offset.y -= dt * (0.3 + (i % 3) * 0.1); });
      orb.rotation.y += dt * 0.4; inner.rotation.x += dt * 0.8; inner.rotation.y += dt;
      neurons.forEach((m, i) => m.scale.setScalar(1 + Math.max(0, Math.sin(t * 2.4 - i * 0.8)) * 0.6));
    });
  },

  /* ── 大氣處理區：巨型空氣處理塔（頂部風扇）、生態穹頂、排出的淨化氣流 ── */
  valley(r, K) {
    const { THREE, mesh, mat, animators, camNear, sparkles } = K;
    const ctx = K.regionCtx(r), { g, col, ly } = ctx;
    const fans = [];
    for (const [u, v, h] of [[-9, -6, 16], [9, -6, 13], [0, -13, 19]]) {
      const y = ly(u, v), tw = new THREE.Group(); tw.position.set(u, y, v); g.add(tw);
      mesh(new THREE.CylinderGeometry(2.6, 3.4, h, 12), concrete(K, '#aeb0b2'), 0, h / 2, 0, tw);
      for (let k = 1; k < 4; k++) noShadow(mesh(new THREE.TorusGeometry(2.7 + 0.25 * (1 - k / 4), 0.08, 4, 32), glow(K, '#4dffb0'), 0, h * k / 4, 0, tw)).rotation.x = Math.PI / 2;
      mesh(new THREE.CylinderGeometry(2.9, 2.6, 1.2, 16, 1, true), metal(K, '#8e98a8', { side: THREE.DoubleSide }), 0, h + 0.6, 0, tw);
      const fan = K.dyn(new THREE.Group()); fan.position.y = h + 0.8; tw.add(fan);
      for (let k = 0; k < 5; k++) { const b = mesh(new THREE.BoxGeometry(2.4, 0.08, 0.6), mat('#8a93ad'), 1.2, 0, 0, new THREE.Group()); const arm = b.parent; arm.rotation.y = k * Math.PI * 2 / 5; b.rotation.x = 0.4; fan.add(arm); }
      sparkles(tw, 40, '#9dffd0', 2.2, h + 1, h + 12, 0.5, 2.2);
      fans.push(fan); col(u, v, 3.4);
    }
    // 生態穹頂：網格玻璃罩著一片綠地
    const dome = new THREE.Group(); dome.position.set(0, ly(0, 2), 2); g.add(dome);
    mesh(new THREE.CylinderGeometry(4.6, 4.8, 0.5, 24), metal(K), 0, 0.25, 0, dome);
    mesh(new THREE.CylinderGeometry(4.3, 4.3, 0.2, 24), mat('#2f8a5a'), 0, 0.55, 0, dome);
    for (let k = 0; k < 7; k++) { const a = k * 0.9; mesh(new THREE.IcosahedronGeometry(0.6 + (k % 3) * 0.2, 0), mat('#3fbf6a'), Math.cos(a) * 2.4, 1.3, Math.sin(a) * 2.4, dome); }
    noShadow(mesh(new THREE.SphereGeometry(4.4, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), holoMat(K, '#4dffb0', 0.12), 0, 0.5, 0, dome));
    const wire = noShadow(new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(4.45, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)), new THREE.LineBasicMaterial({ color: '#4dffb0', transparent: true, opacity: 0.55 })));
    wire.position.y = 0.5; dome.add(wire);
    col(0, 2, 4.8);
    // 空氣品質全像儀表
    const hud = holoScreen(K, g, 3.6, 2.2, 8, 4, 5, -0.5, (c, w, h, time) => {
      c.clearRect(0, 0, w, h); c.fillStyle = 'rgba(0,40,30,0.6)'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#9dffd0'; c.font = '700 18px sans-serif'; c.fillText('AIR QUALITY', 10, 24);
      [['PM2.5', 6 + Math.sin(time) * 2, 35], ['CO2', 540 + Math.sin(time * 0.8) * 60, 1000], ['VOC', 0.2 + Math.sin(time * 0.6) * 0.1, 1]].forEach(([k, v, max], i) => {
        const y = 44 + i * 28; c.fillStyle = '#cfe'; c.font = '600 14px sans-serif'; c.fillText(k, 10, y + 12);
        c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(70, y, 140, 12); c.fillStyle = '#4dffb0'; c.fillRect(70, y, 140 * v / max, 12);
      });
    }, 4);
    // 回收管線
    for (const [u, rot] of [[-5, 0.2], [5, -0.2]]) { const p = mesh(new THREE.CylinderGeometry(0.35, 0.35, 10, 10), metal(K, '#9099a8'), u, ly(u, -6) + 1, -6, g); p.rotation.set(Math.PI / 2, 0, rot); }
    animators.push((t, dt) => {
      fans.forEach((f, i) => { f.rotation.y += dt * (2.5 + i * 0.4); });
      if (!camNear(r)) return;
      hud.update(t); wire.rotation.y += dt * 0.1;
    });
  },

  /* ── 機械製造區：自動化工廠、機械手臂焊接火花、輸送帶、木構實驗屋 ── */
  workshop(r, K) {
    const { THREE, mesh, mat, animators, camNear, sparkles } = K;
    const ctx = K.regionCtx(r), { g, col, ly } = ctx;
    // 工廠：深色量體＋黃黑警示條＋霓虹招牌
    mesh(boxGeo(K, 16, 7, 8, 2.4), windowMat(K), 0, 3.5, -9, g);
    const hazard = ctex(K, 'hazard', 64, 16, (c, w, h) => { c.fillStyle = '#1d1a18'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd23e'; for (let x = -16; x < w; x += 16) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + 8, 0); c.lineTo(x + 16, 0); c.lineTo(x + 8, h); c.fill(); } });
    hazard.repeat.set(6, 1);
    noShadow(mesh(new THREE.PlaneGeometry(16, 0.8), mat('#ffffff', { map: hazard }), 0, 0.5, -4.98, g));
    noShadow(mesh(new THREE.PlaneGeometry(6, 1.8), mat('#ffffff', { map: neonSign(K, 'FAB-07', '#ff9a3c'), emissiveMap: neonSign(K, 'FAB-07', '#ff9a3c'), emissive: '#ffffff', emissiveIntensity: 1 }), 0, 6, -4.97, g));
    for (let k = 0; k < 3; k++) mesh(new THREE.CylinderGeometry(0.6, 0.8, 5, 10), concrete(K), -5 + k * 5, 9.5, -11, g);
    col(-5, -9, 4.6); col(0, -9, 4.6); col(5, -9, 4.6);
    // 輸送帶：箱子不停往前送
    const belt = new THREE.Group(); belt.position.set(0, ly(0, -2), -2); g.add(belt);
    mesh(new THREE.BoxGeometry(14, 0.6, 1.6), concrete(K), 0, 0.8, 0, belt);
    noShadow(mesh(new THREE.BoxGeometry(14, 0.05, 1.7), glow(K, '#ff9a3c', 1), 0, 0.5, 0, belt));
    const boxes = [0, 1, 2, 3, 4].map((i) => K.dyn(mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), mat(i % 2 ? '#c8945a' : '#3ef0ff'), 0, 1.45, 0, belt)));
    col(-4, -2, 1); col(0, -2, 1); col(4, -2, 1);
    // 兩支機械手臂
    const arms = [-1, 1].map((sx) => {
      const base = new THREE.Group(); base.position.set(sx * 3, ly(sx * 3, 0.5), 0.5); g.add(base);
      mesh(new THREE.CylinderGeometry(0.8, 1, 0.6, 12), concrete(K), 0, 0.3, 0, base);
      const a0 = K.dyn(new THREE.Group()); a0.position.y = 0.6; base.add(a0);
      const a1 = new THREE.Group(); a1.position.y = 0.2; a0.add(a1);
      mesh(new THREE.BoxGeometry(0.4, 2.6, 0.4), mat('#ff9a3c'), 0, 1.3, 0, a1);
      noShadow(mesh(new THREE.BoxGeometry(0.06, 2.4, 0.42), glow(K, '#3ef0ff'), 0.2, 1.3, 0, a1));
      const a2 = new THREE.Group(); a2.position.y = 2.6; a1.add(a2);
      mesh(new THREE.BoxGeometry(0.3, 1.8, 0.3), mat('#ff9a3c'), 0, 0.9, 0, a2);
      const tip = noShadow(mesh(new THREE.SphereGeometry(0.18, 8, 6), glow(K, '#ffffff', 2.4), 0, 1.9, 0, a2));
      const sp = sparkles(a2, 26, '#ffcf6b', 0.6, 1.6, 2.8, 0.3, 2.5);
      col(sx * 3, 0.5, 1);
      return { a0, a1, a2, tip, sp, sx };
    });
    // 木構實驗屋（實構築）
    const wood = K.texMat('wood', '#c8945a', 1);
    const lab = new THREE.Group(); lab.position.set(-11, ly(-11, 3), 3); g.add(lab);
    for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) mesh(new THREE.BoxGeometry(0.35, 3.2, 0.35), wood, x, 1.6, z, lab);
    for (const [x, z, rot] of [[0, -2, 0], [0, 2, 0], [-2, 0, Math.PI / 2], [2, 0, Math.PI / 2]]) mesh(new THREE.BoxGeometry(4.6, 0.3, 0.3), wood, x, 3.3, z, lab).rotation.y = rot;
    for (const sx of [-1, 1]) { const b = mesh(new THREE.BoxGeometry(5.6, 0.25, 0.25), wood, 0, 3.4, 0, lab); b.rotation.set(0, sx * Math.PI / 4, 0); }
    noShadow(mesh(new THREE.BoxGeometry(4.4, 0.06, 4.4), holoMat(K, '#ff9a3c', 0.25), 0, 3.6, 0, lab));
    col(-11, 3, 2.6);
    for (const [u, v] of [[-6, 13], [6, 13], [12, 4]]) { neonPylon(K, g, u, v, ly(u, v), '#ff9a3c'); col(u, v, 0.4); }
    animators.push((t) => {
      if (!camNear(r)) return;
      boxes.forEach((b, i) => { const k = ((t * 0.12 + i / 5) % 1); b.position.x = -6.5 + k * 13; });
      arms.forEach(({ a0, a1, a2, tip, sp, sx }, i) => {
        a0.rotation.y = Math.sin(t * 0.8 + i) * 0.9 * sx;
        a1.rotation.z = (-0.5 + Math.sin(t * 1.2 + i * 2) * 0.3) * sx;
        a2.rotation.z = (-1.1 + Math.sin(t * 1.5 + i) * 0.4) * sx;
        const on = Math.sin(t * 3 + i * 1.7) > 0.3; tip.visible = on; sp.visible = on;
      });
    });
  },

  /* ── 霓虹夜市：霓虹招牌的攤位、懸空燈籠、旋轉全像看板、拉麵攤的蒸氣 ── */
  market(r, K) {
    const { THREE, mesh, mat, animators, camNear, sparkles, hash2 } = K;
    const ctx = K.regionCtx(r), { g, col, ly } = ctx;
    const grid = neonGrid(K, ctx, 40, '#ff5d8f', 2.4);
    // 兩側高樓
    for (const [u, v, w, h, d, c] of [[-13, -8, 6, 16, 6, '#ff5d8f'], [13, -8, 6, 13, 6, '#3ef0ff'], [0, -14, 10, 10, 5, '#ffd23e']]) { tower(K, g, u, v, ly(u, v), w, h, d, c); col(u, v, Math.max(w, d) * 0.6); }
    // 夜市攤位
    const stalls = [['拉麵', '#ff4fd8'], ['設計', r.color], ['AR', '#3ef0ff'], ['奶茶', '#ffd23e'], ['二手', '#4dffb0'], ['社造', '#ff9a3c']];
    stalls.forEach(([name, c], i) => {
      const row = i < 3 ? -1 : 1, k = i % 3, u = -8 + k * 8, v = row < 0 ? -3 : 4;
      const st = new THREE.Group(); st.position.set(u, ly(u, v), v); st.rotation.y = row < 0 ? 0 : Math.PI; g.add(st);
      mesh(new THREE.BoxGeometry(4, 1, 2), concrete(K), 0, 0.5, 0, st);
      noShadow(mesh(new THREE.BoxGeometry(4.05, 0.08, 2.05), glow(K, c, 1.2), 0, 1.02, 0, st));
      for (const sx of [-1.9, 1.9]) mesh(new THREE.BoxGeometry(0.12, 3, 0.12), metal(K), sx, 1.5, -0.9, st);
      mesh(new THREE.BoxGeometry(4.2, 0.15, 2.4), metal(K), 0, 3, -0.2, st);
      const nt = neonSign(K, name, c, 128);
      noShadow(mesh(new THREE.PlaneGeometry(2.2, 0.95), mat('#ffffff', { map: nt, emissiveMap: nt, emissive: '#ffffff', emissiveIntensity: 1.1 }), 0, 3.6, 0, st));
      if (name === '拉麵') sparkles(st, 20, '#ffffff', 0.6, 1.1, 3, 0.4, 0.8);
      col(u, v, 2.2);
    });
    // 懸空燈籠
    const lanterns = [];
    for (let k = 0; k < 14; k++) {
      const u = -12 + k * 1.85, v = 0.5 + Math.sin(k) * 0.6;
      lanterns.push(noShadow(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 8), glow(K, NEON[k % 3], 1.8), u, ly(u, v) + 5.2, v, g)));
    }
    // 旋轉全像看板
    const holo = holoScreen(K, g, 4, 2.4, 0, 9.5, -1, 0, (c, w, h, time) => {
      c.clearRect(0, 0, w, h); c.fillStyle = 'rgba(60,0,40,0.5)'; c.fillRect(0, 0, w, h);
      const k = Math.floor(time / 2) % 3;
      c.fillStyle = ['#ff4fd8', '#3ef0ff', '#ffd23e'][k]; c.font = '900 40px sans-serif'; c.textAlign = 'center';
      c.fillText(['NIGHT', 'MARKET', '2099'][k], w / 2, h * 0.6);
      for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(0, (time * 60 + i * 30) % h, w, 2); }
    });
    for (const [u, v] of [[-15, 9], [15, 9], [-5, 14], [5, 14]]) { neonPylon(K, g, u, v, ly(u, v), NEON[(u > 0) + 0]); col(u, v, 0.4); }
    animators.push((t) => {
      if (!camNear(r)) return;
      grid.uniforms.time.value = t;
      holo.update(t); holo.mesh.rotation.y = t * 0.6;
      lanterns.forEach((l, i) => { l.position.y = ly(l.position.x, l.position.z) + 5.2 + Math.sin(t * 1.5 + i) * 0.2; l.material.emissiveIntensity = 1.4 + hash2(i, Math.floor(t * 6)) * 0.8; });
    });
  },

  /* ── 全像藝術區：漂浮的線框雕塑、品牌全像看板、霓虹拱門、光柱 ── */
  plateau(r, K) {
    const { THREE, mesh, mat, animators, camNear, sparkles } = K;
    const ctx = K.regionCtx(r), { g, col, ly } = ctx;
    const grid = neonGrid(K, ctx, 50, '#c77dff', 2.4);
    // 漂浮雕塑：三個大型線框幾何
    const sculpts = [[new THREE.IcosahedronGeometry(3, 0), -8, 9, -6, '#ff4fd8'], [new THREE.TorusKnotGeometry(2, 0.5, 64, 8), 0, 11, -10, '#3ef0ff'], [new THREE.OctahedronGeometry(2.8, 0), 8, 9, -6, '#ffd23e']].map(([geo, u, y, v, c]) => {
      const s = new THREE.Group(); s.position.set(u, ly(u, v) + y, v); g.add(s);
      s.add(noShadow(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: c }))));
      s.add(noShadow(new THREE.Mesh(geo, holoMat(K, c, 0.18))));
      mesh(new THREE.CylinderGeometry(1.4, 1.8, 1, 8), metal(K), u, ly(u, v) + 0.5, v, g);
      const ped = noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 1.2, y - 1, 12, 1, true), holoMat(K, c, 0.15))); ped.position.set(u, ly(u, v) + 1 + (y - 1) / 2, v); g.add(ped);
      col(u, v, 1.8);
      return s;
    });
    // 霓虹拱門（入口）
    const arch = noShadow(new THREE.Mesh(new THREE.TorusGeometry(5, 0.22, 8, 40, Math.PI), glow(K, '#c77dff', 1.8)));
    arch.position.set(0, ly(0, 5), 5); g.add(arch);
    col(-5, 5, 0.5); col(5, 5, 0.5);
    // 品牌全像看板（品牌形象）：標誌與色票輪播
    const brand = holoScreen(K, g, 5, 3, -11, 6, 4, 0.6, (c, w, h, time) => {
      c.clearRect(0, 0, w, h); const k = Math.floor(time / 2.5) % 3, bc = ['#e05d8c', '#4dffb0', '#3ef0ff'][k];
      c.fillStyle = 'rgba(20,0,40,0.55)'; c.fillRect(0, 0, w, h);
      c.strokeStyle = bc; c.lineWidth = 6; c.beginPath(); c.arc(w * 0.28, h / 2, h * 0.26, 0, Math.PI * 2); c.stroke();
      c.fillStyle = bc; c.font = '900 30px sans-serif'; c.fillText(['TUT·ID', 'ECO', 'BRAND'][k], w * 0.48, h / 2 + 10);
    });
    mesh(new THREE.BoxGeometry(0.3, 4.5, 0.3), metal(K), -11, ly(-11, 4) + 2.25, 4, g); col(-11, 4, 0.5);
    // 風格色票牆（室內美學）
    const swatch = ctex(K, 'swatch', 128, 64, (c, w, h) => {
      ['#e8d3a8', '#6b6b6b', '#9fb57a', '#c9a227', '#c77dff', '#3ef0ff', '#ff4fd8', '#f4efe6'].forEach((cc, i) => { c.fillStyle = cc; c.fillRect((i % 4) * 32 + 2, Math.floor(i / 4) * 32 + 2, 28, 28); });
    });
    noShadow(mesh(new THREE.PlaneGeometry(6, 3), mat('#ffffff', { map: swatch, emissiveMap: swatch, emissive: '#ffffff', emissiveIntensity: 0.6 }), 11, ly(11, 3) + 2.4, 3, g)).rotation.y = -0.6;
    mesh(new THREE.BoxGeometry(6.4, 3.4, 0.2), metal(K), 11 + Math.sin(-0.6) * -0.15, ly(11, 3) + 2.4, 3 - Math.cos(-0.6) * 0.15, g).rotation.y = -0.6;
    col(11, 3, 2);
    sparkles(g, 120, '#e6b8ff', 22, 1, 18, 0.45, 1);
    animators.push((t, dt) => {
      sculpts.forEach((s, i) => { s.rotation.y += dt * (0.3 + i * 0.15); s.rotation.x += dt * 0.12; });
      if (!camNear(r)) return;
      grid.uniforms.time.value = t;
      brand.update(t);
      arch.material.emissiveIntensity = 1.4 + Math.sin(t * 4) * 0.4;
    });
  },

  /* ── 全城：夜間高樓、霓虹樹、道路燈帶、全像廣告與飛行車流 ── */
  scenery(pts, K) {
    const { THREE, scene, regions, colliders, isTouch, heightAt, hash2, sstep, animators } = K;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    // 1. 高樓：離區域較遠的點蓋大樓，其餘種霓虹樹
    const towers = [], trees = [];
    pts.forEach((pt, i) => {
      if (pt.nearD > 34 && towers.length < (isTouch ? 70 : 120) && hash2(pt.x, pt.z) < 0.4) towers.push(pt);
      else if (i % 3 === 0) trees.push(pt);
    });
    // 依高度分四組，每組用預先縮放好 UV 的方塊，窗格才不會被拉長
    const towerMat = new THREE.MeshStandardMaterial({ map: windowTex(K), emissiveMap: windowLitTex(K), emissive: '#ffffff', emissiveIntensity: 0.85, roughness: 0.55, metalness: 0.15 });
    towerMat.userData.day = 0.12; towerMat.userData.night = 1.4;
    const BUCKET = [10, 18, 26, 37], bucketOf = (h) => BUCKET.findIndex((b) => h <= b + 2);
    const specs = towers.map((pt, i) => ({ pt, i, w: 3 + hash2(i, 1) * 3, d: 3 + hash2(i, 2) * 3, h: 7 + hash2(i, 3) ** 2 * 30 * sstep(150, 60, Math.hypot(pt.x, pt.z)) }));
    BUCKET.forEach((bh, bi) => {
      const list = specs.filter((sp) => (bucketOf(sp.h) < 0 ? 3 : bucketOf(sp.h)) === bi);
      if (!list.length) return;
      const im = new THREE.InstancedMesh(boxGeo(K, 4.5, bh, 4.5, 2.6), towerMat, list.length);
      list.forEach(({ pt, i, w, d, h }, k) => {
        q.setFromAxisAngle(up, hash2(i, 4) * 1.5);
        m4.compose(p.set(pt.x, pt.h + h / 2, pt.z), q, s.set(w / 4.5, h / bh, d / 4.5)); im.setMatrixAt(k, m4);
        im.setColorAt(k, col.set(['#ffffff', '#e6ecf5', '#f2efe8'][i % 3]));
      });
      im.castShadow = true; im.receiveShadow = true; scene.add(im);
    });
    const capM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), towers.length);
    specs.forEach(({ pt, i, w, d, h }) => {
      q.setFromAxisAngle(up, hash2(i, 4) * 1.5);
      m4.compose(p.set(pt.x, pt.h + h + 0.15, pt.z), q, s.set(w + 0.1, 0.25, d + 0.1)); capM.setMatrixAt(i, m4);
      capM.setColorAt(i, col.set(NEON[i % NEON.length]));
      colliders.push({ x: pt.x, z: pt.z, r: Math.max(w, d) * 0.6 });
    });
    scene.add(capM);
    // 2. 霓虹樹：細樹幹＋發光的錐形樹冠
    const trunkM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.2, 2, 5), new THREE.MeshStandardMaterial({ color: '#8a93a3', roughness: 0.5, metalness: 0.4 }), trees.length);
    const crownM = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 2.6, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, toneMapped: false }), trees.length);
    trees.forEach((pt, i) => {
      const sc = 0.7 + hash2(i, 6) * 0.6;
      m4.compose(p.set(pt.x, pt.h + sc, pt.z), q.identity(), s.set(sc, sc, sc)); trunkM.setMatrixAt(i, m4);
      m4.compose(p.set(pt.x, pt.h + 3.2 * sc, pt.z), q, s.set(sc, sc, sc)); crownM.setMatrixAt(i, m4);
      crownM.setColorAt(i, col.set(pt.near.style.foliage).lerp(new THREE.Color('#3ef0ff'), sstep(22, 60, pt.nearD) * 0.6).multiplyScalar(0.7));
      colliders.push({ x: pt.x, z: pt.z, r: 0.4 * sc + 0.2, tree: true });
    });
    trunkM.castShadow = true; scene.add(trunkM, crownM);
    // 3. 道路兩側的燈帶（青、洋紅）
    const strips = [];
    regions.filter((r) => r.id !== 'capital').forEach((r) => {
      const len = Math.hypot(r.x, r.z), dx = r.x / len, dz = r.z / len, ang = Math.atan2(r.x, r.z);
      for (let d = len * 0.3; d < len * 0.76; d += 1.6) for (const side of [-1, 1]) {
        const x = dx * d + dz * 2.6 * side, z = dz * d - dx * 2.6 * side;
        strips.push({ x, z, ang, c: side < 0 ? '#3ef0ff' : '#ff4fd8' });
      }
    });
    const stripM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.08, 1.1), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), strips.length);
    strips.forEach((st, i) => {
      q.setFromAxisAngle(up, st.ang); m4.compose(p.set(st.x, heightAt(st.x, st.z) + 0.1, st.z), q, s.set(1, 1, 1)); stripM.setMatrixAt(i, m4); stripM.setColorAt(i, col.set(st.c));
      if (i % 6 === 0) K.addLight(null, st.x, heightAt(st.x, st.z) + 0.3, st.z, st.c, { pool: 4.5, noHalo: true }); // 夜裡路面映出霓虹
    });
    scene.add(stripM);
    // 4. 飛行車流：沿幾條環狀航道飛行
    const N = isTouch ? 14 : 26, cars = [];
    const carM = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.45, 1.4, 4, 8), new THREE.MeshStandardMaterial({ color: '#c3c8d0', metalness: 0.5, roughness: 0.35, emissive: '#3ef0ff', emissiveIntensity: 0.4 }), N);
    const tailM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.18, 0.1), new THREE.MeshBasicMaterial({ color: '#ff4fd8', toneMapped: false }), N);
    for (let i = 0; i < N; i++) cars.push({ rad: 45 + (i % 5) * 18, y: 28 + (i % 4) * 7, a: hash2(i, 9) * Math.PI * 2, sp: (0.05 + hash2(i, 10) * 0.05) * (i % 2 ? 1 : -1) });
    scene.add(carM, tailM);
    const rot = new THREE.Quaternion(), tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    const updCars = (t) => {
      cars.forEach((c, i) => {
        const a = c.a + t * c.sp, x = Math.cos(a) * c.rad, z = Math.sin(a) * c.rad, dir = Math.sign(c.sp);
        rot.setFromAxisAngle(up, -a + (dir > 0 ? 0 : Math.PI)).multiply(tilt);
        m4.compose(p.set(x, c.y, z), rot, s.set(1, 1, 1)); carM.setMatrixAt(i, m4);
        const back = new THREE.Vector3(0, -1.2, 0).applyQuaternion(rot);
        m4.compose(p.set(x + back.x, c.y + back.y, z + back.z), rot, s.set(1, 1, 1)); tailM.setMatrixAt(i, m4);
      });
      carM.instanceMatrix.needsUpdate = true; tailM.instanceMatrix.needsUpdate = true;
    };
    updCars(0);
    animators.push((t) => updCars(t));
  }
};
