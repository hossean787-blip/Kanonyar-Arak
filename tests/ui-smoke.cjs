'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const base = path.join(root, 'app/src/main');
const read = (file) => fs.readFileSync(path.join(base, file), 'utf8');
const html = read('assets/index.html');
const js = read('assets/app.js');
const css = read('assets/styles.css');
const manifest = read('AndroidManifest.xml');
const nativeActivity = read('java/ir/kanonha/app/MainActivity.java');
const nativeCalendar = read('java/ir/kanonha/app/DailyCalendarReceiver.java');
const notificationLayout = read('res/layout/notification_jalali.xml');
const notificationBackground = read('res/drawable/calendar_notice_background.xml');
const notificationBadge = read('res/drawable/calendar_notice_badge.xml');
const pages = ['home', 'clubs', 'events', 'ratings', 'activity', 'profile'];

for (const page of pages) {
  assert.ok(html.includes('id="screen-' + page + '"'), 'missing page: ' + page);
  assert.ok(html.includes('data-screen="' + page + '"'), 'missing navigation target: ' + page);
  assert.ok(fs.existsSync(path.join(base, 'assets/assets/nav-' + page + '.svg')));
}
assert.match(manifest, /android:label="\$\{appLabel\}"/);
const gradle = fs.readFileSync(path.join(root, 'app/build.gradle.kts'), 'utf8');
assert.match(gradle, /applicationIdSuffix = "\.test"/, 'Debug app must install next to the original');
assert.match(gradle, /manifestPlaceholders\["appLabel"\] = "کانون‌ها آزمایشی"/);
assert.match(html, /<title>کانون‌ها \| اپ مستقل دانشجویی<\/title>/);
assert.doesNotMatch(html, /student-calendar\.(?:js|css)/, 'Jalali calendar must appear only in persistent Android notification');
assert.match(nativeCalendar, /setOngoing\(true\)/, 'persistent notification must remain enabled');
assert.doesNotMatch(notificationLayout, /calendar_label|تقویم دانشجویی|کانون‌ها/, 'custom notification must show only the date');
assert.doesNotMatch(nativeCalendar, /setContentTitle\("تقویم دانشجویی"\)/, 'fallback notification must show only the date');
assert.match(nativeCalendar, /\.setContentTitle\(today\(\)\)/, 'notification fallback title is the Persian date');
assert.match(notificationLayout, /calendar_date/, 'Persian date text must exist');
assert.match(notificationLayout, /#252E76/i, 'use the app navy date text');
assert.match(notificationBackground, /#EFF1FC/i, 'use the app purple and white palette');
assert.match(notificationBadge, /#7581DB/i, 'day badge must not be green');
assert.doesNotMatch(notificationBackground+notificationBadge, /#137747|#50C878/i, 'old green is not allowed');
assert.match(nativeCalendar, /setTextSize\(84f\)/, 'status day icon should be maximized');
assert.match(nativeCalendar, /measureText\(text\)/, 'fit two-digit Persian day numbers to small icon');
assert.match(nativeCalendar, /setCustomContentView\(view\)/, 'custom Jalali notification must remain enabled');
assert.match(html, /رویدادهای نمونه/);
assert.doesNotMatch(html, /صدای دانشجو/, 'the former survey label must be removed');
assert.doesNotMatch(html, /ratings-home-entry/, 'survey must not have a home promo card');
assert.match(html, /<h1 id="title-ratings">نظرسنجی<\/h1>/, 'survey route title');
assert.match(js, /id: 'ratings',\s+label: 'نظرسنجی'/, 'surveys must be in the student bottom navigation');
for (const content of [html, css, manifest]) {
  assert.doesNotMatch(content, /همراه|hamrah/i, 'companion branding leaked into new app');
}
assert.doesNotMatch(js, /دی ۱۴۰۳/, 'old demo event dates must not be labeled current');
assert.match(js, /onlineMode \? 'ثبت‌نام باز' : 'ثبت‌نام آزمایشی'/, 'status must distinguish live and demo events');
assert.match(js, /'kanonha-ui-v3'/);
assert.match(nativeActivity, /KanonhaPreview\.handleBack\(\)/);
for (const res of [
  'drawable/ic_kanonha_foreground.xml',
  'mipmap-anydpi-v26/ic_launcher.xml',
  'mipmap-anydpi-v26/ic_launcher_round.xml'
]) assert.ok(fs.existsSync(path.join(base, 'res', res)), 'missing icon resource: ' + res);
assert.match(read('res/mipmap-anydpi-v26/ic_launcher.xml'), /ic_kanonha_foreground/);

const ids = Array.from(html.matchAll(/\bid="([^"]+)"/g), m => m[1]);
const nodes = new Map();
const eventHandlers = {};
class FakeElement {
  constructor(id) {
    this.id = id;
    this.dataset = id.startsWith('screen-') ? { screen: id.slice(7) } : {};
    this.hidden = id === 'sheet-overlay' || id === 'toast' || (id.startsWith('screen-') && id !== 'screen-home');
    this.innerHTML = '';
    this.textContent = '';
    this.value = '';
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.listeners = {};
    this.isConnected = true;
  }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  querySelectorAll(selector) {
    if (this.id !== 'home-events' || selector !== '.home-event-slide') return [];
    const count = (this.innerHTML.match(/class="home-event-slide"/g) || []).length;
    return Array.from({ length: count }, () => ({
      getBoundingClientRect() { return { width: 244 }; },
      scrollIntoView() {}
    }));
  }
  focus() {}
}
for (const id of ids) nodes.set(id, new FakeElement(id));
const get = (id) => {
  assert.ok(nodes.has(id), 'script accessed missing element: ' + id);
  return nodes.get(id);
};
const location = { hash: '', search: '?native=1' };
const storage = new Map();
const document = {
  readyState: 'complete',
  body: { classList: { add() {} } },
  activeElement: { isConnected: true, focus() {} },
  getElementById: get,
  querySelectorAll(selector) {
    return selector === '.screen' ? pages.map(page => get('screen-' + page)) : [];
  },
  addEventListener(name, handler) { eventHandlers[name] = handler; }
};
const window = { location, addEventListener() {} };
const context = {
  document,
  window,
  location,
  URLSearchParams,
  history: { replaceState(_state, _title, hash) { location.hash = hash; } },
  localStorage: {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); }
  },
  requestAnimationFrame(callback) { callback(); },
  setTimeout() { return 1; },
  clearTimeout() {},
  console
};
vm.runInNewContext(js, context, { filename: 'app.js', timeout: 2500 });
const app = window.KanonhaPreview;
assert.ok(app, 'app did not initialize');
assert.equal(app.screen, 'home');
assert.match(get('bottom-nav').innerHTML, /data-screen-btn="ratings"/, 'surveys must appear in bottom navigation');
assert.match(get('bottom-nav').innerHTML, /nav-ratings.svg/, 'surveys must have a dedicated icon');
assert.equal((get('bottom-nav').innerHTML.match(/data-screen-btn=/g)||[]).length, 6, 'student navigation must have six routes');
assert.equal(app.state.registered.length, 0, 'demo should not pre-register a user');
assert.equal(app.state.joined.length, 0, 'demo should not pre-join a club');
for (const page of pages) {
  app.go(page);
  assert.equal(app.screen, page, 'navigation failed: ' + page);
  for (const other of pages) {
    assert.equal(get('screen-' + other).hidden, other !== page, 'incorrect visible page: ' + other);
  }
}
assert.equal(app.handleBack(), true, 'back should return from profile to Home');
assert.equal(app.screen, 'home');
assert.equal(app.handleBack(), false, 'back on Home should fall through to Android');
const click = (dataset) => eventHandlers.click({ target: { closest() { return { dataset }; } } });
app.go('events');
click({ details: '0' });
assert.equal(get('sheet-overlay').hidden, false, 'event sheet did not open');
assert.equal(app.handleBack(), true, 'back should first close the sheet');
assert.equal(get('sheet-overlay').hidden, true);
assert.equal(app.screen, 'events', 'closing sheet changed active tab');
click({ register: '0' });
assert.equal(app.state.registered.length, 1, 'demo registration failed');
click({ register: '0' });
assert.equal(app.state.registered.length, 1, 'duplicate registration created');
click({ join: '3' });
assert.equal(app.state.joined.length, 1, 'demo membership failed');
assert.ok(storage.has('kanonha-ui-v3'), 'demo state not persisted locally');
app.reset();
assert.equal(app.state.registered.length, 0, 'reset did not clear registrations');
assert.equal(app.state.joined.length, 0, 'reset did not clear memberships');
console.log('PASS: 5 screens, independent identity, demo state, registration, membership, sheet, Android back and reset');
