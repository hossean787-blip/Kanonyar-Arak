'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const js=read('app/src/main/assets/ratings-admin.js');
const html=read('app/src/main/assets/index.html');
const admin=read('app/src/main/assets/admin.js');
const schema=read('supabase/surveys-v200.sql');
new vm.Script(js,{filename:'ratings-admin.js'});
assert.match(html,/data-admin-tab="ratings"/);
assert.match(admin,/KanonhaRatingManagement\.mount/);
assert.match(admin,/KanonhaRatingManagement\.clear/);
assert.match(schema,/kanonha_surveys_manager_insert/);
assert.match(schema,/kanonha_surveys_manager_update/);
assert.match(schema,/kanonha_survey_options_manager_insert/);
assert.match(schema,/survey_requires_at_least_two_options/);
assert.match(schema,/published_survey_is_locked/);
assert.match(schema,/results_approval_not_allowed_before_competition_end/);

const els={};
const element=id=>els[id]??=(id=>({id,innerHTML:'',listeners:{},
  addEventListener(type,callback){this.listeners[type]=callback}}))(id);
const doc={readyState:'complete',getElementById:element};
const draftId='11111111-1111-4111-8111-111111111111';
const competitionId='22222222-2222-4222-8222-222222222222';
const datePlus=days=>new Date(Date.now()+days*86400000).toISOString();
let allowed=true;
let polls=[{id:competitionId,title:'<script>bad</script>',description:'',
 category:'club',kind:'competition',status:'published',results_approved:false,ends_at:datePlus(-1)}];
let options=[{id:'88888888-8888-4888-8888-888888888888',survey_id:competitionId,title:'کانون یک',sort_order:0},
 {id:'99999999-9999-4999-8999-999999999999',survey_id:competitionId,title:'کانون دو',sort_order:1}];
const operations=[];
const api={
 surveyList:async includeDrafts=>{assert.equal(includeDrafts,true);return polls.map(p=>({...p}))},
 surveyOptions:async()=>options.map(o=>({...o})),
 surveyResults:async()=>[],
 surveyCreate:async(fields,items)=>{
  if(!allowed)throw Error('forbidden');
  operations.push({action:'create',fields,items});
  polls.push({...fields,id:draftId,status:'draft',results_approved:false});
  options.push(...items.map((title,i)=>({id:'77777777-7777-4777-8777-'+String(i+1).padStart(12,'0'),
   survey_id:draftId,title,sort_order:i})));
  return polls.at(-1);
 },
 surveyUpdateDraft:async(id,fields,items)=>{
  if(!allowed)throw Error('forbidden');
  operations.push({action:'edit',id,fields,items});
  polls=polls.map(p=>p.id===id?{...p,...fields}:p);
  return polls.find(p=>p.id===id);
 },
 surveyPublish:async id=>{
  if(!allowed)throw Error('forbidden');
  const p=polls.find(p=>p.id===id);
  if(!p||p.status!=='draft'||p.ends_at<=datePlus(0))throw Error('cannot publish');
  operations.push({action:'publish',id});
  p.status='published';return p;
 },
 surveyApproveResults:async id=>{
  if(!allowed)throw Error('forbidden');
  const p=polls.find(p=>p.id===id);
  if(!p||p.kind!=='competition'||p.status!=='published'||new Date(p.ends_at)>new Date())throw Error('blocked');
  operations.push({action:'approve',id});p.results_approved=true;return p;
 },
 surveyDeleteDraft:async id=>{
  if(!allowed)throw Error('forbidden');
  operations.push({action:'delete',id});
  polls=polls.filter(p=>p.id!==id);return true;
 }
};
const win={KanonhaBackend:api,KanonhaAdminPanel:{hasAccess:()=>allowed}};
class FakeFormData{
 constructor(form){this.fields=form.fields}
 get(name){return this.fields[name]??null}
}
vm.runInNewContext(js,{document:doc,window:win,FormData:FakeFormData,
 Date,Intl,Promise,console},{timeout:4500});
const wait=()=>new Promise(res=>setTimeout(res,30));
const click=(action,id)=>element('admin-content').listeners.click({
 target:{closest:s=>s==='[data-surveys-action]'?{dataset:{surveysAction:action,surveyId:id}}:null}
});
const submit=fields=>element('admin-content').listeners.submit({
 target:{id:'survey-manager-form',fields},preventDefault(){}
});
(async()=>{
 win.KanonhaRatingManagement.mount();
 await wait();
 let page=element('admin-ratings-content').innerHTML;
 assert.match(page,/ساخت نظرسنجی جدید/);
 assert.match(page,/نوع انتشار نتایج/);
 assert.match(page,/name="kind"/);
 assert.match(page,/type="datetime-local"/);
 assert.match(page,/name="options"/);
 assert.match(page,/&lt;script&gt;bad&lt;\/script&gt;/,'escape data from database');
 assert.match(page,/تأیید و اعلام نتایج مسابقه/,'manager can approve ended competition');
 assert.equal(operations.length,0,'loading must not mutate backend');

 submit({title:'بهترین کانون‌ها',category:'club',kind:'regular',
   description:'نظرسنجی معمولی',ends_at:datePlus(7).slice(0,16),options:'کانون الف\nکانون ب'});
 await wait();
 assert.equal(operations[0].action,'create');
 assert.equal(operations[0].fields.kind,'regular');
 assert.equal(operations[0].items.length,2);
 page=element('admin-ratings-content').innerHTML;
 assert.match(page,/بهترین کانون‌ها/);

 click('publish-ask',draftId);
 assert.equal(operations.length,1,'first publish click only requests explicit approval');
 assert.match(element('admin-ratings-content').innerHTML,/تأیید نهایی انتشار/);
 click('publish-confirm',draftId);await wait();
 assert.equal(operations[1].action,'publish','published only after second approval');
 assert.equal(polls.find(x=>x.id===draftId).status,'published');

 click('approve-ask',competitionId);
 assert.equal(operations.length,2,'first contest approval click must be non-mutating');
 click('approve-confirm',competitionId);await wait();
 assert.equal(operations[2].action,'approve');
 assert.equal(polls[0].results_approved,true);

 allowed=false;
 click('publish-ask',draftId);
 assert.equal(operations.length,3,'unauthorized users must not control polls');
 win.KanonhaRatingManagement.clear();
 console.log('PASS: manager draft form, category and mode selection, XSS, two-click publish, after-deadline competition release and role guard');
})().catch(e=>{console.error(e);process.exitCode=1});
