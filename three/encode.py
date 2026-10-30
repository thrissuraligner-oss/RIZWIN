# Turns the captured frames into small web videos (+ poster images) and one manifest of per-frame readouts.
# Backgrounds are baked to match each figure's CSS, so the videos sit seamlessly in the page.
import glob, hashlib, json, os, shutil, subprocess, sys
from PIL import Image
import numpy as np

FR = '/home/claude/n/three/frames'
OUT = '/home/claude/n/base/assets/video'
TMP = '/home/claude/n/three/frames/_comp'
FPS = {'thermo': 16}

def bg(kind, w, h):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    def lin(c0, c1):
        t = (y / (h - 1))[..., None]; return np.array(c0) * (1 - t) + np.array(c1) * t
    if kind == 'sim':  # radial-gradient(120% 95% at 50% 35%, #3b2b68 0, #21173f 60%, #170f2e 100%)
        d = np.sqrt(((x - 0.5 * w) / (1.2 * w)) ** 2 + ((y - 0.35 * h) / (0.95 * h)) ** 2)[..., None]
        c0, c1, c2 = np.array([0x3b, 0x2b, 0x68]), np.array([0x21, 0x17, 0x3f]), np.array([0x17, 0x0f, 0x2e])
        a = np.clip(d / 0.6, 0, 1); b = np.clip((d - 0.6) / 0.4, 0, 1)
        img = np.where(d < 0.6, c0 * (1 - a) + c1 * a, c1 * (1 - b) + c2 * b)
    elif kind == 'spaces': img = np.broadcast_to(np.array([0x16, 0x0b, 0x1a], np.float32), (h, w, 3))
    elif kind == 'story': img = lin([0xfa, 0xf7, 0xff], [0xef, 0xe8, 0xfb])
    else: img = lin([0xff, 0xff, 0xff], [0xf3, 0xee, 0xfc])
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB')

def encode(clip):
    src = f'{FR}/{clip}'; files = sorted(glob.glob(src + '/f*.png'))
    if not files: return None
    kind = clip.split('-')[0]
    w, h = Image.open(files[0]).size; base = bg(kind, w, h)
    tmp = f'{TMP}/{clip}'; shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
    for i, f in enumerate(files):
        im = Image.open(f).convert('RGBA'); c = base.copy(); c.paste(im, (0, 0), im); c.save(f'{tmp}/f{i:03d}.png')
    fps = FPS.get(kind, 24)
    common = ['-y', '-loglevel', 'error', '-framerate', str(fps), '-i', f'{tmp}/f%03d.png', '-an']
    # short keyframe interval so the slider can seek to any frame instantly
    subprocess.run(['ffmpeg', *common, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-pix_fmt', 'yuv420p', '-g', '6', '-movflags', '+faststart', f'{OUT}/{clip}.mp4'], check=True)
    Image.open(f'{tmp}/f000.png').save(f'{OUT}/{clip}.webp', 'WEBP', quality=70, method=6)
    sizes = {e: os.path.getsize(f'{OUT}/{clip}.{e}') for e in ('mp4', 'webp')}
    print(clip, w, 'x', h, len(files), 'frames', {k: f'{v // 1024} KB' for k, v in sizes.items()}, flush=True)
    if clip == 'thermo':  # the still shown without JavaScript: the sheet formed over the model
        Image.open(f'{tmp}/f{min(len(files) - 1, int(8.5 * fps)):03d}.png').resize((1200, 720)).save('/home/claude/n/three/poster/aligner-pressure-former-3d.webp', 'WEBP', quality=80, method=6)
    v = hashlib.sha256(open(f'{OUT}/{clip}.mp4', 'rb').read()).hexdigest()[:8]  # cache-busting for the year-long /assets cache
    return {'w': w, 'h': h, 'frames': len(files), 'fps': fps, 'v': v}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    man = {}
    for f in glob.glob(FR + '/manifest-*.json'): man.update(json.load(open(f)))
    clips = sorted(d for d in os.listdir(FR) if os.path.isdir(f'{FR}/{d}') and not d.startswith('_'))
    if len(sys.argv) > 1: clips = [c for c in clips if c in sys.argv[1:]]  # encode just these
    out = {}
    for c in clips:
        meta = encode(c)
        if meta: out[c] = {**meta, **{k: v for k, v in man.get(c, {}).items() if k not in ('frames',)}}
    if 'thermo' in out and 'text' in out['thermo']:  # store only the frames where the readout changes
        t = out['thermo'].pop('text'); out['thermo']['text'] = [[i, s] for i, s in enumerate(t) if i == 0 or s != t[i - 1]]
    js = json.dumps(out, separators=(',', ':'))
    open(f'{OUT}/manifest.json', 'w').write(js)
    print('manifest', len(js) // 1024, 'KB;', 'total video', sum(os.path.getsize(p) for p in glob.glob(OUT + '/*')) // 1024, 'KB')
