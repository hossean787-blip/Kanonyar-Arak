'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const backend=read('app/src/main/assets/backend.js');
const edge=read('supabase/functions/kanonha-student-auth/index.ts');
const app=read('app/src/main/assets/app.js');
const calendar=read('app/src/main/assets/jalali.js');
assert.match(edge,/return invalid\("nationalId","کد ملی معتبر نیست/);
assert.match(edge,/return invalid\("birthDate","تاریخ تولد معتبر نیست/);
assert.match(edge,/if\("error" in r\) return reply\(422,\{error:r.error,field:r.field\}\)/);
assert.doesNotMatch(edge,/اطلاعات ثبت‌نام معتبر نیست؛ کد ملی، تاریخ تولد و رمز را بررسی کنید/);
assert.match(app,/showSignupFieldError\(error\)/);
assert.match(app,/signup-inline-error/);
assert.match(app,/normalizeRegistrationDigits/);
assert.match(app,/noValidate = Boolean\(student && onlineSignup\)/);
const calendarWindow={};
vm.runInNewContext(calendar,{window:calendarWindow,Intl,Date},{timeout:2000});
assert.equal(calendarWindow.KanonhaJalali.j2g(1381,12,21),'2003-03-12',
 'Screenshot birthday 21 Esfand 1381 must convert to a valid ISO day');
const uid='bbfa9157-5706-4166-aac6-d5ca8459fe06',calls=[];
let forceRemoteInvalid=false;
function reply(payload,status=200){return {ok:status>=200&&status<300,status,
 async text(){return JSON.stringify(payload)},async json(){return payload}};}
async function fakeFetch(url,o){
 const body=o.body?JSON.parse(o.body):null;
 calls.push({url,body,headers:o.headers});
 if(url.endsWith('/functions/v1/kanonha-student-auth')){
   if(forceRemoteInvalid)return reply({error:'کد ملی معتبر نیست؛ رقم کنترل را بررسی کنید.',field:'nationalId'},422);
   return reply({session:{access_token:'local-token',refresh_token:'local-refresh',expires_in:3600,user:{id:uid}}});
 }
 if(url.endsWith('/auth/v1/user'))return reply({id:uid,email:'sample@student.kanonha.invalid'});
 throw Error('Unexpected endpoint '+url);
}
const window={KANONHA_CONFIG:{url:'https://cnqcysnjinghzzrzanpj.supabase.co',publishableKey:'sb_publishable_mock'}};
vm.runInNewContext(backend,{window,fetch:fakeFetch,AbortController,setTimeout,clearTimeout,Date,URL},{timeout:3000});
const api=window.KanonhaBackend;
const fields={name:'دانشجوی آزمایشی',studentNumber:'99887766',nationalId:'0084575948',
 mobile:'09123456789',birthDate:'2003-03-12',university:'دانشگاه آزمایشی',
 faculty:'دانشکده نمونه',major:'روانشناسی',password:'safe-temporary-password'};
(async()=>{
  let issue=null;
  try{await api.studentSignUp({...fields,nationalId:'1234567890'})}catch(e){issue=e}
  assert.equal(issue?.field,'nationalId');
  assert.match(issue.message,/کد ملی/);
  assert.equal(calls.length,0,'invalid national code must not be sent to server');
  await assert.rejects(()=>api.studentSignUp({...fields,birthDate:'2003-02-30'}),
   e=>e.field==='birthDate');
  await assert.rejects(()=>api.studentSignUp({...fields,password:'short'}),
   e=>e.field==='password');
  await assert.rejects(()=>api.studentSignUp({...fields,mobile:'۰۹۱۲۳۴۵۶۷۸'}),
   e=>e.field==='mobile');
  assert.equal(calls.length,0,'invalid local validation should not generate requests');
  const faDigits=n=>String(n).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[+d]);
  const user=await api.studentSignUp({...fields,studentNumber:faDigits(fields.studentNumber),
   nationalId:faDigits(fields.nationalId),mobile:faDigits(fields.mobile)});
  assert.equal(user.id,uid);
  const sent=calls.find(c=>c.body?.action==='register');
  assert.equal(sent.body.studentNumber,fields.studentNumber);
  assert.equal(sent.body.nationalId,fields.nationalId);
  assert.equal(sent.body.mobile,fields.mobile);
  assert.equal(sent.body.birthDate,fields.birthDate);
  await api.studentSignIn('auto',faDigits(fields.studentNumber),'example-password');
  assert.equal(calls.find(c=>c.body?.action==='login').body.identifier,fields.studentNumber);
  forceRemoteInvalid=true;
  issue=null;
  try{await api.studentSignUp(fields)}catch(e){issue=e}
  assert.equal(issue.field,'nationalId','server field tag should be preserved in UI error');
  assert.equal(issue.status,422);
  assert.match(issue.message,/کد ملی/);
  console.log('PASS valid Jalali screenshot date, national checksum, Persian digits, local field errors and remote error mapping');
})().catch(e=>{console.error(e);process.exitCode=1});
