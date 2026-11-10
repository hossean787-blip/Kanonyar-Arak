(() => {
'use strict';
const months=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const format=new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'numeric',day:'numeric'});
const fa=n=>Number(n).toLocaleString('fa-IR',{useGrouping:false});
const latin=s=>String(s).replace(/[۰-۹]/g,x=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(x))).replace(/[٠-٩]/g,x=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(x)));
const parts=date=>Object.fromEntries(format.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,Number(latin(p.value))]));
const now=parts(new Date());
let year=now.year,month=now.month,day=now.day,body,overlay;
function findDate(y,m,d){
 const seed=Date.UTC(y-621,2,21,12);
 for(let offset=-365;offset<=365;offset++){
  const date=new Date(seed+offset*86400000),p=parts(date);
  if(p.year===y&&p.month===m&&p.day===d)return date;
 }
 return null;
}
function render(){
 if(!body)return;
 const first=findDate(year,month,1);
 if(!first)return;
 const offset=(first.getUTCDay()+1)%7;
 let length=month<=6?31:month<=11?30:findDate(year,12,30)?30:29;
 let html='<div class="sc-month"><button data-sc-prev aria-label="ماه قبل">›</button><strong>'+months[month-1]+' '+fa(year)+'</strong><button data-sc-next aria-label="ماه بعد">‹</button></div><div class="sc-grid">';
 html+=['ش','ی','د','س','چ','پ','ج'].map(w=>'<span class="sc-weekday">'+w+'</span>').join('');
 html+='<span></span>'.repeat(offset);
 for(let n=1;n<=length;n++){
  const selected=n===day,today=year===now.year&&month===now.month&&n===now.day;
  html+='<button data-sc-day="'+n+'" class="'+(selected?'sc-selected ':'')+(today?'sc-today':'')+'">'+fa(n)+'</button>';
 }
 body.innerHTML=html+'</div><p class="sc-date">'+fa(day)+' '+months[month-1]+' '+fa(year)+'</p>';
}
function shift(step){month+=step;if(month<1){month=12;year--}if(month>12){month=1;year++}day=1;render();}
function init(){
 const home=document.querySelector('#screen-home .home-body');
 if(!home)return;
 const entry=document.createElement('button');
 entry.type='button';entry.className='sc-entry';
 entry.innerHTML='<span class="sc-icon">▦</span><span><strong>تقویم دانشجویی</strong><small>'+fa(now.day)+' '+months[now.month-1]+' '+fa(now.year)+'</small></span><span>‹</span>';
 home.prepend(entry);
 overlay=document.createElement('div');overlay.className='sc-overlay';overlay.hidden=true;
 overlay.innerHTML='<section class="sc-panel" role="dialog" aria-modal="true" aria-label="تقویم دانشجویی"><header><strong>تقویم دانشجویی</strong><button data-sc-close aria-label="بستن">×</button></header><div id="sc-content"></div></section>';
 document.body.append(overlay);body=document.getElementById('sc-content');
 entry.addEventListener('click',()=>{render();overlay.hidden=false;overlay.querySelector('[data-sc-close]').focus()});
 overlay.addEventListener('click',e=>{
  if(e.target===overlay||e.target.closest('[data-sc-close]'))overlay.hidden=true;
  if(e.target.closest('[data-sc-prev]'))shift(-1);
  if(e.target.closest('[data-sc-next]'))shift(1);
  const target=e.target.closest('[data-sc-day]');
  if(target){day=Number(target.dataset.scDay);render();}
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape')overlay.hidden=true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();