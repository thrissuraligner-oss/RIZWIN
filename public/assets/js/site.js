(function(){
'use strict';
var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* header turns frosted once the page scrolls */
var hdr=$('.site-header');
var st=document.getElementById('sticky-cta');
function onScroll(){if(hdr)hdr.classList.toggle('scrolled',window.scrollY>10);if(st)st.classList.toggle('show',window.scrollY>window.innerHeight*.85)}
window.addEventListener('scroll',onScroll,{passive:true});onScroll();

/* reveal on scroll (content is visible without JS) */
var io=('IntersectionObserver' in window)?new IntersectionObserver(function(en){en.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}})},{threshold:.1,rootMargin:'0px 0px -5% 0px'}):null;
window.__reveal=function(root){$$('[data-reveal]:not(.in)',root).forEach(function(el){io?io.observe(el):el.classList.add('in')})};
window.__reveal(document);

/* analytics events (GA4 loads only if a measurement id is configured) */
window.dataLayer=window.dataLayer||[];
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('[data-event]');if(a)window.dataLayer.push({event:a.getAttribute('data-event')})});

/* mobile menu */
var burger=$('.burger'),mw=$('.menu-wrap');
if(burger&&mw){burger.addEventListener('click',function(){var o=mw.classList.toggle('open');burger.setAttribute('aria-expanded',o?'true':'false')});
 $$('a',mw).forEach(function(a){a.addEventListener('click',function(){mw.classList.remove('open');burger.setAttribute('aria-expanded','false')})});
 document.addEventListener('keydown',function(e){if(e.key==='Escape'){mw.classList.remove('open');burger.setAttribute('aria-expanded','false')}})}

/* closing-spaces widget: real 3D-lit teeth glide together, gaps read out in mm */
var PX_PER_MM=14.2;
function initClosing(root){
  if(root.__init)return;root.__init=true;
  var svg=$('svg.scene',root),teeth=$$('.tooth',root),NS='http://www.w3.org/2000/svg';
  var yTop=+root.getAttribute('data-ytop')||96;
  var slider=$('input[type=range]',root),play=$('button',root),rd=$('.rd b',root),rdl=$('.rd span',root);
  var data=teeth.map(function(t){return{el:t,x0:+t.dataset.x0,x1:+t.dataset.x1,w:+t.dataset.w,side:+t.dataset.side,i:+t.dataset.i}});
  data.sort(function(a,b){return a.x0-b.x0});
  var layer=document.createElementNS(NS,'g');svg.appendChild(layer);
  var ghosts=data.map(function(d){var g=$('use',d.el).cloneNode(false);return g});
  // ghost outlines at planned positions
  data.forEach(function(d,k){var u=document.createElementNS(NS,'use');u.setAttribute('href',$('use[href]',d.el).getAttribute('href'));u.setAttribute('class','ghost');u.setAttribute('transform','translate('+d.x1+','+yTop+')');layer.insertBefore(u,layer.firstChild)});
  var labels=[],arrows=[];
  for(var k=0;k<data.length-1;k++){var t=document.createElementNS(NS,'text');t.setAttribute('class','gaplabel');layer.appendChild(t);labels.push(t)}
  data.forEach(function(){var p=document.createElementNS(NS,'path');p.setAttribute('class','arrow');layer.appendChild(p);arrows.push(p)});
  var p=0;
  function fmt(v){return v.toFixed(1)}
  function render(v){
    p=v;var total=0;
    data.forEach(function(d){var x=d.x0+(d.x1-d.x0)*v;d.cx=x;d.el.setAttribute('transform','translate('+x+','+yTop+')')});
    for(var k=0;k<data.length-1;k++){
      var a=data[k],b=data[k+1],gap=(b.cx-b.w/2)-(a.cx+a.w/2);gap=Math.max(gap,0);total+=gap;
      var mm=gap/PX_PER_MM,t=labels[k];
      t.textContent=mm>0.05?fmt(mm)+' mm':'';
      t.setAttribute('x',(a.cx+a.w/2+b.cx-b.w/2)/2);t.setAttribute('y',yTop-26);
    }
    data.forEach(function(d,k){
      var dx=d.x1-d.x0,ar=arrows[k];
      if(Math.abs(dx)<3||v>.97||v<.02){ar.setAttribute('d','');return}
      var y=yTop+86,dir=dx>0?1:-1,x=d.cx,len=Math.min(38,Math.abs(dx)*(1-v)+8);
      ar.setAttribute('d','M'+x+','+y+' h'+(dir*len)+' m'+(-dir*8)+',-6 l'+(dir*8)+',6 l'+(-dir*8)+',6');
    });
    if(slider)slider.value=Math.round(v*100);
    if(rd&&!root.dataset.three)rd.textContent=fmt(total/PX_PER_MM)+' mm';
    if(rdl)rdl.textContent=v>.98?'Space remaining: closed':'Space remaining';
  }
  render(0);
  var playing=false,raf=0,t0=0,dir=1,dur=5200,hold=900;
  function ease(x){return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2}
  function loop(ts){
    if(!playing)return;
    if(!t0)t0=ts;var e=ts-t0,cyc=dur*2+hold*2,m=e%cyc,v;
    if(m<hold)v=0;else if(m<hold+dur)v=ease((m-hold)/dur);else if(m<hold*2+dur)v=1;else v=1-ease((m-hold*2-dur)/dur);
    render(v);raf=requestAnimationFrame(loop);
  }
  function setPlay(on){playing=on;if(play){play.setAttribute('aria-label',on?'Pause animation':'Play animation');play.innerHTML=on?'<svg class="ico" viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>':'<svg class="ico" viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg>'}
    if(on){t0=0;raf=requestAnimationFrame(loop)}else cancelAnimationFrame(raf)}
  if(play)play.addEventListener('click',function(){setPlay(!playing)});
  if(slider)slider.addEventListener('input',function(){setPlay(false);render(slider.value/100)});
  setPlay(false);
  if(!reduce&&'IntersectionObserver' in window){
    var vis=new IntersectionObserver(function(en){en.forEach(function(x){if(x.isIntersecting&&!root.__user&&!playing)setPlay(true);if(!x.isIntersecting&&playing)setPlay(false)})},{threshold:.4});vis.observe(root);
    ['pointerdown','input'].forEach(function(ev){root.addEventListener(ev,function(e){if(e.target.closest&&e.target.closest('input,button'))root.__user=true})});
  } else render(1);
}
/* contact form: posts to /api/contact when an endpoint is configured, otherwise opens the email app */

window.__waSend=function(f,note){
  var L=[];function add(k,v){if(v&&String(v).trim())L.push(k+': '+String(v).trim())}
  if(!f.name.value.trim()){note.textContent='Please enter your name.';return}
  add('Name',f.name.value);add('Phone',f.phone&&f.phone.value);add('Email',f.email&&f.email.value);add('City',f.city&&f.city.value);add('Interested in',f.topic&&f.topic.value);
  [].forEach.call(f.querySelectorAll('[data-x]'),function(e){add(e.getAttribute('data-x'),e.value)});
  var files=[];[].forEach.call(f.querySelectorAll('input[type=file]'),function(i){if(i.files&&i.files[0])files.push(i.files[0])});
  var m=f.msg&&f.msg.value.trim();
  var text='Hello Dr. Rizwin, I would like to book a consultation.\n\n'+L.join('\n')+(m?'\n\nMy concern: '+m:'')+(files.length?'\n\nPhotos: '+files.length+' (attached with this message)':'');
  var url='https://wa.me/919745555066?text='+encodeURIComponent(files.length?text.replace('(attached with this message)','(I will attach them next in this chat)'):text),num='+91 97455 55066';
  window.dataLayer.push({event:'whatsapp_click'});
  function openWa(){var w=window.open(url,'_blank','noopener');if(!w)window.location.href=url;
    note.textContent=files.length?'WhatsApp opened with your message. Please attach your '+files.length+' photo(s) in the chat with the + button, then send.':'WhatsApp opened with your message ready to send.'}
  if(files.length&&navigator.canShare&&navigator.canShare({files:files})){
    note.textContent='Choose WhatsApp in the share menu, then Dr. Rizwin ('+num+').';
    navigator.share({files:files,text:text}).catch(function(err){if(err&&err.name==='AbortError'){note.textContent='Cancelled. Tap the WhatsApp button to try again.';return}openWa()});
    return}
  openWa();
};
var form=$('#contact-form');
if(form){form.addEventListener('submit',function(e){
  e.preventDefault();var note=$('#form-note'),f=form;
  if(f.website&&f.website.value)return;var mode=(e.submitter&&e.submitter.getAttribute('data-mode'))||'wa';if(mode==='wa'){window.__waSend(f,note);return}
  if(!f.name.value.trim()||!/^\S+@\S+\.\S+$/.test(f.email.value)){note.textContent='Please enter your name and a valid email address.';return}
  var xs=[].slice.call(f.querySelectorAll('[data-x]')).map(function(e){return e.getAttribute('data-x')+': '+e.value}).filter(function(s){return !/: $/.test(s)}).join('\n');var data={name:f.name.value,phone:f.phone.value,email:f.email.value,city:f.city.value,topic:f.topic.value,msg:(xs?xs+'\n\n':'')+f.msg.value};var nPhotos=[].slice.call(f.querySelectorAll('input[type=file]')).filter(function(i){return i.files&&i.files.length}).length;
  var ep=f.getAttribute('data-endpoint');
  if(ep){note.textContent='Sending...';var fd=new FormData(f);fd.set('msg',data.msg);fetch(ep,{method:'POST',body:fd}).then(function(r){if(!r.ok)throw 0;window.location.href='/thank-you/'}).catch(function(){note.textContent='Sorry, that did not send. Please email us directly.'});return}
  var body='Name: '+data.name+'\nPhone: '+(data.phone||'-')+'\nEmail: '+data.email+'\nFrom: '+data.city+'\nInterested in: '+data.topic+'\n\n'+data.msg;
  window.location.href='mailto:'+f.getAttribute('data-mailto')+'?subject='+encodeURIComponent('Consultation enquiry: '+data.topic+' ('+data.city+')')+'&body='+encodeURIComponent(body);
  note.textContent=(nPhotos?'Opening your email app. Please attach your '+nPhotos+' photo(s) to that email. ':'Opening your email app. ')+'If nothing opens, email '+f.getAttribute('data-mailto')+' directly.';
})}
window.__initClosing=function(root){$$('[data-closing]',root).forEach(initClosing)};
window.__initClosing(document);
})();
