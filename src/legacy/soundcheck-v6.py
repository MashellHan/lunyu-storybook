# records a ~20 s sound-check: elephant trumpet at the start, then bunny / cat / dog solos (line + real animal sound)
import asyncio, os, time, json
from playwright.async_api import async_playwright
D=os.path.dirname(os.path.abspath(__file__)); U="file://"+os.path.abspath(os.path.join(D,"..","index-v6.html")); O=os.path.join(D,"..","v6shots","soundcheck")
os.makedirs(O,exist_ok=True)
STEP="document.querySelector('#book').dataset.step"
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--autoplay-policy=user-gesture-required"])
    ctx=await b.new_context(viewport={"width":1180,"height":820},record_video_dir=O,record_video_size={"width":1180,"height":820})
    pg=await ctx.new_page(); t0=time.time()*1000; errs=[]
    pg.on("pageerror",lambda e:errs.append(str(e))); pg.on("console",lambda m: m.type=="error" and errs.append(m.text))
    await pg.goto(U); await pg.wait_for_timeout(2600)
    await pg.click("#startBtn")
    await pg.wait_for_function(f"{STEP}==='trumpet'",timeout=20000)
    await pg.wait_for_function(f"{STEP}!=='trumpet'",timeout=10000)
    await pg.evaluate("__demo.enterFree()")
    for id in ("bunny","cat","dog"):
      await pg.wait_for_timeout(300); await pg.click("#"+id)
      await pg.wait_for_function(f"{STEP}==='sound-{id}'",timeout=15000)
      await pg.wait_for_function(f"{STEP}==='free'",timeout=15000)
    await pg.wait_for_timeout(800)
    log=await pg.evaluate("window.__log"); json.dump({"t0":t0,"log":log,"end":time.time()*1000},open(os.path.join(O,"log.json"),"w"))
    print("errors:",errs); await ctx.close(); await b.close()
asyncio.run(main())
