'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const source=p=>fs.readFileSync(path.join(root,p),'utf8');
const urls=[];
const id='12345678-1234-4123-8123-123456789012';
const project='https://cnqcysnjinghzzrzanpj.supabase.co';
const window={KANONHA_CONFIG:{url:project}};
const document={
 createElement(){
  return {style:{cssText:''},textContent:'',
   querySelector(q){return q==='canvas'?{toDataURL(){return 'data:image/png;base64,QUJD';}}:null;},
   remove(){}};
 },
 body:{appendChild(){}}
};
function QRCode(box,options){urls.push(options.text);}
QRCode.CorrectLevel={M:1};
window.QRCode=QRCode;
const ctx={window,document,Date,Number,Set,Map,encodeURIComponent};
vm.runInNewContext(source('app/src/main/assets/event-kinds.js'),ctx,{timeout:2500});
vm.runInNewContext(source('app/src/main/assets/event-tools.js'),ctx,{timeout:2500});
vm.runInNewContext(source('app/src/main/assets/certificate-document.js'),ctx,{timeout:2500});
assert.equal(window.KanonhaEventKinds.items.length,9);
assert.equal(window.KanonhaEventTools.certificateVerificationUrl('not-a-uuid'),'');
const url=project+'/functions/v1/kanonha-certificate-verify?code='+id;
assert.equal(window.KanonhaEventTools.certificateVerificationUrl(id),url);
assert.equal(window.KanonhaEventTools.certificateQrPng(id),'data:image/png;base64,QUJD');
assert.deepEqual(urls,[url],'QR must encode an actual HTTPS verification URL');
const malicious='<img src=x onerror=alert(1)>';
const certificate={
 certificate_code:id,student_name:malicious+' دانشجو',student_national_id:'1234567891',
 student_number:'001200',event_title:malicious+' کارگاه',event_type:'workshop',
 club_name:'کانون فناوری',event_location:'سالن همایش',event_starts_at:'2026-11-11T09:00:00Z',
 secretary_name:'دبیر نمونه',certificate_signers:['استاد یک','استاد دو']
};
const renderer=window.KanonhaCertificateDocument;
const html=renderer.render(certificate,{qr:'data:image/png;base64,QUJD',verificationUrl:url});
assert.match(html,/<!doctype html>/i);
assert.match(html,/گواهی شرکت در کارگاه/);
assert.match(html,/1234567891/);
assert.match(html,/001200/);
assert.match(html,/دبیر نمونه/);
assert.match(html,/استاد یک/);
assert.match(html,/استاد دو/);
assert.match(html,/A4 landscape/);
assert.match(html,/kanonha-certificate-verify\?code=/);
assert.match(html,/data:image\/png;base64,QUJD/);
assert.doesNotMatch(html,/<img src=x onerror=alert\(1\)>/);
assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
assert.doesNotMatch(html,/همراه/,'standalone app must not borrow another brand');
for(const kind of window.KanonhaEventKinds.items){
 const htmlForType=renderer.render({...certificate,event_type:kind.id},{verificationUrl:url});
 assert.ok(htmlForType.includes(kind.certificateTitle),'title mismatch '+kind.id);
}
assert.match(source('app/src/main/assets/app.js'),/id="certificate-national-form"/);
assert.match(source('app/src/main/assets/backend.js'),/verifyNationalForCertificate/);
assert.match(source('app/src/main/assets/activity-ui.js'),/verifyNationalForCertificate\(nationalCode\)/);
const edge=source('supabase/functions/kanonha-certificate-verify/index.ts');
assert.match(edge,/KIND:Record<string,string>/);
assert.match(edge,/nationalValid\(id\)/);
assert.match(edge,/constantEqual\(stored,await digest\("national:"\+id\)\)/);
assert.match(edge,/auth\/v1\/user/);
assert.match(edge,/user_id=eq\./);
assert.match(edge,/Cache-Control/);
assert.match(edge,/Content-Security-Policy/);
assert.doesNotMatch(edge,/select=[^\n]*student_national_id/);
console.log('PASS: unified nine-category certificate, verification HTTPS QR, one-time proof, layout and XSS controls');
