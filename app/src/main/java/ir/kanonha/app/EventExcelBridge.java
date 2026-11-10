package ir.kanonha.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.fragment.app.FragmentActivity;
import org.json.JSONArray;
import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/** Offline .xlsx writer: exports UTF-8 event rosters as text-only Excel cells.
 * No dependency, formula execution, external transfer or storage permission.
 */
public final class EventExcelBridge {
 private static final int EXCEL_REQUEST=61263;
 private final FragmentActivity activity;
 private final WebView web;
 private byte[] pendingWorkbook;
 EventExcelBridge(FragmentActivity activity, WebView web){
  this.activity=activity;this.web=web;
 }
 private boolean trusted(){
  Uri uri=Uri.parse(web.getUrl()==null?"":web.getUrl());
  return "https".equals(uri.getScheme()) &&
   "appassets.androidplatform.net".equals(uri.getHost()) &&
   "/assets/index.html".equals(uri.getPath());
 }
 private static String xml(String text){
  return text.replace("&","&amp;").replace("<","&lt;")
    .replace(">","&gt;").replace("\"","&quot;").replace("'","&apos;");
 }
 private static String column(int index){
  StringBuilder s=new StringBuilder();int i=index+1;
  while(i>0){i--;s.insert(0,(char)('A'+(i%26)));i/=26;}
  return s.toString();
 }
 private static void entry(ZipOutputStream zip,String path,String content) throws Exception{
  zip.putNextEntry(new ZipEntry(path));
  zip.write(content.getBytes(StandardCharsets.UTF_8));
  zip.closeEntry();
 }
 private static byte[] workbook(JSONArray rows) throws Exception{
  if(rows.length()<1||rows.length()>10015)
   throw new IllegalArgumentException("Invalid row count");
  StringBuilder sheet=new StringBuilder(1024+rows.length()*190);
  sheet.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>")
   .append("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>");
  for(int r=0;r<rows.length();r++){
   JSONArray cells=rows.optJSONArray(r);
   if(cells==null||cells.length()>12)throw new IllegalArgumentException("Invalid row");
   sheet.append("<row r=\"").append(r+1).append("\">");
   for(int c=0;c<cells.length();c++){
    String raw=cells.isNull(c)?"":cells.optString(c,"");
    if(raw.length()>2000)raw=raw.substring(0,2000);
    sheet.append("<c r=\"").append(column(c)).append(r+1)
      .append("\" t=\"inlineStr\"><is><t xml:space=\"preserve\">")
      .append(xml(raw)).append("</t></is></c>");
   }
   sheet.append("</row>");
  }
  sheet.append("</sheetData></worksheet>");
  ByteArrayOutputStream bytes=new ByteArrayOutputStream();
  try(ZipOutputStream zip=new ZipOutputStream(bytes)){
   entry(zip,"[Content_Types].xml","<?xml version=\"1.0\" encoding=\"UTF-8\"?>"+
    "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">"+
    "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>"+
    "<Default Extension=\"xml\" ContentType=\"application/xml\"/>"+
    "<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>"+
    "<Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>"+
    "</Types>");
   entry(zip,"_rels/.rels","<?xml version=\"1.0\" encoding=\"UTF-8\"?>"+
    "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"+
    "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>"+
    "</Relationships>");
   entry(zip,"xl/workbook.xml","<?xml version=\"1.0\" encoding=\"UTF-8\"?>"+
    "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" "+
    "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">"+
    "<sheets><sheet name=\"رویداد\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>");
   entry(zip,"xl/_rels/workbook.xml.rels","<?xml version=\"1.0\" encoding=\"UTF-8\"?>"+
    "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"+
    "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/>"+
    "</Relationships>");
   entry(zip,"xl/worksheets/sheet1.xml",sheet.toString());
  }
  return bytes.toByteArray();
 }
 @JavascriptInterface public void saveExcel(String fileName,String jsonRows){
  if(!trusted()||jsonRows==null||jsonRows.length()>2000000)return;
  try{
   final byte[] workbook=workbook(new JSONArray(jsonRows));
   if(workbook.length>2500000)return;
   String name=fileName==null?"kanonha-event.xlsx":fileName.replaceAll("[^a-zA-Z0-9_.-]","_");
   if(!name.toLowerCase(Locale.ROOT).endsWith(".xlsx"))name+=".xlsx";
   if(name.length()>100)name=name.substring(0,95)+".xlsx";
   final String safeName=name;
   activity.runOnUiThread(()->{
    pendingWorkbook=workbook;
    try{
     Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
     intent.addCategory(Intent.CATEGORY_OPENABLE);
     intent.setType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
     intent.putExtra(Intent.EXTRA_TITLE,safeName);
     activity.startActivityForResult(intent,EXCEL_REQUEST);
    }catch(Exception e){pendingWorkbook=null;
     Toast.makeText(activity,"ذخیره اکسل ممکن نیست.",Toast.LENGTH_SHORT).show();
    }
   });
  }catch(Exception e){
   activity.runOnUiThread(()->Toast.makeText(activity,"ساخت فایل اکسل ناموفق بود.",Toast.LENGTH_SHORT).show());
  }
 }
 boolean handleResult(int requestCode,int resultCode,Intent data){
  if(requestCode!=EXCEL_REQUEST)return false;
  byte[] bytes=pendingWorkbook;pendingWorkbook=null;
  if(resultCode==Activity.RESULT_OK&&data!=null&&data.getData()!=null&&bytes!=null){
   try(OutputStream out=activity.getContentResolver().openOutputStream(data.getData(),"w")){
    if(out==null)throw new IllegalStateException("output unavailable");
    out.write(bytes);out.flush();
    Toast.makeText(activity,"فایل اکسل ذخیره شد.",Toast.LENGTH_SHORT).show();
   }catch(Exception e){Toast.makeText(activity,"ذخیره اکسل ناموفق بود.",Toast.LENGTH_SHORT).show();}
  }
  return true;
 }
 void destroy(){pendingWorkbook=null;}
}