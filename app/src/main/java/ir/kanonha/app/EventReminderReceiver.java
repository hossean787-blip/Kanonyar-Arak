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

/** Private, account-synced local reminders for confirmed event registrations.
 * No ticket tokens or names are persisted. Android may delay inexact alarms.
 */
public final class EventReminderReceiver extends BroadcastReceiver {
 private static final String PREFS="kanonha_event_reminders_v1";
 private static final String DATA="confirmed_events";
 private static final String ACTION="ir.kanonha.app.EVENT_REMINDER";
 private static final String CHANNEL="kanonha_event_reminders";
 private static final int MAX=120;
 public static final class Bridge {
  private final Context context;
  Bridge(Context ctx){context=ctx.getApplicationContext();}
  @JavascriptInterface public void sync(String json){
   if(json==null||json.length()>42000)return;
   try{
    JSONArray arr=new JSONArray(json);
    if(arr.length()>MAX)return;
    for(int i=0;i<arr.length();i++){
     JSONObject o=arr.getJSONObject(i);
     if(!validId(o.optString("id"))||o.optString("title").length()>120)return;
    }
   }catch(Exception e){return;}
   syncInternal(context,json);
  }
  @JavascriptInterface public void clear(){clearInternal(context);}
 }
 private static SharedPreferences prefs(Context c){return c.getSharedPreferences(PREFS,Context.MODE_PRIVATE);}
 private static JSONArray parse(String text){
  try{return new JSONArray(text==null?"[]":text);}catch(Exception e){return new JSONArray();}
 }
 private static boolean validId(String s){
  try{return UUID.fromString(s).toString().equalsIgnoreCase(s);}catch(Exception e){return false;}
 }
 private static PendingIntent intent(Context c,String id,int hours,String title,String message,int flags){
  Intent in=new Intent(c,EventReminderReceiver.class).setAction(ACTION)
    .setData(Uri.parse("kanonha://event-reminder/"+id+"/"+hours));
  in.putExtra("title",title);in.putExtra("message",message);
  int requestCode=("event:"+id+":"+hours).hashCode()&0x7fffffff;
  return PendingIntent.getBroadcast(c,requestCode,in,flags|PendingIntent.FLAG_IMMUTABLE);
 }
 private static void cancelOld(Context c,JSONArray arr){
  AlarmManager mgr=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
  if(mgr==null)return;
  for(int i=0;i<arr.length();i++){
   JSONObject o=arr.optJSONObject(i);if(o==null)continue;
   String id=o.optString("id");if(!validId(id))continue;
   for(int hours:new int[]{24,1}){
    PendingIntent pi=intent(c,id,hours,"","",PendingIntent.FLAG_NO_CREATE);
    if(pi!=null){mgr.cancel(pi);pi.cancel();}
   }
  }
 }
 private static void clearInternal(Context c){
  SharedPreferences p=prefs(c);
  cancelOld(c,parse(p.getString(DATA,"[]")));
  p.edit().clear().apply();
 }
 private static void schedule(Context c,String id,int hours,long when,String title){
  if(when<=System.currentTimeMillis())return;
  AlarmManager mgr=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
  if(mgr==null)return;
  String text=hours==24?"فردا رویداد «"+title+"» برگزار می‌شود.":
    "یک ساعت تا شروع رویداد «"+title+"» باقی مانده است.";
  PendingIntent pi=intent(c,id,hours,"یادآوری رویداد",text,PendingIntent.FLAG_UPDATE_CURRENT);
  try{
   if(Build.VERSION.SDK_INT>=23)mgr.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,pi);
   else mgr.set(AlarmManager.RTC_WAKEUP,when,pi);
  }catch(SecurityException ignored){}
 }
 private static void syncInternal(Context c,String json){
  SharedPreferences p=prefs(c);
  cancelOld(c,parse(p.getString(DATA,"[]")));
  JSONArray arr=parse(json);if(arr.length()>MAX)return;
  p.edit().putString(DATA,json).apply();
  long now=System.currentTimeMillis();
  for(int i=0;i<arr.length();i++){
   JSONObject o=arr.optJSONObject(i);if(o==null)continue;
   String id=o.optString("id"),title=o.optString("title");
   if(!validId(id)||title.length()<2||title.length()>120)continue;
   long start=o.optLong("startsAt",0);
   if(start<=now||start>now+370L*24*3600*1000)continue;
   if(start-86400000L>now)schedule(c,id,24,start-86400000L,title);
   if(start-3600000L>now)schedule(c,id,1,start-3600000L,title);
  }
 }
 private static boolean canShow(Context c){
  return Build.VERSION.SDK_INT<33||
   c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED;
 }
 private static void show(Context c,String id,String title,String message){
  if(!canShow(c))return;
  NotificationManager mgr=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
  if(mgr==null)return;
  if(Build.VERSION.SDK_INT>=26)mgr.createNotificationChannel(
   new NotificationChannel(CHANNEL,"رویدادهای ثبت‌نام‌شده",NotificationManager.IMPORTANCE_DEFAULT));
  PendingIntent open=PendingIntent.getActivity(c,0,new Intent(c,MainActivity.class),
   PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  Notification.Builder n=Build.VERSION.SDK_INT>=26?
   new Notification.Builder(c,CHANNEL):new Notification.Builder(c);
  n.setSmallIcon(android.R.drawable.ic_dialog_info)
   .setColor(Color.rgb(61,117,91)).setContentTitle(title).setContentText(message)
   .setStyle(new Notification.BigTextStyle().bigText(message))
   .setContentIntent(open).setAutoCancel(true);
  mgr.notify(("event:"+id).hashCode()&0x7fffffff,n.build());
 }
 @Override public void onReceive(Context c,Intent in){
  if(in==null)return;
  String action=in.getAction();
  if(Intent.ACTION_BOOT_COMPLETED.equals(action)||Intent.ACTION_TIME_SET.equals(action)
    ||Intent.ACTION_TIMEZONE_CHANGED.equals(action)){
   syncInternal(c,prefs(c).getString(DATA,"[]"));return;
  }
  if(!ACTION.equals(action))return;
  String title=in.getStringExtra("title"),message=in.getStringExtra("message");
  if(title==null||message==null||title.length()>90||message.length()>250)return;
  show(c,String.valueOf(in.getData()),title,message);
 }
}
