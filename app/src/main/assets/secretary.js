/* Kanonha secretary desk — a separate module within the same student app.
 * No client-side role grant: all permissions are verified by RLS in Kanonha DB.
 */
(() => {
  'use strict';
  const backend = window.KanonhaBackend;
  const root = document.getElementById('secretary-panel');
  if (!root || !backend || !backend.enabled) return;
  const $ = (id) => document.getElementById(id);
  const escape = (text) => String(text == null ? '' : text).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validId = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v || '');
  const safeText = (x) => typeof x === 'string' ? x.trim() : '';
  const formValue = (fd, key) => safeText(fd.get(key));
  const stamp = (time) => {
    const date = new Date(time);
    return Number.isFinite(date.getTime()) ? date.toLocaleString('fa-IR') : 'تاریخ نامشخص';
  };
  function inputDate(time) {
    const d = new Date(time);
    if (!Number.isFinite(d.getTime())) return '';
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }
  let seq = 0;
  let owner = null;
  let assigned = [];
  let activeClub = '';
  let clubCatalog = [];
  let members = [];
  let events = [];
  let profiles = new Map();
  let roster = [];
  let rosterEvent = '';
  let activeTab = 'club';
  let editor = null;
  let busy = false;
  function hasSession() {
    return Boolean(owner && backend.currentUser && backend.currentUser.id === owner);
  }
  function hasClub(clubId) {
    return validId(clubId) && assigned.includes(clubId);
  }
  function clubName(id) {
    const club = clubCatalog.find(x => x.id === id);
    return club ? String(club.name || '') : 'کانون اختصاص‌یافته';
  }
  function activeClubInfo() {
    return clubCatalog.find(x => x.id === activeClub) || null;
  }
  function clear() {
    seq++;
    owner = null;
    assigned = [];
    activeClub = '';
    clubCatalog = [];
    members = [];
    events = [];
    profiles = new Map();
    roster = [];
    rosterEvent = '';
    editor = null;
    busy = false;
    root.hidden = true;
    $('secretary-content').innerHTML = '';
    $('secretary-message').textContent = '';
    $('secretary-club-select').innerHTML = '';
  }
  function status(text, isError = false) {
    $('secretary-message').textContent = String(text || '');
    $('secretary-message').style.color = isError ? '#a44538' : '#24674a';
  }
  function errorText(error) {
    if (error && error.status === 401) return 'نشست ورود منقضی شده؛ دوباره وارد شوید.';
    if (error && error.status === 403) return 'اجازه انجام این عملیات را ندارید.';
    return String(error && error.message || 'خطا در ارتباط با سرور').slice(0, 160);
  }
  function fillAssignedSelect() {
    $('secretary-club-select').innerHTML = assigned.map(id =>
      '<option value="' + escape(id) + '"' + (id === activeClub ? ' selected' : '') + '>' +
      escape(clubName(id)) + '</option>').join('');
  }
  async function refresh() {
    clear();
    const current = backend.currentUser;
    if (!current || !validId(current.id)) return;
    const requestId = seq;
    owner = current.id;
    try {
      const roles = await backend.secretaryClubs();
      if (requestId !== seq || !hasSession()) return;
      assigned = [...new Set(roles.map(x => x.club_id).filter(validId))];
      if (!assigned.length) { root.hidden = true; return; }
      const catalog = await backend.clubs();
      if (requestId !== seq || !hasSession()) return;
      clubCatalog = catalog.filter(x => x && validId(x.id));
      activeClub = assigned[0];
      root.hidden = false;
      fillAssignedSelect();
      status('برای مدیریت هر بخش، یکی از گزینه‌های زیر را انتخاب کنید.');
      await loadClubData(requestId);
    } catch (error) {
      if (requestId === seq) {
        root.hidden = true;
        status(errorText(error), true);
      }
    }
  }
  async function loadClubData(requestId = seq) {
    if (!hasSession() || !hasClub(activeClub)) return;
    const club = activeClub;
    status('در حال دریافت اطلاعات از سرور…');
    try {
      const [m, e] = await Promise.all([
        backend.secretaryMemberships(club), backend.secretaryEvents(club)
      ]);
      if (requestId !== seq || !hasSession() || club !== activeClub) return;
      members = m.filter(x => x && validId(x.id) && validId(x.user_id) && x.club_id === club);
      events = e.filter(x => x && validId(x.id) && x.club_id === club);
      const ps = await backend.secretaryProfiles(members.map(x => x.user_id));
      if (requestId !== seq || !hasSession() || club !== activeClub) return;
      profiles = new Map(ps.filter(x => validId(x.user_id)).map(x => [x.user_id, x]));
      roster = [];
      rosterEvent = '';
      status('');
      render();
    } catch (error) {
      if (requestId === seq && club === activeClub) {
        status(errorText(error), true);
        render();
      }
    }
  }
  function memberName(userId) {
    const p = profiles.get(userId);
    return p ? String(p.full_name || 'نام نامشخص') : 'دانشجوی ثبت‌نام‌کننده';
  }
  function studentNumber(userId) {
    const p = profiles.get(userId);
    return p && p.student_number ? 'شماره دانشجویی: ' + p.student_number : 'شماره دانشجویی در دسترس نیست';
  }
  const empty = (message) => '<div class="secretary-empty">' + escape(message) + '</div>';
  const statuses = {pending:'در انتظار بررسی', approved:'عضو تأییدشده', rejected:'درخواست ردشده'};
  function renderClub() {
    const club = activeClubInfo();
    if (!club) return empty('این کانون غیرفعال است یا اطلاعات آن برای نمایش موجود نیست.');
    return '<div class="secretary-summary">' +
      '<div class="secretary-stat"><strong>' + members.filter(m => m.status === 'approved').length + '</strong><span>اعضای فعال</span></div>' +
      '<div class="secretary-stat"><strong>' + members.filter(m => m.status === 'pending').length + '</strong><span>درخواست جدید</span></div>' +
      '<div class="secretary-stat"><strong>' + events.length + '</strong><span>رویدادها</span></div></div>' +
      '<form id="secretary-club-form" class="secretary-card secretary-form">' +
      '<h3 class="secretary-card-title">ویرایش مشخصات کانون</h3>' +
      '<label class="field">نام کانون<input name="name" maxlength="120" required value="' + escape(club.name) + '"></label>' +
      '<label class="field">دسته‌بندی<input name="category" maxlength="80" required value="' + escape(club.category || 'سایر') + '"></label>' +
      '<label class="field">معرفی کانون<textarea name="description" maxlength="2000">' + escape(club.description || '') + '</textarea></label>' +
      '<button class="secretary-cta" type="submit">ذخیره تغییرات کانون</button>' +
      '<p class="secretary-danger-note">فعال یا غیرفعال‌کردن کانون و تعیین دبیر فقط توسط مدیر اصلی انجام می‌شود.</p></form>';
  }
  function renderMembers() {
    if (!members.length) return empty('هنوز درخواست عضویت یا عضو ثبت‌شده‌ای برای این کانون وجود ندارد.');
    return members.map(m => {
      const chip = statuses[m.status] || 'نامشخص';
      return '<article class="secretary-card"><h3 class="secretary-card-title">' + escape(memberName(m.user_id)) + '</h3>' +
      '<p class="secretary-card-p">' + escape(studentNumber(m.user_id)) + '</p>' +
      '<span class="secretary-chip ' + (m.status === 'pending' ? 'pending' : m.status === 'rejected' ? 'rejected' : '') + '">' + chip + '</span>' +
      '<p class="secretary-card-meta">تاریخ درخواست: ' + escape(stamp(m.requested_at)) + '</p>' +
      (m.status === 'pending' ? '<div class="secretary-actions">' +
        '<button type="button" class="positive" data-secretary-decide="' + escape(m.id) + '" data-secretary-status="approved">تأیید عضویت</button>' +
        '<button type="button" class="negative" data-secretary-decide="' + escape(m.id) + '" data-secretary-status="rejected">رد درخواست</button>' +
        '</div>' : '') + '</article>';
    }).join('');
  }
  function eventForm() {
    const editing = editor && editor.id && events.find(e => e.id === editor.id);
    const e = editing || {};
    return '<form id="secretary-event-form" class="secretary-form secretary-card">' +
      '<h3 class="secretary-card-title">' + (editing ? 'ویرایش رویداد' : 'ثبت رویداد جدید') + '</h3>' +
      '<label class="field">عنوان رویداد<input name="title" maxlength="160" required value="' + escape(e.title || '') + '"></label>' +
      '<label class="field">مکان رویداد<input name="location" maxlength="250" value="' + escape(e.location || '') + '"></label>' +
      '<label class="field">زمان شروع<input name="starts_at" type="datetime-local" required value="' + escape(inputDate(e.starts_at)) + '"></label>' +
      '<label class="field">مهلت ثبت‌نام<input name="registration_deadline" type="datetime-local" required value="' + escape(inputDate(e.registration_deadline)) + '"></label>' +
      '<label class="field">ظرفیت<input name="capacity" type="number" min="1" max="100000" required value="' + escape(e.capacity || 30) + '"></label>' +
      '<label class="field"><span><input type="checkbox" name="is_published" value="1"' + (e.is_published ? ' checked' : '') +
      ' style="width:auto;min-height:auto;vertical-align:middle"> انتشار رویداد برای دانشجویان</span></label>' +
      '<p class="field-hint">رویداد منتشرنشده فقط برای دبیر قابل مشاهده است. پس از شروع ثبت‌نام، ویرایش زمان و ظرفیت محدود می‌شود.</p>' +
      '<div class="secretary-actions"><button type="submit" class="positive">ذخیره رویداد</button>' +
      '<button type="button" data-secretary-action="cancel-editor">انصراف</button></div></form>';
  }
  function renderEvents() {
    const heading = '<div class="secretary-actions"><button type="button" class="positive" data-secretary-action="new-event">+ ایجاد رویداد</button></div>';
    const form = editor ? eventForm() : '';
    const rows = !events.length ? empty('هنوز رویدادی برای این کانون ایجاد نشده است.') : events.map(e => {
      const seats = Number(e.registered_count) || 0;
      const canEdit = seats === 0 && new Date(e.starts_at).getTime() > Date.now();
      return '<article class="secretary-card"><h3 class="secretary-card-title">' + escape(e.title || '') + '</h3>' +
        '<span class="secretary-chip ' + (e.is_published ? '' : 'pending') + '">' + (e.is_published ? 'منتشرشده' : 'پیش‌نویس') + '</span>' +
        '<p class="secretary-card-p">شروع: ' + escape(stamp(e.starts_at)) + '</p>' +
        '<p class="secretary-card-meta">ثبت‌نام: ' + seats + ' از ' + Number(e.capacity || 0) + ' نفر</p>' +
        '<div class="secretary-actions">' +
        (canEdit ? '<button type="button" data-secretary-edit="' + escape(e.id) + '">ویرایش رویداد</button>' : '') +
        '<button type="button" data-secretary-roster="' + escape(e.id) + '">ثبت‌نام‌کنندگان</button>' +
        '</div></article>';
    }).join('');
    return heading + form + rows;
  }
  function renderAttendance() {
    if (!events.length) return empty('برای ثبت حضور و غیاب، ابتدا یک رویداد ایجاد کنید.');
    let html = '<label class="secretary-select-label">انتخاب رویداد<select id="secretary-roster-select"><option value="">انتخاب کنید…</option>' +
      events.map(e => '<option value="' + escape(e.id) + '"' + (e.id === rosterEvent ? ' selected' : '') + '>' +
        escape(e.title || '') + '</option>').join('') + '</select></label>';
    if (!rosterEvent) return html + empty('رویداد را انتخاب کنید تا فهرست ثبت‌نام‌کنندگان نمایش داده شود.');
    const event = events.find(e => e.id === rosterEvent);
    if (!event) return html;
    const started = new Date(event.starts_at).getTime() <= Date.now();
    html += '<p class="secretary-card-p">حضور و غیاب ' + (started ? 'فعال است.' : 'پس از آغاز رویداد فعال می‌شود.') + '</p>';
    if (!roster.length) return html + empty('هیچ ثبت‌نام‌کننده‌ای برای این رویداد وجود ندارد.');
    return html + roster.map(r => '<div class="secretary-card">' +
      '<h3 class="secretary-card-title">' + escape(memberName(r.user_id)) + '</h3>' +
      '<p class="secretary-card-meta">' + escape(studentNumber(r.user_id)) + '</p>' +
      '<span class="secretary-chip ' + (r.attended_at ? '' : 'pending') + '">' +
      (r.attended_at ? 'حاضر — ' + escape(stamp(r.attended_at)) : 'حضور ثبت نشده') + '</span>' +
      '<div class="secretary-actions"><button type="button" class="' + (r.attended_at ? 'negative' : 'positive') +
      '" data-secretary-attendance="' + escape(r.id) + '" data-secretary-present="' + (r.attended_at ? 'false' : 'true') +
      '"' + (started ? '' : ' disabled') + '>' + (r.attended_at ? 'لغو حضور' : 'ثبت حضور') + '</button></div></div>').join('');
  }
  function render() {
    if (!hasSession() || !hasClub(activeClub)) return;
    fillAssignedSelect();
    for (const button of root.querySelectorAll('[data-secretary-tab]')) {
      button.classList.toggle('active', button.dataset.secretaryTab === activeTab);
      button.setAttribute('aria-pressed', button.dataset.secretaryTab === activeTab ? 'true' : 'false');
    }
    $('secretary-content').innerHTML =
      activeTab === 'club' ? renderClub() :
      activeTab === 'members' ? renderMembers() :
      activeTab === 'events' ? renderEvents() : renderAttendance();
  }
  async function loadRoster(eventId) {
    if (!hasClub(activeClub) || !events.some(e => e.id === eventId)) return;
    const requestId = seq;
    rosterEvent = eventId;
    status('در حال بارگذاری ثبت‌نام‌کنندگان…');
    try {
      const rows = await backend.secretaryRoster(eventId);
      if (requestId !== seq || !hasSession() || rosterEvent !== eventId) return;
      const normalized = rows.filter(x => validId(x.id) && validId(x.user_id) && x.event_id === eventId);
      const names = await backend.secretaryProfiles(normalized.map(r => r.user_id));
      if (requestId !== seq || !hasSession() || rosterEvent !== eventId) return;
      roster = normalized;
      names.forEach(x => { if (validId(x.user_id)) profiles.set(x.user_id, x); });
      status('');
      render();
    } catch (error) { if (requestId === seq) status(errorText(error), true); }
  }
  async function submitClub(form) {
    const fd = new FormData(form);
    const result = await backend.secretaryUpdateClub(activeClub, {
      name: formValue(fd, 'name'), description: formValue(fd, 'description'),
      category: formValue(fd, 'category')
    });
    const old = activeClubInfo();
    if (old) Object.assign(old, result);
    status('مشخصات کانون در سرور ذخیره شد.');
    render();
  }
  async function submitEvent(form) {
    const fd = new FormData(form);
    const data = {
      title: formValue(fd, 'title'), location: formValue(fd, 'location'),
      starts_at: formValue(fd, 'starts_at'), registration_deadline: formValue(fd, 'registration_deadline'),
      capacity: Number(fd.get('capacity')), is_published: fd.get('is_published') === '1'
    };
    if (editor && editor.id) await backend.secretaryUpdateEvent(editor.id, data);
    else await backend.secretaryCreateEvent(activeClub, data);
    editor = null;
    status('رویداد در سرور ذخیره شد.');
    await loadClubData();
  }
  async function perform(task) {
    if (busy || !hasSession() || !hasClub(activeClub)) return;
    busy = true;
    try { await task(); }
    catch (error) { if (hasSession()) status(errorText(error), true); }
    finally { busy = false; }
  }
  root.addEventListener('change', async event => {
    const target = event.target;
    if (target.id === 'secretary-club-select' && hasClub(target.value)) {
      ++seq; activeClub = target.value; editor = null; activeTab = 'club';
      await loadClubData();
    } else if (target.id === 'secretary-roster-select') {
      if (!target.value) { rosterEvent = ''; roster = []; render(); }
      else await loadRoster(target.value);
    }
  });
  root.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || !root.contains(button) || !hasSession() || !hasClub(activeClub)) return;
    const data = button.dataset;
    if (data.secretaryTab && ['club','members','events','attendance'].includes(data.secretaryTab)) {
      activeTab = data.secretaryTab; editor = null; render(); return;
    }
    if (data.secretaryAction === 'new-event') { activeTab = 'events'; editor = {}; render(); return; }
    if (data.secretaryAction === 'cancel-editor') { editor = null; render(); return; }
    if (data.secretaryEdit && events.some(e => e.id === data.secretaryEdit)) {
      activeTab = 'events'; editor = {id:data.secretaryEdit}; render(); return;
    }
    if (data.secretaryRoster && events.some(e => e.id === data.secretaryRoster)) {
      activeTab = 'attendance'; void loadRoster(data.secretaryRoster); return;
    }
    if (data.secretaryDecide && ['approved','rejected'].includes(data.secretaryStatus)
        && members.some(m => m.id === data.secretaryDecide && m.status === 'pending')) {
      const club = activeClub;
      void perform(async () => {
        await backend.secretaryDecideMembership(data.secretaryDecide, data.secretaryStatus);
        if (club === activeClub && hasSession()) await loadClubData();
      });
      return;
    }
    if (data.secretaryAttendance && ['true','false'].includes(data.secretaryPresent)
        && roster.some(r => r.id === data.secretaryAttendance)) {
      const eventId = rosterEvent;
      void perform(async () => {
        await backend.secretarySetAttendance(data.secretaryAttendance, data.secretaryPresent === 'true');
        if (hasSession() && eventId === rosterEvent) await loadRoster(eventId);
      });
    }
  });
  root.addEventListener('submit', event => {
    const form = event.target;
    if (form.id !== 'secretary-club-form' && form.id !== 'secretary-event-form') return;
    event.preventDefault();
    void perform(() => form.id === 'secretary-club-form' ? submitClub(form) : submitEvent(form));
  });
  window.KanonhaSecretaryPanel = Object.freeze({refresh, clear});
})();
