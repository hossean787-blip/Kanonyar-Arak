/* Kanonha Surveys v2.1 — secure manager studio.
 * The backend enforces permissions, eligible audience, time windows and vote privacy.
 */
(() => {
'use strict';
const api=window.KanonhaBackend;
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=n=>Number(n||0).toLocaleString('fa-IR');
const categories={club:'کانون‌ها',professor:'اساتید',faculty:'دانشکده‌ها'};
const types={regular:'معمولی',competition:'مسابقه‌ای'};
const statusNames={draft:'پیش‌نویس',published:'منتشرشده',paused:'متوقف',cancelled:'لغوشده',archived:'بایگانی'};
const actionNames={created:'ایجاد',edited:'ویرایش',published:'انتشار',approved:'تأیید نتایج',
  unapproved:'لغو تأیید',paused:'توقف',resumed:'ادامه رأی‌گیری',cancelled:'لغو',
  archived:'بایگانی',deleted:'حذف پیش‌نویس',duplicated:'ساخت کپی'};
const authorized=()=>Boolean(window.KanonhaAdminPanel?.hasAccess?.());
const area=()=>$('admin-ratings-content');
const reports=()=>window.KanonhaSurveyReports;
const fmtDate=iso=>window.KanonhaJalali?.formatDate?.(iso,true)||
   new Date(iso).toLocaleString('fa-IR');
const toLocal=iso=>{
 const d=new Date(iso||Date.now()+15*60000);
 return Number.isFinite(d.getTime())
  ?new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16):'';
};
const ended=s=>Date.now()>=Date.parse(s.ends_at);
const started=s=>Date.now()>=Date.parse(s.starts_at);
const state=s=>s.status==='draft'?'پیش‌نویس':s.status==='cancelled'?'لغوشده':
 s.status==='archived'?'بایگانی':s.status==='paused'?'متوقف':
 !started(s)?'زمان‌بندی‌شده':ended(s)?'پایان‌یافته':'در حال رأی‌گیری';
const unique=arr=>[...new Set(arr)];
const emptyForm=()=>({
 title:'',description:'',category:'faculty',kind:'regular',
 starts_at:toLocal(Date.now()+15*60000),ends_at:toLocal(Date.now()+7*86400000),
 min_rank_votes:5,university_id:'',faculty_id:'',sources:[]
});
let seq=0,busy=false,feedback='',isError=false,confirmation=null,editing=null;
let polls=[],options=[],audits=[],academics={universities:[],faculties:[]},catalogs={};
let formState=emptyForm(),formPreview=false,filter='all',reportId=null;
let pendingCoverFile=null,pendingCoverPreview='';
function setCoverFile(file){
  if(pendingCoverPreview&&typeof URL!=='undefined'&&URL.revokeObjectURL)
    URL.revokeObjectURL(pendingCoverPreview);
  pendingCoverFile=file||null;pendingCoverPreview='';
  if(pendingCoverFile&&typeof URL!=='undefined'&&URL.createObjectURL)
    pendingCoverPreview=URL.createObjectURL(pendingCoverFile);
}
let reportRows=new Map(),participations=new Map(),showAudit=false;

function clear(){
 setCoverFile(null);
 ++seq;busy=false;feedback='';isError=false;confirmation=null;editing=null;
 polls=[];options=[];audits=[];academics={universities:[],faculties:[]};catalogs={};
 formState=emptyForm();formPreview=false;filter='all';reportId=null;
 reportRows=new Map();participations=new Map();showAudit=false;
}
function notice(text,error=false){feedback=text;isError=error;render();}
function saveFromForm(form){
 if(!form)return;
 const fd=new FormData(form);
 const chosen=typeof fd.getAll==='function'?fd.getAll('sources'):[];
 formState={
  title:String(fd.get('title')||'').trim(),
  description:String(fd.get('description')||'').trim(),
  category:String(fd.get('category')||'faculty'),
  kind:String(fd.get('kind')||'regular'),
  starts_at:String(fd.get('starts_at')||''),
  ends_at:String(fd.get('ends_at')||''),
  min_rank_votes:Number(fd.get('min_rank_votes')||5),
  university_id:String(fd.get('university_id')||''),
  faculty_id:String(fd.get('faculty_id')||''),
  sources:chosen.map(String)
 };
}
function optionChoices(){
 const current=catalogs[formState.category]||[];
 const selected=new Set(formState.sources);
 if(!current.length)return '<div class="survey-catalog-empty">این دسته هنوز گزینه ثبت‌شده کافی ندارد. '+
  (formState.category==='professor'?'ابتدا استادان واقعی را از فرم زیر اضافه کنید.':'ابتدا اطلاعات کانون یا دانشکده را در پنل مدیرکل تکمیل کنید.')+'</div>';
 return '<div class="survey-catalog-grid">'+current.map(item=>
  '<label class="survey-catalog-entry"><input type="checkbox" name="sources" value="'+esc(item.source_id)+'"'+
    (selected.has(item.source_id)?' checked':'')+'><span class="survey-catalog-identity">'+
    '<strong>'+esc(item.title)+'</strong><small>'+esc(item.subtitle||categories[item.category])+
    '</small></span></label>').join('')+'</div>';
}
function audienceControls(){
 const universities=academics.universities||[];
 const faculties=(academics.faculties||[]).filter(f=>f.university_id===formState.university_id);
 return '<label>دانشگاه مخاطب<select name="university_id">'+
  '<option value="">همه دانشگاه‌ها</option>'+universities.map(u=>
   '<option value="'+esc(u.id)+'"'+(u.id===formState.university_id?' selected':'')+
   '>'+esc(u.name)+'</option>').join('')+'</select></label>'+
  '<label>دانشکده مخاطب<select name="faculty_id"'+(!formState.university_id?' disabled':'')+'>'+
  '<option value="">تمام دانشکده‌های انتخاب‌شده</option>'+faculties.map(f=>
   '<option value="'+esc(f.id)+'"'+(f.id===formState.faculty_id?' selected':'')+
   '>'+esc(f.name)+'</option>').join('')+'</select></label>'+
  '<p class="survey-form-hint survey-admin-wide">محدوده مشارکت با اطلاعات دانشگاه و دانشکده حساب دانشجو تطبیق داده می‌شود. '+
  'مشخصات دانشگاهی فعلاً خوداظهاری هستند و تأیید سازمانی مستقلی ندارند.</p>';
}
function formPreviewBlock(){
 if(!formPreview)return '';
 const choiceNames=(catalogs[formState.category]||[]).filter(x=>
  formState.sources.includes(x.source_id)).map(x=>x.title);
 return '<section class="survey-manager-preview"><div class="survey-preview-label">پیش‌نمایش قبل از انتشار</div>'+
  '<h4>'+esc(formState.title||'عنوان نظرسنجی')+'</h4>'+
  '<p>'+esc(types[formState.kind])+' • '+esc(categories[formState.category])+'</p>'+
  '<small>شروع: '+esc(formState.starts_at||'نامشخص')+' | پایان: '+esc(formState.ends_at||'نامشخص')+'</small>'+
  '<div>'+choiceNames.map((x,i)=>'<span>'+nf(i+1)+'. '+esc(x)+'</span>').join('')+'</div>'+
  '<p>حداقل رأی برای رتبه رسمی: '+nf(formState.min_rank_votes)+'</p></section>';
}
function coverFormControls(){
 const current=editing?polls.find(s=>s.id===editing):null;
 const url=current?.cover_path?api.surveyCoverUrl(current.id,current.cover_path):'';
 const image=pendingCoverPreview||url;
 return '<div class="survey-admin-wide survey-photo-field">'+
  '<div class="survey-photo-title"><strong>عکس نظرسنجی (اختیاری)</strong>'+
  '<small>PNG، JPG یا WebP • حداکثر ۲ مگابایت</small></div>'+
  '<label class="survey-photo-input">انتخاب عکس از گالری'+
  '<input type="file" name="cover_file" accept="image/png,image/jpeg,image/webp"></label>'+
  (image?'<img class="survey-photo-preview" alt="پیش‌نمایش عکس نظرسنجی" src="'+esc(image)+'">':
     '<div class="survey-photo-empty">✦ برای این نظرسنجی هنوز عکسی انتخاب نشده است.</div>')+
  (pendingCoverFile?'<p class="survey-photo-selection">عکس انتخاب‌شده: '+esc(pendingCoverFile.name||'تصویر')+'</p>':'')+
  (editing&&current?.cover_path?'<button type="button" class="survey-photo-remove" data-surveys-action="remove-cover" data-survey-id="'+esc(editing)+'">حذف عکس فعلی</button>':'')+
  '</div>';
}
function managerForm(){
 const catOptions=Object.entries(categories).map(([key,label])=>'<option value="'+key+'"'+
   (key===formState.category?' selected':'')+'>'+label+'</option>').join('');
 const kindOptions=Object.entries(types).map(([key,label])=>'<option value="'+key+'"'+
   (key===formState.kind?' selected':'')+'>'+label+'</option>').join('');
 return '<section class="survey-admin-editor">'+
  '<div class="survey-admin-editor-title"><div><span>✦ استودیوی مدیریت</span><h4>'+
  (editing?'ویرایش پیش‌نویس':'ایجاد نظرسنجی جدید')+'</h4></div>'+
  (editing?'<button type="button" data-surveys-action="cancel-edit">انصراف</button>':'')+'</div>'+
  '<p class="survey-admin-editor-hint">نوع، مخاطب، گزینه‌ها و زمان‌بندی را قبل از انتشار تعیین کنید. '+
  'بعد از انتشار، این اطلاعات قفل می‌شوند.</p>'+
  '<form id="survey-manager-form" class="survey-admin-form">'+
  '<label>عنوان نظرسنجی<input name="title" required minlength="4" maxlength="120" value="'+esc(formState.title)+
  '" placeholder="مثلاً انتخاب برترین دانشکده"></label>'+
  '<label>دسته‌بندی<select name="category" required>'+catOptions+'</select></label>'+
  '<label>نوع نظرسنجی<select name="kind" required>'+kindOptions+'</select></label>'+
  '<p class="survey-admin-mode-help">معمولی: آمار از آغاز انتشار قابل مشاهده است. مسابقه‌ای: آمار و رتبه‌ها '+
  'تا پایان مهلت و تأیید مدیرکل پنهان می‌مانند.</p>'+
  '<label>شروع (تاریخ و ساعت شمسی)<input type="datetime-local" name="starts_at" required value="'+
    esc(toLocal(formState.starts_at))+'"></label>'+
  '<label>پایان (تاریخ و ساعت شمسی)<input type="datetime-local" name="ends_at" required value="'+
    esc(toLocal(formState.ends_at))+'"></label>'+
  '<label>حداقل رأی برای رتبه معتبر<input name="min_rank_votes" type="number" min="1" max="100" required value="'+
    esc(formState.min_rank_votes)+'"></label>'+
  '<label>توضیحات<textarea name="description" maxlength="500" rows="2" placeholder="هدف نظرسنجی">'+
    esc(formState.description)+'</textarea></label>'+
  coverFormControls()+
  audienceControls()+
  '<div class="survey-admin-wide survey-option-title"><strong>انتخاب گزینه‌ها از فهرست واقعی</strong>'+
   '<span id="survey-choice-count">'+nf(formState.sources.length)+' انتخاب</span></div>'+
  '<div class="survey-admin-wide">'+optionChoices()+'</div>'+
  '<p class="survey-admin-form-help">۱ تا ۱۲ گزینه واقعی و متفاوت انتخاب کنید. هر دانشجو در یک نظرسنجی، '+
  'فقط به یک گزینه از ۱ تا ۵ ستاره می‌دهد.</p>'+
  '<div class="survey-admin-wide survey-admin-form-actions">'+
  '<button type="button" data-surveys-action="preview-form">پیش‌نمایش فرم</button>'+
  '<button type="submit" class="survey-admin-save"'+(busy?' disabled':'')+'>'+
  (editing?'ذخیره ویرایش پیش‌نویس':'ثبت پیش‌نویس')+'</button></div>'+
  '</form>'+formPreviewBlock()+
  (formState.category==='professor'?professorForm():'')+
  '</section>';
}
function professorForm(){
 return '<form id="survey-professor-form" class="survey-professor-form">'+
  '<h4>ثبت استاد در فهرست گزینه‌های معتبر</h4>'+
  '<label>نام استاد<input name="professor_name" required minlength="2" maxlength="120"></label>'+
  '<label>دانشکده/گروه<input name="professor_faculty" maxlength="120"></label>'+
  '<button type="submit"'+(busy?' disabled':'')+'>افزودن استاد به فهرست</button></form>';
}
function statusFilter(){
 const counts={
  all:polls.length,draft:polls.filter(s=>s.status==='draft').length,
  running:polls.filter(s=>s.status==='published'&&started(s)&&!ended(s)).length,
  scheduled:polls.filter(s=>s.status==='published'&&!started(s)).length,
  ended:polls.filter(s=>s.status==='published'&&ended(s)).length,
  paused:polls.filter(s=>s.status==='paused').length,
  cancelled:polls.filter(s=>s.status==='cancelled').length,
  archived:polls.filter(s=>s.status==='archived').length
 };
 const labels={all:'همه',draft:'پیش‌نویس',running:'در حال اجرا',
  scheduled:'زمان‌بندی‌شده',ended:'پایان‌یافته',paused:'متوقف',
  cancelled:'لغوشده',archived:'بایگانی'};
 return '<div class="survey-status-filters">'+Object.entries(labels).map(([k,v])=>
  '<button type="button" data-survey-filter="'+k+'" class="'+(filter===k?'active':'')+'">'+
  v+' <small>'+nf(counts[k])+'</small></button>').join('')+'</div>';
}
function visiblePolls(){
 if(filter==='all')return polls;
 return polls.filter(s=>filter==='draft'?s.status==='draft':
  filter==='running'?s.status==='published'&&started(s)&&!ended(s):
  filter==='scheduled'?s.status==='published'&&!started(s):
  filter==='ended'?s.status==='published'&&ended(s):
  s.status===filter);
}
function rank(s){
 const items=options.filter(o=>o.survey_id===s.id);
 return reports()?.rank?.(s,items,reportRows.get(s.id)||[])||[];
}
function reportBlock(s){
 if(reportId!==s.id)return '';
 const r=rank(s),participation=participations.get(s.id)||{};
 const eligible=Number(participation.eligible_students||0);
 const voters=Number(participation.voters||0),pct=eligible?Math.round(voters/eligible*100):0;
 const winners=r.filter(o=>o.rank===1);
 return '<div class="survey-manager-report"><div class="survey-admin-report-heading">'+
  '<strong>گزارش و رتبه‌بندی واقعی</strong><span>'+nf(voters)+' شرکت‌کننده</span></div>'+
  '<div class="survey-report-stat-row"><div><strong>'+nf(eligible)+'</strong><small>واجد شرایط</small></div>'+
  '<div><strong>'+nf(voters)+'</strong><small>رأی ثبت‌شده</small></div>'+
  '<div><strong>'+nf(pct)+'٪</strong><small>مشارکت</small></div></div>'+
  (winners.length?'<p class="survey-manager-winner">★ '+(winners.length>1?'رتبه اول مشترک: ':'رتبه اول: ')+
    esc(winners.map(x=>x.title).join('، '))+'</p>':
   '<p class="survey-admin-report-empty">هنوز هیچ گزینه‌ای حداقل '+nf(s.min_rank_votes||5)+' رأی معتبر را ندارد.</p>')+
  '<div class="survey-rank-rows">'+r.map(x=>
    '<div><span>'+esc(x.title)+'</span><strong>'+
      (x.count?x.average.toLocaleString('fa-IR',{minimumFractionDigits:2,maximumFractionDigits:2}):'—')+
      ' ★</strong><small>'+nf(x.count)+' رأی</small><b>'+
      (x.qualified?'رتبه '+nf(x.rank):'در انتظار حدنصاب')+'</b></div>'
  ).join('')+'</div>'+
  '<div class="survey-export-actions"><button type="button" data-surveys-action="csv" data-survey-id="'+s.id+'">'+
  'دریافت گزارش اکسل (CSV)</button>'+
  '<button type="button" data-surveys-action="pdf" data-survey-id="'+s.id+'">گزارش PDF</button></div></div>';
}
function card(s){
 const draft=s.status==='draft',timeOver=ended(s),isContest=s.kind==='competition';
 const isActive=s.status==='published'&&!timeOver&&started(s);
 const isScheduled=s.status==='published'&&!started(s);
 const opts=options.filter(x=>x.survey_id===s.id);
 const approval=isContest&&timeOver&&!s.results_approved&&['published','paused'].includes(s.status);
 const actions=[];
 function button(action,label,css='',danger=false){
  const key=s.id+':'+action;
  const pending=confirmation===key;
  actions.push('<button type="button" data-surveys-action="'+action+
    (danger?pending?'-confirm':'-ask':'')+'" data-survey-id="'+s.id+'" class="'+css+
    '">'+(pending?'تأیید نهایی: ':'')+label+'</button>');
 }
 if(draft){button('edit','ویرایش');button('publish','انتشار'+(Date.parse(s.starts_at)>Date.now()?' زمان‌بندی‌شده':''),'publish',true);
  button('delete','حذف','delete',true);}
 if(s.status==='published'&&!timeOver)button('pause','توقف موقت','',true);
 if(s.status==='paused'&&!timeOver)button('resume','ادامه رأی‌گیری','publish',true);
 if(['published','paused'].includes(s.status))button('cancel','لغو نظرسنجی','delete',true);
 if(['published','paused'].includes(s.status)&&timeOver)button('archive','بایگانی','',true);
 if(approval)button('approve','انتشار نتایج مسابقه','publish',true);
 button('duplicate','تکثیر به پیش‌نویس');
 button('report','گزارش و رتبه‌بندی');
 button('preview','پیش‌نمایش دانشجو');
 const preview=confirmation===s.id+':preview';
 const candidateNames=opts.map(o=>o.title);
 const university=academics.universities.find(x=>x.id===s.audience_university_id)?.name||'همه دانشگاه‌ها';
 const faculty=academics.faculties.find(x=>x.id===s.audience_faculty_id)?.name||'تمام دانشکده‌ها';
 return '<article class="survey-admin-item survey-admin-card" data-survey-item="'+s.id+'">'+
  '<header class="survey-admin-item-head"><div><span class="survey-kind '+(isContest?'contest':'regular')+'">'+
     esc(types[s.kind])+'</span><span class="survey-admin-category">'+esc(categories[s.category])+'</span></div>'+
  '<span class="survey-state '+(isActive?'active':isScheduled?'scheduled':'')+'">'+esc(state(s))+'</span></header>'+
  (s.cover_path&&api.surveyCoverUrl(s.id,s.cover_path)?'<img class="survey-manager-cover" src="'+esc(api.surveyCoverUrl(s.id,s.cover_path))+'" alt="عکس نظرسنجی">':'')+
  '<h4>'+esc(s.title)+'</h4>'+(s.description?'<p>'+esc(s.description)+'</p>':'')+
  '<div class="survey-admin-item-details"><span>شروع: '+esc(fmtDate(s.starts_at))+
  '</span><span>پایان: '+esc(fmtDate(s.ends_at))+'</span></div>'+
  '<div class="survey-audience-line"><span>مخاطبان: '+esc(university)+
  (s.audience_faculty_id?' / '+esc(faculty):'')+'</span><span>'+nf(opts.length)+' گزینه • حدنصاب '+
  nf(s.min_rank_votes||5)+'</span></div>'+
  (isContest?'<div class="survey-admin-item-note">🔒 نتایج مسابقه تا پایان و تأیید مدیرکل محرمانه می‌مانند.'+
  (s.results_approved?' ✓ نتایج منتشر شده‌اند.':'')+'</div>':'')+
  '<div class="survey-admin-buttons">'+actions.join('')+'</div>'+
  (preview?'<div class="survey-manager-preview"><strong>نمای دانشجو</strong><p>'+esc(s.title)+'</p>'+
    candidateNames.map((x,i)=>'<span>'+nf(i+1)+' • '+esc(x)+'</span>').join('')+
    '<small>امتیازدهی ۱ تا ۵ ستاره به یک گزینه</small></div>':'')+
  (confirmation?.startsWith(s.id+':')&&!preview?
    '<p class="survey-admin-confirm">این اقدام روی همه دانشجویان اثر می‌گذارد؛ برای اجرا دوباره تأیید کنید.</p>':'')+
  reportBlock(s)+'</article>';
}
function auditView(){
 if(!showAudit)return '';
 return '<section class="survey-audit-list"><h4>تاریخچه اقدامات مدیرکل</h4>'+
  (audits.length?audits.map(a=>
   '<div><span>'+esc(actionNames[a.action]||a.action)+'</span>'+
   '<small>'+esc(fmtDate(a.occurred_at))+'</small>'+
   '<small>شناسه نظرسنجی: '+esc(String(a.survey_id||'').slice(0,8))+'</small></div>'
  ).join(''):'<p>هنوز اقدامی ثبت نشده است.</p>')+'</section>';
}
function render(){
 const target=area();if(!target||!authorized())return;
 const drafts=polls.filter(s=>s.status==='draft').length;
 const inProgress=polls.filter(s=>s.status==='published'&&!ended(s)&&started(s)).length;
 target.innerHTML=
  '<header class="survey-admin-heading"><div><h3>مرکز مدیریت نظرسنجی‌ها</h3>'+
   '<p>انتشار دقیق، نتیجه معتبر، گزارش قابل استناد</p></div>'+
   '<button type="button" data-surveys-action="reload" aria-label="تازه‌سازی">↻</button></header>'+
  '<div class="survey-admin-stats">'+
   '<div><strong>'+nf(polls.length)+'</strong><span>کل</span></div>'+
   '<div><strong>'+nf(inProgress)+'</strong><span>در حال رأی‌گیری</span></div>'+
   '<div><strong>'+nf(drafts)+'</strong><span>پیش‌نویس</span></div></div>'+
  '<p role="status" class="survey-admin-feedback'+(isError?' error':'')+'">'+
    esc(feedback||'نظرسنجی جدید را ابتدا به‌صورت پیش‌نویس ذخیره کنید.')+'</p>'+
  managerForm()+
  '<div class="survey-admin-library-heading"><h4>همه نظرسنجی‌ها</h4>'+
   '<span>'+nf(polls.length)+' مورد</span></div>'+
  statusFilter()+
  '<div class="survey-admin-library">'+(visiblePolls().length?visiblePolls().map(card).join(''):
   '<div class="surveys-empty">موردی در این وضعیت وجود ندارد.</div>')+'</div>'+
  '<button type="button" class="survey-audit-toggle" data-surveys-action="audit">'+
  (showAudit?'بستن تاریخچه':'مشاهده تاریخچه تغییرات')+'</button>'+auditView();
 if(window.KanonhaJalali)window.KanonhaJalali.enhance(target);
}
async function ensureCatalog(category,force=false){
 if(!force&&catalogs[category])return;
 catalogs[category]=await api.surveyCatalog(category);
}
async function load(){
 if(!authorized())return;
 const token=++seq;
 busy=true;render();
 try{
  const [data,academic,audit]=await Promise.all([
   api.surveyList(true),api.academicCatalog(),api.surveyAudit(80)
  ]);
  if(token!==seq||!authorized())return;
  const [opts,catalog]=await Promise.all([
    api.surveyOptions(data.map(s=>s.id)),api.surveyCatalog(formState.category)
  ]);
  if(token!==seq||!authorized())return;
  polls=data;options=opts;academics=academic;audits=audit;
  catalogs[formState.category]=catalog;
  feedback='اطلاعات از پایگاه‌داده واقعی دریافت شد.';isError=false;
 }catch(e){
  if(token!==seq)return;
  feedback='بارگذاری بخش نظرسنجی انجام نشد: '+String(e?.message||'ارتباط').slice(0,120);
  isError=true;
 }finally{if(token===seq){busy=false;render();}}
}
function mount(){clear();if(authorized()){render();void load();}}
function showEdit(id){
 setCoverFile(null);
 const record=polls.find(x=>x.id===id&&x.status==='draft');if(!record)return;
 editing=id;
 formState={title:record.title,description:record.description||'',category:record.category,
  kind:record.kind,starts_at:record.starts_at,ends_at:record.ends_at,
  min_rank_votes:record.min_rank_votes||5,
  university_id:record.audience_university_id||'',faculty_id:record.audience_faculty_id||'',
  sources:options.filter(o=>o.survey_id===id&&o.source_id).map(o=>o.source_id)};
 formPreview=false;void ensureCatalog(formState.category).then(render).catch(e=>notice(String(e?.message||e),true));
}
async function submit(form){
 if(!authorized()||busy)return;
 const selected=new FormData(form).get('cover_file');
 const coverFile=pendingCoverFile||(selected&&typeof selected.size==='number'&&selected.name?selected:null);
 if(coverFile){try{api.surveyCoverValidateFile(coverFile);}catch(e){notice(String(e?.message||e),true);return;}}
 if(window.KanonhaJalali&&!window.KanonhaJalali.validateForm(form)){
  notice('تاریخ و ساعت شمسی شروع و پایان را کامل انتخاب کنید.',true);return;
 }
 saveFromForm(form);
 const fields={title:formState.title,description:formState.description,
  category:formState.category,kind:formState.kind,
  starts_at:formState.starts_at,ends_at:formState.ends_at,
  min_rank_votes:formState.min_rank_votes,
  audience_university_id:formState.university_id||null,
  audience_faculty_id:formState.faculty_id||null};
 const catalog=catalogs[fields.category]||[];
 if(formState.sources.length<1||formState.sources.length>12||
   formState.sources.some(id=>!catalog.some(c=>c.source_id===id))){
   notice('۱ تا ۱۲ گزینه معتبر از فهرست همان دسته انتخاب کنید.',true);return;
 }
 busy=true;render();
 let savedId=null;
 try{
  savedId=await api.surveySaveV21(editing,fields,formState.sources);
  if(coverFile)await api.surveyUploadCover(savedId,coverFile);
  setCoverFile(null);
  editing=null;formState=emptyForm();formPreview=false;confirmation=null;
  await load();
  feedback='پیش‌نویس'+(coverFile?' و عکس آن':'')+' با موفقیت ثبت شد.';isError=false;render();
 }catch(e){
  busy=false;
  if(savedId){
    setCoverFile(null);editing=savedId;
    await load();
    feedback='پیش‌نویس ذخیره شد، اما عکس بارگذاری نشد: '+String(e?.message||'خطا').slice(0,120);
    isError=true;render();
  }else notice('ثبت ناموفق: '+String(e?.message||'خطا').slice(0,120),true);
 }
}
async function removeCover(id){
 if(!authorized()||busy||!editing||editing!==id)return;
 busy=true;render();
 try{
  await api.surveyRemoveCover(id);
  await load();showEdit(id);
  feedback='عکس پیش‌نویس حذف شد.';isError=false;render();
 }catch(e){busy=false;notice('حذف عکس انجام نشد: '+String(e?.message||e).slice(0,120),true);}
}
async function change(action,id){
 if(!authorized()||busy)return;
 busy=true;confirmation=null;render();
 const map={pause:'paused',resume:'published',cancel:'cancelled',archive:'archived'};
 try{
  if(action==='publish')await api.surveyPublish(id);
  else if(action==='approve')await api.surveyApproveResults(id);
  else if(action==='delete')await api.surveyDeleteDraft(id);
  else if(action==='duplicate')await api.surveyDuplicate(id);
  else if(map[action])await api.surveyChangeStatus(id,map[action]);
  else throw new Error('عملیات نامعتبر');
  feedback='عملیات '+(actionNames[map[action]]||{
   publish:'انتشار',approve:'تأیید نتایج',delete:'حذف پیش‌نویس',duplicate:'تکثیر'
  }[action]||action)+' در سرور ثبت شد.';
  isError=false;
  await load();
  if(window.KanonhaRatings?.open)void window.KanonhaRatings.open();
 }catch(e){busy=false;notice('عملیات انجام نشد: '+String(e?.message||'خطا').slice(0,135),true);}
}
async function loadReport(id){
 if(!authorized()||busy)return;
 const s=polls.find(x=>x.id===id);if(!s)return;
 if(reportId===id){reportId=null;render();return;}
 busy=true;render();
 try{
  const [r,part]=await Promise.all([api.surveyResults(id),api.surveyParticipation(id)]);
  reportRows.set(id,r);participations.set(id,part);
  reportId=id;feedback='گزارش از آمار واقعی و تجمیعی پایگاه‌داده دریافت شد.';
  isError=false;
 }catch(e){feedback='دریافت گزارش ناموفق بود: '+String(e?.message||'خطا').slice(0,120);isError=true;}
 finally{busy=false;render();}
}
function exportReport(action,id){
 const s=polls.find(x=>x.id===id);
 if(!authorized()||!s||!reportRows.has(id)||!participations.has(id))return;
 const report=reports();if(!report)return notice('ماژول گزارش آماده نیست.',true);
 const opts=options.filter(o=>o.survey_id===id);
 const p=participations.get(id),values=reportRows.get(id);
 const basename='Kanonha-Survey-'+id.slice(0,8);
 if(action==='csv'){
   if(!report.saveCsv(basename+'.csv',report.buildCsv(s,opts,values,p)))
     notice('ذخیره CSV در این مرورگر پشتیبانی نمی‌شود.',true);
   else notice('انتخاب محل ذخیره فایل اکسل آغاز شد.');
 } else {
   if(!report.printPdf(report.buildHtml(s,opts,values,p)))
     notice('ساخت PDF نیازمند چاپگر اندروید است؛ نسخه نصب‌شده را باز کنید.',true);
   else notice('پنجره چاپ باز می‌شود؛ گزینه «ذخیره به‌صورت PDF» را انتخاب کنید.');
 }
}
async function addProfessor(form){
 if(!authorized()||busy)return;
 const fd=new FormData(form);
 const name=String(fd.get('professor_name')||'').trim(),
  faculty=String(fd.get('professor_faculty')||'').trim();
 if(name.length<2||name.length>120)return notice('نام استاد معتبر نیست.',true);
 busy=true;render();
 try{
  await api.ratingAddProfessor(name,faculty);
  await ensureCatalog('professor',true);
  feedback='استاد در فهرست مدیریت نظرسنجی‌ها ثبت شد.';isError=false;
 }catch(e){feedback='ثبت استاد انجام نشد: '+String(e?.message||'خطا').slice(0,120);isError=true;}
 finally{busy=false;render();}
}
function init(){
 const root=$('admin-content');if(!root)return;
 root.addEventListener('click',e=>{
  const filtered=e.target.closest('[data-survey-filter]');
  if(filtered&&authorized()){filter=filtered.dataset.surveyFilter;render();return;}
  const btn=e.target.closest('[data-surveys-action]');
  if(!btn||!authorized()||busy||!area())return;
  const action=btn.dataset.surveysAction,id=btn.dataset.surveyId;
  if(action==='reload'){void load();return;}
  if(action==='audit'){showAudit=!showAudit;render();return;}
  if(action==='cancel-edit'){setCoverFile(null);editing=null;formState=emptyForm();formPreview=false;render();return;}
  if(action==='edit'){showEdit(id);return;}
  if(action==='remove-cover'){void removeCover(id);return;}
  if(action==='preview-form'){
    const form=$('survey-manager-form');saveFromForm(form);formPreview=!formPreview;render();return;
  }
  if(action==='preview'){confirmation=confirmation===id+':preview'?null:id+':preview';render();return;}
  if(action==='report'){void loadReport(id);return;}
  if(action==='csv'||action==='pdf'){exportReport(action,id);return;}
  if(action==='duplicate'){void change('duplicate',id);return;}
  const base=action.replace(/-(ask|confirm)$/,'');
  const p=polls.find(x=>x.id===id);
  const allowed={
   publish:p?.status==='draft',delete:p?.status==='draft',
   pause:p?.status==='published'&&!ended(p),
   resume:p?.status==='paused'&&!ended(p),
   cancel:['published','paused'].includes(p?.status),
   archive:['published','paused'].includes(p?.status)&&ended(p),
   approve:p?.kind==='competition'&&['published','paused'].includes(p?.status)
      &&ended(p)&&!p.results_approved
  };
  if(!allowed[base])return;
  if(action.endsWith('-ask')){confirmation=id+':'+base;render();return;}
  if(action.endsWith('-confirm')&&confirmation===id+':'+base)void change(base,id);
 });
 root.addEventListener('change',e=>{
  if(!authorized()||busy||!area())return;
  const field=e.target?.name;
  if(field==='cover_file'){
    const file=e.target.files?.[0]||null;
    if(file){try{api.surveyCoverValidateFile(file);}catch(e){setCoverFile(null);notice(String(e?.message||e),true);return;}}
    setCoverFile(file);render();return;
  }
  if(!['category','kind','university_id','faculty_id','sources'].includes(field))return;
  const form=$('survey-manager-form');if(!form)return;
  const prev=formState.category;
  saveFromForm(form);
  if(field==='category'){
   if(formState.category!==prev)formState.sources=[];
   formPreview=false;
   void ensureCatalog(formState.category).then(render).catch(err=>notice(err?.message||'فهرست دریافت نشد.',true));
  }else if(field==='university_id'){
   formState.faculty_id='';render();
  }else if(field==='kind'||field==='faculty_id'){render();}
  else {
   const counter=$('survey-choice-count');
   if(counter)counter.textContent=nf(formState.sources.length)+' انتخاب';
  }
 });
 root.addEventListener('submit',e=>{
  if(!authorized())return;
  if(e.target.id==='survey-manager-form'){
   e.preventDefault();void submit(e.target);
  }else if(e.target.id==='survey-professor-form'){
   e.preventDefault();void addProfessor(e.target);
  }
 });
}
window.KanonhaRatingManagement=Object.freeze({mount,clear});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();