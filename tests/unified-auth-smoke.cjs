'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'app/src/main/assets/backend.js'),'utf8');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const authSql=fs.readFileSync(path.join(root,'supabase/unified-identity-v070.sql'),'utf8');
for(const id of ['online-identifier','online-national','online-student','online-birth',
 'online-university','online-faculty','online-major','online-mobile','auth-role-manager','home-management',
 'admin-panel','admin-content','admin-tabs'])
 assert.ok(html.includes('id="'+id+'"'),id+' input not present');
for(const word of ['kanonha_admins','kanonha_student_credentials','kanonha_academic_details',
 'kanonha_auth_attempts','kanonha_rate_limit'])
 assert.ok(authSql.includes(word),'missing server feature '+word);
assert.match(authSql,/email_confirmed_at is not null/i,'admin must require verified email');
assert.match(authSql,/lower\(coalesce\(new.email,''\)\) = 'hossean787@gmail.com'/i);
assert.match(authSql,/revoke all on public\.kanonha_student_credentials from public, anon, authenticated/i);
assert.doesNotMatch(source,/SUPABASE_SERVICE_ROLE_KEY\s*=/);
const calls=[];
const id='af2c8d5d-ab17-4c54-aa22-11b572ad918a';
function response(data,status=200){
 return {ok:status>=200&&status<300,status,
  async text(){return data==null?'':JSON.stringify(data)},
  async json(){return data}};
}
async function fetchMock(url,o){
 const body=o.body?JSON.parse(o.body):null;
 calls.push({url,headers:o.headers,body});
 if(url.endsWith('/functions/v1/kanonha-student-auth'))
  return response({session:{access_token:'student-token',refresh_token:'student-refresh',expires_in:3600,user:{id}}});
 if(url.endsWith('/functions/v1/kanonha-admin-console'))
  return response({result:{clubs:[],events:[],users:[],secretaries:[],memberships:[],registrations:[]}});
 if(url.endsWith('/auth/v1/user'))return response({id,email:'student@login.kanonha.invalid'});
 if(url.endsWith('/auth/v1/signup'))return response({user:{id}});
 if(url.includes('/auth/v1/token?grant_type=password'))return response({access_token:'manager-token',refresh_token:'manager-refresh',expires_in:3600,user:{id}});
 if(url.includes('/rest/v1/kanonha_admins?'))return response([{user_id:id}]);
 if(url.endsWith('/auth/v1/logout'))return response(null,204);
 throw Error('Unexpected endpoint '+url);
}
const window={KANONHA_CONFIG:{url:'https://cnqcysnjinghzzrzanpj.supabase.co',publishableKey:'sb_publishable_testonly'}};
vm.runInNewContext(source,{window,fetch:fetchMock,AbortController,setTimeout,clearTimeout,Date},
 {filename:'backend.js',timeout:3000});
const api=window.KanonhaBackend;
(async()=>{
 await assert.rejects(()=>api.studentSignUp({name:'invalid'}),/معتبر نیست/);
 const fields={name:'دانشجوی تست',studentNumber:'99887766',nationalId:'0084575948',
 birthDate:'2002-05-15',mobile:'09123456789',university:'دانشگاه تست',faculty:'دانشکده تست',major:'حسابداری',password:'secure-password-123'};
 const result=await api.studentSignUp(fields);
 assert.equal(result.id,id);
 const signup=calls.find(x=>x.body?.action==='register');
 assert.ok(signup,'missing student registration call');
 assert.equal(signup.body.email,undefined,'students must not enter an email');
 assert.equal(signup.body.nationalId,fields.nationalId);
 assert.equal(signup.body.mobile,fields.mobile,'unverified mobile must be sent only to own server');
 assert.equal(signup.headers.apikey,'sb_publishable_testonly');
 assert.equal(signup.headers.Authorization,undefined,'signup must use public gateway, not service token');
 await api.studentSignIn('national',fields.nationalId,'secure-password-123');
 await api.studentSignIn('student',fields.studentNumber,'secure-password-123');
 const signins=calls.filter(x=>x.body?.action==='login');
 assert.deepEqual(signins.map(x=>x.body.kind),['national','student']);
 assert.ok(signins.every(x=>x.url.endsWith('/functions/v1/kanonha-student-auth')));
 await assert.rejects(()=>api.studentSignIn('email','foo','pass'),/نامعتبر/);
 assert.equal(await api.isManager(),true,'manager role check should use server');
 await api.adminAction('overview');
 const manage=calls.find(x=>x.url.endsWith('/functions/v1/kanonha-admin-console'));
 assert.equal(manage.headers.Authorization,'Bearer student-token','admin endpoint must receive user JWT');
 await assert.rejects(()=>api.managerSignUp('fake@sample.com','secure-password-123'),/مدیرکل/);
 await api.managerSignUp('hossean787@gmail.com','secure-password-123');
 const manager=calls.find(x=>x.url.endsWith('/auth/v1/signup'));
 assert.equal(manager.body.email,'hossean787@gmail.com','only intended manager email may register');
 assert.equal(manager.body.data,undefined,'manager authority cannot derive from user_metadata');
 console.log('PASS unified email-free students, national/student login, verified manager signup and JWT-protected admin');
})().catch(e=>{console.error(e);process.exitCode=1});
