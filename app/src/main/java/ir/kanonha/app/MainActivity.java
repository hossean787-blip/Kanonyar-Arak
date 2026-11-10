package ir.kanonha.app;
import androidx.fragment.app.FragmentActivity;
import android.os.Bundle;
import android.graphics.Color;
import android.os.Build;
import android.net.Uri;
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
 private BiometricVault biometric;
 private SurveyExportBridge surveyExports;

 @Override public void onCreate(Bundle b) {
  super.onCreate(b);
  DailyCalendarReceiver.schedule(this);
  DailyCalendarReceiver.show(this);
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
  s.setAllowContentAccess(false);
  s.setAllowFileAccessFromFileURLs(false);
  s.setAllowUniversalAccessFromFileURLs(false);
  s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  biometric = new BiometricVault(this, web);
  web.addJavascriptInterface(biometric.new Bridge(), "AndroidBiometric");
  surveyExports=new SurveyExportBridge(this);
  web.addJavascriptInterface(surveyExports, "AndroidSurveyExports");
  web.addJavascriptInterface(new SurveyNoticeReceiver.Bridge(this), "AndroidSurveyNotices");
  web.setWebViewClient(new WebViewClient() {
   @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
    return loader.shouldInterceptRequest(r.getUrl());
   }
   @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
    Uri u = r.getUrl();
    return !"appassets.androidplatform.net".equals(u.getHost());
   }
  });
  web.loadUrl("https://appassets.androidplatform.net/assets/index.html?native=1");
 }

 @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
  super.onRequestPermissionsResult(requestCode, permissions, grantResults);
  if (requestCode==103 && grantResults.length>0 &&
      grantResults[0]==android.content.pm.PackageManager.PERMISSION_GRANTED) {
   DailyCalendarReceiver.show(this);
  }
 }
 @Override protected void onActivityResult(int requestCode,int resultCode,android.content.Intent data){
  super.onActivityResult(requestCode,resultCode,data);
  if(surveyExports!=null)surveyExports.handleResult(requestCode,resultCode,data);
 }
 @Override public void onBackPressed() {
  if (web == null) { super.onBackPressed(); return; }
  web.evaluateJavascript("window.KanonhaPreview ? window.KanonhaPreview.handleBack() : false", value -> {
   if (!"true".equals(value)) MainActivity.super.onBackPressed();
  });
 }
 @Override protected void onDestroy() {
  if (biometric != null) { biometric.destroy(); biometric = null; }
  if (surveyExports != null) { surveyExports.destroy(); surveyExports = null; }
  if (web != null) { web.destroy(); web = null; }
  super.onDestroy();
 }
}
