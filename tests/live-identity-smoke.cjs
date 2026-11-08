'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const cfg=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/config.js'),'utf8');
const w={};vm.runInNewContext(cfg,{window:w});
const url=w.KANONHA_CONFIG.url,key=w.KANONHA_CONFIG.publishableKey;
const headers={apikey:key,'Content-Type':'application/json'};
async function call(path,body){
 const r=await fetch(url+path,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 let b={};try{b=await r.json()}catch{}
 return {status:r.status,data:b};
}
(async()=>{
 const health=await call('/functions/v1/kanonha-student-auth',{action:'health'});
 assert.equal(health.status,200,'Student auth Edge Function must actually run');
 assert.equal(health.data.ready,true);
 const invalid=await call('/functions/v1/kanonha-student-auth',{action:'register',name:'x',studentNumber:'invalid'});
 assert.equal(invalid.status,422,'Invalid signup must be rejected, with no created user');
 const manager=await call('/functions/v1/kanonha-admin-console',{action:'overview'});
 assert.ok([401,403].includes(manager.status),'Unauthenticated global manager must be denied');
 for(const name of ['kanonha_admins','kanonha_student_credentials','kanonha_academic_details']){
  const r=await fetch(url+'/rest/v1/'+name+'?select=user_id&limit=1',
   {headers:{apikey:key},signal:AbortSignal.timeout(20000)});
  assert.ok([401,403].includes(r.status),'Private '+name+' must be inaccessible to anon; got '+r.status);
 }
 console.log('PASS real Edge functions, anonymous admin denial, protected identity tables and validated signup input');
})().catch(e=>{console.error('LIVE IDENTITY TEST FAILED',e);process.exitCode=1});
