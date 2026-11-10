/* Kanonha v0.4 isolated REST adapter.
 * Login tokens deliberately stay in memory: a restart requires another login.
 * Never add a secret, service_role token, or private student data to this file.
 */
(() => {
  'use strict';
  const config = (typeof window !== 'undefined' && window.KANONHA_CONFIG) || {};
  const url = typeof config.url === 'string' ? config.url.trim().replace(/\/$/, '') : '';
  const key = typeof config.publishableKey === 'string' ? config.publishableKey.trim() : '';
  const enabled = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) &&
    (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key) || /^eyJ[A-Za-z0-9_.-]+$/.test(key));
  let session = null;
  let user = null;
  let refreshing = null;

  class ApiError extends Error {
    constructor(message, status = 0, field = '') {
      super(String(message).slice(0, 280));
      this.name = 'KanonhaApiError';
      this.status = status;
      // Explicit allowlist: never display arbitrary server selectors in DOM.
      this.field = ['name','studentNumber','nationalId','birthDate','mobile',
        'university','faculty','major','password'].includes(field) ? field : '';
    }
  }
  const needConfig = () => { if (!enabled) throw new ApiError('اتصال آنلاین برای کانون‌ها پیکربندی نشده است.'); };
  const uuid = (value) => /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value || '');
  const authPath = '/auth/v1/';
  const restPath = '/rest/v1/';
  function parseResponseError(obj, status) {
    const message = obj && typeof obj === 'object' &&
      (obj.msg || obj.error_description || obj.message || obj.error || obj.hint);
    return new ApiError(typeof message === 'string' ? message : 'پاسخ نامعتبر سرور',
      status, obj && typeof obj === 'object' ? obj.field : '');
  }
  async function request(path, options = {}) {
    needConfig();
    const headers = { apikey: key, 'Content-Type': 'application/json', Accept: 'application/json' };
    if (options.auth !== false) {
      if (options.refresh !== false) await refreshIfNeeded();
      if (session && session.access_token) headers.Authorization = 'Bearer ' + session.access_token;
      else if (options.requireUser) throw new ApiError('ابتدا وارد حساب کاربری شوید.', 401);
    }
    if (options.headers) Object.assign(headers, options.headers);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);
    try {
      const response = await fetch(url + path, {
        method: options.method || 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
        cache: 'no-store'
      });
      const raw = await response.text();
      let data = null;
      if (raw) {
        try { data = JSON.parse(raw); }
        catch (_) { throw new ApiError('پاسخ سرور قابل خواندن نیست.', response.status); }
      }
      if (!response.ok) throw parseResponseError(data, response.status);
      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error && error.name === 'AbortError') throw new ApiError('زمان پاسخ سرور به پایان رسید.');
      throw new ApiError('ارتباط امن با سرور برقرار نشد.');
    } finally { clearTimeout(timeout); }
  }
  function setSession(data) {
    if (!data || !data.access_token || !data.refresh_token) throw new ApiError('نشست ورود دریافت نشد.');
    session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (Number(data.expires_in) || 3600)
    };
    user = data.user || user;
    // On Android, a biometric-unlocked vault updates rotating refresh tokens
    // in encrypted native storage. No token is placed in localStorage or logs.
    if(typeof window !== 'undefined' && window.KanonhaNativeBiometric &&
       typeof window.KanonhaNativeBiometric.rotateToken === 'function')
      window.KanonhaNativeBiometric.rotateToken(session.refresh_token,user && user.id ? user.id : '');
  }
  async function resumeFromBiometric(refreshToken) {
    needConfig();
    const token=String(refreshToken||'');
    if(!token || token.length>4096)throw new ApiError('اطلاعات ورود بیومتریک معتبر نیست.');
    try {
      const data=await request(authPath+'token?grant_type=refresh_token',{
        method:'POST',auth:false,refresh:false,body:{refresh_token:token}
      });
      setSession(data);
      return await me();
    } catch(error) { session=null;user=null;throw error; }
  }
  function biometricRefreshToken() {
    return session && user ? session.refresh_token : null;
  }
  async function academicCatalog() {
    const [universities,faculties]=await Promise.all([
      request(restPath+'kanonha_universities?select=id,name&order=name.asc&limit=1000',{auth:false}),
      request(restPath+'kanonha_faculties?select=id,university_id,name&order=name.asc&limit=5000',{auth:false})
    ]);
    return {
      universities:Array.isArray(universities)?universities:[],
      faculties:Array.isArray(faculties)?faculties:[]
    };
  }
  async function refreshIfNeeded() {
    if (!session || session.expires_at - 60 > Math.floor(Date.now() / 1000)) return;
    if (refreshing) { await refreshing; return; }
    refreshing = (async () => {
      const token = session.refresh_token;
      const data = await request(authPath + 'token?grant_type=refresh_token', {
        method: 'POST', auth: false, refresh: false, body: { refresh_token: token }
      });
      setSession(data);
    })();
    try { await refreshing; }
    catch (error) { session = null; user = null; throw error; }
    finally { refreshing = null; }
  }
  function cleanEmail(email) {
    const v = String(email || '').trim().toLowerCase();
    if (v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new ApiError('ایمیل معتبر وارد کنید.');
    return v;
  }
  function checkPassword(password) {
    if (typeof password !== 'string' || password.length < 8 || password.length > 128)
      throw new ApiError('رمز عبور باید بین ۸ تا ۱۲۸ نویسه باشد.');
    return password;
  }
  function checkProfile(name, studentNumber) {
    const full_name = String(name || '').trim();
    const student_number = String(studentNumber || '').trim();
    if (full_name.length < 2 || full_name.length > 80) throw new ApiError('نام و نام خانوادگی معتبر وارد کنید.');
    if (!/^\d{6,20}$/.test(student_number)) throw new ApiError('شماره دانشجویی باید ۶ تا ۲۰ رقم انگلیسی باشد.');
    return { full_name, student_number };
  }
  async function signUp(email, password, name, studentNumber) {
    const profile = checkProfile(name, studentNumber);
    const data = await request(authPath + 'signup', {
      method: 'POST', auth: false,
      body: { email: cleanEmail(email), password: checkPassword(password), data: profile }
    });
    if (data && data.access_token && data.refresh_token) {
      setSession(data);
      await saveProfile(profile.full_name, profile.student_number);
    }
    // With email confirmation on, no session is returned until the mailbox is verified.
    return { confirmationRequired: !session, user: data && data.user ? data.user : null };
  }
  async function signIn(email, password) {
    const data = await request(authPath + 'token?grant_type=password', {
      method: 'POST', auth: false, body: { email: cleanEmail(email), password: checkPassword(password) }
    });
    setSession(data);
    const verified = await request(authPath + 'user', { requireUser: true });
    if (!verified || !uuid(verified.id)) { session = null; user = null; throw new ApiError('حساب کاربری تأیید نشد.'); }
    user = verified;
    return user;
  }
  async function signOut(options={}) {
    // Device-specific opt-in: leave only the already-encrypted biometric
    // refresh token valid when the user chooses ordinary "switch to login".
    // The JS access/refresh tokens are still immediately discarded.
    // A complete logout revokes the server session as before.
    const preserveBiometric = Boolean(options && options.preserveBiometric === true);
    try {
      if (!preserveBiometric && session)
        await request(authPath + 'logout', { method: 'POST', requireUser: true });
    } finally {
      session = null; user = null;
      // University-scoped survey reminders must not remain after logout.
      if(typeof window!=='undefined'&&window.AndroidSurveyNotices&&
         typeof window.AndroidSurveyNotices.clear==='function')
        try{window.AndroidSurveyNotices.clear();}catch(_){}
    }
  }
  async function me() {
    if (!session) return null;
    const obj = await request(authPath + 'user', { requireUser: true });
    if (!obj || !uuid(obj.id)) throw new ApiError('حساب کاربری تأیید نشد.');
    user = obj;
    return obj;
  }
  const mustUser = () => {
    if (!session || !user || !uuid(user.id)) throw new ApiError('ابتدا وارد حساب کاربری شوید.', 401);
    return user.id;
  };
  async function saveProfile(name, studentNumber) {
    const user_id = mustUser();
    const fields = checkProfile(name, studentNumber);
    // Column-level RLS grants never allow the client to UPDATE user_id.
    // Split insert/update so PostgREST does not attempt to update the primary key.
    const existing = await profile();
    if (existing) {
      if (fields.student_number !== existing.student_number)
        throw new ApiError('تغییر شماره دانشجویی فقط از طریق مدیرکل انجام می‌شود.');
      return updateProfile(user_id, { full_name: fields.full_name });
    }
    try {
      const rows = await request(restPath + 'kanonha_profiles', {
        method: 'POST', requireUser: true,
        headers: { Prefer: 'return=representation' },
        body: { user_id, ...fields }
      });
      return Array.isArray(rows) ? rows[0] || null : null;
    } catch (error) {
      // Concurrent account bootstrap: a single profile already exists for this user.
      // A duplicated student number belonging to someone else remains a hard failure.
      if (error.status !== 409 || !(await profile())) throw error;
      return updateProfile(user_id, fields);
    }
  }
  async function updateProfile(userId, fields) {
    const rows = await request(restPath + 'kanonha_profiles?user_id=eq.' + encodeURIComponent(userId), {
      method: 'PATCH', requireUser: true,
      headers: { Prefer: 'return=representation' },
      body: fields
    });
    if (!Array.isArray(rows) || rows.length !== 1) throw new ApiError('ذخیره اطلاعات انجام نشد؛ دوباره تلاش کنید.');
    return rows[0];
  }
  async function profile() {
    const user_id = mustUser();
    const rows = await request(restPath + 'kanonha_profiles?select=full_name,student_number,university_verified&user_id=eq.' + encodeURIComponent(user_id), { requireUser: true });
    return Array.isArray(rows) ? rows[0] || null : null;
  }
  async function ensureProfile() {
    const p = await profile();
    if (p) return p;
    const metadata = user && user.user_metadata || {};
    if (typeof metadata.full_name !== 'string' || typeof metadata.student_number !== 'string') return null;
    return saveProfile(metadata.full_name, metadata.student_number);
  }
  async function clubs() {
    const rows = await request(restPath + 'kanonha_clubs?select=id,name,description,category,university,faculty,logo_path&is_active=eq.true&order=name.asc', { auth: false });
    return Array.isArray(rows) ? rows : [];
  }
  async function events() {
    const rows = await request(restPath + 'kanonha_events?select=id,club_id,title,starts_at,registration_deadline,location,capacity,registered_count,poster_path&is_published=eq.true&approval_status=eq.approved&order=starts_at.asc', { auth: false });
    return Array.isArray(rows) ? rows : [];
  }
  async function memberships() {
    const user_id = mustUser();
    const rows = await request(restPath + 'kanonha_memberships?select=club_id,status&user_id=eq.' + encodeURIComponent(user_id), { requireUser: true });
    return Array.isArray(rows) ? rows : [];
  }
  async function registrations() {
    const user_id = mustUser();
    const rows = await request(restPath + 'kanonha_registrations?select=id,event_id,status,ticket_token&user_id=eq.' + encodeURIComponent(user_id), { requireUser: true });
    return Array.isArray(rows) ? rows : [];
  }
  async function joinClub(clubId) {
    if (!uuid(clubId)) throw new ApiError('کانون معتبر نیست.');
    return request(restPath + 'kanonha_memberships', {
      method: 'POST', requireUser: true,
      headers: { Prefer: 'return=minimal' },
      body: { user_id: mustUser(), club_id: clubId }
    });
  }
  async function reapplyClub(clubId) {
    const id = mustUser();
    if (!uuid(clubId)) throw new ApiError('کانون معتبر نیست.');
    const rows = await request(restPath + 'kanonha_memberships?user_id=eq.' +
      encodeURIComponent(id) + '&club_id=eq.' + encodeURIComponent(clubId) +
      '&status=eq.rejected&select=club_id,status', {
      method: 'PATCH', requireUser: true, headers: {Prefer:'return=representation'},
      body: {status:'pending'}
    });
    if (!Array.isArray(rows) || rows.length !== 1)
      throw new ApiError('درخواست قابل تکرار نیست؛ وضعیت عضویت را به‌روزرسانی کنید.',409);
    return rows[0];
  }
  async function cancelClubMembership(clubId) {
    const id = mustUser();
    if (!uuid(clubId)) throw new ApiError('کانون معتبر نیست.');
    const rows = await request(restPath + 'kanonha_memberships?user_id=eq.' +
      encodeURIComponent(id) + '&club_id=eq.' + encodeURIComponent(clubId) +
      '&status=in.(pending,approved)&select=id', {
      method:'DELETE', requireUser:true, headers:{Prefer:'return=representation'}
    });
    if (!Array.isArray(rows) || rows.length !== 1)
      throw new ApiError('این عضویت دیگر فعال نیست؛ صفحه را به‌روزرسانی کنید.',409);
    return true;
  }
  const logoRevision = new Map();
  function clubLogoUrl(clubId, logoPath) {
    if (!uuid(clubId) || logoPath !== clubId + '/logo.webp' || !enabled) return '';
    return url + '/storage/v1/object/public/kanonha-club-logos/' +
      clubId + '/logo.webp?v=' + (logoRevision.get(clubId) || 1);
  }
  async function secretaryUploadClubLogo(clubId, file) {
    requireUuid(clubId, 'کانون');
    mustUser();
    if (!file || !['image/png','image/jpeg','image/webp'].includes(file.type) ||
        file.size < 1 || file.size > 2097152)
      throw new ApiError('فقط تصویر PNG، JPG یا WebP با حجم حداکثر ۲ مگابایت پذیرفته می‌شود.');
    if (typeof document === 'undefined' || typeof URL === 'undefined')
      throw new ApiError('بارگذاری تصویر در این دستگاه پشتیبانی نمی‌شود.');
    const objectUrl = URL.createObjectURL(file);
    let bitmap;
    try {
      bitmap = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new ApiError('فایل تصویر قابل خواندن نیست.'));
        img.src = objectUrl;
      });
      const ratio = Math.min(1, 480 / Math.max(bitmap.naturalWidth,bitmap.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(bitmap.naturalHeight * ratio));
      canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/webp',0.83));
      if (!blob || blob.type !== 'image/webp' || blob.size > 2097152)
        throw new ApiError('تبدیل لوگو به WebP در این دستگاه ممکن نبود.');
      await refreshIfNeeded();
      const path = clubId + '/logo.webp';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(url + '/storage/v1/object/kanonha-club-logos/' + path, {
          method:'POST', signal:controller.signal, body:blob,
          headers:{apikey:key,Authorization:'Bearer '+session.access_token,
            'Content-Type':'image/webp','x-upsert':'true','cache-control':'60'}
        });
        if (!response.ok) throw new ApiError(
          response.status===403 ? 'مجوز آپلود لوگو برای این کانون تأیید نشد.' : 'بارگذاری لوگو ناموفق بود.',
          response.status);
      } finally { clearTimeout(timeout); }
      const rows = await request(restPath + 'kanonha_clubs?id=eq.' +
        encodeURIComponent(clubId) + '&select=id,logo_path', {
        method:'PATCH', requireUser:true, headers:{Prefer:'return=representation'},
        body:{logo_path:path}
      });
      if (!Array.isArray(rows) || rows.length !== 1)
        throw new ApiError('لوگو آپلود شد اما اتصال آن به کانون ذخیره نشد.');
      logoRevision.set(clubId,Date.now());
      return path;
    } finally { URL.revokeObjectURL(objectUrl); }
  }
  async function registerEvent(eventId) {
    if (!uuid(eventId)) throw new ApiError('رویداد معتبر نیست.');
    return request(restPath + 'kanonha_registrations', {
      method: 'POST', requireUser: true,
      headers: { Prefer: 'return=minimal' },
      body: { user_id: mustUser(), event_id: eventId }
    });
  }
  const posterRevision=new Map();
  function eventPosterUrl(clubId,eventId,path){
    if(!uuid(clubId)||!uuid(eventId)||path!==clubId+'/'+eventId+'.webp'||!enabled)return '';
    return url+'/storage/v1/object/public/kanonha-event-posters/'+path+'?v='+(posterRevision.get(eventId)||1);
  }
  async function uploadEventPoster(clubId,eventId,file){
    requireUuid(clubId,'کانون');requireUuid(eventId,'رویداد');mustUser();
    if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size<1||file.size>2097152)
      throw new ApiError('پوستر باید PNG، JPG یا WebP و حداکثر ۲ مگابایت باشد.');
    const source=URL.createObjectURL(file);
    try{
      const img=await new Promise((resolve,reject)=>{
        const el=new Image();el.onload=()=>resolve(el);
        el.onerror=()=>reject(new ApiError('فایل پوستر قابل خواندن نیست.'));el.src=source;
      });
      const ratio=Math.min(1,900/Math.max(img.naturalWidth,img.naturalHeight));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));
      canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
      canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.85));
      if(!blob||blob.type!=='image/webp'||blob.size>2097152)
        throw new ApiError('تبدیل تصویر پوستر ممکن نبود.');
      await refreshIfNeeded();
      const path=clubId+'/'+eventId+'.webp';
      const response=await fetch(url+'/storage/v1/object/kanonha-event-posters/'+path,{
        method:'POST',body:blob,
        headers:{apikey:key,Authorization:'Bearer '+session.access_token,
         'Content-Type':'image/webp','x-upsert':'true'}
      });
      if(!response.ok)throw new ApiError('آپلود پوستر مجاز نبود یا ناموفق بود.',response.status);
      const rows=await request(restPath+'kanonha_events?id=eq.'+encodeURIComponent(eventId)+
        '&club_id=eq.'+encodeURIComponent(clubId)+'&select=id,poster_path',{
        method:'PATCH',requireUser:true,headers:{Prefer:'return=representation'},body:{poster_path:path}
      });
      if(!Array.isArray(rows)||rows.length!==1)
        throw new ApiError('پوستر بارگذاری شد اما به رویداد متصل نشد.');
      posterRevision.set(eventId,Date.now());return path;
    }finally{URL.revokeObjectURL(source);}
  }
  async function cancelEvent(eventId){
    requireUuid(eventId,'رویداد');const userId=mustUser();
    const rows=await request(restPath+'kanonha_registrations?event_id=eq.'+encodeURIComponent(eventId)+
      '&user_id=eq.'+encodeURIComponent(userId)+'&select=id',{
      method:'DELETE',requireUser:true,headers:{Prefer:'return=representation'}
    });
    if(!Array.isArray(rows)||rows.length!==1)
      throw new ApiError('لغو ثبت‌نام مجاز نیست یا رویداد آغاز شده است.',409);
    return true;
  }
  async function checkInTicket(value){
    mustUser();
    const code=String(value||'').trim().replace(/^KANONHA1:/i,'');
    requireUuid(code,'کد بلیت');
    const rows=await request(restPath+'rpc/kanonha_checkin_ticket',{
      method:'POST',requireUser:true,body:{p_token:code}
    });
    return readRows(rows)[0]||{result:'invalid'};
  }
  async function eventSummary(eventId){
    requireUuid(eventId,'رویداد');mustUser();
    const rows=await request(restPath+'rpc/kanonha_event_summary',{
      method:'POST',requireUser:true,body:{p_event_id:eventId}
    });
    return readRows(rows)[0]||null;
  }
  async function secretaryEventExport(eventId){
    requireUuid(eventId,'رویداد');mustUser();
    const rows=[];
    for(let offset=0;offset<10000;offset+=500){
      const part=readRows(await request(restPath+
        'kanonha_registrations?select=id,user_id,event_id,status,attended_at,registered_at'+
        '&event_id=eq.'+encodeURIComponent(eventId)+'&order=registered_at.asc&limit=500&offset='+offset,
        {requireUser:true}));
      rows.push(...part);
      if(part.length<500)break;
    }
    const names=await secretaryProfiles(rows.map(r=>r.user_id));
    const people=new Map(names.map(p=>[p.user_id,p]));
    return {rows:rows.map(r=>({...r,student:people.get(r.user_id)||null})),
     summary:await eventSummary(eventId),truncated:rows.length>=10000};
  }
  /* ——— Secretary APIs: every request is additionally limited by Postgres RLS. ——— */
  function requireUuid(value, what = 'شناسه') {
    if (!uuid(value)) throw new ApiError(what + ' معتبر نیست.');
    return value;
  }
  function readRows(obj) {
    return Array.isArray(obj) ? obj : [];
  }
  function checkClubFields(input) {
    const name = String(input && input.name || '').trim();
    const description = String(input && input.description || '').trim();
    const category = String(input && input.category || '').trim();
    if (name.length < 2 || name.length > 120) throw new ApiError('نام کانون باید بین ۲ و ۱۲۰ نویسه باشد.');
    if (description.length > 2000 || !category || category.length > 80) throw new ApiError('توضیحات یا دسته‌بندی معتبر نیست.');
    return { name, description, category };
  }
  function checkEventFields(input) {
    const title = String(input && input.title || '').trim();
    const location = String(input && input.location || '').trim();
    const start = new Date(input && input.starts_at);
    const deadline = new Date(input && input.registration_deadline);
    const capacity = Number(input && input.capacity);
    if (title.length < 2 || title.length > 160 || location.length > 250) throw new ApiError('عنوان یا مکان رویداد معتبر نیست.');
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000) throw new ApiError('ظرفیت باید عدد مثبت باشد.');
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(deadline.getTime())
        || start.getTime() <= Date.now() || deadline.getTime() <= Date.now() || deadline > start)
      throw new ApiError('شروع و مهلت ثبت‌نام باید در آینده باشند و مهلت قبل از شروع باشد.');
    return {
      title, location, starts_at: start.toISOString(),
      registration_deadline: deadline.toISOString(), capacity,
      is_published: Boolean(input && input.is_published)
    };
  }
  async function secretaryClubs() {
    const userId = mustUser();
    const rows = await request(restPath + 'kanonha_secretaries?select=club_id,appointed_at&user_id=eq.'
      + encodeURIComponent(userId), { requireUser: true });
    return readRows(rows);
  }
  async function secretaryEvents(clubId) {
    requireUuid(clubId, 'کانون');
    return readRows(await request(restPath + 'kanonha_events?select=id,club_id,title,location,starts_at,registration_deadline,capacity,registered_count,is_published,approval_status,poster_path'
      + '&club_id=eq.' + encodeURIComponent(clubId) + '&order=starts_at.desc&limit=150', { requireUser: true }));
  }
  async function secretaryMemberships(clubId) {
    requireUuid(clubId, 'کانون');
    return readRows(await request(restPath + 'kanonha_memberships?select=id,user_id,club_id,status,requested_at'
      + '&club_id=eq.' + encodeURIComponent(clubId) + '&order=requested_at.desc&limit=300', { requireUser: true }));
  }
  async function secretaryProfiles(userIds) {
    if (!Array.isArray(userIds)) throw new ApiError('ورودی نامعتبر است.');
    const ids = [...new Set(userIds)];
    if (ids.length > 300 || ids.some(id => !uuid(id))) throw new ApiError('تعداد کاربران یا شناسه نامعتبر است.');
    const result = [];
    for (let i = 0; i < ids.length; i += 60) {
      const part = ids.slice(i, i + 60);
      const rows = await request(restPath + 'kanonha_profiles?select=user_id,full_name,student_number'
        + '&user_id=in.(' + part.map(encodeURIComponent).join(',') + ')', { requireUser: true });
      result.push(...readRows(rows));
    }
    return result;
  }
  async function secretaryUpdateClub(clubId, fields) {
    requireUuid(clubId, 'کانون');
    const rows = await request(restPath + 'kanonha_clubs?id=eq.' + encodeURIComponent(clubId), {
      method: 'PATCH', requireUser: true, headers: { Prefer: 'return=representation' },
      body: checkClubFields(fields)
    });
    if (!Array.isArray(rows) || rows.length !== 1) throw new ApiError('ویرایش کانون مجاز نبود.');
    return rows[0];
  }
  async function secretaryCreateEvent(clubId, fields) {
    requireUuid(clubId, 'کانون');
    const rows = await request(restPath + 'kanonha_events', {
      method: 'POST', requireUser: true, headers: { Prefer: 'return=representation' },
      body: { club_id: clubId, ...checkEventFields(fields) }
    });
    if (!Array.isArray(rows) || rows.length !== 1) throw new ApiError('ثبت رویداد انجام نشد.');
    return rows[0];
  }
  async function secretaryUpdateEvent(eventId, fields) {
    requireUuid(eventId, 'رویداد');
    const rows = await request(restPath + 'kanonha_events?id=eq.' + encodeURIComponent(eventId), {
      method: 'PATCH', requireUser: true, headers: { Prefer: 'return=representation' },
      body: checkEventFields(fields)
    });
    if (!Array.isArray(rows) || rows.length !== 1) throw new ApiError('ویرایش رویداد مجاز نبود یا ثبت‌نام شروع شده است.');
    return rows[0];
  }
  async function secretaryDecideMembership(memberId, status) {
    requireUuid(memberId, 'درخواست عضویت');
    if (!['approved', 'rejected'].includes(status)) throw new ApiError('وضعیت عضویت نامعتبر است.');
    const rows = await request(restPath + 'kanonha_memberships?id=eq.' + encodeURIComponent(memberId)
      + '&status=eq.pending', {
      method: 'PATCH', requireUser: true, headers: { Prefer: 'return=representation' },
      body: { status }
    });
    if (!Array.isArray(rows) || rows.length !== 1) throw new ApiError('درخواست قبلاً بررسی شده یا دسترسی ندارید.');
    return rows[0];
  }
  async function secretaryRoster(eventId) {
    requireUuid(eventId, 'رویداد');
    return readRows(await request(restPath + 'kanonha_registrations?select=id,user_id,event_id,status,attended_at,registered_at'
      + '&event_id=eq.' + encodeURIComponent(eventId) + '&order=registered_at.asc&limit=300', { requireUser: true }));
  }
  async function secretarySetAttendance(registrationId, attended) {
    requireUuid(registrationId, 'ثبت‌نام');
    if (typeof attended !== 'boolean') throw new ApiError('وضعیت حضور نامعتبر است.');
    const rows = await request(restPath + 'kanonha_registrations?id=eq.' + encodeURIComponent(registrationId), {
      method: 'PATCH', requireUser: true, headers: { Prefer: 'return=representation' },
      body: { attended_at: attended ? new Date().toISOString() : null }
    });
    if (!Array.isArray(rows) || rows.length !== 1) throw new ApiError('ثبت حضور مجاز نیست یا رویداد هنوز آغاز نشده است.');
    return rows[0];
  }
  /* v0.7: student login aliases are resolved only inside the rate-limited Edge Function. */
  async function edgeRequest(slug, body, privileged = false) {
    needConfig();
    if (privileged) mustUser();
    if (privileged) await refreshIfNeeded();
    const headers = {apikey:key,'Content-Type':'application/json',Accept:'application/json'};
    if (privileged) headers.Authorization = 'Bearer '+session.access_token;
    const controller = new AbortController();
    const timeout=setTimeout(()=>controller.abort(),20000);
    try {
      const response=await fetch(url+'/functions/v1/'+slug,{
        method:'POST',headers,body:JSON.stringify(body),
        signal:controller.signal,cache:'no-store'
      });
      const payload=await response.json();
      if(!response.ok)throw parseResponseError(payload,response.status);
      return payload;
    }catch(error){
      if(error instanceof ApiError)throw error;
      if(error&&error.name==='AbortError')throw new ApiError('پاسخ سرور دیر رسید. دوباره تلاش کنید.');
      throw new ApiError('اتصال به سرویس حساب کاربری برقرار نشد.');
    }finally{clearTimeout(timeout)}
  }
  function normalizeDigits(value) {
    return String(value || '').replace(/[۰-۹٠-٩]/g, c => {
      const fa='۰۱۲۳۴۵۶۷۸۹'.indexOf(c);
      return fa >= 0 ? String(fa) : String('٠١٢٣٤٥٦٧٨٩'.indexOf(c));
    });
  }
  function nationalIdValid(value) {
    if(!/^\d{10}$/.test(value) || /^(\d)\1{9}$/.test(value))return false;
    const check=[...value.slice(0,9)].reduce((sum,c,i)=>sum+Number(c)*(10-i),0)%11;
    return Number(value[9])===(check<2?check:11-check);
  }
  function registrationError(field,message) {
    throw new ApiError(message,422,field);
  }
  function validateStudentRegistration(fields) {
    const name=String(fields.name||'').trim();
    const studentNumber=normalizeDigits(fields.studentNumber).trim();
    const nationalId=normalizeDigits(fields.nationalId).trim();
    const mobile=normalizeDigits(fields.mobile).trim();
    const birthDate=String(fields.birthDate||'').trim();
    const university=String(fields.university||'').trim();
    const faculty=String(fields.faculty||'').trim();
    const major=String(fields.major||'').trim();
    const password=fields.password;
    if(name.length<2||name.length>80)
      registrationError('name','نام و نام خانوادگی باید بین ۲ تا ۸۰ نویسه باشد.');
    if(!/^\d{6,20}$/.test(studentNumber))
      registrationError('studentNumber','شماره دانشجویی باید بین ۶ تا ۲۰ رقم باشد.');
    if(!nationalIdValid(nationalId))
      registrationError('nationalId','کد ملی معتبر نیست؛ ۱۰ رقم و رقم کنترل آن را بررسی کنید.');
    if(!/^09\d{9}$/.test(mobile))
      registrationError('mobile','شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.');
    const date=new Date(birthDate+'T00:00:00Z');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)||
      Number.isNaN(date.getTime()) || date.toISOString().slice(0,10)!==birthDate ||
      date.getTime()>=Date.now() || date.getUTCFullYear()<1920)
      registrationError('birthDate','تاریخ تولد را به‌صورت شمسی و معتبر انتخاب کنید.');
    if(university.length<2||university.length>120)
      registrationError('university','دانشگاه را از فهرست انتخاب کنید.');
    if(faculty.length<2||faculty.length>120)
      registrationError('faculty','دانشکده مربوط به دانشگاه خود را انتخاب کنید.');
    if(major.length<2||major.length>120)
      registrationError('major','نام رشته تحصیلی باید بین ۲ تا ۱۲۰ نویسه باشد.');
    if(typeof password!=='string'||password.length<10||password.length>128)
      registrationError('password','رمز عبور باید حداقل ۱۰ و حداکثر ۱۲۸ نویسه باشد.');
    return {name,studentNumber,nationalId,birthDate,mobile,university,faculty,major,password};
  }
  async function studentSignUp(fields) {
    // Single source of field validation. Only normalized identifiers leave the device.
    const cleaned=validateStudentRegistration(fields);
    const response=await edgeRequest('kanonha-student-auth',{action:'register',...cleaned});
    if(!response||!response.session)throw new ApiError('نشست ثبت‌نام دریافت نشد.');
    setSession(response.session);
    const verified=await me();
    if(!verified||!uuid(verified.id))throw new ApiError('حساب ایجاد شد؛ دوباره وارد شوید.');
    return verified;
  }
  async function studentSignIn(kind,identifier,password) {
    if(!['student','national','auto'].includes(kind))throw new ApiError('روش ورود نامعتبر است.');
    const response=await edgeRequest('kanonha-student-auth',{action:'login',kind,
      identifier:normalizeDigits(identifier).trim(),password:String(password||'')});
    if(!response||!response.session)throw new ApiError('نشست ورود دریافت نشد.');
    setSession(response.session);
    return me();
  }
  async function managerSignUp(email,password) {
    if(cleanEmail(email)!=='hossean787@gmail.com')throw new ApiError('این بخش فقط برای مدیرکل تعریف شده است.');
    // Admin role is NOT created here; it requires verified mailbox ownership on server.
    const data=await request(authPath+'signup',{method:'POST',auth:false,body:{
      email:cleanEmail(email),password:checkPassword(password)
    }});
    if(data&&data.access_token&&data.refresh_token){setSession(data);await me();}
    return {confirmationRequired:!session};
  }
  async function isManager() {
    if(!user||!session)return false;
    const id=mustUser();
    const rows=await request(restPath+'kanonha_admins?select=user_id&user_id=eq.'+
      encodeURIComponent(id)+'&limit=1',{requireUser:true});
    return Array.isArray(rows)&&rows.length===1;
  }
  async function academicDetails() {
    const uid=mustUser();
    const rows=await request(restPath+'kanonha_academic_details?select=birth_date,university,faculty,major,mobile'
      +'&user_id=eq.'+encodeURIComponent(uid),{requireUser:true});
    return Array.isArray(rows)?rows[0]||null:null;
  }
  async function saveAcademicDetails(university,faculty,major,mobile) {
    const uid=mustUser();
    const fields={university:String(university||'').trim(),faculty:String(faculty||'').trim(),major:String(major||'').trim(),mobile:String(mobile||'').trim()};
    if(Object.values(fields).some(v=>v.length<2||v.length>120)||!/^09\d{9}$/.test(fields.mobile))
      throw new ApiError('مشخصات تحصیلی یا شماره موبایل معتبر نیست.');
    const rows=await request(restPath+'kanonha_academic_details?user_id=eq.'+encodeURIComponent(uid),{
      method:'PATCH',requireUser:true,headers:{Prefer:'return=representation'},body:fields
    });
    if(!Array.isArray(rows)||rows.length!==1)throw new ApiError('ذخیره مشخصات تحصیلی انجام نشد.');
    return rows[0];
  }
  async function adminAction(action,fields={}) {
    const result=await edgeRequest('kanonha-admin-console',{action,...fields},true);
    return result.result;
  }
  /* Five-star ratings: identity and one-vote constraint are enforced in Postgres. */
  async function ratingCatalog() {
    const rows=await request(restPath+
      'kanonha_rating_targets?select=id,category,title,subtitle,is_active'
      +'&is_active=eq.true&order=title.asc&limit=1000',{auth:false});
    return readRows(rows);
  }
  async function ratingControl() {
    const rows=await request(restPath+'kanonha_rating_control?select=id,voting_open,results_published&id=eq.1&limit=1',{auth:false});
    if(!Array.isArray(rows)||rows.length!==1) throw new ApiError('تنظیمات نظرسنجی دریافت نشد.');
    return {voting_open:rows[0].voting_open===true,
      results_published:rows[0].results_published===true};
  }
  async function ratingResults() {
    mustUser();
    const rows=await request(restPath+'rpc/kanonha_rating_results',{requireUser:true});
    return readRows(rows);
  }
  async function ratingSetControl(fields) {
    mustUser();
    const keys=Object.keys(fields||{});
    if(!keys.length||keys.some(k=>!['voting_open','results_published'].includes(k))||
       keys.some(k=>typeof fields[k]!=='boolean'))
      throw new ApiError('تنظیمات نظرسنجی نامعتبر است.');
    if(fields.voting_open===true&&fields.results_published===true)
      throw new ApiError('نتایج هنگام رأی‌گیری قابل انتشار نیست.');
    const rows=await request(restPath+'kanonha_rating_control?id=eq.1&select=id,voting_open,results_published',{
      method:'PATCH',requireUser:true,headers:{Prefer:'return=representation'},body:fields
    });
    if(!Array.isArray(rows)||rows.length!==1)
      throw new ApiError('فقط مدیرکل می‌تواند وضعیت نظرسنجی را تغییر دهد.');
    return rows[0];
  }
  async function ratingMyVotes() {
    const uid=mustUser();
    const rows=await request(restPath+
      'kanonha_ratings?select=target_id,stars&user_id=eq.'+encodeURIComponent(uid)
      +'&limit=1000',{requireUser:true});
    return readRows(rows);
  }
  async function ratingSubmit(targetId,stars) {
    const uid=mustUser();
    requireUuid(targetId,'مورد نظرسنجی');
    if(!Number.isInteger(stars)||stars<1||stars>5)
      throw new ApiError('امتیاز باید بین ۱ تا ۵ ستاره باشد.');
    try{
      await request(restPath+'kanonha_ratings',{
        method:'POST',requireUser:true,headers:{Prefer:'return=minimal'},
        body:{user_id:uid,target_id:targetId,stars}
      });
    }catch(error){
      if(error && error.status===409)
        throw new ApiError('برای این مورد قبلاً رأی ثبت شده است.',409);
      throw error;
    }
    return true;
  }
  async function ratingAddProfessor(title,subtitle='') {
    mustUser();
    const name=String(title||'').trim();
    const faculty=String(subtitle||'').trim();
    if(name.length<2||name.length>120||faculty.length>120)
      throw new ApiError('نام استاد یا دانشکده معتبر نیست.');
    const rows=await request(restPath+'kanonha_rating_targets?select=id,category,title,subtitle,is_active',{
      method:'POST',requireUser:true,headers:{Prefer:'return=representation'},
      body:{category:'professor',title:name,subtitle:faculty,is_active:true}
    });
    if(!Array.isArray(rows)||rows.length!==1)
      throw new ApiError('ثبت استاد مجاز نیست یا انجام نشد.');
    return rows[0];
  }

  /* Independent multi-survey API (v2): all authorization, one-vote rules,
     deadline checks and result confidentiality are enforced in Postgres. */
  function surveyCheckId(id) {
    requireUuid(id,'شناسه نظرسنجی');
    return id;
  }
  function surveyPayload(fields) {
    const title=String(fields.title||'').trim();
    const description=String(fields.description||'').trim();
    const category=String(fields.category||'');
    const kind=String(fields.kind||'');
    const ends_at=String(fields.ends_at||'');
    if(title.length<4||title.length>120||description.length>500||
       !['club','professor','faculty'].includes(category)||
       !['regular','competition'].includes(kind)||
       !Number.isFinite(Date.parse(ends_at))||Date.parse(ends_at)<=Date.now())
      throw new ApiError('عنوان، دسته، نوع یا مهلت پایان نظرسنجی معتبر نیست.');
    return {title,description,category,kind,ends_at:new Date(ends_at).toISOString()};
  }
  function surveyItems(items) {
    if(!Array.isArray(items)||items.length<1||items.length>12)
      throw new ApiError('برای هر نظرسنجی بین ۱ تا ۱۲ گزینه تعریف کنید.');
    const options=items.map(v=>String(v||'').trim());
    if(options.some(v=>v.length<2||v.length>120)||
       new Set(options.map(v=>v.toLocaleLowerCase('fa-IR'))).size!==options.length)
      throw new ApiError('گزینه‌ها باید معتبر، متفاوت و حداکثر ۱۲۰ نویسه باشند.');
    return options;
  }
  async function surveyList(includeDrafts=false) {
    const path=restPath+'kanonha_surveys?select=id,title,description,category,kind,status,starts_at,ends_at,results_approved,published_at,created_at,min_rank_votes,audience_university_id,audience_faculty_id,copied_from'
      +(includeDrafts?'':'&status=in.(published,paused,archived)')+'&order=created_at.desc&limit=200';
    return readRows(await request(path,{auth:includeDrafts}));
  }
  async function surveyOptions(ids) {
    if(!Array.isArray(ids)||!ids.length)return [];
    ids.forEach(surveyCheckId);
    const query='&survey_id=in.('+ids.map(encodeURIComponent).join(',')+')';
    return readRows(await request(restPath+'kanonha_survey_options?select=id,survey_id,source_id,title,sort_order'+
      query+'&order=sort_order.asc&limit=2400'));
  }
  async function surveyMyVotes() {
    mustUser();
    return readRows(await request(restPath+
      'kanonha_survey_votes?select=survey_id,option_id,stars&limit=1000',{requireUser:true}));
  }
  async function surveyResults(id) {
    surveyCheckId(id);mustUser();
    return readRows(await request(restPath+'rpc/kanonha_survey_results',{
      method:'POST',body:{p_survey_id:id},requireUser:true
    }));
  }
  async function surveyCreate(fields,items) {
    mustUser();
    const payload=surveyPayload(fields),options=surveyItems(items);
    const created=readRows(await request(restPath+'kanonha_surveys?select=id,title,category,kind,status,ends_at',{
      method:'POST',requireUser:true,headers:{Prefer:'return=representation'},body:payload
    }))[0];
    if(!created?.id)throw new ApiError('ساخت پیش‌نویس انجام نشد.');
    try {
      await request(restPath+'kanonha_survey_options',{
        method:'POST',requireUser:true,headers:{Prefer:'return=minimal'},
        body:options.map((title,sort_order)=>({survey_id:created.id,title,sort_order}))
      });
    } catch(error) {
      // No published poll or vote is affected. Attempt to remove an incomplete draft.
      try {await request(restPath+'kanonha_surveys?id=eq.'+created.id,{
        method:'DELETE',requireUser:true
      });}catch(_){}
      throw error;
    }
    return created;
  }
  async function surveyUpdateDraft(id,fields,items) {
    surveyCheckId(id);mustUser();
    const payload=surveyPayload(fields),options=surveyItems(items);
    const rows=readRows(await request(restPath+'kanonha_surveys?id=eq.'+id+
      '&status=eq.draft&select=id,status',{
      method:'PATCH',requireUser:true,headers:{Prefer:'return=representation'},body:payload
    }));
    if(rows.length!==1)throw new ApiError('فقط پیش‌نویس نظرسنجی قابل ویرایش است.');
    // All option edits are restricted server-side to the draft state.
    await request(restPath+'kanonha_survey_options?survey_id=eq.'+id,{
      method:'DELETE',requireUser:true
    });
    await request(restPath+'kanonha_survey_options',{
      method:'POST',requireUser:true,headers:{Prefer:'return=minimal'},
      body:options.map((title,sort_order)=>({survey_id:id,title,sort_order}))
    });
    return rows[0];
  }
  async function surveyPublish(id) {
    surveyCheckId(id);mustUser();
    const rows=readRows(await request(restPath+'kanonha_surveys?id=eq.'+id+
      '&status=eq.draft&select=id,status',{
      method:'PATCH',requireUser:true,headers:{Prefer:'return=representation'},
      body:{status:'published'}
    }));
    if(rows.length!==1)throw new ApiError('انتشار نظرسنجی انجام نشد.');
    return rows[0];
  }
  async function surveyApproveResults(id) {
    surveyCheckId(id);mustUser();
    const rows=readRows(await request(restPath+'kanonha_surveys?id=eq.'+id+
      '&select=id,results_approved',{
      method:'PATCH',requireUser:true,headers:{Prefer:'return=representation'},
      body:{results_approved:true}
    }));
    if(rows.length!==1)throw new ApiError('تأیید نتایج انجام نشد.');
    return rows[0];
  }
  async function surveyDeleteDraft(id) {
    surveyCheckId(id);mustUser();
    const rows=readRows(await request(restPath+'kanonha_surveys?id=eq.'+id+
      '&status=eq.draft&select=id',{
      method:'DELETE',requireUser:true,headers:{Prefer:'return=representation'}
    }));
    if(rows.length!==1)throw new ApiError('حذف پیش‌نویس مجاز نیست.');
    return true;
  }
  async function surveyVote(id,optionId,stars) {
    surveyCheckId(id);surveyCheckId(optionId);mustUser();
    if(!Number.isInteger(stars)||stars<1||stars>5)
      throw new ApiError('امتیاز باید بین ۱ تا ۵ ستاره باشد.');
    try {
      await request(restPath+'kanonha_survey_votes',{
        method:'POST',requireUser:true,headers:{Prefer:'return=minimal'},
        body:{survey_id:id,option_id:optionId,stars}
      });
    }catch(error) {
      if(error?.status===409)throw new ApiError('شما قبلاً در این نظرسنجی رأی داده‌اید.',409);
      throw error;
    }
    return true;
  }


  /* v2.1: atomic manager authoring, university targeting, authenticated catalog. */
  async function surveyCatalog(category) {
    mustUser();
    if(!['club','professor','faculty'].includes(category))throw new ApiError('دسته نامعتبر است.');
    return readRows(await request(restPath+'rpc/kanonha_survey_catalog',{
      method:'POST',requireUser:true,body:{p_category:category}
    }));
  }
  function surveyFormPayload(fields,sources) {
    if(!fields||typeof fields!=='object')throw new ApiError('فرم نظرسنجی معتبر نیست.');
    const title=String(fields.title||'').trim(),description=String(fields.description||'').trim();
    const category=String(fields.category||''),kind=String(fields.kind||'');
    const startsAt=Date.parse(fields.starts_at||'');
    const endsAt=Date.parse(fields.ends_at||'');
    const minVotes=Number(fields.min_rank_votes??5);
    const audienceUniversity=fields.audience_university_id||null;
    const audienceFaculty=fields.audience_faculty_id||null;
    if(title.length<4||title.length>120||description.length>500||
       !['club','professor','faculty'].includes(category)||
       !['regular','competition'].includes(kind)||
       !Number.isFinite(startsAt)||!Number.isFinite(endsAt)||
       endsAt<=Date.now()||startsAt>=endsAt||
       !Number.isInteger(minVotes)||minVotes<1||minVotes>100||
       (audienceFaculty&&!audienceUniversity))
      throw new ApiError('اطلاعات فرم، بازه زمانی یا مخاطبان معتبر نیست.');
    if(audienceUniversity)surveyCheckId(audienceUniversity);
    if(audienceFaculty)surveyCheckId(audienceFaculty);
    if(!Array.isArray(sources)||sources.length<1||sources.length>12||
       new Set(sources).size!==sources.length||
       sources.some(x=>!uuid(x)))
      throw new ApiError('بین ۱ تا ۱۲ گزینه واقعی و متفاوت از فهرست انتخاب کنید.');
    return {
      p_title:title,p_description:description,p_category:category,p_kind:kind,
      p_starts_at:new Date(startsAt).toISOString(),p_ends_at:new Date(endsAt).toISOString(),
      p_min_rank_votes:minVotes,p_university_id:audienceUniversity,
      p_faculty_id:audienceFaculty,p_sources:sources
    };
  }
  async function surveySaveV21(id,fields,sourceIds) {
    mustUser();
    if(id)surveyCheckId(id);
    const params={p_survey_id:id||null,...surveyFormPayload(fields,sourceIds)};
    const response=await request(restPath+'rpc/kanonha_survey_save',{
      method:'POST',requireUser:true,body:params
    });
    if(typeof response!=='string'||!uuid(response))
      throw new ApiError('شناسه نظرسنجی ذخیره‌شده دریافت نشد.');
    return response;
  }
  async function surveyDuplicate(id) {
    surveyCheckId(id);mustUser();
    const response=await request(restPath+'rpc/kanonha_survey_duplicate',{
      method:'POST',requireUser:true,body:{p_id:id}
    });
    if(typeof response!=='string'||!uuid(response))
      throw new ApiError('کپی نظرسنجی ایجاد نشد.');
    return response;
  }
  async function surveyChangeStatus(id,status) {
    surveyCheckId(id);mustUser();
    if(!['cancelled','archived','paused','published'].includes(status))throw new ApiError('وضعیت نامعتبر است.');
    const rows=readRows(await request(restPath+'kanonha_surveys?id=eq.'+id+
      '&status=in.(published,paused)&select=id,status',{
      method:'PATCH',requireUser:true,headers:{Prefer:'return=representation'},body:{status}
    }));
    if(rows.length!==1)throw new ApiError('لغو یا بایگانی نظرسنجی مجاز نیست.');
    return rows[0];
  }
  async function surveyParticipation(id) {
    surveyCheckId(id);mustUser();
    const result=readRows(await request(restPath+'rpc/kanonha_survey_participation',{
      method:'POST',requireUser:true,body:{p_id:id}
    }));
    return result[0]||{eligible_students:0,voters:0};
  }
  async function surveyAudit(limit=60) {
    mustUser();
    const safe=Math.max(1,Math.min(100,Number(limit)||60));
    return readRows(await request(restPath+
      'kanonha_survey_audit?select=id,survey_id,actor_id,action,occurred_at,info'+
      '&order=occurred_at.desc&limit='+safe,{requireUser:true}));
  }

  window.KanonhaBackend = Object.freeze({
    enabled, signUp, signIn, signOut, me, profile, ensureProfile,
    saveProfile, clubs, events, memberships, registrations,
    joinClub, reapplyClub, cancelClubMembership, clubLogoUrl, secretaryUploadClubLogo,
    registerEvent, cancelEvent, eventPosterUrl, uploadEventPoster, checkInTicket,
    eventSummary, secretaryEventExport, secretaryClubs, secretaryEvents, secretaryMemberships,
    secretaryProfiles, secretaryUpdateClub, secretaryCreateEvent, secretaryUpdateEvent,
    secretaryDecideMembership, secretaryRoster, secretarySetAttendance,
    studentSignUp,studentSignIn,managerSignUp,isManager,academicDetails,saveAcademicDetails,adminAction,
    academicCatalog,resumeFromBiometric,biometricRefreshToken,
    ratingCatalog,ratingControl,ratingResults,ratingSetControl,ratingMyVotes,ratingSubmit,ratingAddProfessor,
    surveyList,surveyOptions,surveyMyVotes,surveyResults,surveyCreate,surveyUpdateDraft,
    surveyPublish,surveyApproveResults,surveyDeleteDraft,surveyVote,
    surveyCatalog,surveySaveV21,surveyDuplicate,surveyChangeStatus,surveyParticipation,surveyAudit,
    get currentUser() { return user; }
  });
})();
