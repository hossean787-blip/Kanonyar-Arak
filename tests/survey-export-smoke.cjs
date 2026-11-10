'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const source=read('app/src/main/assets/survey-report.js');
const backend=read('app/src/main/assets/backend.js');
const app=read('app/src/main/assets/app.js');
const manifest=read('app/src/main/AndroidManifest.xml');
const activity=read('app/src/main/java/ir/kanonha/app/MainActivity.java');
const exportJava=read('app/src/main/java/ir/kanonha/app/SurveyExportBridge.java');
const notices=read('app/src/main/java/ir/kanonha/app/SurveyNoticeReceiver.java');
const sql=read('supabase/surveys-v210-finalization.sql');
const pausing=read('supabase/surveys-v211-pausing.sql');
const rendered=[],saved=[];
const window={AndroidSurveyExports:{
 saveCsv:(fileName,b64)=>saved.push({fileName,b64}),
 printHtml:html=>rendered.push(html)
}};
vm.runInNewContext(source,{window,TextEncoder,btoa,Intl,Date,console,setTimeout},{timeout:4000});
const api=window.KanonhaSurveyReports;
const survey={title:'<script>alert(1)</script>',description:'بررسی کامل گزارش',category:'faculty',
 kind:'competition',ends_at:'2026-11-30T12:30:00Z',min_rank_votes:5};
const options=[
 {id:'a',title:'=HYPERLINK("https://bad.test")'},
 {id:'b',title:'گزینه ب'},
 {id:'c',title:'گزینه ج'}
];
const results=[
 {option_id:'a',rating_count:5,rating_sum:20},
 {option_id:'b',rating_count:5,rating_sum:20},
 {option_id:'c',rating_count:3,rating_sum:15}
];
const ranked=api.rank(survey,options,results);
assert.equal(ranked.filter(x=>x.rank===1).length,2,'tied average and votes share first rank');
assert.equal(ranked.find(x=>x.option_id==='c').rank,null,'under threshold excluded from winner');
const csv=api.buildCsv(survey,options,results,{eligible_students:50,voters:13});
assert.ok(csv.startsWith('\uFEFF'),'Excel UTF-8 BOM');
assert.match(csv,/'=HYPERLINK/,'potential Excel formulas must be escaped as text');
assert.match(csv,/تعداد رأی/,'CSV columns in Persian');
assert.ok(api.saveCsv('Survey.csv',csv),'CSV delegated to native file picker');
assert.equal(saved.length,1);
assert.equal(saved[0].fileName,'Survey.csv');
const bytes=Buffer.from(saved[0].b64,'base64');
assert.ok(bytes.toString('utf8').startsWith('\uFEFF'));
const html=api.buildHtml(survey,options,results,{eligible_students:50,voters:13});
assert.ok(html.startsWith('<!doctype html>'),'printable HTML');
assert.ok(!html.includes('<script>alert(1)</script>'),'HTML escapes user input');
assert.match(html,/&lt;script&gt;alert/);
assert.match(html,/گزارش آماری/);
assert.match(html,/اطلاعات هویتی و رأی انفرادی/);
assert.ok(api.printPdf(html),'native Android print document adapter invoked');
assert.equal(rendered.length,1);
assert.match(activity,/SurveyExportBridge/);
assert.match(activity,/AndroidSurveyNotices/);
assert.match(activity,/AndroidSurveyExports/);
assert.match(exportJava,/ACTION_CREATE_DOCUMENT/,'CSV uses Android SAF document picker');
assert.match(exportJava,/createPrintDocumentAdapter/,'PDF uses platform print service');
assert.match(exportJava,/setJavaScriptEnabled\(false\)/,'report WebView blocks scripts');
assert.match(notices,/setAndAllowWhileIdle/,'native start/end reminders');
assert.match(notices,/POST_NOTIFICATIONS/);
assert.match(notices,/released\./,'result notification deduplicated');
assert.match(manifest,/\.SurveyNoticeReceiver/,'boot rescheduling receiver');
assert.match(backend,/AndroidSurveyNotices\.clear\(\)/,'logout deletes campus-specific reminders');
assert.match(app,/KanonhaRatings\.backgroundSync\(\)/,'login syncs reminders');
assert.match(sql,/security definer set search_path=''/,'RPC locks down search path');
assert.match(sql,/kanonha_survey_audit_manager_read/);
assert.match(pausing,/kanonha_surveys_read/);
console.log('PASS: CSV formula escaping, Excel UTF-8, secure PDF print, tie ranking, privacy, alerts and lifecycle code');
