# ChangeFlow — پروژهٔ عملی جلسهٔ اول

API مدیریت درخواست تغییر با **Node.js 22 + SQLite**، بدون وابستگی npm. این پوشه پاسخ
بخش دوم [تمرین](../Assignment.md) است؛ فایل‌های نمونهٔ کلاس و پنج HTML اصلی دست‌نخورده‌اند.

## اجرا در چند دقیقه

پیش‌نیاز: Node.js نسخهٔ 22.16 یا جدیدتر؛ محیط آزموده‌شده **22.23.4 روی Windows x64** است.
نصب package یا سرویس دیتابیس جدا لازم نیست. از ریشهٔ مخزن:

```powershell
cd Session01/Assignments/ChangeFlow
node --version
npm.cmd run build
npm.cmd test
npm.cmd run demo
```

در Bash از `npm` به‌جای `npm.cmd` استفاده کنید. `demo` یک دیتابیس موقت، کاربران با توکن
تصادفی و سرور محلی با پورت آزاد می‌سازد؛ گردش کامل و خطاهای حساس را روی **بستهٔ dist**
اجرا می‌کند، سپس سرور را می‌بندد و دوباره باز می‌کند تا دوام داده را بسنجد. اسرار را چاپ
نمی‌کند و دادهٔ موقت خودش را پاک می‌کند. قبل از demo، build لازم است.

برای اجرای همهٔ بررسی‌ها و ذخیرهٔ خروجی خام:

```powershell
npm.cmd run validate
# یا با نام جدا برای یک نوبت بررسی:
node scripts/validate.mjs my-run
```

`evidence/<name>-{build,test,demo}.txt` فرمان، خروجی، خطا و exit code را نگه می‌دارند؛ فایل
summary شامل زمان واقعی اجرا، نسخهٔ runtime، تعداد آزمون‌ها و SHA-256 سورس آزموده‌شده است.
Build در این پروژه یعنی syntax-check هفت ماژول اجرایی و ساخت پوشهٔ قابل اجرای `dist`؛
JavaScript به transpilation احتیاج ندارد. هشدار experimental مربوط به `node:sqlite` در
Node 22 مخفی نشده است. آزمون‌گیر در یک فرایند اجرا می‌شود، اما آزمون رقابت workerهای مستقل دارد.

## استفادهٔ دستی و دادهٔ پایدار

در ترمینال اول، از همین پوشه:

```powershell
npm.cmd start
```

سرور روی `http://127.0.0.1:3000` و دیتابیس `data/changeflow.sqlite` شروع می‌شود. در ترمینال
دوم، برای **اولین بار** کاربران را بسازید و توکن‌ها را در متغیر همان ترمینال نگه دارید:

```powershell
$tokens = node src/admin.mjs init-demo | ConvertFrom-Json
$owner = @{ Authorization = "Bearer $($tokens.carol)" }
$reviewer = @{ Authorization = "Bearer $($tokens.bob)" }
$base = 'http://127.0.0.1:3000/requests'
$content = @{ title = 'CSV export'; description = 'Export approved changes'; reason = 'Reduce manual work' }
$request = Invoke-RestMethod -Method Post -Uri $base -Headers $owner -ContentType 'application/json' -Body ($content | ConvertTo-Json)
$request = Invoke-RestMethod -Method Post -Uri "$base/$($request.id)/submit" -Headers $owner -ContentType 'application/json' -Body (@{ version = $request.version } | ConvertTo-Json)
$request = Invoke-RestMethod -Method Post -Uri "$base/$($request.id)/approve" -Headers $reviewer -ContentType 'application/json' -Body (@{ version = $request.version } | ConvertTo-Json)
$request
```

کاربران: `alice` و `dana` فقط Requester، `bob` فقط Reviewer، و `carol` هر دو نقش را دارند.
حتی carol نمی‌تواند درخواست خودش را تأیید کند. `init-demo` روی جمعیت موجود خطا می‌دهد؛
مجوز یا توکن لغوشده را بازنشانی نمی‌کند. برای ادامهٔ استفاده توکن صادرشده را امن نگه دارید؛
توکن خام قابل بازیابی از دیتابیس نیست و داخل مخزن ذخیره نشده است.

تنظیم‌ها: `CHANGEFLOW_DB` مسیر دیتابیس، `PORT` پورت و `HOST` آدرس bind هستند. مسیر پیش‌فرض
نسبت به پوشهٔ جاری است؛ سرور و CLI باید به **همان فایل** اشاره کنند. برای توقف Ctrl+C بزنید.
برای اجرای بستهٔ ساخته‌شده نیز `node dist/src/server.mjs` و `node dist/src/admin.mjs init-demo`
در دسترس‌اند.

اپراتور دارای دسترسی به فایل دیتابیس می‌تواند در ترمینال جدا اجرا کند:

```powershell
node src/admin.mjs set-roles bob none
node src/admin.mjs set-roles bob Reviewer
node src/admin.mjs revoke-tokens carol
node src/admin.mjs deactivate alice
```

این فرمان‌ها API عمومی نیستند. تغییرِ ثبت‌شده در عملیات بعدی مؤثر است؛ در رقابت، تراکنش‌ها
ترتیب اتمیک دارند. لغو نقش، تصمیمی را که قبلاً معتبر ثبت شده است به گذشته برنمی‌گرداند.

## قرارداد و طراحی

گردش: `Draft -> PendingReview -> Approved` یا
`PendingReview -> ChangesRequested -> PendingReview`.

| عملیات | مسیر |
|---|---|
| ایجاد / فهرست | POST / GET `/requests` |
| جزئیات / ویرایش | GET / PUT `/requests/{id}` |
| ارسال | POST `/requests/{id}/submit` |
| تأیید | POST `/requests/{id}/approve` |
| برگشت با دلیل | POST `/requests/{id}/request-changes` |

همهٔ مسیرهای داده توکن Bearer می‌خواهند. هر تغییر باید `version` آخرین نسخهٔ دیده‌شده را
داشته باشد؛ نسخهٔ قدیمی 409 می‌گیرد. پس از تعارض، داده را دوباره بخوانید و دوباره تصمیم
بگیرید؛ تأیید نسخهٔ جدید را خودکار تکرار نکنید. ایجاد تکراری دو درخواست مستقل می‌سازد.
جزئیات شکل JSON، خطاها، فیلتر مشاهده و محدودیت ورودی در
[قرارداد کامل](../../../specs/001-changeflow/contracts/http-api.md) است.

`domain.mjs` قواعد نقش/مالکیت/وضعیت را اجرا می‌کند؛ `application.mjs` آن‌ها را در تراکنش
هماهنگ می‌کند؛ `database.mjs` SQL و مهاجرت را نگه می‌دارد؛ `http.mjs` فقط پروتکل را مدیریت
می‌کند. مجوز فعلی و نسخه، زیر قفل تراکنش خوانده می‌شوند و UPDATE نیز شرط نسخه دارد.
تأیید نهایی هویت، زمان و نسخهٔ بررسی‌شده را ثبت می‌کند؛ محتوای Approved قابل ویرایش نیست.
دلیل انتخاب‌ها و مقایسهٔ گزینه‌ها در [Research](../../../specs/001-changeflow/research.md) است.

## اقلام تحویلی و شواهد

- [Constitution](../../../.specify/memory/constitution.md)، [Spec و فرض‌ها](../../../specs/001-changeflow/spec.md)، [Plan](../../../specs/001-changeflow/plan.md)، [مدل داده](../../../specs/001-changeflow/data-model.md)، [Tasks](../../../specs/001-changeflow/tasks.md).
- [Init](../../../specs/001-changeflow/reports/init.md)، [Analyze](../../../specs/001-changeflow/reports/analyze.md)، [Validation](../../../specs/001-changeflow/reports/validation.md)، [Traceability](../../../specs/001-changeflow/reports/traceability.md)، [Converge](../../../specs/001-changeflow/reports/converge.md).
- [پاسخ‌های مفهومی و ارتباط با HTMLها](docs/answers/session-01.md)، [خروجی‌های خام اجرا](evidence/).
- [مخزن موجود درس](https://github.com/oroumand/SoftwareEngineeringinArtificialIntelligenceEra). فایل‌های این تحویل در checkout محلی آماده‌اند؛ این کار commit/push یا انتشار نسخهٔ راه‌دور انجام نمی‌دهد.

Spec Kit 1.4.0 از قبل در ریشه نصب بود و همان skills/scripts استفاده شدند. برای ادامهٔ
workflow در clone جدید، از ریشه `$env:SPECIFY_FEATURE_DIRECTORY = 'specs/001-changeflow'`
را تنظیم کنید تا اسکریپت‌ها Feature را پیدا کنند. جزئیات اجرای واقعی در گزارش Init آمده است.

## محدودیت‌ها و نقش Agent

این نسخه API آموزشی محلی است: UI، حذف، اجرای واقعی تغییر، SSO، تاریخچهٔ کامل بازبینی،
token expiry، rate limit، TLS termination و استقرار اینترنتی ندارد. SQLite تک‌نویسنده است
و عملیات همگام می‌تواند event loop را هنگام انتظار قفل متوقف کند؛ ظرفیت تولیدی ادعا نشده است.
خطای storage با 503 و دادهٔ بدون تغییر پاسخ داده می‌شود؛ مصرف‌کننده باید وضعیت را دوباره بخواند.
ورودی‌ها و SQL با پارامتر پردازش می‌شوند، ولی دسترسی مستقیم اپراتور به فایل DB خارج از مرز API است.

Codex اسناد، کد، آزمون‌ها و گزارش‌ها را تهیه کرده و با استفاده از مهارت‌ها دو محور معماری و
انطباق با تمرین را بازبینی کرده است. پنج HTML مبنای تصمیم‌های معماری، فرض‌ها و تفاوت Validation
با Acceptance بوده‌اند. فرض‌ها تصمیم تأییدشدهٔ سازمان نیستند؛ نتیجهٔ پذیرش مدرس/مالک محصول
نیز توسط Agent ادعا نمی‌شود. آمار معتبر اجرای نهایی در گزارش Validation و فایل‌های evidence است.
