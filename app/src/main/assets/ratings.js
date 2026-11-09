/* Kanonha ratings v1.0 — real server-backed votes, no demo ratings. */
(() => {
  'use strict';
  const backend=window.KanonhaBackend;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,ch=>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fmt=n=>Number(n).toLocaleString('fa-IR');
  const categoryNames={club:'کانون‌ها',professor:'اساتید',faculty:'دانشکده‌ها'};
  let category='club',targets=[],mine=new Map(),busy=false,seq=0,manager=false;

  const count=t=>Number(t.rating_count)||0;
  const average=t=>count(t)>0?Number(t.rating_sum)/count(t):0;
  const ordered=list=>list.slice().sort((a,b)=>
    average(b)-average(a)||count(b)-count(a)||
    a.title.localeCompare(b.title,'fa'));
  const validId=id=>/^[a-f0-9]{8}-[a-f0-9-]{27,}$/.test(String(id||''));

  function notice(text,error=false){
    const el=$('ratings-notice');
    if(!el)return;
    el.textContent=text;el.classList.toggle('error',error);el.hidden=!text;
  }
  function stars(value){
    const n=Math.max(0,Math.min(5,Math.round(value)));
    return '<span class="ratings-static-stars" aria-hidden="true">'+
      '<span>'+ '★'.repeat(n) + '</span>'+'☆'.repeat(5-n)+'</span>';
  }
  function ratingButtons(t){
    if(mine.has(t.id)){
      const value=mine.get(t.id);
      return '<div class="ratings-voted">'+stars(value)+
        '<span>رأی شما: '+fmt(value)+' از ۵ — ثبت‌شده</span></div>';
    }
    if(!backend||!backend.currentUser)
      return '<p class="ratings-login-hint">برای ثبت امتیاز وارد حساب دانشجویی شوید.</p>';
    let html='<div class="ratings-star-buttons" role="group" aria-label="ثبت امتیاز برای '+esc(t.title)+'">';
    for(let value=1;value<=5;value++)
      html+='<button type="button" data-rating-id="'+esc(t.id)+
        '" data-rating-value="'+value+'" aria-label="'+fmt(value)+
        ' ستاره برای '+esc(t.title)+'" '+(busy?'disabled':'')+'>★</button>';
    return html+'</div>';
  }
  function render(){
    const heading=$('ratings-category-heading');
    if(!heading)return;
    heading.textContent='امتیاز '+categoryNames[category];
    document.querySelectorAll('[data-ratings-tab]').forEach(el=>{
      const active=el.dataset.ratingsTab===category;
      el.classList.toggle('active',active);
      el.setAttribute('aria-selected',String(active));
      el.tabIndex=active?0:-1;
    });
    const list=ordered(targets.filter(t=>t.category===category));
    const leaders=list.filter(t=>count(t)>=5).slice(0,3);
    $('ratings-leader-list').innerHTML=leaders.length?leaders.map((t,i)=>
      '<div class="ratings-leader"><span class="ratings-rank">'+fmt(i+1)+'</span>'+
      '<span class="ratings-leader-name">'+esc(t.title)+'</span>'+
      '<strong>'+average(t).toFixed(2).replace('.', '٫')+' ★</strong></div>'
    ).join(''):'<p class="ratings-empty-leaders">با رسیدن هر مورد به ۵ رأی، برترین‌ها اینجا نمایش داده می‌شوند.</p>';
    $('ratings-list').innerHTML=list.length?list.map(t=>{
      const n=count(t),avg=average(t);
      return '<article class="ratings-card">'+
        '<div class="ratings-card-top"><div class="ratings-item-identity">'+
        '<span class="ratings-category-mark" aria-hidden="true">'+
        (category==='club'?'✦':category==='professor'?'◆':'▦')+'</span>'+
        '<div><h3>'+esc(t.title)+'</h3>'+
        (t.subtitle?'<p>'+esc(t.subtitle)+'</p>':'')+'</div></div>'+
        '<div class="ratings-score"><strong>'+ (n?avg.toFixed(2).replace('.', '٫'):'—')+
        '</strong><span>از ۵</span></div></div>'+
        '<div class="ratings-score-meta">'+stars(avg)+
        '<span>'+fmt(n)+' رأی'+(n>0&&n<5?' • رتبه موقت':'')+'</span></div>'+
        '<div class="ratings-vote-area"><span class="ratings-vote-label">'+
        (mine.has(t.id)?'امتیاز ثبت‌شده شما':'امتیاز شما')+'</span>'+
        ratingButtons(t)+'</div></article>';
    }).join(''):'<div class="ratings-empty-state"><span aria-hidden="true">☆</span>'+
      '<strong>هنوز موردی برای امتیازدهی ثبت نشده</strong>'+
      '<p>به محض ثبت اطلاعات واقعی، فهرست این بخش نمایش داده می‌شود.</p></div>';
    $('ratings-manager').hidden=!(manager && category==='professor');
  }
  async function refresh(){
    const current=++seq,userId=backend&&backend.currentUser?backend.currentUser.id:null;
    busy=true;notice('در حال به‌روزرسانی امتیازها…');
    if(!backend||!backend.enabled){
      targets=[];mine=new Map();manager=false;busy=false;
      notice('برای استفاده از نظرسنجی، اتصال امن آنلاین لازم است.',true);render();return;
    }
    try{
      const responses=await Promise.all([
        backend.ratingCatalog(),
        userId?backend.ratingMyVotes():Promise.resolve([]),
        userId?backend.isManager():Promise.resolve(false)
      ]);
      if(current!==seq || userId!==(backend.currentUser&&backend.currentUser.id||null))return;
      targets=responses[0].filter(t=>validId(t.id)&&
        Object.prototype.hasOwnProperty.call(categoryNames,t.category));
      mine=new Map(responses[1].map(v=>[v.target_id,Number(v.stars)]));
      manager=Boolean(responses[2]);
      notice(userId?'به هر مورد فقط یک‌بار می‌توانید ستاره بدهید.':
        'برای شرکت در رأی‌گیری ابتدا وارد حساب کاربری شوید.');
    }catch(error){
      if(current!==seq)return;
      targets=[];mine=new Map();manager=false;
      notice('دریافت نظرسنجی ناموفق بود؛ اتصال اینترنت و نسخه سرور را بررسی کنید.',true);
    }finally{
      if(current===seq){busy=false;render();}
    }
  }
  async function sendVote(id,value,button){
    if(busy||!validId(id)||!Number.isInteger(value)||value<1||value>5)return;
    if(!backend.currentUser){notice('ابتدا وارد حساب دانشجویی شوید.',true);return;}
    if(mine.has(id)){notice('برای این مورد قبلاً امتیاز ثبت کرده‌اید.',true);return;}
    if(!targets.some(t=>t.id===id)){notice('این مورد در فهرست معتبر نیست.',true);return;}
    busy=true;button.disabled=true;notice('در حال ثبت رأی شما…');
    try{
      await backend.ratingSubmit(id,value);
      await refresh();
      notice('امتیاز شما با موفقیت ثبت شد و قابل تغییر نیست.');
    }catch(error){
      busy=false;
      notice(error&&error.status===409?'برای این مورد قبلاً رأی ثبت کرده‌اید.':
        'ثبت رأی انجام نشد: '+String(error&&error.message||'خطای ارتباط').slice(0,100),true);
      await refresh();
    }
  }
  async function addProfessor(form){
    if(busy||!manager)return;
    const title=String(form.elements.title.value||'').trim();
    const subtitle=String(form.elements.subtitle.value||'').trim();
    if(title.length<2||title.length>120||subtitle.length>120){
      notice('نام استاد باید حداقل ۲ حرف و حداکثر ۱۲۰ حرف باشد.',true);return;
    }
    busy=true;const submit=form.querySelector('[type=submit]');
    if(submit)submit.disabled=true;
    try{
      await backend.ratingAddProfessor(title,subtitle);
      form.reset();
      await refresh();
      notice('استاد به فهرست نظرسنجی اضافه شد.');
    }catch(error){
      busy=false;
      notice('افزودن استاد انجام نشد: '+String(error&&error.message||'دسترسی یا ارتباط').slice(0,110),true);
    }finally{if(submit)submit.disabled=false;}
  }
  function init(){
    const root=$('screen-ratings');
    if(!root)return;
    root.addEventListener('click',e=>{
      const tab=e.target.closest('[data-ratings-tab]');
      if(tab){category=tab.dataset.ratingsTab;render();return;}
      const button=e.target.closest('[data-rating-id][data-rating-value]');
      if(button)void sendVote(button.dataset.ratingId,Number(button.dataset.ratingValue),button);
    });
    const form=$('ratings-professor-form');
    if(form)form.addEventListener('submit',e=>{e.preventDefault();void addProfessor(form);});
    render();
  }
  window.KanonhaRatings=Object.freeze({open:refresh});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
