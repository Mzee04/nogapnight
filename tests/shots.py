"""Render No Gap Night in headless Chrome and save screenshots to shots/.
Usage: python3 -m http.server 8765 (in repo root), then python3 tests/shots.py
"""
import sys, pathlib
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765/"
OUT = pathlib.Path(__file__).resolve().parent.parent / "shots"
OUT.mkdir(exist_ok=True)
errors = []

def attach(page, tag):
    page.on("console", lambda m: errors.append(f"[{tag}] console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errors.append(f"[{tag}] pageerror: {e}"))
    page.on("requestfailed", lambda r: errors.append(f"[{tag}] requestfailed: {r.url}"))

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True,
                          args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    page = b.new_page(viewport={"width": 1440, "height": 900})
    attach(page, "desktop")
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(6000)
    page.screenshot(path=str(OUT / "01-hero-floor-mattress-gaps.png"))
    print("hero score:", page.evaluate("window.__ngn.analysis.roomScore"))
    page.click("[data-preset=room]")
    page.wait_for_timeout(4000)
    page.screenshot(path=str(OUT / "02-one-room-gaps.png"))
    print("room score:", page.evaluate("window.__ngn.analysis.roomScore"))
    page.click("#btn-orbit")
    page.click("#btn-fix")
    page.wait_for_timeout(3500)
    page.screenshot(path=str(OUT / "03-after-fix.png"))
    print("room score after fix:", page.evaluate("window.__ngn.analysis.roomScore"))
    page.click("#btn-card")
    page.wait_for_timeout(600)
    page.screenshot(path=str(OUT / "04-size-card.png"), full_page=False)
    with page.expect_download() as d:
        page.click("#btn-png")
    d.value.save_as(str(OUT / "size-card-export.png"))
    with page.expect_download() as d:
        page.click("#btn-txt")
    d.value.save_as(str(OUT / "size-card-export.txt"))
    page.click("#btn-close-card")
    page.click("[data-preset=crib]")
    page.wait_for_timeout(3000)
    page.screenshot(path=str(OUT / "05-crib-conical.png"))
    # GLB load test with a generated cube GLB if present
    glb = pathlib.Path("/tmp/test-bed.glb")
    if glb.exists():
        page.click("[data-preset=bed]")
        page.wait_for_timeout(500)
        page.set_input_files("#f-glb", str(glb))
        page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / "06a-glb-loading-credit.png"))
        page.wait_for_timeout(3000)
        page.screenshot(path=str(OUT / "06-glb-loaded.png"))
        print("glb info:", page.inner_text("#glb-info")[:160])
    s = b.new_page(viewport={"width": 854, "height": 480})
    attach(s, "480p")
    s.goto(URL, wait_until="networkidle")
    s.wait_for_timeout(6000)
    s.screenshot(path=str(OUT / "01b-hero-480p.png"))
    print("480p stats:", s.inner_text("#hud").replace("\n", " "))
    page.close(); s.close()
    m = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    attach(m, "mobile")
    m.goto(URL, wait_until="networkidle")
    m.wait_for_timeout(3500)
    m.screenshot(path=str(OUT / "07-mobile.png"), timeout=60000)
    m.click("#panel-toggle")
    m.wait_for_timeout(800)
    m.screenshot(path=str(OUT / "08-mobile-panel.png"), timeout=60000)
    b.close()

print("\n".join(errors) if errors else "NO CONSOLE ERRORS")
