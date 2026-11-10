package ir.kanonha.app;
import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.graphics.drawable.Icon;
import android.icu.util.PersianCalendar;
import java.util.Calendar;
public final class DailyCalendarReceiver extends BroadcastReceiver {
 private static final String ACTION="ir.kanonha.app.DAILY_DATE";
 private static final int ID=1405;
 private static final String[] MONTHS={"فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"};
 private static String fa(int number){String s=Integer.toString(number),o="";for(char c:s.toCharArray())o+=(char)('۰'+c-'0');return o;}
 public static String today(){PersianCalendar c=new PersianCalendar();return fa(c.get(PersianCalendar.DAY_OF_MONTH))+" "+MONTHS[c.get(PersianCalendar.MONTH)]+" "+fa(c.get(PersianCalendar.YEAR));}
 public static void schedule(Context context){
  AlarmManager mgr=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
  if(mgr==null)return;
  Intent intent=new Intent(context,DailyCalendarReceiver.class).setAction(ACTION);
  PendingIntent pi=PendingIntent.getBroadcast(context,ID,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  Calendar next=Calendar.getInstance();
  next.set(Calendar.HOUR_OF_DAY,0);next.set(Calendar.MINUTE,0);next.set(Calendar.SECOND,0);next.set(Calendar.MILLISECOND,0);
  if(next.getTimeInMillis()<=System.currentTimeMillis())next.add(Calendar.DAY_OF_YEAR,1);
  mgr.set(AlarmManager.RTC_WAKEUP,next.getTimeInMillis(),pi);
 }
 @Override public void onReceive(Context context,Intent intent){
  if(intent==null)return;
  String action=intent.getAction();
  if(Intent.ACTION_BOOT_COMPLETED.equals(action)||Intent.ACTION_TIME_CHANGED.equals(action)||Intent.ACTION_TIMEZONE_CHANGED.equals(action)){schedule(context);show(context);return;}
  if(!ACTION.equals(action))return;
  schedule(context);
  show(context);
 }
 private static Icon dateIcon(){
  PersianCalendar calendar=new PersianCalendar();
  String text=fa(calendar.get(PersianCalendar.DAY_OF_MONTH));
  Bitmap bitmap=Bitmap.createBitmap(96,96,Bitmap.Config.ARGB_8888);
  Canvas canvas=new Canvas(bitmap);
  Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
  paint.setColor(Color.WHITE);paint.setTypeface(Typeface.create(Typeface.DEFAULT,Typeface.BOLD));
  paint.setTextAlign(Paint.Align.CENTER);paint.setTextSize(57f);
  Paint.FontMetrics fm=paint.getFontMetrics();
  canvas.drawText(text,48f,48f-(fm.ascent+fm.descent)/2f,paint);
  return Icon.createWithBitmap(bitmap);
 }
 public static void show(Context context){
  if(Build.VERSION.SDK_INT>=33&&context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;
  NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
  if(manager==null)return;
  if(Build.VERSION.SDK_INT>=26)manager.createNotificationChannel(new NotificationChannel("calendar_persistent_v2","تاریخ شمسی همیشگی",NotificationManager.IMPORTANCE_LOW));
  PendingIntent open=PendingIntent.getActivity(context,0,new Intent(context,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(context,"calendar_persistent_v2"):new Notification.Builder(context);
  manager.notify(ID,b.setSmallIcon(dateIcon()).setContentTitle("تقویم دانشجویی").setContentText(today()).setOngoing(true).setOnlyAlertOnce(true).setShowWhen(false).setContentIntent(open).build());
 }
}
