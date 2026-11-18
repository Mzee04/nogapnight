"""Screenshot the My bed (Lux3D) preset: gaps, then Fix my room.
Run the static server from the repo, then run this script from /tmp:

    python3 -m http.server 8765 --directory /workspace/nogapnight
    python3 /tmp/shots-lux3d.py
"""
import sys, pathlib
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765/"
OUT = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else pathlib.Path("/workspace/nogapnight/shots")
OUT.mkdir(exist_ok=True)
errors = []

def attach(page, tag):
    page.on("console", lambda m: errors.append(f"[{tag}] console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errors.append(f"[{tag}] pageerror: {e}"))
    page.on("requestfailed", lambda r: errors.append(f"[{tag}] requestfailed: {r.url}"))

def wait_luxbed(page, timeout=45000):
    page.click("[data-preset=luxbed]")
    page.wait_for_function(
        """() => {
          const info = document.getElementById('glb-info');
          const loading = document.getElementById('glb-loading');
          const ok = info && /Generated with Aholo Lux3D/i.test(info.innerText);
          const done = !loading || loading.hidden;
          return ok && done;
        }""",
        timeout=timeout,
    )
    # let the net drop and one frame of mosquitoes settle
    page.wait_for_timeout(3500)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True,
                          args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    page = b.new_page(viewport={"width": 1440, "height": 900})
    attach(page, "desktop")
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(2000)
    wait_luxbed(page)
    # stop orbit so the two shots match
    if page.locator("#btn-orbit.on").count():
        page.click("#btn-orbit")
        page.wait_for_timeout(400)
    page.screenshot(path=str(OUT / "10-lux3d-bed-gaps.png"))
    print("gaps score:", page.evaluate("window.__ngn.analysis.roomScore"))
    print("glb info:", page.inner_text("#glb-info")[:240])
    print("place:", page.evaluate("""() => {
      const p = window.__ngn.state.places[0];
      return {name:p.name, kind:p.kind, length:p.length, width:p.width, top:p.top, net:p.net, hook:p.hook, hookMode:p.hookMode};
    }"""))
    page.click("#btn-fix")
    page.wait_for_timeout(4000)
    page.screenshot(path=str(OUT / "11-lux3d-bed-fixed.png"))
    print("fixed score:", page.evaluate("window.__ngn.analysis.roomScore"))
    print("fixed place:", page.evaluate("""() => {
      const p = window.__ngn.state.places[0];
      return {net:p.net, hookMode:p.hookMode, hook:p.hook};
    }"""))

    s = b.new_page(viewport={"width": 854, "height": 480})
    attach(s, "480p")
    s.goto(URL, wait_until="networkidle")
    s.wait_for_timeout(2000)
    wait_luxbed(s)
    if s.locator("#btn-orbit.on").count():
        s.click("#btn-orbit")
        s.wait_for_timeout(400)
    s.screenshot(path=str(OUT / "10b-lux3d-bed-gaps-480p.png"))
    print("480p gaps score:", s.evaluate("window.__ngn.analysis.roomScore"))
    print("480p hud:", s.inner_text("#hud").replace("\n", " "))
    s.click("#btn-fix")
    s.wait_for_timeout(4000)
    s.screenshot(path=str(OUT / "11b-lux3d-bed-fixed-480p.png"))
    print("480p fixed score:", s.evaluate("window.__ngn.analysis.roomScore"))
    b.close()

print("\n".join(errors) if errors else "NO CONSOLE ERRORS")
