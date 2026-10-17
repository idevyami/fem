// FEMBOY WAR 🎀 — V13 (§8): حذفِ تکرارِ آپدیت‌های تلگرام.
// تلگرام گاهی یک update را دوبار می‌رساند (retry های getUpdates/رفت‌وبرگشتِ شبکه)؛
// بدونِ این لایه، هر دوبارِفرستی یعنی دو بار فرمان به موتور، دو بار خوش‌آمد،
// دو بار member_left — دقیقاً همان ریسکی که موجِ ۱ در کارلاگ هشدارش را داد.
//
// ساز‌و‌کار: LRU از update_id ها (پنجصدِ اخیر؛ از بزرگ‌ترین شناسه‌ها نگه می‌داریم
// چون تلگرام id ها را صعودی می‌دهد). globalThis-guarded تا bun --hot نسل‌های
// تازه را روی همان حافظه بگذارد، نه اینکه با هر ری‌لود از صفر شروع شود.
//
// توابع خالص‌اند و export می‌شوند تا اسکریپتِ تأییدِ آفلاین بتواند مستقیم
// ساز‌وکار را برانجامد؛ سازنده‌ی preloaded در ثبتِ میدل‌ور مصرف می‌شود.

const DEDUP_CAP = 500

export interface UpdateDedup {
  /** true = تازه (پردازشش کن) · false = تکراری (بی‌صدا ردش کن) */
  admit(updateId: number): boolean
  /** تعدادِ id های نگه‌داشته‌شده (برای تست/مشاهده) */
  size(): number
}

/** سازنده‌ی خالص — بدون وابستگی به globalThis؛ برای تست */
export function createUpdateDedup(cap = DEDUP_CAP): UpdateDedup {
  const seen = new Set<number>()
  const order: number[] = []
  return {
    admit(updateId: number): boolean {
      if (seen.has(updateId)) return false
      seen.add(updateId)
      order.push(updateId)
      if (order.length > cap) {
        const drop = order.shift()
        if (drop !== undefined) seen.delete(drop)
      }
      return true
    },
    size(): number {
      return order.length
    },
  }
}

const g = globalThis as typeof globalThis & { __femwarUpdateDedup?: UpdateDedup }

/** نمونه‌ی فرایند (hot-reload-safe) — میان‌برِ میدل‌ور */
export const updateDedup: UpdateDedup = g.__femwarUpdateDedup ?? createUpdateDedup()
g.__femwarUpdateDedup = updateDedup

/** آپدیتِ تکراری است؟ (خالص — برای میدل‌ور و تست)
 *  id نبود (ساختارِ ناشناخته) → هرگز تکراری نمی‌شماریم؛ پردازش ادامه می‌یابد. */
export function isDuplicateUpdate(updateId: number | undefined): boolean {
  if (updateId === undefined || !Number.isFinite(updateId)) return false
  return !updateDedup.admit(updateId)
}
