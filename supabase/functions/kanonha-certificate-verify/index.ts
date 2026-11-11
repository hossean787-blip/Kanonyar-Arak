// Kanonha event certificates: public QR verification + authenticated national-ID proof.
// No raw national ID is stored, logged, returned, or made public.
const SUPA=Deno.env.get("SUPABASE_URL")||"";
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const PEPPER=Deno.env.get("KANONHA_ID_PEPPER")||SERVICE;
const APP_ORIGIN="https://appassets.androidplatform.net";
const NO_STORE={"Cache-Control":"no-store, max-age=0","X-Content-Type-Options":"nosniff",
 "Referrer-Policy":"no-referrer","X-Frame-Options":"DENY",
 "X-Robots-Tag":"noindex, nofollow, noarchive"};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KIND:Record<string,string>={
 workshop:"گواهی شرکت در کارگاه",course:"گواهی شرکت در دوره",
 conference:"گواهی مشارکت علمی",session:"گواهی شرکت در نشست",
 competition:"گواهی شرکت در مسابقه",festival:"گواهی مشارکت فرهنگی و هنری",
 volunteer:"گواهی همکاری داوطلبانه",collaboration:"گواهی همکاری در برگزاری",
 general:"گواهی مشارکت"
};
const escape=(value:unknown)=>String(value==null?"":value)
 .replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
function cors(req:Request){
 const origin=req.headers.get("origin");
 return {...NO_STORE,"Access-Control-Allow-Origin":origin===APP_ORIGIN?APP_ORIGIN:APP_ORIGIN,
  "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
  "Access-Control-Allow-Headers":"apikey,authorization,content-type,x-client-info",
  "Vary":"Origin"};
}
function json(status:number,payload:Record<string,unknown>,req:Request){
 return new Response(JSON.stringify(payload),{status,headers:{"Content-Type":"application/json; charset=utf-8",...cors(req)}});
}
function html(status:number,body:string,req:Request){
 return new Response(body,{status,headers:{"Content-Type":"text/html; charset=utf-8",
  "Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  ...cors(req)}});
}
function national(s:string){
 return s.replace(/[۰-۹٠-٩]/g,c=>{
  const fa="۰۱۲۳۴۵۶۷۸۹".indexOf(c);return String(fa>=0?fa:"٠١٢٣٤٥٦٧٨٩".indexOf(c));
 });
}
function nationalValid(s:string){
 if(!/^\d{10}$/.test(s)||/^(\d)\1{9}$/.test(s))return false;
 const sum=[...s.slice(0,9)].reduce((a,c,i)=>a+Number(c)*(10-i),0)%11;
 return Number(s[9])===(sum<2?sum:11-sum);
}
async function digest(s:string){
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(PEPPER),
  {name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const signed=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(s)));
 return [...signed].map(c=>c.toString(16).padStart(2,"0")).join("");
}
function constantEqual(a:string,b:string){
 if(a.length!==64||b.length!==64)return false;
 let difference=0;for(let i=0;i<64;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);
 return difference===0;
}
async function supa(path:string,options:{method?:string;data?:unknown;auth?:string}={}){
 const response=await fetch(SUPA+path,{method:options.method||"GET",headers:{
  apikey:SERVICE,Authorization:"Bearer "+(options.auth||SERVICE),
  "Content-Type":"application/json",Accept:"application/json"},
  body:options.data===undefined?undefined:JSON.stringify(options.data),
  signal:AbortSignal.timeout(12000)});
 const raw=await response.text();
 let data:unknown=null;try{data=raw?JSON.parse(raw):null;}catch{}
 if(!response.ok)throw new Error("backend:"+response.status);
 return data;
}
function page(status:number,title:string,detail:string,req:Request){
 const body='<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width, initial-scale=1"><title>استعلام اصالت گواهی | کانون‌ها</title>'+
 '<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:28px;background:radial-gradient(circle at 12% 0%,#e5e7cf,#f7f5ec 58%,#e9e8db);font:16px/2 Tahoma,Arial,sans-serif;color:#204d42}'+
 'main{width:min(100%,620px);background:#fffefa;border:1px solid #c8a969;border-radius:24px;box-shadow:0 16px 55px #1d51421b;padding:30px;text-align:center}'+
 '.symbol{margin:auto;width:76px;height:76px;border:2px solid #c3a566;border-radius:50%;display:grid;place-items:center;font-size:34px;color:#146c55}'+
 'h1{font-size:25px;margin:16px 0 4px}h2{font-size:19px;margin:14px 0;color:#166951}p{margin:9px 0;overflow-wrap:anywhere}.pill{display:inline-block;background:#e8f2ec;padding:4px 18px;border-radius:99px;color:#1e6d51;font-weight:bold}'+
 '.muted{font-size:13px;color:#61756c}hr{border:0;border-top:1px solid #e5e2d7;margin:22px 0}</style></head><body><main>'+
 '<div class="symbol" aria-hidden="true">'+(status===200?"✓":"!")+'</div>'+
 '<h1>استعلام اصالت گواهی</h1><p class="muted">سامانه مستقل کانون‌های دانشجویی</p>'+
 '<p class="pill">'+escape(title)+'</p><hr><section>'+detail+'</section>'+
 '<hr><p class="muted">کد ملی و سایر اطلاعات محرمانه در استعلام عمومی نمایش داده نمی‌شوند.</p></main></body></html>';
 return html(status,body,req);
}
async function verifyPublic(req:Request){
 const url=new URL(req.url);
 const code=url.searchParams.get("code")||"";
 if(!UUID.test(code))return page(400,"شناسه نامعتبر","<p>شناسه واردشده معتبر نیست.</p>",req);
 const result=await supa("/rest/v1/kanonha_certificates?select=certificate_code,student_name,event_title,event_type,club_name,event_starts_at,issued_at&certificate_code=eq."+
  encodeURIComponent(code)+"&limit=1");
 const rows=Array.isArray(result)?result:[];
 if(rows.length!==1)return page(404,"گواهی یافت نشد","<p>برای این شناسه، گواهی صادرشده‌ای ثبت نشده است.</p>",req);
 const c=rows[0] as Record<string,unknown>;
 const title=KIND[String(c.event_type)]||KIND.general;
 const eventDate=new Date(String(c.event_starts_at||""));
 const issuedDate=new Date(String(c.issued_at||""));
 const fmt=(d:Date)=>Number.isFinite(d.getTime())?d.toLocaleDateString("fa-IR-u-ca-persian"):"نامشخص";
 const detail="<h2>"+escape(title)+"</h2>"+
  "<p><strong>صاحب گواهی:</strong> "+escape(c.student_name)+"</p>"+
  "<p><strong>رویداد:</strong> "+escape(c.event_title)+"</p>"+
  "<p><strong>برگزارکننده:</strong> "+escape(c.club_name)+"</p>"+
  "<p><strong>تاریخ برگزاری:</strong> "+escape(fmt(eventDate))+"</p>"+
  "<p><strong>تاریخ صدور:</strong> "+escape(fmt(issuedDate))+"</p>"+
  "<p class=\"muted\">شناسه: <span dir=\"ltr\">"+escape(code)+"</span></p>";
 return page(200,"گواهی معتبر است",detail,req);
}
async function verifyNational(req:Request){
 const auth=req.headers.get("authorization")||"";
 const matched=/^Bearer\s+(\S{10,4096})$/i.exec(auth);
 if(!matched)return json(401,{error:"ابتدا وارد حساب کاربری شوید."},req);
 if(Number(req.headers.get("content-length")||0)>2048)
  return json(413,{error:"درخواست بیش از اندازه بزرگ است."},req);
 let body:unknown=null;try{body=await req.json();}catch{}
 if(!body||typeof body!=="object"||Array.isArray(body))
  return json(400,{error:"درخواست معتبر نیست."},req);
 const fields=body as Record<string,unknown>;
 if(fields.action!=="national.verify"||typeof fields.national_id!=="string"||
   fields.national_id.length>16)return json(400,{error:"درخواست معتبر نیست."},req);
 const id=national(fields.national_id.trim());
 if(!nationalValid(id))return json(422,{error:"کد ملی معتبر نیست."},req);
 const identity=await supa("/auth/v1/user",{auth:matched[1]});
 const user=identity&&typeof identity==="object"?identity as Record<string,unknown>:{};
 if(typeof user.id!=="string"||!UUID.test(user.id))
  return json(401,{error:"نشست شما معتبر نیست."},req);
 const limiter=await supa("/rest/v1/rpc/kanonha_rate_limit",{
  method:"POST",data:{p_key:await digest("rate:certificate-national:"+user.id),p_max:6,p_minutes:15}
 });
 if(limiter!==true)return json(429,{error:"تعداد تلاش‌ها بیش از حد مجاز است. بعداً دوباره اقدام کنید."},req);
 const rows=await supa("/rest/v1/kanonha_student_credentials?select=national_digest&user_id=eq."+
   encodeURIComponent(user.id)+"&limit=1");
 const stored=Array.isArray(rows)&&rows[0]&&typeof rows[0].national_digest==="string"?
  rows[0].national_digest:"";
 if(!stored)return json(409,{error:"کد ملی این حساب در ثبت‌نام رسمی ثبت نشده است."},req);
 if(!constantEqual(stored,await digest("national:"+id)))
  return json(422,{error:"کد ملی واردشده با اطلاعات ثبت‌نام مطابقت ندارد."},req);
 return json(200,{valid:true},req);
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
 if(!SUPA||!SERVICE)return json(503,{error:"پیکربندی سرویس کامل نیست."},req);
 try{
  if(req.method==="GET")return await verifyPublic(req);
  if(req.method==="POST")return await verifyNational(req);
  return json(405,{error:"روش درخواست مجاز نیست."},req);
 }catch(_error){return json(503,{error:"سرویس استعلام موقتاً در دسترس نیست."},req);}
});
