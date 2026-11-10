/* Manager-only survey authoring and approval; RLS independently validates all writes. */
(() => {
 'use strict';
 const api=window.KanonhaBackend,$=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=n=>Number(n||0).toLocaleString('fa-IR');
 const categoryNames={club:'کانون‌ها',professor:'اساتید',faculty:'دانشکده‌ها'};
 const kindNames={regular:'معمولی',competition:'مسابقه‌ای'};
 const area=()=>$('admin-ratings-content');
 const authorized=()=>Boolean(window.KanonhaAdminPanel?.hasAccess?.());
 const ended=s=>Date.now()>=new Date(s.ends_at).getTime();
 const localDate=value=>{
   const d=value?new Date(value):new Date(Date.now()+7*86400000);
   if(!Number.isFinite(d.getTime()))return '';
   return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
 };
 const displayDate=value=>{
   const date=new Date(value);
   try{return new Intl.DateTimeFormat('fa-IR-u-ca-persian',
    {year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(date);}
   catch(_){return date.toLocaleString('fa-IR');}
 };
 let seq=0,busy=false,polls=[],options=[],results=new Map(),editing=null;
 let confirmation=null,feedback='',error=false;
 function clear(){
   seq++;busy=false;polls=[];options=[];results=new Map();
   editing=null;confirmation=null;feedback='';error=false;
 }
 function say(msg,isError=false){feedback=msg;error=isError;render();}
 function report(id){return new Map((results.get(id)||[]).map(r=>[r.option_id,r]));}
 function stats(){
   return '<div class="survey-admin-stats">'+
    '<div><strong>'+fmt(polls.length)+'</strong><span>کل نظرسنجی‌ها</span></div>'+
    '<div><strong>'+fmt(polls.filter(p=>p.status==='published'&&!ended(p)).length)+'</strong><span>در حال رأی‌گیری</span></div>'+
    '<div><strong>'+fmt(polls.filter(p=>p.status==='draft').length)+'</strong><span>پیش‌نویس</span></div></div>';
 }
 function form(){
   const record=polls.find(s=>s.id===editing),fields=record||{
     title:'',description:'',category:'club',kind:'regular',ends_at:null
   };
   const items=record?options.filter(x=>x.survey_id===record.id).sort((a,b)=>a.sort_order-b.sort_order):[];
   const categories=Object.entries(categoryNames).map(([key,label])=>
     '<option value="'+key+'"'+(key===fields.category?' selected':'')+'>'+label+'</option>').join('');
   const kinds=Object.entries(kindNames).map(([key,label])=>
     '<option value="'+key+'"'+(key===fields.kind?' selected':'')+'>'+label+'</option>').join('');
   return '<section class="survey-admin-editor"><div class="survey-admin-editor-title">'+
     '<div><span>✦ مدیریت محتوا</span><h4>'+(record?'ویرایش پیش‌نویس':'ساخت نظرسنجی جدید')+'</h4></div>'+
     (record?'<button type="button" data-surveys-action="cancel">انصراف</button>':'')+'</div>'+
     '<p class="survey-admin-editor-hint">نوع رأی‌گیری را پیش از انتشار تعیین کنید. پس از انتشار، عنوان، نوع، گزینه‌ها و تاریخ پایان قفل می‌شوند.</p>'+
     '<form id="survey-manager-form" class="survey-admin-form">'+
     '<label>عنوان نظرسنجی<input name="title" required minlength="4" maxlength="120" placeholder="مثلاً بهترین کانون فرهنگی ترم جاری" value="'+esc(fields.title)+'"></label>'+
     '<label>دسته‌بندی<select name="category" required>'+categories+'</select></label>'+
     '<label>نوع انتشار نتایج<select name="kind" required>'+kinds+'</select></label>'+
     '<p class="survey-admin-mode-help">معمولی: نتیجه از زمان انتشار برای دانشجویان قابل مشاهده است. مسابقه‌ای: هیچ آمار یا رتبه‌ای تا پایان مهلت و تأیید مدیرکل نمایش داده نمی‌شود.</p>'+
     '<label>تاریخ و ساعت پایان<input name="ends_at" type="datetime-local" required value="'+esc(localDate(fields.ends_at))+'"></label>'+
     '<label>توضیحات<input name="description" maxlength="500" placeholder="توضیح کوتاه برای دانشجویان" value="'+esc(fields.description)+'"></label>'+
     '<label class="survey-admin-wide">گزینه‌های نظرسنجی؛ هر خط یک گزینه'+
     '<textarea name="options" required rows="5" placeholder="کانون نمونه یک&#10;کانون نمونه دو&#10;کانون نمونه سه">'+
     esc(items.map(x=>x.title).join('\n'))+'</textarea></label>'+
     '<p class="survey-admin-form-help">بین ۲ تا ۱۲ گزینه منحصربه‌فرد وارد کنید. هر دانشجو در هر نظرسنجی فقط به یکی از گزینه‌ها ۱ تا ۵ ستاره می‌دهد.</p>'+
     '<button type="submit" class="survey-admin-save"'+(busy?' disabled':'')+'>'+
     (record?'ذخیره تغییرات پیش‌نویس':'ثبت پیش‌نویس نظرسنجی')+'</button>'+
     '</form></section>';
 }
 function card(s){
   const draft=s.status==='draft',isEnded=ended(s),contest=s.kind==='competition';
   const opts=options.filter(o=>o.survey_id===s.id).sort((a,b)=>a.sort_order-b.sort_order);
   const scores=report(s.id),total=Array.from(scores.values()).reduce((v,x)=>v+Number(x.rating_count||0),0);
   const state=draft?'پیش‌نویس':!isEnded?'در حال رأی‌گیری':'پایان‌یافته';
   const approved=s.results_approved===true;
   const kindNote=contest?'نتایج مسابقه محرمانه تا پایان مهلت':'نتایج معمولی به‌صورت زنده نمایش داده می‌شود';
   const canApprove=contest&&!draft&&isEnded&&!approved;
   const listing=opts.map(o=>{
      const row=scores.get(o.id),votes=Number(row?.rating_count||0);
      const avg=votes?Number(row.rating_sum)/votes:0;
      return '<div class="survey-admin-option"><span>'+esc(o.title)+'</span><strong>'+
       (votes?avg.toFixed(2).replace('.', '٫'):'—')+' ★</strong><small>'+fmt(votes)+' رأی</small></div>';
   }).join('');
   return '<article class="survey-admin-item"><header class="survey-admin-item-head">'+
    '<div><span class="survey-kind '+(contest?'contest':'regular')+'">'+
    kindNames[s.kind]+'</span><span class="survey-admin-category">'+categoryNames[s.category]+'</span></div>'+
    '<span class="survey-state '+(draft?'draft':isEnded?'':'active')+'">'+state+'</span></header>'+
    '<h4>'+esc(s.title)+'</h4>'+(s.description?'<p>'+esc(s.description)+'</p>':'')+
    '<div class="survey-admin-item-details"><span>◷ '+esc(displayDate(s.ends_at))+'</span>'+
    '<span>'+fmt(opts.length)+' گزینه</span></div>'+
    '<p class="survey-admin-item-note">'+kindNote+'</p>'+
    '<div class="survey-admin-option-list">'+listing+'</div>'+
    (contest&&isEnded?'<p class="survey-admin-approval">'+
      (approved?'✓ نتایج مسابقه با تأیید مدیرکل منتشر شده‌اند.':'🔒 نتایج هنوز منتشر نشده‌اند.')+'</p>':'')+
    '<div class="survey-admin-buttons">'+
    (draft?
      '<button type="button" data-surveys-action="edit" data-survey-id="'+s.id+'">ویرایش</button>'+
      '<button class="publish" type="button" data-surveys-action="'+
        (confirmation===s.id+':publish'?'publish-confirm':'publish-ask')+
        '" data-survey-id="'+s.id+'">'+
        (confirmation===s.id+':publish'?'تأیید نهایی انتشار':'انتشار و آغاز رأی‌گیری')+'</button>'+
      '<button class="delete" type="button" data-surveys-action="'+
        (confirmation===s.id+':delete'?'delete-confirm':'delete-ask')+
        '" data-survey-id="'+s.id+'">'+
        (confirmation===s.id+':delete'?'تأیید حذف پیش‌نویس':'حذف')+'</button>':'')+
    (canApprove?'<button class="publish" type="button" data-surveys-action="'+
       (confirmation===s.id+':approve'?'approve-confirm':'approve-ask')+
       '" data-survey-id="'+s.id+'">'+
       (confirmation===s.id+':approve'?'تأیید قطعی انتشار نتایج':'تأیید و اعلام نتایج مسابقه')+'</button>':'')+
    '</div>'+
    (confirmation&&confirmation.startsWith(s.id+':')?
     '<p class="survey-admin-confirm">برای ثبت این اقدام یک‌بار دیگر روی دکمه تأیید بزنید.</p>':'')+
    '</article>';
 }
 function render(){
   const el=area();if(!el||!authorized())return;
   el.innerHTML='<div class="survey-admin-heading"><div><h3>مدیریت نظرسنجی‌ها</h3>'+
    '<p>ساخت، انتشار و کنترل نتایج؛ فقط مدیرکل</p></div>'+
    '<button type="button" data-surveys-action="reload" aria-label="بارگذاری دوباره نظرسنجی‌ها">↻</button></div>'+
    stats()+
    '<p class="survey-admin-feedback'+(error?' error':'')+'" role="status">'+
      esc(feedback||'پیش‌نویس‌ها فقط برای مدیرکل قابل مشاهده‌اند.')+'</p>'+
    form()+
    '<div class="survey-admin-library-heading"><h4>نظرسنجی‌های ثبت‌شده</h4><span>'+fmt(polls.length)+' مورد</span></div>'+
    (polls.length?'<div class="survey-admin-library">'+polls.map(card).join('')+'</div>':
      '<div class="surveys-empty">هنوز نظرسنجی ایجاد نشده است.</div>');
 }
 async function load(){
   if(!authorized())return;
   const token=++seq;busy=true;render();
   try{
     const fetched=await api.surveyList(true);
     const fetchedOptions=await api.surveyOptions(fetched.map(s=>s.id));
     const fetchedResults=await Promise.all(fetched.map(async s=>[s.id,await api.surveyResults(s.id)]));
     if(token!==seq||!authorized())return;
     polls=fetched;options=fetchedOptions;results=new Map(fetchedResults);
     feedback=feedback||'اطلاعات نظرسنجی‌ها از سرور دریافت شد.';error=false;
   }catch(e){
     if(token!==seq)return;
     feedback='دریافت اطلاعات نظرسنجی‌ها ناموفق بود: '+String(e?.message||'خطا').slice(0,110);
     error=true;
   }finally{if(token===seq){busy=false;render();}}
 }
 function mount(){clear();if(authorized()){render();void load();}}
 async function submit(form){
   if(busy||!authorized())return;
   const fd=new FormData(form);
   const fields={
     title:String(fd.get('title')||'').trim(),
     category:String(fd.get('category')||''),
     kind:String(fd.get('kind')||''),
     description:String(fd.get('description')||'').trim(),
     ends_at:''
   };
   const rawDate=String(fd.get('ends_at')||'');
   const millis=Date.parse(rawDate);
   if(!Number.isFinite(millis)||millis<=Date.now()){
     say('زمان پایان باید در آینده باشد.',true);return;
   }
   fields.ends_at=new Date(millis).toISOString();
   const items=String(fd.get('options')||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
   if(items.length<2||items.length>12||new Set(items.map(x=>x.toLowerCase())).size!==items.length){
     say('بین ۲ تا ۱۲ گزینه متفاوت وارد کنید.',true);return;
   }
   busy=true;render();
   try{
     if(editing)await api.surveyUpdateDraft(editing,fields,items);
     else await api.surveyCreate(fields,items);
     editing=null;confirmation=null;feedback='پیش‌نویس و گزینه‌های نظرسنجی ذخیره شدند.';error=false;
     await load();
   }catch(e){busy=false;say('ثبت نظرسنجی انجام نشد: '+String(e?.message||'خطا').slice(0,110),true);}
 }
 async function change(action,id){
   if(busy||!authorized()||!polls.some(p=>p.id===id))return;
   busy=true;confirmation=null;render();
   try{
     if(action==='publish')await api.surveyPublish(id);
     else if(action==='approve')await api.surveyApproveResults(id);
     else if(action==='delete')await api.surveyDeleteDraft(id);
     else return;
     feedback=action==='publish'?'نظرسنجی منتشر شد؛ نوع آن دیگر قابل تغییر نیست.':
       action==='approve'?'نتایج مسابقه پس از تأیید شما برای دانشجویان آزاد شد.':
       'پیش‌نویس حذف شد.';
     error=false;
     await load();
     if(window.KanonhaRatings?.open)void window.KanonhaRatings.open();
   }catch(e){
     busy=false;say('انجام عملیات مجاز نشد: '+String(e?.message||'خطا').slice(0,120),true);
   }
 }
 function init(){
   const root=$('admin-content');if(!root)return;
   root.addEventListener('click',e=>{
     const button=e.target.closest('[data-surveys-action]');
     if(!button||!authorized()||busy||!area())return;
     const action=button.dataset.surveysAction,id=button.dataset.surveyId;
     if(action==='reload'){confirmation=null;void load();return;}
     if(action==='cancel'){editing=null;confirmation=null;render();return;}
     if(action==='edit'&&polls.some(p=>p.id===id&&p.status==='draft')){
       editing=id;confirmation=null;render();return;
     }
     if(['publish-ask','approve-ask','delete-ask'].includes(action)&&polls.some(p=>p.id===id)){
       confirmation=id+':'+action.split('-')[0];render();return;
     }
     if(action.endsWith('-confirm')&&id&&confirmation===id+':'+action.split('-')[0])
       void change(action.split('-')[0],id);
   });
   root.addEventListener('submit',e=>{
     if(e.target.id!=='survey-manager-form'||!authorized())return;
     e.preventDefault();void submit(e.target);
   });
 }
 window.KanonhaRatingManagement=Object.freeze({mount,clear});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
