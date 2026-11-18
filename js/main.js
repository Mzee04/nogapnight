import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { NETS, analyzeRoom, suggestNet, autoHook } from './analysis.js';
import { buildPlaceholder, addSleepers, fitGLB } from './models.js';
import { createNet, createGapBand, createUncoveredOverlay, createRigging, gapTargets, netTargets } from './drape.js';
import { Swarm } from './mosquitoes.js';
import { renderCard, cardText, cardPNG } from './card.js';

const $ = (id) => document.getElementById(id);
const isMobile = matchMedia('(max-width: 760px)').matches;

// ---------- state ----------
let uid = 1;
const place = (o) => ({ id: uid++, name: 'Bed', kind: 'bed', length: 190, width: 135, top: 50, sleepers: 2, x: 150, z: 120, rot: 0,
  net: 'r190', tuck: 'mattress', hookMode: 'auto', hook: 180, ...o });

const PRESETS = {
  room: () => ({
    room: { width: 420, depth: 380, ceiling: 280 },
    places: [
      place({ name: 'Big bed', kind: 'bed', length: 183, width: 183, top: 50, sleepers: 2, x: 120, z: 110, net: 'r190', hookMode: 'manual', hook: 205 }),
      place({ name: 'Kids mattress', kind: 'floor', length: 183, width: 107, top: 18, sleepers: 2, x: 335, z: 115, net: 'none' }),
      place({ name: 'Baby crib', kind: 'crib', length: 120, width: 60, top: 45, sleepers: 1, x: 300, z: 300, rot: 90, net: 'c850', hookMode: 'manual', hook: 150 }),
    ],
  }),
  floor: () => ({ room: { width: 340, depth: 320, ceiling: 270 },
    places: [place({ name: 'Family mattress', kind: 'floor', length: 183, width: 183, top: 20, sleepers: 3, x: 170, z: 150, net: 'r160', hookMode: 'manual', hook: 190 })] }),
  bed: () => ({ room: { width: 340, depth: 320, ceiling: 280 },
    places: [place({ name: 'Bed', kind: 'bed', length: 190, width: 135, top: 55, sleepers: 2, x: 170, z: 130, net: 'r130', hookMode: 'manual', hook: 200 })] }),
  // Real Aholo Lux3D bed (Bed With Bedding). Size is a rough estimate.
  // Starts with a too-small net hung too high so the gaps glow red; Fix my room then fits it.
  luxbed: () => ({
    room: { width: 360, depth: 380, ceiling: 280 },
    places: [place({
      name: 'My bed', kind: 'bed', length: 190, width: 100, top: 45, sleepers: 1,
      x: 180, z: 170, net: 'r100', hookMode: 'manual', hook: 230, tuck: 'mattress',
    })],
    model: { file: 'bed-lux3d.glb', name: 'Bed With Bedding (Lux3D)' },
  }),
  // Real Aholo Lux3D floor mattress (Patterned Mattress). Size is a rough estimate.
  // Hero scene: two sleepers (pillow and wrapper lumps), a single net that is too small and hung too high.
  luxmat: () => ({
    room: { width: 340, depth: 330, ceiling: 270 },
    places: [place({
      name: 'Floor mattress', kind: 'floor', length: 190, width: 120, top: 15, sleepers: 2,
      x: 170, z: 150, net: 'r100', hookMode: 'manual', hook: 190, tuck: 'mattress',
    })],
    model: { file: 'mattress-lux3d.glb', name: 'Patterned Mattress (Lux3D)' },
  }),
  // Real Aholo Lux3D wooden double bed with corner posts. Size is a rough estimate.
  // Pushed tight against the left wall: the net runs into the wall and is too narrow, so gaps glow red.
  luxwood: () => ({
    room: { width: 360, depth: 360, ceiling: 270 },
    places: [place({
      name: 'Bed by the wall', kind: 'bed', length: 190, width: 140, top: 50, sleepers: 2,
      x: 72, z: 140, net: 'r160', hookMode: 'manual', hook: 215, tuck: 'mattress',
    })],
    model: { file: 'wood-bed-lux3d.glb', name: 'Wooden Bed (Lux3D)' },
  }),
  // Second Lux3D take of the same wooden double bed, from a closer photo over the footboard.
  // Same room and placement as luxwood so the two takes can be compared from one camera.
  luxwood2: () => ({
    room: { width: 360, depth: 360, ceiling: 270 },
    places: [place({
      name: 'Wooden bed, second view', kind: 'bed', length: 190, width: 140, top: 50, sleepers: 2,
      x: 72, z: 140, net: 'r160', hookMode: 'manual', hook: 215, tuck: 'mattress',
    })],
    model: { file: 'wood-bed-2-lux3d.glb', name: 'Wooden Bed, second view (Lux3D)' },
  }),
  // Two real Lux3D sleeping places in one room: the wooden bed against the wall, and the floor mattress.
  // Both start with a net that is too small and hung too high; Fix my room seals the room.
  shared: () => ({
    room: { width: 420, depth: 380, ceiling: 270 },
    places: [
      place({
        name: 'Bed by the wall', kind: 'bed', length: 190, width: 140, top: 50, sleepers: 2,
        x: 72, z: 160, net: 'r160', hookMode: 'manual', hook: 215, tuck: 'mattress',
      }),
      place({
        name: 'Floor mattress', kind: 'floor', length: 190, width: 120, top: 15, sleepers: 2,
        x: 280, z: 160, net: 'r100', hookMode: 'manual', hook: 190, tuck: 'mattress',
      }),
    ],
    models: [
      { file: 'wood-bed-lux3d.glb', name: 'Wooden Bed (Lux3D)' },
      { file: 'mattress-lux3d.glb', name: 'Patterned Mattress (Lux3D)' },
    ],
  }),
  crib: () => ({ room: { width: 300, depth: 280, ceiling: 270 },
    places: [place({ name: 'Crib', kind: 'crib', length: 120, width: 60, top: 45, sleepers: 1, x: 150, z: 130, net: 'c850', hookMode: 'manual', hook: 140 })] }),
};

const params = new URLSearchParams(location.search);
const CLEAN = params.has('clean'); // ?clean: no intro or hints (for screen recording)
const HERO = 'luxmat';
const state = { ...PRESETS[HERO](), selected: null, orbit: true, preset: HERO };
state.selected = state.places[0].id;
const glbs = new Map(); // place id -> { scene, name }
let analysis = { results: [], roomScore: 0 };

// ---------- three.js setup ----------
const canvas = $('c');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
} catch (e) {
  $('loading').textContent = 'This device could not start WebGL, so the 3D view is unavailable.';
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070b1a);
scene.fog = new THREE.Fog(0x070b1a, 9, 20);

const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 60);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI * 0.4;
controls.minPolarAngle = Math.PI * 0.12;
controls.enablePan = false;
controls.minDistance = 1.2;
controls.maxDistance = 12;
controls.autoRotateSpeed = 0.5;
controls.addEventListener('start', () => { setOrbit(false); fly = null; });

scene.add(new THREE.HemisphereLight(0x5a6cb0, 0x20160c, 0.9));
const moon = new THREE.DirectionalLight(0xa9bcff, 1.3);
moon.castShadow = true;
moon.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
moon.shadow.radius = 4;
moon.shadow.bias = -0.0005;
scene.add(moon, moon.target);
const lamp = new THREE.PointLight(0xffb36b, 9, 9, 1.6);
lamp.castShadow = !isMobile;
lamp.shadow.mapSize.set(512, 512);
scene.add(lamp);
const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
scene.add(bulb);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- room ----------
const roomGroup = new THREE.Group();
scene.add(roomGroup);
function textTexture(text, w = 512, h = 96, size = 44) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,0.0)'; g.fillRect(0, 0, w, h);
  g.font = `600 ${size}px system-ui, sans-serif`; g.fillStyle = 'rgba(200,210,255,0.55)';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function floorTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#6b5a4a'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const v = 95 + ((i * 7 + j * 13) % 5) * 6;
    g.fillStyle = `rgb(${v + 10},${v - 5},${v - 25})`;
    g.fillRect(i * 64 + 2, j * 64 + 2, 60, 60);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const floorTex = floorTexture();
function buildRoom() {
  roomGroup.clear();
  const { width, depth, ceiling } = state.room;
  const W = width / 100, D = depth / 100, H = ceiling / 100;
  floorTex.repeat.set(W / 0.5, D / 0.5);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(W / 2, 0, D / 2); floor.receiveShadow = true;
  roomGroup.add(floor);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x3b4466, roughness: 1 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat);
  back.position.set(W / 2, H / 2, 0); back.receiveShadow = true;
  const left = new THREE.Mesh(new THREE.PlaneGeometry(D, H), wallMat);
  left.rotation.y = Math.PI / 2; left.position.set(0, H / 2, D / 2); left.receiveShadow = true;
  roomGroup.add(back, left);
  // window with moonlight
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.8), new THREE.MeshBasicMaterial({ color: 0x9fb8ff }));
  win.position.set(W * 0.72, H * 0.62, 0.005);
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.9), new THREE.MeshStandardMaterial({ color: 0x1b1f33 }));
  frame.position.set(W * 0.72, H * 0.62, 0.003);
  const barV = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.8), new THREE.MeshBasicMaterial({ color: 0x1b1f33 }));
  barV.position.set(W * 0.72, H * 0.62, 0.007);
  const barH = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.03), new THREE.MeshBasicMaterial({ color: 0x1b1f33 }));
  barH.position.set(W * 0.72, H * 0.62, 0.007);
  roomGroup.add(frame, win, barV, barH);
  // wall labels used by the carpenter card
  const lblHead = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.22), new THREE.MeshBasicMaterial({ map: textTexture('HEAD WALL'), transparent: true }));
  lblHead.position.set(W * 0.3, H - 0.25, 0.01);
  const lblLeft = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.22), new THREE.MeshBasicMaterial({ map: textTexture('LEFT WALL'), transparent: true }));
  lblLeft.rotation.y = Math.PI / 2; lblLeft.position.set(0.01, H - 0.25, D * 0.5);
  roomGroup.add(lblHead, lblLeft);
  // ceiling outline so hook heights read clearly
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, D)),
    new THREE.LineBasicMaterial({ color: 0x55609a, transparent: true, opacity: 0.25 }));
  edges.position.set(W / 2, H / 2, D / 2);
  roomGroup.add(edges);

  moon.position.set(W * 0.72, H + 1.5, -1.6);
  moon.target.position.set(W * 0.45, 0, D * 0.6);
  const s = Math.max(W, D);
  Object.assign(moon.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.5, far: 12 });
  moon.shadow.camera.updateProjectionMatrix();
  lamp.position.set(W * 0.88, H - 0.35, D * 0.88);
  bulb.position.copy(lamp.position);
  if (typeof swarmB !== 'undefined') { swarm.setBounds(W, D, H); swarmB.setBounds(W, D, H); }
}

// ---------- places ----------
const placeObjs = new Map(); // id -> { group, net, band, overlay, zzz }
const placesRoot = new THREE.Group();
scene.add(placesRoot);
const zTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.font = 'bold 48px system-ui'; g.fillStyle = '#cfe0ff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('z', 32, 34); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

function disposeObj(o, root = placesRoot) {
  if (!o) return;
  o.net && o.net.dispose();
  o.group.traverse((m) => { if (m.isMesh && m.geometry && !m.userData.shared) m.geometry.dispose(); });
  root.remove(o.group);
}

function buildPlace(p, a, drop, objs = placeObjs, root = placesRoot) {
  disposeObj(objs.get(p.id), root);
  const group = new THREE.Group();
  group.position.set(p.x / 100, 0, p.z / 100);
  group.rotation.y = p.rot === 90 ? Math.PI / 2 : 0;
  const g = glbs.get(p.id);
  let base;
  if (g) {
    base = fitGLB(g.scene, p);
    g.heightCm = base.userData.heightCm;
    // a Lux3D floor mattress or crib has no sleepers in it: add pillow and wrapper lumps (never human figures)
    if (p.kind !== 'bed') addSleepers(base, p.length / 100, p.width / 100, p.top / 100, p.sleepers);
  } else {
    base = buildPlaceholder(p);
    addSleepers(base, p.length / 100, p.width / 100, p.top / 100, p.sleepers);
  }
  group.add(base);
  const o = { group, net: null, band: null, overlay: null, zzz: [], top: p.top / 100 };
  if (a.net.type !== 'none') {
    o.net = createNet(p, a);
    group.add(o.net.group);
    group.add(createRigging(p, a, state.room.ceiling));
    if (drop) o.net.drop();
  }
  o.band = createGapBand(p, a); if (o.band) group.add(o.band);
  o.overlay = createUncoveredOverlay(p, a); if (o.overlay) group.add(o.overlay);
  for (let i = 0; i < Math.min(3, p.sleepers); i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false }));
    s.userData = { seed: Math.random() * 10, x: (Math.random() - 0.5) * p.width / 150, z: -p.length / 250 };
    s.scale.setScalar(0.1);
    group.add(s); o.zzz.push(s);
  }
  root.add(group);
  objs.set(p.id, o);
}

function refreshTargets(places = state.places, results = analysis.results, objs = placeObjs, sw = swarm) {
  const gaps = [], nets = [];
  const v = new THREE.Vector3();
  places.forEach((p, i) => {
    const a = results[i];
    const o = objs.get(p.id);
    if (!o) return;
    o.group.updateMatrixWorld(true);
    for (const t of gapTargets(p, a)) gaps.push(v.set(...t).applyMatrix4(o.group.matrixWorld).clone());
    for (const t of netTargets(p, a)) nets.push(v.set(...t).applyMatrix4(o.group.matrixWorld).clone());
  });
  sw.setTargets(gaps, nets);
}

let prevNetKey = new Map();
function recompute({ drop = false, rebuildAll = false } = {}) {
  analysis = analyzeRoom(state.room, state.places);
  const alive = new Set(state.places.map((p) => p.id));
  for (const [id, o] of placeObjs) if (!alive.has(id)) { disposeObj(o); placeObjs.delete(id); }
  state.places.forEach((p, i) => {
    const a = analysis.results[i];
    const key = `${p.net}`;
    const netChanged = prevNetKey.get(p.id) !== key;
    prevNetKey.set(p.id, key);
    buildPlace(p, a, drop || (netChanged && a.net.type !== 'none'));
  });
  void rebuildAll;
  refreshTargets();
  renderUI();
  if (cmp.on) buildBefore();
}

// ---------- UI ----------
const levelColor = { good: 'var(--good)', fix: 'var(--fix)', bad: 'var(--bad)' };
const sel = () => state.places.find((p) => p.id === state.selected) || state.places[0];
const netSelect = $('f-net');
netSelect.innerHTML = Object.values(NETS).map((n) => `<option value="${n.id}">${n.label}</option>`).join('');

function renderUI() {
  const p = sel();
  const i = state.places.indexOf(p);
  const a = analysis.results[i];
  // tabs
  $('place-tabs').innerHTML = state.places.map((q, k) => {
    const r = analysis.results[k];
    return `<button class="chip tab ${q.id === p.id ? 'sel' : ''}" data-id="${q.id}"><span class="dot" style="background:${levelColor[r.level]}"></span>${escapeHtml(q.name)} · ${r.score}</button>`;
  }).join('');
  // form
  const set = (id, v) => { const el = $(id); if (document.activeElement !== el) el.value = v; };
  set('f-name', p.name); set('f-kind', p.kind); set('f-len', p.length); set('f-wid', p.width); set('f-top', p.top);
  set('f-sleep', p.sleepers); set('f-x', p.x); set('f-z', p.z); $('f-rot').checked = p.rot === 90;
  set('f-net', p.net); set('f-tuck', p.tuck); set('f-hookmode', p.hookMode);
  const sizeKey = `${p.length}x${p.width}`;
  $('f-size').value = [...$('f-size').options].some((o) => o.value === sizeKey) ? sizeKey : '';
  const hook = a.hook ?? autoHook(p) ?? p.hook;
  $('f-hook').max = state.room.ceiling - 3;
  set('f-hook', Math.round(hook)); $('hook-val').textContent = Math.round(hook);
  $('hook-row').style.opacity = p.net === 'none' ? 0.4 : 1;
  $('f-hook').disabled = p.hookMode === 'auto' || p.net === 'none';
  set('room-w', state.room.width); set('room-d', state.room.depth); set('room-c', state.room.ceiling);
  // glb info
  const g = glbs.get(p.id);
  $('btn-clear-glb').hidden = !g;
  $('glb-info').innerHTML = g
    ? `<b>Generated with Aholo Lux3D</b>: ${escapeHtml(g.name)}. Footprint scaled to ${p.length} × ${p.width} cm (rough estimate), model height about ${g.heightCm ?? '?'} cm (your mattress top: ${p.top} cm). The gap check uses the sizes you typed.`
    : 'Using a stand-in model. Generate your real bed in <a href="https://3d.aholo.ai/lux3d/home" target="_blank" rel="noopener">Aholo Lux3D</a>, download the GLB and drop it on the 3D view. It is scaled to the size you typed.';
  // score
  const ring = $('ring');
  ring.className = `ring lvl-${a.level}`;
  $('ps-num').textContent = a.score;
  $('ps-title').textContent = a.level === 'good' ? `${p.name}: sealed` : a.level === 'fix' ? `${p.name}: small gaps` : `${p.name}: open to mosquitoes`;
  $('ps-net').textContent = a.net.type === 'none' ? 'No net' : `${a.net.label} · hooks at ${Math.round(a.hook)} cm`;
  $('tips').innerHTML = a.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join('');
  const rs = $('room-score');
  const rl = analysis.roomScore >= 85 ? 'good' : analysis.roomScore >= 50 ? 'fix' : 'bad';
  rs.className = `hud-score lvl-${rl}`;
  rs.querySelector('.num').textContent = analysis.roomScore;
  rs.title = 'Room score = the weakest sleeping place';
  renderLabels();
}

function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

const labelsEl = $('labels');
function renderLabels() {
  labelsEl.innerHTML = state.places.map((p, i) => {
    const a = analysis.results[i];
    const credit = glbs.has(p.id) ? '<span class="credit">Generated with Aholo Lux3D</span>' : '';
    return `<div class="label ${p.id === state.selected ? 'sel' : ''}" data-id="${p.id}"><span class="dot" style="background:${levelColor[a.level]}"></span>${escapeHtml(p.name)} · ${a.score}${credit}</div>`;
  }).join('');
}
labelsEl.addEventListener('click', (e) => {
  const el = e.target.closest('.label'); if (!el) return;
  selectPlace(+el.dataset.id);
});
const tmpV = new THREE.Vector3();
function positionLabels() {
  const rect = canvas.getBoundingClientRect();
  [...labelsEl.children].forEach((el) => {
    const p = state.places.find((q) => q.id === +el.dataset.id);
    const i = state.places.indexOf(p);
    const a = analysis.results[i];
    if (!p || !a) return;
    const y = (a.hook ?? p.top + 40) / 100 + 0.18;
    tmpV.set(p.x / 100, y, p.z / 100).project(camera);
    const vis = tmpV.z < 1;
    el.style.display = vis ? '' : 'none';
    el.style.left = `${(tmpV.x * 0.5 + 0.5) * rect.width}px`;
    el.style.top = `${(-tmpV.y * 0.5 + 0.5) * rect.height}px`;
  });
}

$('place-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-id]'); if (!b) return;
  selectPlace(+b.dataset.id);
});
document.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
  const kind = b.dataset.add;
  const dims = kind === 'crib' ? { length: 120, width: 60, top: 45, sleepers: 1, net: 'c850' }
    : kind === 'floor' ? { length: 183, width: 137, top: 20, sleepers: 2, net: 'r160' }
    : { length: 190, width: 135, top: 50, sleepers: 2, net: 'r190' };
  const p = place({ kind, name: kind === 'crib' ? 'Crib' : kind === 'floor' ? 'Floor mattress' : 'Bed',
    x: Math.round(state.room.width / 2), z: Math.round(state.room.depth / 2), hookMode: 'auto', ...dims });
  state.places.push(p); state.selected = p.id; recompute();
}));
$('btn-remove').addEventListener('click', () => {
  if (state.places.length <= 1) return;
  const p = sel();
  state.places = state.places.filter((q) => q !== p);
  glbs.delete(p.id);
  state.selected = state.places[0].id; recompute();
});
document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => { loadPreset(b.dataset.preset); onboardStep(1); }));
function loadPreset(name) {
  if (!PRESETS[name]) return;
  const s = PRESETS[name]();
  setCompare(false); before = null;
  state.preset = name;
  state.room = s.room; state.places = s.places; state.selected = s.places[0].id;
  glbs.clear(); buildRoom(); recompute({ drop: true }); frameCamera(); swarm.resetStats();
  document.querySelectorAll('#presets [data-preset]').forEach((b) => b.classList.toggle('sel', b.dataset.preset === name));
  const list = s.models || (s.model ? [s.model] : []);
  (async () => {
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      const p = state.places[m.place ?? i];
      if (p) await loadGLB(`assets/models/${m.file}`, m.name, p);
    }
  })();
}

const num = (id, lo, hi) => Math.min(hi, Math.max(lo, +$(id).value || 0));
function bindForm() {
  const onChange = (fn) => (e) => { const p = sel(); fn(p, e); recompute(); };
  $('f-name').addEventListener('input', onChange((p) => { p.name = $('f-name').value || 'Sleeping place'; }));
  $('f-kind').addEventListener('change', onChange((p) => { p.kind = $('f-kind').value; }));
  $('f-size').addEventListener('change', onChange((p) => {
    const v = $('f-size').value; if (!v) return;
    const [l, w] = v.split('x').map(Number); p.length = l; p.width = w;
  }));
  $('f-len').addEventListener('change', onChange((p) => { p.length = num('f-len', 50, 260); }));
  $('f-wid').addEventListener('change', onChange((p) => { p.width = num('f-wid', 40, 260); }));
  $('f-top').addEventListener('change', onChange((p) => { p.top = num('f-top', 5, 120); }));
  $('f-sleep').addEventListener('change', onChange((p) => { p.sleepers = num('f-sleep', 0, 4); }));
  $('f-x').addEventListener('change', onChange((p) => { p.x = num('f-x', 0, state.room.width); }));
  $('f-z').addEventListener('change', onChange((p) => { p.z = num('f-z', 0, state.room.depth); }));
  $('f-rot').addEventListener('change', onChange((p) => { p.rot = $('f-rot').checked ? 90 : 0; }));
  $('f-net').addEventListener('change', onChange((p) => { p.net = $('f-net').value; }));
  $('f-tuck').addEventListener('change', onChange((p) => { p.tuck = $('f-tuck').value; }));
  $('f-hookmode').addEventListener('change', onChange((p) => {
    p.hookMode = $('f-hookmode').value;
    if (p.hookMode === 'manual') p.hook = Math.round(autoHook(p) ?? p.hook);
  }));
  $('f-hook').addEventListener('input', onChange((p) => { p.hook = +$('f-hook').value; }));
  const roomChange = () => {
    state.room = { width: num('room-w', 150, 1000), depth: num('room-d', 150, 1000), ceiling: num('room-c', 180, 500) };
    buildRoom(); recompute();
  };
  ['room-w', 'room-d', 'room-c'].forEach((id) => $(id).addEventListener('change', roomChange));
}
bindForm();

// Fix my room as a pure step, so the journey card can show before -> after scores for any scene.
function fixPlaces(room, places, results) {
  places.forEach((p, i) => {
    if (p.net === 'none' || !NETS[p.net] || results[i].uncovered) {
      const s = suggestNet(p); if (s) p.net = s.id;
    }
    p.hookMode = 'auto';
    nudgeFromWalls(p, room);
  });
}
function runFix() {
  if (!before || analysis.roomScore < 100) snapshotBefore();
  fixPlaces(state.room, state.places, analysis.results);
  recompute({ drop: true });
  swarm.resetStats();
  onboardStep(3);
  if (!cmp.on) pulse($('btn-compare'));
}
$('btn-fix').addEventListener('click', runFix);
// keep the whole net footprint inside the room so it can hang straight
function nudgeFromWalls(p, room = state.room) {
  const n = NETS[p.net];
  if (!n || n.type === 'none') return;
  let hx, hz;
  if (n.type === 'rect') { hx = Math.max(n.w, p.width) / 2; hz = Math.max(n.l, p.length) / 2; }
  else { hx = hz = Math.hypot(p.width / 2, p.length / 2) + 3; }
  if (p.rot === 90) [hx, hz] = [hz, hx];
  const clamp = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
  p.x = Math.round(clamp(p.x, hx + 3, room.width - hx - 3));
  p.z = Math.round(clamp(p.z, hz + 3, room.depth - hz - 3));
}
$('btn-drop').addEventListener('click', () => { recompute({ drop: true }); });
$('btn-orbit').addEventListener('click', () => setOrbit(!state.orbit));
function setOrbit(on) { state.orbit = on; controls.autoRotate = on; $('btn-orbit').classList.toggle('on', on); }
function openCard() {
  $('print-card').innerHTML = renderCard(state.room, state.places, analysis.results);
  if (!$('card-dialog').open) $('card-dialog').showModal();
}
$('btn-card').addEventListener('click', openCard);
$('btn-close-card').addEventListener('click', () => $('card-dialog').close());
$('btn-print').addEventListener('click', () => window.print());
function download(name, href) { const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
$('btn-png').addEventListener('click', () => download('no-gap-night-size-card.png', cardPNG(state.room, state.places, analysis.results)));
$('btn-txt').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([cardText(state.room, state.places, analysis.results)], { type: 'text/plain' }));
  download('no-gap-night-size-card.txt', url); setTimeout(() => URL.revokeObjectURL(url), 2000);
});
$('panel-toggle').addEventListener('click', () => {
  $('panel').classList.toggle('collapsed');
  document.body.classList.toggle('panel-collapsed', $('panel').classList.contains('collapsed'));
});

// ---------- GLB loading ----------
const loader = new GLTFLoader();
async function loadGLB(url, name, p) {
  const file = url.startsWith('assets/models/') ? url.slice('assets/models/'.length) : null;
  $('glb-info').textContent = `Loading ${name}…`;
  $('glb-loading-name').textContent = `loading ${name}…`;
  $('glb-loading').hidden = false;
  const t0 = performance.now();
  try {
    const gltf = await loader.loadAsync(url);
    await new Promise((r) => setTimeout(r, Math.max(0, 900 - (performance.now() - t0)))); // let the credit be seen
    if (!state.places.includes(p)) return; // scene changed while loading
    glbs.set(p.id, { scene: gltf.scene, name, file });
    recompute({ drop: true });
  } catch (err) {
    console.warn('GLB load failed', err);
    $('glb-info').textContent = `Could not read ${name}. Export it from Lux3D as .glb and try again.`;
  } finally {
    $('glb-loading').hidden = true;
  }
}
function loadFile(file) {
  if (!file) return;
  if (!/\.glb$/i.test(file.name)) { $('glb-info').textContent = 'Please use a .glb file (Lux3D → download → GLB).'; return; }
  const url = URL.createObjectURL(file);
  loadGLB(url, file.name, sel());
  onboardStep(1);
}
$('f-glb').addEventListener('change', (e) => { loadFile(e.target.files[0]); e.target.value = ''; });
$('btn-clear-glb').addEventListener('click', () => { glbs.delete(sel().id); recompute(); });
const vp = $('viewport');
['dragenter', 'dragover'].forEach((ev) => vp.addEventListener(ev, (e) => { e.preventDefault(); $('drop-hint').hidden = false; }));
['dragleave', 'drop'].forEach((ev) => vp.addEventListener(ev, (e) => { e.preventDefault(); if (ev === 'dragleave' && vp.contains(e.relatedTarget)) return; $('drop-hint').hidden = true; }));
vp.addEventListener('drop', (e) => loadFile(e.dataTransfer.files[0]));

let manifest = [];
fetch('assets/models/manifest.json').then((r) => (r.ok ? r.json() : { models: [] })).then((m) => {
  manifest = Array.isArray(m.models) ? m.models : [];
  if (!manifest.length) return;
  const s = $('f-manifest');
  s.hidden = false;
  s.innerHTML += manifest.map((x, i) => `<option value="${i}">${escapeHtml(x.name || x.file)}</option>`).join('');
}).catch(() => {});
$('f-manifest').addEventListener('change', (e) => {
  const m = manifest[+e.target.value]; e.target.value = '';
  if (!m) return;
  const p = sel();
  if (m.kind) p.kind = m.kind;
  if (m.length) p.length = m.length;
  if (m.width) p.width = m.width;
  if (m.top) p.top = m.top;
  loadGLB(`assets/models/${m.file}`, m.name || m.file, p);
});

// ---------- camera ----------
function framePose(scale = 1) {
  const W = state.room.width / 100, D = state.room.depth / 100;
  const s = Math.max(W, D);
  const target = new THREE.Vector3(W * 0.5, 0.6, D * 0.5);
  const dist = s * (isMobile ? 2.1 : 1.5) * scale;
  const pos = new THREE.Vector3(W * 0.5 + dist * 0.55, dist * 0.95, D * 0.5 + dist * 0.7);
  return { pos, target };
}
function frameCamera(instant = false) {
  const { pos, target } = framePose();
  if (instant) { fly = null; camera.position.copy(pos); controls.target.copy(target); controls.update(); }
  else flyTo(pos, target, 1.1);
}
// smooth camera moves (eased), used for presets, the intro and selecting a sleeping place
let fly = null;
function flyTo(pos, target, dur = 1.1) {
  fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos.clone(), t1: target.clone(), start: performance.now(), dur: dur * 1000 };
}
function stepFly() {
  if (!fly) return;
  const k = Math.min(1, (performance.now() - fly.start) / fly.dur);
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  camera.position.lerpVectors(fly.p0, fly.p1, e);
  controls.target.lerpVectors(fly.t0, fly.t1, e);
  if (k >= 1) fly = null;
}
function focusPlace(p) {
  const target = new THREE.Vector3(p.x / 100, Math.max(0.3, p.top / 100 + 0.2), p.z / 100);
  const span = Math.max(p.length, p.width) / 100;
  const dist = span * (isMobile ? 2.8 : 2.2) + 1.7;
  const dir = camera.position.clone().sub(controls.target); dir.y = 0;
  if (dir.lengthSq() < 1e-4) dir.set(0.6, 0, 0.8);
  dir.normalize();
  const pos = target.clone().addScaledVector(dir, dist * 0.62); pos.y += dist * 0.8;
  flyTo(pos, target, 1.0);
}
function selectPlace(id) {
  state.selected = id; renderUI();
  const p = sel();
  if (state.places.length > 1) focusPlace(p); else frameCamera();
}

// ---------- loop ----------
const swarm = new Swarm(scene, isMobile ? 24 : 40);
swarm.onStats = (s) => { $('st-sneak').textContent = s.sneak; $('st-bonk').textContent = s.bonk; };
const swarmB = new Swarm(scene, isMobile ? 16 : 28); // the "before" side of the compare wipe
swarmB.points.visible = false;

function resize() {
  const r = canvas.parentElement.getBoundingClientRect();
  const w = Math.max(1, r.width), h = Math.max(1, r.height);
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  swarm.setPixelScale(h * renderer.getPixelRatio() * 0.13);
  swarmB.setPixelScale(h * renderer.getPixelRatio() * 0.13);
  cmpCanvas.width = canvas.width; cmpCanvas.height = canvas.height;
}
window.addEventListener('resize', resize);

const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  stepFly();
  controls.update();
  for (const o of [...placeObjs.values(), ...(cmp.on ? beforeObjs.values() : [])]) {
    if (o.net) o.net.update(t, dt);
    if (o.band) o.band.material.uniforms.uTime.value = t;
    if (o.overlay) o.overlay.userData.time.value = t;
    o.zzz.forEach((s, k) => {
      const ph = ((t * 0.35 + s.userData.seed + k * 0.33) % 1);
      const top = o.top ?? 0.5;
      s.position.set(s.userData.x + Math.sin(ph * 6) * 0.05, top + 0.25 + ph * 0.5, s.userData.z);
      s.material.opacity = Math.sin(ph * Math.PI) * 0.8;
      s.scale.setScalar(0.06 + ph * 0.08);
    });
  }
  swarm.update(dt, t);
  bulb.material.color.setHSL(0.09, 1, 0.75 + Math.sin(t * 2) * 0.02);
  if (cmp.on) renderBefore(dt, t);
  composer.render();
  positionLabels();
  requestAnimationFrame(tick);
}

// ---------- before / after compare (split-screen wipe) ----------
// The "before" scene is a snapshot of the sleeping places taken just before Fix my room. Each frame we render it,
// copy the frame into an overlay canvas clipped to the left of the slider, then render the fixed room underneath.
const beforeRoot = new THREE.Group();
beforeRoot.visible = false;
scene.add(beforeRoot);
const beforeObjs = new Map();
let before = null; // { places, analysis }
const cmp = { on: false, x: 0.5, anim: null };
const cmpCanvas = $('cmp-canvas');
const cmpCtx = cmpCanvas.getContext('2d');

function snapshotBefore() { before = { places: state.places.map((p) => ({ ...p })), analysis: null }; }
function clearBefore() { for (const o of beforeObjs.values()) disposeObj(o, beforeRoot); beforeObjs.clear(); }
function buildBefore() {
  if (!before) return;
  clearBefore();
  before.analysis = analyzeRoom(state.room, before.places);
  before.places.forEach((p, i) => buildPlace(p, before.analysis.results[i], false, beforeObjs, beforeRoot));
  refreshTargets(before.places, before.analysis.results, beforeObjs, swarmB);
  renderCompareUI();
}
function renderBefore() {
  placesRoot.visible = false; swarm.points.visible = false;
  beforeRoot.visible = true; swarmB.points.visible = true;
  composer.render();
  cmpCtx.clearRect(0, 0, cmpCanvas.width, cmpCanvas.height);
  cmpCtx.drawImage(canvas, 0, 0, cmpCanvas.width, cmpCanvas.height);
  placesRoot.visible = true; swarm.points.visible = true;
  beforeRoot.visible = false; swarmB.points.visible = false;
}
const lvlOf = (s) => (s >= 85 ? 'good' : s >= 50 ? 'fix' : 'bad');
function renderCompareUI() {
  if (!before || !before.analysis) return;
  const b = before.analysis.roomScore, a = analysis.roomScore;
  $('cmp-before').innerHTML = `<small>Before</small><b class="lvl-${lvlOf(b)}">${b}</b>`;
  $('cmp-after').innerHTML = `<small>After</small><b class="lvl-${lvlOf(a)}">${a}</b>`;
}
function setCmpX(x) {
  cmp.x = Math.min(0.98, Math.max(0.02, x));
  $('viewport').style.setProperty('--x', `${(cmp.x * 100).toFixed(2)}%`);
  $('cmp-handle').setAttribute('aria-valuenow', Math.round(cmp.x * 100));
}
function setCompare(on) {
  if (on === cmp.on) return;
  if (on) {
    if (analysis.roomScore < 100) runFix();
    else if (!before) { toast('This room already scores 100. Load a scene with gaps to compare before and after.'); return; }
    cmp.on = true;
    buildBefore();
    swarmB.resetStats();
    $('cmp').hidden = false;
    document.body.classList.add('comparing');
    // sweep in from the right so the "before" room is revealed on camera
    const t0 = performance.now();
    cancelAnimationFrame(cmp.anim);
    const sweep = (now) => {
      const k = Math.min(1, (now - t0) / 1300);
      const e = 1 - Math.pow(1 - k, 3);
      setCmpX(0.98 + (0.5 - 0.98) * e);
      if (k < 1) cmp.anim = requestAnimationFrame(sweep);
    };
    setCmpX(0.98);
    cmp.anim = requestAnimationFrame(sweep);
  } else {
    cmp.on = false;
    cancelAnimationFrame(cmp.anim);
    $('cmp').hidden = true;
    document.body.classList.remove('comparing');
    clearBefore();
  }
  $('btn-compare').classList.toggle('on', cmp.on);
}
$('btn-compare').addEventListener('click', () => setCompare(!cmp.on));
(() => {
  const h = $('cmp-handle');
  const move = (e) => { const r = $('cmp').getBoundingClientRect(); cancelAnimationFrame(cmp.anim); setCmpX((e.clientX - r.left) / r.width); };
  h.addEventListener('pointerdown', (e) => { h.setPointerCapture(e.pointerId); h.classList.add('drag'); move(e); e.preventDefault(); });
  h.addEventListener('pointermove', (e) => { if (h.hasPointerCapture(e.pointerId)) move(e); });
  const end = (e) => { if (h.hasPointerCapture(e.pointerId)) h.releasePointerCapture(e.pointerId); h.classList.remove('drag'); };
  h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
  h.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { setCmpX(cmp.x - 0.05); e.preventDefault(); }
    if (e.key === 'ArrowRight') { setCmpX(cmp.x + 0.05); e.preventDefault(); }
    if (e.key === 'Escape') setCompare(false);
  });
})();

// ---------- toast + pulse ----------
let toastTimer = 0;
function toast(html, ms = 3200) {
  const t = $('toast');
  t.innerHTML = html; t.hidden = false;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); setTimeout(() => { t.hidden = true; }, 300); }, ms);
}
function pulse(el) { if (!el) return; el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }

// ---------- share link (room setup in the URL hash) ----------
const SHARE_KEYS = ['name', 'kind', 'length', 'width', 'top', 'sleepers', 'x', 'z', 'rot', 'net', 'tuck', 'hookMode', 'hook'];
const b64url = (str) => btoa(String.fromCharCode(...new TextEncoder().encode(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));
function encodeShare(withCard = false) {
  const d = {
    v: 1,
    r: [state.room.width, state.room.depth, state.room.ceiling],
    p: state.places.map((p) => SHARE_KEYS.map((k) => (k === 'hook' ? Math.round(p.hook) : p[k]))),
    m: state.places.map((p) => { const g = glbs.get(p.id); return g && g.file ? [g.file, g.name] : 0; }),
    s: Math.max(0, state.places.indexOf(sel())),
  };
  if (withCard) d.c = 1;
  return `#s=${b64url(JSON.stringify(d))}`;
}
function readShare() {
  const m = /[#&]s=([A-Za-z0-9_-]+)/.exec(location.hash);
  if (!m) return null;
  try {
    const d = JSON.parse(unb64url(m[1]));
    if (!d || d.v !== 1 || !Array.isArray(d.r) || !Array.isArray(d.p) || !d.p.length) return null;
    return d;
  } catch (e) { return null; }
}
function applyShare(d) {
  const n = (v, lo, hi, def) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : def);
  const room = { width: n(d.r[0], 150, 1000, 340), depth: n(d.r[1], 150, 1000, 320), ceiling: n(d.r[2], 180, 500, 270) };
  const places = d.p.slice(0, 8).map((a) => {
    const o = Object.fromEntries(SHARE_KEYS.map((k, i) => [k, a[i]]));
    return place({
      name: String(o.name || 'Sleeping place').slice(0, 24),
      kind: ['bed', 'floor', 'crib'].includes(o.kind) ? o.kind : 'bed',
      length: n(o.length, 50, 260, 190), width: n(o.width, 40, 260, 135), top: n(o.top, 5, 120, 45),
      sleepers: Math.round(n(o.sleepers, 0, 4, 1)), x: n(o.x, 0, room.width, room.width / 2), z: n(o.z, 0, room.depth, room.depth / 2),
      rot: +o.rot === 90 ? 90 : 0, net: NETS[o.net] ? o.net : 'none', tuck: o.tuck === 'floor' ? 'floor' : 'mattress',
      hookMode: o.hookMode === 'manual' ? 'manual' : 'auto', hook: n(o.hook, 80, 500, 180),
    });
  });
  setCompare(false); before = null;
  state.preset = null;
  state.room = room; state.places = places;
  state.selected = (places[d.s] || places[0]).id;
  glbs.clear(); buildRoom(); recompute({ drop: true }); swarm.resetStats();
  document.querySelectorAll('#presets [data-preset]').forEach((b) => b.classList.remove('sel'));
  (Array.isArray(d.m) ? d.m : []).forEach((mm, i) => {
    if (!Array.isArray(mm) || !places[i] || !/^[\w.-]+\.glb$/.test(mm[0])) return;
    loadGLB(`assets/models/${mm[0]}`, String(mm[1] || mm[0]).slice(0, 60), places[i]);
  });
  toast('Opened a shared room. Scores are <b>a first estimate</b> from the sizes in the link.');
}
window.addEventListener('hashchange', () => { const d = readShare(); if (d) { applyShare(d); frameCamera(); if (d.c) setTimeout(openCard, 400); } });
async function copyLink(withCard = false) {
  const url = `${location.href.split('#')[0]}${encodeShare(withCard)}`;
  history.replaceState(null, '', url);
  let ok = false;
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(url); ok = true; } } catch (e) { ok = false; }
  if (ok) toast(`🔗 <b>Link copied.</b> Whoever opens it sees this room${withCard ? ' and its size card' : ''}.`);
  else {
    toast(`<b>Copy this link:</b><input id="share-url" readonly value="${escapeHtml(url)}">`, 9000);
    const i = $('share-url'); if (i) { i.focus(); i.select(); }
  }
}
$('btn-share').addEventListener('click', () => copyLink(false));
$('btn-share-card').addEventListener('click', () => copyLink(true));

// ---------- onboarding: 3-step first-view hint ----------
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
let onboardDone = CLEAN || store.get('ngn-onboarded') === '1';
function showOnboard() { if (!onboardDone) { $('onboard').hidden = false; requestAnimationFrame(() => $('onboard').classList.add('show')); } }
function hideOnboard() {
  onboardDone = true; store.set('ngn-onboarded', '1');
  const el = $('onboard'); el.classList.remove('show'); setTimeout(() => { el.hidden = true; }, 350);
}
function onboardStep(n) {
  if (onboardDone) return;
  document.querySelectorAll('#onboard li').forEach((li) => {
    const k = +li.dataset.step;
    if (k <= n) li.classList.add('done');
    li.classList.toggle('now', k === n + 1);
  });
  if (n >= 3) setTimeout(hideOnboard, 3500);
}
$('onboard-x').addEventListener('click', hideOnboard);

// ---------- Photo -> Lux3D -> Net journey card (driven by assets/models/manifest.json) ----------
function journeyScores(m) {
  let room, places;
  if (m.journey.scene && PRESETS[m.journey.scene]) ({ room, places } = PRESETS[m.journey.scene]());
  else { room = { width: 340, depth: 320, ceiling: 270 }; places = [place({ kind: m.kind || 'bed', length: m.length || 190, width: m.width || 135, top: m.top || 45, sleepers: 1, x: 170, z: 150, net: 'none' })]; }
  const b = analyzeRoom(room, places);
  fixPlaces(room, places, b.results);
  const a = analyzeRoom(room, places);
  return { before: b.roomScore, after: a.roomScore, net: NETS[places[0].net]?.label };
}
let journeyIdx = 0;
function renderJourney() {
  const list = manifest.filter((m) => m.journey);
  const box = $('journey-body');
  if (!list.length) { box.innerHTML = '<p class="hint">No journeys listed in assets/models/manifest.json yet.</p>'; return; }
  journeyIdx = Math.min(journeyIdx, list.length - 1);
  const m = list[journeyIdx], j = m.journey;
  const sc = journeyScores(m);
  const tabs = list.length > 1 ? `<div class="row wrap jr-tabs">${list.map((x, i) => `<button class="chip ${i === journeyIdx ? 'sel' : ''}" data-j="${i}">${escapeHtml(x.journey.title || x.name)}</button>`).join('')}</div>` : '';
  box.innerHTML = `${tabs}
    <div class="jr">
      <figure><div class="jr-img photo"><img src="${escapeHtml(j.photo)}" alt="Phone photo of the real sleeping place"></div>
        <figcaption><span class="n">1</span><b>Your photo</b><span>One phone photo of the real place you sleep</span></figcaption></figure>
      <div class="jr-arrow" aria-hidden="true">→</div>
      <figure><div class="jr-img lux"><img src="${escapeHtml(j.lux3d)}" alt="The 3D model Aholo Lux3D generated from the photo"><span class="jr-credit">Generated with Aholo Lux3D</span></div>
        <figcaption><span class="n">2</span><b>Aholo Lux3D model</b><span>${j.lux3dNote ? escapeHtml(j.lux3dNote) : `“${escapeHtml(m.sourceName || m.name)}”, a GLB from one photo`}</span></figcaption></figure>
      <div class="jr-arrow" aria-hidden="true">→</div>
      <figure><div class="jr-img"><img src="${escapeHtml(j.result)}" alt="The model in No Gap Night with the net draped over it"><span class="jr-score"><b class="lvl-${lvlOf(sc.before)}">${sc.before}</b> → <b class="lvl-${lvlOf(sc.after)}">${sc.after}</b></span></div>
        <figcaption><span class="n">3</span><b>Net check</b><span>Red gaps found, then fixed with ${escapeHtml(sc.net || 'a standard net')}</span></figcaption></figure>
    </div>
    <div class="row wrap jr-foot"><button class="chip primary" id="jr-open">Open this in 3D</button>
      <span class="hint">Sizes are a rough estimate (${m.width} × ${m.length} cm), so the score is a first estimate. Model: <a href="https://3d.aholo.ai/lux3d/home" target="_blank" rel="noopener">Aholo Lux3D</a>.</span></div>`;
}
$('journey-body').addEventListener('click', (e) => {
  const t = e.target.closest('[data-j]');
  if (t) { journeyIdx = +t.dataset.j; renderJourney(); return; }
  if (e.target.closest('#jr-open')) {
    const m = manifest.filter((x) => x.journey)[journeyIdx];
    $('journey-dialog').close();
    if (m.journey.scene && PRESETS[m.journey.scene]) loadPreset(m.journey.scene);
    else { const p = sel(); Object.assign(p, { kind: m.kind || p.kind, length: m.length || p.length, width: m.width || p.width, top: m.top || p.top }); loadGLB(`assets/models/${m.file}`, m.name || m.file, p); }
  }
});
function openJourney() {
  const list = manifest.filter((m) => m.journey);
  const cur = list.findIndex((m) => m.journey.scene === state.preset);
  if (cur >= 0) journeyIdx = cur;
  renderJourney();
  $('journey-dialog').showModal();
}
document.querySelectorAll('.btn-journey').forEach((b) => b.addEventListener('click', openJourney));
$('btn-close-journey').addEventListener('click', () => $('journey-dialog').close());

buildRoom();
resize();
const shared = readShare();
if (shared) applyShare(shared);
else {
  recompute({ drop: true });
  document.querySelector(`#presets [data-preset=${HERO}]`)?.classList.add('sel');
  const m = PRESETS[HERO]().model;
  loadGLB(`assets/models/${m.file}`, m.name, state.places[0]);
}
// title intro: start wide and high, then glide in
if (CLEAN) frameCamera(true);
else {
  const far = framePose(1.7); far.pos.y += 1.5;
  camera.position.copy(far.pos); controls.target.copy(far.target); controls.update();
  const { pos, target } = framePose();
  setTimeout(() => flyTo(pos, target, 2.4), 250);
}
setOrbit(true);
requestAnimationFrame(tick);
setTimeout(() => $('loading').classList.add('done'), CLEAN ? 300 : 2300);
setTimeout(() => { $('loading').hidden = true; showOnboard(); }, CLEAN ? 1000 : 3000);
if (isMobile) { $('panel').classList.add('collapsed'); document.body.classList.add('panel-collapsed'); }
if (shared && shared.c) setTimeout(openCard, CLEAN ? 600 : 3100);

// handy for tests / debugging
window.__ngn = { state, get analysis() { return analysis; }, recompute, loadPreset, placeObjs, scene, camera, controls, glbs, setCompare, cmp, encodeShare, get before() { return before; } };
