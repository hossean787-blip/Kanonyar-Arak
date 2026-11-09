'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html=read('app/src/main/assets/index.html');
const js=read('app/src/main/assets/ratings.js');
const backend=read('app/src/main/assets/backend.js');
const schema=read('supabase/ratings-v100.sql');

for (const id of ['screen-ratings','ratings-list','ratings-leader-list',
  'ratings-professor-form','ratings-manager'])
  assert.ok(html.includes('id="'+id+'"'), 'rating element missing: '+id);
for (const category of ['club','professor','faculty'])
  assert.ok(html.includes('data-ratings-tab="'+category+'"'));
assert.match(schema,/unique \(user_id,target_id\)/);
assert.match(schema,/for insert to authenticated/);
assert.match(schema,/revoke all on public\.kanonha_ratings from anon,authenticated/);
assert.match(schema,/stars between 1 and 5/);
assert.match(backend,/ratingCatalog,ratingMyVotes,ratingSubmit,ratingAddProfessor/);
assert.match(backend,/if\(error && error\.status===409\)/);
new vm.Script(js,{filename:'ratings.js'});

const elements={};
function element(id){
  if(!elements[id]){
    elements[id]={id,innerHTML:'',textContent:'',hidden:false,dataset:{},listeners:{},
      classList:{toggle(){}},addEventListener(n,cb){this.listeners[n]=cb},
      setAttribute(){},querySelector(){return null},tabIndex:0};
  }
  return elements[id];
}
const tabs=['club','professor','faculty'].map(name=>{
  const tab=element('tab-'+name);tab.dataset.ratingsTab=name;return tab;
});
const doc={readyState:'complete',getElementById:element,querySelectorAll(){return tabs}};
const targetId='99999999-9999-4999-8999-999999999999';
const userId='77777777-7777-4777-8777-777777777777';
let votes=[],written=[];
const subjects=[
  {id:targetId,category:'club',title:'<script>unsafe</script>',
    subtitle:'',rating_count:6,rating_sum:27},
  {id:'88888888-8888-4888-8888-888888888888',category:'faculty',
    title:'دانشکده آزمایشی',subtitle:'دانشگاه آزمایشی',rating_count:0,rating_sum:0}
];
const api={
  enabled:true,currentUser:{id:userId},
  ratingCatalog:async()=>subjects,
  ratingMyVotes:async()=>votes,
  isManager:async()=>false,
  ratingSubmit:async(id,stars)=>{
    if(votes.some(x=>x.target_id===id))throw {status:409};
    votes.push({target_id:id,stars});
    written.push({id,stars});
    subjects[0].rating_count++;subjects[0].rating_sum+=stars;
  }
};
const win={KanonhaBackend:api};
vm.runInNewContext(js,{window:win,document:doc,console,Promise,Intl});
(async()=>{
  await win.KanonhaRatings.open();
  assert.match(element('ratings-list').innerHTML,/&lt;script&gt;unsafe/);
  assert.ok(!element('ratings-list').innerHTML.includes('<script>unsafe</script>'));
  assert.match(element('ratings-list').innerHTML,/data-rating-value="5"/);
  assert.match(element('ratings-leader-list').innerHTML,/ratings-leader/);

  const button={dataset:{ratingId:targetId,ratingValue:'4'},disabled:false};
  const click=element('screen-ratings').listeners.click;
  click({target:{closest:s=>s==='[data-ratings-tab]'?null:button}});
  await new Promise(resolve=>setTimeout(resolve,25));
  assert.equal(written.length,1);
  assert.equal(written[0].stars,4);
  assert.match(element('ratings-list').innerHTML,/ثبت‌شده/);
  click({target:{closest:s=>s==='[data-ratings-tab]'?null:button}});
  await new Promise(resolve=>setTimeout(resolve,15));
  assert.equal(written.length,1,'second UI vote must never be sent');

  click({target:{closest:s=>s==='[data-ratings-tab]'?tabs[1]:null}});
  assert.equal(element('ratings-category-heading').textContent,'امتیاز اساتید');
  assert.match(element('ratings-list').innerHTML,/هنوز موردی/);

  api.currentUser=null;
  click({target:{closest:s=>s==='[data-ratings-tab]'?tabs[0]:null}});
  await win.KanonhaRatings.open();
  assert.match(element('ratings-list').innerHTML,/وارد حساب/);
  console.log('PASS: three tabs, escape, ranking, one vote UI, persistence refetch, guest mode');
})().catch(error=>{console.error(error);process.exitCode=1});
