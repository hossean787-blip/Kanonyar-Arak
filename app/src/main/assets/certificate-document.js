/* Kanonha: one print-ready certificate design for every event type. */
(() => {
'use strict';
const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const dateText=value=>{
 const d=new Date(value);
 return Number.isFinite(d.getTime())?(window.KanonhaJalali?.formatDate(d,true)||d.toLocaleDateString('fa-IR')):'تاریخ نامشخص';
};
const logo='<svg viewBox="0 0 108 108" xmlns="http://www.w3.org/2000/svg" aria-label="نشان رسمی اپ کانون‌ها" role="img">'+
'<circle cx="54" cy="54" r="40" fill="#fff" stroke="#c7ad75" stroke-width="2"/><circle cx="54" cy="54" r="34" fill="none" stroke="#d3dae8" stroke-width="2"/>'+
'<circle cx="54" cy="39" r="10" fill="#2c3e4c"/><circle cx="35" cy="52" r="7" fill="#3944bc"/><circle cx="73" cy="52" r="7" fill="#3944bc"/>'+
'<path fill="#2c3e4c" d="M36 74C36 61 43 55 54 55s18 6 18 19v3H36z"/>'+
'<path fill="#3944bc" d="M21 74c1-10 7-14 14-14l6 2c-4 4-6 9-6 15H21zm66 0c-1-10-7-14-14-14l-6 2c4 4 6 9 6 15h14z"/></svg>';
const css=[
'<style>',
'@page{size:A4 landscape;margin:0}',
'*{box-sizing:border-box}html,body{margin:0;padding:0;color:#184c44;background:#f9f7f0;direction:rtl;font-family:Tahoma,Arial,sans-serif}',
'body{-webkit-print-color-adjust:exact;print-color-adjust:exact}',
'.certificate{position:relative;isolation:isolate;min-height:210mm;padding:13mm 16mm 12mm;background:radial-gradient(ellipse at 48% 48%,#fffefa 0%,#fbf9f3 55%,#f2eee3 100%);border:7px solid #fff;outline:2px solid #b99658;outline-offset:-8px;overflow:hidden}',
'.certificate:before{content:"";position:absolute;inset:9mm;z-index:-1;border:1px solid #d1b97c;border-radius:10mm 1mm 10mm 1mm}',
'.certificate:after{content:"";position:absolute;z-index:-1;left:-38mm;top:-38mm;width:115mm;height:60mm;background:linear-gradient(135deg,#12483d,#286b56 67%,#c0a46b 68%,#f8f0dd 71%);transform:rotate(-30deg);border-radius:40%}',
'.curve{position:absolute;right:-45mm;bottom:-47mm;width:120mm;height:75mm;z-index:-1;background:linear-gradient(135deg,#c1a165,#236b57 18%,#0b5145 68%,#d9bb7a 72%);border-radius:50%;transform:rotate(-24deg)}',
'.heading{display:flex;align-items:flex-start;justify-content:space-between;gap:10mm;padding:0 6mm}',
'.brand{min-width:38mm;max-width:58mm;display:flex;flex-direction:column;align-items:center;text-align:center;gap:1mm}',
'.brand svg,.brand img{height:20mm;width:20mm;object-fit:contain}.brand strong{font-size:12pt;line-height:1.45;color:#19483f}.brand small{font-size:9pt;line-height:1.5;color:#456a61}',
'.organizer-placeholder{display:flex;align-items:center;justify-content:center;height:20mm;width:20mm;border-radius:50%;border:1.5px solid #88a69a;font-size:19pt;color:#23775e}',
'.heading-center{flex:1;text-align:center;min-width:0}.eyebrow{font-size:9pt;color:#5b6c5c;margin:0 0 1mm}',
'.title{font-size:28pt;line-height:1.55;letter-spacing:-1px;color:#07543f;margin:2mm 0 0;font-weight:800}',
'.english{font-size:9pt;letter-spacing:2px;color:#3b665c;direction:ltr;margin:0}.ornament{width:62mm;height:1px;background:linear-gradient(90deg,transparent,#c9a966,transparent);margin:5mm auto 0}',
'.content{text-align:center;margin:5mm auto 0;max-width:245mm;line-height:2}.intro{font-size:13pt;margin:0}',
'.recipient{font-size:25pt;line-height:1.7;color:#07533f;font-weight:800;margin:0}.national{font-size:11pt;color:#43655f;margin:0}',
'.story{font-size:12pt;line-height:2.1;color:#25463c;margin:5mm auto 0;max-width:220mm}.story strong{color:#057653;font-size:13pt;font-weight:800}',
'.detail{font-size:10pt;color:#45655a;margin:5mm 0 0}',
'.lower{display:flex;align-items:flex-end;gap:8mm;justify-content:space-between;margin-top:9mm}',
'.signatures{display:flex;align-items:flex-end;justify-content:center;gap:5mm;flex:1;flex-wrap:wrap}.signature{min-width:34mm;max-width:55mm;flex:1;text-align:center;page-break-inside:avoid}',
'.signature-line{height:12mm;border-bottom:1px solid #456a64;margin-bottom:2mm}.signature strong{display:block;font-size:9.5pt;color:#183f3a;min-height:5mm}.signature small{font-size:8pt;color:#657b75}',
'.verification{min-width:35mm;max-width:48mm;text-align:center;font-size:8pt;color:#31594f}.verification img{display:block;width:23mm;height:23mm;border:1px solid #c8ad75;background:white;border-radius:2mm;padding:2mm;margin:0 auto 1.5mm}',
'.code{display:block;font:8pt monospace;direction:ltr;overflow-wrap:anywhere;color:#1c4e45}.footer{position:absolute;bottom:7mm;left:0;right:0;text-align:center;font-size:9pt;color:#3f6859}',
'</style>'
].join('');
function render(c, options={}){
 const info=window.KanonhaEventKinds?.get(c.event_type)||{id:'general',certificateTitle:'گواهی مشارکت',context:'در رویداد'};
 // Attendance is not sufficient proof of course completion or winning a rank.
 const title=info.id==='course'?'گواهی شرکت در دوره':info.certificateTitle;
 const professors=Array.isArray(c.certificate_signers)?c.certificate_signers.filter(x=>typeof x==='string').slice(0,60):[];
 const signers=[{name:c.secretary_name||'',role:'دبیر کانون'},...professors.map(name=>({name,role:'استاد امضاکننده'}))];
 const signHtml=signers.map(s=>'<div class="signature"><div class="signature-line" aria-label="محل امضا"></div><strong>'+
  esc(s.name||'محل نام و امضا')+'</strong><small>'+esc(s.role)+'</small></div>').join('');
 const organizerLogo=typeof options.organizerLogo==='string'&&/^data:image\/(png|webp|jpeg);base64,[a-z0-9+/=]+$/i.test(options.organizerLogo)
  ?'<img src="'+options.organizerLogo+'" alt="لوگوی برگزارکننده">':
  '<div class="organizer-placeholder" aria-label="لوگوی کانون بارگذاری نشده">✦</div>';
 const qr=typeof options.qr==='string'&&/^data:image\/png;base64,[a-z0-9+/=]+$/i.test(options.qr)
  ?'<img src="'+options.qr+'" alt="QR شناسه گواهی">':'';
 const code=String(c.certificate_code||'');
 const verifyUrl=typeof options.verificationUrl==='string'&&
   /^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/kanonha-certificate-verify\?code=[0-9a-f-]{36}$/i.test(options.verificationUrl)
     ?options.verificationUrl:'';
 const privateNational=/^\d{10}$/.test(String(c.student_national_id||''))?
   String(c.student_national_id):'—';
 return '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>'+esc(title)+'</title>'+css+
 '</head><body><main class="certificate"><div class="curve" aria-hidden="true"></div><div class="heading">'+
 '<div class="brand">'+organizerLogo+'<strong>'+esc(c.club_name||'برگزارکننده')+'</strong><small>لوگوی برگزارکننده</small></div>'+
 '<div class="heading-center"><p class="eyebrow">گواهی رویدادهای دانشگاهی</p><h1 class="title">'+esc(title)+'</h1>'+
 '<p class="english">CERTIFICATE OF PARTICIPATION</p><div class="ornament"></div></div>'+
 '<div class="brand">'+logo+'<strong>کانون‌ها</strong><small>اپلیکیشن کانون‌های دانشجویی</small></div></div>'+
 '<section class="content"><p class="intro">بدین‌وسیله گواهی می‌شود که</p><p class="recipient">'+esc(c.student_name)+'</p>'+
 '<p class="national">کد ملی: '+esc(privateNational)+' · شماره دانشجویی: '+esc(c.student_number||'')+'</p>'+
 '<p class="story">'+esc(info.context||'در رویداد')+' <strong>«'+esc(c.event_title)+'»</strong> که به همت <strong>'+
 esc(c.club_name)+'</strong> برگزار گردید، مشارکت داشته است؛ این گواهی بر اساس ثبت حضور تأییدشده ایشان صادر شده است.</p>'+
 '<p class="detail">تاریخ برگزاری: '+esc(dateText(c.event_starts_at))+
 (c.event_location?' · محل برگزاری: '+esc(c.event_location):'')+'</p></section>'+
 '<section class="lower"><div class="verification">'+qr+'<span>اسکن جهت استعلام اصالت</span><span class="code">'+esc(code)+'</span>'+
 (verifyUrl?'<a style="font-size:8pt;color:#14694e" href="'+esc(verifyUrl)+'">بررسی آنلاین گواهی</a>':'')+'</div>'+
 '<div class="signatures">'+signHtml+'</div></section><div class="footer">با آرزوی موفقیت</div></main></body></html>';
}
window.KanonhaCertificateDocument=Object.freeze({render});
})();