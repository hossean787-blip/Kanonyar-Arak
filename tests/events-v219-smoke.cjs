'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const file=p=>fs.readFileSync(path.join(root,p),'utf8');
const apiSource=file('app/src/main/assets/backend.js');
const uiSource=file('app/src/main/assets/event-tools.js');
const html=file('app/src/main/assets/index.html');
const secretary=file('app/src/main/assets/secretary.js');
const manager=file('app/src/main/assets/admin.js');
const student=file('app/src/main/assets/app.js');
const activity=file('app/src/main/assets/activity-ui.js');
const native=file('app/src/main/java/ir/kanonha/app/EventReminderReceiver.java');
const activityNative=file('app/src/main/java/ir/kanonha/app/MainActivity.java');
const manifest=file('app/src/main/AndroidManifest.xml');
const sql=file('supabase/events-v219.sql')+
 file('supabase/events-v219-rls-fix.sql')+
 file('supabase/events-v219-scoped-checkin.sql')+
 file('supabase/activity-certificates-v0923.sql')+
 file('supabase/activity-membership-history-v0924.sql')+
 file('supabase/events-v220-secretary-autonomy.sql');
const edge=file('supabase/functions/kanonha-admin-console/index.ts');
const userId='fefea2f1-ef77-4b8f-b38f-fd1c40d35900';
const clubId='aa11aa11-4a11-4a11-8a11-aa11aa11aa11';
const eventId='bb11bb11-4b11-4b11-8b11-bb11bb11bb11';
const ticket='cc11cc11-4c11-4c11-8c11-cc11cc11cc11';
const calls=[];
function ok(payload,status=200){
 return {status,ok:status>=200&&status<300,
  async text(){return payload==null?'':JSON.stringify(payload)},
  async json(){return payload}};
}
async function fetchMock(url,request){
 const method=request.method||'GET';
 const body=request.body&&typeof request.body==='string'?JSON.parse(request.body):null;
 calls.push({url,method,body,headers:request.headers});
 if(url.includes('/auth/v1/token?grant_type=password'))
  return ok({access_token:'test-access',refresh_token:'test-refresh',expires_in:3600,user:{id:userId}});
 if(url.includes('/auth/v1/user'))return ok({id:userId,user_metadata:{}});
 if(url.includes('/functions/v1/kanonha-admin-console')){
  return ok({result:body?.action==='event.report'?
   {event:{id:eventId,title:'کارگاه',capacity:10},registered:1,attended:0,rows:[]}:[]});
 }
 if(url.includes('/rest/v1/rpc/kanonha_checkin_ticket'))
  return ok([{result:'checked_in',attendee:'دانشجوی نمونه'}]);
 if(url.includes('/rest/v1/rpc/kanonha_event_summary'))
  return ok([{registrations:1,attendees:0,capacity:10}]);
 if(url.includes('/rest/v1/rpc/kanonha_my_event_history'))return ok([{
    registration_id:ticket,event_id:eventId,event_title:'کارگاه تست',
    event_starts_at:'2035-05-01T10:00:00Z',event_location:'سالن',club_name:'کانون',
    status:'confirmed',attended_at:null,ticket_expires_at:'2035-05-08T10:00:00Z',ticket_token:ticket
 }]);
 if(url.includes('/rest/v1/rpc/kanonha_my_club_memberships'))return ok([]);
 if(url.includes('/rest/v1/rpc/kanonha_issue_certificate'))return ok([{
   id:ticket,certificate_code:ticket,issued_at:'2035-05-02T10:00:00Z'
 }]);
 if(url.includes('/rest/v1/kanonha_certificates?'))return ok([]);
 if(url.includes('/rest/v1/kanonha_registrations?')&&url.includes('select=id,user_id,event_id'))
  return ok([{id:ticket,user_id:userId,event_id:eventId,status:'confirmed',
   registered_at:'2035-05-01T01:00:00Z',attended_at:null}]);
 if(url.includes('/rest/v1/kanonha_registrations?'))
  return ok([{id:ticket,event_id:eventId,status:'confirmed',ticket_token:ticket,attended_at:null}]);
 if(url.includes('/rest/v1/kanonha_profiles?'))
  return ok([{user_id:userId,full_name:'دانشجوی تست',student_number:'12345678'}]);
 if(url.includes('/rest/v1/kanonha_events?'))
  return ok([{id:eventId,club_id:clubId,title:'کارگاه تست',capacity:10,registered_count:1,
   poster_path:clubId+'/'+eventId+'.webp'}]);
 throw new Error('Unexpected route: '+method+' '+url);
}
const window={KANONHA_CONFIG:{url:'https://cnqcysnjinghzzrzanpj.supabase.co',
 publishableKey:'sb_publishable_test_only'}};
vm.runInNewContext(apiSource,{window,fetch:fetchMock,AbortController,
 setTimeout,clearTimeout,Date,Map,Set,URL,TextEncoder},{timeout:4000,filename:'backend.js'});
const api=window.KanonhaBackend;
const testApi=async()=>{
 assert.equal(api.enabled,true);
 assert.deepEqual(await api.registrations().then(rows=>rows.map(r=>r.ticket_token)),[],'protected without login');
};
async function testFlows(){
 await assert.rejects(()=>api.myEventHistory(),/وارد حساب/);
 await api.signIn('example@example.test','good-password');
 const evs=await api.events();
 assert.equal(evs[0].id,eventId);
 const publicCall=calls.find(x=>x.url.includes('kanonha_events?select='));
 assert.match(publicCall.url,/is_published=eq.true/);
 assert.doesNotMatch(publicCall.url,/approval_status=eq.approved/,'secretary events publish directly');
 assert.equal(publicCall.headers.Authorization,undefined);
 assert.equal((await api.myEventHistory())[0].ticket_token,ticket);
 await api.registrations();
 assert.doesNotMatch(calls.find(x=>x.url.includes('kanonha_registrations?select=id,event_id')).url,/ticket_token/);
 assert.equal((await api.myCertificates()).length,0);
 assert.equal((await api.myClubMemberships()).length,0);
 assert.equal((await api.issueCertificate(ticket)).id,ticket);
 assert.match(api.eventPosterUrl(clubId,eventId,clubId+'/'+eventId+'.webp'),/kanonha-event-posters/);
 assert.equal(api.eventPosterUrl(clubId,eventId,'other/path.webp'),'');
 assert.equal(typeof api.cancelEvent,'undefined','event cancellation is no longer exported');
 assert.ok(!calls.some(c=>c.method==='DELETE'&&c.url.includes('kanonha_registrations')));
 await assert.rejects(()=>api.checkInTicket(ticket,'bad'),/رویداد/);
 await assert.rejects(()=>api.checkInTicket('malformed',eventId),/بلیت/);
 assert.equal((await api.checkInTicket('KANONHA1:'+ticket,eventId)).result,'checked_in');
 const check=calls.findLast(x=>x.url.includes('/rpc/kanonha_checkin_ticket'));
 assert.equal(check.body.p_event_id,eventId);
 assert.equal(check.body.p_token,ticket);
 assert.equal(check.headers.Authorization,'Bearer test-access');
 assert.equal((await api.eventSummary(eventId)).capacity,10);
 const report=await api.secretaryEventExport(eventId);
 assert.equal(report.rows.length,1);
 assert.equal(report.rows[0].student.student_number,'12345678');
 assert.equal(report.summary.registrations,1);
 const adminReport=await api.adminAction('event.report',{id:eventId});
 assert.equal(adminReport.event.id,eventId);
 const ops=calls.filter(c=>c.url.includes('kanonha-admin-console')).map(x=>x.body.action);
 assert.deepEqual(ops,['event.report']);
}
function testQrCsv(){
 const used=[];
 const QR=function(node,options){used.push(options);node._rendered=true};
 QR.CorrectLevel={M:0};
 let captured=null;
 const window={QRCode:QR,AndroidSurveyExports:{saveCsv(name,data){captured={name,data};}}};
 vm.runInNewContext(uiSource,{window,TextEncoder,btoa},{filename:'event-tools.js',timeout:4000});
 const ui=window.KanonhaEventTools;
 const fake={textContent:'',_rendered:false};
 assert.equal(ui.renderQr(fake,ticket),true);
 assert.equal(fake._rendered,true);
 assert.equal(used[0].text,'KANONHA1:'+ticket);
 assert.equal(ui.renderQr(fake,'not-a-uuid'),false);
 const report={event:{id:eventId,title:'کارگاه',capacity:10},registered:1,attended:0,
  rows:[{student:{full_name:'=HYPERLINK("https://bad.test")',student_number:'001234'},
   registered_at:'2035-01-01T00:00:00Z',attended_at:null}]};
 assert.equal(ui.exportEventCsv(report),true);
 assert.match(captured.name,/kanonha-event-/);
 const decoded=Buffer.from(captured.data,'base64').toString('utf8');
 assert.ok(decoded.startsWith('\uFEFF'));
 assert.match(decoded,/'=HYPERLINK/,'spreadsheet formula must be neutralized');
 assert.match(decoded,/001234/,'student number leading zeros preserved in CSV source');
 assert.match(decoded,/کارگاه/,'UTF-8 Persian payload not corrupted');
 assert.equal(ui.exportEventCsv({event:{title:'wrong'}}),false);
}
function testSecurityWiring(){
 assert.match(sql,/approval_status.*pending/s);
 assert.match(sql,/kanonha_private\.guard_event_approval/);
 assert.match(sql,/alter column approval_status set default 'approved'/);
 assert.match(sql,/kanonha_auto_certificate_on_attendance/);
 assert.match(sql,/char_length\(btrim\(new.location\)\)/);
 assert.match(sql,/kanonha_private\.current_student_has_profile/);
 assert.match(sql,/kanonha_private\.release_event_capacity/);
 assert.match(sql,/kanonha_private\.current_student_has_profile/);
 assert.match(sql,/p_event_id uuid/);
 assert.match(sql,/r\.event_id=p_event_id/);
 assert.match(sql,/kanonha-event-posters/);
 assert.match(sql,/status='confirmed'/);
 assert.match(sql,/registered_count=registered_count-1/);
 assert.match(sql,/drop policy if exists kanonha_student_cancel_event/);
 assert.match(sql,/revoke delete on public\.kanonha_registrations/);
 assert.match(sql,/revoke select \(ticket_token\)/);
 assert.match(edge,/event\.approve/);
 assert.match(edge,/event\.reject/);
 assert.match(edge,/event\.report/);
 assert.match(edge,/email_confirmed_at/);
 assert.doesNotMatch(manager,/data-admin-approve-event/);
 assert.doesNotMatch(manager,/data-admin-reject-event/);
 assert.match(manager,/data-admin-export-event/);
 assert.match(secretary,/name="poster"/);
 assert.match(secretary,/confirmAction\('secretary-event'\)/);
 assert.match(secretary,/data-secretary-export-excel/);
 assert.match(secretary,/data-secretary-export-pdf/);
 assert.match(secretary,/backend\.uploadEventPoster/);
 assert.match(secretary,/secretary-ticket-form/);
 assert.match(secretary,/window\.jsQR/);
 assert.match(secretary,/backend\.checkInTicket\(raw,ticketEvent\)/);
 assert.match(secretary,/secretary-export/);
 assert.doesNotMatch(secretary,/data-secretary-certificate=/,'certificate is automatic');
 assert.match(student,/AndroidEventReminders/);
 assert.match(student,/confirmAction\('student-registration'\)/);
 assert.match(student,/data-event-deadline/);
 assert.doesNotMatch(student,/onlineBackend\.cancelEvent/);
 assert.match(student,/activityCertificates/);
 assert.match(activity,/data-ticket-qr/);
 assert.match(html,/vendor\/qrcode\.js/);
 assert.match(html,/vendor\/jsQR\.js/);
 assert.match(html,/event-tools\.js/);
 assert.match(manifest,/android\.permission\.CAMERA/);
 assert.match(manifest,/EventReminderReceiver/);
 assert.match(native,/setAndAllowWhileIdle/);
 assert.match(native,/BOOT_COMPLETED/);
 assert.match(native,/POST_NOTIFICATIONS/);
 assert.match(activityNative,/AndroidEventReminders/);
 assert.match(activityNative,/AndroidEventExcel/);
 assert.match(file('app/src/main/java/ir/kanonha/app/EventExcelBridge.java'),/ZipOutputStream/);
 assert.match(activityNative,/RESOURCE_VIDEO_CAPTURE/);
 assert.match(activityNative,/appassets\.androidplatform\.net/);
 assert.match(file('app/src/main/assets/vendor/qrcode.js'),/QRCode/);
 assert.match(file('app/src/main/assets/vendor/jsQR.js'),/webpackUniversalModuleDefinition/);
 assert.ok(file('app/src/main/assets/vendor/qrcodejs-LICENSE.txt').includes('MIT'));
 assert.ok(file('app/src/main/assets/vendor/jsqr-LICENSE.txt').includes('Apache License'));
 assert.match(file('tests/events-v219-live-qa.sql'),/rollback;/i);
}
(async()=>{
 await testFlows();testQrCsv();testSecurityWiring();
 console.log('PASS: secretary-direct event publication, QR, immutable registrations, automatic certificates, biometrics and exports');
})().catch(e=>{console.error(e);process.exitCode=1});
