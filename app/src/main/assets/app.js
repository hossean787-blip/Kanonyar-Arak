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
    { id: 'activity', label: 'فعالیت‌های من', icon: 'check-square'  },
    { id: 'profile',  label: 'حساب کاربری',   icon: 'user'          }
  ];
  const managerNavItems = [
    {id:'manager-home', label:'خانه', art:'home'},
    {id:'manager-clubs', label:'کانون‌ها', art:'clubs'},
    {id:'manager-users', label:'کاربران', art:'activity'},
    {id:'manager-events', label:'رویدادها', art:'events'},
    {id:'manager-account', label:'حساب', art:'profile'}
  ];
  const secretaryNavItems = [
    {id:'secretary-home', label:'خانه', art:'home'},
    {id:'secretary-club', label:'کانون من', art:'clubs'},
    {id:'secretary-events', label:'رویدادها', art:'events'},
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
  const defaultState = () => ({ joined: [], requested: [], registered: [], name: onlineMode ? 'مهمان' : 'کاربر آزمایشی', number: 'ثبت نشده', isManager: false, academic: null });

  function loadState() {
    // Never read a previous offline demo account while online mode is active.
    if (onlineMode) return defaultState();
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (s && Array.isArray(s.joined) && Array.isArray(s.registered) && typeof s.name === 'string' && typeof s.number === 'string') {
        s.joined = [...new Set(s.joined.filter(n => Number.isInteger(n) && n >= 0 && n < clubs.length))];
        s.registered = [...new Set(s.registered.filter(n => Number.isInteger(n) && n >= 0 && n < events.length))];
        s.requested = [];
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
    $('online-auth-panel').hidden = signed;
    $('online-profile-card').hidden = !signed;
    $('profile-menu').hidden = !signed;
    const student = onlineRole === 'student';
    $('student-login-fields').hidden = !student || onlineSignup;
    $('student-signup-fields').hidden = !student || !onlineSignup;
    $('manager-login-fields').hidden = student;
    $('signup-password-hint').hidden = !onlineSignup || !student;
    $('online-auth-title').textContent = onlineSignup
      ? student ? 'ثبت‌نام دانشجو' : 'ثبت حساب مدیر کل'
      : student ? 'ورود دانشجو / دبیر' : 'ورود مدیر کل';
    $('online-auth-submit').textContent = onlineSignup ? 'ایجاد حساب' : 'ورود به حساب';
    $('online-auth-toggle').textContent = onlineSignup ? 'حساب دارم؛ ورود'
      : student ? 'حساب ندارم؛ ثبت‌نام بدون ایمیل' : 'راه‌اندازی حساب مدیر کل با ایمیل';
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
        tone: 'green'
      }));
      const now = Date.now();
      events = rawEvents.filter(e => e && typeof e.id === 'string').map(e => {
        const start = Date.parse(e.starts_at);
        const close = Date.parse(e.registration_deadline);
        const free = Math.max(0, Number(e.capacity || 0) - Number(e.registered_count || 0));
        const category = 'رویداد';
        return {
          id: e.id,
          title: String(e.title || ''), date: Number.isFinite(start) ? new Date(start).toLocaleString('fa-IR') : 'زمان نامشخص',
          location: String(e.location || ''), capacity: free, poster: 'poster-books.svg',
          category, club: clubs.findIndex(c => c.id === e.club_id),
          registrationOpen: Number.isFinite(start) && Number.isFinite(close) && start > now && close > now && free > 0
        };
      });
      onlineMessage('نمایش اطلاعات آنلاین؛ عضویت و ثبت‌نام در پایگاه داده مستقل ثبت می‌شوند.');
      if (onlineBackend.currentUser) await onlineRefreshPersonal();
      else renderAll();
    } catch (error) {
      if (refreshId !== onlinePublicSequence) return;
      onlineMessage('بارگذاری اطلاعات آنلاین ناموفق بود: ' + onlineError(error), true);
      renderAll();
    }
  }
  async function onlineRefreshPersonal() {
    if (!onlineMode || !onlineBackend.currentUser) return;
    const ownerId = onlineBackend.currentUser.id;
    const refreshId = ++onlinePersonalSequence;
    const [profile, memberRows, eventRows, academic] = await Promise.all([
      state.isManager ? onlineBackend.profile() : onlineBackend.ensureProfile(),
      onlineBackend.memberships(), onlineBackend.registrations(),
      typeof onlineBackend.academicDetails === 'function' ? onlineBackend.academicDetails() : null
    ]);
    if (refreshId !== onlinePersonalSequence ||
        !onlineBackend.currentUser || onlineBackend.currentUser.id !== ownerId) return;
    const memberMap = new Map(memberRows.map(m => [m.club_id, m.status]));
    const eventIds = new Set(eventRows.filter(e => e.status === 'confirmed').map(e => e.event_id));
    state.joined = clubs.map((c, i) => memberMap.get(c.id) === 'approved' ? i : -1).filter(i => i >= 0);
    state.requested = clubs.map((c, i) => memberMap.get(c.id) === 'pending' ? i : -1).filter(i => i >= 0);
    state.registered = events.map((e, i) => eventIds.has(e.id) ? i : -1).filter(i => i >= 0);
    studentProfileReady = Boolean(profile);
    state.name = profile ? profile.full_name : state.isManager ? 'مدیرکل کانون‌ها' : 'اطلاعات تکمیل نشده';
    state.number = profile ? profile.student_number : 'ثبت نشده';
    state.academic = academic;
    renderAll();
    onlineRenderAuth();
    if (!profile && !state.isManager) onlineMessage('برای درخواست عضویت، اطلاعات دانشجویی خود را تکمیل کنید.');
  }
  async function onlineAuthenticate(form) {
    if (onlineWorking) return;
    onlineWorking = true;
    $('online-auth-submit').disabled = true;
    const status = $('online-auth-status');
    status.textContent = 'در حال بررسی حساب کاربری…';
    try {
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
        await onlineBackend.studentSignIn(String(values.get('kind') || 'student'),
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
      state = defaultState();
      state.isManager = !student;
      activePersona = student ? 'student' : 'manager';
      assignedSecretary = false; studentProfileReady = false;
      roleCapabilitiesChecked = false;
      ++onlinePersonalSequence;
      form.reset();
      await onlineRefreshPublic();
      if (window.KanonhaSecretaryPanel) await window.KanonhaSecretaryPanel.refresh();
      if (window.KanonhaAdminPanel) await window.KanonhaAdminPanel.refresh();
      updateAvailablePersonas();
      onlineRenderAuth();
      status.textContent = '';
      go('home');
      notify('ورود به حساب انجام شد.');
    } catch (error) {
      status.textContent = onlineError(error);
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
  async function onlineJoin(i) {
    if (!clubs[i] || !onlineRequireProfile()) return;
    if (state.joined.includes(i) || state.requested.includes(i)) { notify('این درخواست قبلاً ثبت شده است.'); return; }
    try {
      await onlineBackend.joinClub(clubs[i].id);
      await onlineRefreshPersonal();
      closeSheet();
      notify('درخواست عضویت ثبت شد و در انتظار تأیید است.');
    } catch (error) { notify(onlineError(error)); }
  }
  async function onlineRegister(i) {
    if (!events[i] || !onlineRequireProfile()) return;
    if (state.registered.includes(i)) { notify('قبلاً در این رویداد ثبت‌نام کرده‌اید.'); return; }
    if (!events[i].registrationOpen) { notify('ثبت‌نام این رویداد باز نیست.'); return; }
    try {
      await onlineBackend.registerEvent(events[i].id);
      await onlineRefreshPublic();
      await onlineRefreshPersonal();
      closeSheet();
      notify('ثبت‌نام رویداد در سرور تأیید شد.');
    } catch (error) { notify(onlineError(error)); }
  }
  async function onlineLogout() {
    // Invalidate pending account-bound fetches before the logout network call.
    ++onlinePersonalSequence;
    ++onlinePublicSequence;
    if (window.KanonhaSecretaryPanel) window.KanonhaSecretaryPanel.clear();
    if (window.KanonhaAdminPanel) window.KanonhaAdminPanel.clear();
    try { await onlineBackend.signOut(); }
    catch (_) { /* local tokens still cleared by adapter */ }
    state = defaultState();
    activePersona = 'student'; assignedSecretary = false; studentProfileReady = false;
    adminPanelReady = false; secretaryPanelReady = false;
    roleCapabilitiesChecked = false;
    $('home-management').hidden = true;
    $('role-switcher').hidden = true;
    renderAll();
    onlineRenderAuth();
    closeSheet();
    go('profile');
    notify('از حساب خارج شدید.');
  }

  /* ——— One account, independently authorized personas ——— */
  function updateAvailablePersonas() {
    // Panels only become available after they complete their own server-verified refresh.
    adminPanelReady = Boolean(state.isManager && !$('admin-panel').hidden);
    secretaryPanelReady = Boolean(!$('secretary-panel').hidden);
    assignedSecretary = secretaryPanelReady;
    roleCapabilitiesChecked = true;
    renderPersonaSelector();
  }
  function renderPersonaSelector() {
    if (!onlineMode) return;
    const signed = Boolean(onlineBackend.currentUser);
    const picker = $('role-switcher'), banner = $('home-management');
    picker.hidden = !signed;
    if (!signed) { banner.hidden = true; return; }
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
    }
    const roleCount = Object.values(caps).filter(Boolean).length;
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
  function setPersona(role) {
    if (!onlineMode || !onlineBackend.currentUser) return;
    if (role === 'manager' && (!state.isManager || !adminPanelReady)) return;
    if (role === 'secretary' && (!assignedSecretary || !secretaryPanelReady)) return;
    if (!['manager','secretary','student'].includes(role)) return;
    activePersona = role;
    renderPersonaSelector();
    updateProfileDisplay();
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
      notify('دسترسی‌های حساب بررسی و به‌روزرسانی شد.');
    } catch (error) { notify(onlineError(error)); }
    finally { $('role-refresh').disabled = false; }
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
    if (!routeNavItems().some(x => x.id === screen)) return;
    activeScreen = screen;
    const container = screen.endsWith('-account') ? 'profile' :
      screen.startsWith('manager-') || screen.startsWith('secretary-') ? 'workspace' : screen;
    document.querySelectorAll('.screen').forEach(el => {
      el.hidden = el.dataset.screen !== container;
    });
    if (container === 'workspace') renderWorkspace();
    if (container === 'profile') updateProfileDisplay();
    renderNav();
    if (screen === 'activity') renderActivity();
    if (scroll) $('main').scrollTop = 0;
    try { history.replaceState(null, '', `#${screen}`); } catch (_) {}
  }

  function renderNav() {
    $('bottom-nav').innerHTML = routeNavItems().map(x =>
      `<button type="button" data-screen-btn="${x.id}"
        class="${x.id === activeScreen ? 'active' : ''}"
        ${x.id === activeScreen ? 'aria-current="page"' : ''}>
        <img class="nav-art" src="assets/nav-${x.art || x.id}.svg" alt="" width="34" height="34"><span>${x.label}</span>
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

  /* ——— Club card ——— */
  function clubCard(club, index) {
    const member = state.joined.includes(index);
    const isViewOnly = !onlineMode && (index === 0 || index === 3);
    const pending = (state.requested || []).includes(index);
    return `<article class="card club-card">
      <div class="club-icon ${club.tone === 'blue' ? '' : club.tone}"><img class="club-art" src="assets/club-${club.icon === "book" ? "book" : club.icon === "code" ? "tech" : club.icon === "leaf" ? "leaf" : club.icon === "flask" ? "science" : "sport"}.svg" alt="" width="48" height="48"></div>
      <div class="club-info">
        <h3>${escapeHTML(club.title)}</h3>
        <p>${escapeHTML(club.desc)}</p>
        <button type="button"
          ${member || pending || isViewOnly ? `data-club-details="${index}"` : `data-join="${index}"`}
          class="pill-btn ${member ? 'joined' : pending ? 'signed' : isViewOnly ? 'view-btn' : ''}">
          ${member ? 'عضو هستید' : pending ? 'در انتظار تأیید' : isViewOnly ? 'مشاهده' : 'عضویت'}
        </button>
      </div>
    </article>`;
  }

  /* ——— Render functions ——— */
  function homeCarouselCard(event,index){
    return `<article class="home-event-slide" role="group" aria-label="${escapeHTML(event.title)}">
      <div class="home-slide-cover">
        <img src="assets/${event.poster}" alt="پوستر ${escapeHTML(event.title)}" width="244" height="119" loading="lazy">
        <span class="home-slide-status"><span class="home-slide-pulse" aria-hidden="true"></span> ${onlineMode ? 'ثبت‌نام باز' : 'ثبت‌نام آزمایشی'}</span>
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
    // Online content uses published server records; offline fixtures are clearly labeled.
    const found=events.map((event,index)=>[event,index]).filter(([event])=>event.registrationOpen===true&&event.capacity>0&&(!query||event.title.includes(query)));
    $('home-events').innerHTML=found.length?found.map(([event,index])=>homeCarouselCard(event,index)).join(''):'<div class="home-carousel-empty" role="status">رویداد دارای ثبت‌نام فعال پیدا نشد.</div>';
    $('home-events').scrollLeft=0;updateHomeCarouselControls();
    const foundClubs=(onlineMode ? clubs.map((_, i) => i) : [0,2,3]).filter(i=>!query||clubs[i].title.includes(query)||clubs[i].desc.includes(query));
    $('home-clubs').innerHTML=foundClubs.length?foundClubs.map(i=>
      `<button type="button" class="home-mini-club" data-club-details="${i}">
      <span class="mini-club-icon ${clubs[i].tone==='green'?'green':clubs[i].tone==='mint'?'mint':clubs[i].tone==='orange'?'orange':''}"><img class="mini-art" src="assets/club-${clubs[i].icon==='book'?'book':clubs[i].icon==='code'?'tech':clubs[i].icon==='leaf'?'leaf':clubs[i].icon==='flask'?'science':'sport'}.svg" alt="" width="57" height="57"></span>
      ${escapeHTML(clubs[i].short)}</button>`).join(''):'<div class="empty">کانونی یافت نشد.</div>';
  }

  function renderClubs() {
    const q = $('clubs-search').value.trim();
    const found = clubs.map((c, i) => [c, i]).filter(([c]) => !q || c.title.includes(q) || c.desc.includes(q));
    $('clubs-list').innerHTML = found.length
      ? found.map(([c, i]) => clubCard(c, i)).join('')
      : '<div class="no-results">کانونی با این نام پیدا نشد.</div>';
  }

  function renderEvents() {
    $('event-filters').innerHTML = (onlineMode ? ['همه', 'رویداد'] : ['همه', 'کارگاه', 'نشست', 'مسابقه']).map(type =>
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
    const activityMembers = [...new Set([...state.joined, ...(state.requested || [])])];
    $('activity-clubs').innerHTML = activityMembers.length
      ? activityMembers.filter(i => clubs[i]).map(i =>
          `<button class="activity-row" type="button" data-club-details="${i}">
            <span class="club-icon ${clubs[i].tone}"><img class="row-club-art" src="assets/club-${clubs[i].icon === "book" ? "book" : clubs[i].icon === "code" ? "tech" : clubs[i].icon === "leaf" ? "leaf" : clubs[i].icon === "flask" ? "science" : "sport"}.svg" alt="" width="31" height="31"></span>
            <span class="activity-copy">${escapeHTML(clubs[i].title)}${state.requested.includes(i) ? '<small>در انتظار تأیید عضویت</small>' : ''}</span>
            <span class="arrow">${svg('chevron-left', 15)}</span>
          </button>`
        ).join('')
      : '<div class="empty">هنوز عضو کانونی نشده‌اید.</div>';

    $('activity-events').innerHTML = state.registered.length
      ? state.registered.filter(i => events[i]).map(i =>
          `<button class="activity-row" type="button" data-details="${i}">
            <span class="activity-copy">${escapeHTML(events[i].title)}<small>${escapeHTML(events[i].date)}</small></span>
            <span class="arrow">${svg('chevron-left', 15)}</span>
          </button>`
        ).join('')
      : '<div class="empty">رویدادی ثبت‌نام نشده است.</div>';

    $('activity-tickets').innerHTML = state.registered.length
      ? state.registered.filter(i => events[i]).map(i =>
          `<article class="ticket-card">
            <div class="ticket-details">
              <h3>${escapeHTML(events[i].title)}</h3>
              <p>${svg('calendar', 12)} ${escapeHTML(events[i].date)}</p>
              <p>${svg('map-pin', 12)} ${escapeHTML(events[i].location)}</p>
              <div class="ticket-label">${onlineMode ? 'ثبت‌نام تأیید شده — بلیت صادر نشده' : 'بلیت نمونه — فاقد اعتبار ورود'}</div>
            </div>
            ${onlineMode ? '<div class="ticket-label">بلیت قابل‌استفاده پس از راه‌اندازی صدور بلیت ارائه می‌شود.</div>' : qrMarkup(i)}
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
       <p>${onlineMode ? 'ثبت‌نام آنلاین با تأیید سرور انجام می‌شود.' : 'این یک رویداد نمونه رابط کاربری است. ثبت‌نام واقعی انجام نمی‌شود.'}</p>
       <button class="pill-btn sheet-action" type="button" ${onlineMode && (!ev.registrationOpen || state.registered.includes(i)) ? "disabled" : `data-register="${i}"`}>
         ${state.registered.includes(i) ? 'ثبت‌نام‌شده' : onlineMode ? (ev.registrationOpen ? 'ثبت‌نام آنلاین' : 'ثبت‌نام بسته است') : 'ثبت‌نام نمایشی'}
       </button>`
    );
  }

  function clubDetails(i) {
    const club = clubs[i];
    if (!club) return;
    openSheet(club.title,
      `<p>${escapeHTML(club.desc)}</p>
       <p>${onlineMode ? 'عضویت در کانون پس از تأیید مدیر کانون فعال می‌شود.' : 'برای مشاهده عملکرد ظاهری عضویت می‌توانید روی دکمه زیر بزنید. هیچ اطلاعاتی به سرور ارسال نمی‌شود.'}</p>
       <button class="pill-btn sheet-action" type="button" ${state.joined.includes(i) || state.requested.includes(i) ? 'disabled' : 'data-join="' + i + '"'}>
         ${state.joined.includes(i) ? 'عضو هستید' : state.requested.includes(i) ? 'در انتظار تأیید' : onlineMode ? 'درخواست عضویت' : 'درخواست عضویت نمایشی'}
       </button>`
    );
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
          <label class="field">تاریخ تولد میلادی<input name="birth_date" type="date" required></label>
          <label class="field">شماره موبایل (بدون پیامک تأیید)<input name="mobile" inputmode="tel" pattern="09[0-9]{9}" maxlength="11" required></label>
          <label class="field">دانشگاه<input name="university" maxlength="120" required></label>
          <label class="field">دانشکده<input name="faculty" maxlength="120" required></label>
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
          ${onlineMode ? `<label class="field">دانشگاه<input name="university" maxlength="120" required value="${escapeHTML(state.academic?.university || '')}"></label>
          <label class="field">دانشکده<input name="faculty" maxlength="120" required value="${escapeHTML(state.academic?.faculty || '')}"></label>
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
        `<p>کانون‌ها — ${onlineMode ? 'نسخه ۰.۸.۰، حساب چندنقشی و انتخاب نقش' : 'نسخه نمایشی آفلاین'}</p>
         <p>${onlineMode ? 'ورود و ثبت‌نام متصل به پایگاه داده مستقل؛ بلیت معتبر و تأیید شماره دانشجویی هنوز فعال نیست. نشست در حافظه موقت است.' : 'پنج صفحه با HTML، CSS و JavaScript پیاده‌سازی شده‌اند. هیچ داده‌ای به سرور ارسال نمی‌شود.'}</p>
         ${onlineMode ? '' : '<button type="button" data-action="reset" class="pill-btn soft">بازنشانی داده‌های نمایشی</button>'}`
      );
    } else if (name === 'exit') {
      openSheet('خروج از حساب',
        onlineMode
          ? '<p>آیا از حساب کاربری خارج می‌شوید؟</p><button class="pill-btn sheet-action" type="button" data-action="confirm-exit">خروج از حساب</button>'
          : '<p>در نسخه نمایشی، حساب کاربری واقعی وجود ندارد. بنابراین خروج واقعی فعال نیست.</p>'
      );
    } else if (name === 'confirm-exit' && onlineMode) {
      void onlineLogout();
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
    renderEvents();
    renderActivity();
    updateProfileDisplay();
    renderPersonaSelector();
  }

  function updateProfileDisplay() {
    const nameEl = $('profile-name');
    const numEl = $('profile-number');
    if (nameEl) nameEl.textContent = state.isManager && activePersona === 'manager' ? 'مدیرکل کانون‌ها' : state.name;
    if (numEl) numEl.textContent = `شماره دانشجویی: ${state.number}`;
    if (onlineMode) {
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
    if (onlineMode) {
      $('online-events-heading').textContent = 'رویدادهای در حال ثبت‌نام';
      onlineRenderAuth();
      $('online-auth-toggle').addEventListener('click', () => {
        onlineSignup = !onlineSignup;
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
      if (btn.id === 'home-management-btn' && onlineMode) {
        go('profile');
        const section = activePersona === 'manager' ? $('admin-panel') : activePersona === 'secretary' ? $('secretary-panel') : null;
        if (section && !section.hidden && typeof section.scrollIntoView === 'function')
          section.scrollIntoView({behavior:'smooth',block:'start'});
        return;
      }
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
    document.addEventListener('submit', async (e) => {
      if (onlineMode && e.target.id === 'online-auth-form') {
        e.preventDefault();
        await onlineAuthenticate(e.target);
        return;
      }
      if (onlineMode && e.target.id === 'manager-student-form') {
        e.preventDefault();
        if (!state.isManager || !onlineBackend.currentUser || studentProfileReady) return;
        const accountId = onlineBackend.currentUser.id;
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
    // Initial render
    renderAll();
    renderNav();

    // Handle hash navigation
    const requested = location.hash.replace('#', '');
    go(routeNavItems().some(x => x.id === requested) ? requested : onlineMode ? 'profile' : 'home');
    if (onlineMode) void onlineRefreshPublic();

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
      reset: () => action('reset')
    };
  }
})();