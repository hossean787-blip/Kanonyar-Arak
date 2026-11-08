# راهنمای پنل دبیر کانون‌ها — نسخه ۰.۶.۰

پروژه مستقل: https://supabase.com/dashboard/project/cnqcysnjinghzzrzanpj

## وضعیت فنی
مهاجرت‌های kanonha_secretary_roles_events_members_attendance_v060، kanonha_secretary_event_roster_profile_access_v060 و kanonha_secretary_membership_decider_index_v060 روی پروژه اختصاصی Kanonha اعمال شدند. فایل‌های SQL متناظر در همین پوشه موجودند. پروژه دیگر بدون تغییر است.

## فعال‌سازی دبیر توسط مدیر مجاز
۱. دانشجو با ایمیل تأییدشده وارد اپ شود.
۲. مدیر مجاز یک کانون حقیقی و فعال تعریف کند.
۳. مدیر از Authentication شناسه حساب دانشجو و از جدول kanonha_clubs شناسه کانون واقعی را بخواند.
۴. فقط در SQL Editor خود پروژه Kanonha، پس از تأیید سمت دبیر، این دستور را با دو UUID واقعی اجرا کند:

    insert into public.kanonha_secretaries (club_id, user_id)
    values ('UUID_OF_APPROVED_CLUB','UUID_OF_VERIFIED_ACCOUNT')
    on conflict (club_id, user_id) do nothing;

۵. دبیر یک‌بار از اپ خارج شود و دوباره وارد شود. پنل در «حساب کاربری» ظاهر خواهد شد.

لغو سمت توسط مدیر مجاز:

    delete from public.kanonha_secretaries
    where club_id='UUID_OF_APPROVED_CLUB' and user_id='UUID_OF_VERIFIED_ACCOUNT';

هیچ فرم انتصاب یا حذف نقش در اپ دانشجویی تعبیه نشده است. کلید مدیریتی و service_role در APK قرار ندارند.

## قابلیت‌ها
دبیر فقط کانون‌های منصوب‌شده را مدیریت می‌کند: ویرایش نام و توضیحات، بررسی و تأیید/رد درخواست‌های عضویت، ساخت و انتشار رویداد، اصلاح رویداد بدون ثبت‌نام‌کننده، دیدن فهرست ثبت‌نام‌کنندگان و ثبت حضور پس از شروع رویداد. تصمیم عضویت و حضور با اطلاعات ممیزی و زمان سرور ذخیره می‌شوند.

## آزمون‌ها
آزمون روی دیتابیس حقیقی در تراکنش بازگشتی با چهار حساب و دو کانون موقت انجام شد: تأیید دسترسی صحیح دبیر، مسدودشدن انتصاب خودسرانه، جلوگیری از مدیریت کانون غیرمرتبط، خواندن فهرست مجاز و ثبت حضور. همه داده‌های مصنوعی با ROLLBACK حذف شدند.

آزمون‌های کد در GitHub Actions:
- node tests/secretary-backend-smoke.cjs
- node tests/secretary-ui-smoke.cjs
- node tests/live-api-smoke.cjs
- gradle :app:assembleDebug --no-daemon

## باقی‌مانده
هیچ حساب دبیر حقیقی منصوب نشده است. تأیید دانشگاهی شماره دانشجویی، بلیت QR قابل اعتبارسنجی، صدور گواهی، پرداخت و اپ مدیریتی مدیر اصلی هنوز پیاده‌سازی نشده‌اند. قبل از استفاده عمومی، تست دستگاه و آزمون با دو حساب واقعی ضروری است.
