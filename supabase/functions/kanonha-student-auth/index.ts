// Kanonha student identity service. PUBLIC endpoint (verify_jwt=false) because
// signup/login takes credentials; privileges never leave the server.
const URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PUBLIC = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const PEPPER = Deno.env.get("KANONHA_ID_PEPPER") || SERVICE;
const OWN_ORIGIN = "https://appassets.androidplatform.net";
const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": OWN_ORIGIN,
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
  "Cache-Control": "no-store",
};
function reply(status:number, payload:Record<string,unknown>) {
  return new Response(JSON.stringify(payload), {status,headers});
}
function bad() {return reply(401,{error:"شناسه یا رمز عبور صحیح نیست."});}
function text(v:unknown,max=160) {return typeof v==="string" ? v.trim().slice(0,max+2) : "";}
function digits(s:string) {return s.replace(/[۰-۹٠-٩]/g, c => {
  const i="۰۱۲۳۴۵۶۷۸۹".indexOf(c);
  return i>=0?String(i):String("٠١٢٣٤٥٦٧٨٩".indexOf(c));
});}
function nationalValid(s:string) {
  if(!/^\d{10}$/.test(s) || /^(\d)\1{9}$/.test(s))return false;
  const sum=[...s.slice(0,9)].reduce((a,c,i)=>a+Number(c)*(10-i),0)%11;
  return Number(s[9])===(sum<2?sum:11-sum);
}
async function digest(message:string) {
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(PEPPER),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const bytes=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(message)));
  return [...bytes].map(n=>n.toString(16).padStart(2,"0")).join("");
}
async function http(path:string,method="GET",body:unknown=null,usePublic=false) {
  const key=usePublic?PUBLIC:SERVICE;
  const response=await fetch(URL+path,{method,headers:{
    "apikey":key,"Authorization":"Bearer "+key,
    "Content-Type":"application/json","Prefer":"return=representation",
  },body:body===null?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12500)});
  let data:unknown=null;
  try{data=await response.json()}catch{}
  return {status:response.status,ok:response.ok,data};
}
function asRows(data:unknown):Record<string,unknown>[] {return Array.isArray(data)?data:[];}
async function limited(req:Request,identifier:string,signup:boolean) {
  // Both per-identifier and per-connecting-address windows, independent from Auth limits.
  const ip=(req.headers.get("cf-connecting-ip")||req.headers.get("x-forwarded-for")||"missing").split(",")[0].trim().slice(0,80);
  const ipHash=await digest("rate:ip:"+ip);
  const idHash=await digest("rate:identifier:"+identifier);
  for(const [hash,max] of [[ipHash,signup?5:20],[idHash,signup?4:8]] as [string,number][]) {
    const result=await http("/rest/v1/rpc/kanonha_rate_limit","POST",{p_key:hash,p_max:max,p_minutes:15});
    if(!result.ok || result.data!==true) return false;
  }
  return true;
}
function validRegistration(input:Record<string,unknown>) {
  const student=digits(text(input.studentNumber,20)), national=digits(text(input.nationalId,10));
  const fullName=text(input.name,80),university=text(input.university,120),
    faculty=text(input.faculty,120),major=text(input.major,120);
  const birth=text(input.birthDate,10),password=input.password;
  const d=new Date(birth+"T00:00:00Z");
  if(!/^\d{6,20}$/.test(student)||!nationalValid(national)||
    fullName.length<2||fullName.length>80||
    ![university,faculty,major].every(s=>s.length>=2&&s.length<=120)||
    !/^\d{4}-\d{2}-\d{2}$/.test(birth) || Number.isNaN(d.getTime()) ||
    d.toISOString().slice(0,10)!==birth ||
    d.getTime()>=Date.now()||d.getUTCFullYear()<1920 ||
    typeof password!=="string"||password.length<10||password.length>128) return null;
  return {student,national,fullName,university,faculty,major,birth,password};
}
async function create(input:Record<string,unknown>,req:Request) {
  const r=validRegistration(input);
  if(!r) return reply(422,{error:"اطلاعات ثبت‌نام معتبر نیست؛ کد ملی، تاریخ تولد و رمز را بررسی کنید."});
  if(!await limited(req,"register:"+r.student,true))return reply(429,{error:"تعداد تلاش‌ها بیش از حد مجاز است. بعداً دوباره اقدام کنید."});
  const nationalHash=await digest("national:"+r.national);
  const existing=await http("/rest/v1/kanonha_student_credentials?select=user_id&or=(student_number.eq."+encodeURIComponent(r.student)+",national_digest.eq."+nationalHash+")&limit=1");
  if(!existing.ok) return reply(503,{error:"پایگاه داده ثبت‌نام در دسترس نیست."});
  if(asRows(existing.data).length) return reply(409,{error:"حسابی با این شناسه‌ها قبلاً ثبت شده است."});
  // Internal auth email is random and never visible; students supply no real email.
  const internalEmail="u-"+crypto.randomUUID()+"@student.kanonha.invalid";
  const created=await http("/auth/v1/admin/users","POST",{
    email:internalEmail,password:r.password,email_confirm:true,
    user_metadata:{account_type:"student"}
  });
  const body=created.data as Record<string,unknown>|null;
  const user=(body && typeof body.user==="object" ? body.user : body) as Record<string,unknown>|null;
  if(!created.ok||!user||typeof user.id!=="string")return reply(503,{error:"امکان ساخت حساب فراهم نشد."});
  const uid=user.id;
  try{
    const alias=await http("/rest/v1/kanonha_student_credentials","POST",{
      user_id:uid,student_number:r.student,national_digest:nationalHash,internal_email:internalEmail
    });
    if(!alias.ok)throw Error("alias");
    const profile=await http("/rest/v1/kanonha_profiles","POST",{
      user_id:uid,full_name:r.fullName,student_number:r.student
    });
    if(!profile.ok)throw Error("profile");
    const academic=await http("/rest/v1/kanonha_academic_details","POST",{
      user_id:uid,birth_date:r.birth,university:r.university,faculty:r.faculty,major:r.major
    });
    if(!academic.ok)throw Error("academic");
  }catch{
    // Avoid orphaned logins or dangling identifier reservations.
    await http("/auth/v1/admin/users/"+encodeURIComponent(uid),"DELETE");
    return reply(409,{error:"ثبت‌نام کامل نشد؛ شناسه‌ها را بررسی و دوباره تلاش کنید."});
  }
  const signIn=await http("/auth/v1/token?grant_type=password","POST",{email:internalEmail,password:r.password},true);
  if(!signIn.ok)return reply(503,{error:"حساب ساخته شد؛ از صفحه ورود وارد شوید."});
  return reply(201,{session:signIn.data});
}
async function login(input:Record<string,unknown>,req:Request) {
  const kind=input.kind;
  const id=digits(text(input.identifier,20));
  const password=input.password;
  if(!["national","student"].includes(String(kind))||typeof password!=="string"||
    password.length<1||password.length>128)return bad();
  if(kind==="national"?!nationalValid(id):!/^\d{6,20}$/.test(id))return bad();
  if(!await limited(req,"login:"+String(kind)+":"+id,false))
    return reply(429,{error:"تعداد تلاش‌ها بیش از حد مجاز است. بعداً دوباره اقدام کنید."});
  const filter=kind==="national"?"national_digest=eq."+await digest("national:"+id)
    :"student_number=eq."+encodeURIComponent(id);
  const found=await http("/rest/v1/kanonha_student_credentials?select=internal_email&"+filter+"&limit=1");
  if(!found.ok)return reply(503,{error:"اتصال به سرویس ورود برقرار نشد."});
  const row=asRows(found.data)[0];
  const email=typeof row?.internal_email==="string"?row.internal_email:"unknown@student.kanonha.invalid";
  const token=await http("/auth/v1/token?grant_type=password","POST",{email,password},true);
  if(!token.ok)return bad();
  return reply(200,{session:token.data});
}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(req.method!=="POST")return reply(405,{error:"روش درخواست مجاز نیست."});
  if(!URL||!SERVICE||!PUBLIC)return reply(503,{error:"پیکربندی سرویس ورود تکمیل نشده است."});
  if(Number(req.headers.get("content-length")||0)>8000)return reply(413,{error:"درخواست بیش از حد بزرگ است."});
  let body:unknown;
  try{body=await req.json()}catch{return reply(400,{error:"ساختار درخواست نامعتبر است."})}
  if(!body||typeof body!=="object"||Array.isArray(body))return reply(400,{error:"ساختار درخواست نامعتبر است."});
  const input=body as Record<string,unknown>;
  try {
    if(input.action==="health")return reply(200,{ready:true,service:"kanonha-student-auth"});
    if(input.action==="register")return await create(input,req);
    if(input.action==="login")return await login(input,req);
    return reply(400,{error:"عملیات نامعتبر است."});
  }catch{
    return reply(503,{error:"سرویس ورود موقتاً در دسترس نیست."});
  }
});
