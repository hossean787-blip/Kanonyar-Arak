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
const pages = ['home', 'clubs', 'events', 'activity', 'profile'];

for (const page of pages) {
  assert.ok(html.includes('id="screen-' + page + '"'), 'missing page: ' + page);
  assert.ok(html.includes('data-screen="' + page + '"'), 'missing navigation target: ' + page);
  assert.ok(fs.existsSync(path.join(base, 'assets/assets/nav-' + page + '.svg')));
}
assert.match(manifest, /android:label="کانون‌ها"/);
assert.match(html, /<title>کانون‌ها \| اپ مستقل دانشجویی<\/title>/);
assert.match(html, /رویدادهای نمونه/);
for (const content of [html, css, manifest]) {
  assert.doesNotMatch(content, /همراه|hamrah/i, 'companion branding leaked into new app');
}
assert.doesNotMatch(js, /دی ۱۴۰۳|ثبت‌نام باز/);
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
