'use strict';
// Route-level regression for three UIs, two-role users and permission revocation.
// All database/role results are mocked; live RLS is checked separately.
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const root = path.resolve(__dirname,'..');
const html = fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const code = fs.readFileSync(path.join(root,'app/src/main/assets/app.js'),'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
for(const id of ['screen-workspace','workspace-title','workspace-role-menu',
 'workspace-secretary-summary','workspace-secretary-members','workspace-subnav'])
  assert.ok(ids.includes(id),'required workspaces node '+id);
class Node {
 constructor(id) { this.id=id; this.innerHTML='';this.textContent='';this.style={};
  this.dataset=id.startsWith('screen-')?{screen:id.slice(7)}:{};
  this.value='';this.hidden=id.startsWith('screen-')||id==='admin-panel'||id==='secretary-panel'||id==='workspace-role-menu';
  this.disabled=false;this.isConnected=true;this.attrs={};this.events={};
  this.classList={toggle(){},add(){}}; }
 addEventListener(type,fn){this.events[type]=fn}
 setAttribute(k,v){this.attrs[k]=v}
 querySelectorAll(){return []}
 appendChild(child){child.parent=this;return child}
 focus(){}
}
const elements=new Map(ids.map(id=>[id,new Node(id)]));
const get=id=>{assert.ok(elements.has(id),'DOM element '+id);return elements.get(id)};
const callbacks={},location={search:'?native=1',hash:''};
const pages=['home','clubs','events','ratings','activity','profile','workspace'];
const document={readyState:'complete',getElementById:get,
 querySelectorAll:q=>q==='.screen'?pages.map(id=>get('screen-'+id)):[],
 querySelector:()=>null,addEventListener:(k,fn)=>callbacks[k]=fn,
 body:{classList:{add(){}}},activeElement:{isConnected:true,focus(){}}};
const uid='10e0d003-8c4f-4d1a-b87a-cc349cc53001';
let user=null,managerAllowed=true,secretaryAllowed=true,adminTab='',secretaryTab='',managerCalls=0,secretaryCalls=0;
const api={enabled:true,get currentUser(){return user},
 async signIn(){user={id:uid};return user},async studentSignIn(){user={id:uid};return user},
 async isManager(){return managerAllowed},async signOut(){user=null},
 async clubs(){return []},async events(){return []},
 async profile(){return {full_name:'نمونه',student_number:'12345678'}},
 async ensureProfile(){return this.profile()},async memberships(){return []},async registrations(){return []},
 async academicDetails(){return {university:'نمونه',faculty:'دانشکده',major:'رشته'}}
};
const window={KanonhaBackend:api,location,addEventListener(){}};
window.KanonhaAdminPanel={
 async refresh(){managerCalls++;get('admin-panel').hidden=!managerAllowed},
 clear(){get('admin-panel').hidden=true},
 hasAccess(){return !!user&&managerAllowed},
 showTab(tab){adminTab=tab;return true}
};
window.KanonhaSecretaryPanel={
 async refresh(){secretaryCalls++;get('secretary-panel').hidden=!secretaryAllowed},
 clear(){get('secretary-panel').hidden=true},
 hasAssignments(){return !!user&&secretaryAllowed},
 showTab(tab){secretaryTab=tab;return true},
 summary(){return {clubs:1,members:9,events:4,club:'کانون پژوهشی'}}
};
vm.runInNewContext(code,{window,document,location,Date,URLSearchParams,
 FormData:class{constructor(form){this.fields=form.fields}get(k){return this.fields[k]??null}},
 localStorage:{getItem(){return null},setItem(){}},
 history:{replaceState(_s,_t,h){location.hash=h}},
 requestAnimationFrame:fn=>fn(),setTimeout:()=>1,clearTimeout(){},console},{timeout:3500});
const click=(dataset={},id='')=>callbacks.click({target:{closest(){return {dataset,id,setAttribute(){}}}}});
const submit=(id,fields)=>callbacks.submit({target:{id,fields,reset(){}},preventDefault(){}});
const wait=()=>new Promise(resolve=>setImmediate(resolve));
const preview=window.KanonhaPreview;
(async()=>{
 await wait();await wait();
 click({authRole:'manager'},'auth-role-manager');
 await submit('online-auth-form',{email:'hossean787@gmail.com',password:'example-safe-password'});
 assert.equal(preview.persona,'manager');
 assert.equal(preview.screen,'manager-home');
 assert.equal(get('screen-workspace').hidden,false);
 assert.equal(get('screen-home').hidden,true);
 assert.equal(adminTab,'dashboard');
 assert.match(get('bottom-nav').innerHTML,/manager-users/);
 assert.match(get('bottom-nav').innerHTML,/data-screen-btn=\"ratings\"/);
 assert.doesNotMatch(get('bottom-nav').innerHTML,/secretary-members/);
 click({screenBtn:'manager-clubs'});assert.equal(adminTab,'clubs');
 click({screenBtn:'manager-users'});assert.equal(adminTab,'students');
 click({workspaceSubtab:'secretaries'});assert.equal(adminTab,'secretaries');
 click({workspaceSubtab:'members'});assert.equal(adminTab,'members');
 click({screenBtn:'manager-events'});assert.equal(adminTab,'events');
 click({screenBtn:'manager-account'});
 assert.equal(get('screen-profile').hidden,false);
 assert.equal(get('screen-workspace').hidden,true);
 assert.equal(get('title-profile').textContent,'حساب مدیرکل');
 click({screenBtn:'manager-home'});
 click({},'workspace-change-role');assert.equal(get('workspace-role-menu').hidden,false);
 click({roleSwitch:'secretary'});
 assert.equal(preview.persona,'secretary');
 assert.equal(preview.screen,'secretary-home');
 assert.equal(get('workspace-secretary-summary').hidden,false);
 assert.equal(get('workspace-secretary-members').textContent,'۹');
 assert.equal(get('workspace-secretary-club').textContent,'کانون پژوهشی');
 assert.match(get('bottom-nav').innerHTML,/secretary-club/);
 assert.match(get('bottom-nav').innerHTML,/data-screen-btn=\"ratings\"/);
 assert.doesNotMatch(get('bottom-nav').innerHTML,/manager-users/);
 click({workspaceRoute:'secretary-members'});assert.equal(secretaryTab,'members');
 click({workspaceSubtab:'attendance'});assert.equal(secretaryTab,'attendance');
 click({screenBtn:'secretary-events'});assert.equal(secretaryTab,'events');
 click({screenBtn:'secretary-club'});assert.equal(secretaryTab,'club');
 click({roleSwitch:'student'});
 assert.equal(preview.persona,'student');
 assert.equal(preview.screen,'home');
 assert.equal(get('screen-home').hidden,false);
 assert.match(get('bottom-nav').innerHTML,/data-screen-btn="activity"/);
 assert.doesNotMatch(get('bottom-nav').innerHTML,/secretary-members/);
 preview.go('manager-users');assert.equal(preview.screen,'home','student cannot navigate to manager');
 click({roleSwitch:'secretary'});
 secretaryAllowed=false;
 click({},'role-refresh');await wait();await wait();
 assert.equal(get('role-option-secretary').hidden,true,'revoked secretary still offered');
 assert.equal(preview.persona,'manager','role must fall back on revocation');
 assert.equal(preview.screen,'manager-home');
 click({action:'confirm-exit'});await wait();await wait();
 assert.equal(preview.persona,'student');
 assert.equal(preview.screen,'profile');
 assert.equal(get('role-switcher').hidden,true);
 assert.equal(user,null);
 // A student who is also a secretary must not see the manager workspace.
 managerAllowed=false;secretaryAllowed=true;
 click({authRole:'student'},'auth-role-student');
 await submit('online-auth-form',{kind:'student',identifier:'12345678',password:'example-safe-password'});
 assert.equal(preview.persona,'student');
 assert.equal(get('role-option-manager').hidden,true);
 assert.equal(get('role-option-secretary').hidden,false);
 click({roleSwitch:'secretary'});assert.equal(preview.screen,'secretary-home');
 assert.doesNotMatch(get('bottom-nav').innerHTML,/manager-home/);
 preview.go('manager-home');assert.equal(preview.screen,'secretary-home');
 assert.ok(managerCalls>1&&secretaryCalls>1);
 console.log('PASS three independent role workspaces, stats, five tabs, isolation, revocation, logout and dual-role user');
})().catch(e=>{console.error(e);process.exitCode=1});
