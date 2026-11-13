/* FCM bridge: token is registered only after a real authenticated Supabase session.
 * On logout revoke server registration and clear the local notification owner.
 * Without Firebase public config the native bridge reports supported=false.
 */
(() => {
 'use strict';
 const api=window.KanonhaBackend;
 const native=window.AndroidPush;
 const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
 let sequence=0;
 function supported(){try{return Boolean(api?.enabled&&native?.supported?.())}catch(_){return false}}
 function sync(){
  if(!supported())return false;
  const uid=api.currentUser?.id;
  if(!uuid(uid))return false;
  try{native.requestToken(uid);return true}catch(_){return false}
 }
 async function nativeToken(uid,deviceId,token){
  const run=++sequence;
  if(!supported()||!uuid(uid)||!uuid(deviceId)||typeof token!=='string'||
    token.length<20||token.length>4096||api.currentUser?.id!==uid)return false;
  try{
   await api.pushRegister(deviceId,token);
   if(run!==sequence||api.currentUser?.id!==uid)return false;
   native.confirmOwner(uid);
   return true;
  }catch(_){return false}
 }
 async function clear(){
  ++sequence;
  if(!supported())return;
  const uid=api.currentUser?.id;
  try{
   const deviceId=native.deviceId();
   if(uuid(uid)&&uuid(deviceId))await api.pushUnregister(deviceId);
  }catch(_){/* Fail closed on this device even during network failure. */}
  finally{try{native.revoke()}catch(_){}}
 }
 window.KanonhaPush=Object.freeze({supported,sync,nativeToken,clear});
})();
