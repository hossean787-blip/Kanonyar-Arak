'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('app/src/main/assets/index.html');
const css=read('app/src/main/assets/styles.css');
const js=read('app/src/main/assets/app.js');
const edge=read('supabase/functions/kanonha-student-auth/index.ts');
for(const removed of [
 'تاریخ را فقط در تقویم شمسی انتخاب کنید',
 'دانشگاه و دانشکده را از فهرست',
 'اطلاعات فعلاً خوداظهاری است',
 'بازیابی حساب بدون ایمیل نیازمند پشتیبانی مدیرکل',
 'شماره موبایل (بدون کد تأیید)'
]) {
 assert.ok(!html.includes(removed),'Unnecessary registration explanation: '+removed);
 assert.ok(!js.includes(removed),'Unnecessary registration JS explanation: '+removed);
}
assert.match(html,/id="academic-catalog-status"[^>]*hidden><\/p>/);
assert.doesNotMatch(html,/id="signup-password-hint"/);
assert.match(css,/#screen-profile\[data-auth-view="signup"\] > \.screen-kicker/);
assert.match(css,/#screen-profile\[data-auth-view="signup"\] > \.online-connection/);
assert.match(css,/#screen-profile\[data-auth-view="signup"\] \.online-caption/);
assert.match(css,/#screen-profile\[data-auth-view="signup"\] \.jalali-hint/);
assert.match(edge,/email_confirm:true/);
assert.match(edge,/return reply\(201,\{session:signIn\.data\}\)/);
assert.doesNotMatch(edge.slice(edge.indexOf('async function create('),edge.indexOf('async function login(')),
 /kanonha_admins|adminApproval|pending_verification|requires_approval/);

const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
class Node {
 constructor(id) {
  this.id=id;this.innerHTML='';this.textContent='';this.value='';this.style={};
  this.dataset={};this.hidden=id.startsWith('screen-');this.disabled=false;
  this.attrs={};this.events={};this.isConnected=true;
  this.classList={add(){},toggle(){}};
 }
 addEventListener(name,callback){this.events[name]=callback;}
 setAttribute(name,value){this.attrs[name]=value;}
 querySelectorAll(){return [];}
 appendChild(child){child.parent=this;}
 focus(){}
}
const elements=new Map(ids.map(id=>[id,new Node(id)]));
const el=id=>{assert.ok(elements.has(id),'missing UI element '+id);return elements.get(id);};
const handlers={},location={search:'?native=1',hash:''};
const document={readyState:'complete',getElementById:el,
 querySelectorAll(q){
   return q==='.screen'
     ? ['home','clubs','events','activity','profile','workspace'].map(x=>el('screen-'+x)):[];
 },
 querySelector(){return null;},addEventListener(name,fn){handlers[name]=fn;},
 body:{classList:{add(){}}},activeElement:{isConnected:true,focus(){}}};
const uid='bbfa9157-5706-4166-aac6-d5ca8459fe06';
let user=null,managerChecks=0,studentRegistrations=0,secretaryRefreshes=0;
const api={
 enabled:true,get currentUser(){return user;},
 async studentSignUp(fields){
   studentRegistrations++;
   for(const name of ['name','studentNumber','nationalId','birthDate',
                      'mobile','university','faculty','major','password'])
     assert.ok(fields[name],'signup must submit '+name);
   user={id:uid};return user;
 },
 async isManager(){managerChecks++;return false;},
 async clubs(){return []},async events(){return []},
 async profile(){return {full_name:'دانشجو نمونه',student_number:'1234567890'}},
 async ensureProfile(){return this.profile()},
 async memberships(){return []},async registrations(){return []},
 async academicDetails(){return {university:'دانشگاه نمونه',faculty:'دانشکده نمونه',major:'علوم'}},
 async academicCatalog(){return {
   universities:[{id:'1a5b6545-4249-48b8-adf0-a735c45ab68a',name:'دانشگاه نمونه'}],
   faculties:[{university_id:'1a5b6545-4249-48b8-adf0-a735c45ab68a',name:'دانشکده نمونه'}]
 }},
 async signOut(){user=null;}
};
const window={KanonhaBackend:api,location,addEventListener(){}};
window.KanonhaSecretaryPanel={async refresh(){secretaryRefreshes++;el('secretary-panel').hidden=true},clear(){}};
window.KanonhaAdminPanel={async refresh(){el('admin-panel').hidden=true},clear(){}};
vm.runInNewContext(js,{window,document,location,Date,URLSearchParams,
 FormData:class{constructor(form){this.fields=form.fields}get(k){return this.fields[k]??null}},
 localStorage:{getItem(){return null},setItem(){}},
 history:{replaceState(_s,_t,to){location.hash=to}},
 console,setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:fn=>fn()
},{timeout:4500});
const wait=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 await wait();await wait();
 assert.equal(el('screen-profile').dataset.authView,'login');
 el('online-auth-toggle').events.click();
 assert.equal(el('screen-profile').dataset.authView,'signup');
 assert.equal(el('online-auth-title').textContent,'ثبت‌نام');
 assert.equal(el('online-auth-toggle').textContent,'ورود به حساب');
 assert.equal(el('bottom-nav').hidden,true);
 assert.equal(el('academic-catalog-status').textContent,'','healthy catalog should not show explanation');
 assert.equal(el('academic-catalog-status').hidden,true);
 assert.equal(el('student-signup-fields').hidden,false);
 assert.equal(el('online-password').minLength,10);
 const form={id:'online-auth-form',fields:{
   name:'دانشجوی نمونه',studentNumber:'1234567890',nationalId:'0084575948',
   birthDate:'2003-05-22',mobile:'09121234567',
   university:'دانشگاه نمونه',faculty:'دانشکده نمونه',
   major:'علوم',password:'sample-password-1234'
 },reset(){}};
 await handlers.submit({target:form,preventDefault(){}});
 await wait();await wait();
 assert.equal(studentRegistrations,1);
 assert.equal(managerChecks,0,'student signup must never check manager approval');
 assert.equal(window.KanonhaPreview.persona,'student');
 assert.equal(window.KanonhaPreview.screen,'home','new student should land on home');
 assert.equal(el('screen-profile').dataset.authView,'signed');
 assert.equal(el('bottom-nav').hidden,false,'student tabs immediately available');
 assert.ok(secretaryRefreshes>0,'role refresh still runs but is not a manager approval gate');
 console.log('PASS minimalist signup, no explanatory text, catalog selects, immediate student session without director approval');
})().catch(error=>{console.error(error);process.exitCode=1;});
