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
