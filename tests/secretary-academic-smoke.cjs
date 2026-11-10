'use strict';
/* Regression: secretary academic ownership and dependent faculty selector.
 * This UI test intentionally does not depend on event creation / camera mocks.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const script=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/secretary.js'),'utf8');
const directoryId='10e0d003-8c4f-4d1a-b87a-cc349cc53001';
const clubId='10e0d003-8c4f-4d1a-b87a-cc349cc53011';
const uniA='10e0d003-8c4f-4d1a-b87a-cc349cc530a1', uniB='10e0d003-8c4f-4d1a-b87a-cc349cc530b1';
const elements=new Map();
function element(id){
  const el={id,hidden:false,innerHTML:'',textContent:'',style:{},value:'',dataset:{},
    listeners:{},classList:{toggle(){}},setAttribute(){},contains(){return true},
    addEventListener(type,fn){this.listeners[type]=fn},
    querySelectorAll(){return []}};
  elements.set(id,el);return el;
}
for(const id of ['secretary-panel','secretary-content','secretary-message','secretary-club-select',
  'home-management','home-management-overline','home-management-title','home-management-caption','home-management-btn'])
  element(id);
const root=elements.get('secretary-panel');
let user={id:directoryId},assigned=true,directoryFailure=false;
let patchCount=0,lastPatch=null;
const backend={
  enabled:true,get currentUser(){return user},
  async secretaryClubs(){return assigned?[{club_id:clubId}]:[]},
  async clubs(){return [{id:clubId,name:'کانون آزمایشی',category:'علمی',description:'توضیحات واقعی',
    university:'دانشگاه اول',faculty:'علوم انسانی'}]},
  async academicCatalog(){if(directoryFailure)throw new Error('Catalog offline');return {
    universities:[{id:uniA,name:'دانشگاه اول'},{id:uniB,name:'دانشگاه دوم'}],
    faculties:[{university_id:uniA,name:'علوم انسانی'},{university_id:uniA,name:'هنر'},
      {university_id:uniB,name:'مهندسی'}]
  }},
  async secretaryMemberships(){return []},
  async secretaryEvents(){return []},
  async secretaryProfiles(){return []},
  async secretaryUpdateClub(id,fields){
    assert.equal(id,clubId);patchCount++;lastPatch={...fields};return {id,...fields};
  }
};
const document={
  hidden:false,
  getElementById(id){return elements.get(id)||null},
  addEventListener(){}
};
const window={KanonhaBackend:backend};
class MockFormData{
  constructor(form){this.fields=form.fields}
  get(name){return this.fields[name]??null}
}
vm.runInNewContext(script,{window,document,FormData:MockFormData,Date,console},{filename:'secretary.js',timeout:3000});
const panel=window.KanonhaSecretaryPanel;
function submit(fields){
  root.listeners.submit({target:{id:'secretary-club-form',fields},preventDefault(){}});
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  await panel.refresh();
  assert.equal(root.hidden,false);
  const html=elements.get('secretary-content').innerHTML;
  assert.match(html,/name="university" data-secretary-university required/);
  assert.match(html,/name="faculty" data-secretary-faculty required/);
  assert.match(html,/دانشگاه اول/);
  assert.match(html,/علوم انسانی/);
  const faculty={innerHTML:'',value:'علوم انسانی',disabled:false};
  root.listeners.change({target:{dataset:{secretaryUniversity:''},value:'دانشگاه دوم',
    closest(){return {querySelector(){return faculty}}}}});
  assert.match(faculty.innerHTML,/مهندسی/);
  assert.doesNotMatch(faculty.innerHTML,/علوم انسانی/);
  assert.equal(faculty.value,'');
  assert.equal(faculty.disabled,false);
  const base={name:'کانون آزمایشی',category:'علمی',description:'درباره کانون',
    university:'دانشگاه دوم',faculty:'مهندسی'};
  submit({...base,university:'دانشگاه اول'});
  await flush();await flush();
  assert.equal(patchCount,0,'foreign faculty must be rejected in secretary UI');
  submit({...base,faculty:''});
  await flush();await flush();
  assert.equal(patchCount,0,'faculty is mandatory');
  submit({...base,description:'  '});
  await flush();await flush();
  assert.equal(patchCount,0,'about field remains mandatory');
  submit(base);
  await flush();await flush();
  assert.equal(patchCount,1,'valid academic choice must reach backend');
  assert.equal(lastPatch.university,'دانشگاه دوم');
  assert.equal(lastPatch.faculty,'مهندسی');
  directoryFailure=true;
  await panel.refresh();
  assert.equal(root.hidden,false,'academic catalog outage must not hide secretary memberships');
  assert.match(elements.get('secretary-content').innerHTML,/فهرست دانشگاه‌ها در دسترس نیست/);
  directoryFailure=false;
  await panel.refresh();
  assert.doesNotMatch(elements.get('secretary-content').innerHTML,/فهرست دانشگاه‌ها در دسترس نیست/);
  user=null;panel.clear();
  submit(base);await flush();
  assert.equal(patchCount,1,'logged-out secretary cannot patch');
  console.log('PASS secretary academic selector, faculty dependency, mandatory fields, submission and logout');
})().catch(e=>{console.error(e);process.exitCode=1});
