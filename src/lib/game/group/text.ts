// FEMBOY WAR — V11: زبانِ بصریِ «شیشه» برای کارت‌های گروهیِ موتور.
// آینه‌یِ mini-services/bot/src/format.ts (سمتِ ربات) — همان قواعد، همان حس‌وحال.
// فقط نمایش؛ هیچ منطق بازی این‌جا نیست.
//
// قواعدِ زبانِ بصری:
//   • ارقام همه‌جا انگلیسی‌اند (faNum ← en-US؛ esc رقم‌های فارسی/عربیِ متنِ پویا را
//     هم لاتین می‌کند) — چون برچسبِ دکمه‌ها از لاتین‌سازیِ لحظه‌ی ارسالِ ربات رد
//     می‌شوند، منبعِ موتور باید خودش انگلیسی بفرستد.
//   • اعدادِ کلیدی داخلِ <code> تراش می‌خورند (chip) — تلگرام کد را LTR و مونو
//     رندر می‌کند؛ یعنی 4,000 · 45% · 3/5 همه‌جا ثابت و خوانا‌اند.
//   • فرمان‌ها با cmd() مونو می‌شوند: <code>/game</code>.
//   • رازها، حکم‌ها و شانس‌ها با spoiler() زیرِ پرده‌ی لمس‌و‌آشکا می‌روند.
//   • روایت‌های بلند با expand() جمع می‌شوند (blockquote expandable)؛ نقل‌قول‌ها quote.
//   • هدرِ هر کارت: «ایموجی عنوانِ بولد» + SEP ━━━؛ زیربخش‌ها با SUB ───؛ آیتم‌های
//     هم‌ردیف با DOTS · · ·؛ بینِ بلوک‌ها همیشه یک سطرِ خالی برای نفس‌کشیدن.
//
// لایه‌بندیِ متنِ گروه (مهم — parse error کلِ کارت را می‌کشد):
//   • متنِ outbox و کارت‌های فرمان: HTML تلگرام — متغیرها esc()، اعداد chip().
//   • ackText (توستِ کال‌بک) و برچسبِ دکمه‌ها: PLAIN — بدونِ هیچ تگی (توست و دکمه
//     parse_mode ندارند)؛ فقط رقمِ انگلیسی از faNum/toLatinDigits.

import { toLatinDigits } from "./domain"

export { esc, toLatinDigits } from "./domain"

const en = new Intl.NumberFormat("en-US")

/** جداساز ثابتِ بخش‌های اصلی — زیرِ هدرِ هر کارت */
export const SEP = "━━━━━━━━━━━━━━━━━━━━━━"

/** جداساز نازکِ زیربخش‌ها */
export const SUB = "──────────────────"

/** جداسازِ هواییِ نقطه‌ای — بینِ آیتم‌های هم‌ردیف */
export const DOTS = "· · · · · · · · · ·"

/** عدد با جداکننده‌ی هزارگانِ انگلیسی: 4000 → 4,000
 *  (نامِ تاریخی faNum حفظ شده تا فراخوانی‌های موجود دست‌نخورده بمانند؛
 *  V11: en-US — رقمِ فارسی دیگر از موتور بیرون نمی‌رود) */
export function faNum(n: number): string {
  return en.format(n)
}

/** تراشِ عددی/متنی مونو — تلگرام کد را LTR رندر می‌کند: <code>4,000</code> */
export function chip(v: number | string): string {
  return `<code>${typeof v === "number" ? faNum(v) : toLatinDigits(v)}</code>`
}

/** فرمانِ مونو — <code>/game</code> */
export function cmd(s: string): string {
  return `<code>${toLatinDigits(s)}</code>`
}

/** درصدِ تراش‌خورده — <code>45%</code> */
export function pct(n: number): string {
  return `<code>${Math.max(0, Math.min(100, Math.round(n)))}%</code>`
}

/** سِتِ هدرِ کارت: ["", "ایموجی <b>عنوان</b>", SEP] — با join("\n") نفس‌دار می‌شود */
export function head(emoji: string, title: string): string[] {
  return ["", `${emoji} <b>${title}</b>`, SEP]
}

/** اسپویلر — دیده نمی‌شود تا کاربر لمسش کند (راز، حکم، شانس…) */
export function spoiler(s: string): string {
  return `<tg-spoiler>${s}</tg-spoiler>`
}

/** نقل‌قولِ بازشدنی — متنِ بلند جمع می‌شود و با یک لمس باز می‌شود */
export function expand(s: string): string {
  return `<blockquote expandable>${s}</blockquote>`
}

/** نقل‌قولِ معمولی — حاشیه‌ی عمودیِ تلگرام */
export function quote(s: string): string {
  return `<blockquote>${s}</blockquote>`
}

/** چیپِ مهلتِ مانده — mm:ss (زیرِ یک ساعت) یا h:mm؛ رندرِ لحظه‌ای، کارت ایستاست.
 *  V15-1: از خصوصیِ presentation.ts به این‌جا آمد (primitiveِ متنی است) تا hub.ts
 *  هم بدونِ چرخه‌ی import بخواندش. */
export function remainChip(iso: string | null | undefined): string {
  if (!iso) return ""
  const ms = new Date(iso).getTime() - Date.now()
  if (!Number.isFinite(ms)) return ""
  if (ms <= 0) return chip("00:00")
  const min = Math.floor(ms / 60000)
  const two = (n: number) => String(n).padStart(2, "0")
  if (min >= 60) return chip(`${Math.floor(min / 60)}:${two(min % 60)}`)
  return chip(`${two(min)}:${two(Math.floor((ms % 60000) / 1000))}`)
}
