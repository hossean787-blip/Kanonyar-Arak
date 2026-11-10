'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('app/src/main/assets/index.html');
const student=read('app/src/main/assets/ratings.js');
const backend=read('app/src/main/assets/backend.js');
const sql=read('supabase/surveys-v200.sql');
const app=read('app/src/main/assets/app.js');
new vm.Script(student,{filename:'ratings.js'});
for(const name of ['screen-ratings','ratings-list','ratings-notice','ratings-active-count','ratings-contest-count','ratings-admin-open'])
 assert.ok(html.includes('id="'+name+'"'),name);
for(const name of ['all','club','professor','faculty'])
 assert.ok(html.includes('data-ratings-tab="'+name+'"'));
assert.match(app,/id: 'ratings',\s+label: 'نظرسنجی'/);
assert.doesNotMatch(html,/صدای دانشجو|ratings-home-entry/);
assert.match(sql,/kanonha_survey_one_vote_per_person unique \(survey_id,user_id\)/);
assert.match(sql,/user_id=\(select auth\.uid\(\)\)/);
assert.match(sql,/s\.status='published' and clock_timestamp\(\)<s\.ends_at/);
assert.match(sql,/s\.kind='regular' or \(s\.kind='competition' and s\.ends_at<=now\(\) and s\.results_approved\)/);
assert.match(sql,/revoke all on public\.kanonha_surveys,public\.kanonha_survey_options,public\.kanonha_survey_votes/);
assert.match(sql,/revoke all on function public\.kanonha_survey_results\(uuid\) from public,anon,authenticated/);
assert.match(backend,/surveyList,surveyOptions,surveyMyVotes,surveyResults,surveyCreate/);
assert.match(backend,/body:\{survey_id:id,option_id:optionId,stars\}/);
assert.doesNotMatch(backend,/body:\{survey_id:id,option_id:optionId,stars,user_id:/);

const elements=new Map(),handlers={};
const element=id=>{
 if(!elements.has(id))elements.set(id,{
  id,innerHTML:'',textContent:'',hidden:false,disabled:false,attrs:{},dataset:{},
  classList:{toggle(){},add(){}},
  addEventListener(k,fn){this.handlers??={};this.handlers[k]=fn},
  setAttribute(k,v){this.attrs[k]=v},tabIndex:0
 });
 return elements.get(id);
};
const tabs=['all','club','professor','faculty'].map(key=>{
 const t=element('tab-'+key);t.dataset.ratingsTab=key;return t;
});
const document={readyState:'complete',getElementById:element,
 querySelectorAll(query){return query==='[data-ratings-tab]'?tabs:[]}};
const uid='11111111-1111-4111-8111-111111111111';
const regular='22222222-2222-4222-8222-222222222222';
const competition='33333333-3333-4333-8333-333333333333';
const pastContest='44444444-4444-4444-8444-444444444444';
const approvedContest='55555555-5555-4555-8555-555555555555';
const opt=id=>'99999999-9999-4999-8999-'+id.toString().padStart(12,'0');
const now=Date.now(),future=new Date(now+5*86400000).toISOString(),past=new Date(now-86400000).toISOString();
const polls=[
 {id:regular,title:'<script>unsafe</script>',category:'club',kind:'regular',status:'published',ends_at:future},
 {id:competition,title:'مسابقه در حال اجرا',category:'professor',kind:'competition',status:'published',ends_at:future,results_approved:false},
 {id:pastContest,title:'مسابقه پایان‌یافته',category:'faculty',kind:'competition',status:'published',ends_at:past,results_approved:false},
 {id:approvedContest,title:'مسابقه اعلام‌شده',category:'faculty',kind:'competition',status:'published',ends_at:past,results_approved:true}
];
const options=polls.flatMap((p,i)=>[
 {id:opt(i*2+1),survey_id:p.id,title:'گزینه الف '+i,sort_order:0},
 {id:opt(i*2+2),survey_id:p.id,title:'گزینه ب '+i,sort_order:1}
]);
let user={id:uid},actualVotes=[],requested=[],writes=[];
const api={
 enabled:true,get currentUser(){return user},
 surveyList:async()=>polls,
 surveyOptions:async()=>options,
 surveyMyVotes:async()=>actualVotes,
 surveyResults:async id=>{
  requested.push(id);
  if(id===competition||id===pastContest)throw Error('PRIVATE RESULT LEAK');
  return [{option_id:options.find(o=>o.survey_id===id).id,rating_count:6,rating_sum:27}];
 },
 surveyVote:async (surveyId,optionId,stars)=>{
  if(actualVotes.some(v=>v.survey_id===surveyId))throw {status:409};
  writes.push({surveyId,optionId,stars});
  actualVotes.push({survey_id:surveyId,option_id:optionId,stars});
 }
};
const win={KanonhaBackend:api};
vm.runInNewContext(student,{window:win,document,Date,Intl,Promise,console},{timeout:4000});
const click=(selector,value,attrs={})=>{
 const item={dataset:attrs,disabled:false};
 const selectors=Array.isArray(selector)?selector:[selector];
 element('screen-ratings').handlers.click({target:{closest:key=>selectors.includes(key)?item:null}});
};
const wait=()=>new Promise(resolve=>setTimeout(resolve,30));
(async()=>{
 await win.KanonhaRatings.open();
 let view=element('ratings-list').innerHTML;
 assert.match(view,/&lt;script&gt;unsafe&lt;\/script&gt;/);
 assert.ok(!view.includes('<script>unsafe</script>'));
 assert.deepEqual(requested,[regular,approvedContest],
  'regular results immediately visible; competition sealed until end and manager approval');
 assert.match(view,/آمار مسابقه تا روز پایان مخفی است/);
 assert.match(view,/در انتظار تأیید و انتشار نتایج توسط مدیرکل/);
 assert.match(view,/۴٫۵۰/,'normal survey results visible while open');
 assert.equal((view.match(/survey-card"/g)||[]).length,4);
 click('[data-survey-select]',null,{surveyId:regular,surveySelect:opt(1)});
 click('[data-survey-star]',null,{surveyId:regular,surveyStar:'5'});
 view=element('ratings-list').innerHTML;
 assert.match(view,/data-survey-submit/);
 click('[data-survey-submit]',null,{surveySubmit:regular});
 await wait();
 assert.equal(writes.length,1);
 assert.equal(writes[0].stars,5);
 assert.equal(writes[0].optionId,opt(1));
 click('[data-survey-submit]',null,{surveySubmit:regular});
 await wait();
 assert.equal(writes.length,1,'same student cannot vote twice in a poll');
 assert.match(element('ratings-list').innerHTML,/رأی قطعی شما/);
 user=null;requested=[];
 await win.KanonhaRatings.open();
 assert.equal(requested.length,0,'guests must never request aggregate results');
 assert.match(element('ratings-list').innerHTML,/برای مشاهده آمار وارد حساب شوید/);
 click('[data-ratings-tab]',null,{ratingsTab:'professor'});
 assert.equal(element('ratings-category-heading').textContent,'اساتید');
 console.log('PASS: new student survey cards, competition concealment, regular live aggregate, manager approval, XSS, vote once and guest protections');
})().catch(e=>{console.error(e);process.exitCode=1});
