'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const base = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(base, 'app/src/main/assets/index.html'), 'utf8');
const code = fs.readFileSync(path.join(base, 'app/src/main/assets/app.js'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const clubId = '3b45d692-201b-4111-b25e-029c0bc82e62';
const eventId = '6afeed89-2d61-4216-b103-c28e80c85e7e';
const studentId = 'af2c8d5d-ab17-4c54-aa22-11b572ad918a';
const pages = ['home','clubs','club-detail','events','activity','profile'];
// Deliberately adversarial catalog strings supplied by a mocked backend.
const untrustedClub = '<img src=x onerror=alert(1)> کانون';
const untrustedEvent = '<svg onload=alert(2)> نشست';
const untrustedLocation = '<iframe src=javascript:alert(3)></iframe>';
class E {
  constructor(id) {
    this.id = id; this.value = ''; this.innerHTML = ''; this.textContent = '';
    this.dataset = id.startsWith('screen-') ? {screen:id.slice(7)} : {};
    this.hidden = ['sheet-overlay','toast','online-auth-panel','online-connection'].includes(id) ||
      (id.startsWith('screen-') && id !== 'screen-home');
    this.disabled = false; this.required = false; this.isConnected = true;
    this.classList = { toggle() {}, add() {} }; this.events = {};
  }
  addEventListener(event, cb) { this.events[event] = cb; }
  setAttribute(name,value) { this[name]=value; }
  querySelectorAll(selector) {
    if (selector === '.online-signup-only') return [new E('signup-fields')];
    if (selector !== '.home-event-slide' || this.id !== 'home-events') return [];
    return Array.from({length:(this.innerHTML.match(/class="home-event-slide"/g)||[]).length},
      () => ({getBoundingClientRect:()=>({width:244}),scrollIntoView(){}}));
  }
  focus() {}
}
const nodes = new Map(ids.map(id => [id,new E(id)]));
const get = id => { assert.ok(nodes.has(id), 'missing node: ' + id); return nodes.get(id); };
const eventHandlers = {};
const location = { search: '?native=1', hash: '' };
const doc = {
  readyState:'complete', getElementById:get,
  querySelectorAll: selector => selector === '.screen' ? pages.map(id => get('screen-'+id)) : [],
  activeElement:{isConnected:true,focus(){}},
  body:{classList:{add(){}}},
  addEventListener: (name, cb) => { eventHandlers[name] = cb; }
};
let currentUser = null, memberRows = [], eventRows = [], seats = 0;
const actions = { joins:0, cancellations:0, reapplies:0, registrations:0, eventCancellations:0 };
const backend = {
  enabled:true,
  get currentUser() { return currentUser; },
  async clubs() { return [{id:clubId,name:untrustedClub,description:untrustedClub,category:'فرهنگی'}]; },
  async events() { return [{
    id:eventId,club_id:clubId,title:untrustedEvent,
    starts_at:'2035-05-01T10:00:00Z',registration_deadline:'2035-04-30T10:00:00Z',
    location:untrustedLocation,capacity:3,registered_count:seats
  }]; },
  async signIn() { currentUser = {id:studentId}; return currentUser; },
  async studentSignIn() { currentUser = {id:studentId}; return currentUser; },
  async studentSignUp() { currentUser = {id:studentId}; return currentUser; },
  async isManager() { return false; },
  async academicDetails() { return {university:'دانشگاه نمونه',faculty:'دانشکده نمونه',major:'رشته نمونه'}; },
  async signOut() { currentUser = null; },
  async ensureProfile() { return {full_name:'دانشجوی نمونه',student_number:'123456'}; },
  async memberships() { return memberRows; },
  async registrations() { return eventRows; },
  async myClubMemberships() { return memberRows.map(m=>({
    club_id:m.club_id,club_name:untrustedClub,category:'فرهنگی',
    university:'دانشگاه نمونه',status:m.status,is_active:true
  })); },
  async myEventHistory() { return eventRows.map(r=>({
    registration_id:'a0b5a40b-98a3-4bab-8cd8-a9fcaf0dd422',event_id:r.event_id,
    event_title:untrustedEvent,event_location:untrustedLocation,
    event_starts_at:'2035-05-01T10:00:00Z',ticket_expires_at:'2035-05-08T10:00:00Z',
    club_name:untrustedClub,status:r.status,attended_at:null,ticket_token:r.ticket_token||null
  })); },
  async myCertificates() { return []; },
  async joinClub(id) { assert.equal(id,clubId); actions.joins++; memberRows=[{club_id:id,status:'pending'}]; },
  async reapplyClub(id) { assert.equal(id,clubId); actions.reapplies++; memberRows=[{club_id:id,status:'pending'}]; },
  async cancelClubMembership(id) { assert.equal(id,clubId); actions.cancellations++; memberRows=[]; },
  async registerEvent(id) { assert.equal(id,eventId); actions.registrations++; eventRows=[{event_id:id,status:'confirmed'}]; seats++; },
  async cancelEvent(id) { assert.equal(id,eventId); actions.eventCancellations++; eventRows=[]; seats--; },
  async saveProfile(name,number) { return {full_name:name,student_number:number}; }
};
const window = { KanonhaBackend:backend, addEventListener() {}, location };
const previousDemo = JSON.stringify({joined:[0],registered:[0],name:'حساب نمایشی قدیمی',number:'111111'});
const storage = new Map([['kanonha-ui-v3', previousDemo]]);
const ctx = {
  window,document:doc,location,URLSearchParams,Date,
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  history:{replaceState(_a,_b,h){location.hash=h;}},FormData:class {constructor(form){this.data=form.fields;}get(k){return this.data[k];}},
  requestAnimationFrame:fn=>fn(),setTimeout:()=>1,clearTimeout() {},console
};
const activityCode = fs.readFileSync(path.join(base, 'app/src/main/assets/activity-ui.js'), 'utf8');
vm.runInNewContext(activityCode,ctx,{filename:'activity-ui.js',timeout:3000});
vm.runInNewContext(code,ctx,{filename:'app.js',timeout:3000});
const app = window.KanonhaPreview;
const delay = () => new Promise(r=>setImmediate(r));
const click = dataset => eventHandlers.click({target:{closest(){return {dataset};}}});
(async () => {
  await delay(); await delay();
  assert.equal(app.screen,'profile','connected app should present sign-in page first');
  assert.equal(app.state.joined.length,0,'prior demo membership must not leak online');
  assert.equal(app.state.registered.length,0,'prior demo registration must not leak online');
  assert.equal(app.state.name,'مهمان','prior demo name must not leak online');
  assert.equal(get('online-events-heading').textContent,'رویدادهای در حال ثبت‌نام');
  assert.equal(get('online-auth-panel').hidden,false,'auth should be shown to guests');
  assert.equal(get('online-profile-card').hidden,true,'guest cannot see account data');
  assert.ok(!get('home-clubs').innerHTML.includes('کانون فناوری'),'no demo content in online catalog');
  assert.match(html,/Content-Security-Policy/,'CSP must be enabled');
  assert.match(html,/connect-src https:\/\/cnqcysnjinghzzrzanpj\.supabase\.co/,'CSP must allow only the dedicated Kanonha backend');
  assert.ok(get('clubs-list').innerHTML.includes('&lt;img'),'club names must be escaped in catalog');
  assert.ok(get('home-clubs').innerHTML.includes('&lt;img'),'club names must be escaped in home carousel');
  assert.ok(get('events-list').innerHTML.includes('&lt;svg'),'event titles must be escaped');
  assert.ok(!get('clubs-list').innerHTML.includes('<img src=x onerror'),'XSS markup in club title');
  assert.ok(!get('events-list').innerHTML.includes('<svg onload'),'XSS markup in event title');
  app.go('events');
  click({details:'0'});
  assert.ok(get('sheet-content').innerHTML.includes('&lt;iframe'),'event location must be escaped in details');
  assert.ok(!get('sheet-content').innerHTML.includes('<iframe'),'XSS markup in event details');
  app.handleBack();
  app.go('clubs');
  click({clubDetails:'0'});
  assert.equal(app.screen,'club-detail','club must open its own page');
  assert.ok(get('club-detail-content').innerHTML.includes('&lt;img'),'club descriptions must be escaped in details');
  assert.ok(!get('club-detail-content').innerHTML.includes('<img src=x onerror'),'club details must prevent injected HTML');
  app.handleBack();
  assert.equal(app.screen,'clubs','back must return to club cards');
  app.go('profile');
  await eventHandlers.submit({
    target:{id:'online-auth-form',fields:{kind:'student',identifier:'123456',password:'securepassword'},reset(){}},
    preventDefault(){}
  });
  await delay(); await delay();
  assert.equal(get('online-auth-panel').hidden,true,'logged-in screen should hide login');
  assert.equal(get('profile-name').textContent,'دانشجوی نمونه');
  assert.equal(get('online-auth-panel').hidden,true,'login form should close after student auth');
  app.go('clubs');
  click({join:'0'});
  click({join:'0'});
  await delay(); await delay();
  assert.equal(actions.joins,1,'double tap must send only one membership request');
  assert.equal(app.state.requested.length,1,'pending membership not reflected');
  assert.ok(get('activity-clubs').innerHTML.includes('&lt;img'),'club activity names must be escaped');
  app.go('events');
  click({register:'0'});
  await delay(); await delay(); await delay();
  assert.equal(actions.registrations,1);
  assert.equal(app.state.registered.length,1);
  assert.ok(get('activity-events').innerHTML.includes('&lt;svg'),'event activity names must be escaped');
  assert.ok(get('activity-tickets').innerHTML.includes('&lt;iframe'),'ticket venue text must be escaped');
  click({register:'0'});
  await delay();
  assert.equal(actions.registrations,1,'duplicate online registration must be disabled');
  assert.ok(!get('activity-tickets').innerHTML.includes('sample-qr'),'online should never show fake QR');
  app.go('activity');
  assert.ok(!get('activity-events').innerHTML.includes('لغو ثبت‌نام'),'event registrations are permanent');
  assert.ok(!get('activity-tickets').innerHTML.includes('data-event-cancel'),'no manual ticket removal');
  assert.equal(actions.eventCancellations,0,'students cannot cancel event registrations');
  app.go('clubs');
  click({clubDetails:'0'});
  assert.equal(app.screen,'club-detail');
  assert.ok(get('club-detail-content').innerHTML.includes('لغو درخواست عضویت'));
  click({cancelMembership:'0'});
  assert.equal(get('sheet-overlay').hidden,false,'cancellation requires confirmation');
  click({confirmCancel:'0'});
  await delay();await delay();
  assert.equal(actions.cancellations,1);
  assert.equal(app.state.requested.length,0,'pending membership must be removed after cancellation');
  memberRows=[{club_id:clubId,status:'rejected'}];
  click({action:'confirm-exit'});
  await delay();await delay();
  await eventHandlers.submit({
    target:{id:'online-auth-form',fields:{kind:'student',identifier:'123456',password:'securepassword'},reset(){}},
    preventDefault(){}
  });
  await delay();await delay();
  assert.equal(app.state.rejected.length,1,'rejected membership must be distinguishable');
  app.go('clubs');
  assert.ok(get('clubs-list').innerHTML.includes('درخواست مجدد'));
  click({reapply:'0'});
  await delay();await delay();
  assert.equal(actions.reapplies,1);
  assert.equal(app.state.requested.length,1,'reapplication must become pending');
  memberRows=[{club_id:clubId,status:'approved'}];
  click({action:'confirm-exit'});
  await delay();await delay();
  await eventHandlers.submit({
    target:{id:'online-auth-form',fields:{kind:'student',identifier:'123456',password:'securepassword'},reset(){}},
    preventDefault(){}
  });
  await delay();await delay();
  assert.equal(app.state.joined.length,1,'secretary-approved membership must appear');
  app.go('clubs');
  click({clubDetails:'0'});
  assert.ok(get('club-detail-content').innerHTML.includes('خروج از کانون'));
  click({cancelMembership:'0'});
  click({confirmCancel:'0'});
  await delay();await delay();
  assert.equal(actions.cancellations,2);
  assert.equal(app.state.joined.length,0,'club leave must clear approved membership');
  click({action:'confirm-exit'});
  await delay(); await delay();
  assert.equal(backend.currentUser,null);
  assert.equal(get('online-auth-panel').hidden,false);
  assert.equal(app.state.registered.length,0);
  assert.equal(storage.size,1,'online must not persist account records in demo storage');
  assert.equal(storage.get('kanonha-ui-v3'),previousDemo,'online mode must not mutate previous demo state');
  console.log('PASS: online catalog, XSS escaping, CSP, secure account handling, registration deduplication and logout');
})().catch(e=>{console.error(e);process.exitCode=1;});
