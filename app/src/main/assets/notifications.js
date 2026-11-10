/* Kanonha authenticated inbox: no demo announcements in online accounts. */
(() => {
'use strict';
const api=window.KanonhaBackend;
if(!api?.enabled)return;
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kindLabel={event:'رویداد',club:'کانون جدید',update:'به‌روزرسانی',general:'اطلاعیه'};
let owner='',inbox=[],busy=false,inboxOpen=false,requestVersion=0,loaded=false;
function countUnread(){return inbox.filter(n=>!n.read_at).length}
function summary(){
 const banner=$('notice-btn');if(!banner)return;
 const title=banner.querySelector('.home-notice-title'),subtitle=banner.querySelector('.home-notice-subtitle');
 const badge=banner.querySelector('.home-notice-new');
 if(!api.currentUser){banner.setAttribute('aria-label','مشاهده اعلان‌ها؛ ابتدا وارد حساب شوید');return}
 const newest=inbox[0]?.campaign,unread=countUnread();
 banner.setAttribute('aria-label',unread+' اعلان خوانده‌نشده؛ مشاهده مرکز اعلان‌ها');
 if(title)title.textContent=newest?.title||'مرکز اعلان‌ها';
 if(subtitle)subtitle.textContent=newest?.body||'فعلاً اطلاعیه جدیدی وجود ندارد.';
 if(badge)badge.textContent=unread?unread.toLocaleString('fa-IR')+' جدید':'به‌روز';
}
function container(){
 let wrap=$('kanonha-notice-overlay');if(wrap)return wrap;
 wrap=document.createElement('div');wrap.id='kanonha-notice-overlay';
 wrap.className='notice-overlay';wrap.hidden=true;
 wrap.innerHTML='<div class="notice-backdrop" data-notice-close></div>'+
 '<section class="notice-inbox" role="dialog" aria-modal="true" aria-labelledby="notice-inbox-title">'+
 '<header class="notice-inbox-header"><div><small>کانون‌ها · اطلاع‌رسانی</small>'+
 '<h2 id="notice-inbox-title">🔔 اعلان‌های من</h2></div>'+
 '<button type="button" data-notice-close aria-label="بستن مرکز اعلان‌ها">✕</button></header>'+
 '<div id="kanonha-notice-list" class="notice-inbox-list" aria-live="polite"></div></section>';
 document.body.appendChild(wrap);
 wrap.addEventListener('click',async e=>{
  if(e.target.closest('[data-notice-close]')){close();return;}
  const card=e.target.closest('[data-notice-id]');
  if(!card)return;
  const id=card.dataset.noticeId,row=inbox.find(n=>n.id===id);
  if(!row)return;
  if(!row.read_at){
   try{await api.notificationRead(id);row.read_at=new Date().toISOString();summary();draw();}
   catch(err){status('علامت‌گذاری اعلان ناموفق بود: '+String(err.message||''));return;}
  }
  const target=row.campaign;
  close();
  if(target?.kind==='event'||target?.kind==='club'||target?.kind==='update'){
   const ok=window.KanonhaPreview?.openNotificationTarget?.(target.kind,target.related_id);
   if(!ok)status('این مورد دیگر در فهرست عمومی در دسترس نیست.');
  }
 });
 return wrap;
}
function status(text){
 const notice=$('kanonha-notice-list');
 if(notice)notice.insertAdjacentHTML('afterbegin','<p class="notice-inbox-info">'+escape(text)+'</p>');
}
function draw(){
 const box=$('kanonha-notice-list');if(!box)return;
 if(!api.currentUser){box.innerHTML='<p class="notice-inbox-info">برای مشاهده اعلان‌ها وارد حساب شوید.</p>';return;}
 if(!loaded){box.innerHTML='<p class="notice-inbox-info">در حال دریافت اعلان‌ها…</p>';return;}
 if(!inbox.length){box.innerHTML='<div class="notice-inbox-empty">📭<strong>هنوز اعلانی دریافت نکرده‌اید</strong><span>پیام‌های مدیرکل در همین بخش نمایش داده می‌شوند.</span></div>';return;}
 box.innerHTML=inbox.map(n=>{
  const c=n.campaign||{};
  const label=kindLabel[c.kind]||'اطلاعیه';
  const linked=['event','club','update'].includes(c.kind);
  return '<button class="notice-inbox-item'+(!n.read_at?' unread':'')+'" type="button" data-notice-id="'+escape(n.id)+'">'+
  '<span class="notice-item-top"><span class="notice-item-kind">'+escape(label)+'</span>'+
  (!n.read_at?'<span class="notice-item-unread">جدید</span>':'')+'</span>'+
  '<strong>'+escape(c.title)+'</strong><span class="notice-item-body">'+escape(c.body)+'</span>'+
  '<span class="notice-item-footer"><time>'+escape(new Date(n.created_at).toLocaleString('fa-IR'))+
  '</time>'+(linked?'<span>مشاهده جزئیات ←</span>':'')+'</span></button>';
 }).join('');
}
async function refresh(){
 const user=api.currentUser?.id||'';
 if(!user){if(owner){clear();}return;}
 if(busy&&owner===user)return;
 if(owner!==user){owner=user;inbox=[];loaded=false;}
 const run=++requestVersion;busy=true;
 try{
  const rows=await api.notificationInbox();
  if(run!==requestVersion||owner!==api.currentUser?.id)return;
  inbox=Array.isArray(rows)?rows:[];loaded=true;summary();if(inboxOpen)draw();
 }catch(e){
  if(run===requestVersion&&inboxOpen){loaded=true;draw();status('خطا در دریافت اعلان‌ها: '+String(e.message||''));}
 }finally{if(run===requestVersion)busy=false;}
}
function open(){
 inboxOpen=true;const wrap=container();wrap.hidden=false;draw();
 document.body.classList.add('notice-dialog-open');
 void refresh();
}
function close(){
 inboxOpen=false;const wrap=$('kanonha-notice-overlay');if(wrap)wrap.hidden=true;
 document.body.classList.remove('notice-dialog-open');
}
function clear(){
 requestVersion++;owner='';inbox=[];busy=false;loaded=false;close();
}
document.addEventListener('DOMContentLoaded',()=>{
 const button=$('notice-btn');
 if(button)button.addEventListener('click',e=>{
  e.stopImmediatePropagation();e.preventDefault();
  if(!api.currentUser){const info=$('profile-service-note');if(info)info.textContent='برای مشاهده اعلان‌ها ابتدا وارد شوید.';window.KanonhaPreview?.go?.('profile');return;}
  open();
 },true);
 window.setInterval(()=>{if(!document.hidden&&api.currentUser)void refresh();},60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh()});
 if(api.currentUser)void refresh();
});
window.KanonhaNotifications=Object.freeze({refresh,open,clear});
})();