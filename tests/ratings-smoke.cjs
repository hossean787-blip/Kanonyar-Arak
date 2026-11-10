'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root,f),'utf8');
const html=read('app/src/main/assets/index.html');
const js=read('app/src/main/assets/ratings.js');
const backend=read('app/src/main/assets/backend.js');
const schema=read('supabase/ratings-v100.sql');
const controlSchema=read('supabase/ratings-manager-control-v110.sql');

for(const id of ['screen-ratings','ratings-list','ratings-leader-list','admin-ratings-content'])
  if(id!=='admin-ratings-content')assert.ok(html.includes('id="'+id+'"'));
assert.ok(html.includes('data-admin-tab="ratings"'));
assert.doesNotMatch(html,/صدای دانشجو/);
assert.match(html,/<h1 id="title-ratings">نظرسنجی<\/h1>/);
assert.doesNotMatch(html,/ratings-home-entry/);
const navJs=read('app/src/main/assets/app.js');
assert.match(navJs,/\{ id: 'ratings',\s+label: 'نظرسنجی'/);
assert.ok(fs.existsSync(path.join(root,'app/src/main/assets/assets/nav-ratings.svg')));

assert.ok(!html.includes('id="ratings-professor-form"'),'manager-only professor form must not be on student page');
for(const category of ['club','professor','faculty'])
  assert.ok(html.includes('data-ratings-tab="'+category+'"'));
assert.match(schema,/unique \(user_id,target_id\)/);
assert.match(controlSchema,/not \(voting_open and results_published\)/);
assert.match(controlSchema,/revoke select on public\.kanonha_rating_targets from anon,authenticated/);
assert.match(controlSchema,/grant select \(id,category,title,subtitle,is_active\)/);
assert.match(controlSchema,/create policy kanonha_rating_control_manager_update/);
assert.match(controlSchema,/where c\.id=1 and c\.voting_open and not c\.results_published/);
assert.match(backend,/ratingCatalog,ratingControl,ratingResults,ratingSetControl,ratingMyVotes/);
assert.ok(!backend.includes("select=id,category,title,subtitle,rating_count,rating_sum"));
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
let votes=[],written=[],control={voting_open:false,results_published:false};
const subjects=[
  {id:targetId,category:'club',title:'<script>unsafe</script>',subtitle:''},
  {id:'88888888-8888-4888-8888-888888888888',category:'faculty',
    title:'دانشکده آزمایشی',subtitle:'دانشگاه آزمایشی'}
];
const scores=[{target_id:targetId,rating_count:6,rating_sum:27}];
const api={
  enabled:true,currentUser:{id:userId},
  ratingCatalog:async()=>subjects,
  ratingControl:async()=>({...control}),
  ratingResults:async()=>control.results_published?scores:[],
  ratingMyVotes:async()=>votes,
  ratingSubmit:async(id,stars)=>{
    if(!control.voting_open)throw {status:403};
    if(votes.some(x=>x.target_id===id))throw {status:409};
    votes.push({target_id:id,stars});written.push({id,stars});
    scores[0].rating_count++;scores[0].rating_sum+=stars;
  }
};
const win={KanonhaBackend:api};
vm.runInNewContext(js,{window:win,document:doc,console,Promise,Intl});
(async()=>{
  await win.KanonhaRatings.open();
  assert.match(element('ratings-list').innerHTML,/&lt;script&gt;unsafe/);
  assert.ok(!element('ratings-list').innerHTML.includes('<script>unsafe</script>'));
  assert.ok(!element('ratings-list').innerHTML.includes('data-rating-value="5"'));
  assert.ok(!element('ratings-list').innerHTML.includes('4٫50'));
  assert.match(element('ratings-leader-list').innerHTML,/تا تأیید/);

  const button={dataset:{ratingId:targetId,ratingValue:'4'},disabled:false};
  const click=element('screen-ratings').listeners.click;
  click({target:{closest:s=>s==='[data-ratings-tab]'?null:button}});
  await new Promise(resolve=>setTimeout(resolve,15));
  assert.equal(written.length,0,'closed survey must reject UI voting');

  control={voting_open:true,results_published:false};
  await win.KanonhaRatings.open();
  assert.match(element('ratings-list').innerHTML,/data-rating-value="5"/);
  assert.ok(!element('ratings-leader-list').innerHTML.includes('ratings-leader"><span'));
  click({target:{closest:s=>s==='[data-ratings-tab]'?null:button}});
  await new Promise(resolve=>setTimeout(resolve,25));
  assert.equal(written.length,1);assert.equal(written[0].stars,4);
  click({target:{closest:s=>s==='[data-ratings-tab]'?null:button}});
  await new Promise(resolve=>setTimeout(resolve,15));
  assert.equal(written.length,1,'one vote per student and target');

  control={voting_open:false,results_published:false};
  await win.KanonhaRatings.open();
  assert.ok(!element('ratings-list').innerHTML.includes('4٫'));
  assert.match(element('ratings-leader-list').innerHTML,/محرمانه/);

  control={voting_open:false,results_published:true};
  await win.KanonhaRatings.open();
  assert.match(element('ratings-leader-list').innerHTML,/ratings-rank/);
  assert.match(element('ratings-list').innerHTML,/ratings-score/);
  click({target:{closest:s=>s==='[data-ratings-tab]'?tabs[1]:null}});
  assert.equal(element('ratings-category-heading').textContent,'امتیاز اساتید');
  assert.match(element('ratings-list').innerHTML,/هنوز موردی/);

  api.currentUser=null;
  click({target:{closest:s=>s==='[data-ratings-tab]'?tabs[0]:null}});
  await win.KanonhaRatings.open();
  assert.ok(!element('ratings-list').innerHTML.includes('ratings-score"><strong'));
  console.log('PASS: private preapproval, no closed voting, single vote, published ranking, guest protection, XSS');
})().catch(error=>{console.error(error);process.exitCode=1});
