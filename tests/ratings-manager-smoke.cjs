'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('app/src/main/assets/index.html');
const manager=read('app/src/main/assets/ratings-admin.js');
const reports=read('app/src/main/assets/survey-report.js');
const backend=read('app/src/main/assets/backend.js');
const schema=read('supabase/surveys-v210-finalization.sql');
const pausing=read('supabase/surveys-v211-pausing.sql');
const imageSchema=read('supabase/surveys-v213-cover-image.sql');
assert.match(imageSchema,/kanonha-survey-covers/);
assert.match(imageSchema,/allowed_mime_types/);
assert.match(imageSchema,/kanonha_survey_cover_insert/);
assert.match(imageSchema,/s.status='draft'/);
const singleSql=read('supabase/surveys-v212-single-option.sql');
assert.match(singleSql,/v_count not between 1 and 12/);
assert.match(singleSql,/survey_requires_at_least_one_option/);
const admin=read('app/src/main/assets/admin.js');
new vm.Script(manager,{filename:'ratings-admin.js'});
new vm.Script(reports,{filename:'survey-report.js'});
assert.match(html,/data-admin-tab="ratings"/);
assert.match(admin,/KanonhaRatingManagement\.mount/);
assert.match(schema,/kanonha_survey_save\(/,'atomic SQL function exists');
assert.match(schema,/kanonha_survey_catalog\(/);
assert.match(schema,/kanonha_survey_audit/);
assert.match(schema,/kanonha_survey_participation/);
assert.match(schema,/survey_option_source_not_in_catalog/);
assert.match(pausing,/when 'paused' then 'paused'/,'pause events audited');
assert.match(backend,/surveySaveV21/);
const ids={
 competition:'22222222-2222-4222-8222-222222222222',
 created:'33333333-3333-4333-8333-333333333333',
 single:'88888888-8888-4888-8888-888888888888',
 faculty1:'44444444-4444-4444-8444-444444444444',
 faculty2:'55555555-5555-4555-8555-555555555555',
 faculty3:'66666666-6666-4666-8666-666666666666'
};
const idOpt=i=>'99999999-9999-4999-8999-'+String(i).padStart(12,'0');
let allowed=true,operations=[],csv=[],prints=[];
const future=new Date(Date.now()+7*86400000).toISOString();
const past=new Date(Date.now()-86400000).toISOString();
let polls=[{
 id:ids.competition,title:'<script>bad</script>',description:'',kind:'competition',
 category:'faculty',starts_at:past,ends_at:past,min_rank_votes:5,
 status:'published',results_approved:false
}];
let options=[
 {id:idOpt(1),survey_id:ids.competition,title:'دانشکده اول',source_id:ids.faculty1,sort_order:0},
 {id:idOpt(2),survey_id:ids.competition,title:'دانشکده دوم',source_id:ids.faculty2,sort_order:1}
];
const catalog=[
 {source_id:ids.faculty1,title:'دانشکده اول',category:'faculty',subtitle:'دانشگاه آزاد'},
 {source_id:ids.faculty2,title:'دانشکده دوم',category:'faculty',subtitle:'دانشگاه آزاد'},
 {source_id:ids.faculty3,title:'دانشکده سوم',category:'faculty',subtitle:'دانشگاه آزاد'}
];
const api={
 surveyList:async all=>{assert.equal(all,true);return polls.map(x=>({...x}))},
 surveyOptions:async()=>options.map(x=>({...x})),
 academicCatalog:async()=>({universities:[{id:ids.faculty3,name:'دانشگاه آزاد'}],
  faculties:catalog.map(x=>({id:x.source_id,university_id:ids.faculty3,name:x.title}))}),
 surveyAudit:async()=>[{survey_id:ids.competition,action:'published',occurred_at:past,actor_id:ids.faculty1}],
 surveyCatalog:async type=>type==='faculty'?catalog:[],
 surveySaveV21:async (id,fields,sources)=>{
  if(!allowed)throw Error('forbidden');
  operations.push({action:'save',id,fields,sources});
  if(sources.length<1||sources.length>12)throw Error('bad sources');
  const newId=sources.length===1?ids.single:ids.created;
  polls.push({id:newId,status:'draft',results_approved:false,...fields,
   audience_university_id:fields.audience_university_id,
   audience_faculty_id:fields.audience_faculty_id});
  options.push(...sources.map((sourceId,i)=>({
   survey_id:newId,id:idOpt(i+(sources.length===1?8:3)),source_id:sourceId,
   title:catalog.find(x=>x.source_id===sourceId).title,sort_order:i
  })));
  return newId;
 },
 surveyCoverUrl:(id,path)=>path===id+'/cover.webp'?'https://kanonha-test.supabase.co/storage/v1/object/public/kanonha-survey-covers/'+path:'',
 surveyCoverValidateFile:file=>{
   if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size<1||file.size>2097152)throw Error('bad image');
   return true;
 },
 surveyUploadCover:async(id,file)=>{
   if(!allowed)throw Error('forbidden');
   operations.push({action:'image',id,file});
   const p=polls.find(p=>p.id===id);p.cover_path=id+'/cover.webp';
   return p.cover_path;
 },
 surveyRemoveCover:async id=>{
   if(!allowed)throw Error('forbidden');
   operations.push({action:'remove_image',id});
   const p=polls.find(p=>p.id===id);p.cover_path=null;
   return true;
 },
 surveyPublish:async id=>{
  if(!allowed)throw Error('forbidden');
  operations.push({action:'publish',id});
  polls.find(p=>p.id===id).status='published';
  return true;
 },
 surveyApproveResults:async id=>{
  if(!allowed)throw Error('forbidden');
  const p=polls.find(p=>p.id===id);
  if(p.kind!=='competition'||p.ends_at>future)throw Error('wrong type');
  operations.push({action:'approve',id});p.results_approved=true;return true;
 },
 surveyChangeStatus:async (id,status)=>{
  if(!allowed)throw Error('forbidden');
  operations.push({action:'status',id,status});
  polls.find(p=>p.id===id).status=status;return true;
 },
 surveyDeleteDraft:async id=>{
  if(!allowed)throw Error('forbidden');
  operations.push({action:'delete',id});polls=polls.filter(p=>p.id!==id);return true;
 },
 surveyDuplicate:async id=>{
  if(!allowed)throw Error('forbidden');
  operations.push({action:'duplicate',id});return ids.created;
 },
 surveyResults:async id=>id===ids.created?
   [{option_id:idOpt(3),rating_count:6,rating_sum:27},
    {option_id:idOpt(4),rating_count:6,rating_sum:27}]:[],
 surveyParticipation:async()=>({eligible_students:40,voters:12}),
 ratingAddProfessor:async()=>{operations.push({action:'professor'});return true}
};
const els={};
function el(id){
 return els[id]??=(id=>({id,innerHTML:'',textContent:'',listeners:{},
  addEventListener(type,fn){this.listeners[type]=fn},querySelector(){return null}}))(id);
}
const document={
 readyState:'complete',getElementById:el,body:{appendChild(){}},
 createElement:()=>({click(){},remove(){}})
};
const mockJalali={
 enhance:()=>{},validateForm:()=>true,
 formatDate:s=>new Date(s).toLocaleDateString('fa-IR')
};
class FakeFormData{
 constructor(form){this.fields=form.fields}
 get(k){return this.fields[k]??null}
 getAll(k){return k==='sources'?this.fields.sources:[]}
}
const window={KanonhaBackend:api,KanonhaAdminPanel:{hasAccess:()=>allowed},
  KanonhaJalali:mockJalali,
  AndroidSurveyExports:{
   saveCsv:(name,b64)=>csv.push({name,b64}),
   printHtml:html=>prints.push(html)
  }
};
const context={window,document,console,Date,Intl,Promise,FormData:FakeFormData,
 TextEncoder,btoa,Blob,URL,setTimeout};
vm.runInNewContext(reports,context,{timeout:3000});
vm.runInNewContext(manager,context,{timeout:3000});
const delay=()=>new Promise(r=>setTimeout(r,40));
const click=(action,id)=>el('admin-content').listeners.click({
 target:{closest:q=>q==='[data-surveys-action]'?
  {dataset:{surveysAction:action,surveyId:id}}:null}
});
function submit(fields){
 el('admin-content').listeners.submit({
  target:{id:'survey-manager-form',fields},preventDefault(){}
 });
}
(async()=>{
 window.KanonhaRatingManagement.mount();
 await delay();
 let v=el('admin-ratings-content').innerHTML;
 assert.match(v,/استودیوی مدیریت/);
 assert.match(v,/name="starts_at"/);
 assert.match(v,/name="ends_at"/);
 assert.match(v,/name="university_id"/);
 assert.match(v,/name="faculty_id"/);
 assert.match(v,/name="min_rank_votes"/);
 assert.match(v,/type="checkbox" name="sources"/);
 assert.match(v,/name="cover_file"/,'manager photo upload input must exist');
 assert.match(v,/&lt;script&gt;bad&lt;\/script&gt;/);
 assert.match(v,/تأیید/);
 assert.equal(operations.length,0,'mount must not mutate backend');
 submit({title:'نظرسنجی برترین دانشکده',description:'فرایند رأی دانشجویان',
  category:'faculty',kind:'regular',starts_at:new Date(Date.now()-60000).toISOString().slice(0,16),
  ends_at:future.slice(0,16),min_rank_votes:'5',university_id:'',faculty_id:'',
  sources:[ids.faculty1,ids.faculty2]});
 await delay();
 assert.equal(operations[0].action,'save');
 assert.deepEqual(operations[0].sources,[ids.faculty1,ids.faculty2]);
 assert.equal(operations[0].fields.kind,'regular');
 assert.match(el('admin-ratings-content').innerHTML,/نظرسنجی برترین دانشکده/);

 click('publish-ask',ids.created);
 assert.equal(operations.length,1,'first confirmation click must not publish');
 assert.match(el('admin-ratings-content').innerHTML,/تأیید نهایی/);
 click('publish-confirm',ids.created);await delay();
 assert.equal(operations[1].action,'publish');
 assert.equal(polls.find(p=>p.id===ids.created).status,'published');

 click('report',ids.created);await delay();
 v=el('admin-ratings-content').innerHTML;
 assert.match(v,/گزارش و رتبه‌بندی واقعی/);
 assert.match(v,/رتبه اول مشترک/,'equal averages and counts share first place');
 assert.match(v,/۴۰/,'eligible students counted in private report');
 click('csv',ids.created);
 assert.equal(csv.length,1);
 assert.match(csv[0].name,/\.csv$/);
 click('pdf',ids.created);
 assert.equal(prints.length,1);
 assert.match(prints[0],/<!doctype html>/);
 assert.match(prints[0],/اطلاعات هویتی/);

 click('approve-ask',ids.competition);
 assert.equal(operations.length,2,'contest approval must require confirmation');
 click('approve-confirm',ids.competition);await delay();
 assert.equal(operations[2].action,'approve');

 click('pause-ask',ids.created);
 assert.equal(operations.length,3);
 click('pause-confirm',ids.created);await delay();
 assert.equal(operations[3].status,'paused');
 click('resume-ask',ids.created);click('resume-confirm',ids.created);await delay();
 assert.equal(operations[4].status,'published');

 allowed=false;
 click('cancel-ask',ids.created);
 assert.equal(operations.length,5,'nonmanager cannot mutate published survey');
  allowed=true;
  const makeForm=sources=>({
    title:'ارزیابی تک‌گزینه‌ای دانشکده',description:'امتیازدهی مستقل',
    category:'faculty',kind:'regular',
    starts_at:new Date(Date.now()-60000).toISOString().slice(0,16),
    ends_at:future.slice(0,16),min_rank_votes:'1',
    university_id:'',faculty_id:'',sources
  });
  submit(makeForm([]));await delay();
  assert.equal(operations.length,5,'zero options must not save');
  assert.match(el('admin-ratings-content').innerHTML,/۱ تا ۱۲ گزینه/);
  const file={name:'photo.png',type:'image/png',size:22000};
  submit({...makeForm([ids.faculty1]),cover_file:file});await delay();
  assert.equal(operations[5].action,'save','a single-option poll must save');
  assert.deepEqual(operations[5].sources,[ids.faculty1]);
  assert.equal(operations[6].action,'image','cover upload follows draft save');
  assert.equal(operations[6].id,ids.single);
  assert.equal(operations[6].file,file);
  assert.match(el('admin-ratings-content').innerHTML,/survey-manager-cover/);
  assert.ok(polls.some(p=>p.id===ids.single&&p.status==='draft'));
  click('publish-ask',ids.single);
  click('publish-confirm',ids.single);await delay();
  assert.equal(polls.find(p=>p.id===ids.single).status,'published','single-option poll must publish');
  assert.equal(polls.find(p=>p.id===ids.single).cover_path,ids.single+'/cover.webp');
 console.log('PASS: single-option save/publish, zero-option rejection, manager Jalali/form controls, 2-click publish/approval/pause, ranking, Excel/PDF bridges and role guard');
})().catch(e=>{console.error(e);process.exitCode=1});
