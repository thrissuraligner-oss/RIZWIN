import asyncio, sys, json
from playwright.async_api import async_playwright
O='/tmp/claude-0/-home-claude/0e0364f8-2a99-583f-a5df-51eff3b5e089/scratchpad/'
steps=json.loads(sys.argv[1]) if len(sys.argv)>1 else []
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':800,'height':500}); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m:errs.append(m.type+': '+m.text) if m.type in('error','warning') else None)
        await pg.goto('http://localhost:8771/index.html'); await pg.wait_for_timeout(1500)
        for st in steps:
            sel,js,wait,name=st
            await pg.evaluate(f"document.querySelector('{sel}').scrollIntoView({{block:'center'}})")
            if js: await pg.evaluate(js)
            await pg.wait_for_timeout(wait)
            el=await pg.query_selector(sel+' .box') or await pg.query_selector(sel)
            bb=await el.bounding_box(); await pg.screenshot(path=O+name+'.png',clip=bb,timeout=180000)
        print(errs[:8]); await b.close()
asyncio.run(main())
