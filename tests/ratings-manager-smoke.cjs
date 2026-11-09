'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const js=read('app/src/main/assets/ratings-admin.js');
const html=read('app/src/main/assets/index.html');
const admin=read('app/src/main/assets/admin.js');
new vm.Script(js,{filename:'ratings-admin.js'});
assert.ok(html.includes('data-admin-tab="ratings"'));
assert.match(admin,/KanonhaRatingManagement\.mount/);
assert.match(admin,/KanonhaRatingManagement\.clear/);
assert.ok(admin.includes("'universities','ratings'"));
const elements={};
function el(id){
  return elements[id] ||= {id,innerHTML:'',listeners:{},
    addEventListener(type,cb){this.listeners[type]=cb}};
}
const doc={readyState:'complete',getElementById:el,addEventListener(){}};
let access=true;
let control={voting_open:false,results_published:false};
const targetId='99999999-9999-4999-8999-999999999999';
let targets=[{id:targetId,category:'club',title:'<script>alert(1)</script>',subtitle:''}];
let report=[{target_id:targetId,rating_count:8,rating_sum:37}];
let writes=[],professors=[];
const api={
  ratingControl:async()=>({...control}),ratingCatalog:async()=>targets,
  ratingResults:async()=>report,
  ratingSetControl:async(fields)=>{
    if(!access)throw Error('forbidden');
    if(fields.voting_open&&fields.results_published)throw Error('mutually exclusive');
    control={...control,...fields};
    writes.push({...fields});return {...control};
  },
  ratingAddProfessor:async(title,subtitle)=>{
    if(!access)throw Error('forbidden');
    professors.push({title,subtitle});
    targets.push({id:'88888888-8888-4888-8888-888888888888',
      category:'professor',title,subtitle});return true;
  }
};
const win={KanonhaBackend:api,KanonhaAdminPanel:{hasAccess:()=>access}};
vm.runInNewContext(js,{window:win,document:doc,console,Promise,Intl});
const pause=()=>new Promise(r=>setTimeout(r,25));
const click=action=>el('admin-content').listeners.click({
  target:{closest:()=>({dataset:{ratingsAdminAction:action}})}
});
(async()=>{
  win.KanonhaRatingManagement.mount();
  await pause();
  assert.match(el('admin-ratings-content').innerHTML,/مدیریت نظرسنجی/);
  assert.match(el('admin-ratings-content').innerHTML,/&lt;script&gt;/);
  assert.match(el('admin-ratings-content').innerHTML,/پیش‌نمایش محرمانه/);
  assert.equal(writes.length,0,'must not auto-open voting');

  click('start');await pause();
  assert.equal(writes.length,1);
  assert.equal(control.voting_open,true);
  click('publish-ask');await pause();
  assert.equal(writes.length,1,'cannot publish while open');

  click('close');await pause();
  assert.equal(control.voting_open,false);
  click('publish-ask');
  assert.equal(writes.length,2,'first click only arms approval');
  assert.match(el('admin-ratings-content').innerHTML,/تأیید نهایی و انتشار/);
  click('publish-confirm');await pause();
  assert.equal(control.results_published,true,'only explicit second approval publishes');
  assert.equal(writes.length,3);

  click('unpublish');await pause();
  assert.equal(control.results_published,false);
  access=false;
  click('start');await pause();
  assert.equal(writes.length,4,'non-manager cannot start poll');
  console.log('PASS: manager panel, explicit two-click publication, preview security, revoke, unauthorized denial');
})().catch(e=>{console.error(e);process.exitCode=1});
