'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const file=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=file('app/src/main/assets/index.html');
const sql=file('supabase/notifications-v022.sql');
const edge=file('supabase/functions/kanonha-admin-console/index.ts');
const backend=file('app/src/main/assets/backend.js');
const app=file('app/src/main/assets/app.js');
assert.match(html,/data-admin-tab="notifications"/);
for(const name of ['admin-notifications.js','notifications.js','notifications.css'])
 assert.ok(html.includes(name),name);
for(const name of ['kanonha_notification_campaigns','kanonha_notification_deliveries',
 'notification_recipient_ids','kanonha_notification_publish',
 'kanonha_notification_preview','auth.uid()','grant update\(read_at\)'])
 assert.ok(sql.includes(name),'SQL '+name);
assert.match(sql,/revoke all on function public.kanonha_notification_publish/);
assert.match(sql,/grant execute on function public.kanonha_notification_publish[\s\S]*to service_role/);
assert.match(edge,/if\(op==="notification.preview"\|\|op==="notification.send"\)/);
assert.match(edge,/if\(op==="notification.history"\)/);
assert.match(backend,/async function notificationInbox\(\)/);
assert.match(backend,/async function notificationRead\(/);
assert.match(app,/openNotificationTarget:/);
const liveTest=async()=>{
 const title={textContent:''},subtitle={textContent:''},badge={textContent:''};
 let bannerClick;
 const banner={setAttribute(){},querySelector(sel){
  return sel==='.home-notice-title'?title:sel==='.home-notice-subtitle'?subtitle:
   sel==='.home-notice-new'?badge:null;
 },addEventListener(name,fn){if(name==='click')bannerClick=fn}};
 let onReady;
 const document={hidden:false,getElementById:id=>id==='notice-btn'?banner:null,
  addEventListener(name,fn){if(name==='DOMContentLoaded')onReady=fn;}};
 const inboxRows=[{id:'some-id',read_at:null,created_at:new Date().toISOString(),
  campaign:{id:'abc',kind:'event',title:'برنامه فرهنگی',body:'برای ثبت‌نام وارد شوید'}}];
 const api={enabled:true,currentUser:{id:'user-1'},async notificationInbox(){return inboxRows},
  async notificationRead(){return {}}};
 const window={KanonhaBackend:api,setInterval(){return 1}};
 vm.runInNewContext(file('app/src/main/assets/notifications.js'),{window,document,Date,Promise}, {filename:'notifications.js'});
 assert.equal(typeof window.KanonhaNotifications.refresh,'function');
 await window.KanonhaNotifications.refresh();
 assert.equal(title.textContent,'برنامه فرهنگی');
 assert.match(badge.textContent,/جدید/);
 onReady();
 assert.equal(typeof bannerClick,'function');
 window.KanonhaNotifications.clear();
 const rootNode={innerHTML:'',addEventListener(){},querySelectorAll(){return []}};
 const htmlNode={innerHTML:''};
 const doc2={getElementById:id=>id==='admin-panel'?rootNode:
   id==='admin-notices-content'?htmlNode:null};
 const window2={KanonhaBackend:{enabled:true,async adminAction(op){
   assert.equal(op,'notification.history');return [];
 }}};
 vm.runInNewContext(file('app/src/main/assets/admin-notifications.js'),
  {window:window2,document:doc2,Date,Promise,FormData}, {filename:'admin-notifications.js'});
 window2.KanonhaNoticeAdmin.mount({events:[],clubs:[],universities:[],faculties:[]});
 assert.match(htmlNode.innerHTML,/مرکز اطلاع‌رسانی/);
 assert.match(htmlNode.innerHTML,/دانشکده‌ها/);
 assert.match(htmlNode.innerHTML,/محاسبه گیرندگان/);
 assert.match(htmlNode.innerHTML,/ارسال قطعی/);
 console.log('PASS notifications v022: wiring, schema guards, inbox rendering and manager composer');
};
liveTest().catch(e=>{console.error(e);process.exitCode=1;});
