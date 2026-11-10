'use strict';
const assert = require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const script=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/secretary.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'),'utf8');
for (const id of ['secretary-panel','secretary-title','secretary-content','secretary-message','secretary-club-select','secretary-tabs'])
  assert.match(html, new RegExp('id="'+id+'"'));
assert.match(html,/<script src="secretary\.js" defer>/);
const secretaryId='10e0d003-8c4f-4d1a-b87a-cc349cc53001';
const clubId='10e0d003-8c4f-4d1a-b87a-cc349cc53011';
const memberId='10e0d003-8c4f-4d1a-b87a-cc349cc53021';
const eventId='10e0d003-8c4f-4d1a-b87a-cc349cc53031';
const registrantId='10e0d003-8c4f-4d1a-b87a-cc349cc53004';
const registrationId='10e0d003-8c4f-4d1a-b87a-cc349cc53041';
const fakeClub='<img src=x onerror=alert(1)>کانون پژوهشی';
const fakeName='<svg onload=alert(2)>دانشجو';
class Element {
  constructor(id) {
    this.id=id;this.hidden=id==='secretary-panel';this.innerHTML='';this.textContent='';this.style={};
    this.listeners={};this.value='';this.dataset={};
    this.classList={toggle(){}};this.hasAttribute=()=>false;
  }
  addEventListener(type,fn){this.listeners[type]=fn}
  querySelectorAll(query){if(query==='[data-secretary-tab]')return ['club','members','events','attendance'].map(x=>({dataset:{secretaryTab:x},classList:{toggle(){}},setAttribute(){}}));return [];}
  contains(){return true}
}
const el=new Map(['secretary-panel','secretary-content','secretary-message','secretary-club-select'].map(id=>[id,new Element(id)]));
const root=el.get('secretary-panel');
const profileRows=[
  {user_id:secretaryId,full_name:'دبیر',student_number:'99000001'},
  {user_id:registrantId,full_name:fakeName,student_number:'99000004'}];
let user=null;
let secretaryEnabled=true;
let members=[{id:memberId,user_id:registrantId,club_id:clubId,status:'pending',requested_at:'2026-11-01T10:00:00Z'}];
let events=[{id:eventId,club_id:clubId,title:'رویداد واقعی آزمایشی',starts_at:'2020-02-01T12:00:00Z',
  registration_deadline:'2020-01-31T12:00:00Z',registered_count:1,capacity:10,is_published:true}];
let roster=[{id:registrationId,user_id:registrantId,event_id:eventId,attended_at:null,registered_at:'2020-01-15T10:00:00Z'}];
const ops={approvals:0,creates:0,attendances:0,edits:0,autoCertificates:0};
const issued=new Set();
let certificateLookupFails=false;
const backend={
  enabled:true,
  get currentUser(){return user},
  async secretaryClubs(){return secretaryEnabled ? [{club_id:clubId}] : []},
  async clubs(){return [{id:clubId,name:fakeClub,description:'آزمون امنیت',category:'علمی'}]},
  async secretaryEvents(id){assert.equal(id,clubId);return events},
  async secretaryMemberships(id){assert.equal(id,clubId);return members},
  async secretaryProfiles(ids){return profileRows.filter(x=>ids.includes(x.user_id))},
  async secretaryUpdateClub(id,data){assert.equal(id,clubId);ops.edits++;return {id,...data}},
  async secretaryCreateEvent(id,data){assert.equal(id,clubId);ops.creates++;const record={id:'20e0d003-8c4f-4d1a-b87a-cc349cc53031',club_id:id,registered_count:0,...data};events=[...events,record];return record},
  async secretaryUpdateEvent(id,data){assert.ok(events.some(x=>x.id===id));ops.edits++;events=events.map(e=>e.id===id?{...e,...data}:e);return {id,...data}},
  async uploadEventPoster(club,event,file){assert.equal(club,clubId);assert.ok(file&&file.size>0);events=events.map(e=>e.id===event?{...e,poster_path:club+'/'+event+'.webp'}:e);return club+'/'+event+'.webp'},
  async secretaryDecideMembership(id,status){assert.equal(id,memberId);assert.equal(status,'approved');ops.approvals++;members=members.map(x=>({...x,status}));return members[0]},
  async secretaryRoster(id){assert.equal(id,eventId);return roster},
  async secretaryCertificates(id){
    assert.equal(id,eventId);
    if(certificateLookupFails)throw new Error('Certificate service temporarily unavailable');
    return [...issued].map(registration_id=>({registration_id}));
  },
  async secretarySetAttendance(id,present){
    assert.equal(id,registrationId);ops.attendances++;
    roster=roster.map(x=>({...x,attended_at:present?'2026-11-08T15:00:00Z':null}));
    if(present&&!issued.has(id)){ issued.add(id);ops.autoCertificates++; }
    return roster[0];
  }
};
const window={KanonhaBackend:backend,KanonhaBiometric:{confirmAction:async kind=>{assert.equal(kind,'secretary-event');return true;}}};
const document={hidden:false,getElementById(id){return el.get(id)||null},addEventListener(){}};
class FormDataMock{constructor(form){this.fields=form.fields;}get(name){return this.fields[name]??null}}
vm.runInNewContext(script,{window,document,Date,FormData:FormDataMock},{filename:'secretary.js',timeout:3000});
const panel=window.KanonhaSecretaryPanel;
assert.ok(panel&&panel.refresh&&panel.clear);
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
function click(data){
  root.listeners.click({target:{closest(){return{dataset:data}}}});
}
function submit(id,fields){
  root.listeners.submit({target:{id,fields,querySelector(name){return name==='input[name="poster"]'?{files:[{type:'image/png',size:512}]}:null;}},preventDefault(){}});
}
(async()=>{
  await panel.refresh();
  assert.equal(root.hidden,true,'anonymous must not see secretary dashboard');
  user={id:secretaryId};
  await panel.refresh();
  assert.equal(root.hidden,false,'assigned secretary should have panel');
  assert.ok(el.get('secretary-club-select').innerHTML.includes('&lt;img'),'club title must be escaped');
  assert.ok(!el.get('secretary-content').innerHTML.includes('<img src=x onerror'),'untrusted club name');
  click({secretaryTab:'members'});
 const initialPending=panel.summary().pending;
 members=[];
 await panel.refreshData();
 assert.match(el.get('secretary-content').innerHTML,/هنوز درخواست عضویت/);
 members=[{id:memberId,user_id:registrantId,club_id:clubId,status:'pending',requested_at:'2026-11-01T10:00:00Z'}];
 click({secretaryRefresh:''});
 await flush();await flush();
 assert.equal(panel.summary().pending,initialPending,'refresh button must load latest pending queue');
 assert.ok(el.get('secretary-content').innerHTML.includes('تأیید عضویت'));
  assert.ok(el.get('secretary-content').innerHTML.includes('&lt;svg'),'applicant name must be escaped');
  assert.ok(!el.get('secretary-content').innerHTML.includes('<svg onload'),'XSS applicant payload');
  click({secretaryDecide:memberId,secretaryStatus:'approved'});
  await flush();await flush();
  assert.equal(ops.approvals,1);
  assert.ok(el.get('secretary-content').innerHTML.includes('عضو تأییدشده'));
  click({secretaryTab:'events'});
  click({secretaryAction:'new-event'});
  assert.ok(el.get('secretary-content').innerHTML.includes('secretary-event-form'));
  submit('secretary-event-form',{
    title:'رویداد آینده',location:'سالن',starts_at:'2035-03-10T15:00',
    registration_deadline:'2035-03-09T15:00',capacity:'25',is_published:'1'
  });
  await flush();await flush();
  assert.equal(ops.creates,1);
  assert.ok(events.some(e=>e.title==='رویداد آینده'));
  click({secretaryRoster:eventId});
  await flush();await flush();
  assert.ok(el.get('secretary-content').innerHTML.includes('ثبت حضور'));
  click({secretaryAttendance:registrationId,secretaryPresent:'true'});
  await flush();await flush();
  assert.equal(ops.attendances,1);
  assert.ok(el.get('secretary-content').innerHTML.includes('حاضر'));
  assert.equal(ops.autoCertificates,1,'attendance should generate one automatic certificate');
  assert.ok(el.get('secretary-content').innerHTML.includes('گواهینامه صادرشده'));
  assert.ok(!el.get('secretary-content').innerHTML.includes('data-secretary-certificate='),
    'manual certificate issuance must not be required');
  // A certificate API outage must preserve the event roster and attendance actions.
  certificateLookupFails=true;
  click({secretaryRoster:eventId});
  await flush();await flush();
  assert.ok(el.get('secretary-content').innerHTML.includes('حاضر'));
  assert.ok(el.get('secretary-content').innerHTML.includes('data-secretary-attendance='));
  assert.match(el.get('secretary-message').textContent,/فهرست حضور بارگذاری شد/);
  certificateLookupFails=false;
  click({secretaryTab:'club'});
 const editsBefore=ops.edits;
 submit('secretary-club-form',{name:'کانون تازه',description:'  ',category:'علمی'});
 await flush();await flush();
 assert.equal(ops.edits,editsBefore,'blank about field must not submit');
 assert.match(el.get('secretary-message').textContent,/درباره کانون/);
  submit('secretary-club-form',{name:'کانون ثبت شده',description:'توضیحات نو',category:'پژوهشی'});
  await flush();await flush();
  assert.equal(ops.edits,2);
  user=null;panel.clear();
  assert.equal(root.hidden,true,'logout must hide all privileged content');
  user={id:secretaryId};secretaryEnabled=false;
  await panel.refresh();
  assert.equal(root.hidden,true,'non-secretary must never see privileged content');
  console.log('PASS secretary role gating, member review, event create, roster attendance, edit, XSS and logout');
})().catch(e=>{console.error(e);process.exitCode=1});
