/* Jalali-only date controls for all student and management forms.
 * Display: Solar Hijri (Persian); wire format: ISO Gregorian for database APIs.
 * No third-party assets or network calls; ICU conversion is consistent with WebView.
 */
(() => {
  'use strict';
  const numeral = n => Number(n).toLocaleString('fa-IR',{useGrouping:false});
  const months = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور',
    'مهر','آبان','آذر','دی','بهمن','اسفند'];
  const conversion = new Intl.DateTimeFormat('en-US-u-ca-persian',{
    year:'numeric',month:'numeric',day:'numeric',timeZone:'UTC',numberingSystem:'latn'
  });
  const display = new Intl.DateTimeFormat('fa-IR-u-ca-persian',{
    year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Tehran'
  });
  function g2j(date) {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return null;
    const pieces = Object.fromEntries(conversion.formatToParts(date)
      .filter(x => ['year','month','day'].includes(x.type)).map(x => [x.type,Number(x.value)]));
    return {year:pieces.year,month:pieces.month,day:pieces.day};
  }
  function j2g(year,month,day) {
    if (![year,month,day].every(Number.isInteger) || year<1200 || year>1600 ||
      month<1 || month>12 || day<1 || day>31) return null;
    let lo = Math.floor(Date.UTC(year+620,0,1)/86400000);
    let hi = Math.floor(Date.UTC(year+624,0,1)/86400000);
    const wanted = year*10000+month*100+day;
    while(lo<hi) {
      const mid=Math.floor((lo+hi)/2);
      const parts=g2j(new Date(mid*86400000));
      const actual=parts.year*10000+parts.month*100+parts.day;
      if(actual<wanted)lo=mid+1;else hi=mid;
    }
    const when=new Date(lo*86400000),p=g2j(when);
    return p && p.year===year && p.month===month && p.day===day
      ? when.toISOString().slice(0,10) : null;
  }
  const currentYear = g2j(new Date()).year;
  const digits = n => String(n).padStart(2,'0');
  function option(select,value,label) {
    const o=document.createElement('option');
    o.value=String(value);o.textContent=label;select.appendChild(o);
  }
  function makeSelect(aria,placeholder) {
    const s=document.createElement('select');
    s.className='jalali-select';s.setAttribute('aria-label',aria);
    option(s,'',placeholder);return s;
  }
  function enhance(root=document) {
    if(!root || typeof root.querySelectorAll!=='function' || typeof document.createElement!=='function')return;
    const inputs=root.querySelectorAll('input[type="date"], input[type="datetime-local"]');
    for(const input of inputs) {
      if(input.dataset.jalaliReady==='true')continue;
      const dateTime=input.type==='datetime-local';
      const original=input.value||'';
      const originalDate=/^\d{4}-\d{2}-\d{2}/.test(original)
        ? new Date(original.slice(0,10)+'T00:00:00Z'):null;
      const initial=originalDate?g2j(originalDate):null;
      input.type='hidden';
      input.dataset.jalaliReady='true';
      input.dataset.jalaliSource='true';
      input.value='';
      const wrapper=document.createElement('div');wrapper.className='jalali-control';
      wrapper.setAttribute('role','group');
      wrapper.setAttribute('aria-label',dateTime?'تاریخ و ساعت شمسی':'تاریخ شمسی');
      const row=document.createElement('div');row.className='jalali-date-row';
      const y=makeSelect('سال شمسی','سال');
      const m=makeSelect('ماه شمسی','ماه');
      const d=makeSelect('روز شمسی','روز');
      const minYear=dateTime?currentYear-2:1300;
      const maxYear=dateTime?currentYear+12:currentYear;
      for(let n=maxYear;n>=minYear;n--)option(y,n,numeral(n));
      months.forEach((x,i)=>option(m,i+1,x));
      row.appendChild(y);row.appendChild(m);row.appendChild(d);
      wrapper.appendChild(row);
      let hours=null,minutes=null;
      if(dateTime){
        const clock=document.createElement('div');clock.className='jalali-time-row';
        const caption=document.createElement('span');caption.textContent='ساعت';
        hours=makeSelect('ساعت','ساعت');minutes=makeSelect('دقیقه','دقیقه');
        for(let n=0;n<24;n++)option(hours,n,numeral(n).padStart(2,'۰'));
        for(let n=0;n<60;n++)option(minutes,n,numeral(n).padStart(2,'۰'));
        clock.appendChild(caption);clock.appendChild(hours);clock.appendChild(minutes);
        wrapper.appendChild(clock);
      }
      const hint=document.createElement('small');
      hint.className='jalali-hint';hint.textContent='تقویم هجری شمسی';
      wrapper.appendChild(hint);
      input.parentNode.appendChild(wrapper);
      function days() {
        const saved=d.value;d.replaceChildren();option(d,'','روز');
        const year=Number(y.value),month=Number(m.value);
        if(!year||!month)return;
        const last=month<=6?31:month<=11?30:(j2g(year,12,30)?30:29);
        for(let n=1;n<=last;n++)option(d,n,numeral(n));
        if(saved && Number(saved)<=last)d.value=saved;
      }
      function update() {
        const year=Number(y.value),month=Number(m.value),day=Number(d.value);
        const iso=j2g(year,month,day);
        const clockValid=!dateTime||(hours.value!==''&&minutes.value!=='');
        const withinRange=!iso||!dateTime||new Date(iso+'T00:00:00Z').getTime() >=
          Date.UTC(currentYear+620,0,1);
        input.value=iso && clockValid && withinRange
          ? iso+(dateTime?'T'+digits(Number(hours.value))+':'+digits(Number(minutes.value)):'')
          : '';
      }
      y.addEventListener('change',()=>{days();update()});
      m.addEventListener('change',()=>{days();update()});
      d.addEventListener('change',update);
      if(dateTime){hours.addEventListener('change',update);minutes.addEventListener('change',update);}
      if(initial){
        y.value=String(initial.year);m.value=String(initial.month);days();
        d.value=String(initial.day);
        if(dateTime&&/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(original)) {
          hours.value=String(Number(original.slice(11,13)));
          minutes.value=String(Number(original.slice(14,16)));
        }
        update();
      }
    }
  }
  function validateForm(form) {
    if(!form||typeof form.querySelectorAll!=='function')return true;
    for(const input of form.querySelectorAll('input[data-jalali-source="true"]')) {
      // The signup date exists in the login form DOM, but is only required
      // when the student-signup branch is active. Never block ordinary login.
      if(!input.required)continue;
      if(!input.value) {
        const root=input.parentNode;
        const select=root&&root.querySelector('.jalali-select');
        if(select&&select.focus)select.focus();
        return false;
      }
    }
    return true;
  }
  function formatDate(value,withTime=false) {
    const date=new Date(value);
    if(!Number.isFinite(date.getTime()))return 'تاریخ نامشخص';
    return withTime
      ? new Intl.DateTimeFormat('fa-IR-u-ca-persian',{
          year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',
          timeZone:'Asia/Tehran',hour12:false
        }).format(date)
      : display.format(date);
  }
  window.KanonhaJalali=Object.freeze({g2j,j2g,enhance,validateForm,formatDate});
})();
