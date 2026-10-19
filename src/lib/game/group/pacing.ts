// FEMBOY WAR — V18: ریتمِ هوشمندِ رویدادهای گروهی (pacing).
//
// شهر عجله ندارد — دروازه‌ی واحدِ تولدِ هر ماجراست (خودجوشِ تیک، پیگیریِ
// زمان‌بندی‌شده و فرمانِ مستقیمِ شهروند، همه از همین دروازه رد می‌شوند):
//
//   • لاینِ سریع: حداقلِ ۲ ساعت + ۱۰۰ پیامِ گفت‌وگو از آخرین ماجرا (گروهِ زنده)
//   • لاینِ آرام: حداقلِ ۶ ساعت + ۳۰ پیام (رحمتِ شهرِ خواب‌آلود — ماجرا می‌میرد
//     ولی نادر می‌شود، نه صفر)
//   • شمارنده‌ی پیام‌ها (msgsSinceEvent) در observe بالا می‌رود و با تولدِ هر
//     ماجرا صفر می‌شود — فاصله با «نبضِ واقعیِ شهر» سنجیده می‌شود، نه با ساعتِ دیواری
//
// مهلتِ باز بودن (پنجره): هر نوعِ ماجرا پنجره‌ی خودش را دارد (۴۵ تا ۱۲۰ دقیقه؛
// پیش‌فرض ۷۵) — کسی عقب نمی‌ماند.
//
// همه‌ی توابع خالص‌اند (تست‌پذیر؛ V11)؛ فقط pacingOf ردیفِ زنده را می‌خواند.

import type { GroupWorld } from "@prisma/client"
import { cultureOf } from "./domain"
import { SEP, SUB, chip, toLatinDigits } from "./text"

// ─── ثابت‌های ریتم ─────────────────────────────────────────────────────────────

/** کفِ زمانیِ لاینِ سریع — دقیقه (۲ ساعت) */
export const EVENT_GAP_MINUTES = 120
/** سهمیه‌ی پیامِ لاینِ سریع — تعدادِ پیامِ گفت‌وگو از آخرین ماجرا */
export const EVENT_MSG_QUOTA = 100
/** کفِ زمانیِ لاینِ آرام — دقیقه (۶ ساعت؛ شهرِ خواب‌آلود) */
export const EVENT_SLOW_GAP_MINUTES = 360
/** سهمیه‌ی پیامِ لاینِ آرام */
export const EVENT_SLOW_MSG_QUOTA = 30

/** پنجره‌ی پیش‌فرضِ باز بودنِ ماجرا — دقیقه */
export const EVENT_WINDOW_DEFAULT = 75

/** پنجره‌ی هر جنس — جنس‌هایِ سریعِ شوخ ۴۵، معماهایِ عمیق ۱۲۰، بقیه ۷۵ */
const KIND_WINDOW_MINUTES: Record<string, number> = {
  chaos: 45,
  meme: 45,
  mystery: 120,
  world: 120,
}

/** پنجره‌ی باز بودنِ ماجرایِ این جنس — دقیقه */
export function eventWindowMinutes(kind: string): number {
  return KIND_WINDOW_MINUTES[kind] ?? EVENT_WINDOW_DEFAULT
}

// ─── دروازه‌ی ریتم ─────────────────────────────────────────────────────────────

export interface EventPacingInfo {
  /** دقیقه‌های گذشته از آخرین ماجرا */
  minutesSince: number
  /** پیام‌های گفت‌وگوی رد‌شده از آخرین ماجرا */
  msgsSince: number
  /** لاینِ بازِ فعلی — «closed» یعنی هنوز حقِ ماجرا نیست */
  lane: "fast" | "slow" | "closed"
  /** دروازه باز است؟ (لاینِ سریع یا آرام) */
  gateOpen: boolean
  /** دقیقه‌ی مانده تا کفِ زمانیِ لاینِ سریع (۰ = کف رد شده) */
  minutesLeftToGap: number
  /** پیامِ مانده تا سهمیه‌ی لاینِ سریع (۰ = سهمیه رد شده) */
  msgsLeftToQuota: number
}

/** دروازه‌ی ریتم — خالص (V11): (آخرین ماجرا، پیام‌های بعدش، الان) → تصمیم */
export function eventPacingInfo(lastEventAt: Date, msgsSinceEvent: number, now = new Date()): EventPacingInfo {
  const minutesSince = Math.max(0, Math.floor((now.getTime() - lastEventAt.getTime()) / 60000))
  const msgsSince = Math.max(0, Math.floor(msgsSinceEvent))
  const minutesLeftToGap = Math.max(0, EVENT_GAP_MINUTES - minutesSince)
  const msgsLeftToQuota = Math.max(0, EVENT_MSG_QUOTA - msgsSince)

  const fast = minutesLeftToGap === 0 && msgsLeftToQuota === 0
  // لاینِ آرام فقط وقتی لاینِ سریع باز نشده و شهر «قد جمع کرده» باشد
  const slow = !fast && minutesSince >= EVENT_SLOW_GAP_MINUTES && msgsSince >= EVENT_SLOW_MSG_QUOTA

  return {
    minutesSince,
    msgsSince,
    lane: fast ? "fast" : slow ? "slow" : "closed",
    gateOpen: fast || slow,
    minutesLeftToGap,
    msgsLeftToQuota,
  }
}

/** ریتمِ همین شهرِ زنده — شمارنده از cultureJson (msgsSinceEvent؛ نبود = ۰) */
export function pacingOf(group: GroupWorld, now = new Date()): EventPacingInfo {
  const c = cultureOf(group)
  const msgs = typeof c.msgsSinceEvent === "number" ? c.msgsSinceEvent : 0
  return eventPacingInfo(group.lastEventAt, msgs, now)
}

// ─── رندرهای ریتم (خالص) ───────────────────────────────────────────────────────

/** «چه چیزی مانده؟» — پاره‌جمله‌ی صادقانه‌ی نیازِ لاینِ سریع */
function needsPhrase(info: EventPacingInfo): string {
  if (info.minutesLeftToGap === 0 && info.msgsLeftToQuota === 0) return ""
  const parts: string[] = []
  if (info.minutesLeftToGap > 0) parts.push(`${chip(info.minutesLeftToGap)} دقیقه`)
  if (info.msgsLeftToQuota > 0) parts.push(`${chip(info.msgsLeftToQuota)} پیامِ گفت‌وگو`)
  return parts.join(" و ")
}

/** کارتِ «شهر نفس تازه می‌کشد» — جوابِ درخواستِ زودهنگامِ ماجرای شهروند (HTML) */
export function pacingCardText(info: EventPacingInfo): string {
  const needs = needsPhrase(info)
  const middle = needs
    ? `هنوز ${needs} مانده تا شهر دوباره ماجراجو شود.`
    : "شهر آماده است — همین حالا دوباره بگو."
  return [
    "⏳ <b>شهر نفس تازه می‌کشد</b>",
    SEP,
    "",
    `از آخرین ماجرا ${chip(info.minutesSince)} دقیقه و ${chip(info.msgsSince)} پیامِ گفت‌وگو گذشته.`,
    middle,
    "",
    SUB,
    "",
    `<i>قانونِ شهر: بینِ دو ماجرا حداقلِ ${chip(EVENT_GAP_MINUTES)} دقیقه و ${chip(EVENT_MSG_QUOTA)} پیام —`,
    `در شهرِ آرام‌تر ${chip(EVENT_SLOW_GAP_MINUTES)} دقیقه و ${chip(EVENT_SLOW_MSG_QUOTA)} پیام.`,
    `مهلتِ هر ماجرا هم ${chip(45)} تا ${chip(120)} دقیقه است؛ کسی عقب نمی‌ماند.</i>`,
  ].join("\n")
}

/** ack یک‌خطیِ PLAIN (توستِ کال‌بک/مینی‌اپ — بدونِ تگ، رقمِ لاتین) */
export function pacingAckText(info: EventPacingInfo): string {
  const plain = (n: number) => toLatinDigits(String(n))
  const parts: string[] = []
  if (info.minutesLeftToGap > 0) parts.push(`${plain(info.minutesLeftToGap)} دقیقه`)
  if (info.msgsLeftToQuota > 0) parts.push(`${plain(info.msgsLeftToQuota)} پیامِ گفت‌وگو`)
  if (parts.length === 0) return "شهر آماده‌ی ماجراست — دوباره بگو."
  return `شهر نفس تازه می‌کشد: ${parts.join(" و ")} دیگر.`
}

/** خطِ مهلتِ کارتِ ماجرا — «⏳ N دقیقه وقت داری.» (منقضی‌شده = بی‌خط) */
export function eventWindowLine(expiresAt: Date | null, now = new Date()): string {
  if (!expiresAt) return ""
  const mins = Math.ceil((expiresAt.getTime() - now.getTime()) / 60000)
  if (mins <= 0) return ""
  return `⏳ ${chip(mins)} دقیقه وقت داری.`
}
