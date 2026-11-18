// Procedural stand-in models (used until a real Lux3D GLB is loaded). Units: metres.
// Local frame: origin on the floor under the mattress centre, length along Z (head at -Z), width along X.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const M = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts });
const mats = {
  mattress: M(0xf1ead9),
  ticking: M(0x7fa3c9),
  wood: M(0x8a5a36, { roughness: 0.7 }),
  woodLight: M(0xc79a6a, { roughness: 0.7 }),
  pillow: M(0xfffaf0),
  wrapperA: M(0xe2683c), // ankara-style wrapper colours
  wrapperB: M(0x2f8f83),
  wrapperC: M(0xf2b134),
  mat: M(0x9b7b4a, { roughness: 1 }),
};

function shadowed(obj) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return obj;
}

function mattressMesh(L, W, T, y) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(W, T, L, 3, Math.min(0.04, T / 3)), mats.mattress);
  body.position.y = y + T / 2;
  g.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(W + 0.004, T * 0.25, L + 0.004), mats.ticking);
  stripe.position.y = y + T * 0.5;
  g.add(stripe);
  return g;
}

export function addSleepers(group, L, W, topY, n) {
  const wrappers = [mats.wrapperA, mats.wrapperB, mats.wrapperC];
  const count = Math.max(0, Math.min(4, n));
  const slot = W / Math.max(1, count);
  for (let i = 0; i < count; i++) {
    const x = -W / 2 + slot * (i + 0.5);
    const pw = Math.min(0.5, slot * 0.8);
    const pillow = new THREE.Mesh(new RoundedBoxGeometry(pw, 0.1, 0.32, 3, 0.04), mats.pillow);
    pillow.position.set(x, topY + 0.05, -L / 2 + 0.25);
    group.add(pillow);
    // a cosy wrapper lump instead of a human figure
    const lump = new THREE.Mesh(new RoundedBoxGeometry(Math.min(0.48, slot * 0.82), 0.16, L * 0.62, 4, 0.07), wrappers[i % 3]);
    lump.position.set(x, topY + 0.08, L * 0.08);
    lump.scale.y = 0.9 + 0.2 * Math.random();
    group.add(lump);
  }
}

export function buildBed(p) {
  const L = p.length / 100, W = p.width / 100, top = p.top / 100;
  const T = Math.min(0.25, Math.max(0.12, top * 0.4));
  const g = new THREE.Group();
  const baseTop = top - T;
  const frame = new THREE.Mesh(new RoundedBoxGeometry(W + 0.08, 0.12, L + 0.08, 2, 0.02), mats.wood);
  frame.position.y = baseTop - 0.06;
  g.add(frame);
  const legH = Math.max(0.05, baseTop - 0.12);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, legH, 0.07), mats.wood);
    leg.position.set(sx * (W / 2 + 0.0), legH / 2, sz * (L / 2 + 0.0));
    g.add(leg);
  }
  const head = new THREE.Mesh(new RoundedBoxGeometry(W + 0.1, 0.55, 0.06, 2, 0.02), mats.wood);
  head.position.set(0, baseTop + 0.2, -L / 2 - 0.06);
  g.add(head);
  g.add(mattressMesh(L, W, T, baseTop));
  return shadowed(g);
}

export function buildFloor(p) {
  const L = p.length / 100, W = p.width / 100, top = p.top / 100;
  const g = new THREE.Group();
  const mat = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.01, L + 0.3), mats.mat);
  mat.position.y = 0.005;
  g.add(mat);
  g.add(mattressMesh(L, W, Math.max(0.05, top - 0.01), 0.01));
  return shadowed(g);
}

export function buildCrib(p) {
  const L = p.length / 100, W = p.width / 100, top = p.top / 100;
  const g = new THREE.Group();
  const T = 0.1;
  const railH = top + 0.45;
  const base = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, 0.04, L + 0.06), mats.woodLight);
  base.position.y = top - T - 0.02;
  g.add(base);
  g.add(mattressMesh(L, W, T, top - T));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, railH, 0.05), mats.woodLight);
    post.position.set(sx * (W / 2 + 0.03), railH / 2, sz * (L / 2 + 0.03));
    g.add(post);
  }
  const slatGeo = new THREE.CylinderGeometry(0.012, 0.012, railH - top + T, 6);
  const nL = Math.floor(L / 0.08), nW = Math.floor(W / 0.08);
  const slats = new THREE.InstancedMesh(slatGeo, mats.woodLight, 2 * (nL + nW));
  const m4 = new THREE.Matrix4();
  let k = 0;
  const yMid = (railH + top - T) / 2;
  for (let i = 0; i < nL; i++) for (const sx of [-1, 1]) {
    m4.makeTranslation(sx * (W / 2 + 0.03), yMid, -L / 2 + (i + 0.5) * (L / nL));
    slats.setMatrixAt(k++, m4);
  }
  for (let i = 0; i < nW; i++) for (const sz of [-1, 1]) {
    m4.makeTranslation(-W / 2 + (i + 0.5) * (W / nW), yMid, sz * (L / 2 + 0.03));
    slats.setMatrixAt(k++, m4);
  }
  g.add(slats);
  for (const sx of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, L + 0.1), mats.woodLight);
    rail.position.set(sx * (W / 2 + 0.03), railH, 0);
    g.add(rail);
  }
  for (const sz of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, 0.04, 0.04), mats.woodLight);
    rail.position.set(0, railH, sz * (L / 2 + 0.03));
    g.add(rail);
  }
  return shadowed(g);
}

export function buildPlaceholder(p) {
  if (p.kind === 'floor') return buildFloor(p);
  if (p.kind === 'crib') return buildCrib(p);
  return buildBed(p);
}

// Fit a loaded GLB scene to the typed mattress size: centre it, put it on the floor,
// turn its longest horizontal side along Z, scale the footprint to length × width and
// scale height by the average footprint factor (so proportions stay believable).
export function fitGLB(source, p) {
  const obj = source.clone(true);
  const wrap = new THREE.Group();
  wrap.add(obj);
  let box = new THREE.Box3().setFromObject(wrap);
  let size = box.getSize(new THREE.Vector3());
  if (size.x > size.z) { obj.rotation.y = Math.PI / 2; obj.updateMatrixWorld(true); }
  box = new THREE.Box3().setFromObject(wrap);
  size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  obj.position.x -= center.x; obj.position.z -= center.z; obj.position.y -= box.min.y;
  const sx = (p.width / 100) / Math.max(1e-6, size.x);
  const sz = (p.length / 100) / Math.max(1e-6, size.z);
  const sy = (sx + sz) / 2;
  wrap.scale.set(sx, sy, sz);
  const fitted = new THREE.Group();
  fitted.add(wrap);
  fitted.userData.heightCm = Math.round(size.y * sy * 100);
  return shadowed(fitted);
}
