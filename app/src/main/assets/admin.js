/* Kanonha global manager desk. All mutations go to JWT-verified Edge Function. */
(() => {
'use strict';
const api=window.KanonhaBackend;
const root=document.getElementById('admin-panel');
if(!root||!api||!api.enabled)return;
const $=id=>document.getElementById(id);
const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=x=>window.KanonhaJalali?window.KanonhaJalali.formatDate(x,true):new Date(x).toLocaleString('fa-IR');
const inputTime=x=>{const d=new Date(x);return Number.isFinite(d.getTime())?new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16):''};
const v=(fd,name)=>String(fd.get(name)||'').trim();
let seq=0,owner='',data=null,tab='dashboard',editor=null,busy=false,confirmDelete='',rosterFor='',authorized=false;
function home(show){
 const box=$('home-management'); if(!box)return;
 if(show) {
   box.hidden=false;
   box.dataset.mode='admin';
   $('home-management-overline').textContent='دسترسی مدیرکل فعال';
   $('home-management-title').textContent='مدیریت کل کانون‌ها';
   $('home-management-caption').textContent='مدیریت کانون‌ها، دبیران، کاربران و رویدادها';
   $('home-management-btn').textContent='ورود به مدیریت کل';
 } else if(box.dataset.mode==='admin'){box.hidden=true;box.dataset.mode='';}
}
function clear(){
 seq++; owner='';data=null;editor=null;busy=false;confirmDelete='';rosterFor='';authorized=false;
 root.hidden=true;$('admin-content').innerHTML='';$('admin-message').textContent='';home(false);
}
function signed(){return Boolean(owner&&api.currentUser&&api.currentUser.id===owner)}
function msg(s,isError=false){$('admin-message').textContent=s;$('admin-message').style.color=isError?'#a14440':'#267050'}
function fail(e){return String(e&&e.message||'خطای ارتباط با سرور').slice(0,180)}
function student(id){const u=(data?.users||[]).find(x=>x.user_id===id);
 return u ? (u.full_name||'دانشجو')+' — '+(u.student_number||'') : 'کاربر '+String(id||'').slice(0,8)}
function club(id){const c=(data?.clubs||[]).find(x=>x.id===id);return c?c.name||'کانون':'کانون نامشخص'}
function empty(x){return '<div class="secretary-empty">'+esc(x)+'</div>'}
function action(label,key,value='',extra=''){return '<button type="button" '+key+'="'+esc(value)+'" '+extra+'>'+esc(label)+'</button>'}
function stats(){
 const d=data||{};
 return '<div class="admin-stats">'+[
 ['کانون‌ها',d.clubs?.length],['رویدادها',d.events?.length],
 ['دانشجویان',d.users?.length],['دبیران',d.secretaries?.length],
 ['درخواست‌های عضویت',d.memberships?.filter(x=>x.status==='pending').length],
 ['ثبت‌نام‌های رویداد',d.registrations?.length]
 ].map(([name,n])=>'<div class="admin-stat"><strong>'+Number(n||0)+'</strong><span>'+esc(name)+'</span></div>').join('')+'</div>';
}
function dashboard(){
 return stats()+'<div class="secretary-card"><h3 class="secretary-card-title">محدوده دسترسی</h3>'+
 '<p class="secretary-card-p">این پنل فقط برای حساب مدیرکل تأییدشده توسط سرور فعال است. تغییر دبیران و اعتبارسنجی دانشجو از همین بخش انجام می‌شود.</p>'+
 '<button type="button" class="secretary-cta" data-admin-action="reload">بروزرسانی اطلاعات</button></div>';
}
function clubForm(){
 const c=editor?.type==='club'?(data.clubs.find(x=>x.id===editor.id)||{}):{};
 return '<form id="admin-club-form" class="secretary-form secretary-card">'+
 '<h3 class="secretary-card-title">'+(editor?.id?'ویرایش کانون':'ثبت کانون جدید')+'</h3>'+
 '<label class="field">نام کانون<input name="name" required maxlength="120" value="'+esc(c.name||'')+'"></label>'+
 '<label class="field">دسته‌بندی<input name="category" required maxlength="80" value="'+esc(c.category||'فرهنگی')+'"></label>'+
 '<label class="field">معرفی کانون<textarea name="description" maxlength="2000">'+esc(c.description||'')+'</textarea></label>'+
 '<label class="field admin-check"><input type="checkbox" name="is_active" value="1"'+(c.is_active?' checked':'')+'> فعال و قابل مشاهده برای دانشجویان</label>'+
 '<div class="secretary-actions"><button class="positive" type="submit">ذخیره کانون</button>'+
 action('انصراف','data-admin-action','cancel')+'</div></form>';
}
function clubs(){
 return '<div class="secretary-actions">'+action('+ کانون جدید','data-admin-action','new-club','class="positive"')+'</div>'+
 (editor?.type==='club'?clubForm():'')+
 (!data.clubs.length?empty('هنوز کانون واقعی تعریف نشده است.'):
 data.clubs.map(c=>'<article class="secretary-card"><h3 class="secretary-card-title">'+esc(c.name)+'</h3>'+
 '<span class="secretary-chip '+(c.is_active?'':'pending')+'">'+(c.is_active?'فعال':'غیرفعال')+'</span>'+
 '<p class="secretary-card-p">'+esc(c.category)+' · '+esc(c.description)+'</p>'+
 '<div class="secretary-actions">'+action('ویرایش','data-admin-edit-club',c.id)+
 action(confirmDelete===c.id?'تأیید حذف کانون':'حذف کانون','data-admin-delete-club',c.id,
 'class="negative"')+'</div></article>').join(''));
}
function eventForm(){
 const e=editor?.type==='event'?(data.events.find(x=>x.id===editor.id)||{}):{};
 return '<form id="admin-event-form" class="secretary-card secretary-form">'+
 '<h3 class="secretary-card-title">'+(editor?.id?'ویرایش رویداد':'ثبت رویداد جدید')+'</h3>'+
 '<label class="field">کانون برگزارکننده<select name="club_id" required>'+
 data.clubs.map(c=>'<option value="'+esc(c.id)+'"'+(c.id===e.club_id?' selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select></label>'+
 '<label class="field">عنوان<input name="title" required maxlength="160" value="'+esc(e.title||'')+'"></label>'+
 '<label class="field">مکان<input name="location" maxlength="250" value="'+esc(e.location||'')+'"></label>'+
 '<label class="field">زمان شروع<input type="datetime-local" name="starts_at" required value="'+esc(inputTime(e.starts_at))+'"></label>'+
 '<label class="field">مهلت ثبت‌نام<input type="datetime-local" name="registration_deadline" required value="'+esc(inputTime(e.registration_deadline))+'"></label>'+
 '<label class="field">ظرفیت<input type="number" name="capacity" min="1" max="100000" required value="'+Number(e.capacity||25)+'"></label>'+
 '<label class="field admin-check"><input type="checkbox" name="is_published" value="1"'+(e.is_published?' checked':'')+'> انتشار برای دانشجویان</label>'+
 '<div class="secretary-actions"><button class="positive" type="submit">ذخیره رویداد</button>'+
 action('انصراف','data-admin-action','cancel')+'</div></form>';
}
function roster(eventId){
 const rows=data.registrations.filter(x=>x.event_id===eventId);
 if(!rows.length)return empty('هیچ ثبت‌نام‌کننده‌ای وجود ندارد.');
 const e=data.events.find(x=>x.id===eventId);
 const started=e&&Date.parse(e.starts_at)<=Date.now();
 return '<div class="secretary-card"><h3 class="secretary-card-title">ثبت‌نام‌کنندگان — '+esc(e?.title||'')+'</h3>'+
 rows.map(r=>'<div class="admin-roster-row"><div><strong>'+esc(student(r.user_id))+'</strong><small>'+
 (r.attended_at?'حاضر · '+esc(date(r.attended_at)):'حضور ثبت نشده')+'</small></div>'+
 action(r.attended_at?'لغو حضور':'ثبت حضور','data-admin-attendance',r.id,
 'data-present="'+(r.attended_at?'false':'true')+'"'+(started?'':' disabled'))+'</div>').join('')+'</div>';
}
function events(){
 return '<div class="secretary-actions">'+action('+ رویداد جدید','data-admin-action','new-event','class="positive"')+'</div>'+
 (editor?.type==='event'?eventForm():'')+
 (rosterFor?roster(rosterFor):'')+
 (!data.events.length?empty('رویدادی تعریف نشده است.'):
 data.events.map(e=>'<article class="secretary-card"><h3 class="secretary-card-title">'+esc(e.title)+'</h3>'+
 '<p class="secretary-card-p">'+esc(club(e.club_id))+' · '+esc(date(e.starts_at))+'</p>'+
 '<p class="secretary-card-meta">ظرفیت: '+Number(e.registered_count||0)+' / '+Number(e.capacity||0)+
 ' · '+(e.is_published?'منتشرشده':'پیش‌نویس')+'</p><div class="secretary-actions">'+
 (Number(e.registered_count||0)===0?action('ویرایش','data-admin-edit-event',e.id):'')+
 action('ثبت‌نام‌کنندگان','data-admin-roster',e.id)+
 (Number(e.registered_count||0)===0?action(confirmDelete===e.id?'تأیید حذف':'حذف','data-admin-delete-event',e.id,'class="negative"'):'')+
 '</div></article>').join(''));
}
function memberships(){
 const requests=[...data.memberships].sort((a,b)=>(a.status==='pending'?0:1)-(b.status==='pending'?0:1));
 return requests.length?requests.map(m=>'<article class="secretary-card"><h3 class="secretary-card-title">'+esc(student(m.user_id))+'</h3>'+
 '<p class="secretary-card-p">کانون: '+esc(club(m.club_id))+'</p><span class="secretary-chip '+(m.status==='pending'?'pending':'')+'">'+
 esc(m.status==='pending'?'در انتظار بررسی':m.status==='approved'?'تأییدشده':'رد شده')+'</span>'+
 (m.status==='pending'?'<div class="secretary-actions">'+action('تأیید','data-admin-member',m.id,'data-status="approved" class="positive"')+
 action('رد','data-admin-member',m.id,'data-status="rejected" class="negative"')+'</div>':'')+'</article>').join('')
 :empty('درخواست عضویتی ثبت نشده است.');
}
function secretaries(){
 const form='<form id="admin-secretary-form" class="secretary-form secretary-card">'+
 '<h3 class="secretary-card-title">تعیین دبیر کانون</h3>'+
 '<p class="secretary-card-p">انتخاب دبیر براساس شماره دانشجویی ثبت‌شده انجام می‌شود. سمت مدیریتی به حساب احراز هویت‌شده متصل است.</p>'+
 '<label class="field">دانشجو<select name="user_id" required><option value="">انتخاب دانشجو</option>'+
 data.users.map(u=>'<option value="'+esc(u.user_id)+'">'+esc(student(u.user_id))+'</option>').join('')+'</select></label>'+
 '<label class="field">کانون<select name="club_id" required><option value="">انتخاب کانون</option>'+
 data.clubs.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('')+'</select></label>'+
 '<button class="secretary-cta" type="submit">تعیین دبیر</button></form>';
 return form+(data.secretaries.length?data.secretaries.map(a=>'<div class="secretary-card"><h3 class="secretary-card-title">'+
 esc(student(a.user_id))+'</h3><p class="secretary-card-p">دبیر '+esc(club(a.club_id))+'</p>'+
 '<div class="secretary-actions">'+action('لغو مسئولیت','data-admin-revoke',a.user_id,
 'data-club-id="'+esc(a.club_id)+'" class="negative"')+'</div></div>').join(''):empty('هیچ دبیری تعیین نشده است.'));
}
function facultyOptions(university,selected=''){
 const uni=(data?.universities||[]).find(x=>x.name===university);
 const items=(data?.faculties||[]).filter(x=>x.university_id===uni?.id);
 let out='<option value="">انتخاب دانشکده</option>';
 if(selected&&!items.some(x=>x.name===selected))
   out+='<option value="'+esc(selected)+'" selected>'+esc(selected)+' (ثبت‌شده قبلی)</option>';
 return out+items.map(x=>'<option value="'+esc(x.name)+'"'+
   (x.name===selected?' selected':'')+'>'+esc(x.name)+'</option>').join('');
}
function studentForm(){
 const u=data.users.find(x=>x.user_id===editor?.id);
 if(!u)return '';
 return '<form id="admin-student-form" class="secretary-card secretary-form"><h3 class="secretary-card-title">ویرایش اطلاعات دانشجو</h3>'+
 '<p class="secretary-card-p">'+esc(u.student_number)+'</p>'+
 '<label class="field">نام<input name="full_name" required maxlength="80" value="'+esc(u.full_name||'')+'"></label>'+
 '<label class="field">دانشگاه<select name="university" data-admin-student-university required>'+
 '<option value="">انتخاب دانشگاه</option>'+
 (data.universities||[]).map(x=>'<option value="'+esc(x.name)+'"'+
 (x.name===u.academic?.university?' selected':'')+'>'+esc(x.name)+'</option>').join('')+
 (!(data.universities||[]).some(x=>x.name===u.academic?.university)&&u.academic?.university?
 '<option selected value="'+esc(u.academic.university)+'">'+esc(u.academic.university)+' (ثبت‌شده قبلی)</option>':'')+
 '</select></label>'+
 '<label class="field">دانشکده<select name="faculty" data-admin-student-faculty required>'+
 facultyOptions(u.academic?.university||'',u.academic?.faculty||'')+
 '</select></label>'+
 ['major','mobile'].map((k,i)=>'<label class="field">'+['رشته','شماره موبایل'][i]+
 '<input name="'+k+'" required maxlength="120" value="'+esc(u.academic?.[k]||'')+'"></label>').join('')+
 '<div class="secretary-actions"><button type="submit" class="positive">ذخیره</button>'+
 action('انصراف','data-admin-action','cancel')+'</div></form>';
}
function students(){
 return (editor?.type==='student'?studentForm():'')+
 (data.users.length?data.users.map(u=>'<article class="secretary-card">'+
 '<h3 class="secretary-card-title">'+esc(u.full_name||'')+'</h3>'+
 '<p class="secretary-card-p">شماره دانشجویی: '+esc(u.student_number||'')+'</p>'+
 '<p class="secretary-card-meta">'+esc(u.academic?.university||'—')+' | '+esc(u.academic?.faculty||'—')+' | '+esc(u.academic?.major||'—')+'</p>'+
 '<span class="secretary-chip '+(u.university_verified?'':'pending')+'">'+(u.university_verified?'تأیید دانشگاهی':'خوداظهاری')+'</span>'+
 '<div class="secretary-actions">'+action('ویرایش مشخصات','data-admin-edit-student',u.user_id)+
 action(u.university_verified?'لغو تأیید':'تأیید اطلاعات','data-admin-verify',u.user_id,
 'data-verify="'+(u.university_verified?'false':'true')+'"')+'</div></article>').join(''):
 empty('دانشجویی ثبت‌نام نکرده است.'));
}
function universities(){
 const universities=data?.universities||[],faculties=data?.faculties||[];
 const items=universities.map(u=>{
  const children=faculties.filter(f=>f.university_id===u.id);
  return '<article class="secretary-card"><h3 class="secretary-card-title">'+esc(u.name)+'</h3>'+
   '<p class="secretary-card-p">'+children.length.toLocaleString('fa-IR')+' دانشکده تعریف‌شده</p>'+
   (children.length?'<div class="academy-chip-row">'+children.map(f=>
    '<span class="academy-chip">'+esc(f.name)+'</span>').join('')+'</div>':
    '<p class="secretary-card-meta">هنوز دانشکده‌ای برای این دانشگاه ثبت نشده است.</p>')+
   '</article>';
 }).join('');
 return '<div class="academy-management">'+
  '<header class="academy-management-intro"><h3>دانشگاه‌ها و دانشکده‌ها</h3>'+
  '<p>دانشجو فقط از فهرستی که شما ایجاد کرده‌اید انتخاب می‌کند. ابتدا دانشگاه و بعد دانشکده را تعریف کنید.</p></header>'+
  '<form id="admin-university-form" class="secretary-card secretary-form">'+
  '<h3 class="secretary-card-title">افزودن دانشگاه</h3>'+
  '<label class="field">نام دانشگاه<input name="name" required minlength="2" maxlength="120" placeholder="نام کامل دانشگاه"></label>'+
  '<button type="submit" class="positive academy-submit">ثبت دانشگاه</button></form>'+
  '<form id="admin-faculty-form" class="secretary-card secretary-form">'+
  '<h3 class="secretary-card-title">افزودن دانشکده</h3>'+
  '<label class="field">دانشگاه<select name="university_id" required><option value="">انتخاب دانشگاه</option>'+
  universities.map(u=>'<option value="'+esc(u.id)+'">'+esc(u.name)+'</option>').join('')+
  '</select></label>'+
  '<label class="field">نام دانشکده<input name="name" required minlength="2" maxlength="120" placeholder="نام دانشکده"></label>'+
  '<button type="submit" class="positive academy-submit"'+(universities.length?'':' disabled')+'>ثبت دانشکده</button></form>'+
  '<div class="academy-directory"><h3>فهرست ثبت‌شده</h3>'+
  (items||empty('هنوز دانشگاهی تعریف نشده است.'))+'</div></div>';
}
function render(){
 if(!signed()||!data)return;
 for(const el of root.querySelectorAll('[data-admin-tab]')) {
  el.classList.toggle('active',el.dataset.adminTab===tab);
  el.setAttribute('aria-pressed',el.dataset.adminTab===tab?'true':'false');
 }
 $('admin-content').innerHTML=tab==='dashboard'?dashboard():tab==='clubs'?clubs():tab==='events'?events():
  tab==='members'?memberships():tab==='secretaries'?secretaries():
  tab==='universities'?universities():students();
 if(window.KanonhaJalali)window.KanonhaJalali.enhance($('admin-content'));
}
async function refresh(){
 clear();const current=api.currentUser;
 if(!current?.id)return;
 owner=current.id;const attempt=seq;
 try{
  if(!await api.isManager()){clear();return}
  if(attempt!==seq||!signed())return;
  authorized=true;
  const result=await api.adminAction('overview');
  if(attempt!==seq||!signed())return;
  data=result;root.hidden=false;home(true);render();msg('داده‌ها از سرور اختصاصی کانون‌ها دریافت شدند.');
 }catch(e){if(attempt===seq&&signed()){root.hidden=false;home(true);msg(fail(e),true);}}
}
async function reload(){
 const attempt=seq,uid=owner;
 const result=await api.adminAction('overview');
 if(attempt!==seq||uid!==owner||!signed())return;
 data=result;editor=null;confirmDelete='';rosterFor='';render();msg('آخرین اطلاعات دریافت شد.');
}
async function perform(op,fields){
 if(busy||!signed())return;
 busy=true;msg('در حال ثبت در سرور…');
 try{await api.adminAction(op,fields);await reload()}catch(e){msg(fail(e),true)}
 finally{busy=false}
}
root.addEventListener('click',ev=>{
 const btn=ev.target.closest('button');
 if(!btn||!root.contains(btn)||!signed())return;
 const d=btn.dataset;
 if(d.adminTab){tab=d.adminTab;editor=null;rosterFor='';render();return}
 if(d.adminAction==='reload'){void reload();return}
 if(d.adminAction==='cancel'){editor=null;render();return}
 if(d.adminAction==='new-club'){tab='clubs';editor={type:'club'};render();return}
 if(d.adminAction==='new-event'){tab='events';editor={type:'event'};render();return}
 if(d.adminEditClub){tab='clubs';editor={type:'club',id:d.adminEditClub};render();return}
 if(d.adminEditEvent){tab='events';editor={type:'event',id:d.adminEditEvent};render();return}
 if(d.adminEditStudent){tab='students';editor={type:'student',id:d.adminEditStudent};render();return}
 if(d.adminRoster){rosterFor=d.adminRoster;render();return}
 if(d.adminDeleteClub||d.adminDeleteEvent){
  const id=d.adminDeleteClub||d.adminDeleteEvent;
  if(confirmDelete!==id){confirmDelete=id;msg('برای حذف قطعی، دوباره روی دکمه قرمز بزنید.');render();return}
  confirmDelete='';
  void perform(d.adminDeleteClub?'club.delete':'event.delete',{id,confirm:'DELETE'});
  return;
 }
 if(d.adminMember&&['approved','rejected'].includes(d.status)){void perform('member.decide',{id:d.adminMember,status:d.status});return}
 if(d.adminRevoke&&d.clubId){void perform('secretary.revoke',{user_id:d.adminRevoke,club_id:d.clubId});return}
 if(d.adminVerify&&['true','false'].includes(d.verify)){void perform('student.verify',{user_id:d.adminVerify,verified:d.verify==='true'});return}
 if(d.adminAttendance&&d.present){void perform('roster.attendance',{id:d.adminAttendance,present:d.present==='true'});return}
});
root.addEventListener('change',ev=>{
 if(!ev.target || !ev.target.dataset || !('adminStudentUniversity' in ev.target.dataset))return;
 const form=ev.target.closest('form');
 if(!form)return;
 const faculty=form.querySelector('select[data-admin-student-faculty]');
 if(faculty)faculty.innerHTML=facultyOptions(ev.target.value);
});
root.addEventListener('submit',ev=>{
 const f=ev.target;
 if(!['admin-club-form','admin-event-form','admin-secretary-form','admin-student-form',
   'admin-university-form','admin-faculty-form'].includes(f.id))return;
 ev.preventDefault();
 if(window.KanonhaJalali&&!window.KanonhaJalali.validateForm(f)){
   msg('لطفاً تاریخ و ساعت را به صورت شمسی کامل انتخاب کنید.',true);return;
 }
 const fd=new FormData(f);
 if(f.id==='admin-university-form'){
  void perform('university.create',{name:v(fd,'name')});return;
 }
 if(f.id==='admin-faculty-form'){
  void perform('faculty.create',{university_id:v(fd,'university_id'),name:v(fd,'name')});return;
 }
 if(f.id==='admin-secretary-form'){
   void perform('secretary.assign',{user_id:v(fd,'user_id'),club_id:v(fd,'club_id')});return;
 }
 if(f.id==='admin-student-form'){
   void perform('student.edit',{user_id:editor?.id,full_name:v(fd,'full_name'),
     university:v(fd,'university'),faculty:v(fd,'faculty'),major:v(fd,'major'),mobile:v(fd,'mobile')});return;
 }
 if(f.id==='admin-club-form'){
   void perform(editor?.id?'club.update':'club.create',{id:editor?.id,name:v(fd,'name'),
    description:v(fd,'description'),category:v(fd,'category'),is_active:fd.get('is_active')==='1'});return;
 }
 const iso=name=>{const d=new Date(v(fd,name));return Number.isFinite(d.getTime())?d.toISOString():''};
 void perform(editor?.id?'event.update':'event.create',{
  id:editor?.id,club_id:v(fd,'club_id'),title:v(fd,'title'),location:v(fd,'location'),
  starts_at:iso('starts_at'),registration_deadline:iso('registration_deadline'),
  capacity:Number(fd.get('capacity')),is_published:fd.get('is_published')==='1'
 });
});
function hasAccess(){return signed()&&authorized}
function showTab(next){
 if(!hasAccess()||!['dashboard','clubs','events','students','secretaries','members','universities'].includes(next))return false;
 if(tab!==next){tab=next;editor=null;rosterFor='';confirmDelete='';render()}
 return true;
}
window.KanonhaAdminPanel=Object.freeze({refresh,clear,hasAccess,showTab});
})();
