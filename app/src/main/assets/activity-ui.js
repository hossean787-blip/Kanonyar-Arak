/* Private student activity: four independently rendered sections.
 * Memberships, registrations and certificates come only from server-authorized data.
 * Tickets expire exactly seven days after event start; registrations and certificates do not.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g,
    ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const digits = n => Number(n || 0).toLocaleString('fa-IR');
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const tokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let memberFilter = 'all';
  let eventFilter = 'all';
  let snapshot = null;
  let expireTimer = null;
  const memberFilters=[['all','همه'],['approved','عضو'],['pending','در انتظار'],['rejected','ردشده']];
  const eventFilters=[['all','همه'],['upcoming','پیش‌رو'],['past','گذشته']];
  const empty=(message,target,label)=>'<div class="activity-empty" role="status"><span aria-hidden="true">✦</span><p>'+
    esc(message)+'</p>'+(target?'<button type="button" data-goto="'+target+'">'+label+'</button>':'')+'</div>';
  const dateText = iso => {
    const d=new Date(iso);
    return Number.isFinite(d.getTime())
      ? (window.KanonhaJalali ? window.KanonhaJalali.formatDate(d,true) : d.toLocaleString('fa-IR'))
      : 'تاریخ نامشخص';
  };
  function members(data){
    if(data.onlineMode) return (data.memberDetails||[]).map(m=>({
      id:String(m.club_id||''),title:String(m.club_name||'کانون'),category:String(m.category||'کانون'),
      university:String(m.university||''),status:m.status,active:m.is_active!==false,
      index:data.clubs.findIndex(c=>c.id===m.club_id)
    })).filter(m=>['approved','pending','rejected'].includes(m.status));
    const unique=items=>[...new Set(items||[])].filter(Number.isInteger);
    const rows=[
      ...unique(data.state.joined).map(index=>({index,status:'approved'})),
      ...unique(data.state.requested).map(index=>({index,status:'pending'})),
      ...unique(data.state.rejected).map(index=>({index,status:'rejected'}))
    ];
    return rows.filter(x=>data.clubs[x.index]).map(x=>({
      ...x,title:data.clubs[x.index].title,category:data.clubs[x.index].category,
      university:data.clubs[x.index].university,active:true,id:String(x.index)
    }));
  }
  function events(data){
    if(data.onlineMode) return (data.historyRows||[]).filter(r=>r.status==='confirmed').map(r=>({
      registrationId:String(r.registration_id),
      eventId:String(r.event_id),title:String(r.event_title||''),location:String(r.event_location||''),
      clubName:String(r.club_name||''),startsAtMs:Date.parse(r.event_starts_at),
      expiresAtMs:Date.parse(r.ticket_expires_at),date:dateText(r.event_starts_at),
      attended:Boolean(r.attended_at),ticketToken:r.ticket_token||'',
      index:data.events.findIndex(e=>e.id===r.event_id)
    }));
    return [...new Set(data.state.registered||[])].filter(i=>data.events[i]).map(i=>{
      const e=data.events[i];const startsAtMs=Number(e.startsAtMs);
      return {registrationId:'offline-'+i,eventId:'offline-'+i,title:e.title,
        location:e.location,clubName:'',startsAtMs,expiresAtMs:startsAtMs+SEVEN_DAYS,
        date:e.date,attended:(data.state.attended||[]).includes(i),ticketToken:'',index:i};
    });
  }
  function canShowTicket(event,now){
    return Number.isFinite(event.startsAtMs)&&Number.isFinite(event.expiresAtMs)&&
      now < event.expiresAtMs;
  }
  function hasToken(event){
    return typeof event.ticketToken==='string'&&tokenPattern.test(event.ticketToken);
  }
  function tabs(id,options,active,kind,counts){
    const node=$(id);if(!node)return;
    node.innerHTML=options.map(x=>'<button type="button" data-activity-filter-'+kind+'="'+x[0]+
      '" aria-pressed="'+(active===x[0])+'" class="'+(active===x[0]?'active':'')+'">'+
      x[1]+' <small>'+digits(counts[x[0]]||0)+'</small></button>').join('');
  }
  function scheduleExpiry(rows){
    if(expireTimer!==null){clearTimeout(expireTimer);expireTimer=null;}
    const now=Date.now();
    const next=rows.map(e=>e.expiresAtMs).filter(t=>Number.isFinite(t)&&t>now)
      .sort((a,b)=>a-b)[0];
    if(next)expireTimer=setTimeout(()=>{
      expireTimer=null;if(snapshot)render(snapshot);
    },Math.max(100,Math.min(next-now+80,24*60*60*1000)));
  }
  function render(data){
    snapshot=data;
    if(!$('activity-clubs')||!$('activity-tickets')||!$('activity-certificates'))return;
    const now=Date.now();
    const memberRows=members(data);
    const allEvents=events(data).sort((a,b)=>(b.startsAtMs||0)-(a.startsAtMs||0));
    const certs=data.onlineMode?(data.certificates||[]):[];
    const validTickets=allEvents.filter(e=>canShowTicket(e,now));
    scheduleExpiry(validTickets);
    const counts={
      all:memberRows.length,
      approved:memberRows.filter(x=>x.status==='approved').length,
      pending:memberRows.filter(x=>x.status==='pending').length,
      rejected:memberRows.filter(x=>x.status==='rejected').length
    };
    const evCounts={
      all:allEvents.length,upcoming:allEvents.filter(x=>x.startsAtMs>now).length,
      past:allEvents.filter(x=>x.startsAtMs<=now).length
    };
    const overview=$('activity-overview');
    if(overview)overview.innerHTML=[
      ['عضویت‌های فعال',counts.approved],['رویدادهای من',allEvents.length],
      ['بلیت‌های موجود',validTickets.length],['گواهینامه‌ها',certs.length]
    ].map(x=>'<div class="activity-stat"><span class="activity-stat-icon"></span><strong>'+
      digits(x[1])+'</strong><small>'+x[0]+'</small></div>').join('');
    const summary=$('activity-summary');
    if(summary)summary.textContent=data.onlineMode?
      'سوابق عضویت، رویدادها، بلیت‌ها و گواهینامه‌های شما':
      'پیش‌نمایش آفلاین؛ بلیت و گواهینامه واقعی صادر نمی‌شود.';
    const refresh=$('activity-refresh');if(refresh)refresh.hidden=!data.onlineMode;
    tabs('activity-member-filters',memberFilters,memberFilter,'club',counts);
    tabs('activity-event-filters',eventFilters,eventFilter,'event',evCounts);
    const shownMembers=memberRows.filter(r=>memberFilter==='all'||r.status===memberFilter);
    $('activity-clubs').innerHTML=shownMembers.length?shownMembers.map(m=>{
      const stateText=m.status==='approved'?'عضویت تأییدشده':m.status==='pending'?
        'در انتظار تأیید دبیر':'درخواست رد شده';
      const action=m.status==='approved'?'لغو عضویت':m.status==='pending'?'لغو درخواست':
        'درخواست مجدد عضویت';
      const actionKey=m.status==='rejected'?'data-activity-reapply-club':
        'data-activity-cancel-club';
      return '<article class="activity-member-card"><div class="activity-member-top">'+
        '<span class="activity-member-avatar" aria-hidden="true">♧</span><div class="activity-member-name">'+
        '<h3>'+esc(m.title)+'</h3><small>'+esc(m.university||m.category||'کانون')+'</small></div>'+
        '<span class="activity-status '+m.status+'">'+stateText+'</span></div>'+
        (m.active?'<div class="activity-member-actions">'+
          (m.index>=0?'<button type="button" data-club-details="'+m.index+'">مشاهده کانون</button>':'<span></span>')+
          '<button type="button" class="activity-member-action" '+actionKey+'="'+esc(m.id)+'">'+
          action+'</button></div>':
          '<p class="activity-archived">این کانون در حال حاضر غیرفعال است. سوابق شما محفوظ می‌ماند.</p>'+
          (m.status==='approved'||m.status==='pending'?
          '<button type="button" class="activity-member-action" data-activity-cancel-club="'+esc(m.id)+'">لغو عضویت / درخواست</button>':''))+
        '</article>';
    }).join(''):empty(memberFilter==='all'?'هنوز عضویت یا درخواستی ندارید.':
      'در این وضعیت، کانونی وجود ندارد.','clubs','مشاهده کانون‌ها');
    const shownEvents=allEvents.filter(x=>eventFilter==='all'||
      (eventFilter==='past'?x.startsAtMs<=now:x.startsAtMs>now));
    $('activity-events').innerHTML=shownEvents.length?shownEvents.map(e=>{
      const stateText=e.attended?'حضور ثبت‌شده':e.startsAtMs<=now?'برگزارشده':'ثبت‌نام قطعی';
      return '<article class="activity-event-card"><span class="activity-event-mark" aria-hidden="true">▣</span>'+
        '<div class="activity-event-content"><h3>'+esc(e.title)+'</h3><p>'+esc(e.date)+' · '+
        esc(e.location)+'</p><small>'+esc(e.clubName)+'</small><div class="activity-event-state '+(e.attended?'attended':e.startsAtMs<=now?'past':'upcoming')+
        '">'+stateText+'</div></div>'+
        (e.index>=0?'<button type="button" data-details="'+e.index+'">جزئیات</button>':'')+
        '</article>';
    }).join(''):empty(eventFilter==='all'?'هنوز در رویدادی ثبت‌نام نکرده‌اید.':
      'در این دسته رویدادی وجود ندارد.','events','مشاهده رویدادها');
    $('activity-tickets').innerHTML=validTickets.length?validTickets.map((e,i)=>{
      const available=data.onlineMode&&hasToken(e);
      const stateText=!data.onlineMode?'نمایشی':e.attended?'استفاده‌شده':e.startsAtMs>now?
        'آماده ورود':'رویداد برگزارشده';
      return '<article class="activity-ticket"><div class="activity-ticket-header"><span>بلیت رویداد</span>'+
        '<span class="'+(available?'valid':'muted')+'">'+stateText+'</span></div>'+
        '<div class="activity-ticket-content"><div class="activity-ticket-copy"><h3>'+esc(e.title)+'</h3>'+
        '<p>◷ '+esc(e.date)+'</p><p>⌖ '+esc(e.location)+'</p>'+
        '<small class="activity-ticket-expiry">این بلیت ۷ روز پس از برگزاری رویداد از فهرست حذف می‌شود.</small>'+
        (available?'<button type="button" data-activity-download-ticket="'+esc(e.registrationId)+
          '" class="activity-pdf-button">دریافت PDF بلیت</button>':'')+
        '</div>'+(available?'<div class="kanonha-ticket-qr" data-ticket-qr="'+i+
          '" role="img" aria-label="کد بلیت ثبت‌نام"></div>':
          '<div class="activity-ticket-placeholder">'+(data.onlineMode?
          'کد ورود در دسترس نیست':'نمونه فاقد اعتبار')+'</div>')+'</div></article>';
    }).join(''):empty('بلیت فعالی وجود ندارد؛ بلیت‌ها ۷ روز پس از رویداد خودکار از این بخش کنار می‌روند.',
      'events','رویدادها');
    if(data.onlineMode&&$('activity-tickets').querySelectorAll){
      for(const node of $('activity-tickets').querySelectorAll('[data-ticket-qr]')){
        const row=validTickets[Number(node.dataset.ticketQr)];
        if(!row||!window.KanonhaEventTools?.renderQr(node,row.ticketToken))
          node.textContent='نمایش QR ممکن نشد؛ دوباره وارد شوید.';
      }
    }
    $('activity-certificates').innerHTML=certs.length?certs.map(c=>{
      return '<article class="activity-certificate"><div class="activity-certificate-symbol" aria-hidden="true">✦</div>'+
        '<div class="activity-certificate-body"><span>'+esc(window.KanonhaEventKinds?.get(c.event_type)?.certificateTitle||'گواهی مشارکت')+'</span>'+
        '<h3>'+esc(c.event_title)+'</h3><p>'+esc(c.club_name)+' · '+esc(dateText(c.issued_at))+'</p>'+
        '<small>کد گواهینامه: <b dir="ltr">'+esc(c.certificate_code)+'</b></small>'+
        '<button class="activity-pdf-button" type="button" data-activity-download-certificate="'+
        esc(c.id)+'">دریافت PDF گواهینامه</button></div></article>';
    }).join(''):empty('هنوز گواهینامه‌ای برای حساب شما صادر نشده است. گواهینامه‌های صادرشده همیشه در این بخش باقی می‌مانند.');
  }
  function setFilter(kind,value){
    if(kind==='club'&&memberFilters.some(x=>x[0]===value))memberFilter=value;
    else if(kind==='event'&&eventFilters.some(x=>x[0]===value))eventFilter=value;
    else return;
    if(snapshot)render(snapshot);
  }
  const printStyle = '<style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{direction:rtl;text-align:right;margin:0;font-family:Tahoma,Arial,sans-serif;color:#27346c;background:white}'+
    '.paper{border:3px solid #505cc8;border-radius:18px;padding:30px;min-height:650px}header{background:#3946a0;color:white;padding:16px 20px;border-radius:12px;font-size:20px;font-weight:bold}'+
    '.kicker{color:#6875ba;font-size:12px;margin:22px 0 7px}h1{font-size:25px;color:#283378;line-height:1.6}p{line-height:2;font-size:15px}'+
    '.qr{text-align:center;margin-top:24px}.qr img{width:180px;height:180px}.code{direction:ltr;unicode-bidi:embed;font:13px monospace;word-break:break-all;letter-spacing:.7px}'+
    '.seal{font-size:19px;text-align:center;margin:25px 0;color:#505cc8}.fine{border-top:1px solid #d9dcf1;margin-top:22px;padding-top:12px;color:#697391;font-size:11px}'+
    '</style>';
  function docHtml(body){
    return '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>کانون‌ها</title>'+
      printStyle+'</head><body><main class="paper"><header>کانون‌ها · فعالیت‌های دانشجویی</header>'+
      body+'</main></body></html>';
  }
  function printPdf(html,title){
    const bridge=window.AndroidSurveyExports;
    if(!bridge)return false;
    if(typeof bridge.printHtmlNamed==='function')bridge.printHtmlNamed(title,html);
    else if(typeof bridge.printHtml==='function')bridge.printHtml(html);
    else return false;
    return true;
  }
  function downloadTicket(registrationId){
    if(!snapshot||!snapshot.onlineMode)return false;
    const e=events(snapshot).find(x=>x.registrationId===registrationId);
    if(!e||!canShowTicket(e,Date.now())||!hasToken(e))return false;
    const qr=window.KanonhaEventTools?.qrPng?.(e.ticketToken);
    if(typeof qr!=='string'||!qr.startsWith('data:image/png;base64,'))return false;
    const name=esc(snapshot.studentName||'دانشجوی ثبت‌نام‌کننده');
    const html=docHtml('<div class="kicker">بلیت اختصاصی رویداد</div><h1>'+esc(e.title)+'</h1>'+
      '<p><strong>نام دانشجو:</strong> '+name+'</p>'+
      '<p><strong>برگزارکننده:</strong> '+esc(e.clubName)+'</p>'+
      '<p><strong>تاریخ:</strong> '+esc(e.date)+'</p><p><strong>مکان:</strong> '+esc(e.location)+'</p>'+
      '<div class="qr"><img src="'+qr+'" alt="QR بلیت"><p class="code">KANONHA1:'+esc(e.ticketToken)+'</p></div>'+
      '<div class="fine">این بلیت بر اساس ثبت‌نام تأییدشده صادر شده و ۷ روز پس از برگزاری رویداد از اپ حذف می‌شود.</div>');
    return printPdf(html,'Kanonha-Ticket-'+registrationId);
  }
  async function organizerLogoData(c){
    const url=window.KanonhaBackend?.clubLogoUrl?.(c.club_id,c.club_logo_path);
    if(!url||typeof fetch!=='function'||typeof FileReader!=='function')return '';
    try{
      const response=await fetch(url,{mode:'cors',credentials:'omit'});
      if(!response.ok)return '';
      const blob=await response.blob();
      if(!['image/png','image/webp','image/jpeg'].includes(blob.type)||blob.size>2097152)return '';
      return await new Promise(resolve=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(typeof reader.result==='string'?reader.result:'');
        reader.onerror=()=>resolve('');
        reader.readAsDataURL(blob);
      });
    }catch(_error){return '';}
  }
  function downloadCertificate(id){
    if(!snapshot||!snapshot.onlineMode)return false;
    const c=(snapshot.certificates||[]).find(x=>x.id===id);
    const renderer=window.KanonhaCertificateDocument?.render;
    if(!c||typeof renderer!=='function')return false;
    const qr=window.KanonhaEventTools?.certificateQrPng?.(String(c.certificate_code||''))||'';
    const print=organizerLogo=>printPdf(renderer(c,{qr,organizerLogo}),'Kanonha-Certificate-'+id);
    // The logo is loaded into a data URI: Android's secure print WebView blocks network access.
    if(!c.club_id||!c.club_logo_path)return print('');
    return organizerLogoData(c).then(print);
  }
  function clear(){
    snapshot=null;memberFilter='all';eventFilter='all';
    if(expireTimer!==null){clearTimeout(expireTimer);expireTimer=null;}
  }
  if(document.addEventListener) document.addEventListener('visibilitychange',()=>{
    if(!document.hidden&&snapshot)render(snapshot);
  });
  window.KanonhaActivity=Object.freeze({render,setFilter,downloadTicket,downloadCertificate,clear});
})();
