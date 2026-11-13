package ir.kanonha.app;
import androidx.fragment.app.FragmentActivity;
import android.os.Bundle;
import android.graphics.Color;
import android.os.Build;
import android.net.Uri;
import android.content.Intent;
import android.database.Cursor;
import android.provider.OpenableColumns;
import android.webkit.WebChromeClient;
import android.webkit.ValueCallback;
import android.widget.Toast;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;

public final class MainActivity extends FragmentActivity {
 private WebView web;
 private static final int CLUB_LOGO_PICK_REQUEST=61420;
 private ValueCallback<Uri[]> pendingLogoFiles;
 private boolean pendingPngOnly;
 private android.webkit.PermissionRequest pendingCameraPermission;
 private BiometricVault biometric;
 private SurveyExportBridge surveyExports;
 private EventExcelBridge eventExcel;

 @Override public void onCreate(Bundle b) {
  super.onCreate(b);
  DailyCalendarReceiver.schedule(this);
  DailyCalendarReceiver.show(this);\n  KanonhaFirebasePush.initialize(this);
  if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
   requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 103);
  }

  // Android 15/16 enforce edge-to-edge for target SDK 35+.
  // Keep the web content between the real status/navigation bars on all API levels.
  WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
  getWindow().setStatusBarColor(Color.TRANSPARENT);
  getWindow().setNavigationBarColor(Color.TRANSPARENT);
  if (Build.VERSION.SDK_INT >= 29) getWindow().setNavigationBarContrastEnforced(false);

  FrameLayout root = new FrameLayout(this);
  root.setBackgroundColor(Color.WHITE);
  web = new WebView(this);
  web.setBackgroundColor(Color.WHITE);
  root.addView(web, new FrameLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

  ViewCompat.setOnApplyWindowInsetsListener(root, (view, windowInsets) -> {
   // Apply physical system-bar and cutout insets to the native container,
   // never to individual web screens; this fixes all five tabs consistently.
   Insets safe = windowInsets.getInsets(
       WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
   Insets keyboard = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
   view.setPadding(safe.left, safe.top, safe.right, Math.max(safe.bottom, keyboard.bottom));
   return windowInsets;
  });

  setContentView(root);
  WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), root);
  controller.setAppearanceLightStatusBars(true);
  controller.setAppearanceLightNavigationBars(true);
  ViewCompat.requestApplyInsets(root);

  WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
      .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
  WebSettings s = web.getSettings();
  s.setJavaScriptEnabled(true);
  s.setDomStorageEnabled(true);
  s.setAllowFileAccess(false);
  // Required only for user-approved SAF content:// images; file:// remains disabled.
  s.setAllowContentAccess(true);
  s.setAllowFileAccessFromFileURLs(false);
  s.setAllowUniversalAccessFromFileURLs(false);
  s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  biometric = new BiometricVault(this, web);
  web.addJavascriptInterface(biometric.new Bridge(), "AndroidBiometric");
  surveyExports=new SurveyExportBridge(this);
  web.addJavascriptInterface(surveyExports, "AndroidSurveyExports");
  eventExcel=new EventExcelBridge(this,web);
  web.addJavascriptInterface(eventExcel,"AndroidEventExcel");
  web.addJavascriptInterface(new SurveyNoticeReceiver.Bridge(this), "AndroidSurveyNotices");
  web.addJavascriptInterface(new EventReminderReceiver.Bridge(this), "AndroidEventReminders");\n  web.addJavascriptInterface(new KanonhaFirebasePush.Bridge(this,web), "AndroidPush");
  web.setWebViewClient(new WebViewClient() {
   @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
    return loader.shouldInterceptRequest(r.getUrl());
   }
   @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
    Uri u = r.getUrl();
    return !"appassets.androidplatform.net".equals(u.getHost());
   }
  });
  web.setWebChromeClient(new WebChromeClient(){
   @Override public void onPermissionRequest(android.webkit.PermissionRequest request){
    Uri origin=request.getOrigin();
    String[] resources=request.getResources();
    if(origin==null||!"https".equals(origin.getScheme())||
      !"appassets.androidplatform.net".equals(origin.getHost())||
      resources==null||resources.length!=1||
      !android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resources[0])){
     request.deny();return;
    }
    if(Build.VERSION.SDK_INT>=23&&checkSelfPermission(android.Manifest.permission.CAMERA)!=
       android.content.pm.PackageManager.PERMISSION_GRANTED){
     if(pendingCameraPermission!=null)pendingCameraPermission.deny();
     pendingCameraPermission=request;
     requestPermissions(new String[]{android.Manifest.permission.CAMERA},104);
    }else request.grant(new String[]{android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE});
   }
   @Override public void onPermissionRequestCanceled(android.webkit.PermissionRequest request){
    if(pendingCameraPermission==request)pendingCameraPermission=null;
   }
   @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
    // Only one user-selected logo/poster image; no generic file access.
    if(pendingLogoFiles!=null)finishLogoPicker(null);
    pendingLogoFiles=callback;
    if(params!=null&&params.getMode()!=FileChooserParams.MODE_OPEN){
     finishLogoPicker(null);return true;
    }
    Intent pick=new Intent(Intent.ACTION_OPEN_DOCUMENT);
    pick.addCategory(Intent.CATEGORY_OPENABLE);
    String[] accepted=params==null?null:params.getAcceptTypes();
    pendingPngOnly=accepted!=null&&accepted.length==1&&"image/png".equalsIgnoreCase(accepted[0].trim());
    pick.setType(pendingPngOnly?"image/png":"image/*");
    if(!pendingPngOnly)
     pick.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"image/png","image/jpeg","image/webp"});
    pick.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    try{startActivityForResult(pick,CLUB_LOGO_PICK_REQUEST);}
    catch(RuntimeException e){
     finishLogoPicker(null);
     Toast.makeText(MainActivity.this,"انتخاب تصویر در این دستگاه ممکن نیست.",Toast.LENGTH_SHORT).show();
    }
    return true;
   }
  });
  web.loadUrl("https://appassets.androidplatform.net/assets/index.html?native=1");
 }

 @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
  super.onRequestPermissionsResult(requestCode, permissions, grantResults);
  if(requestCode==104){
    android.webkit.PermissionRequest request=pendingCameraPermission;
    pendingCameraPermission=null;
    if(request!=null){
     if(grantResults.length>0&&grantResults[0]==android.content.pm.PackageManager.PERMISSION_GRANTED)
      request.grant(new String[]{android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE});
     else request.deny();
    }
   }
   if (requestCode==103 && grantResults.length>0 &&
      grantResults[0]==android.content.pm.PackageManager.PERMISSION_GRANTED) {
   DailyCalendarReceiver.show(this);
  }
 }
 @Override protected void onActivityResult(int requestCode,int resultCode,android.content.Intent data){
  super.onActivityResult(requestCode,resultCode,data);
  if(requestCode==CLUB_LOGO_PICK_REQUEST){
   Uri uri=resultCode==android.app.Activity.RESULT_OK&&data!=null?data.getData():null;
   finishLogoPicker(validLogoUri(uri,pendingPngOnly)?uri:null);
   return;
  }
  if(eventExcel!=null&&eventExcel.handleResult(requestCode,resultCode,data))return;
  if(surveyExports!=null)surveyExports.handleResult(requestCode,resultCode,data);
 }
 private void finishLogoPicker(Uri uri){
  ValueCallback<Uri[]> callback=pendingLogoFiles;
  pendingLogoFiles=null;
  pendingPngOnly=false;
  if(callback!=null)callback.onReceiveValue(uri==null?null:new Uri[]{uri});
 }
 private boolean validLogoUri(Uri uri,boolean pngOnly){
  if(uri==null||!"content".equals(uri.getScheme()))return false;
  try{
   String mime=getContentResolver().getType(uri);
   if(pngOnly&&!"image/png".equals(mime))return false;
   if(!pngOnly&&!"image/png".equals(mime)&&!"image/jpeg".equals(mime)&&!"image/webp".equals(mime))
    return false;
   try(Cursor cursor=getContentResolver().query(uri,new String[]{OpenableColumns.SIZE},null,null,null)){
    if(cursor!=null&&cursor.moveToFirst()){
     int index=cursor.getColumnIndex(OpenableColumns.SIZE);
     if(index>=0&&!cursor.isNull(index)){
      long size=cursor.getLong(index);
      if(size<1||size>2_097_152L)return false;
     }
    }
   }
   return true;
  }catch(RuntimeException e){return false;}
 }

 @Override public void onBackPressed() {
  if (web == null) { super.onBackPressed(); return; }
  web.evaluateJavascript("window.KanonhaPreview ? window.KanonhaPreview.handleBack() : false", value -> {
   if (!"true".equals(value)) MainActivity.super.onBackPressed();
  });
 }
 @Override protected void onDestroy() {
  finishLogoPicker(null);
  if(pendingCameraPermission!=null){pendingCameraPermission.deny();pendingCameraPermission=null;}
  if (biometric != null) { biometric.destroy(); biometric = null; }
  if (surveyExports != null) { surveyExports.destroy(); surveyExports = null; }
  if (eventExcel != null) { eventExcel.destroy(); eventExcel = null; }
  if (web != null) { web.destroy(); web = null; }
  super.onDestroy();
 }
}
