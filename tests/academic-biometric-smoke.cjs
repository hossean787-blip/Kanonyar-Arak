'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('app/src/main/assets/index.html'),css=read('app/src/main/assets/styles.css');
const app=read('app/src/main/assets/app.js'),backend=read('app/src/main/assets/backend.js');
const admin=read('app/src/main/assets/admin.js');
const student=read('supabase/functions/kanonha-student-auth/index.ts');
const privileged=read('supabase/functions/kanonha-admin-console/index.ts');
const migration=read('supabase/academic-directory-v093.sql');
const native=read('app/src/main/java/ir/kanonha/app/BiometricVault.java');
const activity=read('app/src/main/java/ir/kanonha/app/MainActivity.java');
const manifest=read('app/src/main/AndroidManifest.xml');
const gradle=read('app/build.gradle.kts');

for(const match of [/id="online-university" name="university"/,/id="online-faculty" name="faculty"/,
 /id="workspace-subtab-universities"/,/id="biometric-login-btn"/,/id="biometric-enable-btn"/,
 /src="biometric.js"/])
 assert.match(html,match);
assert.doesNotMatch(html,/<input id="online-(university|faculty)" /,'student must not type arbitrary campus names');
for(const color of ['#2C3E4C','#3944BC'])assert.ok(css.includes(color),color);
for(const name of ['home','clubs','events','activity','profile']){
 const icon=read('app/src/main/assets/assets/nav-'+name+'.svg');
 assert.doesNotMatch(icon,/#(38A869|2A8451|50C884|113621)/i,'old green navigation icon '+name);
}
assert.match(app,/function refreshAcademicDirectory\(\)/);
assert.match(app,/function academyFacultyOptions/);
assert.match(app,/role\s*===\s*'manager'/);
assert.match(admin,/function universities\(\)/);
assert.match(admin,/university\.create/);
assert.match(admin,/faculty\.create/);
assert.match(privileged,/if\(op==="university.create"\)/);
assert.match(privileged,/if\(op==="faculty.create"\)/);
assert.match(privileged,/email_confirmed_at/);
assert.match(privileged,/kanonha_admins/);
assert.ok(student.indexOf('kanonha_universities?select=id') < student.indexOf('/auth/v1/admin/users'),
 'student registry must validate directory before creating auth accounts');
assert.match(student,/دانشکده انتخاب‌شده متعلق به این دانشگاه نیست/);
assert.match(migration,/revoke all on public\.kanonha_universities,public\.kanonha_faculties from public,anon,authenticated/i);
assert.match(migration,/grant select on public\.kanonha_universities,public\.kanonha_faculties to anon,authenticated/i);
assert.match(migration,/create trigger kanonha_academic_directory_guard/i);
for(const expected of ['AndroidKeyStore','BIOMETRIC_STRONG','AES/GCM/NoPadding',
 'setUserAuthenticationRequired(true)','setInvalidatedByBiometricEnrollment(true)',
 'new BiometricPrompt.CryptoObject(cipher)','setUserAuthenticationValidityDurationSeconds(-1)'])
 assert.ok(native.includes(expected),expected);
assert.match(activity,/addJavascriptInterface\(biometric\.new Bridge\(\), "AndroidBiometric"\)/);
assert.match(activity,/extends FragmentActivity/);
assert.match(manifest,/android.permission.USE_BIOMETRIC/);
assert.match(manifest,/android:allowBackup="false"/);
assert.match(gradle,/versionCode = 22/);
assert.match(gradle,/androidx.biometric:biometric:/);

const events=[],uid='ee0d98d0-089a-4d30-840d-7b58038bd18c';
const response=(body,status=200)=>({ok:status>=200&&status<300,status,async text(){return JSON.stringify(body)}});
async function mockFetch(input,options){
 const u=String(input),body=options.body?JSON.parse(options.body):null;
 events.push({u,body,headers:options.headers});
 if(u.includes('/rest/v1/kanonha_universities?'))return response([{id:uid,name:'دانشگاه آزمایشی'}]);
 if(u.includes('/rest/v1/kanonha_faculties?'))return response([{id:'c0994e17-fbeb-40c6-86e7-97dd889704c4',university_id:uid,name:'دانشکده نمونه'}]);
 if(u.includes('/auth/v1/token?grant_type=refresh_token'))return response({
   access_token:'rotated-access',refresh_token:'rotated-secret',expires_in:3600,user:{id:uid}
 });
 if(u.endsWith('/auth/v1/user'))return response({id:uid,email:'user@student.kanonha.invalid'});
 throw Error('unexpected REST request '+u);
}
const rotated=[];
const w={KANONHA_CONFIG:{url:'https://cnqcysnjinghzzrzanpj.supabase.co',publishableKey:'sb_publishable_fixture'},
 KanonhaNativeBiometric:{rotateToken(token){rotated.push(token)}}};
vm.runInNewContext(backend,{window:w,fetch:mockFetch,AbortController,setTimeout,clearTimeout,Date,URL,
 TextEncoder,console},{timeout:4000});
(async()=>{
 const directory=await w.KanonhaBackend.academicCatalog();
 assert.equal(directory.universities.length,1);
 assert.equal(directory.faculties[0].university_id,directory.universities[0].id);
 const account=await w.KanonhaBackend.resumeFromBiometric('previous-refresh-secret');
 assert.equal(account.id,uid);
 assert.equal(events.filter(e=>e.u.includes('grant_type=refresh_token')).length,1);
 assert.equal(events.find(e=>e.u.includes('grant_type=refresh_token')).body.refresh_token,'previous-refresh-secret');
 assert.ok(rotated.includes('rotated-secret'),'rotating credentials must update native vault');
 assert.equal(w.KanonhaBackend.biometricRefreshToken(),'rotated-secret');
 const publicCatalog=events.filter(e=>e.u.includes('/kanonha_universities?')||e.u.includes('/kanonha_faculties?'));
 assert.equal(publicCatalog.length,2);
 assert.ok(publicCatalog.every(e=>!('Authorization' in e.headers)), 'public directory should not require login');
 const biomSource=read('app/src/main/assets/biometric.js');
 const bridge={available:()=>true,enrolled:()=>true,unlock:()=>events.push({u:'unlock'}),
 rotateToken:()=>{},enroll:()=>{}};
 const bwindow={AndroidBiometric:bridge};
 vm.runInNewContext(biomSource,{window:bwindow},{timeout:1500});
 let received='';bwindow.KanonhaBiometric.setHandlers(token=>received=token,()=>{});
 bwindow.KanonhaBiometric.nativeToken('secure-token');assert.equal(received,'secure-token');
 assert.equal(bwindow.KanonhaBiometric.unlock(),true);
 assert.ok(events.some(e=>e.u==='unlock'));
 console.log('PASS academic list/relationship, director authorization, RLS guard, app branding and native biometric resume/rotation contract');
})().catch(e=>{console.error(e);process.exitCode=1});
