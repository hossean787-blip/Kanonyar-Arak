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
    return Number.isFinite(date.getTime())
      ? (window.KanonhaJalali ? window.KanonhaJalali.formatDate(date,true) : date.toLocaleString('fa-IR'))
      : 'تاریخ نامشخص';
  };
  function inputDate(time) {
    const d = new Date(time);
    if (!Number.isFinite(d.getTime())) return '';
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }
  let seq = 0;
  let dataSeq = 0;
  let owner = null;
  let assigned = [];
  let activeClub = '';
  let clubCatalog = [];
  let directory = { universities: [], faculties: [] };
  let members = [];
  let events = [];
  let profiles = new Map();
  let roster = [];
  let rosterCertificates = new Set();
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
  function secretaryHome(show) {
    const banner = $('home-management');
    if (!banner) return;
    if (show) {
      banner.hidden = false; banner.dataset.mode = 'secretary';
      $('home-management-overline').textContent = 'دسترسی دبیر کانون فعال';
      $('home-management-title').textContent = 'مدیریت کانون';
      $('home-management-caption').textContent = 'درخواست‌های عضویت، رویدادها و حضور و غیاب';
      $('home-management-btn').textContent = 'ورود به مدیریت کانون';
    } else if (banner.dataset.mode === 'secretary') {
      banner.hidden = true; banner.dataset.mode = '';
    }
  }
  function clear() {
    seq++;
    dataSeq++;
    owner = null;
    assigned = [];
    activeClub = '';
    clubCatalog = [];
    directory = { universities: [], faculties: [] };
    members = [];
    events = [];
    profiles = new Map();
    roster = [];
    rosterCertificates = new Set();
    rosterEvent = '';
    editor = null;
    busy = false;
    root.hidden = true;
    secretaryHome(false);
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
      // A temporary catalog outage must not hide membership and event management.
      const [catalog, academics] = await Promise.all([
        backend.clubs(),
        backend.academicCatalog().catch(() => ({universities: [], faculties: []}))
      ]);
      if (requestId !== seq || !hasSession()) return;
      clubCatalog = catalog.filter(x => x && validId(x.id));
      directory = {
        universities: Array.isArray(academics?.universities) ? academics.universities : [],
        faculties: Array.isArray(academics?.faculties) ? academics.faculties : []
      };
      activeClub = assigned[0];
      root.hidden = false;
      secretaryHome(true);
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
    const loadId = ++dataSeq;
    const club = activeClub;
    status('در حال دریافت اطلاعات از سرور…');
    try {
      const [m, e] = await Promise.all([
        backend.secretaryMemberships(club), backend.secretaryEvents(club)
      ]);
      if (requestId !== seq || loadId !== dataSeq || !hasSession() || club !== activeClub) return;
      members = m.filter(x => x && validId(x.id) && validId(x.user_id) && x.club_id === club);
      events = e.filter(x => x && validId(x.id) && x.club_id === club);
      const ps = await backend.secretaryProfiles(members.map(x => x.user_id));
      if (requestId !== seq || loadId !== dataSeq || !hasSession() || club !== activeClub) return;
      profiles = new Map(ps.filter(x => validId(x.user_id)).map(x => [x.user_id, x]));
      roster = [];
      rosterEvent = '';
      status('');
      render();
    } catch (error) {
      if (requestId === seq && loadId === dataSeq && club === activeClub) {
        status(errorText(error), true);
        render();
      }
    }
  }
  async function refreshData() {
    if (!hasSession() || !hasClub(activeClub)) return false;
    await loadClubData();
    return true;
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
  function universityOptions(selected = '') {
    return '<option value="">انتخاب دانشگاه</option>' +
      directory.universities.map(u => '<option value="' + escape(u.name) + '"' +
        (u.name === selected ? ' selected' : '') + '>' + escape(u.name) + '</option>').join('');
  }
  function facultyOptions(university, selected = '') {
    const u = directory.universities.find(x => x.name === university);
    return '<option value="">انتخاب دانشکده</option>' +
      directory.faculties.filter(f => u && f.university_id === u.id)
        .map(f => '<option value="' + escape(f.name) + '"' +
          (f.name === selected ? ' selected' : '') + '>' + escape(f.name) + '</option>').join('');
  }
  function renderClub() {
    const club = activeClubInfo();
    if (!club) return empty('این کانون غیرفعال است یا اطلاعات آن برای نمایش موجود نیست.');
    return '<div class="secretary-summary">' +
      '<div class="secretary-stat"><strong>' + members.filter(m => m.status === 'approved').length + '</strong><span>اعضای فعال</span></div>' +
      '<div class="secretary-stat"><strong>' + members.filter(m => m.status === 'pending').length + '</strong><span>درخواست جدید</span></div>' +
      '<div class="secretary-stat"><strong>' + events.length + '</strong><span>رویدادها</span></div></div>' +
      '<form id="secretary-club-form" class="secretary-card secretary-form">' +
      '<h3 class="secretary-card-title">ویرایش مشخصات کانون</h3>' +
      (directory.universities.length ? '' :
        '<p class="secretary-danger-note">فهرست دانشگاه‌ها در دسترس نیست؛ برای ویرایش مشخصات مجدداً تازه‌سازی کنید.</p>') +
      '<label class="field">نام کانون<input name="name" maxlength="120" required value="' + escape(club.name) + '"></label>' +
      '<label class="field">دسته‌بندی<input name="category" maxlength="80" required value="' + escape(club.category || 'سایر') + '"></label>' +
      '<label class="field">دانشگاه *<select name="university" data-secretary-university required aria-required="true">' +
        universityOptions(club.university || '') + '</select></label>' +
      '<label class="field">دانشکده *<select name="faculty" data-secretary-faculty required aria-required="true"' +
        (directory.universities.some(u => u.name === club.university) ? '' : ' disabled') + '>' +
        facultyOptions(club.university || '', club.faculty || '') + '</select></label>' +
      '<label class="field">درباره کانون *<textarea name="description" maxlength="2000" required aria-required="true" placeholder="درباره کانون بنویسید">' + escape(club.description || '') + '</textarea></label>' +
      '<button class="secretary-cta" type="submit">ذخیره تغییرات کانون</button>' +
      '<p class="secretary-danger-note">فعال یا غیرفعال‌کردن کانون و تعیین دبیر فقط توسط مدیر اصلی انجام می‌شود.</p></form>' +
      '<form id="secretary-logo-form" class="secretary-card secretary-form">' +
      '<h3 class="secretary-card-title">لوگوی اختصاصی کانون</h3>' +
      (typeof backend.clubLogoUrl === 'function' && backend.clubLogoUrl(club.id,club.logo_path) ?
        '<img class="secretary-logo-preview" alt="لوگوی فعلی کانون" src="' +
        escape(backend.clubLogoUrl(club.id,club.logo_path)) + '">' : '') +
      '<label class="field">انتخاب لوگو<input type="file" name="logo" required accept="image/png"></label>' +
      '<p class="secretary-card-meta">فقط فایل PNG، حداکثر ۲ مگابایت</p>' +
      '<button class="secretary-cta" type="submit">ثبت لوگوی کانون</button></form>';
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
    const poster=editing?backend.eventPosterUrl?.(e.club_id,e.id,e.poster_path)||'':'';
    const eventLocalTime=inputDate(e.starts_at);
    const eventDate=eventLocalTime.slice(0,10),eventTime=eventLocalTime.slice(11,16);
    return '<form id="secretary-event-form" class="secretary-form secretary-card">' +
      '<h3 class="secretary-card-title">' + (editing ? 'ویرایش رویداد' : 'ثبت رویداد جدید') + '</h3>' +
      '<label class="field">نام رویداد<input name="title" maxlength="160" required value="' + escape(e.title || '') + '"></label>' +
      '<label class="field">محل برگزاری<input name="location" maxlength="250" required value="' + escape(e.location || '') + '"></label>' +
      '<label class="field">تاریخ برگزاری<input name="event_date" type="date" required value="' + escape(eventDate) + '"></label>' +
      '<label class="field">ساعت برگزاری<input name="event_time" type="time" required value="' + escape(eventTime) + '"></label>' +
      '<label class="field">توضیحات رویداد<textarea name="description" maxlength="4000" rows="4" placeholder="موضوع، برنامه و شرایط حضور را توضیح دهید">' + escape(e.description || '') + '</textarea></label>' +
      '<label class="field">مهلت ثبت‌نام<input name="registration_deadline" type="datetime-local" required value="' + escape(inputDate(e.registration_deadline)) + '"></label>' +
      '<label class="field">ظرفیت<input name="capacity" type="number" min="' + Math.max(1,Number(e.registered_count||0)) + '" max="100000" required value="' + escape(e.capacity || 30) + '"></label>' +
      (poster?'<img class="kanonha-event-poster" src="'+escape(poster)+'" alt="پوستر کنونی">':'') +
      '<label class="field">پوستر رویداد (PNG، JPG یا WebP تا ۲ مگابایت)' +
      '<input name="poster" type="file" accept="image/png,image/jpeg,image/webp"' + (editing&&e.poster_path?'':' required') + '></label>' +
      '<p class="field-hint">رویداد بدون تأیید مدیرکل منتشر می‌شود. ثبت نهایی به تأیید اثر انگشت یا چهره روی دستگاه دبیر نیاز دارد. مشخصات رویداد در همه مراحل قابل ویرایش است؛ ظرفیت نباید از تعداد ثبت‌نام قطعی کمتر باشد.</p>' +
      '<div class="secretary-actions"><button type="submit" class="positive">ذخیره و انتشار رویداد</button>' +
      '<button type="button" data-secretary-action="cancel-editor">انصراف</button></div></form>';
  }
  function renderEvents() {
    const heading = '<div class="secretary-actions"><button type="button" class="positive" data-secretary-action="new-event">+ ایجاد رویداد</button></div>';
    const form = editor ? eventForm() : '';
    const rows = !events.length ? empty('هنوز رویدادی برای این کانون ایجاد نشده است.') : events.map(e => {
      const seats = Number(e.registered_count) || 0;
      const poster=backend.eventPosterUrl?.(e.club_id,e.id,e.poster_path)||'';
      return '<article class="secretary-card"><h3 class="secretary-card-title">' + escape(e.title || '') + '</h3>' +
        '<span class="secretary-chip ' + (e.is_published ? '' : 'pending') + '">' +
        (e.is_published?'منتشرشده':'پیش‌نویس؛ منتظر تکمیل پوستر') + '</span>' +
        (poster?'<img class="kanonha-event-poster" src="'+escape(poster)+'" alt="پوستر رویداد">':'') +
        '<p class="secretary-card-p">برگزاری: ' + escape(stamp(e.starts_at)) + '</p>' +
        '<p class="secretary-card-meta">مهلت ثبت‌نام: ' + escape(stamp(e.registration_deadline)) + '</p>' +
        '<p class="secretary-card-meta">ثبت‌نام: ' + seats + ' از ' + Number(e.capacity || 0) + ' نفر</p>' +
        '<div class="secretary-actions">' +
        '<button type="button" data-secretary-edit="' + escape(e.id) + '">ویرایش رویداد</button>' +
        '<button type="button" data-secretary-roster="' + escape(e.id) + '">ثبت‌نام‌کنندگان و اسکن QR</button>' +
        '<button type="button" data-secretary-export-excel="' + escape(e.id) + '">دریافت اکسل</button>' +
        '<button type="button" data-secretary-export-pdf="' + escape(e.id) + '">دریافت PDF</button>' +
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
    html += '<form id="secretary-ticket-form" class="secretary-form secretary-card">'+
      '<label class="field">کد بلیت یا متن QR<input name="ticket" autocomplete="off" spellcheck="false" '+
      'placeholder="KANONHA1:..." required></label>'+
      '<div class="secretary-actions"><button type="submit" class="positive"'+(started?'':' disabled')+
      '>بررسی بلیت و ثبت ورود</button>'+
      '<button type="button" data-secretary-scan="true"'+(started?'':' disabled')+
      '>اسکن QR با دوربین</button></div><div id="secretary-scan-camera"></div></form>';
    if (!roster.length) return html + empty('هیچ ثبت‌نام‌کننده‌ای برای این رویداد وجود ندارد.');
    return html + roster.map(r => '<div class="secretary-card">' +
      '<h3 class="secretary-card-title">' + escape(memberName(r.user_id)) + '</h3>' +
      '<p class="secretary-card-meta">' + escape(studentNumber(r.user_id)) + '</p>' +
      '<span class="secretary-chip ' + (r.attended_at ? '' : 'pending') + '">' +
      (r.attended_at ? 'حاضر — ' + escape(stamp(r.attended_at)) : 'حضور ثبت نشده') + '</span>' +
      '<div class="secretary-actions"><button type="button" class="' + (r.attended_at ? 'negative' : 'positive') +
      '" data-secretary-attendance="' + escape(r.id) + '" data-secretary-present="' + (r.attended_at ? 'false' : 'true') +
      '"' + (started ? '' : ' disabled') + '>' + (r.attended_at ? 'لغو حضور' : 'ثبت حضور') + '</button>' +
      (r.attended_at ? '<span class="secretary-chip">' + (rosterCertificates.has(r.id) ? 'گواهینامه صادرشده' : 'گواهینامه در حال بررسی') + '</span>' : '') +
      '</div></div>').join('');
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
    if (window.KanonhaJalali) window.KanonhaJalali.enhance($('secretary-content'));
  }
  async function loadRoster(eventId) {
    if (!hasClub(activeClub) || !events.some(e => e.id === eventId)) return;
    const requestId = seq;
    rosterEvent = eventId;
    status('در حال بارگذاری ثبت‌نام‌کنندگان…');
    try {
      // A temporary certificate-list failure must never disable attendance scanning.
      const [rows, certificatesResult] = await Promise.all([
        backend.secretaryRoster(eventId),
        Promise.resolve().then(() => backend.secretaryCertificates(eventId))
          .then(value => ({ok:true,rows:value}), () => ({ok:false,rows:[]}))
      ]);
      if (requestId !== seq || !hasSession() || rosterEvent !== eventId) return;
      const normalized = rows.filter(x => validId(x.id) && validId(x.user_id) && x.event_id === eventId);
      const names = await backend.secretaryProfiles(normalized.map(r => r.user_id));
      if (requestId !== seq || !hasSession() || rosterEvent !== eventId) return;
      roster = normalized;
      rosterCertificates = new Set(certificatesResult.rows.map(c=>c.registration_id));
      names.forEach(x => { if (validId(x.user_id)) profiles.set(x.user_id, x); });
      status(certificatesResult.ok ? '' :
        'فهرست حضور بارگذاری شد؛ وضعیت گواهینامه‌ها موقتاً در دسترس نیست.', !certificatesResult.ok);
      render();
    } catch (error) { if (requestId === seq) status(errorText(error), true); }
  }

  let cameraStream=null,cameraActive=false;
  function stopTicketCamera(){
    cameraActive=false;
    if(cameraStream){for(const track of cameraStream.getTracks())track.stop();cameraStream=null;}
    const box=$('secretary-scan-camera');if(box)box.textContent='';
  }
  async function startTicketCamera(){
    stopTicketCamera();
    if(!navigator.mediaDevices?.getUserMedia ||
       (!window.BarcodeDetector&&typeof window.jsQR!=='function')){
      status('این دستگاه از اسکن مستقیم پشتیبانی نمی‌کند؛ کد بلیت را دستی وارد کنید.',true);
      return;
    }
    const host=$('secretary-scan-camera');
    if(!host)return;
    try{
      let detector=null;
      if(window.BarcodeDetector){
        try{detector=new window.BarcodeDetector({formats:['qr_code']});}
        catch(_){if(typeof window.jsQR!=='function')throw new Error('QR decoder unavailable');}
      }
      cameraStream=await navigator.mediaDevices.getUserMedia({
        video:{facingMode:{ideal:'environment'}},audio:false
      });
      cameraActive=true;
      const video=document.createElement('video');
      video.autoplay=true;video.muted=true;video.playsInline=true;
      video.className='kanonha-ticket-camera';video.srcObject=cameraStream;
      host.appendChild(video);
      await video.play();
      status('QR بلیت را مقابل دوربین قرار دهید.');
      const ticketEvent=rosterEvent;
      let lastFrame=0;
      const canvas=document.createElement('canvas');
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      const step=async()=>{
        if(!cameraActive||rosterEvent!==ticketEvent||!hasSession()){stopTicketCamera();return;}
        const now=Date.now();
        if(now-lastFrame<180){requestAnimationFrame(step);return;}
        lastFrame=now;
        try{
          let raw='';
          if(detector){
            try{
              const found=await detector.detect(video);
              raw=found.find(x=>/^KANONHA1:[0-9a-f-]{36}$/i.test(x.rawValue||''))?.rawValue||'';
            }catch(_){detector=null;}
          }
          if(!raw&&typeof window.jsQR==='function'&&ctx&&video.videoWidth>0&&video.videoHeight>0){
            const scale=Math.min(1,640/Math.max(video.videoWidth,video.videoHeight));
            canvas.width=Math.max(1,Math.round(video.videoWidth*scale));
            canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
            ctx.drawImage(video,0,0,canvas.width,canvas.height);
            const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
            const decoded=window.jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:'dontInvert'});
            if(decoded&&/^KANONHA1:[0-9a-f-]{36}$/i.test(decoded.data||''))raw=decoded.data;
          }
          if(raw){
            stopTicketCamera();
            await perform(async()=>{
              const result=await backend.checkInTicket(raw,ticketEvent);
              if(result.result==='checked_in'){
                await loadRoster(ticketEvent);
                status('حضور '+(result.attendee||'دانشجو')+' ثبت و گواهینامه به‌صورت خودکار صادر شد.');
              }else status(result.result==='already'?'بلیت قبلاً استفاده شده است.':
                result.result==='early'?'رویداد هنوز آغاز نشده است.':'بلیت معتبر نیست.',true);
            });
            return;
          }
        }catch(e){stopTicketCamera();status(errorText(e),true);return;}
        if(cameraActive)requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }catch(_){stopTicketCamera();status('دوربین در دسترس نیست؛ کد را دستی وارد کنید.',true);}
  }
  if(typeof document.addEventListener==='function')document.addEventListener('visibilitychange',()=>{if(document.hidden)stopTicketCamera();});
  async function submitClub(form) {
    const fd = new FormData(form);
    if (!formValue(fd,'description')) { status('پر کردن بخش درباره کانون الزامی است.',true);return; }
    const university = formValue(fd, 'university');
    const faculty = formValue(fd, 'faculty');
    const chosen = directory.universities.find(u => u.name === university);
    if (!chosen || !directory.faculties.some(f => f.university_id === chosen.id && f.name === faculty)) {
      status('دانشگاه و دانشکده را از فهرست معتبر انتخاب کنید.', true);
      return;
    }
    const result = await backend.secretaryUpdateClub(activeClub, {
      name: formValue(fd, 'name'), description: formValue(fd, 'description'),
      category: formValue(fd, 'category'), university, faculty
    });
    const old = activeClubInfo();
    if (old) Object.assign(old, result);
    status('مشخصات کانون در سرور ذخیره شد.');
    render();
  }
  async function submitEvent(form) {
    const fd = new FormData(form);
    const poster=form.querySelector('input[name="poster"]')?.files?.[0]||null;
    const existing=editor&&editor.id?events.find(e=>e.id===editor.id):null;
    if(!poster&&!existing?.poster_path)throw new Error('انتخاب پوستر برای انتشار رویداد الزامی است.');
    if(poster&&(!['image/png','image/jpeg','image/webp'].includes(poster.type)||poster.size<1||poster.size>2097152))
      throw new Error('پوستر باید PNG، JPG یا WebP و حداکثر ۲ مگابایت باشد.');
    const eventDate=formValue(fd,'event_date'),eventTime=formValue(fd,'event_time');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)||!/^\d{2}:\d{2}$/.test(eventTime))
      throw new Error('تاریخ و ساعت برگزاری را کامل و معتبر وارد کنید.');
    const data = {
      title: formValue(fd,'title'), location: formValue(fd,'location'),
      description: formValue(fd,'description'),
      starts_at: eventDate+'T'+eventTime, registration_deadline: formValue(fd,'registration_deadline'),
      capacity: Number(fd.get('capacity')), is_published: true
    };
    if(!window.KanonhaBiometric?.confirmAction)
      throw new Error('برای ثبت نهایی باید نسخه اندروید با احراز هویت بیومتریک نصب باشد.');
    await window.KanonhaBiometric.confirmAction('secretary-event');
    if(existing){
      await backend.secretaryUpdateEvent(existing.id,data);
      if(poster)await backend.uploadEventPoster(activeClub,existing.id,poster);
    }else{
      const created=await backend.secretaryCreateEvent(activeClub,{...data,is_published:false});
      try{
        await backend.uploadEventPoster(activeClub,created.id,poster);
        await backend.secretaryUpdateEvent(created.id,data);
      }catch(error){
        editor={id:created.id};
        await loadClubData();
        throw error;
      }
    }
    editor=null;
    status('رویداد بدون نیاز به تأیید مدیرکل منتشر و ذخیره شد.');
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
    if (target.dataset && 'secretaryUniversity' in target.dataset) {
      const form = target.closest('form');
      const faculty = form?.querySelector('select[data-secretary-faculty]');
      if (faculty) {
        faculty.innerHTML = facultyOptions(target.value);
        faculty.value = '';
        faculty.disabled = !directory.universities.some(u => u.name === target.value);
      }
      return;
    }
    if (target.id === 'secretary-club-select' && hasClub(target.value)) {
      ++seq; activeClub = target.value; editor = null; activeTab = 'club';
      await loadClubData();
    } else if (target.id === 'secretary-roster-select') {
      stopTicketCamera();
      if (!target.value) { rosterEvent = ''; roster = []; render(); }
      else await loadRoster(target.value);
    }
  });
  root.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || !root.contains(button) || !hasSession() || !hasClub(activeClub)) return;
    const data = button.dataset;
    if (data.secretaryRefresh !== undefined) { void perform(() => loadClubData()); return; }
    if (data.secretaryTab && ['club','members','events','attendance'].includes(data.secretaryTab)) {
      stopTicketCamera();activeTab = data.secretaryTab; editor = null; render(); return;
    }
    if (data.secretaryAction === 'new-event') { activeTab = 'events'; editor = {}; render(); return; }
    if (data.secretaryAction === 'cancel-editor') { editor = null; render(); return; }
    if (data.secretaryEdit && events.some(e => e.id === data.secretaryEdit)) {
      activeTab = 'events'; editor = {id:data.secretaryEdit}; render(); return;
    }
    const exportId=data.secretaryExportExcel||data.secretaryExportPdf;
    if(exportId&&events.some(e=>e.id===exportId)){
      const current=events.find(e=>e.id===exportId);
      void perform(async()=>{
        const report=await backend.secretaryEventExport(current.id);
        report.event=current;report.registered=Number(report.summary?.registrations||0);
        report.attended=Number(report.summary?.attendees||0);
        const excel=Boolean(data.secretaryExportExcel);
        const ok=excel?window.KanonhaEventTools?.exportEventExcel(report,'secretary'):
          window.KanonhaEventTools?.exportEventPdf(report,'secretary');
        if(!ok)throw new Error('دریافت گزارش در این دستگاه در دسترس نیست یا گزارش بیش از حد بزرگ است.');
        status(report.truncated?'گزارش بیش از ۱۰۰۰۰ نفر است؛ خروجی ناقص خواهد بود.':
          'گزارش '+(excel?'اکسل':'PDF')+' آماده ذخیره است.');
      });return;
    }
    if (data.secretaryScan) {void startTicketCamera();return;}
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
    if (form.id === 'secretary-ticket-form') {
      event.preventDefault();
      const ticket=String(new FormData(form).get('ticket')||'');
      void perform(async()=>{
        const result=await backend.checkInTicket(ticket,rosterEvent);
        if(result.result==='checked_in'){
          status('ورود '+(result.attendee||'دانشجو')+' ثبت شد.');
          await loadRoster(rosterEvent);
        }else if(result.result==='already')status('این بلیت قبلاً استفاده شده است.',true);
        else if(result.result==='early')status('رویداد هنوز آغاز نشده است.',true);
        else status('بلیت معتبر یا قابل استفاده نیست.',true);
      });
      return;
    }
    if (form.id === 'secretary-poster-form') {
      event.preventDefault();
      const file=form.querySelector('input[name="poster"]')?.files?.[0];
      const eventId=form.dataset.eventId;
      const club=activeClub;
      if(!file||!events.some(e=>e.id===eventId&&e.club_id===club)){
        status('رویداد یا فایل پوستر معتبر نیست.',true);return;
      }
      void perform(async()=>{
        await backend.uploadEventPoster(club,eventId,file);
        if(club===activeClub&&hasSession())await loadClubData();
        status('پوستر رویداد ذخیره شد.');
      });
      return;
    }
    if (form.id === 'secretary-logo-form') {
      event.preventDefault();
      const file = form.querySelector('input[name="logo"]')?.files?.[0];
      if (!file) { status('ابتدا تصویر لوگو را انتخاب کنید.',true); return; }
      const club = activeClub;
      void perform(async () => {
        await backend.secretaryUploadClubLogo(club,file);
        if (!hasSession() || club !== activeClub) return;
        clubCatalog = await backend.clubs();
        await loadClubData();
        status('لوگوی کانون ذخیره شد.');
      });
      return;
    }
    if (form.id !== 'secretary-club-form' && form.id !== 'secretary-event-form') return;
    event.preventDefault();
    if(window.KanonhaJalali && !window.KanonhaJalali.validateForm(form)){
      status('لطفاً تاریخ و ساعت را به‌صورت شمسی کامل انتخاب کنید.',true);return;
    }
    void perform(() => form.id === 'secretary-club-form' ? submitClub(form) : submitEvent(form));
  });
  function hasAssignments() { return hasSession() && assigned.length > 0; }
  function showTab(next) {
    if (!hasAssignments() || !hasClub(activeClub) ||
        !['club','events','members','attendance'].includes(next)) return false;
    if (activeTab !== next) { activeTab = next; editor = null; render(); }
    return true;
  }
  function summary() {
    if (!hasAssignments()) return null;
    return Object.freeze({
      clubs: assigned.length, members: members.length, events: events.length,
      pending: members.filter(x => x.status === 'pending').length,
      club: clubName(activeClub)
    });
  }
  window.KanonhaSecretaryPanel = Object.freeze({refresh, refreshData, clear, hasAssignments, showTab, summary});
})();
