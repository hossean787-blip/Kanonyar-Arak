/* Activities screen — only displays data from the current authenticated account.
   Server records and RLS remain authoritative. Never cache identity-bound entries locally. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g,
    ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const digits = n => Number(n || 0).toLocaleString('fa-IR');
  let memberFilter = 'all';
  let eventFilter = 'all';
  let snapshot = null;
  const members = [
    ['all','همه'],['approved','عضو'],['pending','در انتظار'],['rejected','ردشده']
  ];
  const eventFilters = [['all','همه'],['upcoming','پیش‌رو'],['past','گذشته']];
  const empty = (text,target,label) =>
    '<div class="activity-empty"><span aria-hidden="true">✦</span><p>'+esc(text)+'</p>'+
    (target ? '<button type="button" data-goto="'+target+'">'+label+'</button>':'')+'</div>';
  function rowStatus(status){
    return status === 'approved' ? 'عضویت تأییدشده' :
      status === 'pending' ? 'منتظر تأیید دبیر' : 'ردشده؛ درخواست مجدد ممکن است';
  }
  function filters(id,options,current,kind,count) {
    const node=$(id); if(!node)return;
    node.innerHTML=options.map(([key,label]) =>
      '<button type="button" class="'+(key===current?'active':'')+'" data-activity-filter-'+kind+'="'+key+
      '" aria-pressed="'+(key===current)+'">'+label+
      '<small>'+digits(count[key]||0)+'</small></button>').join('');
  }
  function render({clubs,events,state,onlineMode,eventTickets}) {
    snapshot={clubs,events,state,onlineMode,eventTickets};
    const unique = nums => [...new Set(nums)].filter(i=>Number.isInteger(i)&&i>=0);
    const membership = [
      ...unique(state.joined).map(i=>({i,status:'approved'})),
      ...unique(state.requested).map(i=>({i,status:'pending'})),
      ...unique(state.rejected).map(i=>({i,status:'rejected'}))
    ].filter(m=>clubs[m.i]);
    const allEvents=unique(state.registered).filter(i=>events[i]).map(i=>{
      const ev=events[i];
      const past=Number.isFinite(ev.startsAtMs)&&ev.startsAtMs<=Date.now();
      return {i,ev,past,attended:Array.isArray(state.attended)&&state.attended.includes(i)};
    }).sort((a,b)=>(a.past===b.past?((a.ev.startsAtMs||0)-(b.ev.startsAtMs||0)):a.past?1:-1));
    const counts={
      all:membership.length,
      approved:membership.filter(m=>m.status==='approved').length,
      pending:membership.filter(m=>m.status==='pending').length,
      rejected:membership.filter(m=>m.status==='rejected').length
    };
    const evCounts={
      all:allEvents.length,
      upcoming:allEvents.filter(e=>!e.past).length,
      past:allEvents.filter(e=>e.past).length
    };
    const overview=$('activity-overview');
    if(overview)overview.innerHTML=[
      ['کانون‌های عضو',counts.approved,'users'],['درخواست‌های در انتظار',counts.pending,'clock'],
      ['رویدادهای من',evCounts.all,'calendar'],['حضور ثبت‌شده',allEvents.filter(e=>e.attended).length,'check']
    ].map(([label,value,icon])=>'<div class="activity-stat"><span class="activity-stat-icon '+icon+
      '" aria-hidden="true"></span><strong>'+digits(value)+'</strong><small>'+label+'</small></div>').join('');
    const sub=$('activity-summary');
    if(sub)sub.textContent=onlineMode
      ? 'وضعیت عضویت‌ها، برنامه‌ها و بلیت‌های حساب شما'
      : 'پیش‌نمایش آفلاین؛ هیچ عضویت یا بلیت واقعی صادر نمی‌شود.';
    const refresh=$('activity-refresh');
    if(refresh)refresh.hidden=!onlineMode;
    filters('activity-member-filters',members,memberFilter,'club',counts);
    filters('activity-event-filters',eventFilters,eventFilter,'event',evCounts);
    const visibleMembers=membership.filter(m=>memberFilter==='all'||m.status===memberFilter);
    $('activity-clubs').innerHTML=visibleMembers.length?visibleMembers.map(({i,status})=>{
      const club=clubs[i];
      const icon=club.icon==='leaf'?'🌿':club.icon==='code'?'💻':club.icon==='flask'?'🔬':'🎓';
      const action=status==='rejected'?'درخواست مجدد':status==='pending'?'لغو درخواست':'مشاهده کانون';
      const actionAttr=status==='rejected'?'data-reapply="'+i+'"':
        status==='pending'?'data-cancel-membership="'+i+'"':'data-club-details="'+i+'"';
      return '<article class="activity-member-card"><div class="activity-member-top">'+
        '<span class="activity-member-avatar" aria-hidden="true">'+icon+'</span>'+
        '<div class="activity-member-name"><h3>'+esc(club.title)+'</h3><small>'+
        esc(club.university||club.category||'کانون دانشجویی')+'</small></div>'+
        '<span class="activity-status '+status+'">'+rowStatus(status)+'</span></div>'+
        '<div class="activity-member-actions"><button type="button" data-club-details="'+i+'">جزئیات</button>'+
        '<button type="button" class="activity-member-action" '+actionAttr+'>'+action+'</button></div></article>';
    }).join(''):empty(memberFilter==='all'?'هنوز درخواستی برای عضویت در کانون‌ها ثبت نکرده‌اید.':
      'در این وضعیت عضویتی ندارید.','clubs','مشاهده کانون‌ها');
    const visibleEvents=allEvents.filter(item=>eventFilter==='all'||
      (eventFilter==='past'?item.past:!item.past));
    $('activity-events').innerHTML=visibleEvents.length?visibleEvents.map(item=>{
      const {i,ev,past,attended}=item;
      const stateLabel=attended?'حضور ثبت شده':past?'برگزار شده':'ثبت‌نام قطعی';
      return '<article class="activity-event-card">'+
        '<span class="activity-event-mark" aria-hidden="true">🗓</span>'+
        '<div class="activity-event-content"><h3>'+esc(ev.title)+'</h3>'+
        '<p>'+esc(ev.date)+' · '+esc(ev.location)+'</p>'+
        '<span class="activity-event-state '+(attended?'attended':past?'past':'upcoming')+
        '">'+stateLabel+'</span></div>'+
        '<button type="button" data-details="'+i+'" aria-label="جزئیات '+esc(ev.title)+'">جزئیات</button></article>';
    }).join(''):empty(eventFilter==='all'?'هنوز رویدادی ثبت‌نام نکرده‌اید.':
      'رویدادی در این دسته وجود ندارد.','events','مشاهده رویدادها');
    $('activity-tickets').innerHTML=allEvents.length?allEvents.map(({i,ev,past,attended})=>{
      const token=eventTickets&&eventTickets.get(ev.id);
      const validToken=typeof token==='string'&&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
      const available=onlineMode&&!past&&!attended&&validToken;
      const badge= !onlineMode?'صرفاً نمایشی':attended?'استفاده شده':
        past?'رویداد پایان یافته':available?'آماده ورود':'در انتظار بارگذاری کد';
      const cancel=onlineMode&&!past&&!attended;
      return '<article class="activity-ticket"><div class="activity-ticket-header">'+
        '<span>بلیت رویداد</span><span class="'+(available?'valid':'muted')+'">'+badge+'</span></div>'+
        '<div class="activity-ticket-content"><div class="activity-ticket-copy">'+
        '<h3>'+esc(ev.title)+'</h3><p>📅 '+esc(ev.date)+'</p>'+
        '<p>📍 '+esc(ev.location)+'</p>'+
        (cancel?'<button type="button" class="activity-ticket-cancel" data-event-cancel="'+i+
        '">لغو ثبت‌نام</button>':'')+'</div>'+
        (available?'<div class="kanonha-ticket-qr" data-ticket-qr="'+i+
        '" role="img" aria-label="کد ورود اختصاصی این رویداد"></div>':
        '<div class="activity-ticket-placeholder" role="note">'+
        (!onlineMode?'این بلیت آزمایشی است':past?'این رویداد به پایان رسیده است':
          attended?'حضور شما ثبت شده است':'کد بلیت هنوز قابل دریافت نیست')+'</div>')+
        '</div></article>';
    }).join(''):empty('هنوز بلیتی برای نمایش وجود ندارد.','events','رویدادها');
    if(onlineMode&&$('activity-tickets').querySelectorAll) {
      for(const el of $('activity-tickets').querySelectorAll('[data-ticket-qr]')){
        const i=Number(el.dataset.ticketQr);
        if(!events[i]||!window.KanonhaEventTools?.renderQr(el,eventTickets.get(events[i].id))){
          el.textContent='نمایش کد ممکن نشد؛ صفحه را به‌روزرسانی کنید.';
        }
      }
    }
  }
  function setFilter(kind,value) {
    if(kind==='club'&&members.some(([k])=>k===value)) memberFilter=value;
    else if(kind==='event'&&eventFilters.some(([k])=>k===value))eventFilter=value;
    else return;
    if(snapshot)render(snapshot);
  }
  window.KanonhaActivity=Object.freeze({render,setFilter});
})();
