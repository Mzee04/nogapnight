// Parametric net drape (geometric, not cloth physics) + gap visuals. Units: metres in the scene.
import * as THREE from 'three';

const SEG_U = 144, SEG_V = 30, ROOF = 18;

let meshTex = null;
function netTexture() {
  if (meshTex) return meshTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#ffffff'; g.lineWidth = 7;
  g.beginPath();
  g.moveTo(0, 32); g.lineTo(32, 0); g.lineTo(64, 32); g.lineTo(32, 64); g.closePath();
  g.stroke();
  meshTex = new THREE.CanvasTexture(c);
  meshTex.wrapS = meshTex.wrapT = THREE.RepeatWrapping;
  meshTex.anisotropy = 4;
  return meshTex;
}

function rectAt(theta, hx, hz) {
  const c = Math.cos(theta), s = Math.sin(theta);
  const t = Math.min(hx / Math.max(1e-6, Math.abs(c)), hz / Math.max(1e-6, Math.abs(s)));
  return [c * t, s * t];
}

const easeOutBounce = (x) => {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
};
const smooth = (x) => x * x * (3 - 2 * x);

// p: place (cm), a: analysis result (cm), color: net colour
export function createNet(p, a, color = 0xe6efff) {
  const net = a.net;
  const group = new THREE.Group();
  const cm = (v) => v / 100;
  const hookY = cm(a.hook);
  const halfMW = cm(p.width) / 2, halfML = cm(p.length) / 2, topY = cm(p.top);
  const inMattress = (x, z) => Math.abs(x) <= halfMW + 1e-4 && Math.abs(z) <= halfML + 1e-4;

  // top path + bottom path, sampled by angle
  const tops = [], bots = [], botY = [];
  const tucked = a.band <= 0 && !a.uncovered && p.tuck !== 'floor';
  const hemDisp = a.band > 0 ? cm(a.hemY) : tucked ? topY - 0.02 : Math.max(0.005, cm(a.hemY));
  for (let i = 0; i <= SEG_U; i++) {
    const th = (i / SEG_U) * Math.PI * 2 + Math.PI / 4;
    let t;
    if (net.type === 'rect') t = rectAt(th, cm(net.w) / 2, cm(net.l) / 2);
    else t = [Math.cos(th) * cm(net.ring) / 2, Math.sin(th) * cm(net.ring) / 2];
    let b;
    if (tucked) b = rectAt(th, halfMW + 0.015, halfML + 0.015);
    else if (a.footprint.type === 'rect') b = rectAt(th, cm(a.footprint.hx), cm(a.footprint.hz));
    else b = [Math.cos(th) * cm(a.footprint.r), Math.sin(th) * cm(a.footprint.r)];
    tops.push(t); bots.push(b);
    botY.push(inMattress(b[0], b[1]) && !tucked ? Math.max(hemDisp, topY + 0.01) : hemDisp);
  }
  const foldCount = net.type === 'rect' ? 30 : 40;
  let foldAmp = 0.012;
  if (net.type === 'cone') {
    const used = 2 * Math.PI * cm(a.footprint.r);
    foldAmp = Math.min(0.09, Math.max(0.015, (cm(net.circ) - used) / (foldCount * 5)));
  }

  // walls
  const wallGeo = new THREE.BufferGeometry();
  const nW = (SEG_U + 1) * (SEG_V + 1);
  const wpos = new Float32Array(nW * 3), wuv = new Float32Array(nW * 2);
  const idx = [];
  const perim = net.type === 'rect' ? 2 * (cm(net.w) + cm(net.l)) : cm(net.circ);
  const tile = 0.06;
  for (let i = 0; i <= SEG_U; i++) for (let j = 0; j <= SEG_V; j++) {
    const k = i * (SEG_V + 1) + j;
    wuv[k * 2] = (i / SEG_U) * perim / tile;
    wuv[k * 2 + 1] = (j / SEG_V) * cm(net.h) / tile;
  }
  for (let i = 0; i < SEG_U; i++) for (let j = 0; j < SEG_V; j++) {
    const a0 = i * (SEG_V + 1) + j, b0 = (i + 1) * (SEG_V + 1) + j;
    idx.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1);
  }
  wallGeo.setAttribute('position', new THREE.BufferAttribute(wpos, 3));
  wallGeo.setAttribute('uv', new THREE.BufferAttribute(wuv, 2));
  wallGeo.setIndex(idx);

  // roof
  let roofGeo = null, rpos = null;
  if (net.type === 'rect') {
    roofGeo = new THREE.PlaneGeometry(cm(net.w), cm(net.l), ROOF, ROOF);
    roofGeo.rotateX(-Math.PI / 2);
    const uv = roofGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * cm(net.w) / tile, uv.getY(i) * cm(net.l) / tile);
    rpos = roofGeo.attributes.position;
    roofGeo.userData.base = Float32Array.from(rpos.array);
  }

  const tex = netTexture();
  const lace = new THREE.MeshStandardMaterial({
    color, emissive: 0x3a5288, emissiveIntensity: 0.7, roughness: 1, alphaMap: tex,
    transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false,
  });
  const veil = new THREE.MeshStandardMaterial({
    color, emissive: 0x24345e, emissiveIntensity: 0.6, roughness: 1,
    transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false,
  });
  const walls = new THREE.Group();
  walls.add(new THREE.Mesh(wallGeo, lace), new THREE.Mesh(wallGeo, veil));
  walls.children.forEach((m) => { m.renderOrder = 2; m.frustumCulled = false; });
  group.add(walls);
  if (roofGeo) {
    const roof = new THREE.Group();
    roof.add(new THREE.Mesh(roofGeo, lace), new THREE.Mesh(roofGeo, veil));
    roof.children.forEach((m) => { m.renderOrder = 2; });
    group.add(roof);
  } else {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(cm(net.ring) / 2, 0.008, 8, 48),
      new THREE.MeshStandardMaterial({ color: 0xd8c39a, emissive: 0x332211 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = hookY;
    group.add(ring);
    const cap = new THREE.Mesh(new THREE.CircleGeometry(cm(net.ring) / 2, 32), veil);
    cap.rotation.x = -Math.PI / 2; cap.position.y = hookY;
    group.add(cap);
  }

  // hem binding line
  const hemGeo = new THREE.BufferGeometry();
  const hpos = new Float32Array((SEG_U + 1) * 3);
  hemGeo.setAttribute('position', new THREE.BufferAttribute(hpos, 3));
  const hem = new THREE.Line(hemGeo, new THREE.LineBasicMaterial({ color: 0xbfd4ff, transparent: true, opacity: 0.9 }));
  group.add(hem);

  let dropT = 1; // 0..1 animation progress
  const DROP_DUR = 1.6;
  function update(time, dt) {
    if (dropT < 1) dropT = Math.min(1, dropT + dt / DROP_DUR);
    const eY = easeOutBounce(dropT), eX = smooth(dropT);
    for (let i = 0; i <= SEG_U; i++) {
      const [tx, tz] = tops[i], [bx0, bz0] = bots[i];
      const bx = tx + (bx0 - tx) * eX, bz = tz + (bz0 - tz) * eX;
      const by = hookY + (botY[i] - hookY) * eY;
      const u = i / SEG_U;
      const fold = Math.sin(u * foldCount * Math.PI * 2) * foldAmp + Math.sin(u * 7 * Math.PI * 2 + 1.3) * foldAmp * 0.4;
      for (let j = 0; j <= SEG_V; j++) {
        const v = j / SEG_V;
        let x = tx + (bx - tx) * v, z = tz + (bz - tz) * v;
        const y = hookY + (by - hookY) * v;
        const len = Math.hypot(x, z) || 1;
        const breeze = Math.sin(time * 1.1 + u * 9 + v * 2) * 0.006 * v;
        const bulge = Math.sin(Math.PI * v) * 0.025 * eX;
        const off = fold * v * eX + breeze + bulge;
        x += (x / len) * off; z += (z / len) * off;
        const k = (i * (SEG_V + 1) + j) * 3;
        wpos[k] = x; wpos[k + 1] = y; wpos[k + 2] = z;
        if (j === SEG_V) { hpos[i * 3] = x; hpos[i * 3 + 1] = y + 0.002; hpos[i * 3 + 2] = z; }
      }
    }
    wallGeo.attributes.position.needsUpdate = true;
    wallGeo.computeVertexNormals();
    hemGeo.attributes.position.needsUpdate = true;
    if (roofGeo) {
      const base = roofGeo.userData.base;
      const hw = cm(net.w) / 2, hl = cm(net.l) / 2;
      for (let i = 0; i < rpos.count; i++) {
        const x = base[i * 3], z = base[i * 3 + 2];
        const sag = (1 - (x / hw) ** 2) * (1 - (z / hl) ** 2) * (0.05 + 0.006 * Math.sin(time * 0.9));
        rpos.setXYZ(i, x, hookY - sag, z);
      }
      rpos.needsUpdate = true;
    }
  }
  function drop() { dropT = 0; }
  update(0, 0);
  return { group, update, drop, dispose: () => { wallGeo.dispose(); hemGeo.dispose(); roofGeo && roofGeo.dispose(); lace.dispose(); veil.dispose(); } };
}

// Red glowing curtain where the hem stops short of the tuck line.
const bandVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const bandFrag = `uniform float uTime; varying vec2 vUv;
void main(){
  float pulse = 0.75 + 0.25 * sin(uTime * 3.2);
  float edge = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
  float stripes = 0.65 + 0.35 * sin((vUv.x * 160.0) - uTime * 4.0);
  gl_FragColor = vec4(1.0, 0.08, 0.16, clamp((0.5 + 0.5 * edge) * pulse * stripes, 0.0, 0.95));
}`;

export function createGapBand(p, a) {
  if (!(a.band > 0)) return null;
  const cm = (v) => v / 100;
  const halfMW = cm(p.width) / 2, halfML = cm(p.length) / 2;
  const N = 128;
  const pos = new Float32Array((N + 1) * 6), uv = new Float32Array((N + 1) * 4), idx = [];
  const hemY = cm(a.hemY);
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * Math.PI * 2 + Math.PI / 4;
    let x, z;
    if (a.footprint.type === 'rect') [x, z] = rectAt(th, cm(a.footprint.hx) + 0.02, cm(a.footprint.hz) + 0.02);
    else { x = Math.cos(th) * (cm(a.footprint.r) + 0.02); z = Math.sin(th) * (cm(a.footprint.r) + 0.02); }
    const inside = Math.abs(x) <= halfMW && Math.abs(z) <= halfML;
    const low = p.tuck === 'floor' && !inside ? 0.0 : cm(a.tuckY);
    const lowY = Math.min(low, hemY - 0.01);
    pos.set([x, hemY, z, x, lowY, z], i * 6);
    uv.set([i / N, 1, i / N, 0], i * 4);
    if (i < N) { const a0 = i * 2; idx.push(a0, a0 + 2, a0 + 1, a0 + 1, a0 + 2, a0 + 3); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } }, vertexShader: bandVert, fragmentShader: bandFrag,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 3;
  return mesh;
}

// Red glow on the parts of the mattress top that sit outside the net.
const ovVert = `varying vec2 vL; void main(){ vL = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const ovFrag = `uniform float uTime; uniform int uMode; uniform vec2 uHalf; uniform float uR; uniform vec2 uSize; varying vec2 vL;
void main(){
  float outside = 1.0;
  if (uMode == 1) { vec2 d = abs(vL) - uHalf; outside = step(0.0, max(d.x, d.y)); }
  if (uMode == 2) { outside = step(uR, length(vL)); }
  if (outside < 0.5) discard;
  vec2 e = uSize * 0.5 - abs(vL);
  float rim = 1.0 - smoothstep(0.0, 0.08, min(e.x, e.y));
  float pulse = 0.75 + 0.25 * sin(uTime * 3.0);
  gl_FragColor = vec4(1.0, 0.06, 0.14, clamp((0.6 + 0.4 * rim) * pulse, 0.0, 0.95));
}`;

const volVert = `uniform float uH; varying float vY; void main(){ vY = position.y / uH + 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const volFrag = `uniform float uTime; varying float vY;
void main(){
  float pulse = 0.8 + 0.2 * sin(uTime * 3.0);
  float a = mix(0.85, 0.05, smoothstep(0.0, 1.0, vY));
  gl_FragColor = vec4(1.0, 0.08, 0.16, a * pulse);
}`;

export function createUncoveredOverlay(p, a) {
  if (!a.uncovered) return null;
  const cm = (v) => v / 100;
  const W = cm(p.width), L = cm(p.length), top = cm(p.top);
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(W, L);
  let mode = 0, half = new THREE.Vector2(), R = 0;
  if (a.footprint && a.footprint.type === 'rect') { mode = 1; half.set(cm(a.footprint.hx), cm(a.footprint.hz)); }
  if (a.footprint && a.footprint.type === 'circle') { mode = 2; R = cm(a.footprint.r); }
  const time = { value: 0 };
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: time, uMode: { value: mode }, uHalf: { value: half }, uR: { value: R }, uSize: { value: new THREE.Vector2(W, L) } },
    vertexShader: ovVert, fragmentShader: ovFrag, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = top + 0.012;
  m.renderOrder = 3;
  group.add(m);
  // glowing "open air" volumes over the exposed parts, so gaps read even at low resolution
  const H = mode === 0 ? 0.5 : 0.4;
  const vmat = new THREE.ShaderMaterial({
    uniforms: { uTime: time, uH: { value: H } }, vertexShader: volVert, fragmentShader: volFrag,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
  const boxes = [];
  if (mode === 0) boxes.push([0, 0, W, L]);
  if (mode === 1) {
    const sx = W / 2 - half.x, sz = L / 2 - half.y;
    if (sx > 0.01) { boxes.push([-(half.x + sx / 2), 0, sx, L], [half.x + sx / 2, 0, sx, L]); }
    if (sz > 0.01) { boxes.push([0, -(half.y + sz / 2), Math.min(W, half.x * 2), sz], [0, half.y + sz / 2, Math.min(W, half.x * 2), sz]); }
  }
  if (mode === 2) {
    const s = Math.min(W / 2, L / 2, Math.max(0.04, (Math.hypot(W / 2, L / 2) - R) * 1.1));
    for (const ix of [-1, 1]) for (const iz of [-1, 1]) boxes.push([ix * (W / 2 - s / 2), iz * (L / 2 - s / 2), s, s]);
  }
  for (const [x, z, bw, bl] of boxes) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(bw, H, bl), vmat);
    b.position.set(x, top + H / 2 + 0.01, z);
    b.renderOrder = 4;
    group.add(b);
  }
  group.userData.time = time;
  return group;
}

// Wooden frame rails / ceiling cords / hook markers.
export function createRigging(p, a, ceilingCm) {
  const g = new THREE.Group();
  const cm = (v) => v / 100;
  const y = cm(a.hook), ceil = cm(ceilingCm);
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc35a, emissive: 0xff9a1a, emissiveIntensity: 1.2 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.7 });
  const cord = new THREE.LineBasicMaterial({ color: 0xcfc6b0, transparent: true, opacity: 0.6 });
  const dot = new THREE.SphereGeometry(0.018, 12, 8);
  const pts = [];
  if (a.net.type === 'rect') {
    const hx = cm(a.net.w) / 2, hz = cm(a.net.l) / 2;
    pts.push([-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz], [-hx, 0], [hx, 0]);
    const rails = [[cm(a.net.l), hx, 0, true], [cm(a.net.l), -hx, 0, true], [cm(a.net.w), 0, hz, false], [cm(a.net.w), 0, -hz, false]];
    for (const [len, x, z, alongZ] of rails) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? 0.03 : len + 0.03, 0.03, alongZ ? len + 0.03 : 0.03), wood);
      r.position.set(x, y + 0.02, z);
      r.castShadow = true;
      g.add(r);
    }
  } else {
    pts.push([0, 0]);
  }
  pts.forEach(([x, z], i) => {
    const s = new THREE.Mesh(dot, gold);
    s.position.set(x, y + 0.02, z);
    g.add(s);
    if (i < 4 || a.net.type === 'cone') {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y + 0.02, z), new THREE.Vector3(x, ceil, z)]);
      g.add(new THREE.Line(geo, cord));
    }
  });
  return g;
}

// Sample points for mosquitoes (local space of the place group, metres).
export function gapTargets(p, a, n = 24) {
  const cm = (v) => v / 100;
  const out = [];
  const W = cm(p.width), L = cm(p.length), top = cm(p.top);
  if (a.net.type === 'none') {
    for (let i = 0; i < n; i++) out.push([(Math.random() - 0.5) * W, top + 0.1 + Math.random() * 0.2, (Math.random() - 0.5) * L]);
    return out;
  }
  if (a.band > 0) {
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2;
      let x, z;
      if (a.footprint.type === 'rect') [x, z] = rectAt(th, cm(a.footprint.hx), cm(a.footprint.hz));
      else { x = Math.cos(th) * cm(a.footprint.r); z = Math.sin(th) * cm(a.footprint.r); }
      const lo = p.tuck === 'floor' ? 0.03 : top;
      const hi = cm(a.hemY);
      out.push([x, lo + Math.random() * Math.max(0.02, hi - lo), z]);
    }
  }
  if (a.uncovered && a.footprint) {
    let tries = 0;
    while (out.length < n * 2 && tries++ < 400) {
      const x = (Math.random() - 0.5) * W, z = (Math.random() - 0.5) * L;
      const inside = a.footprint.type === 'rect'
        ? Math.abs(x) < cm(a.footprint.hx) && Math.abs(z) < cm(a.footprint.hz)
        : Math.hypot(x, z) < cm(a.footprint.r);
      if (!inside) out.push([x, top + 0.06 + Math.random() * 0.12, z]);
    }
  }
  return out;
}

export function netTargets(p, a, n = 16) {
  const cm = (v) => v / 100;
  if (a.net.type === 'none') return [];
  const out = [];
  for (let i = 0; i < n; i++) {
    const th = Math.random() * Math.PI * 2, v = 0.25 + Math.random() * 0.6;
    let t, b;
    if (a.net.type === 'rect') t = rectAt(th, cm(a.net.w) / 2, cm(a.net.l) / 2);
    else t = [Math.cos(th) * cm(a.net.ring) / 2, Math.sin(th) * cm(a.net.ring) / 2];
    if (a.footprint.type === 'rect') b = rectAt(th, cm(a.footprint.hx), cm(a.footprint.hz));
    else b = [Math.cos(th) * cm(a.footprint.r), Math.sin(th) * cm(a.footprint.r)];
    const x = t[0] + (b[0] - t[0]) * v, z = t[1] + (b[1] - t[1]) * v;
    const lowY = Math.max(cm(a.hemY), 0);
    const y = cm(a.hook) + (lowY - cm(a.hook)) * v;
    const len = Math.hypot(x, z) || 1;
    out.push([x + (x / len) * 0.07, y, z + (z / len) * 0.07]);
  }
  return out;
}
