'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const backendCode = fs.readFileSync('app/src/main/assets/backend.js','utf8');
const native = fs.readFileSync('app/src/main/java/ir/kanonha/app/MainActivity.java','utf8');
const manifest = fs.readFileSync('app/src/main/AndroidManifest.xml','utf8');
for(const required of ['onShowFileChooser','ACTION_OPEN_DOCUMENT','CATEGORY_OPENABLE',
 'EXTRA_MIME_TYPES','FLAG_GRANT_READ_URI_PERMISSION','CLUB_LOGO_PICK_REQUEST',
 'pendingLogoFiles','finishLogoPicker','validLogoUri','image/webp','OpenableColumns.SIZE'])
 assert.ok(native.includes(required),'native image picker missing '+required);
assert.match(native,/setAllowFileAccess\(false\)/,'raw files must remain inaccessible');
assert.match(native,/setAllowContentAccess\(true\)/,'SAF content URIs must be readable');
assert.doesNotMatch(manifest,/READ_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE|READ_MEDIA_IMAGES/,
 'Do not request broad file/gallery access permissions');
const clubId = '3200f2ae-5c14-4c85-8cba-0ac96875cb82';
const otherClubId = '3a2d54f5-cea9-4b81-b8d1-7544e2d2cce3';
const userId = '92fa1ff3-a431-4238-ab28-f2bcfd13bf9e';
const calls = [];
const webp = {size:16000,type:'image/webp'};
let objectsCreated=0,objectsRevoked=0,drawn=0;
const testUrl='https://kanonha-test.supabase.co';
const json=(data,status=200)=>({
 status,ok:status>=200&&status<300,
 async text(){return data===undefined?'':JSON.stringify(data);}
});
class MockImage {
 constructor(){this.naturalWidth=800;this.naturalHeight=600;}
 set src(value){this._src=value;if(this.onload)this.onload();}
}
function fakeFetch(url,options){
 calls.push({url,method:options.method,headers:options.headers,body:options.body});
 if(url.endsWith('/auth/v1/token?grant_type=password'))
   return json({access_token:'jwt-test-only',refresh_token:'refresh-test-only',expires_in:3600,user:{id:userId}});
 if(url.endsWith('/auth/v1/user'))return json({id:userId});
 if(url.includes('/storage/v1/object/kanonha-club-logos/')){
   assert.equal(options.method,'POST');
   assert.equal(options.headers.Authorization,'Bearer jwt-test-only');
   assert.equal(options.headers['Content-Type'],'image/webp');
   assert.equal(options.headers['x-upsert'],'true');
   assert.equal(options.body,webp);
   assert.ok(url.endsWith(clubId+'/logo.webp'));
   return json({Key:clubId+'/logo.webp'},200);
 }
 if(url.includes('/rest/v1/kanonha_clubs?') && options.method==='PATCH'){
   assert.equal(options.headers.Authorization,'Bearer jwt-test-only');
   const b=JSON.parse(options.body);
   assert.equal(b.logo_path,clubId+'/logo.webp');
   return json([{id:clubId,logo_path:b.logo_path}]);
 }
 if(url.endsWith('/rest/v1/kanonha_memberships') && options.method==='POST')return json(undefined,201);
 if(url.includes('/rest/v1/kanonha_memberships?') && options.method==='PATCH'){
   assert.equal(JSON.parse(options.body).status,'pending');
   return json([{club_id:clubId,status:'pending'}]);
 }
 if(url.includes('/rest/v1/kanonha_memberships?') && options.method==='DELETE'){
   assert.equal(options.headers.Prefer,'return=representation');
   return json([{id:'39ddfc64-1258-4f08-ab4c-94f6629b7d21'}]);
 }
 throw Error('unexpected request '+url);
}
const document={createElement(tag){
 assert.equal(tag,'canvas');
 return {
  width:0,height:0,
  getContext(type){
   assert.equal(type,'2d');
   return {drawImage(){drawn++;}};
  },
  toBlob(callback,type,quality){
   assert.equal(type,'image/webp');
   assert.ok(quality>0&&quality<=1);
   callback(webp);
  }
 };
}};
const URL={
 createObjectURL(file){objectsCreated++;return 'blob:mock/'+file.type;},
 revokeObjectURL(uri){objectsRevoked++;assert.match(uri,/^blob:mock\//);}
};
const window={KANONHA_CONFIG:{url:testUrl,publishableKey:'sb_publishable_testonly'}};
vm.runInNewContext(backendCode,{
 window,fetch:fakeFetch,document,URL,Image:MockImage,
 AbortController,setTimeout,clearTimeout,Date
},{filename:'backend.js',timeout:4000});
const api=window.KanonhaBackend;
(async()=>{
 assert.equal(api.clubLogoUrl(clubId,''),'');
 assert.equal(api.clubLogoUrl(otherClubId,clubId+'/logo.webp'),'');
 assert.equal(api.clubLogoUrl(clubId,'https://malicious.example/logo.webp'),'');
 await assert.rejects(()=>api.secretaryUploadClubLogo(clubId,{type:'image/png',size:100}),/وارد حساب/);
 await api.signIn('member@test.example','passphrase-good');
 const file={type:'image/png',size:10000};
 await assert.rejects(()=>api.secretaryUploadClubLogo(clubId,{...file,type:'image/svg+xml'}),/PNG/);
 await assert.rejects(()=>api.secretaryUploadClubLogo(clubId,{...file,size:2097153}),/۲ مگابایت/);
 await assert.rejects(()=>api.secretaryUploadClubLogo('not-a-club',file),/معتبر/);
 assert.equal(objectsCreated,0,'bad upload must not allocate object URLs');
 const saved=await api.secretaryUploadClubLogo(clubId,file);
 assert.equal(saved,clubId+'/logo.webp');
 assert.equal(drawn,1);
 assert.equal(objectsCreated,1);
 assert.equal(objectsRevoked,1,'blob URL must be revoked');
 const logo=api.clubLogoUrl(clubId, saved);
 assert.match(logo,/\/storage\/v1\/object\/public\/kanonha-club-logos\//);
 assert.ok(logo.includes('/logo.webp?v='));
 await api.joinClub(clubId);
 await api.reapplyClub(clubId);
 await api.cancelClubMembership(clubId);
 assert.ok(calls.some(x=>x.url.endsWith('/rest/v1/kanonha_memberships')&&x.method==='POST'));
 assert.ok(calls.some(x=>x.method==='PATCH'&&x.url.includes('/kanonha_memberships?')&&x.url.includes('status=eq.rejected')));
 assert.ok(calls.some(x=>x.method==='DELETE'&&x.url.includes('status=in.(pending,approved)')));
 console.log('PASS: authenticated secretary logo conversion/upload/link and student membership API state transitions');
})().catch(e=>{console.error(e);process.exitCode=1;});