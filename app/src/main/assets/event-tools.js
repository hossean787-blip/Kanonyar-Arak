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
 function eventReportRows(report){
  if(!report||!report.event||!Array.isArray(report.rows)||report.truncated)return null;
  const e=report.event;
  const out=[
   ['رویداد',e.title||''],['تاریخ برگزاری',e.starts_at||''],
   ['محل برگزاری',e.location||''],['ظرفیت',String(e.capacity??'')],
   ['ثبت‌نام قطعی',String(report.registered??report.rows.length)],
   ['حضور ثبت‌شده',String(report.attended??report.rows.filter(r=>r.attended_at).length)],
   [],['ردیف','نام دانشجو','شماره دانشجویی','زمان ثبت‌نام','وضعیت حضور','زمان حضور']
  ];
  report.rows.forEach((r,i)=>out.push([
   String(i+1),r.student?.full_name||'نامشخص',r.student?.student_number||'',
   r.registered_at||'',r.attended_at?'حاضر':'ثبت نشده',r.attended_at||''
  ]));
  return out;
 }
 function exportEventExcel(report,scope='secretary'){
  const rows=eventReportRows(report),bridge=window.AndroidEventExcel;
  if(!rows||!bridge||typeof bridge.saveExcel!=='function')return false;
  const file='Kanonha-Event-'+scope+'-'+String(report.event.id||'event').slice(0,36)+'.xlsx';
  const json=JSON.stringify(rows);
  if(json.length>1900000)return false;
  bridge.saveExcel(file,json);
  return true;
 }
 const htmlEsc=s=>String(s??'').replace(/[&<>"']/g,c=>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function exportEventPdf(report,scope='secretary'){
  const rows=eventReportRows(report),bridge=window.AndroidSurveyExports;
  if(!rows||!bridge||typeof bridge.printHtmlNamed!=='function')return false;
  const e=report.event;
  const meta=rows.slice(0,6).map(row=>'<div class="meta"><strong>'+htmlEsc(row[0])+
    ':</strong> '+htmlEsc(row[1])+'</div>').join('');
  const body=rows.slice(8).map(row=>'<tr>'+row.map(cell=>
    '<td>'+htmlEsc(cell)+'</td>').join('')+'</tr>').join('');
  const html='<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">'+
   '<style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}'+
   'body{direction:rtl;font-family:Tahoma,Arial,sans-serif;color:#242b65;background:#fff}'+
   'h1{text-align:center;font-size:22px;margin:4px 0 16px}.details{display:flex;flex-wrap:wrap;gap:5px 22px;margin-bottom:18px}'+
   '.meta{font-size:12px;padding:4px}table{width:100%;border-collapse:collapse;font-size:10px}'+
   'th,td{border:1px solid #d5d9ea;padding:7px 4px;text-align:right;overflow-wrap:anywhere}'+
   'th{background:#eaeefb}tr:nth-child(even){background:#f8f9fd}'+
   'thead{display:table-header-group}</style></head><body><h1>گزارش شرکت‌کنندگان رویداد</h1>'+
   '<section class="details">'+meta+'</section><table><thead><tr>'+
   rows[7].map(cell=>'<th>'+htmlEsc(cell)+'</th>').join('')+
   '</tr></thead><tbody>'+body+'</tbody></table></body></html>';
  if(html.length>1450000)return false;
  bridge.printHtmlNamed('Kanonha-Event-'+scope+'-'+String(e.id||'event').slice(0,36),html);
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
 function qrPng(token){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(token)))return '';
  if(!window.QRCode||!document?.createElement||!document.body?.appendChild)return '';
  const box=document.createElement('div');
  box.style.cssText='position:absolute;left:-99999px;top:-99999px;opacity:0';
  document.body.appendChild(box);
  try{
   new window.QRCode(box,{text:'KANONHA1:'+token,width:210,height:210,
     colorDark:'#242b65',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.M});
   const canvas=box.querySelector('canvas');
   if(canvas&&typeof canvas.toDataURL==='function')return canvas.toDataURL('image/png');
   const img=box.querySelector('img');
   if(img&&typeof img.src==='string'&&img.src.startsWith('data:image/png;base64,'))return img.src;
   return '';
  }catch(_){return ''}
  finally{box.remove();}
 }
 function certificateQrPng(certificateId){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(certificateId)))return '';
  if(typeof window.QRCode!=='function'||!document?.createElement||!document.body?.appendChild)return '';
  const box=document.createElement('div');
  box.style.cssText='position:absolute;left:-99999px;top:-99999px;opacity:0';
  document.body.appendChild(box);
  try{
    new window.QRCode(box,{text:'KANONHA-CERT:'+certificateId,width:210,height:210,
      colorDark:'#0b5145',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.M});
    const canvas=box.querySelector('canvas');
    if(canvas&&typeof canvas.toDataURL==='function')return canvas.toDataURL('image/png');
    const img=box.querySelector('img');
    return img&&typeof img.src==='string'&&img.src.startsWith('data:image/png;base64,')?img.src:'';
  }catch(_){return ''}
  finally{box.remove();}
 }
 window.KanonhaEventTools=Object.freeze({exportEventCsv,exportEventExcel,exportEventPdf,renderQr,qrPng,certificateQrPng});
})();
