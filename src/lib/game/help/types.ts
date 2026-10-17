// FEMBOY WAR 🎀 — V14 (Task 15b): انواعِ رجیستریِ راهنما — برایِ موتور و ربات امن.

/** بلوکِ متنِ راهنما — h = عنوانِ اختیاریِ بلوک، lines = سطرهای متنِ فارسی */
export interface HelpBlock {
  h?: string
  lines: string[]
}

/** عبارتِ طبیعیِ پشتیبانی‌شده — عینِ همان که ربات می‌شناسد */
export interface HelpPhrase {
  fa: string
  en?: string
  where: "private" | "group" | "both"
}

/** یک موضوعِ کدکس — شناسه‌ی پایدار + دسته + متنِ کامل */
export interface HelpTopic {
  /** شناسه‌ی پایدارِ kebab-case — در دکمه‌های gh:t:{id} می‌نشیند */
  id: string
  /** شناسه‌ی دسته (cat) */
  cat: string
  /** ایموجیِ موضوع */
  icon: string
  titleFa: string
  titleEn: string
  /** خلاصه‌ی یک‌خطی برای منو/جست‌وجو */
  summaryFa: string
  /** بدنه‌ی تفصیلی — بلوک‌ها؛ ≤ ۱۰ بلوک (صفحه‌بندی در رندر) */
  blocks: HelpBlock[]
  /** شناسه‌ی موضوع‌های مرتبط — همه باید موجود باشند (اعتبارسنجی در export) */
  related?: string[]
  /** عبارت‌های دقیقِ پشتیبانی‌شده برای همین کار */
  phrases?: HelpPhrase[]
  /** مثال‌های عینیِ تعامل */
  examples?: string[]
  /** کلیدواژه‌های جست‌وجو (فارسی/انگلیسی) */
  keywords?: string[]
}

/** دسته‌ی کدکس — منویِ سطحِ یک */
export interface HelpCategory {
  id: string
  icon: string
  titleFa: string
  titleEn: string
  /** یک‌خطیِ توضیحِ دسته برای منویِ اصلی */
  descFa: string
  /** شناسه‌ی موضوع‌های این دسته به ترتیبِ نمایش */
  topics: string[]
}
