// Kanonha: authenticated database-webhook FCM HTTP v1 sender.
// Only a Supabase service-role bearer may call this endpoint. All delivery
// details are reloaded from trusted database records; webhook data is untrusted.
// Firebase service account JSON must exist ONLY in Supabase Edge Function secrets.
type ServiceAccount={project_id:string;client_email:string;private_key:string;token_uri?:string};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}
});
const base64url=(input:Uint8Array)=>btoa(String.fromCharCode(...input))
 .replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
const utf8=(s:string)=>new TextEncoder().encode(s);
async function googleAccessToken(account:ServiceAccount):Promise<string>{
 const pem=account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,"");
 const key=await crypto.subtle.importKey("pkcs8",Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{
  name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
 const now=Math.floor(Date.now()/1000);
 const claims={iss:account.client_email,scope:"https://www.googleapis.com/auth/firebase.messaging",
  aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3000};
 const assertion=base64url(utf8(JSON.stringify({alg:"RS256",typ:"JWT"})))+"."+
  base64url(utf8(JSON.stringify(claims)));
 const signature=base64url(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,utf8(assertion))));
 const response=await fetch("https://oauth2.googleapis.com/token",{
  method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",
   assertion:assertion+"."+signature}),signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error("FCM OAuth failed: "+response.status);
 const token=(await response.json()).access_token;
 if(typeof token!=="string"||!token)throw new Error("FCM OAuth missing access token");
 return token;
}
function validUuid(value:unknown):value is string{
 return typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
Deno.serve(async req=>{
 if(req.method!=="POST")return json({error:"method_not_allowed"},405);
 const dbUrl=Deno.env.get("SUPABASE_URL")||"";
 const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 const secret=Deno.env.get("KANONHA_FIREBASE_SERVICE_ACCOUNT_JSON")||"";
 const incoming=req.headers.get("authorization")||"";
 if(!serviceKey||incoming!=="Bearer "+serviceKey)return json({error:"unauthorized"},401);
 if(!secret)return json({error:"firebase_not_configured"},503);
 let account:ServiceAccount;
 try{account=JSON.parse(secret);}catch{return json({error:"firebase_credentials_invalid"},503)}
 if(!account.project_id||!/^[a-z0-9-]{6,100}$/.test(account.project_id)||
    !account.client_email||!account.private_key)return json({error:"firebase_credentials_invalid"},503);
 let event:Record<string,unknown>;
 try{
  if(Number(req.headers.get("content-length")||"0")>8192)return json({error:"payload_too_large"},413);
  event=await req.json();
 }catch{return json({error:"invalid_json"},400)}
 const rec=event?.record as Record<string,unknown>|undefined;
 if(event?.type!=="INSERT"||event?.schema!=="public"||
    event?.table!=="kanonha_notification_deliveries"||!rec||!validUuid(rec.id))
  return json({error:"invalid_webhook"},400);
 const headers={apikey:serviceKey,authorization:"Bearer "+serviceKey,accept:"application/json"};
 const db=async (path:string,init:RequestInit={})=>{
  const r=await fetch(dbUrl+"/rest/v1/"+path,{...init,headers:{...headers,...init.headers},
   signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw new Error("database fetch failed: "+r.status);
  return r.json();
 };
 try{
  // Lookup by delivery ID, never trust campaign fields passed in the webhook.
  const deliveries=await db("kanonha_notification_deliveries?id=eq."+
   encodeURIComponent(rec.id)+"&select=id,user_id,campaign:kanonha_notification_campaigns(title,body,kind,related_id)");
  const delivery=deliveries?.[0];
  if(!delivery?.user_id||!delivery.campaign)return json({error:"delivery_not_found"},404);
  const devices=await db("kanonha_push_devices?user_id=eq."+
   encodeURIComponent(delivery.user_id)+"&select=id,token&limit=30");
  if(!devices?.length)return json({sent:0,reason:"no_registered_devices"});
  const access=await googleAccessToken(account);
  const campaign=delivery.campaign;
  let sent=0,failed=0,pruned=0;
  for(const device of devices){
   const data:Record<string,string>={
    title:String(campaign.title||"اطلاعیه کانون‌ها").slice(0,120),
    body:String(campaign.body||"").slice(0,500),
    user_id:String(delivery.user_id),
    kind:String(campaign.kind||"general"),
    related_id:campaign.related_id?String(campaign.related_id):"",
    campaign_id:String(rec.id)
   };
   let r:Response;
   try{r=await fetch("https://fcm.googleapis.com/v1/projects/"+
     account.project_id+"/messages:send",{
     method:"POST",headers:{authorization:"Bearer "+access,"content-type":"application/json"},
     body:JSON.stringify({message:{token:device.token,data,android:{priority:"HIGH",ttl:"3600s"}}}),
     signal:AbortSignal.timeout(12000)});
   }catch{failed++;continue}
   if(r.ok){sent++;continue}
   failed++;
   const errorBody=await r.text();
   if((r.status===404||r.status===400)&&/UNREGISTERED/.test(errorBody)&&validUuid(device.id)){
    // Only prune this exact invalid token/device.
    await fetch(dbUrl+"/rest/v1/kanonha_push_devices?id=eq."+device.id+
      "&token=eq."+encodeURIComponent(device.token),{
      method:"DELETE",headers,signal:AbortSignal.timeout(8000)}).catch(()=>{});
    pruned++;
   }
  }
  // Non-2xx enables webhook monitoring; individual failures stay retriable by ops.
  return json({sent,failed,pruned},failed?502:200);
 }catch(error){
  // Do not log device tokens, authorization values, or service-account details.
  return json({error:"delivery_failed"},502);
 }
});
