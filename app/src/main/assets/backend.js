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
    constructor(message, status = 0) {
      super(String(message).slice(0, 280));
      this.name = 'KanonhaApiError';
      this.status = status;
    }
  }
  const needConfig = () => { if (!enabled) throw new ApiError('اتصال آنلاین برای کانون‌ها پیکربندی نشده است.'); };
  const uuid = (value) => /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value || '');
  const authPath = '/auth/v1/';
  const restPath = '/rest/v1/';
  function parseResponseError(obj, status) {
    const message = obj && typeof obj === 'object' &&
      (obj.msg || obj.error_description || obj.message || obj.error || obj.hint);
    return new ApiError(typeof message === 'string' ? message : 'پاسخ نامعتبر سرور', status);
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
  async function signOut() {
    try {
      if (session) await request(authPath + 'logout', { method: 'POST', requireUser: true });
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
    const rows = await request(restPath + 'kanonha_profiles?on_conflict=user_id', {
      method: 'POST', requireUser: true,
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: { user_id, ...fields }
    });
    return Array.isArray(rows) ? rows[0] : null;
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
  window.KanonhaBackend = Object.freeze({
    enabled, signUp, signIn, signOut, me, profile, ensureProfile,
    saveProfile, clubs, events, memberships, registrations,
    joinClub, registerEvent, get currentUser() { return user; }
  });
})();
