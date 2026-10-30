#!/usr/bin/env python3
"""Pre-launch audit for the static build. Usage: python3 audit.py [public_dir] [report.md]
Checks the on-page SEO / AEO / GEO basics that can be verified from the HTML alone.
It does NOT replace Lighthouse, Rich Results Test or Search Console. See README."""
import os, re, sys, json, collections
from bs4 import BeautifulSoup
PUB = sys.argv[1] if len(sys.argv) > 1 else 'public'
OUT = sys.argv[2] if len(sys.argv) > 2 else None
DOMAIN = 'https://alignerthrissur.com'
BANNED = [r'(?<!find the )best orthodontist',  # 'how to find the best orthodontist' guides describe a search, not a claim
          r'\bno\.? ?1\b', r'guarantee', r'cheapest', r'\b100 ?%', r'top[- ]rated', r'painless']
PLACEHOLDER = [r'\bTODO\b', r'lorem ipsum', r'\bXXXX', r'example\.com']

pages = {}
for root, _, files in os.walk(PUB):
    for f in files:
        if f.endswith('.html'):
            p = os.path.join(root, f); rel = '/' + os.path.relpath(p, PUB).replace('index.html', '').replace('\\', '/')
            pages[rel] = p
issues = []   # (severity, page, message)
def add(sev, page, msg): issues.append((sev, page, msg))
titles = collections.defaultdict(list); descs = collections.defaultdict(list); rows = []
def local_exists(href):
    href = href.split('#')[0].split('?')[0]
    if not href or href.startswith(('http', 'mailto:', 'tel:')): return True
    if href.endswith('/'): return os.path.exists(PUB + href + 'index.html')
    return os.path.exists(PUB + href) or os.path.exists(PUB + href + '/index.html')
ids_global = set()
for rel, path in sorted(pages.items()):
    html = open(path, encoding='utf-8').read(); s = BeautifulSoup(html, 'lxml'); is404 = rel.startswith('/404')
    t = (s.title.string or '').strip() if s.title else ''; md = s.find('meta', attrs={'name': 'description'}); d = (md['content'] if md else '').strip()
    titles[t].append(rel); descs[d].append(rel)
    if not t: add('critical', rel, 'missing <title>')
    elif len(t) > 60: add('warn', rel, f'title {len(t)} chars (>60)')
    elif len(t) < 30: add('warn', rel, f'title {len(t)} chars (<30)')
    if not d: add('critical', rel, 'missing meta description')
    elif not (120 <= len(d) <= 160): add('warn', rel, f'meta description {len(d)} chars (target 120-160)')
    can = s.find('link', rel='canonical')
    if not is404:
        exp = DOMAIN + rel
        if not can: add('critical', rel, 'missing canonical')
        elif can['href'] != exp: add('critical', rel, f'canonical {can["href"]} != {exp}')
    rb = s.find('meta', attrs={'name': 'robots'})
    if rb and 'noindex' in rb.get('content', '') and not is404: add('critical', rel, 'noindex on a public page')
    h1 = s.find_all('h1')
    if len(h1) != 1: add('critical', rel, f'{len(h1)} <h1> tags')
    last = 0
    for h in s.find_all(re.compile('^h[1-6]$')):
        n = int(h.name[1]);
        if last and n > last + 1: add('warn', rel, f'heading jump h{last} -> h{n}: {h.get_text(strip=True)[:40]}')
        last = n
    if s.html.get('lang') != 'en-IN': add('warn', rel, 'html lang is not en-IN')
    for prop in ('og:title', 'og:description', 'og:image', 'og:url'):
        if not s.find('meta', property=prop): add('warn', rel, f'missing {prop}')
    ogi = s.find('meta', property='og:image')
    if ogi:
        f = PUB + ogi['content'].replace(DOMAIN, '')
        if not os.path.exists(f): add('critical', rel, 'og:image file missing: ' + ogi['content'])
    # images
    for i, im in enumerate(s.find_all('img')):
        if im.get('alt') is None: add('critical', rel, 'img without alt: ' + str(im.get('src'))[:60])
        if not (im.get('width') and im.get('height')): add('warn', rel, 'img without width/height (CLS): ' + str(im.get('src'))[:60])
        src = im.get('src', '')
        if src.startswith('/') and not os.path.exists(PUB + src.split('?')[0]): add('critical', rel, 'img file missing: ' + src)
    # links
    for a in s.find_all('a', href=True):
        h = a['href']
        if h.startswith('#'):
            if h != '#' and not s.find(id=h[1:]): add('warn', rel, 'broken in-page anchor ' + h)
        elif not local_exists(h): add('critical', rel, 'broken internal link ' + h)
        if h.startswith('http') and 'noopener' not in (a.get('rel') or []) and not h.startswith(DOMAIN): add('info', rel, 'external link without rel=noopener: ' + h[:60])
    # json-ld
    blocks = s.find_all('script', type='application/ld+json'); types = []
    if not blocks and not is404: add('critical', rel, 'no JSON-LD')
    for b in blocks:
        try: data = json.loads(b.string)
        except Exception as e: add('critical', rel, f'invalid JSON-LD: {e}'); continue
        txt = json.dumps(data)
        for pat in PLACEHOLDER:
            if re.search(pat, txt, re.I): add('critical', rel, 'placeholder text in JSON-LD: ' + pat)
        if 'null' in txt.replace('"', '') and ': null' in txt: add('warn', rel, 'null value in JSON-LD')
        graph = data.get('@graph', [data]); gids = {n.get('@id') for n in graph if n.get('@id')}
        for n in graph:
            ty = n.get('@type'); types += ty if isinstance(ty, list) else [ty]
            if 'FAQPage' in (ty if isinstance(ty, list) else [ty]): add('info', rel, 'FAQPage present (rich results retired May 2026; no SERP benefit)')
            for k, v in n.items():
                if isinstance(v, str) and v.startswith('/') and k in ('url', 'image', 'item'): add('critical', rel, f'relative URL in JSON-LD {k}: {v}')
        # every {"@id": ...} reference must resolve in-graph or to a sitewide id
        def refs(o):
            if isinstance(o, dict):
                if list(o.keys()) == ['@id']: yield o['@id']
                for v in o.values(): yield from refs(v)
            elif isinstance(o, list):
                for v in o: yield from refs(v)
        site_ids = {DOMAIN + '/#website', DOMAIN + '/#practice', DOMAIN + '/#doctor'}
        for r in set(refs(data)):
            if r not in gids and r not in site_ids: add('warn', rel, 'unresolved @id ' + r)
    # copy / compliance
    body = s.get_text(' ', strip=True); wc = len(body.split())
    for pat in BANNED:
        m = re.search(pat, body, re.I)
        if m: add('critical', rel, f'advertising-claim wording: "{m.group(0)}"')
    for pat in PLACEHOLDER:
        m = re.search(pat, body, re.I)
        if m: add('critical', rel, f'placeholder text on page: "{m.group(0)}"')
    if not is404 and rel not in ('/',) and wc < 250 and not rel.startswith(('/locations/', '/faq', '/blog/')): add('info', rel, f'thin content ({wc} words)')
    ans = s.find(class_='answer')
    rows.append((rel, len(t), len(d), len(h1), wc, ','.join(sorted({x for x in types if x})), 'yes' if ans else 'no'))
for t, ps in titles.items():
    if len(ps) > 1: add('critical', ','.join(ps), 'duplicate title: ' + t)
for d, ps in descs.items():
    if len(ps) > 1: add('critical', ','.join(ps), 'duplicate meta description')
# sitewide files
for f in ('robots.txt', 'sitemap.xml', 'llms.txt', 'favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'site.webmanifest', '404.html'):
    if not os.path.exists(f'{PUB}/{f}'): add('critical', '/' + f, 'missing sitewide file')
sm = open(f'{PUB}/sitemap.xml').read() if os.path.exists(f'{PUB}/sitemap.xml') else ''
for rel in pages:
    if rel.startswith('/404'): continue
    if DOMAIN + rel not in sm: add('critical', rel, 'not in sitemap.xml')
rt = open(f'{PUB}/robots.txt').read() if os.path.exists(f'{PUB}/robots.txt') else ''
if 'Sitemap:' not in rt: add('critical', '/robots.txt', 'no Sitemap directive')
for bot in ('OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot', 'Googlebot', 'Bingbot'):
    if not re.search(rf'User-agent: {bot}\s+Allow: /', rt): add('warn', '/robots.txt', f'{bot} not explicitly allowed')
size = {f: os.path.getsize(f'{PUB}/assets/{f}') for f in ('css/site.css', 'js/site.js')}

order = {'critical': 0, 'warn': 1, 'info': 2}
issues.sort(key=lambda x: (order[x[0]], x[1]))
cnt = collections.Counter(i[0] for i in issues)
L = [f'# Pre-launch audit ({len(pages)} pages)\n', f'Critical: **{cnt["critical"]}** · Warnings: **{cnt["warn"]}** · Info: **{cnt["info"]}**\n',
     f'CSS {size["css/site.css"]//1024} KB · JS {size["js/site.js"]//1024} KB (uncompressed)\n', '## Findings\n']
L += [f'- **{s.upper()}** `{p}`: {m}' for s, p, m in issues] or ['- none']
L += ['\n## Page table\n', '| Page | Title | Meta | H1 | Words | Schema | Answer-first block |', '|---|---|---|---|---|---|---|']
L += [f'| {r[0]} | {r[1]} | {r[2]} | {r[3]} | {r[4]} | {r[5]} | {r[6]} |' for r in rows]
rep = '\n'.join(L)
print(rep if not OUT else rep[:3000])
if OUT: open(OUT, 'w').write(rep)
sys.exit(1 if cnt['critical'] else 0)
