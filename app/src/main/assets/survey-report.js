/* Survey report module: inspectable ranking, spreadsheet export and Android PDF printing. */
(() => {
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
  const nf=value=>Number(value||0).toLocaleString('fa-IR');
  function rank(survey,options,results){
    const map=new Map((results||[]).map(r=>[r.option_id,r]));
    const min=Math.max(1,Math.min(100,Number(survey.min_rank_votes)||5));
    const rows=(options||[]).map(o=>{
      const r=map.get(o.id);
      const count=Math.max(0,Number(r?.rating_count||0));
      const sum=Math.max(0,Number(r?.rating_sum||0));
      return {option_id:o.id,title:String(o.title||''),count,sum,
        average:count?sum/count:0,qualified:count>=min,rank:null};
    });
    rows.sort((a,b)=>Number(b.qualified)-Number(a.qualified)||
      b.average-a.average||b.count-a.count||a.title.localeCompare(b.title,'fa'));
    let last=null;
    for(let i=0;i<rows.length;i++){
      const r=rows[i];
      if(!r.qualified)continue;
      if(!last||r.sum*last.count!==last.sum*r.count||r.count!==last.count)
        r.rank=i+1;
      else r.rank=last.rank;
      last=r;
    }
    return rows;
  }
  function csvEscape(s){
    let t=String(s??'');
    // Prevent spreadsheet formula execution from imported CSV text fields.
    if(/^[\s\u200e\u200f]*[=+\-@]/.test(t))t="'"+t;
    return '"'+t.replace(/"/g,'""')+'"';
  }
  function buildCsv(survey,options,results,participation){
    const rows=rank(survey,options,results);
    const headers=['نظرسنجی','نوع','دسته','مهلت پایان','شرکت‌کنندگان','دانشجویان واجد شرایط',
      'گزینه','امتیاز میانگین','تعداد رأی','رتبه','آیا حداقل رأی را دارد'];
    const lines=[headers.map(csvEscape).join(',')];
    const count=Number(participation?.voters||0),eligible=Number(participation?.eligible_students||0);
    for(const r of rows){
      lines.push([
        survey.title,survey.kind==='competition'?'مسابقه‌ای':'معمولی',survey.category,
        survey.kind==='competition'?survey.ends_at:'بدون محدودیت زمانی',count,eligible,r.title,
        r.count?r.average.toFixed(3):'',r.count,r.rank??'',
        r.qualified?'بله':'خیر'
      ].map(csvEscape).join(','));
    }
    return '\uFEFF'+lines.join('\r\n')+'\r\n';
  }
  function buildHtml(survey,options,results,participation){
    const rows=rank(survey,options,results);
    const count=Number(participation?.voters||0),eligible=Number(participation?.eligible_students||0);
    const ratio=eligible>0?((count/eligible)*100).toFixed(1)+'%':'—';
    const min=Math.max(1,Math.min(100,Number(survey.min_rank_votes)||5));
    const date=v=>{
      try{return new Intl.DateTimeFormat('fa-IR-u-ca-persian',
        {dateStyle:'long',timeStyle:'short',timeZone:'Asia/Tehran'}).format(new Date(v));}
      catch(_){return String(v);}
    };
    const body=rows.map(r=>'<tr><td>'+esc(r.title)+'</td>'+
      '<td>'+nf(r.count)+'</td><td>'+(r.count?r.average.toLocaleString('fa-IR',
        {minimumFractionDigits:2,maximumFractionDigits:2}):'—')+'</td>'+
      '<td>'+(r.qualified?nf(r.rank):'فاقد حداقل رأی')+'</td></tr>').join('');
    return '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">'+
      '<meta name="viewport" content="width=device-width,initial-scale=1">'+
      '<title>گزارش نظرسنجی کانون‌ها</title>'+
      '<style>@page{size:A4;margin:16mm}*{box-sizing:border-box}body{margin:0;background:#fff;'+
      'font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#242F68;font-size:12px}'+
      'header{padding:18px;border-radius:15px;background:#EEF0FA;border:1px solid #D6DCFA}'+
      'h1{font-size:22px;margin:0 0 12px}h2{font-size:15px;color:#424D94}'+
      '.small{font-size:11px;color:#69749E}.stats{display:flex;justify-content:space-between;'+
      'gap:8px;margin:20px 0}.stats>div{width:33%;border:1px solid #E0E4F3;border-radius:12px;'+
      'padding:13px;text-align:center}.stats strong{display:block;font-size:21px;color:#36449B}'+
      'table{width:100%;border-collapse:collapse;margin-top:16px}'+
      'th,td{text-align:right;padding:11px;border-bottom:1px solid #E2E5F1}'+
      'th{background:#F0F2FB;font-weight:bold}tr{page-break-inside:avoid}'+
      'footer{margin-top:30px;color:#8590A8;font-size:10px;border-top:1px solid #ddd;padding-top:12px}'+
      '</style></head><body><header><h1>'+esc(survey.title)+'</h1>'+
      '<div class="small">گزارش رسمی آماری پنل مدیرکل اپ کانون‌ها</div>'+
      '<p>'+esc(survey.description||'')+'</p>'+
      '<div>نوع: '+esc(survey.kind==='competition'?'مسابقه‌ای':'معمولی')+
      ' | پایان: '+esc(survey.kind==='competition'?date(survey.ends_at):'بدون محدودیت زمانی')+'</div></header>'+
      '<section class="stats"><div><strong>'+nf(count)+'</strong>شرکت‌کننده</div>'+
      '<div><strong>'+nf(eligible)+'</strong>واجد شرایط</div>'+
      '<div><strong>'+ratio+'</strong>نرخ مشارکت</div></section>'+
      '<h2>رتبه‌بندی براساس میانگین ستاره‌ها</h2>'+
      '<p class="small">حداقل رأی برای رتبه معتبر: '+nf(min)+
      ' | امتیازهای مساوی با تعداد رأی مساوی، رتبه مشترک دارند.</p>'+
      '<table><thead><tr><th>گزینه</th><th>آرا</th><th>میانگین از ۵</th><th>رتبه</th></tr></thead>'+
      '<tbody>'+body+'</tbody></table>'+
      '<footer>گزارش آماری؛ اطلاعات هویتی و رأی انفرادی دانشجویان در آن درج نشده است.</footer>'+
      '</body></html>';
  }
  function base64Utf8(str){
    const bytes=new TextEncoder().encode(str);
    let binary='';
    for(let i=0;i<bytes.length;i+=8192)
      binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return btoa(binary);
  }
  function saveCsv(filename,content){
    if(typeof window.AndroidSurveyExports?.saveCsv==='function'){
      window.AndroidSurveyExports.saveCsv(filename,base64Utf8(content));
      return true;
    }
    if(typeof Blob==='undefined'||typeof URL?.createObjectURL!=='function')return false;
    const blob=new Blob([content],{type:'text/csv;charset=utf-8'});
    const uri=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=uri;a.download=filename;document.body.appendChild(a);
    a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(uri),2000);
    return true;
  }
  function printPdf(html){
    if(typeof window.AndroidSurveyExports?.printHtml==='function'){
      window.AndroidSurveyExports.printHtml(html);return true;
    }
    return false; // Browser/preview cannot pretend a PDF was created.
  }
  window.KanonhaSurveyReports=Object.freeze({rank,buildCsv,buildHtml,saveCsv,printPdf});
})();