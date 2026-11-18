// Cartoon mosquito swarm: they wander the room, bonk off nets and sneak through gaps.
import * as THREE from 'three';

const vert = `attribute float aState; attribute float aPhase; uniform float uScale; uniform float uTime;
varying float vState; varying float vPhase;
void main(){
  vState = aState; vPhase = aPhase;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uScale * (aState > 1.5 ? 1.5 : 1.0) / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const frag = `uniform float uTime; varying float vState; varying float vPhase;
void main(){
  vec2 p = gl_PointCoord - 0.5;
  p.y = -p.y;
  float body = smoothstep(0.13, 0.08, length(vec2(p.x * 2.2, p.y + 0.05)));
  float flap = 0.5 + 0.5 * sin(uTime * 70.0 + vPhase * 10.0);
  vec2 wl = vec2(p.x + 0.16, p.y - 0.1 - 0.05 * flap);
  vec2 wr = vec2(p.x - 0.16, p.y - 0.1 - 0.05 * flap);
  float wings = smoothstep(0.15, 0.1, length(wl * vec2(1.0, 1.6))) + smoothstep(0.15, 0.1, length(wr * vec2(1.0, 1.6)));
  float glow = smoothstep(0.5, 0.0, length(p)) * 0.35;
  vec3 c = vec3(1.0, 0.78, 0.35);            // wandering: warm amber
  if (vState > 0.5 && vState < 1.5) c = vec3(0.6, 0.85, 1.0); // bonked: cool flash
  if (vState > 1.5) c = vec3(1.0, 0.25, 0.3);  // found a gap: red
  float a = max(body, wings * 0.55) + glow;
  if (a < 0.02) discard;
  vec3 col = mix(c, vec3(0.15, 0.1, 0.08), body * 0.6);
  gl_FragColor = vec4(col + glow * c, a);
}`;

export class Swarm {
  constructor(scene, count = 36) {
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.state = new Float32Array(count);
    const phase = new Float32Array(count).map(() => Math.random());
    this.m = Array.from({ length: count }, () => ({
      vel: new THREE.Vector3(), target: new THREE.Vector3(), mode: 'wander', timer: 0, kind: 'wander', flash: 0,
    }));
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aState', new THREE.BufferAttribute(this.state, 1));
    this.geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 60 } }, vertexShader: vert, fragmentShader: frag,
      transparent: true, depthWrite: false,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.bounds = { w: 4, d: 3.5, h: 2.6 };
    this.gaps = []; this.nets = [];
    this.stats = { sneak: 0, bonk: 0 };
    this.onStats = null;
    for (let i = 0; i < count; i++) { this._randomPoint(this.pos, i * 3); this._pick(i); }
  }
  setBounds(w, d, h) { this.bounds = { w, d, h }; }
  setTargets(gaps, nets) { this.gaps = gaps; this.nets = nets; for (let i = 0; i < this.count; i++) if (this.m[i].mode !== 'hover') this._pick(i); }
  setPixelScale(s) { this.mat.uniforms.uScale.value = s; }
  _randomPoint(arr, o) {
    const b = this.bounds;
    arr[o] = 0.2 + Math.random() * (b.w - 0.4);
    arr[o + 1] = 0.3 + Math.random() * (b.h - 0.6);
    arr[o + 2] = 0.2 + Math.random() * (b.d - 0.4);
  }
  _pick(i) {
    const m = this.m[i];
    const r = Math.random();
    if (this.gaps.length && r < 0.5) {
      const g = this.gaps[(Math.random() * this.gaps.length) | 0];
      m.target.copy(g); m.kind = 'gap';
    } else if (this.nets.length && r < 0.85) {
      const n = this.nets[(Math.random() * this.nets.length) | 0];
      m.target.copy(n); m.kind = 'net';
    } else {
      const t = [0, 0, 0]; this._randomPoint(t, 0); m.target.set(t[0], t[1], t[2]); m.kind = 'wander';
    }
    m.mode = 'fly';
  }
  update(dt, time) {
    this.mat.uniforms.uTime.value = time;
    const p = this.pos, tmp = new THREE.Vector3(), cur = new THREE.Vector3();
    let changed = false;
    for (let i = 0; i < this.count; i++) {
      const m = this.m[i], o = i * 3;
      cur.set(p[o], p[o + 1], p[o + 2]);
      if (m.flash > 0) m.flash -= dt;
      if (m.mode === 'hover') {
        m.timer -= dt;
        cur.x = m.target.x + Math.sin(time * 6 + i) * 0.03;
        cur.y = m.target.y + Math.sin(time * 9 + i * 2) * 0.02;
        cur.z = m.target.z + Math.cos(time * 7 + i) * 0.03;
        this.state[i] = 2;
        if (m.timer <= 0) { this._pick(i); m.kind = 'wander'; const t = [0, 0, 0]; this._randomPoint(t, 0); m.target.set(t[0], t[1], t[2]); }
      } else {
        tmp.subVectors(m.target, cur);
        const dist = tmp.length();
        const speed = m.kind === 'gap' ? 0.55 : 0.45;
        tmp.normalize().multiplyScalar(speed);
        const wig = Math.min(1, dist / 0.6) * 0.25;
        tmp.x += Math.sin(time * 5 + i * 1.7) * wig;
        tmp.y += Math.sin(time * 7 + i * 2.3) * wig * 0.8;
        tmp.z += Math.cos(time * 6 + i * 1.1) * wig;
        m.vel.lerp(tmp, Math.min(1, dt * 4));
        cur.addScaledVector(m.vel, dt);
        this.state[i] = m.flash > 0 ? 1 : 0;
        if (dist < 0.1) {
          if (m.kind === 'gap') { m.mode = 'hover'; m.timer = 1.5 + Math.random() * 2; this.stats.sneak++; changed = true; }
          else if (m.kind === 'net') {
            m.vel.multiplyScalar(-2.5); m.flash = 0.5; this.stats.bonk++; changed = true;
            const t = [0, 0, 0]; this._randomPoint(t, 0); m.target.set(t[0], t[1], t[2]); m.kind = 'wander';
          } else this._pick(i);
        }
      }
      const b = this.bounds;
      cur.x = Math.min(b.w - 0.05, Math.max(0.05, cur.x));
      cur.y = Math.min(b.h - 0.05, Math.max(0.05, cur.y));
      cur.z = Math.min(b.d - 0.05, Math.max(0.05, cur.z));
      p[o] = cur.x; p[o + 1] = cur.y; p[o + 2] = cur.z;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aState.needsUpdate = true;
    if (changed && this.onStats) this.onStats(this.stats);
  }
  resetStats() { this.stats = { sneak: 0, bonk: 0 }; this.onStats && this.onStats(this.stats); }
}
