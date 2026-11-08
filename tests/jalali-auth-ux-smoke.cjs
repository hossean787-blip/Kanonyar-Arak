'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,'app/src/main/assets',p),'utf8');
const html=read('index.html'),app=read('app.js'),css=read('styles.css'),calendar=read('jalali.js');
assert.ok(html.indexOf('src="jalali.js"')<html.indexOf('src="app.js"'));
assert.match(html, /class="v7-role-switch"[^>]*hidden/,'manager must not be on public signup UI');
assert.match(html, /id="online-auth-title" class="v95-login-title-button"/);
assert.doesNotMatch(html,/id="auth-admin-entry"/);
assert.match(html, /id="auth-back-student"/);
assert.match(app, /managerEntryTaps < 7/,'manager entry should not be discoverable as public tab');
assert.match(app, /\$\('bottom-nav'\)\.hidden = !signed/,'guests should not see navigation');
assert.match(app, /picker\.hidden = roleCount <= 1/,'one-role students must not see a role selector');
assert.match(css, /\.role-switcher-options button \{ min-height:39px/);
assert.doesNotMatch(html,/تاریخ تولد را در تقویم میلادی/);
class Element{
 constructor(tag){this.tag=tag;this.type=tag;this.dataset={};this.required=false;
  this.value='';this.children=[];this.events={};this.textContent='';this.className='';this.parentNode=null;}
 appendChild(child){this.children.push(child);child.parentNode=this;return child}
 replaceChildren(){this.children=[]}
 setAttribute(k,v){this[k]=v}
 addEventListener(k,cb){this.events[k]=cb}
 emit(k){if(this.events[k])this.events[k]()}
 focus(){this.focused=true}
 querySelector(q){
  if(q==='.jalali-select'){
   if(this.className==='jalali-select')return this;
   for(const c of this.children){const v=c.querySelector?.(q);if(v)return v}
  }
  return null;
 }
}
const birth=new Element('input'),birthParent=new Element('label');birth.type='date';birth.required=true;birthParent.appendChild(birth);
const when=new Element('input'),whenParent=new Element('label');when.type='datetime-local';when.required=true;
when.value='2026-11-09T18:45';whenParent.appendChild(when);
const document={createElement:tag=>new Element(tag),
 querySelectorAll:sel=>sel==='input[type="date"], input[type="datetime-local"]'?[birth,when]:[]};
const window={};vm.runInNewContext(calendar,{window,document,Intl,Date,Number,String,Object,Math},{timeout:3500});
const j=window.KanonhaJalali;
assert.deepEqual(JSON.parse(JSON.stringify(j.g2j(new Date('2026-11-09T00:00:00Z')))),{year:1405,month:8,day:18});
assert.equal(j.j2g(1405,8,18),'2026-11-09');
assert.equal(j.j2g(1400,1,1),'2021-03-21');
assert.equal(j.j2g(1399,12,30),'2021-03-20');
assert.equal(j.j2g(1403,12,30),'2025-03-20');
assert.equal(j.j2g(1404,12,30),null);
assert.equal(j.j2g(1405,13,1),null);
assert.match(j.formatDate('2026-11-09T12:00:00Z'),/آبان/);
j.enhance(document);
assert.equal(birth.type,'hidden','Gregorian native date picker must be gone');
assert.equal(when.type,'hidden','Gregorian native datetime picker must be gone');
assert.equal(when.value,'2026-11-09T18:45','ISO format must survive existing event editing');
const wrap=birthParent.children[1],row=wrap.children[0];
const [year,month,day]=row.children;
year.value='1405';year.emit('change');
month.value='8';month.emit('change');
day.value='18';day.emit('change');
assert.equal(birth.value,'2026-11-09','solar selection must map to ISO for the API');
const form={querySelectorAll:selector=>selector==='input[data-jalali-source="true"]'?[birth,when]:[]};
assert.equal(j.validateForm(form),true);
birth.value='';assert.equal(j.validateForm(form),false,'required birthdate must be complete');
birth.required=false;assert.equal(j.validateForm(form),true,'login mode ignores hidden signup birthdate');
j.enhance(document);assert.equal(birthParent.children.length,2,'date control should not duplicate');
console.log('PASS Jalali-only calendar, leap days, UTC ISO conversions, public role hiding, guest nav and required field gating');
