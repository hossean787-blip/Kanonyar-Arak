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
assert.match(cfg, /publishableKey:\s*''/);
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
    return ok([{ full_name: 'دانشجو', student_number: '123456', university_verified: false }]);
  if (url.includes('/rest/v1/kanonha_profiles?on_conflict='))
    return ok([{ full_name: 'دانشجو', student_number: '123456' }]);
  if (url.includes('/rest/v1/kanonha_memberships?select=')) return ok([]);
  if (url.includes('/rest/v1/kanonha_registrations?select=')) return ok([]);
  if (url.endsWith('/rest/v1/kanonha_memberships')) return ok(undefined, 201);
  if (url.endsWith('/rest/v1/kanonha_registrations')) return ok(undefined, 201);
  if (url.endsWith('/auth/v1/signup')) return ok({ user: { id } });
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
  await online.saveProfile('دانشجو', '123456');
  await online.memberships();
  await online.registrations();
  await online.joinClub(club);
  await online.registerEvent(event);
  const register = responses.find(r => r.url.endsWith('/rest/v1/kanonha_registrations'));
  assert.deepEqual(register.body, { user_id: id, event_id: event });
  assert.equal(register.headers.Authorization, 'Bearer test-token');
  await assert.rejects(() => online.registerEvent('not-a-uuid'), /معتبر نیست/);
  await assert.rejects(() => online.saveProfile('A', 'wrong-number'), /نام و نام/);
  await online.signOut();
  assert.equal(online.currentUser, null);
  await assert.rejects(() => online.registrations(), /وارد حساب/);
  const newClient = createClient({ url: 'https://kanonha-test.supabase.co', publishableKey: 'sb_publishable_testonly' });
  const result = await newClient.signUp('test@sample.org', 'strongpassword', 'دانشجو نمونه', '123456');
  assert.equal(result.confirmationRequired, true);
  console.log('PASS: disabled guard, online public catalog, auth, profile, private RLS requests, registration and logout');
})().catch(error => { console.error(error); process.exitCode = 1; });
