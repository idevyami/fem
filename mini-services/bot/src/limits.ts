// FEMBOY WAR 🎀 — V13 (§6.4/§17): ضدسیل — محدودیتِ نرخِ فرمان‌ها و دکمه‌ها.
// بازیکنِ شلوغ نباید موتور یا چت را غرق کند: /play پشتِ‌سرِ‌سرِ‌هم یا کلیکِ
// سرکش روی دکمه‌ها → قبل از هر فراخوانیِ موتور متوقف می‌شود.
//
//   • فرمان‌ها: ≥ 2 ثانیه بینِ دو فرمان برای هر کاربر در هر چت — نقض = ردِ بی‌صدا.
//   • دکمه‌ها:  ≥ 300 میلی‌ثانیه بینِ دو کال‌بک برای هر کاربر در هر چت —
//               نقض = توستِ «کمی آهسته‌تر 🐢» و هیچ فراخوانیِ موتور.
//
// درون‌حافظه‌ای و globalThis-guarded (hot-reload روی همان جدول می‌نشیند)؛
// سقفِ اندازه با بیرون‌انداختنِ کهنه‌ترین کلید (ترتیبِ درج) نگه داشته می‌شود.
// کلید = «chatId:userId» — یعنی سقفِ سیل برای همان کاربر در همان چت؛ کاربرهای
// دیگر و چت‌های دیگر آزادند. توابع خالص export می‌شوند تا اسکریپتِ تأییدِ
// آفلاین بتواند مستقیم زمان‌بندی را برانجامد.

import type { Context } from "grammy"

const CMD_GAP_MS = 2_000 // فرمان‌ها: ≥ ۲ ثانیه
const CB_GAP_MS = 300 // دکمه‌ها: ≥ ۳۰۰ میلی‌ثانیه
const LIMITER_MAX_KEYS = 1_000 // سقفِ جدول — کهنه‌ترین‌ها بیرون می‌افتند

/** توستِ ضدسیلِ دکمه‌ها (PLAIN — توست HTML نمی‌فهمد؛ رقم انگلیسی ندارد) */
export const SLOW_DOWN_TOAST = "کمی آهسته‌تر 🐢"

export interface RateEntry {
  lastCmd: number
  lastCb: number
  cmdBurst: number // شمارِ نقض‌های پیاپیِ فرمان (مشاهده‌پذیری؛ بازنشانی با پذیرش)
}

export interface RateLimiter {
  /** فرمانِ تازه مجاز است؟ (نقض → false + شمارشِ burst) */
  allowCommand(key: string, now: number): boolean
  /** کال‌بکِ تازه مجاز است؟ (نقض → false) */
  allowCallback(key: string, now: number): boolean
  /** اندازه‌ی جدول (تست/مشاهده) */
  size(): number
}

/** سازنده‌ی خالص — برای تست؛ زمان از بیرون تزریق می‌شود */
export function createRateLimiter(cmdGapMs = CMD_GAP_MS, cbGapMs = CB_GAP_MS, maxKeys = LIMITER_MAX_KEYS): RateLimiter {
  const table = new Map<string, RateEntry>()
  const evict = (): void => {
    while (table.size > maxKeys) {
      const oldest = table.keys().next().value
      if (oldest === undefined) break
      table.delete(oldest)
    }
  }
  const entry = (key: string): RateEntry => {
    let e = table.get(key)
    if (!e) {
      e = { lastCmd: 0, lastCb: 0, cmdBurst: 0 }
      table.set(key, e)
      evict()
    }
    return e
  }
  return {
    allowCommand(key: string, now: number): boolean {
      const e = entry(key)
      if (now - e.lastCmd < cmdGapMs) {
        e.cmdBurst++
        return false
      }
      e.lastCmd = now
      e.cmdBurst = 0
      return true
    },
    allowCallback(key: string, now: number): boolean {
      const e = entry(key)
      if (now - e.lastCb < cbGapMs) return false
      e.lastCb = now
      return true
    },
    size(): number {
      return table.size
    },
  }
}

const g = globalThis as typeof globalThis & { __femwarRateLimiter?: RateLimiter }

/** نمونه‌ی فرایند (hot-reload-safe) — میان‌برِ میدل‌ورها */
export const rateLimiter: RateLimiter = g.__femwarRateLimiter ?? createRateLimiter()
g.__femwarRateLimiter = rateLimiter

/** کلیدِ سیلِ یک کنش — «chatId:userId»؛ نبودِ چت/کاربر = کلیدِ یگانه‌ی بی‌خطر */
export function rateKey(chatId: number | undefined, userId: number | undefined): string {
  return `${chatId ?? "?"}:${userId ?? "?"}`
}

// ─── میان‌برهای میدل‌ور (کلید را از ctx می‌سازند؛ زمان = حال) ─────────────────

/** فرمانِ این ctx مجاز است؟ — فقط متن‌های «/…» را می‌سنجد */
export function admitCommand(ctx: Context): boolean {
  const text = ctx.message?.text
  if (!text || !text.startsWith("/")) return true // غیرفرمان → آزاد (ناظرِ حضور خودش ضداسپم دارد)
  return rateLimiter.allowCommand(rateKey(ctx.chat?.id, ctx.from?.id), Date.now())
}

/** نیتِ بدونِ اسلش (V13 Part IV) — همان قاعده‌ی فرمان‌ها ولی بدونِ پیشوندِ «/»:
 *  هر نیتِ اجراشدنی از مسیریابِ نیت، قبل از هر فراخوانیِ موتور از این می‌گذرد. */
export function admitTextCommand(ctx: Context): boolean {
  return rateLimiter.allowCommand(rateKey(ctx.chat?.id, ctx.from?.id), Date.now())
}

/** کال‌بکِ این ctx مجاز است؟ — چت از پیامِ خودِ دکمه خوانده می‌شود */
export function admitCallback(ctx: Context): boolean {
  const cq = ctx.callbackQuery
  if (!cq) return true
  return rateLimiter.allowCallback(rateKey(cq.message?.chat?.id, cq.from.id), Date.now())
}
