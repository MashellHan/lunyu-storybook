"""Headless smoke test: python3 tests/check.py <url> [out.png]
Opens the page, taps ▶, waits for the elephant trumpet and the first line, then free-play taps the dog; fails on any JS error or failed request."""
import asyncio, sys, json
from playwright.async_api import async_playwright
U = sys.argv[1]; OUT = sys.argv[2] if len(sys.argv) > 2 else "shots/check.png"
STEP = "document.querySelector('#book').dataset.step"
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--autoplay-policy=user-gesture-required"])
    pg = await b.new_page(viewport={"width":1180,"height":820}); errs=[]; bad=[]; aud={}
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: m.type=="error" and errs.append(m.text))
    pg.on("response", lambda r: (bad.append((r.status,r.url)) if r.status>=400 else None, aud.__setitem__(r.url.split("/")[-1], r.headers.get("content-type")) if "/assets/" in r.url else None))
    pg.on("requestfailed", lambda r: bad.append(("failed", r.url)))
    await pg.goto(U, wait_until="networkidle"); await pg.wait_for_timeout(1500)
    await pg.screenshot(path=OUT.replace(".png","-title.png"))
    await pg.click("#startBtn")
    await pg.wait_for_function(f"{STEP}==='trumpet'", timeout=25000)
    await pg.wait_for_function(f"{STEP}==='e1'", timeout=10000); await pg.wait_for_timeout(1200)
    await pg.screenshot(path=OUT)
    await pg.evaluate("__demo.enterFree()"); await pg.wait_for_timeout(300); await pg.click("#dog")
    await pg.wait_for_function(f"{STEP}==='sound-dog'", timeout=15000)
    st = await pg.evaluate("(()=>{const a=document.querySelector('audio')||null; return {log:window.__log.map(x=>x.key), blobs:0}})()")
    print(json.dumps({"errors":errs,"bad":bad,"played":st["log"],"asset_types":aud}, ensure_ascii=False, indent=1))
    await b.close(); sys.exit(1 if errs or bad else 0)
asyncio.run(main())
