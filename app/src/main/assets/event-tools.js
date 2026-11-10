/* Event-only presentation helpers. No credentials, no remote services. */
(()=>{
 'use strict';
 const esc=s=>String(s??'');
 const csvCell=value=>{
  let s=esc(value);
  // Prevent spreadsheet formula injection in exported personal fields.
  if(/^[\s\uFEFF]*[=+@\-\t\r]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
 };
 function exportEventCsv(report,scope='event'){
  if(!report||!Array.isArray(report.rows)||!report.event)return false;
  const event=report.event;
  const lines=[
   ['عنوان رویداد',event.title],['ظرفیت کل',event.capacity],
   ['تعداد ثبت‌نام',report.registered??report.rows.length],
   ['تعداد حاضر',report.attended??report.rows.filter(r=>r.attended_at).length],
   ['وضعیت خروجی',report.truncated?'ناقص؛ بیش از ۱۰۰۰۰ ثبت‌نام':'کامل'],
   [],
   ['ردیف','نام دانشجو','شماره دانشجویی','زمان ثبت‌نام','حضور','زمان حضور']
  ];
  report.rows.forEach((r,i)=>lines.push([
   i+1,r.student?.full_name||'نامشخص',r.student?.student_number||'',
   r.registered_at||'',r.attended_at?'حاضر':'غایب',r.attended_at||''
  ]));
  const csv='\uFEFF'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n');
  if(!window.AndroidSurveyExports?.saveCsv)return false;
  // Browser btoa expects Latin-1; encode UTF-8 before base64.
  const bytes=new TextEncoder().encode(csv);let binary='';
  for(let i=0;i<bytes.length;i+=0x4000){
   binary+=String.fromCharCode(...bytes.slice(i,i+0x4000));
  }
  const safeName='kanonha-'+scope+'-'+String(event.id||'event').slice(0,36)+'.csv';
  window.AndroidSurveyExports.saveCsv(safeName,btoa(binary));
  return true;
 }
 function renderQr(container,token){
  if(!container||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(token)))return false;
  if(typeof window.QRCode!=='function')return false;
  container.textContent='';
  new window.QRCode(container,{text:'KANONHA1:'+token,width:172,height:172,
    colorDark:'#142927',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.M});
  return true;
 }
 window.KanonhaEventTools=Object.freeze({exportEventCsv,renderQr});
})();
