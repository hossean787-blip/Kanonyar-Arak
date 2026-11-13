'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const backend=read('app/src/main/assets/backend.js');
const bridge=read('app/src/main/assets/biometric.js');
const app=read('app/src/main/assets/app.js');
const vault=read('app/src/main/java/ir/kanonha/app/BiometricVault.java');
const gradle=read('app/build.gradle.kts');

assert.match(gradle,/versionCode = 45/);
assert.match(gradle,/applicationId = "ir\.kanonha\.app"/);
assert.match(app,/async function onlineLogout\(\{forgetBiometric=false\}=\{\}\)/);
assert.match(app,/preserveBiometric:preserve/);
assert.match(app,/data-action="secure-exit"/);
assert.match(app,/forgetBiometric:true/);
assert.match(app,/biom\.lock\(\)/);
assert.match(app,/biom\.clear\(\)/);
for(const m of [/private boolean ownedBy\(String accountId\)/, /putString\("account_id", accountId\)/,
 /private void lockVault\(\)/, /@JavascriptInterface public void lock\(\)/,
 /BiometricManager\.Authenticators\.BIOMETRIC_STRONG/,
 /setUserAuthenticationRequired\(true\)/,
 /setInvalidatedByBiometricEnrollment\(true\)/,
 /if \(!correctOrigin\(\) \|\| !ownedBy\(accountId\)\) return;/])
 assert.match(vault,m);

const uid='e10b134d-36cc-449a-91a9-5c903e2faad1';
let logoutCalls=0,refreshCalls=0,renewed=null,rotated=[];
const response=(obj,status=200)=>({ok:status>=200&&status<300,status,
 async text(){return obj===null?'':JSON.stringify(obj)}});
const mockFetch=async (raw,options)=>{
 const url=String(raw);
 if(url.includes('/token?grant_type=password'))
  return response({access_token:'pw-access',refresh_token:'pw-refresh',expires_in:3600,user:{id:uid}});
 if(url.includes('/token?grant_type=refresh_token')){
  refreshCalls++;renewed=JSON.parse(options.body).refresh_token;
  return response({access_token:'bio-access',refresh_token:'bio-refresh-rotated',expires_in:3600,user:{id:uid}});
 }
 if(url.endsWith('/auth/v1/user'))return response({id:uid,email:'student@invalid.test'});
 if(url.endsWith('/auth/v1/logout')){logoutCalls++;return response(null,204)}
 throw new Error('unexpected network call '+url);
};
const w={
 KANONHA_CONFIG:{url:'https://cnqcysnjinghzzrzanpj.supabase.co',publishableKey:'sb_publishable_fixture'},
 KanonhaNativeBiometric:{rotateToken(token,account){rotated.push([token,account])}}
};
vm.runInNewContext(backend,{window:w,fetch:mockFetch,AbortController,
 setTimeout,clearTimeout,Date,URL,TextEncoder,console},{timeout:4000});
const client=w.KanonhaBackend;

const calls=[];
let boundUser=uid,enrolled=true,secret='bio-refresh-rotated';
const device={
 available(){return true},enrolled(){return enrolled},
 ownedBy(id){return id===boundUser},
 enroll(token,id){calls.push(['enroll',token,id]);boundUser=id;enrolled=true},
 rotateToken(token,id){calls.push(['rotate',token,id]);if(id===boundUser)secret=token},
 unlock(){calls.push(['unlock'])},lock(){calls.push(['lock'])},
 clear(){calls.push(['clear']);enrolled=false}
};
const bw={AndroidBiometric:device};
vm.runInNewContext(bridge,{window:bw},{timeout:2000});
const bio=bw.KanonhaBiometric;
(async()=>{
 assert.equal(bio.present(),true);
 assert.equal(bio.available(),true);
 assert.equal(bio.enrolled(),true);
 assert.equal(bio.ownedBy(uid),true);
 assert.equal(bio.ownedBy('wrong-account'),false);
 assert.equal(bio.enroll('encrypted-refresh',uid),true);
 assert.deepEqual(calls[0],['enroll','encrypted-refresh',uid]);
 bio.rotateToken('next-secret','wrong-account');
 assert.equal(calls.filter(c=>c[0]==='rotate').length,0,'wrong account must not replace vault');
 bio.rotateToken('next-secret',uid);
 assert.deepEqual(calls[1],['rotate','next-secret',uid]);
 bio.lock();assert.deepEqual(calls[2],['lock']);
 assert.equal(bio.unlock(),true);
 assert.deepEqual(calls[3],['unlock']);
 assert.equal(bio.enrolled(),true,'locking must not erase enrollment');

 const who=await client.signIn('student@invalid.test','sample-password');
 assert.equal(who.id,uid);
 assert.equal(client.biometricRefreshToken(),'pw-refresh');
 assert.ok(rotated.some(([tok,id])=>tok==='pw-refresh'&&id===uid));
 await client.signOut({preserveBiometric:true});
 assert.equal(client.currentUser,null);
 assert.equal(client.biometricRefreshToken(),null,'memory credentials must be purged');
 assert.equal(logoutCalls,0,'ordinary device logout must not revoke vaulted refresh token');

 const again=await client.resumeFromBiometric('pw-refresh');
 assert.equal(again.id,uid);
 assert.equal(refreshCalls,1);
 assert.equal(renewed,'pw-refresh');
 assert.equal(client.biometricRefreshToken(),'bio-refresh-rotated');
 assert.ok(rotated.some(([tok,id])=>tok==='bio-refresh-rotated'&&id===uid));
 await client.signOut();
 assert.equal(logoutCalls,1,'complete logout must revoke server session');
 assert.equal(client.currentUser,null);
 bio.clear();assert.equal(bio.enrolled(),false);
 assert.ok(calls.some(c=>c[0]==='clear'));
 console.log('PASS biometric re-login across ordinary logout; account-bound rotation; full logout revokes and clears, native vault locked');
})().catch(e=>{console.error(e);process.exitCode=1});
