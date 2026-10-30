# alignerthrissur.com (static site)

Plain static HTML/CSS/JS. Every page is a real URL with server-rendered content, so Google, Bing and AI crawlers (which mostly do not run JavaScript) see the full text, headings and JSON-LD.

## Repository layout
- `public/` is the website itself (what Netlify publishes): every page, `assets/`, `_headers`, `_redirects`, `robots.txt`, `sitemap.xml`, `llms.txt`.
- `netlify/functions/` holds the Instagram reels feed (`/api/reels` and `/api/reels/thumb/:id`).
- `netlify.toml` and `package.json` configure Netlify. `three/` is the 3D source and `tools/audit.py` the pre-launch check; neither is published.

## Deploy on Netlify
1. Push this repository to GitHub.
2. In Netlify: **Add new project → Import an existing project → GitHub**, pick the repository. Netlify reads `netlify.toml`, so leave the build settings as detected (publish directory `public`, no real build step). Deploy.
3. **Domain management → Add a domain**: add `alignerthrissur.com` and set it as the primary domain, then add `www.alignerthrissur.com` as an alias. Netlify redirects the alias to the primary domain, and `_redirects` does the same.
4. Point the domain at Netlify: either switch the domain's nameservers to Netlify DNS (simplest), or keep your registrar's DNS and add an `A` record for `@` to Netlify's load balancer IP and a `CNAME` for `www` to `<your-site>.netlify.app` (Netlify shows the exact values).
5. **HTTPS**: Netlify issues a free Let's Encrypt certificate automatically once DNS resolves; then turn on **Force HTTPS**.
6. `_headers` (HSTS, security headers, one-year caching for `/assets/*`) and `_redirects` are read by Netlify automatically.
7. Booking: the consultation and contact forms open WhatsApp (+91 97455 55066) with the patient's details, so no server or email setup is needed.

## Fill these before launch (the build never guesses them)
Edit `CFG` in the generator (`lib.py`) and rebuild, or edit the HTML/JSON-LD directly:
phone and WhatsApp, real opening hours (GBP currently says "Open 24 hours"), latitude/longitude (5+ decimals), Google Maps URL, `sameAs` profiles, GA4 id, credentials and registration number, and `reviewed=True` once Dr. Rizwin approves the clinical copy. Pages marked "Pending clinical review" and the "Provider details" box on the lingual page need his confirmation. Nothing appears in schema until it is filled.

## Name decision
The GBP name is "Dr.Rizwin"; the brand is "Rizwin Orthodontics". Schema uses the GBP name as `name` and the brand as `alternateName`. Pick one primary name and keep signage, GBP and directories identical.

## Verify
- `python3 tools/audit.py public` checks titles, meta, canonicals, one H1, alt text, broken links, JSON-LD ids, sitemap, robots and advertising-claim wording (last run: 0 critical, 0 warnings).
- Then run Lighthouse (mobile), Google Rich Results Test, Search Console + Bing Webmaster (submit `sitemap.xml`), claim Bing Places and Apple Business listings.
- Optional: install the claude-seo skills in Claude Code (`/plugin marketplace add AgriciDaniel/claude-seo`, then `/plugin install claude-seo@agricidaniel-claude-seo`) and run `/seo audit https://alignerthrissur.com`, `/seo local`, `/seo geo`.

## Crawler policy
`robots.txt` allows Googlebot, Bingbot and the citation crawlers (OAI-SearchBot, Claude-SearchBot, PerplexityBot). Model-training crawlers (GPTBot, ClaudeBot, Google-Extended, Applebot-Extended, CCBot) are allowed by default as a licensing choice; to opt out of training, rename `robots.alt-block-training.txt` to `robots.txt`. Blocking those does not affect search visibility. `llms.txt` is included but optional: Google says it has no effect on Search.

## Trust badge
The hero shows "Trusted by 10,000+ patients" from `patients_trusted` in CFG. Keep it only if Dr. Rizwin can substantiate the figure (Indian dental advertising norms); set it to None to hide it. Do not add it to schema.

## Notes
FAQPage schema is kept on blog and city pages for machine readability (Google retired FAQ rich results in May 2026, so it brings no SERP feature). Renderings are illustrative, not patients. Publish before/after photos only with written consent.

## Real-time 3D figures and the reality gate

Four figures on the site are rendered live with three.js: **See aligners at work** (concern simulator, front and side camera), **Watch spaces close**, **My story** (front teeth straightening chapter by chapter) and **Fig. 1, the aligner pressure former** (heat, drape, press, cool, release).

- The bundle `assets/js/dental3d.js` (about 145 KB gzipped) is loaded only when one of these figures comes within 600 px of the viewport, and never on data-saver connections or browsers without WebGL 2. Until then the original 2D drawings (and a still render for the pressure former) are shown, so nothing is lost without JavaScript.
- Every tooth is built at real crown size (mm), placed on a measured parabolic arch and packed to touching contacts. Treatment movement comes from one table of tooth displacements per concern.
- **Reality gate.** `three/gate.mjs` measures the actual 3D geometry before every build and stops the build if the model stops meeting reality:
  - Bite: overjet and overbite within normal limits at the finished result, lower incisors never ahead of the uppers, no teeth passing through each other in any frame, upper molars outside the lowers (no scissor or cross bite), Class I molars, closed contacts, and each concern's "before" really showing that concern.
  - Settled occlusion: every upper premolar and molar rests on the lower teeth (cusp clearance within 0.3 mm) in every frame of every concern, including open bite, where only the front teeth are apart.
  - Gums: built from the same crowns every frame. They must hug each tooth (margin 0.2-0.8 mm off the crown), never cover a visible crown, show 70-90% of each front crown, never tear, and keep the jaw (gum base) fixed while teeth move through it.
  Run it with `node three/gate.mjs`.
- Source lives in `three/` (`dental-core.mjs` anatomy and cusps, `gum-core.mjs` gums, `gate.mjs`, `tune.mjs` arch fitting, `src/dental3d.js` scenes). Rebuild the bundle with `npx esbuild three/src/dental3d.js --bundle --format=esm --minify --outfile=public/assets/js/dental3d.js`.

## Instagram reels on the site (auto-updating)

The home page shows the six newest Reels from @thealignerproject under the topic cards. New reels appear within about 5 minutes of posting. Nothing is loaded from Instagram in the visitor's browser: the site's own `/api/reels` function (a Netlify Function) reads the Instagram API, Netlify's CDN caches the result for 5 minutes, and covers are served from the site's own domain. If the feed isn't set up or Instagram is down, the section keeps its normal links to Instagram.

One-time setup (about 20 minutes):
1. In the Instagram app, make @thealignerproject a **Professional account** (Creator or Business): Settings → Account type and tools.
2. At developers.facebook.com, create an app (type **Business**), add the **Instagram** product, and choose **API setup with Instagram login**.
3. Under "Generate access tokens", add @thealignerproject, log in and approve the `instagram_business_basic` permission. Copy the token; it's a long-lived token that lasts 60 days.
4. In Netlify: **Project configuration → Environment variables → Add a variable**, name `IG_TOKEN`, paste the token, scope it to Functions, and mark it secret. Then **Deploys → Trigger deploy**. Netlify Blobs (the store `instagram`) is created automatically; nothing else to set up.
5. Open `https://alignerthrissur.com/api/reels`; you should see your latest reels as JSON.

The function refreshes the token automatically every 7 days and saves the new one in Netlify Blobs, so the feed never expires as long as the site gets visitors at least once every couple of months. To check Instagram more often, lower `TTL` in `netlify/functions/reels.mjs`; Instagram allows roughly 200 calls per hour per account. Never commit the token to GitHub.

## 3D figures as video (the 3D engine loads only on request)

The four 3D scenes (concern simulator, closing spaces, My story and the pressure former) are rendered offline into short videos from the same geometry the bite check approves. That's 15 simulator clips (5 concerns × front/side/open), plus spaces, story and thermoformer. The site plays and scrubs these videos; the three.js engine (≈145 KB compressed) is fetched only when a visitor taps **Explore in 3D** in the simulator.

- Each clip is an H.264 MP4 (plays in every browser), with a keyframe every 6 frames so sliders seek instantly. A poster image of about 20 KB is shown first.
- Nothing is requested until the page has loaded and the figure is within ~500 px of the screen; then only that figure's clip loads.
- **Simulator:** the Before→After slider scrubs the clip, and the overjet/overbite readout comes from the measurements recorded at each frame.
- **Spaces:** the slider scrubs the clip and the gap readout is the measured gap at each frame.
- **Story:** scrolling through the chapters scrubs the clip.
- **Pressure former:** the clip loops while on screen, and the step buttons and scrub bar seek it.
- Re-render after any change to the teeth, gums or scenes, in this order:
  1. `node three/gate.mjs`
  2. Serve `three/test/` on port 8771.
  3. `python3 three/capture.py <job>` for each job: `spaces`, `story`, `sim-front`, `sim-side`, `sim-three`, `thermo`.
  4. `python3 three/encode.py`, which writes `public/assets/video/` and its `manifest.json`.
  5. Build.

## Speed on slow connections

- **Nothing 3D loads until the page has finished loading**, so page load time and Largest Contentful Paint are unaffected. By default only the pre-rendered videos load; the live 3D bundle is fetched only on request ("Explore in 3D").
- **Low-power phones** (≤ 3 GB RAM or ≤ 4 cores) and slow links get a lighter render: lower pixel ratio, no shadows, fewer polygons. The bite check covers the geometry at every quality level.
- **Gum shapes** are cached for each pose, so replays and slider scrubbing cost nothing after the first pass.
- **Caching:** all CSS and JS get content hashes (`?v=` or a hashed filename), so `/assets/*` can be cached for a year without visitors ever seeing stale files after an update.
- **Mobile hero:** an 800 px hero image (35 KB) is served to typical phones, and only the headline font is preloaded.
- **Tested:** on emulated slow 3G (400 kbps, 400 ms latency, 4× CPU slowdown) the 3D bundle was requested only after the page load event, and the simulator mounted when scrolled to. On emulated 2G with data-saver, the scenes still mounted, about 20 s after the visitor scrolled to them on an uncompressed local server; Netlify's compression should make this several times faster.
