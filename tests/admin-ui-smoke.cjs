'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/admin.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/index.html'),'utf8');
for(const id of ['admin-panel','admin-content','admin-tabs','admin-message','home-management'])
 assert.ok(html.includes('id="'+id+'"'),'Missing admin UI element '+id);
class E{
 constructor(id){this.id=id;this.hidden=true;this.innerHTML='';this.textContent='';this.dataset={};this.style={};this.events={};this.classList={toggle(){}}}
 addEventListener(k,fn){this.events[k]=fn}
 querySelectorAll(q){return q==='[data-admin-tab]'?['dashboard','clubs','events','members','secretaries','students'].map(t=>({dataset:{adminTab:t},classList:{toggle(){}},setAttribute(){}})):[]}
 contains(){return true}
}
const ids=['admin-panel','admin-content','admin-message','home-management','home-management-overline',
 'home-management-title','home-management-caption','home-management-btn'];
const dom=new Map(ids.map(id=>[id,new E(id)])),get=id=>dom.get(id);
const userId='10e0d003-8c4f-4d1a-b87a-cc349cc53001';
const clubId='10e0d003-8c4f-4d1a-b87a-cc349cc53011';
const memberId='10e0d003-8c4f-4d1a-b87a-cc349cc53021';
let user=null,allow=true;
const ops=[];
const store={
 clubs:[{id:clubId,name:'<img src=x onerror=alert(1)>کانون نمونه',description:'شرح',category:'پژوهشی',is_active:true}],
 events:[{id:'10e0d003-8c4f-4d1a-b87a-cc349cc53031',club_id:clubId,title:'رویداد نمونه',starts_at:'2035-03-01T10:00:00Z',
 registration_deadline:'2035-02-28T10:00:00Z',capacity:20,registered_count:0,is_published:true}],
 memberships:[{id:memberId,user_id:userId,club_id:clubId,status:'pending',requested_at:'2026-11-01T10:00:00Z'}],
 registrations:[],secretaries:[],
 users:[{user_id:userId,full_name:'دانشجوی نمونه',student_number:'99887766',university_verified:false,
  academic:{university:'دانشگاه نمونه',faculty:'دانشکده هنر',major:'هنر'}}]
};
const api={enabled:true,get currentUser(){return user},async isManager(){return allow},
 async adminAction(action,data={}){ops.push({action,data});
  if(action==='overview')return store;
  if(action==='secretary.assign')store.secretaries.push({user_id:data.user_id,club_id:data.club_id});
  if(action==='member.decide')store.memberships[0].status=data.status;
  if(action==='club.create')store.clubs.push({id:'20e0d003-8c4f-4d1a-b87a-cc349cc53011',...data});
  if(action==='student.verify')store.users[0].university_verified=data.verified;
  return [{}];
 }};
const window={KanonhaBackend:api},document={getElementById:get};
class FormDataMock{constructor(form){this.obj=form.fields}get(k){return this.obj[k]??null}}
vm.runInNewContext(src,{window,document,Date,FormData:FormDataMock},{filename:'admin.js',timeout:2000});
const panel=window.KanonhaAdminPanel,root=get('admin-panel');
const wait=()=>new Promise(r=>setTimeout(r,0));
function click(dataset){root.events.click({target:{closest(){return {dataset}}}})}
function submit(id,fields){root.events.submit({target:{id,fields},preventDefault(){}})}
(async()=>{
 await panel.refresh();assert.equal(root.hidden,true,'No user cannot view admin');
 user={id:userId};allow=false;
 await panel.refresh();assert.equal(root.hidden,true,'Non-admin denied');
 allow=true;await panel.refresh();
 assert.equal(root.hidden,false,'Verified admin can view console');
 assert.equal(get('home-management').hidden,false,'Admin management must appear on home');
 click({adminTab:'clubs'});
 assert.ok(get('admin-content').innerHTML.includes('&lt;img'),'Untrusted club HTML must be escaped');
 assert.ok(!get('admin-content').innerHTML.includes('<img src=x onerror'),'XSS must be prevented');
 click({adminAction:'new-club'});
 submit('admin-club-form',{name:'کانون تازه',category:'علمی',description:'شرح کانون',is_active:'1'});
 await wait();await wait();assert.ok(ops.some(o=>o.action==='club.create'&&o.data.is_active===true));
 click({adminTab:'members'});
 click({adminMember:memberId,status:'approved'});await wait();await wait();
 assert.ok(ops.some(o=>o.action==='member.decide'&&o.data.status==='approved'));
 click({adminTab:'secretaries'});
 submit('admin-secretary-form',{user_id:userId,club_id:clubId});await wait();await wait();
 assert.ok(ops.some(o=>o.action==='secretary.assign'));
 click({adminTab:'students'});click({adminVerify:userId,verify:'true'});await wait();await wait();
 assert.ok(ops.some(o=>o.action==='student.verify'&&o.data.verified===true));
 click({adminEditStudent:userId});
 assert.ok(get('admin-content').innerHTML.includes('admin-student-form'),'Academic edit form must render');
 user=null;panel.clear();
 assert.equal(root.hidden,true);
 assert.equal(get('home-management').hidden,true,'Logout must hide manager action');
 console.log('PASS manager role gating, home CTA, clubs, member approvals, secretary assignment, verification, XSS and logout');
})().catch(e=>{console.error(e);process.exitCode=1});
