package ir.kanonha.app;

import android.app.Activity;
import android.print.PrintManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.print.PrintAttributes;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.fragment.app.FragmentActivity;
import java.io.OutputStream;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/** Native export bridge for authenticated, aggregate-only survey reports.
 *  CSV uses Android's document picker; PDF uses the system Print > Save as PDF.
 *  No file-storage permissions, remote fonts, or web scripts are needed.
 */
public final class SurveyExportBridge {
 private static final int CSV_REQUEST=61241;
 private final FragmentActivity activity;
 private byte[] csvData;
 private WebView printView;
 SurveyExportBridge(FragmentActivity activity) { this.activity=activity; }

 @JavascriptInterface public void saveCsv(String fileName,String base64Utf8) {
  if(base64Utf8==null||base64Utf8.length()>2_000_000)return;
  final byte[] bytes;
  try {
   bytes=Base64.decode(base64Utf8,Base64.DEFAULT);
   if(bytes.length<8||bytes.length>1_500_000)return;
  } catch(IllegalArgumentException e){return;}
  String name=fileName==null?"Kanonha-Survey.csv":fileName;
  name=name.replaceAll("[^a-zA-Z0-9_.-]","_");
  if(!name.toLowerCase(Locale.ROOT).endsWith(".csv"))name+=".csv";
  if(name.length()>100)name=name.substring(0,96)+".csv";
  final String safeName=name;
  activity.runOnUiThread(()->{
   csvData=bytes;
   try {
    Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType("text/csv");
    intent.putExtra(Intent.EXTRA_TITLE,safeName);
    activity.startActivityForResult(intent,CSV_REQUEST);
   }catch(Exception e){
    csvData=null;
    Toast.makeText(activity,"انتخاب محل ذخیره ممکن نشد.",Toast.LENGTH_SHORT).show();
   }
  });
 }

 boolean handleResult(int requestCode,int resultCode,Intent data){
  if(requestCode!=CSV_REQUEST)return false;
  byte[] bytes=csvData;csvData=null;
  if(resultCode==Activity.RESULT_OK&&data!=null&&data.getData()!=null&&bytes!=null){
   Uri output=data.getData();
   try(OutputStream os=activity.getContentResolver().openOutputStream(output,"w")){
    if(os==null)throw new IllegalStateException("no document output");
    os.write(bytes);os.flush();
    Toast.makeText(activity,"فایل اکسل ذخیره شد.",Toast.LENGTH_SHORT).show();
   }catch(Exception e){
    Toast.makeText(activity,"ذخیره گزارش ناموفق بود.",Toast.LENGTH_SHORT).show();
   }
  }
  return true;
 }

 @JavascriptInterface public void printHtml(String html){
  printHtmlNamed("Kanonha-Survey-Report",html);
 }
 @JavascriptInterface public void printHtmlNamed(String fileName,String html){
  if(html==null||html.length()>1_500_000||!html.startsWith("<!doctype html>"))return;
  String safeName=fileName==null?"Kanonha-Document":fileName.replaceAll("[^a-zA-Z0-9_.-]","_");
  if(safeName.length()<3)safeName="Kanonha-Document";
  if(safeName.length()>96)safeName=safeName.substring(0,96);
  final String title=safeName;
  activity.runOnUiThread(()->{
   if(printView!=null){printView.destroy();printView=null;}
   WebView report=new WebView(activity);
   printView=report;
   WebSettings settings=report.getSettings();
   settings.setJavaScriptEnabled(false);
   settings.setAllowFileAccess(false);
   settings.setAllowContentAccess(false);
   settings.setBlockNetworkLoads(true);
   report.setWebViewClient(new WebViewClient(){
    @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest request){
     return new WebResourceResponse("text/plain","UTF-8",
       new ByteArrayInputStream(new byte[0]));
    }
    @Override public void onPageFinished(WebView v,String url){
     if(report!=printView)return;
     try{
      PrintManager printer=(PrintManager)activity.getSystemService(Context.PRINT_SERVICE);
      if(printer==null)throw new IllegalStateException("Print service absent");
      PrintAttributes.MediaSize mediaSize=title.startsWith("Kanonha-Certificate-")
        ?PrintAttributes.MediaSize.ISO_A4.asLandscape():PrintAttributes.MediaSize.ISO_A4;
      PrintAttributes attributes=new PrintAttributes.Builder()
        .setMediaSize(mediaSize)
        .setColorMode(PrintAttributes.COLOR_MODE_COLOR).build();
      printer.print(title,v.createPrintDocumentAdapter(title),attributes);
     }catch(Exception e){
      Toast.makeText(activity,"چاپ PDF در این گوشی در دسترس نیست.",Toast.LENGTH_SHORT).show();
     }
    }
   });
   report.loadDataWithBaseURL("about:blank",html,"text/html","UTF-8",null);
  });
 }
 void destroy(){
  csvData=null;
  if(printView!=null){printView.destroy();printView=null;}
 }
}
