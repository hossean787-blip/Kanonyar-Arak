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
    } finally { session = null; user = null; }
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
    const rows = await request(restPath + 'kanonha_clubs?select=id,name,description,category&is_active=eq.true&order=name.asc', { auth: false });
    return Array.isArray(rows) ? rows : [];
  }
  async function events() {
    const rows = await request(restPath + 'kanonha_events?select=id,club_id,title,starts_at,registration_deadline,location,capacity,registered_count&is_published=eq.true&order=starts_at.asc', { auth: false });
    return Array.isArray(rows) ? rows : [];
  }
  async function memberships() {
    const user_id = mustUser();
    const rows = await request(restPath + 'kanonha_memberships?select=club_id,status&user_id=eq.' + encodeURIComponent(user_id), { requireUser: true });
    return Array.isArray(rows) ? rows : [];
  }
  async function registrations() {
    const user_id = mustUser();
    const rows = await request(restPath + 'kanonha_registrations?select=event_id,status&user_id=eq.' + encodeURIComponent(user_id), { requireUser: true });
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
  async function registerEvent(eventId) {
    if (!uuid(eventId)) throw new ApiError('رویداد معتبر نیست.');
    return request(restPath + 'kanonha_registrations', {
      method: 'POST', requireUser: true,
      headers: { Prefer: 'return=minimal' },
      body: { user_id: mustUser(), event_id: eventId }
    });
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
    return readRows(await request(restPath + 'kanonha_events?select=id,club_id,title,location,starts_at,registration_deadline,capacity,registered_count,is_published'
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
      'kanonha_rating_targets?select=id,category,title,subtitle,rating_count,rating_sum'
      +'&is_active=eq.true&order=title.asc&limit=1000',{auth:false});
    return readRows(rows);
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
    const rows=await request(restPath+'kanonha_rating_targets',{
      method:'POST',requireUser:true,headers:{Prefer:'return=representation'},
      body:{category:'professor',title:name,subtitle:faculty,is_active:true}
    });
    if(!Array.isArray(rows)||rows.length!==1)
      throw new ApiError('ثبت استاد مجاز نیست یا انجام نشد.');
    return rows[0];
  }
  window.KanonhaBackend = Object.freeze({
    enabled, signUp, signIn, signOut, me, profile, ensureProfile,
    saveProfile, clubs, events, memberships, registrations,
    joinClub, registerEvent, secretaryClubs, secretaryEvents, secretaryMemberships,
    secretaryProfiles, secretaryUpdateClub, secretaryCreateEvent, secretaryUpdateEvent,
    secretaryDecideMembership, secretaryRoster, secretarySetAttendance,
    studentSignUp,studentSignIn,managerSignUp,isManager,academicDetails,saveAcademicDetails,adminAction,
    academicCatalog,resumeFromBiometric,biometricRefreshToken,
    ratingCatalog,ratingMyVotes,ratingSubmit,ratingAddProfessor,
    get currentUser() { return user; }
  });
})();
