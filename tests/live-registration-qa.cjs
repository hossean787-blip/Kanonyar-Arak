'use strict';
// One-time controlled QA on the dedicated Kanonha backend only.
// REMOVE its CI invocation after collecting evidence; delete temporary user in database.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const cfg=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/config.js'),'utf8');
const w={};vm.runInNewContext(cfg,{window:w});
const url=w.KANONHA_CONFIG.url,key=w.KANONHA_CONFIG.publishableKey;
const student='990'+String(Date.now()).slice(-10);
const national='0000000019'; // Deliberately synthetic valid checksum; do not use as a person's ID.
const password=crypto.randomBytes(24).toString('base64url');
async function call(action,fields={}){
 const r=await fetch(url+'/functions/v1/kanonha-student-auth',{method:'POST',
  headers:{apikey:key,'Content-Type':'application/json'},
  body:JSON.stringify({action,...fields}),signal:AbortSignal.timeout(25000)});
 let b={};try{b=await r.json()}catch{}
 return {status:r.status,body:b};
}
(async()=>{
 const registered=await call('register',{name:'کاربر آزمون کنترل‌شده',
  studentNumber:student,nationalId:national,birthDate:'2001-01-01',
  university:'دانشگاه آزمایشی',faculty:'دانشکده آزمایشی',major:'حسابداری آزمایشی',
  password});
 console.log('QA registration status',registered.status);
 assert.equal(registered.status,201,'Registration must return token; '+registered.body.error);
 const token=registered.body.session?.access_token,uid=registered.body.session?.user?.id;
 assert.ok(token&&uid,'Valid session must be returned');
 console.log('QA TEMPORARY USER ID TO CLEAN UP:',uid);
 console.log('QA TEMPORARY STUDENT NUMBER TO CLEAN UP:',student);
 const profile=await fetch(url+'/rest/v1/kanonha_profiles?select=full_name,student_number',
  {headers:{apikey:key,Authorization:'Bearer '+token},signal:AbortSignal.timeout(18000)});
 assert.equal(profile.status,200);
 const rows=await profile.json();
 assert.equal(rows[0]?.student_number,student,'Created profile must link to student alias');
 const details=await fetch(url+'/rest/v1/kanonha_academic_details?select=university,faculty,major,birth_date',
  {headers:{apikey:key,Authorization:'Bearer '+token},signal:AbortSignal.timeout(18000)});
 assert.equal(details.status,200);
 const d=await details.json();
 assert.equal(d[0]?.birth_date,'2001-01-01');
 for(const [kind,identifier] of [['student',student],['national',national]]){
  const logged=await call('login',{kind,identifier,password});
  assert.equal(logged.status,200,'Password sign-in must work with '+kind+'; '+logged.body.error);
  assert.equal(logged.body.session?.user?.id,uid);
 }
 const wrong=await call('login',{kind:'student',identifier:student,password:'incorrect-password'});
 assert.equal(wrong.status,401,'Incorrect password must be rejected');
 console.log('PASS live signup with no email, academic data RLS, student ID login, national ID login, wrong password denial');
})().catch(e=>{console.error('E2E QA FAILED:',e);process.exitCode=1});
