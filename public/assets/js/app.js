/* Rizwin Orthodontics: interactive home sections (story, simulator, quiz, FAQ tabs). Progressive enhancement; content is in the HTML. */
(function(){
'use strict';
var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};
var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
var NS='http://www.w3.org/2000/svg';
function f(n){return Math.round(n*100)/100}

/* ---------- story: one more tooth falls into line per chapter ---------- */
(function(){
 var root=$('[data-story]');if(!root)return;
 var teeth=$$('.st',root),chs=$$('.chapter',root),bar=$('.prog b',root);
 var off=[[-7,12,-15],[8,-9,19],[-5,15,-23],[10,-5,17],[-9,9,-13],[6,-11,21]];
 function set(n){
  teeth.forEach(function(g,i){var cx=38+56*i,o=off[i],on=i<n;
   g.style.transformOrigin=cx+'px 75px';
   g.style.transform=on?'none':'translate('+o[0]+'px,'+o[1]+'px) rotate('+o[2]+'deg)'});
  chs.forEach(function(c,i){c.classList.toggle('on',i===n-1)});
  if(bar)bar.style.width=(n/6*100)+'%';
 }
 set(1);
 if(!('IntersectionObserver' in window)){set(6);return}
 var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)set(+e.target.getAttribute('data-ch'))})},{rootMargin:'-40% 0px -50% 0px'});
 chs.forEach(function(c){io.observe(c)});
})();

/* ---------- concern simulator ---------- */
(function(){
 var root=$('[data-sim]');if(!root)return;
 var front=$('.sim-front',root),side=$('.sim-side',root),range=$('[data-range]',root),stage=$('[data-stage]',root),play=$('[data-play]',root);
 var UP=[[-152,24,62],[-128,28,66],[-99,34,74],[-65,36,68],[-24,46,74],[24,46,74],[65,36,68],[99,34,74],[128,28,66],[152,24,62]];
 var LO=[[-130,24,64],[-106,26,66],[-80,30,70],[-50,30,68],[-16,30,68],[16,30,68],[50,30,68],[80,30,70],[106,26,66],[130,24,64]];
 var cU=[[0,0,0,0],[2,0,-3,0],[12,-16,-8,-.08],[16,-4,12,-.2],[6,2,-7,0],[-5,0,9,0],[-14,-2,-14,-.18],[-8,-8,6,-.05],[-2,0,3,0],[0,0,0,0]];
 var cL=[[0,0,0,0],[2,0,4,0],[4,2,-6,0],[8,0,-14,-.15],[5,0,10,-.1],[-4,2,-12,-.1],[-6,0,12,-.12],[-3,2,6,0],[-2,0,-4,0],[0,0,0,0]];
 var T='M-.46 0C-.5 .2 -.5 .72 -.46 .9C-.44 1 -.3 1 0 1C.3 1 .44 1 .46 .9C.5 .72 .5 .2 .46 0C.2 -.04 -.2 -.04 -.46 0Z';
 function defs(p){return '<defs><linearGradient id="'+p+'g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffdf8"/><stop offset=".55" stop-color="#f4eee2"/><stop offset="1" stop-color="#d9cfbd"/></linearGradient><linearGradient id="'+p+'m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8566a"/><stop offset="1" stop-color="#ee9eaa"/></linearGradient><path id="'+p+'t" vector-effect="non-scaling-stroke" d="'+T+'"/></defs>'}
 front.innerHTML=defs('simF')+'<rect x="30" y="26" width="460" height="64" rx="30" fill="url(#simFm)"/><rect x="40" y="204" width="440" height="62" rx="30" fill="url(#simFm)"/><g id="simFU"></g><g id="simFL"></g>';
 side.innerHTML=defs('simS')+'<rect x="150" y="6" width="44" height="50" rx="14" fill="url(#simSm)"/><rect x="6" y="236" width="150" height="48" rx="14" fill="url(#simSm)"/><g id="simSL"></g><g id="simSU"></g>';
 var gU=$('#simFU',front),gL=$('#simFL',front),sU=$('#simSU',side),sL=$('#simSL',side);
 function mk(parent,n){var out=[];for(var i=0;i<n;i++){var u=document.createElementNS(NS,'use');u.setAttribute('class','tooth');parent.appendChild(u);out.push(u)}return out}
 var uu=mk(gU,10).map(function(u){u.setAttribute('href','#simFt');u.setAttribute('fill','url(#simFg)');return u}),
     ll=mk(gL,10).map(function(u){u.setAttribute('href','#simFt');u.setAttribute('fill','url(#simFg)');return u});
 var su=mk(sU,1)[0],sl=mk(sL,1)[0];su.setAttribute('href','#simSt');sl.setAttribute('href','#simSt');su.setAttribute('fill','url(#simSg)');sl.setAttribute('fill','url(#simSg)');
 var key='crowd';
 function draw(pos){
  var u=1-pos/100;
  UP.forEach(function(b,i){var x=b[0],dx=0,dy=0,r=0,sx=1,sy=1,sg=x<0?-1:1;
   if(key==='crowd'){var o=cU[i];dx=o[0]*u;dy=o[1]*u;r=o[2]*u;sx=1+o[3]*u}
   else if(key==='space'){dx=x*.2*u+(i===4?-7*u:i===5?7*u:0);sx=1-.06*u}
   else if(key==='forward'){if(i===4||i===5){dx=sg*7*u;r=-sg*6*u;sy=1+.14*u}else if(i===3||i===6){dx=sg*10*u;r=-sg*4*u;sy=1+.08*u}else if(i===2||i===7){dx=sg*4*u}}
   else if(key==='open'){dy=(i===4||i===5)?-14*u:(i===3||i===6)?-11*u:(i===2||i===7)?-5*u:0}
   else if(key==='deep'){dy=(i===4||i===5)?6*u:(i===3||i===6)?4*u:0}
   uu[i].setAttribute('transform','translate('+f(260+x+dx)+','+f(80+dy)+') rotate('+f(r)+') scale('+f(b[1]*sx)+','+f(b[2]*sy)+')')});
  LO.forEach(function(b,i){var x=b[0],dx=0,dy=0,r=0,sx=1;
   if(key==='crowd'){var o=cL[i];dx=o[0]*u;dy=o[1]*u;r=o[2]*u;sx=1+o[3]*u}
   else if(key==='space'){dx=x*.16*u;sx=1-.05*u}
   else if(key==='open'){dy=(i===4||i===5)?16*u:(i===3||i===6)?12*u:(i===2||i===7)?6*u:0}
   ll[i].setAttribute('transform','translate('+f(260+x+dx)+','+f(214+dy)+') rotate('+f(r)+') scale('+f(b[1]*sx)+','+f(-b[2])+')')});
  /* side view: lips to the left; upper incisor pivots at its root */
  var uy=44+(key==='open'?-18*u:key==='deep'?14*u:0),ur=key==='forward'?30*u:0,ly=(key==='open'?16*u:key==='deep'?-6*u:0);
  su.setAttribute('transform','translate(160,'+f(uy)+') rotate('+f(ur)+') scale(40,84)');
  sl.setAttribute('transform','translate(128,'+f(246+ly)+') scale(34,-76)');
  stage.textContent=pos<8?'Before':pos>92?'After':'Correcting…';
 }
 function pick(k){key=k;$$('.sim-tabs button',root).forEach(function(b){b.setAttribute('aria-selected',b.getAttribute('data-k')===k?'true':'false')});
  $$('.sim-info',root).forEach(function(p){p.classList.toggle('on',p.getAttribute('data-k')===k)});range.value=0;draw(0)}
 $$('.sim-tabs button',root).forEach(function(b){b.addEventListener('click',function(){stopPlay();pick(b.getAttribute('data-k'))})});
 range.addEventListener('input',function(){stopPlay();draw(+range.value)});
 var raf=0;function stopPlay(){if(raf){cancelAnimationFrame(raf);raf=0}play.textContent='▶ Play'}
 play.addEventListener('click',function(){if(raf){stopPlay();return}
  if(reduce){range.value=100;draw(100);return}
  var from=+range.value>=100?0:+range.value,t0=performance.now(),dur=2600*(1-from/100)+400;play.textContent='❚❚ Pause';
  (function step(t){var p=Math.min(1,(t-t0)/dur),v=from+(100-from)*(p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2);range.value=v;draw(v);if(p<1)raf=requestAnimationFrame(step);else stopPlay()})(t0)});
 pick('crowd');
})();

/* ---------- candidate quiz ---------- */
(function(){
 var root=$('[data-quiz]');if(!root)return;
 var W=JSON.parse(root.getAttribute('data-worries')||'{}'),V=JSON.parse(root.getAttribute('data-verdicts')||'{}');
 var form=$('.quiz-form',root),box=$('[data-verdict]',root),cnt=$('[data-count]',root);
 function get(){var a={};$$('input:checked',form).forEach(function(i){a[i.name]=i.value});return a}
 function upd(){var a=get(),n=Object.keys(a).length;
  if(n<5){cnt.textContent=n+' of 5 answered';box.hidden=true;return}
  cnt.textContent='✓ All answered';
  var k=a.age==='Under 12'?'growth':a.gums==='Loose teeth or gum disease'?'gums':a.wear==='Honestly, I’m not sure'?'wear':a.concern==='My bite doesn’t feel right'?'bite':'good';
  var v=V[k],body=v[1];if(a.gums==='My gums bleed sometimes'&&a.age!=='Under 12')body+=' A quick professional cleaning before we start is a good idea.';
  $('[data-vt]',box).textContent=v[0];$('[data-vb]',box).textContent=body;
  var w=$('[data-vw]',box);w.textContent=W[a.worry]?'“'+a.worry+'” '+W[a.worry]:'';w.hidden=!W[a.worry];
  box.classList.toggle('warn',!!v[2]);box.hidden=false;
  if(!reduce)box.scrollIntoView({block:'nearest',behavior:'smooth'});
  if(window.dataLayer)dataLayer.push({event:'quiz_complete',verdict:k});
 }
 form.addEventListener('change',upd);
 $('[data-reset]',root).addEventListener('click',function(){$$('input',form).forEach(function(i){i.checked=false});upd();root.scrollIntoView({behavior:reduce?'auto':'smooth'})});
})();

/* ---------- FAQ tabs ---------- */
(function(){
 var root=$('[data-faq]');if(!root)return;
 var tabs=$$('[role=tab]',root),panels=$$('.faq-panel',root);
 function pick(k,focus){tabs.forEach(function(t){var on=t.getAttribute('data-k')===k;t.setAttribute('aria-selected',on?'true':'false');t.tabIndex=on?0:-1;if(on&&focus)t.focus()});
  panels.forEach(function(p){p.classList.toggle('on',p.getAttribute('data-k')===k)})}
 tabs.forEach(function(t,i){t.addEventListener('click',function(){pick(t.getAttribute('data-k'))});
  t.addEventListener('keydown',function(e){var j=e.key==='ArrowRight'?i+1:e.key==='ArrowLeft'?i-1:-1;if(j<0)return;e.preventDefault();pick(tabs[(j+tabs.length)%tabs.length].getAttribute('data-k'),true)})});
 var h=(location.hash.match(/^#faq-(\w+)/)||[])[1];
 pick(h&&$('[data-k="'+h+'"]',root)?h:tabs[0].getAttribute('data-k'));
})();

/* ---------- 3D figures as pre-rendered video (the 3D engine is only fetched on request) ----------
   Every 3D scene was rendered offline from the same gate-checked geometry into short H.264 clips.
   Nothing is fetched until the page has loaded and a figure is near the screen; then only that figure's poster
   (~20 KB) and clip (~100-400 KB) load. Sliders and chapter scrolls scrub the video; readouts come from the manifest.
   "Explore in 3D" (simulator only) loads the live three.js scene on demand. */
(function(){
 var els=$$('[data-3d]');if(!els.length)return;
 var me=document.currentScript||$('script[src*="app.js"]'),base=me&&me.src?me.src:location.href;
 var D3D=new URL('dental3d.ae09de74bc.js',base).href,VDIR=new URL('../video/',base).href,MAN=new URL('../video/manifest.json?v=63dc4456',base).href;
 var hasVideo=!!document.createElement('video').canPlayType;if(!hasVideo)return;
 var man=null;function manifest(){return man||(man=fetch(MAN).then(function(r){return r.json()}))}
 function src(c,m){var v=m[c]?('?v='+m[c].v):'';return{mp4:VDIR+c+'.mp4'+v,poster:VDIR+c+'.webp'+v}}
 function makeVideo(host,c,m,loop){var s=src(c,m),v=document.createElement('video');v.className='v3d';v.muted=true;v.defaultMuted=true;v.playsInline=true;v.setAttribute('playsinline','');v.setAttribute('aria-hidden','true');v.preload='auto';v.poster=s.poster;if(loop)v.loop=true;
  v.innerHTML='<source src="'+s.mp4+'" type="video/mp4">';host.insertBefore(v,host.firstChild);return v}
 function swap(v,c,m){var s=src(c,m);v.poster=s.poster;v.innerHTML='<source src="'+s.mp4+'" type="video/mp4">';v.load()}
 function seek(v,t){ // t in 0..1, waits for metadata
  if(!(v.readyState>=1)){v.__pending=t;if(!v.__w){v.__w=1;v.addEventListener('loadedmetadata',function(){v.__w=0;if(v.__pending!=null){seek(v,v.__pending);v.__pending=null}})}return}
  var d=v.duration||0;if(!d)return;var to=Math.min(d-0.001,Math.max(0,t*d));if(Math.abs(v.currentTime-to)>0.008)v.currentTime=to}
 function visible(el,cb){var on=false,io=new IntersectionObserver(function(es){on=es[0].isIntersecting;cb(on)});io.observe(el);return function(){return on}}
 function frameOf(v,meta){return Math.min(meta.frames-1,Math.max(0,Math.round((v.currentTime||0)*meta.fps)))}

 function sim(root,m){
  var host=$('.sim3d',root),range=$('[data-range]',root),read=$('[data-measure]',root);if(!host||!range)return;
  var concern=($('.sim-tabs [aria-selected="true"]',root)||{}).getAttribute?$('.sim-tabs [aria-selected="true"]',root).getAttribute('data-k'):'crowd',view='front',v;
  var clip=function(){return 'sim-'+concern+'-'+view};
  v=makeVideo(host,clip(),m);root.dataset.three='1';
  var auto=function(k){return k==='open'||k==='deep'||k==='forward'?'side':'front'};
  function setView(x){view=x;$$('[data-view]',root).forEach(function(b){b.setAttribute('aria-pressed',b.getAttribute('data-view')===x?'true':'false')});swap(v,clip(),m);last=-1}
  $$('.sim-tabs button',root).forEach(function(b){b.addEventListener('click',function(){concern=b.getAttribute('data-k');setView(auto(concern))})});
  $$('[data-view]',root).forEach(function(b){b.addEventListener('click',function(){setView(b.getAttribute('data-view'))})});
  var last=-1,isOn=visible(root,function(on){if(on)loop()}),raf=0;
  function loop(){if(raf)return;(function f(){raf=0;if(!isOn()||root.__live)return;var t=(+range.value||0)/100;if(t!==last){last=t;seek(v,t);
    var meta=m[clip()];if(read&&meta&&meta.measure){var r=meta.measure[Math.round(t*(meta.frames-1))];read.textContent='Overjet '+r[0].toFixed(1)+' mm, overbite '+r[1].toFixed(1)+' mm'}}
    raf=requestAnimationFrame(f)})()}
  loop();
  // live 3D, only if asked for
  var ui=$('.sim3d-ui',root);if(ui&&window.WebGL2RenderingContext){var b=document.createElement('button');b.type='button';b.className='go3d';b.textContent='Explore in 3D';
   b.addEventListener('click',function(){b.disabled=true;b.textContent='Loading 3D…';import(D3D).then(function(mod){root.__live=1;v.remove();mod.mount(root);b.remove()}).catch(function(){b.disabled=false;b.textContent='Explore in 3D'})});ui.appendChild(b)}
 }
 function spaces(fig,m){
  var host=$('.closing3d',fig);if(!host){host=document.createElement('div');host.className='closing3d';fig.insertBefore(host,$('.hud',fig))}
  var v=makeVideo(host,'spaces',m),range=$('input[type=range]',fig),rd=$('.rd b',fig),meta=m.spaces;fig.dataset.three='1';
  var last=-1,isOn=visible(fig,function(on){if(on)f()}),raf=0;
  function f(){raf=0;if(!isOn())return;var t=(+range.value||0)/100;if(t!==last){last=t;seek(v,t);if(rd&&meta&&meta.gap)rd.textContent=meta.gap[Math.round(t*(meta.frames-1))]}raf=requestAnimationFrame(f)}
  f();
 }
 function story(root,m){
  var host=$('.story3d',root);if(!host)return;var v=makeVideo(host,'story',m);root.dataset.three='1';
  var target=1,cur=1,raf=0;
  $$('.chapter',root).forEach(function(c){new IntersectionObserver(function(es){if(es[0].isIntersecting){target=+c.getAttribute('data-ch');go()}},{rootMargin:'-40% 0px -50% 0px'}).observe(c)});
  function go(){if(raf)return;(function f(){cur+=(target-cur)*0.12;if(Math.abs(target-cur)<0.01)cur=target;seek(v,(cur-1)/5);raf=cur===target?0:requestAnimationFrame(f)})()}
  go();
 }
 function thermo(root,m){
  var host=$('.thermo3d',root);if(!host)return;var v=makeVideo(host,'thermo',m,true),meta=m.thermo;root.dataset.three='1';
  var out=$('[data-readout]',root),scrub=$('[data-scrub]',root),play=$('[data-play]',root),steps=$$('[data-step]',root);
  var PH={heating:1.0,pressing:5.2,forming:7.4,cooling:9.6,released:11.6},names=['ready','heating','pressing','forming','cooling','released'],starts=[0,1.0,5.2,7.4,9.6,11.6];
  var user=false,reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setPlay(p){if(play){play.setAttribute('aria-pressed',p?'true':'false');play.querySelector('span').textContent=p?'Pause':'Play'}}
  function upd(){var tm=v.currentTime||0;if(meta&&meta.text&&out){var f=frameOf(v,meta),txt=meta.text[0][1];meta.text.forEach(function(e){if(e[0]<=f)txt=e[1]});if(out.textContent!==txt)out.textContent=txt}
   var k=0;starts.forEach(function(s,i){if(tm>=s)k=i});steps.forEach(function(b){b.setAttribute('aria-current',b.getAttribute('data-step')===names[k]?'step':'false')});
   if(scrub&&!scrub.__drag&&v.duration)scrub.value=String(Math.round(tm/v.duration*1000))}
  v.addEventListener('timeupdate',upd);v.addEventListener('seeked',upd);
  if(scrub){scrub.addEventListener('input',function(){scrub.__drag=1;v.pause();setPlay(false);user=true;seek(v,+scrub.value/1000)});scrub.addEventListener('change',function(){scrub.__drag=0})}
  steps.forEach(function(b){b.addEventListener('click',function(){var t0=PH[b.getAttribute('data-step')];user=false;if(v.readyState>=1)v.currentTime=t0+0.02;else v.__pending=(t0+0.02)/15;v.play().catch(function(){});setPlay(true)})});
  if(play)play.addEventListener('click',function(){if(v.paused){user=false;v.play().catch(function(){});setPlay(true)}else{user=true;v.pause();setPlay(false)}});
  visible(root,function(on){if(on&&!user&&!reduce){v.play().catch(function(){});setPlay(true)}else if(!on){v.pause();if(!user)setPlay(false)}});
  setPlay(false);
 }
 function mount(el){if(el.__m)return;el.__m=1;manifest().then(function(m){var k=el.getAttribute('data-3d');
  if(k==='sim')sim(el,m);else if(k==='spaces')spaces(el,m);else if(k==='story')story(el,m);else if(k==='thermo')thermo(el,m)}).catch(function(){})}
 function start(){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){io.unobserve(e.target);mount(e.target)}})},{rootMargin:'500px 0px'});els.forEach(function(e){io.observe(e)})}
 if(document.readyState==='complete')start();else window.addEventListener('load',start,{once:true});
})();

/* ---------- newest Instagram reels (from /api/reels, refreshed at the edge every 5 minutes) ----------
   Added below the topic cards once the page has loaded, so it never shifts what the visitor is reading.
   If the feed is not configured or Instagram is unreachable, the section simply keeps its static links. */
(function(){
 var box=$('[data-ig-feed]');if(!box||!window.fetch)return;
 var list=$('.ig-grid',box),handle=(box.querySelector('a')||{}).textContent||'';
 function esc(t){return String(t).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
 function ago(d){var s=(Date.now()-new Date(d))/1000;if(s<3600)return Math.max(1,Math.round(s/60))+' min ago';if(s<86400)return Math.round(s/3600)+' h ago';if(s<86400*30)return Math.round(s/86400)+' d ago';return new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
 function show(reels){if(!reels||!reels.length)return;
  list.innerHTML=reels.slice(0,6).map(function(r){var cap=r.caption||'Reel by @thealignerproject';
   return '<li><a href="'+esc(r.url)+'" target="_blank" rel="noopener" data-event="instagram_click"><img src="'+esc(r.thumb)+'" width="270" height="480" loading="lazy" decoding="async" alt="'+esc('Instagram reel by Dr. Rizwin: '+cap)+'"><span class="ig-play" aria-hidden="true"></span><span class="ig-cap">'+esc(cap)+'</span><span class="ig-date">'+ago(r.date)+'</span></a></li>'}).join('');
  box.hidden=false;}
 function go(){fetch('/api/reels',{credentials:'omit'}).then(function(r){return r.ok?r.json():null}).then(function(d){if(d)show(d.reels)}).catch(function(){})}
 var done=0;function once(){if(!done){done=1;go()}}
 function arm(){if(!('IntersectionObserver' in window)){once();return}var io=new IntersectionObserver(function(es){if(es.some(function(e){return e.isIntersecting})){io.disconnect();once()}},{rootMargin:'800px 0px'});io.observe(box.closest('section')||box.parentNode);setTimeout(once,6000)}
 if(document.readyState==='complete')arm();else window.addEventListener('load',arm,{once:true});
})();

/* ---------- guided photo slots on the consultation form ---------- */
(function(){
 $$('.slot input[type=file]').forEach(function(inp){
  inp.addEventListener('change',function(){var box=inp.closest('.slot'),f=inp.files&&inp.files[0];var pv=box.querySelector('.pv');
   if(f){pv.style.backgroundImage='url('+URL.createObjectURL(f)+')';box.classList.add('has')}else{pv.style.backgroundImage='';box.classList.remove('has')}
   var n=$$('.slot.has').length,c=$('[data-photo-count]');if(c)c.textContent=n+' / 8 added'});
 });
})();
})();
