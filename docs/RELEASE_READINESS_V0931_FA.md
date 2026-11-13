# کانون‌ها — وضعیت پذیرش نسخه ۰.۹.۳۱

تاریخ: ۲۰۲۶-۱۱-۱۳ | مخزن مستقل `hossean787-blip/Kanonyar-Arak` | شاخه `main`

## دامنه و سیاست انتشار
- شناسه بسته: `ir.kanonha.app`؛ `versionCode=44`؛ امضا با گواهی اصلی نسخه‌های قبلی.
- این نسخه «آزمایشی / زیرساخت اعلان پوش آماده‌سازی‌شده» است، **نه نسخه تجاری**.
- هیچ اطلاعات یا دارایی از اپ‌های دیگر وارد این پروژه نشده است.
- APK امضاشده در بخش Artifacts فرایند GitHub Actions `signed-upgrade.yml` قرار می‌گیرد. موفقیت ساخت به‌معنای نصب موفق روی گوشی نیست.

## موارد انجام‌شده و شواهد
۱. **دیتابیس FCM:** migration `kanonha_push_fcm_v0931` در پروژه اختصاصی `cnqcysnjinghzzrzanpj` اعمال شده؛ جدول `kanonha_push_devices` دارای RLS و ۴ سیاست دسترسی بر پایه `auth.uid()` و بدون حق SELECT برای `anon` است. آزمون واقعی سه شناسه موقت، جداسازی SELECT/UPDATE/DELETE و رد ثبت دستگاه به نام حساب دیگر را تأیید کرد. آزمون در تراکنش `ROLLBACK` بود و پس از آن ۱ حساب حقیقی و ۰ دستگاه پوش باقی ماند.
۲. **فرستنده سرور:** Edge Function `kanonha-fcm-delivery` با `verify_jwt=true` مستقر و وضعیت `ACTIVE` است. فرستنده payload اعلان را از پایگاه داده مجدداً می‌خواند، bearer سمت سرور را می‌سنجد، و فقط با وجود Firebase secret پیام می‌فرستد. **هنوز هیچ تحویل پوش واقعی اثبات نشده**.
۳. **اندروید:** Firebase Messaging در نسخه ۰.۹.۳۱ اضافه شده است؛ تنظیمات عمومی Firebase از متغیرهای مخصوص ساخت وارد می‌شوند و کلید خصوصی داخل APK وجود ندارد. توکن دستگاه در جلسهٔ کاربر واردشده ثبت و هنگام خروج از فهرست سرور حذف می‌شود. نمایش اعلان برای حساب دیگری در همین دستگاه مسدود است.
۴. **آزمون‌های منبع:** `tests/push-fcm-smoke.cjs` قرارداد RLS، webhook، Android service و عدم وجود credential خصوصی را بررسی می‌کند. مسیرهای قبلی عضویت، نظرسنجی، رویداد، گواهی و بیومتریک نیز باید در CI موفق باشند.
۵. **کنترل سلامت:** Supabase health advisor بدون یافته؛ Security Advisor دارای دو خانواده هشدار است (۱۱ مورد SECURITY DEFINER قابل‌فراخوانی برای authenticated و محافظت گذرواژه‌های افشاشده خاموش). SECURITY DEFINERها مستلزم بازبینی موردی هستند؛ در دو تابع اصلی check-in/issue-certificate کنترل کاربر، نقش و مالکیت بررسی شد، اما اعلام «امنیت کامل» مجاز نیست.

## الزامات عملیاتی باقی‌مانده
- Firebase Project اختصاصی برنامه، Android App با package `ir.kanonha.app` و فعال‌کردن Firebase Cloud Messaging؛ بدون Firebase واقعی، `AndroidPush.supported()` مقدار false می‌دهد. تنظیمات **عمومی** ساخت (در GitHub Actions Secrets):
  - `KANONHA_FCM_PROJECT_ID` — شناسه پروژه Firebase
  - `KANONHA_FCM_APP_ID` — Android App ID
  - `KANONHA_FCM_API_KEY` — کلید عمومی Firebase API
  - `KANONHA_FCM_SENDER_ID` — Project Number/Sender ID
- **محرمانه فقط روی سرور:** JSON حساب خدمت Firebase در Supabase Edge Functions Secrets با نام `KANONHA_FIREBASE_SERVICE_ACCOUNT_JSON`. JSON حساب خدمت، private key یا password را در GitHub، چت یا APK وارد نکنید.
- ساخت webhook در Supabase برای `public.kanonha_notification_deliveries` / event `INSERT` به `kanonha-fcm-delivery` با احراز هویت سروری. **تا اتصال Firebase و webhook فعال نشود، اعلان‌های بسته‌بودن اپ کار نمی‌کنند.**
- آزمون دستگاه Android 8 تا 16: نصب افزایشی امضاشده روی نسخه قبلی، حفظ داده محلی، ورود با دو کاربر واقعی، ثبت/تعویض توکن، اعلان در foreground/background/بسته‌بودن اپ، مجوز Android 13+، عدم نمایش اعلان حساب قبلی پس از خروج، آزمایش اثرانگشت و قطع شبکه.
- آزمون واقعی سه‌نقشی با حساب‌ها و کانون/رویدادهای مجاز: درخواست و تأیید عضویت، انتشار رویداد توسط دبیر، ثبت‌نام، بلیت QR، بررسی کنترل ورود زودهنگام، ثبت حضور، صدور PDF و استعلام QR. فایل `tests/live-three-role-e2e-v0931.sql` برای تراکنش بازگشتی آماده شده اما **اجرای نسخه اصلاح‌شدهٔ آن توسط محدودیت ابزار مسدود و هنوز آزموده نشده**. دو اجرای پیشین به‌ترتیب به‌درستی‌سنجی دانشگاه و column-level permissions برخورد کردند؛ داده دائمی تولید نکردند.
- بررسی تنظیم `Leaked Password Protection` در Supabase Auth و ممیزی ۱۱ RPC دارای `SECURITY DEFINER` پیش از عرضه گسترده.

## معیار پایان
فقط پس از موفقیت **دو CI اصلی روی یک SHA**، تنظیم واقعی FCM، آزمون اعلان روی حداقل دو دستگاه/حساب، آزمون چرخه رویداد تا استعلام گواهی واقعی، و بازبینی امنیت و حریم خصوصی می‌توان نسخه را «تکمیل و آزموده‌شده برای انتشار» دانست.
