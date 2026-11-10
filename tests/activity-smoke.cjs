'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.resolve(__dirname,'..');
const getFile=p=>fs.readFileSync(path.join(base,p),'utf8');
const code=getFile('app/src/main/assets/activity-ui.js');
const app=getFile('app/src/main/assets/app.js');
const html=getFile('app/src/main/assets/index.html');
const styles=getFile('app/src/main/assets/styles.css');
const backend=getFile('app/src/main/assets/backend.js');
const migration=getFile('supabase/activity-certificates-v0923.sql');
const memberSql=getFile('supabase/activity-membership-history-v0924.sql');
class Node{
 constructor(id){this.id=id;this.innerHTML='';this.textContent='';this.hidden=false;this.disabled=false;}
 querySelectorAll(sel){
  if(sel==='[data-ticket-qr]')return [...this.innerHTML.matchAll(/data-ticket-qr="(\d+)"/g)]
    .map(m=>({dataset:{ticketQr:m[1]},textContent:''}));
  return [];
 }
}
const nodes=new Map();
const document={
 getElementById(id){if(!nodes.has(id))nodes.set(id,new Node(id));return nodes.get(id);},
 addEventListener(){}
};
const prints=[],qrCalls=[];
const token='fc9ec2ef-75b1-485e-afaa-720cb7962348';
const window={
 KanonhaEventTools:{
  renderQr(el,t){qrCalls.push(t);return Boolean(t);},
  qrPng(t){return t===token?'data:image/png;base64,AAAA':'';
  }
 },
 AndroidSurveyExports:{printHtmlNamed(title,body){prints.push({title,body});}}
};
vm.runInNewContext(code,{window,document,Date,Number,Set,Map,setTimeout:()=>1,clearTimeout(){}},
 {filename:'activity-ui.js',timeout:3000});
const page=window.KanonhaActivity;
const malicious='<img src=x onerror=alert(1)>';
const now=Date.now(),day=86400000;
const iso=t=>new Date(t).toISOString();
const regA='11111111-1111-4111-8111-111111111111';
const regB='22222222-2222-4222-8222-222222222222';
const regC='33333333-3333-4333-8333-333333333333';
const data={
 onlineMode:true,studentName:malicious+' علی',studentNumber:'001230',
 clubs:[{id:'club-0',title:malicious,category:'آموزشی'}],
 events:[],state:{joined:[],requested:[],rejected:[],registered:[],attended:[]},
 memberDetails:[
  {club_id:'club-0',club_name:malicious,status:'approved',is_active:true},
  {club_id:'club-1',club_name:'کانون نمونه',status:'pending',is_active:true},
  {club_id:'club-2',club_name:'کانون قدیمی',status:'rejected',is_active:true}
 ],
 historyRows:[
  {registration_id:regA,event_id:'event-a',event_title:malicious,event_starts_at:iso(now+day),
   event_location:malicious,club_name:'کانون فرهنگی',status:'confirmed',attended_at:null,
   ticket_expires_at:iso(now+8*day),ticket_token:token},
  {registration_id:regB,event_id:'event-b',event_title:'رویداد قدیمی',
   event_starts_at:iso(now-8*day),event_location:'سالن اجتماعات',club_name:'کانون فرهنگی',
   status:'confirmed',attended_at:iso(now-8*day),ticket_expires_at:iso(now-day),ticket_token:null},
  {registration_id:regC,event_id:'event-c',event_title:'رویداد اخیر',
   event_starts_at:iso(now-6*day),event_location:'دانشگاه',club_name:'کانون فناوری',
   status:'confirmed',attended_at:iso(now-6*day),ticket_expires_at:iso(now+day),ticket_token:token}
 ],
 certificates:[
  {id:'cert-id',student_name:malicious,student_number:'001230',event_title:malicious,
   club_name:'کانون قدیمی',event_starts_at:iso(now-3650*day),
   issued_at:iso(now-3649*day),certificate_code:'12345678-1234-4123-8123-123456789012'}
 ]
};
const get=id=>document.getElementById(id).innerHTML;
page.render(data);
assert.match(get('activity-overview'),/گواهینامه‌ها/);
assert.match(get('activity-clubs'),/عضویت تأییدشده/);
assert.match(get('activity-clubs'),/در انتظار تأیید دبیر/);
assert.match(get('activity-clubs'),/درخواست رد شده/);
assert.match(get('activity-clubs'),/لغو عضویت/);
assert.match(get('activity-clubs'),/درخواست مجدد عضویت/);
assert.match(get('activity-clubs'),/data-activity-cancel-club/);
assert.match(get('activity-events'),/رویداد قدیمی/,'history is permanent');
assert.ok(!get('activity-events').includes('لغو ثبت‌نام'),'event registration cannot be cancelled');
assert.match(get('activity-tickets'),/data-activity-download-ticket/);
assert.ok(get('activity-tickets').includes(regA)&&get('activity-tickets').includes(regC));
assert.ok(!get('activity-tickets').includes(regB),'ticket must disappear after seven days');
assert.equal(qrCalls.length,2,'tickets from attended events remain within seven-day window');
assert.ok(get('activity-certificates').includes('cert-id'),'old certificates persist');
assert.ok(!get('activity-clubs').includes(malicious),'escaped membership');
assert.ok(!get('activity-events').includes(malicious),'escaped event');
assert.ok(!get('activity-certificates').includes(malicious),'escaped certificate');
assert.equal(page.downloadTicket(regA),true,'ticket PDF opens native print');
assert.equal(page.downloadTicket(regB),false,'expired tickets are not downloadable');
assert.equal(page.downloadCertificate('cert-id'),true);
assert.equal(prints.length,2);
assert.match(prints[0].body,/data:image\/png;base64,AAAA/);
assert.match(prints[0].title,/Kanonha-Ticket/);
assert.match(prints[1].title,/Kanonha-Certificate/);
assert.ok(!prints[0].body.includes(malicious),'ticket PDF escapes unsafe input');
assert.ok(!prints[1].body.includes(malicious),'certificate PDF escapes unsafe input');
assert.match(prints[1].body,/001230/,'preserve leading zeros in student number');
page.setFilter('club','pending');
assert.match(get('activity-clubs'),/در انتظار تأیید/);
assert.ok(!get('activity-clubs').includes('درخواست مجدد عضویت'));
page.setFilter('event','past');
assert.match(get('activity-events'),/رویداد قدیمی/);
assert.ok(!get('activity-events').includes('11111111-1111'));
page.render({...data,historyRows:[],memberDetails:[],certificates:[]});
page.setFilter('club','all');page.setFilter('event','all');
assert.match(get('activity-tickets'),/بلیت فعالی وجود ندارد/);
assert.match(get('activity-certificates'),/هنوز گواهینامه‌ای/);
page.clear();
assert.equal(page.downloadCertificate('cert-id'),false,'clear identity-bound data on logout');
assert.doesNotMatch(app,/onlineCancelEvent|confirmEventCancel/);
assert.doesNotMatch(backend,/async function cancelEvent/);
assert.match(app,/activityHistory = historyRows/);
assert.match(app,/activityCertificates = certificates/);
assert.match(backend,/rpc\/kanonha_my_event_history/);
assert.match(backend,/kanonha_my_club_memberships/);
assert.match(backend,/rpc\/kanonha_issue_certificate/);
assert.match(migration,/interval '7 days'/);
assert.match(migration,/revoke delete on public\.kanonha_registrations/);
assert.match(migration,/revoke select \(ticket_token\)/);
assert.match(migration,/enable row level security/);
assert.match(migration,/for select to authenticated using \(user_id=\(select auth\.uid\(\)\)\)/);
assert.match(migration,/Attendance is required/);
assert.match(memberSql,/where m\.user_id=v_actor/);
assert.match(html,/id="activity-certificates"/);
const css=styles.slice(styles.indexOf('/* Activities v0.9.21'),styles.indexOf('/* Survey cover image:'));
assert.match(css,/#505cc8|#4c55b4|#303d91/i);
assert.doesNotMatch(css,/--ac:#16865b/,'green activity theme must not return');
console.log('PASS: four activity sections, club state, 7-day ticket expiry, permanent certificates, signed-in PDF and XSS safety');
