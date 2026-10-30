# Renders every 3D scene, frame by frame, from the same gate-checked geometry, for the video versions.
# usage: python3 capture.py <job> ; jobs: sim-front sim-side sim-three spaces story thermo
import asyncio, base64, json, os, sys
from playwright.async_api import async_playwright
OUT = '/home/claude/n/three/frames'
CONCERNS = ['crowd', 'space', 'open', 'deep', 'forward']
SIM_N, SP_N, ST_N, TH_FPS, TH_T = 41, 41, 51, 16, 15
async def main(job):
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': 1100, 'height': 2600}, device_scale_factor=1)
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8771/capture.html'); await pg.wait_for_function('window.__ready && document.getElementById("thermo").__frame', timeout=180000)
        man = {}
        async def grab(js, path):
            r = await pg.evaluate(js); os.makedirs(os.path.dirname(path), exist_ok=True)
            open(path, 'wb').write(base64.b64decode(r.pop('img').split(',')[1])); return r
        if job.startswith('sim-'):
            view = job[4:]
            for c in CONCERNS:
                rows = []
                for f in range(SIM_N):
                    t = f / (SIM_N - 1)
                    r = await grab(f"document.getElementById('sim').__frame('{c}','{view}',{t})", f'{OUT}/sim-{c}-{view}/f{f:03d}.png')
                    rows.append([round(r['overjet'], 2), round(r['overbite'], 2)])
                man[f'sim-{c}-{view}'] = {'frames': SIM_N, 'measure': rows}
                print(job, c, 'done', flush=True)
        elif job == 'spaces':
            rows = []
            for f in range(SP_N):
                r = await grab(f"document.getElementById('spaces').__frame({f / (SP_N - 1)})", f'{OUT}/spaces/f{f:03d}.png'); rows.append(r['gap'])
            man['spaces'] = {'frames': SP_N, 'gap': rows}
        elif job == 'story':
            for f in range(ST_N):
                await grab(f"document.getElementById('story').__frame({1 + 5 * f / (ST_N - 1)})", f'{OUT}/story/f{f:03d}.png')
            man['story'] = {'frames': ST_N, 'from': 1, 'to': 6}
        elif job == 'thermo':
            rows = []; n = TH_FPS * TH_T
            for f in range(n):
                r = await grab(f"document.getElementById('thermo').__frame({f / TH_FPS})", f'{OUT}/thermo/f{f:03d}.png'); rows.append(r['text'])
            man['thermo'] = {'frames': n, 'fps': TH_FPS, 'text': rows}
        json.dump(man, open(f'{OUT}/manifest-{job}.json', 'w'))
        print(job, 'finished', errs[:3], flush=True)
        await b.close()
asyncio.run(main(sys.argv[1]))
