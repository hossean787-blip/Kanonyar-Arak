'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'app/src/main/assets/activity-ui.js'),'utf8');
const app=fs.readFileSync(path.join(root,'app/src/main/assets/app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const backend=fs.readFileSync(path.join(root,'app/src/main/assets/backend.js'),'utf8');
const nodes=new Map();
class Node {
  constructor(id){this.id=id;this.innerHTML='';this.textContent='';this.hidden=false;this.disabled=false;}
  querySelectorAll(selector){
    if(selector!=='[data-ticket-qr]')return [];
    return [...this.innerHTML.matchAll(/data-ticket-qr="(\d+)"/g)]
      .map(m=>({dataset:{ticketQr:m[1]},textContent:''}));
  }
}
const document={getElementById(id){if(!nodes.has(id))nodes.set(id,new Node(id));return nodes.get(id);}};
let qrCalls=[];
const window={KanonhaEventTools:{renderQr(el,token){qrCalls.push(token);return Boolean(token);}}};
vm.runInNewContext(code,{window,document,Date,Number,Map,Set},{filename:'activity-ui.js',timeout:3000});
const panel=window.KanonhaActivity;
const malicious='<img src=x onerror=alert(1)>';
const ids=['a','b','c'],token='fc9ec2ef-75b1-485e-afaa-720cb7962348';
const clubs=ids.map((id,i)=>({title:malicious+id,university:'دانشگاه',category:'کانون',icon:'leaf'}));
const events=[
 {id:'open',title:malicious,date:'۱۴۰۶/۰۳/۰۴',location:malicious,startsAtMs:Date.now()+86400000},
 {id:'old',title:'رویداد گذشته',date:'۱۴۰۰/۰۲/۰۱',location:'سالن',startsAtMs:946684800000}
];
const state={joined:[0],requested:[1],rejected:[2],registered:[0,1],attended:[1]};
const opts={clubs,events,state,onlineMode:true,eventTickets:new Map([['open',token],['old',token]])};
const get=id=>document.getElementById(id).innerHTML;
panel.render(opts);
assert.match(get('activity-overview'),/کانون‌های عضو/);
assert.match(get('activity-clubs'),/منتظر تأیید دبیر/);
assert.match(get('activity-clubs'),/درخواست مجدد/);
assert.match(get('activity-events'),/حضور ثبت شده/);
assert.ok(get('activity-tickets').includes('data-ticket-qr="0"'));
assert.ok(!get('activity-tickets').includes('data-ticket-qr="1"'),'past/attended QR must not be displayed');
assert.ok(!get('activity-tickets').includes('sample-qr'),'live mode never displays fake QR');
assert.deepEqual(qrCalls,[token]);
assert.ok(!get('activity-clubs').includes(malicious),'HTML injection in club');
assert.ok(!get('activity-events').includes(malicious),'HTML injection in event');
assert.ok(!get('activity-tickets').includes(malicious),'HTML injection in ticket');
panel.setFilter('club','pending');
assert.ok(get('activity-clubs').includes('منتظر تأیید دبیر'));
assert.ok(!get('activity-clubs').includes('ردشده'));
panel.setFilter('event','past');
assert.ok(get('activity-events').includes('رویداد گذشته'));
assert.ok(!get('activity-events').includes('۱۴۰۶/۰۳/۰۴'));
panel.setFilter('club','approved');
assert.ok(get('activity-clubs').includes('عضویت تأییدشده'));
panel.render({...opts,state:{joined:[],requested:[],rejected:[],registered:[],attended:[]}});
panel.setFilter('club','all');panel.setFilter('event','all');
assert.match(get('activity-clubs'),/هنوز درخواستی/);
assert.match(get('activity-tickets'),/هنوز بلیتی/);
panel.render({...opts,onlineMode:false,state:{joined:[0],requested:[],rejected:[],registered:[0],attended:[]}});
assert.ok(!get('activity-tickets').includes('data-ticket-qr'));
assert.match(get('activity-tickets'),/صرفاً نمایشی/);
assert.match(app,/await onlineBackend.cancelEvent\(eventId\)/);
assert.match(app,/state\.registered=state\.registered\.filter/);
assert.match(app,/activityFilterClub/);
assert.match(backend,/ticket_token,attended_at/);
for(const id of ['activity-overview','activity-member-filters','activity-event-filters','activity-refresh']){
 assert.ok(html.includes('id="'+id+'"'),'missing activity DOM: '+id);
}
console.log('PASS: activity filters, online tickets, attendance, cancellation integration, XSS escaping and empty state');
