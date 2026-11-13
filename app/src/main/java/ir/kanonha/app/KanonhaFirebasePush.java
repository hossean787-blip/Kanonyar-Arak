package ir.kanonha.app;

import android.content.Context;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import org.json.JSONObject;
import java.util.UUID;
import java.util.regex.Pattern;

/** Optional Firebase setup; disabled until public Firebase Android configuration is provided.
 * Never store a service-account secret, account session, or Firebase private key in the APK.
 */
public final class KanonhaFirebasePush {
  static final String PREFS="kanonha_fcm_v1";
  static final String OWNER="owner_id";
  private static final String DEVICE="device_id";
  private static final Pattern ID=Pattern.compile("^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$");
  private static volatile boolean ready=false;

  private KanonhaFirebasePush(){}

  public static synchronized void initialize(Context context){
    if(ready)return;
    String project=BuildConfig.FCM_PROJECT_ID;
    String appId=BuildConfig.FCM_APP_ID;
    String apiKey=BuildConfig.FCM_API_KEY;
    String sender=BuildConfig.FCM_SENDER_ID;
    if(project.isEmpty()||appId.isEmpty()||apiKey.isEmpty()||sender.isEmpty())return;
    try{
      if(FirebaseApp.getApps(context).isEmpty()){
        FirebaseOptions options=new FirebaseOptions.Builder()
          .setProjectId(project).setApplicationId(appId)
          .setApiKey(apiKey).setGcmSenderId(sender).build();
        FirebaseApp.initializeApp(context,options);
      }
      FirebaseMessaging.getInstance().setAutoInitEnabled(false);
      ready=true;
    }catch(RuntimeException ignored){ready=false;}
  }

  public static final class Bridge {
    private final Context context;
    private final WebView web;
    public Bridge(Context c,WebView v){context=c.getApplicationContext();web=v;}
    @JavascriptInterface public boolean supported(){return ready;}
    @JavascriptInterface public String deviceId(){
      if(!ready)return "";
      String id=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).getString(DEVICE,"");
      if(ID.matcher(id).matches())return id;
      id=UUID.randomUUID().toString();
      context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putString(DEVICE,id).apply();
      return id;
    }
    @JavascriptInterface public void requestToken(String userId){
      if(!ready||userId==null||!ID.matcher(userId).matches())return;
      FirebaseMessaging.getInstance().setAutoInitEnabled(true);
      FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task->{
        if(!task.isSuccessful()||task.getResult()==null)return;
        String token=task.getResult();
        if(token.length()<20||token.length()>4096)return;
        String device=deviceId();
        String js="window.KanonhaPush&&window.KanonhaPush.nativeToken("+
          JSONObject.quote(userId)+","+JSONObject.quote(device)+","+
          JSONObject.quote(token)+")";
        web.post(()->{
          if(web.getUrl()!=null && web.getUrl().startsWith(
             "https://appassets.androidplatform.net/assets/"))web.evaluateJavascript(js,null);
        });
      });
    }
    @JavascriptInterface public void confirmOwner(String id){
      if(!ready||id==null||!ID.matcher(id).matches())return;
      context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putString(OWNER,id).apply();
    }
    @JavascriptInterface public void revoke(){
      context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().remove(OWNER).apply();
      if(ready){
        FirebaseMessaging.getInstance().setAutoInitEnabled(false);
        FirebaseMessaging.getInstance().deleteToken();
      }
    }
  }
}
