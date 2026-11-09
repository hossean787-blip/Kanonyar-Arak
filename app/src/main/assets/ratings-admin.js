/* Kanonha: survey operations are exclusive to the verified global manager.
 * Server RLS and the guarded report RPC remain the source of truth.
 */
(() => {
  'use strict';
  const api=window.KanonhaBackend;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>Number(v||0).toLocaleString('fa-IR');
  const categoryLabel={club:'کانون‌ها',professor:'اساتید',faculty:'دانشکده‌ها'};
  let seq=0,busy=false,control=null,targets=[],results=[],confirmPublish=false,feedback='',error=false;
  const authorized=()=>Boolean(window.KanonhaAdminPanel&&window.KanonhaAdminPanel.hasAccess());
  const area=()=>$('admin-ratings-content');
  function clear(){
    ++seq;busy=false;control=null;targets=[];results=[];
    confirmPublish=false;feedback='';error=false;
  }
  function warn(message,isError=false){feedback=message;error=isError;render();}
  function rows(){
    const map=new Map(results.map(r=>[r.target_id,r]));
    return targets.map(t=>({...t,count:Number(map.get(t.id)?.rating_count||0),
      sum:Number(map.get(t.id)?.rating_sum||0)}));
  }
  const avg=t=>t.count?t.sum/t.count:0;
  function group(category){
    const items=rows().filter(t=>t.category===category).sort((a,b)=>
      avg(b)-avg(a)||b.count-a.count||a.title.localeCompare(b.title,'fa'));
    const votes=items.reduce((v,t)=>v+t.count,0);
    return '<section class="ratings-admin-group"><div class="ratings-admin-group-title"><h4>'+
      categoryLabel[category]+'</h4><span>'+fmt(items.length)+' مورد • '+fmt(votes)+' رأی</span></div>'+
      (!items.length?'<p class="ratings-admin-empty">موردی ثبت نشده است.</p>':
      items.map((t,i)=>'<div class="ratings-admin-item"><div><strong>'+esc(t.title)+'</strong>'+
      (t.subtitle?'<small>'+esc(t.subtitle)+'</small>':'')+'</div>'+
      '<div class="ratings-admin-item-score">'+
      '<strong>'+(t.count?avg(t).toFixed(2).replace('.','٫'):'—')+' ★</strong>'+
      '<small>'+fmt(t.count)+' رأی'+(t.count<5?' • رتبه موقت':'')+'</small></div>'+
      '</div>').join(''))+'</section>';
  }
  function render(){
    const el=area();if(!el||!authorized())return;
    if(!control){
      el.innerHTML='<div class="secretary-card ratings-admin-loading">در حال دریافت تنظیمات امن نظرسنجی…</div>';
      return;
    }
    const open=control.voting_open,published=control.results_published;
    const status=open?'در حال رأی‌گیری':published?'نتایج منتشرشده':'بسته؛ نتایج محرمانه';
    const statusClass=open?'open':published?'published':'closed';
    el.innerHTML='<div class="ratings-admin-header"><div class="ratings-admin-header-badge">★</div>'+
      '<div><h3>مدیریت نظرسنجی دانشجویی</h3>'+
      '<p>مدیریت هر سه دسته فقط با حساب مدیرکل مجاز است.</p></div></div>'+
      '<div class="ratings-admin-status '+statusClass+'"><span>وضعیت فعلی</span><strong>'+status+'</strong></div>'+
      '<div class="ratings-admin-actions">'+
      (open?
        '<button type="button" class="negative" data-ratings-admin-action="close"'+(busy?' disabled':'')+'>پایان رأی‌گیری</button>':
        !published?
        '<button type="button" class="positive" data-ratings-admin-action="start"'+(busy?' disabled':'')+'>شروع / ادامه رأی‌گیری</button>':'')+
      (!open&&!published?
        '<button type="button" class="ratings-publish-btn" data-ratings-admin-action="'+
        (confirmPublish?'publish-confirm':'publish-ask')+'"'+(busy?' disabled':'')+'>'+
        (confirmPublish?'تأیید نهایی و انتشار نتایج':'تأیید و انتشار نتایج')+'</button>':'')+
      (published?'<button type="button" data-ratings-admin-action="unpublish"'+
        (busy?' disabled':'')+'>لغو انتشار نتایج</button>':'')+
      '<button type="button" data-ratings-admin-action="reload"'+(busy?' disabled':'')+'>بروزرسانی آمار</button></div>'+
      (confirmPublish&&!open&&!published?
        '<p class="ratings-publish-warning">با تأیید بعدی، میانگین ستاره‌ها و برترین‌های هر سه دسته برای دانشجویان منتشر می‌شوند. مطمئن هستید؟</p>':'')+
      '<p class="ratings-admin-feedback'+(error?' error':'')+'" role="status">'+
      esc(feedback||'نتایج تا زمانی که شما تأیید نکنید برای دانشجویان قابل مشاهده نیستند.')+'</p>'+
      '<h3 class="ratings-admin-section-title">پیش‌نمایش محرمانه نتایج</h3>'+
      '<p class="ratings-admin-help">این آمار را فقط مدیرکل پیش از انتشار می‌بیند. رتبه رسمی هر مورد حداقل ۵ رأی لازم دارد.</p>'+
      group('club')+group('professor')+group('faculty')+
      '<section class="ratings-admin-professor"><h3>افزودن استاد به نظرسنجی</h3>'+
      '<p>پیش از شروع رأی‌گیری، نام استادان واقعی را وارد کنید.</p>'+
      '<form id="ratings-admin-professor-form" class="secretary-form">'+
      '<label class="field">نام و نام خانوادگی استاد<input name="title" minlength="2" maxlength="120" autocomplete="off" required placeholder="نام استاد"></label>'+
      '<label class="field">دانشکده یا گروه آموزشی<input name="subtitle" maxlength="120" autocomplete="off" placeholder="نام دانشکده (اختیاری)"></label>'+
      '<button class="positive" type="submit"'+(busy||open||published?' disabled':'')+'>افزودن استاد</button>'+
      (open||published?'<small>برای تغییر فهرست استادان، رأی‌گیری باید بسته و نتایج منتشرنشده باشند.</small>':'')+
      '</form></section>'+
      '<p class="ratings-admin-footnote">هر دانشجو برای هر مورد فقط یک رأی تغییرناپذیر دارد. شروع دوباره رأی‌گیری، رأی‌های قبلی را پاک نمی‌کند.</p>';
  }
  async function load(){
    if(!authorized())return;
    const current=++seq;
    busy=true;error=false;feedback='';
    try{
      const response=await Promise.all([api.ratingControl(),api.ratingCatalog(),api.ratingResults()]);
      if(current!==seq||!authorized())return;
      control=response[0];targets=response[1];results=response[2];
      feedback='وضعیت و آمار از سرور دریافت شد.';
    }catch(e){
      if(current!==seq)return;
      control=control||{voting_open:false,results_published:false};
      error=true;feedback='دریافت وضعیت نظرسنجی ناموفق بود: '+String(e?.message||'خطای ارتباط').slice(0,130);
    }finally{
      if(current===seq){busy=false;render();}
    }
  }
  function mount(){
    clear();
    if(!authorized())return;
    render();void load();
  }
  async function change(fields){
    if(busy||!authorized())return;
    busy=true;render();
    try{
      const updated=await api.ratingSetControl(fields);
      control={voting_open:updated.voting_open,results_published:updated.results_published};
      confirmPublish=false;
      await load();
      warn('تغییر وضعیت نظرسنجی توسط سرور تأیید شد.');
      if(window.KanonhaRatings&&window.KanonhaRatings.invalidate)
        window.KanonhaRatings.invalidate();
    }catch(e){
      busy=false;confirmPublish=false;
      warn('ثبت تغییر انجام نشد: '+String(e?.message||'دسترسی مجاز نیست').slice(0,120),true);
    }
  }
  async function addProfessor(form){
    if(busy||!authorized()||!control||control.voting_open||control.results_published)return;
    const title=String(form.elements.title?.value||'').trim();
    const subtitle=String(form.elements.subtitle?.value||'').trim();
    if(title.length<2||title.length>120||subtitle.length>120){
      warn('نام استاد معتبر نیست.',true);return;
    }
    busy=true;render();
    try{
      await api.ratingAddProfessor(title,subtitle);
      await load();
      warn('استاد به فهرست نظرسنجی اضافه شد.');
    }catch(e){
      busy=false;warn('افزودن استاد ناموفق بود: '+String(e?.message||'خطا').slice(0,120),true);
    }
  }
  function init(){
    const root=$('admin-content');if(!root)return;
    root.addEventListener('click',ev=>{
      const button=ev.target.closest('[data-ratings-admin-action]');
      if(!button||!authorized()||!area()||busy)return;
      const action=button.dataset.ratingsAdminAction;
      if(action==='reload'){confirmPublish=false;void load();return;}
      if(action==='start'&&!control.voting_open&&!control.results_published)
        return void change({voting_open:true,results_published:false});
      if(action==='close'&&control.voting_open)
        return void change({voting_open:false});
      if(action==='publish-ask'&&!control.voting_open&&!control.results_published){
        confirmPublish=true;render();return;
      }
      if(action==='publish-confirm'&&confirmPublish&&!control.voting_open&&!control.results_published)
        return void change({voting_open:false,results_published:true});
      if(action==='unpublish'&&control.results_published)
        return void change({results_published:false});
    });
    root.addEventListener('submit',ev=>{
      if(ev.target.id!=='ratings-admin-professor-form')return;
      ev.preventDefault();void addProfessor(ev.target);
    });
  }
  window.KanonhaRatingManagement=Object.freeze({mount,clear});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
