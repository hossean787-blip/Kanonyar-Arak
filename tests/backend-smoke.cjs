'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const base = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(base, 'app/src/main/assets/backend.js'), 'utf8');
const cfg = fs.readFileSync(path.join(base, 'app/src/main/assets/config.js'), 'utf8');
const sql = fs.readFileSync(path.join(base, 'supabase/schema-v040.sql'), 'utf8');
const manifest = fs.readFileSync(path.join(base, 'app/src/main/AndroidManifest.xml'), 'utf8');
assert.match(manifest, /android.permission.INTERNET/);
assert.match(cfg, /url:\s*'https:\/\/cnqcysnjinghzzrzanpj\.supabase\.co'/);
assert.match(cfg, /publishableKey:\s*'sb_publishable_[A-Za-z0-9_-]+'/);
assert.doesNotMatch(cfg, /publishableKey:\s*['\"](?:sb_secret_|service_role)/i, 'configuration must not embed privileged keys');
assert.doesNotMatch(cfg + code, /service_role\s*[:=]\s*['"][^'"]{5}/i);
for (const table of ['profiles','clubs','events','memberships','registrations']) {
  assert.match(sql, new RegExp('alter table public\\.kanonha_' + table + ' enable row level security', 'i'));
}
assert.match(sql, /security definer/i);
assert.match(sql, /schema if not exists kanonha_private/i);
assert.match(sql, /registered_count\s*=\s*registered_count\s*\+\s*1/i);
assert.match(sql, /registered_count\s*<\s*capacity/i);
assert.match(sql, /unique\s*\(user_id,\s*event_id\)/i);
assert.match(sql, /grant insert \(user_id,\s*event_id\)/i);
assert.doesNotMatch(sql, /grant\s+(all|delete|update)\s+on\s+public\.kanonha_registrations\s+to\s+authenticated/i);

const id = 'af2c8d5d-ab17-4c54-aa22-11b572ad918a';
const club = '3b45d692-201b-4111-b25e-029c0bc82e62';
const event = '6afeed89-2d61-4216-b103-c28e80c85e7e';
const responses = [];
let storedProfile = { full_name: 'دانشجو', student_number: '123456', university_verified: false };
function ok(data, status = 200) {
  return { ok: status >= 200 && status < 300, status,
    async text() { return data === undefined ? '' : JSON.stringify(data); } };
}
async function fakeFetch(url, options) {
  responses.push({ url, method: options.method, headers: options.headers, body: options.body && JSON.parse(options.body) });
  if (url.endsWith('/auth/v1/token?grant_type=password'))
    return ok({ access_token: 'test-token', refresh_token: 'test-refresh', expires_in: 3600, user: { id } });
  if (url.endsWith('/auth/v1/user')) return ok({ id, email: 'test@sample.org', user_metadata: {} });
  if (url.endsWith('/auth/v1/logout')) return ok(undefined, 204);
  if (url.includes('/rest/v1/kanonha_clubs?'))
    return ok([{ id: club, name: 'کانون آزمایشی', description: '', category: 'فرهنگی' }]);
  if (url.includes('/rest/v1/kanonha_events?'))
    return ok([{ id: event, title: 'رویداد آزمایشی', registered_count: 0 }]);
  if (url.includes('/rest/v1/kanonha_profiles?select='))
    return ok(storedProfile ? [storedProfile] : []);
  if (url.endsWith('/rest/v1/kanonha_profiles') && options.method === 'POST') {
    assert.equal(options.headers.Prefer, 'return=representation');
    storedProfile = { ...JSON.parse(options.body), university_verified: false };
    return ok([storedProfile], 201);
  }
  if (url.includes('/rest/v1/kanonha_profiles?user_id=eq.') && options.method === 'PATCH') {
    assert.deepEqual(Object.keys(JSON.parse(options.body)).sort(), ['full_name']);
    storedProfile = { ...storedProfile, ...JSON.parse(options.body) };
    return ok([storedProfile]);
  }
  if (url.includes('/rest/v1/kanonha_memberships?select=')) return ok([]);
  if (url.includes('/rest/v1/kanonha_registrations?select=')) return ok([]);
  if (url.endsWith('/rest/v1/kanonha_memberships')) return ok(undefined, 201);
  if (url.endsWith('/rest/v1/kanonha_registrations')) return ok(undefined, 201);
  if (url.endsWith('/auth/v1/signup')) return ok({ user: { id } });
  if (url.endsWith('/rest/v1/rpc/kanonha_survey_save')) return ok('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  throw new Error('unexpected path: ' + url);
}
function createClient(config) {
  const window = { KANONHA_CONFIG: config };
  const ctx = { window, fetch: fakeFetch, AbortController, Date, setTimeout, clearTimeout };
  vm.runInNewContext(code, ctx, { filename: 'backend.js', timeout: 2000 });
  return window.KanonhaBackend;
}
(async () => {
  const disabled = createClient({ url: '', publishableKey: '' });
  assert.equal(disabled.enabled, false);
  await assert.rejects(() => disabled.clubs(), /پیکربندی نشده/);
  const online = createClient({
    url: 'https://kanonha-test.supabase.co',
    publishableKey: 'sb_publishable_testonly'
  });
  assert.equal(online.enabled, true);
  await online.clubs();
  const first = responses.at(-1);
  assert.equal(first.headers.apikey, 'sb_publishable_testonly');
  assert.equal(first.headers.Authorization, undefined, 'no anon token expected');
  await assert.rejects(() => online.joinClub(club), /وارد حساب/);
  await assert.rejects(() => online.signIn('bademail', '12345678'), /ایمیل/);
  await online.signIn('test@sample.org', 'eight-characters');
  assert.equal(online.currentUser.id, id);
  assert.equal((await online.profile()).student_number, '123456');
  await online.saveProfile('دانشجوی تازه', '123456');
  const updated = responses.findLast(r => r.method === 'PATCH' && r.url.includes('/kanonha_profiles?user_id=eq.'));
  assert.ok(updated, 'existing profile must be PATCHed rather than upserted');
  assert.equal(updated.body.user_id, undefined, 'primary key must never be updated');
  storedProfile = null;
  const created = await online.saveProfile('دانشجوی جدید', '987654');
  assert.equal(created.student_number, '987654');
  const inserted = responses.findLast(r => r.method === 'POST' && r.url.endsWith('/kanonha_profiles'));
  assert.equal(inserted.body.user_id, id, 'new profile must belong to authenticated user');
  assert.ok(!responses.some(r => r.url.includes('on_conflict=')), 'unsafe upsert must never be called');
  await online.memberships();
  await online.registrations();
  await online.joinClub(club);
  await online.registerEvent(event);
  const register = responses.find(r => r.url.endsWith('/rest/v1/kanonha_registrations'));
  assert.deepEqual(register.body, { user_id: id, event_id: event });
  assert.equal(register.headers.Authorization, 'Bearer test-token');
  await assert.rejects(() => online.registerEvent('not-a-uuid'), /معتبر نیست/);
  await assert.rejects(() => online.saveProfile('A', 'wrong-number'), /نام و نام/);
  const future=new Date(Date.now()+7*86400000).toISOString();
  const surveyFields={title:'ارزیابی یک استاد',description:'',category:'professor',
    kind:'regular',starts_at:new Date(Date.now()+60000).toISOString(),
    ends_at:future,min_rank_votes:1};
  const saved=await online.surveySaveV21(null,surveyFields,[club]);
  assert.equal(saved,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  const rpc=responses.findLast(r=>r.url.endsWith('/rest/v1/rpc/kanonha_survey_save'));
  assert.deepEqual(rpc.body.p_sources,[club],'one catalog option must reach the RPC');
  assert.equal(rpc.body.p_starts_at,null,'regular poll omits start');
  assert.equal(rpc.body.p_ends_at,null,'regular poll omits end');
  const competitionFields={...surveyFields,kind:'competition'};
  await assert.rejects(()=>online.surveySaveV21(null,
    {...competitionFields,starts_at:null,ends_at:null},[club]),/بازه زمانی/);
  await assert.rejects(()=>online.surveySaveV21(null,
    {...competitionFields,starts_at:future,ends_at:future},[club]),/بازه زمانی/);
  await online.surveySaveV21(null,competitionFields,[club]);
  const contestRpc=responses.findLast(r=>r.url.endsWith('/rest/v1/rpc/kanonha_survey_save'));
  assert.equal(typeof contestRpc.body.p_starts_at,'string');
  assert.equal(typeof contestRpc.body.p_ends_at,'string');
  await assert.rejects(()=>online.surveySaveV21(null,surveyFields,[]),/۱ تا ۱۲/);
  await assert.rejects(()=>online.surveySaveV21(null,surveyFields,[club,club]),/۱ تا ۱۲/);
  await online.signOut();
  assert.equal(online.currentUser, null);
  await assert.rejects(() => online.registrations(), /وارد حساب/);
  const newClient = createClient({ url: 'https://kanonha-test.supabase.co', publishableKey: 'sb_publishable_testonly' });
  const result = await newClient.signUp('test@sample.org', 'strongpassword', 'دانشجو نمونه', '123456');
  assert.equal(result.confirmationRequired, true);
  console.log('PASS: RLS-compatible profile insert/update, auth, catalog, membership, registration and logout');
})().catch(error => { console.error(error); process.exitCode = 1; });
