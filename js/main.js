/* =========================================================================
 * 南應室研大陸 · 主程式
 * Three.js 建構的奇幻大陸：地形、六大區域地標、導師 NPC、
 * 「導覽模式」（點擊飛行）與「探險模式」（操控角色走動），以及所有介面。
 * 師資與區域內容請改 data/faculty.js，不需要動這個檔案。
 * ========================================================================= */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const W = window.WORLD;
const $ = (s) => document.querySelector(s);
const isTouch = window.matchMedia('(pointer: coarse)').matches;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- 世界常數 ---------- */
const ISLAND_R = 112;
const REGION_DIST = 64;
const RUNE = {
  capital: 'THE CAPITAL', forest: 'FOREST OF CODE', valley: 'VALE OF WINDS',
  workshop: "ARTISANS' HAMLET", ruins: 'ANCIENT RUINS', plateau: 'CHROMA PLATEAU'
};
const GROUND = { capital: '#93c45f', forest: '#2f8a72', valley: '#86c25a', workshop: '#b9a066', ruins: '#9b95a9', plateau: '#d98fb2' };
const FOLIAGE = { capital: '#4f8f45', forest: '#2a6e66', valley: '#5e9c3e', workshop: '#c9863e', ruins: '#7b8a5e', plateau: '#e7a3c3' };
const FLOOR = { capital: 3.2, forest: 3.0, valley: 2.4, workshop: 2.8, ruins: 3.6, plateau: 11 };
const FLAT = { capital: [27, 16], forest: [22, 10], valley: [17, 10], workshop: [22, 15], ruins: [22, 15], plateau: [30, 21] };

/* ---------- 資料前處理 ---------- */
const regions = W.regions;
const RG = {};
regions.forEach((r) => {
  const a = THREE.MathUtils.degToRad(r.angle || 0);
  if (r.id === 'capital') { r.x = 0; r.z = 0; r.toward = new THREE.Vector2(0, 1); }
  else {
    r.x = Math.sin(a) * REGION_DIST; r.z = -Math.cos(a) * REGION_DIST;
    r.toward = new THREE.Vector2(-Math.sin(a), Math.cos(a)); // 指向王都
  }
  r.floor = FLOOR[r.id] ?? 3;
  r.flat = FLAT[r.id] ?? [22, 14];
  r.col = new THREE.Color(r.color);
  r.ground = new THREE.Color(GROUND[r.id] ?? '#7fb35a');
  r.teachers = [];
  RG[r.id] = r;
});
const faculty = W.faculty;
faculty.forEach((f, i) => { f.index = i; (RG[f.region] || RG.capital).teachers.push(f); });

/* ---------- 雜訊與地形高度 ---------- */
function hash2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123; return s - Math.floor(s); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) { let s = 0, amp = 0.5, f = 1; for (let i = 0; i < 4; i++) { s += amp * vnoise(x * f, y * f); f *= 2.03; amp *= 0.5; } return s; }
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return [Math.hypot(px - (ax + dx * t), pz - (az + dz * t)), t];
}
function coastR(x, z) {
  const ang = Math.atan2(z, x);
  return ISLAND_R * (0.9 + 0.07 * Math.sin(ang * 3 + 1.3) + 0.04 * Math.sin(ang * 7 + 0.4))
    + (fbm(Math.cos(ang) * 1.7 + 5, Math.sin(ang) * 1.7 + 5) - 0.45) * 14;
}
function terrainInfo(x, z) {
  const d = Math.hypot(x, z);
  const cr = coastR(x, z);
  const land = sstep(cr, cr - 16, d);
  let h = 1.6 + fbm(x * 0.028 + 10, z * 0.028 + 10) * 6 + fbm(x * 0.11, z * 0.11) * 0.9;
  h += sstep(40, 90, d) * 3 * fbm(x * 0.05 + 3, z * 0.05 + 7);
  let near = RG.capital, nearD = 1e9;
  for (const r of regions) {
    const rd = Math.hypot(x - r.x, z - r.z);
    if (r.id === 'valley') h += sstep(13, 19, rd) * sstep(31, 23, rd) * (5 + 4 * fbm(x * 0.09, z * 0.09));
    const w = sstep(r.flat[0], r.flat[1], rd);
    if (r.id === 'forest') h = lerp(h, r.floor + fbm(x * 0.15, z * 0.15) * 1.2, w * 0.85);
    else h = lerp(h, r.floor + (r.id === 'plateau' ? fbm(x * 0.2, z * 0.2) * 0.5 : 0), w);
    if (rd < nearD) { nearD = rd; near = r; }
  }
  let pathW = 0;
  for (const r of regions) {
    if (r.id === 'capital') continue;
    const [pd, t] = segDist(x, z, 0, 0, r.x, r.z);
    if (pd < 6) {
      const target = lerp(RG.capital.floor, r.floor, sstep(0.25, 0.8, t));
      h = lerp(h, target, sstep(6, 2.6, pd));
      pathW = Math.max(pathW, sstep(3.2, 1.6, pd) * sstep(0.25, 0.3, t) * sstep(0.83, 0.76, t));
    }
  }
  h = h * land + (1 - land) * -5;
  return { h, pathW: pathW * land, near, nearD };
}
const heightAt = (x, z) => terrainInfo(x, z).h;

/* ---------- 渲染器 ---------- */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  $('#webgl-error').hidden = false; $('#loading').classList.add('done');
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.75 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
$('#stage').appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer({ element: $('#labels') });
labelRenderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#ead2b2', 170, 430);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 1500);
camera.position.set(0, 125, 175);

/* ---------- 天空、海、光 ---------- */
{
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(700, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color('#3a72b5') }, mid: { value: new THREE.Color('#f5d6ae') }, bot: { value: new THREE.Color('#2a6f8f') } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vW; void main(){ float h = normalize(vW).y; vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.55)) : mix(mid, bot, pow(-h, 0.4)); gl_FragColor = vec4(c, 1.0); }'
    })
  );
  scene.add(sky);

  const water = new THREE.Mesh(
    new THREE.CircleGeometry(520, 72),
    new THREE.MeshStandardMaterial({ color: '#2f86a6', roughness: 0.3, metalness: 0.1 })
  );
  water.rotation.x = -Math.PI / 2; water.position.y = 0.05; water.receiveShadow = true;
  scene.add(water);

  scene.add(new THREE.HemisphereLight('#d6e6ff', '#5b4a36', 1.5));
  const sun = new THREE.DirectionalLight('#ffe0b5', 2.6);
  sun.position.set(-90, 130, 70);
  sun.castShadow = true;
  const sc = sun.shadow.camera;
  sc.left = -135; sc.right = 135; sc.top = 135; sc.bottom = -135; sc.near = 10; sc.far = 420;
  sun.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.5;
  scene.add(sun);
}

/* ---------- 共用工具 ---------- */
const MATS = new Map();
function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!MATS.has(key)) MATS.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, ...o }));
  return MATS.get(key);
}
function mesh(geo, m, x = 0, y = 0, z = 0, parent = null) {
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true;
  if (parent) parent.add(me);
  return me;
}
const animators = [];
const colliders = [];
const npcSlots = [];

const dotTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

function sparkles(parent, count, color, radius, y0, y1, size = 0.45, speed = 1) {
  const pos = new Float32Array(count * 3); const seed = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * radius;
    pos[i * 3] = Math.cos(a) * d; pos[i * 3 + 1] = y0 + Math.random() * (y1 - y0); pos[i * 3 + 2] = Math.sin(a) * d;
    seed.push(0.4 + Math.random());
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  parent.add(pts);
  animators.push((t, dt) => {
    const p = geo.attributes.position;
    for (let i = 0; i < count; i++) {
      let y = p.getY(i) + dt * seed[i] * speed;
      if (y > y1) y = y0;
      p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(t * seed[i] + i) * dt * 0.3);
    }
    p.needsUpdate = true;
  });
  return pts;
}

function isClear(x, z, pad) {
  for (const s of npcSlots) if (Math.hypot(x - s.x, z - s.z) < pad + 1.8) return false;
  for (const c of colliders) if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return false;
  return terrainInfo(x, z).pathW < 0.05;
}

/* 每個區域的區域座標系：local +z 指向王都（訪客來的方向） */
function regionCtx(r) {
  const baseY = heightAt(r.x, r.z);
  const fx = r.toward.x, fz = r.toward.y;
  const g = new THREE.Group();
  g.position.set(r.x, baseY, r.z);
  g.rotation.y = Math.atan2(fx, fz);
  scene.add(g);
  const P = (u, v) => [r.x + u * fz + v * fx, r.z - u * fx + v * fz];
  return {
    g, baseY, P,
    ly: (u, v) => { const [x, z] = P(u, v); return heightAt(x, z) - baseY; },
    col: (u, v, rad) => { const [x, z] = P(u, v); colliders.push({ x, z, r: rad }); },
    clear: (u, v, pad) => { const [x, z] = P(u, v); return isClear(x, z, pad); }
  };
}

/* ---------- 地形網格 ---------- */
{
  const SIZE = 280, SEG = isTouch ? 170 : 220;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const infos = new Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const inf = terrainInfo(pos.getX(i), pos.getZ(i));
    infos[i] = inf; pos.setY(i, inf.h);
  }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  const grass = new THREE.Color('#78ad55'), sand = new THREE.Color('#e7d39c'), wet = new THREE.Color('#b9a675');
  const rock = new THREE.Color('#8d8273'), path = new THREE.Color('#dcc58e'), pink = new THREE.Color('#eeb2cc');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const { h, pathW, near, nearD } = infos[i];
    const x = pos.getX(i), z = pos.getZ(i);
    c.copy(grass).lerp(near.ground, sstep(38, 12, nearD) * 0.78);
    if (near.id === 'plateau' && h > 9.5) c.lerp(pink, 0.35);
    const ny = nrm.getY(i);
    c.lerp(rock, sstep(0.84, 0.6, ny));
    c.lerp(sand, sstep(1.5, 0.6, h));
    c.lerp(wet, sstep(0.2, -1.5, h));
    c.lerp(path, pathW * 0.9);
    const j = 0.93 + hash2(x * 3.1, z * 1.7) * 0.12;
    col[i * 3] = c.r * j; col[i * 3 + 1] = c.g * j; col[i * 3 + 2] = c.b * j;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
  terrain.receiveShadow = true;
  scene.add(terrain);
}

/* ---------- NPC 站位（先算好，讓裝飾物避開） ---------- */
regions.forEach((r) => {
  const n = r.teachers.length;
  const base = Math.atan2(r.toward.y, r.toward.x);
  const radius = r.id === 'capital' ? 19.5 : 12;
  const spread = r.id === 'capital' ? 0.38 : 0.45;
  r.teachers.forEach((f, i) => {
    const a = base + (i - (n - 1) / 2) * spread;
    const slot = { x: r.x + Math.cos(a) * radius, z: r.z + Math.sin(a) * radius, fx: Math.cos(a), fz: Math.sin(a), f };
    f.slot = slot; npcSlots.push(slot);
  });
  // 訪客抵達點（探險模式傳送用）
  const ad = r.id === 'capital' ? 31 : 23;
  r.approach = { x: r.x + r.toward.x * ad, z: r.z + r.toward.y * ad };
});

/* =========================================================================
 * 區域地標
 * ========================================================================= */
function buildCapital(r) {
  const { g, col } = regionCtx(r);
  const stone = mat('#e8dcc2'), stone2 = mat('#c9ba9b'), roof = mat('#b5452f'), gold = mat('#e2b45c', { metalness: 0.45, roughness: 0.4 });
  const win = mat('#3a2614', { emissive: '#ffb347', emissiveIntensity: 0.7 });
  mesh(new THREE.CylinderGeometry(15.5, 17, 1.4, 8), stone2, 0, 0.3, 0, g);
  const R = 13.2;
  const flags = [];
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + Math.PI / 8;
    const x = Math.sin(a) * R, z = Math.cos(a) * R;
    mesh(new THREE.CylinderGeometry(1.7, 1.95, 8, 8), stone, x, 4.5, z, g);
    mesh(new THREE.ConeGeometry(2.4, 3.6, 8), roof, x, 10.3, z, g);
    col(x, z, 2.3);
    if (i === 0 || i === 7) {
      const banner = mesh(new THREE.PlaneGeometry(1.5, 3.6), mat(r.color, { side: THREE.DoubleSide }), x * 1.15, 5.2, z * 1.15, g);
      banner.rotation.y = a; flags.push(banner);
    }
  }
  const WR = R * Math.cos(Math.PI / 8), WL = 2 * R * Math.sin(Math.PI / 8);
  for (let i = 0; i < 8; i++) {
    const m = i * Math.PI / 4;
    const x = Math.sin(m) * WR, z = Math.cos(m) * WR;
    if (i === 0) {
      const side = (WL - 4.6) / 2;
      for (const s of [-1, 1]) {
        mesh(new THREE.BoxGeometry(side, 5, 1.4), stone, x + (2.3 + side / 2) * s, 3.1, z, g);
        col(x + (2.3 + side / 2) * s, z, 1.4);
      }
      mesh(new THREE.BoxGeometry(5.4, 1.8, 1.8), stone2, x, 6.3, z, g);
      continue;
    }
    const w = mesh(new THREE.BoxGeometry(WL, 5, 1.4), stone, x, 3.1, z, g); w.rotation.y = m;
    for (let k = -2; k <= 2; k++) {
      const cr = mesh(new THREE.BoxGeometry(1, 0.9, 1.5), stone, x + Math.cos(m) * k * 1.9, 6.05, z - Math.sin(m) * k * 1.9, g);
      cr.rotation.y = m;
    }
    for (let k = -1; k <= 1; k++) col(x + Math.cos(m) * k * 3.2, z - Math.sin(m) * k * 3.2, 1.7);
  }
  // 主堡
  mesh(new THREE.BoxGeometry(9, 9, 9), stone, 0, 5.5, 0, g);
  mesh(new THREE.ConeGeometry(6.9, 3.6, 4), roof, 0, 11.8, 0, g).rotation.y = Math.PI / 4;
  for (const [x, z] of [[4.2, 4.2], [-4.2, 4.2], [4.2, -4.2], [-4.2, -4.2]]) {
    mesh(new THREE.CylinderGeometry(0.95, 1.05, 3.4, 8), stone, x, 11.4, z, g);
    mesh(new THREE.ConeGeometry(1.35, 2.2, 8), roof, x, 14.2, z, g);
  }
  mesh(new THREE.CylinderGeometry(2.1, 2.5, 9, 10), stone, 0, 15.5, 0, g);
  mesh(new THREE.ConeGeometry(3.1, 5.2, 10), gold, 0, 22.6, 0, g);
  mesh(new THREE.CylinderGeometry(0.08, 0.08, 4, 5), mat('#5b4a3a'), 0, 27, 0, g);
  const pennant = mesh(new THREE.PlaneGeometry(2.6, 1.2), mat(r.color, { side: THREE.DoubleSide, emissive: r.color, emissiveIntensity: 0.25 }), 1.3, 28.2, 0, g);
  for (const [x, y, z] of [[0, 7, 4.55], [-2.6, 7, 4.55], [2.6, 7, 4.55], [0, 17, 2.45], [4.55, 7, 0], [-4.55, 7, 0]]) {
    const w = mesh(new THREE.BoxGeometry(z ? 1 : 0.2, 1.6, z ? 0.2 : 1), win, x, y, z, g); w.castShadow = false;
  }
  col(0, 0, 7.4);
  animators.push((t) => {
    flags.forEach((f, i) => { f.rotation.z = Math.sin(t * 1.6 + i) * 0.06; });
    pennant.rotation.y = Math.sin(t * 2.1) * 0.35;
  });
}

function buildForest(r) {
  const { g, ly, col, clear } = regionCtx(r);
  const trunk = mat('#3b2d48');
  const glowA = mat('#68f3f3', { emissive: '#22d3e0', emissiveIntensity: 0.95, roughness: 0.2, transparent: true, opacity: 0.93 });
  const glowB = mat('#c3adff', { emissive: '#7c5cff', emissiveIntensity: 0.85, roughness: 0.2 });
  mesh(new THREE.CylinderGeometry(0.9, 1.9, 11, 7), trunk, 0, 5.5, 0, g);
  for (const [rx, rz, y] of [[0.9, 0.3, 7.5], [-0.8, -0.5, 8], [0.2, 1, 9]]) {
    const b = mesh(new THREE.CylinderGeometry(0.25, 0.45, 5, 5), trunk, 0, y, 0, g);
    b.rotation.set(rx, 0, rz); b.position.x = rz * -2.2; b.position.z = rx * 2.2;
  }
  const crowns = [];
  [[0, 12.5, 0, 4.2], [2.8, 10.4, 1.4, 2.4], [-2.6, 10.8, -1.3, 2.6], [0.6, 15.6, -0.6, 2.3], [-1.2, 13, 2.4, 1.8]].forEach(([x, y, z, s], i) => {
    const c = mesh(new THREE.IcosahedronGeometry(s, 0), i % 2 ? glowB : glowA, x, y, z, g);
    c.castShadow = false; c.userData.y = y; crowns.push(c);
  });
  col(0, 0, 2.6);
  const ringMat = new THREE.MeshBasicMaterial({ color: '#8ffcff', transparent: true, opacity: 0.75, side: THREE.DoubleSide });
  const ring1 = new THREE.Mesh(new THREE.RingGeometry(6.2, 6.6, 6), ringMat);
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(4.2, 4.45, 48), ringMat);
  for (const rg of [ring1, ring2]) { rg.rotation.x = -Math.PI / 2; rg.position.y = 0.2; g.add(rg); }
  const small = [];
  for (let tries = 1, placed = 0; placed < 24 && tries < 500; tries++) {
    const a = hash2(tries, 7.7) * Math.PI * 2, d = 8 + hash2(tries, 3.3) * 16;
    const u = Math.cos(a) * d, v = Math.sin(a) * d;
    if (!clear(u, v, 2.6)) continue;
    const hgt = 2.4 + hash2(tries, 1.1) * 3.4, y = ly(u, v);
    mesh(new THREE.CylinderGeometry(0.16, 0.32, hgt, 5), trunk, u, y + hgt / 2, v, g);
    const c = mesh(new THREE.OctahedronGeometry(0.8 + hash2(tries, 9) * 0.8, 0), placed % 3 ? glowA : glowB, u, y + hgt + 0.9, v, g);
    c.scale.y = 1.7; c.castShadow = false; c.userData.y = c.position.y; small.push(c);
    col(u, v, 0.7); placed++;
  }
  const cubes = new THREE.Group(); cubes.position.y = 0; g.add(cubes);
  const cubeMat = mat('#c4fdff', { emissive: '#3ee6ff', emissiveIntensity: 1.3 });
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2, rad = 4.8 + (i % 4) * 1.5;
    const c = mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), cubeMat, Math.cos(a) * rad, 5 + (i % 7) * 1.4, Math.sin(a) * rad, cubes);
    c.castShadow = false;
  }
  sparkles(g, 140, '#8ff7ff', 18, 0.5, 16, 0.5, 1.2);
  animators.push((t, dt) => {
    crowns.forEach((c, i) => { c.position.y = c.userData.y + Math.sin(t * 1.2 + i) * 0.25; c.rotation.y += dt * 0.3; });
    small.forEach((c, i) => { c.position.y = c.userData.y + Math.sin(t * 1.5 + i * 0.7) * 0.18; c.rotation.y += dt * 0.6; });
    ring1.rotation.z += dt * 0.15; ring2.rotation.z -= dt * 0.25;
    cubes.rotation.y += dt * 0.22;
    cubes.children.forEach((c, i) => { c.rotation.x += dt * (0.5 + i % 3 * 0.3); c.rotation.y += dt * 0.4; });
  });
}

function buildValley(r) {
  const { g, ly, col } = regionCtx(r);
  const white = mat('#f1ebdf'), green = mat('#4f7d3a'), sail = mat('#efe2c4', { side: THREE.DoubleSide }), dark = mat('#4a3b2c');
  function windmill(u, v, s) {
    const w = new THREE.Group(); w.position.set(u, ly(u, v), v); w.scale.setScalar(s);
    w.rotation.y = Math.atan2(-u, -v) + Math.PI; // 面向區域中心外側
    g.add(w);
    mesh(new THREE.CylinderGeometry(0.9, 1.55, 8, 6), white, 0, 4, 0, w);
    mesh(new THREE.ConeGeometry(1.45, 1.9, 6), green, 0, 8.9, 0, w);
    mesh(new THREE.BoxGeometry(0.9, 1.4, 0.1), dark, 0, 0.7, 1.25, w).rotation.x = -0.12;
    const hub = new THREE.Group(); hub.position.set(0, 7.5, 1.25); w.add(hub);
    mesh(new THREE.SphereGeometry(0.38, 8, 6), dark, 0, 0, 0, hub);
    for (let k = 0; k < 4; k++) {
      const piv = new THREE.Group(); piv.rotation.z = k * Math.PI / 2; hub.add(piv);
      mesh(new THREE.BoxGeometry(0.1, 5.3, 0.1), dark, 0, 2.7, 0, piv);
      mesh(new THREE.BoxGeometry(0.85, 4.4, 0.05), sail, 0.48, 3, 0, piv);
    }
    const speed = 0.9 + hash2(u, v) * 0.8;
    animators.push((t, dt) => { hub.rotation.z += dt * speed; });
    col(u, v, 1.7 * s);
  }
  windmill(-6, -5, 1); windmill(6.5, -3, 0.9); windmill(-1, -11, 1.15);
  windmill(-19, -13, 0.85); windmill(20, -9, 0.85); windmill(-23, 4, 0.75);
  // 氣象觀測桅杆
  const mast = new THREE.Group(); mast.position.set(9, ly(9, 4), 4); g.add(mast);
  mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6), mat('#c9ccd1', { metalness: 0.5, roughness: 0.4 }), 0, 3.5, 0, mast);
  const cups = new THREE.Group(); cups.position.y = 7.2; mast.add(cups);
  for (let k = 0; k < 3; k++) {
    const arm = mesh(new THREE.BoxGeometry(1.4, 0.06, 0.06), dark, 0.7, 0, 0);
    const piv = new THREE.Group(); piv.rotation.y = k * Math.PI * 2 / 3; piv.add(arm); cups.add(piv);
    mesh(new THREE.SphereGeometry(0.22, 8, 6, 0, Math.PI), mat('#e05d5d'), 1.4, 0, 0, piv);
  }
  col(9, 4, 0.6);
  animators.push((t, dt) => { cups.rotation.y += dt * 3; });
  // 可見的氣流
  const N = 320, pos = new Float32Array(N * 3), prm = [];
  for (let i = 0; i < N; i++) prm.push({ rad: 4 + Math.random() * 16, ph: Math.random() * Math.PI * 2, h: 1.5 + Math.random() * 8, sp: 4 + Math.random() * 5 });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: '#f2fff4', size: 0.42, map: dotTex, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })));
  animators.push((t) => {
    const p = geo.attributes.position;
    for (let i = 0; i < N; i++) {
      const q = prm[i], a = q.ph + t * q.sp / q.rad;
      p.setXYZ(i, Math.cos(a) * q.rad, q.h + Math.sin(a * 2 + i) * 1.1, Math.sin(a) * q.rad);
    }
    p.needsUpdate = true;
  });
}

function buildWorkshop(r) {
  const { g, ly, col } = regionCtx(r);
  const plaster = mat('#efe0c2'), timber = mat('#7a4d2c'), roofM = mat('#9c4a2e'), roof2 = mat('#6e5a43'), oak = mat('#b07444'), win = mat('#3a2614', { emissive: '#ffb347', emissiveIntensity: 0.6 });
  function house(u, v, w, d, h, rot, roofMat) {
    const hs = new THREE.Group(); hs.position.set(u, ly(u, v), v); hs.rotation.y = rot; g.add(hs);
    mesh(new THREE.BoxGeometry(w, h, d), plaster, 0, h / 2, 0, hs);
    for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.25, h, 0.25), timber, s * (w / 2 - 0.05), h / 2, d / 2 + 0.02, hs);
    mesh(new THREE.BoxGeometry(w, 0.25, 0.25), timber, 0, h * 0.55, d / 2 + 0.05, hs);
    const sh = new THREE.Shape(); sh.moveTo(-w / 2 - 0.4, 0); sh.lineTo(w / 2 + 0.4, 0); sh.lineTo(0, h * 0.7); sh.closePath();
    const rg = new THREE.ExtrudeGeometry(sh, { depth: d + 0.6, bevelEnabled: false }); rg.translate(0, 0, -(d + 0.6) / 2);
    mesh(rg, roofMat, 0, h, 0, hs);
    const wn = mesh(new THREE.BoxGeometry(1, 1, 0.1), win, w * 0.22, h * 0.45, d / 2 + 0.06, hs); wn.castShadow = false;
    mesh(new THREE.BoxGeometry(1.1, 1.9, 0.1), timber, -w * 0.2, 0.95, d / 2 + 0.06, hs);
    col(u, v, Math.max(w, d) * 0.62);
    return hs;
  }
  const hall = house(0, -4, 10, 7, 5.2, 0, roofM);
  const chimney = mesh(new THREE.BoxGeometry(1, 3, 1), mat('#8a7a6a'), 3, 7.2, -1.5, hall);
  house(-13, -2, 5, 4.4, 3.4, 0.5, roof2); house(12.5, -5, 5.5, 4.6, 3.6, -0.45, roofM);
  house(-9, -14, 4.6, 4.2, 3.2, 0.2, roofM); house(8, -15, 5, 4, 3.4, -0.25, roof2);
  // 巨型椅子雕塑（家具設計）
  const chair = new THREE.Group(); chair.position.set(-8, ly(-8, 5), 5); chair.rotation.y = 0.5; g.add(chair);
  mesh(new THREE.BoxGeometry(3.2, 0.45, 3), oak, 0, 2.3, 0, chair);
  for (const [x, z] of [[-1.35, -1.25], [1.35, -1.25], [-1.35, 1.25], [1.35, 1.25]]) mesh(new THREE.BoxGeometry(0.35, 2.1, 0.35), oak, x, 1.05, z, chair);
  mesh(new THREE.BoxGeometry(3.2, 0.4, 0.35), oak, 0, 5.4, -1.3, chair);
  for (const x of [-1.35, -0.45, 0.45, 1.35]) mesh(new THREE.BoxGeometry(0.22, 2.8, 0.22), oak, x, 3.95, -1.3, chair);
  col(-8, 5, 2.3);
  // 木材堆與工作台
  for (let k = 0; k < 6; k++) {
    const lg = mesh(new THREE.CylinderGeometry(0.42, 0.42, 4, 7), mat('#8b5a33'), 9 + (k % 3) * 0.86 - 0.86 + (k > 2 ? 0.43 : 0), ly(9, 4) + 0.42 + (k > 2 ? 0.74 : 0), 4, g);
    lg.rotation.x = Math.PI / 2;
  }
  col(9, 4, 2.1);
  const bench = new THREE.Group(); bench.position.set(4, ly(4, 3), 3); g.add(bench);
  mesh(new THREE.BoxGeometry(3, 0.25, 1.3), oak, 0, 1.1, 0, bench);
  for (const [x, z] of [[-1.3, -0.5], [1.3, -0.5], [-1.3, 0.5], [1.3, 0.5]]) mesh(new THREE.BoxGeometry(0.2, 1.1, 0.2), timber, x, 0.55, z, bench);
  mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5), mat('#d9b380'), -0.6, 1.38, 0, bench);
  col(4, 3, 1.6);
  // 煙囪的煙
  const puffs = [];
  for (let k = 0; k < 6; k++) {
    const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), new THREE.MeshStandardMaterial({ color: '#e8e2da', transparent: true, opacity: 0.7, flatShading: true }));
    g.add(p); puffs.push({ m: p, off: k / 6 });
  }
  const base = new THREE.Vector3(3, 0, -5.5).add(new THREE.Vector3(0, ly(0, -4) + 8.9, 0));
  animators.push((t) => {
    puffs.forEach(({ m, off }) => {
      const k = (t * 0.18 + off) % 1;
      m.position.set(base.x + k * 1.5, base.y + k * 6, base.z + Math.sin(k * 6) * 0.4);
      m.scale.setScalar(0.6 + k * 1.6); m.material.opacity = 0.75 * (1 - k);
    });
  });
}

function buildRuins(r) {
  const { g, ly, col } = regionCtx(r);
  const stone = mat('#d3cadb'), stone2 = mat('#ada3bd'), moss = mat('#71905c');
  const rune = mat('#2f2840', { emissive: '#b896ff', emissiveIntensity: 1 });
  // 中央階梯平台與石碑
  [[4.4, 0.5], [3.4, 1.0], [2.4, 1.5]].forEach(([rad, y]) => mesh(new THREE.CylinderGeometry(rad, rad + 0.2, 0.5, 10), stone2, 0, y - 0.25 + 0.25, 0, g));
  mesh(new THREE.BoxGeometry(1.4, 4.4, 0.7), mat('#4b4262'), 0, 3.95, 0, g);
  const glyph = mesh(new THREE.BoxGeometry(0.7, 2.6, 0.08), rune, 0, 4.1, 0.38, g); glyph.castShadow = false;
  const glyphB = mesh(new THREE.BoxGeometry(0.7, 2.6, 0.08), rune, 0, 4.1, -0.38, g); glyphB.castShadow = false;
  col(0, 0, 4.5);
  // 環形柱廊
  const N = 12, R = 8.5, full = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + 0.13;
    const u = Math.cos(a) * R, v = Math.sin(a) * R;
    if (v > 6.5 && Math.abs(u) < 3.5) { full.push(false); continue; } // 留出入口
    const isFull = i % 3 !== 1;
    const h = isFull ? 6 : 1.6 + hash2(i, 4) * 2.2;
    const y = ly(u, v);
    mesh(new THREE.BoxGeometry(1.6, 0.45, 1.6), stone2, u, y + 0.22, v, g);
    const c = mesh(new THREE.CylinderGeometry(0.52, 0.6, h, 10), stone, u, y + 0.45 + h / 2, v, g);
    if (!isFull) c.rotation.z = (hash2(i, 2) - 0.5) * 0.2;
    if (isFull) mesh(new THREE.BoxGeometry(1.5, 0.45, 1.5), stone2, u, y + 0.45 + h + 0.22, v, g);
    if (i % 4 === 0) mesh(new THREE.BoxGeometry(1.7, 0.2, 1.7), moss, u, y + 0.5, v, g);
    full.push(isFull ? { u, v, top: y + 0.45 + h + 0.45 } : false);
    col(u, v, 0.85);
  }
  for (let i = 0; i < N; i++) {
    const a = full[i], b = full[(i + 1) % N];
    if (!a || !b) continue;
    const len = Math.hypot(b.u - a.u, b.v - a.v);
    const l = mesh(new THREE.BoxGeometry(len + 1.2, 0.6, 1.1), stone, (a.u + b.u) / 2, Math.min(a.top, b.top) + 0.3, (a.v + b.v) / 2, g);
    l.rotation.y = -Math.atan2(b.v - a.v, b.u - a.u);
  }
  // 古城門（路徑穿過）
  for (const s of [-1, 1]) {
    mesh(new THREE.BoxGeometry(1.8, 7.5, 1.8), stone, s * 3.4, ly(s * 3.4, 19) + 3.75, 19, g);
    col(s * 3.4, 19, 1.3);
  }
  const gy = Math.max(ly(-3.4, 19), ly(3.4, 19)) + 7.5;
  mesh(new THREE.BoxGeometry(9.2, 1.3, 2.1), stone2, 0, gy + 0.6, 19, g);
  mesh(new THREE.BoxGeometry(3, 0.8, 2.2), stone, 0, gy + 1.6, 19, g);
  // 倒下的柱子與散落石塊
  const fallen = mesh(new THREE.CylinderGeometry(0.55, 0.6, 6, 10), stone, 13, ly(13, -6) + 0.55, -6, g);
  fallen.rotation.set(0, 0.4, Math.PI / 2);
  col(13, -6, 2.6);
  for (let k = 0; k < 12; k++) {
    const a = hash2(k, 11) * Math.PI * 2, d = 11 + hash2(k, 5) * 10;
    const u = Math.cos(a) * d, v = Math.sin(a) * d;
    if (v > 8 && Math.abs(u) < 6) continue;
    const b = mesh(new THREE.BoxGeometry(0.8 + hash2(k, 1), 0.6 + hash2(k, 2) * 0.6, 0.8 + hash2(k, 3)), k % 3 ? stone2 : moss, u, ly(u, v) + 0.3, v, g);
    b.rotation.y = hash2(k, 9) * 3;
  }
  sparkles(g, 90, '#cdb6ff', 13, 0.5, 9, 0.55, 0.6);
  animators.push((t) => { rune.emissiveIntensity = 0.75 + Math.sin(t * 2) * 0.45; });
}

function buildPlateau(r) {
  const { g, ly, col } = regionCtx(r);
  const rainbow = ['#e5484d', '#f28c28', '#f5c518', '#46b35b', '#3a8ee6', '#8b5cd6'];
  // 彩虹拱門
  const arch = new THREE.Group(); arch.position.set(0, ly(0, -4), -4); g.add(arch);
  rainbow.forEach((c, i) => {
    const t = mesh(new THREE.TorusGeometry(7.4 - i * 0.78, 0.4, 6, 40, Math.PI), mat(c, { emissive: c, emissiveIntensity: 0.18 }), 0, 0, 0, arch);
    t.castShadow = true;
  });
  col(-7.1, -4, 0.8); col(7.1, -4, 0.8); col(-3.4, -4, 0.6); col(3.4, -4, 0.6);
  // 巨型畫架
  const easel = new THREE.Group(); easel.position.set(-10, ly(-10, 2), 2); easel.rotation.y = 0.35; g.add(easel);
  const wood = mat('#8a5a33');
  for (const [x, z, rx, rz] of [[-1.8, 0, -0.08, 0.12], [1.8, 0, -0.08, -0.12], [0, -1.6, 0.25, 0]]) {
    const leg = mesh(new THREE.BoxGeometry(0.3, 10, 0.3), wood, x, 5, z, easel); leg.rotation.set(rx, 0, rz);
  }
  mesh(new THREE.BoxGeometry(5.6, 0.3, 0.6), wood, 0, 2.6, 0.25, easel);
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 400;
  const cx = cv.getContext('2d');
  const gr = cx.createLinearGradient(0, 0, 0, 400); gr.addColorStop(0, '#f7e7c9'); gr.addColorStop(1, '#efd2b8');
  cx.fillStyle = gr; cx.fillRect(0, 0, 320, 400);
  [['#e5484d', 30, 60, 120, 150], ['#3a8ee6', 170, 40, 110, 110], ['#f5c518', 60, 230, 90, 120], ['#46b35b', 180, 180, 100, 170], ['#8b5cd6', 120, 120, 70, 70]].forEach(([c, x, y, w, h]) => {
    cx.globalAlpha = 0.85; cx.fillStyle = c; cx.fillRect(x, y, w, h);
  });
  cx.globalAlpha = 1; cx.strokeStyle = '#2c2216'; cx.lineWidth = 6;
  cx.beginPath(); cx.moveTo(20, 330); cx.lineTo(160, 210); cx.lineTo(300, 330); cx.stroke();
  cx.beginPath(); cx.arc(250, 70, 30, 0, Math.PI * 2); cx.fillStyle = '#f28c28'; cx.fill();
  const canvasTex = new THREE.CanvasTexture(cv); canvasTex.colorSpace = THREE.SRGBColorSpace;
  const art = mesh(new THREE.BoxGeometry(5, 6.2, 0.15), [mat('#f3e6cc'), mat('#f3e6cc'), mat('#f3e6cc'), mat('#f3e6cc'), new THREE.MeshStandardMaterial({ map: canvasTex, roughness: 0.9 }), mat('#d9c39a')], 0, 6, 0.35, easel);
  art.rotation.x = -0.08;
  col(-10, 2, 2.6);
  // 顏料桶
  [['#e5484d', -6.5, 5.5], ['#3a8ee6', -5, 7], ['#f5c518', -7.5, 7.8]].forEach(([c, u, v]) => {
    const y = ly(u, v);
    mesh(new THREE.CylinderGeometry(0.85, 0.75, 1.2, 10), mat('#9aa3ad', { metalness: 0.5, roughness: 0.45 }), u, y + 0.6, v, g);
    mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.06, 10), mat(c, { roughness: 0.3 }), u, y + 1.22, v, g);
    col(u, v, 1);
  });
  // 蠟筆柱林
  for (let k = 0; k < 9; k++) {
    const u = 9 + (k % 3) * 2.3 + hash2(k, 1) * 0.6, v = -1 - Math.floor(k / 3) * 2.6 + hash2(k, 2) * 0.6;
    const h = 2.6 + hash2(k, 3) * 4, c = rainbow[k % 6];
    const cr = new THREE.Group(); cr.position.set(u, ly(u, v), v); cr.rotation.set((hash2(k, 4) - 0.5) * 0.25, 0, (hash2(k, 5) - 0.5) * 0.25); g.add(cr);
    mesh(new THREE.CylinderGeometry(0.6, 0.6, h, 8), mat(c), 0, h / 2, 0, cr);
    mesh(new THREE.CylinderGeometry(0.63, 0.63, 0.5, 8), mat('#f3e6cc'), 0, h * 0.7, 0, cr);
    mesh(new THREE.ConeGeometry(0.6, 1.3, 8), mat(c), 0, h + 0.65, 0, cr);
    col(u, v, 0.8);
  }
  // 漂浮色球
  const orbs = [];
  rainbow.forEach((c, i) => {
    const o = mesh(new THREE.IcosahedronGeometry(0.55, 1), mat(c, { emissive: c, emissiveIntensity: 0.7, roughness: 0.3 }), Math.cos(i) * 5, 9 + i * 0.4, -4 + Math.sin(i) * 2, g);
    o.castShadow = false; o.userData.base = o.position.clone(); orbs.push(o);
  });
  animators.push((t) => {
    orbs.forEach((o, i) => {
      const a = t * 0.5 + i * (Math.PI / 3);
      o.position.set(Math.cos(a) * 6, o.userData.base.y + Math.sin(t * 1.4 + i) * 0.6, -4 + Math.sin(a) * 3);
    });
  });
}

const BUILDERS = { capital: buildCapital, forest: buildForest, valley: buildValley, workshop: buildWorkshop, ruins: buildRuins, plateau: buildPlateau };
regions.forEach((r) => (BUILDERS[r.id] || (() => regionCtx(r)))(r));

/* ---------- 植被與岩石 ---------- */
{
  const EXCL = { capital: 27, forest: 21, valley: 14, workshop: 24, ruins: 24, plateau: 27 };
  const count = isTouch ? 340 : 480;
  const pts = [];
  let tries = 0;
  while (pts.length < count && tries < count * 25) {
    tries++;
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 108;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const inf = terrainInfo(x, z);
    if (inf.h < 1.5 || inf.pathW > 0.02) continue;
    if (inf.nearD < (EXCL[inf.near.id] ?? 22)) continue;
    let bad = false;
    for (const r of regions) if (Math.hypot(x - r.approach.x, z - r.approach.z) < 7) { bad = true; break; }
    if (bad || !isClear(x, z, 1.2)) continue;
    pts.push({ x, z, h: inf.h, near: inf.near, nearD: inf.nearD });
  }
  const pines = pts.filter((_, i) => i % 5 < 3), rounds = pts.filter((_, i) => i % 5 >= 3);
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 1.8, 5);
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b4a2f', flatShading: true });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.85 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, pts.length);
  const pineM = new THREE.InstancedMesh(new THREE.ConeGeometry(1.6, 4, 6), leafMat, pines.length);
  const pineTop = new THREE.InstancedMesh(new THREE.ConeGeometry(1.1, 2.6, 6), leafMat, pines.length);
  const roundM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.7, 0), leafMat, rounds.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  const tint = (pt) => {
    const base = new THREE.Color('#4d8b44');
    const regCol = new THREE.Color(FOLIAGE[pt.near.id] || '#4d8b44');
    base.lerp(regCol, sstep(50, 22, pt.nearD));
    return base.multiplyScalar(0.85 + Math.random() * 0.3);
  };
  pts.forEach((pt, i) => {
    const sc = 0.75 + Math.random() * 0.6;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28);
    m4.compose(p.set(pt.x, pt.h + 0.9 * sc, pt.z), q, s.set(sc, sc, sc)); trunks.setMatrixAt(i, m4);
    pt.sc = sc; pt.q = q.clone();
  });
  pines.forEach((pt, i) => {
    const sc = pt.sc;
    m4.compose(p.set(pt.x, pt.h + (1.8 + 2) * sc, pt.z), pt.q, s.set(sc, sc, sc)); pineM.setMatrixAt(i, m4);
    m4.compose(p.set(pt.x, pt.h + (1.8 + 3.8) * sc, pt.z), pt.q, s.set(sc, sc, sc)); pineTop.setMatrixAt(i, m4);
    col.copy(tint(pt)); pineM.setColorAt(i, col); pineTop.setColorAt(i, col.multiplyScalar(1.1));
  });
  rounds.forEach((pt, i) => {
    const sc = pt.sc;
    m4.compose(p.set(pt.x, pt.h + (1.6 + 1.5) * sc, pt.z), pt.q, s.set(sc * 1.05, sc * 0.95, sc * 1.05)); roundM.setMatrixAt(i, m4);
    roundM.setColorAt(i, tint(pt));
  });
  for (const im of [trunks, pineM, pineTop, roundM]) { im.castShadow = true; im.receiveShadow = true; scene.add(im); }
  pts.forEach((pt) => colliders.push({ x: pt.x, z: pt.z, r: 0.5 * pt.sc + 0.2, tree: true }));

  // 岩石
  const rocks = [];
  for (let k = 0; rocks.length < 90 && k < 3000; k++) {
    const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 70;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const inf = terrainInfo(x, z);
    if (inf.h < -0.5 || inf.h > 14 || inf.pathW > 0.02 || inf.nearD < 20 || !isClear(x, z, 1)) continue;
    rocks.push({ x, z, h: inf.h });
  }
  const rockM = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#9b9387', flatShading: true }), rocks.length);
  rocks.forEach((r, i) => {
    const sc = 0.5 + Math.random() * 1.3;
    q.setFromEuler(new THREE.Euler(Math.random(), Math.random() * 6, Math.random()));
    m4.compose(p.set(r.x, r.h + sc * 0.3, r.z), q, s.set(sc * 1.2, sc * 0.8, sc)); rockM.setMatrixAt(i, m4);
  });
  rockM.castShadow = true; rockM.receiveShadow = true; scene.add(rockM);
}

/* ---------- 雲 ---------- */
{
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, emissive: '#fff4e6', emissiveIntensity: 0.25, roughness: 1 });
  const clouds = [];
  for (let i = 0; i < 13; i++) {
    const c = new THREE.Group();
    const n = 3 + (i % 3);
    for (let k = 0; k < n; k++) {
      const s = 3 + Math.random() * 3.5;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), cloudMat);
      m.position.set((k - n / 2) * 3.6, Math.random() * 1.5, (Math.random() - 0.5) * 3); m.scale.y = 0.65;
      c.add(m);
    }
    const a = (i / 13) * Math.PI * 2, d = 50 + Math.random() * 90;
    c.userData = { a, d, y: 42 + Math.random() * 18, sp: 0.008 + Math.random() * 0.01 };
    scene.add(c); clouds.push(c);
  }
  animators.push((t) => clouds.forEach((c) => {
    const u = c.userData, a = u.a + t * u.sp;
    c.position.set(Math.cos(a) * u.d, u.y, Math.sin(a) * u.d); c.rotation.y = -a;
  }));
}

/* =========================================================================
 * 導師 NPC
 * ========================================================================= */
const npcs = [];
const hitTargets = [];
function buildHat(r, g) {
  const id = r.id;
  if (id === 'capital') {
    mesh(new THREE.CylinderGeometry(0.46, 0.5, 0.36, 8, 1, true), mat('#e2b45c', { metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide }), 0, 3.45, 0, g);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; mesh(new THREE.ConeGeometry(0.1, 0.32, 4), mat('#e2b45c', { metalness: 0.6, roughness: 0.35 }), Math.cos(a) * 0.46, 3.76, Math.sin(a) * 0.46, g); }
  } else if (id === 'forest') {
    mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.08, 16), mat('#1d4f58'), 0, 3.3, 0, g);
    const c = mesh(new THREE.ConeGeometry(0.56, 1.7, 10), mat('#1d4f58'), 0, 4.15, 0, g); c.rotation.z = 0.18;
    mesh(new THREE.OctahedronGeometry(0.14), mat('#8ffcff', { emissive: '#3ee6ff', emissiveIntensity: 1.5 }), -0.16, 4.98, 0, g);
  } else if (id === 'valley') {
    mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.07, 16), mat('#6b8d3b'), 0, 3.3, 0, g);
    mesh(new THREE.CylinderGeometry(0.48, 0.56, 0.52, 12), mat('#6b8d3b'), 0, 3.58, 0, g);
    mesh(new THREE.CylinderGeometry(0.57, 0.57, 0.12, 12), mat('#3f5a22'), 0, 3.4, 0, g);
  } else if (id === 'workshop') {
    mesh(new THREE.SphereGeometry(0.64, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#7a4a2a'), 0, 3.05, 0, g);
    mesh(new THREE.BoxGeometry(0.8, 0.06, 0.45), mat('#5c3820'), 0, 3.08, 0.62, g);
  } else if (id === 'ruins') {
    const hood = mesh(new THREE.SphereGeometry(0.74, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), mat('#5d4e86', { side: THREE.DoubleSide }), 0, 2.9, -0.08, g);
    hood.rotation.x = -0.35;
  } else if (id === 'plateau') {
    const b = mesh(new THREE.CylinderGeometry(0.74, 0.6, 0.22, 16), mat('#c2366b'), 0.06, 3.42, 0, g); b.rotation.z = -0.2;
    mesh(new THREE.SphereGeometry(0.1, 6, 5), mat('#c2366b'), 0.1, 3.58, 0, g);
  }
}

function buildNPC(f) {
  const r = RG[f.region] || RG.capital, s = f.slot;
  const g = new THREE.Group();
  g.position.set(s.x, heightAt(s.x, s.z), s.z);
  g.rotation.y = Math.atan2(s.fx, s.fz);
  scene.add(g);
  const robe = mat('#' + r.col.clone().multiplyScalar(0.82).getHexString());
  const skin = mat('#f0c8a0'), dark = mat('#1d1a18');
  mesh(new THREE.CylinderGeometry(0.5, 1.0, 2.3, 10), robe, 0, 1.15, 0, g);
  mesh(new THREE.TorusGeometry(0.97, 0.08, 6, 18), mat('#e2b45c', { metalness: 0.5, roughness: 0.4 }), 0, 0.12, 0, g).rotation.x = Math.PI / 2;
  mesh(new THREE.TorusGeometry(0.62, 0.09, 6, 16), mat('#4a3423'), 0, 1.45, 0, g).rotation.x = Math.PI / 2;
  mesh(new THREE.SphereGeometry(0.6, 14, 12), skin, 0, 2.85, 0, g);
  for (const sx of [-0.2, 0.2]) mesh(new THREE.SphereGeometry(0.08, 6, 5), dark, sx, 2.92, 0.54, g).castShadow = false;
  for (const sx of [-1, 1]) {
    const arm = mesh(new THREE.CapsuleGeometry(0.17, 0.9, 4, 8), robe, sx * 0.68, 1.75, 0, g); arm.rotation.z = sx * 0.28;
    mesh(new THREE.SphereGeometry(0.17, 8, 6), skin, sx * 0.86, 1.18, 0.05, g);
  }
  buildHat(r, g);
  mesh(new THREE.CylinderGeometry(0.06, 0.07, 3.3, 6), mat('#6b4a2f'), 0.98, 1.6, 0.18, g);
  const tip = mesh(new THREE.OctahedronGeometry(0.24), mat(r.color, { emissive: r.color, emissiveIntensity: 0.9 }), 0.98, 3.4, 0.18, g);
  tip.castShadow = false;

  const markerMat = new THREE.MeshStandardMaterial({ color: '#ffd36b', emissive: '#e2a32c', emissiveIntensity: 1, flatShading: true });
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), markerMat);
  marker.scale.y = 1.5; marker.position.y = 4.9; g.add(marker);

  const hit = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 4.8, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  hit.position.y = 2.4; hit.userData.f = f; g.add(hit); hitTargets.push(hit);

  const el = document.createElement('div');
  el.className = 'npc-label';
  el.innerHTML = `<small>${esc(f.cls)}</small>${esc(f.name)}`;
  el.addEventListener('click', (e) => { e.stopPropagation(); selectTeacher(f); });
  const label = new CSS2DObject(el); label.position.y = 5.9; g.add(label);

  colliders.push({ x: s.x, z: s.z, r: 1.1 });
  const npc = { f, r, group: g, marker, markerMat, label: el, tip, pos: new THREE.Vector3(s.x, g.position.y, s.z), seed: Math.random() * 6 };
  f.npc = npc; npcs.push(npc);
}
faculty.forEach(buildNPC);

animators.push((t, dt) => {
  npcs.forEach((n) => {
    n.marker.rotation.y += dt * 1.6;
    n.marker.position.y = 4.9 + Math.sin(t * 2 + n.seed) * 0.18;
    n.group.children[0].scale.y = 1 + Math.sin(t * 1.8 + n.seed) * 0.015;
    n.tip.rotation.y += dt * 2;
  });
});

/* 區域旗幟 */
const regionSigns = [];
regions.forEach((r) => {
  const el = document.createElement('button');
  el.type = 'button'; el.className = 'region-sign';
  el.style.setProperty('--region', r.color);
  el.innerHTML = `<i>${esc(RUNE[r.id] || r.id.toUpperCase())}</i><b>${esc(r.name)}</b><span class="fog-tag">迷霧籠罩 · 點擊驅散</span>`;
  el.setAttribute('aria-label', `前往${r.name}`);
  el.addEventListener('click', (e) => { e.stopPropagation(); goRegion(r); });
  const o = new CSS2DObject(el);
  const y = heightAt(r.x, r.z) + (r.id === 'capital' ? 32 : r.id === 'forest' ? 21 : 15);
  o.position.set(r.x, y, r.z);
  scene.add(o);
  regionSigns.push({ r, el, pos: o.position });
});

/* =========================================================================
 * 黑霧：未探索的區域被迷霧籠罩，抵達後散去（王都一開始就是已探索）
 * ========================================================================= */
const EXPLORE_KEY = 'tutIdQuest.explored.v1';
const explored = new Set(['capital']);
try { JSON.parse(localStorage.getItem(EXPLORE_KEY) || '[]').forEach((id) => explored.add(id)); } catch (e) { /* 無法讀取就從頭探索 */ }
const FOG_R = 28;
const isFogged = (r) => !!r && !explored.has(r.id);

function buildFog(r) {
  const baseY = heightAt(r.x, r.z);
  const g = new THREE.Group(); g.position.set(r.x, baseY, r.z); scene.add(g);
  const m = new THREE.MeshStandardMaterial({
    color: '#15101f', emissive: '#2a1d47', emissiveIntensity: 0.4, flatShading: true,
    roughness: 1, transparent: true, opacity: 0.94, depthWrite: false
  });
  const puffs = [];
  const N = isTouch ? 36 : 48;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 * 3.3 + hash2(i, r.angle) * 0.8;
    const k = Math.sqrt(hash2(i, 5.1 + r.angle));
    const x = Math.cos(a) * k * FOG_R, z = Math.sin(a) * k * FOG_R;
    const sz = 4 + hash2(i, 2.2) * 4.5 + (1 - k) * 2.5;
    const y = heightAt(r.x + x, r.z + z) - baseY + sz * 0.35 + hash2(i, 8.8) * 6 + (1 - k) * 7;
    const p = new THREE.Mesh(new THREE.IcosahedronGeometry(sz, 0), m);
    p.position.set(x, y, z); p.scale.y = 0.85;
    p.userData = { base: p.position.clone(), ph: hash2(i, 3) * 6.28 };
    p.renderOrder = 2;
    g.add(p); puffs.push(p);
  }
  const motes = sparkles(g, 60, '#9b7cff', FOG_R * 0.85, 1, 16, 0.75, 0.5);
  r.fog = { g, m, puffs, motes, revealAt: null };
}
regions.forEach((r) => { if (isFogged(r)) buildFog(r); });

animators.push((t, dt) => {
  for (const r of regions) {
    const f = r.fog;
    if (!f || !f.g.parent) continue;
    if (f.revealAt === null) {
      f.g.rotation.y += dt * 0.035;
      f.puffs.forEach((p) => { p.position.y = p.userData.base.y + Math.sin(t * 0.6 + p.userData.ph) * 0.6; p.rotation.y += dt * 0.1; });
    } else {
      const k = Math.min(1, (performance.now() - f.revealAt) / 1900);
      const e = 1 - (1 - k) * (1 - k);
      f.m.opacity = 0.94 * (1 - e);
      f.motes.material.opacity = 1 - e;
      f.puffs.forEach((p) => {
        const b = p.userData.base;
        p.position.set(b.x * (1 + e * 0.9), b.y + e * 12, b.z * (1 + e * 0.9));
        p.scale.set(1 + e, (1 + e) * 0.85, 1 + e);
      });
      if (k >= 1) scene.remove(f.g);
    }
  }
});

function applyFogState() {
  regionSigns.forEach((sg) => {
    const fog = isFogged(sg.r);
    sg.el.classList.toggle('fogged', fog);
    sg.el.setAttribute('aria-label', fog ? `驅散迷霧，前往${sg.r.name}` : `前往${sg.r.name}`);
  });
  npcs.forEach((n) => { const fog = isFogged(n.r); n.label.classList.toggle('fogged', fog); n.marker.visible = !fog; });
}
/* 驅散一個區域的迷霧；回傳是否真的有迷霧被驅散 */
function reveal(r) {
  if (!isFogged(r)) return false;
  explored.add(r.id);
  try { localStorage.setItem(EXPLORE_KEY, JSON.stringify([...explored])); } catch (e) { /* 忽略 */ }
  if (r.fog) { if (reduceMotion) scene.remove(r.fog.g); else r.fog.revealAt = performance.now(); }
  applyFogState();
  refreshProgress();
  return true;
}
applyFogState();

/* =========================================================================
 * 玩家角色
 * ========================================================================= */
const player = new THREE.Group();
{
  const tunic = mat('#2f5fd0'), skin = mat('#f0c8a0'), dark = mat('#1d1a18'), hair = mat('#4a2f1c'), pack = mat('#8a5a34'), scarf = mat('#c8413a');
  const body = new THREE.Group(); player.add(body); player.userData.body = body;
  for (const sx of [-0.26, 0.26]) { const leg = mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.8, 6), mat('#3a2d24'), sx, 0.4, 0, body); leg.userData.leg = sx; }
  mesh(new THREE.CylinderGeometry(0.45, 0.66, 1.3, 10), tunic, 0, 1.35, 0, body);
  mesh(new THREE.TorusGeometry(0.42, 0.13, 6, 14), scarf, 0, 1.98, 0, body).rotation.x = Math.PI / 2;
  mesh(new THREE.SphereGeometry(0.55, 14, 12), skin, 0, 2.5, 0, body);
  mesh(new THREE.SphereGeometry(0.58, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 2.58, -0.04, body);
  for (const sx of [-0.19, 0.19]) mesh(new THREE.SphereGeometry(0.075, 6, 5), dark, sx, 2.55, 0.5, body).castShadow = false;
  mesh(new THREE.BoxGeometry(0.85, 0.95, 0.42), pack, 0, 1.45, -0.58, body);
  mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.9, 8), mat('#d8c39a'), 0, 2.02, -0.58, body).rotation.z = Math.PI / 2;
  const arms = [];
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(sx * 0.6, 1.85, 0); body.add(piv);
    const a = mesh(new THREE.CapsuleGeometry(0.15, 0.7, 4, 8), tunic, 0, -0.45, 0, piv); a.rotation.z = sx * 0.12;
    mesh(new THREE.SphereGeometry(0.15, 8, 6), skin, sx * 0.06, -0.92, 0, piv);
    arms.push(piv);
  }
  player.userData.arms = arms;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.15, 32), new THREE.MeshBasicMaterial({ color: '#ffd36b', transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; player.add(ring);
  player.visible = false;
  scene.add(player);
}

/* =========================================================================
 * 鏡頭與控制
 * ========================================================================= */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.maxPolarAngle = 1.32; controls.minDistance = 12; controls.maxDistance = 290;
controls.target.set(0, 4, 0);
controls.autoRotate = !reduceMotion; controls.autoRotateSpeed = 0.35;
controls.update();

const state = {
  mode: 'tour', started: false, flying: null, currentRegion: null, nearNPC: null,
  card: null, filter: '', regionFilter: null, completeShown: false,
  yaw: 0, pitch: 0.42, dist: isTouch ? 17 : 14, walkT: 0
};
const keys = new Set();
const joy = { x: 0, y: 0, active: false };

function viewForRegion(r) {
  const target = new THREE.Vector3(r.x, heightAt(r.x, r.z) + 3, r.z);
  const back = r.id === 'capital' ? 44 : 34, up = r.id === 'capital' ? 30 : 22;
  const pos = target.clone().add(new THREE.Vector3(r.toward.x * back, up, r.toward.y * back));
  return { pos, target };
}
function viewForNPC(n) {
  const s = n.f.slot;
  const target = n.pos.clone().add(new THREE.Vector3(0, 2.4, 0));
  const pos = n.pos.clone().add(new THREE.Vector3(s.fx * 9.5 - s.fz * 2.5, 4.6, s.fz * 9.5 + s.fx * 2.5));
  return { pos, target };
}
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
function flyTo({ pos, target }, done, dur = 1.7) {
  controls.autoRotate = false;
  if (reduceMotion) { camera.position.copy(pos); controls.target.copy(target); controls.update(); done && done(); return; }
  state.flying = { fromP: camera.position.clone(), fromT: controls.target.clone(), toP: pos, toT: target, start: performance.now(), dur, done, arc: Math.min(36, camera.position.distanceTo(pos) * 0.22) };
  controls.enabled = false;
}

function goRegion(r) {
  closeCodexIfNarrow();
  if (state.mode === 'explore') {
    teleport(r.approach.x, r.approach.z, Math.atan2(r.toward.x, r.toward.y));
    showToast(r, reveal(r));
  } else {
    flyTo(viewForRegion(r), () => showToast(r, reveal(r)));
  }
}
function selectTeacher(f, { fromCodex = false } = {}) {
  const n = f.npc, r = RG[f.region] || RG.capital;
  if (fromCodex) closeCodexIfNarrow();
  const fogged = isFogged(r);
  const wait = reduceMotion ? 0 : 1600;
  if (state.mode === 'explore') {
    const s = f.slot;
    if (fromCodex || fogged || player.position.distanceTo(n.pos) > 14) teleport(s.x + s.fx * 4.5, s.z + s.fz * 4.5, Math.atan2(s.fx, s.fz));
    if (fogged) { showToast(r, reveal(r)); setTimeout(() => openCard(f), wait); }
    else openCard(f);
  } else if (fogged) {
    // 先飛到區域看迷霧散去，再靠近導師
    flyTo(viewForRegion(r), () => {
      showToast(r, reveal(r));
      setTimeout(() => flyTo(viewForNPC(n), () => openCard(f), 1.3), wait);
    });
  } else {
    flyTo(viewForNPC(n), () => openCard(f), 1.5);
  }
}

/* ---------- 探險模式 ---------- */
function teleport(x, z, yaw) {
  player.position.set(x, heightAt(x, z), z);
  if (yaw !== undefined) { state.yaw = yaw; player.rotation.y = yaw + Math.PI; }
  placeFollowCam(true);
}
function placeFollowCam(snap) {
  const p = player.position;
  const d = state.dist;
  const want = new THREE.Vector3(
    p.x + Math.sin(state.yaw) * Math.cos(state.pitch) * d,
    p.y + 1.6 + Math.sin(state.pitch) * d,
    p.z + Math.cos(state.yaw) * Math.cos(state.pitch) * d
  );
  want.y = Math.max(want.y, heightAt(want.x, want.z) + 1.8);
  if (snap) camera.position.copy(want);
  return want;
}
function setMode(mode) {
  if (mode === state.mode) return;
  state.mode = mode;
  state.flying = null;
  document.body.classList.toggle('exploring', mode === 'explore');
  $('#mode-label').innerHTML = (mode === 'explore' ? '導覽' : '探險') + '<span class="lbl-long">模式</span>';
  if (mode === 'explore') {
    controls.enabled = false; controls.autoRotate = false;
    let best = RG.capital, bd = 1e9;
    for (const r of regions) { const d = Math.hypot(controls.target.x - r.x, controls.target.z - r.z); if (d < bd) { bd = d; best = r; } }
    player.visible = true;
    const keepCam = camera.position.clone();
    teleport(best.approach.x, best.approach.z, Math.atan2(best.toward.x, best.toward.y));
    camera.position.copy(keepCam);
    $('#joystick').hidden = !isTouch; $('#btn-interact').hidden = !isTouch;
  } else {
    controls.enabled = true;
    controls.target.copy(player.position).add(new THREE.Vector3(0, 2, 0));
    controls.update();
    $('#joystick').hidden = true; $('#btn-interact').hidden = true; $('#prompt').hidden = true;
    state.nearNPC = null;
  }
  updateHint();
}

function updateExplore(dt) {
  let ix = 0, iz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) iz -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) iz += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
  if (joy.active) { ix += joy.x; iz += joy.y; }
  const sy = Math.sin(state.yaw), cy = Math.cos(state.yaw);
  let mx = -sy * -iz + cy * ix, mz = -cy * -iz - sy * ix;
  const len = Math.hypot(mx, mz);
  const moving = len > 0.05 && !state.card;
  const p = player.position;
  if (moving) {
    const k = Math.min(1, len) / len;
    mx *= k; mz *= k;
    const speed = 12 * (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 1.7 : 1);
    let nx = p.x + mx * speed * dt, nz = p.z + mz * speed * dt;
    const ok = (x, z) => heightAt(x, z) > 0.7 && Math.hypot(x, z) < 118;
    if (!ok(nx, nz)) { if (ok(nx, p.z)) nz = p.z; else if (ok(p.x, nz)) nx = p.x; else { nx = p.x; nz = p.z; } }
    for (const c of colliders) {
      const dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz), min = c.r + 0.6;
      if (d < min && d > 1e-4) { nx = c.x + dx / d * min; nz = c.z + dz / d * min; }
    }
    if (ok(nx, nz)) { p.x = nx; p.z = nz; }
    const targetYaw = Math.atan2(mx, mz);
    let dy = targetYaw - player.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    player.rotation.y += dy * Math.min(1, dt * 12);
    state.walkT += dt * speed * 0.9;
  }
  p.y = heightAt(p.x, p.z);
  const body = player.userData.body;
  const swing = moving ? Math.sin(state.walkT) : 0;
  body.position.y = moving ? Math.abs(Math.sin(state.walkT)) * 0.18 : 0;
  player.userData.arms.forEach((a, i) => { a.rotation.x = swing * 0.7 * (i ? 1 : -1); });
  body.children.forEach((c) => { if (c.userData.leg) c.rotation.x = swing * 0.5 * (c.userData.leg > 0 ? 1 : -1); });

  const want = placeFollowCam(false);
  camera.position.lerp(want, 1 - Math.exp(-dt * 7));
  camera.lookAt(p.x, p.y + 2.2, p.z);

  // 附近的導師
  let near = null, nd = 4.6;
  for (const n of npcs) { const d = Math.hypot(n.pos.x - p.x, n.pos.z - p.z); if (d < nd) { nd = d; near = n; } }
  if (near !== state.nearNPC) {
    state.nearNPC = near;
    const pr = $('#prompt');
    if (near && !state.card) {
      pr.innerHTML = isTouch ? `點「對話」拜訪 <b>${esc(near.f.name)}</b>` : `按 <b>E</b> 與 <b>${esc(near.f.name)}</b> 對話`;
      pr.hidden = false;
    } else pr.hidden = true;
    $('#btn-interact').disabled = !near;
  }
}
function interact() { if (state.mode === 'explore' && state.nearNPC && !state.card) openCard(state.nearNPC.f); }

/* ---------- 輸入 ---------- */
window.addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, textarea')) return;
  if (e.code === 'Escape') { if (state.card) closeCard(); else if ($('#codex').classList.contains('open')) toggleCodex(false); return; }
  if (state.mode !== 'explore' || !state.started) return;
  if (['KeyE', 'Enter', 'Space'].includes(e.code)) { interact(); e.preventDefault(); return; }
  if (/^(Key[WASD]|Arrow|Shift)/.test(e.code)) { keys.add(e.code); if (e.code.startsWith('Arrow')) e.preventDefault(); }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

const dom = renderer.domElement;
let drag = null;
dom.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, id: e.pointerId };
});
window.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (state.mode === 'explore') {
    state.yaw -= (e.clientX - drag.x) * 0.006;
    state.pitch = Math.min(1.05, Math.max(0.12, state.pitch + (e.clientY - drag.y) * 0.004));
  }
  drag.x = e.clientX; drag.y = e.clientY;
});
window.addEventListener('pointerup', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const moved = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy);
  drag = null;
  if (moved < 6 && state.started) pick(e);
});
dom.addEventListener('wheel', (e) => {
  if (state.mode === 'explore') { state.dist = Math.min(30, Math.max(7, state.dist + e.deltaY * 0.012)); e.preventDefault(); }
}, { passive: false });

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pick(e) {
  const rect = dom.getBoundingClientRect();
  ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(hitTargets, false)[0];
  if (hit) selectTeacher(hit.object.userData.f);
}

// 手機搖桿
{
  const js = $('#joystick'), knob = js.querySelector('.knob');
  let pid = null;
  const setKnob = (x, y) => { knob.style.transform = `translate(${x}px, ${y}px)`; };
  js.addEventListener('pointerdown', (e) => { pid = e.pointerId; js.setPointerCapture(pid); move(e); e.stopPropagation(); });
  js.addEventListener('pointermove', (e) => { if (e.pointerId === pid) move(e); });
  const end = (e) => { if (e.pointerId !== pid) return; pid = null; joy.active = false; joy.x = joy.y = 0; setKnob(0, 0); };
  js.addEventListener('pointerup', end); js.addEventListener('pointercancel', end);
  function move(e) {
    const r = js.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy), max = 42;
    if (d > max) { dx = dx / d * max; dy = dy / d * max; }
    setKnob(dx, dy); joy.active = true; joy.x = dx / max; joy.y = dy / max;
  }
}
$('#btn-interact').addEventListener('click', interact);

/* =========================================================================
 * 介面：進度、導師卡、圖鑑、提示、小地圖
 * ========================================================================= */
const STORE_KEY = 'tutIdQuest.visited.v1';
const visited = new Set();
try { JSON.parse(localStorage.getItem(STORE_KEY) || '[]').forEach((id) => visited.add(id)); } catch (e) { /* 無法讀取就從零開始 */ }
function saveVisited() { try { localStorage.setItem(STORE_KEY, JSON.stringify([...visited])); } catch (e) { /* 忽略 */ } }

function refreshProgress() {
  const n = faculty.filter((f) => visited.has(f.id)).length, total = faculty.length;
  $('#prog-text').innerHTML = `已拜訪 <b>${n}</b> / ${total} 位導師 · 探索 <b>${explored.size}</b> / ${regions.length} 區`;
  $('#prog-bar').style.width = `${(n / total) * 100}%`;
  $('#prog-mini').textContent = `${n} / ${total}`;
  npcs.forEach((np) => {
    const v = visited.has(np.f.id);
    np.label.classList.toggle('visited', v);
    np.markerMat.color.set(v ? '#7ee39d' : '#ffd36b');
    np.markerMat.emissive.set(v ? '#2f9c58' : '#e2a32c');
  });
  renderCodex();
  return n === total;
}
function markVisited(f) {
  if (visited.has(f.id)) return;
  visited.add(f.id); saveVisited();
  if (refreshProgress() && !state.completeShown) state.pendingComplete = true;
}

const photoHTML = (f) => f.photo
  ? `<img src="${esc(f.photo)}" alt="${esc(f.name)}老師照片" referrerpolicy="no-referrer" loading="lazy" data-initial="${esc(f.name[0])}">`
  : `<span>${esc(f.name[0])}</span>`;
function fixBrokenPhotos(root) {
  root.querySelectorAll('img[data-initial]').forEach((img) => {
    const fail = () => { const s = document.createElement('span'); s.textContent = img.dataset.initial; img.replaceWith(s); };
    if (img.complete && img.naturalWidth === 0) fail(); else img.addEventListener('error', fail, { once: true });
  });
}

function openCard(f) {
  const r = RG[f.region] || RG.capital;
  state.card = f;
  markVisited(f);
  $('#prompt').hidden = true;
  const sheet = $('#card-sheet');
  sheet.style.setProperty('--region', r.color);
  const half = Math.ceil(r.name.length / 2);
  sheet.innerHTML = `
    <button class="icon-btn close" type="button" aria-label="關閉"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <div class="dossier">
      <div class="portrait">
        <div class="frame"><div>${photoHTML(f)}</div></div>
        <div class="seal" aria-hidden="true">${esc(r.name.slice(0, half))}<br>${esc(r.name.slice(half))}</div>
      </div>
      <div class="dossier-main">
        <span class="cls-tag"><i></i>${esc(r.name)} · ${esc(f.cls)}</span>
        <h3 id="card-name">${esc(f.name)}</h3>
        <p class="role"><b>${esc(f.title)}</b>　${esc(f.edu)}</p>
        <section class="sect"><h4>專長技能</h4><div class="skills">${f.fields.map((x) => `<span class="skill">${esc(x)}</span>`).join('')}</div></section>
        <section class="sect"><h4>傳授技能書</h4><ul class="tomes">${f.courses.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
        ${f.feats && f.feats.length ? `<section class="sect"><h4>冒險紀錄</h4><ul class="feats">${f.feats.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
        <div class="contact">
          <span class="mail">${esc(f.email)}</span>
          <button class="copy" type="button">複製信箱</button>
          ${f.url ? `<a class="site" href="${esc(f.url)}" target="_blank" rel="noopener">個人網站 ↗</a>` : ''}
        </div>
      </div>
    </div>
    <nav class="card-nav">
      <button type="button" data-nav="-1">← 上一位導師</button>
      <span class="lore">${esc(r.motto)}</span>
      <button type="button" data-nav="1">下一位導師 →</button>
    </nav>`;
  fixBrokenPhotos(sheet);
  sheet.querySelector('.close').addEventListener('click', closeCard);
  sheet.querySelector('.copy').addEventListener('click', (e) => {
    const btn = e.currentTarget, mail = sheet.querySelector('.mail');
    const done = () => { btn.textContent = '已複製'; setTimeout(() => (btn.textContent = '複製信箱'), 1600); };
    const fallback = () => { const rg = document.createRange(); rg.selectNodeContents(mail); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(rg); btn.textContent = '已選取，請按複製'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(f.email).then(done, fallback); else fallback();
  });
  sheet.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => {
    const next = faculty[(f.index + Number(b.dataset.nav) + faculty.length) % faculty.length];
    if (isFogged(RG[next.region])) { closeCard(); selectTeacher(next); return; }
    if (state.mode === 'tour') flyTo(viewForNPC(next.npc), null, 1.2);
    else { const s = next.slot; teleport(s.x + s.fx * 4.5, s.z + s.fz * 4.5, Math.atan2(s.fx, s.fz)); }
    openCard(next);
  }));
  $('#card').hidden = false;
  sheet.scrollTop = 0;
  sheet.querySelector('.close').focus({ preventScroll: true });
  try { history.replaceState(null, '', '#' + f.id); } catch (e) { /* 忽略 */ }
}
function closeCard() {
  $('#card').hidden = true; state.card = null; state.nearNPC = null;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* 忽略 */ }
  if (state.pendingComplete && !state.completeShown) { state.completeShown = true; state.pendingComplete = false; $('#complete').hidden = false; }
}
$('#card').addEventListener('click', (e) => { if (e.target.id === 'card') closeCard(); });
$('#btn-complete-close').addEventListener('click', () => { $('#complete').hidden = true; });

/* 圖鑑 */
function toggleCodex(open) {
  const c = $('#codex');
  const on = open ?? !c.classList.contains('open');
  c.classList.toggle('open', on); c.setAttribute('aria-hidden', String(!on));
  if (on && !isTouch) setTimeout(() => $('#codex-search').focus({ preventScroll: true }), 300);
}
function closeCodexIfNarrow() { if (window.innerWidth < 900) toggleCodex(false); }
$('#btn-codex').addEventListener('click', () => toggleCodex());
$('#codex-close').addEventListener('click', () => toggleCodex(false));

const chips = $('#codex-chips');
chips.innerHTML = `<button type="button" data-r="" class="on">全部</button>` + regions.map((r) => `<button type="button" data-r="${r.id}">${esc(r.name)}</button>`).join('');
chips.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  state.regionFilter = b.dataset.r || null;
  chips.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  renderCodex();
});
$('#codex-search').addEventListener('input', (e) => { state.filter = e.target.value.trim().toLowerCase(); renderCodex(); });

const SYN = {
  ai: ['人工智慧', '生成式', '運算化'], aigc: ['生成式人工智慧'], 人工智慧: ['人工智慧'], 程式: ['運算化', '電腦輔助'],
  數位: ['數位', '電腦', '運算化', 'bim'], '3d': ['電腦輔助', '數位製作', 'bim'], 電腦: ['電腦', '運算化', 'bim'],
  木: ['木作', '木工', '家具'], 家具: ['家具', '傢飾', '木作'], 材料: ['材料', '建材'],
  色: ['色彩', '繪畫', '水彩', '油畫'], 畫: ['繪畫', '素描', '水彩', '油畫'], 品牌: ['品牌', '識別', 'vis'],
  史: ['史', '文化資產', '後殖民'], 文化: ['文化', '客家', '聚落'], 環境: ['環境', 'iaq', '空氣', '聲學', 'cfd'],
  健康: ['空氣品質', '環境'], 研究: ['量化研究', 'sem', '研究'], 統計: ['sem', '量化研究']
};
function matches(f) {
  if (state.regionFilter && f.region !== state.regionFilter) return false;
  if (!state.filter) return true;
  const r = RG[f.region] || {};
  const hay = [f.name, f.title, f.cls, f.edu, r.name, ...f.fields, ...f.courses, ...(f.feats || [])].join(' ').toLowerCase();
  return state.filter.split(/\s+/).every((w) => hay.includes(w) || (SYN[w] || []).some((x) => hay.includes(x.toLowerCase())));
}
function renderCodex() {
  const list = $('#codex-list');
  const active = !!(state.filter || state.regionFilter);
  let html = '', shown = 0;
  regions.forEach((r) => {
    const ts = r.teachers.filter(matches);
    if (!ts.length) return;
    shown += ts.length;
    const v = r.teachers.filter((f) => visited.has(f.id)).length;
    if (isFogged(r)) {
      html += `<div class="region-block locked" style="--region:${r.color}">
        <button type="button" data-region="${r.id}"><i></i><b>${esc(r.name)}</b><small>迷霧中</small></button>
        ${ts.map((f) => `<button type="button" class="t-row locked" data-t="${f.id}">
          <span class="avatar">?</span>
          <span class="who"><b>？？？</b><small>迷霧籠罩，點擊前往驅散</small></span>
          <span class="mark">未探索</span>
        </button>`).join('')}
      </div>`;
      return;
    }
    html += `<div class="region-block" style="--region:${r.color}">
      <button type="button" data-region="${r.id}"><i></i><b>${esc(r.name)}</b><small>${v} / ${r.teachers.length}</small></button>
      ${ts.map((f) => `<button type="button" class="t-row" data-t="${f.id}" style="--region:${r.color}">
        <span class="avatar">${photoHTML(f)}</span>
        <span class="who"><b>${esc(f.name)}</b><small>${esc(f.cls)}｜${esc(f.fields.slice(0, 3).join('、'))}</small></span>
        <span class="mark ${visited.has(f.id) ? 'ok' : ''}">${visited.has(f.id) ? '✓ 已拜訪' : '未拜訪'}</span>
      </button>`).join('')}
    </div>`;
  });
  list.innerHTML = html || `<p class="empty-note">找不到符合「${esc(state.filter)}」的導師。<br>試試「設計」「AI」「材料」等關鍵字。</p>`;
  fixBrokenPhotos(list);
  npcs.forEach((n) => n.label.classList.toggle('dim', active && !matches(n.f)));
  npcs.forEach((n) => n.marker.scale.setScalar(active && matches(n.f) ? 1.6 : 1));
  return shown;
}
$('#codex-list').addEventListener('click', (e) => {
  const t = e.target.closest('[data-t]'), rg = e.target.closest('[data-region]');
  if (t) selectTeacher(faculty.find((f) => f.id === t.dataset.t), { fromCodex: true });
  else if (rg) goRegion(RG[rg.dataset.region]);
});

/* 提示列 */
function updateHint() {
  const h = $('#hint');
  if (state.mode === 'tour') {
    h.innerHTML = isTouch ? '單指旋轉 · 雙指縮放 · 點旗幟或名牌前往' : '拖曳旋轉 · 滾輪縮放 · 右鍵平移 · 點擊旗幟或名牌前往';
  } else {
    h.innerHTML = isTouch ? '左下搖桿移動 · 拖曳畫面轉視角' : '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移動 · <kbd>Shift</kbd> 奔跑 · 拖曳轉視角 · <kbd>E</kbd> 對話';
  }
}

/* 區域抵達提示 */
let toastTimer = null;
function showToast(r, revealed = false) {
  state.currentRegion = r;
  $('#toast-rune').textContent = RUNE[r.id] || '';
  $('#toast-name').textContent = r.name;
  $('#toast-motto').textContent = revealed ? `迷霧散去 · ${r.motto}` : r.motto;
  const t = $('#toast'); t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* 小地圖 */
const mm = $('#minimap'), mctx = mm.getContext('2d');
const MM = 336, WORLD_HALF = 122;
const toMap = (x, z) => [(x + WORLD_HALF) / (WORLD_HALF * 2) * MM, (z + WORLD_HALF) / (WORLD_HALF * 2) * MM];
const mmBase = document.createElement('canvas'); mmBase.width = mmBase.height = MM;
{
  const b = mmBase.getContext('2d'), step = 3, c = new THREE.Color();
  const grass = new THREE.Color('#6f9f50'), sea = new THREE.Color('#25607a'), shallow = new THREE.Color('#3d8aa6'), sand = new THREE.Color('#e2cc92'), path = new THREE.Color('#e3cf98');
  for (let py = 0; py < MM; py += step) for (let px = 0; px < MM; px += step) {
    const x = (px / MM) * WORLD_HALF * 2 - WORLD_HALF, z = (py / MM) * WORLD_HALF * 2 - WORLD_HALF;
    const { h, pathW, near, nearD } = terrainInfo(x, z);
    if (h < 0.1) c.copy(shallow).lerp(sea, sstep(0, -4, h));
    else {
      c.copy(grass).lerp(near.ground, sstep(38, 10, nearD) * 0.85);
      c.lerp(sand, sstep(1.4, 0.5, h));
      c.multiplyScalar(0.8 + Math.min(h, 14) / 14 * 0.35);
      c.lerp(path, pathW);
    }
    b.fillStyle = '#' + c.getHexString(); b.fillRect(px, py, step, step);
  }
}
let mmT = 0;
function drawMinimap() {
  mctx.clearRect(0, 0, MM, MM);
  mctx.save();
  mctx.beginPath(); mctx.arc(MM / 2, MM / 2, MM / 2 - 2, 0, Math.PI * 2); mctx.clip();
  mctx.drawImage(mmBase, 0, 0);
  regions.forEach((r) => {
    if (!isFogged(r)) return;
    const [x, y] = toMap(r.x, r.z), rad = (FOG_R * 1.15) / (WORLD_HALF * 2) * MM;
    const gr = mctx.createRadialGradient(x, y, rad * 0.35, x, y, rad);
    gr.addColorStop(0, 'rgba(18,12,30,0.95)'); gr.addColorStop(1, 'rgba(18,12,30,0)');
    mctx.fillStyle = gr; mctx.beginPath(); mctx.arc(x, y, rad, 0, Math.PI * 2); mctx.fill();
  });
  regions.forEach((r) => {
    const [x, y] = toMap(r.x, r.z);
    mctx.save(); mctx.translate(x, y); mctx.rotate(Math.PI / 4);
    mctx.fillStyle = r.color; mctx.strokeStyle = '#141a2e'; mctx.lineWidth = 3;
    mctx.fillRect(-9, -9, 18, 18); mctx.strokeRect(-9, -9, 18, 18); mctx.restore();
  });
  npcs.forEach((n) => {
    if (isFogged(n.r)) return;
    const [x, y] = toMap(n.pos.x, n.pos.z);
    mctx.beginPath(); mctx.arc(x, y, 4.5, 0, Math.PI * 2);
    mctx.fillStyle = visited.has(n.f.id) ? '#7ee39d' : '#ffd36b'; mctx.fill();
    mctx.lineWidth = 1.5; mctx.strokeStyle = '#141a2e'; mctx.stroke();
  });
  const focus = state.mode === 'explore' ? player.position : controls.target;
  const [fx, fy] = toMap(focus.x, focus.z);
  const dir = state.mode === 'explore' ? player.rotation.y : Math.atan2(controls.target.x - camera.position.x, controls.target.z - camera.position.z);
  mctx.save(); mctx.translate(fx, fy); mctx.rotate(-dir + Math.PI);
  mctx.beginPath(); mctx.moveTo(0, -13); mctx.lineTo(9, 9); mctx.lineTo(0, 4); mctx.lineTo(-9, 9); mctx.closePath();
  mctx.fillStyle = '#ffffff'; mctx.fill(); mctx.lineWidth = 2.5; mctx.strokeStyle = '#141a2e'; mctx.stroke();
  mctx.restore();
  mctx.restore();
  mctx.beginPath(); mctx.arc(MM / 2, MM / 2, MM / 2 - 2, 0, Math.PI * 2);
  mctx.lineWidth = 3; mctx.strokeStyle = 'rgba(226,180,92,.7)'; mctx.stroke();
}
mm.addEventListener('click', (e) => {
  if (!state.started) return;
  const rect = mm.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * WORLD_HALF * 2 - WORLD_HALF;
  const z = ((e.clientY - rect.top) / rect.height) * WORLD_HALF * 2 - WORLD_HALF;
  let best = null, bd = 30;
  for (const r of regions) { const d = Math.hypot(x - r.x, z - r.z); if (d < bd) { bd = d; best = r; } }
  if (best) goRegion(best);
  else if (state.mode === 'explore' && heightAt(x, z) > 1 && isClear(x, z, 1)) teleport(x, z);
  else if (state.mode === 'tour' && heightAt(x, z) > 0) flyTo({ target: new THREE.Vector3(x, heightAt(x, z) + 2, z), pos: new THREE.Vector3(x, heightAt(x, z) + 45, z + 50) });
});

/* 開場 */
$('#btn-apply').href = W.links.admissions;
$('#cta-admissions').href = W.links.admissions;
$('#cta-master').href = W.links.master;
$('#btn-start').addEventListener('click', () => {
  $('#intro').hidden = true;
  state.started = true;
  const hashId = decodeURIComponent(location.hash.slice(1));
  const target = faculty.find((f) => f.id === hashId);
  if (target) selectTeacher(target);
  else flyTo(viewForRegion(RG.capital), () => showToast(RG.capital), 2.4);
});
{
  const btn = $('#btn-reset');
  let armed = false, timer = null;
  btn.addEventListener('click', () => {
    if (!armed) {
      armed = true; btn.textContent = '確定要清除進度？再按一次';
      clearTimeout(timer); timer = setTimeout(() => { armed = false; btn.textContent = '重新開始冒險'; }, 4000);
      return;
    }
    try { localStorage.removeItem(STORE_KEY); localStorage.removeItem(EXPLORE_KEY); } catch (e) { /* 忽略 */ }
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* 忽略 */ }
    location.reload();
  });
}
$('#btn-mode').addEventListener('click', () => { if (!state.started) return; setMode(state.mode === 'tour' ? 'explore' : 'tour'); });

refreshProgress();
updateHint();

/* =========================================================================
 * 主迴圈
 * ========================================================================= */
const clock = new THREE.Clock();
let firstFrame = true;
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (!reduceMotion) animators.forEach((fn) => fn(t, dt));
  else if (firstFrame) animators.forEach((fn) => fn(0, 0));

  if (state.flying) {
    const f = state.flying;
    const k = Math.min(1, (performance.now() - f.start) / 1000 / f.dur), e = ease(k);
    camera.position.lerpVectors(f.fromP, f.toP, e);
    camera.position.y += Math.sin(Math.PI * k) * f.arc;
    controls.target.lerpVectors(f.fromT, f.toT, e);
    camera.lookAt(controls.target);
    if (k >= 1) { state.flying = null; controls.enabled = true; controls.update(); f.done && f.done(); }
  } else if (state.mode === 'explore') {
    updateExplore(dt);
  } else {
    const tg = controls.target, d = Math.hypot(tg.x, tg.z);
    if (d > 105) { tg.x *= 105 / d; tg.z *= 105 / d; }
    controls.update();
    const ground = heightAt(camera.position.x, camera.position.z) + 3;
    if (camera.position.y < ground) camera.position.y = ground;
  }

  // 依距離調整標籤
  const cp = camera.position;
  const focus = state.mode === 'explore' ? player.position : controls.target;
  for (const n of npcs) {
    const d = cp.distanceTo(n.pos);
    n.label.classList.toggle('far', d > (state.mode === 'explore' ? 60 : 95));
  }
  for (const s of regionSigns) {
    const d = Math.hypot(focus.x - s.r.x, focus.z - s.r.z);
    s.el.classList.toggle('near', state.mode === 'explore' ? d < 30 : cp.distanceTo(s.pos) < 32);
  }
  if (state.mode === 'explore' && state.started) {
    let cur = null;
    for (const r of regions) {
      const d = Math.hypot(focus.x - r.x, focus.z - r.z);
      if (d < FOG_R + 4 && isFogged(r)) showToast(r, reveal(r));
      if (d < (r.id === 'capital' ? 24 : 27)) cur = r;
    }
    if (cur && cur !== state.currentRegion) showToast(cur);
    if (!cur) state.currentRegion = null;
  } else if (state.started && !state.flying) {
    for (const r of regions) {
      if (isFogged(r) && Math.hypot(focus.x - r.x, focus.z - r.z) < 16 && cp.distanceTo(focus) < 70) showToast(r, reveal(r));
    }
  }

  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  mmT += dt;
  if (mmT > 0.1 || firstFrame) { mmT = 0; drawMinimap(); }
  if (firstFrame) { firstFrame = false; $('#loading').classList.add('done'); }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

// 提供給測試腳本
window.__quest = { state, setMode, selectTeacher, goRegion, faculty, regions, openCard, closeCard, toggleCodex, reveal, explored };
