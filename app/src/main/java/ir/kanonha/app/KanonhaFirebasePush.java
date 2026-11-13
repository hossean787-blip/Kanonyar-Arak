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

/** Firebase Messaging setup for the registered release identity only.
 * Service-account private keys are server-only. No FCM token before sign-in.
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
    // The registered Firebase Android App belongs only to the production
    // package. The .test package has not been registered in Firebase.
    if(BuildConfig.DEBUG || !"ir.kanonha.app".equals(context.getPackageName()))return;
    try{
      // Google Services generates the Android resources from the release-only
      // google-services.json. Do not hand-copy credentials into BuildConfig.
      FirebaseApp app=FirebaseApp.getApps(context).isEmpty()
        ? FirebaseApp.initializeApp(context) : FirebaseApp.getInstance();
      if(app==null)return;
      FirebaseOptions options=app.getOptions();
      if(!"kanonha-86f00".equals(options.getProjectId()) ||
         !"1:172921153592:android:ffd6bec6daf6f9f5a7decd".equals(options.getApplicationId()) ||
         !"172921153592".equals(options.getGcmSenderId()))return;
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
