'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('app/src/main/assets/index.html');
const css=read('app/src/main/assets/styles.css');
const app=read('app/src/main/assets/app.js');
const backend=read('app/src/main/assets/backend.js');
const edge=read('supabase/functions/kanonha-student-auth/index.ts');
assert.match(html,/<button id="online-auth-title" class="v95-login-title-button"/);
assert.match(html,/id="student-login-kind" name="kind" hidden aria-hidden="true"/);
assert.match(html,/<option value="auto" selected>/);
assert.doesNotMatch(html, /id="auth-admin-entry"/);
assert.match(html,/id="online-auth-toggle"[^>]*>ساخت حساب کاربری<\/button>/);
assert.match(html,/<svg viewBox="0 0 64 64"/);
assert.match(css, /#screen-profile\[data-auth-view="login"\] > \.screen-kicker/);
assert.match(css, /#screen-profile\[data-auth-view="login"\] > \.online-connection/);
assert.match(edge, /"national","student","auto"/);
assert.match(edge,/automatic && useNational/);
assert.match(edge,/for\(const row of users.slice\(0,2\)\)/);
assert.match(backend, /\['student','national','auto'\]/);

const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
class Node {
 constructor(id) {
  this.id=id;this.innerHTML='';this.textContent='';this.value='';this.style={};
  this.dataset={};this.hidden=id.startsWith('screen-');this.disabled=false;
  this.attrs={};this.events={};this.isConnected=true;
  this.classList={add(){},toggle(){}};
 }
 addEventListener(name,cb){this.events[name]=cb}
 setAttribute(name,value){this.attrs[name]=value}
 querySelectorAll(){return []}
 appendChild(child){child.parent=this}
 focus(){}
}
const nodes=new Map(ids.map(id=>[id,new Node(id)]));
const el=id=>{assert.ok(nodes.has(id),'missing DOM '+id);return nodes.get(id)};
const callbacks={},location={search:'?native=1',hash:''};
const document={readyState:'complete',getElementById:el,
 querySelectorAll(q){
  if(q==='.screen') return ['home','clubs','events','activity','profile','workspace'].map(id=>el('screen-'+id));
  return [];
 },
 querySelector(){return null},addEventListener(name,fn){callbacks[name]=fn},
 body:{classList:{add(){}}},activeElement:{isConnected:true,focus(){}}};
const uid='ee0d98d0-089a-4d30-840d-7b58038bd18c';
let user=null;const signins=[];
const api={enabled:true,get currentUser(){return user},async studentSignIn(kind,id,pw){
 signins.push({kind,id,pw});user={id:uid};return user;
},async signIn(){user={id:uid};return user;},
 async isManager(){return false},async signOut(){user=null},
 async clubs(){return []},async events(){return []},
 async profile(){return {full_name:'دانشجوی نمونه',student_number:'1234567890'}},
 async ensureProfile(){return this.profile()},async memberships(){return []},
 async registrations(){return []},async academicDetails(){return null}
};
const window={KanonhaBackend:api,location,addEventListener(){}};
window.KanonhaSecretaryPanel={async refresh(){el('secretary-panel').hidden=true},clear(){}};
window.KanonhaAdminPanel={async refresh(){el('admin-panel').hidden=true},clear(){}};
vm.runInNewContext(app,{window,document,location,Date,URLSearchParams,
 FormData:class {constructor(form){this.fields=form.fields}get(k){return this.fields[k]??null}},
 localStorage:{getItem(){return null},setItem(){}},
 history:{replaceState(_s,_t,v){location.hash=v}},console,
 requestAnimationFrame:fn=>fn(),setTimeout:()=>1,clearTimeout(){}},{timeout:4000});
const touch=()=>el('online-auth-title').events.click();
const wait=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 await wait();await wait();
 assert.equal(el('screen-profile').dataset.authView,'login');
 assert.equal(el('online-auth-title').textContent,'ورود');
 assert.equal(el('online-auth-toggle').textContent,'ساخت حساب کاربری');
 assert.equal(el('bottom-nav').hidden,true);
 assert.equal(el('manager-login-fields').hidden,true);
 assert.equal(el('student-login-fields').hidden,false);

 for(let i=0;i<6;i++) touch();
 assert.equal(el('online-auth-title').textContent,'ورود','manager route must require 7 taps');
 touch();
 assert.equal(el('online-auth-title').textContent,'ورود مدیرکل');
 assert.equal(el('manager-login-fields').hidden,false);
 assert.equal(el('student-login-fields').hidden,true);
 el('auth-back-student').events.click();
 assert.equal(el('online-auth-title').textContent,'ورود');
 assert.equal(el('manager-login-fields').hidden,true);

 el('online-auth-toggle').events.click();
 assert.equal(el('screen-profile').dataset.authView,'signup');
 assert.match(el('online-auth-title').textContent,/ثبت‌نام/);
 for(let i=0;i<7;i++) touch();
 assert.match(el('online-auth-title').textContent,/ثبت‌نام/,'signup must not leak manager route');
 el('online-auth-toggle').events.click();
 assert.equal(el('screen-profile').dataset.authView,'login');
 assert.equal(el('online-auth-toggle').textContent,'ساخت حساب کاربری');

 const form={id:'online-auth-form',fields:{identifier:'1234567890',password:'verified-password'},reset(){}};
 await callbacks.submit({target:form,preventDefault(){}});
 await wait();await wait();
 assert.deepEqual(signins,[{kind:'auto',id:'1234567890',pw:'verified-password'}]);
 assert.equal(el('screen-profile').dataset.authView,'signed');
 assert.equal(el('bottom-nav').hidden,false);
 console.log('PASS minimal login title, secret 7 taps, signup isolation, hidden header, auto national/student login and normal account');
})().catch(e=>{console.error(e);process.exitCode=1});
