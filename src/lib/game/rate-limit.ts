// FEMBOY WAR 🎀 — محدودکننده‌ی نرخِ درخواست (حافظه‌ی محلی، بدون وابستگی بیرونی).
// برای مسیرهای حساس: ساخت بازیکن مهمان، لاگین، و اکشن‌های پرهزینه.
// پنجره‌ی لغزانِ ساده: برای هر کلید (مثلاً IP) فهرستِ زمان‌های ثبت‌شده را نگه می‌دارد.

type Bucket = number[]

const g = globalThis as typeof globalThis & { __femboyRateLimit?: Map<string, Bucket> }
const buckets: Map<string, Bucket> = g.__femboyRateLimit ?? new Map()
g.__femboyRateLimit = buckets

export interface RateLimitResult {
  allowed: boolean
  retryAfterSec: number
}

/** آیا این کلید در این پنجره اجازه دارد؟ (limit بار در windowMs میلی‌ثانیه) */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const list = buckets.get(key) ?? []
  const fresh = list.filter((t) => now - t < windowMs)
  if (fresh.length >= limit) {
    const oldest = fresh[0]
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)) }
  }
  fresh.push(now)
  buckets.set(key, fresh)
  // جمع‌آوری گاه‌به‌گاه تا Map بی‌کران نشود
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k)
    }
  }
  return { allowed: true, retryAfterSec: 0 }
}

/** IP فراخواننده — پشت گیت‌وی، x-forwarded-for معتبر است. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim()
  return req.headers.get("x-real-ip") || "local"
}
