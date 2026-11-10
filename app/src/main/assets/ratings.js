/* Kanonha surveys v2: each poll has its own deadline, voting type and publication rules.
   Unpublished results are never requested by students, and the server enforces RLS. */
(() => {
 'use strict';
 const api=window.KanonhaBackend;
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>
   ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const n=v=>Number(v||0).toLocaleString('fa-IR');
 const categories={all:'همه نظرسنجی‌ها',club:'کانون‌ها',professor:'اساتید',faculty:'دانشکده‌ها'};
 const icons={club:'✦',professor:'◆',faculty:'▦'};
 const valid=id=>/^[a-f0-9]{8}-[a-f0-9-]{27,}$/i.test(String(id||''));
 const date=s=>{
   const d=new Date(s);
   if(!Number.isFinite(d.getTime()))return 'زمان نامشخص';
   try{return new Intl.DateTimeFormat('fa-IR-u-ca-persian',
      {year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Tehran'}).format(d);}
   catch(_){return d.toLocaleString('fa-IR');}
 };
 let currentCategory='all',life='active',polls=[],options=[],votes=new Map(),results=new Map();
 let chosen=new Map(),stars=new Map(),loading=false,sending=false,seq=0,message='',error=false;
 const uid=()=>api?.currentUser?.id||null;
 const isEnded=s=>Date.now()>=new Date(s.ends_at).getTime();
 const canShow=s=>['published','paused','archived'].includes(s.status)&&
   (s.kind==='regular' || (isEnded(s)&&s.results_approved===true));
 const isLive=s=>s.status==='published'&&Date.now()>=new Date(s.starts_at||0).getTime()&&!isEnded(s);
 const optionName=id=>options.find(o=>o.id===id)?.title||'گزینه ثبت‌شده';
 function announce(text,isError=false){message=text;error=isError;}
 function resultMap(id){return new Map((results.get(id)||[]).map(x=>[x.option_id,x]));}
 function categoryTabs(){
   document.querySelectorAll('[data-ratings-tab]').forEach(el=>{
     const active=el.dataset.ratingsTab===currentCategory;
     el.classList.toggle('active',active);
     el.setAttribute('aria-selected',String(active));
     el.tabIndex=active?0:-1;
   });
   $('ratings-category-heading').textContent=categories[currentCategory];
 }
 function renderCard(s){
   const ended=isEnded(s),active=isLive(s),already=votes.get(s.id);
   const reveal=canShow(s)&&Boolean(uid()),visible=resultMap(s.id);
   const choices=options.filter(o=>o.survey_id===s.id).sort((a,b)=>a.sort_order-b.sort_order);
   const contest=s.kind==='competition';
   const type=contest?'مسابقه‌ای':'معمولی';
   const state=s.status==='paused'?'موقتاً متوقف':s.status==='archived'?'بایگانی‌شده':
      active?'در حال رأی‌گیری':ended?'پایان‌یافته':'شروع به‌زودی';
   const selected=chosen.get(s.id)||'';
   const score=stars.get(s.id)||0;
   const votesTotal=reveal?Array.from(visible.values()).reduce((v,x)=>v+Number(x.rating_count||0),0):0;
   const choiceHtml=choices.map(o=>{
     const r=visible.get(o.id),count=Number(r?.rating_count||0);
     const avg=count?Number(r.rating_sum||0)/count:0;
     const ratio=votesTotal?Math.round(count/votesTotal*100):0;
     const picked=selected===o.id;
     const isMyVote=already?.option_id===o.id;
     return '<div class="survey-choice'+(picked?' selected':'')+(isMyVote?' my-vote':'')+'">'+
       '<button type="button" data-survey-select="'+esc(o.id)+'" data-survey-id="'+esc(s.id)+'"'+
       ((!active||already||!uid()||sending)?' disabled':'')+
       ' aria-pressed="'+String(picked)+'" aria-label="انتخاب '+esc(o.title)+'">'+
       '<span class="survey-choice-mark" aria-hidden="true">'+(isMyVote?'✓':picked?'●':'○')+'</span>'+
       '<strong>'+esc(o.title)+'</strong>'+(isMyVote?'<small>رأی شما</small>':'')+'</button>'+
       (reveal?'<div class="survey-results-meta"><span>میانگین '+(count?avg.toLocaleString('fa-IR',{minimumFractionDigits:2,maximumFractionDigits:2}):'—')+' ★</span>'+
       '<span>'+n(count)+' رأی</span></div>'+
       '<div class="survey-result-track"><i style="width:'+ratio+'%"></i></div>':'')+
       '</div>';
   }).join('');
   let action='';
   if(already) action='<p class="survey-voted-message">✓ رأی قطعی شما: '+esc(optionName(already.option_id))+
     ' • '+n(already.stars)+' از ۵ ستاره</p>';
   else if(active&&uid()){
     action='<div class="survey-vote-form"><span class="survey-vote-title">امتیاز شما به گزینه انتخاب‌شده</span>'+
       '<div class="survey-stars" role="group" aria-label="انتخاب امتیاز از یک تا پنج">'+
       [1,2,3,4,5].map(v=>'<button type="button" data-survey-star="'+v+
       '" data-survey-id="'+esc(s.id)+'" aria-pressed="'+String(score===v)+
       '" aria-label="'+n(v)+' ستاره" '+(sending?'disabled':'')+'>'+
       (v<=score?'★':'☆')+'</button>').join('')+'</div>'+
       '<button type="button" class="survey-submit" data-survey-submit="'+esc(s.id)+'"'+
       (!selected||!score||sending?' disabled':'')+'>ثبت رأی قطعی</button></div>';
   } else if(active)action='<p class="survey-login">برای شرکت در رأی‌گیری، ابتدا وارد حساب دانشجویی شوید.</p>';
   else action='<p class="survey-closed">زمان رأی‌گیری این نظرسنجی به پایان رسیده است.</p>';
   const secrecy=contest&&!reveal
    ?'<div class="survey-privacy-lock">🔒 '+(ended?'در انتظار تأیید و انتشار نتایج توسط مدیرکل':'آمار مسابقه تا روز پایان مخفی است')+'</div>'
    :!contest&&!uid()?'<div class="survey-privacy-lock">برای مشاهده آمار وارد حساب شوید.</div>'
    :reveal?'<div class="survey-privacy-open">✦ '+n(votesTotal)+' رأی ثبت شده • نتایج قابل مشاهده</div>':'';
   const ranked=reveal&&window.KanonhaSurveyReports?
      window.KanonhaSurveyReports.rank(s,choices,results.get(s.id)||[]):[];
   const winners=ranked.filter(x=>x.rank===1);
   const leader=reveal?(winners.length?
     '<div class="survey-public-leader">★ '+(winners.length>1?'رتبه اول مشترک: ':'برترین گزینه: ')+
        esc(winners.map(x=>x.title).join('، '))+'</div>':
     '<p class="survey-public-threshold">رتبه رسمی پس از رسیدن گزینه‌ها به حداقل '+n(s.min_rank_votes||5)+' رأی مشخص می‌شود.</p>'):'';
   const audience=s.audience_university_id?'دانشگاه و دانشکده مشخص':'همه دانشجویان';
   return '<article class="survey-card" data-survey-card="'+esc(s.id)+'">'+
     '<div class="survey-card-top"><span class="survey-kind '+(contest?'contest':'regular')+'">'+
       (contest?'♛':'✧')+' '+type+'</span>'+
       '<span class="survey-state'+(active?' active':'')+'">'+state+'</span></div>'+
     '<div class="survey-card-title"><span class="survey-card-icon">'+(icons[s.category]||'★')+'</span>'+
     '<div><span class="survey-card-category">'+esc(categories[s.category])+'</span>'+
     '<h3>'+esc(s.title)+'</h3></div></div>'+
     (s.description?'<p class="survey-description">'+esc(s.description)+'</p>':'')+
     '<div class="survey-deadline"><span>◷ پایان رأی‌گیری</span><strong>'+esc(date(s.ends_at))+'</strong></div>'+ 
     '<div class="survey-audience-badge">◉ مخاطبان: '+esc(audience)+'</div>'+ 
     (s.status==='published'&&!active&&!ended?'<div class="survey-coming-start">شروع: '+esc(date(s.starts_at))+'</div>':'')+
     '<div class="survey-options" role="group" aria-label="گزینه‌های '+esc(s.title)+'">'+choiceHtml+'</div>'+
     action+secrecy+leader+'</article>';
 }
 function render(){
   if(!$('ratings-list'))return;
   categoryTabs();
   const relevant=polls.filter(s=>(currentCategory==='all'||s.category===currentCategory)&&
     (life==='all'||(life==='active'&&!isEnded(s)&&s.status!=='archived')||
      (life==='history'&&(isEnded(s)||s.status==='archived'))));
   document.querySelectorAll('[data-ratings-life]').forEach(el=>{
     const on=el.dataset.ratingsLife===life;
     el.classList.toggle('active',on);el.setAttribute('aria-pressed',String(on));
   });
   $('ratings-active-count').textContent=n(polls.filter(isLive).length);
   $('ratings-finished-count').textContent=n(polls.filter(isEnded).length);
   $('ratings-contest-count').textContent=n(polls.filter(s=>s.kind==='competition').length);
   $('ratings-notice').textContent=message;
   $('ratings-notice').classList.toggle('error',error);
   $('ratings-notice').hidden=!message;
   const alerts=$('ratings-alerts');
   if(alerts){
     const urgent=polls.filter(p=>isLive(p)&&Date.parse(p.ends_at)-Date.now()<=24*3600000);
     const soon=polls.filter(p=>p.status==='published'&&Date.now()<Date.parse(p.starts_at)&&
       Date.parse(p.starts_at)-Date.now()<=24*3600000);
     const released=polls.filter(p=>p.kind==='competition'&&isEnded(p)&&p.results_approved);
     const paused=polls.filter(p=>p.status==='paused');
     const items=[...urgent.map(p=>'⌛ پایان نزدیک: '+p.title),
       ...soon.map(p=>'✦ آغاز به‌زودی: '+p.title),
       ...released.map(p=>'🏆 نتایج مسابقه منتشر شد: '+p.title),
       ...paused.map(p=>'⏸ رأی‌گیری موقتاً متوقف شد: '+p.title)].slice(0,4);
     alerts.hidden=items.length===0;
     alerts.innerHTML=items.map(x=>'<p>'+esc(x)+'</p>').join('');
   }
   const shortcut=$('ratings-admin-open');
   if(shortcut)shortcut.hidden=!(window.KanonhaAdminPanel?.hasAccess?.());
   $('ratings-list').innerHTML=loading?'<div class="surveys-empty">در حال بارگذاری نظرسنجی‌ها…</div>':
     relevant.length?relevant.map(renderCard).join(''):
     '<div class="surveys-empty"><span>☆</span><strong>فعلاً نظرسنجی منتشرشده‌ای وجود ندارد</strong>'+
     '<p>پس از ایجاد و انتشار نظرسنجی توسط مدیرکل، اینجا نمایش داده می‌شود.</p></div>';
 }
 async function refresh(){
   const token=++seq,userId=uid();
   loading=true;announce('در حال دریافت نظرسنجی‌ها…');render();
   if(!api||!api.enabled){
     polls=[];options=[];votes=new Map();results=new Map();loading=false;
     announce('نظرسنجی به اتصال امن اینترنت نیاز دارد.',true);render();return;
   }
   try{
     const surveyRows=await api.surveyList(false);
     if(token!==seq)return;
     const list=surveyRows.filter(s=>valid(s.id)&&Object.hasOwn(categories,s.category)&&s.category!=='all');
     const [items,myVotes]=await Promise.all([
       api.surveyOptions(list.map(s=>s.id)),
       userId?api.surveyMyVotes():Promise.resolve([])
     ]);
     if(token!==seq||uid()!==userId)return;
     const allowed=list.filter(s=>canShow(s)&&Boolean(userId));
     const reports=await Promise.all(allowed.map(async s=>[s.id,await api.surveyResults(s.id)]));
     if(token!==seq||uid()!==userId)return;
     polls=list;options=items;votes=new Map(myVotes.map(v=>[v.survey_id,v]));
     results=new Map(reports);
     if(userId&&window.AndroidSurveyNotices&&typeof window.AndroidSurveyNotices.sync==='function'){
       try{window.AndroidSurveyNotices.sync(JSON.stringify(list.map(p=>({
         id:p.id,title:p.title,startsAt:Date.parse(p.starts_at),
         endsAt:Date.parse(p.ends_at),kind:p.kind,approved:p.results_approved===true,
         status:p.status
       }))));}catch(_){}
     }
     announce('');
   }catch(e){
     if(token!==seq)return;
     polls=[];options=[];votes=new Map();results=new Map();
     announce('دریافت نظرسنجی‌ها ناموفق بود؛ اتصال به سرور را بررسی کنید.',true);
   }finally{if(token===seq){loading=false;sending=false;render();}}
 }
 async function vote(surveyId){
   if(sending||!valid(surveyId)||!uid())return;
   const poll=polls.find(s=>s.id===surveyId),choice=chosen.get(surveyId),score=stars.get(surveyId);
   if(!poll||!isLive(poll)||votes.has(surveyId)||!valid(choice)||
      !options.some(o=>o.id===choice&&o.survey_id===surveyId)||!Number.isInteger(score)||score<1||score>5)return;
   sending=true;announce('در حال ثبت رأی قطعی شما…');render();
   try{
     await api.surveyVote(surveyId,choice,score);
     chosen.delete(surveyId);stars.delete(surveyId);
     await refresh();announce('رأی شما ثبت شد و دیگر قابل تغییر نیست.');
   }catch(e){
     sending=false;
     const duplicate=e?.status===409;
     await refresh();
     announce(duplicate?'در این نظرسنجی قبلاً رأی داده‌اید.':
       'ثبت رأی ناموفق بود: '+String(e?.message||'خطای ارتباط').slice(0,90),true);
   }finally{sending=false;render();}
 }
 function init(){
   const root=$('screen-ratings');if(!root)return;
   root.addEventListener('click',e=>{
     const lf=e.target.closest('[data-ratings-life]');
     if(lf){life=lf.dataset.ratingsLife;render();return;}
     const tab=e.target.closest('[data-ratings-tab]');
     if(tab){currentCategory=tab.dataset.ratingsTab;render();return;}
     if(e.target.closest('#ratings-refresh')){void refresh();return;}
     if(e.target.closest('#ratings-admin-open')){
       if(window.KanonhaAdminPanel?.hasAccess?.()){
         window.KanonhaPreview?.go('manager-home');
         window.KanonhaAdminPanel.showTab('ratings');
       }
       return;
     }
     const option=e.target.closest('[data-survey-select]');
     if(option&&!option.disabled){
       chosen.set(option.dataset.surveyId,option.dataset.surveySelect);render();return;
     }
     const star=e.target.closest('[data-survey-star]');
     if(star&&!star.disabled){
       stars.set(star.dataset.surveyId,Number(star.dataset.surveyStar));render();return;
     }
     const submit=e.target.closest('[data-survey-submit]');
     if(submit&&!submit.disabled)void vote(submit.dataset.surveySubmit);
   });
   render();
 }
 window.KanonhaRatings=Object.freeze({open:refresh,backgroundSync:refresh});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
