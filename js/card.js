// Printable "carpenter card": frame sizes, hook height and hook positions measured from two walls.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function topView(room, places, results) {
  const W = 560, pad = 36;
  const s = (W - pad * 2) / Math.max(room.width, room.depth);
  const H = room.depth * s + pad * 2;
  const X = (x) => pad + x * s, Z = (z) => pad + z * s;
  let g = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="topview" font-family="system-ui, sans-serif">`;
  g += `<rect x="${X(0)}" y="${Z(0)}" width="${room.width * s}" height="${room.depth * s}" fill="#fff" stroke="#222" stroke-width="2"/>`;
  g += `<text x="${X(room.width / 2)}" y="${Z(0) - 10}" text-anchor="middle" font-size="12" font-weight="700">HEAD WALL</text>`;
  g += `<text x="${X(0) - 12}" y="${Z(room.depth / 2)}" text-anchor="middle" font-size="12" font-weight="700" transform="rotate(-90 ${X(0) - 12} ${Z(room.depth / 2)})">LEFT WALL</text>`;
  places.forEach((p, i) => {
    const a = results[i];
    const [mw, ml] = p.rot === 90 ? [p.length, p.width] : [p.width, p.length];
    g += `<rect x="${X(p.x - mw / 2)}" y="${Z(p.z - ml / 2)}" width="${mw * s}" height="${ml * s}" fill="#e9e3d4" stroke="#8a7a5a"/>`;
    g += `<text x="${X(p.x)}" y="${Z(p.z)}" text-anchor="middle" font-size="11" fill="#555">${esc(p.name)}</text>`;
    if (!a.card) return;
    if (a.card.type === 'rect') {
      const [fw, fl] = p.rot === 90 ? [a.net.l, a.net.w] : [a.net.w, a.net.l];
      g += `<rect x="${X(p.x - fw / 2)}" y="${Z(p.z - fl / 2)}" width="${fw * s}" height="${fl * s}" fill="none" stroke="#a0522d" stroke-width="2.5" stroke-dasharray="6 3"/>`;
    } else {
      g += `<circle cx="${X(p.x)}" cy="${Z(p.z)}" r="${a.footprint.r * s}" fill="none" stroke="#3a6ea5" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    }
    a.card.points.forEach((pt) => {
      g += `<circle cx="${X(pt.x)}" cy="${Z(pt.z)}" r="5" fill="#d98a00" stroke="#000"/>`;
      g += `<text x="${X(pt.x) + 7}" y="${Z(pt.z) - 6}" font-size="11" font-weight="700">${i + 1}${pt.label}</text>`;
    });
  });
  g += `<text x="${X(room.width)}" y="${Z(room.depth) + 22}" text-anchor="end" font-size="11">Room ${room.width} × ${room.depth} cm, ceiling ${room.ceiling} cm</text>`;
  return g + '</svg>';
}

function netWLH(n) {
  return n.type === 'rect' ? `${n.w} × ${n.l} × ${n.h} cm (W × L × H)` : `conical, ${n.circ} cm hem × ${n.ring} cm ring × ${n.h} cm H`;
}

export function cardText(room, places, results) {
  const L = ['HAND THIS TO YOUR CARPENTER', 'No Gap Night size card (a first estimate). All sizes in cm.',
    `Room ${room.width} x ${room.depth}, ceiling ${room.ceiling}. Measure from the LEFT WALL and the HEAD WALL; heights from the floor.`, ''];
  places.forEach((p, i) => {
    const a = results[i];
    L.push(`${i + 1}. ${p.name}: mattress ${p.length} x ${p.width}, top at ${p.top}`);
    if (!a.card) { L.push('   No net chosen yet.', ''); return; }
    L.push(`   Net: ${netWLH(a.net).replace(/×/g, 'x')}`);
    L.push(`   Hang height: ${a.card.hook}${a.card.drop > 0 ? `   Cord from ceiling: ${a.card.drop}` : ''}`);
    if (a.card.type === 'rect') L.push(`   Frame inside size (W x L): ${a.card.frameW} x ${a.card.frameL}`);
    L.push(`   Cut list: ${a.card.cut.join('; ')}`);
    L.push('   Tie points (from left wall / from head wall / height):');
    a.card.points.forEach((pt) => L.push(`     ${i + 1}${pt.label}: ${pt.x} / ${pt.z} / ${pt.y}  (${pt.note})`));
    L.push(`   Gap score: ${a.score}/100`);
    a.tips.forEach((t) => L.push(`   - ${t}`));
    L.push('');
  });
  L.push('Practical aid only, not a certified health device. Net sizes are standard LLIN presets; check your own net label.');
  return L.join('\n');
}

// Draws the card (plan + text) onto a canvas and returns a PNG data URL.
export function cardPNG(room, places, results) {
  const lines = cardText(room, places, results).split('\n');
  const W = 1100, lh = 26, pad = 40;
  const planH = 420;
  const c = document.createElement('canvas');
  c.width = W; c.height = pad * 2 + planH + 30 + lines.length * lh;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  // plan
  const s = Math.min((W - pad * 2 - 60) / room.width, (planH - 40) / room.depth);
  const ox = pad + 30, oz = pad + 30;
  g.strokeStyle = '#222'; g.lineWidth = 2; g.strokeRect(ox, oz, room.width * s, room.depth * s);
  g.fillStyle = '#111'; g.font = 'bold 15px sans-serif';
  g.fillText('HEAD WALL', ox + room.width * s / 2 - 40, oz - 10);
  g.save(); g.translate(ox - 12, oz + room.depth * s / 2 + 40); g.rotate(-Math.PI / 2); g.fillText('LEFT WALL', 0, 0); g.restore();
  places.forEach((p, i) => {
    const a = results[i];
    const [mw, ml] = p.rot === 90 ? [p.length, p.width] : [p.width, p.length];
    g.fillStyle = '#e9e3d4'; g.strokeStyle = '#8a7a5a'; g.lineWidth = 1;
    g.fillRect(ox + (p.x - mw / 2) * s, oz + (p.z - ml / 2) * s, mw * s, ml * s);
    g.strokeRect(ox + (p.x - mw / 2) * s, oz + (p.z - ml / 2) * s, mw * s, ml * s);
    g.fillStyle = '#555'; g.font = '14px sans-serif'; g.fillText(p.name, ox + p.x * s - 30, oz + p.z * s);
    if (!a.card) return;
    a.card.points.forEach((pt) => {
      g.fillStyle = '#d98a00'; g.beginPath(); g.arc(ox + pt.x * s, oz + pt.z * s, 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#000'; g.font = 'bold 13px sans-serif'; g.fillText(`${i + 1}${pt.label}`, ox + pt.x * s + 8, oz + pt.z * s - 6);
    });
  });
  let y = pad + planH + 30;
  lines.forEach((t, k) => {
    g.fillStyle = k === 0 ? '#000' : '#222';
    g.font = k === 0 ? 'bold 24px sans-serif' : /^\d+\./.test(t) ? 'bold 17px sans-serif' : '16px monospace';
    g.fillText(t, pad, y); y += lh;
  });
  return c.toDataURL('image/png');
}

export function renderCard(room, places, results) {
  let h = `<div class="card-head"><h1>Hand this to your carpenter</h1><p class="sub">No Gap Night size card · a first estimate</p>
  <p>All sizes in centimetres. Measure hook positions from the <b>left wall</b> and the <b>head wall</b> (see plan). Heights are from the floor.</p></div>`;
  h += topView(room, places, results);
  places.forEach((p, i) => {
    const a = results[i];
    h += `<section class="card-place"><h2>${i + 1}. ${esc(p.name)} <small>${p.length}×${p.width} cm mattress, top at ${p.top} cm</small></h2>`;
    if (!a.card) { h += `<p class="warn">No net chosen for this sleeping place. Nothing to build yet.</p></section>`; return; }
    h += `<p class="big"><b>Net:</b> ${netWLH(a.net)} · <b>Hang height:</b> ${a.card.hook} cm · <b>Tie points:</b> ${a.card.points.length}</p>`;
    h += `<p><b>Net type:</b> ${esc(a.net.label)} · <b>Gap score:</b> ${a.score}/100</p>`;
    if (a.card.type === 'rect') {
      h += `<p><b>Frame inside size (W × L):</b> ${a.card.frameW} × ${a.card.frameL} cm · <b>Hang height:</b> ${a.card.hook} cm${a.card.drop > 0 ? ` · <b>Cord from ceiling:</b> ${a.card.drop} cm` : ''}</p>`;
    } else {
      h += `<p><b>Ring:</b> ${a.card.ring} cm across · <b>Ring height:</b> ${a.card.hook} cm · <b>Cord from ceiling hook:</b> ${a.card.drop} cm</p>`;
    }
    h += `<p><b>Cut list:</b> ${a.card.cut.map(esc).join(' · ')}</p>`;
    h += `<table><thead><tr><th>Point</th><th>From left wall</th><th>From head wall</th><th>Height</th><th>Note</th></tr></thead><tbody>`;
    a.card.points.forEach((pt) => { h += `<tr><td>${i + 1}${pt.label}</td><td>${pt.x}</td><td>${pt.z}</td><td>${pt.y}</td><td>${esc(pt.note)}</td></tr>`; });
    h += `</tbody></table>`;
    if (a.tips.length) h += `<ul class="tips">${a.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
    h += `</section>`;
  });
  h += `<p class="fine">A first estimate from No Gap Night. Practical aid only, not a certified health device. Net sizes are standard LLIN presets; check the label on your own net. 3D models generated with Aholo Lux3D where loaded.</p>`;
  return h;
}
