/* =========================================================================
 * 南應大室研所大冒險 · 主程式
 * Three.js 建構的 3D 大陸：地形、六大區域地標、導師 NPC、
 * 「導覽模式」（點擊飛行）與「探險模式」（操控角色走動），以及所有介面。
 * 三個世界觀（中古奇幻／現代城鎮／賽博未來）共用同一張地圖與同一批老師，
 * 開場時選擇世界；現代與未來的地標在 js/world-modern.js、js/world-cyber.js。
 * 師資與區域內容請改 data/faculty.js，世界觀文字改 data/worlds.js，不需要動這個檔案。
 * ========================================================================= */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { initQuests, QUEST_KEY, registerTrial } from './quests.js?v=5';
import { installTrials } from './trials.js?v=2';
import { MODERN_BUILDERS } from './world-modern.js?v=3';
import { CYBER_BUILDERS } from './world-cyber.js?v=2';

const W = window.WORLD;

/* ---------- 世界觀：網址 ?world= 優先，其次是上次的選擇 ---------- */
const WORLDS = window.WORLDS || { fantasy: {} };
const WORLD_KEY = 'tutIdQuest.world.v1';
const WORLD_ID = (() => {
  let id = new URLSearchParams(location.search).get('world');
  if (!WORLDS[id]) { try { id = localStorage.getItem(WORLD_KEY); } catch (e) { id = null; } }
  return WORLDS[id] ? id : 'fantasy';
})();
const WD = WORLDS[WORLD_ID] || {};
document.documentElement.dataset.world = WORLD_ID;
document.querySelector('#loading').textContent = `正在繪製${WD.land || '世界'}⋯`;
// 用世界觀的文字覆寫區域名稱、職業稱號與小怪名稱
for (const r of W.regions) {
  const o = (WD.regions || {})[r.id]; if (!o) continue;
  for (const k of ['name', 'motto', 'desc']) if (o[k]) r[k] = o[k];
  if (o.rune) r.rune = o.rune;
  if (o.field && r.field) r.field.name = o.field;
}
for (const f of W.faculty) if ((WD.cls || {})[f.id]) f.cls = WD.cls[f.id];
for (const [id, name] of Object.entries(WD.monsters || {})) { const q = window.QUESTS && window.QUESTS.teachers[id]; if (q) q.stage1.monster.name = name; }
const $ = (s) => document.querySelector(s);
const isTouch = window.matchMedia('(pointer: coarse)').matches;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- 世界常數 ---------- */
const ISLAND_R = 150;
const REGION_DIST = 80;
const FIELD_R = 13; // 任務採集場半徑
/* 各區域的場景設定；新增區域時在這裡補一筆，並在 BUILDERS 加地標函式。
 *   rune 旗幟英文　ground 地面色　foliage 樹葉色　floor 平台高度
 *   flat 整平範圍 [外緣, 內緣]　clear 植被淨空半徑　signY 旗幟高度 */
const STYLE = {
  capital:  { rune: 'THE CAPITAL',       ground: '#93c45f', foliage: '#4f8f45', floor: 3.2, flat: [27, 16], clear: 27, signY: 32 },
  forest:   { rune: 'FOREST OF CODE',    ground: '#2f8a72', foliage: '#2a6e66', floor: 3.0, flat: [22, 10], clear: 21, signY: 21 },
  valley:   { rune: 'VALE OF WINDS',     ground: '#86c25a', foliage: '#5e9c3e', floor: 2.4, flat: [17, 10], clear: 14 },
  workshop: { rune: "ARTISANS' HAMLET",  ground: '#b9a066', foliage: '#c9863e', floor: 2.8, flat: [22, 15], clear: 24 },
  market:   { rune: 'COMMONS MARKET',    ground: '#c4b48e', foliage: '#5e9c3e', floor: 3.6, flat: [22, 15], clear: 24 },
  plateau:  { rune: 'CHROMA PLATEAU',    ground: '#d98fb2', foliage: '#e7a3c3', floor: 11,  flat: [30, 21], clear: 27 }
};
/* 走進區域時的氛圍：霧色／天光／陽光 */
const MOOD = {
  capital:  { fog: '#ead2b2', hemi: '#d6e6ff', sun: '#ffe0b5' },
  forest:   { fog: '#b9d3ea', hemi: '#c6f2ff', sun: '#d9e4ff' },
  valley:   { fog: '#d9ecd2', hemi: '#e6ffe6', sun: '#fff4d6' },
  workshop: { fog: '#efcfa6', hemi: '#ffe4c2', sun: '#ffcf96' },
  market:   { fog: '#f2d0b8', hemi: '#ffe1cc', sun: '#ffd2a8' },
  plateau:  { fog: '#f0cfe0', hemi: '#ffe2f1', sun: '#ffe0ec' }
};
const DEFAULT_STYLE = { ground: '#7fb35a', foliage: '#4d8b44', floor: 3, flat: [22, 14], clear: 22, signY: 15 };
/* 各世界的環境：天空（上／中／下）、海、光、地形用色，以及各區的地面色（ground）、植被色（foliage）與氛圍（MOOD） */
const ENV = {
  fantasy: {
    sky: ['#3a72b5', '#f5d6ae', '#2a6f8f'], water: '#2f86a6', hemi: ['#d6e6ff', '#5b4a36', 1.5], sun: 2.6, exposure: 1.05,
    terrain: { grass: '#78ad55', sand: '#e7d39c', wet: '#b9a675', rock: '#8d8273', path: '#dcc58e', pink: '#eeb2cc' }
  },
  modern: {
    sky: ['#3f86d9', '#e4eef6', '#2f7ea8'], water: '#3a92b8', hemi: ['#e8f1ff', '#55603f', 1.65], sun: 2.7, exposure: 1.05,
    terrain: { grass: '#7cbc58', sand: '#ddd2b0', wet: '#a8a089', rock: '#8e8e88', path: '#62666e', pink: '#c9d98f' },
    style: {
      capital: { ground: '#b9bdb4', foliage: '#4f9a45' }, forest: { ground: '#86c06a', foliage: '#3f8f4f' },
      valley: { ground: '#8fc95e', foliage: '#5ea83e' }, workshop: { ground: '#c4b49a', foliage: '#6fa04a' },
      market: { ground: '#c9bfae', foliage: '#5e9c3e' }, plateau: { ground: '#d7c9e6', foliage: '#e39ab8' }
    },
    mood: {
      capital: { fog: '#dfe8f0', hemi: '#e8f1ff', sun: '#fff3df' }, forest: { fog: '#d6ecf2', hemi: '#e0f6ff', sun: '#f2f8ff' },
      valley: { fog: '#e2f2dc', hemi: '#eeffe6', sun: '#fff8e0' }, workshop: { fog: '#efe2cf', hemi: '#fff0dc', sun: '#ffe6c4' },
      market: { fog: '#f2e2d6', hemi: '#fff0e6', sun: '#ffe6cc' }, plateau: { fog: '#efe0ef', hemi: '#fff0fa', sun: '#fff0f4' }
    }
  },
  cyber: {
    // 白天是帶紫的霧霾晴天，夜裡（見 DN）才是深色霓虹夜景
    sky: ['#3e6fb8', '#a48cc8', '#1d3a66'], water: '#1b3f66', hemi: ['#c9c2ff', '#2a2f48', 1.45], sun: 2.1, exposure: 1.1,
    terrain: { grass: '#4b5372', sand: '#4a4d66', wet: '#2c3048', rock: '#5a5e78', path: '#262a3e', pink: '#6a4a86' },
    style: {
      capital: { ground: '#5a5480', foliage: '#ff4fd8' }, forest: { ground: '#3a5a7e', foliage: '#3ee6ff' },
      valley: { ground: '#3e6a62', foliage: '#4dffb0' }, workshop: { ground: '#6a5446', foliage: '#ff9a3c' },
      market: { ground: '#6a446a', foliage: '#ff5d8f' }, plateau: { ground: '#5e4884', foliage: '#c77dff' }
    },
    mood: {
      capital: { fog: '#b9a6d8', hemi: '#d6ccff', sun: '#fff0f6' }, forest: { fog: '#a6c4e0', hemi: '#c6ecff', sun: '#eaf8ff' },
      valley: { fog: '#a8d4c8', hemi: '#cfffe8', sun: '#f0fff6' }, workshop: { fog: '#d8b8a0', hemi: '#ffe0c6', sun: '#fff0dc' },
      market: { fog: '#d8a8c8', hemi: '#ffd6ec', sun: '#fff0f6' }, plateau: { fog: '#c6aee6', hemi: '#ecdcff', sun: '#fbf0ff' }
    }
  }
};
const EV = ENV[WORLD_ID] || ENV.fantasy;
for (const [id, o] of Object.entries(EV.style || {})) STYLE[id] = { ...STYLE[id], ...o };
for (const [id, o] of Object.entries(EV.mood || {})) MOOD[id] = o;

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
  r.style = { ...DEFAULT_STYLE, rune: r.id.toUpperCase(), ...STYLE[r.id] };
  if (r.rune) r.style.rune = r.rune;
  r.floor = r.style.floor;
  r.flat = r.style.flat;
  r.col = new THREE.Color(r.color);
  r.ground = new THREE.Color(r.style.ground);
  r.teachers = [];
  if (r.field) { // 任務採集場：兩區之間沒有道路的荒野
    const fa = THREE.MathUtils.degToRad(r.field.angle);
    r.field.x = Math.sin(fa) * r.field.dist; r.field.z = -Math.cos(fa) * r.field.dist;
  }
  RG[r.id] = r;
});
const fields = regions.filter((r) => r.field).map((r) => ({ r, ...r.field }));
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
  h += sstep(50, 115, d) * 3 * fbm(x * 0.05 + 3, z * 0.05 + 7);
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
  let fieldW = 0, field = null;
  for (const f of fields) {
    const w = sstep(FIELD_R, FIELD_R - 4, Math.hypot(x - f.x, z - f.z));
    if (w > fieldW) { fieldW = w; field = f; }
  }
  h = h * land + (1 - land) * -5;
  return { h, pathW: pathW * land, near, nearD, fieldW: fieldW * land, field };
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
renderer.toneMappingExposure = EV.exposure;
$('#stage').appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer({ element: $('#labels') });
labelRenderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(MOOD.capital.fog, 210, 520);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 1500);
camera.position.set(0, 160, 225);

/* ---------- 天空、海、光 ---------- */
let skyMat, hemi, sunLight;
{
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(700, 32, 16),
    skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(EV.sky[0]) }, mid: { value: new THREE.Color(EV.sky[1]) }, bot: { value: new THREE.Color(EV.sky[2]) } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vW; void main(){ float h = normalize(vW).y; vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.55)) : mix(mid, bot, pow(-h, 0.4)); gl_FragColor = vec4(c, 1.0); }'
    })
  );
  scene.add(sky);

  const water = new THREE.Mesh(
    new THREE.CircleGeometry(650, 72),
    new THREE.MeshStandardMaterial({ color: EV.water, roughness: 0.3, metalness: 0.1, emissive: WORLD_ID === 'cyber' ? '#08243f' : '#000000' })
  );
  water.rotation.x = -Math.PI / 2; water.position.y = 0.05; water.receiveShadow = true;
  scene.add(water);

  hemi = new THREE.HemisphereLight(...EV.hemi);
  scene.add(hemi);
  const sun = sunLight = new THREE.DirectionalLight(MOOD.capital.sun, EV.sun);
  sun.position.set(-90, 130, 70);
  sun.castShadow = true;
  const sc = sun.shadow.camera;
  sc.left = -135; sc.right = 135; sc.top = 135; sc.bottom = -135; sc.near = 10; sc.far = 420;
  sun.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.5;
  scene.add(sun);
}

/* ---------- 共用工具 ---------- */
/* 卡通明暗：四階漸層，讓地標與人物的明暗分成清楚的色塊，畫風統一 */
const TOON = true;
const toonRamp = (() => {
  const t = new THREE.DataTexture(new Uint8Array([88, 140, 192, 238]), 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
})();
const MATS = new Map();
function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!MATS.has(key)) {
    if (TOON) {
      const { metalness, roughness, flatShading, ...rest } = o; // 卡通材質沒有金屬度與粗糙度
      MATS.set(key, new THREE.MeshToonMaterial({ color, gradientMap: toonRamp, ...rest }));
    } else MATS.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, ...o }));
  }
  return MATS.get(key);
}
/* 程式貼圖：淺灰紋理，由材質顏色染色，同一張紋理可用在不同顏色 */
const PATTERNS = {
  stone(c, w, h) { // 石砌：錯縫石塊
    c.fillStyle = '#9a9a9a'; c.fillRect(0, 0, w, h);
    for (let y = 0, row = 0; y < h; y += 32, row++) for (let x = -48; x < w; x += 48) {
      const v = 210 + ((x * 7 + y * 13) % 40); c.fillStyle = `rgb(${v},${v},${v})`;
      c.fillRect(x + (row % 2) * 24 + 2, y + 2, 44, 28);
    }
  },
  tile(c, w, h) { // 屋瓦：魚鱗瓦
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
    for (let y = 0, row = 0; y < h + 16; y += 16, row++) for (let x = -16; x < w + 16; x += 32) {
      const cx = x + (row % 2) * 16;
      c.fillStyle = '#c8c8c8'; c.beginPath(); c.arc(cx, y, 16, 0, Math.PI); c.fill();
      c.fillStyle = '#f2f2f2'; c.beginPath(); c.arc(cx, y - 2, 13, 0, Math.PI); c.fill();
    }
  },
  wood(c, w, h) { // 木紋：直紋與節眼
    c.fillStyle = '#e6e6e6'; c.fillRect(0, 0, w, h);
    for (let k = 0; k < 26; k++) {
      const x0 = (k * 37) % w, v = 160 + (k * 29) % 70;
      c.strokeStyle = `rgba(${v},${v},${v},0.8)`; c.lineWidth = 1 + (k % 3);
      c.beginPath(); for (let y = 0; y <= h; y += 8) c.lineTo(x0 + Math.sin(y * 0.05 + k) * 3, y); c.stroke();
    }
    c.fillStyle = 'rgba(120,120,120,0.6)'; c.beginPath(); c.ellipse(90, 40, 5, 9, 0, 0, Math.PI * 2); c.fill();
  }
};
const PATTERN_TEX = {};
function texMat(pattern, color, repeat = 1) {
  const key = `tex:${pattern}:${color}:${repeat}`;
  if (!MATS.has(key)) {
    let t = PATTERN_TEX[pattern + repeat];
    if (!t) {
      const c = document.createElement('canvas'); c.width = c.height = 128; PATTERNS[pattern](c.getContext('2d'), 128, 128);
      t = PATTERN_TEX[pattern + repeat] = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 4;
    }
    MATS.set(key, TOON ? new THREE.MeshToonMaterial({ color, map: t, gradientMap: toonRamp }) : new THREE.MeshStandardMaterial({ color, map: t, roughness: 0.85 }));
  }
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
/* 夜燈位置（路燈、火把、霓虹柱）：夜裡在這些點亮起光暈與地面光圈。
 * parent 給了就是 parent 的區域座標（地標群組在合併前位置還沒算好，等全部建好再換算成世界座標） */
const lightSpots = [];
function addLight(parent, x, y, z, color, o = {}) { lightSpots.push({ parent, x, y, z, color, pool: 5, ...o }); }
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
  const animate = (t, dt) => {
    const p = geo.attributes.position;
    for (let i = 0; i < count; i++) {
      let y = p.getY(i) + dt * seed[i] * speed;
      if (y > y1) y = y0;
      p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(t * seed[i] + i) * dt * 0.3);
    }
    p.needsUpdate = true;
  };
  pts.userData.animate = animate;
  animators.push(animate);
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
  const SIZE = 360, SEG = isTouch ? 200 : 280;
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
  const T = EV.terrain;
  const grass = new THREE.Color(T.grass), sand = new THREE.Color(T.sand), wet = new THREE.Color(T.wet);
  const rock = new THREE.Color(T.rock), path = new THREE.Color(T.path), pink = new THREE.Color(T.pink);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const { h, pathW, near, nearD, fieldW, field } = infos[i];
    const x = pos.getX(i), z = pos.getZ(i);
    c.copy(grass).lerp(near.ground, sstep(38, 12, nearD) * 0.78);
    if (near.id === 'plateau' && h > 9.5) c.lerp(pink, 0.35);
    const ny = nrm.getY(i);
    c.lerp(rock, sstep(0.84, 0.6, ny));
    c.lerp(sand, sstep(1.5, 0.6, h));
    c.lerp(wet, sstep(0.2, -1.5, h));
    c.lerp(path, pathW * 0.9);
    if (fieldW > 0) c.lerp(path, fieldW * 0.45).lerp(field.r.col, fieldW * 0.18);
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
/* ---------- 地標特效共用工具 ---------- */
// 鏡頭離區域太遠時暫停該區的特效動畫，省效能
let detecting = false; // 合併靜態模型前偵測動態物件時，強制所有特效都跑
const camNear = (r, d = 170) => detecting || Math.hypot(camera.position.x - r.x, camera.position.z - r.z) < d;
// 標記會動、但動得不頻繁的物件，避免被當成靜態模型合併
const dyn = (o) => { o.userData.dynamic = true; return o; };
// 用 canvas 畫貼圖
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// 貼著地形起伏的平面（地面特效用），中心在區域座標 (cu, cv)
function drapedPlane(ctx, cu, cv, sx, sz, seg, material) {
  const geo = new THREE.PlaneGeometry(sx, sz, seg, Math.max(2, Math.round(seg * sz / sx)));
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, ctx.ly(cu + p.getX(i), cv + p.getZ(i)) + 0.14);
  geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, material);
  m.position.set(cu, 0, cv); m.renderOrder = 1; ctx.g.add(m);
  return m;
}
const GROUND_VS = 'varying vec2 vP; varying vec2 vUv; void main(){ vP = position.xz; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const groundFX = (uniforms, fragmentShader, additive = true) => new THREE.ShaderMaterial({
  uniforms, vertexShader: GROUND_VS, fragmentShader, transparent: true, depthWrite: false,
  polygonOffset: true, polygonOffsetFactor: -2, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
});
const _v3 = new THREE.Vector3();
// 玩家在某區域座標系中的位置（探險模式才有）
function playerLocal(g, out) {
  if (state.mode !== 'explore') return false;
  g.worldToLocal(_v3.copy(player.position)); out.set(_v3.x, _v3.z);
  return true;
}

function buildCapital(r) {
  const ctx = regionCtx(r), { g, col } = ctx;
  const stone = texMat('stone', '#f0e6cf', 2), stone2 = texMat('stone', '#d3c4a4', 2), roof = texMat('tile', '#c24a33', 2), gold = mat('#e2b45c', { metalness: 0.45, roughness: 0.4 });
  const win = mat('#3a2614', { emissive: '#ffb347', emissiveIntensity: 0.7 });
  // 城牆旗幟：藍圖布
  const bpTex = canvasTex(64, 160, (c, w, h) => {
    c.fillStyle = '#1f4f8f'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 1;
    for (let x = 0; x <= w; x += 8) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (let y = 0; y <= h; y += 8) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.strokeStyle = '#ffffff'; c.lineWidth = 2.5; c.strokeRect(12, 24, 40, 56); c.beginPath(); c.moveTo(12, 52); c.lineTo(52, 52); c.moveTo(32, 24); c.lineTo(32, 52); c.stroke();
    c.beginPath(); c.arc(32, 112, 14, 0, Math.PI * 2); c.stroke();
    c.fillStyle = r.color; c.fillRect(0, h - 14, w, 14);
  });
  const bpBanner = new THREE.MeshStandardMaterial({ map: bpTex, side: THREE.DoubleSide, roughness: 0.8 });
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
      const banner = mesh(new THREE.PlaneGeometry(1.5, 3.6), bpBanner, x * 1.15, 5.2, z * 1.15, g);
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
  // ── 第二階段：關係星圖（社會網路分析）環繞主塔頂端 ──
  const net = new THREE.Group(); net.position.y = 19; g.add(net);
  const nodeP = [];
  for (let i = 0; i < 16; i++) {
    const a = i * 2.39996, rad = 5.5 + hash2(i, 7.3) * 3;
    nodeP.push(new THREE.Vector3(Math.cos(a) * rad, (hash2(i, 3.1) - 0.5) * 6, Math.sin(a) * rad));
  }
  const edges = [];
  nodeP.forEach((p, i) => nodeP.forEach((q, j) => { if (j > i && p.distanceTo(q) < 5.4) edges.push([i, j]); }));
  const nodeMat = mat('#ffc23d', { emissive: '#ff9a1a', emissiveIntensity: 0.9 });
  const nodeM = nodeP.map((p) => { const m = mesh(new THREE.IcosahedronGeometry(0.5, 0), nodeMat, p.x, p.y, p.z, net); m.castShadow = false; return m; });
  net.add(new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(edges.flatMap(([a, b]) => [nodeP[a], nodeP[b]])),
    new THREE.LineBasicMaterial({ color: '#e8920c', transparent: true, opacity: 0.95, depthWrite: false })
  ));
  const pulseMat = new THREE.MeshBasicMaterial({ color: '#fff6c8' });
  const pulses = Array.from({ length: isTouch ? 5 : 9 }, (_, i) => ({ m: mesh(new THREE.SphereGeometry(0.28, 6, 5), pulseMat, 0, 0, 0, net), e: edges[(i * 7) % edges.length], k: hash2(i, 2) }));
  // 地面藍圖：城門前的平面圖一筆一筆畫出來
  const planTex = canvasTex(512, 320, (c, w, h) => {
    c.strokeStyle = '#ffffff'; c.lineCap = 'round';
    c.lineWidth = 7; c.strokeRect(24, 24, w - 48, h - 48);
    c.lineWidth = 4;
    [[200, 24, 200, 180], [24, 180, 330, 180], [330, 24, 330, 296], [200, 240, 330, 240]].forEach(([a, b, x, y]) => { c.beginPath(); c.moveTo(a, b); c.lineTo(x, y); c.stroke(); });
    c.lineWidth = 2;
    [[120, 180, 40], [330, 120, 36]].forEach(([x, y, rr]) => { c.beginPath(); c.arc(x, y, rr, Math.PI, Math.PI * 1.5); c.stroke(); });
    c.strokeRect(60, 60, 90, 60); c.strokeRect(380, 60, 90, 120);
    c.beginPath(); c.arc(420, 250, 30, 0, Math.PI * 2); c.stroke();
    c.setLineDash([10, 8]); c.beginPath(); c.moveTo(24, h - 8); c.lineTo(w - 24, h - 8); c.stroke();
  });
  const planMat = groundFX({ map: { value: planTex }, prog: { value: 0 }, fade: { value: 1 } },
    `uniform sampler2D map; uniform float prog; uniform float fade; varying vec2 vUv;
    void main(){
      float a = texture2D(map, vUv).a;
      float s = vUv.x * 0.7 + (1.0 - vUv.y) * 0.3;
      float shown = step(s, prog), edge = smoothstep(0.05, 0.0, abs(s - prog));
      float grid = (step(0.96, fract(vUv.x * 32.0)) + step(0.95, fract(vUv.y * 20.0))) * 0.25;
      vec3 line = mix(vec3(0.75, 0.9, 1.0), vec3(1.0, 0.92, 0.55), edge);
      vec3 col = mix(vec3(0.16, 0.42, 0.85), line, a);
      gl_FragColor = vec4(col, (0.16 + grid * 0.5 + a * (shown + edge * 2.0)) * fade);
    }`, false);
  drapedPlane(ctx, 0, 23.5, 14, 8.75, 40, planMat);
  animators.push((t, dt) => {
    if (!camNear(r, 230)) return;
    net.rotation.y += dt * 0.08;
    nodeM.forEach((m, i) => m.scale.setScalar(1 + Math.max(0, Math.sin(t * 1.7 - i * 0.6)) * 0.6));
    pulses.forEach((p) => {
      p.k += dt * 0.7;
      if (p.k >= 1) {
        p.k = 0;
        const from = p.e[1], next = edges.filter((e) => e[0] === from || e[1] === from);
        const e = next[Math.floor(Math.random() * next.length)] || edges[0];
        p.e = e[0] === from ? e : [e[1], e[0]];
      }
      p.m.position.lerpVectors(nodeP[p.e[0]], nodeP[p.e[1]], p.k);
    });
    const c = t % 10;
    planMat.uniforms.prog.value = Math.min(1.1, c / 6 * 1.1);
    planMat.uniforms.fade.value = c < 9 ? 1 : 1 - (c - 9);
  });
}

function buildForest(r) {
  const ctx = regionCtx(r), { g, ly, col, clear } = ctx;
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
  // ── 第二階段：神經網路樹（AI）──
  const layers = [[6, 6.6, 8], [6, 5.6, 12.5], [3, 2.4, 18.6]];
  const lp = layers.map(([n, rad, y], li) => Array.from({ length: n }, (_, i) => {
    const a = i / n * Math.PI * 2 + li * 0.5;
    return new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad);
  }));
  const neuronMat = mat('#e8feff', { emissive: '#3ee6ff', emissiveIntensity: 1.3 });
  const neurons = lp.flat().map((p) => { const m = mesh(new THREE.IcosahedronGeometry(0.3, 0), neuronMat, p.x, p.y, p.z, g); m.castShadow = false; return m; });
  const synapses = [];
  for (let l = 0; l < 2; l++) lp[l].forEach((a, i) => lp[l + 1].forEach((b, j) => synapses.push([l, i, j])));
  g.add(new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(synapses.flatMap(([l, i, j]) => [lp[l][i], lp[l + 1][j]])),
    new THREE.LineBasicMaterial({ color: '#7ff4ff', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })
  ));
  const sigMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const signals = Array.from({ length: isTouch ? 6 : 12 }, (_, i) => ({ m: mesh(new THREE.SphereGeometry(0.16, 6, 5), sigMat, 0, 0, 0, g), s: synapses[(i * 5) % synapses.length], k: i / 12 }));
  // 沿樹幹往上流的資料流
  const streamTex = canvasTex(64, 256, (c, w, h) => {
    for (let k = 0; k < 14; k++) {
      const x = (k * 37) % w, y = (k * 71) % h, len = 20 + (k * 13) % 50;
      const gr = c.createLinearGradient(0, y, 0, y + len); gr.addColorStop(0, 'rgba(160,255,255,0)'); gr.addColorStop(1, 'rgba(160,255,255,1)');
      c.fillStyle = gr; c.fillRect(x, y, 3, len);
    }
  });
  streamTex.wrapS = streamTex.wrapT = THREE.RepeatWrapping; streamTex.repeat.set(3, 1.5);
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 1.98, 11, 14, 1, true),
    new THREE.MeshBasicMaterial({ map: streamTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  stream.position.y = 5.5; g.add(stream);
  // 六角電路地面：中心定時發出脈衝，玩家走過泛起漣漪
  const hexMat = groundFX({ time: { value: 0 }, pl: { value: new THREE.Vector2(999, 999) } },
    `uniform float time; uniform vec2 pl; varying vec2 vP;
    float hexDist(vec2 p){ p = abs(p); return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x); }
    void main(){
      vec2 uv = vP / 1.5, rr = vec2(1.0, 1.7320508), h = rr * 0.5;
      vec2 a = mod(uv, rr) - h, b = mod(uv - h, rr) - h;
      vec2 gv = dot(a, a) < dot(b, b) ? a : b;
      float line = 1.0 - smoothstep(0.02, 0.07, 0.5 - hexDist(gv));
      float d = length(vP);
      float ring = smoothstep(0.1, 0.0, abs(fract(d / 18.0 - time * 0.22) - 0.5));
      float dp = length(vP - pl);
      float rip = smoothstep(6.0, 0.0, dp) * (0.55 + 0.45 * sin(dp * 2.2 - time * 7.0));
      float a2 = line * (0.1 + ring * 0.8 + rip) * smoothstep(21.0, 15.0, d);
      gl_FragColor = vec4(vec3(0.3, 0.95, 1.0) * a2, a2);
    }`);
  drapedPlane(ctx, 0, 0, 42, 42, isTouch ? 36 : 60, hexMat);
  // 體素樹：方塊一格格生成、再散成光點（生成式 AI）
  const spot = [[-13, -7], [12, -9], [-10, -14], [14, -2], [-15, 2]].find(([u, v]) => clear(u, v, 3)) || [-13, -7];
  const vox = [];
  for (let y = 0; y < 4; y++) vox.push([0, y * 0.5 + 0.25, 0, '#7d6bd6']);
  for (let x = -3; x <= 3; x++) for (let y = 0; y <= 5; y++) for (let z = -3; z <= 3; z++) {
    if (x * x + (y - 2.5) * (y - 2.5) * 1.2 + z * z <= 9.5 && hash2(x * 7 + z, y) > 0.25) vox.push([x * 0.5, 2.2 + y * 0.5, z * 0.5, (x + y + z) % 3 ? '#68f3f3' : '#c3adff']);
  }
  const voxM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), new THREE.MeshStandardMaterial({ emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.3, flatShading: true }), vox.length);
  const vy = ctx.ly(spot[0], spot[1]), maxH = Math.max(...vox.map((v) => v[1]));
  vox.forEach((v, i) => voxM.setColorAt(i, new THREE.Color(v[3])));
  voxM.position.set(spot[0], vy, spot[1]); voxM.castShadow = true; g.add(voxM);
  col(spot[0], spot[1], 1.2);
  const m4 = new THREE.Matrix4(), vq = new THREE.Quaternion(), vs = new THREE.Vector3(), vp = new THREE.Vector3();
  const plV = new THREE.Vector2();
  animators.push((t, dt) => {
    if (!camNear(r)) return;
    neurons.forEach((m, i) => m.scale.setScalar(1 + Math.max(0, Math.sin(t * 2.2 - i * 0.8)) * 0.5));
    signals.forEach((s) => {
      s.k += dt * 0.8;
      if (s.k >= 1) { s.k = 0; const [l, , j] = s.s; s.s = l === 0 ? [1, j, Math.floor(Math.random() * 3)] : [0, Math.floor(Math.random() * 6), Math.floor(Math.random() * 6)]; }
      const [l, i, j] = s.s; s.m.position.lerpVectors(lp[l][i], lp[l + 1][j], s.k);
    });
    streamTex.offset.y -= dt * 0.35;
    hexMat.uniforms.time.value = t;
    if (playerLocal(g, plV)) hexMat.uniforms.pl.value.copy(plV); else hexMat.uniforms.pl.value.set(999, 999);
    const c = t % 9;
    vox.forEach((v, i) => {
      const h = v[1] / maxH;
      let s = 0, lift = 0;
      if (c < 5.5) s = Math.min(1, Math.max(0, (c - h * 3) / 0.4));
      else { const k = Math.min(1, Math.max(0, (c - 5.5 - (1 - h) * 1.5) / 0.6)); s = 1 - k; lift = k * 1.5; }
      m4.compose(vp.set(v[0], v[1] + lift, v[2]), vq, vs.setScalar(Math.max(0.001, s)));
      voxM.setMatrixAt(i, m4);
    });
    voxM.instanceMatrix.needsUpdate = true;
  });
}

function buildValley(r) {
  const ctx = regionCtx(r), { g, ly, col } = ctx;
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
  // 循環之環（循環設計）
  const loop = new THREE.Group(); loop.position.set(0, ly(0, 3) + 10, 3); g.add(loop);
  const loopMat = mat('#9be37a', { emissive: '#58c23a', emissiveIntensity: 0.7 });
  const arcLen = Math.PI * 2 / 3 - 0.45;
  for (let k = 0; k < 3; k++) {
    const piv = new THREE.Group(); piv.rotation.z = k * Math.PI * 2 / 3; loop.add(piv);
    mesh(new THREE.TorusGeometry(2.6, 0.32, 8, 24, arcLen), loopMat, 0, 0, 0, piv);
    const head = mesh(new THREE.ConeGeometry(0.62, 1.1, 8), loopMat, Math.cos(arcLen) * 2.6, Math.sin(arcLen) * 2.6, 0, piv);
    head.rotation.z = arcLen; // 箭頭沿圓弧切線
  }
  animators.push((t, dt) => { loop.rotation.z += dt * 0.5; loop.rotation.y = Math.sin(t * 0.4) * 0.35; });
  // 可見的氣流
  const N = isTouch ? 120 : 180, pos = new Float32Array(N * 3), prm = [];
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
  // ── 第二階段：智慧實驗小屋（智慧生活與互動設計）──
  const cabin = new THREE.Group(); cabin.position.set(-9.5, ly(-9.5, 5), 5); cabin.rotation.y = Math.atan2(9.5, -5); g.add(cabin);
  mesh(new THREE.BoxGeometry(4.6, 3, 3.4), mat('#f4efe4'), 0, 1.5, 0, cabin);
  mesh(new THREE.BoxGeometry(5, 0.25, 3.8), mat('#6e5a43'), 0, 3.12, 0, cabin);
  const panes = [-1.4, 0, 1.4].map((x) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 0.08), new THREE.MeshStandardMaterial({ color: '#cfe9ff', emissive: '#ffd27a', emissiveIntensity: 0.1, transparent: true, opacity: 0.85 })); m.position.set(x, 1.45, 1.72); cabin.add(m); return m; });
  for (const x of [-0.9, 0.9]) { const sp = mesh(new THREE.BoxGeometry(1.6, 0.08, 1.4), mat('#24365e', { metalness: 0.6, roughness: 0.3 }), x, 3.55, -0.4, cabin); sp.rotation.x = -0.35; }
  const beacon = dyn(mesh(new THREE.SphereGeometry(0.16, 8, 6), mat('#7dffb0', { emissive: '#3cff8a', emissiveIntensity: 1.5 }), 1.9, 3.5, 1.4, cabin));
  beacon.castShadow = false;
  col(-9.5, 5, 2.8);
  // CFD 流線：看得見的氣流，顏色由冷（藍）到熱（紅）
  const flowMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float time; varying vec2 vUv;
      void main(){
        vec3 col = mix(vec3(0.25, 0.55, 1.0), vec3(1.0, 0.35, 0.25), smoothstep(0.1, 0.9, vUv.x));
        float dash = smoothstep(0.55, 1.0, fract(vUv.x * 7.0 - time * 0.7));
        float a = (0.18 + 0.82 * dash) * smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
        gl_FragColor = vec4(col * a, a);
      }`
  });
  const NF = isTouch ? 6 : 10;
  for (let i = 0; i < NF; i++) {
    const zc = -11 + i * (20 / NF), h = 1.6 + (i % 4) * 1.4, ph = i * 1.7;
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const x = -22 + k * (44 / 12), z = zc + Math.sin(x * 0.16 + ph) * 2.6;
      pts.push(new THREE.Vector3(x, ly(x, z) + h + Math.sin(x * 0.3 + ph) * 0.6, z));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.07, 5), flowMat);
    tube.renderOrder = 2; g.add(tube);
  }
  // 空氣品質柱：光環顏色隨空氣品質由綠轉黃
  const aqi = new THREE.Group(); aqi.position.set(6.5, ly(6.5, 8.5), 8.5); g.add(aqi);
  mesh(new THREE.CylinderGeometry(0.22, 0.3, 4, 8), mat('#d7dce2', { metalness: 0.4, roughness: 0.4 }), 0, 2, 0, aqi);
  const aqiMat = new THREE.MeshBasicMaterial({ color: '#5dff9a', transparent: true, opacity: 0.85 });
  const aqiRings = [2.6, 3.2, 3.8].map((y) => { const m = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.07, 6, 24), aqiMat); m.position.y = y; m.rotation.x = Math.PI / 2; aqi.add(m); return m; });
  const aqiTop = mesh(new THREE.SphereGeometry(0.3, 10, 8), aqiMat, 0, 4.35, 0, aqi); aqiTop.castShadow = false;
  col(6.5, 8.5, 0.6);
  const good = new THREE.Color('#5dff9a'), fair = new THREE.Color('#ffd84a');
  // 循環之環上移動的建材方塊，每過一段就換一種材料
  const loopMats = [mat('#c08a52'), mat('#9b9a96'), mat('#bfe8ff', { transparent: true, opacity: 0.7, roughness: 0.1 })];
  const travelers = [0, 1, 2].map((k) => ({ k, m: mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), loopMats[k], 0, 0, 0.5, loop) }));
  animators.push((t, dt) => {
    if (!camNear(r)) return;
    flowMat.uniforms.time.value = t;
    const lit = Math.floor(t / 1.6) % 4;
    panes.forEach((p, i) => { p.material.emissiveIntensity = i < lit ? 0.9 : 0.1; });
    beacon.visible = Math.sin(t * 5) > -0.2;
    const q = Math.sin(t * 0.5) * 0.5 + 0.5;
    aqiMat.color.copy(good).lerp(fair, q * q);
    aqiRings.forEach((m, i) => { m.scale.setScalar(1 + Math.sin(t * 2 - i) * 0.08); });
    travelers.forEach((tr) => {
      const a = t * 0.7 + tr.k * Math.PI * 2 / 3, seg = Math.floor(((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2 / 3));
      tr.m.position.set(Math.cos(a) * 2.6, Math.sin(a) * 2.6, 0.5);
      tr.m.material = loopMats[seg]; tr.m.rotation.set(t, t * 1.3, 0);
    });
  });
}

function buildWorkshop(r) {
  const { g, ly, col } = regionCtx(r);
  const plaster = mat('#efe0c2'), timber = texMat('wood', '#8a5a36'), roofM = texMat('tile', '#a8503a', 0.6), roof2 = texMat('tile', '#7a6550', 0.6), oak = texMat('wood', '#c08452'), win = mat('#3a2614', { emissive: '#ffb347', emissiveIntensity: 0.6 });
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
  // 實構築：外露的木構架（樑柱、斜撐、人字屋架）
  const frame = new THREE.Group(); frame.position.set(-8.5, ly(-8.5, 5), 5); frame.rotation.y = 0.5; g.add(frame);
  const FW = 2.6, FD = 1.9, FH = 4.2;
  for (const x of [-FW, 0, FW]) for (const z of [-FD, FD]) mesh(new THREE.BoxGeometry(0.35, FH, 0.35), oak, x, FH / 2, z, frame);
  for (const z of [-FD, FD]) mesh(new THREE.BoxGeometry(FW * 2 + 0.6, 0.35, 0.35), timber, 0, FH, z, frame);
  for (const x of [-FW, 0, FW]) {
    mesh(new THREE.BoxGeometry(0.3, 0.3, FD * 2 + 0.5), timber, x, FH + 0.3, 0, frame);
    for (const sg of [-1, 1]) { const rf = mesh(new THREE.BoxGeometry(0.22, 0.22, 2.75), oak, x, FH + 1.15, sg * 0.95, frame); rf.rotation.x = sg * 0.73; }
  }
  mesh(new THREE.BoxGeometry(FW * 2 + 0.6, 0.25, 0.25), timber, 0, FH + 2.05, 0, frame);
  for (const sx of [-1, 1]) for (const z of [-FD, FD]) {
    const br = mesh(new THREE.BoxGeometry(0.16, 1.56, 0.16), timber, sx * (FW - 0.55), FH - 0.55, z, frame); br.rotation.z = sx * Math.PI / 4;
  }
  for (let k = 0; k < 4; k++) mesh(new THREE.BoxGeometry(4, 0.3, 0.3), oak, 0, 0.15 + (k > 1 ? 0.3 : 0), FD + 1.2 + (k % 2) * 0.35, frame);
  col(-8.5, 5, 3.3);
  // 數位製造：機械手臂與加工台
  const steel = mat('#d9dde3', { metalness: 0.5, roughness: 0.35 }), armM = mat('#f28c28', { roughness: 0.5 });
  const cell = new THREE.Group(); cell.position.set(5.5, ly(5.5, 6.5), 6.5); cell.rotation.y = -0.6; g.add(cell);
  mesh(new THREE.BoxGeometry(3.2, 0.9, 2), mat('#5a5f69', { metalness: 0.4 }), 1.2, 0.45, 0, cell);
  mesh(new THREE.BoxGeometry(1.4, 0.5, 1), oak, 1.4, 1.15, 0, cell);
  mesh(new THREE.CylinderGeometry(0.6, 0.75, 0.6, 12), steel, -1.2, 0.3, 0, cell);
  const turret = new THREE.Group(); turret.position.set(-1.2, 0.6, 0); cell.add(turret);
  mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.6, 12), armM, 0, 0.3, 0, turret);
  const shoulder = new THREE.Group(); shoulder.position.y = 0.7; turret.add(shoulder);
  mesh(new THREE.BoxGeometry(0.4, 2.2, 0.4), armM, 0, 1.1, 0, shoulder);
  const elbow = new THREE.Group(); elbow.position.y = 2.2; shoulder.add(elbow);
  mesh(new THREE.SphereGeometry(0.3, 10, 8), steel, 0, 0, 0, elbow);
  mesh(new THREE.BoxGeometry(0.32, 1.8, 0.32), armM, 0, 0.9, 0, elbow);
  mesh(new THREE.ConeGeometry(0.16, 0.4, 8), steel, 0, 1.95, 0, elbow);
  const spark = mesh(new THREE.OctahedronGeometry(0.16), mat('#fff6c8', { emissive: '#ffd36b', emissiveIntensity: 2 }), 0, 2.2, 0, elbow);
  spark.castShadow = false;
  col(5.5, 6.5, 2.2);
  animators.push((t) => {
    turret.rotation.y = Math.sin(t * 0.6) * 0.35;
    shoulder.rotation.z = -0.5 + Math.sin(t * 0.9) * 0.12;
    elbow.rotation.z = -1.6 + Math.sin(t * 1.3) * 0.18;
    spark.visible = Math.sin(t * 9) > 0;
  });
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
  // ── 第二階段：塔式吊車把木樑一根根吊上構架（實構築）──
  const yellow = mat('#f2b632'), cb = new THREE.Vector3(-14, ly(-14, 10), 10);
  const crane = new THREE.Group(); crane.position.copy(cb); g.add(crane);
  for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) mesh(new THREE.BoxGeometry(0.12, 10, 0.12), yellow, x, 5, z, crane);
  for (let y = 1; y < 10; y += 1.2) for (const rz of [0, Math.PI / 2]) { const br = mesh(new THREE.BoxGeometry(0.85, 0.08, 0.08), yellow, 0, y, 0, crane); br.rotation.set(0, rz, 0.7); }
  col(-14, 10, 0.7);
  const jib = new THREE.Group(); jib.position.y = 10.2; crane.add(jib);
  mesh(new THREE.BoxGeometry(9.5, 0.35, 0.35), yellow, 3.2, 0, 0, jib);
  mesh(new THREE.BoxGeometry(1.2, 0.9, 0.9), mat('#5a5f69'), -1.6, -0.3, 0, jib);
  mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), mat('#2b3a55'), 0, 0.6, 0, jib);
  const trolley = mesh(new THREE.BoxGeometry(0.5, 0.25, 0.5), mat('#3a3a3a'), 4, -0.3, 0, jib);
  const cable = mesh(new THREE.BoxGeometry(0.04, 1, 0.04), mat('#222222'), 0, 0, 0, g); cable.castShadow = false;
  const hook = mesh(new THREE.TorusGeometry(0.16, 0.05, 5, 10, Math.PI * 1.5), mat('#3a3a3a'), 0, 0, 0, g);
  const BEAM_ROT = 0.5;
  const hangBeam = mesh(new THREE.BoxGeometry(0.3, 0.3, 3.2), oak, 0, 0, 0, g); hangBeam.rotation.y = BEAM_ROT;
  const P0 = new THREE.Vector3(-10.8, 0, 11.2); P0.y = ly(P0.x, P0.z);
  for (let k = 0; k < 3; k++) { const b = mesh(new THREE.BoxGeometry(0.3, 0.3, 3.2), oak, P0.x + (k - 1) * 0.36, P0.y + 0.15, P0.z, g); b.rotation.y = BEAM_ROT; }
  col(P0.x, P0.z, 1.4);
  const P1 = new THREE.Vector3(-8.5, ly(-8.5, 5) + 4.85, 5);
  const placed = dyn(mesh(new THREE.BoxGeometry(0.3, 0.3, 3.2), mat('#d39a5e', { emissive: '#ffb347', emissiveIntensity: 0 }), P1.x, P1.y, P1.z, g)); placed.rotation.y = BEAM_ROT;
  const angTo = (p) => Math.atan2(-(p.z - cb.z), p.x - cb.x), distTo = (p) => Math.hypot(p.x - cb.x, p.z - cb.z) - 0.4;
  const A0 = angTo(P0), A1 = angTo(P1), D0 = distTo(P0), D1 = distTo(P1), TOP = cb.y + 8.6;
  const sm = (a, b, k) => a + (b - a) * (k * k * (3 - 2 * k));
  const ph = (c, a, b) => Math.min(1, Math.max(0, (c - a) / (b - a)));
  // 雷射切割台（數位製造）：雷射頭沿著零件輪廓移動，燒出切割線
  const laser = new THREE.Group(); laser.position.set(13, ly(13, 2.5), 2.5); laser.rotation.y = -0.4; g.add(laser);
  mesh(new THREE.BoxGeometry(2.8, 0.9, 1.9), mat('#3a3f48', { metalness: 0.4 }), 0, 0.45, 0, laser);
  const cutCv = document.createElement('canvas'); cutCv.width = cutCv.height = 128;
  const cutCx = cutCv.getContext('2d'), cutTex = new THREE.CanvasTexture(cutCv); cutTex.colorSpace = THREE.SRGBColorSpace;
  const sheet = mesh(new THREE.BoxGeometry(2.4, 0.04, 1.5), [mat('#d9b380'), mat('#d9b380'), new THREE.MeshStandardMaterial({ map: cutTex, roughness: 0.9 }), mat('#d9b380'), mat('#d9b380'), mat('#d9b380')], 0, 0.93, 0, laser);
  for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.1, 0.6, 1.9), mat('#c9ccd1', { metalness: 0.5 }), sx * 1.35, 1.2, 0, laser);
  const gantry = mesh(new THREE.BoxGeometry(0.16, 0.12, 1.9), mat('#c9ccd1', { metalness: 0.5 }), 0, 1.5, 0, laser);
  const head = new THREE.Group(); laser.add(head);
  mesh(new THREE.BoxGeometry(0.22, 0.25, 0.22), mat('#e5484d'), 0, 1.42, 0, head);
  const ray = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 4), new THREE.MeshBasicMaterial({ color: '#ff4d4d' })); ray.position.y = 1.15; head.add(ray);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), new THREE.MeshBasicMaterial({ color: '#fff0c0' })); dot.position.y = 0.96; head.add(dot);
  col(13, 2.5, 1.7);
  const se = (v) => Math.sign(v) * Math.abs(v) ** 0.4; // 超橢圓：圓角矩形
  const cutPath = (k) => { // 椅背零件輪廓：外框圓角矩形＋中間圓孔
    if (k < 0.7) { const a = k / 0.7 * Math.PI * 2; return [se(Math.cos(a)) * 0.85, se(Math.sin(a)) * 0.5]; }
    const a = (k - 0.7) / 0.3 * Math.PI * 2; return [0.25 + Math.cos(a) * 0.2, Math.sin(a) * 0.2];
  };
  const resetCut = () => { cutCx.fillStyle = '#d9b380'; cutCx.fillRect(0, 0, 128, 128); cutTex.needsUpdate = true; };
  resetCut();
  let lastCut = null, cutCycle = -1;
  // 機械手臂的火花
  const SPN = isTouch ? 20 : 40, spPos = new Float32Array(SPN * 3), spVel = [];
  for (let i = 0; i < SPN; i++) { spVel.push(new THREE.Vector3()); spPos[i * 3 + 1] = -99; }
  const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
  g.add(new THREE.Points(spGeo, new THREE.PointsMaterial({ color: '#ffd36b', size: 0.22, map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  let spI = 0;
  const tip = new THREE.Vector3();
  animators.push((t, dt) => {
    if (!camNear(r)) return;
    // 吊車 12 秒一輪：取料 → 吊起 → 轉向 → 放到構架上
    const c = t % 12;
    let ang, dist, hy, carry = false;
    if (c < 2) { ang = sm(A1, A0, ph(c, 0, 2)); dist = sm(D1, D0, ph(c, 0, 2)); hy = TOP; }
    else if (c < 5) { ang = A0; dist = D0; hy = c < 3.5 ? sm(TOP, P0.y + 1.2, ph(c, 2, 3.5)) : sm(P0.y + 1.2, TOP, ph(c, 3.5, 5)); carry = c >= 3.5; }
    else if (c < 8) { ang = sm(A0, A1, ph(c, 5, 8)); dist = sm(D0, D1, ph(c, 5, 8)); hy = TOP; carry = true; }
    else if (c < 9.6) { ang = A1; dist = D1; hy = sm(TOP, P1.y + 0.9, ph(c, 8, 9.6)); carry = true; }
    else { ang = A1; dist = D1; hy = sm(P1.y + 0.9, TOP, ph(c, 9.6, 12)); }
    jib.rotation.y = ang; trolley.position.x = dist;
    const hx = cb.x + Math.cos(ang) * dist, hz = cb.z - Math.sin(ang) * dist, topY = cb.y + 9.9;
    hook.position.set(hx, hy, hz);
    cable.position.set(hx, (topY + hy) / 2, hz); cable.scale.y = Math.max(0.1, topY - hy);
    hangBeam.visible = carry; hangBeam.position.set(hx, hy - 0.5, hz);
    placed.visible = c >= 9.6 && c < 11.7;
    placed.material.emissiveIntensity = placed.visible ? Math.max(0, 1 - (c - 9.6)) * 0.8 : 0;
    // 雷射切割 8 秒一輪
    const lc = t % 8, cyc = Math.floor(t / 8);
    if (cyc !== cutCycle) { cutCycle = cyc; resetCut(); lastCut = null; }
    const k = Math.min(1, lc / 6.5), [px, pz] = cutPath(k);
    head.position.set(px, 0, pz); gantry.position.x = px;
    dot.visible = ray.visible = lc < 6.5;
    if (lc < 6.5) {
      const cx = 64 + px / 1.2 * 64, cy = 64 + pz / 0.75 * 64;
      if (lastCut && Math.hypot(cx - lastCut[0], cy - lastCut[1]) < 20) { cutCx.strokeStyle = '#3a2412'; cutCx.lineWidth = 2.5; cutCx.beginPath(); cutCx.moveTo(...lastCut); cutCx.lineTo(cx, cy); cutCx.stroke(); cutTex.needsUpdate = true; }
      lastCut = [cx, cy];
    }
    // 火花：手臂工具發亮時從刀尖噴出
    if (spark.visible) {
      g.worldToLocal(spark.getWorldPosition(tip));
      for (let n = 0; n < 2; n++) {
        const i = spI = (spI + 1) % SPN;
        spPos[i * 3] = tip.x; spPos[i * 3 + 1] = tip.y; spPos[i * 3 + 2] = tip.z;
        spVel[i].set((Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3);
      }
    }
    for (let i = 0; i < SPN; i++) {
      spVel[i].y -= dt * 9;
      spPos[i * 3] += spVel[i].x * dt; spPos[i * 3 + 1] += spVel[i].y * dt; spPos[i * 3 + 2] += spVel[i].z * dt;
    }
    spGeo.attributes.position.needsUpdate = true;
  });
}

/* 創生市集：社區總體營造、創新產業、商業空間與設計經營 */
function buildMarket(r) {
  const ctx = regionCtx(r), { g, ly, col } = ctx;
  const wood = texMat('wood', '#9a6a40'), plank = texMat('wood', '#d6ad78'), plaster = mat('#f1e6d2'), bark = texMat('wood', '#7a5638'), red = mat('#b8392e');
  const AWN = ['#e5484d', '#f5c518', '#3a8ee6', '#46b35b', '#f28c28', '#8b5cd6'];
  // 中央廣場與大榕樹：社區聚會的地方
  mesh(new THREE.CylinderGeometry(7.5, 7.8, 0.3, 24), mat('#dccaa4'), 0, 0.05, 0, g);
  mesh(new THREE.CylinderGeometry(0.9, 1.5, 6, 8), bark, 0, 3, 0, g);
  for (const [x, z] of [[1.1, 0.3], [-1, 0.5], [0.2, -1.1]]) {
    const b = mesh(new THREE.CylinderGeometry(0.3, 0.5, 4, 6), bark, x, 5.5, z, g); b.rotation.set(z * 0.4, 0, -x * 0.4);
  }
  [[0, 8.2, 0, 4.2], [3, 7, 1, 2.8], [-3, 7.2, -0.8, 3], [1, 7.4, -3, 2.6], [-1.5, 7.6, 2.8, 2.5]].forEach(([x, y, z, sz], i) => {
    mesh(new THREE.IcosahedronGeometry(sz, 0), mat(i % 2 ? '#6aa84f' : '#4f8f45'), x, y, z, g);
  });
  for (let k = 0; k < 9; k++) { // 氣根
    const a = k / 9 * Math.PI * 2 + 0.3, d = 2.6 + hash2(k, 3) * 1.2, h = 3 + hash2(k, 4) * 1.5;
    mesh(new THREE.CylinderGeometry(0.06, 0.08, h, 4), bark, Math.cos(a) * d, 6 - h / 2, Math.sin(a) * d, g).castShadow = false;
  }
  const seat = mesh(new THREE.TorusGeometry(2.4, 0.32, 6, 24), plank, 0, 0.75, 0, g); seat.rotation.x = Math.PI / 2;
  col(0, 0, 2.9);
  // 攤棚：環繞廣場，正面（訪客方向）留給導師與入口
  const facing = (u, v) => Math.atan2(-u, -v);
  // 台灣花布：紅底牡丹與綠葉
  const flowerTex = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#c8243a'; c.fillRect(0, 0, w, h);
    for (let k = 0; k < 7; k++) {
      const x = (k * 53) % w, y = (k * 37 + 20) % h, rr = 10 + (k % 3) * 3;
      c.fillStyle = '#2f8a4a'; c.beginPath(); c.ellipse(x + rr, y + rr * 0.6, rr * 0.9, rr * 0.4, 0.6, 0, Math.PI * 2); c.fill();
      for (let q = 0; q < 6; q++) { const a = q / 6 * Math.PI * 2; c.fillStyle = k % 2 ? '#ff8fb1' : '#ffffff'; c.beginPath(); c.arc(x + Math.cos(a) * rr * 0.6, y + Math.sin(a) * rr * 0.6, rr * 0.55, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#f5c518'; c.beginPath(); c.arc(x, y, rr * 0.35, 0, Math.PI * 2); c.fill();
    }
  });
  const flowerMat = new THREE.MeshStandardMaterial({ map: flowerTex, roughness: 0.85 });
  const stalls = [];
  [0.95, 1.18, 1.42, 1.6, 1.84, 0.06].forEach((k, i) => {
    const a = k * Math.PI, u = Math.cos(a) * 11, v = Math.sin(a) * 11;
    const st = new THREE.Group(); st.position.set(u, ly(u, v), v); st.rotation.y = facing(u, v); g.add(st);
    mesh(new THREE.BoxGeometry(3, 1, 1.2), plank, 0, 0.5, 0.3, st);
    for (const [x, z] of [[-1.45, -0.55], [1.45, -0.55], [-1.45, 0.85], [1.45, 0.85]]) mesh(new THREE.BoxGeometry(0.12, 2.7, 0.12), wood, x, 1.35, z, st);
    if (i % 2 === 0) { // 花布遮陽棚
      const aw = mesh(new THREE.BoxGeometry(3.4, 0.1, 2), flowerMat, 0, 2.75, 0.2, st); aw.rotation.x = 0.22;
    } else for (let k2 = 0; k2 < 4; k2++) { // 條紋遮陽棚
      const aw = mesh(new THREE.BoxGeometry(0.85, 0.1, 2), mat(k2 % 2 ? '#f6efe2' : AWN[i]), -1.275 + k2 * 0.85, 2.75, 0.2, st);
      aw.rotation.x = 0.22;
    }
    stalls.push(new THREE.Vector3(u, ly(u, v), v));
    for (let k2 = 0; k2 < 3; k2++) {
      const c = AWN[(i + k2 + 2) % 6];
      mesh(k2 === 1 ? new THREE.SphereGeometry(0.28, 8, 6) : new THREE.BoxGeometry(0.5, 0.4, 0.4), mat(c), -0.9 + k2 * 0.9, 1.22, 0.4, st);
    }
    col(u, v, 1.9);
  });
  // 老街街屋：紅磚、騎樓、木窗花與招牌（商業空間）
  const signMat = mat(r.color, { emissive: r.color, emissiveIntensity: 0.6 });
  const glass = mat('#ffe2a8', { emissive: '#ffb347', emissiveIntensity: 0.8 });
  const brickTex = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#e4d3bb'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = -32; x < w; x += 32) {
      const ox = (y / 16) % 2 ? 16 : 0;
      c.fillStyle = ['#b5523b', '#a84a35', '#bf5c43'][(x + y) / 16 % 3 | 0]; c.fillRect(x + ox + 1.5, y + 1.5, 29, 13);
    }
  });
  brickTex.wrapS = brickTex.wrapT = THREE.RepeatWrapping; brickTex.repeat.set(3, 1.5);
  const brick = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.9 });
  const latticeTex = canvasTex(96, 96, (c, w, h) => {
    c.fillStyle = '#ffd98a'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#5a3a22'; c.lineWidth = 5; c.strokeRect(2, 2, w - 4, h - 4);
    c.lineWidth = 3;
    for (let k = 16; k < w; k += 16) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k, h); c.moveTo(0, k); c.lineTo(w, k); c.stroke(); }
    c.beginPath(); c.moveTo(w / 2, 10); c.lineTo(w - 10, h / 2); c.lineTo(w / 2, h - 10); c.lineTo(10, h / 2); c.closePath(); c.stroke();
  });
  const lattice = new THREE.MeshBasicMaterial({ map: latticeTex });
  for (const [u, v] of [[-8, -17], [8, -17], [0, -20]]) {
    const sh = new THREE.Group(); sh.position.set(u, ly(u, v), v); sh.rotation.y = facing(u, v); g.add(sh);
    const W = 6.4, D = 4.6;
    mesh(new THREE.BoxGeometry(W, 3, D - 1.6), plaster, 0, 1.5, -0.8, sh);
    mesh(new THREE.BoxGeometry(4.2, 2.1, 0.1), glass, -0.7, 1.25, D / 2 - 1.55, sh).castShadow = false;
    mesh(new THREE.BoxGeometry(1, 2.3, 0.1), mat('#3a2a1e'), 2.3, 1.15, D / 2 - 1.55, sh);
    for (const x of [-W / 2 + 0.35, 0, W / 2 - 0.35]) mesh(new THREE.BoxGeometry(0.55, 3, 0.55), brick, x, 1.5, D / 2 - 0.3, sh);
    mesh(new THREE.BoxGeometry(W, 3.2, D), brick, 0, 4.6, 0, sh);
    for (const x of [-1.5, 1.5]) mesh(new THREE.PlaneGeometry(1.5, 1.6), lattice, x, 4.7, D / 2 + 0.01, sh).castShadow = false;
    mesh(new THREE.BoxGeometry(W + 0.2, 0.9, 0.3), brick, 0, 6.55, D / 2 - 0.1, sh);
    mesh(new THREE.BoxGeometry(1.6, 0.5, 0.3), brick, 0, 7.2, D / 2 - 0.1, sh);
    mesh(new THREE.BoxGeometry(4, 0.7, 0.16), signMat, 0, 3.35, D / 2 + 0.05, sh);
    col(u, v, 3.6);
  }
  // 燈串：從榕樹拉向廣場周邊的燈柱
  const bulbA = mat('#fff1c4', { emissive: '#ffcf6b', emissiveIntensity: 1.2 });
  const bulbB = mat('#ffd6e0', { emissive: '#ff8fa8', emissiveIntensity: 1.2 });
  [1.07, 1.3, 1.72, 1.95, 0.0].forEach((k, i) => {
    const a = k * Math.PI, u = Math.cos(a) * 8, v = Math.sin(a) * 8, y0 = ly(u, v);
    mesh(new THREE.CylinderGeometry(0.1, 0.12, 5, 6), wood, u, y0 + 2.5, v, g);
    col(u, v, 0.3);
    for (let b = 1; b < 8; b++) {
      const t = b / 8, x = u * t, z = v * t, y = 6.2 + (y0 + 5 - 6.2) * t - Math.sin(Math.PI * t) * 0.9;
      mesh(new THREE.SphereGeometry(0.13, 6, 5), (b + i) % 2 ? bulbA : bulbB, x, y, z, g).castShadow = false;
    }
  });
  // 牌樓入口（路徑穿過）
  const GV = 26; // 放在導師鏡頭位置之外，避免擋住視線
  for (const sgn of [-1, 1]) {
    mesh(new THREE.BoxGeometry(0.8, 6.5, 0.8), red, sgn * 3.4, ly(sgn * 3.4, GV) + 3.25, GV, g);
    col(sgn * 3.4, GV, 0.7);
  }
  const gy = Math.max(ly(-3.4, GV), ly(3.4, GV)) + 6.5;
  mesh(new THREE.BoxGeometry(8.6, 0.6, 1), red, 0, gy - 0.6, GV, g);
  mesh(new THREE.BoxGeometry(9.6, 0.5, 1.8), mat('#3d5a8a'), 0, gy + 0.1, GV, g);
  mesh(new THREE.BoxGeometry(3.2, 1, 0.2), signMat, 0, gy - 1.5, GV + 0.55, g);
  sparkles(g, 70, '#ffd59a', 12, 0.5, 8, 0.5, 0.5);
  animators.push((t) => {
    bulbA.emissiveIntensity = 1 + Math.sin(t * 2.2) * 0.4;
    bulbB.emissiveIntensity = 1 + Math.sin(t * 2.2 + Math.PI) * 0.4;
  });
  // ── 第二階段：逛市集的居民與交易小圖示 ──
  const cloth = ['#e5484d', '#3a8ee6', '#46b35b', '#f5c518', '#8b5cd6', '#f28c28'];
  const walkers = Array.from({ length: isTouch ? 3 : 5 }, (_, i) => {
    const w = new THREE.Group(); g.add(w);
    const legs = [-1, 1].map((sx) => mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.55, 6), mat('#2b2d33'), sx * 0.13, 0.3, 0, w));
    mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.75, 8), mat(cloth[i % 6]), 0, 0.92, 0, w);
    mesh(new THREE.SphereGeometry(0.3, 10, 8), mat('#f0c8a0'), 0, 1.55, 0, w);
    const hc = mesh(new THREE.SphereGeometry(0.32, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(['#1f1b19', '#5a3a26', '#9a9a96'][i % 3]), 0, 1.58, -0.02, w); hc.rotation.x = -0.35;
    if (i % 2) mesh(new THREE.BoxGeometry(0.3, 0.32, 0.18), mat('#c9a06a'), 0.36, 0.85, 0.05, w);
    return { w, legs, rad: 5.2 + (i % 3) * 0.7, sp: (0.18 + hash2(i, 3) * 0.12) * (i % 2 ? 1 : -1), ph: i * 1.3 };
  });
  const iconTex = (draw) => canvasTex(64, 64, draw);
  const heart = iconTex((c) => { c.fillStyle = '#ff5c7a'; c.beginPath(); c.moveTo(32, 54); c.bezierCurveTo(4, 34, 10, 8, 32, 22); c.bezierCurveTo(54, 8, 60, 34, 32, 54); c.fill(); });
  const coin = iconTex((c) => { c.fillStyle = '#f5c518'; c.beginPath(); c.arc(32, 32, 26, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#b8860b'; c.lineWidth = 4; c.stroke(); c.fillStyle = '#8a5a00'; c.font = 'bold 32px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', 32, 34); });
  const pops = Array.from({ length: 6 }, (_, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: i % 2 ? coin : heart, transparent: true, depthWrite: false })); s.scale.setScalar(0.9); s.visible = false; g.add(s); return { s, t0: -9, at: null }; });
  let nextPop = 0;
  animators.push((t, dt) => {
    if (!camNear(r)) return;
    walkers.forEach((wk) => {
      const a = wk.ph + t * wk.sp, x = Math.cos(a) * wk.rad, z = Math.sin(a) * wk.rad;
      wk.w.position.set(x, ly(x, z) + Math.abs(Math.sin(t * 7 + wk.ph)) * 0.08, z);
      wk.w.rotation.y = Math.atan2(-Math.sin(a) * Math.sign(wk.sp), Math.cos(a) * Math.sign(wk.sp));
      wk.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 7 + wk.ph) * 0.5 * (i ? 1 : -1); });
    });
    if (t > nextPop || nextPop - t > 5) {
      nextPop = t + 0.9 + Math.random() * 0.8;
      const p = pops.find((q) => t - q.t0 > 1.6), st = stalls[Math.floor(Math.random() * stalls.length)];
      if (p) { p.t0 = t; p.at = st; }
    }
    pops.forEach((p) => {
      const k = (t - p.t0) / 1.6;
      p.s.visible = k < 1 && !!p.at;
      if (p.s.visible) { p.s.position.set(p.at.x, p.at.y + 3.3 + k * 1.6, p.at.z); p.s.material.opacity = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8; }
    });
  });
}

function buildPlateau(r) {
  const ctx = regionCtx(r), { g, ly, col } = ctx;
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
  const easelTex = new THREE.CanvasTexture(cv); easelTex.colorSpace = THREE.SRGBColorSpace;
  const art = mesh(new THREE.BoxGeometry(5, 6.2, 0.15), [mat('#f3e6cc'), mat('#f3e6cc'), mat('#f3e6cc'), mat('#f3e6cc'), new THREE.MeshStandardMaterial({ map: easelTex, roughness: 0.9 }), mat('#d9c39a')], 0, 6, 0.35, easel);
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
  // ── 第二階段：品牌牆、懸浮色票與風格展示亭 ──
  const archMats = rainbow.map((c) => mat(c, { emissive: c, emissiveIntensity: 0.18 }));
  const wall = new THREE.Group(); wall.position.set(0, ly(0, -13), -13); g.add(wall);
  mesh(new THREE.BoxGeometry(9.4, 5.6, 0.6), mat('#faf6ee'), 0, 2.8, 0, wall);
  mesh(new THREE.BoxGeometry(9.8, 0.4, 0.9), mat('#2c2622'), 0, 5.7, 0, wall);
  col(-3.5, -13, 1.4); col(0, -13, 1.4); col(3.5, -13, 1.4);
  const logo = (bg, fg, leaf) => canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.fillStyle = fg; c.strokeStyle = fg; c.lineWidth = 16;
    c.beginPath(); c.arc(128, 112, 70, 0, Math.PI * 2); c.stroke();
    if (leaf) { c.beginPath(); c.moveTo(128, 60); c.quadraticCurveTo(190, 112, 128, 164); c.quadraticCurveTo(66, 112, 128, 60); c.fill(); }
    else { c.fillRect(92, 76, 30, 72); c.fillRect(134, 76, 30, 72); }
    c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.fillText('TUT · ID', 128, 228);
  });
  const variants = [logo('#ffffff', r.color, false), logo('#1d1d22', '#ffffff', false), logo('#eef6ea', '#3f9b4f', true)];
  const tiles = [-3, 0, 3].map((x, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), new THREE.MeshStandardMaterial({ map: variants[i], roughness: 0.6, side: THREE.DoubleSide })); m.position.set(x, 3, 0.32); wall.add(dyn(m)); return m; });
  const swatch = (hex) => canvasTex(96, 140, (c, w, h) => {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = hex; c.fillRect(0, 0, w, 100);
    c.fillStyle = '#333'; c.font = 'bold 15px sans-serif'; c.fillText(hex.toUpperCase(), 8, 124);
  });
  const SW = ['#e05d8c', '#f28c28', '#f5c518', '#46b35b', '#3a8ee6', '#8b5cd6', '#2c2622'];
  const cards = SW.map((hex, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.3), new THREE.MeshStandardMaterial({ map: swatch(hex), side: THREE.DoubleSide, roughness: 0.5 })); g.add(m); return m; });
  const wy = ly(0, -13);
  // 風格展示亭（室內美學與風格）：沙發、茶几、落地燈、植栽與地毯
  const pav = new THREE.Group(); pav.position.set(-12, ly(-12, -8), -8); pav.rotation.y = Math.atan2(12, 8); g.add(pav);
  mesh(new THREE.BoxGeometry(5.6, 0.3, 4.4), mat('#efe6d8'), 0, 0.15, 0, pav);
  for (const [x, z] of [[-2.6, -2], [2.6, -2], [-2.6, 2], [2.6, 2]]) mesh(new THREE.BoxGeometry(0.16, 3.4, 0.16), mat('#2c2622'), x, 1.9, z, pav);
  mesh(new THREE.BoxGeometry(5.8, 0.18, 4.6), mat('#2c2622'), 0, 3.65, 0, pav);
  const rugTex = canvasTex(128, 96, (c, w, h) => { c.fillStyle = '#d9b8b0'; c.fillRect(0, 0, w, h); c.strokeStyle = '#a5574a'; c.lineWidth = 4; c.strokeRect(8, 8, w - 16, h - 16); c.beginPath(); c.arc(w / 2, h / 2, 22, 0, Math.PI * 2); c.stroke(); });
  mesh(new THREE.BoxGeometry(3.4, 0.03, 2.4), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }), 0, 0.32, 0.2, pav);
  const sofa = mat('#7f8c6e');
  mesh(new THREE.BoxGeometry(2.6, 0.5, 0.9), sofa, 0, 0.6, -1.2, pav); mesh(new THREE.BoxGeometry(2.6, 0.8, 0.3), sofa, 0, 1.0, -1.55, pav);
  for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.3, 0.7, 0.9), sofa, sx * 1.3, 0.75, -1.2, pav);
  mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 16), mat('#c9a27a'), 0.2, 0.75, 0.4, pav); mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.45, 6), mat('#2c2622'), 0.2, 0.52, 0.4, pav);
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 2, 6), mat('#2c2622'), 1.9, 1.3, -1.4, pav);
  const shade = mesh(new THREE.ConeGeometry(0.38, 0.45, 12, 1, true), mat('#fff3d6', { emissive: '#ffd27a', emissiveIntensity: 0.8, side: THREE.DoubleSide }), 1.9, 2.3, -1.4, pav); shade.castShadow = false;
  mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 10), mat('#f3e6cc'), -1.9, 0.55, 1.2, pav);
  for (let k = 0; k < 3; k++) mesh(new THREE.ConeGeometry(0.35 - k * 0.08, 0.7, 7), mat('#4f8f45'), -1.9, 1.05 + k * 0.38, 1.2, pav);
  col(-12, -8, 3.2);
  // 地面色彩漣漪：走過的地方泛起彩虹色圈
  const rippleMat = groundFX({ time: { value: 0 }, pl: { value: new THREE.Vector2(999, 999) } },
    `uniform float time; uniform vec2 pl; varying vec2 vP;
    vec3 hue(float h){ return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
    void main(){
      float d = length(vP), dp = length(vP - pl);
      float ring = smoothstep(0.08, 0.0, abs(fract(d / 14.0 - time * 0.12) - 0.5)) * 0.35;
      float rip = smoothstep(7.0, 0.0, dp) * smoothstep(0.35, 0.0, abs(fract(dp * 0.35 - time * 0.9) - 0.5));
      float a = (ring + rip) * smoothstep(23.0, 17.0, d);
      gl_FragColor = vec4(hue(fract(d * 0.04 + dp * 0.05 - time * 0.1)) * a, a);
    }`);
  drapedPlane(ctx, 0, 0, 46, 46, isTouch ? 36 : 56, rippleMat);
  const plV = new THREE.Vector2();
  let flipAt = 0, vi = 0;
  animators.push((t, dt) => {
    if (!camNear(r)) return;
    archMats.forEach((m, i) => { m.emissiveIntensity = 0.18 + Math.max(0, Math.sin(t * 2.4 - i * 0.7)) * 0.55; });
    rippleMat.uniforms.time.value = t;
    if (playerLocal(g, plV)) rippleMat.uniforms.pl.value.copy(plV); else rippleMat.uniforms.pl.value.set(999, 999);
    // 品牌牆：每 3 秒翻轉一次，換成另一個版本的標誌
    if (t > flipAt || flipAt - t > 3) { flipAt = t + 3; vi++; }
    const fk = Math.min(1, (t - (flipAt - 3)) / 0.6);
    tiles.forEach((m, i) => {
      m.rotation.y = fk < 1 ? Math.sin(fk * Math.PI) * Math.PI * 0.5 : 0;
      if (fk > 0.5) m.material.map = variants[(i + vi) % 3];
    });
    cards.forEach((m, i) => {
      const a = (i / SW.length - 0.5) * 2.2 + Math.sin(t * 0.4) * 0.15;
      m.position.set(Math.sin(a) * 6.5, wy + 7.6 + Math.cos(a) * 1.2 + Math.sin(t * 1.3 + i) * 0.15, -13 + 1.5 + Math.cos(a) * 0.5);
      m.rotation.set(0, -a * 0.6 + Math.sin(t * 0.8 + i) * 0.2, -a * 0.25);
    });
  });
}

const BUILDERS = { capital: buildCapital, forest: buildForest, valley: buildValley, workshop: buildWorkshop, market: buildMarket, plateau: buildPlateau };
/* 給 js/world-*.js 用的工具箱：地標、植被與裝飾都用同一套工具建構 */
const K = {
  THREE, scene, regions, RG, fields, FIELD_R, isTouch, animators, colliders,
  regionCtx, mesh, mat, texMat, canvasTex, drapedPlane, groundFX, sparkles, camNear, dyn, hash2, sstep,
  heightAt, terrainInfo, isClear, addLight, playerLocal: (g, out) => playerLocal(g, out)
};
const WORLD_BUILDERS = { modern: MODERN_BUILDERS, cyber: CYBER_BUILDERS }[WORLD_ID] || BUILDERS;
regions.forEach((r) => (WORLD_BUILDERS[r.id] ? WORLD_BUILDERS[r.id](r, K) : regionCtx(r)));

/* ---------- 任務採集場：燈柱圍成的圓、地面虛線邊界與名牌 ---------- */
const fieldSigns = [];
fields.forEach((f, fi) => {
  const g = new THREE.Group(); g.position.set(f.x, 0, f.z); scene.add(g);
  const ctx = { g, ly: (u, v) => heightAt(f.x + u, f.z + v) };
  const post = WORLD_ID === 'fantasy' ? texMat('wood', '#8a5a36') : mat(WORLD_ID === 'modern' ? '#a3a8b0' : '#23263a');
  const lamp = mat(f.r.color, { emissive: f.r.color, emissiveIntensity: WORLD_ID === 'cyber' ? 1.6 : 0.9 });
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2 + 0.2, u = Math.cos(a) * (FIELD_R + 0.6), v = Math.sin(a) * (FIELD_R + 0.6), y = ctx.ly(u, v);
    mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.2, 6), post, u, y + 1.1, v, g);
    mesh(new THREE.OctahedronGeometry(0.32), lamp, u, y + 2.5, v, g).castShadow = false;
    addLight(null, f.x + u, y + 2.5, f.z + v, f.r.color, { pool: 3 });
    colliders.push({ x: f.x + u, z: f.z + v, r: 0.3 });
  }
  const ringMat = groundFX({ time: { value: 0 }, col: { value: new THREE.Color(f.r.color) } },
    `uniform float time; uniform vec3 col; varying vec2 vP;
    void main(){
      float d = length(vP), a = atan(vP.y, vP.x);
      float ring = smoothstep(0.35, 0.0, abs(d - ${(FIELD_R - 0.8).toFixed(1)})) * step(0.5, fract(a * 6.0 + time * 0.25));
      float glow = smoothstep(${FIELD_R.toFixed(1)}, 0.0, d) * 0.08;
      float al = ring * 0.85 + glow;
      gl_FragColor = vec4(col * al, al);
    }`);
  drapedPlane(ctx, 0, 0, FIELD_R * 2 + 2, FIELD_R * 2 + 2, 28, ringMat);
  animators.push((t) => { ringMat.uniforms.time.value = t; });
  const el = document.createElement('div');
  el.className = 'field-sign'; el.style.setProperty('--region', f.r.color);
  el.innerHTML = `<i>採集場</i><b>${esc(f.name)}</b>`;
  const o = new CSS2DObject(el); o.position.set(0, ctx.ly(0, 0) + 5, 0); g.add(o);
  fieldSigns.push({ el, pos: new THREE.Vector3(f.x, ctx.ly(0, 0), f.z) });
});

/* ---------- 中古奇幻：沿路與區域入口的火把（夜裡點亮） ---------- */
if (WORLD_ID === 'fantasy') {
  const spots = [];
  regions.filter((r) => r.id !== 'capital').forEach((r) => {
    const len = Math.hypot(r.x, r.z), dx = r.x / len, dz = r.z / len;
    for (let d = len * 0.33, k = 0; d < len * 0.74; d += 11, k++) {
      const side = k % 2 ? 1 : -1, x = dx * d + dz * 3.4 * side, z = dz * d - dx * 3.4 * side;
      if (isClear(x, z, 0.4)) spots.push([x, z]);
    }
  });
  regions.forEach((r) => {
    const px = -r.toward.y, pz = r.toward.x; // 入口兩側
    for (const side of [-1, 1]) { const x = r.approach.x + px * 4.5 * side, z = r.approach.z + pz * 4.5 * side; if (isClear(x, z, 0.4)) spots.push([x, z]); }
    // 導師兩側與地標前方（區域座標 u 橫向、v 指向王都）
    const near = r.id === 'capital' ? [[-8, 21], [8, 21], [-17, 11], [17, 11]] : [[-7, 13], [7, 13], [-11, 5], [11, 5]];
    for (const [u, v] of near) { const x = r.x + u * r.toward.y + v * r.toward.x, z = r.z - u * r.toward.x + v * r.toward.y; if (isClear(x, z, 0.8)) spots.push([x, z]); }
  });
  const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.12, 2.6, 6), texMat('wood', '#6b4a2f'), spots.length);
  const bowl = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.14, 0.3, 8), mat('#3a332c'), spots.length);
  const fire = new THREE.InstancedMesh(new THREE.ConeGeometry(0.2, 0.55, 7), mat('#ffb347', { emissive: '#ff7a1a', emissiveIntensity: 1.4 }), spots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  spots.forEach(([x, z], i) => {
    const y = heightAt(x, z);
    m4.compose(p.set(x, y + 1.3, z), q, sc); pole.setMatrixAt(i, m4);
    m4.compose(p.set(x, y + 2.7, z), q, sc); bowl.setMatrixAt(i, m4);
    m4.compose(p.set(x, y + 3.05, z), q, sc); fire.setMatrixAt(i, m4);
    colliders.push({ x, z, r: 0.3 });
    addLight(null, x, y + 3.1, z, '#ffa040', { flame: true, pool: 6 });
  });
  pole.castShadow = true; fire.castShadow = false;
  scene.add(pole, bowl, fire);
}

/* ---------- 植被與岩石 ---------- */
{
  const count = isTouch ? 520 : 780;
  const pts = [];
  let tries = 0;
  while (pts.length < count && tries < count * 25) {
    tries++;
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 145;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const inf = terrainInfo(x, z);
    if (inf.h < 1.5 || inf.pathW > 0.02 || fields.some((f) => Math.hypot(x - f.x, z - f.z) < FIELD_R + 2.5)) continue; // 採集場留出空地（含樹冠）
    if (inf.nearD < inf.near.style.clear) continue;
    let bad = false;
    for (const r of regions) if (Math.hypot(x - r.approach.x, z - r.approach.z) < 7) { bad = true; break; }
    if (bad || !isClear(x, z, 1.2)) continue;
    pts.push({ x, z, h: inf.h, near: inf.near, nearD: inf.nearD });
  }
  const scenery = { modern: MODERN_BUILDERS.scenery, cyber: CYBER_BUILDERS.scenery }[WORLD_ID] || fantasyScenery;
  scenery(pts, K);
}
/* 中古奇幻的植被：松樹、圓樹與岩石 */
function fantasyScenery(pts) {
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
    const regCol = new THREE.Color(pt.near.style.foliage);
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
  for (let k = 0; rocks.length < 140 && k < 4000; k++) {
    const a = Math.random() * Math.PI * 2, d = 45 + Math.random() * 100;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const inf = terrainInfo(x, z);
    if (inf.h < -0.5 || inf.h > 14 || inf.pathW > 0.02 || inf.fieldW > 0 || inf.nearD < 20 || !isClear(x, z, 1)) continue;
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

/* ---------- 雲（未來都市是低空的霓虹霧霾） ---------- */
{
  const cyberSky = WORLD_ID === 'cyber';
  const cloudMat = new THREE.MeshStandardMaterial(cyberSky
    ? { color: '#3a2a5e', flatShading: true, emissive: '#5a2a8a', emissiveIntensity: 0.35, roughness: 1, transparent: true, opacity: 0.7 }
    : { color: '#ffffff', flatShading: true, emissive: '#fff4e6', emissiveIntensity: 0.25, roughness: 1 });
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
    const a = (i / 13) * Math.PI * 2, d = 70 + Math.random() * 120;
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
const SKIN = '#f0c8a0';
const HEAD_Y = 2.72, HEAD_R = 0.62;

/* 髮型：頂部髮蓋＋依樣式加後髮、側髮、瀏海 */
function buildHair(lk, g) {
  const hm = mat(lk.hairColor || '#1f1b19', { side: THREE.DoubleSide });
  const cap = (tilt, len = 0.5) => {
    const c = mesh(new THREE.SphereGeometry(HEAD_R * 1.07, 16, 10, 0, Math.PI * 2, 0, Math.PI * len), hm, 0, HEAD_Y + 0.02, -0.02, g);
    c.rotation.x = -tilt; return c;
  };
  const back = (len, wide = 1) => {
    const b = mesh(new THREE.CylinderGeometry(HEAD_R * 1.03 * wide, HEAD_R * 1.12 * wide, len, 16, 1, true, Math.PI / 2, Math.PI), hm, 0, HEAD_Y + 0.1 - len / 2, -0.04, g);
    return b;
  };
  const style = lk.hair || 'short';
  if (style === 'short') cap(0.42);
  else if (style === 'swept') {
    cap(0.38);
    const tuft = mesh(new THREE.SphereGeometry(0.34, 10, 8), hm, 0.08, HEAD_Y + 0.6, 0.28, g); tuft.scale.set(1.5, 0.55, 1); tuft.rotation.x = -0.5;
  } else if (style === 'shoulder') {
    cap(0.3); back(1.05);
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.16, 0.85, 0.34), hm, sx * 0.6, HEAD_Y - 0.25, 0.12, g);
  } else if (style === 'bob') {
    cap(0.12, 0.52); back(0.7, 1.04);
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.18, 0.62, 0.42), hm, sx * 0.6, HEAD_Y - 0.16, 0.14, g);
  } else if (style === 'long' || style === 'wavy') {
    cap(0.25); back(1.7, 1.05);
    for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.18, 1.2, 0.4), hm, sx * 0.62, HEAD_Y - 0.45, 0.1, g);
    if (style === 'wavy') for (let k = 0; k < 5; k++) mesh(new THREE.SphereGeometry(0.24, 8, 6), hm, -0.5 + k * 0.25, HEAD_Y - 1.55 + (k % 2) * 0.12, -0.35, g);
  }
}

function buildHatLook(lk, g) {
  if (!lk.hat) return;
  const hm = mat(lk.hatColor || '#333333');
  if (lk.hat === 'beanie') {
    const b = mesh(new THREE.SphereGeometry(HEAD_R * 1.13, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hm, 0, HEAD_Y + 0.12, -0.02, g); b.rotation.x = -0.2;
    const fold = mesh(new THREE.TorusGeometry(HEAD_R * 1.1, 0.1, 6, 20), hm, 0, HEAD_Y + 0.14, 0.02, g); fold.rotation.x = Math.PI / 2 - 0.2;
  } else if (lk.hat === 'flatcap') {
    const c = mesh(new THREE.SphereGeometry(HEAD_R * 1.12, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hm, 0, HEAD_Y + 0.14, -0.04, g); c.scale.y = 0.6; c.rotation.x = 0.12;
    mesh(new THREE.BoxGeometry(0.8, 0.06, 0.38), hm, 0, HEAD_Y + 0.22, 0.6, g).rotation.x = 0.18;
  }
}

function buildGlasses(lk, g) {
  if (!lk.glasses) return;
  const frame = mat('#1b1b1f', { metalness: 0.3, roughness: 0.4 });
  const y = HEAD_Y + 0.04, z = 0.6;
  for (const sx of [-1, 1]) {
    if (lk.glasses === 'sun') {
      mesh(new THREE.CircleGeometry(0.15, 14), mat('#101014', { metalness: 0.6, roughness: 0.15, side: THREE.DoubleSide }), sx * 0.21, y, z + 0.01, g).castShadow = false;
    }
    const ring = mesh(new THREE.TorusGeometry(lk.glasses === 'square' ? 0.16 : 0.14, 0.025, 6, lk.glasses === 'square' ? 4 : 16), frame, sx * 0.21, y, z, g);
    if (lk.glasses === 'square') { ring.rotation.z = Math.PI / 4; ring.scale.set(1.15, 0.85, 1); }
    ring.castShadow = false;
    const arm = mesh(new THREE.BoxGeometry(0.03, 0.03, 0.5), frame, sx * 0.6, y, 0.33, g); arm.castShadow = false;
  }
  mesh(new THREE.BoxGeometry(0.14, 0.03, 0.03), frame, 0, y + 0.02, z, g).castShadow = false;
}

/* 上衣：身體＋依樣式加外套前襟、領子 */
function buildTop(lk, g, r) {
  const top = mat(lk.topColor || '#555555');
  const torso = mesh(new THREE.CylinderGeometry(0.5, 0.62, 1.25, 12), top, 0, 1.52, 0, g);
  if (lk.top === 'blazer') {
    mesh(new THREE.BoxGeometry(0.34, 1.0, 0.1), mat(lk.inner || '#dddddd'), 0, 1.62, 0.53, g);
    for (const sx of [-1, 1]) { const lp = mesh(new THREE.BoxGeometry(0.12, 0.55, 0.06), top, sx * 0.2, 1.92, 0.56, g); lp.rotation.z = sx * 0.35; }
  } else if (lk.top === 'polo' || lk.top === 'shirt') {
    for (const sx of [-1, 1]) { const c = mesh(new THREE.BoxGeometry(0.26, 0.08, 0.2), top, sx * 0.17, 2.14, 0.38, g); c.rotation.set(0.3, 0, sx * -0.4); }
    if (lk.top === 'shirt') for (let k = 0; k < 3; k++) mesh(new THREE.SphereGeometry(0.035, 6, 4), mat('#d8d4cc'), 0, 1.95 - k * 0.3, 0.56 + k * 0.012, g).castShadow = false;
  } else if (lk.top === 'mandarin') {
    mesh(new THREE.CylinderGeometry(0.27, 0.29, 0.14, 12, 1, true), top, 0, 2.18, 0, g);
  } else if (lk.top === 'sweater') {
    const c = mesh(new THREE.TorusGeometry(0.28, 0.08, 6, 14), top, 0, 2.16, 0, g); c.rotation.x = Math.PI / 2;
  }
  worldGear(g, r);
  return torso;
}

/* 區域識別：奇幻是胸前的區域色寶石，現代是掛繩識別證，未來是霓虹肩線、腰帶、耳機與全像徽章 */
function worldGear(g, r) {
  const flat = (m) => { m.castShadow = false; return m; };
  if (WORLD_ID === 'modern') {
    const strap = mat(r.color);
    for (const sx of [-1, 1]) { const st = flat(mesh(new THREE.BoxGeometry(0.05, 0.62, 0.03), strap, sx * 0.16, 1.92, 0.52, g)); st.rotation.set(-0.15, 0, sx * -0.3); }
    flat(mesh(new THREE.BoxGeometry(0.26, 0.34, 0.03), mat('#ffffff'), 0, 1.58, 0.6, g));
    flat(mesh(new THREE.BoxGeometry(0.22, 0.08, 0.01), mat(r.color), 0, 1.69, 0.62, g));
    flat(mesh(new THREE.BoxGeometry(0.1, 0.12, 0.01), mat('#c9ced6'), -0.05, 1.54, 0.62, g));
  } else if (WORLD_ID === 'cyber') {
    const neon = mat(r.color, { emissive: r.color, emissiveIntensity: 1.6 });
    for (const sx of [-1, 1]) flat(mesh(new THREE.BoxGeometry(0.07, 0.07, 0.95), neon, sx * 0.46, 2.1, 0, g));
    const belt = flat(mesh(new THREE.TorusGeometry(0.6, 0.04, 4, 24), neon, 0, 0.98, 0, g)); belt.rotation.x = Math.PI / 2;
    flat(mesh(new THREE.BoxGeometry(0.12, 0.26, 0.2), mat('#1b1e2c'), 0.64, HEAD_Y, 0, g));
    flat(mesh(new THREE.BoxGeometry(0.03, 0.03, 0.42), neon, 0.6, HEAD_Y - 0.1, 0.28, g));
    flat(mesh(new THREE.OctahedronGeometry(0.13), neon, -0.26, 1.86, 0.6, g));
  } else flat(mesh(new THREE.OctahedronGeometry(0.11), mat(r.color, { emissive: r.color, emissiveIntensity: 0.8 }), -0.26, 1.86, 0.55, g));
}

/* 手臂：以肩膀為軸，方便揮手與拿道具 */
function buildArm(lk, g, sx) {
  const piv = dyn(new THREE.Group()); piv.position.set(sx * 0.6, 2.0, 0); g.add(piv); // 揮手與拿道具，不能合併
  const sleeve = mat(lk.topColor || '#555555'), skin = mat(SKIN);
  if (lk.top === 'sleeveless') mesh(new THREE.CapsuleGeometry(0.13, 0.72, 4, 8), skin, 0, -0.45, 0, piv);
  else if (lk.sleeves === 'short') {
    mesh(new THREE.CapsuleGeometry(0.16, 0.28, 4, 8), sleeve, 0, -0.22, 0, piv);
    mesh(new THREE.CapsuleGeometry(0.13, 0.45, 4, 8), skin, 0, -0.6, 0, piv);
  } else mesh(new THREE.CapsuleGeometry(0.15, 0.72, 4, 8), sleeve, 0, -0.45, 0, piv);
  const hand = new THREE.Group(); hand.position.y = -0.92; piv.add(hand);
  mesh(new THREE.SphereGeometry(0.15, 8, 6), skin, 0, 0, 0, hand);
  piv.rotation.z = sx * 0.12;
  return { piv, hand, rest: new THREE.Euler(0, 0, sx * 0.12) };
}

/* ---------- 招牌道具：每位老師一個，對應研究專長 ---------- */
const glowMat = (c, k = 1) => mat(c, { emissive: c, emissiveIntensity: k });
function holdForward(arm, x = -1.0) { arm.rest.set(x, 0, 0.05); arm.piv.rotation.copy(arm.rest); }
const PROPS = {
  // 社會網路分析：手上漂浮的關係星圖
  netOrb(n, R) {
    holdForward(R, -1.25);
    const orb = new THREE.Group(); orb.position.set(0.62, 2.95, 0.95); n.group.add(orb);
    const pts = [[0, 0, 0], [0.42, 0.15, 0], [-0.3, 0.3, 0.2], [0.1, -0.35, 0.3], [-0.2, -0.15, -0.38], [0.3, 0.35, -0.3], [-0.42, 0.05, -0.05]];
    const nodes = pts.map((p, i) => { const m = mesh(new THREE.SphereGeometry(i ? 0.07 : 0.11, 8, 6), glowMat('#ffd36b', 0.9), ...p, orb); m.castShadow = false; return m; });
    const links = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 5], [2, 6], [3, 1], [4, 6], [5, 2]];
    const geo = new THREE.BufferGeometry().setFromPoints(links.flatMap(([a, b]) => [new THREE.Vector3(...pts[a]), new THREE.Vector3(...pts[b])]));
    orb.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#ffe8a8', transparent: true, opacity: 0.8 })));
    return (t, dt) => { orb.rotation.y += dt * 0.7; nodes.forEach((m, i) => m.scale.setScalar(1 + Math.max(0, Math.sin(t * 3 - i * 0.9)) * 0.7)); };
  },
  // 室內設計實務：拉捲尺丈量
  tape(n, R) {
    holdForward(R, -0.9);
    mesh(new THREE.BoxGeometry(0.3, 0.3, 0.14), mat('#f2c230'), 0, -0.05, 0.1, R.hand);
    const strip = mesh(new THREE.BoxGeometry(1, 0.04, 0.12), mat('#f7d84a', { metalness: 0.3 }), 0, 0, 0, n.group);
    strip.castShadow = false;
    return (t) => {
      const L = 0.4 + (Math.sin(t * 0.9) * 0.5 + 0.5) * 1.6;
      strip.scale.x = L; strip.position.set(0.75 - L / 2 - 0.1, 1.5, 0.95);
    };
  },
  // AI 應用研究、設計運算：全像螢幕輪播生成圖樣
  holo(n, R) {
    R.rest.set(-0.7, 0, 0.5); R.piv.rotation.copy(R.rest);
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 96;
    const cx = cv.getContext('2d'); const tex = new THREE.CanvasTexture(cv);
    const draw = (seed) => {
      cx.fillStyle = 'rgba(10,40,60,0.85)'; cx.fillRect(0, 0, 128, 96);
      for (let k = 0; k < 9; k++) {
        const h = hash2(seed, k), w = 10 + hash2(k, seed) * 40;
        cx.fillStyle = ['#3ee6ff', '#8ffcff', '#c3adff', '#ffffff'][k % 4]; cx.globalAlpha = 0.55 + h * 0.4;
        if (k % 2) cx.fillRect(h * 100, hash2(seed + 1, k) * 70, w, w * 0.6);
        else { cx.beginPath(); cx.arc(h * 128, hash2(seed + 2, k) * 96, w * 0.4, 0, Math.PI * 2); cx.fill(); }
      }
      cx.globalAlpha = 1; cx.strokeStyle = '#8ffcff'; cx.lineWidth = 3; cx.strokeRect(2, 2, 124, 92);
      tex.needsUpdate = true;
    };
    draw(1);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.86), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    scr.position.set(1.15, 2.55, 0.7); scr.rotation.y = -0.45; n.group.add(scr);
    let last = 0;
    return (t) => { scr.position.y = 2.55 + Math.sin(t * 1.5) * 0.06; if (t - last > 1.4) { last = t; draw(Math.floor(t)); } };
  },
  // 設計運算、AI 整合：Grasshopper 般的節點與連線
  nodes(n, R) {
    R.rest.set(-0.6, 0, 0.4); R.piv.rotation.copy(R.rest);
    const box = new THREE.Group(); box.position.set(0, 2.6, 0); n.group.add(box);
    const cols = ['#3ee6ff', '#ffd36b', '#9be37a', '#c3adff'];
    const nodes = cols.map((c, i) => { const m = mesh(new THREE.BoxGeometry(0.26, 0.18, 0.08), glowMat(c, 0.8), 0, 0, 0, box); m.castShadow = false; return m; });
    const N = 3 * 12, pos = new Float32Array(N * 3);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    box.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#d8fbff', transparent: true, opacity: 0.85 })));
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c1 = new THREE.Vector3(), c2 = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Vector3();
    const curve = new THREE.CubicBezierCurve3(a, c1, c2, b);
    return (t) => {
      nodes.forEach((m, i) => { const ang = t * 0.6 + i * Math.PI / 2; m.position.set(Math.cos(ang) * 1.15, Math.sin(t * 1.3 + i) * 0.35 + (i - 1.5) * 0.25, Math.sin(ang) * 0.9 + 0.3); m.rotation.set(0, -ang, 0); });
      for (let l = 0; l < 3; l++) {
        a.copy(nodes[l].position); b.copy(nodes[l + 1].position);
        c1.copy(a).add(p.set(0.5, 0, 0)); c2.copy(b).add(q.set(-0.5, 0, 0));
        for (let k = 0; k < 6; k++) {
          curve.getPoint(k / 6, p); curve.getPoint((k + 1) / 6, q);
          const o = (l * 12 + k * 2) * 3; pos[o] = p.x; pos[o + 1] = p.y; pos[o + 2] = p.z; pos[o + 3] = q.x; pos[o + 4] = q.y; pos[o + 5] = q.z;
        }
      }
      geo.attributes.position.needsUpdate = true;
    };
  },
  // 室內空氣品質：手持偵測器發出偵測波
  sensor(n, R) {
    holdForward(R, -1.1);
    mesh(new THREE.BoxGeometry(0.22, 0.38, 0.1), mat('#2b2f36'), 0, 0.05, 0.12, R.hand);
    mesh(new THREE.PlaneGeometry(0.16, 0.16), glowMat('#7dffb0', 1.2), 0, 0.1, 0.18, R.hand).castShadow = false;
    const waves = [0, 1, 2].map(() => {
      const w = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 6, 32), new THREE.MeshBasicMaterial({ color: '#9dffc4', transparent: true, depthWrite: false }));
      w.position.set(0.66, 1.75, 1.0); n.group.add(w); return w;
    });
    return (t) => waves.forEach((w, i) => { const k = (t * 0.5 + i / 3) % 1; w.scale.setScalar(0.3 + k * 2.4); w.material.opacity = 0.8 * (1 - k); });
  },
  // 循環設計、建材性能：環繞身邊的木、石、玻璃樣本，背著樣本箱
  samples(n) {
    mesh(new THREE.BoxGeometry(0.8, 0.9, 0.42), mat('#7a5a3a'), 0, 1.6, -0.62, n.group);
    const ring = new THREE.Group(); ring.position.y = 2.1; n.group.add(ring);
    const ms = [mat('#c08a52'), mat('#9b9a96'), mat('#bfe8ff', { transparent: true, opacity: 0.6, roughness: 0.1 })];
    const cubes = ms.map((m, i) => mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), m, Math.cos(i * 2.09) * 1.25, 0, Math.sin(i * 2.09) * 1.25, ring));
    return (t, dt) => { ring.rotation.y += dt * 0.9; cubes.forEach((c, i) => { c.rotation.x += dt; c.rotation.y += dt * 1.3; c.position.y = Math.sin(t * 2 + i * 2) * 0.18; }); };
  },
  // 數位製造：平板控制，上方 3D 列印逐層長出
  printer(n, R) {
    holdForward(R, -1.15);
    const tab = mesh(new THREE.BoxGeometry(0.62, 0.05, 0.44), mat('#2b2f36'), 0.05, 0.05, 0.22, R.hand);
    mesh(new THREE.PlaneGeometry(0.54, 0.36), glowMat('#6ad8ff', 0.9), 0, 0.03, 0, tab).rotation.x = -Math.PI / 2;
    const vase = mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.6, 10), glowMat('#f28c28', 0.35), 0.62, 1.95, 1.1, n.group);
    const noz = mesh(new THREE.ConeGeometry(0.06, 0.14, 6), glowMat('#fff3b0', 1.6), 0.62, 2.4, 1.1, n.group);
    noz.rotation.x = Math.PI; noz.castShadow = false;
    return (t) => {
      const k = (t * 0.35) % 1;
      vase.scale.y = Math.max(0.02, k); vase.position.y = 1.65 + 0.3 * k;
      noz.position.set(0.62 + Math.cos(t * 7) * 0.14, 1.72 + 0.6 * k, 1.1 + Math.sin(t * 7) * 0.14);
    };
  },
  // 實構築、木構造：肩扛木樑，另一手拿木槌
  beam(n, R) {
    R.rest.set(0, 0, 2.5); R.piv.rotation.copy(R.rest);
    const beam = mesh(new THREE.BoxGeometry(0.28, 0.28, 3.2), mat('#b07444'), 0.62, 2.45, 0.2, n.group);
    beam.rotation.y = 0.85;
    for (const z of [-1.3, 1.3]) mesh(new THREE.BoxGeometry(0.29, 0.29, 0.06), mat('#d9b380'), 0, 0, z, beam);
    return (t) => { beam.position.y = 2.45 + Math.sin(t * 1.8) * 0.04; beam.rotation.z = Math.sin(t * 0.9) * 0.05; };
  },
  // 社區總體營造：社區地圖板，便利貼一張張貼上去
  map(n, R) {
    holdForward(R, -1.0);
    const board = new THREE.Group(); board.position.set(0.55, 1.75, 0.95); board.rotation.y = -0.3; n.group.add(board);
    mesh(new THREE.BoxGeometry(1.0, 0.75, 0.05), mat('#efe3c4'), 0, 0, 0, board);
    for (const [x, y, w, h] of [[-0.2, 0.1, 0.4, 0.06], [0.15, -0.1, 0.06, 0.45], [0.1, 0.18, 0.5, 0.05]]) mesh(new THREE.BoxGeometry(w, h, 0.01), mat('#c9a06a'), x, y, 0.03, board);
    const notes = ['#f5c518', '#e5484d', '#46b35b', '#3a8ee6'].map((c, i) => { const m = mesh(new THREE.PlaneGeometry(0.16, 0.16), mat(c, { side: THREE.DoubleSide }), -0.32 + i * 0.22, (i % 2 ? -0.18 : 0.2), 0.035, board); m.castShadow = false; return m; });
    return (t) => { const k = (t * 0.5) % 1; notes.forEach((m, i) => { m.visible = k > i * 0.2; }); };
  },
  // 商業空間、經營管理：平板上的營收長條圖往上長
  chart(n, R) {
    holdForward(R, -1.15);
    mesh(new THREE.BoxGeometry(0.56, 0.05, 0.4), mat('#2b2f36'), 0.05, 0.05, 0.2, R.hand);
    const bars = [0, 1, 2].map((i) => { const b = mesh(new THREE.BoxGeometry(0.16, 1, 0.16), glowMat(['#5b8fd9', '#9be37a', '#ffd36b'][i], 0.7), 0.42 + i * 0.22, 1.8, 1.05, n.group); b.castShadow = false; return b; });
    return (t) => bars.forEach((b, i) => { const h = 0.15 + (Math.sin(t * 1.2 + i * 0.8) * 0.5 + 0.5) * (0.3 + i * 0.25); b.scale.y = h; b.position.y = 1.72 + h / 2; });
  },
  // 品牌形象與永續：手拿筆記本，旁邊漂浮會變換的品牌徽章
  emblem(n, R) {
    holdForward(R, -0.95);
    mesh(new THREE.BoxGeometry(0.4, 0.05, 0.3), mat('#f3e6cc'), 0, 0.03, 0.15, R.hand);
    const disk = new THREE.Group(); disk.position.set(0.95, 3.1, 0.6); n.group.add(disk);
    const plate = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.07, 24), mat('#f6efe2'), 0, 0, 0, disk); plate.rotation.x = Math.PI / 2;
    const col = n.r.color;
    const leaf = mesh(new THREE.SphereGeometry(0.24, 10, 8), glowMat('#46b35b', 0.5), 0, 0, 0.06, disk); leaf.scale.set(0.6, 1, 0.3); leaf.rotation.z = 0.6;
    const star = mesh(new THREE.OctahedronGeometry(0.24), glowMat(col, 0.5), 0, 0, 0.06, disk); star.scale.z = 0.3;
    const ring = mesh(new THREE.TorusGeometry(0.2, 0.06, 6, 20), glowMat('#3a8ee6', 0.5), 0, 0, 0.06, disk);
    const shapes = [leaf, star, ring];
    return (t) => { disk.rotation.y = Math.sin(t * 0.8) * 0.6; disk.position.y = 3.1 + Math.sin(t * 1.4) * 0.08; const k = Math.floor(t / 2.5) % 3; shapes.forEach((s, i) => { s.visible = i === k; }); };
  },
  // 室內美學與風格：情緒板與飄動的布料樣本
  moodboard(n, R) {
    holdForward(R, -1.0);
    const board = new THREE.Group(); board.position.set(0.6, 1.8, 0.95); board.rotation.y = -0.3; n.group.add(board);
    mesh(new THREE.BoxGeometry(0.9, 0.7, 0.05), mat('#faf6ee'), 0, 0, 0, board);
    ['#c9a27a', '#7f8c6e', '#d9b8b0', '#3d4a5c'].forEach((c, i) => mesh(new THREE.PlaneGeometry(0.32, 0.24), mat(c), -0.2 + (i % 2) * 0.4, 0.15 - Math.floor(i / 2) * 0.3, 0.03, board).castShadow = false);
    const cloths = ['#e8c4b8', '#b9c7a8', '#c7b3d9'].map((c, i) => { const m = mesh(new THREE.PlaneGeometry(0.34, 0.46), mat(c, { side: THREE.DoubleSide }), -0.9 + i * 0.35, 3.0, 0.5, n.group); m.castShadow = false; return m; });
    return (t) => cloths.forEach((m, i) => { m.rotation.set(Math.sin(t * 1.6 + i) * 0.3, Math.sin(t + i) * 0.5, Math.sin(t * 1.2 + i) * 0.2); m.position.y = 3.0 + Math.sin(t * 1.1 + i * 1.5) * 0.12; });
  }
};

function buildNPC(f) {
  const r = RG[f.region] || RG.capital, s = f.slot, lk = f.look || {};
  const g = new THREE.Group();
  g.position.set(s.x, heightAt(s.x, s.z), s.z);
  const baseYaw = Math.atan2(s.fx, s.fz);
  g.rotation.y = baseYaw;
  scene.add(g);
  const skin = mat(SKIN), dark = mat('#1d1a18');
  // 腳下的區域色光環
  const ringMat = new THREE.MeshBasicMaterial({ color: r.color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.05, 28), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
  // 腿與鞋
  for (const sx of [-1, 1]) {
    mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.9, 8), mat(lk.pants || '#2b2d33'), sx * 0.22, 0.5, 0, g);
    mesh(new THREE.BoxGeometry(0.28, 0.14, 0.44), dark, sx * 0.22, 0.07, 0.07, g);
  }
  const torso = buildTop(lk, g, r);
  mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.22, 8), skin, 0, 2.18, 0, g);
  mesh(new THREE.SphereGeometry(HEAD_R, 16, 14), skin, 0, HEAD_Y, 0, g);
  const eyes = [-0.2, 0.2].map((sx) => { const e = mesh(new THREE.SphereGeometry(0.075, 8, 6), dark, sx, HEAD_Y + 0.04, 0.57, g); e.castShadow = false; return e; });
  if (lk.glasses === 'sun') eyes.forEach((e) => { e.visible = false; });
  const mouth = mesh(new THREE.TorusGeometry(0.09, 0.022, 4, 10, Math.PI), mat('#a5574a'), 0, HEAD_Y - 0.2, 0.58, g);
  mouth.rotation.z = Math.PI; mouth.castShadow = false;
  if (lk.earrings) for (const sx of [-1, 1]) mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 4), mat('#d9d9d9', { metalness: 0.8, roughness: 0.2 }), sx * 0.6, HEAD_Y - 0.36, 0.05, g).castShadow = false;
  buildHair(lk, g);
  buildHatLook(lk, g);
  buildGlasses(lk, g);
  const L = buildArm(lk, g, -1), R = buildArm(lk, g, 1);

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

  // 拜訪完成的光環特效
  const burst = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 3.5, 24, 1, true), new THREE.MeshBasicMaterial({ color: r.color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  burst.position.y = 1.75; burst.visible = false; g.add(burst);

  colliders.push({ x: s.x, z: s.z, r: 1.1 });
  const npc = {
    f, r, group: g, marker, markerMat, label: el, torso, eyes, arms: { L, R }, ring, burst, baseYaw,
    pos: new THREE.Vector3(s.x, g.position.y, s.z), seed: hash2(f.index, 4.2) * 6,
    near: false, waveAt: -9, burstAt: -9, blinkAt: 2 + hash2(f.index, 1.7) * 3, lineAt: 0, line: 0, prop: null
  };
  f.npc = npc;
  npc.prop = PROPS[lk.prop] ? PROPS[lk.prop](npc, R) : null;
  npcs.push(npc);
}
faculty.forEach(buildNPC);

/* 待機動畫：呼吸、眨眼、道具 */
animators.push((t, dt) => {
  npcs.forEach((n) => {
    n.marker.rotation.y += dt * 1.6;
    n.marker.position.y = 4.9 + Math.sin(t * 2 + n.seed) * 0.18;
    n.torso.scale.set(1 + Math.sin(t * 1.8 + n.seed) * 0.012, 1 + Math.sin(t * 1.8 + n.seed) * 0.02, 1);
    if (t > n.blinkAt) { n.blinkAt = t + 2.5 + hash2(t, n.seed) * 3; n.blinkEnd = t + 0.12; }
    const shut = t < n.blinkEnd;
    n.eyes.forEach((e) => e.scale.set(1, shut ? 0.15 : 1, 1));
    if (n.prop) n.prop(t, dt);
  });
});

/* 互動：轉向訪客、揮手、對話框、拜訪特效（每幀由主迴圈呼叫） */
const NEAR_EXPLORE = 9, NEAR_TOUR = 24;
const dialog = $('#dialog'), fogTip = $('#tip');
function updateNPCs(t, dt) {
  const exploring = state.mode === 'explore';
  const viewer = exploring ? player.position : camera.position;
  const now = performance.now() / 1000;
  let talker = null, talkD = 1e9;
  for (const n of npcs) {
    const fogged = isFogged(n.r);
    const d = Math.hypot(viewer.x - n.pos.x, viewer.z - n.pos.z);
    const near = state.started && !fogged && d < (exploring ? NEAR_EXPLORE : NEAR_TOUR) && (exploring || camera.position.distanceTo(n.pos) < NEAR_TOUR);
    if (near && !n.near) { n.waveAt = now; n.lineAt = now; n.line = Math.floor(hash2(now, n.seed) * n.f.lines.length); }
    n.near = near;
    // 轉身面向訪客（最多轉 75 度，避免背對入口）
    let want = n.baseYaw;
    if (near) {
      const diff = Math.atan2(Math.sin(Math.atan2(viewer.x - n.pos.x, viewer.z - n.pos.z) - n.baseYaw), Math.cos(Math.atan2(viewer.x - n.pos.x, viewer.z - n.pos.z) - n.baseYaw));
      want = n.baseYaw + Math.max(-1.3, Math.min(1.3, diff));
    }
    let dy = want - n.group.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    n.group.rotation.y += dy * Math.min(1, dt * (reduceMotion ? 60 : 4));
    // 揮手（左手）
    const w = now - n.waveAt, L = n.arms.L.piv;
    if (w < 1.8 && !reduceMotion) { const k = Math.sin(Math.min(1, w / 0.25) * Math.PI / 2) * (w > 1.5 ? (1.8 - w) / 0.3 : 1); L.rotation.set(0, 0, -0.12 - k * (2.5 + Math.sin(w * 14) * 0.3)); }
    else L.rotation.copy(n.arms.L.rest);
    // 台詞輪播；最靠近的一位會顯示在對話框
    if (near && n.f.lines?.length) {
      if (now - n.lineAt > 4.5) { n.lineAt = now; n.line = (n.line + 1) % n.f.lines.length; }
      if (d < talkD) { talkD = d; talker = n; }
    }
    // 拜訪特效
    const b = now - n.burstAt;
    if (b < 1.4) { const k = b / 1.4; n.burst.visible = true; n.burst.scale.set(1 + k * 0.8, 0.4 + k * 1.2, 1 + k * 0.8); n.burst.position.y = 1.75 + k * 1.5; n.burst.material.opacity = 0.6 * (1 - k); }
    else if (n.burst.visible) n.burst.visible = false;
  }
  const show = talker && !state.card && !state.busy && !state.flying && fogTip.hidden;
  if (show) {
    const key = talker.f.id + ':' + talker.line;
    if (dialog.dataset.key !== key) {
      dialog.dataset.key = key;
      dialog.style.setProperty('--region', talker.r.color);
      dialog.innerHTML = `<b>${esc(talker.f.name)}</b><span>${esc(talker.f.lines[talker.line])}</span>`;
    }
  }
  dialog.hidden = !show;
}

/* 區域旗幟 */
const regionSigns = [];
regions.forEach((r) => {
  const el = document.createElement('button');
  el.type = 'button'; el.className = 'region-sign';
  el.style.setProperty('--region', r.color);
  el.innerHTML = `<i>${esc(r.style.rune)}</i><b>${esc(r.name)}</b><span class="fog-tag">迷霧籠罩 · 點擊驅散</span>`;
  el.setAttribute('aria-label', `前往${r.name}`);
  el.addEventListener('click', (e) => { e.stopPropagation(); goRegion(r); });
  const o = new CSS2DObject(el);
  const y = heightAt(r.x, r.z) + r.style.signY;
  o.position.set(r.x, y, r.z);
  scene.add(o);
  regionSigns.push({ r, el, pos: o.position });
});

/* =========================================================================
 * 白霧：未探索的區域被迷霧籠罩，抵達後散去（王都一開始就是已探索）
 * ========================================================================= */
const EXPLORE_KEY = 'tutIdQuest.explored.v1';
const explored = new Set(['capital']);
try { JSON.parse(localStorage.getItem(EXPLORE_KEY) || '[]').forEach((id) => explored.add(id)); } catch (e) { /* 無法讀取就從頭探索 */ }
const FOG_R = 28;
const FOG_OPACITY = 0.6;
const isFogged = (r) => !!r && !explored.has(r.id);

function buildFog(r) {
  const baseY = heightAt(r.x, r.z);
  const g = new THREE.Group(); g.position.set(r.x, baseY, r.z); scene.add(g);
  const m = new THREE.MeshStandardMaterial({
    // 不套用色調映射並提高自發光，背光面也維持接近純白
    color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.8, flatShading: true,
    roughness: 1, transparent: true, opacity: FOG_OPACITY, depthWrite: false, toneMapped: false
  });
  // 霧團用 InstancedMesh：整區只要一次 draw call
  const puffs = [];
  const N = isTouch ? 36 : 48;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 * 3.3 + hash2(i, r.angle) * 0.8;
    const k = Math.sqrt(hash2(i, 5.1 + r.angle));
    const x = Math.cos(a) * k * FOG_R, z = Math.sin(a) * k * FOG_R;
    const sz = 4 + hash2(i, 2.2) * 4.5 + (1 - k) * 2.5;
    const y = heightAt(r.x + x, r.z + z) - baseY + sz * 0.35 + hash2(i, 8.8) * 6 + (1 - k) * 7;
    puffs.push({ base: new THREE.Vector3(x, y, z), sz, ph: hash2(i, 3) * 6.28, rot: hash2(i, 6) * 6.28 });
  }
  const inst = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), m, N);
  inst.renderOrder = 2; inst.frustumCulled = false; g.add(inst);
  const motes = sparkles(g, 50, '#ffffff', FOG_R * 0.85, 1, 16, 0.6, 0.5);
  r.fog = { g, m, puffs, inst, motes, revealAt: null };
  placePuffs(r.fog, 0, 0);
}
const _fm = new THREE.Matrix4(), _fq = new THREE.Quaternion(), _fp = new THREE.Vector3(), _fs = new THREE.Vector3(), _fy = new THREE.Vector3(0, 1, 0);
/* t：時間（霧團上下飄動）；e：消散進度 0～1 */
function placePuffs(f, t, e) {
  f.puffs.forEach((p, i) => {
    const b = p.base;
    if (e > 0) _fp.set(b.x * (1 + e * 0.9), b.y + e * 12, b.z * (1 + e * 0.9));
    else _fp.set(b.x, b.y + Math.sin(t * 0.6 + p.ph) * 0.6, b.z);
    _fq.setFromAxisAngle(_fy, p.rot + t * 0.1);
    _fs.set(p.sz * (1 + e), p.sz * (1 + e) * 0.85, p.sz * (1 + e));
    f.inst.setMatrixAt(i, _fm.compose(_fp, _fq, _fs));
  });
  f.inst.instanceMatrix.needsUpdate = true;
}
/* 迷霧消散後移出場景並釋放 GPU 資源 */
function disposeFog(r) {
  const f = r.fog;
  if (!f) return;
  scene.remove(f.g);
  f.inst.geometry.dispose(); f.inst.dispose();
  f.m.dispose();
  f.motes.geometry.dispose(); f.motes.material.dispose();
  // 此時可能正在走訪 animators，等這一輪跑完再移除
  queueMicrotask(() => { const i = animators.indexOf(f.motes.userData.animate); if (i >= 0) animators.splice(i, 1); });
  r.fog = null;
}
regions.forEach((r) => { if (isFogged(r)) buildFog(r); });

animators.push((t, dt) => {
  for (const r of regions) {
    const f = r.fog;
    if (!f || !f.g.parent) continue;
    if (f.revealAt === null) {
      f.g.rotation.y += dt * 0.035;
      if (camNear(r, 220)) placePuffs(f, t, 0);
    } else {
      const k = Math.min(1, (performance.now() - f.revealAt) / 1900);
      const e = 1 - (1 - k) * (1 - k);
      f.m.opacity = FOG_OPACITY * (1 - e);
      f.motes.material.opacity = 1 - e;
      placePuffs(f, t, e);
      if (k >= 1) disposeFog(r);
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
  if (r.fog) { if (reduceMotion) disposeFog(r); else r.fog.revealAt = performance.now(); }
  sound.sfx('reveal');
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
  // 依世界換裝：奇幻是冒險者斗篷與圍巾；現代是帽 T 與耳機；未來是霓虹夾克與護目鏡
  const OUTFIT = {
    fantasy: { top: '#2f5fd0', legs: '#3a2d24', pack: '#8a5a34', neck: '#c8413a' },
    modern: { top: '#f0a33a', legs: '#33486e', pack: '#2c3e50', neck: '#f0a33a' },
    cyber: { top: '#1b1f33', legs: '#14172a', pack: '#262a40', neck: '#3ef0ff' }
  }[WORLD_ID];
  const tunic = mat(OUTFIT.top), skin = mat('#f0c8a0'), dark = mat('#1d1a18'), hair = mat('#4a2f1c'), pack = mat(OUTFIT.pack);
  const scarf = mat(OUTFIT.neck, WORLD_ID === 'cyber' ? { emissive: OUTFIT.neck, emissiveIntensity: 1.4 } : {});
  const body = new THREE.Group(); player.add(body); player.userData.body = body;
  for (const sx of [-0.26, 0.26]) { const leg = mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.8, 6), mat(OUTFIT.legs), sx, 0.4, 0, body); leg.userData.leg = sx; }
  mesh(new THREE.CylinderGeometry(0.45, 0.66, 1.3, 10), tunic, 0, 1.35, 0, body);
  mesh(new THREE.TorusGeometry(0.42, WORLD_ID === 'cyber' ? 0.06 : 0.13, 6, 14), scarf, 0, 1.98, 0, body).rotation.x = Math.PI / 2;
  mesh(new THREE.SphereGeometry(0.55, 14, 12), skin, 0, 2.5, 0, body);
  mesh(new THREE.SphereGeometry(0.58, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 2.58, -0.04, body);
  for (const sx of [-0.19, 0.19]) mesh(new THREE.SphereGeometry(0.075, 6, 5), dark, sx, 2.55, 0.5, body).castShadow = false;
  mesh(new THREE.BoxGeometry(0.85, 0.95, 0.42), pack, 0, 1.45, -0.58, body);
  if (WORLD_ID === 'fantasy') mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.9, 8), mat('#d8c39a'), 0, 2.02, -0.58, body).rotation.z = Math.PI / 2;
  else if (WORLD_ID === 'modern') { // 耳機
    const band = mesh(new THREE.TorusGeometry(0.6, 0.05, 6, 16, Math.PI), mat('#2b2f36'), 0, 2.55, 0, body); band.rotation.y = Math.PI / 2;
    for (const sx of [-0.6, 0.6]) mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 12), mat('#2b2f36'), sx, 2.5, 0, body).rotation.z = Math.PI / 2;
  } else { // 護目鏡與背包燈條
    mesh(new THREE.BoxGeometry(0.9, 0.16, 0.2), mat('#3ef0ff', { emissive: '#3ef0ff', emissiveIntensity: 1.5 }), 0, 2.56, 0.42, body).castShadow = false;
    mesh(new THREE.BoxGeometry(0.06, 0.8, 0.44), mat('#ff4fd8', { emissive: '#ff4fd8', emissiveIntensity: 1.5 }), 0, 1.45, -0.58, body).castShadow = false;
  }
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
controls.maxPolarAngle = 1.32; controls.minDistance = 12; controls.maxDistance = 360;
controls.target.set(0, 4, 0);
controls.autoRotate = !reduceMotion; controls.autoRotateSpeed = 0.35;
controls.update();

const state = {
  mode: 'tour', started: false, flying: null, currentRegion: null, nearNPC: null,
  card: null, cardTimer: null, filter: '', regionFilter: null, completeShown: false,
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
  clearTimeout(state.cardTimer);
  const fogged = isFogged(r);
  if (state.mode === 'explore') {
    const s = f.slot;
    if (fromCodex || fogged || player.position.distanceTo(n.pos) > 14) teleport(s.x + s.fx * 4.5, s.z + s.fz * 4.5, Math.atan2(s.fx, s.fz));
    if (!fogged) { openCard(f); return; }
    showToast(r, reveal(r));
    // 讓迷霧先散一半再開卡；這段時間若玩家已走開或切換模式就取消
    state.cardTimer = setTimeout(() => {
      if (state.mode === 'explore' && !state.card && player.position.distanceTo(n.pos) < 8) openCard(f);
    }, reduceMotion ? 0 : 900);
  } else {
    // 迷霧中的導師：出發時就驅散迷霧，鏡頭直接穿過消散中的霧飛到導師面前
    if (fogged) showToast(r, reveal(r));
    flyTo(viewForNPC(n), () => openCard(f), fogged ? 2 : 1.5);
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
  clearTimeout(state.cardTimer);
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
  let moving = len > 0.05 && !state.card && !state.busy;
  const p = player.position;
  if (state.moveHook) { // 採集戰：移動交給任務系統（限制在場內、速度較慢）
    const k = moving ? Math.min(1, len) / len : 0;
    moving = state.moveHook(mx * k, mz * k, dt);
    if (moving) state.walkT += dt * 7;
  } else if (moving) {
    const k = Math.min(1, len) / len;
    mx *= k; mz *= k;
    const speed = 12 * (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 1.7 : 1);
    let nx = p.x + mx * speed * dt, nz = p.z + mz * speed * dt;
    const ok = (x, z) => heightAt(x, z) > 0.7 && Math.hypot(x, z) < 158;
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
    syncInteract();
  }
}
/* 手機互動鈕：靠近導師是「對話」，靠近任務小怪是「挑戰」 */
function syncInteract() {
  const b = $('#btn-interact'), m = quests && quests.nearMonster;
  b.disabled = !state.nearNPC && !m;
  b.textContent = m && !state.nearNPC ? '挑戰' : '對話';
}
function interact() {
  if (state.mode !== 'explore' || state.card || state.busy) return;
  if (state.nearNPC) openCard(state.nearNPC.f);
  else quests.interact();
}

/* ---------- 輸入 ---------- */
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') { if (state.card) closeCard(); else if ($('#codex').classList.contains('open')) toggleCodex(false); return; }
  if (e.code === 'Tab' && state.card) { trapFocus(e, $('#card-sheet')); return; }
  if (state.busy) return; // 採集戰小視窗、試煉、重置視窗開著時，不處理移動與對話快捷鍵
  if (e.target.closest && e.target.closest('input, textarea')) return;
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
  if (state.busy || quests.pick(ray)) return; // 點到任務小怪就打開採集戰；採集戰中點畫面＝使用道具
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
  if (f.npc) f.npc.waveAt = performance.now() / 1000;
  if (visited.has(f.id)) return;
  if (f.npc) f.npc.burstAt = performance.now() / 1000;
  sound.sfx('visit');
  visited.add(f.id); saveVisited();
  if (refreshProgress() && !state.completeShown) state.pendingComplete = true;
}

const photoHTML = (f) => f.photo
  ? `<img src="${esc(f.photo)}" alt="${esc(f.name)}老師照片" loading="lazy" data-initial="${esc(f.name[0])}">`
  : `<span>${esc(f.name[0])}</span>`;
function fixBrokenPhotos(root) {
  root.querySelectorAll('img[data-initial]').forEach((img) => {
    const fail = () => { const s = document.createElement('span'); s.textContent = img.dataset.initial; img.replaceWith(s); };
    if (img.complete && img.naturalWidth === 0) fail(); else img.addEventListener('error', fail, { once: true });
  });
}

/* 讓 Tab／Shift+Tab 只在 root 內的可聚焦元素間循環 */
function trapFocus(e, root) {
  const items = [...root.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled && el.offsetParent);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (!root.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function openCard(f) {
  const r = RG[f.region] || RG.capital;
  // 記下開卡前的焦點，關卡時還回去（上一位／下一位切換時不覆蓋）
  if (!state.card) state.returnFocus = document.activeElement;
  state.card = f;
  markVisited(f);
  sound.sfx('card');
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
        ${f.lines?.length ? `<p class="quote">「${esc(f.lines[0])}」</p>` : ''}
        <p class="role">${f.adjunct ? '<span class="adj-tag">兼任</span>' : ''}<b>${esc(f.title)}</b>${f.edu ? `　${esc(f.edu)}` : ''}</p>
        <section class="sect"><h4>專長技能</h4><div class="skills">${f.fields.map((x) => `<span class="skill">${esc(x)}</span>`).join('')}</div></section>
        ${f.courses?.length ? `<section class="sect"><h4>傳授技能書</h4><ul class="tomes">${f.courses.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
        ${f.feats?.length ? `<section class="sect"><h4>冒險紀錄</h4><ul class="feats">${f.feats.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
        ${quests.cardHTML(f)}
        ${f.email || f.url ? `<div class="contact">
          ${f.email ? `<span class="mail">${esc(f.email)}</span><button class="copy" type="button">複製信箱</button>` : ''}
          ${f.url ? `<a class="site" href="${esc(f.url)}" target="_blank" rel="noopener">${f.adjunct ? '相關資料' : '個人網站'} ↗</a>` : ''}
        </div>` : ''}
      </div>
    </div>
    <nav class="card-nav">
      <button type="button" data-nav="-1">← 上一位導師</button>
      <span class="lore">${esc(r.motto)}</span>
      <button type="button" data-nav="1">下一位導師 →</button>
    </nav>`;
  fixBrokenPhotos(sheet);
  quests.bindCard(sheet, f);
  sheet.querySelector('.close').addEventListener('click', closeCard);
  sheet.querySelector('.copy')?.addEventListener('click', (e) => {
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
  const back = state.returnFocus; state.returnFocus = null;
  if (back && back !== document.body && back.isConnected && !back.closest('[inert]')) back.focus({ preventScroll: true });
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
  c.inert = !on; // 收起時抽屜內的按鈕不應被 Tab 選到
  if (on && !isTouch) setTimeout(() => $('#codex-search').focus({ preventScroll: true }), 300);
}
function closeCodexIfNarrow() { if (window.innerWidth < 900) toggleCodex(false); }
$('#btn-codex').addEventListener('click', () => toggleCodex());
$('#codex-close').addEventListener('click', () => toggleCodex(false));

// 圖鑑分頁：導師名冊／任務日誌
$('#codex-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]'); if (!b) return;
  $('#codex').dataset.tab = b.dataset.tab;
  $('#codex-tabs').querySelectorAll('button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
});
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
  人工智慧: ['ai', '生成式'], 運算: ['設計運算', '運算化'], 程式: ['設計運算', '運算化', 'rhino'],
  數位: ['數位', '設計運算', 'bim', 'rhino'], '3d': ['數位製造', 'bim', 'rhino'], 電腦: ['數位', '設計運算', 'bim'],
  木: ['木構造', '木工'], 構造: ['構造', '構築', '結構'], 結構: ['構造', '構築', '結構'], 材料: ['材料', '建材'],
  永續: ['永續', '循環', '建材環境'], 環境: ['環境', '空氣品質', '循環'], 健康: ['空氣品質', '環境'], 智慧: ['智慧生活', '互動'],
  社區: ['社區', '營造'], 產業: ['產業', '經營'], 商業: ['商業空間', '經營'], 經營: ['經營管理', '產業'],
  色: ['色彩', '美學'], 美學: ['美學', '風格'], 風格: ['美學', '風格'], 品牌: ['品牌', '識別'],
  兼任: ['兼任'], 研究: ['研究']
};
function matches(f) {
  if (state.regionFilter && f.region !== state.regionFilter) return false;
  if (!state.filter) return true;
  const r = RG[f.region] || {};
  const hay = [f.name, f.title, f.cls, f.edu, r.name, ...f.fields, ...(f.courses || []), ...(f.feats || [])].join(' ').toLowerCase();
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
        <span class="who"><b>${esc(f.name)}${f.adjunct ? '<span class="adj-tag">兼任</span>' : ''}</b><small>${esc(f.cls)}｜${esc(f.fields.slice(0, 3).join('、'))}</small></span>
        <span class="mark ${visited.has(f.id) ? 'ok' : ''}">${visited.has(f.id) ? '✓ 已拜訪' : '未拜訪'}</span>
      </button>`).join('')}
    </div>`;
  });
  list.innerHTML = html || `<p class="empty-note">找不到符合「${esc(state.filter)}」的導師。<br>試試「AI」「永續」「社區」等關鍵字。</p>`;
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
    h.innerHTML = isTouch ? '單指旋轉 · 雙指縮放 · 點旗幟驅散白霧' : '拖曳旋轉 · 滾輪縮放 · 右鍵平移 · 點擊旗幟驅散白霧、點名牌拜訪導師';
  } else {
    h.innerHTML = isTouch ? '左下搖桿移動 · 拖曳畫面轉視角' : '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移動 · <kbd>Shift</kbd> 奔跑 · 拖曳轉視角 · <kbd>E</kbd> 對話';
  }
}

/* 區域抵達提示 */
let toastTimer = null;
function showToast(r, revealed = false) {
  state.currentRegion = r;
  $('#toast-rune').textContent = r.style.rune;
  $('#toast-name').textContent = r.name;
  $('#toast-motto').textContent = revealed ? `迷霧散去 · ${r.motto}` : r.motto;
  const t = $('#toast'); t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* 小地圖 */
const mm = $('#minimap'), mctx = mm.getContext('2d');
const MM = 336, WORLD_HALF = 165;
const toMap = (x, z) => [(x + WORLD_HALF) / (WORLD_HALF * 2) * MM, (z + WORLD_HALF) / (WORLD_HALF * 2) * MM];
const mmBase = document.createElement('canvas'); mmBase.width = mmBase.height = MM;
{
  const b = mmBase.getContext('2d'), step = 3, c = new THREE.Color();
  const MMC = { // 小地圖配色跟著世界觀
    fantasy: ['#6f9f50', '#25607a', '#3d8aa6', '#e2cc92', '#e3cf98'],
    modern: ['#76b354', '#2a6f95', '#4596bd', '#d9cfb0', '#8a8f98'],
    cyber: ['#2a2f48', '#081428', '#10284a', '#2e3150', '#3ef0ff']
  }[WORLD_ID].map((h) => new THREE.Color(h));
  const [grass, sea, shallow, sand, path] = MMC;
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
  fields.forEach((f) => {
    const [x, y] = toMap(f.x, f.z);
    mctx.beginPath(); mctx.arc(x, y, FIELD_R / (WORLD_HALF * 2) * MM, 0, Math.PI * 2);
    mctx.setLineDash([4, 4]); mctx.lineWidth = 2.5; mctx.strokeStyle = f.r.color; mctx.stroke(); mctx.setLineDash([]);
  });
  regions.forEach((r) => {
    if (!isFogged(r)) return;
    const [x, y] = toMap(r.x, r.z), rad = (FOG_R * 1.15) / (WORLD_HALF * 2) * MM;
    const gr = mctx.createRadialGradient(x, y, rad * 0.35, x, y, rad);
    gr.addColorStop(0, 'rgba(255,255,255,0.88)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
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
function showFogTip() {
  const left = regions.filter(isFogged).length;
  if (!left) return;
  $('#tip-text').innerHTML = `還有 <b>${left}</b> 個區域被白霧遮蔽，霧中的導師要驅散迷霧後才會現身。<br>點區域旗幟、在探險模式走近，或把鏡頭拉近，就能驅散迷霧。`;
  const tip = $('#tip'); tip.hidden = false;
  clearTimeout(showFogTip.timer); showFogTip.timer = setTimeout(() => { tip.hidden = true; }, 12000);
}
$('#tip-close').addEventListener('click', () => { $('#tip').hidden = true; });
/* ---------- 開場：選擇世界。換世界會重新載入，背景直接換成那個世界的預覽 ---------- */
const WORLD_ART = {
  fantasy: '<svg viewBox="0 0 120 64"><rect width="120" height="64" fill="#7fb6e6"/><circle cx="96" cy="16" r="8" fill="#ffe7a8"/><path d="M0 52 Q40 36 80 48 T120 44 V64 H0Z" fill="#6fae4f"/><g fill="#efe3c8"><rect x="44" y="26" width="32" height="22"/><rect x="40" y="18" width="9" height="30"/><rect x="71" y="18" width="9" height="30"/><rect x="55" y="12" width="10" height="36"/></g><g fill="#c24a33"><path d="M39 18l5.5-8 5.5 8z"/><path d="M70 18l5.5-8 5.5 8z"/><path d="M54 12l6-9 6 9z"/></g><rect x="56" y="38" width="8" height="10" rx="4" fill="#5b4a3a"/></svg>',
  modern: '<svg viewBox="0 0 120 64"><rect width="120" height="64" fill="#8ec5f0"/><circle cx="20" cy="15" r="7" fill="#fff3c4"/><g fill="#dfe8f2"><rect x="10" y="30" width="16" height="26"/><rect x="88" y="26" width="18" height="30"/></g><rect x="46" y="10" width="22" height="46" fill="#a9cbe8"/><g fill="#eef3f7"><rect x="49" y="14" width="16" height="2"/><rect x="49" y="22" width="16" height="2"/><rect x="49" y="30" width="16" height="2"/><rect x="49" y="38" width="16" height="2"/></g><rect x="28" y="36" width="16" height="20" fill="#f4e3c8"/><path d="M27 37l9-8 9 8z" fill="#b0503a"/><rect x="70" y="40" width="16" height="16" fill="#f6dcd2"/><rect x="0" y="56" width="120" height="8" fill="#62666e"/><g fill="#fff"><rect x="8" y="59" width="10" height="2"/><rect x="40" y="59" width="10" height="2"/><rect x="72" y="59" width="10" height="2"/><rect x="104" y="59" width="10" height="2"/></g><circle cx="34" cy="50" r="5" fill="#4f9a45"/></svg>',
  cyber: '<svg viewBox="0 0 120 64"><defs><linearGradient id="cs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#090a26"/><stop offset="1" stop-color="#4a1b6e"/></linearGradient></defs><rect width="120" height="64" fill="url(#cs)"/><circle cx="60" cy="40" r="16" fill="#ff4fd8" opacity=".55"/><g fill="#141826"><rect x="6" y="20" width="14" height="44"/><rect x="24" y="30" width="12" height="34"/><rect x="50" y="8" width="18" height="56"/><rect x="74" y="24" width="12" height="40"/><rect x="92" y="14" width="16" height="50"/></g><g fill="#3ef0ff"><rect x="6" y="20" width="14" height="1.5"/><rect x="50" y="8" width="18" height="1.5"/><rect x="92" y="14" width="16" height="1.5"/><rect x="58" y="0" width="2" height="8" opacity=".7"/></g><g fill="#ff4fd8"><rect x="24" y="30" width="12" height="1.5"/><rect x="74" y="24" width="12" height="1.5"/></g><g fill="#ffe28a" opacity=".85"><rect x="10" y="28" width="2" height="2"/><rect x="54" y="18" width="2" height="2"/><rect x="62" y="30" width="2" height="2"/><rect x="96" y="24" width="2" height="2"/><rect x="100" y="40" width="2" height="2"/><rect x="28" y="40" width="2" height="2"/></g><rect x="0" y="60" width="120" height="1.5" fill="#3ef0ff"/></svg>'
};
{
  const pick = $('.world-pick');
  pick.innerHTML = Object.entries(WORLDS).map(([id, w]) => `
    <button type="button" class="world-card" role="radio" aria-checked="${id === WORLD_ID}" data-world="${id}">
      <span class="wc-art" aria-hidden="true">${WORLD_ART[id] || ''}</span>
      <span class="wc-text"><i>${esc(w.tag || '')}</i><b>${esc(w.label || id)}</b><small>${esc(w.desc || '')}</small></span>
    </button>`).join('');
  pick.addEventListener('click', (e) => {
    const b = e.target.closest('[data-world]');
    if (b && b.dataset.world !== WORLD_ID) switchWorld(b.dataset.world);
  });
  $('#intro-lore').innerHTML = WD.lore || ''; // 文字來自本站的 data/worlds.js
  $('#complete-title').textContent = `${WD.land || '大陸'}已走遍`;
}
function switchWorld(id) {
  try { localStorage.setItem(WORLD_KEY, id); } catch (e) { /* 存不了就只換這一次 */ }
  const u = new URL(location.href); u.searchParams.set('world', id); u.hash = '';
  document.body.classList.add('switching');
  location.href = u.href;
}
$('#btn-world').addEventListener('click', () => { const u = new URL(location.href); u.hash = ''; location.href = u.href; });
$('#btn-start').addEventListener('click', () => {
  try { localStorage.setItem(WORLD_KEY, WORLD_ID); } catch (e) { /* 無法記住也沒關係 */ }
  $('#intro').hidden = true;
  state.started = true;
  sound.resumeIfWanted();
  setTimeout(showFogTip, reduceMotion ? 0 : 2600);
  const hashId = decodeURIComponent(location.hash.slice(1));
  const target = faculty.find((f) => f.id === hashId);
  if (target) selectTeacher(target);
  else flyTo(viewForRegion(RG.capital), () => showToast(RG.capital), 2.4);
});
/* 重置所有進度：圖鑑底部的連結與「任務與徽章」分頁的按鈕共用，先跳出確認視窗 */
const resetDlg = $('#reset-dlg');
let resetBack = null;
function openReset() {
  resetBack = document.activeElement;
  resetDlg.hidden = false; state.busy = true;
  resetDlg.querySelector('[data-reset="cancel"]').focus({ preventScroll: true });
}
function closeReset() {
  resetDlg.hidden = true; state.busy = false;
  if (resetBack && resetBack.isConnected) resetBack.focus({ preventScroll: true });
}
function resetAll() {
  // 音效開關是個人偏好，保留；其餘進度全部清除
  try { [STORE_KEY, EXPLORE_KEY, QUEST_KEY].forEach((k) => localStorage.removeItem(k)); } catch (e) { /* 忽略 */ }
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* 忽略 */ }
  location.reload();
}
$('#btn-reset').addEventListener('click', openReset);
resetDlg.addEventListener('click', (e) => {
  const b = e.target.closest('[data-reset]');
  if (b) (b.dataset.reset === 'confirm' ? resetAll : closeReset)();
  else if (e.target === resetDlg) closeReset();
});
resetDlg.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') { closeReset(); e.stopPropagation(); }
  else if (e.code === 'Tab') trapFocus(e, resetDlg.querySelector('.reset-box'));
});
$('#btn-mode').addEventListener('click', () => { if (!state.started) return; setMode(state.mode === 'tour' ? 'explore' : 'tour'); });

refreshProgress();
updateHint();

/* =========================================================================
 * 環境音效：Web Audio 即時合成，不需要音檔。預設關閉，訪客按小地圖上的喇叭鈕開啟。
 * 每區一條環境音軌（bed），依鏡頭所在區域淡入淡出；互動時另外播放短音效。
 * ========================================================================= */
const SOUND_KEY = 'tutIdQuest.sound.v1';
const sound = (() => {
  let ac = null, master = null, on = false;
  const beds = {}, nextAt = {};
  const LEVEL = { capital: 0.55, forest: 0.5, valley: 0.75, workshop: 0.9, market: 0.8, plateau: 0.9 };
  const PENTA = [523.3, 587.3, 659.3, 784, 880, 1046.5, 1174.7, 1318.5];
  let arp = 0;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function tone(freq, t0, dur, vol, type = 'sine', dest = master) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function burst(t0, dur, freq, vol, dest = master, sweepTo = null) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = beds.noise; f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(freq, t0);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + dur * 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(dest); s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
  }
  function init() {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
    const nb = beds.noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const loopNoise = () => { const s = ac.createBufferSource(); s.buffer = nb; s.loop = true; s.start(); return s; };
    const bed = (id) => { const g = ac.createGain(); g.gain.value = 0; g.connect(master); beds[id] = g; return g; };
    const filt = (type, freq, q = 1) => { const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; };
    const lfo = (freq, depth, target) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = freq; g.gain.value = depth; o.connect(g).connect(target); o.start(); };
    // 全島：微風
    const base = bed('base'); base.gain.value = 0.22; loopNoise().connect(filt('lowpass', 420)).connect(base);
    // 環控風谷：較強的風，音色隨氣流起伏
    const vf = filt('bandpass', 700, 0.8); lfo(0.11, 420, vf.frequency); loopNoise().connect(vf).connect(bed('valley'));
    // 運算之森：低音和聲墊
    const ff = filt('lowpass', 900); ff.connect(bed('forest'));
    [220, 329.6, 440.5].forEach((fr) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = fr; g.gain.value = 0.1; o.connect(g).connect(ff); o.start(); });
    // 設計王都：溫暖和弦
    const cb = bed('capital');
    [130.8, 196, 261.6].forEach((fr) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = fr; g.gain.value = 0.08; o.connect(g).connect(cb); o.start(); });
    // 創生市集：人聲般的低語
    const mg = ac.createGain(); mg.gain.value = 0.5; lfo(3.1, 0.25, mg.gain);
    loopNoise().connect(filt('bandpass', 460, 1.2)).connect(mg).connect(bed('market'));
    bed('workshop'); bed('plateau');
  }
  // 每幀呼叫：依所在區域調整音量，並排程該區的點綴音
  function update(id, w) {
    if (!on || !ac) return;
    const t = ac.currentTime;
    for (const r of Object.keys(LEVEL)) beds[r].gain.setTargetAtTime(r === id ? w * LEVEL[r] : 0, t, 0.6);
    if (!id || w < 0.1) return;
    if ((nextAt[id] || 0) > t + 10) nextAt[id] = t; // 剛開啟時重置
    if (t < (nextAt[id] || 0)) return;
    const b = beds[id];
    if (id === 'forest') { tone(pick(PENTA) * 2, t, 0.3, 0.06, 'sine', b); nextAt[id] = t + 0.35 + Math.random() * 0.9; }
    else if (id === 'workshop') { tone(85, t, 0.18, 0.5, 'sine', b); burst(t, 0.08, 2200, 0.35, b); nextAt[id] = t + (Math.random() < 0.3 ? 0.35 : 1.1); }
    else if (id === 'market') { if (Math.random() < 0.5) { tone(1046.5, t, 1.4, 0.08, 'sine', b); tone(1568, t + 0.02, 1.1, 0.04, 'sine', b); } nextAt[id] = t + 2.5 + Math.random() * 3; }
    else if (id === 'plateau') { const f = PENTA[[0, 2, 4, 5, 4, 2, 3, 1][arp++ % 8]]; tone(f, t, 1.0, 0.09, 'sine', b); tone(f * 2, t, 0.4, 0.025, 'sine', b); nextAt[id] = t + 0.32; }
    else if (id === 'capital') { tone(pick([523.3, 659.3, 784]), t, 2.4, 0.06, 'sine', b); nextAt[id] = t + 3.5 + Math.random() * 3; }
    else nextAt[id] = t + 1;
  }
  function sfx(name) {
    if (!on || !ac) return;
    const t = ac.currentTime;
    if (name === 'card') { tone(784, t, 0.5, 0.12); tone(1174.7, t + 0.08, 0.6, 0.1); }
    else if (name === 'reveal') burst(t, 1.3, 300, 0.5, master, 2600);
    else if (name === 'visit') [523.3, 659.3, 784, 1046.5].forEach((f, i) => tone(f, t + i * 0.07, 0.6, 0.1, 'triangle'));
    else if (name === 'miss') tone(196, t, 0.25, 0.12, 'square');
    // 採集戰
    else if (name === 'hit') { burst(t, 0.12, 900, 0.35); tone(140, t, 0.12, 0.2, 'triangle'); }
    else if (name === 'shoot') tone(1400, t, 0.09, 0.05, 'triangle');
    else if (name === 'pickup') { tone(1046.5, t, 0.18, 0.08); tone(1568, t + 0.06, 0.25, 0.07); }
    else if (name === 'hurt') { tone(260, t, 0.3, 0.14, 'square'); tone(170, t + 0.08, 0.35, 0.12, 'square'); }
    else if (name === 'beep') tone(1250, t, 0.06, 0.04);
    else if (name === 'fail') [392, 329.6, 261.6].forEach((f, i) => tone(f, t + i * 0.16, 0.5, 0.1, 'triangle'));
  }
  const btn = $('#btn-sound');
  function set(v) {
    on = v;
    try { localStorage.setItem(SOUND_KEY, v ? '1' : '0'); } catch (e) { /* 忽略 */ }
    btn.setAttribute('aria-pressed', String(v));
    btn.setAttribute('aria-label', v ? '關閉音效' : '開啟音效');
    btn.classList.toggle('on', v);
    if (v) {
      if (!ac) init();
      ac.resume(); master.gain.setTargetAtTime(0.5, ac.currentTime, 0.3);
    } else if (ac) master.gain.setTargetAtTime(0, ac.currentTime, 0.15);
  }
  btn.addEventListener('click', (e) => { e.stopPropagation(); set(!on); });
  document.addEventListener('visibilitychange', () => { if (ac && on) (document.hidden ? ac.suspend() : ac.resume()); });
  let pref = false;
  try { pref = localStorage.getItem(SOUND_KEY) === '1'; } catch (e) { /* 忽略 */ }
  btn.classList.toggle('on', pref);
  // 瀏覽器規定要有使用者操作才能發聲：記得上次開著的話，按「開始冒險」時再開啟
  return { update, sfx, set, resumeIfWanted: () => { if (pref) set(true); } };
})();

/* 陰影跟著鏡頭焦點走：拉近時範圍小、陰影清楚；拉遠時涵蓋整座島 */
scene.add(sunLight.target);
const SUN_OFF = new THREE.Vector3(-90, 130, 70);
function updateShadow() {
  const focus = state.mode === 'explore' ? player.position : controls.target;
  const sc = sunLight.shadow.camera;
  const span = THREE.MathUtils.clamp(Math.ceil(camera.position.distanceTo(focus) * 0.9 / 20) * 20, 60, 190);
  if (span !== sc.right) { sc.left = sc.bottom = -span; sc.right = sc.top = span; sc.updateProjectionMatrix(); }
  const texel = span * 2 / sunLight.shadow.mapSize.x; // 對齊陰影貼圖像素，移動時不閃爍
  const fx = Math.round(focus.x / texel) * texel, fz = Math.round(focus.z / texel) * texel;
  sunLight.target.position.set(fx, 0, fz); sunLight.target.updateMatrixWorld();
  sunLight.position.set(fx + SUN_OFF.x, SUN_OFF.y, fz + SUN_OFF.z);
}

/* 區域氛圍：鏡頭焦點靠近哪一區，霧色與天光就漸漸染上該區的色調 */
const MOOD_COL = Object.fromEntries(Object.entries(MOOD).map(([id, m]) => [id, { fog: new THREE.Color(m.fog), hemi: new THREE.Color(m.hemi), sun: new THREE.Color(m.sun) }]));
const moodBase = MOOD_COL.capital, moodCol = { fog: new THREE.Color(), hemi: new THREE.Color(), sun: new THREE.Color() };
function updateMood(dt) {
  const focus = state.mode === 'explore' ? player.position : controls.target;
  const zoom = state.mode === 'explore' ? 1 : sstep(140, 70, camera.position.distanceTo(controls.target));
  let best = null, w = 0;
  for (const r of regions) {
    const k = sstep(42, 18, Math.hypot(focus.x - r.x, focus.z - r.z)) * zoom;
    if (k > w) { w = k; best = r; }
  }
  const m = (best && MOOD_COL[best.id]) || moodBase;
  for (const key of ['fog', 'hemi', 'sun']) moodCol[key].copy(moodBase[key]).lerp(m[key], w);
  // 日夜：黃昏染上暖色，夜裡換成夜色與月光
  const N = DN_COL;
  moodCol.fog.lerp(N.dusk.fog, dn.dusk * 0.55).lerp(N.night.fog, dn.night * 0.85); // 夜裡保留一點區域色調
  moodCol.hemi.lerp(N.night.hemi, dn.night * 0.85);
  moodCol.sun.lerp(N.dusk.sun, dn.dusk * 0.7).lerp(N.night.moon, dn.night);
  skyMat.uniforms.top.value.copy(N.day.top).lerp(N.dusk.top, dn.dusk * 0.6).lerp(N.night.top, dn.night);
  skyMat.uniforms.bot.value.copy(N.day.bot).lerp(N.dusk.bot, dn.dusk * 0.5).lerp(N.night.bot, dn.night);
  hemi.intensity = EV.hemi[2] + (DN.night.hemiI - EV.hemi[2]) * dn.night;
  sunLight.intensity = EV.sun * dn.day + DN.night.moonI * dn.night;
  const k = reduceMotion ? 1 : Math.min(1, dt * 2);
  scene.fog.color.lerp(moodCol.fog, k);
  skyMat.uniforms.mid.value.lerp(moodCol.fog, k);
  hemi.color.lerp(moodCol.hemi, k);
  sunLight.color.lerp(moodCol.sun, k);
  sound.update(best && best.id, w);
}

/* =========================================================================
 * 主迴圈
 * ========================================================================= */
/* =========================================================================
 * 效能：合併靜態模型
 * 地標由上千個小模型組成，每個都是一次 draw call。先把所有動畫在幾個時間點各跑一次，
 * 找出位置、顯示或材質會變的物件；其餘靜態模型依「區域＋材質＋陰影設定」合併成一個。
 * 材質本身的動畫（例如發光強度）不受影響，因為合併後仍共用同一個材質。
 * ========================================================================= */
function mergeStatic() {
  const npcGroups = new Set(npcs.map((n) => n.group));
  const skip = new Set([player]);
  const cands = [];
  const visibleUp = (o) => { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; };
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (skip.has(o)) return;
    let root = scene;
    for (let x = o.parent; x; x = x.parent) { if (skip.has(x) || x.userData.dynamic) return; if (npcGroups.has(x)) root = x; }
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || o.userData.dynamic || o.children.length) return;
    if (!o.geometry.attributes.position || !o.geometry.attributes.normal) return;
    cands.push({ o, root, m: o.matrixWorld.clone(), v: visibleUp(o), mat: o.material });
  });
  const keep = scene.fog.color.clone();
  detecting = true;
  const T = [0.7, 1.9, 2.9, 4.4, 5.3, 6.6, 8.1, 9.2, 10.6, 11.5, 13.3, 17.9];
  for (const t of T) {
    animators.forEach((fn) => fn(t, 0.016));
    scene.updateMatrixWorld(true);
    for (const c of cands) if (!c.dyn && (!c.o.matrixWorld.equals(c.m) || visibleUp(c.o) !== c.v || c.o.material !== c.mat)) c.dyn = true;
  }
  detecting = false;
  animators.forEach((fn) => fn(0, 0)); // 回到起始狀態
  scene.fog.color.copy(keep);
  scene.updateMatrixWorld(true);
  const groups = new Map();
  for (const c of cands) {
    if (c.dyn || !c.v) continue;
    const o = c.o, wp = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
    let near = RG.capital, nd = 1e9;
    for (const r of regions) { const d = Math.hypot(wp.x - r.x, wp.z - r.z); if (d < nd) { nd = d; near = r; } }
    const key = [c.root.uuid, near.id, o.material.uuid, o.castShadow, o.receiveShadow, o.renderOrder].join('|');
    if (!groups.has(key)) groups.set(key, { root: c.root, list: [] });
    groups.get(key).list.push(o);
  }
  let before = 0, after = 0;
  const inv = new THREE.Matrix4(), rel = new THREE.Matrix4();
  for (const { root, list } of groups.values()) {
    if (list.length < 2) continue;
    inv.copy(root.matrixWorld).invert();
    const geos = list.map((o) => {
      let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
      if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
      geo.morphAttributes = {};
      return geo.applyMatrix4(rel.multiplyMatrices(inv, o.matrixWorld));
    });
    const merged = mergeGeometries(geos, false);
    geos.forEach((g2) => g2.dispose());
    if (!merged) continue;
    const src = list[0], m = new THREE.Mesh(merged, src.material);
    m.castShadow = src.castShadow; m.receiveShadow = src.receiveShadow; m.renderOrder = src.renderOrder;
    m.matrixAutoUpdate = false; root.add(m);
    list.forEach((o) => o.removeFromParent());
    before += list.length; after++;
  }
  return { before, after };
}
const mergeInfo = mergeStatic();

/* =========================================================================
 * 日夜循環：現實 1 小時＝遊戲裡 1 天，跟著真實時鐘走（重新整理不會重來）。
 * 太陽方向、天空、霧、天光隨時間改變；夜裡出現星星與月亮，發光材質（窗戶、燈、霓虹）變亮，
 * 路燈、火把、霓虹柱亮起光暈與地面光圈。網址加 ?time=20 可指定開始的時刻（測試用）。
 * ========================================================================= */
const DAY_SEC = 3600;
let clockShift = 0;
const hourNow = () => ((((Date.now() / 1000 + clockShift) % DAY_SEC) + DAY_SEC) % DAY_SEC) / DAY_SEC * 24;
function setHour(h) { clockShift += ((h - hourNow()) / 24) * DAY_SEC; }
{ const tp = new URLSearchParams(location.search).get('time'); if (tp !== null && !Number.isNaN(parseFloat(tp))) setHour(parseFloat(tp)); }

/* 各世界的白天／黃昏／夜晚：天空上下色、霧色、天光、陽光（夜裡是月光） */
const DN = {
  fantasy: { dusk: { top: '#4a4f8f', bot: '#3a4f6f', fog: '#f2a27a', sun: '#ff9a5a' }, night: { top: '#050918', bot: '#07122a', fog: '#18213d', hemi: '#40508a', hemiI: 0.45, moon: '#a9bcff', moonI: 0.45 }, dayK: 1, boost: 1.8 },
  modern: { dusk: { top: '#3f5a9a', bot: '#2c5470', fog: '#f0a07a', sun: '#ff9e60' }, night: { top: '#060b1c', bot: '#081628', fog: '#1a2236', hemi: '#45557e', hemiI: 0.5, moon: '#b0c4ff', moonI: 0.45 }, dayK: 1, boost: 1.7 },
  cyber: { dusk: { top: '#3a1f6e', bot: '#2a1040', fog: '#c0508a', sun: '#ff6fa0' }, night: { top: '#070820', bot: '#04030c', fog: '#1d1236', hemi: '#5a4cff', hemiI: 0.75, moon: '#9fd4ff', moonI: 0.55 }, dayK: 0.5, boost: 1.6 }
}[WORLD_ID];
const DN_COL = {
  dusk: { top: new THREE.Color(DN.dusk.top), bot: new THREE.Color(DN.dusk.bot), fog: new THREE.Color(DN.dusk.fog), sun: new THREE.Color(DN.dusk.sun) },
  night: { top: new THREE.Color(DN.night.top), bot: new THREE.Color(DN.night.bot), fog: new THREE.Color(DN.night.fog), hemi: new THREE.Color(DN.night.hemi), moon: new THREE.Color(DN.night.moon) },
  day: { top: new THREE.Color(EV.sky[0]), bot: new THREE.Color(EV.sky[2]) }
};
const dn = { hour: 12, day: 1, dusk: 0, night: 0 };
function dayFactors() {
  const h = hourNow(), elev = Math.sin((h - 6) / 12 * Math.PI); // 正午 1、午夜 −1
  dn.hour = h; dn.elev = elev;
  dn.day = sstep(-0.06, 0.32, elev);
  dn.night = 1 - sstep(-0.3, 0.02, elev);
  dn.dusk = Math.max(0, 1 - Math.abs(elev + 0.04) / 0.32);
}
dayFactors();

/* 星星與日月 */
const stars = (() => {
  const n = 700, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = hash2(i, 1.3) * Math.PI * 2, y = 0.08 + hash2(i, 2.7) * 0.92, rr = Math.sqrt(1 - y * y);
    pos[i * 3] = Math.cos(a) * rr * 640; pos[i * 3 + 1] = y * 640; pos[i * 3 + 2] = Math.sin(a) * rr * 640;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  scene.add(p); return p;
})();
const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: '#fff2c4', fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: '#dfe8ff', fog: false, depthWrite: false, transparent: true }));
sunSprite.scale.setScalar(90); moonSprite.scale.setScalar(36);
scene.add(sunSprite, moonSprite);

/* 夜燈：路燈、火把、霓虹柱的光暈（Points）與地面光圈（InstancedMesh），白天隱藏 */
const nightLamps = (() => {
  scene.updateMatrixWorld(true);
  const wp = new THREE.Vector3();
  for (const l of lightSpots) if (l.parent) { l.parent.localToWorld(wp.set(l.x, l.y, l.z)); Object.assign(l, { x: wp.x, y: wp.y, z: wp.z, parent: null }); }
  const groups = { halo: [], flame: [] };
  for (const l of lightSpots) if (!l.noHalo) (l.flame ? groups.flame : groups.halo).push(l);
  const make = (list, size) => {
    if (!list.length) return null;
    const pos = new Float32Array(list.length * 3), col = new Float32Array(list.length * 3), c = new THREE.Color();
    list.forEach((l, i) => { pos.set([l.x, l.y, l.z], i * 3); c.set(l.color); col.set([c.r, c.g, c.b], i * 3); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ size, map: dotTex, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(p); return p;
  };
  const halo = make(groups.halo, 3.2), flame = make(groups.flame, 2.8);
  const pools = lightSpots.filter((l) => l.pool);
  let pool = null;
  if (pools.length) {
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    pool = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: dotTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), pools.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
    pools.forEach((l, i) => { m4.compose(p.set(l.x, heightAt(l.x, l.z) + 0.15, l.z), q, s.set(l.pool, 1, l.pool)); pool.setMatrixAt(i, m4); pool.setColorAt(i, c.set(l.color)); });
    pool.renderOrder = 2; scene.add(pool);
  }
  return { halo, flame, pool };
})();

/* 發光材質：開場時記下每個材質的亮度，白天／夜晚依比例調整；有自己動畫的材質不接管 */
const nightGlows = (() => {
  const mats = new Set();
  scene.traverse((o) => {
    const list = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of list) if (m.emissive && m.emissiveIntensity > 0 && m.emissive.getHex() !== 0) mats.add(m);
  });
  const arr = [...mats];
  detecting = true;
  const snap = (t) => { animators.forEach((fn) => fn(t, 0.016)); return arr.map((m) => m.emissiveIntensity); };
  const a = snap(3.3), b = snap(7.1), c = snap(11.9);
  animators.forEach((fn) => fn(0, 0));
  detecting = false;
  return arr.map((m, i) => (a[i] === b[i] && b[i] === c[i] ? { m, day: m.userData.day ?? a[i] * DN.dayK, night: m.userData.night ?? a[i] * DN.boost } : null)).filter(Boolean);
})();

/* 小地圖角落的時鐘 */
const clockEl = $('#clock');
let clockText = '';
const sunDir = new THREE.Vector3();
function updateDayNight(t) {
  dayFactors();
  const th = (dn.hour - 6) / 12 * Math.PI;
  // 太陽從東（+x）升起、西（−x）落下；夜裡改用月光，方向與太陽相反
  if (dn.elev > -0.05) sunDir.set(Math.cos(th), Math.max(0.18, Math.sin(th)), 0.45).normalize();
  else sunDir.set(-Math.cos(th), Math.max(0.3, -Math.sin(th)), -0.35).normalize();
  SUN_OFF.copy(sunDir).multiplyScalar(175);
  sunSprite.position.copy(camera.position).addScaledVector(new THREE.Vector3(Math.cos(th), Math.sin(th), 0.45).normalize(), 600);
  moonSprite.position.copy(camera.position).addScaledVector(new THREE.Vector3(-Math.cos(th), -Math.sin(th), -0.35).normalize(), 600);
  sunSprite.material.opacity = sstep(-0.12, 0.05, dn.elev); moonSprite.material.opacity = dn.night;
  stars.material.opacity = dn.night * 0.95;
  const n = dn.night;
  nightGlows.forEach((g) => { g.m.emissiveIntensity = g.day + (g.night - g.day) * n; });
  if (nightLamps.halo) nightLamps.halo.material.opacity = n * 0.7;
  if (nightLamps.flame) { nightLamps.flame.material.opacity = n * (0.75 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.07); nightLamps.flame.material.size = 2.8 + Math.sin(t * 9.1) * 0.25; }
  if (nightLamps.pool) nightLamps.pool.material.opacity = n * 0.5;
  renderer.toneMappingExposure = EV.exposure * (1 + n * 0.18);
  const hh = Math.floor(dn.hour), mm = Math.floor((dn.hour - hh) * 60);
  const label = `${dn.night > 0.5 ? '夜晚' : dn.dusk > 0.5 ? (dn.hour < 12 ? '清晨' : '黃昏') : '白天'} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  if (label !== clockText) { clockText = label; clockEl.textContent = label; clockEl.dataset.phase = dn.night > 0.5 ? 'night' : 'day'; }
}

/* 任務系統（js/quests.js）：在合併靜態模型之後建立，小怪才不會被合併 */
const quests = initQuests({
  scene, camera, $, esc, isTouch, heightAt, faculty, RG, FIELD_R, npcs, state, player, mat, sound,
  flyTo, teleport, closeCard, closeCodexIfNarrow, selectTeacher, syncInteract, openReset, setMode
});
installTrials(registerTrial); // 導師試煉小遊戲（js/trials.js）

const clock = new THREE.Clock();
let firstFrame = true;
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  // 導師卡或試煉視窗蓋住畫面時，背後只是模糊背景：暫停 3D 渲染，省電也讓小遊戲更順
  if ((state.card || state.paused) && !state.flying && !firstFrame) { requestAnimationFrame(tick); return; }
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
    if (d > 140) { tg.x *= 140 / d; tg.z *= 140 / d; }
    controls.update();
    const ground = heightAt(camera.position.x, camera.position.z) + 3;
    if (camera.position.y < ground) camera.position.y = ground;
  }

  updateNPCs(t, dt);
  quests.update(t, dt);
  updateDayNight(t);
  updateMood(dt);
  updateShadow();

  // 依距離調整標籤
  const cp = camera.position;
  const focus = state.mode === 'explore' ? player.position : controls.target;
  for (const n of npcs) {
    const d = cp.distanceTo(n.pos);
    n.label.classList.toggle('far', d > (state.mode === 'explore' ? 60 : 95));
  }
  for (const s of fieldSigns) s.el.classList.toggle('far', cp.distanceTo(s.pos) > 120);
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
window.__quest = { setHour, dayNight: dn, state, setMode, selectTeacher, goRegion, faculty, regions, openCard, closeCard, toggleCodex, reveal, explored, camera, controls, teleport, renderer, mergeInfo, quests };
