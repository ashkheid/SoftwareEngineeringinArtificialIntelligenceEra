# مهندسی نرم‌افزار در عصر هوش مصنوعی

تمرین‌ها و نمونه‌های درس، با تمرکز بر توسعهٔ مبتنی بر مشخصات (SDD) و استفاده از Coding Agent.

## جلسهٔ اول — پاسخ تمرین‌ها

[صورت تمرین جلسهٔ اول](Session01/Assignments/Assignment.md) دو بخش دارد:

### بخش اول: سؤالات تشریحی

[پاسخ نهایی هر پنج سؤال](Session01/Assignments/descriptive-answers/session-01.md) در یک فایل گردآوری شده است؛ موضوع‌ها شامل Constitution، Specify/Clarify، تصمیم طراحی، Tasks/Analyze و Validation/Converge هستند.

### بخش دوم: پروژهٔ عملی ChangeFlow

ChangeFlow یک HTTP API با Node.js و SQLite برای ثبت، ارسال، بازبینی مستقل و تأیید درخواست تغییر است. تأیید درخواست خود، ویرایش درخواست تأییدشده و بازنویسی با نسخهٔ قدیمی رد می‌شوند.

- [راهنمای اجرا و تصمیم‌های اصلی](Session01/Assignments/ChangeFlow/README.md)
- [سورس API](Session01/Assignments/ChangeFlow/src/) و [آزمون‌ها](Session01/Assignments/ChangeFlow/tests/)
- [اسناد SDD](specs/001-changeflow/): مشخصات، فرض‌ها، طرح، تحقیق، مدل داده، قرارداد API و Taskها
- [گزارش اعتبارسنجی](specs/001-changeflow/reports/validation.md) و [چرخهٔ Converge](specs/001-changeflow/reports/converge.md)

خروجی بخش عملی در کامیت `4831e00` ثبت شده است. شواهد همان نسخه: ساخت موفق، **۳۹ آزمون موفق** و اجرای موفق سناریوی کامل روی بستهٔ ساخته‌شده، شامل بستن و بازکردن مجدد سرویس.

برای فهمیدن اینکه هر سند، تصمیم، فایل کد و آزمون چرا و چگونه ایجاد شده، [راهنمای قدم‌به‌قدم ساخت ChangeFlow با Spec Kit](Session01/Assignments/changeflow-walkthrough.html) را بخوانید. این فایل مستقل را پس از دریافت مخزن در مرورگر باز کنید؛ GitHub معمولاً سورس HTML را نمایش می‌دهد.
