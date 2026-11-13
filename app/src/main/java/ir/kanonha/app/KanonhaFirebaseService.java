package ir.kanonha.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/** FCM data-only notifications. Never show messages for a signed-out or different user. */
public final class KanonhaFirebaseService extends FirebaseMessagingService {
  private static final String CHANNEL="kanonha-remote";
  @Override public void onMessageReceived(RemoteMessage remote) {
    Map<String,String> data=remote.getData();
    if(data==null)return;
    String incoming=data.get("user_id");
    String owner=getSharedPreferences(KanonhaFirebasePush.PREFS,MODE_PRIVATE)
      .getString(KanonhaFirebasePush.OWNER,"");
    if(owner.isEmpty()||!owner.equals(incoming))return;
    if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
      !=PackageManager.PERMISSION_GRANTED)return;
    String title=limited(data.get("title"),"اطلاعیه کانون‌ها",120);
    String body=limited(data.get("body"),"یک اعلان جدید دریافت کردید.",500);
    NotificationManager manager=(NotificationManager)getSystemService(Context.NOTIFICATION_SERVICE);
    if(manager==null)return;
    manager.createNotificationChannel(new NotificationChannel(CHANNEL,
      "اعلان‌های کانون‌ها",NotificationManager.IMPORTANCE_DEFAULT));
    Intent open=new Intent(this,MainActivity.class);
    open.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
    PendingIntent pending=PendingIntent.getActivity(this,0,open,
      PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
    Notification note=new Notification.Builder(this,CHANNEL)
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentTitle(title).setContentText(body)
      .setStyle(new Notification.BigTextStyle().bigText(body))
      .setAutoCancel(true).setContentIntent(pending).build();
    int code=("fcm:"+String.valueOf(data.get("campaign_id"))).hashCode()&0x7fffffff;
    manager.notify(code,note);
  }
  @Override public void onNewToken(String token) {
    // The next authenticated app launch registers the new token using RLS.
    // No backend request is made here because this process may have no user session.
  }
  private static String limited(String text,String fallback,int max){
    if(text==null||text.isBlank())return fallback;
    return text.length()<=max?text:text.substring(0,max);
  }
}
