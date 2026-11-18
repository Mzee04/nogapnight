# 🌙 No Gap Night

**Hang your mosquito net with no gaps.** Photograph the real place you sleep (a bed, a mattress on the floor, a crib),
turn it into 3D with **Aholo Lux3D**, and No Gap Night drapes a standard mosquito net over it in 3D. Every gap
where a mosquito could get in glows red, you get a gap score with plain-language tips, and a size card you can
**hand to your carpenter** (net W × L × H, hang height, tie points measured from two walls). The card downloads as PNG or text.

Built for the **Aholo Global 3D AI Hackathon** (Making the World Better / Spatial Design).

> **Honest note:** this is a first estimate and a practical aid, **not a certified health device**. Net sizes are standard
> long-lasting insecticidal net (LLIN) presets; check the label on your own net. The drape is a geometric estimate, not cloth physics.

## Why
In a lot of homes, and many Lagos rooms, one room holds a bed, a floor mattress for the children and a crib. Nets get
hung from whatever nail is there: too high, so the hem never reaches the tuck line; too narrow for a 6 × 6 ft mattress;
or only one sleeper gets a net at all. A net with a gap barely helps. No Gap Night shows the gap on *your* bed
and tells you exactly where to put the hooks.

## What it does
- **Your real bed in 3D** – load a Lux3D GLB (file picker or drag-and-drop). It is centred, put on the floor, turned so its
  long side is the mattress length and its footprint is scaled to the mattress size you type (height scales proportionally).
  A "Generated with Aholo Lux3D" credit is shown while it loads and on the model label.
- **Standard nets** – rectangular 100/130/160 × 180 × 150, 190 × 180 × 150, 190 × 180 × 180, 210 × 190 × 180 and conical
  850 / 1050 / 1250 cm hem (see sources below).
- **Gap check** – red glowing curtain where the hem stops short of the tuck line (under the mattress or the floor), red glowing
  patches over any part of the mattress outside the net, and a whole red glow over a sleeping place with no net.
  Also flags tight nets (walls pressing on skin), low roofs, nets running into a wall and nets overlapping each other.
- **Gap score** per sleeping place, and a room score = the weakest place (one exposed child matters).
- **One-room night** – several sleeping places in one room, each with its own net.
- **Fix my room** – picks a net that fits, sets the best hook height and nudges nets off the walls, then drops the new nets.
- **Size card for your carpenter** – plan view, net W × L × H, frame inside size, hang height, cord length from the ceiling,
  cut list, and 4–6 tie points (A–F) measured from the left wall and the head wall. Print, download PNG or download text.
- **Delight** – animated net drop, soft moonlit night scene with a warm lamp, bloom glow on the gaps, cartoon mosquitoes
  that bonk off nets and sneak through gaps (with a counter), floating "z"s over sleepers (pillows and wrapper lumps,
  no human figures), slow camera orbit that stays above the room. Works on phones (bottom-sheet controls).

## How Aholo Lux3D is used
Lux3D is the input: it turns a phone photo of the real sleeping place into a GLB. That is what makes the check personal:
the net is draped over *your* bed, crib or floor mattress (with its headboard, rails or the mat it sits on), and the
scene in the demo is the user's own room rather than a generic box. Workflow:
1. Photograph the bed / mattress / crib (whole object in frame, even light).
2. In [Lux3D](https://3d.aholo.ai/lux3d/home) generate the model and download **GLB**.
3. Drop the GLB on the 3D view (or put it in `assets/models/` and list it in `manifest.json`).
4. Type the real mattress length, width and top height in cm so the model and the gap check use real sizes.

Until a GLB is loaded, procedural stand-in models (bed, floor mattress, crib) are used.

A real Lux3D model is included: **My bed (Lux3D)** in the Scene row loads `assets/models/bed-lux3d.glb`
("Bed With Bedding" — a single bed with a headboard, frame and messy sheet), scaled to a rough estimate of
100 × 190 cm, mattress top about 45 cm. The app uses a web-optimized copy (~4.1 MB). The original Lux3D export
is kept beside it as `bed-lux3d-original.glb` (26.8 MB) and is not loaded at runtime.

## Run it
No build step. Any static file server works:

```bash
cd nogapnight
python3 -m http.server 8000
# open http://localhost:8000
```

three.js r170 is loaded from jsDelivr through an import map (pinned `three@0.170.0`), so the page needs internet the first
time. It runs as-is on GitHub Pages (`.nojekyll` included). Opening `index.html` straight from disk (`file://`) will not load
ES modules in most browsers; use a server.

### Adding your own models
See [`assets/models/README.md`](assets/models/README.md).

### Screenshots / smoke test
`tests/shots.py` (Playwright + Chrome) loads the app, clicks through the scenes, Fix my room, the size card, PNG/text export,
a GLB load and a phone viewport, saves images to `shots/`, and prints any console errors. `tests/shots-lux3d.py` loads the
My bed (Lux3D) preset and saves `shots/10-lux3d-bed-gaps.png`, `shots/11-lux3d-bed-fixed.png` and 480p copies.

```bash
python3 -m http.server 8765 &
python3 tests/shots.py
```

## How the check works (all cm)
- **Tuck line** = mattress top − 15 cm (hem tucked under the mattress) or the floor.
- **Rectangular net**: hem height = hook height − net height. Gap = hem height − tuck line (if positive).
  If the net is more than 5 cm smaller than the mattress, the strip outside it is a gap; up to 5 cm is "tight".
  Best hook height = tuck line + net height − 5.
- **Conical net**: the ring hangs at the hook; the hem can reach out `ring/2 + √(height² − drop²)` but never more than
  `hem circumference / 2π`. The mattress corners must be inside that reach. If the drop is more than the net height,
  the hem hangs short of the tuck line.
- Score starts at 100 and loses points for hem gaps (25 + 2/cm), uncovered mattress (30 + 1/cm), tight nets, low roofs,
  walls and overlaps.

## Limits
- A first estimate. The drape is parametric (straight walls with sag and folds), not a cloth simulation.
- The gap check uses the sizes you type, not the mesh; the GLB is for seeing your real bed. Lux3D models are not to scale,
  so the footprint is scaled to your typed size and the height is scaled proportionally.
- Assumes the net is intact, hung square, centred over the mattress and tucked in. It cannot see holes or torn hems.
- Rooms are simple boxes (left wall, head wall, ceiling height); furniture other than sleeping places is not modelled.
- Not medical advice and not a certified device.

## Net size sources
- WHO Prequalification Declaration of Labelling, DCT Royal Guard LLIN – rectangular 70–190 × 180 × 150–180; conical
  1050 × 56 × 220, 1250 × 65 × 250, 1350 × 75 × 250 cm.
  https://extranet.who.int/prequal/sites/default/files/vcp-documents/WHOPAR-VC_003-003_DOL_20190329.pdf
- WHO PQ Declaration of Labelling, UNET G1 LN – 190 × 180 × 150, 160 × 180 × 150 …; conical 850 × 56 × 220, 1050 × 56 × 220, 1250 × 65 × 250.
  https://extranet.who.int/prequal/sites/default/files/doc_parts/P-13227%20-%20part8v2%2020260715.pdf
- WHO PQ Declaration of Labelling, GreenNet – 190 × 180 × 150/160/180, 210 × 190 × 180; conical 1250 × 65 × 250.
  https://extranet.who.int/prequal/sites/default/files/doc_parts/p-00320-part8v0.pdf
- Draft East African Standard DEAS 455:2021 (LLIN), tables 5 and 6 – single fitted conical 850 cm / 180 cm / 56 cm ring,
  double fitted 1050 / 220 / 56, extra double 1250 / 250 / 65.
  https://bbnburundi.org/wp-content/uploads/2021/08/DEAS-455_2021-LLIN-Mosquito-nets-standard-1.pdf
- SafeNet LLIN standard sizes table. https://safenetllin.com/product/

Nigerian mattress presets (6 × 6, 6 × 4½, 6 × 3½ ft) are common market sizes converted to cm.

## Credits
3D models generated with [Aholo Lux3D](https://www.aholo.ai/) (Manycore). Rendering with [three.js](https://threejs.org/) (MIT).
