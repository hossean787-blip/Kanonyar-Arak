package ir.kanonha.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.webkit.JavascriptInterface;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;

/** Locally scheduled survey alerts; no cloud keys or student votes are stored.
 * Android may delay an inexact alarm during battery-saving modes.
 * Result-approval alerts are delivered at the next authenticated sync.
 */
public final class SurveyNoticeReceiver extends BroadcastReceiver {
 private static final String PREFS="kanonha_survey_reminders";
 private static final String DATA="eligible_survey_schedule";
 private static final String CHANNEL="kanonha_survey_alerts_v1";
 private static final String ACTION="ir.kanonha.app.SURVEY_EVENT";
 private static final int MAX=120;
 public static final class Bridge {
  private final Context context;
  Bridge(Context context){this.context=context.getApplicationContext();}
  @JavascriptInterface public void sync(String data){
   if(data==null||data.length()>80000)return;
   try { JSONArray arr=new JSONArray(data);if(arr.length()>MAX)return; }
   catch(Exception e){return;}
   syncInternal(context,data,true);
  }
  @JavascriptInterface public void clear(){clearAll(context);}
 }
 private static SharedPreferences prefs(Context c){
  return c.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
 }
 private static JSONArray parse(String data){
  try {return new JSONArray(data==null?"[]":data);}catch(Exception e){return new JSONArray();}
 }
 private static PendingIntent intent(Context c,String id,String phase,String title,String message,int flags){
  Intent in=new Intent(c,SurveyNoticeReceiver.class).setAction(ACTION)
    .setData(Uri.parse("kanonha://notice/"+id+"/"+phase));
  in.putExtra("title",title);in.putExtra("message",message);
  int code=(id+":"+phase).hashCode()&0x7fffffff;
  return PendingIntent.getBroadcast(c,code,in,flags|PendingIntent.FLAG_IMMUTABLE);
 }
 private static boolean validId(String id){
  try{return UUID.fromString(id).toString().equalsIgnoreCase(id);}catch(Exception e){return false;}
 }
 private static void cancelPending(Context c,JSONArray old){
  AlarmManager mgr=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
  if(mgr==null)return;
  for(int i=0;i<old.length();i++){
   JSONObject s=old.optJSONObject(i);if(s==null)continue;
   String id=s.optString("id");if(!validId(id))continue;
   for(String phase:new String[]{"start","deadline"}){
    PendingIntent pi=intent(c,id,phase,"","",PendingIntent.FLAG_NO_CREATE);
    if(pi!=null){mgr.cancel(pi);pi.cancel();}
   }
  }
 }
 private static void clearAll(Context c){
  SharedPreferences p=prefs(c);
  cancelPending(c,parse(p.getString(DATA,"[]")));
  p.edit().clear().apply();
 }
 private static void scheduleAlarm(Context c,String id,String phase,long time,String msg){
  if(time<=System.currentTimeMillis())return;
  AlarmManager mgr=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
  if(mgr==null)return;
  PendingIntent pi=intent(c,id,phase,"نظرسنجی کانون‌ها",msg,PendingIntent.FLAG_UPDATE_CURRENT);
  try{
   if(Build.VERSION.SDK_INT>=23)mgr.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,time,pi);
   else mgr.set(AlarmManager.RTC_WAKEUP,time,pi);
  }catch(SecurityException ignored){}
 }
 private static boolean canShow(Context c){
  return Build.VERSION.SDK_INT<33||
   c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED;
 }
 private static void showNotice(Context c,String id,String title,String message){
  if(!canShow(c))return;
  NotificationManager manager=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
  if(manager==null)return;
  if(Build.VERSION.SDK_INT>=26)manager.createNotificationChannel(
   new NotificationChannel(CHANNEL,"یادآوری نظرسنجی‌ها",NotificationManager.IMPORTANCE_DEFAULT));
  PendingIntent open=PendingIntent.getActivity(c,0,new Intent(c,MainActivity.class),
   PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  Notification.Builder builder=Build.VERSION.SDK_INT>=26
   ?new Notification.Builder(c,CHANNEL):new Notification.Builder(c);
  builder.setSmallIcon(android.R.drawable.ic_dialog_info)
   .setColor(Color.rgb(78,90,174))
   .setContentTitle(title).setContentText(message)
   .setStyle(new Notification.BigTextStyle().bigText(message))
   .setContentIntent(open).setAutoCancel(true).setOnlyAlertOnce(true);
  manager.notify((id+":"+title).hashCode()&0x7fffffff,builder.build());
 }
 private static void syncInternal(Context c,String data,boolean announceResults){
  SharedPreferences p=prefs(c);
  JSONArray prev=parse(p.getString(DATA,"[]"));
  JSONArray incoming=parse(data);
  if(incoming.length()>MAX)return;
  cancelPending(c,prev);
  p.edit().putString(DATA,data).apply();
  long now=System.currentTimeMillis();
  for(int i=0;i<incoming.length();i++){
   JSONObject s=incoming.optJSONObject(i);if(s==null)continue;
   String id=s.optString("id"),title=s.optString("title");
   if(!validId(id)||title.length()>120||title.length()<4)continue;
   long start=s.optLong("startsAt",0),end=s.optLong("endsAt",0);
   if(start<1||end<=start)continue;
   String status=s.optString("status");
   String shortTitle=title.length()>60?title.substring(0,60)+"…":title;
   if("published".equals(status)){
    if(start>now)scheduleAlarm(c,id,"start",start,"نظرسنجی «"+shortTitle+"» آغاز شد.");
    long reminder=end-24*60*60*1000L;
    if(reminder<=now&&end>now)reminder=now+30*1000L;
    if(reminder>now&&end>now)scheduleAlarm(c,id,"deadline",reminder,
      "کمتر از یک روز تا پایان نظرسنجی «"+shortTitle+"» باقی مانده است.");
   }
   if(announceResults&&"competition".equals(s.optString("kind"))&&
      s.optBoolean("approved",false)&&end<=now &&
      !"cancelled".equals(status)&&!p.getBoolean("released."+id,false)&&canShow(c)){
    showNotice(c,id,"نتایج مسابقه منتشر شد","نتایج نظرسنجی «"+shortTitle+"» آماده مشاهده است.");
    p.edit().putBoolean("released."+id,true).apply();
   }
  }
 }
 @Override public void onReceive(Context c,Intent in){
  if(in==null)return;
  if(Intent.ACTION_BOOT_COMPLETED.equals(in.getAction())){
   syncInternal(c,prefs(c).getString(DATA,"[]"),false);return;
  }
  if(!ACTION.equals(in.getAction()))return;
  String title=in.getStringExtra("title"),message=in.getStringExtra("message");
  if(title==null||message==null||title.length()>100||message.length()>220)return;
  showNotice(c,String.valueOf(in.getData()),title,message);
 }
}
