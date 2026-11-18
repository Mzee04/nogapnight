// No Gap Night — pure geometry + scoring (no three.js here, so it can be unit-tested in Node).
// All inputs and outputs are in centimetres.

// Standard long-lasting insecticidal net (LLIN) presets.
// Sources (see README): WHO PQ labels (e.g. DCT Royal Guard, UNET G1, GreenNet),
// Draft East African Standard DEAS 455:2021 tables 5 and 6, SafeNet LLIN size table.
// Rectangular: l = long side, w = short side, h = wall height.
// Conical: circ = hem (bottom) circumference, ring = top ring diameter, h = height (slope).
export const NETS = {
  none:     { id: 'none', type: 'none', label: 'No net' },
  r100:     { id: 'r100', type: 'rect', l: 180, w: 100, h: 150, label: 'Rectangular 100×180×150 (single)' },
  r130:     { id: 'r130', type: 'rect', l: 180, w: 130, h: 150, label: 'Rectangular 130×180×150 (medium)' },
  r160:     { id: 'r160', type: 'rect', l: 180, w: 160, h: 150, label: 'Rectangular 160×180×150 (large)' },
  r190:     { id: 'r190', type: 'rect', l: 190, w: 180, h: 150, label: 'Rectangular 190×180×150 (family)' },
  r190h180: { id: 'r190h180', type: 'rect', l: 190, w: 180, h: 180, label: 'Rectangular 190×180×180 (tall family)' },
  r210:     { id: 'r210', type: 'rect', l: 210, w: 190, h: 180, label: 'Rectangular 210×190×180 (extra large)' },
  c850:     { id: 'c850', type: 'cone', circ: 850, ring: 56, h: 180, label: 'Conical 850 cm hem, 56 cm ring, 180 cm (single fitted)' },
  c1050:    { id: 'c1050', type: 'cone', circ: 1050, ring: 56, h: 220, label: 'Conical 1050 cm hem, 56 cm ring, 220 cm (double fitted)' },
  c1250:    { id: 'c1250', type: 'cone', circ: 1250, ring: 65, h: 250, label: 'Conical 1250 cm hem, 65 cm ring, 250 cm (extra double)' },
};

export const TUCK_ALLOWANCE = 15;   // cm of net that should go under the mattress edge
export const TIGHT_TOLERANCE = 5;   // a net up to 5 cm smaller can be stretched/tucked, but it will be tight

const r = (v) => Math.round(v);

// local (lx along width, lz along length) -> room coords, matching three.js rotation.y = +90°
export function toRoom(p, lx, lz) {
  if (p.rot === 90) return { x: p.x + lz, z: p.z - lx };
  return { x: p.x + lx, z: p.z + lz };
}

export function tuckLine(p) {
  return p.tuck === 'floor' ? 0 : Math.max(0, p.top - TUCK_ALLOWANCE);
}

function rectAuto(p, net) { return tuckLine(p) + net.h - 5; }

function coneReq(p) { return Math.hypot(p.length / 2, p.width / 2) + 3; }

function coneAuto(p, net) {
  const ringR = net.ring / 2, Rmax = net.circ / (2 * Math.PI), slant = net.h;
  const req = Math.min(coneReq(p), Rmax);
  const reach = Math.min(slant - 1, req - ringR);
  return tuckLine(p) + Math.sqrt(slant * slant - reach * reach) - 3;
}

export function autoHook(p) {
  const net = NETS[p.net];
  if (!net || net.type === 'none') return null;
  return net.type === 'rect' ? rectAuto(p, net) : coneAuto(p, net);
}

export function analyzePlace(p, room) {
  const net = NETS[p.net] || NETS.none;
  const tips = [];
  const res = {
    id: p.id, net, tips, band: 0, uncovered: false, tight: false,
    tuckY: tuckLine(p), tuckVisY: p.tuck === 'floor' ? 0 : p.top,
    footprint: null, hook: null, hemY: null, score: 0, level: 'bad', card: null,
  };
  const who = p.sleepers === 1 ? '1 person' : `${p.sleepers} people`;

  if (net.type === 'none') {
    res.score = p.sleepers > 0 ? 0 : 40;
    res.uncovered = true;
    tips.push(p.sleepers > 0
      ? `No net here: ${who} sleeping exposed all night.`
      : 'No net here. If anyone sleeps on this, they are exposed.');
    const s = suggestNet(p);
    if (s) tips.push(`A ${s.label} fits this ${r(p.length)}×${r(p.width)} cm mattress.`);
    res.level = 'bad';
    return res;
  }

  const ceilingMax = room.ceiling - 3;
  let hook = p.hookMode === 'manual' ? p.hook : autoHook(p);
  let clamped = false;
  if (hook > ceilingMax) { hook = ceilingMax; clamped = true; }
  res.hook = hook;
  res.autoHook = autoHook(p);
  let score = 100;

  if (net.type === 'rect') {
    const defW = p.width - net.w, defL = p.length - net.l;
    let hx = net.w / 2, hz = net.l / 2;
    if (defW > 0 && defW <= TIGHT_TOLERANCE) { res.tight = true; hx = p.width / 2; }
    if (defL > 0 && defL <= TIGHT_TOLERANCE) { res.tight = true; hz = p.length / 2; }
    if (defW > TIGHT_TOLERANCE || defL > TIGHT_TOLERANCE) res.uncovered = true;
    res.footprint = { type: 'rect', hx, hz };
    res.hemY = hook - net.h;
    const band = res.hemY - res.tuckY;
    if (band > 0) res.band = band;

    if (res.uncovered) {
      const worst = Math.max(defW, defL);
      score -= 30 + Math.min(40, worst);
      if (defW > TIGHT_TOLERANCE) tips.push(`The net is ${net.w} cm wide but the mattress is ${r(p.width)} cm. About ${r(defW / 2)} cm of mattress on each side sits outside the net.`);
      if (defL > TIGHT_TOLERANCE) tips.push(`The net is ${net.l} cm long but the mattress is ${r(p.length)} cm. The ends stick out by about ${r(defL / 2)} cm each.`);
      const s = suggestNet(p);
      if (s && s.id !== net.id) tips.push(`Try a ${s.label} instead.`);
    } else if (res.tight) {
      score -= 10;
      tips.push(`Tight fit: the net is a few cm smaller than the mattress (${net.l}×${net.w} vs ${r(p.length)}×${r(p.width)}). The walls will press on arms, and mosquitoes can bite through netting that touches skin.`);
    } else if ((net.w - p.width) / 2 < 3) {
      score -= 5;
      tips.push('The net walls sit right at the mattress edge. Keep arms and feet off the netting.');
    }
    if (hook - p.top < 60) { score -= 10; tips.push(`The net roof is only ${r(hook - p.top)} cm above the mattress, so it will sag onto faces. Hang it higher or use a taller net.`); }
  } else {
    const ringR = net.ring / 2, Rmax = net.circ / (2 * Math.PI), slant = net.h;
    const req = coneReq(p);
    const d = hook - res.tuckY;
    let R;
    if (d > slant) {
      res.band = d - slant;
      res.hemY = hook - slant;
      R = Math.min(Rmax, req);
    } else {
      res.hemY = res.tuckY;
      R = Math.min(Rmax, ringR + Math.sqrt(slant * slant - d * d));
    }
    res.footprint = { type: 'circle', r: R, rmax: Rmax, req };
    if (R < req - 3) {
      res.uncovered = true;
      const short = req - R;
      score -= 30 + Math.min(40, short);
      if (req > Rmax) tips.push(`This conical net is too small: its hem can only spread about ${r(Rmax * 2)} cm across, but the mattress corners need ${r(req * 2)} cm. Use a bigger conical net (1250 cm hem) or a rectangular net.`);
      else tips.push(`The ring hangs too low, so the hem can't spread to the mattress corners (it reaches ${r(R)} cm out, the corners need ${r(req)} cm). Raise the ring to about ${r(res.autoHook)} cm.`);
    }
    if (hook - p.top < 70) { score -= 10; tips.push(`The ring is only ${r(hook - p.top)} cm above the mattress, so the net will sag onto faces.`); }
  }

  if (res.band > 0) {
    score -= 25 + Math.min(45, res.band * 2);
    const target = p.tuck === 'floor' ? 'the floor' : 'the tuck line under the mattress';
    if (clamped && res.autoHook > ceilingMax) {
      tips.push(`Your ceiling (${r(room.ceiling)} cm) is too low for this net to reach ${target}. Use a shorter net or raise the mattress.`);
    } else {
      tips.push(`The hem stops ${r(res.band)} cm above ${target}. Lower the hooks to about ${r(res.autoHook)} cm (${r(res.autoHook - hook)} cm), or use a taller net.`);
    }
  }
  if (clamped && res.band <= 0) tips.push(`Hook height capped at the ceiling (${r(room.ceiling)} cm).`);
  if (p.sleepers > 0 && p.width / p.sleepers < 60) tips.push(`${who} on a ${r(p.width)} cm wide mattress is crowded. Someone will end up pressed against the net.`);

  res.score = Math.max(0, Math.min(100, Math.round(score)));
  res.level = res.score >= 85 ? 'good' : res.score >= 50 ? 'fix' : 'bad';
  res.card = buildCard(p, net, res, room);
  return res;
}

export function suggestNet(p) {
  const rects = ['r100', 'r130', 'r160', 'r190', 'r190h180', 'r210'].map((k) => NETS[k]);
  const fit = rects.find((n) => n.w >= p.width && n.l >= p.length);
  if (fit) return fit;
  const req = coneReq(p);
  return ['c850', 'c1050', 'c1250'].map((k) => NETS[k]).find((n) => n.circ / (2 * Math.PI) >= req) || null;
}

function buildCard(p, net, res, room) {
  const pts = [];
  const mk = (label, lx, lz, note) => {
    const q = toRoom(p, lx, lz);
    pts.push({ label, x: r(q.x), z: r(q.z), y: r(res.hook), note });
  };
  if (net.type === 'rect') {
    const hx = net.w / 2, hz = net.l / 2;
    mk('A', -hx, -hz, 'corner loop'); mk('B', hx, -hz, 'corner loop');
    mk('C', hx, hz, 'corner loop'); mk('D', -hx, hz, 'corner loop');
    mk('E', -hx, 0, 'optional, stops side sag'); mk('F', hx, 0, 'optional, stops side sag');
    return {
      type: 'rect', frameL: net.l, frameW: net.w, netWLH: [net.w, net.l, net.h], hook: r(res.hook), drop: r(room.ceiling - res.hook),
      posts: r(res.hook + 5), points: pts,
      cut: [`2 rails × ${net.l} cm`, `2 rails × ${net.w} cm`, `4 posts × ${r(res.hook + 5)} cm (only for a free-standing frame)`],
    };
  }
  mk('A', 0, 0, 'single hook, centre of the mattress');
  return { type: 'cone', ring: net.ring, hook: r(res.hook), drop: r(room.ceiling - res.hook), points: pts, cut: [`1 ceiling hook + ${r(room.ceiling - res.hook)} cm of cord to the ring`] };
}

function footprintAABB(p, res) {
  const fp = res.footprint;
  if (!fp) return null;
  let hx, hz;
  if (fp.type === 'rect') { hx = fp.hx; hz = fp.hz; } else { hx = hz = Math.min(fp.r, fp.rmax, fp.req); }
  if (p.rot === 90) [hx, hz] = [hz, hx];
  return { x0: p.x - hx, x1: p.x + hx, z0: p.z - hz, z1: p.z + hz };
}

export function analyzeRoom(room, places) {
  const results = places.map((p) => analyzePlace(p, room));
  const boxes = places.map((p, i) => footprintAABB(p, results[i]));
  for (let i = 0; i < places.length; i++) {
    const a = boxes[i];
    if (!a) continue;
    if (a.x0 < -2 || a.z0 < -2 || a.x1 > room.width + 2 || a.z1 > room.depth + 2) {
      results[i].tips.push('The net runs into a wall here. Move this mattress away from the wall so the net can hang straight down.');
      results[i].score = Math.max(0, results[i].score - 10);
    }
    for (let j = i + 1; j < places.length; j++) {
      const b = boxes[j];
      if (!b) continue;
      if (a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1) {
        results[i].tips.push(`This net overlaps the net over "${places[j].name}". Move them apart so neither hem gets pinned open.`);
        results[j].tips.push(`This net overlaps the net over "${places[i].name}". Move them apart so neither hem gets pinned open.`);
        results[i].score = Math.max(0, results[i].score - 10);
        results[j].score = Math.max(0, results[j].score - 10);
      }
    }
  }
  results.forEach((x, i) => {
    x.level = x.score >= 85 ? 'good' : x.score >= 50 ? 'fix' : 'bad';
    if (x.level === 'good' && x.net.type !== 'none') {
      const how = places[i].tuck === 'floor' ? 'Let the hem rest flat on the floor all the way round.' : 'Tuck the hem under the mattress all the way round before lights out.';
      x.tips.unshift(x.tips.length ? `Nearly sealed. Check the notes below. ${how}` : `Looks sealed. ${how}`);
    }
  });
  const roomScore = results.length ? Math.min(...results.map((x) => x.score)) : 0;
  return { results, roomScore };
}
