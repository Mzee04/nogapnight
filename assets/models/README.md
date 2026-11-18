# Your Lux3D models

1. Generate your bed, floor mattress or crib in [Aholo Lux3D](https://3d.aholo.ai/lux3d/home) and download it as **GLB**.
2. Copy the `.glb` file into this folder.
3. List it in `manifest.json` so it shows up in the app's "pick from assets/models" menu:

```json
{
  "models": [
    { "file": "my-floor-mattress.glb", "name": "My floor mattress (Lux3D)", "kind": "floor", "length": 183, "width": 183, "top": 20 }
  ]
}
```

`kind` is `bed`, `floor` or `crib`. `length`, `width` and `top` (floor to mattress top) are in centimetres and are optional;
when present they are filled into the form so the model is scaled to your real mattress. You can also skip the manifest and
just drag a `.glb` onto the 3D view.

Sizes you type are a **rough estimate** / first estimate, not a surveyed measurement. The gap check uses those sizes, not the mesh.

## Journey card

Add a `journey` block to an entry to give it a tab in the app's **Photo → Lux3D → Net** card:

```json
"journey": { "title": "Floor mattress", "scene": "luxmat",
  "photo": "assets/photos/mattress.jpg", "lux3d": "assets/journey/mattress-lux3d.jpg", "result": "assets/journey/mattress-netted.jpg" }
```

`scene` is optional (a preset name in `js/main.js`); without it, "Open this in 3D" loads the model onto the selected
sleeping place with the manifest sizes. Keep photos small (about 480 px) since they may show personal items.

## Included: Patterned Mattress (Lux3D)

- `mattress-lux3d.glb` — web copy used by **My floor mattress (Lux3D)**, the hero scene (~2.6 MB; levelled with a PCA
  fit so the thin axis is up and the long side runs along Z, sitting on y = 0; simplified, quantized, 1024 px JPEG base colour).
- `mattress-lux3d-original.glb` — the untouched Lux3D export (16.3 MB, ~267k faces, tilted about 43° in its own frame). Not loaded by the app.

Default size: 120 × 190 cm, about 15 cm thick (a rough estimate).

## Included: Wooden Bed (Lux3D)

- `wood-bed-lux3d.glb` — web copy used by **Bed by the wall (Lux3D)** (~2.8 MB; levelled with a PCA fit, on y = 0, long side along Z; simplified, quantized, 1024 px JPEG).
- `wood-bed-lux3d-original.glb` — the untouched Lux3D export (18.1 MB). Not loaded by the app.

Default size: 140 × 190 cm, mattress top about 50 cm (a rough estimate). The journey tile for this model is a render of the GLB in No Gap Night, not a Lux3D editor screenshot.

## Included: Bed With Bedding (Lux3D)

- `bed-lux3d.glb` — web-optimized copy used by the app and the **My bed (Lux3D)** scene (~4.1 MB; 1024 px JPEG textures, simplified mesh, `KHR_mesh_quantization`). Y-up, sitting on the floor, headboard at −Z (the head wall).
- `bed-lux3d-original.glb` — the untouched Lux3D export (26.8 MB, ~484k triangles, 2048 px PNG textures). Not loaded by the app; kept so the source model is on hand.

Lux3D named this model "Bed With Bedding". It is a single bed with a headboard, frame and a messy sheet. Default size in the manifest is 100 × 190 cm, mattress top about 45 cm (a rough estimate).
