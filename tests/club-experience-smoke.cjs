'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root='app/src/main/assets/';
const get=name=>fs.readFileSync(root+name,'utf8');
const app=get('app.js'), api=get('backend.js'), secretary=get('secretary.js');
const admin=get('admin.js'), html=get('index.html'), css=get('styles.css');
const sql=fs.readFileSync('supabase/club-experience-v097.sql','utf8');
const edge=fs.readFileSync('supabase/functions/kanonha-admin-console/index.ts','utf8');
for(const [name,script] of [['app',app],['backend',api],['secretary',secretary],['admin',admin]])
 new vm.Script(script,{filename:name+'.js'});
for(const id of ['clubs-university','clubs-faculty','clubs-category','screen-club-detail','club-detail-content'])
 assert.match(html,new RegExp('id="'+id+'"'),'missing UI '+id);
assert.match(css,/#screen-clubs\s+\.club-list\s*\{[^}]*grid-template-columns:\s*repeat\(2/);
assert.match(html,/img-src 'self' data: blob: https:\/\/cnqcysnjinghzzrzanpj\.supabase\.co;/,
 'CSP must permit selected image previews and only the dedicated logo host');
assert.doesNotMatch(html,/img-src[^;]*\*/,'CSP must not allow wildcard image origins');
for(const feature of ['clubImageSrc','renderClubDetail','onlineCancelMembership','reapplyClub','cancelClubMembership','clubLogoUrl','secretaryUploadClubLogo'])
 assert.ok((app+api).includes(feature),'missing '+feature);
assert.ok(secretary.includes('secretary-logo-form'));
assert.ok(secretary.includes('secretaryUploadClubLogo'));
assert.ok(admin.includes('clubUniversityOptions'));
assert.ok(admin.includes('clubFacultyOptions'));
assert.ok(!admin.includes("'member.decide'"),'manager must not approve membership');
assert.ok(!edge.includes('if(op==="member.decide")'),'manager edge must not approve membership');
assert.ok(edge.includes('kanonha_universities?select=id'));
for(const symbol of ['kanonha_membership_student_profile_fk','kanonha_member_cancel_or_leave',
 'kanonha_member_reapply','kanonha_secretary_logo_insert','kanonha_secretary_logo_update',
 'Invalid membership state transition or unauthorized secretary'])assert.ok(sql.includes(symbol),symbol);
assert.match(sql,/name\s*~\s*'\^\[0-9a-f-\]/);
assert.equal((sql.match(/split_part\(storage\.objects\.name,'\/',1\)/g)||[]).length,4,'All storage paths must be fully qualified');
assert.doesNotMatch(sql,/split_part\(name,'\/',1\)/,'Ambiguous name reference breaks secretary permissions');
const fix=fs.readFileSync('supabase/club-logo-rls-fix-v098.sql','utf8');
assert.equal((fix.match(/split_part\(storage\.objects\.name,'\/',1\)/g)||[]).length,3);
assert.doesNotMatch(fix,/split_part\(name,'\/',1\)/);
assert.match(api,/status=eq\.rejected/);
assert.match(api,/status=in\.\(pending,approved\)/);
console.log('Club experience static, syntax and access-contract checks passed.');
