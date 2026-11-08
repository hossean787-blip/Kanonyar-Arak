'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const script=fs.readFileSync(path.join(root,'app/src/main/assets/app.js'),'utf8');
for(const id of ['role-switcher','role-option-student','role-option-secretary','role-option-manager','role-onboard-btn'])
 assert.ok(html.includes('id="'+id+'"'));
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);class E{
 constructor(id){this.id=id;this.value='';this.innerHTML='';this.textContent='';this.style={};this.dataset={};
  this.hidden=id==='role-switcher'||id==='home-management'||id==='admin-panel'||id==='secretary-panel';this.disabled=false;this.isConnected=true;
  this.classList={toggle(){},add(){}};this.events={}}
 addEventListener(t,fn){this.events[t]=fn}setAttribute(k,v){this[k]=v}
 querySelectorAll(){return []}focus(){}
}
const elements=new Map(ids.map(id=>[id,new E(id)]));const get=id=>elements.get(id);
const handlers={};const location={search:'?native=1',hash:''};const document={
 readyState:'complete',getElementById:get,querySelectorAll:q=>q==='.screen'?['home','clubs','events','activity','profile'].map(id=>get('screen-'+id)):[],
 addEventListener:(n,fn)=>handlers[n]=fn,activeElement:{isConnected:true,focus(){}},body:{classList:{add(){}}}
};
let user=null,profile=false,secretary=true,links=0;
const uid='10e0d003-8c4f-4d1a-b87a-cc349cc53001';
const api={enabled:true,get currentUser(){return user},
 async signIn(){user={id:uid};return user},async signOut(){user=null},async isManager(){return true},
 async clubs(){return []},async events(){return []},async profile(){return profile?{full_name:'Test Student',student_number:'12345678'}:null},
 async ensureProfile(){return this.profile()},async memberships(){return []},async registrations(){return []},
 async academicDetails(){return null},async adminAction(op){assert.equal(op,'manager.student.attach');links++;profile=true;return {linked:true}}
};
const window={KanonhaBackend:api,location,addEventListener(){}};
window.KanonhaAdminPanel={async refresh(){get('admin-panel').hidden=false},clear(){get('admin-panel').hidden=true}};
window.KanonhaSecretaryPanel={async refresh(){get('secretary-panel').hidden=!secretary},clear(){get('secretary-panel').hidden=true}};
vm.runInNewContext(script,{window,document,location,Date,URLSearchParams,
 FormData:class{constructor(f){this.fields=f.fields}get(k){return this.fields[k]??null}},
 localStorage:{getItem(){return null},setItem(){}},history:{replaceState(_x,_y,h){location.hash=h}},
 requestAnimationFrame:fn=>fn(),setTimeout:()=>1,clearTimeout(){},console},{timeout:3000});
const click=(dataset,id)=>handlers.click({target:{closest(){return {dataset,id}}}});
const submit=(id,fields)=>handlers.submit({target:{id,fields,reset(){}},preventDefault(){}});
const wait=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 await wait();await wait();
 assert.equal(get('role-switcher').hidden,true);
 click({authRole:'manager'});
 await submit('online-auth-form',{email:'director@example.test',password:'test-password'});
 assert.equal(get('role-switcher').hidden,false);
 assert.equal(get('role-option-manager')['aria-pressed'],'true');
 click({roleSwitch:'secretary'});assert.equal(get('secretary-panel').hidden,false);
 click({roleSwitch:'student'});assert.equal(get('role-onboard-btn').hidden,false);
 await submit('manager-student-form',{full_name:'Test Student',student_number:'12345678',national_id:'1234567891',
 birth_date:'2000-01-01',mobile:'09000000000',university:'Sample University',faculty:'Sample Faculty',major:'Sample Major'});
 assert.equal(links,1);assert.equal(user.id,uid);
 assert.equal(get('role-onboard-btn').hidden,true);
 click({roleSwitch:'manager'});assert.equal(get('admin-panel').hidden,false);
 secretary=false;click({},'role-refresh');await wait();await wait();
 assert.equal(get('role-option-secretary').hidden,true);
 click({action:'confirm-exit'});await wait();await wait();
 assert.equal(get('role-switcher').hidden,true);
 console.log('PASS single-session manager, secretary and student switch, onboarding and role refresh');
})().catch(e=>{console.error(e);process.exitCode=1});
