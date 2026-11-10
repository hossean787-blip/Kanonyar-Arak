/* Manager-only targeted campaign composer. Server determines recipients and authorizes publication. */
(() => {
'use strict';
const api=window.KanonhaBackend,root=document.getElementById('admin-panel');
if(!root||!api||!api.enabled)return;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let directory=null,history=[],previewCount=null,loading=false,confirming=false,historyLoaded=false,run=0,requestKey=null;
const kinds={event:'تبلیغ رویداد',club:'معرفی کانون جدید',update:'به‌روزرسانی برنامه',general:'اطلاعیه عمومی'};
const audiences={all:'تمام کاربران',students:'تمام دانشجویان',secretaries:'دبیران',university:'یک دانشگاه',faculties:'دانشکده‌های انتخابی',club_members:'اعضای یک کانون'};
function selectedOptions(options,placeholder){
 return '<option value="">'+placeholder+'</option>'+options.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.label)+'</option>').join('');
}
function view(){
 const el=$('admin-notices-content');if(!el||!directory)return;
 const activeEvents=(directory.events||[]).filter(e=>e.is_published&&Date.parse(e.registration_deadline)>Date.now());
 const activeClubs=(directory.clubs||[]).filter(c=>c.is_active);
 el.innerHTML='<section class="notice-composer"><h3>🔔 مرکز اطلاع‌رسانی</h3>'+
  '<p class="notice-hint">اعلان‌های هدفمند در صندوق کاربران ذخیره می‌شوند. پوش گوشی در حالت بسته‌بودن برنامه هنوز فعال نیست.</p>'+
  '<form id="notice-send-form" class="notice-form" autocomplete="off">'+
  '<label>موضوع<select name="kind" id="notice-kind">'+Object.entries(kinds).map(([k,label])=>'<option value="'+k+'">'+label+'</option>').join('')+'</select></label>'+
  '<label data-notice-section="event">انتخاب رویداد منتشرشده<select name="event_id" id="notice-event">'+
   selectedOptions(activeEvents.map(e=>({id:e.id,label:e.title})),activeEvents.length?'رویداد را انتخاب کنید':'رویداد قابل تبلیغی وجود ندارد')+'</select></label>'+
  '<label data-notice-section="club" hidden>انتخاب کانون فعال<select name="related_club_id" id="notice-related-club">'+
   selectedOptions(activeClubs.map(c=>({id:c.id,label:c.name})),activeClubs.length?'کانون را انتخاب کنید':'کانون فعالی وجود ندارد')+'</select></label>'+
  '<label data-notice-section="update" hidden>نسخه جدید برنامه<input name="version_label" id="notice-version" maxlength="40" placeholder="مثلاً ۰.۹.۲۲"></label>'+
  '<label>عنوان اعلان<input name="title" id="notice-title" required minlength="2" maxlength="120" placeholder="عنوان جذاب و کوتاه"></label>'+
  '<label>متن اعلان<textarea name="body" required minlength="2" maxlength="1000" rows="4" placeholder="پیام دانشجوها…"></textarea></label>'+
  '<label>مخاطبان<select name="audience" id="notice-audience">'+Object.entries(audiences).map(([k,label])=>'<option value="'+k+'">'+label+'</option>').join('')+'</select></label>'+
  '<label data-notice-target="university" hidden>دانشگاه<select name="university" id="notice-university">'+
    '<option value="">انتخاب دانشگاه</option>'+(directory.universities||[]).map(u=>'<option value="'+esc(u.name)+'">'+esc(u.name)+'</option>').join('')+'</select></label>'+
  '<fieldset data-notice-target="faculties" hidden><legend>دانشکده‌ها (انتخاب چندتایی)</legend><div id="notice-faculties" class="notice-faculties"><small>ابتدا دانشگاه را انتخاب کنید.</small></div></fieldset>'+
  '<label data-notice-target="club_members" hidden>کانون اعضا<select name="club_id" id="notice-target-club">'+
    selectedOptions(activeClubs.map(c=>({id:c.id,label:c.name})),'انتخاب کانون')+'</select></label>'+
  '<div class="notice-preview" id="notice-preview" role="status">ابتدا مخاطبان را مشخص و تعداد گیرندگان را محاسبه کنید.</div>'+
  '<div class="notice-actions"><button type="button" id="notice-preview-btn">محاسبه گیرندگان</button>'+
  '<button type="button" id="notice-send-btn" disabled>تأیید نهایی ارسال</button></div>'+
  '<div id="notice-send-confirm" class="notice-confirm" hidden><strong>ارسال به گیرندگان تأیید شود؟</strong>'+
    '<p>این کار اعلان را در صندوق کاربران انتخاب‌شده منتشر می‌کند و برگشت فوری ندارد.</p>'+
    '<button type="button" id="notice-commit-btn">بله، ارسال قطعی</button>'+
    '<button type="button" id="notice-cancel-btn">انصراف</button></div></form></section>'+
  '<section class="notice-history"><h3>تاریخچه ارسال‌ها</h3><div id="notice-history-list"></div></section>';
 updateVisibility();drawHistory();
}
function refreshFaculty(){
 const uni=$('notice-university')?.value||'',u=(directory?.universities||[]).find(x=>x.name===uni);
 const faculties=(directory?.faculties||[]).filter(f=>f.university_id===u?.id);
 const box=$('notice-faculties');if(!box)return;
 box.innerHTML=faculties.length?faculties.map(f=>'<label class="notice-faculty"><input type="checkbox" name="faculties" value="'+esc(f.name)+'">'+esc(f.name)+'</label>').join(''):
 '<small>برای این دانشگاه دانشکده‌ای تعریف نشده است.</small>';
}
function updateVisibility(){
 const kind=$('notice-kind')?.value||'event',audience=$('notice-audience')?.value||'all';
 root.querySelectorAll('[data-notice-section]').forEach(el=>{el.hidden=el.dataset.noticeSection!==kind});
 root.querySelectorAll('[data-notice-target]').forEach(el=>{
  el.hidden=el.dataset.noticeTarget==='university'? !['university','faculties'].includes(audience):el.dataset.noticeTarget!==audience;
 });
}
function invalidate(){
 previewCount=null;confirming=false;requestKey=null;
 const notice=$('notice-preview');if(notice)notice.textContent='برای ارسال، تعداد گیرندگان را دوباره محاسبه کنید.';
 if($('notice-send-btn'))$('notice-send-btn').disabled=true;
 if($('notice-send-confirm'))$('notice-send-confirm').hidden=true;
}
function values(){
 const form=$('notice-send-form');if(!form)throw Error('فرم آماده نیست.');
 const fd=new FormData(form),audience=String(fd.get('audience')||''),kind=String(fd.get('kind')||'');
 const university=['university','faculties'].includes(audience)?String(fd.get('university')||''):'';
 const faculties=audience==='faculties'?fd.getAll('faculties').map(String):[];
 const club_id=audience==='club_members'?String(fd.get('club_id')||''):null;
 const related_id=kind==='event'?String(fd.get('event_id')||''):
  kind==='club'?String(fd.get('related_club_id')||''):null;
 if(['event','club'].includes(kind)&&!related_id)throw Error('رویداد یا کانون را انتخاب کنید.');
 if(['university','faculties'].includes(audience)&&!university)throw Error('دانشگاه را انتخاب کنید.');
 if(audience==='faculties'&&!faculties.length)throw Error('حداقل یک دانشکده را انتخاب کنید.');
 if(audience==='club_members'&&!club_id)throw Error('کانون اعضا را انتخاب کنید.');
 return {kind,title:String(fd.get('title')||'').trim(),body:String(fd.get('body')||'').trim(),
  audience,university,faculties,club_id,related_id,version_label:String(fd.get('version_label')||'').trim()};
}
function noticeStatus(s,isError=false){
 const box=$('notice-preview');if(box){box.textContent=s;box.classList.toggle('error',isError);}
}
function drawHistory(){
 const box=$('notice-history-list');if(!box)return;
 box.innerHTML=history.length?history.map(h=>
  '<article class="notice-history-item"><strong>'+esc(h.title)+'</strong><span>'+
  esc(kinds[h.kind]||'اعلان')+' · '+Number(h.recipient_count||0).toLocaleString('fa-IR')+
  ' گیرنده</span><small>'+esc(new Date(h.created_at).toLocaleString('fa-IR'))+'</small></article>'
 ).join(''):'<p class="notice-hint">هنوز اعلانی ارسال نشده است.</p>';
}
async function historyRefresh(){
 const current=++run;
 try{
  const rows=await api.adminAction('notification.history');
  if(current!==run||!$('notice-history-list'))return;
  history=Array.isArray(rows)?rows:[];historyLoaded=true;drawHistory();
 }catch(e){if(current===run)noticeStatus('تاریخچه دریافت نشد: '+String(e.message||''),true)}
}
function prefill(){
 const kind=$('notice-kind')?.value;
 if(kind==='event'){
  const e=(directory.events||[]).find(x=>x.id===$('notice-event')?.value);
  if(e){$('notice-title').value='دعوت به رویداد «'+e.title+'»';
    $('notice-send-form').elements.body.value='ثبت‌نام این رویداد آغاز شده است. برای مشاهده جزئیات و ثبت‌نام روی اعلان بزنید.';}
 }else if(kind==='club'){
  const c=(directory.clubs||[]).find(x=>x.id===$('notice-related-club')?.value);
  if(c){$('notice-title').value='معرفی کانون «'+c.name+'»';
    $('notice-send-form').elements.body.value='کانون جدید را بشناسید و درخواست عضویت خود را ثبت کنید.';}
 }
}
async function preview(){
 if(loading)return;
 let fields;
 try{fields=values();}catch(e){noticeStatus(e.message,true);return;}
 loading=true;noticeStatus('در حال شمارش گیرندگان…');
 try{
  const count=await api.adminAction('notification.preview',fields);
  if(!Number.isInteger(count)||count<0)throw Error('پاسخ شمارش معتبر نیست.');
  previewCount=count;requestKey=crypto.randomUUID();noticeStatus(count.toLocaleString('fa-IR')+' گیرنده مطابق فیلتر انتخابی');
  $('notice-send-btn').disabled=count===0;
 }catch(e){invalidate();noticeStatus('خطا: '+String(e.message||'خطای سرور'),true);}
 finally{loading=false;}
}
async function send(){
 if(loading||!confirming||!Number.isInteger(previewCount)||previewCount<1)return;
 let fields;
 try{fields=values();}catch(e){noticeStatus(e.message,true);return;}
 const form=$('notice-send-form');
 if(!form.reportValidity())return;
 loading=true;$('notice-commit-btn').disabled=true;noticeStatus('ثبت اعلان در سرور…');
 try{
  const result=await api.adminAction('notification.send',{...fields,request_key:requestKey});
  noticeStatus('اعلان در صندوق '+Number(result.recipient_count||0).toLocaleString('fa-IR')+' کاربر ثبت شد.');
  previewCount=null;confirming=false;requestKey=null;$('notice-send-confirm').hidden=true;
  $('notice-send-btn').disabled=true;
  await historyRefresh();
  window.KanonhaNotifications?.refresh();
 }catch(e){noticeStatus('ارسال انجام نشد: '+String(e.message||'خطای سرور'),true);}
 finally{loading=false;if($('notice-commit-btn'))$('notice-commit-btn').disabled=false;}
}
root.addEventListener('change',ev=>{
 if(!ev.target?.closest?.('#notice-send-form'))return;
 if(ev.target.id==='notice-university')refreshFaculty();
 if(['notice-kind','notice-audience'].includes(ev.target.id))updateVisibility();
 if(['notice-event','notice-related-club'].includes(ev.target.id))prefill();
 invalidate();
});
root.addEventListener('input',ev=>{
 if(ev.target?.closest?.('#notice-send-form'))invalidate();
});
root.addEventListener('click',ev=>{
 const b=ev.target.closest?.('button');if(!b||!b.closest('#admin-notices-content'))return;
 if(b.id==='notice-preview-btn'){void preview();return;}
 if(b.id==='notice-send-btn'){
  const form=$('notice-send-form');if(!form.reportValidity()||!previewCount)return;
  confirming=true;$('notice-send-confirm').hidden=false;return;
 }
 if(b.id==='notice-cancel-btn'){confirming=false;$('notice-send-confirm').hidden=true;return;}
 if(b.id==='notice-commit-btn'){void send();}
});
function mount(data){
 directory=data;previewCount=null;confirming=false;view();
 if(!historyLoaded)void historyRefresh();else drawHistory();
}
function clear(){run++;directory=null;history=[];historyLoaded=false;previewCount=null;confirming=false;requestKey=null;}
window.KanonhaNoticeAdmin=Object.freeze({mount,clear});
})();