'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const backend=read('app/src/main/assets/backend.js');
const sql=read('supabase/surveys-v213-cover-image.sql');
new vm.Script(backend,{filename:'backend.js'});
for(const x of ['storage.buckets','kanonha-survey-covers','kanonha_admins','cover_path=id::text',
  'kanonha_survey_cover_insert','kanonha_survey_cover_update','kanonha_survey_cover_delete'])
 assert.ok(sql.includes(x),'migration missing '+x);
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
let objects=0,revoked=0,drawn=0,allow=true,stored=null;const calls=[];
const blob={type:'image/webp',size:18000};
const response=(value,status=200)=>({status,ok:status>=200&&status<300,
 async text(){return value===undefined?'':JSON.stringify(value)}});
function fakeFetch(url,opts){
 calls.push({url,method:opts.method,headers:opts.headers,body:opts.body});
 if(url.endsWith('/auth/v1/token?grant_type=password'))
  return response({access_token:'test-jwt',refresh_token:'test-refresh',expires_in:3600,user:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}});
 if(url.endsWith('/auth/v1/user'))return response({id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'});
 if(url.includes('/storage/v1/object/kanonha-survey-covers/')){
  assert.equal(opts.headers.Authorization,'Bearer test-jwt');
  if(opts.method==='POST'){
   assert.equal(opts.headers['Content-Type'],'image/webp');
   assert.equal(opts.headers['x-upsert'],'true');
   assert.strictEqual(opts.body,blob);
   assert.ok(url.endsWith(id+'/cover.webp'));
   return response({Key:id+'/cover.webp'});
  }
  if(opts.method==='DELETE')return response({});
 }
 if(url.includes('/rest/v1/kanonha_surveys?')&&opts.method==='PATCH'){
  assert.ok(url.includes('status=eq.draft'));
  if(!allow)return response([]);
  stored=JSON.parse(opts.body).cover_path;
  return response([{id,cover_path:stored}]);
 }
 throw Error('unexpected API: '+url);
}
class ImageMock{
 constructor(){this.naturalWidth=1600;this.naturalHeight=900;}
 set src(u){if(this.onload)this.onload();}
}
const document={createElement(tag){
 assert.equal(tag,'canvas');
 return{width:0,height:0,getContext(kind){
  assert.equal(kind,'2d');return{drawImage(){drawn++;}};
 },toBlob(cb,format,quality){
  assert.equal(format,'image/webp');assert.ok(quality>0&&quality<=1);cb(blob);
 }};
}};
const URL={createObjectURL(){objects++;return 'blob:survey-test';},
 revokeObjectURL(uri){assert.equal(uri,'blob:survey-test');revoked++;}};
const window={KANONHA_CONFIG:{url:'https://kanonha-test.supabase.co',publishableKey:'sb_publishable_testing'}};
vm.runInNewContext(backend,{window,fetch:fakeFetch,document,URL,Image:ImageMock,
 AbortController,setTimeout,clearTimeout,Date},{filename:'backend.js',timeout:4000});
const api=window.KanonhaBackend;
(async()=>{
 assert.equal(api.surveyCoverUrl(id,null),'');
 assert.equal(api.surveyCoverUrl(other,id+'/cover.webp'),'');
 assert.equal(api.surveyCoverUrl(id,'javascript:alert(1)'),'');
 assert.equal(api.surveyCoverUrl(id,'../../cover.webp'),'');
 const file={name:'photo.jpg',type:'image/jpeg',size:100000};
 await assert.rejects(()=>api.surveyUploadCover(id,file),/وارد حساب/);
 await api.signIn('user@test.example','long-password');
 await assert.rejects(()=>api.surveyUploadCover(id,{...file,type:'image/svg+xml'}),/PNG/);
 await assert.rejects(()=>api.surveyUploadCover(id,{...file,size:2097153}),/۲ مگابایت/);
 await assert.rejects(()=>api.surveyUploadCover('invalid-id',file),/معتبر/);
 assert.equal(objects,0);
 assert.equal(await api.surveyUploadCover(id,file),id+'/cover.webp');
 assert.equal(stored,id+'/cover.webp');
 assert.equal(drawn,1);assert.equal(objects,1);assert.equal(revoked,1);
 assert.match(api.surveyCoverUrl(id,stored),/kanonha-survey-covers\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\/cover.webp/);
 allow=false;
 await assert.rejects(()=>api.surveyUploadCover(id,file),/پیش‌نویس/);
 allow=true;
 assert.equal(await api.surveyRemoveCover(id),true);
 assert.equal(stored,null);
 assert.ok(calls.some(c=>c.method==='DELETE'&&c.url.endsWith('/kanonha-survey-covers/'+id+'/cover.webp')));
 console.log('PASS: safe survey image uploads, resizing, MIME and size limits, draft-only modification and removal');
})().catch(e=>{console.error(e);process.exitCode=1});
