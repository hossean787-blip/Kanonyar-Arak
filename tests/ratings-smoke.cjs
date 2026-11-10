'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('app/src/main/assets/index.html');
const student=read('app/src/main/assets/ratings.js');
const reports=read('app/src/main/assets/survey-report.js');
const backend=read('app/src/main/assets/backend.js');
const sql=read('supabase/surveys-v210-finalization.sql');
const pauseSql=read('supabase/surveys-v211-pausing.sql');
new vm.Script(student,{filename:'ratings.js'});
new vm.Script(reports,{filename:'survey-report.js'});
for(const id of ['screen-ratings','ratings-list','ratings-alerts','ratings-active-count',
 'ratings-contest-count','ratings-admin-open','ratings-notice'])
 assert.ok(html.includes('id="'+id+'"'),id);
for(const n of ['all','club','professor','faculty'])
 assert.ok(html.includes('data-ratings-tab="'+n+'"'));
for(const n of ['active','history','all'])
 assert.ok(html.includes('data-ratings-life="'+n+'"'));
assert.doesNotMatch(html,/صدای دانشجو|ratings-home-entry/);
assert.match(sql,/p_sources uuid\[\]/,'Atomic catalog selection');
assert.match(sql,/kanonha_surveys_audience_pair_check/);
assert.match(sql,/kanonha_survey_one_vote_per_person|kanonha_survey_votes_student_insert/);
assert.match(sql,/create or replace function public\.kanonha_survey_catalog/);
assert.match(pauseSql,/status='paused'/);
assert.match(backend,/surveyCatalog,surveySaveV21,surveyDuplicate,surveyChangeStatus,surveyParticipation,surveyAudit/);
assert.match(read('app/src/main/java/ir/kanonha/app/SurveyNoticeReceiver.java'),/setAndAllowWhileIdle/);

const elements={};
function el(id){
 return elements[id]??=(id=>({
  id,innerHTML:'',textContent:'',hidden:false,disabled:false,dataset:{},
  listeners:{},classList:{toggle(){}},addEventListener(k,fn){this.listeners[k]=fn},
  setAttribute(){},tabIndex:0
 }))(id);
}
const tabs=['all','club','professor','faculty'].map(k=>{
 const o=el('tab-'+k);o.dataset.ratingsTab=k;return o;
});
const lifeTabs=['active','history','all'].map(k=>{
 const o=el('life-'+k);o.dataset.ratingsLife=k;return o;
});
const document={readyState:'complete',getElementById:el,
 querySelectorAll(q){return q==='[data-ratings-tab]'?tabs:q==='[data-ratings-life]'?lifeTabs:[]}};
const uid='77777777-7777-4777-8777-777777777777';
const ids=['22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333',
 '44444444-4444-4444-8444-444444444444',
 '55555555-5555-4555-8555-555555555555'];
const opt=i=>'99999999-9999-4999-8999-'+String(i).padStart(12,'0');
const future=new Date(Date.now()+4*86400000).toISOString();
const past=new Date(Date.now()-86400000).toISOString();
const start=new Date(Date.now()-2*3600000).toISOString();
const polls=[
 {id:ids[0],title:'<script>bad</script>',category:'club',status:'published',
   kind:'regular',starts_at:start,ends_at:future,min_rank_votes:5,
   cover_path:ids[0]+'/cover.webp'},
 {id:ids[1],title:'مسابقه در حال اجرا',category:'professor',status:'published',
   kind:'competition',starts_at:start,ends_at:future,results_approved:false,min_rank_votes:5},
 {id:ids[2],title:'مسابقه منتظر اعلام',category:'faculty',status:'published',
   kind:'competition',starts_at:start,ends_at:past,results_approved:false,min_rank_votes:5},
 {id:ids[3],title:'مسابقه برندگان',category:'faculty',status:'archived',
   kind:'competition',starts_at:start,ends_at:past,results_approved:true,min_rank_votes:5}
];
const options=polls.flatMap((s,i)=>[
 {survey_id:s.id,id:opt(i*2+1),title:'گزینه اول '+i,sort_order:0},
 {survey_id:s.id,id:opt(i*2+2),title:'گزینه دوم '+i,sort_order:1}
]);
let current={id:uid},requested=[],votes=[],writes=[],synced=[];
const api={
 enabled:true,get currentUser(){return current;},
 surveyList:async()=>polls,
 surveyOptions:async()=>options,
 surveyMyVotes:async()=>votes,
 surveyCoverUrl:(id,path)=>path===id+'/cover.webp'?'https://kanonha-test.supabase.co/storage/v1/object/public/kanonha-survey-covers/'+path:'',
 surveyResults:async id=>{
  requested.push(id);
  if(id===ids[1]||id===ids[2])throw Error('Private contest results leaked');
  return [{option_id:options.find(o=>o.survey_id===id).id,rating_count:6,rating_sum:27}];
 },
 surveyVote:async(id,option,stars)=>{
  if(votes.some(v=>v.survey_id===id))throw {status:409};
  writes.push({id,option,stars});
  votes.push({survey_id:id,option_id:option,stars});
 }
};
const window={KanonhaBackend:api,AndroidSurveyNotices:{sync:s=>synced.push(s)},
  KanonhaAdminPanel:{hasAccess:()=>false}};
const ctx={window,document,console,Promise,Date,Intl,TextEncoder,btoa,Blob,URL,setTimeout};
vm.runInNewContext(reports,ctx,{timeout:3000});
vm.runInNewContext(student,ctx,{timeout:3000});
const sleep=()=>new Promise(r=>setTimeout(r,35));
function click(q,data){
 const item={dataset:data||{},disabled:false};
 el('screen-ratings').listeners.click({target:{closest:x=>x===q?item:null}});
}
(async()=>{
 await window.KanonhaRatings.open();
 let view=el('ratings-list').innerHTML;
 assert.match(view,/survey-cover-image/,'student cover must display');
 assert.match(view,/kanonha-survey-covers/);
 assert.match(view,/&lt;script&gt;bad&lt;\/script&gt;/,'XSS escaping');
 assert.ok(!view.includes('<script>bad</script>'));
 assert.deepEqual(requested,[ids[0],ids[3]],'only ordinary and approved-ended contest aggregations requested');
 assert.equal((view.match(/data-survey-card=/g)||[]).length,2,'active tab hides history');
 assert.match(view,/میانگین/);
 assert.match(view,/برترین گزینه/);
 assert.match(view,/آمار مسابقه تا روز پایان مخفی است/);
 assert.ok(synced.length===1,'local Android alerts synced on student refresh');

 click('[data-ratings-life]',{ratingsLife:'history'});
 view=el('ratings-list').innerHTML;
 assert.equal((view.match(/data-survey-card=/g)||[]).length,2);
 assert.match(view,/در انتظار تأیید و انتشار نتایج توسط مدیرکل/);
 assert.match(view,/مسابقه برندگان/);
 click('[data-ratings-life]',{ratingsLife:'active'});

 click('[data-survey-select]',{surveyId:ids[0],surveySelect:opt(1)});
 click('[data-survey-star]',{surveyId:ids[0],surveyStar:'5'});
 click('[data-survey-submit]',{surveySubmit:ids[0]});
 await sleep();
 assert.equal(writes.length,1,'one vote submitted');
 assert.equal(writes[0].stars,5);
 click('[data-survey-submit]',{surveySubmit:ids[0]});
 await sleep();
 assert.equal(writes.length,1,'repeat vote blocked');
 assert.match(el('ratings-list').innerHTML,/رأی قطعی شما/);

 current=null;requested=[];
 await window.KanonhaRatings.open();
 assert.equal(requested.length,0,'guest cannot fetch aggregates');
 assert.match(el('ratings-list').innerHTML,/برای مشاهده آمار وارد حساب شوید/);

 const tied=window.KanonhaSurveyReports.rank({min_rank_votes:5},
  [{id:opt(1),title:'الف'},{id:opt(2),title:'ب'},{id:opt(3),title:'ج'}],
  [{option_id:opt(1),rating_count:5,rating_sum:20},
   {option_id:opt(2),rating_count:5,rating_sum:20},
   {option_id:opt(3),rating_count:2,rating_sum:10}]);
 assert.equal(tied.filter(x=>x.rank===1).length,2,'equal scores and votes are co-winners');
 assert.equal(tied.find(x=>x.title==='ج').qualified,false,'min valid ballots enforced');
 console.log('PASS: protected competition, normal real-time stats, in-app/native alert sync, scoped results, ties, threshold and vote-once');
})().catch(e=>{console.error(e);process.exitCode=1});
