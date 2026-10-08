// LK Jewellers: small helpers (no libraries)
const header=document.querySelector('header'),btn=document.querySelector('.menu-btn'),nav=document.querySelector('nav');
// Header turns frosted after scrolling (or while the mobile menu is open)
const solid=()=>header.classList.toggle('solid',scrollY>40||nav.classList.contains('open'));
addEventListener('scroll',solid,{passive:true});solid();
// Mobile menu
btn.addEventListener('click',()=>{const o=nav.classList.toggle('open');btn.setAttribute('aria-expanded',o);btn.textContent=o?'Close':'Menu';solid()});
// Footer year
const yr=document.getElementById('year');if(yr)yr.textContent=new Date().getFullYear();
// Reveal on scroll
const rv=document.querySelectorAll('.rv');
if('IntersectionObserver' in window){const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});rv.forEach(el=>io.observe(el));setTimeout(()=>rv.forEach(el=>el.classList.add('in')),3000)}else rv.forEach(el=>el.classList.add('in'));
// Homepage product slideshow: autoplay, arrows, dots, swipe and arrow keys
const car=document.querySelector('.car');
if(car){
  const slides=[...car.querySelectorAll('.slide')],dots=car.querySelector('.dots');
  const still=matchMedia('(prefers-reduced-motion: reduce)').matches;let i=0,timer=null,paused=false;
  slides.forEach((s,k)=>{const d=document.createElement('button');d.type='button';d.setAttribute('aria-label','Show '+s.dataset.name);d.addEventListener('click',()=>{go(k);play()});dots.appendChild(d)});
  function go(n){slides[i].classList.remove('on');slides[i].setAttribute('aria-hidden','true');slides[i].querySelectorAll('a').forEach(a=>a.tabIndex=-1);dots.children[i].removeAttribute('aria-current');
    i=(n+slides.length)%slides.length;slides[i].classList.add('on');slides[i].removeAttribute('aria-hidden');slides[i].querySelectorAll('a').forEach(a=>a.removeAttribute('tabindex'));dots.children[i].setAttribute('aria-current','true')}
  function play(){clearInterval(timer);if(!still&&!paused)timer=setInterval(()=>go(i+1),5500)}
  slides.forEach((s,k)=>{if(k){s.setAttribute('aria-hidden','true');s.querySelectorAll('a').forEach(a=>a.tabIndex=-1)}});
  dots.children[0].setAttribute('aria-current','true');
  car.querySelector('.prev').addEventListener('click',()=>{go(i-1);play()});
  car.querySelector('.next').addEventListener('click',()=>{go(i+1);play()});
  car.addEventListener('mouseenter',()=>{paused=true;play()});car.addEventListener('mouseleave',()=>{paused=false;play()});
  car.addEventListener('focusin',()=>{paused=true;play()});car.addEventListener('focusout',()=>{paused=false;play()});
  car.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){go(i-1);play()}if(e.key==='ArrowRight'){go(i+1);play()}});
  let x0=null;const st=car.querySelector('.stage');
  st.addEventListener('touchstart',e=>{x0=e.touches[0].clientX},{passive:true});
  st.addEventListener('touchend',e=>{if(x0===null)return;const dx=e.changedTouches[0].clientX-x0;if(Math.abs(dx)>40){go(dx<0?i+1:i-1);play()}x0=null});
  document.addEventListener('visibilitychange',()=>{paused=document.hidden;play()});
  play();
}
// Product galleries: thumbnail buttons swap the main image
document.querySelectorAll('.gal').forEach(g=>{
  const box=g.querySelector('.gal-main'),main=box.querySelector('img'),btns=g.querySelectorAll('.thumbs button');
  btns.forEach(b=>b.addEventListener('click',()=>{
    if(b.getAttribute('aria-pressed')==='true')return;
    btns.forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));
    main.classList.add('swap');
    const next=new Image();next.src=b.dataset.src;
    const show=()=>{main.src=b.dataset.src;main.alt=b.dataset.alt;box.classList.toggle('photo',b.dataset.type==='photo');requestAnimationFrame(()=>main.classList.remove('swap'))};
    (next.decode?next.decode():Promise.resolve()).then(show,show);
  }));
});
// Contact form: posts to Formspree (set your ID in contact.html)
const form=document.getElementById('contact-form');
if(form)form.addEventListener('submit',async e=>{e.preventDefault();const n=document.getElementById('note');
  try{const r=await fetch(form.action,{method:'POST',body:new FormData(form),headers:{Accept:'application/json'}});if(!r.ok)throw 0;form.reset();n.textContent='Thank you. We will reply within one working day.'}
  catch{n.textContent='Message not sent. Please email hello@lkjewellers.co.uk instead.'}});
// "Add to cart" is visual only for now: it just confirms the click
document.querySelectorAll('.add').forEach(b=>b.addEventListener('click',()=>{b.textContent='Added';b.classList.add('added');setTimeout(()=>{b.textContent='Add to cart';b.classList.remove('added')},1800)}));
// "Enquire" links use contact.html?enquire=Product+name; this pre-fills the message box
const q=new URLSearchParams(location.search).get('enquire'),msg=document.querySelector('textarea[name=message]');
if(q&&msg)msg.value='I would like to enquire about: '+q;
