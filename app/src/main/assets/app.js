/* ==========================================
   اپ کانون‌های دانشجویی — نمونه رابط کاربری
   HTML + CSS + JavaScript — کاملاً آفلاین
   هیچ داده‌ای به سرور ارسال نمی‌شود.
   ========================================== */
(() => {
  'use strict';

  /* ——— Helpers ——— */
  const $ = (id) => document.getElementById(id);
  const escapeHTML = (str) => String(str).replace(/[&<>"']/g, s =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s])
  );

  /* ——— Navigation items ——— */
  const navItems = [
    { id: 'home',     label: 'خانه',          icon: 'home'          },
    { id: 'clubs',    label: 'کانون‌ها',       icon: 'users'         },
    { id: 'events',   label: 'رویدادها',       icon: 'calendar'      },
    { id: 'activity', label: 'فعالیت‌های من', icon: 'check-square'  },
    { id: 'profile',  label: 'حساب کاربری',   icon: 'user'          }
  ];

  /* ——— SVG icon paths ——— */
  const iconPaths = {
    home:           '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    users:          '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M17 14a6 6 0 0 1 4 6"/>',
    user:           '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    calendar:       '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 10h18"/>',
    'check-square': '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8 12 3 3 5-6"/>',
    search:         '<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4.5 4.5"/>',
    megaphone:      '<path d="M4 10h4l10-5v14L8 14H4zM8 14l2 5h3M20 9v6"/>',
    'chevron-left': '<path d="m15 18-6-6 6-6"/>',
    'chevron-right':'<path d="m9 18 6-6-6-6"/>',
    'map-pin':      '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2"/>',
    ticket:         '<path d="M3 8V5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4a3 3 0 0 0 0-6Z"/><path d="M13 4v15" stroke-dasharray="2 3"/>',
    pencil:         '<path d="m4 20 4-.8L19 8a2 2 0 1 0-3-3L5 16z"/><path d="m14 7 3 3"/>',
    info:           '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    'log-out':      '<path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M14 8l4 4-4 4M18 12H8"/>',
    x:              '<path d="M5 5l14 14M19 5 5 19"/>',
    book:           '<path d="M12 6c-2-2-6-3-9-2v14c3-1 7 0 9 2 2-2 6-3 9-2V4c-3-1-7 0-9 2Z"/><path d="M12 6v14M6 8l3 1M15 9l3-1M6 12l3 1"/>',
    flask:          '<path d="M8 3h8M10 3v8l-6 9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1l-6-9V3M7 16h10"/>',
    code:           '<path d="m8 5-6 7 6 7m8-14 6 7-6 7M14 3l-4 18"/>',
    leaf:           '<path d="M21 3C12 3 4 6 4 15a6 6 0 0 0 6 6c9 0 11-9 11-18ZM3 21c3-5 7-8 14-12"/>',
    basketball:     '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5 5c6 3 8 11 14 14M19 5C13 8 11 16 5 19"/>'
  };

  const svg = (name, size = 21) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.info}</svg>`;

  /* ——— Data ——— */
  const clubs = [
    { title: 'کانون فرهنگی و هنری',    desc: 'برگزاری رویدادهای فرهنگی، هنری و ادبی',                          short: 'کانون فرهنگی',      icon: 'book',       tone: 'blue'   },
    { title: 'کانون علمی و پژوهشی',     desc: 'ترویج فعالیت‌های علمی و پژوهشی دانشجویان',                      short: 'کانون علمی',        icon: 'flask',      tone: 'mint'   },
    { title: 'کانون فناوری و نوآوری',   desc: 'حمایت از ایده‌های فناورانه و آموزش مهارت‌های روز',              short: 'کانون فناوری',      icon: 'code',       tone: 'blue'   },
    { title: 'کانون محیط‌زیست',          desc: 'فرهنگ‌سازی و اجرای برنامه‌های حفاظت از محیط‌زیست',             short: 'کانون محیط‌زیست',  icon: 'leaf',       tone: 'green'  },
    { title: 'کانون ورزشی',              desc: 'برگزاری مسابقات و برنامه‌های ورزشی دانشجویی',                   short: 'کانون ورزشی',       icon: 'basketball', tone: 'orange' }
  ];

  const events = [
    { title: 'کارگاه مقدماتی پایتون',     date: 'زمان‌بندی نمونه',    location: 'سالن جلسات دانشکده مهندسی', capacity: 18, poster: 'poster-code.svg',  category: 'کارگاه',   club: 2, registrationOpen: true },
    { title: 'نشست «آینده هوش مصنوعی»',   date: 'زمان‌بندی نمونه',  location: 'سالن آمفی‌تئاتر مرکزی',     capacity: 45, poster: 'poster-ai.svg',    category: 'نشست',     club: 1, registrationOpen: true },
    { title: 'مسابقه طراحی پوستر',        date: 'زمان‌بندی نمونه',     location: 'کانون فرهنگی و هنری',       capacity: 20, poster: 'poster-art.svg',   category: 'مسابقه',   club: 0, registrationOpen: true },
    { title: 'نشست کتاب‌خوانی',           date: 'زمان‌بندی نمونه',  location: 'کتابخانه دانشگاه',          capacity: 25, poster: 'poster-books.svg', category: 'نشست',     club: 0, registrationOpen: true }
  ];

  /* ——— State ——— */
  const STORAGE_KEY = 'kanonha-ui-v3';
  const defaultState = () => ({ joined: [], registered: [], name: 'کاربر آزمایشی', number: 'ثبت نشده' });

  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (s && Array.isArray(s.joined) && Array.isArray(s.registered) && typeof s.name === 'string' && typeof s.number === 'string') {
        s.joined = [...new Set(s.joined.filter(n => Number.isInteger(n) && n >= 0 && n < clubs.length))];
        s.registered = [...new Set(s.registered.filter(n => Number.isInteger(n) && n >= 0 && n < events.length))];
        return s;
      }
    } catch (_) {}
    return defaultState();
  }

  let state = loadState();
  let activeScreen = 'home';
  let activeFilter = 'همه';
  let toastTimer;

  const saveState = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  };

  /* ——— Toast ——— */
  function notify(message) {
    const el = $('toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.hidden = true, 2600);
  }

  /* ——— Navigation ——— */
  function go(screen, { scroll = true } = {}) {
    if (!navItems.some(x => x.id === screen)) return;
    activeScreen = screen;
    document.querySelectorAll('.screen').forEach(el => {
      el.hidden = el.dataset.screen !== screen;
    });
    renderNav();
    if (screen === 'activity') renderActivity();
    if (scroll) $('main').scrollTop = 0;
    try { history.replaceState(null, '', `#${screen}`); } catch (_) {}
  }

  function renderNav() {
    $('bottom-nav').innerHTML = navItems.map(x =>
      `<button type="button" data-screen-btn="${x.id}"
        class="${x.id === activeScreen ? 'active' : ''}"
        ${x.id === activeScreen ? 'aria-current="page"' : ''}>
        <img class="nav-art" src="assets/nav-${x.id}.svg" alt="" width="34" height="34"><span>${x.label}</span>
      </button>`
    ).join('');
  }

  /* ——— Event card ——— */
  function eventCard(event, index, { compact = false } = {}) {
    const registered = state.registered.includes(index);
    return `<article class="card event-card${compact ? ' compact' : ''}" data-event-card="${index}">
      <img class="event-poster" src="assets/${event.poster}" alt="پوستر ${escapeHTML(event.title)}" width="88" height="${compact ? 88 : 120}" loading="lazy">
      <div class="event-info">
        <h3>${escapeHTML(event.title)}</h3>
        <div class="event-meta">${svg('calendar', 13)}<span>${escapeHTML(event.date)}</span></div>
        ${compact ? '' : `<div class="event-meta">${svg('map-pin', 13)}<span>${escapeHTML(event.location)}</span></div>
        <div class="capacity">ظرفیت نمونه: <strong>${event.capacity} نفر</strong></div>`}
      </div>
      <button type="button"
        class="pill-btn ${compact ? 'view-btn' : registered ? 'signed' : ''}"
        data-${compact ? 'details' : 'register'}="${index}"
        aria-label="${compact ? 'مشاهده' : 'ثبت‌نام'} ${escapeHTML(event.title)}">
        ${compact ? 'مشاهده' : registered ? 'ثبت‌نام‌شده' : 'ثبت‌نام'}
      </button>
    </article>`;
  }

  /* ——— Club card ——— */
  function clubCard(club, index) {
    const member = state.joined.includes(index);
    const isViewOnly = index === 0 || index === 3;
    return `<article class="card club-card">
      <div class="club-icon ${club.tone === 'blue' ? '' : club.tone}"><img class="club-art" src="assets/club-${club.icon === "book" ? "book" : club.icon === "code" ? "tech" : club.icon === "leaf" ? "leaf" : club.icon === "flask" ? "science" : "sport"}.svg" alt="" width="48" height="48"></div>
      <div class="club-info">
        <h3>${club.title}</h3>
        <p>${club.desc}</p>
        <button type="button"
          ${member || isViewOnly ? `data-club-details="${index}"` : `data-join="${index}"`}
          class="pill-btn ${member ? 'joined' : isViewOnly ? 'view-btn' : ''}">
          ${member ? 'عضو هستید' : isViewOnly ? 'مشاهده' : 'عضویت'}
        </button>
      </div>
    </article>`;
  }

  /* ——— Render functions ——— */
  function homeCarouselCard(event,index){
    return `<article class="home-event-slide" role="group" aria-label="${escapeHTML(event.title)}">
      <div class="home-slide-cover">
        <img src="assets/${event.poster}" alt="پوستر ${escapeHTML(event.title)}" width="244" height="119" loading="lazy">
        <span class="home-slide-status"><span class="home-slide-pulse" aria-hidden="true"></span> ثبت‌نام آزمایشی</span>
      </div>
      <div class="home-slide-info">
        <h3>${escapeHTML(event.title)}</h3>
        <span class="home-slide-date">${svg('calendar',13)}${escapeHTML(event.date)}</span>
        <button class="home-slide-view" type="button" data-details="${index}" aria-label="مشاهده ${escapeHTML(event.title)}">مشاهده جزئیات <span aria-hidden="true">‹</span></button>
      </div>
    </article>`;
  }

  function updateHomeCarouselControls(){
    const scroll=$('home-events'),items=Array.from(scroll.querySelectorAll('.home-event-slide'));
    const count=$('home-carousel-count'),prev=$('home-carousel-prev'),next=$('home-carousel-next');
    const width=items[0]?items[0].getBoundingClientRect().width:0;
    const step=width+12;
    const index=step?Math.max(0,Math.min(items.length-1,Math.round(Math.abs(scroll.scrollLeft)/step))):0;
    count.textContent=items.length?`${index+1} از ${items.length}`:'رویدادی یافت نشد';
    prev.disabled=!items.length||index===0;next.disabled=!items.length||index===items.length-1;
  }

  function moveHomeCarousel(direction){
    const scroll=$('home-events'),items=Array.from(scroll.querySelectorAll('.home-event-slide'));
    if(!items.length)return;
    const step=items[0].getBoundingClientRect().width+12;
    const index=Math.max(0,Math.min(items.length-1,Math.round(Math.abs(scroll.scrollLeft)/step)));
    const target=Math.max(0,Math.min(items.length-1,index+direction));
    items[target].scrollIntoView({behavior:'smooth',block:'nearest',inline:'start'});
  }

  function renderHome(query=$('home-search').value.trim()){
    // Explicit demo registration statuses; replace with backend results before production.
    const found=events.map((event,index)=>[event,index]).filter(([event])=>event.registrationOpen===true&&event.capacity>0&&(!query||event.title.includes(query)));
    $('home-events').innerHTML=found.length?found.map(([event,index])=>homeCarouselCard(event,index)).join(''):'<div class="home-carousel-empty" role="status">رویداد دارای ثبت‌نام فعال پیدا نشد.</div>';
    $('home-events').scrollLeft=0;updateHomeCarouselControls();
    const foundClubs=[0,2,3].filter(i=>!query||clubs[i].title.includes(query)||clubs[i].desc.includes(query));
    $('home-clubs').innerHTML=foundClubs.length?foundClubs.map(i=>
      `<button type="button" class="home-mini-club" data-club-details="${i}">
      <span class="mini-club-icon ${clubs[i].tone==='green'?'green':clubs[i].tone==='mint'?'mint':clubs[i].tone==='orange'?'orange':''}"><img class="mini-art" src="assets/club-${clubs[i].icon==='book'?'book':clubs[i].icon==='code'?'tech':clubs[i].icon==='leaf'?'leaf':clubs[i].icon==='flask'?'science':'sport'}.svg" alt="" width="57" height="57"></span>
      ${clubs[i].short}</button>`).join(''):'<div class="empty">کانونی یافت نشد.</div>';
  }

  function renderClubs() {
    const q = $('clubs-search').value.trim();
    const found = clubs.map((c, i) => [c, i]).filter(([c]) => !q || c.title.includes(q) || c.desc.includes(q));
    $('clubs-list').innerHTML = found.length
      ? found.map(([c, i]) => clubCard(c, i)).join('')
      : '<div class="no-results">کانونی با این نام پیدا نشد.</div>';
  }

  function renderEvents() {
    $('event-filters').innerHTML = ['همه', 'کارگاه', 'نشست', 'مسابقه'].map(type =>
      `<button type="button" class="filter-btn${type === activeFilter ? ' active' : ''}" data-filter="${type}" aria-pressed="${type === activeFilter}">${type}</button>`
    ).join('');
    const found = events.map((ev, i) => [ev, i]).filter(([ev]) => activeFilter === 'همه' || ev.category === activeFilter);
    $('events-list').innerHTML = found.length
      ? found.map(([ev, i]) => eventCard(ev, i)).join('')
      : '<div class="no-results">رویدادی پیدا نشد.</div>';
  }

  /* ——— QR placeholder (non-scannable, labeled) ——— */
  function qrMarkup(seed) {
    let cells = '';
    for (let y = 0; y < 13; y++) {
      for (let x = 0; x < 13; x++) {
        let finder = false;
        for (const [sx, sy] of [[0, 0], [8, 0], [0, 8]]) {
          const dx = x - sx, dy = y - sy;
          if (dx >= 0 && dx < 5 && dy >= 0 && dy < 5) {
            finder = dx === 0 || dy === 0 || dx === 4 || dy === 4 || (dx === 2 && dy === 2);
            break;
          }
        }
        const on = finder || ((x * 19 + y * 13 + seed * 11 + x * y) % 7 <= 2);
        cells += `<i class="${on ? 'dark' : ''}"></i>`;
      }
    }
    return `<div class="sample-qr" role="img" aria-label="کد QR صرفاً نمایشی و فاقد اعتبار">${cells}</div>`;
  }

  function renderActivity() {
    $('activity-clubs').innerHTML = state.joined.length
      ? state.joined.filter(i => clubs[i]).map(i =>
          `<button class="activity-row" type="button" data-club-details="${i}">
            <span class="club-icon ${clubs[i].tone}"><img class="row-club-art" src="assets/club-${clubs[i].icon === "book" ? "book" : clubs[i].icon === "code" ? "tech" : clubs[i].icon === "leaf" ? "leaf" : clubs[i].icon === "flask" ? "science" : "sport"}.svg" alt="" width="31" height="31"></span>
            <span class="activity-copy">${clubs[i].title}</span>
            <span class="arrow">${svg('chevron-left', 15)}</span>
          </button>`
        ).join('')
      : '<div class="empty">هنوز عضو کانونی نشده‌اید.</div>';

    $('activity-events').innerHTML = state.registered.length
      ? state.registered.filter(i => events[i]).map(i =>
          `<button class="activity-row" type="button" data-details="${i}">
            <span class="activity-copy">${events[i].title}<small>${events[i].date}</small></span>
            <span class="arrow">${svg('chevron-left', 15)}</span>
          </button>`
        ).join('')
      : '<div class="empty">رویدادی ثبت‌نام نشده است.</div>';

    $('activity-tickets').innerHTML = state.registered.length
      ? state.registered.filter(i => events[i]).map(i =>
          `<article class="ticket-card">
            <div class="ticket-details">
              <h3>${events[i].title}</h3>
              <p>${svg('calendar', 12)} ${events[i].date}</p>
              <p>${svg('map-pin', 12)} ${events[i].location}</p>
              <div class="ticket-label">بلیت نمونه — فاقد اعتبار ورود</div>
            </div>
            ${qrMarkup(i)}
          </article>`
        ).join('')
      : '<div class="empty">هنوز بلیتی ندارید.</div>';
  }

  /* ——— Sheet ——— */
  let focusBeforeSheet = null;
  function openSheet(title, html) {
    focusBeforeSheet = document.activeElement;
    $('sheet-title').textContent = title;
    $('sheet-content').innerHTML = html;
    $('sheet-overlay').hidden = false;
    requestAnimationFrame(() => $('close-sheet').focus());
  }

  function closeSheet() {
    $('sheet-overlay').hidden = true;
    if (focusBeforeSheet && typeof focusBeforeSheet.focus === 'function' && focusBeforeSheet.isConnected) focusBeforeSheet.focus();
    focusBeforeSheet = null;
  }

  /* ——— Native Android back action: close the sheet first, then return Home. ——— */
  function handleBack() {
    if (!$('sheet-overlay').hidden) { closeSheet(); return true; }
    if (activeScreen !== 'home') { go('home'); return true; }
    return false;
  }

  /* ——— Detail sheets ——— */
  function eventDetails(i) {
    const ev = events[i];
    if (!ev) return;
    openSheet(ev.title,
      `<p>${svg('calendar', 15)} ${ev.date}<br>${svg('map-pin', 15)} ${ev.location}<br>
       کانون برگزارکننده: ${clubs[ev.club].title}</p>
       <p>این یک رویداد نمونه رابط کاربری است. ثبت‌نام واقعی انجام نمی‌شود.</p>
       <button class="pill-btn sheet-action" type="button" data-register="${i}">
         ${state.registered.includes(i) ? 'ثبت‌نام‌شده' : 'ثبت‌نام نمایشی'}
       </button>`
    );
  }

  function clubDetails(i) {
    const club = clubs[i];
    if (!club) return;
    openSheet(club.title,
      `<p>${club.desc}</p>
       <p>برای مشاهده عملکرد ظاهری عضویت می‌توانید روی دکمه زیر بزنید. هیچ اطلاعاتی به سرور ارسال نمی‌شود.</p>
       <button class="pill-btn sheet-action" type="button" data-join="${i}">
         ${state.joined.includes(i) ? 'عضو هستید' : 'درخواست عضویت نمایشی'}
       </button>`
    );
  }

  /* ——— Actions ——— */
  function join(i) {
    if (!clubs[i]) return;
    if (state.joined.includes(i)) { notify('این عضویت در نسخه نمایشی ثبت شده است.'); return; }
    state.joined.push(i);
    saveState();
    renderClubs();
    renderActivity();
    closeSheet();
    notify('عضویت نمایشی ثبت شد.');
  }

  function register(i) {
    if (!events[i]) return;
    if (state.registered.includes(i)) { notify('قبلاً در این رویداد ثبت‌نام نمایشی کرده‌اید.'); return; }
    state.registered.push(i);
    saveState();
    renderEvents();
    renderActivity();
    renderHome();
    closeSheet();
    notify('ثبت‌نام نمایشی انجام شد.');
  }

  function action(name) {
    if (name === 'edit') {
      openSheet('ویرایش اطلاعات',
        `<form id="edit-form">
          <label class="field">نام و نام خانوادگی
            <input name="name" autocomplete="name" maxlength="60" required value="${escapeHTML(state.name)}">
          </label>
          <label class="field">شماره دانشجویی
            <input name="number" maxlength="20" required value="${escapeHTML(state.number)}">
          </label>
          <button type="submit" class="pill-btn sheet-action">ذخیره نمایشی</button>
        </form>`
      );
    } else if (name === 'requests') {
      openSheet('درخواست‌های عضویت',
        `<p>این نمونه رابط کاربری است. وضعیت عضویت نمونه در قسمت «فعالیت‌های من» قابل مشاهده است.</p>
         <button class="pill-btn sheet-action" type="button" data-goto="activity">فعالیت‌های من</button>`
      );
    } else if (name === 'about') {
      openSheet('درباره برنامه',
        `<p>کانون‌ها — نسخه آزمایشی مستقل</p>
         <p>پنج صفحه با HTML، CSS، JavaScript و تصویرسازی SVG پیاده‌سازی شده‌اند. هیچ داده‌ای به سرور ارسال نمی‌شود.</p>
         <button type="button" data-action="reset" class="pill-btn soft">بازنشانی داده‌های نمایشی</button>`
      );
    } else if (name === 'exit') {
      openSheet('خروج از حساب',
        `<p>در نسخه نمایشی، حساب کاربری واقعی وجود ندارد. بنابراین خروج واقعی فعال نیست.</p>`
      );
    } else if (name === 'reset') {
      state = defaultState();
      saveState();
      renderAll();
      closeSheet();
      notify('داده‌های نمونه بازنشانی شد.');
    }
  }

  /* ——— Render all ——— */
  function renderAll() {
    renderHome();
    renderClubs();
    renderEvents();
    renderActivity();
    updateProfileDisplay();
  }

  function updateProfileDisplay() {
    const nameEl = $('profile-name');
    const numEl = $('profile-number');
    if (nameEl) nameEl.textContent = state.name;
    if (numEl) numEl.textContent = `شماره دانشجویی: ${state.number}`;
  }

  /* ——— Init ——— */
  function init() {
    // Inject SVGs into data-icon elements
    document.querySelectorAll('[data-icon]').forEach(el => {
      el.innerHTML = svg(el.dataset.icon);
    });

    // Notice banner
    $('notice-btn').addEventListener('click', () =>
      openSheet('اطلاعیه مهم',
        '<p>این یک اطلاعیه نمایشی برای آزمایش رابط کاربری کانون‌هاست.</p><p>ثبت‌نام واقعی هنوز فعال نیست.</p>'
      )
    );

    // Horizontal home carousel stays horizontal after search.
    $('home-search').addEventListener('input',e=>renderHome(e.target.value.trim()));
    $('home-events').addEventListener('scroll',updateHomeCarouselControls,{passive:true});
    $('home-events').addEventListener('keydown',e=>{
      if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();moveHomeCarousel(e.key==='ArrowLeft'?1:-1);}
    });

    // Clubs search
    $('clubs-search').addEventListener('input', renderClubs);

    // Sheet close
    $('close-sheet').addEventListener('click', closeSheet);
    $('sheet-overlay').addEventListener('click', e => {
      if (e.target === $('sheet-overlay')) closeSheet();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !$('sheet-overlay').hidden) closeSheet();
    });

    // Delegated click handler
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.carousel) { moveHomeCarousel(btn.dataset.carousel==='next'?1:-1); return; }
      if (btn.dataset.screenBtn)      { go(btn.dataset.screenBtn); return; }
      if (btn.dataset.goto)           { closeSheet(); go(btn.dataset.goto); return; }
      if (btn.dataset.filter)         { activeFilter = btn.dataset.filter; renderEvents(); return; }
      if (btn.dataset.join !== undefined)        { join(Number(btn.dataset.join)); return; }
      if (btn.dataset.register !== undefined)    { register(Number(btn.dataset.register)); return; }
      if (btn.dataset.details !== undefined)     { eventDetails(Number(btn.dataset.details)); return; }
      if (btn.dataset.clubDetails !== undefined) { clubDetails(Number(btn.dataset.clubDetails)); return; }
      if (btn.dataset.action)         { action(btn.dataset.action); }
    });

    // Profile edit form
    document.addEventListener('submit', (e) => {
      if (e.target.id !== 'edit-form') return;
      e.preventDefault();
      const form = new FormData(e.target);
      const name = String(form.get('name') || '').trim();
      const number = String(form.get('number') || '').trim();
      if (!name || !number) return;
      state.name = name;
      state.number = number;
      saveState();
      renderAll();
      closeSheet();
      notify('اطلاعات نمایشی ذخیره شد.');
    });

    if (new URLSearchParams(window.location.search).get('native') === '1') { document.body.classList.add('native-app'); }
    // Initial render
    renderAll();
    renderNav();

    // Handle hash navigation
    const requested = location.hash.replace('#', '');
    go(navItems.some(x => x.id === requested) ? requested : 'home');

    window.addEventListener('hashchange', () => {
      const id = location.hash.slice(1);
      if (navItems.some(x => x.id === id) && id !== activeScreen) go(id);
    });
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Read-only testing API
  if (typeof window !== 'undefined') {
    window.KanonhaPreview = {
      get screen() { return activeScreen; },
      get state() { return { ...state, joined: [...state.joined], registered: [...state.registered] }; },
      go,
      handleBack,
      reset: () => action('reset')
    };
  }
})();