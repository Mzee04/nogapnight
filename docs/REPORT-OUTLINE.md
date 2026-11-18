# No Gap Night: report outline (PDF / slides)

Target: 4–6 pages or 6–8 slides. Keep it plain and visual. Wording: say "a first estimate", never claim medical effect.

## 1. Title
- **No Gap Night: hang your mosquito net with no gaps**
- One line: Photo of your real bed → Aholo Lux3D → 3D net drape → red gaps → a size card for your carpenter.
- Name, country (Nigeria), hackathon name, track/awards targeted (Making the World Better, Spatial Design).
- [SCREENSHOT: hero, floor mattress with three sleepers and red gaps glowing]

## 2. The problem
- Treated nets only work when they are sealed. Common real gaps: hem hung too high to tuck, net narrower than a 6 × 6 ft
  mattress, floor mattresses and cribs with no net, nets pinned against a wall.
- Many families sleep in one room: bed + floor mattress + crib.
- Nobody can "see" the gap before night falls, and carpenters need numbers, not advice.

## 3. Why Aholo Lux3D is core
- Lux3D turns one phone photo of the user's *own* sleeping place into a 3D model (GLB) in minutes. No scanner or 3D skills.
- The net is draped over that model, in that room, so the result is personal and believable.
- Without Lux3D the app would be a generic calculator; with it, the family sees its own bed with the gap glowing.
- [SCREENSHOT: Lux3D editor with the source photo]
- [SCREENSHOT: Lux3D generation result / credit cost]
- [SCREENSHOT: GLB download]

## 4. Process (how I built it)
- Photo → Lux3D → GLB → loaded in No Gap Night (drag-drop), scaled to the typed mattress size.
- [SCREENSHOT: "Generated with Aholo Lux3D" loading state]
- [SCREENSHOT: real Lux3D bed with net draped]
- Built as a static three.js web app (no install, runs on a phone, hosted on GitHub Pages).

## 5. How it works
- Standard LLIN presets (rectangular and conical, sizes from WHO PQ labels and DEAS 455).
- Tuck line, hem height, conical reach formula (one sentence each, see README).
- Gap score per sleeping place; room score = weakest place.
- Fix my room: picks a fitting net, best hook height, moves nets off walls.
- Size card: W × L × H, hang height, tie points from two walls, PNG / text / print.
- [SCREENSHOT: one-room night before]  [SCREENSHOT: after Fix my room]
- [SCREENSHOT: size card]
- Fun layer: mosquitoes bonk off nets and sneak through gaps, with a counter.

## 6. Impact
- Turns "hang your net properly" into a picture and a set of numbers a local carpenter can build from today.
- Works for floor mattresses and multi-sleeper rooms, which generic advice ignores.
- Cheap: free web app, a phone camera, standard nets.

## 7. Limits (be honest)
- A first estimate, geometric drape, not cloth physics; not a certified health device.
- Gap check uses typed sizes; Lux3D model is scaled to them.
- Cannot detect holes in the net; assumes the net is hung square and tucked.

## 8. Links
- Live demo: [GitHub Pages URL]
- Source: [GitHub repo URL]
- Demo video: [YouTube / video URL]
- Aholo Lux3D: https://3d.aholo.ai/lux3d/home
