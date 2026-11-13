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
  const studentNavItems = [
    { id: 'home',     label: 'خانه',          icon: 'home'          },
    { id: 'clubs',    label: 'کانون‌ها',       icon: 'users'         },
    { id: 'events',   label: 'رویدادها',       icon: 'calendar'      },
    { id: 'ratings',  label: 'نظرسنجی',       art: 'ratings'         },
    { id: 'activity', label: 'فعالیت‌های من', icon: 'check-square'  },
    { id: 'profile',  label: 'حساب کاربری',   icon: 'user'          }
  ];
  const managerNavItems = [
    {id:'manager-home', label:'خانه', art:'home'},
    {id:'manager-clubs', label:'کانون‌ها', art:'clubs'},
    {id:'manager-users', label:'کاربران', art:'activity'},
    {id:'manager-events', label:'رویدادها', art:'events'},
    {id:'ratings', label:'نظرسنجی', art:'ratings'},
    {id:'manager-account', label:'حساب', art:'profile'}
  ];
  const secretaryNavItems = [
    {id:'secretary-home', label:'خانه', art:'home'},
    {id:'secretary-club', label:'کانون من', art:'clubs'},
    {id:'secretary-events', label:'رویدادها', art:'events'},
    {id:'ratings', label:'نظرسنجی', art:'ratings'},
    {id:'secretary-members', label:'اعضا', art:'activity'},
    {id:'secretary-account', label:'حساب', art:'profile'}
  ];
  function routeNavItems() {
    if (!onlineMode || !onlineBackend.currentUser) return studentNavItems;
    return activePersona === 'manager' ? managerNavItems :
      activePersona === 'secretary' ? secretaryNavItems : studentNavItems;
  }
  function personaHome() {
    return activePersona === 'manager' ? 'manager-home' :
      activePersona === 'secretary' ? 'secretary-home' : 'home';
  }

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

  /* ——— Online provider. Demo content is never mixed with a configured backend. ——— */
  const onlineBackend = typeof window !== 'undefined' ? window.KanonhaBackend : null;
  const onlineMode = Boolean(onlineBackend && onlineBackend.enabled);

  /* ——— Data ——— */
  let clubs = onlineMode ? [] : [
    { title: 'کانون فرهنگی و هنری',    desc: 'برگزاری رویدادهای فرهنگی، هنری و ادبی',                          short: 'کانون فرهنگی',      icon: 'book',       tone: 'blue'   },
    { title: 'کانون علمی و پژوهشی',     desc: 'ترویج فعالیت‌های علمی و پژوهشی دانشجویان',                      short: 'کانون علمی',        icon: 'flask',      tone: 'mint'   },
    { title: 'کانون فناوری و نوآوری',   desc: 'حمایت از ایده‌های فناورانه و آموزش مهارت‌های روز',              short: 'کانون فناوری',      icon: 'code',       tone: 'blue'   },
    { title: 'کانون محیط‌زیست',          desc: 'فرهنگ‌سازی و اجرای برنامه‌های حفاظت از محیط‌زیست',             short: 'کانون محیط‌زیست',  icon: 'leaf',       tone: 'green'  },
    { title: 'کانون ورزشی',              desc: 'برگزاری مسابقات و برنامه‌های ورزشی دانشجویی',                   short: 'کانون ورزشی',       icon: 'basketball', tone: 'orange' }
  ];

  let events = onlineMode ? [] : [
    { title: 'کارگاه مقدماتی پایتون',     date: 'زمان‌بندی نمونه',    location: 'سالن جلسات دانشکده مهندسی', capacity: 18, poster: 'poster-code.svg',  category: 'کارگاه',   club: 2, registrationOpen: true },
    { title: 'نشست «آینده هوش مصنوعی»',   date: 'زمان‌بندی نمونه',  location: 'سالن آمفی‌تئاتر مرکزی',     capacity: 45, poster: 'poster-ai.svg',    category: 'نشست',     club: 1, registrationOpen: true },
    { title: 'مسابقه طراحی پوستر',        date: 'زمان‌بندی نمونه',     location: 'کانون فرهنگی و هنری',       capacity: 20, poster: 'poster-art.svg',   category: 'مسابقه',   club: 0, registrationOpen: true },
    { title: 'نشست کتاب‌خوانی',           date: 'زمان‌بندی نمونه',  location: 'کتابخانه دانشگاه',          capacity: 25, poster: 'poster-books.svg', category: 'نشست',     club: 0, registrationOpen: true }
  ];

  /* ——— State ——— */
  const STORAGE_KEY = 'kanonha-ui-v3';
  const defaultState = () => ({ joined: [], requested: [], rejected: [], registered: [], attended: [], name: onlineMode ? 'مهمان' : 'کاربر آزمایشی', number: 'ثبت نشده', isManager: false, academic: null });

  function loadState() {
    // Never read a previous offline demo account while online mode is active.
    if (onlineMode) return defaultState();
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (s && Array.isArray(s.joined) && Array.isArray(s.registered) && typeof s.name === 'string' && typeof s.number === 'string') {
        s.joined = [...new Set(s.joined.filter(n => Number.isInteger(n) && n >= 0 && n < clubs.length))];
        s.registered = [...new Set(s.registered.filter(n => Number.isInteger(n) && n >= 0 && n < events.length))];
        s.requested = [];
        s.rejected = [];
        s.attended = [];
        return s;
      }
    } catch (_) {}
    return defaultState();
  }

  const eventTickets = new Map();
  let activityHistory = [];
  let activityMembers = [];
  let activityCertificates = [];
  const activityClubBusy = new Set();
  let state = loadState();
  let activeScreen = 'home';
  let activeFilter = 'همه';
  let toastTimer;

  const saveState = () => {
    if (onlineMode) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  };

  /* ——— Online catalog, account, and durable per-user records ——— */
  let onlineSignup = false;
  let onlineRole = 'student';
  let onlineWorking = false;
  let onlinePublicSequence = 0;
  let onlinePersonalSequence = 0;
  let activePersona = 'student';
  let assignedSecretary = false;
  let studentProfileReady = false;
  let adminPanelReady = false;
  let secretaryPanelReady = false;
  let roleCapabilitiesChecked = false;
  let managerUsersTab = 'students';
  let secretaryMembersTab = 'members';
  let managerEntryTaps = 0;
  let managerEntryLastTap = 0;
  let academicDirectory = {universities: [], faculties: []};
  let academicDirectoryReady = false;
  let academicDirectoryLoading = false;
  function onlineMessage(text, isError = false) {
    const el = $('online-connection');
    if (!el) return;
    el.hidden = false;
    el.textContent = text;
    el.classList.toggle('is-error', isError);
  }
  function onlineError(error) {
    const code = error && error.status;
    if (code === 409 || code === 23505) return 'این ثبت قبلاً انجام شده است.';
    if (code === 401) return 'نشست شما منقضی شده است؛ دوباره وارد شوید.';
    return error && typeof error.message === 'string'
      ? error.message.slice(0, 180) : 'خطای ارتباط با پایگاه داده.';
  }
  function onlineRenderAuth() {
    if (!onlineMode) return;
    const signed = Boolean(onlineBackend.currentUser);
    // Guest LOGIN is a standalone screen; keep registered profile/signup intact.
    $('screen-profile').dataset.authView = signed ? 'signed' : onlineSignup ? 'signup' : 'login';
    $('online-auth-panel').hidden = signed;
    $('online-profile-card').hidden = !signed;
    $('profile-menu').hidden = !signed;
    $('bottom-nav').hidden = !signed;
    const student = onlineRole === 'student';
    $('auth-back-student').hidden = student;
    $('student-login-fields').hidden = !student || onlineSignup;
    $('student-signup-fields').hidden = !student || !onlineSignup;
    $('manager-login-fields').hidden = student;
    $('online-auth-title').textContent = onlineSignup
      ? student ? 'ثبت‌نام' : 'ثبت حساب مدیر کل'
      : student ? 'ورود' : 'ورود مدیرکل';
    $('online-auth-title').setAttribute('aria-label', $('online-auth-title').textContent);
    $('online-auth-submit').textContent = onlineSignup ? 'ایجاد حساب' : 'ورود به حساب';
    $('online-auth-toggle').textContent = onlineSignup ? 'ورود به حساب'
      : student ? 'ساخت حساب کاربری' : 'راه‌اندازی حساب مدیرکل';
    for (const role of ['student','manager']) {
      const el = $('auth-role-' + role);
      el.classList.toggle('active',onlineRole === role);
      el.setAttribute('aria-pressed',onlineRole === role ? 'true' : 'false');
    }
    for (const id of ['online-name','online-student','online-national','online-birth',
      'online-university','online-faculty','online-major','online-mobile'])
      $(id).required = student && onlineSignup;
    $('online-identifier').required = student && !onlineSignup;
    $('online-email').required = !student;
    $('online-password').minLength = student && onlineSignup ? 10 : 8;
    $('online-password').autocomplete = onlineSignup ? 'new-password' : 'current-password';
    // Browser's ASCII-only pattern would block Persian digits before our
    // normalization logic could produce a meaningful message.
    $('online-auth-form').noValidate = Boolean(student && onlineSignup);
    updateBiometricUI();
  }
  function academyUniversityOptions(selected = '') {
    let options = '<option value="">انتخاب دانشگاه</option>';
    const known = academicDirectory.universities.some(x => x.name === selected);
    if (selected && !known) options += '<option value="' + escapeHTML(selected) +
      '">نام ثبت‌شده قبلی: ' + escapeHTML(selected) + '</option>';
    return options + academicDirectory.universities.map(u =>
      '<option value="' + escapeHTML(u.name) + '"' + (u.name===selected?' selected':'') +
      '>' + escapeHTML(u.name) + '</option>').join('');
  }
  function academyFacultyOptions(university, selected='') {
    let options = '<option value="">انتخاب دانشکده</option>';
    const uni = academicDirectory.universities.find(x => x.name===university);
    const faculties = uni ? academicDirectory.faculties.filter(x => x.university_id===uni.id) : [];
    if (selected && !faculties.some(x=>x.name===selected))
      options += '<option value="'+escapeHTML(selected)+'">نام ثبت‌شده قبلی: '+escapeHTML(selected)+'</option>';
    return options + faculties.map(x =>
      '<option value="'+escapeHTML(x.name)+'"'+(x.name===selected?' selected':'')+'>'+
       escapeHTML(x.name)+'</option>').join('');
  }
  function updateSignupFaculty() {
    const university=$('online-university'),faculty=$('online-faculty');
    if(!university||!faculty)return;
    faculty.innerHTML=academyFacultyOptions(university.value);
    faculty.disabled=!university.value ||
      !academicDirectory.universities.some(x=>x.name===university.value);
  }
  function updateAcademicSignup() {
    if(!$('online-university'))return;
    const previous=$('online-university').value;
    $('online-university').innerHTML=academyUniversityOptions(previous);
    $('online-university').value=academicDirectory.universities.some(x=>x.name===previous)
       ? previous : '';
    updateSignupFaculty();
    const status=$('academic-catalog-status');
    if(status) {
      // Normal registration needs no administrative-approval explanation;
      // show a message only when the directory actually blocks signup.
      const noUniversity=academicDirectory.universities.length===0;
      status.hidden=!noUniversity;
      status.textContent=noUniversity
        ? 'هنوز دانشگاهی ثبت نشده است؛ امکان انتخاب دانشگاه وجود ندارد.' : '';
    }
  }
  async function refreshAcademicDirectory() {
    if(!onlineMode || academicDirectoryLoading || typeof onlineBackend.academicCatalog !== 'function')return;
    academicDirectoryLoading=true;
    try {
      const data=await onlineBackend.academicCatalog();
      academicDirectory={
        universities:Array.isArray(data.universities)?data.universities:[],
        faculties:Array.isArray(data.faculties)?data.faculties:[]
      };
      academicDirectoryReady=true;
      updateAcademicSignup();
    } catch(error) {
      const status=$('academic-catalog-status');
      if(status) {
        status.hidden=false;
        status.textContent='دریافت دانشگاه‌ها ناموفق بود؛ اتصال اینترنت را بررسی کنید.';
      }
    } finally {academicDirectoryLoading=false;}
  }
  function updateBiometricUI() {
    if(!onlineMode) return;
    const biometric=window.KanonhaBiometric;
    const available=Boolean(biometric && biometric.available && biometric.available());
    const present=Boolean(biometric && biometric.present && biometric.present());
    const enrolled=available && biometric.enrolled();
    const signed=Boolean(onlineBackend.currentUser);
    const currentId=signed?onlineBackend.currentUser.id:'';
    const belongs=enrolled && Boolean(biometric.ownedBy && biometric.ownedBy(currentId));
    const button=$('biometric-login-btn');
    if(button)button.hidden=!enrolled||signed||onlineSignup;
    const hint=$('biometric-login-hint');
    if(hint){
      hint.hidden=signed||onlineSignup||(!enrolled&&!present);
      hint.textContent=enrolled?'برای ورود امن، روی نشان اثر انگشت کنار رمز بزنید.'
        :'حسگر اثرانگشت امن این دستگاه قابل استفاده نیست؛ با رمز عبور وارد شوید.';
    }
    const settings=$('biometric-settings');
    if(settings)settings.hidden=!signed||!present;
    const stateLabel=$('biometric-settings-state');
    if(stateLabel)stateLabel.textContent=!available
      ? 'حسگر اثرانگشت امن در این دستگاه فعال یا پشتیبانی نمی‌شود.'
      : belongs ? 'فعال است؛ پس از خروج هم می‌توانید با اثر انگشت وارد شوید.'
      : enrolled ? 'اثر انگشت قبلی به این حساب متصل نیست؛ دوباره فعال کنید.'
      : 'برای ورودهای بعدی روی همین دستگاه فعال کنید.';
    const enable=$('biometric-enable-btn');
    if(enable) {
      enable.disabled=!available;
      enable.textContent=belongs?'غیرفعال‌سازی':enrolled?'فعال‌سازی مجدد':'فعال‌سازی';
    }
  }
  async function finishOnlineSignIn(manager,form=null) {
    const justRegistered=Boolean(onlineSignup && !manager);
    // Newly registered students are signed in immediately; no director
    // approval, second login, or email confirmation step is required.
    onlineSignup=false;
    state=defaultState();
    state.isManager=Boolean(manager);
    activePersona=manager?'manager':'student';
    assignedSecretary=false;studentProfileReady=false;roleCapabilitiesChecked=false;
    ++onlinePersonalSequence;
    if(form && typeof form.reset==='function')form.reset();
    await onlineRefreshPublic();
    if(window.KanonhaSecretaryPanel)await window.KanonhaSecretaryPanel.refresh();
    if(window.KanonhaAdminPanel)await window.KanonhaAdminPanel.refresh();
    updateAvailablePersonas();
    onlineRenderAuth();
    $('online-auth-status').textContent='';
    go(personaHome());
    // Register push only after the server confirmed this account.
    window.KanonhaPush?.sync?.();
    // Sync eligible survey start/end/result reminders at each verified sign-in.
    if(window.KanonhaRatings?.backgroundSync)
      void window.KanonhaRatings.backgroundSync();
    notify(justRegistered?'حساب ساخته شد؛ می‌توانید از امکانات دانشجویی استفاده کنید.'
      :'ورود به حساب انجام شد.');
  }
  function setupBiometric() {
    if(!onlineMode || !window.KanonhaBiometric)return;
    const biometric=window.KanonhaBiometric;
    biometric.setHandlers(async refreshToken=>{
      if(onlineWorking||onlineBackend.currentUser)return;
      onlineWorking=true;
      const status=$('online-auth-status');
      status.textContent='در حال ورود امن با اثر انگشت…';
      try{
        await onlineBackend.resumeFromBiometric(refreshToken);
        const manager=await onlineBackend.isManager();
        await finishOnlineSignIn(manager);
      }catch(error){
        status.textContent='ورود اثرانگشتی ممکن نشد؛ با رمز عبور وارد شوید و اثر انگشت را مجدداً فعال کنید. '+onlineError(error);
      }finally{
        onlineWorking=false;updateBiometricUI();
      }
    },status=>{
      updateBiometricUI();
      if(status==='enabled')notify('ورود با اثر انگشت برای دفعات بعد فعال شد.');
      else if(status==='invalidated')notify('اطلاعات اثر انگشت تغییر کرده است؛ با رمز وارد شده و دوباره فعال کنید.');
      else if(status==='unavailable')notify('حسگر اثرانگشت امن در این دستگاه آماده نیست؛ از رمز عبور استفاده کنید.');
      else if(status==='error')notify('تنظیم اثر انگشت تکمیل نشد. دوباره تلاش کنید.');
      else if(status==='cancelled') {
        const label=$('online-auth-status');
        if(label && !onlineBackend.currentUser)
          label.textContent='اسکن اثر انگشت لغو شد. می‌توانید دوباره تلاش کنید یا رمز عبور بزنید.';
      }
      else if(status==='cleared')notify('ورود اثرانگشتی غیرفعال شد.');
    });
    if(biometric.enrolled()){
      // Auto prompt only after the user previously opted in to biometrics.
      setTimeout(()=>{
        if(!onlineBackend.currentUser && !onlineWorking && biometric.enrolled())biometric.unlock();
      },450);
    }
  }
  function onlineClubIcon(category) {
    const t = String(category || '');
    if (/فناوری|کامپیوتر|نرم‌افزار/.test(t)) return 'code';
    if (/علم|پژوهش/.test(t)) return 'flask';
    if (/محیط|طبیعت/.test(t)) return 'leaf';
    if (/ورزش/.test(t)) return 'basketball';
    return 'book';
  }
  async function onlineRefreshPublic() {
    if (!onlineMode) return;
    const refreshId = ++onlinePublicSequence;
    try {
      const [rawClubs, rawEvents] = await Promise.all([onlineBackend.clubs(), onlineBackend.events()]);
      if (refreshId !== onlinePublicSequence) return;
      clubs = rawClubs.filter(c => c && typeof c.id === 'string').map(c => ({
        id: c.id, title: String(c.name || ''), short: String(c.name || '').slice(0, 28),
        desc: String(c.description || ''), icon: onlineClubIcon(c.category),
        category: String(c.category || 'سایر'), university: String(c.university || ''),
        faculty: String(c.faculty || ''), logoPath: String(c.logo_path || ''), tone: 'indigo'
      }));
      const now = Date.now();
      events = rawEvents.filter(e => e && typeof e.id === 'string').map(e => {
        const start = Date.parse(e.starts_at);
        const close = Date.parse(e.registration_deadline);
        const free = Math.max(0, Number(e.capacity || 0) - Number(e.registered_count || 0));
        const category = window.KanonhaEventKinds?.get(e.event_type)?.label || 'سایر رویدادها';
        return {
          id: e.id,
          title: String(e.title || ''), date: Number.isFinite(start) ? (window.KanonhaJalali
            ? window.KanonhaJalali.formatDate(new Date(start),true)
            : new Date(start).toLocaleString('fa-IR-u-ca-persian')) : 'زمان نامشخص',
          location: String(e.location || ''), description: String(e.description || ''),
          deadlineMs:close, capacity: free, poster: 'poster-books.svg',
          posterUrl: onlineBackend.eventPosterUrl?.(e.club_id,e.id,e.poster_path)||'assets/poster-books.svg',
          startsAtMs:start,
          category, club: clubs.findIndex(c => c.id === e.club_id),
          registrationOpen: Number.isFinite(start) && Number.isFinite(close) && start > now && close > now && free > 0
        };
      });
      onlineMessage('نمایش اطلاعات آنلاین؛ عضویت و ثبت‌نام در پایگاه داده مستقل ثبت می‌شوند.');
      if (onlineBackend.currentUser) await onlineRefreshPersonal();
      else renderAll();
      return true;
    } catch (error) {
      if (refreshId !== onlinePublicSequence) return;
      onlineMessage('بارگذاری اطلاعات آنلاین ناموفق بود: ' + onlineError(error), true);
      renderAll();
      return false;
    }
  }
  async function onlineRefreshPersonal() {
    if (!onlineMode || !onlineBackend.currentUser) return;
    const ownerId = onlineBackend.currentUser.id;
    const refreshId = ++onlinePersonalSequence;
    // Optional activity endpoints must never block the member-request status.
    const outcomes = await Promise.allSettled([
      state.isManager ? onlineBackend.profile() : onlineBackend.ensureProfile(),
      onlineBackend.memberships(), onlineBackend.registrations(),
      typeof onlineBackend.academicDetails === 'function' ? onlineBackend.academicDetails() : null,
      typeof onlineBackend.myEventHistory==='function'?onlineBackend.myEventHistory():[],
      typeof onlineBackend.myClubMemberships==='function'?onlineBackend.myClubMemberships():[],
      typeof onlineBackend.myCertificates==='function'?onlineBackend.myCertificates():[]
    ]);
    const successful = (index, fallback = null) =>
      outcomes[index].status === 'fulfilled' ? outcomes[index].value : fallback;
    const profile = successful(0);
    const memberRows = successful(1);
    const eventRows = successful(2);
    const academic = successful(3);
    const historyRows = successful(4);
    const memberDetails = successful(5);
    const certificates = successful(6);
    if (refreshId !== onlinePersonalSequence ||
        !onlineBackend.currentUser || onlineBackend.currentUser.id !== ownerId) return;
    const eventIds = new Set((eventRows || []).filter(e => e.status === 'confirmed').map(e => e.event_id));
    if (Array.isArray(memberRows)) {
      const memberMap = new Map(memberRows.map(m => [m.club_id, m.status]));
      state.joined = clubs.map((c, i) => memberMap.get(c.id) === 'approved' ? i : -1).filter(i => i >= 0);
      state.requested = clubs.map((c, i) => memberMap.get(c.id) === 'pending' ? i : -1).filter(i => i >= 0);
      state.rejected = clubs.map((c, i) => memberMap.get(c.id) === 'rejected' ? i : -1).filter(i => i >= 0);
    } else {
      onlineMessage('دریافت وضعیت عضویت ناموفق بود؛ وضعیت قبلی حفظ شد. دوباره تازه‌سازی کنید.', true);
    }
    if (Array.isArray(eventRows)) {
      const attendedIds = new Set(eventRows.filter(e => e.status === 'confirmed' && e.attended_at).map(e=>e.event_id));
      state.registered = events.map((e, i) => eventIds.has(e.id) ? i : -1).filter(i => i >= 0);
      state.attended = events.map((e,i)=>attendedIds.has(e.id)?i:-1).filter(i=>i>=0);
    } else {
      onlineMessage('دریافت ثبت‌نام رویدادها ناموفق بود؛ اطلاعات قبلی حفظ شد.', true);
    }
    if (Array.isArray(historyRows)) {
      activityHistory = historyRows;
      eventTickets.clear();
      for (const r of historyRows)
        if (r.status === 'confirmed' && r.ticket_token) eventTickets.set(r.event_id, r.ticket_token);
    }
    if (Array.isArray(memberDetails)) activityMembers = memberDetails;
    else if (Array.isArray(memberRows)) activityMembers = memberRows.map(m => {
      const club = clubs.find(c => c.id === m.club_id);
      return { club_id: m.club_id, club_name: club?.title || 'کانون',
        university: club?.university || '', category: club?.category || '',
        is_active: Boolean(club), status: m.status };
    });
    if (Array.isArray(certificates)) activityCertificates = certificates;
    studentProfileReady = Boolean(profile &&
      /^[0-9]{6,20}$/.test(String(profile.student_number||'')) &&
      String(profile.full_name||'').trim().length>=2 && academic &&
      academic.birth_date && String(academic.university||'').trim().length>=2 &&
      String(academic.faculty||'').trim().length>=2 &&
      String(academic.major||'').trim().length>=2 &&
      /^09[0-9]{9}$/.test(String(academic.mobile||'')));
    state.name = profile ? profile.full_name : state.isManager ? 'مدیرکل کانون‌ها' : 'اطلاعات تکمیل نشده';
    state.number = profile ? profile.student_number : 'ثبت نشده';
    state.academic = academic;
    renderAll();
    onlineRenderAuth();
    window.KanonhaNotifications?.refresh?.();
    try{window.AndroidEventReminders?.sync?.(JSON.stringify(
      events.filter(e=>eventIds.has(e.id)&&e.startsAtMs>Date.now())
        .map(e=>({id:e.id,title:e.title,startsAt:e.startsAtMs}))
    ));}catch(_){}
    if (!profile && !state.isManager && outcomes[0].status === 'fulfilled')
      onlineMessage('برای درخواست عضویت، اطلاعات دانشجویی خود را تکمیل کنید.');
    return Array.isArray(memberRows);
  }
  const signupFieldIds = Object.freeze({
    name:'online-name',studentNumber:'online-student',nationalId:'online-national',
    mobile:'online-mobile',birthDate:'online-birth',university:'online-university',
    faculty:'online-faculty',major:'online-major',password:'online-password'
  });
  const normalizeRegistrationDigits = value => String(value||'').replace(/[۰-۹٠-٩]/g, c => {
    const fa='۰۱۲۳۴۵۶۷۸۹'.indexOf(c);
    return String(fa>=0?fa:'٠١٢٣٤٥٦٧٨٩'.indexOf(c));
  });
  function clearSignupFieldError(fieldName='') {
    if(typeof document.querySelectorAll==='function') {
      for(const note of document.querySelectorAll('.signup-inline-error')) {
        if(!fieldName||note.dataset.signupField===fieldName)note.remove?.();
      }
    }
    for(const [field,id] of Object.entries(signupFieldIds)) {
      if(fieldName&&field!==fieldName)continue;
      const input=$(id);
      if(input&&typeof input.removeAttribute==='function')input.removeAttribute('aria-invalid');
      if(input?.classList?.remove)input.classList.remove('signup-invalid-input');
    }
  }
  function showSignupFieldError(error) {
    const input=$(signupFieldIds[error?.field]);
    if(!input)return;
    const label=typeof input.closest==='function'?input.closest('label'):null;
    if(!label)return;
    input.setAttribute('aria-invalid','true');
    input.classList.add('signup-invalid-input');
    if(typeof document.createElement==='function') {
      const note=document.createElement('small');
      note.className='signup-inline-error';
      note.dataset.signupField=error.field;
      note.setAttribute('role','alert');
      note.textContent=String(error.message||'اطلاعات این فیلد را بررسی کنید.');
      label.appendChild(note);
    }
    const target=error.field==='birthDate'
      ? (label.querySelector?.('.jalali-select')||label) : input;
    if(typeof label.scrollIntoView==='function')
      label.scrollIntoView({behavior:'smooth',block:'center'});
    if(typeof target.focus==='function')target.focus();
  }
  async function onlineAuthenticate(form) {
    if (onlineWorking) return;
    onlineWorking = true;
    $('online-auth-submit').disabled = true;
    const status = $('online-auth-status');
    clearSignupFieldError();
    status.textContent = 'در حال بررسی حساب کاربری…';
    try {
      if (window.KanonhaJalali && !window.KanonhaJalali.validateForm(form)) {
        const err=new Error('لطفاً تاریخ را در تقویم شمسی کامل انتخاب کنید.');
        err.field='birthDate';
        throw err;
      }
      const values = new FormData(form);
      const password = String(values.get('password') || '');
      const student = onlineRole === 'student';
      if (onlineSignup) {
        if (student) {
          await onlineBackend.studentSignUp({
            name: String(values.get('name') || ''),
            studentNumber: String(values.get('studentNumber') || ''),
            nationalId: String(values.get('nationalId') || ''),
            birthDate: String(values.get('birthDate') || ''),
            mobile: String(values.get('mobile') || ''),
            university: String(values.get('university') || ''),
            faculty: String(values.get('faculty') || ''),
            major: String(values.get('major') || ''),
            password
          });
        } else {
          const result = await onlineBackend.managerSignUp(String(values.get('email') || ''),password);
          if (result.confirmationRequired) {
            onlineSignup = false; onlineRenderAuth();
            status.textContent = 'ایمیل تأیید مدیرکل ارسال شد. پس از تأیید مالکیت ایمیل وارد شوید.';
            return;
          }
        }
      } else if (student) {
        await onlineBackend.studentSignIn('auto',
          String(values.get('identifier') || ''),password);
      } else {
        await onlineBackend.signIn(String(values.get('email') || ''),password);
      }
      if (!student) {
        const allowed = await onlineBackend.isManager();
        if (!allowed) {
          await onlineBackend.signOut();
          throw new Error('حساب مدیرکل هنوز تأیید نشده یا دسترسی آن فعال نیست.');
        }
      }
      await finishOnlineSignIn(!student,form);
    } catch (error) {
      status.textContent = onlineError(error);
      if(onlineSignup && onlineRole==='student' && error?.field)
        showSignupFieldError(error);
    } finally { onlineWorking = false; $('online-auth-submit').disabled = false; }
  }
  function onlineRequireProfile() {
    if (!onlineBackend.currentUser) {
      go('profile');
      notify('برای ثبت اطلاعات ابتدا وارد حساب شوید.');
      return false;
    }
    if (!/^[0-9]{6,20}$/.test(state.number)) {
      go('profile');
      notify('ابتدا پرونده دانشجویی را تکمیل کنید.');
      action(state.isManager ? 'link-student' : 'edit');
      return false;
    }
    return true;
  }
  const clubMembershipWorking = new Set();
  async function onlineJoin(i) {
    if (!clubs[i] || !onlineRequireProfile()) return;
    if (state.joined.includes(i) || state.requested.includes(i)) { notify('این درخواست قبلاً ثبت شده است.'); return; }
    const clubId = clubs[i].id;
    if (clubMembershipWorking.has(clubId)) return;
    clubMembershipWorking.add(clubId);
    try {
      if (state.rejected.includes(i)) await onlineBackend.reapplyClub(clubs[i].id);
      else await onlineBackend.joinClub(clubs[i].id);
      const synced = await onlineRefreshPersonal();
      closeSheet();
      notify(synced ? 'درخواست عضویت ثبت شد و در انتظار تأیید است.' :
        'درخواست در سرور ثبت شد، اما دریافت وضعیت جدید ممکن نشد؛ بخش فعالیت‌های من را تازه‌سازی کنید.');
    } catch (error) {
      if (error?.status === 409) {
        try { await onlineRefreshPersonal(); } catch (_) {}
        notify('وضعیت عضویت تغییر کرده است؛ لطفاً دوباره بررسی کنید.');
      } else notify(onlineError(error));
    } finally { clubMembershipWorking.delete(clubId); }
  }
  async function onlineCancelMembership(i) {
    if (!onlineMode || !clubs[i] || !onlineRequireProfile()) return;
    if (!state.joined.includes(i) && !state.requested.includes(i)) return;
    const wasMember = state.joined.includes(i);
    const clubId = clubs[i].id;
    if (clubMembershipWorking.has(clubId)) return;
    clubMembershipWorking.add(clubId);
    try {
      await onlineBackend.cancelClubMembership(clubId);
      const synced = await onlineRefreshPersonal();
      closeSheet();
      notify(!synced ? 'لغو روی سرور ثبت شد؛ برای مشاهده وضعیت جدید تازه‌سازی کنید.' :
        wasMember ? 'عضویت شما در کانون پایان یافت.' : 'درخواست عضویت لغو شد.');
    } catch (error) { notify(onlineError(error)); }
    finally { clubMembershipWorking.delete(clubId); }
  }
  function confirmMembershipCancel(i) {
    if (!clubs[i]) return;
    const member = state.joined.includes(i);
    openSheet(member ? 'خروج از کانون' : 'لغو درخواست عضویت',
      '<p>آیا از ' + (member ? 'خروج از این کانون' : 'لغو درخواست عضویت') +
      ' مطمئن هستید؟</p><button type="button" class="pill-btn sheet-action" data-confirm-cancel="' +
      i + '">بله، تأیید می‌کنم</button>');
  }
  const eventRegistrationWorking = new Set();
  async function onlineRegister(i) {
    if (!events[i] || !onlineRequireProfile()) return;
    if (!studentProfileReady) {
      go('profile');
      notify('برای ثبت‌نام رویداد، تمام مشخصات فردی و تحصیلی از جمله تاریخ تولد و تلفن همراه باید تکمیل باشد.');
      action(state.isManager ? 'link-student' : 'edit');
      return;
    }
    const selected=events[i],eventId=selected.id;
    if (eventRegistrationWorking.has(eventId)) return;
    if (state.registered.includes(i)) { notify('قبلاً در این رویداد ثبت‌نام کرده‌اید.'); return; }
    if (!selected.registrationOpen || Number(selected.deadlineMs)<=Date.now()) {
      notify('مهلت ثبت‌نام این رویداد تمام شده است.'); return;
    }
    eventRegistrationWorking.add(eventId);
    try {
      if (!window.KanonhaBiometric?.confirmAction)
        throw new Error('ثبت نهایی نیازمند تأیید اثر انگشت یا چهره در نسخه اندروید است.');
      const userId=onlineBackend.currentUser?.id;
      await window.KanonhaBiometric.confirmAction('student-registration');
      if (!userId || onlineBackend.currentUser?.id!==userId || !studentProfileReady)
        throw new Error('نشست یا مشخصات کاربری تغییر کرده است؛ ثبت‌نام را دوباره انجام دهید.');
      await onlineBackend.registerEvent(eventId);
      await onlineRefreshPublic();
      await onlineRefreshPersonal();
      closeSheet();
      notify('ثبت‌نام قطعی شد و بلیت QR در فعالیت‌های من آماده است.');
    } catch (error) { notify(onlineError(error)); }
    finally {eventRegistrationWorking.delete(eventId);}
  }
  function findActivityClub(id){
    return activityMembers.find(m=>m.club_id===id);
  }
  function activityCancelClubPrompt(id){
    const row=findActivityClub(id);
    if(!onlineMode||!row||!['approved','pending'].includes(row.status))return;
    const member=row.status==='approved';
    openSheet(member?'لغو عضویت کانون':'لغو درخواست عضویت',
      '<p>آیا از '+(member?'خروج از این کانون':'لغو درخواست عضویت')+
      ' اطمینان دارید؟</p><button class="pill-btn sheet-action" type="button" data-activity-confirm-club-cancel="'+
      escapeHTML(id)+'">تأیید</button>');
  }
  async function activityCancelClub(id){
    const row=findActivityClub(id);
    if(!onlineMode||!row||!['approved','pending'].includes(row.status)||activityClubBusy.has(id))return;
    activityClubBusy.add(id);
    try{
      await onlineBackend.cancelClubMembership(id);
      await onlineRefreshPersonal();
      closeSheet();
      notify('وضعیت عضویت به‌روزرسانی شد.');
    }catch(error){notify(onlineError(error));}
    finally{activityClubBusy.delete(id);}
  }
  async function activityReapplyClub(id){
    const row=findActivityClub(id);
    if(!onlineMode||!row||row.status!=='rejected'||row.is_active===false||activityClubBusy.has(id))return;
    activityClubBusy.add(id);
    try{
      await onlineBackend.reapplyClub(id);
      await onlineRefreshPersonal();
      notify('درخواست مجدد ثبت شد و در انتظار تأیید دبیر است.');
    }catch(error){notify(onlineError(error));}
    finally{activityClubBusy.delete(id);}
  }

  async function onlineLogout({forgetBiometric=false}={}) {
    // Normal logout keeps opt-in biometric refresh token ONLY on this device,
    // encrypted behind a fresh prompt. Full logout revokes server refresh token.
    const biom=window.KanonhaBiometric;
    const currentId=onlineBackend.currentUser&&onlineBackend.currentUser.id;
    const preserve=Boolean(!forgetBiometric && biom && biom.ownedBy && biom.ownedBy(currentId));
    // Invalidate pending account-bound fetches before the logout network call.
    ++onlinePersonalSequence;
    ++onlinePublicSequence;
    if (window.KanonhaSecretaryPanel) window.KanonhaSecretaryPanel.clear();
    if (window.KanonhaAdminPanel) window.KanonhaAdminPanel.clear();
    window.KanonhaNotifications?.clear?.();
    managerUsersTab = 'students'; secretaryMembersTab = 'members';
    // Remove this account's device token before deleting its session.
    await window.KanonhaPush?.clear?.();
    try { await onlineBackend.signOut({preserveBiometric:preserve}); }
    catch (_) { /* local tokens still cleared by adapter */ }
    if(biom){
      if(forgetBiometric) biom.clear();
      else if(biom.lock) biom.lock();
    }
    eventTickets.clear();
    activityHistory=[];activityMembers=[];activityCertificates=[];
    window.KanonhaActivity?.clear?.();
    try{window.AndroidEventReminders?.clear?.();}catch(_){}
    state = defaultState();
    activePersona = 'student'; assignedSecretary = false; studentProfileReady = false;
    adminPanelReady = false; secretaryPanelReady = false;
    roleCapabilitiesChecked = false;
    onlineSignup=false;
    $('home-management').hidden = true;
    $('role-switcher').hidden = true;
    renderAll();
    onlineRenderAuth();
    closeSheet();
    go('profile');
    notify(preserve?'خارج شدید؛ برای ورود دوباره از اثر انگشت یا رمز استفاده کنید.':
      'از حساب خارج شدید.');
  }

  /* ——— One account, independently authorized personas ——— */
  function updateAvailablePersonas() {
    // Panels only become available after they complete their own server-verified refresh.
    const admin = window.KanonhaAdminPanel;
    const secretary = window.KanonhaSecretaryPanel;
    adminPanelReady = Boolean(state.isManager && (admin && typeof admin.hasAccess === 'function'
      ? admin.hasAccess() : !$('admin-panel').hidden));
    secretaryPanelReady = Boolean(secretary && typeof secretary.hasAssignments === 'function'
      ? secretary.hasAssignments() : !$('secretary-panel').hidden);
    assignedSecretary = secretaryPanelReady;
    roleCapabilitiesChecked = true;
    renderPersonaSelector();
  }
  function renderPersonaSelector() {
    if (!onlineMode) return;
    const signed = Boolean(onlineBackend.currentUser);
    const picker = $('role-switcher'), banner = $('home-management');
    if (!signed) { picker.hidden = true; banner.hidden = true; return; }
    const caps = {
      student: true,
      secretary: assignedSecretary && secretaryPanelReady,
      manager: state.isManager && adminPanelReady
    };
    if (!caps[activePersona] && roleCapabilitiesChecked)
      activePersona = caps.manager ? 'manager' : caps.secretary ? 'secretary' : 'student';
    for (const role of ['student','secretary','manager']) {
      const button = $('role-option-' + role);
      button.hidden = !caps[role];
      button.classList.toggle('active', activePersona === role);
      button.setAttribute('aria-pressed', activePersona === role ? 'true' : 'false');
      const workspaceButton = $('workspace-choice-' + role);
      if (workspaceButton) {
        workspaceButton.hidden = !caps[role];
        workspaceButton.classList.toggle('active',activePersona === role);
        workspaceButton.setAttribute('aria-pressed',activePersona === role ? 'true' : 'false');
      }
    }
    const roleCount = Object.values(caps).filter(Boolean).length;
    // One-role students see their normal home, not a giant role chooser.
    picker.hidden = roleCount <= 1;
    $('role-switcher-options').style.gridTemplateColumns = 'repeat(' + roleCount + ',minmax(0,1fr))';
    const needsProfile = activePersona === 'student' && state.isManager && !studentProfileReady;
    $('role-onboard-btn').hidden = !needsProfile;
    const descriptions = {
      student: needsProfile
        ? 'این همان حساب مدیرکل است. برای فعالیت دانشجویی فقط یک‌بار اطلاعات تحصیلی خود را ثبت کن.'
        : 'در این نقش می‌توانی به کانون‌ها بپیوندی و در رویدادها ثبت‌نام کنی.',
      secretary: 'مدیریت اعضا، رویدادها و حضور و غیابِ کانون‌هایی که دبیرشان هستی.',
      manager: 'اختیارات سراسری برای مدیریت کانون‌ها، دبیران، دانشجویان و رویدادها.'
    };
    $('role-switcher-description').textContent = descriptions[activePersona];
    const managerMode = activePersona === 'manager' && caps.manager;
    const secretaryMode = activePersona === 'secretary' && caps.secretary;
    banner.hidden = !managerMode && !secretaryMode;
    if (managerMode || secretaryMode) {
      $('home-management-overline').textContent = managerMode ? 'مدیریت سراسری فعال' : 'مدیریت کانون فعال';
      $('home-management-title').textContent = managerMode ? 'مدیریت کل کانون‌ها' : 'مدیریت کانون من';
      $('home-management-caption').textContent = managerMode
        ? 'کانون‌ها، دبیران، دانشجویان و رویدادها' : 'اعضا، درخواست‌ها، رویدادها و حضور و غیاب';
      $('home-management-btn').textContent = managerMode ? 'ورود به مدیریت کل' : 'ورود به مدیریت کانون';
    }
    // Selecting a persona changes what is presented, never server privileges.
    $('admin-panel').hidden = !managerMode;
    $('secretary-panel').hidden = !secretaryMode;
  }
  function refreshSecretaryWorkspace() {
    const ownerId = onlineBackend.currentUser?.id;
    const panel = window.KanonhaSecretaryPanel;
    if (!ownerId || !panel || typeof panel.refreshData !== 'function') return;
    void Promise.resolve().then(() => panel.refreshData()).then(() => {
      if (onlineBackend.currentUser?.id === ownerId && activePersona === 'secretary' &&
          activeScreen.startsWith('secretary-')) renderWorkspace();
    }).catch(error => notify(onlineError(error)));
  }
  function setPersona(role) {
    if (!onlineMode || !onlineBackend.currentUser) return;
    if (role === 'manager' && (!state.isManager || !adminPanelReady)) return;
    if (role === 'secretary' && (!assignedSecretary || !secretaryPanelReady)) return;
    if (!['manager','secretary','student'].includes(role)) return;
    activePersona = role;
    $('workspace-role-menu').hidden = true;
    $('workspace-change-role').setAttribute('aria-expanded','false');
    renderPersonaSelector();
    updateProfileDisplay();
    go(personaHome());
    if (role === 'secretary') refreshSecretaryWorkspace();
    if (role === 'student' && state.isManager && !studentProfileReady) {
      action('link-student');
    }
  }
  async function reloadPersonas() {
    if (!onlineMode || !onlineBackend.currentUser) return;
    const userId = onlineBackend.currentUser.id;
    $('role-refresh').disabled = true;
    try {
      // The modules each recheck their own authorized server-side roles.
      if (window.KanonhaSecretaryPanel) await window.KanonhaSecretaryPanel.refresh();
      if (window.KanonhaAdminPanel) await window.KanonhaAdminPanel.refresh();
      if (!onlineBackend.currentUser || onlineBackend.currentUser.id !== userId) return;
      updateAvailablePersonas();
      updateProfileDisplay();
      if (!routeNavItems().some(x => x.id === activeScreen)) go(personaHome());
      else if (activeScreen.startsWith('manager-') || activeScreen.startsWith('secretary-'))
        renderWorkspace();
      renderNav();
      notify('دسترسی‌های حساب بررسی و به‌روزرسانی شد.');
    } catch (error) { notify(onlineError(error)); }
    finally { $('role-refresh').disabled = false; }
  }

  /* ——— Role-specific dashboards and five independent navigation routes ——— */
  function renderWorkspace() {
    if (!onlineMode || !onlineBackend.currentUser) return;
    const manager = activePersona === 'manager' && adminPanelReady;
    const secretary = activePersona === 'secretary' && secretaryPanelReady;
    const workspace = $('screen-workspace');
    if (!workspace) return;
    workspace.dataset.persona = manager ? 'manager' : secretary ? 'secretary' : 'student';
    const titles = {
      'manager-home': ['داشبورد مدیرکل','آمار زنده و کنترل تمام کانون‌ها','مدیریت سراسری'],
      'manager-clubs': ['مدیریت کانون‌ها','ایجاد، ویرایش و فعال‌سازی کانون‌ها','مدیرکل'],
      'manager-users': ['کاربران و دبیران','مدیریت دانشجویان، انتصاب دبیر و درخواست‌ها','مدیرکل'],
      'manager-events': ['رویدادهای سامانه','ایجاد و کنترل رویدادهای تمامی کانون‌ها','مدیرکل'],
      'secretary-home': ['خانه کانون من','نمای کلی و دسترسی سریع به ابزارهای دبیر','دبیر کانون'],
      'secretary-club': ['مدیریت کانون','مشخصات و اطلاعات کانون تحت مسئولیت','دبیر کانون'],
      'secretary-events': ['رویدادهای کانون','ساخت، انتشار و ویرایش برنامه‌های کانون','دبیر کانون'],
      'secretary-members': ['اعضا و حضور و غیاب','بررسی درخواست‌ها و ثبت حضور دانشجویان','دبیر کانون']
    };
    const info = titles[activeScreen] || ['محیط اختصاصی','ابزارهای متناسب با مسئولیت شما','حساب کانون‌ها'];
    $('workspace-title').textContent = info[0];
    $('workspace-caption').textContent = info[1];
    $('workspace-overline').textContent = info[2];
    $('workspace-current-role').textContent = manager ? 'مدیرکل' : secretary ? 'دبیر کانون' : 'دانشجو';
    const secretaryHome = secretary && activeScreen === 'secretary-home';
    $('workspace-secretary-summary').hidden = !secretaryHome;
    const subnav = $('workspace-subnav');
    const usersRoute = manager && activeScreen === 'manager-users';
    const membersRoute = secretary && activeScreen === 'secretary-members';
    subnav.hidden = !usersRoute && !membersRoute;
    for (const name of ['students','secretaries','members','attendance','universities']) {
      const button = $('workspace-subtab-' + name);
      if (!button) continue;
      button.hidden = usersRoute ? name === 'attendance' :
        membersRoute ? !['members','attendance'].includes(name) : true;
      const tab = usersRoute ? managerUsersTab : secretaryMembersTab;
      button.classList.toggle('active',tab === name);
      button.setAttribute('aria-pressed',tab === name ? 'true' : 'false');
    }
    $('workspace-subtab-members').textContent = membersRoute ? 'اعضا و درخواست‌ها' : 'درخواست‌ها';
    if (secretaryHome) {
      const summary = window.KanonhaSecretaryPanel &&
        typeof window.KanonhaSecretaryPanel.summary === 'function'
        ? window.KanonhaSecretaryPanel.summary() : null;
      $('workspace-secretary-club').textContent = summary?.club || 'کانون تحت مدیریت';
      for (const name of ['clubs','members','events'])
        $('workspace-secretary-' + name).textContent =
          Number(summary?.[name] || 0).toLocaleString('fa-IR');
    }
    $('admin-panel').hidden = !manager;
    $('secretary-panel').hidden = !secretary || secretaryHome;
    if (manager && window.KanonhaAdminPanel?.showTab) {
      const mapped = activeScreen === 'manager-home' ? 'dashboard' :
        activeScreen === 'manager-clubs' ? 'clubs' :
        activeScreen === 'manager-users' ? managerUsersTab : 'events';
      window.KanonhaAdminPanel.showTab(mapped);
    }
    if (secretary && !secretaryHome && window.KanonhaSecretaryPanel?.showTab) {
      const mapped = activeScreen === 'secretary-club' ? 'club' :
        activeScreen === 'secretary-events' ? 'events' : secretaryMembersTab;
      window.KanonhaSecretaryPanel.showTab(mapped);
    }
  }

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
    if (!routeNavItems().some(x => x.id === screen) && !(screen === 'club-detail' && clubDetailKey)) return;
    const previousScreen = activeScreen;
    activeScreen = screen;
    const container = screen.endsWith('-account') ? 'profile' :
      screen.startsWith('manager-') || screen.startsWith('secretary-') ? 'workspace' : screen;
    document.querySelectorAll('.screen').forEach(el => {
      el.hidden = el.dataset.screen !== container;
    });
    if (container === 'workspace') renderWorkspace();
    if (screen === 'secretary-members' && previousScreen !== screen) refreshSecretaryWorkspace();
    if (container === 'profile') updateProfileDisplay();
    if (screen === 'ratings' && window.KanonhaRatings) void window.KanonhaRatings.open();
    renderNav();
    if (screen === 'activity') {
      renderActivity();
      // Fetch new attendance/certificates whenever the student re-enters this screen.
      if (previousScreen !== 'activity' && onlineMode && onlineBackend.currentUser) {
        void onlineRefreshPersonal().catch(error => {
          if (activeScreen === 'activity' && onlineBackend.currentUser)
            onlineMessage('به‌روزرسانی فعالیت‌ها ناموفق بود: ' + onlineError(error), true);
        });
      }
    }
    if (screen === 'club-detail') renderClubDetail();
    if (scroll) $('main').scrollTop = 0;
    try { history.replaceState(null, '', `#${screen}`); } catch (_) {}
  }

  function renderNav() {
    $('bottom-nav').innerHTML = routeNavItems().map(x =>
      `<button type="button" data-screen-btn="${x.id}"
        class="${x.id === activeScreen || (x.id==='clubs' && activeScreen==='club-detail') ? 'active' : ''}"
        ${x.id === activeScreen ? 'aria-current="page"' : ''}>
        <img class="nav-art" src="assets/nav-${x.art || x.id}.svg" alt="" width="34" height="34"><span>${x.label}</span>
      </button>`
    ).join('');
  }

  /* Event registration window is a live countdown, not a static date label. */
  function eventTimeRemaining(epoch){
    const left=Number(epoch)-Date.now();
    if(!Number.isFinite(left))return 'نامشخص';
    if(left<=0)return 'مهلت ثبت‌نام تمام شد';
    const min=Math.ceil(left/60000),days=Math.floor(min/1440),
      hours=Math.floor(min%1440/60),minutes=min%60;
    const fa=n=>n.toLocaleString('fa-IR');
    if(days)return fa(days)+' روز و '+fa(hours)+' ساعت';
    if(hours)return fa(hours)+' ساعت و '+fa(minutes)+' دقیقه';
    return fa(minutes)+' دقیقه';
  }
  function deadlineMarkup(ev){
    if(!onlineMode||!Number.isFinite(ev.deadlineMs))return '';
    return '<div class="event-meta event-deadline"><span>زمان باقی‌مانده ثبت‌نام: <strong data-event-deadline="'+
      ev.deadlineMs+'">'+escapeHTML(eventTimeRemaining(ev.deadlineMs))+'</strong></span></div>';
  }
  function refreshEventCountdowns(){
    for(const node of document.querySelectorAll('[data-event-deadline]')){
      const epoch=Number(node.dataset.eventDeadline);
      node.textContent=eventTimeRemaining(epoch);
      if(epoch<=Date.now()){
        node.classList.add('expired');
        const card=node.closest('[data-event-card]');
        if(card){const btn=card.querySelector('[data-register]');
          if(btn){btn.disabled=true;btn.removeAttribute('data-register');btn.textContent='ثبت‌نام بسته است';}}
      }
    }
  }
  if(typeof window.setInterval==='function')window.setInterval(refreshEventCountdowns,30000);

  /* ——— Event card ——— */
  function eventCard(event, index, { compact = false } = {}) {
    const registered = state.registered.includes(index);
    return `<article class="card event-card${compact ? ' compact' : ''}" data-event-card="${index}">
      <img class="event-poster" src="${escapeHTML(event.posterUrl || "assets/"+event.poster)}" alt="پوستر ${escapeHTML(event.title)}" width="88" height="${compact ? 88 : 120}" loading="lazy">
      <div class="event-info">
        <h3>${escapeHTML(event.title)}</h3>
        <div class="event-meta">${svg('calendar', 13)}<span>${escapeHTML(event.date)}</span></div>
        ${deadlineMarkup(event)}
        ${compact ? '' : `<div class="event-meta">${svg('map-pin', 13)}<span>${escapeHTML(event.location)}</span></div>
        <div class="capacity">${onlineMode ? 'ظرفیت باقی‌مانده' : 'ظرفیت نمونه'}: <strong>${event.capacity} نفر</strong></div>`}
      </div>
      <button type="button"
        class="pill-btn ${compact ? 'view-btn' : registered ? 'signed' : ''}"
        ${onlineMode && !compact && (registered || !event.registrationOpen) ? 'disabled' : `data-${compact ? 'details' : 'register'}="${index}"`}
        aria-label="${compact ? 'مشاهده' : 'ثبت‌نام'} ${escapeHTML(event.title)}">
        ${compact ? 'مشاهده' : registered ? 'ثبت‌نام‌شده' : onlineMode && !event.registrationOpen ? 'ثبت‌نام بسته است' : 'ثبت‌نام'}
      </button>
    </article>`;
  }

  /* ——— Club cards and verified detail ——— */
  let clubDetailKey = '';
  function clubImageSrc(club) {
    const icon = club.icon === 'book' ? 'book' : club.icon === 'code' ? 'tech' :
      club.icon === 'leaf' ? 'leaf' : club.icon === 'flask' ? 'science' : 'sport';
    const custom = onlineMode && typeof onlineBackend.clubLogoUrl === 'function' && onlineBackend.clubLogoUrl(club.id,club.logoPath);
    return custom || 'assets/club-' + icon + '.svg';
  }
  function clubCard(club,index) {
    const member = state.joined.includes(index);
    const pending = state.requested.includes(index);
    const rejected = state.rejected.includes(index);
    const isViewOnly = !onlineMode && (index === 0 || index === 3);
    const label = member ? 'عضو هستید' : pending ? 'در انتظار تأیید' :
      rejected ? 'درخواست مجدد' : isViewOnly ? 'مشاهده' : 'عضویت';
    const attr = rejected ? 'data-reapply="' + index + '"' :
      member || pending || isViewOnly ? 'data-club-details="' + index + '"' :
      'data-join="' + index + '"';
    return `<article class="card club-card">
      <button type="button" class="club-card-open" data-club-details="${index}" aria-label="مشاهده ${escapeHTML(club.title)}">
        <span class="club-icon"><img class="club-art" src="${escapeHTML(clubImageSrc(club))}" alt="" width="76" height="76" loading="lazy"></span>
        <strong class="club-card-name">${escapeHTML(club.title)}</strong>
        <span class="club-card-category">${escapeHTML(club.category || 'کانون دانشجویی')}</span>
        <span class="club-card-scope">${escapeHTML(club.university || 'دانشگاه نامشخص')}</span>
      </button>
      <button type="button" class="pill-btn club-join-btn ${member?'joined':pending?'signed':''}" ${attr}>${label}</button>
    </article>`;
  }

  /* ——— Render functions ——— */
  function homeCarouselCard(event,index){
    return `<article class="home-event-slide" role="group" aria-label="${escapeHTML(event.title)}">
      <div class="home-slide-cover">
        <img src="${escapeHTML(event.posterUrl || "assets/"+event.poster)}" alt="پوستر ${escapeHTML(event.title)}" width="244" height="119" loading="lazy">
        <span class="home-slide-status"><span class="home-slide-pulse" aria-hidden="true"></span> ${onlineMode ? 'ثبت‌نام باز' : 'ثبت‌نام آزمایشی'}</span>
      </div>
      <div class="home-slide-info">
        <h3>${escapeHTML(event.title)}</h3>
        <span class="home-slide-date">${svg('calendar',13)}${escapeHTML(event.date)}</span>
        ${deadlineMarkup(event)}
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
    // Online content uses published server records; offline fixtures are clearly labeled.
    const found=events.map((event,index)=>[event,index]).filter(([event])=>event.registrationOpen===true&&event.capacity>0&&(!query||event.title.includes(query)));
    $('home-events').innerHTML=found.length?found.map(([event,index])=>homeCarouselCard(event,index)).join(''):'<div class="home-carousel-empty" role="status">رویداد دارای ثبت‌نام فعال پیدا نشد.</div>';
    $('home-events').scrollLeft=0;updateHomeCarouselControls();
    refreshEventCountdowns();
    const foundClubs=(onlineMode ? clubs.map((_, i) => i) : [0,2,3]).filter(i=>!query||clubs[i].title.includes(query)||clubs[i].desc.includes(query));
    $('home-clubs').innerHTML=foundClubs.length?foundClubs.map(i=>
      `<button type="button" class="home-mini-club" data-club-details="${i}">
      <span class="mini-club-icon ${clubs[i].tone==='green'?'green':clubs[i].tone==='mint'?'mint':clubs[i].tone==='orange'?'orange':''}"><img class="mini-art" src="${escapeHTML(clubImageSrc(clubs[i]))}" alt="" width="57" height="57"></span>
      ${escapeHTML(clubs[i].short)}</button>`).join(''):'<div class="empty">کانونی یافت نشد.</div>';
  }

  function renderClubs() {
    const unique = values => [...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fa'));
    const choose = (id,values,placeholder) => {
      const select = $(id);
      if (!select) return '';
      const current = select.value;
      select.innerHTML = '<option value="">'+placeholder+'</option>'+values.map(value =>
        '<option value="'+escapeHTML(value)+'">'+escapeHTML(value)+'</option>').join('');
      select.value = values.includes(current) ? current : '';
      return select.value;
    };
    const q = $('clubs-search').value.trim();
    const uni = choose('clubs-university',unique(clubs.map(c=>c.university)),'همه دانشگاه‌ها');
    const faculty = choose('clubs-faculty',unique(clubs.filter(c=>!uni||c.university===uni).map(c=>c.faculty)),'همه دانشکده‌ها');
    const category = choose('clubs-category',unique(clubs.map(c=>c.category)),'همه دسته‌ها');
    const found = clubs.map((c,i)=>[c,i]).filter(([c]) =>
      (!q || c.title.includes(q) || c.desc.includes(q)) &&
      (!uni || c.university===uni) &&
      (!faculty || c.faculty===faculty) &&
      (!category || c.category===category));
    $('clubs-list').innerHTML = found.length ? found.map(([c,i])=>clubCard(c,i)).join('') :
      '<div class="no-results">کانونی با این فیلتر پیدا نشد.</div>';
  }

  function renderEvents() {
    const filterOptions=onlineMode?['همه',...new Set(events.map(e=>e.category))]:['همه','کارگاه','نشست','مسابقه'];
    if(!filterOptions.includes(activeFilter))activeFilter='همه';
    $('event-filters').innerHTML = filterOptions.map(type =>
      `<button type="button" class="filter-btn${type === activeFilter ? ' active' : ''}" data-filter="${type}" aria-pressed="${type === activeFilter}">${type}</button>`
    ).join('');
    const found = events.map((ev, i) => [ev, i]).filter(([ev]) => activeFilter === 'همه' || ev.category === activeFilter);
    $('events-list').innerHTML = found.length
      ? found.map(([ev, i]) => eventCard(ev, i)).join('')
      : '<div class="no-results">رویدادی پیدا نشد.</div>';
    refreshEventCountdowns();
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
    if (window.KanonhaActivity) window.KanonhaActivity.render({clubs,events,state,onlineMode,eventTickets,
      historyRows:activityHistory,memberDetails:activityMembers,certificates:activityCertificates,
      studentName:state.name,studentNumber:state.number});
  }

  /* ——— Sheet ——— */
  let focusBeforeSheet = null;
  function openSheet(title, html) {
    focusBeforeSheet = document.activeElement;
    $('sheet-title').textContent = title;
    $('sheet-content').innerHTML = html;
    if (window.KanonhaJalali) window.KanonhaJalali.enhance($('sheet-content'));
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
    if (activeScreen === 'club-detail') { go('clubs'); return true; }
    if (activeScreen !== personaHome()) { go(personaHome()); return true; }
    return false;
  }

  /* ——— Detail sheets ——— */
  function eventDetails(i) {
    const ev = events[i];
    if (!ev) return;
    openSheet(ev.title,
      `<p>${svg('calendar', 15)} ${escapeHTML(ev.date)}<br>${svg('map-pin', 15)} ${escapeHTML(ev.location)}<br>
       کانون برگزارکننده: ${clubs[ev.club] ? escapeHTML(clubs[ev.club].title) : 'نامشخص'}</p>
       <p>${escapeHTML(ev.description||'')}</p>
       ${deadlineMarkup(ev)}
       <p>${onlineMode ? 'ثبت‌نام قطعی پس از تکمیل مشخصات و تأیید اثر انگشت یا چهره انجام می‌شود.' : 'این یک رویداد نمونه رابط کاربری است. ثبت‌نام واقعی انجام نمی‌شود.'}</p>
       <button class="pill-btn sheet-action" type="button" ${onlineMode && (!ev.registrationOpen || state.registered.includes(i)) ? "disabled" : `data-register="${i}"`}>
         ${state.registered.includes(i) ? 'ثبت‌نام‌شده' : onlineMode ? (ev.registrationOpen ? 'ثبت‌نام آنلاین' : 'ثبت‌نام بسته است') : 'ثبت‌نام نمایشی'}
       </button>`
    );
  }

  function renderClubDetail() {
    const i = clubs.findIndex(c => (c.id || String(clubs.indexOf(c))) === clubDetailKey);
    const club = clubs[i], root = $('club-detail-content');
    if (!root) return;
    if (!club) { root.innerHTML = '<p class="empty">اطلاعات کانون در دسترس نیست.</p>'; return; }
    const member = state.joined.includes(i);
    const pending = state.requested.includes(i);
    const rejected = state.rejected.includes(i);
    const related = events.map((e,index)=>[e,index]).filter(([e])=>e.club===i).slice(0,8);
    const button = member || pending ?
      `<button class="pill-btn club-leave" type="button" data-cancel-membership="${i}">${member?'خروج از کانون':'لغو درخواست عضویت'}</button>` :
      `<button class="pill-btn" type="button" ${rejected?'data-reapply':'data-join'}="${i}">${rejected?'درخواست مجدد عضویت':'درخواست عضویت'}</button>`;
    root.innerHTML = `<div class="club-detail-hero">
      <img src="${escapeHTML(clubImageSrc(club))}" alt="" class="club-detail-logo">
      <h1>${escapeHTML(club.title)}</h1>
      <span>${escapeHTML(club.category||'کانون دانشجویی')}</span>
      <p>${escapeHTML(club.university||'دانشگاه ثبت نشده')}${club.faculty?' · '+escapeHTML(club.faculty):''}</p>
    </div>
    <section class="club-detail-section"><h2>درباره کانون</h2><p>${escapeHTML(club.desc||'هنوز توضیحی ثبت نشده است.')}</p>
    <div class="club-detail-action">${button}</div>
    ${pending?'<p class="club-detail-status">درخواست شما منتظر تأیید دبیر است.</p>':''}
    </section>
    <section class="club-detail-section"><h2>رویدادهای کانون</h2>
    ${related.length?related.map(([event,j])=>`<button type="button" class="activity-row" data-details="${j}"><span class="activity-copy">${escapeHTML(event.title)}<small>${escapeHTML(event.date)}</small></span><span>‹</span></button>`).join(''):'<p class="empty">فعلاً رویدادی برای این کانون ثبت نشده است.</p>'}
    </section>`;
  }
  function clubDetails(i) {
    const club=clubs[i];
    if (!club) return;
    clubDetailKey=club.id || String(i);
    renderClubDetail();
    go('club-detail');
  }

  /* ——— Actions ——— */
  function join(i) {
    if (onlineMode) { void onlineJoin(i); return; }
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
    if (onlineMode) { void onlineRegister(i); return; }
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
    if (name === 'link-student' && onlineMode && state.isManager) {
      if (studentProfileReady) { notify('پرونده دانشجویی این حساب از قبل تکمیل شده است.'); return; }
      openSheet('تکمیل هویت دانشجویی مدیرکل',
        `<p class="secretary-card-p">پرونده زیر به حساب مدیریتی فعلی متصل می‌شود؛ حساب یا رمز دوم ساخته نخواهد شد.</p>
        <form id="manager-student-form" class="secretary-form">
          <label class="field">نام و نام خانوادگی<input name="full_name" maxlength="80" autocomplete="name" required></label>
          <label class="field">شماره دانشجویی<input name="student_number" inputmode="numeric" pattern="[0-9]{6,20}" maxlength="20" required></label>
          <label class="field">کد ملی<input name="national_id" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" required></label>
          <label class="field">تاریخ تولد شمسی<input name="birth_date" type="date" required></label>
          <label class="field">شماره موبایل (بدون پیامک تأیید)<input name="mobile" inputmode="tel" pattern="09[0-9]{9}" maxlength="11" required></label>
          <label class="field">دانشگاه<select name="university" data-academic-select="university" required>
            ${academyUniversityOptions()}</select></label>
          <label class="field">دانشکده<select name="faculty" data-academic-select="faculty" required>
            ${academyFacultyOptions('')}</select></label>
          <label class="field">رشته تحصیلی<input name="major" maxlength="120" required></label>
          <p class="field-hint">شماره دانشجویی و کد ملی یکتا خواهند بود. کد ملی فقط به‌شکل اثرانگشت رمزنگاری‌شده در سرور ثبت می‌شود.</p>
          <button class="pill-btn sheet-action" type="submit">ثبت و اتصال به همین حساب</button>
        </form>`
      );
      return;
    }
    if (name === 'edit') {
      if (onlineMode && state.isManager && !studentProfileReady) { action('link-student'); return; }
      if (onlineMode && state.isManager && activePersona === 'manager') { notify('برای ویرایش اطلاعات دانشجویی، ابتدا نقش دانشجو را انتخاب کنید.'); return; }
      openSheet('ویرایش اطلاعات',
        `<form id="edit-form">
          <label class="field">نام و نام خانوادگی
            <input name="name" autocomplete="name" maxlength="60" required value="${escapeHTML(state.name)}">
          </label>
          <label class="field">شماره دانشجویی
            <input name="number" maxlength="20" required value="${escapeHTML(state.number)}" ${onlineMode ? 'readonly' : ''}>
          </label>
          ${onlineMode ? `<label class="field">دانشگاه<select name="university" data-academic-select="university" required>
           ${academyUniversityOptions(state.academic?.university||'')}</select></label>
          <label class="field">دانشکده<select name="faculty" data-academic-select="faculty" required>
           ${academyFacultyOptions(state.academic?.university||'',state.academic?.faculty||'')}</select></label>
          <label class="field">رشته تحصیلی<input name="major" maxlength="120" required value="${escapeHTML(state.academic?.major || '')}"></label>
          <label class="field">شماره موبایل<input name="mobile" inputmode="tel" maxlength="11" required value="${escapeHTML(state.academic?.mobile || '')}"></label>` : ''}
          <button type="submit" class="pill-btn sheet-action">${onlineMode ? 'ذخیره اطلاعات دانشجو' : 'ذخیره نمایشی'}</button>
        </form>`
      );
    } else if (name === 'requests') {
      openSheet('درخواست‌های عضویت',
        `<p>${onlineMode ? 'درخواست‌های شما در صفحه فعالیت‌های من نمایش داده می‌شوند.' : 'این نمونه رابط کاربری است. وضعیت عضویت نمونه در قسمت «فعالیت‌های من» قابل مشاهده است.'}</p>
         <button class="pill-btn sheet-action" type="button" data-goto="activity">فعالیت‌های من</button>`
      );
    } else if (name === 'about') {
      openSheet('درباره برنامه',
        `<p>کانون‌ها — ${onlineMode ? 'نسخه ۰.۹.۲۱ آزمایشی، رویدادها و بلیت QR' : 'نسخه نمایشی آفلاین'}</p>
         <p>${onlineMode ? 'ثبت‌نام، بلیت QR و تأیید رویداد به سرور مستقل متصل‌اند؛ اعلان رویدادها محلی است و تأیید رسمی شماره دانشجویی هنوز فعال نیست.' : 'شش بخش با HTML، CSS و JavaScript در حالت نمایشی پیاده‌سازی شده‌اند. هیچ رأی آزمایشی به سرور ارسال نمی‌شود.'}</p>
         ${onlineMode ? '' : '<button type="button" data-action="reset" class="pill-btn soft">بازنشانی داده‌های نمایشی</button>'}`
      );
    } else if (name === 'exit') {
      openSheet('خروج از حساب',
        onlineMode
          ? '<p>آیا از حساب کاربری خارج می‌شوید؟</p><p class="field-hint">اگر ورود با اثر انگشت را فعال کرده‌اید، برای ورود دوباره روی همین دستگاه محفوظ می‌ماند.</p>'+
            '<button class="pill-btn sheet-action" type="button" data-action="confirm-exit">خروج از حساب (حفظ اثر انگشت)</button>'+
            '<button class="auth-return-student" type="button" data-action="secure-exit">خروج کامل و حذف ورود اثرانگشتی</button>'
          : '<p>در نسخه نمایشی، حساب کاربری واقعی وجود ندارد. بنابراین خروج واقعی فعال نیست.</p>'
      );
    } else if (name === 'confirm-exit' && onlineMode) {
      void onlineLogout();
    } else if (name === 'secure-exit' && onlineMode) {
      void onlineLogout({forgetBiometric:true});
    } else if (name === 'reset' && !onlineMode) {
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
    if (activeScreen === 'club-detail') renderClubDetail();
    renderEvents();
    renderActivity();
    updateProfileDisplay();
    renderPersonaSelector();
    if (activeScreen.startsWith('manager-') || activeScreen.startsWith('secretary-'))
      renderWorkspace();
  }

  function updateProfileDisplay() {
    const nameEl = $('profile-name');
    const numEl = $('profile-number');
    if ($('title-profile')) $('title-profile').textContent = activePersona === 'manager'
      ? 'حساب مدیرکل' : activePersona === 'secretary' ? 'حساب دبیر کانون' : 'حساب کاربری';
    if (nameEl) nameEl.textContent = state.isManager && activePersona === 'manager' ? 'مدیرکل کانون‌ها' : state.name;
    if (numEl) numEl.textContent = `شماره دانشجویی: ${state.number}`;
    if (onlineMode) {
      const requests = typeof document.querySelector === 'function'
        ? document.querySelector('[data-action="requests"]') : null;
      if (requests) requests.hidden = activePersona === 'manager';
      onlineRenderAuth();
      $('profile-service-note').textContent = state.isManager && activePersona === 'manager'
        ? 'دسترسی مدیرکل؛ مدیریت همه کانون‌ها، دبیران و رویدادها.'
        : state.academic ? 'دانشگاه: '+state.academic.university+' | دانشکده: '+state.academic.faculty+' | رشته: '+state.academic.major
          : 'اطلاعات تحصیلی هنوز ثبت نشده است.';
    }
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
    for (const id of ['clubs-university','clubs-faculty','clubs-category']) { const filter=$(id); if(filter)filter.addEventListener('change',renderClubs); }
    if (window.KanonhaJalali) window.KanonhaJalali.enhance(document);
    if (onlineMode) {
      $('online-events-heading').textContent = 'رویدادهای در حال ثبت‌نام';
      onlineRenderAuth();
      $('online-auth-toggle').addEventListener('click', () => {
        onlineSignup = !onlineSignup;
        $('online-auth-status').textContent = '';
        onlineRenderAuth();
        if(onlineSignup && onlineRole==='student')void refreshAcademicDirectory();
      });
      // Accept فارسی/عربی numeric keyboards; normalize before HTML patterns.
      for(const [id,field] of [['online-student','studentNumber'],
        ['online-national','nationalId'],['online-mobile','mobile']]) {
        $(id).addEventListener('input',e=>{
          const normalized=normalizeRegistrationDigits(e.target.value);
          if(normalized!==e.target.value)e.target.value=normalized;
          clearSignupFieldError(field);
        });
      }
      for(const [id,field] of [['online-name','name'],['online-major','major'],
        ['online-password','password']]) {
        $(id).addEventListener('input',()=>clearSignupFieldError(field));
      }
      $('online-university').addEventListener('change',()=>{
        updateSignupFaculty();
        clearSignupFieldError('university');
        clearSignupFieldError('faculty');
      });
      $('online-faculty').addEventListener('change',()=>clearSignupFieldError('faculty'));
      $('biometric-login-btn').addEventListener('click',()=>{
        if(!window.KanonhaBiometric || !window.KanonhaBiometric.unlock())
          $('online-auth-status').textContent='اثر انگشت هنوز فعال نیست؛ با رمز وارد شوید و از حساب کاربری فعال کنید.';
      });
      $('biometric-enable-btn').addEventListener('click',()=>{
        const b=window.KanonhaBiometric;
        if(!b||!onlineBackend.currentUser)return;
        const uid=onlineBackend.currentUser.id;
        if(b.ownedBy(uid)){b.clear();updateBiometricUI();return;}
        const token=onlineBackend.biometricRefreshToken();
        if(!b.enroll(token,uid))notify('ورود اثرانگشتی در دستگاه فعال نیست.');
      });
      setupBiometric();
      // Manager access remains absent from public signup. Seven taps on
      // the visible "ورود" heading open its login. Authorization remains server-side.
      $('online-auth-title').addEventListener('click', () => {
        if (onlineBackend.currentUser || onlineSignup || onlineRole !== 'student') return;
        const now = Date.now();
        managerEntryTaps = now - managerEntryLastTap > 9000 ? 1 : managerEntryTaps + 1;
        managerEntryLastTap = now;
        if (managerEntryTaps < 7) return;
        managerEntryTaps = 0;
        onlineRole = 'manager'; onlineSignup = false;
        $('online-auth-status').textContent = '';
        onlineRenderAuth();
      });
      $('auth-back-student').addEventListener('click', () => {
        onlineRole = 'student'; onlineSignup = false;
        $('online-auth-status').textContent = '';
        onlineRenderAuth();
      });
    }

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
      if (btn.dataset.authRole && onlineMode) {
        onlineRole = btn.dataset.authRole === 'manager' ? 'manager' : 'student';
        onlineSignup = false;
        $('online-auth-status').textContent = '';
        onlineRenderAuth(); return;
      }
      if (btn.dataset.roleSwitch && onlineMode) { setPersona(btn.dataset.roleSwitch); return; }
      if (btn.id === 'role-refresh' && onlineMode) { void reloadPersonas(); return; }
      if (btn.id === 'role-onboard-btn' && onlineMode) { action('link-student'); return; }
      if (btn.id === 'workspace-change-role' && onlineMode) {
        const open = $('workspace-role-menu').hidden;
        $('workspace-role-menu').hidden = !open;
        btn.setAttribute('aria-expanded',open ? 'true' : 'false');
        return;
      }
      if (btn.dataset.workspaceRoute && onlineMode) { go(btn.dataset.workspaceRoute); return; }
      if (btn.dataset.workspaceSubtab && onlineMode) {
        const value = btn.dataset.workspaceSubtab;
        if (activePersona === 'manager' && activeScreen === 'manager-users' &&
            ['students','secretaries','members','universities'].includes(value)) managerUsersTab = value;
        else if (activePersona === 'secretary' && activeScreen === 'secretary-members' &&
            ['members','attendance'].includes(value)) secretaryMembersTab = value;
        else return;
        renderWorkspace(); return;
      }
      if (btn.id === 'home-management-btn' && onlineMode) {
        go(activePersona === 'manager' ? 'manager-home' : activePersona === 'secretary' ? 'secretary-club' : 'profile');
        return;
      }
      if (btn.dataset.carousel) { moveHomeCarousel(btn.dataset.carousel==='next'?1:-1); return; }
      if (btn.id === 'activity-refresh' && onlineMode) {
        if(btn.disabled)return;
        btn.disabled=true;btn.textContent='در حال دریافت…';
        void onlineRefreshPublic().then(ok=>notify(ok?'فعالیت‌های شما به‌روزرسانی شد.':'دریافت اطلاعات ناموفق بود.'))
          .catch(error=>notify(onlineError(error)))
          .finally(()=>{btn.disabled=false;btn.textContent='به‌روزرسانی';});
        return;
      }
      if (btn.dataset.activityFilterClub && window.KanonhaActivity) {
        window.KanonhaActivity.setFilter('club',btn.dataset.activityFilterClub);return;
      }
      if (btn.dataset.activityFilterEvent && window.KanonhaActivity) {
        window.KanonhaActivity.setFilter('event',btn.dataset.activityFilterEvent);return;
      }
      if (btn.dataset.screenBtn)      { go(btn.dataset.screenBtn); return; }
      if (btn.dataset.goto)           { closeSheet(); go(btn.dataset.goto); return; }
      if (btn.dataset.filter)         { activeFilter = btn.dataset.filter; renderEvents(); return; }
      if (btn.dataset.join !== undefined)        { join(Number(btn.dataset.join)); return; }
      if (btn.dataset.reapply !== undefined)     { join(Number(btn.dataset.reapply)); return; }
      if (btn.dataset.cancelMembership !== undefined) { confirmMembershipCancel(Number(btn.dataset.cancelMembership)); return; }
      if (btn.dataset.confirmCancel !== undefined) { void onlineCancelMembership(Number(btn.dataset.confirmCancel)); return; }
      if (btn.dataset.activityCancelClub!==undefined) {activityCancelClubPrompt(btn.dataset.activityCancelClub);return;}
      if (btn.dataset.activityConfirmClubCancel!==undefined) {void activityCancelClub(btn.dataset.activityConfirmClubCancel);return;}
      if (btn.dataset.activityReapplyClub!==undefined) {void activityReapplyClub(btn.dataset.activityReapplyClub);return;}
      if (btn.dataset.activityDownloadTicket!==undefined) {
        notify(window.KanonhaActivity?.downloadTicket(btn.dataset.activityDownloadTicket)
          ? 'برای دریافت فایل، در پنجره چاپ «ذخیره به‌صورت PDF» را انتخاب کنید.'
          : 'بلیت یا کد QR برای دریافت PDF در دسترس نیست.');
        return;
      }
      if (btn.dataset.activityDownloadCertificate!==undefined) {
        if(!onlineMode||!onlineBackend.currentUser)return notify('برای دانلود گواهی وارد شوید.');
        const certificateId=btn.dataset.activityDownloadCertificate;
        openSheet('تأیید کد ملی گواهی',
          '<p>برای درج کد ملی واقعی روی گواهی، آن را با اطلاعات ثبت‌نام خود تطبیق دهید. '+
          'متن کد ملی در حافظه برنامه یا پایگاه‌داده گواهی ذخیره نمی‌شود؛ اما در فایل PDF شما درج خواهد شد.</p>'+
          '<form id="certificate-national-form" data-certificate-id="'+escapeHTML(certificateId)+'" autocomplete="off">'+
          '<label class="field">کد ملی (۱۰ رقم)<input name="national_id" type="password" inputmode="numeric" '+
          'maxlength="10" minlength="10" autocomplete="off" required placeholder="کد ملی خود را وارد کنید"></label>'+
          '<p class="field-hint">پس از تأیید، گزینه ذخیره PDF در گوشی نمایش داده می‌شود.</p>'+
          '<p id="certificate-national-error" class="online-auth-status" role="status" aria-live="polite"></p>'+
          '<button type="submit" class="pill-btn sheet-action">تأیید و دریافت PDF</button></form>');
        return;
      }

      if (btn.dataset.register !== undefined)    { register(Number(btn.dataset.register)); return; }
      if (btn.dataset.details !== undefined)     { eventDetails(Number(btn.dataset.details)); return; }
      if (btn.dataset.clubDetails !== undefined) { clubDetails(Number(btn.dataset.clubDetails)); return; }
      if (btn.dataset.action)         { action(btn.dataset.action); }
    });
    document.addEventListener('change',e=>{
      const target=e.target;
      if(!target || !target.dataset || target.dataset.academicSelect!=='university')return;
      const form=typeof target.closest==='function'?target.closest('form'):null;
      const faculty=form&&typeof form.querySelector==='function'
        ?form.querySelector('select[data-academic-select="faculty"]'):null;
      if(faculty){
        faculty.innerHTML=academyFacultyOptions(target.value);
        faculty.disabled=!target.value;
      }
    });

    // Profile edit form
    document.addEventListener('submit', async (e) => {
      if(onlineMode && e.target.id==='certificate-national-form'){
        e.preventDefault();
        const form=e.target, input=form.querySelector('input[name="national_id"]');
        const button=form.querySelector('button[type="submit"]');
        const message=form.querySelector('#certificate-national-error');
        const account=onlineBackend.currentUser?.id;
        if(!account||!input)return;
        const candidate=input.value;
        if(button)button.disabled=true;
        if(message)message.textContent='در حال اعتبارسنجی اطلاعات…';
        try{
          const ok=await window.KanonhaActivity?.downloadCertificate(
            form.dataset.certificateId,candidate);
          if(!onlineBackend.currentUser||onlineBackend.currentUser.id!==account)return;
          if(!ok)throw new Error('تولید PDF یا کد استعلام ممکن نشد.');
          closeSheet();
          notify('در پنجره چاپ، «ذخیره به‌صورت PDF» را انتخاب کنید.');
        }catch(error){
          if(message)message.textContent=onlineError(error);
        }finally{
          if(input)input.value='';
          if(button)button.disabled=false;
        }
        return;
      }
      if (onlineMode && e.target.id === 'online-auth-form') {
        e.preventDefault();
        await onlineAuthenticate(e.target);
        return;
      }
      if (onlineMode && e.target.id === 'manager-student-form') {
        e.preventDefault();
        if (!state.isManager || !onlineBackend.currentUser || studentProfileReady) return;
        const accountId = onlineBackend.currentUser.id;
        if (window.KanonhaJalali && !window.KanonhaJalali.validateForm(e.target)) {
          notify('لطفاً تاریخ تولد را به‌صورت شمسی کامل انتخاب کنید.'); return;
        }
        const fd = new FormData(e.target);
        const fields = {};
        for (const key of ['full_name','student_number','national_id','birth_date',
          'university','faculty','major','mobile']) fields[key] = String(fd.get(key) || '').trim();
        try {
          await onlineBackend.adminAction('manager.student.attach', fields);
          if (!onlineBackend.currentUser || onlineBackend.currentUser.id !== accountId) return;
          await onlineRefreshPersonal();
          closeSheet();
          activePersona = 'student';
          renderPersonaSelector();
          updateProfileDisplay();
          go('home');
          notify('پرونده دانشجویی به همین حساب مدیرکل متصل شد.');
        } catch (error) { notify(onlineError(error)); }
        return;
      }
      if (e.target.id !== 'edit-form') return;
      e.preventDefault();
      const form = new FormData(e.target);
      const name = String(form.get('name') || '').trim();
      const number = String(form.get('number') || '').trim();
      if (!name || !number) return;
      if (onlineMode) {
        try {
          await onlineBackend.saveProfile(name, number);
          if (typeof onlineBackend.saveAcademicDetails === 'function')
            await onlineBackend.saveAcademicDetails(String(form.get('university') || ''),
              String(form.get('faculty') || ''),String(form.get('major') || ''),String(form.get('mobile') || ''));
          await onlineRefreshPersonal();
          closeSheet();
          notify('اطلاعات دانشجویی در سرور ذخیره شد.');
        } catch (error) { notify(onlineError(error)); }
        return;
      }
      state.name = name;
      state.number = number;
      saveState();
      renderAll();
      closeSheet();
      notify('اطلاعات نمایشی ذخیره شد.');
    });

    if (new URLSearchParams(window.location.search).get('native') === '1') { document.body.classList.add('native-app'); }
    // Move the existing secured management desks once, preserving their listeners and state.
    const workspacePanels = $('workspace-panels');
    if (workspacePanels && typeof workspacePanels.appendChild === 'function') {
      workspacePanels.appendChild($('admin-panel'));
      workspacePanels.appendChild($('secretary-panel'));
    }
    // Initial render
    renderAll();
    renderNav();

    // Handle hash navigation
    const requested = location.hash.replace('#', '');
    go(routeNavItems().some(x => x.id === requested) ? requested : onlineMode ? 'profile' : 'home');
    if (onlineMode) {
      void onlineRefreshPublic();
      // Directory is public read-only and cached in memory for signup/profile forms.
      void refreshAcademicDirectory();
    }

    window.addEventListener('hashchange', () => {
      const id = location.hash.slice(1);
      if (routeNavItems().some(x => x.id === id) && id !== activeScreen) go(id);
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
      get persona() { return activePersona; },
      get state() { return { ...state, joined: [...state.joined], registered: [...state.registered] }; },
      go,
      handleBack,
      notificationImageFor: (kind,id) => {
        if(kind==='event')return events.find(e=>e.id===id)?.posterUrl||'';
        if(kind==='club'){
          const c=clubs.find(c=>c.id===id);
          return c?clubImageSrc(c):'';
        }
        return '';
      },
      openNotificationTarget: (kind,id) => {
        if(kind==='event'){
          const i=events.findIndex(e=>e.id===id);
          if(i>=0){go('events');eventDetails(i);return true;}
          go('events');return false;
        }
        if(kind==='club'){
          const i=clubs.findIndex(c=>c.id===id);
          if(i>=0){clubDetails(i);return true;}
          go('clubs');return false;
        }
        if(kind==='update'){go('profile');action('about');return true;}
        go('home');return true;
      },
      reset: () => action('reset')
    };
  }
})();