// Kanonha privileged console. verify_jwt=true + independently validated Auth user + admin DB row.
const SUPA=Deno.env.get("SUPABASE_URL")||"";
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const OWNER="hossean787@gmail.com";
const CORS={
 "Content-Type":"application/json; charset=utf-8",
 "Access-Control-Allow-Origin":"https://appassets.androidplatform.net",
 "Access-Control-Allow-Methods":"POST,OPTIONS",
 "Access-Control-Allow-Headers":"authorization,content-type,apikey,x-client-info",
 "Cache-Control":"no-store"
};
const respond=(status:number,obj:unknown)=>new Response(JSON.stringify(obj),{status,headers:CORS});
const uuid=(s:unknown):s is string=>typeof s==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[a-f0-9]{12}$/i.test(s);
function val(s:unknown,max=180){return typeof s==="string"?s.trim().slice(0,max+2):"";}
async function api(path:string,method="GET",data:unknown=null,asUser=""){
 const key=SERVICE;
 const response=await fetch(SUPA+path,{method,headers:{
  apikey:key,Authorization:"Bearer "+(asUser||key),
  "Content-Type":"application/json",Prefer:"return=representation"
 },body:data===null?undefined:JSON.stringify(data),signal:AbortSignal.timeout(18000)});
 let json:unknown=null;try{json=await response.json()}catch{}
 if(!response.ok)throw new Error("backend:"+response.status);
 return json;
}
async function rows(path:string){const data=await api("/rest/v1/"+path);return Array.isArray(data)?data:[]}
async function mutation(table:string,method:string,payload:unknown,filter="",expectOne=true){
 const path="/rest/v1/"+table+filter;
 const data=await api(path,method,payload);
 if(expectOne && (!Array.isArray(data)||data.length!==1))throw new Error("row_missing");
 return data;
}
async function identity(req:Request){
 const token=(req.headers.get("authorization")||"").match(/^Bearer\s+(\S+)$/i)?.[1];
 if(!token||token.length>4096)return null;
 const verified=await api("/auth/v1/user","GET",null,token);
 const user=(verified&&typeof verified==="object"?verified:{} )as Record<string,unknown>;
 if(!uuid(user.id)||String(user.email||"").toLowerCase()!==OWNER||!user.email_confirmed_at)return null;
 const roles=await rows("kanonha_admins?select=user_id&user_id=eq."+encodeURIComponent(user.id)+"&limit=1");
 return roles.length===1?user.id:null;
}
async function overview(){
 const [clubs,events,memberships,registrations,secretaries,profiles,academics,universities,faculties]=await Promise.all([
  rows("kanonha_clubs?select=id,name,description,category,university,faculty,logo_path,is_active,created_at&order=name.asc&limit=500"),
  rows("kanonha_events?select=id,club_id,title,starts_at,registration_deadline,location,capacity,registered_count,is_published,approval_status,approved_at,poster_path&order=starts_at.desc&limit=500"),
  rows("kanonha_memberships?select=id,user_id,club_id,status,requested_at,decided_at&order=requested_at.desc&limit=500"),
  rows("kanonha_registrations?select=id,user_id,event_id,status,attended_at,registered_at&order=registered_at.desc&limit=500"),
  rows("kanonha_secretaries?select=club_id,user_id,appointed_at&limit=500"),
  rows("kanonha_profiles?select=user_id,full_name,student_number,university_verified&limit=500"),
  rows("kanonha_academic_details?select=user_id,birth_date,university,faculty,major,mobile&limit=500"),
  rows("kanonha_universities?select=id,name&order=name.asc&limit=1000"),
  rows("kanonha_faculties?select=id,university_id,name&order=name.asc&limit=5000")
 ]);
 return {clubs,events,memberships,registrations,secretaries,universities,faculties,
  users:profiles.map(p=>({...p,academic:academics.find(a=>a.user_id===p.user_id)||null}))};
}
// A director may additionally be a student: attach academic records to the SAME auth.uid.
function validNational(code:string){
 if(!/^\d{10}$/.test(code)||/^(\d)\1{9}$/.test(code))return false;
 const mod=[...code.slice(0,9)].reduce((sum,c,i)=>sum+Number(c)*(10-i),0)%11;
 return Number(code[9])===(mod<2?mod:11-mod);
}
async function hashNational(code:string){
 const pepper=Deno.env.get("KANONHA_ID_PEPPER")||SERVICE;
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(pepper),
  {name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const bytes=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode("national:"+code)));
 return [...bytes].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function attachManagerStudent(d:Record<string,unknown>,actor:string){
 const fullName=val(d.full_name,80),student=val(d.student_number,20);
 const national=val(d.national_id,10),birth=val(d.birth_date,10);
 const university=val(d.university,120),faculty=val(d.faculty,120),major=val(d.major,120);
 const mobile=val(d.mobile,11),parsed=new Date(birth+"T00:00:00Z");
 if(fullName.length<2||fullName.length>80||!/^\d{6,20}$/.test(student)
   ||!validNational(national)||!/^09\d{9}$/.test(mobile)
   ||[university,faculty,major].some(v=>v.length<2||v.length>120)
   ||!/^\d{4}-\d{2}-\d{2}$/.test(birth)||!Number.isFinite(parsed.getTime())
   ||parsed.toISOString().slice(0,10)!==birth||parsed.getUTCFullYear()<1920
   ||parsed.getTime()>=Date.now())throw new Error("input");
 return await api("/rest/v1/rpc/kanonha_manager_attach_student","POST",{
   p_user_id:actor,p_full_name:fullName,p_student_number:student,
   p_national_digest:await hashNational(national),p_birth_date:birth,
   p_university:university,p_faculty:faculty,p_major:major,p_mobile:mobile
 });
}
const allowedBool=(b:unknown)=>typeof b==="boolean";
async function handle(op:string,d:Record<string,unknown>,actor:string){
 const id=val(d.id,40);
 if(op==="overview")return await overview(); if(op==="notification.preview"||op==="notification.send"){
  const audience=val(d.audience,30),university=val(d.university,120);
  const club_id=d.club_id==null||d.club_id===""?null:val(d.club_id,40);
  const faculties=Array.isArray(d.faculties)?d.faculties:[];
  if(!["all","students","secretaries","university","faculties","club_members"].includes(audience)
     ||(club_id!==null&&!uuid(club_id))
     ||faculties.length>30||faculties.some(f=>typeof f!=="string"||f.trim().length<2||f.trim().length>120)
     ||(["university","faculties"].includes(audience)&&university.length<2)
     ||(audience==="faculties"&&faculties.length===0)
     ||(audience==="club_members"&&!club_id))throw new Error("input");
  const target={p_audience:audience,p_university:university||null,
    p_faculties:[...new Set(faculties.map(f=>String(f).trim()))],p_club_id:club_id};
  if(op==="notification.preview")
    return await api("/rest/v1/rpc/kanonha_notification_preview","POST",target);
  const kind=val(d.kind,20),title=val(d.title,120),body=val(d.body,1000);
  const related_id=d.related_id==null||d.related_id===""?null:val(d.related_id,40);
  const version_label=val(d.version_label,40);
  const request_key=val(d.request_key,40);
  if(!uuid(request_key)||!["event","club","update","general"].includes(kind)
    ||title.length<2||title.length>120||body.length<2||body.length>1000
    ||(related_id!==null&&!uuid(related_id))
    ||(["event","club"].includes(kind)&&!related_id)
    ||(kind==="update"&&!version_label))throw new Error("input");
  return await api("/rest/v1/rpc/kanonha_notification_publish","POST",{
    ...target,p_request_key:request_key,p_kind:kind,p_title:title,p_body:body,
    p_actor:actor,p_related_id:related_id,p_version_label:version_label||null
  });
 }
 if(op==="notification.history")
  return await rows("kanonha_notification_campaigns?select=id,kind,title,body,audience,recipient_count,created_at,target_university,target_faculties,version_label&order=created_at.desc&limit=60");


 if(op==="university.create"){
  const name=val(d.name,120);
  if(name.length<2||name.length>120)throw new Error("input");
  return mutation("kanonha_universities","POST",{name});
 }
 if(op==="faculty.create"){
  const name=val(d.name,120),university_id=val(d.university_id,40);
  if(name.length<2||name.length>120||!uuid(university_id))throw new Error("input");
  const matched=await rows("kanonha_universities?select=id&id=eq."+university_id+"&limit=1");
  if(matched.length!==1)throw new Error("input");
  return mutation("kanonha_faculties","POST",{university_id,name});
 }
  if(op==="manager.student.attach")return await attachManagerStudent(d,actor);
 if(op==="club.create"||op==="club.update"){
  const name=val(d.name,120),description=val(d.description,2000),category=val(d.category,80);
  const university=val(d.university,120),faculty=val(d.faculty,120);
  if(name.length<2||name.length>120||!description||description.length>2000||category.length<2||category.length>80
    ||university.length<2||university.length>120||faculty.length>120
    ||!allowedBool(d.is_active))throw new Error("input");
  const universities=await rows("kanonha_universities?select=id&name=eq."+encodeURIComponent(university)+"&limit=1");
  if(universities.length!==1)throw new Error("input");
  if(faculty){
   const faculties=await rows("kanonha_faculties?select=id&university_id=eq."+
     universities[0].id+"&name=eq."+encodeURIComponent(faculty)+"&limit=1");
   if(faculties.length!==1)throw new Error("input");
  }
  const patch={name,description,category,university,faculty,is_active:d.is_active};
  if(op==="club.create")return mutation("kanonha_clubs","POST",patch);
  if(!uuid(id))throw new Error("input");
  return mutation("kanonha_clubs","PATCH",patch,"?id=eq."+id);
 }
 if(op==="club.delete"){
  if(!uuid(id)||d.confirm!=="DELETE")throw new Error("input");
  return mutation("kanonha_clubs","DELETE",null,"?id=eq."+id);
 }
 if(op==="event.create"||op==="event.update"){
  const club_id=val(d.club_id,40);
  const title=val(d.title,160),location=val(d.location,250);
  const starts_at=val(d.starts_at,45),registration_deadline=val(d.registration_deadline,45);
  const capacity=Number(d.capacity);
  if(!uuid(club_id)||title.length<2||title.length>160||location.length>250||
    !Number.isFinite(Date.parse(starts_at))||!Number.isFinite(Date.parse(registration_deadline))||
    Date.parse(starts_at)<=Date.now()||Date.parse(registration_deadline)<=Date.now()||
    Date.parse(registration_deadline)>Date.parse(starts_at)||
    !Number.isInteger(capacity)||capacity<1||capacity>100000||!allowedBool(d.is_published))throw new Error("input");
  const published=d.is_published===true;
  const patch={title,location,starts_at,registration_deadline,capacity,
   is_published:published,approval_status:published?'approved':'pending',
   approved_at:published?new Date().toISOString():null};
  if(op==="event.create")return mutation("kanonha_events","POST",{club_id,...patch});
  if(!uuid(id))throw new Error("input");
  // Changes to event with registrants can invalidate issued registration capacity.
  const existing=await rows("kanonha_events?select=id,registered_count,club_id&id=eq."+id);
  if(existing.length!==1||existing[0].registered_count>0||existing[0].club_id!==club_id)throw new Error("locked");
  return mutation("kanonha_events","PATCH",patch,"?id=eq."+id+"&registered_count=eq.0");
 }
 if(op==="event.approve"||op==="event.reject"){
  if(!uuid(id))throw new Error("input");
  const matches=await rows("kanonha_events?select=id,approval_status,is_published,registered_count,starts_at,registration_deadline&id=eq."+id+"&limit=1");
  const event=matches[0];
  if(!event)throw new Error("missing");
  if(op==="event.approve"){
   if(event.approval_status==="approved"&&event.is_published)return {status:"approved"};
   if(Date.parse(event.starts_at)<=Date.now()||Date.parse(event.registration_deadline)<=Date.now())throw new Error("locked");
   return mutation("kanonha_events","PATCH",{
    approval_status:"approved",approved_at:new Date().toISOString(),is_published:true
   },"?id=eq."+id+"&approval_status=eq."+encodeURIComponent(event.approval_status));
  }
  if(Number(event.registered_count)>0)throw new Error("locked");
  return mutation("kanonha_events","PATCH",{
   approval_status:"rejected",approved_at:null,is_published:false
  },"?id=eq."+id+"&registered_count=eq.0");
 }
 if(op==="event.report"){
  if(!uuid(id))throw new Error("input");
  const events=await rows("kanonha_events?select=id,title,club_id,capacity,registered_count&id=eq."+id+"&limit=1");
  if(!events.length)throw new Error("missing");
  const all:Record<string,unknown>[]=[];
  for(let offset=0;offset<10000;offset+=500){
   const part=await rows("kanonha_registrations?select=id,user_id,event_id,status,registered_at,attended_at"+
    "&event_id=eq."+id+"&order=registered_at.asc&limit=500&offset="+offset);
   all.push(...part);if(part.length<500)break;
  }
  const ids=[...new Set(all.map(r=>String(r.user_id||"")).filter(uuid))];
  const profiles:Record<string,unknown>[]=[];
  for(let i=0;i<ids.length;i+=80){
   profiles.push(...await rows("kanonha_profiles?select=user_id,full_name,student_number"+
    "&user_id=in.("+ids.slice(i,i+80).map(encodeURIComponent).join(",")+")"));
  }
  const byId=new Map(profiles.map(p=>[String(p.user_id),p]));
  return {event:events[0],registered:Number(events[0].registered_count||0),
   attended:all.filter(r=>r.attended_at).length,
   rows:all.map(r=>({...r,student:byId.get(String(r.user_id))||null})),
   truncated:all.length>=10000};
 }
 if(op==="event.delete"){
  if(!uuid(id)||d.confirm!=="DELETE")throw new Error("input");
  const events=await rows("kanonha_events?select=registered_count&id=eq."+id);
  if(events.length!==1||events[0].registered_count>0)throw new Error("locked");
  return mutation("kanonha_events","DELETE",null,"?id=eq."+id+"&registered_count=eq.0");
 }
 if(op==="secretary.assign"||op==="secretary.revoke"){
  if(!uuid(d.user_id)||!uuid(d.club_id))throw new Error("input");
  if(op==="secretary.assign")return mutation("kanonha_secretaries","POST",{user_id:d.user_id,club_id:d.club_id});
  return mutation("kanonha_secretaries","DELETE",null,"?user_id=eq."+d.user_id+"&club_id=eq."+d.club_id);
 }
 if(op==="student.verify"){
  if(!uuid(d.user_id)||!allowedBool(d.verified))throw new Error("input");
  return mutation("kanonha_profiles","PATCH",{university_verified:d.verified},"?user_id=eq."+d.user_id);
 }
 if(op==="student.edit"){
  if(!uuid(d.user_id))throw new Error("input");
  const full_name=val(d.full_name,80),university=val(d.university,120),
    faculty=val(d.faculty,120),major=val(d.major,120),mobile=val(d.mobile,11);
  if(full_name.length<2||[university,faculty,major].some(x=>x.length<2||x.length>120)||!/^09\d{9}$/.test(mobile))throw new Error("input");
  await mutation("kanonha_profiles","PATCH",{full_name},"?user_id=eq."+d.user_id);
  return mutation("kanonha_academic_details","PATCH",{university,faculty,major,mobile},"?user_id=eq."+d.user_id);
 }
 if(op==="roster.attendance"){
  if(!uuid(id)||!allowedBool(d.present))throw new Error("input");
  const registration=await rows("kanonha_registrations?select=id,event_id&id=eq."+id);
  if(registration.length!==1)throw new Error("missing");
  const ev=await rows("kanonha_events?select=starts_at&id=eq."+registration[0].event_id);
  if(ev.length!==1||Date.parse(ev[0].starts_at)>Date.now())throw new Error("locked");
  return mutation("kanonha_registrations","PATCH",{attended_at:d.present?new Date().toISOString():null},"?id=eq."+id);
 }
 throw new Error("operation");
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:CORS,status:204});
 if(req.method!=="POST")return respond(405,{error:"روش درخواست پشتیبانی نمی‌شود."});
 if(!SUPA||!SERVICE)return respond(503,{error:"سرویس مدیریت در دسترس نیست."});
 let actor:string|null=null;
 try{actor=await identity(req)}catch{}
 if(!actor)return respond(403,{error:"دسترسی مدیرکل برای این حساب تأیید نشده است."});
 let input:unknown;
 try{input=await req.json()}catch{return respond(400,{error:"درخواست نامعتبر است."})}
 if(!input||typeof input!=="object"||Array.isArray(input))return respond(400,{error:"درخواست نامعتبر است."});
 const d=input as Record<string,unknown>;
 try{return respond(200,{result:await handle(String(d.action||""),d,actor)})}
 catch(e){const msg=String(e);
  if(msg.includes("locked"))return respond(409,{error:"به دلیل وجود ثبت‌نام یا زمان‌بندی، این تغییر مجاز نیست."});
  if(msg.includes("input"))return respond(422,{error:"اطلاعات واردشده معتبر نیست."});
  if(msg.includes("row_missing"))return respond(409,{error:"رکورد یافت نشد یا تغییر قابل اجرا نیست."});
  return respond(409,{error:"عملیات مدیریتی انجام نشد؛ وابستگی داده یا مجوزها را بررسی کنید."});
 }
});
