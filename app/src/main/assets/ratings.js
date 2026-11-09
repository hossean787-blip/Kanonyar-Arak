/* Kanonha ratings v1.0 — real server-backed votes, no demo ratings. */
(() => {
  'use strict';
  const backend=window.KanonhaBackend;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,ch=>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fmt=n=>Number(n).toLocaleString('fa-IR');
  const categoryNames={club:'کانون‌ها',professor:'اساتید',faculty:'دانشکده‌ها'};
  let category='club',targets=[],mine=new Map(),busy=false,seq=0;
  let control={voting_open:false,results_published:false};

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
    if(!control.voting_open)
      return '<p class="ratings-login-hint">رأی‌گیری در حال حاضر بسته است.</p>';
    if(!backend||!backend.currentUser)
      return '<p class="ratings-login-hint">برای ثبت امتیاز وارد حساب دانشجویی شوید.</p>';
    let html='<div class="ratings-star-buttons" role="group" aria-label="ثبت امتیاز برای '+esc(t.title)+'">';
    for(let value=1;value<=5;value++)
      html+='<button type="button" data-rating-id="'+esc(t.id)+
        '" data-rating-value="'+value+'" aria-label="'+fmt(value)+
        ' ستاره برای '+esc(t.title)+'" '+(busy?'disabled':'')+'>★<small>'+fmt(value)+'</small></button>';
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
    const published=control.results_published;
    const list=published?ordered(targets.filter(t=>t.category===category)):
      targets.filter(t=>t.category===category).sort((a,b)=>a.title.localeCompare(b.title,'fa'));
    const leaders=published?list.filter(t=>count(t)>=5).slice(0,3):[];
    $('ratings-leader-list').innerHTML=!published?
      '<p class="ratings-empty-leaders">نتایج تا تأیید و انتشار توسط مدیرکل محرمانه می‌مانند.</p>':
      leaders.length?leaders.map((t,i)=>
      '<div class="ratings-leader"><span class="ratings-rank">'+fmt(i+1)+'</span>'+
      '<span class="ratings-leader-name">'+esc(t.title)+'</span>'+
      '<strong>'+average(t).toFixed(2).replace('.', '٫')+' ★</strong></div>'
    ).join(''):'<p class="ratings-empty-leaders">برای اعلام رتبه رسمی، هر مورد به حداقل ۵ رأی نیاز دارد.</p>';
    $('ratings-list').innerHTML=list.length?list.map(t=>{
      const n=count(t),avg=average(t);
      return '<article class="ratings-card">'+
        '<div class="ratings-card-top"><div class="ratings-item-identity">'+
        '<span class="ratings-category-mark" aria-hidden="true">'+
        (category==='club'?'✦':category==='professor'?'◆':'▦')+'</span>'+
        '<div><h3>'+esc(t.title)+'</h3>'+
        (t.subtitle?'<p>'+esc(t.subtitle)+'</p>':'')+'</div></div>'+
        (published?'<div class="ratings-score"><strong>'+
          (n?avg.toFixed(2).replace('.', '٫'):'—')+
          '</strong><span>از ۵</span></div>':'<span class="ratings-private-tag">نتایج محرمانه</span>')+
        '</div>'+
        (published?'<div class="ratings-score-meta">'+stars(avg)+
        '<span>'+fmt(n)+' رأی'+(n>0&&n<5?' • رتبه موقت':'')+'</span></div>':'')+
        '<div class="ratings-vote-area"><span class="ratings-vote-label">'+
        (mine.has(t.id)?'امتیاز ثبت‌شده شما':'امتیاز شما')+'</span>'+
        ratingButtons(t)+'</div></article>';
    }).join(''):'<div class="ratings-empty-state"><span aria-hidden="true">☆</span>'+
      '<strong>هنوز موردی برای امتیازدهی ثبت نشده</strong>'+
      '<p>مدیرکل باید موارد واقعی نظرسنجی را ثبت کند.</p></div>';
  }
  async function refresh(){
    const current=++seq,userId=backend&&backend.currentUser?backend.currentUser.id:null;
    busy=true;notice('در حال دریافت وضعیت نظرسنجی…');
    if(!backend||!backend.enabled){
      targets=[];mine=new Map();control={voting_open:false,results_published:false};busy=false;
      notice('برای استفاده از نظرسنجی، اتصال امن آنلاین لازم است.',true);render();return;
    }
    try{
      const responses=await Promise.all([
        backend.ratingCatalog(),backend.ratingControl(),
        userId?backend.ratingMyVotes():Promise.resolve([]),
        userId?backend.ratingResults():Promise.resolve([])
      ]);
      if(current!==seq||userId!==(backend.currentUser&&backend.currentUser.id||null))return;
      control=responses[1];
      const scores=new Map(control.results_published?responses[3].map(row=>[row.target_id,row]):[]);
      targets=responses[0].filter(t=>validId(t.id)&&
        Object.prototype.hasOwnProperty.call(categoryNames,t.category)).map(t=>{
          const info=scores.get(t.id);
          return {...t,rating_count:info?Number(info.rating_count):0,
            rating_sum:info?Number(info.rating_sum):0};
        });
      mine=new Map(responses[2].map(v=>[v.target_id,Number(v.stars)]));
      notice(control.voting_open
        ?(userId?'نظرسنجی به دستور مدیرکل فعال است. هر دانشجو به هر مورد فقط یک رأی می‌دهد.':
           'نظرسنجی فعال است؛ برای ثبت امتیاز وارد حساب دانشجویی شوید.')
        :control.results_published
          ?'رأی‌گیری بسته شده و نتایج با تأیید مدیرکل منتشر شده‌اند.'
          :'نظرسنجی بسته است. نتایج فقط پس از تأیید مدیرکل نمایش داده می‌شوند.');
    }catch(error){
      if(current!==seq)return;
      targets=[];mine=new Map();control={voting_open:false,results_published:false};
      notice('دریافت نظرسنجی ناموفق بود؛ ارتباط با سرور را بررسی کنید.',true);
    }finally{
      if(current===seq){busy=false;render();}
    }
  }
  async function sendVote(id,value,button){
    if(busy||!validId(id)||!Number.isInteger(value)||value<1||value>5)return;
    if(!control.voting_open){notice('تنها مدیرکل می‌تواند رأی‌گیری را فعال کند.',true);return;}
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
      const message=error&&error.status===409?'برای این مورد قبلاً رأی ثبت کرده‌اید.':
        'ثبت رأی انجام نشد: '+String(error&&error.message||'خطای ارتباط').slice(0,100);
      await refresh();
      notice(message,true);
    }
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
    render();
  }
  window.KanonhaRatings=Object.freeze({open:refresh});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
