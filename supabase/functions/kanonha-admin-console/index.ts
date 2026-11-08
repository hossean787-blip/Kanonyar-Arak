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
 const [clubs,events,memberships,registrations,secretaries,profiles,academics]=await Promise.all([
  rows("kanonha_clubs?select=id,name,description,category,is_active,created_at&order=name.asc&limit=500"),
  rows("kanonha_events?select=id,club_id,title,starts_at,registration_deadline,location,capacity,registered_count,is_published&order=starts_at.desc&limit=500"),
  rows("kanonha_memberships?select=id,user_id,club_id,status,requested_at,decided_at&order=requested_at.desc&limit=500"),
  rows("kanonha_registrations?select=id,user_id,event_id,status,attended_at,registered_at&order=registered_at.desc&limit=500"),
  rows("kanonha_secretaries?select=club_id,user_id,appointed_at&limit=500"),
  rows("kanonha_profiles?select=user_id,full_name,student_number,university_verified&limit=500"),
  rows("kanonha_academic_details?select=user_id,birth_date,university,faculty,major,mobile&limit=500")
 ]);
 return {clubs,events,memberships,registrations,secretaries,
  users:profiles.map(p=>({...p,academic:academics.find(a=>a.user_id===p.user_id)||null}))};
}
const allowedBool=(b:unknown)=>typeof b==="boolean";
async function handle(op:string,d:Record<string,unknown>,actor:string){
 const id=val(d.id,40);
 if(op==="overview")return await overview();
 if(op==="club.create"||op==="club.update"){
  const name=val(d.name,120),description=val(d.description,2000),category=val(d.category,80);
  if(name.length<2||name.length>120||description.length>2000||category.length<2||category.length>80
    ||!allowedBool(d.is_active))throw new Error("input");
  const patch={name,description,category,is_active:d.is_active};
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
  const patch={title,location,starts_at,registration_deadline,capacity,is_published:d.is_published};
  if(op==="event.create")return mutation("kanonha_events","POST",{club_id,...patch});
  if(!uuid(id))throw new Error("input");
  // Changes to event with registrants can invalidate issued registration capacity.
  const existing=await rows("kanonha_events?select=id,registered_count,club_id&id=eq."+id);
  if(existing.length!==1||existing[0].registered_count>0||existing[0].club_id!==club_id)throw new Error("locked");
  return mutation("kanonha_events","PATCH",patch,"?id=eq."+id+"&registered_count=eq.0");
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
 if(op==="member.decide"){
  if(!uuid(id)||!["approved","rejected"].includes(String(d.status)))throw new Error("input");
  return mutation("kanonha_memberships","PATCH",{status:d.status,decided_by:actor},"?id=eq."+id+"&status=eq.pending");
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
