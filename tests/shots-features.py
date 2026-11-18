"""Screenshots for the demo features: intro, onboarding, Lux3D floor mattress (gaps -> fixed), before/after wipe,
Photo -> Lux3D -> Net journey card, and share links. Also writes the journey-card result images in assets/journey/.
Run the static server from the repo, then run this script from /tmp:

    python3 -m http.server 8765 --directory /workspace/nogapnight
    cd /tmp && python3 /workspace/nogapnight/tests/shots-features.py
"""
import sys, pathlib
from playwright.sync_api import sync_playwright
from PIL import Image

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765/"
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "shots"
JR = ROOT / "assets" / "journey"
OUT.mkdir(exist_ok=True)
errors = []

def attach(page, tag):
    page.on("console", lambda m: errors.append(f"[{tag}] console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errors.append(f"[{tag}] pageerror: {e}"))
    page.on("requestfailed", lambda r: errors.append(f"[{tag}] requestfailed: {r.url}"))

def wait_model(page, timeout=60000):
    page.wait_for_function("""() => /Generated with Aholo Lux3D/.test(document.getElementById('glb-info').innerText)
        && document.getElementById('glb-loading').hidden""", timeout=timeout)

def orbit_off(page):
    if page.locator("#btn-orbit.on").count():
        page.click("#btn-orbit")

def score(page):
    return page.evaluate("window.__ngn.analysis.roomScore")

def crop_viewport(png, dst, aspect=4 / 5, width=520):
    """Crop the centre of the 3D viewport (left of the 380 px panel) to a portrait tile for the journey card."""
    im = Image.open(png).convert("RGB")
    W, H = im.size
    vw = W - 380 * (W // 1440 if W >= 1440 else 1)
    h = int(H * 0.70); w = int(h * aspect)
    cx = int(vw * 0.47); cy = int(H * 0.46)
    box = (max(0, cx - w // 2), max(0, cy - h // 2), min(vw, cx + w // 2), min(H, cy + h // 2))
    t = im.crop(box); t.thumbnail((width, int(width / aspect)))
    t.save(dst, quality=82, optimize=True)

def scenario(b, size, tag, suffix):
    page = b.new_page(viewport=size)
    attach(page, tag)
    page.goto(BASE + "?clean", wait_until="networkidle")
    wait_model(page)
    page.wait_for_timeout(3000)
    orbit_off(page)
    page.wait_for_timeout(400)
    page.screenshot(path=str(OUT / f"15-lux3d-mattress-gaps{suffix}.png"))
    print(tag, "mattress gaps score:", score(page))
    page.click("#btn-fix")
    page.wait_for_timeout(3500)
    page.screenshot(path=str(OUT / f"16-lux3d-mattress-fixed{suffix}.png"))
    print(tag, "mattress fixed score:", score(page))
    page.click("#btn-compare")
    page.wait_for_timeout(2600)
    page.screenshot(path=str(OUT / f"12-before-after{suffix}.png"))
    print(tag, "compare before/after:", page.evaluate("[window.__ngn.before.analysis.roomScore, window.__ngn.analysis.roomScore]"))
    if not suffix:
        crop_viewport(OUT / "12-before-after.png", JR / "mattress-netted.jpg")
        # drag the wipe to show more "before"
        h = page.locator("#cmp-handle").bounding_box()
        page.mouse.move(h["x"] + h["width"] / 2, h["y"] + h["height"] / 2)
        page.mouse.down(); page.mouse.move(h["x"] + 230, h["y"] + h["height"] / 2, steps=8); page.mouse.up()
        page.wait_for_timeout(600)
        page.screenshot(path=str(OUT / "12a-before-after-dragged.png"))
        print(tag, "slider x after drag:", round(page.evaluate("window.__ngn.cmp.x"), 2))
    page.click("#btn-compare")
    page.wait_for_timeout(300)
    # bed: fixed + compare to make its journey tile
    page.click("[data-preset=luxbed]")
    wait_model(page)
    page.wait_for_timeout(2500)
    orbit_off(page)
    page.click("#btn-compare")
    page.wait_for_timeout(2600)
    if not suffix:
        page.screenshot(path=str(OUT / "12c-before-after-bed.png"))
        crop_viewport(OUT / "12c-before-after-bed.png", JR / "bed-netted.jpg")
    page.click("#btn-compare")
    # Lux3D wooden bed pushed against the left wall: the net runs into the wall
    page.click("[data-preset=luxwood]")
    wait_model(page)
    page.wait_for_timeout(3000)
    orbit_off(page)
    page.wait_for_timeout(400)
    page.screenshot(path=str(OUT / f"17-lux3d-woodbed-wall{suffix}.png"))
    print(tag, "wood bed score:", score(page), "wall tip:", any("wall" in t for t in page.evaluate("window.__ngn.analysis.results[0].tips")))
    page.click("#btn-compare")
    page.wait_for_timeout(2600)
    print(tag, "wood bed before/after:", page.evaluate("[window.__ngn.before.analysis.roomScore, window.__ngn.analysis.roomScore]"),
          "x:", page.evaluate("window.__ngn.state.places[0].x"))
    if not suffix:
        page.screenshot(path=str(OUT / "17b-lux3d-woodbed-before-after.png"))
        crop_viewport(OUT / "17b-lux3d-woodbed-before-after.png", JR / "wood-bed-netted.jpg")
    page.click("#btn-compare")
    page.click("[data-preset=luxmat]")
    wait_model(page)
    page.wait_for_timeout(1500)
    page.click(".btn-journey >> nth=0")
    page.wait_for_timeout(1200)
    page.screenshot(path=str(OUT / f"13-journey-card{suffix}.png"))
    if not suffix:
        page.click("[data-j='1']")
        page.wait_for_timeout(800)
        page.screenshot(path=str(OUT / "13a-journey-card-bed.png"))
        page.click("[data-j='0']")
    page.click("#btn-close-journey")
    # share: fix, then copy link
    page.click("#btn-fix")
    page.wait_for_timeout(1500)
    page.click("#btn-share")
    page.wait_for_timeout(700)
    if not suffix:
        page.screenshot(path=str(OUT / "14a-share-copied.png"))
    page.click("#btn-card")
    page.wait_for_timeout(300)
    page.click("#btn-share-card")
    url = page.evaluate("location.href")
    page.click("#btn-close-card")
    print(tag, "share url length:", len(url))
    page.close()
    # open the shared link fresh: the room, its model and the size card come back
    s = b.new_page(viewport=size)
    attach(s, tag + "-shared")
    s.goto(url.replace("/#", "/?clean#") if "?clean" not in url else url, wait_until="networkidle")
    wait_model(s)
    s.wait_for_timeout(2500)
    s.screenshot(path=str(OUT / f"14-share{suffix}.png"))
    print(tag, "shared opened: score", score(s), "card open:", s.evaluate("document.getElementById('card-dialog').open"),
          "place:", s.evaluate("(({name,kind,length,width,top,net,hookMode}) => ({name,kind,length,width,top,net,hookMode}))(window.__ngn.state.places[0])"))
    s.close()

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True,
                          args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    # intro title + onboarding (no ?clean)
    page = b.new_page(viewport={"width": 1440, "height": 900})
    attach(page, "intro")
    page.goto(BASE, wait_until="commit")
    page.wait_for_function("() => !!window.__ngn")  # module running: the title is on screen for ~2.3 s
    page.wait_for_timeout(1000)
    page.screenshot(path=str(OUT / "00-intro-title.png"))
    wait_model(page)
    page.wait_for_timeout(3500)
    page.screenshot(path=str(OUT / "19-onboarding.png"))
    # selecting a place glides the camera (One-room night has three)
    page.click("[data-preset=room]")
    page.wait_for_timeout(1500)
    page.click("#place-tabs [data-id] >> nth=2")
    page.wait_for_timeout(1500)
    orbit_off(page)
    page.screenshot(path=str(OUT / "18-camera-focus-crib.png"))
    page.close()
    scenario(b, {"width": 1440, "height": 900}, "desktop", "")
    scenario(b, {"width": 854, "height": 480}, "480p", "-480p")
    m = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    attach(m, "mobile")
    m.goto(BASE + "?clean", wait_until="networkidle")
    wait_model(m)
    m.wait_for_timeout(1500)
    m.click("#btn-compare")
    m.wait_for_timeout(2600)
    m.screenshot(path=str(OUT / "12m-before-after-mobile.png"))
    b.close()

print("\n".join(errors) if errors else "NO CONSOLE ERRORS")
