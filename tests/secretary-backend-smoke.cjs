'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app/src/main/assets/backend.js'), 'utf8');
const sql = fs.readFileSync(path.join(__dirname, '../supabase/secretary-v060.sql'), 'utf8');
const rosterSql = fs.readFileSync(path.join(__dirname, '../supabase/secretary-roster-profiles-v060.sql'), 'utf8');
const secretaryId = '10e0d003-8c4f-4d1a-b87a-cc349cc53001';
const clubId = '10e0d003-8c4f-4d1a-b87a-cc349cc53011';
const eventId = '10e0d003-8c4f-4d1a-b87a-cc349cc53031';
const memberId = '10e0d003-8c4f-4d1a-b87a-cc349cc53021';
const registrationId = '10e0d003-8c4f-4d1a-b87a-cc349cc53041';
const calls = [];
function ok(data, status=200) {
  return {status, ok:status>=200&&status<300, async text(){return data===undefined?'':JSON.stringify(data)}};
}
async function fetchMock(url, options) {
  const body = options.body ? JSON.parse(options.body) : null;
  calls.push({url,method:options.method,body,headers:options.headers});
  if (url.includes('/auth/v1/token?grant_type=password')) return ok({access_token:'sample-token',refresh_token:'sample-refresh',expires_in:3600,user:{id:secretaryId}});
  if (url.endsWith('/auth/v1/user')) return ok({id:secretaryId});
  if (url.includes('/kanonha_secretaries?')) return ok([{club_id:clubId,user_id:secretaryId}]);
  if (url.includes('/kanonha_memberships?') && options.method==='PATCH') {
    // Real PostgREST returns 42501 when RETURNING * includes hidden decision-audit columns.
    if (!url.includes('&select=id,status')) return ok({message:'permission denied for table kanonha_memberships'},403);
    return ok([{id:memberId,status:body.status}]);
  }
  if (url.includes('/kanonha_memberships?')) return ok([{id:memberId,user_id:secretaryId,club_id:clubId,status:'pending'}]);
  if (url.includes('/kanonha_profiles?')) return ok([{user_id:secretaryId,full_name:'دبیر نمونه',student_number:'123456'}]);
  if (url.includes('/kanonha_clubs?') && options.method==='PATCH') return ok([{id:clubId,...body}]);
  if (url.includes('/kanonha_events?') && options.method==='PATCH') return ok([{id:eventId,...body}]);
  if (url.endsWith('/kanonha_events') && options.method==='POST') return ok([{id:eventId,...body}],201);
  if (url.includes('/kanonha_events?')) return ok([{id:eventId,club_id:clubId,title:'رویداد',registered_count:0}]);
  if (url.includes('/kanonha_registrations?') && options.method==='PATCH') return ok([{id:registrationId,attended_at:body.attended_at}]);
  if (url.includes('/kanonha_registrations?')) return ok([{id:registrationId,event_id:eventId,user_id:secretaryId}]);
  throw Error('Unexpected request '+url);
}
const window = {KANONHA_CONFIG:{url:'https://cnqcysnjinghzzrzanpj.supabase.co',publishableKey:'sb_publishable_testkey'}};
vm.runInNewContext(source,{window,fetch:fetchMock,AbortController,setTimeout,clearTimeout,Date},{filename:'backend.js',timeout:3000});
const api=window.KanonhaBackend;
(async()=>{
  assert.match(sql,/secretary_can_read_own_assignments/);
  assert.match(sql,/secretary_can_decide_assigned_memberships/);
  assert.match(sql,/kanonha_private\.audit_membership_decision/);
  assert.match(sql,/kanonha_private\.stamp_attendance/);
  assert.match(rosterSql,/kanonha_profiles\.user_id/);
  assert.doesNotMatch(sql,/s\.club_id = club_id(?:\s|$)/);
  await assert.rejects(()=>api.secretaryClubs(),/وارد حساب/);
  await api.signIn('manager@example.test','secure-password');
  assert.equal((await api.secretaryClubs())[0].club_id,clubId);
  assert.equal((await api.secretaryEvents(clubId))[0].id,eventId);
  assert.equal((await api.secretaryMemberships(clubId))[0].id,memberId);
  assert.equal((await api.secretaryProfiles([secretaryId,secretaryId])).length,1);
  await api.secretaryUpdateClub(clubId,{name:'کانون تست',description:'توضیحات',category:'علمی',
    university:'دانشگاه نمونه',faculty:'علوم انسانی'});
  const clubPatch=calls.findLast(x=>x.method==='PATCH'&&x.url.includes('kanonha_clubs'));
  assert.deepEqual(Object.keys(clubPatch.body).sort(),['category','description','faculty','name','university']);
  assert.equal(clubPatch.body.university,'دانشگاه نمونه');
  assert.equal(clubPatch.body.faculty,'علوم انسانی');
  assert.equal(clubPatch.headers.Authorization,'Bearer sample-token');
  await assert.rejects(()=>api.secretaryUpdateClub(clubId,{name:'کانون تست',description:'   ',category:'علمی',
    university:'دانشگاه نمونه',faculty:'علوم انسانی'}),/درباره کانون/);
  await assert.rejects(()=>api.secretaryUpdateClub(clubId,{name:'کانون تست',description:'توضیحات',category:'علمی',
    university:'دانشگاه نمونه',faculty:''}),/دانشگاه و دانشکده/);
  const future={title:'کارگاه پژوهشی',location:'سالن اصلی',starts_at:'2035-05-12T10:00:00Z',registration_deadline:'2035-05-11T10:00:00Z',capacity:30,is_published:false};
  await api.secretaryCreateEvent(clubId,future);
  const inserted=calls.findLast(x=>x.url.endsWith('kanonha_events'));
  assert.equal(inserted.body.club_id,clubId);
  assert.equal(inserted.body.is_published,false);
  await api.secretaryUpdateEvent(eventId,{...future,is_published:true});
  const updated=calls.findLast(x=>x.method==='PATCH'&&x.url.includes('kanonha_events'));
  assert.equal(updated.body.club_id,undefined);
  assert.equal(updated.body.is_published,true);
  await api.secretaryDecideMembership(memberId,'approved');
  const decision=calls.findLast(x=>x.method==='PATCH'&&x.url.includes('kanonha_memberships'));
  assert.deepEqual(decision.body,{status:'approved'});
  assert.match(decision.url,/&status=eq\.pending&select=id,status/);
  assert.ok(!decision.url.includes('decided_at') && !decision.url.includes('decided_by'),
    'the decision must never request private audit fields');
  await api.secretaryRoster(eventId);
  await api.secretarySetAttendance(registrationId,true);
  const attendance=calls.findLast(x=>x.method==='PATCH'&&x.url.includes('kanonha_registrations'));
  assert.ok(attendance.body.attended_at && !Number.isNaN(Date.parse(attendance.body.attended_at)));
  await assert.rejects(()=>api.secretaryDecideMembership(memberId,'admin'),/نامعتبر/);
  await assert.rejects(()=>api.secretaryCreateEvent(clubId,{...future,capacity:-1}),/ظرفیت/);
  await assert.rejects(()=>api.secretaryUpdateClub('invalid',{name:'نام',category:'علمی'}),/معتبر/);
  await assert.rejects(()=>api.secretaryProfiles(['malformed-id']),/نامعتبر/);
  console.log('PASS secretary API contract, ownership-scoped routes, event validation, status and attendance writes');
})().catch(e=>{console.error(e);process.exitCode=1});
